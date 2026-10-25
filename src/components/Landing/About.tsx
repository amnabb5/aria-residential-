'use client';

/**
 * About — building overview with an image and a short narrative + feature list.
 */
import Image from 'next/image';
import { Check } from 'lucide-react';
import { useTranslation, type DictionaryKey } from '@/i18n/dictionaries';
import { LiquidGlassSurface } from '@/components/ui/liquid-glass';

const FEATURES: DictionaryKey[] = [
  'about_f1',
  'about_f2',
  'about_f3',
  'about_f4',
];

export function About() {
  const { t } = useTranslation();

  return (
    <section id="about" className="py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* Image */}
        <div className="relative order-2 lg:order-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br from-stone-200 to-stone-300 shadow-lg">
            <Image
              src="/images/gallery-interior.png"
              alt="A bright, modern apartment living room at Aria Residences"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="h-full w-full object-cover"
            />
          </div>
          <LiquidGlassSurface variant="chip" className="absolute -bottom-6 -right-4 hidden rounded-2xl p-4 shadow-xl sm:block">
            <div className="text-3xl font-semibold text-stone-900">4.9★</div>
            <div className="text-xs text-muted-foreground">Resident rating</div>
          </LiquidGlassSurface>
        </div>

        {/* Copy */}
        <LiquidGlassSurface variant="panel" className="order-1 rounded-3xl p-8 shadow-lg lg:order-2 sm:p-10">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
            {t('about_badge')}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            {t('about_title')}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-600">
            {t('about_desc')}
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-sm text-stone-700">{t(f)}</span>
              </li>
            ))}
          </ul>
        </LiquidGlassSurface>
      </div>
    </section>
  );
}
