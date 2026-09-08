/**
 * ============================================================================
 *  APARTMENTS CONFIG  —  floors, units, specs, building geometry, spawn points
 * ============================================================================
 *
 *  Coordinates below are the CONFIRMED real-model coordinates provided by the
 *  user (measured against the actual GLB scene). Do not change them unless the
 *  models change.
 *
 *    City camera default position : (161.10, 37.58, 10.93)
 *    City camera orbit target     : ( 77.09, 67.22, -1.63)
 *    Apartment spawn position     : (  3.90,  1.05, -4.02)
 *    Apartment spawn rotation     : ( -0.03,  1.58,  0.00)  [radians]
 *
 *  Floor-height math (BUILDING_BASE_Y / FLOOR_HEIGHT) is an ESTIMATE based on
 *  the city GLB's bounding box (building mass spans roughly y=0..70). Tweak
 *  with the in-app debug HUD (press k to toggle) once you need per-floor
 *  precision.
 * ============================================================================
 */

export type Facing = 'North' | 'South' | 'East' | 'West';

export interface ApartmentSpec {
  unit: string;
  beds: number;
  baths: number;
  sqft: number;
  facing: Facing;
  price: string;
}

export interface FloorConfig {
  floor: number;
  name: string;
  units: ApartmentSpec[];
}

export const BUILDING_NAME = 'Aria Residences';

/**
 * Real-model building geometry. `center` is the orbit lookAt target; it is
 * also used as the zoom-transition facade target XZ. These values come straight
 * from the confirmed coordinates above.
 */
export const BUILDING_CONFIG = {
  /** Orbit lookAt target == building focal point (confirmed). */
  center: [77.09, 67.22, -1.63] as [number, number, number],
  /** Number of above-ground floors. The main tower in the city GLB reaches
   *  ~y=90; at FLOOR_HEIGHT=3 that's ~30 floors. Set to 30 to cover the tower. */
  floors: 30,
  /**
   * Facade point the zoom-transition flies toward (confirmed XZ; Y is per-floor
   * via floorWorldY). This replaces the old placeholder [0,0,2] which sent the
   * camera to the wrong location.
   */
  facadeTarget: [77.09, 0, -1.63] as [number, number, number],
} as const;

/**
 * Building base + floor height. The city GLB's tallest tower ("Building 02")
 * reaches y≈90.7; 30 floors × 3 units/floor ≈ 90, which matches. Tweak with
 * the in-app debug HUD (press k to toggle) if per-floor precision is needed.
 */
export const BUILDING_BASE_Y = 0;
export const FLOOR_HEIGHT = 3;

/**
 * Convert a floor number to its world-space Y (center of that floor's slab).
 * Floors are numbered 1..N from the ground up.
 */
export function floorWorldY(floor: number): number {
  return BUILDING_BASE_Y + (floor - 0.5) * FLOOR_HEIGHT;
}

/** Apartment key from floor + unit, e.g. (3, "A") → "3-A". */
export function getApartmentKey(floor: number, unit: string): string {
  return `${floor}-${unit}`;
}

export interface SpawnConfig {
  position: [number, number, number];
  /** Euler rotation in radians [x, y, z]. y = yaw. */
  rotation: [number, number, number];
}

/**
 * Interior-model normalization transform.
 *
 * modern_apartment_interior.glb is a Sketchfab model exported in MILLIMETRES
 * with its origin far from the mesh (bbox center ≈ [-8060, 4474, 960] mm).
 * We scale by 0.001 (mm→m) and recenter so the room sits at the scene origin,
 * making the spawn point + window-view math stable.
 *
 * After normalization the room occupies roughly x:[-3.7,3.7] y:[0,5.7] z:[-0.95,0.95].
 * (Derived from the GLB's bounding box; safe to leave as-is for this model.)
 */
export const INTERIOR_NORMALIZE = {
  scale: 0.001,
  position: [8.06, -1.6, -0.96] as [number, number, number],
} as const;

/**
 * Spawn point for the interior walkthrough.
 * Sits near room center at realistic eye height, facing into the room.
 * Tune with the debug HUD (press k) if the model has a different layout.
 */
const REAL_SPAWN: SpawnConfig = {
  position: [0.85, -0.92, -4.87],
  rotation: [0.06, -4.81, 0],
};

/**
 * INVISIBLE BOUNDARY WALLS — walkthrough collision boundary.
 *
 * These are camera positions captured with the debug HUD's "Copy
 * coordinates" button (press k, fly with WASD, copy at each corner). The
 * player collides with each segment A→B (in listed order) and slides along
 * it; only X/Z matter (eye height is locked in normal mode).
 *
 * The chain runs east → south → west → north and CLOSES back to its first
 * point, fully containing the player (spawn at [0.85, -0.92, -4.87] is well
 * inside). The first 15 points are the latest capture (east/south/west
 * sides); the next 4 continue up the west side and along the north wall
 * (bridged from the earlier capture); the final row repeats the first point
 * to close the loop.
 *
 * To adjust: fly to new spots in debug mode, copy the coordinates, and
 * paste/replace rows here. Remove the last row to open the north side, or
 * delete a row to create a doorway-sized gap in that wall.
 */
export const BOUNDARY_WALL_POINTS: ReadonlyArray<readonly [number, number, number]> = [
  // East → south → west (latest capture)
  [3.03, -1.09, -2.28],
  [4.25, -1.07, -2.81],
  [4.28, -1.42, -7.48],
  [4.84, -1.49, -7.53],
  [4.84, -1.44, -8.83],
  [4.73, -1.42, -8.73],
  [3.02, -1.45, -8.81],
  [2.99, -1.5, -8.1],
  [2.72, -1.49, -8.08],
  [2.69, -1.41, -8.87],
  [-0.99, -1.52, -7.98],
  [-2.33, -1.57, -7.95],
  [-2.36, -1.55, -6.87],
  [-2.93, -1.56, -6.83],
  [-2.88, -1.42, -2.53],
  // North side (earlier capture, bridged from the west wall)
  [-2.87, -1.06, -0.26],
  [2.64, -0.95, -0.65],
  [2.93, -1.01, -1.37],
  [3.23, -1.07, -1.91],
  // Close the loop back to the first point
  [3.03, -1.09, -2.28],
];

const UNIT_TYPES: Record<string, Omit<ApartmentSpec, 'unit'>> = {
  A: { beds: 1, baths: 1, sqft: 640, facing: 'North', price: '$2,400/mo' },
  B: { beds: 2, baths: 2, sqft: 980, facing: 'East', price: '$3,650/mo' },
  C: { beds: 2, baths: 2, sqft: 1040, facing: 'South', price: '$3,900/mo' },
  D: { beds: 3, baths: 2, sqft: 1380, facing: 'West', price: '$5,200/mo' },
};

const UNIT_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const floors: FloorConfig[] = Array.from(
  { length: BUILDING_CONFIG.floors },
  (_, i) => {
    const floor = i + 1;
    const isPenthouse = floor >= 26;
    return {
      floor,
      name: isPenthouse
        ? floor === BUILDING_CONFIG.floors
          ? 'Sky Penthouse'
          : `Penthouse ${floor}`
        : `Floor ${floor}`,
      units: UNIT_LETTERS.map((unit) => ({
        unit,
        ...UNIT_TYPES[unit],
        price: isPenthouse
          ? `$${Math.round(
              parseInt(UNIT_TYPES[unit].price.replace(/\D/g, ''), 10) * 1.35
            ).toLocaleString()}/mo`
          : UNIT_TYPES[unit].price,
      })),
    };
  }
);

export function getApartment(floor: number, unit: string): ApartmentSpec | null {
  const f = floors.find((x) => x.floor === floor);
  if (!f) return null;
  return f.units.find((u) => u.unit === unit) ?? null;
}

/**
 * Spawn config for a given apartment. All units currently share the confirmed
 * REAL_SPAWN (one shared apartment.glb). Return per-unit overrides here once
 * distinct interior models exist.
 */
export function getSpawnConfig(floor: number, unit: string): SpawnConfig {
  void floor;
  void unit;
  return REAL_SPAWN;
}
