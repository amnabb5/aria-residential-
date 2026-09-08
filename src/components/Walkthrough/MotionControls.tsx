'use client';

/**
 * MotionControls — phone-sensor LOOK for the walkthrough (touch only).
 *
 * The view follows the phone's orientation in EVERY direction: turn the
 * phone left/right (yaw) or tilt it up/down (pitch) and the camera rotates
 * accordingly — VR-style. MOVEMENT stays on the joystick (and walls), so
 * look = phone, move = joystick.
 *
 * Implementation: each `deviceorientation` event (alpha/beta/gamma) is
 * converted to a world-space device quaternion using the standard W3C
 * formula (the same one three.js's DeviceOrientationControls uses). The
 * rotation DELTA between consecutive events is decomposed into yaw + pitch
 * and fed into the same `look` channel the drag-look uses — so phone look
 * and drag look compose naturally, pitch stays clamped, and roll is ignored
 * (correct for first-person looking).
 *
 * Requires a secure context (HTTPS or localhost); iOS 13+ needs the explicit
 * permission gesture handled by the enable button.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LOOK_SENSITIVITY, type WalkInput } from './WalkControls';

interface MotionControlsProps {
  inputRef: React.MutableRefObject<WalkInput>;
}

/** How strongly the view follows the phone (1 = exactly the physical turn). */
const LOOK_FOLLOW = 0.9;

const ZEE = new THREE.Vector3(0, 0, 1);
/** −90° rotation around X, part of the W3C device-orientation formula. */
const Q_CORRECTION = new THREE.Quaternion(
  -Math.sqrt(0.5),
  0,
  0,
  Math.sqrt(0.5)
);
const Q_SCREEN = new THREE.Quaternion();
const EULER = new THREE.Euler();
const CURRENT = new THREE.Quaternion();
const PREVIOUS = new THREE.Quaternion();
const DELTA = new THREE.Quaternion();

const DEG = Math.PI / 180;

/** Standard W3C alpha/beta/gamma (+ screen orientation) → world quaternion. */
function deviceQuaternion(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle: number,
  out: THREE.Quaternion
): THREE.Quaternion {
  EULER.set(beta * DEG, alpha * DEG, -gamma * DEG, 'YXZ');
  out.setFromEuler(EULER);
  out.multiply(Q_CORRECTION);
  out.multiply(Q_SCREEN.setFromAxisAngle(ZEE, -screenAngle * DEG));
  return out;
}

export function MotionControls({ inputRef }: MotionControlsProps) {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const calibrated = useRef(false);

  useEffect(() => {
    if (!enabled) {
      calibrated.current = false;
      return;
    }

    let gotEvent = false;

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null || e.gamma == null) {
        if (!gotEvent) setSupported(false); // no real sensors on this device
        return;
      }
      gotEvent = true;

      const screenAngle =
        typeof screen !== 'undefined' ? (screen.orientation?.angle ?? 0) : 0;
      deviceQuaternion(e.alpha, e.beta, e.gamma, screenAngle, CURRENT);

      // First event only establishes the reference orientation.
      if (!calibrated.current) {
        PREVIOUS.copy(CURRENT);
        calibrated.current = true;
        return;
      }

      // Rotation delta since the previous event, decomposed to yaw/pitch.
      DELTA.copy(PREVIOUS).invert().multiply(CURRENT);
      EULER.setFromQuaternion(DELTA, 'YXZ');
      const yawDelta = EULER.y;
      const pitchDelta = EULER.x;
      PREVIOUS.copy(CURRENT);

      // Feed the same "pixel" units WalkControls consumes for drag-look.
      const k = (LOOK_FOLLOW / LOOK_SENSITIVITY);
      inputRef.current.look.x -= yawDelta * k; // turn phone right → look right
      inputRef.current.look.y -= pitchDelta * k; // tilt phone up → look up
    };

    window.addEventListener('deviceorientation', onOrient);
    const probe = setTimeout(() => {
      if (!gotEvent) setSupported(false);
    }, 1500);

    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      clearTimeout(probe);
    };
  }, [enabled, inputRef]);

  const onToggle = async () => {
    if (enabled) {
      setEnabled(false);
      return;
    }
    // iOS 13+ requires an explicit permission prompt from a user gesture.
    const DOE = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
      | undefined;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        if ((await DOE.requestPermission()) !== 'granted') return;
      } catch {
        return;
      }
    }
    setSupported(true);
    setEnabled(true);
  };

  if (!supported) return null;

  // Device sensors only fire in secure contexts (e.g. a raw HTTP LAN URL).
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return (
      <div className="pointer-events-none absolute bottom-8 right-8 z-30 select-none">
        <div className="rounded-full border border-amber-300/40 bg-black/60 px-3 py-1.5 text-[11px] font-medium text-amber-200/90 backdrop-blur-sm">
          Motion controls need HTTPS
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute bottom-8 right-8 z-30 select-none">
      <button
        onClick={onToggle}
        className="pointer-events-auto rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-sm active:bg-white/30"
      >
        {enabled ? 'Look: phone' : 'Look: drag'}
      </button>
    </div>
  );
}
