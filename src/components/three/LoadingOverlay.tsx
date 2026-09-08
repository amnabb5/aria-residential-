'use client';

/**
 * LoadingOverlay — global asset-loading progress UI.
 *
 * Uses drei's useProgress, which subscribes to THREE.DefaultLoadingManager.
 * Works for BOTH real GLB loads (via useGLTF) AND, gracefully, for the
 * placeholder path (which resolves near-instantly, so this overlay flashes
 * briefly then hides). Keeping this UI in place today means real models
 * "just work" with a real progress bar later.
 *
 * Rendered as a sibling overlay (outside the Canvas) so it can be styled
 * freely with Tailwind.
 */
import { useProgress } from '@react-three/drei';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  /** Override the label shown under the spinner. */
  label?: string;
  /** When true, the overlay is always rendered (use during transitions). */
  force?: boolean;
}

export function LoadingOverlay({ label, force = false }: LoadingOverlayProps) {
  const { active, progress, item, loaded, total } = useProgress();

  // Show when something is actively loading, or when forced.
  const visible = force || active;

  if (!visible) return null;

  const pct = Math.round(progress);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity">
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-sm font-medium text-foreground/80">
          {label ?? (item ? `Loading ${item}` : 'Preparing scene')}
        </div>
        <div className="h-1.5 w-56 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {loaded}/{total} assets · {pct}%
        </div>
      </div>
    </div>
  );
}
