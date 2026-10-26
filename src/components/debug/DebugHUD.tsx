'use client';

/**
 * DebugHUD — dev utility showing live camera position + rotation.
 *
 * Two parts, sharing one DOM ref:
 *   - <CameraReporter/>  : lives INSIDE the R3F <Canvas>; each frame writes
 *                          camera.position + camera.rotation to the HUD div's
 *                          textContent (bypasses React re-renders → smooth).
 *   - <DebugHUD/>        : the HTML overlay (outside the canvas) that renders
 *                          the panel <div ref={hudRef}/> in the bottom-left.
 *
 * Both are gated by the `debug` store flag (toggled with the 'k' key).
 * When debug is off, CameraReporter no-ops and DebugHUD renders nothing — so
 * the HUD is completely invisible in the normal/production experience.
 *
 * USAGE in a scene:
 *   const hudRef = useRef<HTMLDivElement>(null);
 *   <Canvas>
 *     ...
 *     <CameraReporter hudRef={hudRef} />
 *   </Canvas>
 *   <DebugHUD hudRef={hudRef} />
 */
import { useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAppStore } from '@/state/useAppStore';

type HudRef = RefObject<HTMLDivElement | null>;

type PerfRef = RefObject<HTMLDivElement | null>;

/** Collects counters from the actual WebGL context currently rendering this canvas. */
export function PerformanceReporter({ perfRef }: { perfRef: PerfRef }) {
  const { gl, size, viewport } = useThree();
  const debug = useAppStore((s) => s.debug);
  const qualityTier = useAppStore((s) => s.qualityTier);
  const frameCount = useRef(0);
  const elapsed = useRef(0);
  const lastNow = useRef(0);
  const fps = useRef(0);
  const gpu = useRef('unavailable');

  useFrame((_, delta) => {
    if (!debug) return;
    frameCount.current++;
    elapsed.current += delta;
    const now = performance.now();
    if (!lastNow.current) {
      lastNow.current = now;
      try {
        const ctx = gl.getContext();
        const ext = ctx.getExtension('WEBGL_debug_renderer_info');
        gpu.current = ext ? String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'masked';
      } catch { gpu.current = 'unavailable'; }
    }
    if (now - lastNow.current < 500) return;
    fps.current = elapsed.current > 0 ? frameCount.current / elapsed.current : 0;
    frameCount.current = 0;
    elapsed.current = 0;
    lastNow.current = now;

    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const heap = memory ? `${(memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'n/a';
    const counts = (window as Window & { __ariaSplatCounts?: Record<string, number> }).__ariaSplatCounts ?? {};
    const splats = Object.entries(counts).map(([label, count]) => `${label} ${count.toLocaleString()}`).join(' · ') || 'loading';
    const info = gl.info;
    const dpr = viewport.dpr;
    const el = perfRef.current;
    if (!el) return;
    el.textContent =
      `${fps.current.toFixed(1)} FPS · ${(1000 / Math.max(fps.current, 0.01)).toFixed(1)} ms/frame · ${qualityTier}\n` +
      `DPR ${dpr.toFixed(2)} · ${gl.domElement.width}×${gl.domElement.height} (${size.width}×${size.height} CSS px)\n` +
      `draw ${info.render.calls} · tris ${info.render.triangles.toLocaleString()} · geo ${info.memory.geometries} · tex ${info.memory.textures}\n` +
      `splats ${splats}\nGPU ${gpu.current}\nJS heap ${heap}`;
  });
  return null;
}

/** In-canvas: streams camera transform into the HUD div. */
export function CameraReporter({ hudRef }: { hudRef: HudRef }) {
  const { camera } = useThree();
  const debug = useAppStore((s) => s.debug);

  useFrame(() => {
    if (!debug) return;
    const el = hudRef.current;
    if (!el) return;
    const p = camera.position;
    const r = camera.rotation;
    // Degrees are easier to reason about for spawn tuning.
    const rx = ((r.x * 180) / Math.PI).toFixed(2);
    const ry = ((r.y * 180) / Math.PI).toFixed(2);
    const rz = ((r.z * 180) / Math.PI).toFixed(2);
    el.textContent =
      `pos  ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}\n` +
      `rot  ${rx}°, ${ry}°, ${rz}°`;
  });

  return null;
}

/** HTML overlay: the visible panel. Hidden unless debug is on. */
export function DebugHUD({ hudRef, perfRef }: { hudRef: HudRef; perfRef?: PerfRef }) {
  const debug = useAppStore((s) => s.debug);
  const toggleDebug = useAppStore((s) => s.toggleDebug);
  const [copied, setCopied] = useState(false);

  if (!debug) return null;

  /**
   * Copy the live camera transform in config-ready format (rotation as
   * radians), e.g. paste straight into REAL_SPAWN in apartments.ts.
   */
  const onCopy = async () => {
    const text = hudRef.current?.textContent ?? '';
    const nums = (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (nums.length < 6) return;
    const [x, y, z, rxDeg, ryDeg, rzDeg] = nums;
    const d2r = (d: number) => +((d * Math.PI) / 180).toFixed(4);
    const out = `{ position: [${x}, ${y}, ${z}], rotation: [${d2r(rxDeg)}, ${d2r(ryDeg)}, ${d2r(rzDeg)}] }`;
    try {
      await navigator.clipboard.writeText(out);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = out;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-50 select-none">
      <div className="pointer-events-auto rounded-lg border border-amber-400/50 bg-black/75 px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-200 shadow-lg backdrop-blur-sm">
        <div
          ref={hudRef}
          className="whitespace-pre"
          style={{ minWidth: '15rem' }}
        >
          pos  —
          {'\n'}rot  —
        </div>
        {perfRef && <div ref={perfRef} className="mt-1 whitespace-pre border-t border-amber-400/20 pt-1 text-amber-100/90">performance sampling…</div>}
        <div className="mt-1 flex items-center gap-3">
          <button
            onClick={onCopy}
            className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-200 underline decoration-amber-400/40 hover:bg-amber-400/30"
          >
            {copied ? 'Copied ✓' : 'Copy coordinates'}
          </button>
          <button
            onClick={toggleDebug}
            className="text-[10px] text-amber-400/70 underline hover:text-amber-300"
          >
            debug on · press k to hide
          </button>
        </div>
      </div>
    </div>
  );
}
