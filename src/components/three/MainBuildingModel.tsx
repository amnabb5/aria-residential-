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
import { Suspense, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { PlaceholderBuilding } from '@/components/CityScene/PlaceholderBuilding';
import { GLTFModel } from './GLTFModel';
import {
  USE_PLACEHOLDER_MODELS,
  MAIN_BUILDING_MODEL,
} from '@/config/assets';
import { QUALITY_TIERS } from '@/config/perf';
import { useAppStore } from '@/state/useAppStore';
import { buildCityHeightfield } from '@/components/CityScene/cityHeightfield';
import { DRACO_DECODER_PATH } from '@/config/assets';

export function MainBuildingModel() {
  const qualityTier = useAppStore((s) => s.qualityTier);
  const tierConfig = QUALITY_TIERS[qualityTier] || QUALITY_TIERS.high;
  const modelPath = tierConfig.cityBuildingModel || MAIN_BUILDING_MODEL;
  const isMobile = tierConfig.mobile;

  if (USE_PLACEHOLDER_MODELS) {
    return (
      <Suspense fallback={null}>
        <PlaceholderBuilding />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <CityModelGLB path={modelPath} disposeOnUnmount={isMobile} />
    </Suspense>
  );
}

/**
 * GLB host for the city model. Once the scene is available it feeds the
 * roofline heightfield used by the landing tour's anti-clipping guard
 * (see cityHeightfield.ts — keeps the camera above buildings without
 * changing the tour's movement).
 */
function CityModelGLB({ path, disposeOnUnmount }: { path: string; disposeOnUnmount: boolean }) {
  const { scene } = useGLTF(path, DRACO_DECODER_PATH);

  useEffect(() => {
    buildCityHeightfield(scene);
  }, [scene]);

  return <GLTFModel path={path} disposeOnUnmount={disposeOnUnmount} />;
}
