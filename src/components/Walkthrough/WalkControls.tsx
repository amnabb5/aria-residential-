'use client';

/**
 * WalkControls — first-person movement + look, runs inside the R3F Canvas.
 *
 * Two modes (gated by the `debug` store flag, toggled with the 'k' key):
 *
 *   NORMAL mode (debug off):
 *     - Movement in the XZ plane (no flying), eye height locked to spawn.
 *     - Invisible boundary walls (BOUNDARY_WALL_POINTS in apartments.ts,
 *       captured with the debug HUD): the player collides with them and
 *       slides along. A soft AABB clamp around spawn remains as a fallback.
 *
 *   DEBUG mode (debug on):
 *     - Free-fly: full 3D movement along the camera's look direction (including
 *       vertical), no bounds, no vertical lock. Use this to find/verify spawn
 *       points and camera targets.
 *     - Slow, precise speed (80% slower than before) for careful tuning; copy
 *       the camera transform from the debug HUD's "Copy coordinates" button.
 *
 * Input (shared via inputRef):
 *   - Desktop: WASD/Arrows move, mouse-drag look.
 *   - Mobile:  <MobileControls/> writes move + look deltas.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BOUNDARY_WALL_POINTS,
  type SpawnConfig,
} from '@/config/apartments';
import { useAppStore } from '@/state/useAppStore';

export interface WalkInput {
  /** Joystick / drag movement vector (−1..1, y = forward). */
  move: { x: number; y: number };
  /** Accumulated look delta in "pixels" (consumed and zeroed each frame). */
  look: { x: number; y: number };
}

interface WalkControlsProps {
  inputRef: React.MutableRefObject<WalkInput>;
  spawn: SpawnConfig;
}

const NORMAL_SPEED = 2.4;
/** Debug free-fly speed — 80% slower than the old 12 u/s for careful tuning. */
const DEBUG_SPEED = 2.4;
/** Radians of view rotation per "pixel" of look delta (shared with MotionControls). */
export const LOOK_SENSITIVITY = 0.0024;
const PITCH_LIMIT = 1.4;

// ---- Pacing (Commit 6: smooth controls) ----
// Look deltas (mouse drag / gyro / touch) are consumed through a short
// exponential ease instead of instantly, which removes the harsh 1-frame
// snap on fast flicks while staying within ~2–4 frames of true input.
const LOOK_EASE_RATE = 50;
// Movement input (keyboard / joystick) accelerates and glides through the
// same damped-approach easing the rest of the camera rig uses.
const MOVE_EASE_RATE = 14;
/** Below this smoothed magnitude (with zero raw input) the glide snaps to 0. */
const MOVE_DEADZONE_SQ = 0.0004;

// ---- Invisible boundary walls (see BOUNDARY_WALL_POINTS in apartments.ts) ----

/** Player collision radius against the boundary walls (metres). */
const WALL_RADIUS = 0.3;

/** Precomputed XZ segments: point i → point i+1. */
const WALL_SEGMENTS: Array<{ ax: number; az: number; bx: number; bz: number }> =
  [];
for (let i = 0; i + 1 < BOUNDARY_WALL_POINTS.length; i++) {
  const a = BOUNDARY_WALL_POINTS[i];
  const b = BOUNDARY_WALL_POINTS[i + 1];
  WALL_SEGMENTS.push({ ax: a[0], az: a[2], bx: b[0], bz: b[2] });
}

/** True when a circle at (x, z) touches any boundary wall segment. */
function hitsWall(x: number, z: number, radius: number): boolean {
  for (const s of WALL_SEGMENTS) {
    const abx = s.bx - s.ax;
    const abz = s.bz - s.az;
    const lenSq = abx * abx + abz * abz || 1e-9;
    let t = ((x - s.ax) * abx + (z - s.az) * abz) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - (s.ax + t * abx);
    const dz = z - (s.az + t * abz);
    if (dx * dx + dz * dz <= radius * radius) return true;
  }
  return false;
}

// Normal-mode soft bounds around the spawn point (outer safety net beyond
// the boundary walls; also applies before/while walls are irrelevant).
const BOUND_MARGIN = 40;

export function WalkControls({ inputRef, spawn }: WalkControlsProps) {
  const { camera, gl } = useThree();
  const debug = useAppStore((s) => s.debug);
  const keys = useRef<Set<string>>(new Set());
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const forwardVec = useRef(new THREE.Vector3());
  const rightVec = useRef(new THREE.Vector3());
  const upVec = useRef(new THREE.Vector3(0, 1, 0));
  const moveVec = useRef(new THREE.Vector3());
  /** Smoothed movement input (damped approach toward the raw vector). */
  const smoothMove = useRef(new THREE.Vector2());

  // Spawn the camera at the entry point.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.rotation.order = 'YXZ';
    cam.position.set(...spawn.position);
    cam.rotation.set(...spawn.rotation);
    cam.fov = 62;
    cam.near = 0.05;
    cam.far = 1500;
    cam.updateProjectionMatrix();
  }, [camera, spawn]);

  // Keyboard listeners.
  useEffect(() => {
    const isMoveKey = (k: string) =>
      [
        'w', 'a', 's', 'd',
        'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
      ].includes(k.toLowerCase());

    const onDown = (e: KeyboardEvent) => {
      if (isMoveKey(e.key)) {
        keys.current.add(e.key.toLowerCase());
        if (e.key.startsWith('Arrow')) e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const onBlur = () => keys.current.clear();

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Mouse-drag look (desktop).
  useEffect(() => {
    const dom = gl.domElement;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      dom.style.cursor = 'grabbing';
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !dragging.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      inputRef.current.look.x += dx;
      inputRef.current.look.y += dy;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      dragging.current = false;
      dom.style.cursor = 'grab';
    };
    dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl, inputRef]);

  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const dt = Math.min(delta, 0.05);

    // --- Look (eased consumption: a short glide instead of 1-frame snap) ---
    const look = inputRef.current.look;
    if (look.x !== 0 || look.y !== 0) {
      const ease = 1 - Math.exp(-LOOK_EASE_RATE * dt);
      const lx = look.x * ease;
      const ly = look.y * ease;
      look.x -= lx;
      look.y -= ly;
      if (Math.abs(look.x) < 1e-4) look.x = 0;
      if (Math.abs(look.y) < 1e-4) look.y = 0;
      cam.rotation.y -= lx * LOOK_SENSITIVITY;
      cam.rotation.x -= ly * LOOK_SENSITIVITY;
      cam.rotation.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, cam.rotation.x));
    }

    // --- Move (raw keyboard/joystick input) ---
    let mx = 0;
    let my = 0;
    const k = keys.current;
    if (k.has('w') || k.has('arrowup')) my += 1;
    if (k.has('s') || k.has('arrowdown')) my -= 1;
    if (k.has('d') || k.has('arrowright')) mx += 1;
    if (k.has('a') || k.has('arrowleft')) mx -= 1;
    if (mx === 0 && my === 0) {
      mx = inputRef.current.move.x;
      my = inputRef.current.move.y;
    }

    // --- Movement pacing: accelerate into the input, glide out of it ---
    const smooth = smoothMove.current;
    const moveEase = 1 - Math.exp(-MOVE_EASE_RATE * dt);
    smooth.x += (mx - smooth.x) * moveEase;
    smooth.y += (my - smooth.y) * moveEase;
    if (mx === 0 && my === 0 && smooth.lengthSq() < MOVE_DEADZONE_SQ) {
      smooth.set(0, 0);
    }
    mx = smooth.x;
    my = smooth.y;
    if (mx > 1) mx = 1;
    else if (mx < -1) mx = -1;
    if (my > 1) my = 1;
    else if (my < -1) my = -1;

    if (mx !== 0 || my !== 0) {
      cam.getWorldDirection(forwardVec.current);

      if (debug) {
        // Free-fly: move along the full 3D look direction (pitch included).
        forwardVec.current.normalize();
        rightVec.current.crossVectors(forwardVec.current, upVec.current).normalize();
        moveVec.current
          .set(0, 0, 0)
          .addScaledVector(forwardVec.current, my)
          .addScaledVector(rightVec.current, mx);
        if (moveVec.current.lengthSq() > 1) moveVec.current.normalize();
        cam.position.addScaledVector(moveVec.current, DEBUG_SPEED * dt);
      } else {
        // Normal: move in the XZ plane, eye height locked.
        forwardVec.current.y = 0;
        forwardVec.current.normalize();
        rightVec.current.crossVectors(forwardVec.current, upVec.current).normalize();
        moveVec.current
          .set(0, 0, 0)
          .addScaledVector(forwardVec.current, my)
          .addScaledVector(rightVec.current, mx);
        if (moveVec.current.lengthSq() > 1) moveVec.current.normalize();

        // Invisible boundary walls: try the full move, then each axis
        // separately so the player SLIDES along walls instead of sticking.
        // (If already overlapping a wall — e.g. a bad spawn — allow free
        // movement so the player can move back out instead of getting stuck.)
        const step = NORMAL_SPEED * dt;
        const nx = cam.position.x + moveVec.current.x * step;
        const nz = cam.position.z + moveVec.current.z * step;
        if (hitsWall(cam.position.x, cam.position.z, WALL_RADIUS)) {
          cam.position.x = nx;
          cam.position.z = nz;
        } else {
          if (!hitsWall(nx, cam.position.z, WALL_RADIUS)) {
            cam.position.x = nx;
          }
          if (!hitsWall(cam.position.x, nz, WALL_RADIUS)) {
            cam.position.z = nz;
          }
        }
      }
    }

    if (!debug) {
      // Normal-mode constraints: lock eye height + clamp to room bounds.
      cam.position.y = spawn.position[1];
      cam.position.x = Math.max(
        spawn.position[0] - BOUND_MARGIN,
        Math.min(spawn.position[0] + BOUND_MARGIN, cam.position.x)
      );
      cam.position.z = Math.max(
        spawn.position[2] - BOUND_MARGIN,
        Math.min(spawn.position[2] + BOUND_MARGIN, cam.position.z)
      );
    }
    // Debug mode: no constraints — full free-fly.
  });

  return null;
}
