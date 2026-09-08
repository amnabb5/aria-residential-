'use client';

/**
 * Page — the single user-visible route ("/").
 *
 * State machine:
 *   LANDING        → <Landing />       (marketing page, DOM over 3D background)
 *   CITY_ORBIT     → FloorUnitSelector (HTML overlay over 3D)
 *   ZOOM_TRANSITION→ TransitionOverlay (HTML overlay over 3D + GSAP camera tween)
 *   WALKTHROUGH    → <WalkthroughScene /> (first-person interior, own Canvas)
 *
 * PERSISTENCE: <PersistentCityCanvas /> stays mounted across LANDING,
 * CITY_ORBIT, and ZOOM_TRANSITION — the heavy GLB + HDRI load ONCE per
 * session (no re-download on stage switches). Only WALKTHROUGH unmounts the
 * city canvas (it needs its own Canvas for Gaussian splats).
 */
import dynamic from 'next/dynamic';
import { useAppStore } from '@/state/useAppStore';
import Landing from '@/components/Landing/Landing';
import { DebugGate } from '@/components/debug/DebugGate';
import { FloorUnitSelector } from '@/components/CityScene/FloorUnitSelector';
import { AnimatePresence } from 'framer-motion';
import { TransitionOverlay } from '@/components/Transition/TransitionOverlay';
import { CityTransitionOverlay } from '@/components/Transition/CityTransitionOverlay';
import { useI18nStore } from '@/i18n/store';
import { useEffect } from 'react';

const PersistentCityCanvas = dynamic(
  () => import('@/components/CityScene/PersistentCityCanvas'),
  { ssr: false }
);
const WalkthroughScene = dynamic(
  () => import('@/components/Walkthrough/WalkthroughScene'),
  { ssr: false }
);

export default function Home() {
  const stage = useAppStore((s) => s.stage);

  useEffect(() => {
    useI18nStore.getState().initLanguage();
  }, []);

  return (
    <>
      <DebugGate />

      {/* ── City 3D canvas: persists across LANDING / CITY_ORBIT / ZOOM ── */}
      {stage !== 'WALKTHROUGH' && <PersistentCityCanvas />}

      {/* ── Stage-specific overlays ── */}
      {stage === 'LANDING' && <Landing />}

      {stage === 'CITY_ORBIT' && (
        <div className="fixed inset-0 z-40">
          <FloorUnitSelector />
        </div>
      )}

      <AnimatePresence>
        {stage === 'LANDING_TO_CITY_TRANSITION' && <CityTransitionOverlay />}
        {stage === 'ZOOM_TRANSITION' && (
          <div className="fixed inset-0 z-50">
            <TransitionOverlay />
          </div>
        )}
      </AnimatePresence>

      {/* ── Walkthrough: own Canvas for Gaussian splats ── */}
      {stage === 'WALKTHROUGH' && <WalkthroughScene />}
    </>
  );
}
