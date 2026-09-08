'use client';

/**
 * FinalCTA — the closing call-to-action at the bottom of the landing page.
 *
 * A translucent panel (so the 3D background shows through) with a large
 * "Choose Apartment" button. Clicking it transitions into the existing
 * CITY_ORBIT stage. The hand-off is seamless: LandingScene publishes its
 * current camera transform to `landingCameraRef` every frame, and CameraDirector
 * reads it on mount — so the orbit picks up exactly where scrolling left off.
 */
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/state/useAppStore';
import { BUILDING_NAME } from '@/config/apartments';

export function FinalCTA() {
  const setStage = useAppStore((s) => s.setStage);

  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/20 bg-background/70 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-lg">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Ready to find your home at {BUILDING_NAME}?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-stone-600">
          Pick your floor, choose your unit, and step inside for a first-person
          walkthrough — all in your browser, no tour appointment needed.
        </p>
        <div className="mt-8">
          <Button
            size="lg"
            onClick={() => setStage('LANDING_TO_CITY_TRANSITION')}
            className="group h-14 px-8 text-base"
          >
            Choose Apartment
            <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
