# Aria Residences — 3D Apartment Walkthrough

A production-ready landing page for a residential building ("Aria Residences").
Browse a 3D model of the building, pick a floor + unit, then transition into a
**first-person walkthrough** of that apartment's interior.

The app ships **today with procedural placeholder 3D assets** (built from
Three.js primitives — no external model files required). When your real `.glb`
models are ready, you swap them in by **dropping files into folders and
flipping one config flag** — no code changes needed.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) + TypeScript |
| 3D | **React Three Fiber** + **@react-three/drei** (Three.js) |
| Animation | **GSAP** (camera tweens) + **Framer Motion** (UI) |
| State | **Zustand** (stage machine + selection) |
| Styling | **Tailwind CSS 4** + **shadcn/ui** |
| Icons | lucide-react |

> The brief suggested React + Vite; this project uses Next.js 16 (the scaffold's
> stack). Every other requested library (R3F, drei, GSAP, Zustand, Tailwind) is
> used as specified. The architecture and swap-in story are identical.

---

## Run it

```bash
bun install        # if not already installed
bun run dev        # starts on http://localhost:3000
```

Open the **Preview Panel** (right side of the editor) — or click
**"Open in New Tab"** above it. (Don't navigate to `localhost:3000` directly;
the sandbox exposes the app through the preview gateway.)

Lint:

```bash
bun run lint
```

---

## Deploy to a server

```bash
npm run build     # next build + copies static & referenced assets into .next/standalone
npm run start     # runs .next/standalone/server.js (plain Node, no bundler needed)
```

The build produces a **self-contained** `.next/standalone` folder (~165 MB —
only the assets the app serves; the ~1 GB of `.ply`/`.splat` source captures
in `public/models` are intentionally NOT deployed). Copy that folder to any
server with Node 18+ and run:

```bash
PORT=3000 HOSTNAME=0.0.0.0 node server.js
```

Notes:

- **Reverse proxy**: the included `Caddyfile` proxies `:81 → localhost:3000`.
  With plain Nginx, forward to `127.0.0.1:3000` and leave the COOP/COEP
  headers (set by the app) intact — they enable SharedArrayBuffer for the
  splat sort workers.
- **Caching**: `/models/*` and `/hdri/*` ship with
  `Cache-Control: immutable, max-age=1y` — repeat visits refetch nothing.
  If you ever replace a model, deploy it under a new filename.
- **HTTPS**: required for phone features (gyroscope etc.); the splat viewer
  itself works over plain HTTP on localhost/LAN.
- Database: the only API route (`/api`) is stateless; Prisma isn't needed at
  runtime unless you extend it.

---

## How the app flows (state machine)

```
LANDING  ──"Choose Apartment"──▶  CITY_ORBIT
   ▲                                   │
   │                              "Confirm"
   │                                   ▼
   │                              ZOOM_TRANSITION  (GSAP camera tween)
   │                                   │
   │                              tween completes
   │                                   ▼
   └──────── "Exit Walkthrough" ──  WALKTHROUGH  (first-person interior)
```

State lives in `src/state/useAppStore.ts` (Zustand). `src/app/page.tsx` reads
`stage` and renders the matching experience:

| Stage | Component |
|---|---|
| `LANDING` | `src/components/Landing/Landing.tsx` |
| `CITY_ORBIT` / `ZOOM_TRANSITION` | `src/components/CityScene/CityExperience.tsx` (one canvas; `CameraDirector` switches behavior) |
| `WALKTHROUGH` | `src/components/Walkthrough/WalkthroughScene.tsx` |

---

## The placeholder system (and how to swap in real models)

### Today: procedural placeholders

Because no real GLBs exist yet, the 3D scenes are built from Three.js
primitives:

- **Main building** — `src/components/CityScene/PlaceholderBuilding.tsx`
  (a tower with a procedural window-grid texture, floor bands, an outline, and
  a glowing highlight on the selected floor) + `CitySurroundings` (ground +
  scattered context buildings).
- **Apartment interior** — `src/components/Walkthrough/PlaceholderRoom.tsx`
  (four walls, a doorway opening, floor/ceiling, window panels, and box
  furniture: sofa, coffee table, bed, rug).

Both live behind the **same swap interface** as real GLB loading, so the rest
of the app (camera math, loading overlay, controls) is identical for both
code paths.

### The swap abstraction

Two thin "switch" components decide placeholder vs. real:

- `src/components/three/MainBuildingModel.tsx`
  → `<PlaceholderBuilding />` **or** `<GLTFModel path={MAIN_BUILDING_MODEL} />`
- `src/components/three/ApartmentModel.tsx`
  → `<PlaceholderRoom />` **or** `<GLTFModel path={url} />` **or** a
  "Coming soon" marker (when no model is mapped).

`GLTFModel` (`src/components/three/GLTFModel.tsx`) uses drei's `useGLTF` with
DRACO support, and reports to THREE's `DefaultLoadingManager` — so the shared
`<LoadingOverlay />` (drei `useProgress`) shows a real progress bar for free.

---

## Swapping in your real models (no code changes)

**Step 1 — drop in files:**

```
public/
  models/
    main-building.glb            ← your real building model
    apartments/
      apartment-3.glb            ← your real apartment model(s)
      penthouse-12.glb
      ...
```

**Step 2 — edit ONE file:** `src/config/assets.ts`

```ts
// Flip the master switch:
export const USE_PLACEHOLDER_MODELS = false;

// Register apartment GLB paths (key = `${floor}-${unit}`, e.g. "3-A"):
export const apartmentModelMap: Record<string, string> = {
  '3-A':  '/models/apartments/apartment-3.glb',
  '3-B':  '/models/apartments/apartment-3.glb',
  '12-D': '/models/apartments/penthouse-12.glb',
};
```

That's it. The app now loads your real GLBs via `useGLTF` with Draco decoding.
Apartments you haven't mapped yet automatically show a **"Coming soon"** panel
instead of crashing.

> Tip: export GLBs with **Draco mesh compression** for fast streaming — the
> decoder path is already configured (`DRACO_DECODER_PATH` in `assets.ts`).

---

## Tweak points for real-model scale/origin

Real models rarely share the placeholder's exact scale/origin. When yours
arrive, you may need to nudge a few numbers — all centralized:

### 1. Zoom-transition camera target — `src/config/apartments.ts`

```ts
export const BUILDING_CONFIG = {
  center: [0, 10, 0],   // world center of the building mass
  totalHeight: 20,      // match your model's real height
  floors: 20,
  floorHeight: 1,       // = totalHeight / floors
  footprint: [4, 4],    // [width (x), depth (z)]
  facadeTarget: [0, 0, 2], // the +Z facade point the camera flies toward
};
```

- `floorWorldY(floor)` (same file) converts a floor number → its world Y.
  The zoom tween ends the camera at `[facadeTarget.x, floorWorldY(floor), facadeTarget.z + 1.4]`.
- `facadeTarget` is **the single most important knob**: set it to the world
  point on your model's entrance facade at ground level.

Orbit framing constants are at the top of
`src/components/CityScene/CameraDirector.tsx`:

```ts
const ORBIT_RADIUS = 18;
const ORBIT_HEIGHT = 9;
const ORBIT_TARGET = [0, 8, 0];
const ZOOM_DURATION = 2.4;
const ZOOM_FOV_END = 32;
const FACADE_OFFSET = 1.4;
```

### 2. Walkthrough spawn point — `src/config/apartments.ts`

```ts
getSpawnConfig(floor, unit) → SpawnConfig { position, rotation }
```

Today every apartment reuses `PLACEHOLDER_SPAWN` (just inside the door, facing
in). For real models, return per-apartment spawn points (origin/orientation
differ per GLB):

```ts
export function getSpawnConfig(floor, number, unit): SpawnConfig {
  const map: Record<string, SpawnConfig> = {
    '3-A': { position: [0, 1.5, 2.2], rotation: [0, 0, 0] },
    '12-D': { position: [1.2, 1.6, 3.0], rotation: [0, Math.PI, 0] },
  };
  return map[getApartmentKey(floor, unit)] ?? DEFAULT_SPAWN;
}
```

### 3. Walk movement bounds — `src/components/Walkthrough/WalkControls.tsx`

```ts
const BOUNDS = { minX: -2.6, maxX: 2.6, minZ: -2.6, maxZ: 2.6 };
```

Set these to your apartment's interior footprint (minus a margin). v1 uses a
simple AABB clamp (no mesh collision) per the brief.

### 4. GLTFModel transform — `src/components/three/GLTFModel.tsx`

If a real model's origin/scale is off, pass `scale`/`position`/`rotation`
props where `<GLTFModel />` is used (in `MainBuildingModel.tsx` and
`ApartmentModel.tsx`).

---

## Config files (add floors/units here, not in components)

- `src/config/assets.ts` — placeholder flag + real GLB path map (the swap file).
- `src/config/apartments.ts` — floors, units, specs (beds/baths/sqft/price),
  building geometry, spawn points, `getApartmentKey()`.

Adding a floor or unit = editing `floors`/`UNIT_TYPES` in `apartments.ts`. The
selector UI, floor highlight, and zoom math all follow automatically.

---

## Project structure

```
public/
  images/            generated marketing imagery
  models/            ← drop real .glb files here
    apartments/
src/
  app/
    page.tsx         stage machine (the only user route)
    layout.tsx
  components/
    Landing/         Navbar, Hero (+HeroPreview 3D), About, Amenities,
                     Location, Gallery, Contact, Footer
    CityScene/       CityExperience (canvas), CameraDirector (orbit+zoom),
                     FloorUnitSelector, PlaceholderBuilding (+surroundings)
    Transition/      TransitionOverlay ("Entering apartment 3-A…")
    Walkthrough/     WalkthroughScene (canvas), WalkControls (FPS),
                     MobileControls (touch joystick + drag-look),
                     PlaceholderRoom
    three/           GLTFModel, MainBuildingModel, ApartmentModel,
                     LoadingOverlay  ← the swap-in abstraction layer
  config/
    assets.ts        ← EDIT THIS to swap models
    apartments.ts    ← EDIT THIS to add floors/units / tweak camera targets
  state/
    useAppStore.ts   Zustand store (stage, selection, spawn)
```

---

## Controls

**City orbit:** drag to look, the camera auto-rotates; pick a floor, then a
unit, then **Confirm**.

**Walkthrough (desktop):** `W`/`A`/`S`/`D` or arrow keys to move, mouse-drag to
look. **Exit Walkthrough** returns to the orbit.

**Walkthrough (mobile/touch):** left joystick to move, drag the right side to
look. (Auto-detected via `pointer: coarse`.)

---

## Notes & assumptions

- The brief named the building "Main Building"; I used the marketing brand
  **"Aria Residences"** (`BUILDING_NAME` in `apartments.ts` — change in one
  place).
- City surroundings (ground + context buildings) are always procedural context,
  not part of the swappable main-building model. If your `main-building.glb`
  ships with its own surroundings, remove `<CitySurroundings />` from
  `CityExperience.tsx`.
- Walk collision is an AABB clamp (v1, per brief). Real mesh collision is a
  documented stretch goal.
- 3D experiences are dynamically imported with `ssr: false` to keep three.js
  off the server-render path.
