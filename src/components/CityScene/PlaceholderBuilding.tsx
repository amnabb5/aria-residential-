'use client';

/**
 * PlaceholderBuilding — procedural stand-in for the real main-building.glb.
 *
 * Built entirely from Three.js primitives so the app works today with zero
 * external assets. Lives behind the SAME swap interface as a real GLB
 * (see <MainBuildingModel />), so flipping USE_PLACEHOLDER_MODELS to false
 * later is the only change needed.
 *
 * Visual goals:
 *   - Clearly reads as a multi-floor residential tower (floor bands + windows)
 *   - Is obviously "the interactive one" (subtle emissive outline via <Edges>)
 *   - Highlights the currently-selected floor with a glowing band
 *   - Reads at the BUILDING_CONFIG scale so camera math stays consistent
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import { useAppStore } from '@/state/useAppStore';

// Local dimensions for the decorative placeholder building (used only by the
// landing hero preview now). Decoupled from BUILDING_CONFIG so config changes
// to the real-model coordinates never break this decorative element.
const HERO_FOOTPRINT = [4, 4] as [number, number];
const HERO_HEIGHT = 20;
const HERO_FLOORS = 20;
const HERO_FLOOR_H = HERO_HEIGHT / HERO_FLOORS;

/** Build a window-grid CanvasTexture for the building facades. */
function useWindowTexture() {
  return useMemo(() => {
    const cols = 4;
    const rows = HERO_FLOORS;
    const cellW = 64;
    const cellH = 48;
    const pad = 10;
    const canvas = document.createElement('canvas');
    canvas.width = cols * cellW;
    canvas.height = rows * cellH;
    const ctx = canvas.getContext('2d')!;

    // Building facade base color (warm concrete).
    ctx.fillStyle = '#c9c7c2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Faint vertical mullions.
    ctx.strokeStyle = '#a8a6a1';
    ctx.lineWidth = 2;
    for (let i = 0; i <= cols; i++) {
      const x = i * cellW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Windows per cell. Some lit (warm) for life.
    for (let r = 0; r < rows; r++) {
      // Floor slab band across the top of each row.
      ctx.fillStyle = '#b5b2ac';
      ctx.fillRect(0, r * cellH, canvas.width, 6);

      for (let c = 0; c < cols; c++) {
        const x = c * cellW + pad;
        const y = r * cellH + pad;
        const w = cellW - pad * 2;
        const h = cellH - pad * 2 - 4;
        const lit = Math.random() < 0.25;
        ctx.fillStyle = lit ? '#f4d9a0' : '#9fb4c4';
        ctx.fillRect(x, y, w, h);
        // glass reflection streak
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x, y, w * 0.35, h);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

/**
 * The main building mass. Sits at BUILDING_CONFIG.center, base on ground (y=0).
 */
export function PlaceholderBuilding() {
  const windowTex = useWindowTexture();
  const selectedFloor = useAppStore((s) => s.selectedFloor);

  const [w, h, d] = [HERO_FOOTPRINT[0], HERO_HEIGHT, HERO_FOOTPRINT[1]];

  // Clone the texture per-face set so we can tweak repeat independently is
  // overkill here; one texture on all four sides reads fine.
  const sideMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: windowTex,
        roughness: 0.85,
        metalness: 0.05,
      }),
    [windowTex]
  );
  const roofMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6b6a66',
        roughness: 0.9,
        metalness: 0.05,
      }),
    []
  );

  return (
    <group position={[0, 0, 0]}>
      {/* Main mass — materials array: [px, nx, py(top), ny(bottom), pz, nz] */}
      <mesh
        position={[0, h / 2, 0]}
        castShadow
        receiveShadow
        material={[
          sideMaterial,
          sideMaterial,
          roofMaterial,
          roofMaterial,
          sideMaterial,
          sideMaterial,
        ]}
      >
        <boxGeometry args={[w, h, d]} />
        {/* Subtle emissive outline so it reads as "the interactive building". */}
        <Edges threshold={15} color="#e8c07a" />
      </mesh>

      {/* Rooftop detail — a small penthouse box + an accent edge. */}
      <mesh position={[0, h + 0.25, 0]} castShadow>
        <boxGeometry args={[w * 0.4, 0.5, d * 0.4]} />
        <meshStandardMaterial color="#7a7873" roughness={0.9} />
      </mesh>

      {/* Selected floor highlight band — glowing horizontal slab. */}
      {selectedFloor && selectedFloor >= 1 && selectedFloor <= HERO_FLOORS && (
        <mesh position={[0, (selectedFloor - 0.5) * HERO_FLOOR_H, 0]}>
          <boxGeometry args={[w + 0.12, HERO_FLOOR_H * 0.92, d + 0.12]} />
          <meshStandardMaterial
            color="#f5b461"
            emissive="#f5b461"
            emissiveIntensity={0.65}
            transparent
            opacity={0.55}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * CitySurroundings — procedural context: ground + scattered surrounding
 * buildings. This is NOT part of the swappable main-building model (it's
 * ambient context). If your real main-building.glb already ships with its
 * own surroundings, you can delete this from the scene.
 */
const SURROUNDINGS = [
  // [x, z, w, h, d, color]
  [-12, -6, 3, 9, 3, '#9a9a96'],
  [-12, 2, 2.5, 6, 2.5, '#a6a6a2'],
  [-9, 9, 3.5, 12, 3.5, '#8e8e8a'],
  [-4, -12, 4, 7, 4, '#a0a09c'],
  [5, -12, 3, 10, 3, '#969692'],
  [11, -8, 3.5, 8, 3.5, '#a8a8a4'],
  [13, 1, 3, 13, 3, '#848480'],
  [12, 9, 2.5, 5, 2.5, '#aeaeaa'],
  [6, 12, 3.5, 9, 3.5, '#9c9c98'],
  [-2, 13, 3, 6, 3, '#a4a4a0'],
  [-8, 14, 2.5, 11, 2.5, '#90908c'],
  [8, -5, 2, 4, 2, '#b0b0ac'],
  [-14, -2, 2.2, 5, 2.2, '#a6a6a2'],
  [2, 6, 2, 3.5, 2, '#b4b4b0'],
] as const;

export function CitySurroundings() {
  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#3a3a40" roughness={1} metalness={0} />
      </mesh>

      {/* Surrounding context buildings */}
      {SURROUNDINGS.map((b, i) => {
        // Tuple: [x, z, w, h, d, color]
        const [x, z, w, h, d, color] = b;
        return (
          <mesh key={i} position={[x, h / 2, z]} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={color} roughness={0.92} />
          </mesh>
        );
      })}
    </group>
  );
}
