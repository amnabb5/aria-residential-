'use client';

/**
 * Landing — the marketing page.
 *
 * The 3D city background is now rendered by PersistentCityCanvas in page.tsx
 * (shared across LANDING + CITY_ORBIT stages, so the heavy model loads once).
 * This component is pure DOM content — navbar, hero, sections, footer —
 * layered above the 3D canvas via z-10.
 *
 * Footer sticks to the bottom via mt-auto (per the sticky-footer rule).
 */
import { useEffect } from 'react';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { About } from './About';
import { Amenities } from './Amenities';
import { Location } from './Location';
import { Gallery } from './Gallery';
import { Contact } from './Contact';
import { Footer } from './Footer';
import { FinalCTA } from './FinalCTA';
import { LandingBackground } from './LandingBackground';

export default function Landing() {
  // Smooth-scroll for in-page nav anchors.
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-transparent">
      {/* Luxury architectural presentation background — visible immediately from frame 0 */}
      <LandingBackground />

      {/* Page content on top of the 3D scene (z-10 > canvas z-0). */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <Hero />
          <About />
          <Amenities />
          <Location />
          <Gallery />
          <Contact />
          <FinalCTA />
        </main>
        <Footer />
      </div>
    </div>
  );
}
