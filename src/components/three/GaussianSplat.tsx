'use client';

/**
 * ============================================================================
 *  GaussianSplat — optimized R3F wrapper for @mkkellogg/gaussian-splats-3d
 * ============================================================================
 *
 * Uses `DropInViewer` (a THREE.Group whose callbackMesh.onBeforeRender drives
 * viewer.update() every frame). Optimisations vs drei <Splat>:
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
 * THREE.js 0.185+ compatibility: the DropInViewer's internal callbackMesh
 * relies on onBeforeRender to drive viewer.update(). In newer Three.js
 * versions this callback may not fire reliably for zero-area invisible meshes.
 * We now explicitly call viewer.update() every frame via useFrame as a
 * belt-and-suspenders fix.
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
  /** Called once the splat scene has finished loading successfully. */
  onLoaded?: (splatMesh: THREE.Mesh | null) => void;
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
 */
function enableCameraCulling(splatMesh: THREE.Mesh) {
  const mats = splatMesh.material;
  const list = Array.isArray(mats) ? mats : [mats];
  let patched = 0;
  list.forEach((m) => {
    const mat = m as THREE.ShaderMaterial;
    if (!mat.vertexShader || mat.userData.__cameraCulling) return;
    const IF_LINE =
      'if (clipCenter.z < -clip || clipCenter.x < -clip || clipCenter.x > clip || clipCenter.y < -clip || clipCenter.y > clip) {';
    if (mat.vertexShader.includes(IF_LINE)) {
      mat.vertexShader = mat.vertexShader.replace(
        IF_LINE,
        `if (clipCenter.z < -clip || clipCenter.x < -clip || clipCenter.x > clip || clipCenter.y < -clip || clipCenter.y > clip
                 || viewCenter.z > 0.0) {`
      );
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
  onLoaded,
}: GaussianSplatProps) {
  const containerRef = useRef<THREE.Group>(null);
  const viewerRef = useRef<DropInViewer | null>(null);
  const disposedRef = useRef(false);
  const loadedRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Bumped on context-loss → triggers viewer rebuild. */
  const [ctxRestoreEpoch, setCtxRestoreEpoch] = useState(0);

  const { gl: renderer, camera } = useThree();

  const quaternion = useMemo(() => eulerToQuat(rotation), [rotation]);
  const scaleVec = useMemo(() => normaliseScale(scale), [scale]);
  const iso = useMemo(() => isCrossOriginIsolated(), []);

  // ---- Manually drive the viewer's update loop every frame ----
  // Three.js 0.185 deprecated THREE.Clock and may not reliably fire
  // onBeforeRender for the DropInViewer's internal callback mesh.
  // Explicitly calling viewer.update() from useFrame guarantees splats
  // get sorted and rendered every frame.
  useFrame(() => {
    const dropInViewer = viewerRef.current as any;
    if (!dropInViewer || !loadedRef.current) return;
    try {
      // The inner viewer needs the renderer and camera passed explicitly.
      // DropInViewer wraps Viewer; the actual update method is on the inner viewer.
      if (dropInViewer.viewer && typeof dropInViewer.viewer.update === 'function') {
        dropInViewer.viewer.update(renderer, camera);
      } else if (typeof dropInViewer.update === 'function') {
        dropInViewer.update(renderer, camera);
      }
    } catch (err) {
      // Silently ignore update errors (e.g. during disposal)
    }
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
    loadedRef.current = false;
    setLoadError(null);

    console.info(`[GaussianSplat] creating viewer for: ${src} (iso=${iso})`);

    const viewer = new DropInViewer({
      selfDrivenMode: false,
      useBuiltInControls: false,
      rootElement: null,
      dropInMode: true,

      // Sorting: GPU-compute sort when the device tier allows it (offscreen
      // GL context — crashes iGPUs, hence the explicit opt-in), else the WASM
      // sort worker. gpuSort additionally requires cross-origin isolation.
      gpuAcceleratedSort: gpuSort && iso,
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
      renderMode: 1,               // Always
      sceneRevealMode: iso ? 1 : 2, // Gradual if SAB, else Instant
    });

    viewerRef.current = viewer;
    containerRef.current.add(viewer as unknown as THREE.Object3D);

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
            loadedRef.current = true;
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
              if (cameraCulling) enableCameraCulling(splatMesh);
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
      loadedRef.current = false;
      clearTimeout(timer);
      if (viewerRef.current) {
        viewerRef.current.dispose().catch(() => {});
        viewerRef.current = null;
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

