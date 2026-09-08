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
import { useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAppStore } from '@/state/useAppStore';

type HudRef = RefObject<HTMLDivElement | null>;

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
export function DebugHUD({ hudRef }: { hudRef: HudRef }) {
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
