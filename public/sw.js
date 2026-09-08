/**
 * Aria Residences service worker — on-device caching.
 *
 * Strategies:
 *   • Immutable heavy assets (models, HDRI, images, build chunks):
 *     CACHE-FIRST. Served from disk on every repeat visit — zero server
 *     round-trips. (~190 MB total; browsers evict only under disk pressure.)
 *   • Page navigations (HTML): NETWORK-FIRST with cache fallback, so the
 *     site always shows fresh content when online but still opens offline
 *     or on a flaky connection.
 *
 * Bump CACHE_VERSION to invalidate everything (assets are also fingerprinted
 * or served immutable, so this is only needed for hard refreshes).
 */
const CACHE_VERSION = 'aria-v1';
const IMMUTABLE_PREFIXES = ['/_next/static/', '/models/', '/hdri/', '/images/'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for immutable assets.
  if (IMMUTABLE_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        } catch {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // Network-first (with cache fallback) for page navigations.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((r) => r || caches.match('/'))
        )
    );
  }
});
