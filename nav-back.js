/* STC XXI - tombol Back Android/PWA (frontend saja, tidak menyentuh backend).
   Back menutup modal atau sidebar dulu, lalu kembali ke Dashboard.
   Dari Dashboard, tekan dua kali dalam 2 detik untuk keluar dari aplikasi. */
(function () {
  var lastBack = 0;
  var SENTINEL = { stc: 'app' };

  function el(id) { return document.getElementById(id); }
  function modalOpen() { var m = el('modal'); return !!m && !m.classList.contains('hidden'); }
  function sideOpen() { var s = el('side'); return !!s && s.classList.contains('open'); }
  function pushSentinel() { try { history.pushState(SENTINEL, '', location.href); } catch (e) {} }
  function notify(msg) {
    var t = el('toast'); if (!t) return;
    t.textContent = msg; t.className = 'show';
    clearTimeout(notify.h); notify.h = setTimeout(function () { t.className = ''; }, 2500);
  }
  function currentPage() {
    var items = document.querySelectorAll('[data-p].on');
    for (var i = 0; i < items.length; i++) {
      var p = items[i].getAttribute('data-p');
      if (p && p !== 'menu' && p !== 'new' && p !== 'search') return p;
    }
    return 'dashboard';
  }

  function onBack() {
    if (modalOpen()) {
      var mx = el('mx');
      if (mx) mx.click();
      if (modalOpen()) notify('Laporan sedang dikirim, mohon tunggu.');
      pushSentinel();
      return;
    }
    if (sideOpen()) {
      var shade = el('shade');
      if (shade) shade.click();
      else { el('side').classList.remove('open'); }
      pushSentinel();
      return;
    }
    if (currentPage() !== 'dashboard') {
      var home = document.querySelector('[data-p="dashboard"]');
      if (home) home.click();
      pushSentinel();
      return;
    }
    var now = Date.now();
    if (now - lastBack < 2000) return; // tekan kedua: biarkan browser keluar
    lastBack = now;
    notify('Tekan sekali lagi untuk keluar.');
    pushSentinel();
  }

  window.addEventListener('popstate', onBack);
  try {
    history.replaceState({ stc: 'root' }, '', location.href);
    pushSentinel();
  } catch (e) {}
})();
