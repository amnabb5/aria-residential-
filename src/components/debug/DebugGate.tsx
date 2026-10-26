'use client';

/**
 * DebugGate — invisible global component that:
 *   1. Hydrates the `debug` flag from localStorage on mount.
 *   2. Registers a global keyboard shortcut ('k') to toggle debug.
 *   3. Persists debug changes to localStorage.
 *
 * Rendered once in page.tsx (always mounted). Renders nothing visible.
 */
import { useEffect } from 'react';
import { useAppStore } from '@/state/useAppStore';

const STORAGE_KEY = 'aria-debug';

export function DebugGate() {
  const debug = useAppStore((s) => s.debug);
  const toggleDebug = useAppStore((s) => s.toggleDebug);
  const setDebug = useAppStore((s) => s.setDebug);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    // Query flag is useful for repeatable device profiling without changing
    // the persisted preference: `?debug=1` enables the overlay for this load.
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      setDebug(true);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setDebug(true);
    } catch {
      /* ignore */
    }
  }, [setDebug]);

  // Persist on change.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('debug') === '1') return;
    try {
      localStorage.setItem(STORAGE_KEY, debug ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [debug]);

  // Global keyboard shortcut: 'k' toggles debug.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'k') return;
      // Don't steal browser/OS shortcuts like Ctrl+K / Cmd+K.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Avoid stealing the key when typing in a text field.
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      e.preventDefault();
      toggleDebug();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleDebug]);

  return null;
}
