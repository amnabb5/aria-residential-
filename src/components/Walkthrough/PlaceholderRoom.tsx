'use client';

/**
 * PlaceholderRoom — procedural stand-in for a real apartment GLB.
 *
 * Built from Three.js primitives so the walkthrough is fully functional today.
 * Lives behind the SAME swap interface as a real GLB (see <ApartmentModel />),
 * so flipping USE_PLACEHOLDER_MODELS to false later is the only change needed.
 *
 * Layout (matches the spawn point in src/config/apartments.ts):
 *   - Room interior: 6 (x) × 6 (z) × 2.4 (y)
 *   - Doorway on the +Z wall (front wall, z = +3), centered, 1.0 wide × 2.0 tall
 *   - Player spawns at [0, 0.9, 2.2] facing -Z (into the room)
 *
 * The accent wall hue is derived from the apartment key so different units feel
 * subtly different even though the geometry is shared.
 */
import { useMemo } from 'react';
import * as THREE from 'three';

interface PlaceholderRoomProps {
  apartmentKey: string;
}

const ROOM = {
  w: 6, // x
  d: 6, // z
  h: 2.4, // y
  wall: 0.1,
  doorWidth: 1.0,
  doorHeight: 2.0,
};

/** Deterministic accent hue (0–360) from an apartment key like "3-A". */
function accentHueForKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function PlaceholderRoom({ apartmentKey }: PlaceholderRoomProps) {
  const accentHue = useMemo(() => accentHueForKey(apartmentKey), [apartmentKey]);
  const accentColor = useMemo(
    () => new THREE.Color(`hsl(${accentHue}, 32%, 58%)`),
    [accentHue]
  );

  // Shared materials (memoized).
  const mats = useMemo(() => {
    return {
      wall: new THREE.MeshStandardMaterial({ color: '#ece9e3', roughness: 0.95 }),
      accentWall: new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.95,
      }),
      floor: new THREE.MeshStandardMaterial({ color: '#b08968', roughness: 0.7 }),
      ceiling: new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 1 }),
      sofa: new THREE.MeshStandardMaterial({ color: '#5b7c7a', roughness: 0.85 }),
      table: new THREE.MeshStandardMaterial({ color: '#8a5a3b', roughness: 0.6 }),
      bed: new THREE.MeshStandardMaterial({ color: '#d8d3c8', roughness: 0.9 }),
      rug: new THREE.MeshStandardMaterial({ color: '#c98a5e', roughness: 0.95 }),
      window: new THREE.MeshStandardMaterial({
        color: '#bfe0f0',
        emissive: '#bfe0f0',
        emissiveIntensity: 0.7,
        roughness: 0.3,
      }),
    };
  }, [accentColor]);

  const { w, d, h, wall, doorWidth, doorHeight } = ROOM;
  const halfW = w / 2;
  const halfD = d / 2;

  // Front-wall segments around the doorway (door centered at x=0).
  const sideWidth = (w - doorWidth) / 2; // 2.5
  const sideCenterX = halfW - sideWidth / 2; // 1.75
  const lintelH = h - doorHeight; // 0.4
  const lintelY = doorHeight + lintelH / 2; // 2.2

  return (
    <group>
      {/* ---- Floor ---- */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        material={mats.floor}
      >
        <planeGeometry args={[w, d]} />
      </mesh>

      {/* ---- Ceiling ---- */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, h, 0]}
        material={mats.ceiling}
      >
        <planeGeometry args={[w, d]} />
      </mesh>

      {/* ---- Back wall (accent) ---- */}
      <mesh position={[0, h / 2, -halfD]} material={mats.accentWall} receiveShadow>
        <boxGeometry args={[w, h, wall]} />
      </mesh>

      {/* ---- Left wall ---- */}
      <mesh position={[-halfW, h / 2, 0]} material={mats.wall} receiveShadow>
        <boxGeometry args={[wall, h, d]} />
      </mesh>

      {/* ---- Right wall ---- */}
      <mesh position={[halfW, h / 2, 0]} material={mats.wall} receiveShadow>
        <boxGeometry args={[wall, h, d]} />
      </mesh>

      {/* ---- Front wall with doorway (z = +halfD) ---- */}
      {/* Left segment */}
      <mesh
        position={[-sideCenterX, h / 2, halfD]}
        material={mats.wall}
        receiveShadow
      >
        <boxGeometry args={[sideWidth, h, wall]} />
      </mesh>
      {/* Right segment */}
      <mesh
        position={[sideCenterX, h / 2, halfD]}
        material={mats.wall}
        receiveShadow
      >
        <boxGeometry args={[sideWidth, h, wall]} />
      </mesh>
      {/* Lintel above door */}
      <mesh position={[0, lintelY, halfD]} material={mats.wall} receiveShadow>
        <boxGeometry args={[doorWidth, lintelH, wall]} />
      </mesh>

      {/* ---- Window panels (emissive, faux daylight) ---- */}
      <mesh position={[-1.4, 1.45, -halfD + 0.06]} material={mats.window}>
        <planeGeometry args={[1.6, 1.2]} />
      </mesh>
      <mesh
        position={[halfW - 0.06, 1.45, 0]}
        rotation={[0, Math.PI / 2, 0]}
        material={mats.window}
      >
        <planeGeometry args={[1.6, 1.2]} />
      </mesh>

      {/* ---- Furniture placeholders ---- */}
      {/* Sofa against back wall (facing +Z into room) */}
      <group position={[-1.3, 0, -halfD + 0.6]}>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow material={mats.sofa}>
          <boxGeometry args={[2, 0.4, 0.9]} />
        </mesh>
        <mesh position={[0, 0.65, -0.35]} castShadow material={mats.sofa}>
          <boxGeometry args={[2, 0.5, 0.2]} />
        </mesh>
        <mesh position={[-1.05, 0.45, 0]} castShadow material={mats.sofa}>
          <boxGeometry args={[0.2, 0.3, 0.9]} />
        </mesh>
        <mesh position={[1.05, 0.45, 0]} castShadow material={mats.sofa}>
          <boxGeometry args={[0.2, 0.3, 0.9]} />
        </mesh>
      </group>

      {/* Rug */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0.4, 0.012, -0.6]}
        material={mats.rug}
      >
        <planeGeometry args={[3, 3]} />
      </mesh>

      {/* Coffee table */}
      <mesh
        position={[0.4, 0.2, -0.6]}
        castShadow
        receiveShadow
        material={mats.table}
      >
        <boxGeometry args={[1.2, 0.4, 0.6]} />
      </mesh>

      {/* Bed against right wall */}
      <group position={[halfW - 1.0, 0, 1.4]}>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow material={mats.bed}>
          <boxGeometry args={[1.6, 0.4, 2]} />
        </mesh>
        <mesh position={[-0.4, 0.5, -0.7]} castShadow material={mats.bed}>
          <boxGeometry args={[0.7, 0.15, 0.5]} />
        </mesh>
      </group>
    </group>
  );
}
