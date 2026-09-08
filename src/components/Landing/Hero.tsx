'use client';

/**
 * Hero — marketing hero. The 3D building is now the persistent background
 * (LandingScene), so the hero is just copy + CTAs over a translucent panel.
 * No separate <HeroPreview/> canvas (that would double-render the model).
 */
import { ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/state/useAppStore';
import { BUILDING_NAME } from '@/config/apartments';
import { useTranslation } from '@/i18n/dictionaries';

export function Hero() {
  const setStage = useAppStore((s) => s.setStage);
  const { t } = useTranslation();

  return (
    <section id="home" className="relative min-h-[100svh] w-full pt-16">
      <div className="mx-auto flex h-full min-h-[calc(100svh-4rem)] max-w-7xl flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="z-10 mt-12 flex max-w-4xl flex-col items-center text-center sm:mt-0">
          <h1
            className="text-4xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5rem] lg:leading-[1.1]"
            style={{ textShadow: '0 2px 16px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.5)' }}
          >
            {t('hero_title')}
          </h1>
          <p
            className="mt-6 max-w-2xl text-lg leading-relaxed text-white/90 sm:text-xl"
            style={{ textShadow: '0 1px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)' }}
          >
            {t('hero_subtitle')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => setStage('LANDING_TO_CITY_TRANSITION')} className="group shadow-lg">
              {t('hero_cta')}
              <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
            </Button>
            <Button size="lg" variant="outline" asChild className="border-white/40 bg-white/10 text-white shadow-lg backdrop-blur-sm hover:bg-white/20">
              <a href="#gallery">
                <Play className="mr-2 h-4 w-4" />
                View Gallery
              </a>
            </Button>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-8 rounded-2xl border border-white/15 bg-black/30 px-8 py-6 backdrop-blur-sm">
            {[
              { k: '30', v: 'Floors' },
              { k: '120', v: 'Residences' },
              { k: '24/7', v: 'Concierge' },
            ].map((s) => (
              <div key={s.v}>
                <dt className="text-3xl font-semibold text-white" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>{s.k}</dt>
                <dd className="mt-1 text-xs font-medium uppercase tracking-wider text-white/80">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
