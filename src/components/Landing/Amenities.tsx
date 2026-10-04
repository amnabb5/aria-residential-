'use client';

/**
 * Amenities — grid of building amenity cards.
 */
import {
  Waves,
  Dumbbell,
  Wifi,
  Trees,
  Car,
  ConciergeBell,
  Dog,
  Wine,
} from 'lucide-react';
import { useTranslation, type DictionaryKey } from '@/i18n/dictionaries';
import { LiquidGlassSurface } from '@/components/ui/liquid-glass';

const FEATURES: {
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  descKey: string;
}[] = [
  { icon: Waves, titleKey: 'am_pool_title', descKey: 'am_pool_desc' },
  { icon: Dumbbell, titleKey: 'am_fitness_title', descKey: 'am_fitness_desc' },
  { icon: ConciergeBell, titleKey: 'am_concierge_title', descKey: 'am_concierge_desc' },
  { icon: Trees, titleKey: 'am_garden_title', descKey: 'am_garden_desc' },
  { icon: Car, titleKey: 'am_parking_title', descKey: 'am_parking_desc' },
  { icon: Wifi, titleKey: 'am_smart_title', descKey: 'am_smart_desc' },
  { icon: Wine, titleKey: 'am_lounge_title', descKey: 'am_lounge_desc' },
  { icon: Dog, titleKey: 'am_pet_title', descKey: 'am_pet_desc' },
];

export function Amenities() {
  const { t } = useTranslation();

  return (
    <section id="amenities" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <LiquidGlassSurface variant="panel" className="mx-auto max-w-2xl rounded-3xl p-8 text-center shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
            {t('amenities_badge')}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            {t('amenities_title')}
          </h2>
          <p className="mt-4 text-base text-stone-600">
            {t('amenities_desc')}
          </p>
        </LiquidGlassSurface>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <LiquidGlassSurface
                key={i}
                variant="panel"
                className="group rounded-2xl p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 transition group-hover:bg-amber-600 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900">
                  {t(f.titleKey as DictionaryKey)}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                  {t(f.descKey as DictionaryKey)}
                </p>
              </LiquidGlassSurface>
            );
          })}
        </div>
      </div>
    </section>
  );
}
