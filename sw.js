/* STC XXI Technical Report - service worker (cache untuk penggunaan offline).
   Strategi: network-first untuk berkas aplikasi di domain yang sama, sehingga pengguna online
   selalu mendapat versi terbaru; cache hanya dipakai saat jaringan tidak tersedia.
   Permintaan API (Apps Script, lintas domain, POST) tidak pernah disentuh.
   Saat merilis versi baru, naikkan CACHE_VERSION. */
var CACHE_VERSION = 'stc-tr-v1';
var CACHE = CACHE_VERSION;
var SHELL = [
  './',
  './index.html',
  './style.css',
  './style-polish.css',
  './style-dash.css',
  './style-dash2.css',
  './style-reference.css',
  './style-redesign.css',
  './style-sidebar.css',
  './style-ux.css',
  './app.js',
  './sidebar.js',
  './ux.js',
  './manifest.json',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* API & CDN: biarkan langsung ke jaringan */

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
