/* BOOK FOREVER — service worker
   Règle absolue : le HTML, les réponses /api et les chapitres ne sont JAMAIS mis en cache.
   Seuls les fichiers statiques (polices, icônes, couvertures) le sont. */

const VERSION = 'bf-v1';
const STATIC_CACHE = `${VERSION}-static`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* Jamais de cache pour l'API, les documents et le service worker lui-même. */
  if (url.pathname.startsWith('/api/') || request.mode === 'navigate' || url.pathname === '/sw.js') {
    return;
  }

  const isStatic =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/media/');

  if (!isStatic) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
