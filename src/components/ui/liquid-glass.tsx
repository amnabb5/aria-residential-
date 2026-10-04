'use client';

/**
 * LiquidGlass — app-wide wrapper around `quick-liquid` (Apple-style liquid
 * glass: real SVG backdrop refraction, rim lighting, chromatic dispersion).
 *
 * Why a wrapper:
 *  - One place defines the design-language presets (`variant`) so every glass
 *    surface in the app shares the same optics.
 *  - Device-aware quality: SVG displacement maps are GPU-composited but not
 *    free — phones render with a lighter tier (and identical visuals at
 *    mobile sizes), desktops get full quality.
 *  - SSR-safe: the engine only mounts in an effect (client), and hydration
 *    differences are avoided by rendering plain children until mounted.
 */

import { useSyncExternalStore } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import { isMobileDevice } from '@/config/perf';
import { cn } from '@/lib/utils';

export type GlassVariant = 'nav' | 'tab' | 'panel' | 'chip' | 'cta';

interface LiquidGlassSurfaceProps {
  variant?: GlassVariant;
  className?: string;
  children?: React.ReactNode;
  role?: React.AriaRole;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean;
  /** Disable the engine (renders a plain backdrop-blur fallback instead). */
  disabled?: boolean;
}

const PRESETS: Record<
  GlassVariant,
  {
    config: Parameters<typeof LiquidGlass>[0]['config'];
    className: string;
    liquidPress?: boolean;
  }
> = {
  // Slim, dock-like bar for the floating navbar.
  nav: {
    config: {
      material: 'regular',
      borderRadius: 20,
      blur: 14,
      saturation: 1.4,
      tint: '255, 255, 255',
      tintOpacity: 0.2,
      refractionStrength: 16,
      bezelWidth: 26,
      chromaticAberration: 0.18,
      edgeHighlight: 0.7,
      dynamicLighting: true,
      quality: 'high',
      appearance: 'light',
    },
    className: 'shadow-[0_8px_32px_rgba(0,0,0,0.18)]',
  },
  // Compact active-section indicator inside the navigation bar.
  tab: {
    config: {
      material: 'regular',
      borderRadius: 12,
      blur: 12,
      saturation: 1.4,
      tint: '255, 255, 255',
      tintOpacity: 0.2,
      refractionStrength: 14,
      bezelWidth: 20,
      chromaticAberration: 0.16,
      edgeHighlight: 0.75,
      quality: 'high',
      appearance: 'light',
    },
    className: '',
  },
  // Large content cards (selector panel, CTA panel, hero stats).
  panel: {
    config: {
      material: 'regular',
      borderRadius: 24,
      blur: 18,
      saturation: 1.35,
      tint: '255, 255, 255',
      tintOpacity: 0.32,
      refractionStrength: 22,
      bezelWidth: 32,
      chromaticAberration: 0.2,
      edgeHighlight: 0.8,
      quality: 'high',
      appearance: 'light',
    },
    className: 'shadow-[0_16px_48px_rgba(0,0,0,0.22)]',
  },
  // Small pill surfaces (badges, compact controls).
  chip: {
    config: {
      material: 'clear',
      borderRadius: 999,
      blur: 10,
      saturation: 1.5,
      refractionStrength: 12,
      bezelWidth: 18,
      chromaticAberration: 0.24,
      edgeHighlight: 0.9,
      quality: 'medium',
      appearance: 'auto',
    },
    className: '',
    liquidPress: true,
  },
  // Prominent CTA surfaces.
  cta: {
    config: {
      material: 'clear',
      borderRadius: 20,
      blur: 12,
      saturation: 1.45,
      refractionStrength: 18,
      bezelWidth: 24,
      chromaticAberration: 0.22,
      edgeHighlight: 0.95,
      dynamicLighting: true,
      quality: 'high',
      appearance: 'auto',
    },
    className: '',
    liquidPress: true,
  },
};

// Mount + device-tier flags via useSyncExternalStore: server snapshot renders
// the frosted fallback (no hydration mismatch), client snapshots are reactive
// (e.g. tablet rotation flips the quality tier live).
const noopSubscribe = () => () => {};
const windowSubscribe = (onStoreChange: () => void) => {
  window.addEventListener('resize', onStoreChange);
  return () => window.removeEventListener('resize', onStoreChange);
};

export function LiquidGlassSurface({
  variant = 'panel',
  className,
  children,
  role,
  style,
  'aria-hidden': ariaHidden,
  disabled = false,
}: LiquidGlassSurfaceProps) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  const mobile = useSyncExternalStore(windowSubscribe, isMobileDevice, () => false);

  const preset = PRESETS[variant];
  const baseConfig = preset.config ?? {};

  // Pre-mount / disabled / server render: a graceful frosted fallback with
  // the same geometry, so there is never a layout flash.
  if (!mounted || disabled) {
    return (
      <div
        className={cn(
          'backdrop-blur-md [background:rgba(255,255,255,0.08)] [border:1px_solid_rgba(255,255,255,0.22)]',
          className
        )}
        role={role}
        style={style}
        aria-hidden={ariaHidden}
      >
        {children}
      </div>
    );
  }

  return (
    <LiquidGlass
      config={{
        ...baseConfig,
        // Phones: lighter displacement tier — visually identical at mobile
        // sizes, materially cheaper to composite.
        quality: mobile ? 'medium' : baseConfig.quality,
        refractionStrength: mobile
          ? Math.round((baseConfig.refractionStrength ?? 20) * 0.7)
          : baseConfig.refractionStrength,
      }}
      liquidPress={preset.liquidPress}
      className={cn(preset.className, className)}
      role={role}
      style={style}
      aria-hidden={ariaHidden}
    >
      {children}
    </LiquidGlass>
  );
}
