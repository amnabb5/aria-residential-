'use client';

import { useAppStore } from '@/state/useAppStore';
import { QualityMode, QUALITY_TIERS } from '@/config/perf';
import { Sliders, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function QualitySelector({ className }: { className?: string }) {
  const qualityMode = useAppStore((s) => s.qualityMode);
  const qualityTier = useAppStore((s) => s.qualityTier);
  const setQualityMode = useAppStore((s) => s.setQualityMode);
  const [open, setOpen] = useState(false);

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
        <span className="uppercase tracking-wider text-[11px]">
          {qualityMode === 'auto' ? `Auto (${qualityTier})` : qualityMode}
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
