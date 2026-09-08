'use client';

/**
 * TransitionOverlay — the crossfade/blur overlay shown during ZOOM_TRANSITION.
 *
 * Fades in a blurred, darkened veil with an "Entering apartment 3-A…" message
 * while the GSAP camera tween runs. When the tween completes, the stage flips
 * to WALKTHROUGH and this overlay unmounts (AnimatePresence handles the exit).
 */
import { motion } from 'framer-motion';
import { DoorOpen } from 'lucide-react';
import { useAppStore } from '@/state/useAppStore';
import { getApartmentKey, getApartment } from '@/config/apartments';

export function TransitionOverlay() {
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const selectedUnit = useAppStore((s) => s.selectedUnit);

  if (selectedFloor == null || selectedUnit == null) return null;

  const key = getApartmentKey(selectedFloor, selectedUnit);
  const spec = getApartment(selectedFloor, selectedUnit);
  const label = spec
    ? `Unit ${selectedUnit} · ${spec.beds} bed · ${spec.sqft} ft²`
    : `Unit ${selectedUnit}`;

  return (
    <motion.div
      key="transition"
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      <motion.div
        className="flex flex-col items-center gap-4 px-6 text-center"
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"
        >
          <DoorOpen className="h-8 w-8" />
        </motion.div>
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Entering apartment
          </div>
          <div className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {key}
          </div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
        <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.3, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
