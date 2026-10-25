/**
 * Global app store (Zustand).
 *
 * Drives the state machine:
 *   LANDING → CITY_ORBIT → ZOOM_TRANSITION → WALKTHROUGH
 * plus the current apartment selection and a global debug toggle.
 *
 * Debug toggle ('k' key, handled in <DebugGate/>):
 *   - When ON: shows the camera HUD (pos/rot) in both 3D scenes, unlocks free
 *     orbit in the city view (no distance/polar limits, pan enabled), and
 *     unlocks free-fly in the walkthrough (no bounds, no vertical lock).
 *   - When OFF: normal constrained UX for end users.
 *   Persisted to localStorage so it survives reloads while tuning.
 */
import { create } from 'zustand';
import {
  getApartmentKey,
  getSpawnConfig,
  type SpawnConfig,
} from '@/config/apartments';
import { resolveApartmentModelUrl } from '@/config/assets';

export type Stage = 'LANDING' | 'LANDING_TO_CITY_TRANSITION' | 'CITY_ORBIT' | 'ZOOM_TRANSITION' | 'WALKTHROUGH';

/**
 * Non-reactive ref holding the landing scroll-scene's current camera transform.
 * The LandingScene mutates `.current` every frame (no set() → no re-render);
 * CameraDirector reads it on mount so the hand-off into CITY_ORBIT starts from
 * wherever the scroll left the camera (no snap).
 */
export interface CameraTransform {
  position: [number, number, number];
  target: [number, number, number];
}
export const landingCameraRef: { current: CameraTransform | null } = {
  current: null,
};

interface AppState {
  stage: Stage;
  selectedFloor: number | null;
  selectedUnit: string | null;
  apartmentModelUrl: string | null;
  hasRealModel: boolean;
  spawn: SpawnConfig | null;
  debug: boolean;
  is3DReady: boolean;
  sceneLoadProgress: number;
  webglFailed: boolean;

  setStage: (stage: Stage) => void;
  selectFloor: (floor: number | null) => void;
  selectUnit: (unit: string | null) => void;
  confirmSelection: () => void;
  resetToLanding: () => void;
  backToOrbit: () => void;
  setDebug: (v: boolean) => void;
  toggleDebug: () => void;
  set3DReady: (ready: boolean) => void;
  setSceneLoadProgress: (progress: number) => void;
  setWebglFailed: (failed: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  stage: 'LANDING',
  selectedFloor: null,
  selectedUnit: null,
  apartmentModelUrl: null,
  hasRealModel: false,
  spawn: null,
  debug: false,
  is3DReady: false,
  sceneLoadProgress: 0,
  webglFailed: false,

  setStage: (stage) => set({ stage }),

  selectFloor: (floor) =>
    set({ selectedFloor: floor, selectedUnit: null, apartmentModelUrl: null }),

  selectUnit: (unit) => {
    const { selectedFloor } = get();
    if (!selectedFloor || !unit) {
      set({ selectedUnit: unit, apartmentModelUrl: null, hasRealModel: false });
      return;
    }
    const key = getApartmentKey(selectedFloor, unit);
    const url = resolveApartmentModelUrl(key);
    set({
      selectedUnit: unit,
      apartmentModelUrl: url,
      hasRealModel: !!url,
    });
  },

  confirmSelection: () => {
    const { selectedFloor, selectedUnit } = get();
    if (!selectedFloor || !selectedUnit) return;
    const spawn = getSpawnConfig(selectedFloor, selectedUnit);
    set({ spawn, stage: 'ZOOM_TRANSITION' });
  },

  resetToLanding: () =>
    set({
      stage: 'LANDING',
      selectedFloor: null,
      selectedUnit: null,
      apartmentModelUrl: null,
      hasRealModel: false,
      spawn: null,
      webglFailed: false,
    }),

  backToOrbit: () => set({ stage: 'CITY_ORBIT', webglFailed: false }),

  setDebug: (v) => set({ debug: v }),
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
  set3DReady: (is3DReady) => set({ is3DReady }),
  setSceneLoadProgress: (sceneLoadProgress) => set({ sceneLoadProgress }),
  setWebglFailed: (webglFailed) => set({ webglFailed }),
}));
