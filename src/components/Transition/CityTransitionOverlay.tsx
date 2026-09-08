'use client';

/**
 * CityTransitionOverlay — a fake loading screen for LANDING -> CITY_ORBIT.
 *
 * Simulates a loading process to meet user expectations, even though the 3D
 * assets are already loaded. Automatically advances the state to CITY_ORBIT
 * after the animation finishes.
 */
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { useAppStore } from '@/state/useAppStore';

export function CityTransitionOverlay() {
  const setStage = useAppStore((s) => s.setStage);

  // Automatically advance to CITY_ORBIT after the bar fills (2.3s)
  useEffect(() => {
    const timer = setTimeout(() => {
      setStage('CITY_ORBIT');
    }, 2400); // 2.4s to be safe and let the bar finish
    
    return () => clearTimeout(timer);
  }, [setStage]);

  return (
    <motion.div
      key="city-transition"
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md"
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
          <Building2 className="h-8 w-8" />
        </motion.div>
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Connecting
          </div>
          <div className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Loading City View
          </div>
          <div className="text-sm text-muted-foreground">
            Preparing 3D environment...
          </div>
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
