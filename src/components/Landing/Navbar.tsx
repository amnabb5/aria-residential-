'use client';

/**
 * Navbar — sticky top navigation with smooth-scroll section links and a
 * "Choose Apartment" CTA. Becomes opaque/blurred on scroll.
 */
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goChoose = () => setStage('LANDING_TO_CITY_TRANSITION');

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-border/60 bg-background/85 backdrop-blur-md'
          : 'bg-transparent'
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <a href="#home" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight sm:text-base">
            {BUILDING_NAME}
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/70 transition hover:bg-muted hover:text-foreground"
            >
              {t(l.labelKey)}
            </a>
          ))}
        </div>

        {/* Desktop CTA & Language */}
        <div className="hidden md:flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground/70 hover:text-foreground">
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

          <Button onClick={goChoose} size="sm">
            {t('hero_cta')}
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-md md:hidden">
          <div className="space-y-1 px-4 py-3">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
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
        </div>
      )}
    </header>
  );
}
