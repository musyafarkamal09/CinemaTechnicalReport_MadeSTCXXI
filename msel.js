/* NOVA Multi-Select (hanya Admin). NovaSel.attach(host, {rows, id(el), actions:[{label, danger, run(ids)}], onDone}).
   Tombol "Pilih" mengaktifkan mode; checkbox dan toolbar tindakan hanya muncul saat mode aktif. Mode mati saat host terlepas dari halaman. */
(function () {
  'use strict';
  var CSS = '.msel-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px}.msel-bar[hidden]{display:none}' +
    '.msel-bar .msel-n{font-size:13px;opacity:.85;margin-right:auto}.msel-bar .btn{min-height:36px;padding:6px 12px}.msel-bar .msel-danger{border-color:#dc2626;color:#dc2626}' +
    '.msel-cb{display:none;width:18px;height:18px;margin:0 8px 0 0;vertical-align:middle;accent-color:var(--accent,#6246d9);flex:none}' +
    '.msel-on .msel-cb{display:inline-block}.msel-on tr.msel-sel>td{background:rgba(98,70,217,.12)}' +
    '@media(max-width:640px){.msel-bar{position:sticky;top:0;z-index:5;background:var(--card,#fff);padding:6px 0}}';
  function css() { if (document.getElementById('msel-css')) return; var s = document.createElement('style'); s.id = 'msel-css'; s.textContent = CSS; document.head.appendChild(s); }
  function attach(host, o) {
    if (!host || !o || !o.admin || host.getAttribute('data-msel')) return;
    css(); host.setAttribute('data-msel', '1');
    var on = false, bar = document.createElement('div'), obs;
    bar.className = 'msel-bar';
    bar.innerHTML = '<button type="button" class="btn sec" data-m="toggle">Pilih</button><span class="msel-n" hidden></span>' +
      '<button type="button" class="btn sec" data-m="all" hidden>Pilih semua</button>' +
      (o.actions || []).map(function (a, i) { return '<button type="button" class="btn sec' + (a.danger ? ' msel-danger' : '') + '" data-m="act" data-i="' + i + '" hidden>' + a.label + '</button>'; }).join('');
    host.parentNode.insertBefore(bar, host);
    function rows() { return [].slice.call(host.querySelectorAll(o.rows)); }
    function cb(r) { return r.querySelector('.msel-cb'); }
    function decorate() {
      rows().forEach(function (r) {
        if (cb(r)) return;
        var c = r.querySelector('td,th,*'), i = document.createElement('input');
        i.type = 'checkbox'; i.className = 'msel-cb'; i.setAttribute('aria-label', 'Pilih baris');
        if (c) c.insertBefore(i, c.firstChild);
      });
    }
    function picked() { return rows().filter(function (r) { var c = cb(r); return c && c.checked; }); }
    function sync() {
      var p = picked(), n = bar.querySelector('.msel-n');
      rows().forEach(function (r) { r.classList.toggle('msel-sel', !!(cb(r) && cb(r).checked)); });
      n.hidden = !on; n.textContent = p.length + ' dipilih';
      [].forEach.call(bar.querySelectorAll('[data-m=all],[data-m=act]'), function (b) { b.hidden = !on; if (b.getAttribute('data-m') === 'act') b.disabled = !p.length; });
      bar.querySelector('[data-m=toggle]').textContent = on ? 'Selesai' : 'Pilih';
      host.classList.toggle('msel-on', on);
    }
    function stop() { on = false; rows().forEach(function (r) { if (cb(r)) cb(r).checked = false; }); sync(); }
    bar.onclick = function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      var m = b.getAttribute('data-m');
      if (m === 'toggle') { on = !on; if (on) decorate(); else stop(); sync(); }
      else if (m === 'all') { var all = rows(), every = all.every(function (r) { return cb(r) && cb(r).checked; }); all.forEach(function (r) { if (cb(r)) cb(r).checked = !every; }); sync(); }
      else if (m === 'act') {
        var a = o.actions[+b.getAttribute('data-i')], ids = picked().map(o.id).filter(Boolean);
        if (!ids.length) return;
        if (a.confirm !== false && !window.confirm(a.label + ' ' + ids.length + ' data terpilih?')) return;
        bar.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        Promise.resolve(a.run(ids)).then(function () { stop(); if (o.onDone) o.onDone(); })
          .catch(function (er) { if (window.toast) window.toast(er && er.message || 'Gagal.', 1); })
          .then(function () { bar.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); sync(); });
      }
    };
    /* saat mode aktif, klik baris memilih baris (bukan membuka detail) */
    host.addEventListener('click', function (e) {
      if (!on) return;
      var r = e.target.closest(o.rows); if (!r || !host.contains(r)) return;
      if (e.target.classList && e.target.classList.contains('msel-cb')) { sync(); return; }
      e.stopPropagation(); e.preventDefault();
      var c = cb(r); if (c) c.checked = !c.checked; sync();
    }, true);
    host.addEventListener('keydown', function (e) { if (on && (e.key === 'Enter' || e.key === ' ') && e.target.closest(o.rows)) { e.stopPropagation(); e.preventDefault(); var c = cb(e.target.closest(o.rows)); if (c) { c.checked = !c.checked; sync(); } } }, true);
    obs = new MutationObserver(function () {
      if (!document.body.contains(host)) { obs.disconnect(); bar.remove(); return; }
      if (on) { decorate(); sync(); }
    });
    obs.observe(host, { childList: true, subtree: true });
    sync();
  }
  /* dipanggil setelah daftar dirender; aman dipanggil berulang pada host yang sama */
  window.NovaSel = { attach: attach };
})();
