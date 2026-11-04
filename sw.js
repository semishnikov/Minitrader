// Офлайн-кэш: игра статична, поэтому после первого захода работает без сети.
// Стратегия: cache-first для своих файлов, сеть только как источник обновления.
const CACHE = 'otbleski-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './src/core/engine.js',
  './src/core/rng.js',
  './src/data/cards.js',
  './src/ui/app.js',
  './src/ui/art.js',
  './src/ui/dom.js',
  './src/ui/styles.css',
  './assets/fonts/cormorant-garamond-cyrillic-600-normal.woff2',
  './assets/fonts/cormorant-garamond-latin-600-normal.woff2',
  './assets/fonts/golos-text-cyrillic-400-normal.woff2',
  './assets/fonts/golos-text-cyrillic-500-normal.woff2',
  './assets/fonts/golos-text-latin-400-normal.woff2',
  './assets/fonts/golos-text-latin-500-normal.woff2',
  './assets/fonts/oswald-cyrillic-500-normal.woff2',
  './assets/fonts/oswald-cyrillic-600-normal.woff2',
  './assets/fonts/oswald-latin-500-normal.woff2',
  './assets/fonts/oswald-latin-600-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        // Фоном обновляем кэш, чтобы правки доезжали без ручной чистки.
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        }).catch(() => {});
        return hit;
      }
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
