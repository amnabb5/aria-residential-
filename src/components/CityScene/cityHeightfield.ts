/**
 * ============================================================================
 *  CityHeightfield — roofline map of the city model for the landing tour
 * ============================================================================
 *
 * WHY: the scroll-driven landing camera flies a fixed XZ path across the city
 * (see KEYFRAMES in PersistentCityCanvas). Parts of that path pass through
 * real building meshes (e.g. the 156m Residential Complex towers north-east
 * of the main tower), so the camera visibly enters houses and blocks the
 * view. The brief for the fix: keep the same movement, only edit the height.
 *
 * HOW: after the city GLB loads, we rasterize its geometry into a coarse
 * top-down height grid (world XZ → highest vertex Y per ~6u cell). The scroll
 * camera then consults `rooflineAt(x, z)` every frame and its Y is damped up
 * so it always clears the local roofline by CAMERA_CLEARANCE. The XZ path and
 * every look-target are untouched — only the camera's altitude adapts.
 *
 * EXCLUDED from the heightfield (documented model-side artifacts, verified
 * visually — these meshes' vertex soup does not match anything visible on
 * screen and would push the camera to absurd altitudes):
 *   - "geometry-lumionModel*"   (Lumion export shells, stretched to Y≈240)
 *   - "Toy plane" / "Circle*"   (flying props near the main tower)
 * ============================================================================
 */

export const CAMERA_CLEARANCE = 4;

import * as THREE from 'three';

const CELL = 6;
const GRID_MIN_X = -300;
const GRID_MIN_Z = -300;
const GRID_MAX_X = 800;
const GRID_MAX_Z = 400;

/** Meshes whose geometry must not constrain the tour camera. */
const EXCLUDED_MESH_PATTERNS = [
  /^geometry-lumionModel/i,
  /^toy plane$/i,
  /^circle/i,
  /^plane\.001$/i,
];

class Heightfield {
  private readonly nx: number;
  private readonly nz: number;
  private readonly data: Float32Array;

  constructor() {
    this.nx = Math.ceil((GRID_MAX_X - GRID_MIN_X) / CELL);
    this.nz = Math.ceil((GRID_MAX_Z - GRID_MIN_Z) / CELL);
    this.data = new Float32Array(this.nx * this.nz);
  }

  bump(x: number, y: number, z: number): void {
    const gx = Math.floor((x - GRID_MIN_X) / CELL);
    const gz = Math.floor((z - GRID_MIN_Z) / CELL);
    if (gx < 0 || gz < 0 || gx >= this.nx || gz >= this.nz) return;
    const i = gz * this.nx + gx;
    if (y > this.data[i]) this.data[i] = y;
  }

  /** Highest roofline within a ~1-cell radius of (x, z). Ground level = 0. */
  sample(x: number, z: number): number {
    const gx = Math.floor((x - GRID_MIN_X) / CELL);
    const gz = Math.floor((z - GRID_MIN_Z) / CELL);
    let h = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = gx + dx;
        const nz2 = gz + dz;
        if (nx < 0 || nz2 < 0 || nx >= this.nx || nz2 >= this.nz) continue;
        const v = this.data[nz2 * this.nx + nx];
        if (v > h) h = v;
      }
    }
    return h;
  }
}

let heightfield: Heightfield | null = null;
let building = false;
let builtAt = 0;
const listeners = new Set<() => void>();

function isExcluded(name: string): boolean {
  if (!name) return false;
  return EXCLUDED_MESH_PATTERNS.some((re) => re.test(name));
}

/**
 * Build (once) the roofline heightfield from the loaded city scene.
 * Runs asynchronously in chunks so it never blocks a frame budget.
 */
export function buildCityHeightfield(root: import('three').Object3D): void {
  if (heightfield || building) return;
  building = true;

  const hf = new Heightfield();
  const meshes: import('three').Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as import('three').Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const meshName = mesh.name || '';
    const parentName = (obj.parent && obj.parent.name) || '';
    if (isExcluded(meshName) || isExcluded(parentName)) return;
    meshes.push(mesh);
  });

  // Process a few meshes per macrotask — the 7.8M-vertex city model takes a
  // few hundred ms total, spread so the landing stays interactive.
  let index = 0;
  const pos = new THREE.Vector3();
  const step = () => {
    const t0 = performance.now();
    while (index < meshes.length && performance.now() - t0 < 12) {
      const mesh = meshes[index++];
      mesh.updateWorldMatrix(true, false);
      const geom = mesh.geometry;
      const attr = geom.getAttribute('position');
      if (!attr) continue;
      const arr = attr.array as ArrayLike<number>;
      const comp = attr.itemSize;
      const total = attr.count;
      const vertexStep = Math.max(1, Math.floor(total / 4000)); // ≤4k samples/mesh
      for (let i = 0; i < total; i += vertexStep) {
        const o = i * comp;
        pos.set(arr[o], arr[o + 1], arr[o + 2]).applyMatrix4(mesh.matrixWorld);
        hf.bump(pos.x, pos.y, pos.z);
      }
    }
    if (index < meshes.length) {
      setTimeout(step, 0);
    } else {
      heightfield = hf;
      builtAt = Date.now();
      building = false;
      listeners.forEach((fn) => fn());
      listeners.clear();
      console.info('[CityHeightfield] ready — roofline map built from city model');
    }
  };
  setTimeout(step, 0);
}

/** True once the heightfield has been computed. */
export function hasCityHeightfield(): boolean {
  return heightfield !== null;
}

/** Roofline Y at world (x, z) — 0 when the heightfield is not ready yet. */
export function rooflineAt(x: number, z: number): number {
  if (!heightfield) return 0;
  return heightfield.sample(x, z);
}

/** Subscribe to heightfield readiness (used to re-invalidate the canvas). */
export function onCityHeightfieldReady(fn: () => void): () => void {
  if (heightfield || builtAt) {
    fn();
    return () => {};
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}
