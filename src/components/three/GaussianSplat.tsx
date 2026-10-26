'use client';

/**
 * ============================================================================
 *  GaussianSplat — optimized R3F wrapper for @mkkellogg/gaussian-splats-3d
 * ============================================================================
 *
 * Uses `DropInViewer` (a THREE.Group whose callbackMesh.onBeforeRender drives
 * viewer.update() during rendering). Optimisations vs drei <Splat>:
 *   ✓ Octree frustum culling  ✓ WASM sort worker  ✓ Half-precision covariances
 *   ✓ Intermediate data freed  ✓ Full splat count (zero decimation)
 *
 * IMPORTANT: gpuAcceleratedSort is DISABLED — it creates an offscreen WebGL
 * context for GPU-compute sorting, which causes "Context Lost" crashes on
 * integrated/virtualised GPUs. The WASM sort worker (sharedMemoryForWorkers)
 * handles sorting without a second GL context.
 *
 * Includes WebGL context-loss recovery: if the main GL context is lost and
 * restored, the viewer is rebuilt so splat textures are re-uploaded.
 *
 * The DropInViewer callback mesh has real geometry and is not frustum culled,
 * so its onBeforeRender callback updates the viewer before its splat mesh is
 * drawn. Do not also call viewer.update() from useFrame: that duplicates the
 * update on every moving-camera frame.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { DropInViewer } from '@mkkellogg/gaussian-splats-3d';
import * as THREE from 'three';

export interface GaussianSplatProps {
  src: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  alphaThreshold?: number;
  showLoadingUI?: boolean;
  /** Render order for sorting overlapping splats (lower draws first). */
  renderOrder?: number;
  /**
   * Enable GPU-accelerated sorting (offscreen-GL compute). Big sort-speedup
   * on capable GPUs, but crashes integrated/virtualised GPUs — only pass
   * true for the high-end tier (see getRenderProfile in config/perf.ts).
   */
  gpuSort?: boolean;
  /**
   * Opt into camera-based culling (behind-camera cull in the vertex shader;
   * extends the library's built-in per-splat frustum cull). Invisible to the
   * user — it only skips splats that could never rasterize correctly.
   */
  cameraCulling?: boolean;
  /**
   * REGION DELETE (city splats only): a axis-aligned rectangle in WORLD
   * (walkthrough/HUD) coordinates — `xMin..xMax` (right/left) × `zMin..zMax`
   * (front/back) — spanning ALL heights. Every splat inside that prism is
   * culled in the vertex shader: it is never rendered and never processed
   * (the asset itself is untouched). Use it to delete the capture's junk
   * backdrop "rectangle" that shows up when flying outside the city in
   * k-mode debug.
   *
   * The world→splat-shader-space mapping is derived at load time from the
   * splat mesh's world matrix, so the rectangle is expressed in the same
   * coordinates the DebugHUD shows.
   */
  cullRegion?: { xMin: number; xMax: number; zMin: number; zMax: number };
  /**
   * BEHIND-VIEW DELETE (city splats only): a FIXED world-space camera pose.
   * Every splat in the half-space BEHIND that view (opposite side of the
   * plane through `position` facing along the pose's forward direction) is
   * culled in the vertex shader — never rendered, never processed, all
   * heights. Use it to delete everything behind a viewpoint that the capture
   * shows as junk. If the WRONG half is deleted, add π to the rotation's y.
   */
  cullBehind?: { position: [number, number, number]; rotation: [number, number, number] };
  /** Called once the splat scene has finished loading successfully. */
  onLoaded?: (splatMesh: THREE.Mesh | null) => void;
}

interface PlaneCull {
  planePoint: THREE.Vector3;
  planeDir: THREE.Vector3;
}

const CULL_POSE_HELPER_EULER = new THREE.Euler(0, 0, 0, 'XYZ');
const CULL_POSE_HELPER_FORWARD = new THREE.Vector3(0, 0, -1);

/**
 * Converts a FIXED world-space camera pose into a half-space cull plane
 * expressed in the vertex shader's `splatCenter` space (via the splat mesh's
 * inverted world matrix — exact for any group nesting). "Behind" = the side
 * the pose is NOT looking at; those splats get deleted.
 */
function computePlaneCull(
  splatMesh: THREE.Mesh,
  pose: { position: [number, number, number]; rotation: [number, number, number] }
): PlaneCull | null {
  try {
    splatMesh.updateWorldMatrix(true, false);
    const toLocal = new THREE.Matrix4().copy(splatMesh.matrixWorld).invert();

    CULL_POSE_HELPER_EULER.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ');
    const forward = CULL_POSE_HELPER_FORWARD
      .copy(new THREE.Vector3(0, 0, -1))
      .applyEuler(CULL_POSE_HELPER_EULER);

    const worldPoint = new THREE.Vector3(pose.position[0], pose.position[1], pose.position[2]);
    const localPoint = worldPoint.clone().applyMatrix4(toLocal);
    const localAim = worldPoint.clone().add(forward).applyMatrix4(toLocal);
    const planeDir = localAim.sub(localPoint).normalize();

    console.info(
      `[GaussianSplat] behind-view delete: pose ${pose.position.join(', ')} rot ${pose.rotation.join(', ')} — ` +
        `deleting everything behind it (kept side: forward ≈ (${forward.x.toFixed(3)}, ${forward.y.toFixed(3)}, ${forward.z.toFixed(3)}))`
    );
    return { planePoint: localPoint, planeDir };
  } catch (err) {
    console.warn('[GaussianSplat] behind-view cull computation failed:', err);
    return null;
  }
}

/**
 * Converts a WORLD-space X/Z rectangle (all heights) into an AABB in the
 * vertex shader's `splatCenter` space, using the splat mesh's own world
 * matrix (inverted) — exact, regardless of how many group transforms nest
 * the splat (scale ×20, π-flips, per-floor offsets …).
 */
function computeRegionCull(
  splatMesh: THREE.Mesh,
  region: { xMin: number; xMax: number; zMin: number; zMax: number }
): { regionMin: THREE.Vector3; regionMax: THREE.Vector3 } | null {
  try {
    splatMesh.updateWorldMatrix(true, false);
    const toLocal = new THREE.Matrix4().copy(splatMesh.matrixWorld).invert();
    const HUGE = 1e6;
    const corner = new THREE.Vector3();
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    const xs = [region.xMin, region.xMax];
    const ys = [-HUGE, HUGE];
    const zs = [region.zMin, region.zMax];
    for (const x of xs) {
      for (const y of ys) {
        for (const z of zs) {
          corner.set(x, y, z).applyMatrix4(toLocal);
          min.min(corner);
          max.max(corner);
        }
      }
    }
    // Small pad so splats straddling the rectangle's border fall inside it.
    padRegionAabb(min, max, 1.0);
    console.info(
      `[GaussianSplat] region delete: world x[${region.xMin}, ${region.xMax}] z[${region.zMin}, ${region.zMax}] (all heights)` +
        ` → shader-space [${min.toArray().map((v) => v.toFixed(1))} … ${max.toArray().map((v) => v.toFixed(1))}]`
    );
    return { regionMin: min, regionMax: max };
  } catch (err) {
    console.warn('[GaussianSplat] region-cull computation failed:', err);
    return null;
  }
}

function padRegionAabb(min: THREE.Vector3, max: THREE.Vector3, amount: number) {
  min.x -= amount; min.y -= amount; min.z -= amount;
  max.x += amount; max.y += amount; max.z += amount;
}

function eulerToQuat(e: [number, number, number]): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2], 'XYZ'));
  return [q.x, q.y, q.z, q.w];
}

function normaliseScale(s: number | [number, number, number]): [number, number, number] {
  return typeof s === 'number' ? [s, s, s] : s;
}

/**
 * Camera-based culling patch for a splat mesh (see the `cameraCulling` prop).
 *
 * Adds ONE strictly invisible condition to the library's built-in per-splat
 * frustum cull, in the vertex shader:
 *
 *   • behind-camera cull — viewCenter.z > 0 (three.js looks down −Z). Splats
 *     behind the eye can wrap through the NDC math and would otherwise
 *     rasterize mirrored; culling them changes nothing visible and skips all
 *     downstream vertex + fragment work.
 *
 * IMPORTANT — no far-plane/distance culling: splat quads are constructed in
 * SCREEN SPACE from the projected center, which bypasses the rasterizer's
 * far-plane clipping. Splats therefore intentionally render at ANY distance,
 * and any distance threshold we impose would remove visibly rendered city.
 * (That exact mistake made the skyline disappear once — never again.)
 *
 * The full splat geometry is untouched — this only affects which splats get
 * processed per frame. Gracefully no-ops (console warning) if the library's
 * shader signature ever changes.
 *
 * `regionCull` (optional): deletes every splat inside a WORLD-space X/Z
 * prism (see the `cullRegion` prop) — the junk backdrop rectangle never
 * renders.
 */
function enableCameraCulling(
  splatMesh: THREE.Mesh,
  regionCull?: { regionMin: THREE.Vector3; regionMax: THREE.Vector3 },
  planeCull?: PlaneCull
) {
  const mats = splatMesh.material;
  const list = Array.isArray(mats) ? mats : [mats];
  let patched = 0;
  list.forEach((m) => {
    const mat = m as THREE.ShaderMaterial;
    if (!mat.vertexShader || mat.userData.__cameraCulling) return;
    const IF_LINE =
      'if (clipCenter.z < -clip || clipCenter.x < -clip || clipCenter.x > clip || clipCenter.y < -clip || clipCenter.y > clip) {';
    if (mat.vertexShader.includes(IF_LINE)) {
      let extraConditions = regionCull
        ? '\n         || any(lessThan(splatCenter, uCullRegionMin))' +
          '\n         || any(greaterThan(splatCenter, uCullRegionMax))'
        : '';
      let uniformPrepends = '';
      if (regionCull) {
        uniformPrepends += 'uniform vec3 uCullRegionMin;\nuniform vec3 uCullRegionMax;\n';
        mat.uniforms.uCullRegionMin = { value: regionCull.regionMin.clone() };
        mat.uniforms.uCullRegionMax = { value: regionCull.regionMax.clone() };
      }
      if (planeCull) {
        extraConditions +=
          '\n         || dot(splatCenter - uCullPlanePoint, uCullPlaneDir) < 0.0';
        uniformPrepends += 'uniform vec3 uCullPlanePoint;\nuniform vec3 uCullPlaneDir;\n';
        mat.uniforms.uCullPlanePoint = { value: planeCull.planePoint.clone() };
        mat.uniforms.uCullPlaneDir = { value: planeCull.planeDir.clone() };
      }
      if (!extraConditions) {
        // Nothing beyond the behind-camera cull — leave the shader as-is.
      }
      mat.vertexShader = mat.vertexShader.replace(
        IF_LINE,
        `if (clipCenter.z < -clip || clipCenter.x < -clip || clipCenter.x > clip || clipCenter.y < -clip || clipCenter.y > clip${extraConditions}
                 || viewCenter.z > 0.0) {`
      );
      if (uniformPrepends) {
        mat.vertexShader = uniformPrepends + mat.vertexShader;
      }
      mat.userData.__cameraCulling = true;
      mat.needsUpdate = true;
      patched++;
    }
  });
  if (patched === 0) {
    console.warn(
      '[GaussianSplat] camera-culling patch did not apply (shader signature changed?)'
    );
  }
}

function isCrossOriginIsolated(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof SharedArrayBuffer !== 'undefined' &&
    (window as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true
  );
}

export function GaussianSplat({
  src,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  alphaThreshold = 0.02,
  showLoadingUI = false,
  renderOrder = 0,
  gpuSort = false,
  cameraCulling = false,
  cullRegion,
  cullBehind,
  onLoaded,
}: GaussianSplatProps) {
  const containerRef = useRef<THREE.Group>(null);
  const viewerRef = useRef<DropInViewer | null>(null);
  const disposedRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Bumped on context-loss → triggers viewer rebuild. */
  const [ctxRestoreEpoch, setCtxRestoreEpoch] = useState(0);

  const { gl: renderer, camera } = useThree();

  const quaternion = useMemo(() => eulerToQuat(rotation), [rotation]);
  const scaleVec = useMemo(() => normaliseScale(scale), [scale]);
  const iso = useMemo(() => isCrossOriginIsolated(), []);

  /**
   * Re-apply the cull shader patch whenever the splat material has been
   * (re)built without it.
   *
   * WHY THIS EXISTS: SplatMesh.updateBuild() constructs a BRAND-NEW
   * ShaderMaterial every time it rebuilds — and the DropInViewer streams the
   * .ksplat in progressively (per-section), so the material is replaced
   * AFTER addSplatScene()'s promise resolves. A one-time patch at load time
   * is silently discarded, and the behind-camera/region culls never actually
   * run. Flagging the material with `__cameraCulling` and re-checking each
   * frame (one property read — free) re-patches any rebuilt material
   * immediately.
   */
  const ensureCullPatch = useCallback(() => {
    if (!cameraCulling && !cullRegion && !cullBehind) return;
    const dropInViewer = viewerRef.current as unknown as
      | { splatMesh?: THREE.Mesh | null }
      | null;
    const splatMesh = dropInViewer?.splatMesh as unknown as THREE.Mesh | null;
    if (!splatMesh?.material || disposedRef.current) return;
    const mats = Array.isArray(splatMesh.material) ? splatMesh.material : [splatMesh.material];
    for (const m of mats) {
      if ((m as THREE.ShaderMaterial).userData.__cameraCulling) continue;
      const regionCull = cullRegion ? computeRegionCull(splatMesh, cullRegion) : undefined;
      const planeCull = cullBehind ? computePlaneCull(splatMesh, cullBehind) : undefined;
      enableCameraCulling(splatMesh, regionCull ?? undefined, planeCull ?? undefined);
      break;
    }
  }, [cameraCulling, cullRegion, cullBehind]);

  // DropInViewer updates itself through its callback mesh immediately before
  // drawing. This hook only reapplies shader culling after progressive loads
  // rebuild the viewer's material.
  useFrame(() => {
    ensureCullPatch();
  });

  // ---- WebGL context-loss recovery ----
  // When the GL context is lost and then restored, all splat GPU textures are
  // destroyed. We listen for restore and rebuild the viewer.
  useEffect(() => {
    if (!renderer) return;
    const canvas = renderer.domElement;
    const onLost = (e: Event) => {
      console.warn('[GaussianSplat] WebGL context lost — will rebuild on restore');
      e.preventDefault(); // allow auto-restore
    };
    const onRestored = () => {
      console.info('[GaussianSplat] WebGL context restored — rebuilding viewer');
      setCtxRestoreEpoch((n) => n + 1);
    };
    canvas.addEventListener('webglcontextlost', onLost as EventListener);
    canvas.addEventListener('webglcontextrestored', onRestored as EventListener);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', onRestored as EventListener);
    };
  }, [renderer]);

  // ---- Create / re-create viewer on src change or context restore ----
  useEffect(() => {
    if (!containerRef.current) return;
    disposedRef.current = false;
    setLoadError(null);

    console.info(
      `[GaussianSplat] creating viewer for: ${src} (iso=${iso}, gpuSortRequested=${gpuSort} → wasm sort)`
    );

    const viewer = new DropInViewer({
      selfDrivenMode: false,
      useBuiltInControls: false,
      rootElement: null,
      dropInMode: true,

      // FIX (splats-invisible-after-Confirm): gpuAcceleratedSort MUST stay
      // off on @mkkellogg/gaussian-splats-3d v0.4.7. In that version the
      // GPU-sort path never uploads the splat centers to the sorter worker
      // (Viewer.addSplatBuffers only queues `preSortMessages` when
      // gpuAcceleratedSort is false), so the worker clamps every sort to
      // `splatRenderCount = 0` and SplatMesh.updateRenderIndexes leaves
      // `geometry.instanceCount = 0` — the scene loads "successfully" but
      // zero splats are ever drawn. This is exactly the "3D world splats
      // disappear after clicking Confirm" regression: devices with ≥8
      // logical cores get the high-end render profile (gpuSort=true), and
      // with the COOP/COEP headers set in next.config.ts the page is
      // cross-origin isolated, so `gpuSort && iso` evaluated true.
      // The SIMD WASM sort worker below is the reliable, off-thread path —
      // same visual output, every splat rendered. All other tier-based
      // optimization (DPR profiles, mobile asset selection, culling) is
      // untouched.
      gpuAcceleratedSort: false,
      sharedMemoryForWorkers: iso,
      enableSIMDInSort: true,
      // integerBasedSort stays OFF: per the library docs it can overflow on
      // large scenes (ours are 1.5M–3M splats) and cause sort artifacts.
      integerBasedSort: false,

      // Memory
      halfPrecisionCovariancesOnGPU: true,
      optimizeSplatData: true,
      freeIntermediateSplatData: true,
      inMemoryCompressionLevel: 0,
      sphericalHarmonicsDegree: 0,

      // Rendering
      renderMode: 1,               // OnChange
      sceneRevealMode: iso ? 1 : 2, // Gradual if SAB, else Instant
    });

    viewerRef.current = viewer;
    containerRef.current.add(viewer as unknown as THREE.Object3D);

    // FIX (splats-invisible-on-iOS-15.0–15.3): the Viewer constructor
    // force-disables sharedMemoryForWorkers on iOS < 16 while its worker
    // ALWAYS imports a `shared: true` WebAssembly.Memory. On iOS 15.0–15.3
    // that combination selects the non-shared WASM binary and instantiation
    // fails with "mismatch in shared state of memory" — the sorter never
    // boots, addSplatScene() never resolves and the splats stay invisible.
    // Re-asserting the flag post-construction (before addSplatScene) makes
    // the binary selection coherent again: shared-memory-capable WASM plus
    // the shared import it already passes. SAB is available here because the
    // app ships COOP/COEP headers (crossOriginIsolated === true). On every
    // other device this is a no-op (the value we assign equals what the
    // option above already resolved to).
    const innerViewer = (
      viewer as unknown as { viewer?: { sharedMemoryForWorkers?: boolean } }
    ).viewer;
    if (innerViewer && iso) {
      innerViewer.sharedMemoryForWorkers = true;
    }

    // Give the viewer access to the R3F renderer and camera so it can
    // render splats into the correct context (required when selfDrivenMode
    // is false and the library's internal renderer reference is null).
    try {
      if (typeof viewer.setRenderer === 'function') {
        viewer.setRenderer(renderer);
      }
      if (typeof viewer.setCamera === 'function') {
        viewer.setCamera(camera);
      }
    } catch {
      // Older library versions may not expose these methods — safe to ignore.
    }

    const alphaRemoval = Math.round(alphaThreshold * 255);

    // Small delay lets the GL context stabilise after creation/restore.
    const timer = setTimeout(() => {
      if (disposedRef.current) return;
      console.info(`[GaussianSplat] loading scene: ${src}`);
      viewer
        .addSplatScene(src, {
          position,
          rotation: quaternion,
          scale: scaleVec,
          splatAlphaRemovalThreshold: alphaRemoval,
          showLoadingUI,
        })
        .then(() => {
          if (!disposedRef.current) {
            console.info(`[GaussianSplat] loaded: ${src} (iso=${iso})`);
            // NOTE: do NOT force depthWrite on the splat material. Splat
            // transparency is resolved by per-frame SORTING, not the depth
            // buffer — writing depth makes each splat punch holes that
            // flicker whenever the sort order changes with camera motion
            // (the library intentionally hard-codes depthWrite:false).
            //
            // Occlusion BETWEEN multiple splat scenes (e.g. room walls
            // hiding the city behind them) must instead be expressed via
            // renderOrder: draw the far scene first, the near scene last,
            // and let alpha blending composite them. See ApartmentModel
            // (room, high order) vs WalkthroughScene's ExteriorSplat
            // (city, low order).
            const splatMesh = viewer.splatMesh as unknown as THREE.Mesh | null;
            if (splatMesh) {
              splatMesh.renderOrder = renderOrder;
              // Apply (or re-apply) the cull patch immediately; the frame
              // loop re-applies it whenever the library rebuilds its material.
              ensureCullPatch();
            }
            onLoaded?.(splatMesh ?? null);
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[GaussianSplat] load FAILED: ${src}`, err);
          if (!disposedRef.current) setLoadError(msg);
        });
    }, 150);

    return () => {
      disposedRef.current = true;
      clearTimeout(timer);
      // Capture refs before clearing; the frame hook stops applying culling
      // patches as soon as the viewer ref is cleared.
      const deadViewer = viewerRef.current;
      const parent = containerRef.current;
      viewerRef.current = null;
      if (deadViewer) {
        // Dispose first, THEN remove from scene graph to avoid GPU texture
        // leaks (the old code removed synchronously while dispose ran async).
        deadViewer.dispose()
          .catch(() => {})
          .finally(() => {
            if (parent) {
              try { parent.remove(deadViewer as unknown as THREE.Object3D); } catch {}
            }
          });
      }
    };
  }, [src, ctxRestoreEpoch]);

  if (loadError) {
    return (
      <group>
        <mesh position={position}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshBasicMaterial color="red" wireframe />
        </mesh>
      </group>
    );
  }

  return <group ref={containerRef} />;
}

