'use client';

/**
 * Footer — site footer with brand, quick links, and legal row.
 * Sticky to the bottom (the page wrapper in Landing uses min-h-screen flex flex-col
 * and applies mt-auto here so the footer never floats).
 */
import { Building2 } from 'lucide-react';
import { BUILDING_NAME } from '@/config/apartments';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/20 bg-background/70 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">{BUILDING_NAME}</span>
            </div>
            <p className="mt-3 text-sm text-stone-600">
              Twenty floors of design-forward residences. Tour any unit in 3D,
              right from your browser.
            </p>
          </div>

          <FooterCol
            title="Explore"
            links={[
              { label: 'About', href: '#about' },
              { label: 'Amenities', href: '#amenities' },
              { label: 'Location', href: '#location' },
              { label: 'Gallery', href: '#gallery' },
            ]}
          />
          <FooterCol
            title="Leasing"
            links={[
              { label: 'Contact', href: '#contact' },
              { label: 'Floor plans', href: '#amenities' },
              { label: 'Availability', href: '#contact' },
            ]}
          />
          <FooterCol
            title="Visit"
            links={[
              { label: '88 Aria Boulevard', href: '#location' },
              { label: 'Riverside District', href: '#location' },
              { label: 'leasing@ariaresidences.com', href: '#contact' },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-stone-200 pt-6 text-xs text-stone-500 sm:flex-row">
          <p>© {new Date().getFullYear()} {BUILDING_NAME}. All rights reserved.</p>
          <p>3D walkthrough prototype · placeholders in use</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="text-sm text-stone-600 transition hover:text-stone-900"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
