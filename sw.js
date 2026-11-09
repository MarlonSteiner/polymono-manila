// Network first, so updates show up right away; the cache keeps the game playable offline.
const CACHE = 'polymono-manila-v4';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/engine.js', 'js/ai.js', 'js/ui.js', 'js/board.js', 'js/art.js', 'js/data.js', 'js/audio.js',
  'js/net.js', 'js/online.js', 'vendor/mqtt.min.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's own HTTP cache, so a new version never mixes in old files.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' })
    .then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
