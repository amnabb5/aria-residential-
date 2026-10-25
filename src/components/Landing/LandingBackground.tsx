'use client';

/**
 * LandingBackground — luxury architectural presentation background for the landing page.
 *
 * Solves Problem 2: "the landing page is unusable before the 3d scene load,
 * make it presentable and have some sort of background before the 3d scene load".
 *
 * FEATURES:
 *  - Instant cinematic presentation from frame 0 (no black/blank screen).
 *  - High-definition architectural render of Aria Residential with twilight & golden hour glow.
 *  - Non-blocking, luxury glassmorphic 3D loading badge with live progress.
 *  - Smooth 1.2s cross-fade handoff when the 3D canvas is ready.
 *  - Persistent atmospheric vignette ensuring all landing text remains ultra-readable.
 *  - Graceful fallback: stays active if WebGL is unavailable or fails on mobile devices.
 */
import { useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useAppStore } from '@/state/useAppStore';
import { Sparkles, Compass } from 'lucide-react';

const emptySubscribe = () => () => {};

export function LandingBackground() {
  const is3DReady = useAppStore((s) => s.is3DReady);
  const sceneLoadProgress = useAppStore((s) => s.sceneLoadProgress);
  const webglFailed = useAppStore((s) => s.webglFailed);
  const stage = useAppStore((s) => s.stage);

  // Hydration-safe client detection via official React pattern
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (stage !== 'LANDING') return null;

  const pct = Math.min(100, Math.max(0, Math.round(sceneLoadProgress)));
  const showLoadingBadge = mounted && !is3DReady && !webglFailed && pct < 100;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* ── 1. Cinematic Architectural Backdrop ── */}
      <div
        className={`absolute inset-0 transition-opacity duration-1200 ease-out ${
          is3DReady && !webglFailed ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {/* Architectural Skyscraper Image with subtle ambient breath */}
        <div className="absolute inset-0 scale-105 animate-[pulse_10s_ease-in-out_infinite] opacity-90">
          <Image
            src="/images/hero-building.png"
            alt="Aria Residential Architecture"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_35%] filter brightness-[0.88] contrast-[1.08]"
          />
        </div>

        {/* Deep luxury twilight gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#090d18]/85 via-[#0e1628]/55 to-[#060a12]/95" />

        {/* Warm sunset amber atmospheric radial glow */}
        <div
          className="absolute inset-0 mix-blend-screen opacity-65"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(251, 146, 60, 0.22) 0%, rgba(217, 119, 6, 0.08) 45%, transparent 75%)',
          }}
        />

        {/* Architectural grid overlay for ultra-premium feel */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      {/* ── 2. Persistent Text-Readability Vignette (always present over 3D & 2D) ── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

      {/* ── 3. Luxury 3D Experience Loading Indicator (non-blocking, bottom-right) ── */}
      {showLoadingBadge && (
        <div className="pointer-events-auto fixed bottom-6 right-6 z-30 flex items-center gap-3 rounded-full border border-white/20 bg-background/80 px-4 py-2.5 shadow-2xl backdrop-blur-md transition-all duration-300">
          <div className="relative flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Compass className="h-3.5 w-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Interactive 3D Scene</span>
              <span className="text-amber-400 font-mono text-[11px]">{pct}%</span>
            </div>
            {/* Sleek mini progress bar */}
            <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(8, pct)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 4. WebGL Fallback Notification (if device GPU drops context) ── */}
      {webglFailed && (
        <div className="pointer-events-auto fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full border border-white/20 bg-background/85 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>High-Definition Visual Presentation Active</span>
        </div>
      )}
    </div>
  );
}
