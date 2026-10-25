'use client';

/**
 * Location — a stylized map panel with the address and nearby points.
 */
import Image from 'next/image';
import { MapPin, Navigation, Clock } from 'lucide-react';
import { useTranslation } from '@/i18n/dictionaries';
import { LiquidGlassSurface } from '@/components/ui/liquid-glass';

const NEARBY = [
  { nameKey: 'loc_near_1', time: '5 min walk' },
  { nameKey: 'loc_near_2', time: '3 min walk' },
  { nameKey: 'loc_near_3', time: '8 min walk' },
  { nameKey: 'loc_near_4', time: '4 min walk' },
];

export function Location() {
  const { t } = useTranslation();

  return (
    <section id="location" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Map */}
          <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-stone-100 shadow-sm">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="/images/location-map.png"
                alt="Neighborhood map around Aria Residences"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="h-full w-full object-cover"
              />
            </div>
            {/* Pin */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
              <span className="relative flex h-5 w-5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg">
                  <MapPin className="h-3 w-3" />
                </span>
              </span>
            </div>
          </div>

          {/* Copy */}
          <LiquidGlassSurface variant="panel" className="flex flex-col justify-center rounded-3xl p-8 shadow-lg">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
              {t('location_badge')}
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              {t('location_title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-stone-600">
              {t('location_desc')}
            </p>

            <LiquidGlassSurface variant="chip" className="mt-6 flex items-start gap-3 rounded-2xl p-4">
              <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="text-sm font-semibold text-stone-900">
                  88 Aria Boulevard, Riverside District
                </div>
                <div className="text-sm text-stone-600">
                  Open daily · 9:00 AM – 7:00 PM
                </div>
              </div>
            </LiquidGlassSurface>

            <div role="list" className="mt-6 grid gap-3 sm:grid-cols-2">
              {NEARBY.map((n) => (
                <LiquidGlassSurface
                  key={n.nameKey}
                  variant="chip"
                  role="listitem"
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                >
                  <span className="text-sm font-medium text-stone-800">
                    {t(n.nameKey as keyof typeof import('@/i18n/dictionaries').DICTIONARY.en)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                    <Clock className="h-3 w-3" />
                    {n.time}
                  </span>
                </LiquidGlassSurface>
              ))}
            </div>
          </LiquidGlassSurface>
        </div>
      </div>
    </section>
  );
}
