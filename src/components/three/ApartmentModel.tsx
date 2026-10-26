'use client';

/**
 * ApartmentModel — the single swap point for the apartment-interior model.
 *
 * Resolution logic for a given apartment key (e.g. "3-A"):
 *   1. USE_PLACEHOLDER_MODELS === true
 *        → render the procedural <PlaceholderRoom /> (works for every apartment)
 *   2. USE_PLACEHOLDER_MODELS === false AND a real GLB is mapped
 *        → render <GLTFModel path={url} />
 *   3. USE_PLACEHOLDER_MODELS === false AND no GLB is mapped yet
 *        → render a <ComingSoon /> marker (the parent shows an HTML overlay)
 *
 * This guarantees the app NEVER crashes on an unmapped apartment — it either
 * shows the placeholder room or a friendly "Coming soon" notice.
 */
import { Suspense, useEffect } from 'react';
import { PlaceholderRoom } from '@/components/Walkthrough/PlaceholderRoom';
import { GLTFModel } from './GLTFModel';
import { GaussianSplat } from './GaussianSplat';
import {
  USE_PLACEHOLDER_MODELS,
  resolveApartmentModelUrl,
} from '@/config/assets';
import { INTERIOR_NORMALIZE, type SpawnConfig } from '@/config/apartments';

interface ApartmentModelProps {
  apartmentKey: string;
  spawn?: SpawnConfig;
  /** Called with true when this apartment has no model available (coming soon). */
  onComingSoon?: (comingSoon: boolean) => void;
  /** GPU-accelerated splat sort opt-in (high-end GPU tier only). */
  gpuSort?: boolean;
}

export function ApartmentModel({ apartmentKey, spawn, onComingSoon, gpuSort = false }: ApartmentModelProps) {
  // Resolve the model path once per render (pure — no side effects).
  const usePlaceholder = USE_PLACEHOLDER_MODELS;
  const url = usePlaceholder ? null : resolveApartmentModelUrl(apartmentKey);
  const comingSoon = !usePlaceholder && !url;

  // Notify the parent from an effect. Calling onComingSoon (a parent setState)
  // directly during render is illegal in React ("Cannot update a component
  // while rendering a different component") and used to log a console error.
  useEffect(() => {
    onComingSoon?.(comingSoon);
  }, [comingSoon, onComingSoon]);

  // Path 1: placeholders — always render the procedural room.
  if (usePlaceholder) {
    return (
      <Suspense fallback={null}>
        <PlaceholderRoom apartmentKey={apartmentKey} />
      </Suspense>
    );
  }

  // Path 3: no real model mapped yet.
  if (!url) {
    return <ComingSoonMarker />;
  }

  const isSplat =
    url.toLowerCase().endsWith('.splat') ||
    url.toLowerCase().endsWith('.ksplat') ||
    url.toLowerCase().endsWith('.ply');
  return (
    <Suspense fallback={null}>
      {/*
        INTERIOR_NORMALIZE compensates for modern_apartment_interior.glb being
        exported in millimetres with an off-origin pivot. Scale 0.001 (mm→m)
        + recenter position so the room sits at the scene origin, matching the
        spawn point in apartments.ts.
      */}
      {isSplat ? (
        <GaussianSplat
          src={url}
          debugLabel="apartment"
          alphaThreshold={0.1}
          scale={1}
          rotation={[Math.PI, Math.PI, 0]}
          position={spawn?.position ?? [0, 0, 0]}
          // Draw AFTER the exterior city splat (renderOrder 1 in
          // WalkthroughScene). Splat scenes composite via alpha blending,
          // not the depth buffer: the room drawn last naturally occludes
          // the city through walls while windows stay see-through.
          renderOrder={2}
          gpuSort={gpuSort}
          // Skip splats behind the eye before rasterization; this removes no
          // visible detail and is especially helpful for the interior capture.
          cameraCulling
        />
      ) : (
        <GLTFModel
          path={url}
          scale={INTERIOR_NORMALIZE.scale}
          position={INTERIOR_NORMALIZE.position}
        />
      )}
    </Suspense>
  );
}

/**
 * Invisible marker placed in the scene so the walkthrough still has a
 * navigable (empty) space. The HTML "Coming soon" overlay is rendered by
 * the parent WalkthroughScene based on the onComingSoon callback.
 */
function ComingSoonMarker() {
  return (
    <group>
      {/* Minimal floor so the player isn't floating in void. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#e7e5e4" />
      </mesh>
    </group>
  );
}
