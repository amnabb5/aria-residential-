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
 * Hardware heuristic assessment combining:
 *  - GPU renderer string (via unmasked WEBGL_debug_renderer_info)
 *  - navigator.deviceMemory (GB RAM)
 *  - navigator.hardwareConcurrency (CPU cores)
 *  - devicePixelRatio and screen dimensions
 */
export function detectHardwareTier(): QualityTier {
  if (typeof window === 'undefined') return 'high';

  const isMob = isMobileDevice();
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const dpr = window.devicePixelRatio || 1;
  const screenPixels = window.screen.width * window.screen.height;

  // Query unmasked GPU renderer info
  let renderer = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ''
        : gl.getParameter(gl.RENDERER) || '';
    }
  } catch {}

  const rLower = renderer.toLowerCase();
  const isDiscreteGPU =
    /nvidia|rtx|gtx|geforce|radeon rx|apple m[2-4]|apple m1 (pro|max|ultra)/i.test(
      rLower
    );
  const isWeakIntegrated =
    /intel.*(uhd|hd graphics)|mali-4|adreno (3|4|5)|powervr/i.test(rLower);

  // Mobile tier decisions
  if (isMob) {
    if (mem <= 2 || cores <= 4 || isWeakIntegrated) {
      return 'low';
    }
    // Modern flagship phones (iPhone 13+, Galaxy S22+, >=6GB RAM)
    if (mem >= 6 && cores >= 8) {
      return 'medium';
    }
    return 'medium';
  }

  // Desktop tier decisions
  if (isDiscreteGPU || (cores >= 8 && mem >= 8 && !isWeakIntegrated)) {
    return 'ultra';
  }
  if (isWeakIntegrated || mem < 4) {
    return 'medium';
  }
  return 'high';
}

/**
 * 1-2s Lightweight real-time startup benchmark:
 * Renders multiple offscreen WebGL quads under time pressure to sample real frame delta.
 */
let cachedBenchmarkTier: QualityTier | null = null;

export async function runStartupBenchmark(): Promise<QualityTier> {
  if (cachedBenchmarkTier) return cachedBenchmarkTier;
  const baseline = detectHardwareTier();
  if (typeof window === 'undefined') return baseline;

  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' }) || canvas.getContext('webgl');
      if (!gl) {
        cachedBenchmarkTier = baseline;
        resolve(baseline);
        return;
      }

      const vsSource = `
        attribute vec2 position;
        void main() {
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `;
      const fsSource = `
        precision mediump float;
        uniform float u_time;
        void main() {
          vec2 uv = gl_FragCoord.xy / 256.0;
          float c = sin(uv.x * 20.0 + u_time) * cos(uv.y * 20.0 + u_time);
          gl_FragColor = vec4(c, uv.x, uv.y, 1.0);
        }
      `;

      function createShader(type: number, src: string) {
        const s = gl!.createShader(type)!;
        gl!.shaderSource(s, src);
        gl!.compileShader(s);
        return s;
      }

      const program = gl.createProgram()!;
      gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
      gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
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

      const timeLoc = gl.getUniformLocation(program, 'u_time');

      let frames = 0;
      const start = performance.now();
      const targetFrames = 30;

      function renderFrame(now: number) {
        gl!.uniform1f(timeLoc, now * 0.001);
        for (let i = 0; i < 8; i++) {
          gl!.drawArrays(gl!.TRIANGLES, 0, 6);
        }
        frames++;
        if (frames < targetFrames && performance.now() - start < 600) {
          requestAnimationFrame(renderFrame);
        } else {
          const totalMs = performance.now() - start;
          const avgFrameMs = totalMs / frames;
          // Determine benchmark tier:
          // < 16ms avg frame (>=60fps) -> Keep baseline or Ultra
          // > 33ms avg frame (<=30fps) -> Downshift one tier
          let tier = baseline;
          if (avgFrameMs > 35 && baseline === 'ultra') tier = 'high';
          else if (avgFrameMs > 45 && baseline === 'high') tier = 'medium';
          else if (avgFrameMs > 60 && baseline === 'medium') tier = 'low';

          // Cleanup WebGL resources
          try {
            gl!.deleteProgram(program);
            gl!.deleteBuffer(buf);
            const loseCtx = gl!.getExtension('WEBGL_lose_context');
            if (loseCtx) loseCtx.loseContext();
          } catch {}

          cachedBenchmarkTier = tier;
          resolve(tier);
        }
      }

      requestAnimationFrame(renderFrame);
    } catch {
      cachedBenchmarkTier = baseline;
      resolve(baseline);
    }
  });
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
