'use client';

/**
 * MobileControls — on-screen touch controls for the walkthrough (touch only).
 *
 * Layout:
 *   - Left: a virtual joystick (drag within a pad → movement vector).
 *   - Right: a large drag area → look delta (yaw/pitch).
 *
 * Both write into the shared `inputRef` that <WalkControls /> (inside the
 * Canvas) consumes each frame. Uses pointer events + setPointerCapture so the
 * joystick and look area can be used simultaneously (multitouch).
 *
 * Only rendered on coarse-pointer (touch) devices — see WalkthroughScene.
 *
 * NOTE: the knob visual uses React state (so it re-renders), while the movement
 * vector is written to a ref (read by useFrame, never during render).
 */
import { useRef, useState } from 'react';
import type { WalkInput } from './WalkControls';

interface MobileControlsProps {
  inputRef: React.MutableRefObject<WalkInput>;
}

const PAD_RADIUS = 56; // px — max knob travel

export function MobileControls({ inputRef }: MobileControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const lookLast = useRef<{ id: number; x: number; y: number } | null>(null);

  // --- Joystick (left) ---
  const onPadDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPadMove = (e: React.PointerEvent) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > PAD_RADIUS) {
      dx = (dx / dist) * PAD_RADIUS;
      dy = (dy / dist) * PAD_RADIUS;
    }
    // Visual (state) + game input (ref). y inverted: up on screen = forward.
    setKnob({ x: dx, y: dy });
    inputRef.current.move.x = dx / PAD_RADIUS;
    inputRef.current.move.y = -dy / PAD_RADIUS;
  };
  const onPadUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    setKnob({ x: 0, y: 0 });
    inputRef.current.move.x = 0;
    inputRef.current.move.y = 0;
  };

  // --- Look area (right) ---
  const onLookDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    lookLast.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onLookMove = (e: React.PointerEvent) => {
    if (!lookLast.current || lookLast.current.id !== e.pointerId) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current.x = e.clientX;
    lookLast.current.y = e.clientY;
    inputRef.current.look.x += dx;
    inputRef.current.look.y += dy;
  };
  const onLookUp = (e: React.PointerEvent) => {
    if (lookLast.current?.id === e.pointerId) lookLast.current = null;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none">
      {/* Look area — right ~60% of screen, below the top bar */}
      <div
        className="pointer-events-auto absolute right-0 top-16 bottom-0 w-[60%] touch-none"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />

      {/* Joystick — bottom-left */}
      <div
        ref={padRef}
        className="pointer-events-auto absolute bottom-8 left-8 flex h-32 w-32 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm touch-none"
        onPointerDown={onPadDown}
        onPointerMove={onPadMove}
        onPointerUp={onPadUp}
        onPointerCancel={onPadUp}
      >
        <div
          className="h-14 w-14 rounded-full bg-white/70 shadow-lg"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>
    </div>
  );
}
