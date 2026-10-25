/**
 * ============================================================================
 *  PERFORMANCE CONFIG  — render profiles for GPU capability tiers
 * ============================================================================
 *
 * The walkthrough renders heavy Gaussian splat scenes.  On integrated GPUs we
 * cap the device-pixel-ratio to avoid drowning the rasteriser in overdraw
 * (splats are soft primitives — 1–1.5× dpr is visually indistinguishable from
 * 2× but cuts fill cost in half).
 *
 * Phones get their own profile (see isMobileDevice): the desktop tiers below
 * are completely unaffected by mobile settings — the desktop experience
 * renders exactly as before.
 * ============================================================================
 */

export interface RenderProfile {
  /** Min/max device-pixel-ratio for the walkthrough canvas. */
  dpr: [number, number];
  /** Label for debug HUD. */
  label: string;
  /**
   * Enable GPU-accelerated splat sorting for this device.
   * Per the gaussian-splats-3d docs this gives the best sorting performance,
   * but it creates a second offscreen WebGL context that has caused
   * "Context Lost" crashes on integrated/virtualized GPUs — so we only
   * enable it on the high-end (discrete) tier. Requires cross-origin
   * isolation (COOP/COEP headers are already set in next.config.ts).
   */
  gpuSort: boolean;
  /**
   * Phone-tuned profile: lower dpr ceiling, adaptive performance regression
   * (R3F dips dpr under load), and the lighter city backdrop. Desktop is
   * never flagged mobile.
   */
  mobile: boolean;
}

const PROFILES: RenderProfile[] = [
  /*   tier   dpr          label            gpuSort  mobile */
  { dpr: [1, 1.25], label: "integrated-gpu", gpuSort: false, mobile: false },
  { dpr: [1, 1.5], label: "midrange-gpu", gpuSort: false, mobile: false },
  { dpr: [1, 2], label: "high-end-gpu", gpuSort: true, mobile: false },
] as const;

/** Phone profile: targets seamless ~40-60fps on phones and prevents iOS Safari memory exhaustion. */
const MOBILE_PROFILE: RenderProfile = {
  dpr: [0.65, 0.85],
  label: "mobile",
  gpuSort: false, // GPU compute sort is a desktop-only affordance
  mobile: true,
};

/**
 * Robust iOS detection (iPhone, iPad, iPod, including Safari desktop-mode MacIntel with touch).
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1)
  );
}

/**
 * Best-effort phone/touch device detection.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (isIOS()) return true;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const narrow = window.innerWidth <= 820;
  return coarse && (mobileUA || narrow);
}

/**
 * Pick a render profile based on hardware heuristics.
 * Phones get the dedicated mobile profile; desktops keep the original tiers.
 */
export function getRenderProfile(): RenderProfile {
  if (typeof window === "undefined") return PROFILES[0];

  if (isMobileDevice()) return MOBILE_PROFILE;

  const cores = navigator.hardwareConcurrency ?? 4;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  const renderer = gl?.getParameter(gl.RENDERER) ?? "";
  const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");

  const unmaskedRenderer: string = debugInfo
    ? (gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? renderer)
    : renderer;

  // Simple heuristic: Intel/AMD integrated → tier 0
  const integrated =
    /intel|iris|uhd graphics|amd.*radeon.*vega|apple.*m[12]/i.test(
      unmaskedRenderer
    );

  if (integrated) return PROFILES[0];
  if (cores >= 8) return PROFILES[2]; // beefy CPU → likely discrete GPU
  return PROFILES[1];
}
