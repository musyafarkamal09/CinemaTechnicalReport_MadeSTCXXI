/* NOVA Multi-Select: satu komponen untuk semua kategori laporan. Hanya Admin; mode seleksi dan toolbar muncul saat tombol "Pilih" diaktifkan.
   Pemakaian: STC.msel.mount({ key, admin, host, rows, id, anchor, reload, actions:[{label, danger, run(ids, ctx)}] })
   - host: elemen daftar; rows: selector baris di dalam host; id(el): id baris; anchor: tempat tombol "Pilih"; reload(): muat ulang daftar. */
(function () {
  'use strict';
  var ST = {}, BAR = null, WATCH = null, CUR = null, LASTPG = '', GONE = 0;
  function toast(m, e) { if (window.STC && STC.toast) STC.toast(m, e); }
  function slot(k) { return ST[k] || (ST[k] = { on: false, sel: {} }); }
  function count(c) { return Object.keys(slot(c.key).sel).length; }
  function rowsOf(c) { return [].slice.call(c.host.querySelectorAll(c.rows)).filter(function (el) { return !!c.id(el); }); }
  function paint(c) {
    var s = slot(c.key);
    rowsOf(c).forEach(function (el) {
      var id = c.id(el), tg = el.tagName === 'TR' ? el.cells[0] : el, cb = tg && tg.querySelector(':scope > .msel-cb');
      if (!s.on) { if (cb) cb.remove(); el.classList.remove('msel-row', 'msel-sel'); el.removeAttribute('aria-selected'); return; }
      tg.classList.add('msel-c0');
      if (!cb) { cb = document.createElement('span'); cb.className = 'msel-cb'; cb.innerHTML = '<input type="checkbox" tabindex="-1" aria-hidden="true"><i></i>'; tg.insertBefore(cb, tg.firstChild); }
      var on = !!s.sel[id]; cb.firstChild.checked = on;
      el.classList.add('msel-row'); el.classList.toggle('msel-sel', on); el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }
  function bar(c) {
    var s = slot(c.key);
    if (!s.on) { closeBar(); return; }
    if (!BAR) {
      BAR = document.createElement('div'); BAR.className = 'msel-bar'; BAR.setAttribute('role', 'toolbar'); BAR.setAttribute('aria-label', 'Tindakan massal');
      document.body.appendChild(BAR);
      WATCH = setInterval(function () {
        if (!CUR || document.body.contains(CUR.host)) { GONE = 0; return; }
        BAR.style.display = 'none'; /* daftar sedang dimuat ulang: sembunyikan; mount berikutnya menampilkannya lagi */
        if (++GONE > 7) { ST = {}; GONE = 0; closeBar(); } /* >4 dtk tanpa daftar = halaman ditinggalkan: mode seleksi dimatikan */
      }, 600);
    }
    CUR = c; BAR.style.display = '';
    var n = count(c), all = rowsOf(c).length;
    BAR.innerHTML = '<span class="msel-n"><b>' + n + '</b> dipilih</span><button type="button" class="msel-b" data-m="all">' + (n && n >= all ? 'Kosongkan' : 'Pilih semua') + '</button><span class="msel-sp"></span>' +
      (c.actions || []).map(function (a, i) { return '<button type="button" class="msel-b' + (a.danger ? ' msel-d' : ' msel-p') + '" data-m="a' + i + '"' + (n ? '' : ' disabled') + '>' + STC.esc(a.label) + '</button>'; }).join('') +
      '<button type="button" class="msel-b msel-x" data-m="x" aria-label="Selesai memilih">Selesai</button>';
    BAR.onclick = function (e) {
      var b = e.target.closest('[data-m]'); if (!b || b.disabled) return; var m = b.getAttribute('data-m');
      if (m === 'x') return setOn(c, false);
      if (m === 'all') { var cur = count(c) && count(c) >= rowsOf(c).length; slot(c.key).sel = {}; if (!cur) rowsOf(c).forEach(function (el) { slot(c.key).sel[c.id(el)] = 1; }); paint(c); return bar(c); }
      var act = c.actions[Number(m.slice(1))], ids = Object.keys(slot(c.key).sel);
      if (!act || !ids.length) return;
      var els = rowsOf(c).filter(function (el) { return slot(c.key).sel[c.id(el)]; });
      [].forEach.call(BAR.querySelectorAll('button'), function (x) { x.disabled = true; });
      Promise.resolve().then(function () { return act.run(ids, { els: els, key: c.key }); }).then(function (r) {
        if (r === false) { bar(c); return; } /* dibatalkan pengguna: seleksi tetap */
        slot(c.key).sel = {}; if (c.reload) c.reload(); else { paint(c); bar(c); }
      }, function (er) { toast((er && er.message) || 'Tindakan massal gagal.', 1); bar(c); });
    };
  }
  function closeBar() { if (BAR) { BAR.remove(); BAR = null; } if (WATCH) { clearInterval(WATCH); WATCH = null; } CUR = null; }
  function setOn(c, on) {
    var s = slot(c.key); s.on = !!on; if (!on) s.sel = {};
    var t = document.querySelector('.msel-tg[data-k="' + c.key + '"]'); if (t) { t.setAttribute('aria-pressed', on ? 'true' : 'false'); t.classList.toggle('msel-on', !!on); }
    c.host.classList.toggle('msel-active', !!on); paint(c); bar(c);
  }
  function toggle(c, el) { var s = slot(c.key), id = c.id(el); if (!id) return; if (s.sel[id]) delete s.sel[id]; else s.sel[id] = 1; paint(c); bar(c); }
  function mount(c) {
    if (!c || !c.admin || !c.host) { return; }
    var s = slot(c.key), pg = (document.getElementById('ptitle') || {}).textContent || ''; c.host.__msel = c;
    if (LASTPG && LASTPG !== pg) { ST = {}; s = slot(c.key); closeBar(); } /* pindah halaman: mode seleksi kembali mati */
    LASTPG = pg;
    if (!c.host.__mselBound) {
      c.host.__mselBound = true;
      c.host.addEventListener('click', function (e) {
        var cc = c.host.__msel, row = e.target.closest(cc.rows); if (!slot(cc.key).on || !row || !c.host.contains(row) || !cc.id(row)) return;
        e.preventDefault(); e.stopPropagation(); toggle(cc, row);
      }, true);
      c.host.addEventListener('keydown', function (e) {
        var cc = c.host.__msel, row = e.target.closest && e.target.closest(cc.rows); if (!slot(cc.key).on || !row || !cc.id(row) || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault(); e.stopPropagation(); toggle(cc, row);
      }, true);
    }
    var a = c.anchor || c.host, old = document.querySelector('.msel-tg[data-k="' + c.key + '"]');
    if (old) old.remove();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn sec msel-tg'; b.setAttribute('data-k', c.key); b.setAttribute('aria-pressed', s.on ? 'true' : 'false');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.5l2.7 2.7L16 9.5"/></svg><span>Pilih</span>';
    b.classList.toggle('msel-on', !!s.on);
    b.onclick = function () { setOn(c.host.__msel, !slot(c.key).on); };
    if (c.anchor) a.appendChild(b); else a.insertBefore(b, a.firstChild);
    c.host.classList.toggle('msel-active', !!s.on); paint(c); bar(c);
  }
  /* jalankan fn(id) berurutan dengan progres; kembalikan {ok, fail:[{id,msg}]} lalu tampilkan ringkasan */
  function seq(ids, fn, label) {
    var ok = 0, fail = [];
    return ids.reduce(function (p, id, i) {
      return p.then(function () { toast((label || 'Memproses') + ' ' + (i + 1) + '/' + ids.length + '...'); return Promise.resolve(fn(id)).then(function () { ok++; }, function (e) { fail.push({ id: id, msg: (e && e.message) || 'gagal' }); }); });
    }, Promise.resolve()).then(function () {
      toast(ok + ' berhasil' + (fail.length ? ', ' + fail.length + ' gagal: ' + fail[0].msg : '') + '.', !!fail.length); return { ok: ok, fail: fail };
    });
  }
  window.STC = window.STC || {}; window.STC.msel = { mount: mount, seq: seq, count: function (k) { return count({ key: k }); } };
})();
