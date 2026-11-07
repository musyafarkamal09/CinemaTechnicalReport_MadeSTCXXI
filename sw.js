importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js');
/* Outlet Operation System - service worker (cache untuk penggunaan offline).
   Strategi: network-first untuk berkas aplikasi di domain yang sama, sehingga pengguna online
   selalu mendapat versi terbaru; cache hanya dipakai saat jaringan tidak tersedia.
   Permintaan API (Apps Script, lintas domain, POST) tidak pernah disentuh.
   Saat merilis versi baru, naikkan CACHE_VERSION. */
var CACHE_VERSION = 'nova-v16-ac-form';
var CACHE = CACHE_VERSION;
var SHELL = [
  './',
  './index.html',
  './tailwind.css',
  './legacy-modules.css',
  './oos.css',
  './figma.css',
  './nova.css',
  './nova-ds.css',
  './multi-item.js',
  './pdfkit.js',
  './logo-light.png',
  './logo-xxi.png',
  './nova-logo.png',
  './nova-logo-light.png',
  './ac-trend.js',
  './loader.js',
  './shell.js',
  './app.js',
  './sidebar.js',
  './ux.js',
  './drafts.js',
  './mode.js',
  './notify.js',
  './nav-back.js',
  './modul-dcp.js',
  './pelaporan.js',
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

/* network-first dengan batas waktu: jika jaringan lambat (> 3,5 detik) dan ada salinan cache, tampilkan cache lebih dulu
   sementara permintaan jaringan tetap berjalan dan memperbarui cache untuk kunjungan berikutnya. Permintaan API tidak pernah disentuh. */
var NET_TIMEOUT_MS = 3500;
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* API & CDN: biarkan langsung ke jaringan */

  var fromNet = fetch(req).then(function (res) {
    if (res && res.status === 200 && res.type === 'basic') {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  });

  var fallback = function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    });
  };

  var slow = new Promise(function (resolve) {
    setTimeout(function () {
      caches.match(req).then(function (hit) { if (hit) resolve(hit); });
    }, NET_TIMEOUT_MS);
  });

  e.respondWith(Promise.race([fromNet.catch(fallback), slow]));
});
