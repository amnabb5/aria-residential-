'use client';

/**
 * ServiceWorkerRegister — enables on-device caching (public/sw.js):
 * heavy 3D assets are served from the phone/computer's disk on repeat
 * visits, so the site opens instantly instead of re-downloading ~190 MB.
 */
import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* caching is an enhancement — never block the app */
    });
  }, []);

  return null;
}
