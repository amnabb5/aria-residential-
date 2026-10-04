'use client';

/**
 * GLTFModel — loads a real .glb scene via drei's useGLTF.
 *
 * This is the REAL-model code path. It is only reached when
 * USE_PLACEHOLDER_MODELS === false (see src/config/assets.ts).
 *
 * Uses DRACOLoader (via drei's useGLTF second arg) so Draco-compressed
 * GLBs load efficiently. drei's useGLTF also reports to THREE's
 * DefaultLoadingManager, so the shared <LoadingOverlay /> (which uses
 * drei's useProgress) works for free.
 */
import { useGLTF } from '@react-three/drei';
import { DRACO_DECODER_PATH } from '@/config/assets';
import { useEffect } from 'react';
import * as THREE from 'three';

/**
 * Any PBR-capable material. `MeshPhysicalMaterial` extends
 * `MeshStandardMaterial`, so this cast exposes both `isMeshStandardMaterial`
 * and `isMeshPhysicalMaterial` flags for the health check below.
 */
type PbrMaterial = THREE.MeshStandardMaterial & {
  isMeshPhysicalMaterial?: boolean;
};

interface GLTFModelProps {
  path: string;
  /** Optional scale to fit your model into the scene's unit system. */
  scale?: number | [number, number, number];
  /** Optional position offset (use if your GLB's origin isn't centered). */
  position?: [number, number, number];
  /** Optional rotation (radians). */
  rotation?: [number, number, number];
  /**
   * MOBILE memory cap: when true, every geometry/material/texture this model
   * uploaded is disposed and the drei useGLTF cache entry is dropped when the
   * component unmounts. Used ONLY on the mobile tier (see MainBuildingModel);
   * desktop keeps the persistent cache (unchanged behavior — returning from
   * the walkthrough re-shows the model without re-decoding).
   */
  disposeOnUnmount?: boolean;
}

export function GLTFModel({
  path,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  disposeOnUnmount = false,
}: GLTFModelProps) {
  // useGLTF(path, useDraco) — passing the decoder path enables Draco decoding.
  const { scene } = useGLTF(path, DRACO_DECODER_PATH);

  // Mobile memory cap: hard-release this model's GPU footprint on unmount.
  useEffect(() => {
    if (!disposeOnUnmount) return;
    return () => {
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if (!mat) return;
          // Dispose every texture slot the material owns.
          const std = mat as THREE.MeshStandardMaterial;
          for (const value of Object.values(std) as unknown as Array<{ isTexture?: boolean } | null | undefined>) {
            if (value && typeof value === 'object' && value.isTexture) {
              (value as unknown as THREE.Texture).dispose();
            }
          }
          mat.dispose();
        });
      });
      // Drop the CPU-side GLTF cache entry too (re-entering the city stage
      // re-fetches from the browser HTTP cache — immutable 1-year headers —
      // and re-decodes, trading a short hitch for a hard memory guarantee).
      useGLTF.clear(path);
    };
  }, [scene, path, disposeOnUnmount]);

  // Enable shadows on every mesh + (dev only) report material health.
  useEffect(() => {
    let missing = 0;
    let defaultMat = 0;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Diagnose material health (dev only — helps spot model-side issues).
      if (process.env.NODE_ENV !== 'production') {
        const m = mesh.material;
        if (!m || (Array.isArray(m) ? m.length === 0 : false)) {
          missing++;
          console.warn('[GLTFModel] mesh with NO material:', mesh.name || '(unnamed)');
        } else if (Array.isArray(m)) {
          m.forEach((mm) => {
            const std = mm as PbrMaterial;
            if (!std.isMeshStandardMaterial && !std.isMeshPhysicalMaterial) {
              defaultMat++;
            }
          });
        } else {
          const std = m as PbrMaterial;
          if (!std.isMeshStandardMaterial && !std.isMeshPhysicalMaterial) {
            defaultMat++;
          }
        }
      }
    });
    if (process.env.NODE_ENV !== 'production' && (missing || defaultMat)) {
      console.info(
        `[GLTFModel] "${path}" — ${missing} mesh(es) with no material, ${defaultMat} with non-PBR material. ` +
          'No-material meshes render with the glTF default (white). PBR surfaces will still shade correctly under the HDRI.'
      );
    }
  }, [scene, path]);

  return (
    <primitive object={scene} position={position} rotation={rotation} scale={scale} />
  );
}
