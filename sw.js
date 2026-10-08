/* GeoField Core: service worker (funcionamiento sin internet)
   Para publicar una versión nueva de index.html: cambia VERSION (v1 -> v2...). */
const VERSION = 'v2';
const CACHE = 'geofield-core-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];
const NAV_TIMEOUT_MS = 3000; // con señal débil, usa la copia guardada tras 3 s

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('geofield-core-') && k !== CACHE)
            .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Páginas: red primero (si hay señal buena, siempre la versión más nueva);
// si no hay red o tarda, la copia guardada.
function navigationResponse(req) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const fromCache = () => caches.match('./index.html').then(r => r || caches.match('./'));
    const timer = setTimeout(() => fromCache().then(finish), NAV_TIMEOUT_MS);
    fetch(req.url, { cache: 'no-cache' }).then(res => {   // no-cache: revalida contra el servidor (evita la caché HTTP de GitHub Pages)
      clearTimeout(timer);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        finish(res);
      } else {
        fromCache().then(r => finish(r || res));
      }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then(r => finish(r || Response.error()));
    });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(navigationResponse(req));
    return;
  }
  // Resto de archivos propios: caché primero, red como respaldo.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
