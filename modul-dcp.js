/* STC XXI Technical Report - modul DCP Management & Daily Film Testing (frontend).
   Dimuat setelah app.js. Memakai helper global: api, modal, closeM, toast, esc, dt, $, curU().
   Semua validasi final ada di server (dcp.gs); klien hanya membantu pengisian. */
(function () {
  var S = window.STC;
  var api = function (a, p) { return S.api(a, p); };
  var modal = function (h) { return S.modal(h); };
  var closeM = function () { return S.closeM(); };
  var toast = function (m, e) { return S.toast(m, e); };
  var esc = S.esc, dt = S.dt;
  var $ = S.$;
  function curU() { return S.getU(); }
  var META = null;
  Object.assign(S.DESC, { dcp: 'Catat DCP keluar dan masuk, kelengkapan komponen, dan foto', ftest: 'Pengetesan harian film: checklist PASS/FAIL, status, dan riwayat ulang' });
  S.IC.dcp = '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></svg>';
  S.IC.ftest = '<svg class="ic" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/></svg>';
  var KOMP_DEF = ['HDD', 'USB', 'Kabel Power', 'Adaptor'];
  var KOMP_ST = ['Lengkap', 'Tidak Ada', 'Rusak', 'Tidak Diperlukan'];
  var FMT_DCP = ['2D', '3D', 'ATMOS', '3D-ATMOS', '2D-ATMOS', 'Lainnya'];
  var FMT_FT = ['2D', '3D', 'ATMOS', '3D-ATMOS', 'Lainnya'];
  var STAT_DCP = ['Diproses', 'Selesai', 'Bermasalah'];
  var MAX_IMG = 4000000;

  function q(s) { return esc(s); }
  function jkt(d) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()); }
  function jam(d) { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(d || new Date()); }
  var MYPERM = null;
  function can(k) { var u = curU(); if (!u) return false; if (u.role === 'ADMIN') return true; return !!MYPERM && MYPERM.indexOf(k) >= 0; }
  function canDel() { return can('delete'); }
  function canWrite() { return can('create') || can('edit'); }
  function loadMyPerm() { if (MYPERM) return Promise.resolve(MYPERM); return api('perm_me', { quiet: true }).then(function (r) { MYPERM = r.perms || []; return MYPERM; }, function () { MYPERM = []; return MYPERM; }); }
  function st(cls, txt) { return '<span class="mdc-st mdc-' + String(cls).replace(/[^a-z0-9-]/gi, '') + '">' + q(txt) + '</span>'; }
  function stDcp(s) { return st(String(s || '').toLowerCase().replace(/\s+/g, '-'), s || '-'); }
  function stFt(s) { return st('ft-' + String(s || '').toLowerCase(), s || '-'); }
  function kelOk(list) { return (list || []).every(function (c) { return c.status === 'Lengkap' || c.status === 'Tidak Diperlukan'; }); }

  function getMeta() {
    if (META) return Promise.resolve(META);
    return api('dcp_meta', { quiet: true }).then(function (m) { META = m; return m; });
  }

  /* ---------- foto: perkecil di perangkat agar di bawah batas server ---------- */
  function shrink(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('Gagal membaca berkas ' + file.name)); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { rej(new Error('Berkas ' + file.name + ' bukan gambar yang didukung.')); };
        img.onload = function () {
          var max = 1600, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var url = c.toDataURL('image/jpeg', 0.85);
          res(url);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function sendPhotos(id, files, kind, save, done) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    toast('Mengunggah ' + list.length + ' foto...');
    var out = [];
    Promise.all(list.map(function (f) {
      if (f.size > 20 * 1024 * 1024) return Promise.reject(new Error(f.name + ' terlalu besar.'));
      return shrink(f).then(function (u) { return { b64: u, kind: kind || 'Foto', capturedAt: f.lastModified || Date.now() }; });
    })).then(function (arr) {
      var batches = [];
      for (var i = 0; i < arr.length; i += 6) batches.push(arr.slice(i, i + 6));
      return batches.reduce(function (p, b) {
        return p.then(function (acc) {
          return api(save, { id: id, photos: b }).then(function (r) { acc.added += r.added; acc.failed += r.failed; return acc; });
        });
      }, Promise.resolve({ added: 0, failed: 0 }));
    }).then(function (r) {
      toast(r.failed ? 'Sebagian foto gagal (' + r.failed + ')' : 'Foto tersimpan (' + r.added + ')', !!r.failed);
      done && done();
    }).catch(function (e) { toast(e.message, 1); });
  }

  /* ================= DCP MANAGEMENT ================= */
  var DST = { jenis: '', status: '', q: '' };

  window.vDcp = function () {
    var v = $('view');
    Promise.all([api('dcp_dash'), api('dcp_list', { jenis: DST.jenis, status: DST.status, q: DST.q }), getMeta(), loadMyPerm()]).then(function (r) {
      var d = r[0], list = r[1] || [];
      var over = (d.overdue || []).length;
      var h = '<div class="mdc-top"><div class="mdc-kpis">' +
        kpi('DCP Keluar', d.totalKeluar, '') + kpi('DCP Masuk', d.totalMasuk, '') +
        kpi('Belum kembali', d.belumKembali, d.belumKembali ? 'warn' : '') +
        kpi('Diproses', d.dalamProses, '') + kpi('Bermasalah', d.bermasalah, d.bermasalah ? 'bad' : '') + '</div>' +
        '<div class="mdc-acts">' + (canWrite() ? '<button type="button" class="btn" data-dcp-new="KELUAR">+ DCP Keluar</button><button type="button" class="btn sec" data-dcp-new="MASUK">+ DCP Masuk</button>' : '') + '<button type="button" class="btn sec" id="dcpprint">Cetak</button>' + (curU().role === 'ADMIN' ? '<button type="button" class="btn sec" id="dcpadm">Izin &amp; pengingat</button>' : '') + '</div></div>';
      if (over) {
        h += '<div class="mdc-alert" role="alert"><b>' + over + ' DCP belum kembali lebih dari ' + d.batasHari + ' hari</b><ul>' +
          d.overdue.slice(0, 6).map(function (o) { return '<li>' + q(o.film) + ' · ' + q(o.kodeDisk) + ' · keluar ' + q(o.tanggal) + '</li>'; }).join('') + '</ul></div>';
      }
      h += '<div class="mdc-filter"><input id="dcpq" type="search" placeholder="Cari film, kode disk, PH, atau ID" value="' + q(DST.q) + '" aria-label="Cari DCP">' +
        '<select id="dcpj" aria-label="Jenis"><option value="">Semua jenis</option><option value="KELUAR"' + (DST.jenis === 'KELUAR' ? ' selected' : '') + '>Keluar</option><option value="MASUK"' + (DST.jenis === 'MASUK' ? ' selected' : '') + '>Masuk</option></select>' +
        '<select id="dcps" aria-label="Status"><option value="">Semua status</option>' + STAT_DCP.map(function (s) { return '<option' + (DST.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>';
      h += '<div class="mdc-tbl" role="region" aria-label="Daftar DCP"><table><thead><tr><th>ID</th><th>Tanggal</th><th>Jenis</th><th>Film</th><th>Kode disk</th><th>Status</th><th>Kelengkapan</th></tr></thead><tbody>' +
        (list.length ? list.map(function (t) {
          return '<tr data-dcp-open="' + q(t.id) + '" tabindex="0"><td class="mdc-mono">' + q(t.id) + '</td><td>' + q(t.tanggal) + ' ' + q(t.jam) + '</td><td>' + (t.jenis === 'KELUAR' ? 'Keluar' : 'Masuk') + '</td><td>' + q(t.film) + '</td><td class="mdc-mono">' + q(t.kodeDisk) + '</td><td>' + stDcp(t.status) + (t.jenis === 'KELUAR' && !t.masukId ? ' <span class="mdc-st mdc-warn">Belum kembali</span>' : '') + '</td><td>' + (t.incomplete ? st('bad', 'Tidak lengkap') : st('ok', 'Lengkap')) + '</td></tr>';
        }).join('') : '<tr><td colspan="7" class="mdc-empty">Belum ada data DCP.</td></tr>') +
        '</tbody></table></div>';
      v.innerHTML = h;
      bindDcp();
    }).catch(function (e) { v.innerHTML = '<div class="mdc-alert bad" role="alert">' + q(e.message) + '</div>'; });
  };
  function kpi(l, n, cls) { return '<div class="mdc-kpi ' + (cls || '') + '"><small>' + q(l) + '</small><b>' + (Number(n) || 0) + '</b></div>'; }
  function bindDcp() {
    var t;
    $('dcpq').oninput = function (e) { DST.q = e.target.value; clearTimeout(t); t = setTimeout(vDcp, 350); };
    $('dcpj').onchange = function (e) { DST.jenis = e.target.value; vDcp(); };
    $('dcps').onchange = function (e) { DST.status = e.target.value; vDcp(); };
    document.querySelectorAll('[data-dcp-new]').forEach(function (b) { b.onclick = function () { dcpForm(b.dataset.dcpNew, null); }; });
    $('dcpprint').onclick = function () { window.print(); };
    if ($('dcpadm')) $('dcpadm').onclick = function () { permAdmin(); };
    document.querySelectorAll('[data-dcp-open]').forEach(function (r) {
      r.onclick = function () { dcpDetail(r.dataset.dcpOpen); };
      r.onkeydown = function (e) { if (e.key === 'Enter') dcpDetail(r.dataset.dcpOpen); };
    });
  }

  function loadPhotos() {
    document.querySelectorAll('img[data-fid]').forEach(function (img) {
      api(img.dataset.fk === 'ft' ? 'ft_photo_get' : 'dcp_photo_get', { fotoId: img.dataset.fid, quiet: true })
        .then(function (r) { img.src = r.url; })
        .catch(function () { img.alt = 'Foto tidak dapat dimuat'; });
    });
  }
  function bindPhotoDel() {
    document.querySelectorAll('[data-pdel]').forEach(function (b) {
      b.onclick = function () {
        if (!confirm('Hapus foto ini? Berkas di Drive juga dipindahkan ke sampah.')) return;
        var isFt = b.dataset.pk === 'ft';
        api(isFt ? 'ft_photo_del' : 'dcp_photo_del', { fotoId: b.dataset.pdel }).then(function () {
          toast('Foto dihapus');
          (isFt ? ftDetail : dcpDetail)(b.dataset.id);
        }).catch(function (e) { toast(e.message, 1); });
      };
    });
  }

  function dcpDetail(id) {
    api('dcp_get', { id: id }).then(function (r) {
      var x = r.transaksi, kel = x.kelengkapan || [];
      var h = '<h2>' + (x.jenis === 'KELUAR' ? 'DCP Keluar' : 'DCP Masuk') + '</h2><p class="mdc-mono">' + q(x.id) + '</p>' +
        '<div class="mdc-grid"><div><small>Film</small><b>' + q(x.film) + '</b></div><div><small>Kode disk</small><b class="mdc-mono">' + q(x.kodeDisk) + '</b></div>' +
        '<div><small>Tanggal & jam</small><b>' + q(x.tanggal) + ' ' + q(x.jam) + '</b></div><div><small>Format</small><b>' + q(x.format || '-') + '</b></div>' +
        '<div><small>PH</small><b>' + q(x.ph) + '</b></div><div><small>Status</small>' + stDcp(x.status) + '</div>' +
        '<div><small>' + (x.jenis === 'KELUAR' ? 'Penyerah / Penerima' : 'Penyerah / Penerima') + '</small><b>' + q(x.penyerah) + ' → ' + q(x.penerima) + '</b></div><div><small>Tujuan / asal</small><b>' + q(x.tujuan) + '</b></div></div>';
      h += '<h3>Kelengkapan</h3><ul class="mdc-chk">' + kel.map(function (c) {
        return '<li><span>' + q(c.name) + '</span>' + (c.status === 'Lengkap' ? st('ok', c.status) : c.status === 'Tidak Diperlukan' ? st('na', c.status) : st('bad', c.status)) + (c.note ? '<em>' + q(c.note) + '</em>' : '') + '</li>';
      }).join('') + '</ul>';
      if (x.keterangan) h += '<h3>Keterangan</h3><p>' + q(x.keterangan) + '</p>';
      h += '<h3>Timeline</h3><ol class="mdc-tl"><li><b>Dibuat</b> oleh ' + q(x.createdBy || '-') + ' · ' + dt(x.createdAt) + '</li>' +
        (x.updatedAt && x.updatedAt !== x.createdAt ? '<li><b>Diubah</b> oleh ' + q(x.updatedBy || '-') + ' · ' + dt(x.updatedAt) + '</li>' : '') +
        (r.relasi ? '<li><b>Tertaut</b> dengan ' + (r.relasi.jenis === 'KELUAR' ? 'DCP Keluar' : 'DCP Masuk') + ' ' + q(r.relasi.id) + '</li>' : '') +
        (x.verifiedAt ? '<li><b>Diverifikasi</b> oleh ' + q(x.verifiedBy) + ' · ' + dt(x.verifiedAt) + '</li>' : '') +
        (x.jenis === 'KELUAR' && !x.masukId ? '<li class="warn">Belum ada DCP Masuk</li>' : '') + '</ol>';
      h += '<h3>Foto (' + (r.foto || []).length + ')</h3><div class="mdc-ph">' + (r.foto || []).map(function (p) {
        return '<figure><img loading="lazy" data-fid="' + q(p.fotoId) + '" data-fk="dcp" alt="' + q(p.kind) + '"><figcaption>' + q(p.kind) + '</figcaption>' + (can('photo') ? '<button type="button" class="mdc-pdel" data-pdel="' + q(p.fotoId) + '" data-pk="dcp" data-id="' + q(x.id) + '" aria-label="Hapus foto ' + q(p.kind) + '">Hapus</button>' : '') + '</figure>';
      }).join('') + '</div>';
      if (canWrite()) h += '<label class="mdc-up">Tambah foto<input type="file" accept="image/*" multiple id="dcpph"></label>';
      h += '<div class="mdc-foot">' + (can('verify') && !x.verifiedAt ? '<button type="button" class="btn" id="dcpver">Verifikasi</button>' : '') + (canWrite() ? '<button type="button" class="btn sec" id="dcpedit">Ubah</button>' : '') +
        (x.jenis === 'KELUAR' && !x.masukId && canWrite() ? '<button type="button" class="btn sec" id="dcpin">Catat DCP Masuk</button>' : '') +
        (canDel() ? '<button type="button" class="btn danger" id="dcpdel">Hapus</button>' : '') + '</div>';
      modal(h);
      bindPhotoDel();
      loadPhotos();
      if ($('dcpph')) $('dcpph').onchange = function (e) { sendPhotos(x.id, e.target.files, 'Foto DCP', 'dcp_photo_save', function () { dcpDetail(x.id); }); };
      if ($('dcpedit')) $('dcpedit').onclick = function () { dcpForm(x.jenis, x); };
      if ($('dcpver')) $('dcpver').onclick = function () { api('dcp_verify_save', { id: x.id }).then(function () { toast('DCP diverifikasi'); dcpDetail(x.id); }).catch(function (e) { toast(e.message, 1); }); };
      if ($('dcpin')) $('dcpin').onclick = function () { dcpForm('MASUK', null, x); };
      if ($('dcpdel')) $('dcpdel').onclick = function () {
        if (!confirm('Hapus DCP ' + x.id + '? Tindakan ini tidak dapat dibatalkan.')) return;
        api('dcp_del', { id: x.id }).then(function () { closeM(); toast('DCP dihapus'); vDcp(); }).catch(function (e) { toast(e.message, 1); });
      };
    }).catch(function (e) { toast(e.message, 1); });
  }

  function dcpForm(jenis, row, keluarRef) {
    getMeta().then(function (m) {
      var x = row || {};
      var kel = (x.kelengkapan && x.kelengkapan.length) ? x.kelengkapan : KOMP_DEF.map(function (n) { return { name: n, status: 'Lengkap', note: '' }; });
      var lk = keluarRef || null;
      var h = '<h2>' + (row ? 'Ubah ' : '') + (jenis === 'KELUAR' ? 'DCP Keluar' : 'DCP Masuk') + '</h2>' +
        '<form id="dcpf" class="mdc-form" novalidate>' +
        '<div class="mdc-row"><label>Tanggal<input name="tanggal" type="date" required value="' + q(x.tanggal || jkt()) + '"></label>' +
        '<label>Jam<input name="jam" type="time" required value="' + q(x.jam || jam()) + '"></label></div>' +
        '<label>Film<input name="film" required maxlength="200" value="' + q(x.film || (lk && lk.film) || '') + '"></label>' +
        '<div class="mdc-row"><label>Kode disk<input name="kodeDisk" required maxlength="60" value="' + q(x.kodeDisk || (lk && lk.kodeDisk) || '') + '"></label>' +
        '<label>Format<select name="format">' + FMT_DCP.map(function (f) { return '<option' + ((x.format || '') === f ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select></label></div>' +
        '<label>PH (Production House)<input name="ph" required maxlength="160" value="' + q(x.ph || '') + '"></label>' +
        '<div class="mdc-row"><label>' + (jenis === 'KELUAR' ? 'Penyerah (Tim Teknikal)' : 'Penyerah (dari PH / Penerima)') + '<input name="penyerah" required maxlength="120" value="' + q(x.penyerah || '') + '"></label>' +
        '<label>' + (jenis === 'KELUAR' ? 'Penerima' : 'Penerima (Tim Teknikal)') + '<input name="penerima" required maxlength="120" value="' + q(x.penerima || '') + '"></label></div>' +
        '<label>' + (jenis === 'KELUAR' ? 'Tujuan' : 'Asal') + '<input name="tujuan" required maxlength="200" value="' + q(x.tujuan || '') + '"></label>' +
        '<fieldset class="mdc-fs"><legend>Kelengkapan</legend>' + KOMP_DEF.map(function (n, i) {
          var c = kel.filter(function (k) { return k.name === n; })[0] || { status: 'Lengkap', note: '' };
          return '<div class="mdc-kr" data-k="' + i + '"><span>' + q(n) + '</span><select name="ks' + i + '" aria-label="Status ' + q(n) + '">' +
            KOMP_ST.map(function (s) { return '<option' + (c.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
            '<input name="kn' + i + '" maxlength="300" placeholder="Keterangan (wajib jika Tidak Ada / Rusak)" value="' + q(c.note || '') + '" aria-label="Keterangan ' + q(n) + '"></div>';
        }).join('') + '</fieldset>' +
        '<label>Keterangan umum<textarea name="keterangan" maxlength="2000" rows="2">' + q(x.keterangan || '') + '</textarea></label>' +
        '<label>Status<select name="status">' + STAT_DCP.map(function (s) { return '<option' + ((x.status || 'Diproses') === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
        '<p class="mdc-err" id="dcperr" role="alert"></p>' +
        '<div class="mdc-foot"><button type="button" class="btn sec" id="dcpx">Batal</button><button type="submit" class="btn" id="dcpok">Simpan</button></div></form>';
      modal(h);
      $('dcpx').onclick = closeM;
      $('dcpf').onsubmit = function (e) {
        e.preventDefault();
        var f = e.target, p = {
          id: x.id || '', jenis: jenis, tanggal: f.tanggal.value, jam: f.jam.value, film: f.film.value.trim(), kodeDisk: f.kodeDisk.value.trim(),
          format: f.format.value, ph: f.ph.value.trim(), penyerah: f.penyerah.value.trim(), penerima: f.penerima.value.trim(), tujuan: f.tujuan.value.trim(),
          keterangan: f.keterangan.value.trim(), status: f.status.value,
          kelengkapan: KOMP_DEF.map(function (n, i) { return { name: n, status: f['ks' + i].value, note: f['kn' + i].value.trim() }; })
        };
        if (lk && lk.id && !x.id) p.relasiId = lk.id;
        var bad = p.kelengkapan.filter(function (c) { return (c.status === 'Tidak Ada' || c.status === 'Rusak') && !c.note; });
        var err = $('dcperr');
        if (bad.length) { err.textContent = 'Isi keterangan untuk: ' + bad.map(function (c) { return c.name; }).join(', ') + '.'; return; }
        if (!kelOk(p.kelengkapan) && !p.keterangan) { err.textContent = 'Ada komponen tidak lengkap. Isi keterangan umum.'; return; }
        err.textContent = '';
        $('dcpok').disabled = true;
        api('dcp_save', p).then(function (id) {
          closeM(); toast('DCP tersimpan'); vDcp(); dcpDetail(id);
        }).catch(function (er) { $('dcpok').disabled = false; err.textContent = er.message; });
      };
    });
  }


  /* ---------- panel Admin: izin per Teknisi & pengingat harian ---------- */
  var PERM_KEYS = [['view', 'Lihat'], ['create', 'Buat'], ['edit', 'Ubah'], ['delete', 'Hapus'], ['verify', 'Verifikasi'], ['photo', 'Foto'], ['pdf', 'Cetak/PDF']];
  function permAdmin() {
    Promise.all([api('usr_list'), api('perm_list', { quiet: true })]).then(function (r) {
      var users = (r[0] || []).filter(function (x) { return x.role === 'USER'; });
      var cur = {}; (r[1] || []).forEach(function (p) { cur[p.userId] = p.perms || []; });
      var h = '<h2>Izin modul DCP &amp; Testing</h2><p class="mdc-note">Admin selalu memiliki semua izin. Teknisi (USER) tanpa pengaturan memakai izin bawaan: Lihat, Buat, Ubah, Foto, Cetak/PDF.</p>';
      if (!users.length) h += '<p class="mdc-empty">Belum ada akun Teknisi.</p>';
      users.forEach(function (x) {
        var list = cur[x.userId] || ['view', 'create', 'edit', 'photo', 'pdf'];
        h += '<fieldset class="mdc-fs" data-uid="' + q(x.userId) + '"><legend>' + q(x.fullName) + '</legend><div class="mdc-perm">' +
          PERM_KEYS.map(function (k) { return '<label><input type="checkbox" value="' + k[0] + '"' + (list.indexOf(k[0]) >= 0 ? ' checked' : '') + '> ' + k[1] + '</label>'; }).join('') +
          '</div><div class="mdc-foot"><button type="button" class="btn sec" data-perm-save="' + q(x.userId) + '">Simpan izin</button></div></fieldset>';
      });
      h += '<h3>Pengingat DCP terlambat</h3><p class="mdc-note">Mengirim notifikasi harian pukul 09.00 untuk DCP keluar yang belum kembali lebih dari batas hari (Script Property DCP_OVERDUE_HARI, default 7).</p>' +
        '<div class="mdc-foot"><button type="button" class="btn" id="dcpjob">Pasang pengingat harian</button></div>';
      modal(h);
      document.querySelectorAll('[data-perm-save]').forEach(function (b) {
        b.onclick = function () {
          var fs = b.closest('fieldset'), perms = Array.prototype.map.call(fs.querySelectorAll('input:checked'), function (c) { return c.value; });
          api('perm_save', { userId: b.dataset.permSave, perms: perms }).then(function () { toast('Izin disimpan'); }).catch(function (e) { toast(e.message, 1); });
        };
      });
      $('dcpjob').onclick = function () { api('dcp_job_install', {}).then(function () { toast('Pengingat harian dipasang'); }).catch(function (e) { toast(e.message, 1); }); };
    }).catch(function (e) { toast(e.message, 1); });
  }

  /* ================= DAILY FILM TESTING ================= */
  var FST = { q: '', status: '', studio: '' };
  var FT_TMP = null;

  window.vFt = function () {
    var v = $('view');
    Promise.all([api('ft_dash'), api('ft_list', { q: FST.q, status: FST.status, studio: FST.studio }), getMeta(), loadMyPerm()]).then(function (r) {
      var d = r[0], list = r[1] || [];
      var h = '<div class="mdc-top"><div class="mdc-kpis">' + kpi('Dites hari ini', d.hariIni, '') + kpi('PASSED', d.passed, 'ok') +
        kpi('FAILED', d.failed, d.failed ? 'bad' : '') + kpi('RETEST', d.retest, d.retest ? 'warn' : '') + '</div>' +
        '<div class="mdc-acts">' + (canWrite() ? '<button type="button" class="btn" id="ftnew">+ Input Testing</button>' : '') + '</div></div>';
      if ((d.belumDites || []).length) {
        h += '<div class="mdc-alert"><b>Film aktif belum dites hari ini (' + d.belumDites.length + ')</b><ul>' +
          d.belumDites.slice(0, 8).map(function (f) { return '<li>' + q(f.title) + '</li>'; }).join('') + '</ul></div>';
      }
      if ((d.perluTindakan || []).length) {
        h += '<div class="mdc-alert bad"><b>Perlu tindakan / tes ulang (' + d.perluTindakan.length + ')</b><ul>' +
          d.perluTindakan.map(function (t) { return '<li><button type="button" class="mdc-link" data-ft-open="' + q(t.id) + '">' + q(t.film) + ' · ' + q(t.id) + '</button> ' + stFt(t.status) + '</li>'; }).join('') + '</ul></div>';
      }
      h += '<div class="mdc-filter"><input id="ftq" type="search" placeholder="Cari film atau ID" value="' + q(FST.q) + '" aria-label="Cari testing">' +
        '<select id="fts" aria-label="Status"><option value="">Semua status</option>' + ['PASSED', 'FAILED', 'RETEST'].map(function (s) { return '<option' + (FST.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<select id="ftstu" aria-label="Studio"><option value="">Semua studio</option>' + ['1', '2', '3', '4'].map(function (s) { return '<option value="' + s + '"' + (FST.studio === s ? ' selected' : '') + '>Studio ' + s + '</option>'; }).join('') + '</select></div>';
      h += '<div class="mdc-tbl ft" role="region" aria-label="Daftar testing"><table><thead><tr><th>ID</th><th>Tanggal</th><th>Film</th><th>Studio</th><th>Tester</th><th>Hasil</th></tr></thead><tbody>' +
        (list.length ? list.map(function (t) {
          return '<tr data-ft-open="' + q(t.id) + '" tabindex="0"><td class="mdc-mono">' + q(t.id) + (t.parentId ? ' <span class="mdc-st mdc-info">Retest</span>' : '') + '</td><td>' + q(t.tanggal) + ' ' + q(t.jam) + '</td><td>' + q(t.film) + '</td><td>Studio ' + q(t.studio) + '</td><td>' + q(t.tester) + '</td><td>' + stFt(t.status) + '</td></tr>';
        }).join('') : '<tr><td colspan="6" class="mdc-empty">Belum ada laporan testing.</td></tr>') + '</tbody></table></div>';
      v.innerHTML = h;
      var t;
      $('ftq').oninput = function (e) { FST.q = e.target.value; clearTimeout(t); t = setTimeout(vFt, 350); };
      $('fts').onchange = function (e) { FST.status = e.target.value; vFt(); };
      $('ftstu').onchange = function (e) { FST.studio = e.target.value; vFt(); };
      if ($('ftnew')) $('ftnew').onclick = function () { ftForm(null, null); };
      document.querySelectorAll('[data-ft-open]').forEach(function (rw) {
        rw.onclick = function () { ftDetail(rw.dataset.ftOpen); };
        rw.onkeydown = function (e) { if (e.key === 'Enter') ftDetail(rw.dataset.ftOpen); };
      });
    }).catch(function (e) { v.innerHTML = '<div class="mdc-alert bad" role="alert">' + q(e.message) + '</div>'; });
  };

  function ftDetail(id) {
    getMeta().then(function () { return api('ft_get', { id: id }); }).then(function (r) {
      var L = r.laporan, items = (META && META.checklistItem) || [];
      var h = '<h2>Laporan Testing</h2><p class="mdc-mono">' + q(L.id) + '</p>' +
        '<div class="mdc-grid"><div><small>Film</small><b>' + q(L.film) + '</b></div><div><small>Hasil</small>' + stFt(L.status) + '</div>' +
        '<div><small>Tanggal & jam</small><b>' + q(L.tanggal) + ' ' + q(L.jam) + '</b></div><div><small>Studio / format</small><b>Studio ' + q(L.studio) + ' · ' + q(L.format) + '</b></div>' +
        '<div><small>Server / proyektor</small><b>' + q(L.server || '-') + ' / ' + q(L.projector || '-') + '</b></div><div><small>Tester</small><b>' + q(L.tester) + '</b></div></div>';
      var fails = (L.checklist || []).filter(function (c) { return c.val === 'FAIL'; });
      if (fails.length) {
        h += '<h3>Item gagal</h3><ul class="mdc-chk">' + fails.map(function (c) {
          var it = items.filter(function (i) { return i.id === c.id; })[0];
          return '<li><span>' + q(it ? it.label : c.id) + '</span>' + st('bad', 'FAIL') + '<em>' + q(c.ket) + '</em></li>';
        }).join('') + '</ul>';
      }
      if (L.masalah) h += '<h3>Masalah</h3><p>' + q(L.masalah) + '</p>';
      if (L.tindakan) h += '<h3>Tindakan</h3><p>' + q(L.tindakan) + '</p>';
      if (L.hasilUlang) h += '<h3>Hasil ulang</h3><p>' + q(L.hasilUlang) + '</p>';
      h += '<h3>Riwayat</h3><ol class="mdc-tl">' + (r.riwayat || []).map(function (x) {
        return '<li><b>' + q(x.id) + '</b> ' + stFt(x.status) + ' · ' + q(x.tester) + ' · ' + q(x.tanggal) + '</li>';
      }).join('') + '</ol>';
      h += '<h3>Dokumentasi (' + (r.foto || []).length + ')</h3><div class="mdc-ph">' + (r.foto || []).map(function (p) {
        return '<figure><img loading="lazy" data-fid="' + q(p.fotoId) + '" data-fk="ft" alt="' + q(p.kind) + '"><figcaption>' + q(p.kind) + '</figcaption>' + (can('photo') ? '<button type="button" class="mdc-pdel" data-pdel="' + q(p.fotoId) + '" data-pk="ft" data-id="' + q(L.id) + '" aria-label="Hapus foto ' + q(p.kind) + '">Hapus</button>' : '') + '</figure>';
      }).join('') + '</div>';
      if (canWrite()) h += '<label class="mdc-up">Tambah foto<input type="file" accept="image/*" multiple id="ftph"></label>';
      h += '<div class="mdc-foot">' +
        (canWrite() && (L.status === 'FAILED' || L.status === 'RETEST') && !r.retestId ? '<button type="button" class="btn" id="ftre">Buat pengetesan ulang</button>' : '') +
        (r.retestId ? '<button type="button" class="btn sec" id="ftgo" data-id="' + q(r.retestId) + '">Lihat pengetesan ulang</button>' : '') +
        (canWrite() && !r.retestId ? '<button type="button" class="btn sec" id="ftedit">Ubah</button>' : '') +
        (canDel() && !r.retestId ? '<button type="button" class="btn danger" id="ftdel">Hapus</button>' : '') + '</div>';
      modal(h);
      bindPhotoDel();
      loadPhotos();
      if ($('ftph')) $('ftph').onchange = function (e) { sendPhotos(L.id, e.target.files, 'Dokumentasi', 'ft_photo_save', function () { ftDetail(L.id); }); };
      if ($('ftre')) $('ftre').onclick = function () { ftForm(null, L); };
      if ($('ftgo')) $('ftgo').onclick = function () { ftDetail($('ftgo').dataset.id); };
      if ($('ftedit')) $('ftedit').onclick = function () { ftForm(L, null); };
      if ($('ftdel')) $('ftdel').onclick = function () {
        if (!confirm('Hapus laporan ' + L.id + '?')) return;
        api('ft_del', { id: L.id }).then(function () { closeM(); toast('Laporan dihapus'); vFt(); }).catch(function (e) { toast(e.message, 1); });
      };
    }).catch(function (e) { toast(e.message, 1); });
  }

  /* form: edit (row), retest dari induk (parent), atau baru */
  function ftForm(row, parent) {
    getMeta().then(function (m) {
      var x = row || {}, items = m.checklistItem || [], groups = m.checklist || [];
      var cur = {};
      (x.checklist || []).forEach(function (c) { cur[c.id] = c; });
      var pre = parent ? (parent.checklist || []) : [];
      var h = '<h2>' + (row ? 'Ubah laporan' : parent ? 'Pengetesan ulang' : 'Input Testing') + '</h2>' +
        (parent ? '<p class="mdc-note">Pengetesan ulang untuk <b class="mdc-mono">' + q(parent.id) + '</b>. Laporan lama tetap tersimpan sebagai riwayat.</p>' : '') +
        '<form id="ftf" class="mdc-form" novalidate>' +
        '<div class="mdc-row"><label>Tanggal<input name="tanggal" type="date" required value="' + q(x.tanggal || (parent && parent.tanggal) || jkt()) + '"></label>' +
        '<label>Jam<input name="jam" type="time" required value="' + q(x.jam || jam()) + '"></label></div>' +
        '<label>Judul film<input name="film" required maxlength="200" value="' + q(x.film || (parent && parent.film) || '') + '"></label>' +
        '<div class="mdc-row"><label>Studio<select name="studio">' + ['1', '2', '3', '4'].map(function (s) { return '<option value="' + s + '"' + ((x.studio || (parent && parent.studio)) == s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
        '<label>Format<select name="format">' + FMT_FT.map(function (f) { return '<option' + ((x.format || (parent && parent.format) || '2D') === f ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="mdc-row"><label>Server<input name="server" maxlength="80" value="' + q(x.server || (parent && parent.server) || '') + '"></label>' +
        '<label>Proyektor<input name="projector" maxlength="80" value="' + q(x.projector || (parent && parent.projector) || '') + '"></label></div>' +
        '<label>Tester<input name="tester" required maxlength="120" value="' + q(x.tester || (curU() && curU().name) || '') + '"></label>';
      groups.forEach(function (g) {
        h += '<fieldset class="mdc-fs"><legend>' + q(g.name) + '</legend>';
        items.filter(function (it) { return it.grp === g.name; }).forEach(function (it) {
          var c = cur[it.id] || (pre.filter(function (p) { return p.id === it.id; })[0] || {});
          h += '<div class="mdc-ck" data-id="' + it.id + '"><span>' + q(it.label) + '</span><div class="mdc-seg" role="radiogroup" aria-label="' + q(it.label) + '">' +
            ['PASS', 'FAIL', 'N/A'].map(function (v) {
              return '<label><input type="radio" name="v_' + it.id + '" value="' + v + '"' + (c.val === v ? ' checked' : '') + '><span>' + v + '</span></label>';
            }).join('') + '</div><input class="mdc-ket" name="k_' + it.id + '" maxlength="500" placeholder="Keterangan masalah (wajib jika FAIL)" value="' + q(c.ket || '') + '" aria-label="Keterangan ' + q(it.label) + '"' + (c.val === 'FAIL' ? '' : ' hidden') + '></div>';
        });
        h += '</fieldset>';
      });
      h += '<label>Deskripsi masalah (wajib jika ada FAIL)<textarea name="masalah" maxlength="2000" rows="2">' + q(x.masalah || '') + '</textarea></label>' +
        '<label>Tindakan perbaikan (wajib jika ada FAIL)<textarea name="tindakan" maxlength="2000" rows="2">' + q(x.tindakan || '') + '</textarea></label>' +
        '<label>Catatan teknisi<textarea name="catatanTeknisi" maxlength="2000" rows="2">' + q(x.catatanTeknisi || '') + '</textarea></label>' +
        '<label class="mdc-chkbox"><input type="checkbox" name="retest"' + (x.status === 'RETEST' ? ' checked' : '') + '> Perlu pengetesan ulang (hasil RETEST)</label>' +
        '<p class="mdc-note">Hasil dihitung otomatis: ada item FAIL = FAILED; tanpa FAIL dan ditandai tes ulang = RETEST; selain itu = PASSED.</p>' +
        '<p class="mdc-err" id="ftferr" role="alert"></p>' +
        '<div class="mdc-foot"><button type="button" class="btn sec" id="ftx">Batal</button><button type="submit" class="btn" id="ftok">Simpan</button></div></form>';
      modal(h);
      $('ftx').onclick = closeM;
      var f = $('ftf');
      f.onchange = function (e) {
        if (e.target.name && e.target.name.indexOf('v_') === 0) {
          var id = e.target.name.slice(2), ket = f['k_' + id];
          ket.hidden = e.target.value !== 'FAIL';
        }
      };
      f.onsubmit = function (e) {
        e.preventDefault();
        var err = $('ftferr');
        var chk = items.map(function (it) {
          var r = f.querySelector('input[name="v_' + it.id + '"]:checked');
          return { id: it.id, val: r ? r.value : '', ket: f['k_' + it.id].value.trim(), label: it.label };
        });
        var miss = chk.filter(function (c) { return !c.val; });
        if (miss.length) { err.textContent = 'Lengkapi hasil untuk: ' + miss.slice(0, 3).map(function (c) { return c.label; }).join(', ') + (miss.length > 3 ? ' dan lainnya' : '') + '.'; return; }
        var fl = chk.filter(function (c) { return c.val === 'FAIL' && !c.ket; });
        if (fl.length) { err.textContent = 'Item FAIL wajib diberi keterangan: ' + fl[0].label + '.'; return; }
        var anyFail = chk.some(function (c) { return c.val === 'FAIL'; });
        if (anyFail && (!f.masalah.value.trim() || !f.tindakan.value.trim())) { err.textContent = 'Hasil FAILED: isi deskripsi masalah dan tindakan perbaikan.'; return; }
        err.textContent = '';
        $('ftok').disabled = true;
        var p = {
          id: x.id || '', tanggal: f.tanggal.value, jam: f.jam.value, film: f.film.value.trim(), studio: f.studio.value, format: f.format.value,
          server: f.server.value.trim(), projector: f.projector.value.trim(), tester: f.tester.value.trim(),
          checklist: chk.map(function (c) { return { id: c.id, val: c.val, ket: c.ket }; }),
          masalah: f.masalah.value.trim(), tindakan: f.tindakan.value.trim(), catatanTeknisi: f.catatanTeknisi.value.trim(),
          retest: !!f.retest.checked, parentId: parent ? parent.id : ''
        };
        api('ft_save', p).then(function (id) { closeM(); toast('Testing tersimpan'); vFt(); ftDetail(id); })
          .catch(function (er) { $('ftok').disabled = false; err.textContent = er.message; });
      };
    });
  }
})();
