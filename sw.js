/* =========================================================
   SERVICE WORKER – Narodeninový kalendár
   OPRAVA: verzia zvýšená na v4, aby sa vynútila aktualizácia
   ========================================================= */

const CACHE_VERSION = 'v4';
const CACHE_STATIC  = `narodeninovy-kalendar-static-${CACHE_VERSION}`;
const CACHE_RUNTIME = `narodeninovy-kalendar-runtime-${CACHE_VERSION}`;
const CACHE_FONTS   = `narodeninovy-kalendar-fonts-${CACHE_VERSION}`;

/* Súbory, ktoré chceme mať vždy offline */
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-512.png',
  './apple-touch-icon.png'
];

/* =========================================================
   INSTALL – precache + okamžitá aktivácia
   ========================================================= */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* =========================================================
   ACTIVATE – upratanie starých cache
   ========================================================= */
self.addEventListener('activate', (event) => {
  const allowed = [CACHE_STATIC, CACHE_RUNTIME, CACHE_FONTS];

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !allowed.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* =========================================================
   MESSAGE – manuálna aktivácia nového SW (z tlačidla 🎂)
   ========================================================= */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* =========================================================
   FETCH – stratégie podľa typu requestu
   ========================================================= */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ignoruj non-GET requesty
  if (req.method !== 'GET') return;

  // Ignoruj chrome-extension:// a podobné
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  // 1) HTML navigácia → network-first s fallbackom na index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_STATIC).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() =>
          caches.match('./index.html').then(
            (r) => r || new Response('Offline', { status: 503 })
          )
        )
    );
    return;
  }

  // 2) Google Fonts → cache-first (runtime)
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (!res || (res.status !== 200 && res.type !== 'opaque')) {
              return res;
            }
            const copy = res.clone();
            caches.open(CACHE_FONTS).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // 3) Ostatné (CSS, JS, obrázky) → cache-first + stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (!res || res.status !== 200 || res.type === 'opaque') {
            return res;
          }
          const copy = res.clone();
          caches.open(CACHE_RUNTIME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});