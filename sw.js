/* ============================================================
   Service worker — Julie De Kezel
   Doel: bezoekers nooit op een verouderde (gecachete) versie laten
   lezen, en de site toch offline bruikbaar maken.

   Strategie:
   - HTML  -> network-first  (pagina is altijd vers; offline: cache)
   - assets-> cache-first    (veiliger, want elke asset heeft ?v=BUILD)
   - oude caches worden bij activering weggegooid
   - een nieuwe versie herlaadt de pagina automatisch, één keer

   BUILD staat ook in index.html (meta name="build") en in build.py.
   ============================================================ */

const BUILD = '20261020a';
const CACHE = 'jdj-' + BUILD;

const PRECACHE = [
  './',
  './index.html',
  './css/style.css?v=' + BUILD,
  './fonts/fonts.css?v=' + BUILD,
  './js/reveal.js?v=' + BUILD,
  './js/app.js?v=' + BUILD,
  './assets/julie.jpg',
  './assets/praktijk.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'JDJ_UPDATED', build: BUILD });
        }
      })
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // externe links: niet bemoeien

  const isPage = req.mode === 'navigate' ||
                 (req.destination === 'document' && url.pathname.endsWith('.html'));

  if (isPage) {
    // network-first MET no-store: anders geeft de browser-/CDN-cache
    // een 304 terug en blijft de bezoeker de oude HTML zien
    e.respondWith(
      fetch(req.url, { cache: 'no-store', credentials: 'same-origin', redirect: 'follow' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
