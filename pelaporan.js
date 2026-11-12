/* Outlet Operation System - modul Pelaporan DCP (frontend).
   Satu DCP = satu data utama (judul, PH, kode disk) dengan riwayat transaksi MASUK dan KELUAR.
   Dimuat setelah modul-dcp.js (memakai helper foto dan izin dari window.STC.pel).
   Tanpa validasi manual: DCP Masuk otomatis berstatus Lengkap bila laporan (satu batch) memiliki minimal 1 foto;
   DCP Keluar hanya didata (Tercatat), foto opsional. Aturan akses dan audit tetap ditegakkan di server (dcp.gs: pel_list, pel_save). */
(function () {
  var S = window.STC;
  var P = S.pel;
  var esc = S.esc, dt = S.dt, $ = S.$, api = S.api, modal = S.modal, closeM = S.closeM, toast = S.toast;
  var OUTLET = ['Sukaramai Trade Center XXI', 'Pekanbaru Xchange XXI', 'Ciputra Seraya XXI', 'SKA XXI'];
  var LAIN = 'Lainnya';
  var KOMP = P.KOMP_DEF;
  /* DCP Besar: HDD, USB, Kabel Power, Adaptor. DCP Kecil: HDD, USB. */
  var KOMP_BESAR = ['HDD', 'USB', 'Kabel Power', 'Adaptor'];
  var KOMP_KECIL = ['HDD', 'USB'];
  function komp(j) { return j === 'Kecil' ? KOMP_KECIL : KOMP_BESAR; }
  /* nama outlet tempat aplikasi ini dipakai (sama dengan judul di sidebar) */
  var OUTLET_SAYA = 'Sukaramai Trade Center XXI';
  var STATUS = ['Menunggu foto', 'Lengkap', 'Tercatat', 'Tervalidasi', 'Lama'];
  var ROWS = [], FROM_DCP = false;
  var DST = { q: '', status: '', dari: '', sampai: '', tab: 'stc' };

  Object.assign(S.DESC, { pel: 'Pelaporan DCP: riwayat masuk dan keluar per kode disk, dengan dokumentasi foto' });
  S.IC.pel = '<svg class="ic" viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>';

  function q(s) { return esc(s); }
  function me() { return S.getU() || {}; }
  function myName() { var u = me(); return u.name || u.fullName || u.username || '-'; }
  function isLama(r) { return r.modul !== 'PEL'; }
  /* jumlah foto per laporan: satu laporan = satu batchId (bisa banyak item DCP). Satu foto cukup untuk seluruh item. */
  var _fcRows = null, _fc = {};
  function batchFoto(r) {
    if (!r.batchId) return (r.foto || []).length;
    if (_fcRows !== ROWS) {
      _fcRows = ROWS; _fc = {};
      ROWS.forEach(function (x) { if (x.batchId) _fc[x.batchId] = (_fc[x.batchId] || 0) + (x.foto || []).length; });
    }
    return _fc[r.batchId] || 0;
  }
  /* tanpa validasi manual: Masuk = Lengkap bila ada foto; Keluar = Tercatat. 'Tervalidasi' hanya untuk data yang sudah divalidasi sebelumnya. */
  function statusOf(r) {
    if (isLama(r)) return 'Lama';
    if (r.verifiedAt) return 'Tervalidasi';
    if (r.jenis === 'KELUAR') return 'Tercatat';
    return batchFoto(r) > 0 ? 'Lengkap' : 'Menunggu foto';
  }
  function owner(r) { var u = me(); return u.role === 'ADMIN' || String(r.pelaporId) === String(u.userId); }
  function key(r) { return String(r.tanggal) + ' ' + String(r.jam) + ' ' + String(r.createdAt || 0).padStart(15, '0'); }
  /* urutan tampilan: tanggal & jam terbaru di atas (sortAsc tetap dipakai untuk logika posisi/riwayat) */
  function sortDesc(a) {
    return a.slice().sort(function (x, y) { var p = key(x), k = key(y); return p < k ? 1 : p > k ? -1 : 0; });
  }
  function sortAsc(a) {
    return a.slice().sort(function (x, y) { var p = key(x), k = key(y); return p < k ? -1 : p > k ? 1 : 0; });
  }
  function stBadge(s) {
    var cls = (s === 'Tervalidasi' || s === 'Lengkap') ? 'selesai' : s === 'Menunggu foto' ? 'diproses' : 'na';
    return '<span class="mdc-st mdc-' + cls + '">' + q(s === 'Lama' ? 'Data lama (baca saja)' : s) + '</span>';
  }

  /* ---------- kelompok per kode disk dan posisi terakhir ---------- */
  function groupDisks(rows) {
    var m = {};
    rows.forEach(function (r) { (m[r.kodeDisk] = m[r.kodeDisk] || []).push(r); });
    return Object.keys(m).map(function (kd) {
      var h = sortAsc(m[kd]);
      return { kd: kd, hist: h, last: h[h.length - 1], film: h[0].film, ph: h[0].ph };
    });
  }
  function groups() { return groupDisks(ROWS); }
  function groupOf(kd) { return groups().filter(function (g) { return g.kd === kd; })[0] || null; }
  /* posisi DCP: MASUK terakhir = berada di outlet itu; KELUAR terakhir = dalam perjalanan ke tujuan */
  function posisi(g) {
    var l = g && g.last;
    if (!l) return { at: false, here: false, outlet: '', tujuan: '', txt: '-', cls: '' };
    var own = OUTLET_SAYA.toLowerCase();
    if (l.jenis === 'MASUK') {
      var o = l.outlet || l.tujuan || '';
      if (o.toLowerCase() === own) return { at: true, here: true, outlet: o, tujuan: '', txt: 'Ada di outlet ini', cls: 'warn' };
      return { at: true, here: false, outlet: o, tujuan: '', txt: 'Sudah dikirim dan diterima oleh ' + o, cls: 'ok' };
    }
    var t = l.outletTujuan || l.tujuan || '';
    return { at: false, here: false, outlet: '', tujuan: t, txt: 'Sudah dikirim dan diterima oleh ' + (t || '-'), cls: 'ok' };
  }

  /* ---------- filter ---------- */
  function match(r) {
    var s = DST.q.toLowerCase();
    if (s && [r.film, r.ph, r.kodeDisk, r.outlet, r.outletTujuan, r.penerima, r.pelapor].join(' ').toLowerCase().indexOf(s) < 0) return false;
    if (DST.status && statusOf(r) !== DST.status) return false;
    if (DST.dari && String(r.tanggal) < DST.dari) return false;
    if (DST.sampai && String(r.tanggal) > DST.sampai) return false;
    return true;
  }

  /* ---------- unduh Excel / PDF: isi sesuai filter yang sedang dipakai ---------- */
  function plExport(fmt) {
    var rows = sortDesc(ROWS.filter(match));
    if (!rows.length) { toast('Tidak ada data untuk diunduh.', 1); return; }
    var head = ['ID', 'Jenis', 'Tanggal', 'Jam', 'Kode disk', 'Judul film', 'PH', 'Outlet', 'Outlet tujuan', 'Penerima', 'Pelapor', 'Datang dari', 'Pengirim', 'Kelengkapan', 'Status laporan', 'Divalidasi oleh (data lama)', 'Catatan', 'Jenis DCP'];
    var body = rows.map(function (r) {
      var kel = (r.kelengkapan || []).map(function (c) { return c.name + ': ' + c.status + (c.note ? ' (' + c.note + ')' : ''); }).join('; ');
      return [r.id, r.jenis === 'KELUAR' ? 'Keluar' : 'Masuk', r.tanggal, r.jam, r.kodeDisk, r.film, r.ph, r.outlet, r.jenis === 'KELUAR' ? (r.outletTujuan || '') : '', r.penerima, r.pelapor, r.asalDari || '', r.namaPengirim || '', kel || 'Tidak diisi (data lama)', statusOf(r), r.verifiedBy || '', r.keterangan, r.jenisDcp || 'Besar']
        .map(function (v) { return v == null ? '' : String(v); });
    });
    /* PDF memakai 12 kolom yang relevan (tanpa ID, jam, pelapor, validator, catatan) agar tabel tetap terbaca di A4 landscape */
    var PDF_COLS = [1, 2, 3, 4, 5, 7, 8, 11, 12, 9, 13, 14, 17];
    var pick = function (a) { return fmt === 'pdf' ? PDF_COLS.map(function (i) { return a[i]; }) : a; };
    P.recSave('Laporan Pelaporan DCP', [['Jumlah transaksi', rows.length], ['Tanggal cetak', P.jkt()]], [{ head: pick(head), rows: body.map(pick) }], fmt, 'Laporan_Pelaporan_DCP_STCXXI_' + P.jkt());
  }

  /* Laporan multi-item: semua item (batchId sama) dalam SATU PDF/Excel — ringkasan, kelengkapan tiap item, foto tiap item */
  function plBatchExport(rows, fmt) {
    rows = sortAsc(rows);
    if (!rows.length) return;
    var f = rows[0], sv = function (v) { return v == null ? '' : String(v); };
    var jen = rows.every(function (r) { return r.jenis === f.jenis; }) ? (f.jenis === 'KELUAR' ? 'DCP Keluar' : 'DCP Masuk') : 'DCP Masuk/Keluar';
    var pairs = [['Jenis laporan', jen], ['Tanggal', f.tanggal + ' ' + f.jam], ['Jumlah item', rows.length], ['Pelapor', f.pelapor || '-'], ['Kode laporan (batch)', f.batchId || f.id], ['Dicetak oleh', P.uname()]];
    var tables = [{ title: 'Ringkasan item', head: ['No', 'ID', 'Jenis', 'Kode disk', 'Judul film', 'PH', 'Jenis DCP', 'Outlet', 'Tujuan / asal', 'Penerima', 'Pengirim', 'Status'],
      rows: rows.map(function (r, i) { return [i + 1, r.id, r.jenis === 'KELUAR' ? 'Keluar' : 'Masuk', r.kodeDisk, r.film, r.ph, r.jenisDcp || 'Besar', r.outlet, r.jenis === 'KELUAR' ? r.outletTujuan : r.asalDari, r.penerima, r.namaPengirim, statusOf(r)].map(sv); }) }];
    rows.forEach(function (r, i) {
      var kr = (r.kelengkapan || []).map(function (c) { return [c.name, c.status, c.note || '-'].map(sv); });
      if (r.keterangan) kr.push(['Keterangan item', '', r.keterangan]);
      tables.push({ title: 'Item ' + (i + 1) + ': ' + r.film + ' (' + r.kodeDisk + ') - kelengkapan', sheet: 'Item ' + (i + 1) + ' ' + r.kodeDisk, head: ['Komponen', 'Status', 'Keterangan'], rows: kr.length ? kr : [['Tidak diisi', '', '']] });
    });
    var file = 'Laporan_Pelaporan_DCP_' + rows.length + 'item_' + P.jkt();
    var go = function (ph) { P.recSave('Laporan Pelaporan DCP - ' + rows.length + ' item', pairs, tables, fmt, file, { id: f.batchId || f.id, orient: 'landscape', photos: ph || [], mainSheet: 'Ringkasan' }); };
    if (fmt === 'pdf' && window.NovaPDF) {
      toast('Menyiapkan PDF: mengambil foto semua item...');
      P.collectPhotos(rows.map(function (r) { return { foto: r.foto || [], label: r.id + ' ' + r.film }; }), 'dcp_photo_get').then(go).catch(function () { go([]); });
    } else go([]);
  }

  /* ---------- daftar utama ---------- */
  window.vPel = function () {
    var v = $('view');
    v.innerHTML = OOS.skel('page');
    Promise.all([api('pel_list', { quiet: true }), P.loadMyPerm()]).then(function (r) {
      ROWS = r[0] || [];
      shell();
    }).catch(function (e) { v.innerHTML = '<div class="mdc-alert bad" role="alert">' + q(e.message) + '</div>'; });
  };

  function shell() {
    var v = $('view'), all = groups(), enabled = P.canWrite();
    var n = { disk: all.length, di: 0, jalan: 0, draft: 0, valid: 0 };
    all.forEach(function (g) {
      var p = posisi(g);
      if (p.here) n.di++; else n.jalan++;
      g.hist.forEach(function (r) { var st = statusOf(r); if (st === 'Menunggu foto') n.draft++; if (st === 'Lengkap' || st === 'Tervalidasi') n.valid++; });
    });
    var kpi = function (l, x, c) { return '<div class="mdc-kpi ' + (c || '') + '"><small>' + q(l) + '</small><b>' + (Number(x) || 0) + '</b></div>'; };
    var h = '<div class="mdc-top"><div class="mdc-kpis">' +
      kpi('Kode disk', n.disk) + kpi('Ada di outlet ini', n.di, n.di ? 'warn' : '') + kpi('Sudah dikirim', n.jalan, n.jalan ? 'ok' : '') +
      kpi('Menunggu foto', n.draft, n.draft ? 'warn' : '') + kpi('Lengkap', n.valid) + '</div>' +
      '<div class="mdc-acts">' + (enabled ? '<button type="button" class="btn" id="plMasuk">+ Catat DCP Masuk</button><button type="button" class="btn sec" id="plKeluar">Kirim DCP</button>' : '') + P.dlMenu('pl') + '</div></div>' +
      '<div class="pel-tabs" role="tablist" aria-label="Posisi DCP">' +
      [['stc', 'Di STC', n.di], ['kirim', 'Sudah dikirim', n.jalan], ['all', 'Semua', n.disk]].map(function (t) {
        return '<button type="button" role="tab" class="pel-tab' + (DST.tab === t[0] ? ' on' : '') + '" aria-selected="' + (DST.tab === t[0]) + '" data-pel-tab="' + t[0] + '">' + t[1] + ' <b>' + t[2] + '</b></button>';
      }).join('') + '</div>' +
      '<div class="mdc-filter pel-filter">' +
      '<input id="plQ" type="search" placeholder="Cari film, PH, kode disk, outlet, penerima" value="' + q(DST.q) + '" aria-label="Cari">' +
      '<select id="plS" aria-label="Status laporan"><option value="">Semua status</option>' +
      STATUS.map(function (s) { return '<option value="' + s + '"' + (DST.status === s ? ' selected' : '') + '>' + (s === 'Lama' ? 'Data lama' : s) + '</option>'; }).join('') +
      '</select>' +
      '<label class="pel-date">Dari <input id="plD1" type="date" value="' + q(DST.dari) + '"></label>' +
      '<label class="pel-date">Sampai <input id="plD2" type="date" value="' + q(DST.sampai) + '"></label>' +
      '<button type="button" class="btn sec" id="plReset">Atur ulang</button></div>' +
      '<div class="mdc-tbl" role="region" aria-label="Daftar kode disk"><table><thead><tr><th>Kode disk</th><th>Judul film</th><th>PH</th><th>Posisi saat ini</th><th>Transaksi</th><th>Terakhir</th><th></th></tr></thead><tbody id="plBody"></tbody></table></div>';
    v.innerHTML = h;
    renderBody();
    bindList();
  }

  function renderBody() {
    var body = $('plBody');
    if (!body) return;
    var enabledK = P.canWrite();
    var shown = groups().filter(function (g) { var h = posisi(g).here; return (DST.tab === 'all' || (DST.tab === 'stc' ? h : !h)) && g.hist.some(match); })
      .sort(function (a, b) { var p = key(a.last), k = key(b.last); return p < k ? 1 : p > k ? -1 : 0; });
    body.innerHTML = shown.length ? shown.map(function (g) {
      var p = posisi(g), cnt = g.hist.length, wait = g.hist.filter(function (r) { return statusOf(r) === 'Menunggu foto'; }).length;
      var last = g.last;
      return '<tr data-pel-open="' + q(g.kd) + '" tabindex="0"><td class="mdc-mono">' + q(g.kd) + '</td><td>' + q(g.film) + '</td><td>' + q(g.ph) + '</td>' +
        '<td><span class="mdc-st mdc-' + (p.cls === 'ok' ? 'selesai' : 'warn') + '">' + q(p.txt) + '</span></td>' +
        '<td>' + cnt + ' transaksi' + (wait ? ' · ' + wait + ' menunggu foto' : '') + '</td><td>' + q(last.tanggal) + ' ' + q(last.jam) + '</td>' +
        '<td>' + (enabledK && p.here ? '<button type="button" class="btn sec pel-kirim" data-pel-kirim="' + q(g.kd) + '">Kirim</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="mdc-empty">' + (DST.tab === 'stc' ? 'Tidak ada DCP di STC yang cocok.' : 'Tidak ada data yang cocok dengan filter.') + '</td></tr>';
  }

  function bindList() {
    var t;
    $('plQ').oninput = function () { DST.q = this.value; clearTimeout(t); t = setTimeout(renderBody, 150); };
    $('plS').onchange = function () { DST.status = this.value; renderBody(); };
    $('plD1').onchange = function () { DST.dari = this.value; renderBody(); };
    $('plD2').onchange = function () { DST.sampai = this.value; renderBody(); };
    $('plReset').onclick = function () { DST = { q: '', status: '', dari: '', sampai: '', tab: DST.tab }; shell(); };
    var m = $('plMasuk'), k = $('plKeluar');
    if (m) m.onclick = function () { openForm('MASUK', null, ''); };
    if (k) k.onclick = function () { openKirim(''); };
    $('plxl').onclick = function () { plExport('xlsx'); };
    $('plpdf').onclick = function () { plExport('pdf'); };
    [].forEach.call(document.querySelectorAll('[data-pel-tab]'), function (b) {
      b.onclick = function () { DST.tab = b.getAttribute('data-pel-tab'); shell(); };
    });
    $('plBody').onclick = function (e) {
      var kb = e.target.closest('[data-pel-kirim]');
      if (kb) { e.stopPropagation(); openKirim(kb.getAttribute('data-pel-kirim')); return; }
      var tr = e.target.closest('[data-pel-open]');
      if (tr) openDetail(tr.getAttribute('data-pel-open'));
    };
    $('plBody').onkeydown = function (e) {
      var tr = e.target.closest && e.target.closest('[data-pel-open]');
      if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(tr.getAttribute('data-pel-open')); }
    };
  }

  /* ---------- muat ulang data, lalu perbarui tampilan ---------- */
  function reload() {
    return api('pel_list', { quiet: true }).then(function (r) { ROWS = r || []; });
  }

  /* ---------- detail kode disk: timeline ---------- */
  function line(l, v) { return '<dt>' + q(l) + '</dt><dd>' + v + '</dd>'; }
  function nodeHtml(r, enabled) {
    var masuk = r.jenis === 'MASUK', s = statusOf(r), dok = r.foto || [];
    var head = masuk
      ? 'Masuk di <b>' + q(r.outlet || '-') + '</b>'
      : 'Keluar dari <b>' + q(r.outlet || '-') + '</b> ke <b>' + q(r.outletTujuan || r.tujuan || '-') + '</b>';
    var rows = line('Tanggal & waktu', q(r.tanggal || '-') + ' ' + q(r.jam || '')) +
      line('Pelapor', q(r.pelapor || '-'));
    if (masuk) rows += line('Datang dari', q(r.asalDari || '-'));
    rows += line('Pengirim', q(r.namaPengirim || '-'));
    if (!masuk) rows += line('Penerima', q(r.penerima || '-'));
    if (r.kelengkapan && r.kelengkapan.length) rows += line('Jenis DCP', q(r.jenisDcp || 'Besar')) + line('Kelengkapan', kelHtml(r.kelengkapan));
    if (r.keterangan) rows += line('Catatan', q(r.keterangan));
    if (r.verifiedAt) rows += line('Divalidasi', q(r.verifiedBy || '-') + ' · ' + q(dt(r.verifiedAt)));
    if (r.alasanBatal) rows += line('Alasan batal validasi terakhir', q(r.alasanBatal) + ' (' + q(r.batalBy || '-') + ', ' + q(dt(r.batalAt)) + ')');
    var shared = null;
    if (!dok.length && r.batchId) {
      shared = ROWS.filter(function (x) { return x.batchId === r.batchId && x.id !== r.id && (x.foto || []).length; })[0] || null;
      if (shared) dok = shared.foto;
    }
    var photos = dok.length
      ? (shared ? '<p class="mdc-note">Dokumentasi satu laporan (diunggah pada item ' + q(shared.id) + ').</p>' : '') +
        '<div class="pel-ph">' + dok.map(function (f) { return '<img data-fid="' + q(f.fotoId) + '" data-th="1" alt="Dokumentasi ' + (masuk ? 'masuk' : 'keluar') + '" loading="lazy">'; }).join('') + '</div>'
      : '<p class="mdc-note">' + (masuk ? 'Belum ada dokumentasi foto. Unggah minimal 1 foto agar laporan berstatus Lengkap.' : 'Belum ada dokumentasi foto (opsional untuk DCP keluar).') + '</p>';
    var acts = '';
    /* Admin: kuasa penuh atas semua baris (juga data lama/DCP Management, tervalidasi, milik pengguna lain). Pengguna lain: hanya laporan miliknya yang belum tervalidasi. */
    var adm = me().role === 'ADMIN';
    if (enabled && (adm || (!isLama(r) && owner(r)))) {
      if (!r.verifiedAt || adm) {
        acts += '<button type="button" class="btn sec" data-pel-act="edit" data-id="' + q(r.id) + '">Ubah</button>';
        acts += '<button type="button" class="btn sec" data-pel-act="foto" data-id="' + q(r.id) + '">' + (dok.length ? 'Tambah foto' + (adm ? '' : ' (opsional)') : 'Unggah foto') + '</button>';
      }
      if (r.verifiedAt && !isLama(r)) acts += '<button type="button" class="btn sec" data-pel-act="batal" data-id="' + q(r.id) + '">Batalkan validasi</button>';
      if (adm) acts += '<button type="button" class="btn danger" data-pel-act="hapus" data-id="' + q(r.id) + '">Hapus</button>';
    }
    return '<div class="pel-node ' + (masuk ? 'in' : 'out') + '"><div class="pel-dot" aria-hidden="true"></div>' +
      '<article class="pel-card"><div class="pel-head"><span class="pel-jenis">' + (masuk ? 'DCP MASUK' : 'DCP KELUAR') + ' · ' + q(r.id) + '</span>' + stBadge(s) + '</div>' +
      '<h4>' + head + '</h4><dl class="pel-dl">' + rows + '</dl>' + photos +
      (acts ? '<div class="pel-acts">' + acts + '</div>' : '') + '</article></div>';
  }

  function batchIds(g) { var m = {}; g.hist.forEach(function (r) { if (r.batchId) m[r.batchId] = 1; }); return Object.keys(m); }
  function batchHtml(g) {
    return batchIds(g).map(function (b, bi) {
      var rs = sortAsc(ROWS.filter(function (r) { return r.batchId === b; }));
      if (rs.length < 2) return '';
      return '<section class="mi-sib" aria-label="Laporan multi-item"><h3>Laporan multi-item (' + rs.length + ' item)</h3><ul class="mi-sibl">' + rs.map(function (r) {
        return '<li><button type="button" class="btn sec" data-pel-open="' + q(r.kodeDisk) + '">' + q(r.film) + ' · ' + q(r.kodeDisk) + ' · ' + (r.jenis === 'KELUAR' ? 'Keluar' : 'Masuk') + '</button></li>';
      }).join('') + '</ul><div class="mdc-foot mi-bfoot">' + P.dlMenu('plb' + bi, 'Download laporan lengkap') + '</div></section>';
    }).join('');
  }
  function bindBatch(g) {
    [].forEach.call(document.querySelectorAll('#mbox [data-pel-open]'), function (b) { b.onclick = function () { openDetail(b.getAttribute('data-pel-open')); }; });
    batchIds(g).forEach(function (b, bi) {
      var rs = ROWS.filter(function (r) { return r.batchId === b; });
      if ($('plb' + bi + 'xl')) $('plb' + bi + 'xl').onclick = function () { plBatchExport(rs, 'xlsx'); };
      if ($('plb' + bi + 'pdf')) $('plb' + bi + 'pdf').onclick = function () { plBatchExport(rs, 'pdf'); };
    });
  }
  function openDetail(kd) {
    var g = groupOf(kd);
    if (!g) { toast('Kode disk tidak ditemukan.', 1); return; }
    var enabled = P.canWrite(), p = posisi(g);
    var h = '<h3>Kode disk ' + q(g.kd) + '</h3>' +
      '<p class="mdc-note">' + q(g.film) + ' · PH ' + q(g.ph) + '</p>' +
      '<div class="pel-sum">Posisi saat ini: <span class="mdc-st mdc-' + (p.cls === 'ok' ? 'selesai' : 'warn') + '">' + q(p.txt) + '</span> · ' + g.hist.length + ' transaksi</div>' +
      '<div class="pel-tl" aria-label="Riwayat DCP">' + sortDesc(g.hist).map(function (r) { return nodeHtml(r, enabled); }).join('') + '</div>' + batchHtml(g) +
      '<div class="mdc-foot"><button type="button" class="btn sec" id="plx">Tutup</button>' +
      (enabled ? '<button type="button" class="btn sec" id="plAddM">+ Masuk</button><button type="button" class="btn" id="plAddK">+ Keluar</button>' : '') + '</div>';
    modal(h);
    $('plx').onclick = closeM;
    var a = $('plAddM'), b = $('plAddK');
    if (a) a.onclick = function () { openForm('MASUK', null, g.kd); };
    if (b) b.onclick = function () { if (p.here) openKirim(g.kd); else toast('DCP belum berada di ' + OUTLET_SAYA + '. Catat DCP Masuk terlebih dahulu.', 1); };
    P.loadThumbs(document.getElementById('mbox') || document);
    bindBatch(g);
    document.querySelectorAll('#mbox [data-pel-act]').forEach(function (btn) {
      btn.onclick = function () { act(btn.getAttribute('data-pel-act'), btn.getAttribute('data-id'), g.kd); };
    });
  }

  function findRow(id) { return ROWS.filter(function (r) { return r.id === id; })[0] || null; }

  function act(a, id, kd) {
    var r = findRow(id);
    if (!r) { toast('Transaksi tidak ditemukan.', 1); return; }
    if (a === 'edit') {
      if (!isLama(r)) return openForm(r.jenis, r, kd);
      /* baris DCP Management: formulir Management (satu sumber data, aturan server sama) */
      return api('dcp_get', { id: r.id }).then(function (d) { S.dcpUI.form(d.transaksi.jenis, d.transaksi); }).catch(function (e) { toast(e.message, 1); });
    }
    if (a === 'hapus') {
      if (!confirm('Hapus ' + (r.jenis === 'MASUK' ? 'DCP Masuk ' : 'DCP Keluar ') + r.id + ' (' + r.film + ', ' + r.kodeDisk + ')? Foto ikut dihapus dan tindakan ini tidak dapat dibatalkan.')) return;
      return api('dcp_del', { id: r.id }).then(function () { toast('Transaksi dihapus.'); return reload().then(function () { refresh(kd); }); }).catch(function (e) { toast(e.message, 1); });
    }
    if (a === 'foto') return pickPhotos(r, kd);
    if (a === 'batal') return openBatal(r, kd);
  }

  /* setelah perubahan: perbarui daftar (bila terbuka) lalu tampilkan detail kode disk */
  function refresh(kd) {
    if ($('plBody')) shell();
    if (FROM_DCP) { FROM_DCP = false; closeM(); if (S.dcpUI) S.dcpUI.reload(); return; } /* diubah dari DCP Management: kembali ke Management */
    if (kd && groupOf(kd)) openDetail(kd);
    else closeM();
  }

  /* ---------- tambah foto ke transaksi yang sudah ada (galeri atau kamera) ---------- */
  function pickPhotos(r, kd) {
    modal('<h3>Tambah foto dokumentasi</h3><p class="mdc-note">Transaksi ' + q(r.id) + ' · ' + (r.jenis === 'MASUK' ? 'DCP Masuk' : 'DCP Keluar') + '</p>' +
      '<form id="plpf" class="mdc-form" novalidate>' + P.photoBox('plp') + '<div class="mdc-foot"><button type="button" class="btn sec" id="plpx">Batal</button><button type="submit" class="btn" id="plps">Unggah foto</button></div></form>');
    var pb = P.photoBind('plp');
    $('plpx').onclick = closeM;
    $('plpf').onsubmit = function (e) {
      e.preventDefault();
      var files = pb.get();
      if (!files.length) { toast('Pilih minimal satu foto.', 1); return; }
      P.sendPhotos(r.id, files, 'Foto DCP ' + (r.jenis === 'MASUK' ? 'Masuk' : 'Keluar'), 'dcp_photo_save', function () {
        reload().then(function () { refresh(kd); });
      });
    };
  }

  /* ---------- batalkan validasi: alasan wajib ---------- */
  function openBatal(r, kd) {
    modal('<h3>Batalkan validasi</h3><p class="mdc-note">Data lama ini kembali dapat diubah dan ditambah foto. Alasan dicatat di jejak audit.</p>' +
      '<form id="plbf" class="mdc-form" novalidate><label>Alasan pembatalan<textarea name="alasan" required minlength="5" maxlength="500" rows="3" placeholder="mis. Foto keluar kurang jelas"></textarea></label>' +
      '<div class="mdc-foot"><button type="button" class="btn sec" id="plbx">Tutup</button><button type="submit" class="btn">Batalkan validasi</button></div></form>');
    $('plbx').onclick = function () { openDetail(kd); };
    $('plbf').onsubmit = function (e) {
      e.preventDefault();
      var alasan = this.alasan.value.trim();
      if (alasan.length < 5) { toast('Isi alasan minimal 5 karakter.', 1); return; }
      api('pel_validasi', { id: r.id, aksi: 'batal', alasan: alasan }).then(function () {
        toast('Validasi dibatalkan. Laporan dapat diubah kembali.');
        return reload().then(function () { refresh(kd); });
      }).catch(function (e2) { toast(e2.message, 1); });
    };
  }

  /* ---------- formulir Masuk / Keluar ---------- */
  function outletOpts(sel) {
    var o = OUTLET.map(function (x) { return '<option' + (sel === x ? ' selected' : '') + '>' + q(x) + '</option>'; }).join('');
    var isLain = sel && OUTLET.indexOf(sel) < 0;
    return o + '<option value="' + LAIN + '"' + (isLain ? ' selected' : '') + '>' + LAIN + '</option>';
  }
  function lainVal(sel) { return sel && OUTLET.indexOf(sel) < 0 ? sel : ''; }
  /* outlet asal pengirim: outlet XXI selain STC, XPDC, atau nama lain */
  var ASAL_OPTS = OUTLET.filter(function (o) { return o !== OUTLET_SAYA; }).concat(['XPDC']);
  function asalOpts(sel) {
    return ASAL_OPTS.concat([LAIN]).map(function (x) { return '<option value="' + q(x) + '"' + (sel === x ? ' selected' : '') + '>' + q(x === LAIN ? 'Lainnya' : x) + '</option>'; }).join('');
  }
  /* checklist kelengkapan (sama dengan DCP Management): centang = lengkap, isi keterangan bila tidak ada/rusak */
  function kelFieldset(rec, jenis) {
    var L = komp(jenis);
    var list = (rec && rec.kelengkapan && rec.kelengkapan.length) ? rec.kelengkapan : L.map(function (n) { return { name: n, status: 'Lengkap', note: '' }; });
    return '<fieldset class="mdc-fs pel-kelfs"><legend>Kelengkapan</legend>' + L.map(function (n, i) {
      var c = list.filter(function (k) { return k.name === n; })[0] || { status: 'Lengkap', note: '' };
      var on = c.status === 'Lengkap' || c.status === 'Tidak Diperlukan';
      return '<div class="mdc-kr" data-k="' + i + '"><label class="mdc-cbx"><input type="checkbox" name="kc' + i + '" data-st="' + q(c.status) + '"' + (on ? ' checked' : '') + '> <span>' + q(n) + '</span></label>' +
        '<input name="kn' + i + '" maxlength="300" placeholder="Keterangan, mis. adaptor rusak (wajib jika tidak dicentang)" value="' + q(c.note || '') + '" aria-label="Keterangan ' + q(n) + '"></div>';
    }).join('') + '</fieldset>';
  }
  /* pilihan jenis DCP; checklist baru tampil setelah jenis dipilih */
  function jenisBlock(rec) {
    var sel = rec ? (rec.jenisDcp || 'Besar') : '';
    var radios = '<div class="pel-jlist" role="radiogroup" aria-label="Jenis DCP">' +
      [['Besar', 'DCP Besar', 'HDD, USB, Kabel Power, Adaptor'], ['Kecil', 'DCP Kecil', 'HDD, USB']].map(function (o) {
        return '<label class="mdc-cbx"><input type="radio" name="jenisDcp" value="' + o[0] + '"' + (sel === o[0] ? ' checked' : '') + '><span><b>' + o[1] + '</b> <small>(' + o[2] + ')</small></span></label>';
      }).join('') + '</div>';
    return '<fieldset class="mdc-fs pel-jenis"><legend>Jenis DCP</legend>' + radios + '</fieldset>' +
      '<div id="plKel">' + (sel ? kelFieldset(rec, sel) : '<p class="mdc-note">Pilih jenis DCP untuk menampilkan checklist kelengkapan.</p>') + '</div>';
  }
  function kelRead(f, jenis) {
    return komp(jenis).map(function (n, i) {
      var cb = f['kc' + i], orig = cb.getAttribute('data-st') || '';
      var st = cb.checked ? (orig === 'Tidak Diperlukan' ? 'Tidak Diperlukan' : 'Lengkap') : (orig === 'Rusak' ? 'Rusak' : 'Tidak Ada');
      return { name: n, status: st, note: f['kn' + i].value.trim() };
    });
  }
  function kelHtml(list) {
    return '<ul class="pel-kel">' + list.map(function (c) {
      var bad = c.status === 'Tidak Ada' || c.status === 'Rusak';
      return '<li class="' + (bad ? 'bad' : 'ok') + '"><b>' + q(c.name) + '</b> · ' + q(c.status) + (c.note ? ' <span class="pel-kelnote">(' + q(c.note) + ')</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  /* kd: kode disk yang sudah dipilih (dari detail); rec: transaksi untuk diubah */
  window.pelOpenForm = function (jenis, kd) {
    var go = ROWS.length ? Promise.resolve() : reload();
    go.then(function () { if (jenis === 'KELUAR' && !kd) openKirim(''); else openForm(jenis, null, kd || ''); }).catch(function (e) { toast(e.message, 1); });
  };

  /* ---------- Kirim DCP (Keluar): pilih dari daftar DCP yang ada di STC, isi tujuan sekali, banyak disk sekaligus ---------- */
  (function () {
    if (document.getElementById('pel-kirim-css')) return;
    var st = document.createElement('style'); st.id = 'pel-kirim-css';
    st.textContent = '.pel-tabs{display:flex;gap:6px;margin:12px 0 8px;flex-wrap:wrap}' +
      '.pel-tab{border:1px solid var(--bd,#d0d5dd);background:transparent;color:inherit;border-radius:999px;padding:8px 14px;font:inherit;font-size:14px;cursor:pointer;min-height:40px}' +
      '.pel-tab.on{background:var(--brand,#4f46e5);border-color:var(--brand,#4f46e5);color:#fff}.pel-tab b{margin-left:4px}' +
      '.pel-kl{display:flex;flex-direction:column;gap:6px;max-height:42vh;overflow:auto;border:1px solid var(--bd,#d0d5dd);border-radius:10px;padding:8px}' +
      '.pel-ki{border-bottom:1px solid var(--bd,#e4e7ec);padding:6px 2px}.pel-ki:last-child{border-bottom:0}.pel-ki[hidden]{display:none}' +
      '.pel-kd{margin:4px 0 0 28px;font-size:13px}.pel-kd summary{cursor:pointer;opacity:.8}.pel-kcs{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:6px}' +
      '.pel-kcs .pel-kn{flex:1 1 100%}.pel-kirim{padding:6px 12px;min-height:36px}';
    document.head.appendChild(st);
  })();
  function lastJenis(g) {
    for (var i = g.hist.length - 1; i >= 0; i--) if (g.hist[i].jenis === 'MASUK') return g.hist[i].jenisDcp || 'Besar';
    return g.last.jenisDcp || 'Besar';
  }
  function openKirim(pre) {
    var stc = groups().filter(function (g) { return posisi(g).here; })
      .sort(function (a, b) { var x = key(a.last), y = key(b.last); return x < y ? 1 : x > y ? -1 : 0; });
    if (!stc.length) { toast('Tidak ada DCP di ' + OUTLET_SAYA + '. Catat DCP Masuk terlebih dahulu.', 1); return; }
    var savedP = ''; try { savedP = localStorage.getItem('nova_pel_pengirim') || ''; } catch (e) {}
    var list = stc.map(function (g) {
      var jn = lastJenis(g);
      var kel = komp(jn).map(function (n, k) { return '<label class="mdc-cbx pel-kc"><input type="checkbox" data-k="' + k + '" checked> <span>' + q(n) + '</span></label>'; }).join('');
      return '<div class="pel-ki" data-kd="' + q(g.kd) + '" data-s="' + q((g.kd + ' ' + g.film + ' ' + g.ph).toLowerCase()) + '" data-j="' + q(jn) + '">' +
        '<label class="mdc-cbx"><input type="checkbox" name="kdsel" value="' + q(g.kd) + '"' + (pre === g.kd ? ' checked' : '') + '> <span><b class="mdc-mono">' + q(g.kd) + '</b> · ' + q(g.film) + ' <small>PH ' + q(g.ph) + ' · DCP ' + q(jn) + '</small></span></label>' +
        '<details class="pel-kd"><summary>Kelengkapan: semua lengkap</summary><div class="pel-kcs">' + kel +
        '<input class="pel-kn" maxlength="300" placeholder="Keterangan (wajib jika ada yang tidak dicentang)" aria-label="Keterangan kelengkapan ' + q(g.kd) + '"></div></details></div>';
    }).join('');
    var tujOpts = OUTLET.filter(function (o) { return o !== OUTLET_SAYA; }).concat([LAIN]).map(function (x) { return '<option value="' + q(x) + '">' + q(x) + '</option>'; }).join('');
    modal('<h3>Kirim DCP</h3><p class="mdc-note">Pilih DCP yang akan dikirim dari ' + q(OUTLET_SAYA) + '. Judul film, PH, dan jenis DCP terisi otomatis dari catatan Masuk.</p>' +
      '<form id="plkf" class="mdc-form" novalidate>' +
      '<div class="mdc-grid"><input id="plkq" type="search" placeholder="Cari kode disk, judul film, atau PH" aria-label="Cari DCP"><button type="button" class="btn sec" id="plkall">Pilih semua yang tampil</button></div>' +
      '<div class="pel-kl" id="plkl">' + list + '</div><p class="mdc-note" id="plkcnt"></p>' +
      '<div class="mdc-grid"><label>Outlet tujuan<select name="outletTujuan" required><option value="">Pilih outlet tujuan</option>' + tujOpts + '</select></label>' +
      '<label>Nama penerima di outlet tujuan<input name="penerima" required maxlength="120" placeholder="mis. Budi"></label></div>' +
      '<label class="pel-lain" id="plkLain" hidden>Nama outlet tujuan lain<input name="outletTujuanLain" maxlength="120"></label>' +
      '<div class="mdc-grid"><label>Nama pengirim (di STC)<input name="namaPengirim" required maxlength="120" value="' + q(savedP || myName()) + '"></label></div>' +
      '<label>Catatan (opsional)<textarea name="keterangan" maxlength="2000" rows="2"></textarea></label>' +
      '<p class="mdc-note">Tanpa validasi: DCP keluar hanya didata. Foto bersifat opsional.</p>' + P.photoBox('plk') +
      '<p class="mdc-err" id="plkerr" role="alert"></p>' +
      '<div class="mdc-foot"><button type="button" class="btn sec" id="plkx">Batal</button><button type="submit" class="btn" id="plks">Kirim DCP</button></div></form>');
    var f = $('plkf'), pb = P.photoBind('plk');
    function items() { return [].slice.call(f.querySelectorAll('.pel-ki')); }
    function chosen() { return items().filter(function (el) { return el.querySelector('input[name=kdsel]').checked; }); }
    function sync() {
      var n = chosen().length; $('plkcnt').textContent = n ? n + ' DCP dipilih.' : 'Belum ada DCP dipilih.';
      items().forEach(function (el) {
        var bad = [].some.call(el.querySelectorAll('.pel-kcs input[type=checkbox]'), function (c) { return !c.checked; });
        el.querySelector('summary').textContent = bad ? 'Kelengkapan: ada yang tidak lengkap (isi keterangan)' : 'Kelengkapan: semua lengkap';
      });
      var tw = $('plkLain'); if (tw) tw.hidden = f.outletTujuan.value !== LAIN;
    }
    f.addEventListener('change', sync);
    $('plkq').oninput = function () {
      var s = this.value.trim().toLowerCase();
      items().forEach(function (el) { el.hidden = !!s && el.getAttribute('data-s').indexOf(s) < 0; });
    };
    $('plkall').onclick = function () {
      items().forEach(function (el) { if (!el.hidden) el.querySelector('input[name=kdsel]').checked = true; });
      sync();
    };
    $('plkx').onclick = function () { if (pre && groupOf(pre)) openDetail(pre); else closeM(); };
    sync();
    f.onsubmit = function (e) {
      e.preventDefault();
      var err = $('plkerr'); err.textContent = '';
      var sel = chosen();
      if (!sel.length) { err.textContent = 'Pilih minimal satu DCP yang akan dikirim.'; return; }
      var tuj = f.outletTujuan.value, penerima = f.penerima.value.trim(), pengirim = f.namaPengirim.value.trim();
      if (!tuj) { err.textContent = 'Pilih outlet tujuan.'; return; }
      if (tuj === LAIN && !f.outletTujuanLain.value.trim()) { err.textContent = 'Isi nama outlet tujuan lain.'; return; }
      if (!penerima) { err.textContent = 'Isi nama penerima di outlet tujuan.'; return; }
      if (!pengirim) { err.textContent = 'Isi nama pengirim.'; return; }
      var batch = sel.length > 1 ? S.mi.uid() : '', problem = '';
      var rows = sel.map(function (el) {
        var kd = el.getAttribute('data-kd'), g = groupOf(kd), jn = el.getAttribute('data-j') || 'Besar';
        var note = el.querySelector('.pel-kn').value.trim();
        var cbs = el.querySelectorAll('.pel-kcs input[type=checkbox]');
        var kel = komp(jn).map(function (n, i) { return { name: n, status: cbs[i].checked ? 'Lengkap' : 'Tidak Ada', note: cbs[i].checked ? '' : note }; });
        if (kel.some(function (c) { return c.status !== 'Lengkap' && !c.note; }) && !problem) problem = 'Isi keterangan kelengkapan untuk disk ' + kd + '.';
        return { jenis: 'KELUAR', kodeDisk: kd, film: g.film, ph: g.ph, outlet: (g.last.outlet || OUTLET_SAYA), outletTujuan: tuj,
          outletTujuanLain: f.outletTujuanLain.value.trim(), penerima: penerima, namaPengirim: pengirim, keterangan: f.keterangan.value.trim(),
          jenisDcp: jn, kelengkapan: kel, batchId: batch };
      });
      if (problem) { err.textContent = problem; return; }
      var btn = $('plks'); btn.disabled = true;
      var call = rows.length === 1
        ? api('pel_save', rows[0]).then(function (id) { return [id]; })
        : api('dcp_batch_save', { kind: 'pel', batchId: batch, items: rows }).then(function (r) { return r.ids; });
      call.then(function (ids) {
        try { localStorage.setItem('nova_pel_pengirim', pengirim); } catch (e2) {}
        var files = pb.get();
        var finish = function () {
          toast(ids.length + ' DCP dikirim ke ' + (tuj === LAIN ? f.outletTujuanLain.value.trim() : tuj) + '.');
          reload().then(function () { DST.tab = 'kirim'; refresh(''); });
        };
        if (files.length) P.sendPhotos(ids[0], files, 'Foto DCP Keluar', 'dcp_photo_save', finish); else finish();
      }).catch(function (er) { btn.disabled = false; toast(er.message, 1); err.textContent = er.message; });
    };
  }

  function openForm(jenis, rec, kd) {
    var masuk = jenis === 'MASUK';
    var g = kd ? groupOf(kd) : null;
    var p = posisi(g);
    var defOutlet = masuk ? OUTLET_SAYA : (rec ? rec.outlet : (p.at ? p.outlet : ''));
    var defTujuan = rec ? (rec.outletTujuan || '') : '';
    var film = rec ? rec.film : (g ? g.film : '');
    var ph = rec ? rec.ph : (g ? g.ph : '');
    var kdVal = rec ? rec.kodeDisk : kd;
    var h = '<h3>' + (rec ? 'Ubah ' : '') + (masuk ? 'DCP Masuk' : 'DCP Keluar') + '</h3>' +
      '<form id="plf" class="mdc-form" novalidate>' +
      '<div class="mdc-grid"><label>Kode disk<input name="kodeDisk" required maxlength="60" value="' + q(kdVal) + '"' + (rec || g ? ' readonly' : '') + ' placeholder="mis. D-01"></label>' +
      '<label>Judul film<input name="film" maxlength="200" value="' + q(film) + '"' + (g || rec ? ' readonly' : '') + '></label></div>' +
      '<div class="mdc-grid"><label>PH<input name="ph" maxlength="160" value="' + q(ph) + '"' + (g || rec ? ' readonly' : '') + '></label>' +
      '<div class="pel-loc"><span>' + (masuk ? 'Outlet penerima (outlet ini)' : 'Outlet asal (posisi DCP saat ini)') + '</span><b id="plLoc">' + q(defOutlet || '-') + '</b></div></div>' +
      '<input type="hidden" name="outlet" value="' + q(defOutlet) + '">';
    if (!masuk) {
      h += '<div class="mdc-grid"><label>Outlet tujuan<select name="outletTujuan" required><option value="">Pilih outlet tujuan</option>' + outletOpts(defTujuan) + '</select></label>' +
        '<label>Nama penerima di outlet tujuan<input name="penerima" required maxlength="120" value="' + q(rec ? rec.penerima : '') + '" placeholder="mis. Budi"></label></div>' +
        '<label class="pel-lain" id="plLainT"' + (lainVal(defTujuan) || defTujuan === LAIN ? '' : ' hidden') + '>Nama outlet tujuan lain<input name="outletTujuanLain" maxlength="120" value="' + q(lainVal(defTujuan)) + '"></label>' +
        '<div class="mdc-grid"><label>Nama pengirim (di STC)<input name="namaPengirim" required maxlength="120" value="' + q(rec ? rec.namaPengirim : '') + '" placeholder="mis. Budi"></label></div>';
    }
    if (masuk) {
      var asalSel = rec && rec.asalDari && ASAL_OPTS.indexOf(rec.asalDari) < 0 ? LAIN : (rec ? rec.asalDari : '');
      h += '<div class="mdc-grid"><label>Outlet asal pengirim<select name="asalDari" required><option value="">Pilih outlet asal</option>' + asalOpts(asalSel) + '</select></label>' +
        '<label>Nama pengirim<input name="namaPengirim" required maxlength="120" value="' + q(rec ? rec.namaPengirim : '') + '" placeholder="mis. Budi"></label></div>' +
        '<label class="pel-lain" id="plLainA"' + (asalSel === LAIN ? '' : ' hidden') + '>Nama outlet asal lain<input name="asalLain" maxlength="200" value="' + q(rec && asalSel === LAIN ? rec.asalDari : '') + '"></label>' +
        '<div class="mdc-grid"><div class="pel-loc"><span>Nama penerima (pelapor)</span><b>' + q(rec ? (rec.penerima || '-') : myName()) + '</b></div></div>';
    }
    h += '<p class="mdc-note" id="plInfo"></p>' +
      '<div class="pel-auto"><span>Tanggal & waktu: otomatis saat disimpan</span><span>Pelapor: ' + q(myName()) + '</span></div>' +
      '<label>Catatan<textarea name="keterangan" maxlength="2000" rows="3">' + q(rec ? rec.keterangan : '') + '</textarea></label>' +
      jenisBlock(rec) + (rec || kd ? '' : '<div id="mi-host"></div>') + (rec ? '' : '<p class="mdc-note">' + (masuk ? 'Unggah minimal 1 foto agar laporan berstatus Lengkap. Satu foto sudah cukup untuk seluruh item dalam laporan; foto tambahan opsional.' : 'DCP keluar hanya didata, tanpa validasi. Foto bersifat opsional.') + '</p>' + P.photoBox('pel')) + '<p class="mdc-err" id="plerr" role="alert"></p>' +
      '<div class="mdc-foot"><button type="button" class="btn sec" id="plcancel">Batal</button><button type="submit" class="btn" id="plsave">Simpan laporan</button></div></form>';
    modal(h);
    var pb = rec ? null : P.photoBind('pel');
    var MI = (!rec && !kd && S.mi && $('mi-host')) ? S.mi.mount($('mi-host'), { mode: 'pel' }) : null;
    var f = $('plf'), saved = rec;

    function sync() {
      var v = f.kodeDisk.value.trim(), gg = v ? groupOf(v) : null, pp = posisi(gg);
      if (!rec) {
        var lock = !!gg;
        f.film.readOnly = lock; f.ph.readOnly = lock;
        if (gg) { f.film.value = gg.film; f.ph.value = gg.ph; }
        var info = $('plInfo');
        if (info) {
          if (!gg) info.textContent = masuk ? 'Kode disk baru: isi judul film dan PH.' : 'Kode disk belum pernah dicatat. Catat DCP Masuk terlebih dahulu.';
          else info.textContent = 'DCP ditemukan: ' + pp.txt + '.' + (!masuk && !pp.here ? ' Catat DCP Masuk ke ' + OUTLET_SAYA + ' terlebih dahulu.' : '');
        }
        var wantO = masuk ? OUTLET_SAYA : (pp.at ? pp.outlet : '');
        f.outlet.value = wantO;
        var ol = $('plLoc'); if (ol) ol.textContent = wantO || '-';
      }
      syncLain();
    }
    function syncLain() {
      var tw = $('plLainT'); if (tw) tw.hidden = !f.outletTujuan || f.outletTujuan.value !== LAIN;
      var la = $('plLainA'); if (la) la.hidden = !f.asalDari || f.asalDari.value !== LAIN;
    }
    f.kodeDisk.oninput = sync;
    if (f.outletTujuan) f.outletTujuan.onchange = syncLain;
    if (f.asalDari) f.asalDari.onchange = syncLain;
    sync();

    [].forEach.call(f.querySelectorAll('input[name=jenisDcp]'), function (r) {
      r.onchange = function () { $('plKel').innerHTML = kelFieldset(rec, r.value); };
    });
    $('plcancel').onclick = function () { if (kd && groupOf(kd)) openDetail(kd); else closeM(); };
    f.onsubmit = function (e) {
      e.preventDefault();
      var body = {
        jenis: jenis,
        kodeDisk: f.kodeDisk.value.trim(),
        film: f.film.value.trim(),
        ph: f.ph.value.trim(),
        outlet: f.outlet.value,
        outletLain: f.outletLain ? f.outletLain.value.trim() : '',
        keterangan: f.keterangan.value.trim()
      };
      if (!masuk) {
        body.outletTujuan = f.outletTujuan.value;
        body.outletTujuanLain = f.outletTujuanLain ? f.outletTujuanLain.value.trim() : '';
        body.penerima = f.penerima.value.trim();
        body.namaPengirim = f.namaPengirim.value.trim();
        if (!body.namaPengirim) { toast('Isi nama pengirim DCP.', 1); return; }
      }
      if (masuk) {
        body.asalDari = f.asalDari.value === LAIN ? f.asalLain.value.trim() : f.asalDari.value;
        body.namaPengirim = f.namaPengirim.value.trim();
        if (!body.asalDari || !body.namaPengirim) { toast('Pilih outlet asal pengirim dan isi nama pengirim.', 1); return; }
      }
      var jsel = f.querySelector('input[name=jenisDcp]:checked');
      if (!jsel) { $('plerr').textContent = 'Pilih jenis DCP (Besar atau Kecil) terlebih dahulu.'; return; }
      body.jenisDcp = jsel.value;
      body.kelengkapan = kelRead(f, body.jenisDcp);
      var bad = body.kelengkapan.filter(function (c) { return (c.status === 'Tidak Ada' || c.status === 'Rusak') && !c.note; });
      if (bad.length) { $('plerr').textContent = 'Isi keterangan untuk: ' + bad.map(function (c) { return c.name; }).join(', ') + '.'; return; }
      $('plerr').textContent = '';
      if (!body.kodeDisk) { toast('Kode disk wajib diisi.', 1); return; }
      if (!body.outlet) { toast(masuk ? 'Outlet DCP masuk tidak valid.' : 'DCP belum berada di outlet ini. Catat DCP Masuk terlebih dahulu.', 1); return; }
      if (!masuk && !body.outletTujuan) { toast('Pilih outlet tujuan.', 1); return; }
      var ex = MI ? MI.read() : { items: [] };
      if (ex.error) { $('plerr').textContent = ex.error; return; }
      var batch = ex.items.length ? S.mi.uid() : '';
      var items = [body].concat(ex.items.map(function (it) {
        return Object.assign({}, body, { kodeDisk: it.kodeDisk, film: it.film, ph: it.ph, jenisDcp: it.jenisDcp, kelengkapan: it.kelengkapan, keterangan: it.keterangan, batchId: batch });
      }));
      if (batch) {
        body.batchId = batch;
        var seen = {}, dup = '';
        items.forEach(function (it, i) { var k = String(it.kodeDisk).toLowerCase(); if (seen[k] !== undefined && !dup) dup = 'Kode disk ' + it.kodeDisk + ' dipakai dua kali (item ' + (seen[k] + 1) + ' dan item ' + (i + 1) + ').'; seen[k] = i; });
        if (dup) { $('plerr').textContent = dup; return; }
      }
      var btn = $('plsave'); btn.disabled = true;
      if (saved) body.id = saved.id;
      /* satu item: pel_save; banyak item: dcp_batch_save (atomik di server — tidak ada laporan setengah jadi) */
      var call = items.length === 1
        ? api('pel_save', items[0]).then(function (id) { return [id]; })
        : api('dcp_batch_save', { kind: 'pel', batchId: batch, items: items }).then(function (r) { return r.ids; });
      call.then(function (ids) {
        var id = ids[0]; saved = { id: id };
        var files = pb ? pb.get() : [];
        var finish = function (noPhoto) { toast((rec ? 'Laporan diperbarui.' : (ids.length > 1 ? ids.length + ' item DCP tersimpan dalam satu laporan.' : 'Laporan tersimpan.')) + (noPhoto === true ? ' Unggah 1 foto agar laporan berstatus Lengkap.' : '')); reload().then(function () { refresh(body.kodeDisk); }); };
        if (files.length) P.sendPhotos(id, files, 'Foto DCP ' + (masuk ? 'Masuk' : 'Keluar'), 'dcp_photo_save', finish); else finish(!rec && masuk);
      }).catch(function (er) {
        btn.disabled = false;
        toast(er.message, 1); $('plerr').textContent = er.message;
      });
    };
  }
  /* dipakai DCP Management: ubah baris Pelaporan (modul PEL) dengan formulir Pelaporan */
  S.pelUI = { edit: function (id) {
    return reload().then(function () {
      var r = findRow(id); if (!r) { toast('Transaksi tidak ditemukan.', 1); return; }
      FROM_DCP = true; openForm(r.jenis, r, r.kodeDisk);
    }).catch(function (e) { toast(e.message, 1); });
  } };
})();
