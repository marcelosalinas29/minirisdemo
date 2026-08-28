// This service worker is intentionally conservative about caching HTML/
// navigation requests: those are ALWAYS fetched from the network first,
// so a new deploy is picked up immediately on the very next page load —
// no stuck "old version" ever again. Only genuinely immutable, content-
// hashed build assets (JS/CSS/fonts/images) are cached aggressively,
// since a new deploy always produces new filenames for those anyway.
const CACHE_NAME = 'consultorio-v2';

const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache backend/API requests
  if (
    url.pathname.startsWith('/rest') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/storage') ||
    url.pathname.startsWith('/functions') ||
    url.hostname.includes('supabase')
  ) {
    return; // Let the browser handle it normally
  }

  if (event.request.method !== 'GET') return;

  // HTML / navigation requests: network-first, ALWAYS. This is what
  // guarantees a fresh deploy shows up right away instead of a stale
  // cached shell pointing at old JS bundle filenames.
  const isHtmlOrNavigation =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  if (isHtmlOrNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Content-hashed build assets (JS/CSS/fonts/images) are safe to cache
  // aggressively: a new deploy always produces new filenames for these,
  // so there is zero risk of ever serving a stale version of them.
  const isImmutableAsset =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.mjs') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.otf') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico');

  if (isImmutableAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        })
      )
    );
    return;
  }
});
