'use client';

/**
 * WalkthroughScene — first-person interior walkthrough.
 *
 * Lighting is HDRI-ONLY:
 *   - No manual lights (ambient/hemisphere/directional/point) — removed per brief.
 *   - <Environment files={HDRI} background environmentIntensity={0.6} /> lights
 *     the space via image-based lighting AND shows the sky through window
 *     openings. Intensity is toned down to 0.6 so the interior isn't blown out
 *     (the exterior city scene keeps the default full intensity).
 *
 *   DECISION (flagged per brief): the HDRI IS set as the visible background
 *   here (background={true}) so that any window/opening in the apartment model
 *   shows the real sky rather than a flat void. The apartment.glb includes
 *   window materials and some exterior context, so showing the sky through
 *   openings looks correct. If your interior model is a fully sealed box with
 *   no window holes, this is a harmless no-op (the walls occlude the sky).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, PerformanceMonitor } from '@react-three/drei';
import { GaussianSplat } from '@/components/three/GaussianSplat';
import * as THREE from 'three';
import { useAppStore } from '@/state/useAppStore';
import {
  getApartmentKey,
  getApartment,
  getSpawnConfig,
  BUILDING_CONFIG,
  type SpawnConfig,
} from '@/config/apartments';
import { ApartmentModel } from '@/components/three/ApartmentModel';
import { WalkControls, type WalkInput } from './WalkControls';
import { MobileControls } from './MobileControls';
import { MotionControls } from './MotionControls';
import { LoadingOverlay } from '@/components/three/LoadingOverlay';
import { CameraReporter, DebugHUD } from '@/components/debug/DebugHUD';
import { HDRI_PATH, resolveHdriPath } from '@/config/assets';
import { getRenderProfile, QUALITY_TIERS } from '@/config/perf';
import { QualitySelector } from '@/components/ui/QualitySelector';
import { ArrowLeft, Move, MousePointer2, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SPLAT_TOP_FLOOR_POSITION: [number, number, number] = [-1, -4, -1];
const SPLAT_FIRST_FLOOR_Y = 7.103448275862068;
const EXTERIOR_SPLAT_GROUP_POSITION: [number, number, number] = [19.04, -15.97, 15.73];

/**
 * City backdrop seen through the apartment windows.
 *
 * CITY OPTIMIZATION APPROACH (applies to the CITY SPLAT ONLY — its own
 * material; the room, lighting, camera behavior and every other scene part
 * are untouched):
 * The FULL-QUALITY capture is the single, permanent city model — no decimated
 * copy is ever swapped in at runtime as the final render. Performance comes
 * from CAMERA-BASED CULLING of the full-quality splats instead:
 *
 *   • Frustum culling — the splat renderer's built-in per-splat viewport
 *     cull, extended (city material only) with a behind-camera cull. Every
 *     splat outside the camera's view is skipped, and this updates
 *     automatically as the camera moves or stops.
 *   • Occlusion — city splats hidden behind the apartment are simply
 *     overdrawn by the room (drawn later via renderOrder); per-splat
 *     occlusion queries aren't practical for splats.
 *   • NO distance culling, deliberately: splat quads are built in screen
 *     space and render beyond the camera's far plane by design, so ANY
 *     distance threshold would erase visibly rendered skyline.
 *
 * The geometry itself is never modified: same splat data, same materials,
 * same lighting, every frame — moving or still.
 */
const EXTERIOR_SPLAT_SRC = '/models/la_night_full.ksplat';
/**
 * PHONES get an alpha-weighted decimated city (scripts/decimate-splat-alpha.mjs):
 * every bright splat (city lights, key surfaces) is kept, dim splats are
 * randomly thinned — no stride banding, lights intact, ~1/3 the sort+fill
 * cost of the full capture. Phones also profit from portrait view: the
 * narrow horizontal FOV means the splat sorter culls most of the city
 * automatically. Desktop renders the full capture.
 * (Max-speed fallback: la_night_decimated.ksplat · max-quality: full.)
 */
const EXTERIOR_SPLAT_MOBILE_SRC = '/models/la_night_mobile.ksplat';
/**
 * PROGRESSIVE STREAMING (asset, not renderer, change):
 * While the tier's city splat (23–69 MB) streams in, the tiny 3.4 MB
 * decimated capture renders first as an instant low-res preview — the
 * skyline appears in ~1 s instead of blank for the full download. When the
 * full-quality splat finishes loading, the preview unmounts (disposing its
 * GPU data) and the high-fidelity capture takes over. The final render is
 * ALWAYS the tier's selected splat — this only fills the initial blank-by-fs
 * window with real content.
 */
const EXTERIOR_SPLAT_PREVIEW_SRC = '/models/la_night_decimated.ksplat';

/**
 * Adaptive DPR (60fps target, quality-neutral):
 *
 * The Canvas is created with the device profile's dpr RANGE
 * (see getRenderProfile in config/perf.ts) — R3F starts at the top of the
 * range, which is the full-quality setting. This component lets the runtime
 * DOWN-shift inside that range only while the measured frame rate cannot
 * hold ~55–60fps, and immediately restores full dpr when there is headroom
 * again. On capable devices the factor stays at 1 → the renderer NEVER
 * leaves its maximum quality; nothing is lost on desktop GPUs or newer
 * phones. This makes the existing per-tier dpr ranges (which were declared
 * but never actually adjusted at runtime) do their job.
 *
 * It deliberately touches ONLY the splat walkthrough's resolution scale —
 * splat content, sort behavior, culling, asset selection and all other
 * optimizations are untouched.
 */
/**
 * Adaptive DPR-ONLY resolution scaling.
 *
 * IMPORTANT: this component ONLY adjusts the pixel ratio within the
 * locked tier's DPR range. It does NOT shift the quality tier itself
 * (Ultra→High→Medium→Low) — doing so mid-walkthrough would re-download
 * HDRI/GLB/splat assets, causing a multi-second stutter. The tier is
 * locked on walkthrough entry (see WalkthroughScene below).
 */
function AdaptiveSplatResolution({ min, max }: { min: number; max: number }) {
  const setDpr = useThree((s) => s.setDpr);

  const clamp = (v: number) =>
    Math.round(THREE.MathUtils.clamp(v, min, max) * 100) / 100;

  return (
    <PerformanceMonitor
      ms={350}
      iterations={8}
      bounds={() => [45, 80]}
      onChange={({ factor }) => setDpr(clamp(min + (max - min) * factor))}
      flipflops={3}
      onFallback={() => setDpr(min)}
    />
  );
}

export default function WalkthroughScene() {
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const selectedUnit = useAppStore((s) => s.selectedUnit);
  const storeSpawn = useAppStore((s) => s.spawn);
  const backToOrbit = useAppStore((s) => s.backToOrbit);
  const debug = useAppStore((s) => s.debug);

  const inputRef = useRef<WalkInput>({
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
  });
  const hudRef = useRef<HTMLDivElement>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const apartmentKey = useMemo(
    () =>
      selectedFloor != null && selectedUnit != null
        ? getApartmentKey(selectedFloor, selectedUnit)
        : '',
    [selectedFloor, selectedUnit]
  );

  const spawn: SpawnConfig = useMemo(
    () =>
      storeSpawn ??
      (selectedFloor != null && selectedUnit != null
        ? getSpawnConfig(selectedFloor, selectedUnit)
        : { position: [3.9, 1.05, -4.02], rotation: [-0.03, 1.58, 0] }),
    [storeSpawn, selectedFloor, selectedUnit]
  );

  // Detect touch device for control scheme selection.
  useEffect(() => {
    const compute = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const touchCapable =
        'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const narrow = window.innerWidth <= 820;
      const mobileUA = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      setIsTouch(coarse || (touchCapable && narrow) || (mobileUA && narrow));
    };
    compute();
    const onResize = () => compute();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isTouch) return;
    const t = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(t);
  }, [isTouch]);

  const spec = getApartment(selectedFloor ?? 0, selectedUnit ?? '');
  const floorNumber = Math.min(
    BUILDING_CONFIG.floors,
    Math.max(1, selectedFloor ?? 1)
  );
  const floorProgress =
    BUILDING_CONFIG.floors > 1
      ? (floorNumber - 1) / (BUILDING_CONFIG.floors - 1)
      : 1;
  const splatPosition: [number, number, number] = [
    SPLAT_TOP_FLOOR_POSITION[0],
    SPLAT_FIRST_FLOOR_Y +
      (SPLAT_TOP_FLOOR_POSITION[1] - SPLAT_FIRST_FLOOR_Y) * floorProgress,
    SPLAT_TOP_FLOOR_POSITION[2],
  ];

  const qualityTier = useAppStore((s) => s.qualityTier);
  const isTabVisible = useAppStore((s) => s.isTabVisible);
  const tierConfig = QUALITY_TIERS[qualityTier] || QUALITY_TIERS.high;

  return (
    <div className="fixed inset-0 z-40 bg-[#1a1a1f]">
      <Canvas
        frameloop={isTabVisible ? 'always' : 'never'}
        dpr={tierConfig.dpr}
        gl={{
          antialias: tierConfig.antialias,
          toneMapping: THREE.ACESFilmicToneMapping,
          powerPreference: 'default',
        }}
        camera={{ fov: 62, near: 0.1, far: tierConfig.drawDistance, position: spawn.position }}
      >
        {/* HDRI environment — tier-selected resolution. */}
        <Environment files={tierConfig.hdriPath} background environmentIntensity={0.6} />

        {/* 60fps guard: adaptive resolution within this device's profile bounds. */}
        <AdaptiveSplatResolution
          min={tierConfig.dpr[0]}
          max={tierConfig.dpr[1]}
        />

        <ApartmentModel
          apartmentKey={apartmentKey}
          spawn={spawn}
          onComingSoon={setComingSoon}
          gpuSort={tierConfig.gpuSort}
        />

        {/* The city scene via Gaussian Splatting — Y shifts down with floor number.
            Tiers select the appropriate skyline budget (full / mobile / decimated). */}
        <ExteriorSplat
          position={splatPosition}
          gpuSort={tierConfig.gpuSort}
          src={tierConfig.citySplatSrc}
        />

        <WalkControls inputRef={inputRef} spawn={spawn} />
        <CameraReporter hudRef={hudRef} />
      </Canvas>

      <LoadingOverlay label="Loading apartment" />
      <DebugHUD hudRef={hudRef} />

      {/* Top bar: exit + apartment label + quality selector */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3 sm:p-4">
        <Button
          variant="secondary"
          size="sm"
          className="pointer-events-auto gap-1.5 bg-background/80 backdrop-blur-md"
          onClick={backToOrbit}
        >
          <ArrowLeft className="h-4 w-4" />
          Exit Walkthrough
        </Button>
        <div className="flex items-center gap-2">
          <QualitySelector />
          {spec && (
            <div className="pointer-events-none rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground/80 backdrop-blur-md sm:text-sm">
              {apartmentKey} · {spec.beds} bed · {spec.facing}
            </div>
          )}
        </div>
      </div>

      {/* Crosshair (hidden in debug free-fly mode for clarity) */}
      {!debug && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-white/70 shadow ring-1 ring-black/20" />
        </div>
      )}

      {/* Desktop control hint */}
      {!isTouch && showHint && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 animate-pulse">
          <div className="flex items-center gap-4 rounded-full bg-background/80 px-4 py-2 text-xs text-foreground/80 backdrop-blur-md">
            <span className="inline-flex items-center gap-1.5">
              <Move className="h-3.5 w-3.5" />
              {debug ? 'WASD/Arrows fly · drag to look' : 'WASD / Arrows to move'}
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="inline-flex items-center gap-1.5">
              <MousePointer2 className="h-3.5 w-3.5" />
              Drag to look
            </span>
          </div>
        </div>
      )}

      {/* Mobile hint */}
      {isTouch && showHint && (
        <div className="pointer-events-none absolute bottom-44 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-xs text-foreground/80 backdrop-blur-md">
            <Hand className="h-3.5 w-3.5" />
            Joystick or tilt to move · drag to look
          </div>
        </div>
      )}

      {isTouch && <MobileControls inputRef={inputRef} />}

      {/* Phone sensors: tilt to walk, rotate to look (adds to the joystick). */}
      {isTouch && <MotionControls inputRef={inputRef} />}

      {comingSoon && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-border/60 bg-background/90 p-6 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
              <Hand className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">Coming soon</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The 3D model for apartment{' '}
              <span className="font-medium text-foreground">{apartmentKey}</span>{' '}
              isn&rsquo;t available yet. You&rsquo;re exploring a preview space.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="pointer-events-auto mt-4"
              onClick={backToOrbit}
            >
              Choose another apartment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExteriorSplat({
  position,
  gpuSort = false,
  src = EXTERIOR_SPLAT_SRC,
}: {
  position: [number, number, number];
  gpuSort?: boolean;
  /** City backdrop asset — full quality on desktop, decimated on phones. */
  src?: string;
}) {
  // ── Progressive streaming ─────────────────────────────────────────────────
  // The tiny decimated capture renders first (instant skyline preview);
  // when the tier's real asset finishes loading, the preview unmounts and
  // its GPU data is disposed. If src IS the decimated asset (low tier),
  // there is nothing to preview — skip the duplicate entirely.
  const [fullLoaded, setFullLoaded] = useState(false);
  useEffect(() => {
    setFullLoaded(false);
  }, [src]);
  const showPreview = src !== EXTERIOR_SPLAT_PREVIEW_SRC && !fullLoaded;

  return (
    <group rotation={[0, Math.PI, 0]}>
      <group position={EXTERIOR_SPLAT_GROUP_POSITION}>
        <group position={position}>
          {showPreview && (
            <GaussianSplat
              key="splat-preview"
              src={EXTERIOR_SPLAT_PREVIEW_SRC}
              alphaThreshold={0.02}
              scale={20.0}
              rotation={[Math.PI, 0, 0]}
              renderOrder={0}
              gpuSort={gpuSort}
              cameraCulling
            />
          )}
          {/* The one and only final city model on this device: full-quality
              on desktop, phone-tuned backdrop on mobile. Perf comes from
              camera-based culling — and the culling patch applies to THIS
              splat's material only. */}
          <GaussianSplat
            key={src}
            src={src}
            alphaThreshold={0.02}
            scale={20.0}
            rotation={[Math.PI, 0, 0]}
            renderOrder={1}
            gpuSort={gpuSort}
            cameraCulling
            onLoaded={() => setFullLoaded(true)}
          />
        </group>
      </group>
    </group>
  );
}
