/**
 * ============================================================================
 *  PREFETCH — perceived-performance asset warming
 * ============================================================================
 *
 * Downloads the heavy walkthrough assets into the browser's HTTP cache
 * BEFORE they are needed, so the eventual scene load skips the network
 * entirely (assets are served with `Cache-Control: immutable`, so cached
 * responses are reused without revalidation).
 *
 * Fetches run one-at-a-time during browser idle time, in priority order —
 * they never compete with a scene that's currently loading.
 * ============================================================================
 */

let queue: string[] = [];
let running = false;

async function drain() {
  running = true;
  while (queue.length) {
    const url = queue.shift()!;
    try {
      const res = await fetch(url, { cache: 'default' });
      // Drain the body so the response is fully cached.
      if (res.body) await res.body.cancel().catch(() => {});
    } catch {
      /* warm-up is best-effort; the real load will retry */
    }
  }
  running = false;
}

/**
 * Queue URLs for background prefetching (deduplicated, sequential,
 * started on idle). Safe to call repeatedly — e.g. on every stage change.
 */
export function prefetchAssets(urls: string[]) {
  if (typeof window === 'undefined') return;
  const fresh = urls.filter((u) => !queue.includes(u));
  if (!fresh.length) return;
  queue.push(...fresh);
  if (running) return;
  const ric = window.requestIdleCallback;
  if (typeof ric === 'function') ric(() => drain());
  else setTimeout(drain, 200);
}
