'use client';

/**
 * Navbar — sticky top navigation with smooth-scroll section links and a
 * "Choose Apartment" CTA. Becomes opaque/blurred on scroll.
 */
import { useEffect, useRef, useState } from 'react';
import { Building2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/state/useAppStore';
import { BUILDING_NAME } from '@/config/apartments';
import { cn } from '@/lib/utils';

import { useTranslation, type DictionaryKey } from '@/i18n/dictionaries';
import { useI18nStore, type Language } from '@/i18n/store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { LiquidGlassSurface } from '@/components/ui/liquid-glass';
import { QualitySelector } from '@/components/ui/QualitySelector';

const LINKS: { href: string; labelKey: DictionaryKey }[] = [
  { href: '#about', labelKey: 'nav_about' },
  { href: '#amenities', labelKey: 'nav_amenities' },
  { href: '#location', labelKey: 'nav_location' },
  { href: '#gallery', labelKey: 'nav_gallery' },
  { href: '#contact', labelKey: 'nav_contact' },
];

export function Navbar() {
  const { t, language } = useTranslation();
  const setLanguage = useI18nStore((s) => s.setLanguage);
  
  const setStage = useAppStore((s) => s.setStage);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [indicator, setIndicator] = useState({ x: 0, width: 0 });
  const linksContainerRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const clickScrollLock = useRef(false);
  const scrollUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Keep the selected tab in sync with the section crossing the reading line.
  // A short lock preserves the clicked destination while smooth scrolling is
  // underway; scrollend (with a timer fallback) hands control back to the spy.
  useEffect(() => {
    let frame = 0;

    const updateActiveSection = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const readingLine = 136;
        let current: string | null = null;
        for (const link of LINKS) {
          const section = document.querySelector<HTMLElement>(link.href);
          if (section && section.getBoundingClientRect().top <= readingLine) {
            current = link.href;
          }
        }
        setActiveHref(current);
      });
    };

    const unlockAndSync = () => {
      clickScrollLock.current = false;
      if (scrollUnlockTimer.current) clearTimeout(scrollUnlockTimer.current);
      scrollUnlockTimer.current = null;
      updateActiveSection();
    };

    const onScroll = () => {
      if (clickScrollLock.current) {
        if (scrollUnlockTimer.current) clearTimeout(scrollUnlockTimer.current);
        scrollUnlockTimer.current = setTimeout(unlockAndSync, 220);
        return;
      }
      updateActiveSection();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    window.addEventListener('scrollend', unlockAndSync);
    updateActiveSection();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateActiveSection);
      window.removeEventListener('scrollend', unlockAndSync);
      if (frame) window.cancelAnimationFrame(frame);
      if (scrollUnlockTimer.current) clearTimeout(scrollUnlockTimer.current);
    };
  }, []);

  // Measure the active link so QuickLiquid's rounded glass tab can glide to
  // the exact width and position of each label, including after translations.
  useEffect(() => {
    const container = linksContainerRef.current;
    const activeLink = activeHref ? linkRefs.current[activeHref] : null;
    if (!container || !activeLink) {
      setIndicator((current) => ({ ...current, width: 0 }));
      return;
    }

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      setIndicator({ x: linkRect.left - containerRect.left, width: linkRect.width });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeHref, language]);

  const selectSection = (href: string) => {
    setActiveHref(href);
    clickScrollLock.current = true;
    if (scrollUnlockTimer.current) clearTimeout(scrollUnlockTimer.current);
    scrollUnlockTimer.current = setTimeout(() => {
      clickScrollLock.current = false;
      scrollUnlockTimer.current = null;
    }, 1200);
  };

  const goChoose = () => setStage('LANDING_TO_CITY_TRANSITION');

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      {/* Floating liquid-glass pill nav (desktop) — the 3D city refracts
          through it as the tour camera moves. */}
      <nav className="pointer-events-auto relative mx-auto mt-3 hidden h-14 max-w-5xl items-center justify-between rounded-2xl px-2 pl-4 md:flex">
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl" aria-hidden="true">
          <LiquidGlassSurface variant="nav" className="h-full w-full rounded-2xl" />
        </div>

        {/* Brand */}
        <a href="#home" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight sm:text-base">
            {BUILDING_NAME}
          </span>
        </a>

        {/* Desktop links */}
        <div ref={linksContainerRef} className="relative flex items-center gap-0.5">
          <div
            aria-hidden="true"
            className="nav-section-indicator"
            style={{
              width: indicator.width,
              opacity: indicator.width ? 1 : 0,
              transform: `translate3d(${indicator.x}px, -50%, 0)`,
            }}
          >
            <LiquidGlassSurface variant="tab" className="h-full w-full rounded-xl" />
          </div>
          {LINKS.map((l) => (
            <a
              key={l.href}
              ref={(element) => { linkRefs.current[l.href] = element; }}
              href={l.href}
              onClick={() => selectSection(l.href)}
              aria-current={activeHref === l.href ? 'location' : undefined}
              className={cn(
                'relative z-10 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:text-foreground',
                activeHref === l.href ? 'text-foreground' : 'text-foreground/75'
              )}
            >
              {t(l.labelKey)}
            </a>
          ))}
        </div>

        {/* Desktop CTA & Language */}
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground/70 hover:bg-white/25 hover:text-foreground">
                <Globe className="h-4 w-4" />
                <span className="sr-only">Toggle language</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('en')} className={language === 'en' ? 'bg-muted' : ''}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('fr')} className={language === 'fr' ? 'bg-muted' : ''}>
                Français
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('ar')} className={language === 'ar' ? 'bg-muted' : ''}>
                العربية
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <QualitySelector className="hidden sm:block" />

          <Button onClick={goChoose} size="sm" className="shadow-md">
            {t('hero_cta')}
          </Button>
        </div>
      </nav>

      {/* Mobile bar */}
      <div
        className={cn(
          'pointer-events-auto relative flex h-16 items-center justify-between transition-all duration-300 md:hidden'
        )}
      >
        {scrolled && (
          <div className="pointer-events-none absolute inset-0 -z-10 border-b border-white/15" aria-hidden="true">
            <LiquidGlassSurface variant="nav" className="h-full w-full rounded-none" />
          </div>
        )}
        <div className="flex w-full items-center justify-between px-4">
          {/* Brand */}
          <a href="#home" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              {BUILDING_NAME}
            </span>
          </a>

          {/* Mobile toggle */}
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <LiquidGlassSurface variant="panel" className="border-t border-white/20 md:hidden">
          <div className="space-y-1 px-4 py-3">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => {
                  selectSection(l.href);
                  setOpen(false);
                }}
                aria-current={activeHref === l.href ? 'location' : undefined}
                className={cn(
                  'block rounded-xl px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted',
                  activeHref === l.href && 'bg-white/20 text-foreground'
                )}
              >
                {t(l.labelKey)}
              </a>
            ))}
            <Button
              onClick={() => {
                setOpen(false);
                goChoose();
              }}
              size="sm"
              className="mt-2 w-full"
            >
              {t('hero_cta')}
            </Button>
            
            <div className="mt-4 flex items-center justify-center gap-2 border-t border-border/40 pt-4 pb-1">
              <Button variant="ghost" size="sm" onClick={() => setLanguage('en')} className={language === 'en' ? 'bg-muted' : ''}>EN</Button>
              <Button variant="ghost" size="sm" onClick={() => setLanguage('fr')} className={language === 'fr' ? 'bg-muted' : ''}>FR</Button>
              <Button variant="ghost" size="sm" onClick={() => setLanguage('ar')} className={language === 'ar' ? 'bg-muted' : ''}>AR</Button>
            </div>
          </div>
        </LiquidGlassSurface>
      )}
    </header>
  );
}
