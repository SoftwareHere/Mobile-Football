/* Pixel Gridiron service worker: offline cache (network-first so updates arrive) */
const CACHE = 'pixel-gridiron-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './assets/fonts/PressStart2P.woff2', './assets/fonts/VT323.woff2', './assets/icon-192.png', './assets/icon-512.png',
  './js/util.js', './js/data.js', './js/player.js', './js/league.js', './js/sim.js', './js/season.js', './js/career.js',
  './js/font.js', './js/sprites.js', './js/plays.js', './js/input.js', './js/field.js', './js/engine.js', './js/drills.js',
  './js/audio.js', './js/match.js', './js/ui.js', './js/main.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
