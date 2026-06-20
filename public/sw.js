/* Mandarin learning PWA — service worker.
 * Hand-written (no build-tool coupling) so it survives framework upgrades.
 * Provides offline support for the app shell, dictionary lookups and audio,
 * which is what makes reviews usable without a signal. */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const DICT_CACHE = `dict-${VERSION}`;
const AUDIO_CACHE = `audio-${VERSION}`;

const KEEP = new Set([SHELL_CACHE, ASSET_CACHE, DICT_CACHE, AUDIO_CACHE]);

self.addEventListener("install", (event) => {
  // Pre-cache the home route so the app opens offline.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(["/"]).catch(() => {})),
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

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
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
  // Generated/cached audio.
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
