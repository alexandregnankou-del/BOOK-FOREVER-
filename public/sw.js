/* BOOK FOREVER — service worker
   Objectif : l'application s'ouvre même sans réseau, sans jamais servir une
   page périmée ni une réponse d'API mise en cache.

   - Navigations : réseau d'abord (délai 4 s), repli sur la dernière coquille connue.
   - Fichiers versionnés (/assets/*) : cache d'abord, ils portent leur empreinte.
   - Polices, icônes, couvertures, audio : cache d'abord, rafraîchis en arrière-plan.
   - /api/* : jamais de cache, jamais de repli. */

const VERSION = 'bf-v3';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;

const STATIC_PREFIXES = ['/assets/', '/fonts/', '/icons/', '/audio/'];
const CACHED_EXTENSIONS = /\.(?:css|js|woff2?|png|jpe?g|webp|svg|mp3|ico)$/i;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      try {
        await cache.add(new Request('/', { cache: 'reload' }));
      } catch {
        /* hors ligne à l'installation : la coquille sera mise en cache plus tard */
      }
    })(),
  );
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

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response && response.ok) {
      cache.put('/', response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match('/');
    if (cached) return cached;
    return new Response(
      `<!doctype html><html lang="fr"><meta charset="utf-8">
       <meta name="viewport" content="width=device-width,initial-scale=1">
       <title>Hors ligne — BOOK FOREVER</title>
       <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#14110E;color:#F5EFE6;font-family:system-ui,sans-serif;text-align:center;padding:24px">
       <div><p style="letter-spacing:.3em;color:#C9A227;font-size:12px">BOOK FOREVER</p>
       <h1 style="font-family:Georgia,serif;font-size:28px;margin:12px 0">Pas de connexion</h1>
       <p style="color:#C4B8A4;max-width:320px;margin:0 auto 20px">Vos chapitres déjà ouverts restent lisibles. Revenez en ligne pour la suite.</p>
       <button onclick="location.reload()" style="padding:14px 28px;border-radius:999px;border:0;background:#C9A227;color:#14110E;font-weight:600">Réessayer</button>
       </div></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then((fresh) => {
        if (fresh && fresh.ok) cache.put(request, fresh.clone());
      })
      .catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
      || CACHED_EXTENSIONS.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }

  event.respondWith(fetch(request));
});

/* Permet à la page de demander l'activation immédiate d'une nouvelle version. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
