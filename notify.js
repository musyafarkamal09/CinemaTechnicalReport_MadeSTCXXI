/* Notifikasi push (OneSignal): menautkan akun ke OneSignal saat login, melepas saat logout,
   dan menyediakan tombol "Aktifkan notifikasi" di menu akun. */
(function () {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  function withOS(fn) {
    window.OneSignalDeferred.push(function (OS) { try { fn(OS); } catch (e) {} });
  }
  function storedUser() {
    try {
      var raw = (window.localStorage && localStorage.getItem('stc_u')) || (window.sessionStorage && sessionStorage.getItem('stc_u'));
      var u = raw ? JSON.parse(raw) : null;
      return u && (u.userId || u.username) ? String(u.userId || u.username) : null;
    } catch (e) { return null; }
  }
  var linked = null;
  function syncLogin() {
    var app = document.getElementById('app');
    if (!app) return;
    var logged = !app.classList.contains('hidden');
    var id = storedUser();
    if (logged && id && id !== linked) {
      linked = id;
      withOS(function (OS) { OS.login(id); });
    } else if (!logged && linked) {
      linked = null;
      withOS(function (OS) { OS.logout(); });
    }
  }
  function addEnableButton() {
    var m = document.getElementById('uhmenu');
    if (!m || document.getElementById('osEnable')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'osEnable';
    b.className = (m.querySelector('button') || {}).className || '';
    b.textContent = 'Aktifkan notifikasi';
    b.onclick = function () {
      withOS(function (OS) { OS.Notifications.requestPermission(); });
    };
    m.appendChild(b);
  }
  function start() {
    addEnableButton();
    syncLogin();
    var app = document.getElementById('app'), login = document.getElementById('login');
    var mo = new MutationObserver(syncLogin);
    [app, login].forEach(function (el) { if (el) mo.observe(el, { attributes: true, attributeFilter: ['class'] }); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
