/**
 * ============================================================================
 *  ASSET CONFIG  —  swap-in point for real 3D models + HDRI
 * ============================================================================
 *
 *  Real models are now integrated:
 *    - /public/models/main-building.glb   (city + main building)
 *    - /public/models/apartments/apartment.glb  (shared interior for all units)
 *    - /public/hdri/citrus_orchard_puresky_4k.hdr  (environment lighting)
 *
 *  USE_PLACEHOLDER_MODELS is false → the app loads the real GLBs via useGLTF.
 * ============================================================================
 */

/**
 * Master switch.
 *  true  → render procedural placeholders
 *  false → load real .glb files via useGLTF (CURRENT: real models are in)
 */
export const USE_PLACEHOLDER_MODELS = false;

/**
 * Path to the real main-building / city model.
 */
export const MAIN_BUILDING_MODEL = '/models/main-building.glb';

/**
 * MOBILE-ONLY variant of the city model (Task: hard 1.5GB model-memory cap
 * on phones). Same scene, materials and mesh structure as the desktop GLB —
 * textures are capped at 1024px and the file is re-welded/Draco-recompressed
 * (39.4MB → 11.1MB, render-lossless: weld only merges identical vertices and
 * removes invisible degenerate triangles).
 *
 * GPU footprint (model + its assets, measured with resolution × 4B × 1.33
 * mips summed per texture + vertex/index buffer bytes):
 *   desktop GLB  ≈ 322.9MB geometry + ~230MB textures (webp) + HDRI
 *   mobile  GLB  ≈ 138.8MB geometry +  ~64MB textures (worst-case) + HDRI
 * Desktop NEVER loads this file — see MainBuildingModel.
 */
export const MAIN_BUILDING_MODEL_MOBILE = '/models/main-building.mobile.glb';

/**
 * Shared apartment interior model. Today every unit maps to this one splat
 * scene. (.ksplat = the library's pre-packaged format: cache-optimized splat
 * ordering + compression → faster loads, same visual quality. See
 * scripts/convert-ksplat.mjs to regenerate.)
 * (Per-unit overrides can be added in `apartmentModelMap` below.)
 */
export const DEFAULT_APARTMENT_MODEL = '/models/apartments/ApartmentV2.fast.ksplat';

/**
 * Per-apartment GLB overrides. Keys follow `${floor}-${unit}` (e.g. "3-A").
 * Any key NOT listed here falls back to DEFAULT_APARTMENT_MODEL.
 */
export const apartmentModelMap: Record<string, string> = {
  // add per-unit overrides here when distinct models exist
};

/**
 * HDRI environment map — used by both scenes for PBR lighting/reflections,
 * and as the visible sky in the city scene.
 *
 * Optimized tiers:
 *   - Desktop: 2K HDR (4.9MB) — fast loading, high fidelity reflections.
 *   - Mobile/iOS: 1K HDR (1.29MB) — safe memory footprint (~6MB VRAM instead of 130MB+),
 *     preventing WebGL context crashes and iOS Safari Jetsam terminations.
 *   - 4K original kept available at /hdri/citrus_orchard_puresky_4k.hdr.
 */
export const HDRI_PATH_4K = '/hdri/citrus_orchard_puresky_4k.hdr';
export const HDRI_PATH_2K = '/hdri/citrus_orchard_puresky_2k.hdr';
export const HDRI_PATH_MOBILE = '/hdri/citrus_orchard_puresky_1k.hdr';
export const HDRI_PATH = HDRI_PATH_2K;

export function resolveHdriPath(isMobile: boolean): string {
  return isMobile ? HDRI_PATH_MOBILE : HDRI_PATH_2K;
}

/**
 * Draco decoder path (drei's useGLTF supports Draco-compressed GLBs).
 */
export const DRACO_DECODER_PATH =
  'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

/**
 * Resolve the GLB URL for a given apartment key.
 * Falls back to DEFAULT_APARTMENT_MODEL so every apartment is walkable today.
 * Returns `null` only if both the map and the default are unset.
 */
export function resolveApartmentModelUrl(apartmentKey: string): string | null {
  return apartmentModelMap[apartmentKey] ?? DEFAULT_APARTMENT_MODEL ?? null;
}

