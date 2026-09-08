'use client';

/**
 * MainBuildingModel — the single swap point for the main-building model.
 *
 *  - USE_PLACEHOLDER_MODELS === true  → <PlaceholderBuilding /> (procedural)
 *  - USE_PLACEHOLDER_MODELS === false → <GLTFModel path={MAIN_BUILDING_MODEL} />
 *
 * Drop your real main-building.glb into /public/models/ and flip the flag in
 * src/config/assets.ts — no other changes needed here.
 */
import { Suspense } from 'react';
import { PlaceholderBuilding } from '@/components/CityScene/PlaceholderBuilding';
import { GLTFModel } from './GLTFModel';
import { USE_PLACEHOLDER_MODELS, MAIN_BUILDING_MODEL } from '@/config/assets';

export function MainBuildingModel() {
  if (USE_PLACEHOLDER_MODELS) {
    return (
      <Suspense fallback={null}>
        <PlaceholderBuilding />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <GLTFModel path={MAIN_BUILDING_MODEL} />
    </Suspense>
  );
}
