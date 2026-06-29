/* Mandarin learning PWA — service worker.
 * Hand-written (no build-tool coupling) so it survives framework upgrades.
 * Provides offline support for the app shell, dictionary lookups and audio,
 * which is what makes reviews usable without a signal. */

const VERSION = "v3";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const DICT_CACHE = `dict-${VERSION}`;
const AUDIO_CACHE = `audio-${VERSION}`;

const KEEP = new Set([SHELL_CACHE, ASSET_CACHE, DICT_CACHE, AUDIO_CACHE]);

// The core navigations to warm on install so the app opens offline.
const SHELL_ROUTES = ["/", "/review", "/reader", "/dashboard"];

// Max entries per runtime cache (LRU). Audio clips are larger than dict JSON.
const LIMITS = { [DICT_CACHE]: 300, [AUDIO_CACHE]: 150 };

self.addEventListener("install", (event) => {
  // Pre-cache the main route shells (best-effort, per-route so one failure
  // doesn't abort the rest — e.g. an auth redirect when not signed in).
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(SHELL_ROUTES.map((r) => cache.add(r).catch(() => {}))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|gif|webp|ico)$/.test(url.pathname)
  );
}

/** Keep a runtime cache under its entry cap by evicting the oldest entries.
 *  Cache API keys() preserves insertion order, so the front is least-recent. */
async function trim(cache, cacheName) {
  const max = LIMITS[cacheName];
  if (!max) return;
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/** Re-insert a hit so it becomes most-recently-used (LRU for capped caches). */
async function touch(cache, cacheName, request, hit) {
  if (!LIMITS[cacheName]) return;
  await cache.delete(request);
  await cache.put(request, hit.clone());
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) {
    await touch(cache, cacheName, request, hit);
    return hit;
  }
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    await trim(cache, cacheName);
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(async (res) => {
      if (res.ok) {
        await cache.put(request, res.clone());
        await trim(cache, cacheName);
      }
      return res;
    })
    .catch(() => hit);
  return hit || fetchPromise;
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || (await cache.match("/")) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache POST/auth mutations

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // skip Supabase/Azure/cross-origin

  // Dictionary lookups: instant from cache, refresh in the background.
  if (url.pathname.startsWith("/api/dict")) {
    event.respondWith(staleWhileRevalidate(request, DICT_CACHE));
    return;
  }
  // Generated/cached audio (on-demand /api/tts fallback; CDN clips are cross-origin).
  if (url.pathname.startsWith("/api/tts") || url.pathname.startsWith("/audio")) {
    event.respondWith(cacheFirst(request, AUDIO_CACHE));
    return;
  }
  // Build assets, icons, fonts.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }
  // App pages (navigations).
  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
    return;
  }
});
