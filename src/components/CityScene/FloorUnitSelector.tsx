'use client';

/**
 * FloorUnitSelector — the HTML overlay on top of the CityOrbit canvas.
 *
 * Lets the user pick a floor (1–N) and a unit (A–D), see live specs, and
 * confirm to trigger the ZOOM_TRANSITION. Disabled Confirm until both are
 * chosen. Includes a "Back to site" link.
 *
 * Pure HTML/Tailwind (no R3F), absolutely positioned over the canvas.
 */
import { ArrowLeft, ChevronRight, BedDouble, Bath, Maximize, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { floors, BUILDING_NAME, getApartmentKey } from '@/config/apartments';
import { useAppStore } from '@/state/useAppStore';
import { cn } from '@/lib/utils';
import { prefetchAssets } from '@/lib/prefetch';
import { isMobileDevice } from '@/config/perf';
import { useEffect } from 'react';

export function FloorUnitSelector() {
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const selectedUnit = useAppStore((s) => s.selectedUnit);
  const selectFloor = useAppStore((s) => s.selectFloor);
  const selectUnit = useAppStore((s) => s.selectUnit);
  const confirmSelection = useAppStore((s) => s.confirmSelection);
  const resetToLanding = useAppStore((s) => s.resetToLanding);

  // PERF (perceived): the user is browsing floors here — warm the walkthrough
  // assets in the background so entering an apartment feels instant. Phones
  // prefetch their tuned city backdrop, desktops the full one.
  useEffect(() => {
    prefetchAssets([
      '/models/apartments/ApartmentV2.fast.ksplat',
      isMobileDevice()
        ? '/models/la_night_mobile.ksplat'
        : '/models/la_night_full.ksplat',
    ]);
  }, []);

  const currentFloor = floors.find((f) => f.floor === selectedFloor);
  const units = currentFloor?.units ?? [];
  const canConfirm = selectedFloor != null && selectedUnit != null;
  const selectedSpec = selectedUnit
    ? units.find((u) => u.unit === selectedUnit)
    : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col">
      {/* Top bar: title + back link */}
      <div className="pointer-events-auto flex items-center justify-between gap-4 p-4 sm:p-6">
        <button
          onClick={resetToLanding}
          className="group inline-flex items-center gap-2 rounded-full bg-background/70 px-4 py-2 text-sm font-medium text-foreground/80 backdrop-blur-md transition hover:bg-background/90 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
          Back to site
        </button>
        <div className="rounded-full bg-background/70 px-4 py-2 text-sm font-medium text-foreground/80 backdrop-blur-md">
          {BUILDING_NAME}
        </div>
      </div>

      {/* Selector panel */}
      <div className="mt-auto p-3 sm:p-6">
        <div className="pointer-events-auto mx-auto w-full max-w-4xl rounded-2xl border border-border/60 bg-background/80 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                Select Your Apartment
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Choose a floor, then a unit to preview.
              </p>
            </div>
            {selectedSpec && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {getApartmentKey(selectedFloor!, selectedUnit!)}
              </Badge>
            )}
          </div>

          {/* Floor chips */}
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Floor
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
              {floors.map((f) => {
                const active = selectedFloor === f.floor;
                return (
                  <button
                    key={f.floor}
                    onClick={() => selectFloor(f.floor)}
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold transition',
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow'
                        : 'border-border bg-background/60 text-foreground/70 hover:border-foreground/40 hover:text-foreground'
                    )}
                    title={f.name}
                  >
                    {f.floor}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Units */}
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Unit {selectedFloor == null && '— pick a floor first'}
            </div>
            {units.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Select a floor above to see available units.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {units.map((u) => {
                  const active = selectedUnit === u.unit;
                  return (
                    <button
                      key={u.unit}
                      onClick={() => selectUnit(u.unit)}
                      className={cn(
                        'group flex flex-col gap-1 rounded-lg border p-3 text-left transition',
                        active
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-background/60 hover:border-foreground/40'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold">Unit {u.unit}</span>
                        <Compass className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="h-3 w-3" />
                          {u.beds} bd
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Bath className="h-3 w-3" />
                          {u.baths} ba
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Maximize className="h-3 w-3" />
                          {u.sqft} ft²
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-foreground/80">
                        {u.price}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-xs text-muted-foreground">
              {selectedSpec ? (
                <span className="truncate">
                  {getApartmentKey(selectedFloor!, selectedUnit!)} ·{' '}
                  {selectedSpec.beds} bed · {selectedSpec.facing}
                </span>
              ) : (
                <span>Pick a floor and unit to continue</span>
              )}
            </div>
            <Button
              onClick={confirmSelection}
              disabled={!canConfirm}
              size="lg"
              className="shrink-0"
            >
              Confirm
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
