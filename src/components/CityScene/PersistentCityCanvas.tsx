'use client';

/**
 * PersistentCityCanvas — a SINGLE <Canvas> that stays mounted across LANDING,
 * CITY_ORBIT, and ZOOM_TRANSITION stages.
 *
 * WHY: previously two separate <Canvas> components existed (LandingScene +
 * CityExperience). When the user toggled between Landing and "Choose Apartment",
 * the old canvas unmounted (GPU resources destroyed) and the new one mounted
 * (re-download, re-decode, re-upload of the 41 MB GLB + 18 MB HDRI). Now the
 * model + HDRI load ONCE and persist until the user enters WALKTHROUGH (which
 * needs its own canvas for Gaussian splats).
 *
 * Camera behaviour changes with the stage:
 *   LANDING          → scroll-driven keyframe interpolation (ported from LandingScene)
 *   CITY_ORBIT       → OrbitControls with auto-rotate (ported from CameraDirector)
 *   ZOOM_TRANSITION  → GSAP tween toward the facade (ported from CameraDirector)
 *
 * Mobile optimisations (all quality-neutral):
 *   • DPR capped at [0.65, 0.9] (imperceptible on small screens)
 *   • Antialiasing disabled
 *   • Stencil buffer disabled
 *   • powerPreference: 'high-performance'
 *   • frameloop 'demand' during landing (scroll-driven invalidation)
 *   • Extra lights (directional + hemisphere) skipped on mobile
 *   • On-demand rendering when idle (no continuous loop during LANDING scroll)
 */
import { Suspense, useEffect, useMemo, useRef, useState, Component, type ErrorInfo, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, Preload, useProgress } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import gsap from 'gsap';
import * as THREE from 'three';
import { useAppStore, landingCameraRef, type Stage } from '@/state/useAppStore';
import { MainBuildingModel } from '@/components/three/MainBuildingModel';
import { LoadingOverlay } from '@/components/three/LoadingOverlay';
import { CameraReporter, DebugHUD } from '@/components/debug/DebugHUD';
import { HDRI_PATH, resolveHdriPath } from '@/config/assets';
import { getRenderProfile, isMobileDevice, isIOS } from '@/config/perf';
import { BUILDING_CONFIG, floorWorldY } from '@/config/apartments';
import {
  rooflineAt,
  onCityHeightfieldReady,
  CAMERA_CLEARANCE,
} from '@/components/CityScene/cityHeightfield';

THREE.ColorManagement.enabled = true;

// ─── Scroll-driven camera keyframes ──────────────────────────────────────────
interface Keyframe {
  progress: number;
  pos: [number, number, number];
  target: [number, number, number];
  label: string;
}
// TOUR CAMERA FIX ("it enters houses and blocks the view"): the path's XZ
// movement and every look-target are EXACTLY as they were — only the heights
// were adjusted (raised a bit where the previous values grazed rooftops or
// flew through the mid-rise blocks along the Gallery→Contact line). On top
// of these keyframes the scroll camera applies the roofline guard (see
// UnifiedCameraController / cityHeightfield.ts) so it can never dip inside
// any building, whatever the interpolated position is.
const KEYFRAMES: Keyframe[] = [
  { progress: 0.0, pos: [161.1, 37.58, 10.93], target: [77.09, 67.22, -1.63], label: 'Hero' },
  { progress: 0.2, pos: [122, 37, 76],          target: [77, 67, -2],          label: 'About' },
  { progress: 0.4, pos: [42, 30, 59],           target: [77, 40, -2],          label: 'Amenities' },
  { progress: 0.6, pos: [-50, 75, -10],         target: [77, 50, -2],          label: 'Location' },
  { progress: 0.8, pos: [30, 54, -85],          target: [77, 60, -2],          label: 'Gallery' },
  { progress: 1.0, pos: [130, 48, -85],         target: [77, 60, -2],          label: 'Contact' },
];

function lerpKF(a: Keyframe, b: Keyframe, t: number, out: Keyframe): Keyframe {
  out.pos[0] = THREE.MathUtils.lerp(a.pos[0], b.pos[0], t);
  out.pos[1] = THREE.MathUtils.lerp(a.pos[1], b.pos[1], t);
  out.pos[2] = THREE.MathUtils.lerp(a.pos[2], b.pos[2], t);
  out.target[0] = THREE.MathUtils.lerp(a.target[0], b.target[0], t);
  out.target[1] = THREE.MathUtils.lerp(a.target[1], b.target[1], t);
  out.target[2] = THREE.MathUtils.lerp(a.target[2], b.target[2], t);
  return out;
}

function keyframeAt(progress: number, out: Keyframe): Keyframe {
  const kfs = KEYFRAMES;
  if (progress <= kfs[0].progress) return Object.assign(out, kfs[0]);
  if (progress >= kfs[kfs.length - 1].progress)
    return Object.assign(out, kfs[kfs.length - 1]);
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (progress >= a.progress && progress <= b.progress) {
      const t = (progress - a.progress) / (b.progress - a.progress);
      return lerpKF(a, b, t, out);
    }
  }
  return Object.assign(out, kfs[0]);
}

// ─── Camera constants ────────────────────────────────────────────────────────
const ORBIT_CAMERA_DEFAULT: [number, number, number] = [161.1, 37.58, 10.93];
const ORBIT_TARGET: [number, number, number] = [77.09, 67.22, -1.63];
const ORBIT_FOV = isMobileDevice() ? 62 : 50;
const ORBIT_AUTOROTATE_SPEED = 0.4;
const ZOOM_DURATION = 2.4;
const ZOOM_FOV_END = 35;
const FACADE_OFFSET = 30;

/**
 * Render the optimized mobile city model on the landing page as well as on
 * desktop. MainBuildingModel selects the smaller phone GLB and mobile canvas
 * settings keep its GPU cost within the phone profile.
 */
const MOBILE_3D_ON_LANDING = true;

// ─── Detect mobile once ──────────────────────────────────────────────────────
function useIsMobile() {
  const [m] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768)
  );
  return m;
}

// ─── Unified camera controller (lives INSIDE the Canvas) ─────────────────────
function UnifiedCameraController({
  scrollProgressRef,
}: {
  scrollProgressRef: React.MutableRefObject<number>;
}) {
  const { camera, invalidate } = useThree();
  const stage = useAppStore((s) => s.stage);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const setStage = useAppStore((s) => s.setStage);
  const debug = useAppStore((s) => s.debug);

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const lookTarget = useRef(new THREE.Vector3(...ORBIT_TARGET));
  const tweenRef = useRef<gsap.core.Timeline | null>(null);

  // Scroll-camera scratch refs (avoid per-frame allocation).
  const smoothP = useRef(0);
  const kfScratch = useRef<Keyframe>({
    progress: 0, pos: [0, 0, 0], target: [0, 0, 0], label: '',
  });
  const scratchPos = useRef(new THREE.Vector3());
  const scratchTarget = useRef(new THREE.Vector3());
  const settleDistanceSq = 0.01 * 0.01;

  /** Track which stage we're coming FROM so we can do one-time transitions. */
  const prevStageRef = useRef<Stage>(stage);

  // Listen for the custom landing-scroll event to invalidate the demand canvas.
  useEffect(() => {
    const onScroll = () => invalidate();
    window.addEventListener('landing-scene-scroll', onScroll);
    return () => window.removeEventListener('landing-scene-scroll', onScroll);
  }, [invalidate]);

  // When the roofline map finishes building (async, after the GLB decodes)
  // re-render once so the guard can lift the camera where needed.
  useEffect(() => onCityHeightfieldReady(() => invalidate()), [invalidate]);

  // ── Initial camera setup ──────────────────────────────────────────────────
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = ORBIT_FOV;
    cam.near = 0.5;
    cam.far = 3000;
    if (stage === 'CITY_ORBIT' || stage === 'LANDING_TO_CITY_TRANSITION') {
      cam.position.set(...ORBIT_CAMERA_DEFAULT);
      lookTarget.current.set(...ORBIT_TARGET);
    } else {
      cam.position.set(...KEYFRAMES[0].pos);
      lookTarget.current.set(...ORBIT_TARGET);
    }
    cam.updateProjectionMatrix();
    cam.lookAt(lookTarget.current);

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(lookTarget.current);
      controls.update();
    }
  }, [camera, stage]);

  // ── Stage-transition logic ────────────────────────────────────────────────

  // LANDING → CITY_ORBIT: hand off camera smoothly
  useEffect(() => {
    if (stage !== 'CITY_ORBIT' && stage !== 'LANDING_TO_CITY_TRANSITION') return;
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = ORBIT_FOV;
    cam.updateProjectionMatrix();

    // If we came from WALKTHROUGH or remounted, position at default orbit
    if (
      prevStageRef.current === 'WALKTHROUGH' ||
      prevStageRef.current === 'ZOOM_TRANSITION' ||
      prevStageRef.current === 'CITY_ORBIT'
    ) {
      cam.position.set(...ORBIT_CAMERA_DEFAULT);
      lookTarget.current.set(...ORBIT_TARGET);
      cam.lookAt(lookTarget.current);
    }
    // else (from LANDING): camera is already where the scroll left it — don't snap.

    // Sync OrbitControls target
    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(lookTarget.current);
      controls.update();
    }

    prevStageRef.current = stage;
    invalidate();
  }, [stage, camera, invalidate]);

  // CITY_ORBIT → LANDING: publish camera position for the scroll camera to pick up.
  useEffect(() => {
    if (stage !== 'LANDING') return;
    const cam = camera as THREE.PerspectiveCamera;
    // Snap the scroll progress smoothed value to the beginning when returning
    smoothP.current = scrollProgressRef.current;
    prevStageRef.current = stage;
    cam.fov = ORBIT_FOV;
    cam.updateProjectionMatrix();
    invalidate();
  }, [stage, camera, invalidate, scrollProgressRef]);

  // ZOOM_TRANSITION: kick off the GSAP tween
  useEffect(() => {
    if (stage !== 'ZOOM_TRANSITION' || !selectedFloor) return;
    prevStageRef.current = stage;

    const cam = camera as THREE.PerspectiveCamera;
    const floorY = floorWorldY(selectedFloor);
    const fx = BUILDING_CONFIG.facadeTarget[0];
    const fz = BUILDING_CONFIG.facadeTarget[2];

    const dx = ORBIT_CAMERA_DEFAULT[0] - fx;
    const dz = ORBIT_CAMERA_DEFAULT[2] - fz;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len;
    const nz = dz / len;

    const endPos = {
      x: fx + nx * FACADE_OFFSET,
      y: floorY,
      z: fz + nz * FACADE_OFFSET,
    };
    const endTarget = { x: fx, y: floorY, z: fz };

    const tl = gsap.timeline({
      defaults: { duration: ZOOM_DURATION, ease: 'power2.inOut' },
      onUpdate: () => invalidate(),
      onComplete: () => setStage('WALKTHROUGH'),
    });

    tl.to(cam.position, endPos, 0);
    tl.to(lookTarget.current, endTarget, 0);
    tl.to(
      cam,
      { fov: ZOOM_FOV_END, onUpdate: () => cam.updateProjectionMatrix() },
      0
    );

    tweenRef.current = tl;
    return () => {
      tl.kill();
      tweenRef.current = null;
    };
  }, [stage, selectedFloor, camera, setStage, invalidate]);

  // ── Per-frame logic ─────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const currentStage = useAppStore.getState().stage;
    const currentDebug = useAppStore.getState().debug;

    // ZOOM_TRANSITION: just keep looking at the tweened target.
    if (currentStage === 'ZOOM_TRANSITION') {
      camera.lookAt(lookTarget.current);
      return;
    }

    // CITY_ORBIT: OrbitControls handle everything (via makeDefault).
    if (currentStage === 'CITY_ORBIT' || currentStage === 'LANDING_TO_CITY_TRANSITION') {
      return;
    }

    // LANDING: scroll-driven camera (skip if debug — OrbitControls take over).
    if (currentStage === 'LANDING' && !currentDebug) {
      const dt = Math.min(delta, 0.05);
      smoothP.current = THREE.MathUtils.damp(
        smoothP.current,
        scrollProgressRef.current,
        6,
        dt
      );
      const kfNow = keyframeAt(smoothP.current, kfScratch.current);

      scratchPos.current.set(kfNow.pos[0], kfNow.pos[1], kfNow.pos[2]);
      scratchTarget.current.set(kfNow.target[0], kfNow.target[1], kfNow.target[2]);

      // ROOFLINE GUARD (tour anti-clipping): the keyframed altitude is a
      // floor, not a promise — if the local city roofline under the camera
      // is higher, the camera glides up to clear it (+4u margin). The XZ
      // path and look-targets stay exactly as designed; only Y adapts, and
      // through the same damped integrator as everything else, so the
      // motion still feels like one continuous shot.
      const roof = rooflineAt(scratchPos.current.x, scratchPos.current.z);
      if (roof > 0) {
        scratchPos.current.y = Math.max(
          scratchPos.current.y,
          roof + CAMERA_CLEARANCE
        );
      }

      const cam = camera as THREE.PerspectiveCamera;
      const cameraSettled =
        cam.position.distanceToSquared(scratchPos.current) < settleDistanceSq &&
        lookTarget.current.distanceToSquared(scratchTarget.current) < settleDistanceSq;
      if (cameraSettled) return;

      cam.position.x = THREE.MathUtils.damp(cam.position.x, kfNow.pos[0], 5, dt);
      // Y damps toward the GUARDED altitude (keyframe vs roofline, whichever
      // is higher) — so the camera glides over buildings instead of through
      // them, with the same easing as the rest of the rig.
      cam.position.y = THREE.MathUtils.damp(cam.position.y, scratchPos.current.y, 5, dt);
      cam.position.z = THREE.MathUtils.damp(cam.position.z, kfNow.pos[2], 5, dt);
      lookTarget.current.x = THREE.MathUtils.damp(lookTarget.current.x, kfNow.target[0], 5, dt);
      lookTarget.current.y = THREE.MathUtils.damp(lookTarget.current.y, kfNow.target[1], 5, dt);
      lookTarget.current.z = THREE.MathUtils.damp(lookTarget.current.z, kfNow.target[2], 5, dt);
      cam.lookAt(lookTarget.current);

      // Publish for hand-off to CITY_ORBIT.
      landingCameraRef.current = {
        position: [cam.position.x, cam.position.y, cam.position.z],
        target: [lookTarget.current.x, lookTarget.current.y, lookTarget.current.z],
      };
      invalidate();
    }
  });

  // ── OrbitControls: rendered only during CITY_ORBIT ──────────────────────────
  return (
    <>
      {(stage === 'CITY_ORBIT' || stage === 'LANDING_TO_CITY_TRANSITION') && (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={debug}
          autoRotate={!debug}
          autoRotateSpeed={ORBIT_AUTOROTATE_SPEED}
          enableDamping
          dampingFactor={0.08}
          minDistance={debug ? 0.1 : 40}
          maxDistance={debug ? 5000 : 260}
          minPolarAngle={debug ? 0 : Math.PI * 0.12}
          maxPolarAngle={debug ? Math.PI : Math.PI * 0.52}
        />
      )}

      {/* Debug-mode orbit on landing so you can find keyframe coordinates. */}
      {stage === 'LANDING' && debug && (
        <DebugOrbitLanding lookTarget={lookTarget} />
      )}
    </>
  );
}

/** Debug-mode orbit controls on landing (unlocked). */
function DebugOrbitLanding({
  lookTarget,
}: {
  lookTarget: React.MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<OrbitControlsImpl | null>(null);
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    controls.target.copy(lookTarget.current);
    controls.update();
  }, [lookTarget]);

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enablePan
      enableDamping
      dampingFactor={0.08}
      minDistance={0.1}
      maxDistance={5000}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
    />
  );
}

/**
 * Reports loading progress and 3D readiness to global store
 * so LandingBackground can display the luxury non-blocking status
 * and smoothly cross-fade to the 3D scene when ready.
 */
function SceneLoadTracker() {
  const { active, progress } = useProgress();
  const set3DReady = useAppStore((s) => s.set3DReady);
  const setSceneLoadProgress = useAppStore((s) => s.setSceneLoadProgress);

  useEffect(() => {
    setSceneLoadProgress(progress);
    if (!active && progress === 100) {
      const t = setTimeout(() => {
        set3DReady(true);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [active, progress, set3DReady, setSceneLoadProgress]);

  return null;
}

/**
 * Monitors WebGL context while the Canvas is actively mounted.
 * Cleans up cleanly on unmount without false-positive error flags.
 */
function WebGLContextWatcher() {
  const { gl } = useThree();
  const setWebglFailed = useAppStore((s) => s.setWebglFailed);

  useEffect(() => {
    const canvas = gl.domElement;
    let active = true;

    const onLost = (e: Event) => {
      // If unmounting, loseContext is called intentionally by R3F renderer disposal.
      // Do NOT flag this as a WebGL failure.
      if (!active) return;
      e.preventDefault();
      console.warn('[WebGL] Context lost unexpectedly while active.');
      setWebglFailed(true);
    };

    const onRestored = () => {
      if (!active) return;
      console.info('[WebGL] Context restored.');
      setWebglFailed(false);
    };

    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    return () => {
      active = false;
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl, setWebglFailed]);

  return null;
}

/**
 * Protects against WebGL crashes/OOM on constrained mobile devices.
 */
class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[WebGL Boundary] WebGL crashed or failed on mobile device:', error, errorInfo);
    useAppStore.getState().setWebglFailed(true);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

// ─── Main exported component ─────────────────────────────────────────────────
export default function PersistentCityCanvas() {
  const stage = useAppStore((s) => s.stage);
  const debug = useAppStore((s) => s.debug);
  const webglFailed = useAppStore((s) => s.webglFailed);
  const qualityTier = useAppStore((s) => s.qualityTier);
  const isTabVisible = useAppStore((s) => s.isTabVisible);
  const tierConfig = QUALITY_TIERS[qualityTier] || QUALITY_TIERS.high;
  const isMobile = tierConfig.mobile;
  const hudRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);

  // Mobile landing uses the optimized phone model; other stages always show 3D.
  const show3D =
    stage !== 'LANDING' || !isMobile || MOBILE_3D_ON_LANDING;

  // Determine the frameloop mode:
  // - 'never' when tab/window is hidden (zero background GPU/battery drain)
  // - 'demand' during scroll-driven landing (only re-render on scroll events)
  // - 'always' during orbit/zoom/debug
  const frameloop: 'always' | 'demand' | 'never' =
    !isTabVisible
      ? 'never'
      : stage === 'LANDING' && !debug
        ? 'demand'
        : 'always';

  // ── Scroll progress tracking (only needed during LANDING) ─────────────────
  useEffect(() => {
    if (stage !== 'LANDING' || !show3D || webglFailed) return;
    let rafId = 0;

    const updateProgress = () => {
      rafId = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      scrollProgressRef.current = max > 0 ? window.scrollY / max : 0;
      window.dispatchEvent(new Event('landing-scene-scroll'));
    };

    const requestProgressUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateProgress);
    };

    requestProgressUpdate();
    window.addEventListener('scroll', requestProgressUpdate, { passive: true });
    window.addEventListener('resize', requestProgressUpdate);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', requestProgressUpdate);
      window.removeEventListener('resize', requestProgressUpdate);
    };
  }, [stage, show3D, webglFailed]);

  // If WebGL failed or is disabled, gracefully fall back
  if (!show3D || webglFailed) {
    if (stage === 'LANDING') return null; // LandingBackground handles landing
    return (
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#1a2333] via-[#0f1624] to-[#070b14]" />
    );
  }

  // ── z-index logic ──
  // LANDING: canvas behind content (z-0). CITY_ORBIT/ZOOM_TRANSITION: on top (z-40).
  const isLanding = stage === 'LANDING';

  return (
    <div
      className={`fixed inset-0 ${isLanding ? 'z-0' : 'z-40 bg-background'}`}
    >
      <WebGLErrorBoundary fallback={null}>
        <Canvas
          frameloop={frameloop}
          resize={isLanding ? { scroll: false, debounce: { scroll: 250, resize: 250 } } : undefined}
          dpr={tierConfig.dpr}
          gl={{
            antialias: tierConfig.antialias,
            alpha: false,
            depth: true,
            stencil: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            powerPreference: 'default', // Never use high-performance on iOS Safari
            preserveDrawingBuffer: false,
          }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.92;
            gl.shadowMap.enabled = tierConfig.enableShadows;
          }}
          camera={{
            fov: ORBIT_FOV,
            near: 0.5,
            far: tierConfig.drawDistance,
            position: stage === 'CITY_ORBIT' ? ORBIT_CAMERA_DEFAULT : KEYFRAMES[0].pos,
          }}
        >
          <SceneLoadTracker />
          <WebGLContextWatcher />

          {/* HDRI environment — tier-selected resolution. */}
          <Environment
            files={tierConfig.hdriPath}
            background
            backgroundBlurriness={isLanding ? 0.03 : 0}
            environmentIntensity={1}
          />

          {/* Extra lights only when tier enables shadows on landing for stronger form. */}
          {tierConfig.enableShadows && isLanding && (
            <>
              <directionalLight
                position={[125, 180, 90]}
                intensity={1.1}
                color="#ffe3bd"
              />
              <hemisphereLight args={['#dfefff', '#5a5048', 0.22]} />
            </>
          )}

          <Suspense fallback={null}>
            <MainBuildingModel />
          </Suspense>

          <UnifiedCameraController scrollProgressRef={scrollProgressRef} />
          <CameraReporter hudRef={hudRef} />
          {/* Never Preload all on mobile/iOS — it causes massive instantaneous VRAM spike */}
          {!isMobile && <Preload all />}
        </Canvas>
      </WebGLErrorBoundary>

      {/* Only show modal loader outside landing, since LandingBackground handles landing progress */}
      {!isLanding && <LoadingOverlay />}
      <DebugHUD hudRef={hudRef} />
    </div>
  );
}
