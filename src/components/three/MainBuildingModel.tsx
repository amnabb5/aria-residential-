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
  MAIN_BUILDING_MODEL_MOBILE,
} from '@/config/assets';
import { getRenderProfile } from '@/config/perf';
import { buildCityHeightfield } from '@/components/CityScene/cityHeightfield';
import { DRACO_DECODER_PATH } from '@/config/assets';

export function MainBuildingModel() {
  // MOBILE-ONLY model tier (hard 1.5GB model-memory cap on phones):
  // phones load the texture-capped / re-welded variant; desktops load the
  // exact same GLB they always have — the desktop code path is untouched.
  // Detection is viewport/UA based (getRenderProfile → isMobileDevice),
  // never a device-RAM check.
  const modelPath = useMemo(() => {
    try {
      return getRenderProfile().mobile ? MAIN_BUILDING_MODEL_MOBILE : MAIN_BUILDING_MODEL;
    } catch {
      return MAIN_BUILDING_MODEL;
    }
  }, []);
  const isMobile = modelPath === MAIN_BUILDING_MODEL_MOBILE;

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
