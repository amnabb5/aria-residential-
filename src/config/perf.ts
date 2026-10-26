/**
 * ============================================================================
 *  PERFORMANCE & ADAPTIVE QUALITY CONFIG
 * ============================================================================
 *
 * Tiers:
 *   - ULTRA : Uncompromised visual quality for capable desktop GPUs (NVIDIA/AMD discrete, Apple M2 Pro+).
 *             Full splat budget, 2K HDRI, full desktop GLB, antialiasing on, DPR [1, 2.0].
 *   - HIGH  : High-end laptops / capable tablets / fast integrated GPUs.
 *             Full apartment + medium city backdrop, 2K HDRI, DPR [1, 1.5], antialiasing on.
 *   - MEDIUM: Mid-range laptops & mainstream phones.
 *             Phone-optimized GLB, alpha-weighted mobile backdrop, 1K HDRI, DPR [0.75, 1.0].
 *   - LOW   : Constrained mobile / weak integrated GPUs.
 *             Decimated backdrop, 1K HDRI, phone GLB, DPR [0.65, 0.85], antialiasing off.
 *
 * PRIME DIRECTIVE: Capable devices ALWAYS run at Ultra / High (zero quality regression).
 * Down-shifting occurs only automatically on demonstrably weak hardware or sustained low FPS.
 * ============================================================================
 */

export type QualityTier = 'ultra' | 'high' | 'medium' | 'low';
export type QualityMode = 'auto' | 'ultra' | 'high' | 'medium' | 'low';

export interface QualityTierConfig {
  tier: QualityTier;
  label: string;
  dpr: [number, number];
  cityBuildingModel: string;
  citySplatSrc: string;
  hdriPath: string;
  antialias: boolean;
  sphericalHarmonicsDegree: number;
  drawDistance: number;
  enableShadows: boolean;
  gpuSort: boolean;
  mobile: boolean;
}

export const QUALITY_TIERS: Record<QualityTier, QualityTierConfig> = {
  ultra: {
    tier: 'ultra',
    label: 'Ultra Fidelity',
    dpr: [1, 2.0],
    cityBuildingModel: '/models/main-building.glb',
    citySplatSrc: '/models/la_night_full.ksplat',
    hdriPath: '/hdri/citrus_orchard_puresky_2k.hdr',
    antialias: true,
    sphericalHarmonicsDegree: 0,
    drawDistance: 3000,
    enableShadows: true,
    gpuSort: false, // Keep false per gaussian-splats-3d v0.4.7 WASM SIMD stability
    mobile: false,
  },
  high: {
    tier: 'high',
    label: 'High Quality',
    dpr: [1, 1.5],
    cityBuildingModel: '/models/main-building.glb',
    citySplatSrc: '/models/la_night_full.ksplat',
    hdriPath: '/hdri/citrus_orchard_puresky_2k.hdr',
    antialias: true,
    sphericalHarmonicsDegree: 0,
    drawDistance: 2500,
    enableShadows: false,
    gpuSort: false,
    mobile: false,
  },
  medium: {
    tier: 'medium',
    label: 'Balanced',
    dpr: [0.75, 1.0],
    cityBuildingModel: '/models/main-building.mobile.glb',
    citySplatSrc: '/models/la_night_mobile.ksplat',
    hdriPath: '/hdri/citrus_orchard_puresky_1k.hdr',
    antialias: false,
    sphericalHarmonicsDegree: 0,
    drawDistance: 1800,
    enableShadows: false,
    gpuSort: false,
    mobile: true,
  },
  low: {
    tier: 'low',
    label: 'Performance / Power Saver',
    dpr: [0.65, 0.85],
    cityBuildingModel: '/models/main-building.mobile.glb',
    citySplatSrc: '/models/la_night_decimated.ksplat',
    hdriPath: '/hdri/citrus_orchard_puresky_1k.hdr',
    antialias: false,
    sphericalHarmonicsDegree: 0,
    drawDistance: 1200,
    enableShadows: false,
    gpuSort: false,
    mobile: true,
  },
};

/** Compatibility interface with existing components */
export interface RenderProfile {
  dpr: [number, number];
  label: string;
  gpuSort: boolean;
  mobile: boolean;
  tier?: QualityTier;
}

const LOCAL_STORAGE_KEY = 'aria_quality_mode';

export function getSavedQualityMode(): QualityMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved && ['auto', 'ultra', 'high', 'medium', 'low'].includes(saved)) {
      return saved as QualityMode;
    }
  } catch {}
  return 'auto';
}

export function saveQualityMode(mode: QualityMode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, mode);
  } catch {}
}

/** Robust iOS detection */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1)
  );
}

/** Phone / touch detection */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (isIOS()) return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const narrow = window.innerWidth <= 820;
  return coarse && (mobileUA || narrow);
}

/**
 * ── GPU adapter probe (memoized) ────────────────────────────────────────────
 *
 * Reads the UNMASKED renderer string from a context created WITHOUT a
 * powerPreference override — exactly like the app's canvases do. This is
 * the key fix for hybrid-GPU machines (discrete + integrated):
 * the returned string is the adapter the browser ACTUALLY assigns to
 * default-preference contexts, so a Chrome running on the Intel iGPU reports
 * "Intel(R) Iris(R) Xe / UHD" instead of "NVIDIA GeForce RTX …". Matching the
 * string to the adapter that will do the rendering (instead of blindly
 * matching a discrete-GPU regex) prevents guessing Ultra for a machine the
 * browser renders on integrated graphics.
 *
 * Classification:
 *   'discrete'          GeForce/RTX/Quadro, Radeon RX, Apple M2–M4 — strong
 *   'modern-integrated' Apple M1 / Ax, Iris Xe / Arc, Adreno 7xx, Mali-G7x
 *   'old-integrated'    AMD Vega APU renderer (generic Radeon Graphics),
 *                       Intel HD/UHD (pre-Xe), MX-series, older Mali,
 *                       PowerVR, SwiftShader/llvmpipe (fake/software)
 *   'unknown'           no DOM / blocked string (Safari masks it) → heuristics
 */
type GpuClass =
  | 'discrete'
  | 'modern-integrated'
  | 'old-integrated'
  | 'unknown';

let gpuProbeCache: { renderer: string; gpuClass: GpuClass } | null = null;

export function probeGpuRenderer(): { renderer: string; gpuClass: GpuClass } {
  if (gpuProbeCache) return gpuProbeCache;

  let renderer = '';
  let gpuClass: GpuClass = 'unknown';

  try {
    const canvas = document.createElement('canvas');
    // No powerPreference — MUST match how the app's <Canvas>/gl options are
    // created so the probed adapter equals the rendering adapter.
    const gl =
      canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      renderer =
        (debugInfo
          ? (gl.getParameter(
              debugInfo.UNMASKED_RENDERER_WEBGL
            ) as string | null)
          : (gl.getParameter(gl.RENDERER) as string | null)) || '';
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {}
    }
  } catch {}

  const r = renderer.toLowerCase();
  if (r) {
    if (/swiftshader|llvmpipe|angle \(software|basic render/.test(r)) {
      gpuClass = 'old-integrated'; // Software rasterizer — always weak
    } else if (
      /nvidia|geforce|quadro|rtx|gtx|tesla/.test(r) &&
      !/mx\d{3}/.test(r) // entry MX laptop dGPUs are NOT 'discrete-class'
    ) {
      gpuClass = 'discrete';
    } else if (/radeon rx|radeon pro v|firepro|rdna/.test(r)) {
      gpuClass = 'discrete';
    } else if (/apple m[2-9]\b/.test(r)) {
      gpuClass = 'discrete'; // M2+ integrated GPUs comfortably Ultra-capable
    } else if (
      /apple m1\b|apple a1[2-9]|iris (xe| xt)|intel arc|adreno 7[0-9]{2}|mali-g7[5-9]/.test(
        r
      )
    ) {
      gpuClass = 'modern-integrated';
    } else if (
      /radeon\s*\(tm\)\s*graphics|radeon graphics|intel.*(uhd|hd graphics|iris|arc)|apple a[1-9]\b|mali-|adreno|powervr|mx\d{3}/.test(
        r
      )
    ) {
      gpuClass = 'old-integrated';
    } else {
      gpuClass = 'unknown'; // non-empty string we couldn't classify
    }
  }

  gpuProbeCache = { renderer, gpuClass };
  return gpuProbeCache;
}

const TIER_ORDER: QualityTier[] = ['low', 'medium', 'high', 'ultra'];

function shiftTier(
  tier: QualityTier,
  delta: number,
  ceiling?: QualityTier
): QualityTier {
  const cap = ceiling
    ? TIER_ORDER.indexOf(ceiling)
    : TIER_ORDER.length - 1;
  const next = TIER_ORDER.indexOf(tier) + delta;
  return TIER_ORDER[Math.max(0, Math.min(cap, next))];
}

/**
 * Static pre-3D tier guess (runs synchronously at store creation).
 *
 * Uses the adapter probe above + cores/RAM. Interactive phones are capped at
 * 'medium' BY DESIGN — the 'high'/'ultra' tiers select DESKTOP city GLBs and
 * 2K HDRI + the 69 MB full splat, which phones must never pull down.
 */
export function detectHardwareTier(): QualityTier {
  if (typeof window === 'undefined') return 'high';

  const { gpuClass } = probeGpuRenderer();
  const cores = navigator.hardwareConcurrency ?? 4;
  // navigator.deviceMemory is capped at 8 by Chrome and reported coarsely —
  // use it only as a tiebreaker, never as the primary signal.
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const isMob = isMobileDevice();

  // ── Phones / tablets: always an in-house tuned tier (medium | low) ────────
  if (isMob) {
    if (mem <= 2 || cores <= 4 || gpuClass === 'old-integrated') return 'low';
    return 'medium'; // modern flagships ∙ modern-integrated ∙ unknown (masked)
  }

  // ── Desktops / laptops ─────────────────────────────────────────────────────
  switch (gpuClass) {
    case 'discrete':
      return 'ultra';
    case 'modern-integrated':
      // Iris Xe / Arc / M1 / Adreno 7xx — capable, but we want headroom
      // for the 68 MB splat + GLB simultaneously: reserve Ultra need for
      // real discrete GPUs and let the boot calibration upgrade if measured.
      return cores >= 6 && mem >= 8 ? 'high' : 'medium';
    case 'old-integrated':
      return mem <= 4 || cores <= 4 ? 'low' : 'medium';
    default:
      // Unknown adapter (Safari / privacy-blocked renderer string): fall back
      // to CPU/RAM only. Conservative cap — Upgrade decisions come from the
      // GPU benchmark, which DOES have real data even when the string is masked.
      return cores >= 8 && mem >= 8 ? 'high' : 'medium';
  }
}

/**
 * ── Boot GPU calibration benchmark ─────────────────────────────────────────
 *
 * A short, GPU-heavy fullscreen workload rendered on a context created with
 * the SAME default powerPreference as the app — measuring the adapter that
 * will actually draw the scenes. This corrects BOTH failure modes:
 *
 *   • hybrid laptops where the browser renders on the iGPU and the static
 *     guess expected a discrete GPU (string match) → downgrades one tier,
 *   • masked renderer strings (Safari) that made strong machines look
 *     'unknown' → upgrades following the MEASURED GPU throughput.
 *
 * The result is applied once per session (see useAppStore.calibrateAutoTier)
 * BEFORE any 3D stage — never mid-walkthrough, so assets are never re-fetched.
 */
let cachedBenchmarkTier: QualityTier | null = null;

export async function runStartupBenchmark(): Promise<QualityTier> {
  if (cachedBenchmarkTier) return cachedBenchmarkTier;
  const baseline = detectHardwareTier();
  if (
    typeof window === 'undefined' ||
    document.hidden ||
    // rAF is throttled (often to 0fps) in background tabs — measurement useless.
    document.visibilityState !== 'visible'
  ) {
    cachedBenchmarkTier = baseline;
    return baseline;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    // Same default preference as the app's canvases → same adapter measured.
    const gl =
      canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedBenchmarkTier = baseline;
      return baseline;
    }

    const VS = `
      attribute vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `;
    const FS = `
      precision highp float;
      uniform float u_time;
      void main() {
        vec2 uv = gl_FragCoord.xy / 512.0;
        float acc = u_time * 0.1;
        // Matrix-chained heavy fragment work: keeps the GPU bound so the
        // measured frame time reflects fill/ALU throughput, not draw overhead.
        vec2 st = uv;
        for (int i = 0; i < 96; i++) {
          acc += sin(st.x * (12.0 + float(i))) * cos(st.y * (8.0 + float(i)));
          acc += pow(abs(sin(acc)), 1.6) * 0.5 - pow(abs(cos(acc)), 1.4) * 0.5;
          st = vec2(
            st.x * 0.8775826 + st.y * 0.4794255,
            st.x * -0.4794255 + st.y * 0.8775826
          ) + 0.007;
        }
        gl_FragColor = vec4(acc * 0.01, st.x, st.y, 1.0);
      }
    `;

    const compile = (type: number, src: string) => {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posAttr = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);
    const timeLoc = gl.getUniformLocation(program, 'u_time')!;

    const result = await new Promise<number>((resolve) => {
      const start = performance.now();
      const spans: number[] = [];
      let last = start;
      let frames = 0;
      const WARMUP_FRAMES = 8; // shader compile + first-touch allocations
      const MAX_TOTAL_MS = 900;

      const frame = (now: number) => {
        const t = now * 0.001;
        gl!.uniform1f(timeLoc, t);
        // 6 fullscreen heavy draws per rAF — one pass alone may be cached/
        // pipelined; saturating the submit queue makes the GPU the bottleneck.
        for (let i = 0; i < 6; i++) gl!.drawArrays(gl!.TRIANGLES, 0, 6);
        frames++;
        if (frames > WARMUP_FRAMES) {
          spans.push(now - last);
        }
        last = now;
        if (now - start < MAX_TOTAL_MS) {
          requestAnimationFrame(frame);
        } else {
          // Median center-frame span (robust against GC hiccups /
          // compositor interference).
          spans.sort((a, b) => a - b);
          const m = spans.length;
          const median = m > 0 ? spans[Math.floor(m / 2)] : 0;
          resolve(median);
        }
      };
      requestAnimationFrame(frame);
    });

    // Cleanup.
    try {
      gl.deleteProgram(program);
      gl.deleteBuffer(buf);
      const loseCtx = gl.getExtension('WEBGL_lose_context');
      loseCtx?.loseContext();
    } catch {}

    // ── Decision matrix ──────────────────────────────────────────────────────
    // Calibrated against the walkthrough workload (68 MB splat + 39 MB GLB):
    // a GPU that can't chew this benchmark faster than ~26 ms median can't
    // hold Ultra; a GPU finishing it under 11 ms has Ultra headroom.
    let tier = baseline;
    if (result < 11 && probeGpuRenderer().gpuClass !== 'old-integrated') {
      // This fragment-only probe does not measure CPU splat sorting. In
      // particular, it must not promote older shared-memory APUs such as the
      // Ryzen 7 5800H Vega iGPU to a desktop tier based on an easy shader pass.
      tier = shiftTier(baseline, +1);
    } else if (result > 40) {
      tier = shiftTier(baseline, -2);
    } else if (result > 26) {
      tier = shiftTier(baseline, -1);
    }
    // Phones: the high/ultra tiers pull desktop assets — hard-capped.
    if (isMobileDevice() && tier === 'ultra') tier = 'medium';
    if (isMobileDevice() && tier === 'high') tier = 'medium';

    cachedBenchmarkTier = tier;
    if (tier !== baseline) {
      console.info(
        `[perf] GPU calibration: ${baseline} → ${tier} (median frame ${result.toFixed(
          1
        )}ms, probe "${probeGpuRenderer().renderer}")`
      );
    }
    return tier;
  } catch {
    cachedBenchmarkTier = baseline;
    return baseline;
  }
}

/** Legacy support */
export function getRenderProfile(): RenderProfile {
  const tier = detectHardwareTier();
  const cfg = QUALITY_TIERS[tier];
  return {
    dpr: cfg.dpr,
    label: cfg.label,
    gpuSort: cfg.gpuSort,
    mobile: cfg.mobile,
    tier,
  };
}
