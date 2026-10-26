'use client';

import { useAppStore } from '@/state/useAppStore';
import { QualityMode, QUALITY_TIERS } from '@/config/perf';
import { Sliders, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

export function QualitySelector({ className }: { className?: string }) {
  const qualityMode = useAppStore((s) => s.qualityMode);
  const qualityTier = useAppStore((s) => s.qualityTier);
  const setQualityMode = useAppStore((s) => s.setQualityMode);
  const [open, setOpen] = useState(false);

  // The auto tier (e.g. "Auto (medium)") is hardware-derived, so it can NEVER
  // match the server's SSR snapshot — not even via mounted-gating;
  // React 19 still throws on the text diff. Instead: React renders ONLY the
  // stable literal ('Auto' / mode). The dynamic tier suffix is written into
  // the DOM imperatively via the ref after hydration — React never owns that
  // text, so there is nothing to mismatch. When the mode itself changes,
  // React rewrites the text node as usual.
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    el.textContent = qualityMode === 'auto' ? `Auto (${qualityTier})` : qualityMode;
  }, [qualityMode, qualityTier]);

  const modes: { id: QualityMode; label: string }[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'ultra', label: 'Ultra' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
  ];

  return (
    <div className={cn('relative pointer-events-auto', className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-white/20 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground/90 shadow-md backdrop-blur-md transition hover:bg-background/95"
        title="Graphics Quality Settings"
      >
        <Sliders className="h-3.5 w-3.5 text-amber-500" />
        <span className="uppercase tracking-wider text-[11px] min-w-16 text-left inline-block">
          {qualityMode === 'auto' ? 'Auto' : qualityMode}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/20 bg-background/90 p-2 shadow-2xl backdrop-blur-xl z-50">
          <div className="mb-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Graphics Quality</span>
            <Sparkles className="h-3 w-3 text-amber-500" />
          </div>
          <div className="space-y-1">
            {modes.map((m) => {
              const active = qualityMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setQualityMode(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition font-medium',
                    active
                      ? 'bg-primary text-primary-foreground font-semibold shadow'
                      : 'text-foreground/80 hover:bg-white/10 hover:text-foreground'
                  )}
                >
                  <span>{m.label}</span>
                  {/* Only rendered after hydration (open is user-triggered),
                      so the dynamic tier text here is hydration-safe. */}
                  {m.id === 'auto' && (
                    <span className="text-[10px] opacity-75 font-mono uppercase">
                      {qualityTier}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 border-t border-white/10 px-2 pt-1 text-[10px] text-muted-foreground/80">
            {QUALITY_TIERS[qualityTier]?.label} active
          </div>
        </div>
      )}
    </div>
  );
}
