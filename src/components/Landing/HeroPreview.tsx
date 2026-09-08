'use client';

/**
 * HeroPreview — a small embedded 3D preview of the building for the hero
 * section (the brief's "small embedded low-poly preview" option).
 *
 * Reuses the same <PlaceholderBuilding /> as the city scene so the hero stays
 * visually consistent. Lightweight: no shadows, capped DPR, slow auto-orbit.
 * Dynamically imported with ssr:false from <Hero /> to avoid SSR three.js work.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { PlaceholderBuilding } from '@/components/CityScene/PlaceholderBuilding';

function Spin() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.18;
  });
  return (
    <group ref={group}>
      <PlaceholderBuilding />
    </group>
  );
}

export default function HeroPreview() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 38, position: [16, 12, 16], near: 0.1, far: 100 }}
    >
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#ffffff', '#9aa6b2', 0.5]} />
      <directionalLight position={[8, 14, 6]} intensity={1.1} />
      {/* Minimal ground disc for context (no shadows → light). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial color="#2f3138" />
      </mesh>
      <Spin />
    </Canvas>
  );
}
