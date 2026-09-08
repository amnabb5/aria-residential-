'use client';

/**
 * WindowCityView — renders the city model as a distant background visible
 * through the apartment's windows, positioned at the selected floor's height.
 *
 * As the user picks different floors, the city appears at the correct vertical
 * perspective: a high floor shows the city far below, a low floor shows it at
 * eye level. The city is rendered on a separate <Canvas> layered behind the
 * apartment interior canvas, so window transparency reveals it.
 *
 * Implementation:
 *   - A dedicated R3F Canvas (background layer) renders ONLY the city model +
 *     HDRI sky.
 *   - The city model is offset DOWN by floorWorldY(selectedFloor) so that the
 *     apartment's local origin (y=0) sits at the real building's selected
 *     floor. From the apartment camera, the city's ground appears at
 *     -floorWorldY(floor) — high floors see deep ground, low floors see it near.
 *   - The HDRI sky is shared so lighting/color matches the city scene.
 */
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '@/state/useAppStore';
import { GLTFModel } from '@/components/three/GLTFModel';
import { MAIN_BUILDING_MODEL, HDRI_PATH } from '@/config/assets';
import { floorWorldY, BUILDING_CONFIG } from '@/config/apartments';

export function WindowCityView() {
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const floor = selectedFloor ?? 1;
  // Drop the city by the floor's world Y so the apartment origin matches that floor.
  const cityY = -floorWorldY(floor);

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
      camera={{ fov: 60, near: 0.5, far: 2000, position: [0, 0, 0] }}
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
    >

      {/* HDRI sky as background + lighting (matches the city scene). */}
      <Environment files={HDRI_PATH} background />

      <Suspense fallback={null}>
        {/*
          The city model is placed at the building's facade target XZ (so it's
          centered around the real building), offset DOWN by the floor height.
          We also nudge it back along Z so windows face into the city.
        */}
        <group
          position={[
            BUILDING_CONFIG.facadeTarget[0],
            cityY,
            BUILDING_CONFIG.facadeTarget[2],
          ]}
        >
          <GLTFModel path={MAIN_BUILDING_MODEL} />
        </group>
      </Suspense>
    </Canvas>
  );
}

// Suppress unused-import lint for THREE (kept for potential tone-mapping tweaks).
void THREE;
