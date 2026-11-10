/* NOVA — item DCP ganda dalam satu laporan (DCP Management & Pelaporan DCP).
   Item 1 = isian utama pada formulir; item tambahan dibuat di sini, masing-masing punya judul film, kode disk,
   format/jenis, PH, kelengkapan, dan keterangan sendiri. Tiap item disimpan sebagai transaksi terpisah lewat API
   yang sama (validasi server tidak berubah) dan diikat oleh batchId yang sama. */
(function () {
  var S = window.STC, esc = S.esc;
  var FMT = ['2D', '3D', 'ATMOS', '3D-ATMOS', '2D-ATMOS', 'Lainnya'];
  var KOMP = { Besar: ['HDD', 'USB', 'Kabel Power', 'Adaptor'], Kecil: ['HDD', 'USB'] };
  function uid() { return 'B' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(); }

  function kelHtml(list) {
    return '<fieldset class="mdc-fs mi-kel"><legend>Kelengkapan item</legend>' + list.map(function (n, i) {
      return '<div class="mdc-kr"><label class="mdc-cbx"><input type="checkbox" class="mi-kc" data-n="' + esc(n) + '" checked> <span>' + esc(n) + '</span></label>' +
        '<input class="mi-kn" maxlength="300" placeholder="Keterangan (wajib jika tidak dicentang)" aria-label="Keterangan ' + esc(n) + '"></div>';
    }).join('') + '</fieldset>';
  }

  function itemHtml(mode, n) {
    var h = '<fieldset class="mi-item"><legend>Item <span class="mi-no">' + n + '</span></legend>' +
      '<div class="mdc-row"><label>Judul film<input class="mi-film" maxlength="200" required></label>' +
      '<label>Kode disk<input class="mi-kd" maxlength="60" required placeholder="mis. D-02"></label></div>' +
      '<div class="mdc-row"><label>PH (Production House)<input class="mi-ph" maxlength="160" required></label>';
    if (mode === 'dcp') {
      h += '<label>Format<select class="mi-fmt">' + FMT.map(function (f) { return '<option>' + f + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="mi-kelbox">' + kelHtml(KOMP.Besar) + '</div>';
    } else {
      var rn = 'mij' + n + '_' + uid();
      h += '<div class="pel-jlist mi-jenis" role="radiogroup" aria-label="Jenis DCP"><span class="mi-lbl">Jenis DCP</span>' +
        '<label class="mdc-cbx"><input type="radio" class="mi-jd" name="' + rn + '" value="Besar" checked><span><b>Besar</b> <small>(HDD, USB, Kabel Power, Adaptor)</small></span></label>' +
        '<label class="mdc-cbx"><input type="radio" class="mi-jd" name="' + rn + '" value="Kecil"><span><b>Kecil</b> <small>(HDD, USB)</small></span></label></div></div>' +
        '<div class="mi-kelbox">' + kelHtml(KOMP.Besar) + '</div>';
    }
    h += '<label>Keterangan item<textarea class="mi-ket" rows="2" maxlength="2000"></textarea></label>' +
      '<div class="mi-act"><button type="button" class="btn sec mi-del">Hapus item</button></div></fieldset>';
    return h;
  }

  function mount(host, cfg) {
    var mode = cfg.mode;
    host.innerHTML = '<section class="mi-box" aria-label="Item DCP tambahan"><div class="mi-head"><div><b>Item DCP dalam laporan ini</b>' +
      '<small>Data di atas adalah Item 1. Tambahkan item lain bila satu laporan memuat lebih dari satu DCP. Setiap item punya data sendiri.</small></div>' +
      '<button type="button" class="btn sec mi-add">+ Tambah item</button></div><div class="mi-list"></div></section>';
    var list = host.querySelector('.mi-list');
    function renumber() { [].forEach.call(list.querySelectorAll('.mi-item'), function (el, i) { el.querySelector('.mi-no').textContent = i + 2; }); }
    host.querySelector('.mi-add').onclick = function () {
      var d = document.createElement('div'); d.innerHTML = itemHtml(mode, list.children.length + 2);
      var el = d.firstChild; list.appendChild(el); renumber();
      el.querySelector('.mi-del').onclick = function () { el.remove(); renumber(); };
      [].forEach.call(el.querySelectorAll('.mi-jd'), function (r) {
        r.onchange = function () { el.querySelector('.mi-kelbox').innerHTML = kelHtml(KOMP[r.value]); };
      });
      var f = el.querySelector('.mi-film'); if (f && f.scrollIntoView) f.scrollIntoView({ block: 'center', behavior: 'smooth' });
      try { f.focus({ preventScroll: true }); } catch (e) {}
    };
    return {
      /* mengembalikan {items:[...]} atau {error:'...'} */
      read: function () {
        var out = [], err = '';
        [].forEach.call(list.querySelectorAll('.mi-item'), function (el, i) {
          if (err) return;
          var no = i + 2, v = function (c) { return (el.querySelector(c).value || '').trim(); };
          var it = { film: v('.mi-film'), kodeDisk: v('.mi-kd'), ph: v('.mi-ph'), keterangan: v('.mi-ket') };
          if (!it.film || !it.kodeDisk || !it.ph) { err = 'Item ' + no + ': judul film, kode disk, dan PH wajib diisi (atau hapus item).'; return; }
          if (mode === 'dcp') it.format = v('.mi-fmt'); else { var jd = el.querySelector('.mi-jd:checked'); it.jenisDcp = jd ? jd.value : 'Besar'; }
          var kr = [].map.call(el.querySelectorAll('.mdc-kr'), function (r) {
            var cb = r.querySelector('.mi-kc');
            return { name: cb.getAttribute('data-n'), status: cb.checked ? 'Lengkap' : 'Tidak Ada', note: r.querySelector('.mi-kn').value.trim() };
          });
          var bad = kr.filter(function (c) { return c.status !== 'Lengkap' && !c.note; });
          if (bad.length) { err = 'Item ' + no + ': isi keterangan untuk ' + bad.map(function (c) { return c.name; }).join(', ') + '.'; return; }
          it.kelengkapan = kr; out.push(it);
        });
        return err ? { error: err } : { items: out };
      }
    };
  }
  S.mi = { mount: mount, uid: uid };
})();
