/* STC XXI Technical Report - tiga mode tampilan (frontend saja).
   Mode: dark (gelap lumut, bawaan), glass (kaca di atas foto), light (terang latar putih).
   Tombol [data-thm] di header berpindah mode secara berurutan. Pilihan disimpan di perangkat (localStorage).
   Dimuat setelah app.js agar menggantikan applyTheme bawaan yang hanya mengenal gelap/terang. */
(function () {
  var MODES = ['dark', 'glass', 'light'];
  var NAMES = { dark: 'Gelap (hijau lumut)', glass: 'Kaca (foto)', light: 'Terang (latar putih)' };
  var ICON = { dark: '🌙', glass: '✨', light: '☀️' };
  var NEXT = { dark: 'glass', glass: 'light', light: 'dark' };

  function valid(t) { return MODES.indexOf(t) >= 0 ? t : 'dark'; }
  function current() { return valid(document.documentElement.getAttribute('data-theme')); }

  function paint(t) {
    document.querySelectorAll('[data-thm]').forEach(function (b) {
      b.textContent = ICON[t];
      b.title = 'Mode: ' + NAMES[t] + '. Klik untuk ganti mode';
      b.setAttribute('aria-label', 'Mode tampilan: ' + NAMES[t] + '. Klik untuk ganti');
    });
    var tm = document.querySelector('meta[name=theme-color]');
    if (tm) tm.content = t === 'light' ? '#0c3b2b' : (t === 'glass' ? '#120e0a' : '#0a1511');
  }

  function set(t, quiet) {
    t = valid(t);
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('stc_theme', t); } catch (e) {}
    window.STC_MODE = t;
    paint(t);
    if (!quiet && typeof window.toast === 'function') window.toast('Mode: ' + NAMES[t]);
  }

  // Menggantikan applyTheme dari app.js; app.js memanggilnya saat dimuat dengan nilai gelap/terang saja.
  window.applyTheme = function (t) { set(t, true); };

  document.querySelectorAll('[data-thm]').forEach(function (b) {
    b.onclick = function () { set(NEXT[current()]); };
  });

  // Pulihkan mode yang dipilih pengguna (app.js sudah menimpanya saat dimuat).
  set(window.STC_MODE || 'dark', true);
})();
