/* STC XXI Technical Report - pemilih mode tampilan (frontend saja).
   Tiga mode: Gelap (bawaan), Kaca (di atas foto), Terang (latar putih).
   Pemilih berupa kontrol segmen [data-mode] di header. Pilihan disimpan di perangkat (localStorage).
   Warna grafik meteran ikut diganti sesuai mode agar tetap terbaca. */
(function () {
  var MODES = ['dark', 'light'];
  var NAMES = { dark: 'Gelap', light: 'Terang' };
  var META = { dark: '#0a0a0a', light: '#ffffff' };
  // Warna seri grafik per mode: kontras cukup di latar gelap, kaca, dan terang.
  var CHART = {
    dark:  { listrik: '#dceeb1', wbp: '#c5b0f4', genset: '#f3c9b6', air: '#c8e6cd' },
    light: { listrik: '#1f1d3d', wbp: '#6a4fb0', genset: '#b5562f', air: '#2f6f4a' }
  };

  function valid(t) { if (t === 'glass') t = 'dark'; return MODES.indexOf(t) >= 0 ? t : 'dark'; }
  function current() { return valid(document.documentElement.getAttribute('data-theme')); }

  function paintChart(t) {
    if (typeof CC !== 'undefined' && CC) {
      var p = CHART[t];
      CC.listrik = p.listrik; CC.lwbp = p.listrik; CC.wbp = p.wbp; CC.genset = p.genset; CC.air = p.air;
    }
    if (typeof mLegend === 'function' && document.getElementById('mlg')) {
      document.getElementById('mlg').innerHTML = mLegend();
    }
    if (typeof mDraw === 'function' && typeof CH !== 'undefined' && CH) mDraw();
  }

  function paint(t) {
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      var on = b.dataset.mode === t;
      b.setAttribute('aria-checked', String(on));
      b.classList.toggle('on', on);
      b.tabIndex = on ? 0 : -1;
    });
    var tm = document.querySelector('meta[name=theme-color]');
    if (tm) tm.content = META[t];
    paintChart(t);
  }

  function set(t, quiet) {
    t = valid(t);
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('stc_theme', t); } catch (e) {}
    window.STC_MODE = t;
    paint(t);
    if (!quiet && typeof window.toast === 'function') window.toast('Mode ' + NAMES[t]);
  }

  // Menggantikan applyTheme dari app.js (yang hanya mengenal gelap/terang).
  window.applyTheme = function (t) { set(t, true); };

  document.querySelectorAll('[data-mode]').forEach(function (b) {
    b.onclick = function () { set(b.dataset.mode); };
    b.onkeydown = function (e) {
      var i = MODES.indexOf(current()), k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowDown') i = (i + 1) % MODES.length;
      else if (k === 'ArrowLeft' || k === 'ArrowUp') i = (i + MODES.length - 1) % MODES.length;
      else return;
      e.preventDefault();
      set(MODES[i]);
      var nb = document.querySelector('[data-mode="' + MODES[i] + '"]');
      if (nb) nb.focus();
    };
  });

  set(window.STC_MODE || 'dark', true);
})();
