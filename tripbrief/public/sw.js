/**
 * Service worker for Trip Brief.
 *
 * Google Play's Trusted Web Activity path requires an installable PWA, which
 * means a service worker with a fetch handler. Strategy:
 *   - App shell (HTML/JS/CSS/icons): cache-first, refreshed in the background.
 *   - API calls: network-first with a cache fallback, so a previously viewed
 *     destination still renders offline.
 *   - Navigations: fall back to the cached shell, then to /offline.html.
 */

const VERSION = 'v1';
const SHELL = `tripbrief-shell-${VERSION}`;
const DATA = `tripbrief-data-${VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];

const API_HOSTS = [
  'api.open-meteo.com',
  'archive-api.open-meteo.com',
  'air-quality-api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'nominatim.openstreetmap.org',
  'restcountries.com',
  'api.frankfurter.dev',
  'date.nager.at',
  'en.wikipedia.org',
  'disease.sh',
  'get.geojs.io',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Navigations — serve the app shell, fall back to the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(async () => (await caches.match('/index.html')) || caches.match('/offline.html'))
    );
    return;
  }

  // 2. Third-party API data — network first, cache fallback.
  if (API_HOSTS.includes(url.hostname)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(DATA).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. Same-origin static assets — cache first, revalidate in background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const net = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});
