/* Outlet Operation System - modul DCP Management & Daily Film Testing (frontend).
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
  S.IC.ftest = '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14"/><path d="M10.5 9.5v5l3.5-2.5z"/></svg>';
  var KOMP_DEF = ['HDD', 'USB', 'Kabel Power', 'Adaptor'];
  var KOMP_ST = ['Lengkap', 'Tidak Ada', 'Rusak', 'Tidak Diperlukan'];
  var FMT_DCP = ['2D', '3D', 'ATMOS', '3D-ATMOS', '2D-ATMOS', 'Lainnya'];
  var FMT_FT = ['2D', '3D', 'ATMOS', '3D-ATMOS', 'Lainnya'];
  var STAT_DCP = ['Diproses', 'Selesai', 'Bermasalah'];

  function q(s) { return esc(s); }
  function tnow() { return new Date(S.now ? S.now() : Date.now()); } /* jam server, sama di semua perangkat */
  function jkt(d) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || tnow()); }
  function jam(d) { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(d || tnow()); }
  var MYPERM = null;
  function can(k) { var u = curU(); if (!u) return false; if (u.role === 'ADMIN') return true; return !!MYPERM && MYPERM.indexOf(k) >= 0; }
  function canDel() { return can('delete'); }
  function canWrite() { return can('create') || can('edit'); }
  function loadMyPerm() { if (MYPERM) return Promise.resolve(MYPERM); return api('perm_me', { quiet: true }).then(function (r) { MYPERM = r.perms || []; return MYPERM; }, function () { MYPERM = []; return MYPERM; }); }
  function st(cls, txt) { return '<span class="mdc-st mdc-' + String(cls).replace(/[^a-z0-9-]/gi, '') + '">' + q(txt) + '</span>'; }
  function stDcp(s) { if (s === 'Sudah Keluar') return st('ok', s); return st(String(s || '').toLowerCase().replace(/\s+/g, '-'), s || '-'); }
  function stFt(s) { return st('ft-' + String(s || '').toLowerCase(), s || '-'); }
  function kelOk(list) { return (list || []).every(function (c) { return c.status === 'Lengkap' || c.status === 'Tidak Diperlukan'; }); }

  function getMeta() {
    if (META) return Promise.resolve(META);
    return api('dcp_meta', { quiet: true }).then(function (m) { META = m; return m; });
  }

  /* ---------- foto: file ASLI dikirim apa adanya (tanpa kompresi). Hanya berkas non-JPG/PNG/WebP (mis. HEIC) atau di atas
     batas server (MAX_ORI) diubah ke JPEG kualitas tinggi (sisi maks 4096px, q 0.95) dan pengguna diberi tahu. ---------- */
  var MAX_ORI = 10 * 1024 * 1024, MAX_REQ = 8 * 1024 * 1024;
  function readUrl(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('Gagal membaca berkas ' + file.name)); };
      fr.onload = function () { res(fr.result); };
      fr.readAsDataURL(file);
    });
  }
  function reencode(file) {
    return readUrl(file).then(function (src) {
      return new Promise(function (res, rej) {
        var img = new Image();
        img.onerror = function () { rej(new Error('Berkas ' + file.name + ' bukan gambar yang didukung.')); };
        img.onload = function () {
          var k = Math.min(1, 4096 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.95));
        };
        img.src = src;
      });
    });
  }
  function prepPhoto(file, kind) {
    var native = /^image\/(jpeg|png|webp)$/.test(file.type || '') && file.size <= MAX_ORI;
    return (native ? readUrl(file) : reencode(file).then(function (u) { prepPhoto.re = (prepPhoto.re || 0) + 1; return u; }))
      .then(function (u) { return { b64: u, kind: kind || 'Foto', capturedAt: file.lastModified || Date.now() }; });
  }
  function sendPhotos(id, files, kind, save, done) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    toast('Mengunggah ' + list.length + ' foto...');
    prepPhoto.re = 0;
    Promise.all(list.map(function (f) {
      if (f.size > 40 * 1024 * 1024) return Promise.reject(new Error(f.name + ' terlalu besar (maks 40 MB).'));
      return prepPhoto(f, kind);
    })).then(function (arr) {
      /* batch: maks 6 foto dan ~8 MB per permintaan agar tidak melewati batas Apps Script / waktu habis */
      var batches = [], cur = [], sz = 0;
      arr.forEach(function (p) {
        var b = p.b64.length * 0.75;
        if (cur.length && (cur.length >= 6 || sz + b > MAX_REQ)) { batches.push(cur); cur = []; sz = 0; }
        cur.push(p); sz += b;
      });
      if (cur.length) batches.push(cur);
      return batches.reduce(function (p, b) {
        return p.then(function (acc) {
          return api(save, { id: id, photos: b }).then(function (r) { acc.added += r.added; acc.failed += r.failed; return acc; });
        });
      }, Promise.resolve({ added: 0, failed: 0 }));
    }).then(function (r) {
      toast((r.failed ? 'Sebagian foto gagal (' + r.failed + ')' : 'Foto tersimpan (' + r.added + ')') + (prepPhoto.re ? ' - ' + prepPhoto.re + ' foto diubah ke JPEG kualitas tinggi (format/ukuran tidak didukung apa adanya)' : ''), !!r.failed);
      done && done();
    }).catch(function (e) { toast(e.message, 1); done && done(); });
  }

  /* ---------- dokumentasi foto di dalam form (galeri + kamera), sama dengan form laporan lain ---------- */
  var PH_MAX = 30;
  function photoBox(key, nohead) {
    return (nohead ? '' : '<div class="mdc-sec">Dokumentasi foto</div>') +
      '<div class="mdc-ph"><div class="pick"><label class="btn sec pk" for="' + key + 'gi">Pilih dari galeri</label>' +
      '<label class="btn sec pk" for="' + key + 'gc">Ambil dengan kamera</label></div>' +
      '<input class="vh" type="file" id="' + key + 'gi" accept="image/jpeg,image/png,image/webp" multiple>' +
      '<input class="vh" type="file" id="' + key + 'gc" accept="image/*" capture="environment">' +
      '<p class="mdc-note" id="' + key + 'cnt"></p><div class="ph" id="' + key + 'pv"></div></div>';
  }
  function photoBind(key) {
    var files = [], urls = [];
    function draw() {
      var cnt = $(key + 'cnt'), pv = $(key + 'pv');
      urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} }); urls = []; /* cegah kebocoran memori di HP */
      if (cnt) cnt.textContent = 'Foto: ' + files.length + ' / ' + PH_MAX + ' (JPG/PNG/WebP, boleh langsung dari kamera)';
      if (!pv) return;
      pv.innerHTML = '';
      files.forEach(function (f, i) {
        var d = document.createElement('div'), im = document.createElement('img'), b = document.createElement('button');
        var ou = URL.createObjectURL(f); urls.push(ou); im.decoding = 'async'; im.src = ou; im.alt = 'Foto ' + (i + 1);
        b.type = 'button'; b.className = 'x'; b.setAttribute('aria-label', 'Hapus foto ' + (i + 1)); b.textContent = '×';
        b.onclick = function () { files.splice(i, 1); draw(); };
        d.appendChild(im); d.appendChild(b); pv.appendChild(d);
      });
    }
    function add(list) {
      var arr = Array.prototype.slice.call(list || []), skip = 0;
      arr.forEach(function (f) {
        if (!/^image\//.test(f.type || '')) { skip++; return; }
        if (files.length < PH_MAX) files.push(f); else skip++;
      });
      if (skip) toast(skip + ' berkas dilewati (bukan gambar atau melebihi ' + PH_MAX + ' foto).', 1);
      draw();
    }
    ['gi', 'gc'].forEach(function (s) {
      var el = $(key + s);
      if (el) el.onchange = function () { add(this.files); this.value = ''; };
    });
    draw();
    return { get: function () { return files.slice(); } };
  }

  /* ================= DCP MANAGEMENT ================= */
  var DST = { jenis: '', status: '', q: '' };

  window.vDcp = function () {
    var v = $('view');
    Promise.all([api('dcp_dash'), api('dcp_list', { jenis: DST.jenis, status: DST.status, q: DST.q }), getMeta(), loadMyPerm()]).then(function (r) {
      var d = r[0], list = r[1] || [];
      var over = (d.overdue || []).length;
      var h = '<div class="mdc-top"><div class="mdc-kpis">' +
        kpi('Sudah keluar', d.sudahKeluar != null ? d.sudahKeluar : d.totalKeluar, '') + kpi('DCP Masuk', d.totalMasuk, '') +
        kpi('Belum kembali', d.belumKembali, d.belumKembali ? 'warn' : '') +
        kpi('DCP aktif', d.aktif != null ? d.aktif : d.dcpAktif, '') + kpi('Diproses', d.dalamProses, '') + kpi('Bermasalah', d.bermasalah, d.bermasalah ? 'bad' : '') + '</div>' +
        '<div class="mdc-acts">' + (canWrite() ? '<div class="mdc-tg" role="radiogroup" aria-label="Jenis laporan"><label><input type="radio" name="dcpjt" value="KELUAR" checked><span>DCP Keluar</span></label><label><input type="radio" name="dcpjt" value="MASUK"><span>DCP Masuk</span></label></div><button type="button" class="btn" id="dcpnew">Tambah DCP</button>' : '') + dlMenu('dcp') + '<button type="button" class="btn sec" id="dcprh">Riwayat disk</button>' + (curU().role === 'ADMIN' ? '<button type="button" class="btn sec" id="dcpadm">Izin &amp; pengingat</button>' : '') + '</div></div>';
      if (over) {
        h += '<div class="mdc-alert" role="alert"><b>' + over + ' DCP belum kembali lebih dari ' + d.batasHari + ' hari</b><ul>' +
          d.overdue.slice(0, 6).map(function (o) { return '<li>' + q(o.film) + ' · ' + q(o.kodeDisk) + ' · keluar ' + q(o.tanggal) + '</li>'; }).join('') + '</ul></div>';
      }
      h += '<div class="mdc-filter"><input id="dcpq" type="search" placeholder="Cari film, kode disk, PH, atau ID" value="' + q(DST.q) + '" aria-label="Cari DCP">' +
        '<select id="dcpj" aria-label="Jenis"><option value="">Semua jenis</option><option value="KELUAR"' + (DST.jenis === 'KELUAR' ? ' selected' : '') + '>Keluar</option><option value="MASUK"' + (DST.jenis === 'MASUK' ? ' selected' : '') + '>Masuk</option></select>' +
        '<select id="dcps" aria-label="Status"><option value="">Semua status</option>' + STAT_DCP.map(function (s) { return '<option' + (DST.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>';
      var bc = {}; list.forEach(function (t) { if (t.batchId) bc[t.batchId] = (bc[t.batchId] || 0) + 1; });
      h += '<div class="mdc-tbl stack" role="region" aria-label="Daftar DCP"><table><thead><tr><th>ID</th><th>Tanggal</th><th>Jenis</th><th>Film</th><th>Kode disk</th><th>Status</th><th>Kelengkapan</th></tr></thead><tbody>' +
        (list.length ? list.map(function (t) {
          return '<tr data-dcp-open="' + q(t.id) + '" tabindex="0"><td data-l="ID" class="mdc-mono">' + q(t.id) + (bc[t.batchId] > 1 ? ' <span class="mdc-st mdc-info" title="Satu laporan memuat ' + bc[t.batchId] + ' item">Multi-item (' + bc[t.batchId] + ')</span>' : '') + '</td><td data-l="Tanggal">' + q(t.tanggal) + ' ' + q(t.jam) + '</td><td data-l="Jenis">' + (t.jenis === 'KELUAR' ? 'Keluar' : 'Masuk') + '</td><td data-l="Film">' + q(t.film) + '</td><td data-l="Kode disk" class="mdc-mono">' + q(t.kodeDisk) + '</td><td data-l="Status">' + stDcp(t.status) + (t.jenis === 'KELUAR' && t.modul !== 'PEL' && !t.masukId ? ' <span class="mdc-st mdc-warn">Belum kembali</span>' : '') + '</td><td data-l="Kelengkapan">' + (t.incomplete ? st('bad', 'Tidak lengkap') : st('ok', 'Lengkap')) + '</td></tr>';
        }).join('') : '<tr><td colspan="7" class="mdc-empty">Belum ada data DCP.</td></tr>') +
        '</tbody></table></div>';
      v.innerHTML = h;
      bindDcp();
      mselDcp();
    }).catch(function (e) { v.innerHTML = '<div class="mdc-alert bad" role="alert">' + q(e.message) + '</div>'; });
  };
  /* Multi-Select Admin: hapus massal dan unduh terpilih */
  function mselDcp() {
    var host = document.querySelector('#view .mdc-tbl'), M = S.msel;
    if (!M || !host) return;
    M.mount({ key: 'dcp', admin: (curU() || {}).role === 'ADMIN', host: host, rows: 'tbody tr[data-dcp-open]', id: function (el) { return el.getAttribute('data-dcp-open'); },
      anchor: document.querySelector('#view .mdc-filter'), reload: function () { vDcp(); },
      actions: [
        { label: 'Unduh Excel', run: function (ids) { dcpExport('xlsx', ids); return false; } },
        { label: 'Unduh PDF', run: function (ids) { dcpExport('pdf', ids); return false; } },
        { label: 'Hapus', danger: true, run: function (ids) {
          if (!confirm('Hapus ' + ids.length + ' transaksi DCP beserta fotonya? Tindakan ini tidak dapat dibatalkan.')) return false;
          return M.seq(ids, function (id) { return api('dcp_del', { id: id, quiet: true }); }, 'Menghapus');
        } }
      ] });
  }
  function kpi(l, n, cls) { return '<div class="mdc-kpi ' + (cls || '') + '"><small>' + q(l) + '</small><b>' + (Number(n) || 0) + '</b></div>'; }
  /* riwayat satu kode disk: seluruh perjalanan DCP dari keluar sampai kembali, dibaca dari data DCP yang sudah ada */
  function riwayatDisk() {
    modal('<h3>Riwayat disk</h3><form id="rdf" class="mdc-form" novalidate><label>Kode disk<input name="kd" required maxlength="60" placeholder="mis. D-01"></label>' +
      '<div class="mdc-foot"><button type="button" class="btn sec" id="rdx">Tutup</button><button type="submit" class="btn">Tampilkan</button></div></form><div id="rdout"></div>');
    $('rdx').onclick = closeM;
    $('rdf').onsubmit = function (e) {
      e.preventDefault();
      var kd = e.target.kd.value.trim();
      if (!kd) return;
      api('dcp_list', { q: kd, quiet: true }).then(function (list) {
        var rows = (list || []).filter(function (r) { return String(r.kodeDisk) === kd; }).sort(function (a, b) {
          return (String(a.tanggal) + ' ' + String(a.jam)).localeCompare(String(b.tanggal) + ' ' + String(b.jam));
        });
        var out = $('rdout');
        if (!rows.length) { out.innerHTML = '<p class="mdc-note">Belum ada riwayat untuk kode disk ini.</p>'; return; }
        var last = rows[rows.length - 1];
        var posisi = (last.jenis === 'KELUAR' && last.modul !== 'PEL' && !last.masukId) ? 'Sedang keluar ke ' + (last.tujuan || '-') + ' (belum kembali)' : 'Berada di gudang / sudah kembali';
        out.innerHTML = '<p><b>Posisi terakhir:</b> ' + q(posisi) + '</p><div class="mdc-tbl"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Film</th><th>Tujuan / Asal</th><th>Status</th></tr></thead><tbody>' +
          rows.map(function (r) {
            var stat = r.jenis === 'KELUAR' && r.modul !== 'PEL' ? (r.masukId ? st('ok', 'Kembali') : st('bad', 'Belum kembali')) : st('ok', 'Kembali');
            return '<tr><td>' + q(r.tanggal) + ' ' + q(r.jam) + '</td><td>' + (r.jenis === 'KELUAR' ? 'Keluar' : 'Masuk') + '</td><td>' + q(r.film) + '</td><td>' + q(r.tujuan || '-') + '</td><td>' + stat + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }).catch(function (er) { $('rdout').innerHTML = '<p class="mdc-err">' + q(er.message) + '</p>'; });
    };
  }

  function bindDcp() {
    var t;
    if ($('dcprh')) $('dcprh').onclick = riwayatDisk;
    $('dcpq').oninput = function (e) { DST.q = e.target.value; clearTimeout(t); t = setTimeout(vDcp, 350); };
    $('dcpj').onchange = function (e) { DST.jenis = e.target.value; vDcp(); };
    $('dcps').onchange = function (e) { DST.status = e.target.value; vDcp(); };
    if ($('dcpnew')) $('dcpnew').onclick = function () { var c = document.querySelector('input[name=dcpjt]:checked'); dcpForm(c ? c.value : 'KELUAR', null); };
    $('dcpxl').onclick = function () { dcpExport('xlsx'); };
    $('dcppdf').onclick = function () { dcpExport('pdf'); };
    if ($('dcpadm')) $('dcpadm').onclick = function () { permAdmin(); };
    document.querySelectorAll('[data-dcp-open]').forEach(function (r) {
      r.onclick = function () { dcpDetail(r.dataset.dcpOpen); };
      r.onkeydown = function (e) { if (e.key === 'Enter') dcpDetail(r.dataset.dcpOpen); };
    });
  }

  /* ---------- muat foto DCP: skeleton saat memuat, 3 permintaan paralel (6 foto per permintaan), coba ulang otomatis
     2x, gambar pengganti + ketuk-untuk-ulang bila tetap gagal. Cache memori: membuka ulang detail langsung tampil.
     Server juga menyimpan thumbnail di CacheService, jadi pembukaan kedua tidak lagi menyentuh Drive.
     shortcut: cache hanya di memori halaman (tidak ada Cache Storage, agar foto tidak tertinggal di perangkat bersama), upgrade bila perlu offline. */
  var PHC = { t: {}, f: {} }, INF = {}, POOL = 0, PQ = [];
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  var ERRIMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="#ece9f6"/><text x="80" y="56" font-size="12" text-anchor="middle" fill="#5b5670" font-family="sans-serif">Foto gagal dimuat</text><text x="80" y="76" font-size="12" font-weight="bold" text-anchor="middle" fill="#6246d9" font-family="sans-serif">Ketuk untuk coba lagi</text></svg>');
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function pump() { while (POOL < 3 && PQ.length) { POOL++; PQ.shift()().then(fin, fin); } }
  function fin() { POOL--; pump(); }
  function thumbReady(img, url) { img.src = url; img.dataset.ok = '1'; delete img.dataset.err; img.classList.remove('ph-wait'); }
  function thumbFail(img) { img.classList.remove('ph-wait'); img.src = ERRIMG; img.dataset.err = '1'; delete img.dataset.ok; img.title = 'Ketuk untuk coba lagi'; }
  function thumbWait(img) { img.classList.add('ph-wait'); delete img.dataset.err; img.removeAttribute('title'); img.src = BLANK; }
  function fetchChunk(chunk, tries) {
    chunk = chunk.filter(function (i) { return document.body.contains(i); });
    if (!chunk.length) return Promise.resolve();
    return api('dcp_photo_batch', { ids: chunk.map(function (x) { return x.dataset.fid; }), thumb: true, quiet: true }).then(function (r) {
      var by = {}, again = [];
      ((r && r.items) || []).forEach(function (it) { by[it.fotoId] = it; });
      chunk.forEach(function (img) {
        var it = by[img.dataset.fid];
        if (it && it.url) { (it.thumb ? PHC.t : PHC.f)[it.fotoId] = it.url; if (!it.thumb) PHC.t[it.fotoId] = it.url; thumbReady(img, it.url); }
        else if (it && it.error && !/dimuat/.test(it.error)) { thumbFail(img); img.alt = it.error; } /* galat tetap (tidak ditemukan / tanpa izin): jangan diulang */
        else again.push(img);
      });
      if (again.length) return tries < 2 ? delay(1200 * (tries + 1)).then(function () { return fetchChunk(again, tries + 1); }) : again.forEach(thumbFail);
    }, function () {
      return tries < 2 ? delay(1200 * (tries + 1)).then(function () { return fetchChunk(chunk, tries + 1); }) : chunk.forEach(thumbFail);
    });
  }
  function loadThumbs(root) {
    var imgs = [].slice.call((root || document).querySelectorAll('img[data-fid][data-th]')), need = [];
    imgs.forEach(function (img) {
      var id = img.dataset.fid;
      img.onclick = function () {
        if (img.dataset.err) { thumbWait(img); PQ.push(function () { return fetchChunk([img], 0); }); pump(); return; }
        openFull(img);
      };
      if (PHC.t[id] || PHC.f[id]) thumbReady(img, PHC.t[id] || PHC.f[id]); else { thumbWait(img); need.push(img); }
    });
    for (var i = 0; i < need.length; i += 6) (function (chunk) { PQ.push(function () { return fetchChunk(chunk, 0); }); })(need.slice(i, i + 6));
    pump();
  }
  /* Detail DCP/Testing: foto DCP lewat jalur thumbnail+cache yang sama; foto Testing satu per satu dengan skeleton dan coba ulang */
  function loadFt(img, t) {
    t = t || 0;
    if (!document.body.contains(img)) return;
    thumbWait(img);
    api('ft_photo_get', { fotoId: img.dataset.fid, quiet: true }).then(function (r) { thumbReady(img, r.url); },
      function () { if (t < 2) delay(1200 * (t + 1)).then(function () { loadFt(img, t + 1); }); else thumbFail(img); });
  }
  function loadPhotos() {
    var ft = [];
    document.querySelectorAll('img[data-fid]').forEach(function (img) { if (img.dataset.fk === 'ft') ft.push(img); else img.dataset.th = '1'; });
    loadThumbs(document);
    ft.forEach(function (img) {
      img.onclick = function () { if (img.dataset.err) loadFt(img, 0); else if (img.dataset.ok) S.lightbox(img.src); };
      loadFt(img, 0);
    });
  }
  /* Foto ukuran penuh (file asli): satu permintaan per foto, tidak ganda, disimpan di memori. Lightbox langsung terbuka
     dengan thumbnail yang sudah tampil, lalu diganti file asli begitu selesai diunduh. */
  function fetchFull(id) {
    if (PHC.f[id]) return Promise.resolve(PHC.f[id]);
    if (INF[id]) return INF[id];
    INF[id] = api('dcp_photo_get', { fotoId: id, quiet: true }).then(function (r) { PHC.f[id] = r.url; delete INF[id]; return r.url; },
      function (e) { delete INF[id]; throw e; });
    return INF[id];
  }
  function openFull(img) {
    var id = img.dataset.fid;
    if (!img.dataset.ok) return;
    if (PHC.f[id]) { S.lightbox(PHC.f[id]); return; }
    var lb = S.lightbox(img.src, { note: 'Memuat resolusi penuh...' });
    fetchFull(id).then(function (u) { lb.set(u); }).catch(function (e) { lb.fail((e && e.message) || 'Foto tidak dapat dimuat.'); });
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

  /* ---------- unduh Excel & PDF: elemen dan pola sama dengan laporan lain (menu Download) ---------- */
  function dlMenu(k, label) {
    return '<div class="dlw"><button type="button" class="btn sec" data-dlt aria-haspopup="menu" aria-expanded="false">' + q(label || 'Download') + '</button>' +
      '<div class="dlm hidden" role="menu"><button type="button" role="menuitem" id="' + k + 'xl">Excel (.xlsx)</button>' +
      '<button type="button" role="menuitem" id="' + k + 'pdf">PDF (.pdf)</button></div></div>';
  }
  function sv(v) { return v == null ? '' : String(v); }
  function needLib(pdf) {
    var ok = pdf ? !!(window.jspdf && window.jspdf.jsPDF) : typeof XLSX !== 'undefined';
    if (!ok) toast('Library ' + (pdf ? 'PDF' : 'Excel') + ' belum termuat. Periksa koneksi internet lalu muat ulang halaman.', 1);
    return ok;
  }
  /* Ekspor generik. tables: [{title, head, rows, sheet?, fs?, colStyles?}]; extra: {id, orient, photos:[{title,list}], user}
     PDF: header logo XXI+NOVA, footer identitas MK dan "Halaman k / n" di setiap halaman (pdfkit.js).
     Excel: satu lembar; bila ada tabel dengan `sheet`, tiap tabel itu menjadi lembar sendiri (data tidak tercampur). */
  function uname() { var u = curU() || {}; return u.name || u.fullName || u.username || ''; }
  function sheetName(n, used) {
    var b = String(n || 'Sheet').replace(/[\\\/\?\*\[\]:]/g, ' ').trim().slice(0, 28) || 'Sheet', x = b, k = 2;
    while (used[x.toLowerCase()]) { x = b.slice(0, 25) + ' ' + k++; }
    used[x.toLowerCase()] = 1; return x;
  }
  function recSave(title, pairs, tables, fmt, file, extra) {
    var pdf = fmt === 'pdf', ex = extra || {};
    if (!needLib(pdf)) return;
    if (pdf && !window.NovaPDF) { toast('Modul PDF belum termuat. Muat ulang halaman.', 1); return; }
    pairs = (pairs || []).map(function (p) { return [sv(p[0]), sv(p[1])]; });
    if (pdf) {
      var wide = ex.orient ? ex.orient === 'landscape' : tables.some(function (t) { return t.head.length > 6; });
      var blocks = [];
      if (pairs.length) blocks.push({ t: 'pairs', rows: pairs });
      tables.forEach(function (t) {
        var fs = t.fs || (wide ? (t.head.length > 10 ? 7 : 7.8) : 8.5);
        blocks.push({ t: 'table', title: t.title, head: t.head, rows: t.rows, fs: fs, colStyles: t.colStyles, foot: t.foot });
      });
      (ex.photos || []).forEach(function (ph) { blocks.push({ t: 'photos', title: ph.title, list: ph.list }); });
      var doc = window.NovaPDF.render({ title: title, id: ex.id || '', user: uname(), orient: wide ? 'landscape' : 'portrait', blocks: blocks });
      doc.save(file + '.pdf');
    } else {
      var used = {}, wb = XLSX.utils.book_new(), main = [[title + ' - NOVA'], ['NOVA \u2014 An Innovation by MK | Designed & Developed by MK'], []].concat(pairs, [[]]);
      var sep = [], mh = [];
      tables.forEach(function (t) {
        if (t.sheet) { sep.push(t); return; }
        mh.push({ r: main.length + (t.title ? 1 : 0) + 1, n: t.rows.length, cols: t.head.length });
        main = main.concat(t.title ? [[t.title]] : [], [t.head], t.rows, [[]]);
      });
      var ws = XLSX.utils.aoa_to_sheet(main);
      ws['!cols'] = Array.apply(null, Array(main.reduce(function (n, r) { return Math.max(n, r.length); }, 1))).map(function (_, ci) { var m = 10; main.forEach(function (r, ri) { if (ri > 2) m = Math.max(m, Math.min(48, String(r[ci] == null ? '' : r[ci]).length + 2)); }); return { wch: m }; });
      XLSX.utils.book_append_sheet(wb, ws, sheetName(ex.mainSheet || 'Laporan', used));
      sep.forEach(function (t) {
        var s2 = XLSX.utils.aoa_to_sheet([[t.title || t.sheet], []].concat([t.head], t.rows));
        s2['!cols'] = t.head.map(function (h, ci) { var m = String(h).length; t.rows.forEach(function (r) { m = Math.max(m, Math.min(48, String(r[ci] == null ? '' : r[ci]).length)); }); return { wch: Math.max(10, m + 2) }; });
        XLSX.utils.book_append_sheet(wb, s2, sheetName(t.sheet, used));
      });
      var plain = function () { XLSX.writeFile(wb, file + '.xlsx'); };
      var ph = [].concat.apply([], (ex.photos || []).map(function (g) { return g.list.map(function (x) { return { t: g.title, x: x }; }); }));
      if (!window.ExcelJS) { plain(); return; }
      /* dengan ExcelJS: header berwarna, garis tabel, teks membungkus, halaman cetak A4 muat 1 lembar lebar, judul tabel berulang, footer halaman; foto di lembar "Foto Dokumentasi" (rasio asli). Gagal -> unduh polos. */
      try {
        var e = new ExcelJS.Workbook(), last = '';
        var thin = { style: 'thin', color: { argb: 'FFD9D4EA' } }, bd = { top: thin, left: thin, bottom: thin, right: thin };
        var decor = function (w, heads, single) {
          var wide = heads.some(function (h) { return h.cols > 6; });
          heads.forEach(function (h) {
            for (var c = 1; c <= h.cols; c++) {
              var hc = w.getCell(h.r, c); hc.font = { bold: true, color: { argb: 'FFFFFFFF' } }; hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF25164F' } }; hc.alignment = { vertical: 'middle', wrapText: true }; hc.border = bd;
              for (var r = 1; r <= h.n; r++) { var bc = w.getCell(h.r + r, c); bc.alignment = { vertical: 'top', wrapText: true }; bc.border = bd; if (r % 2 === 0) bc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF9FD' } }; }
            }
          });
          w.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF25164F' } };
          w.pageSetup = { paperSize: 9, orientation: wide ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } };
          if (single && heads.length === 1) w.pageSetup.printTitlesRow = heads[0].r + ':' + heads[0].r;
          w.headerFooter = { oddFooter: '&L&8NOVA - An Innovation by MK&R&8Halaman &P / &N' };
        };
        e.xlsx.load(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })).then(function () {
          decor(e.worksheets[0], mh, true);
          sep.forEach(function (t, k) { var w = e.worksheets[k + 1]; if (w) { decor(w, [{ r: 3, n: t.rows.length, cols: t.head.length }], true); w.views = [{ state: 'frozen', ySplit: 3 }]; } });
          if (ph.length) {
            var w2 = e.addWorksheet('Foto Dokumentasi'), row = 1; w2.columns = [{ width: 36 }, { width: 100 }];
            w2.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
            ph.forEach(function (o, i) {
              if (o.t !== last) { w2.getCell(row, 1).value = o.t; w2.getCell(row, 1).font = { bold: true, size: 12 }; row++; last = o.t; }
              var k = Math.min(1, 640 / o.x.w, 480 / o.x.h), W = Math.round(o.x.w * k), Hh = Math.round(o.x.h * k);
              w2.getCell(row, 1).value = (i + 1) + '. ' + (o.x.caption || 'Foto'); w2.getCell(row, 1).alignment = { vertical: 'top', wrapText: true };
              w2.addImage(e.addImage({ base64: o.x.data.split(',')[1], extension: 'jpeg' }), { tl: { col: 1, row: row - 1 }, ext: { width: W, height: Hh } });
              row += Math.ceil(Hh / 20) + 1;
            });
          }
          return e.xlsx.writeBuffer();
        }).then(function (b) {
          var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([b], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = file + '.xlsx';
          document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        }).catch(function () { toast('Format Excel lanjutan gagal; mengunduh versi polos.', 1); plain(); });
      } catch (er) { plain(); }
    }
  }
  /* ambil foto (data URL) untuk sekumpulan transaksi -> [{title, list:[{data,w,h,caption}]}]; gagal dimuat dilewati */
  function collectPhotos(entries, getKind) {
    var out = [], gagal = 0;
    function get1(p, t) { return api(getKind, { fotoId: p.fotoId, quiet: true }).catch(function (e) { return t < 1 ? delay(800).then(function () { return get1(p, t + 1); }) : Promise.reject(e); }); }
    function one(p, en) {
      return get1(p, 0).then(function (r) { return window.NovaPDF.loadPhoto(r.url, p.kind || 'Foto'); }).then(function (x) { if (!x) gagal++; return x; }, function () { gagal++; return null; });
    }
    return entries.reduce(function (chain, en) {
      return chain.then(function () {
        var fl = (en.foto || []).slice(0, 12), res = [];
        function run(i) { /* 3 foto sekaligus */
          if (i >= fl.length) return Promise.resolve();
          return Promise.all(fl.slice(i, i + 3).map(function (p) { return one(p, en); })).then(function (l) { res = res.concat(l); return run(i + 3); });
        }
        return run(0).then(function () {
          var list = res.filter(Boolean);
          if (list.length) out.push({ title: en.title || ('Foto dokumentasi - ' + en.label), list: list });
        });
      });
    }, Promise.resolve()).then(function () { if (gagal) toast(gagal + ' foto gagal dimuat dan tidak masuk PDF. Coba unduh ulang.', 1); return out; });
  }
  function dcpExport(fmt, ids) {
    api('dcp_list', { q: DST.q, jenis: DST.jenis, status: DST.status }).then(function (rows) {
      if (ids) rows = rows.filter(function (r) { return ids.indexOf(r.id) >= 0; });
      if (!rows.length) { toast('Tidak ada data untuk diunduh.', 1); return; }
      var head = ['ID', 'Jenis', 'Tanggal', 'Jam', 'Film', 'Kode disk', 'PH', 'Format', 'Status', 'Kelengkapan', 'Penyerah', 'Penerima', 'Tujuan', 'No. resi', 'Tgl kirim'];
      var body = rows.map(function (x) {
        return [x.id, x.jenis === 'KELUAR' ? 'Keluar' : 'Masuk', x.tanggal, x.jam, x.film, x.kodeDisk, x.ph, x.format, x.status, x.incomplete ? 'Belum lengkap' : 'Lengkap', x.penyerah, x.penerima, x.tujuan, x.noResi || '', x.tglKirim || ''].map(sv);
      });
      recSave('Laporan DCP Management', [['Jumlah laporan', rows.length], ['Tanggal cetak', jkt()]], [{ head: head, rows: body }], fmt, 'Laporan_DCP_STCXXI_' + jkt());
    }).catch(function (e) { toast(e.message, 1); });
  }
  /* Laporan gabungan Daily Film Testing: SEMUA laporan yang tampil (sesuai filter) dalam SATU berkas.
     Rekap per studio di awal, lalu satu tabel harian (tanggal, laporan, studio) — tidak dipecah per studio. */
  function ftExport(fmt) {
    var V = FT_VIEW;
    if (!V) { toast('Buka halaman Film Testing terlebih dahulu.', 1); return; }
    var reps = V.reports || [];
    if (!reps.length) { toast('Tidak ada data untuk diunduh pada filter yang dipilih.', 1); return; }
    var latest = [], nFoto = 0, nRows = 0;
    reps.forEach(function (rp) { rp.shown.forEach(function (e) { latest.push(e.latest); e.chain.forEach(function (x) { nFoto += x.fotoCount || 0; nRows++; }); }); });
    var tot = ftStat(latest);
    var per = FST.from || FST.to ? (FST.from || 'awal') + ' s.d. ' + (FST.to || 'sekarang') : 'Semua tanggal';
    var pairs = [['Studio dalam laporan', V.sel.map(function (z) { return 'Studio ' + z; }).join(', ')], ['Jumlah studio', V.sel.length], ['Periode', per], ['Filter status', FST.status || 'Semua'], ['Jumlah laporan', reps.length], ['Total hasil studio', latest.length], ['Total foto dokumentasi', nFoto + (fmt === 'pdf' ? '' : ' (foto ada di PDF; Excel memuat jumlah dan keterangan)')], ['Tanggal cetak', jkt()]];
    var tables = [{
      title: 'Rekap gabungan per studio', head: ['Studio', 'Total', 'PASSED', 'FAILED', 'RETEST', 'Hari ini'],
      rows: V.sel.map(function (z) { var l = []; reps.forEach(function (rp) { rp.shown.forEach(function (e) { if (e.z === z) l.push(e.latest); }); }); var o = ftStat(l); return ['Studio ' + z, o.n, o.passed, o.failed, o.retest, o.hari].map(sv); }),
      foot: ['Total', tot.n, tot.passed, tot.failed, tot.retest, tot.hari].map(sv), fs: 9
    }];
    var rows = [];
    reps.forEach(function (rp) {
      rp.shown.forEach(function (e) {
        e.chain.forEach(function (x) {
          rows.push([x.tanggal + ' ' + x.jam, rp.id, 'Studio ' + x.studio, x.id + (x.parentId ? ' (retest)' : ''), x.film, x.format, x.server, x.projector, x.tester, x.status, ftTemuan(x, V.items) || '-', x.fotoCount || 0, x.ketDok || '-'].map(sv));
        });
      });
    });
    tables.push({ title: 'Laporan harian - ' + reps.length + ' laporan, ' + nRows + ' hasil studio', head: ['Tanggal', 'Laporan', 'Studio', 'ID studio', 'Film', 'Format', 'Server', 'Proyektor', 'Tester', 'Hasil', 'Temuan / masalah', 'Foto', 'Keterangan dokumentasi'], rows: rows, colStyles: { 10: { cellWidth: 48 }, 12: { cellWidth: 40 } }, fs: 7 });
    var go = function (ph) { recSave('Laporan Gabungan Daily Film Testing', pairs, tables, fmt, 'Laporan_Testing_Gabungan_' + reps.length + 'Laporan_' + jkt(), { id: reps.length + ' laporan', orient: 'landscape', mainSheet: 'Rekap', photos: ph || [] }); };
    if (fmt === 'pdf' && nFoto && window.NovaPDF) {
      /* foto mengikuti laporan lalu studio; satu panggilan ft_report_get per laporan yang punya foto */
      toast('Menyiapkan PDF: mengambil foto per laporan...');
      var ens = [], withFoto = reps.filter(function (rp) { return rp.shown.some(function (e) { return e.chain.some(function (x) { return x.fotoCount; }); }); });
      withFoto.reduce(function (p, rp) {
        return p.then(function () {
          return api('ft_report_get', { id: rp.id, quiet: true }).then(function (d) {
            rp.shown.forEach(function (e) {
              var fl = []; e.chain.forEach(function (x) { fl = fl.concat((d.foto || {})[x.id] || []); });
              if (fl.length) ens.push({ foto: fl, title: 'Dokumentasi Studio ' + e.z + ' - ' + e.latest.film + ' (' + rp.tanggal + ')', label: 'Studio ' + e.z + ' - ' + e.latest.film + (e.latest.ketDok ? ' (' + e.latest.ketDok + ')' : '') });
            });
          }).catch(function () {});
        });
      }, Promise.resolve()).then(function () { return collectPhotos(ens, 'ft_photo_get'); }).then(go).catch(function () { go([]); });
    } else go([]);
  }
  function dcpOneExport(x, fmt, foto) {
    var jn = x.jenis === 'KELUAR' ? 'DCP Keluar' : 'DCP Masuk';
    var pairs = [['ID', x.id], ['Jenis', jn], ['Tanggal', x.tanggal + ' ' + x.jam], ['Film', x.film], ['Kode disk', x.kodeDisk], ['PH', x.ph], ['Format', x.format || '-'], ['Penyerah', x.penyerah], ['Penerima', x.penerima], ['Tujuan / asal', x.tujuan], ['Status', x.status], ['Keterangan', x.keterangan || '-'], ['Diverifikasi', x.verifiedAt ? (x.verifiedBy || '-') : 'Belum']];
    var tables = [{ title: 'Kelengkapan', head: ['Komponen', 'Status', 'Keterangan'], rows: (x.kelengkapan || []).map(function (k) { return [k.name, k.status, k.note || '-'].map(sv); }) }];
    var done = function (ph) { recSave(jn + ' ' + x.id, pairs, tables, fmt, 'DCP_' + x.id, { id: x.id, orient: 'portrait', photos: ph || [] }); };
    if ((fmt === 'pdf' || window.ExcelJS) && foto && foto.length && window.NovaPDF) {
      toast('Menyiapkan PDF dan foto...');
      collectPhotos([{ foto: foto, label: x.id }], 'dcp_photo_get').then(done).catch(function () { done([]); });
    } else done([]);
  }
  /* Laporan DCP lengkap: SEMUA item satu laporan (batch) dalam satu PDF/Excel, termasuk kelengkapan & foto tiap item */
  function dcpBatchExport(items, fmt) {
    if (!items.length) return;
    var f = items[0], jn = f.jenis === 'KELUAR' ? 'DCP Keluar' : 'DCP Masuk';
    var tg = items.map(function (r) { return r.tanggal + ' ' + r.jam; }).sort();
    var pairs = [['Jenis laporan', jn], ['Tanggal', tg[0] + (tg[tg.length - 1] !== tg[0] ? ' s.d. ' + tg[tg.length - 1] : '')], ['Jumlah item', items.length], ['Kode laporan (batch)', f.batchId || f.id], ['Dicetak oleh', uname()]];
    var summary = { title: 'Ringkasan item', sheet: '', head: ['No', 'ID', 'Judul film', 'Kode disk', 'PH', 'Format', 'Status', 'Penyerah', 'Penerima', 'Tujuan / asal', 'Kelengkapan'],
      rows: items.map(function (r, i) { return [i + 1, r.id, r.film, r.kodeDisk, r.ph, r.format || '-', r.status, r.penyerah, r.penerima, r.tujuan, kelOk(r.kelengkapan) ? 'Lengkap' : 'Belum lengkap'].map(sv); }) };
    delete summary.sheet;
    var tables = [summary];
    items.forEach(function (r, i) {
      var rows = (r.kelengkapan || []).map(function (k) { return [k.name, k.status, k.note || '-'].map(sv); });
      if (r.keterangan) rows.push(['Keterangan item', '', r.keterangan].map(sv));
      tables.push({ title: 'Item ' + (i + 1) + ': ' + r.film + ' (' + r.kodeDisk + ') - kelengkapan', sheet: 'Item ' + (i + 1) + ' ' + r.kodeDisk, head: ['Komponen', 'Status', 'Keterangan'], rows: rows });
    });
    var file = 'Laporan_DCP_' + (f.jenis === 'KELUAR' ? 'Keluar' : 'Masuk') + '_' + items.length + 'item_' + jkt();
    var go = function (ph) { recSave('Laporan ' + jn + ' - ' + items.length + ' item', pairs, tables, fmt, file, { id: f.batchId || f.id, orient: 'landscape', photos: ph || [], mainSheet: 'Ringkasan' }); };
    if ((fmt === 'pdf' || window.ExcelJS) && window.NovaPDF) {
      toast('Menyiapkan ' + (fmt === 'pdf' ? 'PDF' : 'Excel') + ': mengambil foto semua item...');
      Promise.all(items.map(function (r) { return api('dcp_get', { id: r.id, quiet: true }).then(function (d) { return { foto: d.foto || [], label: r.id + ' ' + r.film }; }).catch(function () { return { foto: [], label: r.id }; }); }))
        .then(function (en) { return collectPhotos(en, 'dcp_photo_get'); }).then(go).catch(function () { go([]); });
    } else go([]);
  }
  function byId(a, b) { return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0; }
  /* panel "Item DCP dalam laporan ini": lihat, tambah, ubah, hapus tiap item + unduh laporan lengkap */
  function renderBatch(host, x) {
    if (!host) return;
    var load = x.batchId ? api('dcp_list', { q: '', quiet: true }).then(function (l) {
      var o = (l || []).filter(function (r) { return r.batchId === x.batchId; });
      if (!o.some(function (r) { return r.id === x.id; })) o.push(x);
      return o.sort(byId);
    }) : Promise.resolve([x]);
    load.then(function (items) {
      var h = '<h3>Item DCP dalam laporan ini (' + items.length + ')</h3><div class="mdc-tbl stack" role="region" aria-label="Item DCP"><table><thead><tr><th>No</th><th>Judul film</th><th>Kode disk</th><th>Format</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
        items.map(function (r, i) {
          return '<tr class="' + (r.id === x.id ? 'mi-cur' : '') + '"><td data-l="No">' + (i + 1) + '</td><td data-l="Judul film"><b>' + q(r.film) + '</b><small class="mdc-mono"> ' + q(r.id) + '</small></td><td data-l="Kode disk" class="mdc-mono">' + q(r.kodeDisk) + '</td><td data-l="Format">' + q(r.format || '-') + '</td><td data-l="Status">' + stDcp(r.status) + '</td><td data-l="Aksi" class="mi-acts">' +
            (r.id === x.id ? '<span class="mdc-st mdc-info">Sedang dibuka</span>' : '<button type="button" class="btn sec" data-mi-open="' + q(r.id) + '">Buka</button>') +
            (canWrite() ? '<button type="button" class="btn sec" data-mi-edit="' + q(r.id) + '">Ubah</button>' : '') +
            (canDel() ? '<button type="button" class="btn danger" data-mi-del="' + q(r.id) + '">Hapus</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="mdc-foot mi-bfoot">' + (canWrite() ? '<button type="button" class="btn sec" id="mi-add2">+ Tambah item ke laporan ini</button>' : '') + (can('pdf') ? dlMenu('mib', 'Download laporan lengkap') : '') + '</div>';
      host.innerHTML = h;
      var by = {}; items.forEach(function (r) { by[r.id] = r; });
      [].forEach.call(host.querySelectorAll('[data-mi-open]'), function (b) { b.onclick = function () { dcpDetail(b.getAttribute('data-mi-open')); }; });
      [].forEach.call(host.querySelectorAll('[data-mi-edit]'), function (b) { b.onclick = function () { editRow(by[b.getAttribute('data-mi-edit')]); }; });
      [].forEach.call(host.querySelectorAll('[data-mi-del]'), function (b) {
        b.onclick = function () {
          var r = by[b.getAttribute('data-mi-del')];
          if (!confirm('Hapus item ' + r.id + ' (' + r.film + ', ' + r.kodeDisk + ') dari laporan ini? Foto item ini ikut dihapus.')) return;
          b.disabled = true;
          api('dcp_del', { id: r.id }).then(function () {
            toast('Item dihapus'); vDcp();
            if (r.id === x.id) { var rest = items.filter(function (z) { return z.id !== r.id; }); if (rest.length) dcpDetail(rest[0].id); else closeM(); }
            else renderBatch(host, x);
          }).catch(function (e) { b.disabled = false; toast(e.message, 1); });
        };
      });
      if ($('mi-add2')) $('mi-add2').onclick = function () {
        var bid = x.batchId || S.mi.uid(), btn = this; btn.disabled = true;
        /* laporan tunggal lama diikat ke batch dulu (data lama tidak berubah selain batchId) */
        var pre = x.batchId ? Promise.resolve() : api('dcp_save', Object.assign({}, x, { batchId: bid }));
        pre.then(function () { dcpForm(x.jenis, null, null, { batchId: bid, seed: x }); }).catch(function (e) { btn.disabled = false; toast(e.message, 1); });
      };
      if ($('mibxl')) $('mibxl').onclick = function () { dcpBatchExport(items, 'xlsx'); };
      if ($('mibpdf')) $('mibpdf').onclick = function () { dcpBatchExport(items, 'pdf'); };
    }).catch(function () { host.innerHTML = ''; });
  }
  /* Unduh SATU laporan testing: semua studio di dalam satu berkas (ringkasan, checklist tiap studio, foto tiap studio) */
  function ftReportExport(rp, items, fmt, FOTO) {
    FOTO = FOTO || {};
    var nFoto = 0; rp.entries.forEach(function (e) { e.chain.forEach(function (x) { nFoto += (FOTO[x.id] || []).length; }); });
    var pairs = [['Laporan', rp.id], ['Kode laporan (batch)', rp.key], ['Tanggal', rp.tanggal + ' ' + rp.jam], ['Jumlah studio', rp.entries.length], ['Hasil gabungan', rp.status],
      ['Studio', rp.entries.map(function (e) { return 'Studio ' + e.z + ' (' + e.latest.status + ')'; }).join(', ')], ['Total foto dokumentasi', nFoto], ['Dicetak oleh', uname()]];
    var tables = [{ title: 'Ringkasan per studio', head: ['Studio', 'Film', 'Format', 'Server', 'Proyektor', 'Tester', 'Hasil', 'Temuan / masalah', 'Foto', 'Keterangan dokumentasi'],
      rows: rp.entries.map(function (e) { var L = e.latest; return ['Studio ' + e.z, L.film, L.format, L.server || '-', L.projector || '-', L.tester, L.status, ftTemuan(L, items) || '-', (FOTO[L.id] || []).length, L.ketDok || '-'].map(sv); }),
      colStyles: { 7: { cellWidth: 52 }, 9: { cellWidth: 40 } }, fs: 7.5 }];
    rp.entries.forEach(function (e) {
      var L = e.latest;
      var rows = (L.checklist || []).map(function (c) {
        var it = (items || []).filter(function (i) { return i.id === c.id; })[0];
        return [it ? it.label : c.id, c.val || '-', c.ket || '-'].map(sv);
      });
      [['Masalah', L.masalah], ['Tindakan', L.tindakan], ['Hasil ulang', L.hasilUlang], ['Catatan teknisi', L.catatanTeknisi]].forEach(function (p) { if (p[1]) rows.push([p[0], '', p[1]].map(sv)); });
      tables.push({ title: 'Studio ' + e.z + ' - ' + L.film + ' (' + L.status + ') - checklist', sheet: 'Studio ' + e.z, head: ['Item', 'Hasil', 'Keterangan'], rows: rows });
    });
    var done = function (ph) { recSave('Daily Film Testing ' + rp.id, pairs, tables, fmt, 'Testing_' + rp.id, { id: rp.id, orient: 'portrait', mainSheet: 'Ringkasan', photos: ph || [] }); };
    if (fmt === 'pdf' && nFoto && window.NovaPDF) {
      toast('Menyiapkan PDF dan foto per studio...');
      var ens = [];
      rp.entries.forEach(function (e) {
        var fl = []; e.chain.forEach(function (x) { fl = fl.concat(FOTO[x.id] || []); });
        if (fl.length) ens.push({ foto: fl, title: 'Dokumentasi Studio ' + e.z + ' - ' + e.latest.film, label: 'Studio ' + e.z + (e.latest.ketDok ? ' (' + e.latest.ketDok + ')' : '') });
      });
      collectPhotos(ens, 'ft_photo_get').then(done).catch(function () { done([]); });
    } else done([]);
  }

  function dcpDetail(id) {
    api('dcp_get', { id: id }).then(function (r) {
      var x = r.transaksi, kel = x.kelengkapan || [];
      var h = '<h2>' + (x.jenis === 'KELUAR' ? 'DCP Keluar' : 'DCP Masuk') + '</h2><p class="mdc-mono">' + q(x.id) + '</p>' +
        '<div class="mdc-grid"><div><small>Film</small><b>' + q(x.film) + '</b></div><div><small>Kode disk</small><b class="mdc-mono">' + q(x.kodeDisk) + '</b></div>' +
        '<div><small>Tanggal & jam</small><b>' + q(x.tanggal) + ' ' + q(x.jam) + '</b></div><div><small>Format</small><b>' + q(x.format || '-') + '</b></div>' +
        '<div><small>PH</small><b>' + q(x.ph) + '</b></div><div><small>Status</small>' + stDcp(x.status) + '</div>' +
        (x.noResi ? '<div><small>Kirim ke Kantor Pusat</small><b>Resi ' + q(x.noResi) + '</b> · ' + q(x.tglKirim || '-') + '</div>' : '') +
        '<div><small>' + (x.jenis === 'KELUAR' ? 'Penyerah / Penerima' : 'Penyerah / Penerima') + '</small><b>' + q(x.penyerah) + ' → ' + q(x.penerima) + '</b></div><div><small>Tujuan / asal</small><b>' + q(x.tujuan) + '</b></div></div>';
      h += '<h3>Kelengkapan</h3><ul class="mdc-chk">' + kel.map(function (c) {
        return '<li><span>' + q(c.name) + '</span>' + (c.status === 'Lengkap' ? st('ok', c.status) : c.status === 'Tidak Diperlukan' ? st('na', c.status) : st('bad', c.status)) + (c.note ? '<em>' + q(c.note) + '</em>' : '') + '</li>';
      }).join('') + '</ul>';
      if (x.keterangan) h += '<h3>Keterangan</h3><p>' + q(x.keterangan) + '</p>';
      h += '<div id="mi-sib" class="mi-sib" data-b="' + q(x.batchId || '') + '" data-id="' + q(x.id) + '"></div>';
      h += '<h3>Timeline</h3><ol class="mdc-tl"><li><b>Dibuat</b> oleh ' + q(x.createdBy || '-') + ' · ' + dt(x.createdAt) + '</li>' +
        (x.updatedAt && x.updatedAt !== x.createdAt ? '<li><b>Diubah</b> oleh ' + q(x.updatedBy || '-') + ' · ' + dt(x.updatedAt) + '</li>' : '') +
        (r.relasi ? '<li><b>Tertaut</b> dengan ' + (r.relasi.jenis === 'KELUAR' ? 'DCP Keluar' : 'DCP Masuk') + ' ' + q(r.relasi.id) + '</li>' : '') +
        (x.verifiedAt ? '<li><b>Diverifikasi</b> oleh ' + q(x.verifiedBy) + ' · ' + dt(x.verifiedAt) + '</li>' : '') +
        (x.jenis === 'KELUAR' && x.modul !== 'PEL' && !x.masukId ? '<li class="warn">Belum ada DCP Masuk</li>' : '') + '</ol>';
      h += '<h3>Foto (' + (r.foto || []).length + ')</h3><div class="mdc-ph">' + (r.foto || []).map(function (p) {
        return '<figure><img loading="lazy" data-fid="' + q(p.fotoId) + '" data-fk="dcp" alt="' + q(p.kind) + '"><figcaption>' + q(p.kind) + '</figcaption>' + (can('photo') ? '<button type="button" class="mdc-pdel" data-pdel="' + q(p.fotoId) + '" data-pk="dcp" data-id="' + q(x.id) + '" aria-label="Hapus foto ' + q(p.kind) + '">Hapus</button>' : '') + '</figure>';
      }).join('') + '</div>';
      if (canWrite()) h += '<div class="mdc-ph-up"><p class="mdc-note">Dokumentasi ' + (x.jenis === 'KELUAR' ? 'DCP Keluar' : 'DCP Masuk') + ': tambah foto dari galeri atau langsung dari kamera.</p><div class="pick"><label class="btn sec pk" for="dcpphg">Pilih dari galeri</label><label class="btn sec pk" for="dcpphc">Ambil dengan kamera</label></div><input class="vh" type="file" id="dcpphg" accept="image/jpeg,image/png,image/webp" multiple><input class="vh" type="file" id="dcpphc" accept="image/*" capture="environment"></div>';
      h += '<div class="mdc-foot">' + dlMenu('mdc') + (can('verify') && !x.verifiedAt ? '<button type="button" class="btn" id="dcpver">Verifikasi</button>' : '') + (canWrite() ? '<button type="button" class="btn sec" id="dcpedit">Ubah</button>' : '') +
        (x.jenis === 'KELUAR' && x.modul !== 'PEL' && !x.masukId && canWrite() ? '<button type="button" class="btn sec" id="dcpin">Catat DCP Masuk</button>' : '') +
        (canDel() ? '<button type="button" class="btn danger" id="dcpdel">Hapus</button>' : '') + '</div>';
      modal(h);
      bindPhotoDel();
      loadPhotos();
      renderBatch($('mi-sib'), x);
      if ($('mdcxl')) $('mdcxl').onclick = function () { dcpOneExport(x, 'xlsx', r.foto); };
      if ($('mdcpdf')) $('mdcpdf').onclick = function () { dcpOneExport(x, 'pdf', r.foto); };
      var kindPh = x.jenis === 'KELUAR' ? 'Foto DCP Keluar' : 'Foto DCP Masuk';
      ['dcpphg', 'dcpphc'].forEach(function (id) { if ($(id)) $(id).onchange = function (e) { var fl = Array.prototype.slice.call(e.target.files || []); e.target.value = ''; sendPhotos(x.id, fl, kindPh, 'dcp_photo_save', function () { dcpDetail(x.id); }); }; });
      if ($('dcpedit')) $('dcpedit').onclick = function () { editRow(x); };
      if ($('dcpver')) $('dcpver').onclick = function () { api('dcp_verify_save', { id: x.id }).then(function () { toast('DCP diverifikasi'); dcpDetail(x.id); }).catch(function (e) { toast(e.message, 1); }); };
      if ($('dcpin')) $('dcpin').onclick = function () { dcpForm('MASUK', null, x); };
      if ($('dcpdel')) $('dcpdel').onclick = function () {
        if (!confirm('Hapus DCP ' + x.id + '? Tindakan ini tidak dapat dibatalkan.')) return;
        api('dcp_del', { id: x.id }).then(function () { closeM(); toast('DCP dihapus'); vDcp(); }).catch(function (e) { toast(e.message, 1); });
      };
    }).catch(function (e) { toast(e.message, 1); });
  }

  /* satu sumber data: baris Pelaporan (modul PEL) diubah dengan formulir Pelaporan, baris Management dengan formulir ini */
  function editRow(r) { if (r.modul === 'PEL' && S.pelUI) S.pelUI.edit(r.id); else dcpForm(r.jenis, r); }
  function dcpForm(jenis, row, keluarRef, ctx) {
    getMeta().then(function (m) {
      var sd = ctx && ctx.seed ? ctx.seed : null;
      var x = row || (sd ? { tanggal: sd.tanggal, jam: sd.jam, penyerah: sd.penyerah, penerima: sd.penerima, tujuan: sd.tujuan, status: sd.status, format: sd.format } : {});
      var kel = (x.kelengkapan && x.kelengkapan.length) ? x.kelengkapan : KOMP_DEF.map(function (n) { return { name: n, status: 'Lengkap', note: '' }; });
      var lk = keluarRef || null;
      var h = '<h3>' + (row ? 'Ubah ' : (ctx && ctx.batchId ? 'Tambah item ke laporan: ' : '')) + (jenis === 'KELUAR' ? 'DCP Keluar' : 'DCP Masuk') + '</h3>' +
        (ctx && ctx.batchId ? '<p class="mdc-note">Item baru ini akan masuk ke laporan yang sama dengan item <b class="mdc-mono">' + q(sd ? sd.id : '') + '</b>. Anda bisa menambahkan beberapa item sekaligus di bawah.</p>' : '') +
        '<form id="dcpf" class="mdc-form" novalidate>' +
        '<div class="mdc-sec">Jadwal</div>' +
        '<div class="mdc-row"><label>Tanggal<input name="tanggal" type="date" required value="' + q(x.tanggal || jkt()) + '"></label>' +
        '<label>Jam<input name="jam" type="time" required value="' + q(x.jam || jam()) + '"></label></div>' +
        '<div class="mdc-sec">Film dan disk</div>' +
        '<label>Film<input name="film" required maxlength="200" value="' + q(x.film || (lk && lk.film) || '') + '"></label>' +
        '<div class="mdc-row"><label>Kode disk<input name="kodeDisk" required maxlength="60" value="' + q(x.kodeDisk || (lk && lk.kodeDisk) || '') + '"></label>' +
        '<label>Format<select name="format">' + FMT_DCP.map(function (f) { return '<option' + ((x.format || '') === f ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select></label></div>' +
        '<label>PH (Production House)<input name="ph" required maxlength="160" value="' + q(x.ph || '') + '"></label>' +
        '<div class="mdc-sec">Pihak</div>' +
        '<div class="mdc-row"><label>' + (jenis === 'KELUAR' ? 'Penyerah (Tim Teknikal)' : 'Penyerah (dari PH / Penerima)') + '<input name="penyerah" required maxlength="120" value="' + q(x.penyerah || '') + '"></label>' +
        '<label>' + (jenis === 'KELUAR' ? 'Penerima' : 'Penerima (Tim Teknikal)') + '<input name="penerima" required maxlength="120" value="' + q(x.penerima || '') + '"></label></div>' +
        '<label>' + (jenis === 'KELUAR' ? 'Tujuan' : 'Asal') + '<input name="tujuan" required maxlength="200" value="' + q(x.tujuan || '') + '"></label>' +
        '<fieldset class="mdc-fs"><legend>Kelengkapan</legend>' + KOMP_DEF.map(function (n, i) {
          var c = kel.filter(function (k) { return k.name === n; })[0] || { status: 'Lengkap', note: '' };
          var on = c.status === 'Lengkap' || c.status === 'Tidak Diperlukan';
          return '<div class="mdc-kr" data-k="' + i + '"><label class="mdc-cbx"><input type="checkbox" name="kc' + i + '" data-st="' + q(c.status) + '"' + (on ? ' checked' : '') + '> <span>' + q(n) + '</span></label>' +
            '<input name="kn' + i + '" maxlength="300" placeholder="Keterangan (wajib jika tidak dicentang)" value="' + q(c.note || '') + '" aria-label="Keterangan ' + q(n) + '"></div>';
        }).join('') + '</fieldset>' +
        '<div class="mdc-sec">Catatan dan foto</div>' +
        '<label>Keterangan umum<textarea name="keterangan" maxlength="2000" rows="2">' + q(x.keterangan || '') + '</textarea></label>' +
        '<label>Status<select name="status">' + STAT_DCP.map(function (s) { return '<option' + (((x.statusAsli || x.status || 'Diproses')) === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
        (row ? '' : '<div id="mi-host"></div>') + photoBox('dcp') +
        '<p class="mdc-err" id="dcperr" role="alert"></p>' +
        '<div class="mdc-foot"><button type="button" class="btn sec" id="dcpx">Batal</button><button type="submit" class="btn" id="dcpok">Simpan</button></div></form>';
      modal(h);
      var ph = photoBind('dcp');
      var MI = (!x.id && S.mi && $('mi-host')) ? S.mi.mount($('mi-host'), { mode: 'dcp' }) : null;
      $('dcpx').onclick = closeM;
      $('dcpf').onsubmit = function (e) {
        e.preventDefault();
        var f = e.target, p = {
          id: x.id || '', jenis: jenis, tanggal: f.tanggal.value, jam: f.jam.value, film: f.film.value.trim(), kodeDisk: f.kodeDisk.value.trim(),
          format: f.format.value, ph: f.ph.value.trim(), penyerah: f.penyerah.value.trim(), penerima: f.penerima.value.trim(), tujuan: f.tujuan.value.trim(),
          keterangan: f.keterangan.value.trim(), status: f.status.value,
          kelengkapan: KOMP_DEF.map(function (n, i) { var cb = f['kc' + i], orig = cb.getAttribute('data-st') || ''; var st = cb.checked ? (orig === 'Tidak Diperlukan' ? 'Tidak Diperlukan' : 'Lengkap') : (orig === 'Rusak' ? 'Rusak' : 'Tidak Ada'); return { name: n, status: st, note: f['kn' + i].value.trim() }; })
        };
        if (lk && lk.id && !x.id) p.relasiId = lk.id;
        var bad = p.kelengkapan.filter(function (c) { return (c.status === 'Tidak Ada' || c.status === 'Rusak') && !c.note; });
        var err = $('dcperr');
        if (bad.length) { err.textContent = 'Isi keterangan untuk: ' + bad.map(function (c) { return c.name; }).join(', ') + '.'; return; }
        if (!kelOk(p.kelengkapan) && !p.keterangan) { p.keterangan = p.kelengkapan.filter(function (c) { return c.status !== 'Lengkap' && c.status !== 'Tidak Diperlukan'; }).map(function (c) { return c.name + ': ' + c.note; }).join('; '); }
        var ex = MI ? MI.read() : { items: [] };
        if (ex.error) { err.textContent = ex.error; return; }
        var batch = (ctx && ctx.batchId) ? ctx.batchId : (ex.items.length ? S.mi.uid() : '');
        var items = [p].concat(ex.items.map(function (it) {
          return Object.assign({}, p, { id: '', film: it.film, kodeDisk: it.kodeDisk, format: it.format, ph: it.ph, keterangan: it.keterangan, kelengkapan: it.kelengkapan, relasiId: '', batchId: batch });
        }));
        if (batch) {
          p.batchId = batch;
          var seen = {}, dup = '';
          items.forEach(function (it, i) { var k = String(it.kodeDisk).toLowerCase(); if (seen[k] !== undefined && !dup) dup = 'Kode disk ' + it.kodeDisk + ' dipakai dua kali (item ' + (seen[k] + 1) + ' dan item ' + (i + 1) + ').'; seen[k] = i; });
          if (dup) { err.textContent = dup; return; }
        }
        err.textContent = '';
        $('dcpok').disabled = true;
        var norm = function (v) { return String(v || '').trim().toLowerCase(); };
        /* validasi tiap item terhadap data server sebelum ada yang disimpan */
        var check = function (it, first) {
          if (x.id) return Promise.resolve(it);
          return api('dcp_list', { q: it.kodeDisk, quiet: true }).then(function (list) {
            var open = (list || []).filter(function (r) { return r.jenis === 'KELUAR' && r.modul !== 'PEL' && String(r.kodeDisk) === it.kodeDisk && !r.masukId; });
            if (jenis === 'KELUAR') {
              if (open.length) throw new Error('Kode disk ' + it.kodeDisk + ' masih belum kembali (' + open[0].id + ', film ' + open[0].film + '). Catat DCP Masuk terlebih dahulu.');
              return it;
            }
            var cand = open.sort(function (a, b) { return (String(a.tanggal) + ' ' + String(a.jam)).localeCompare(String(b.tanggal) + ' ' + String(b.jam)); });
            var same = cand.filter(function (r) { return norm(r.film) === norm(it.film); });
            if (!cand.length) throw new Error('Tidak ada DCP Keluar yang belum kembali untuk kode disk ' + it.kodeDisk + '. Catat DCP Keluar terlebih dahulu.');
            if (!same.length) throw new Error('Judul film tidak sama dengan DCP Keluar yang terbuka untuk kode disk ' + it.kodeDisk + ' (' + cand[0].film + '). Judul dan kode disk harus sama.');
            var pick = (first && lk && lk.id) ? same.filter(function (r) { return r.id === lk.id; })[0] : same[0];
            if (!pick) throw new Error('DCP Keluar yang dipilih tidak cocok dengan judul dan kode disk ini.');
            it.relasiId = pick.id; return it;
          });
        };
        var seq = function (arr, fn) { return arr.reduce(function (pr, it, i) { return pr.then(function () { return fn(it, i); }); }, Promise.resolve()); };
        seq(items, function (it, i) { return check(it, i === 0).catch(function (er) { throw new Error(items.length > 1 ? 'Item ' + (i + 1) + ': ' + er.message : er.message); }); })
          .then(function () {
            /* satu item: dcp_save; banyak item: dcp_batch_save (atomik di server — semua tersimpan atau tidak sama sekali) */
            if (items.length === 1) return api('dcp_save', items[0]).then(function (id) { return [id]; });
            return api('dcp_batch_save', { kind: 'dcp', batchId: batch, items: items }).then(function (r) { return r.ids; });
          })
          .then(function (ids) {
            var pf = ph.get(), id = ids[0];
            closeM(); toast(ids.length > 1 ? ids.length + ' item DCP tersimpan dalam satu laporan' : (x.id ? 'DCP diperbarui' : 'DCP tersimpan')); vDcp();
            if (pf && pf.length) sendPhotos(id, pf, jenis === 'KELUAR' ? 'Foto DCP Keluar' : 'Foto DCP Masuk', 'dcp_photo_save', function () { dcpDetail(id); });
            else dcpDetail(id);
          })
          .catch(function (er) { $('dcpok').disabled = false; err.textContent = er.message; });
      };
    });
  }


  /* ---------- panel Admin: izin per Teknisi & pengingat harian ---------- */
  var PERM_KEYS = [['view', 'Lihat'], ['create', 'Buat'], ['edit', 'Ubah'], ['delete', 'Hapus'], ['verify', 'Verifikasi'], ['photo', 'Foto'], ['pdf', 'Cetak/PDF']];
  function permAdmin() {
    Promise.all([api('usr_list'), api('perm_list', { quiet: true })]).then(function (r) {
      var users = (r[0] || []).filter(function (x) { return x.role === 'USER'; });
      var cur = {}; (r[1] || []).forEach(function (p) { cur[p.userId] = p.perms || []; });
      var h = '<h3 class="mdc-sec">Izin modul DCP &amp; Testing</h3><p class="mdc-note">Admin selalu memiliki semua izin. Teknisi (USER) tanpa pengaturan memakai izin bawaan: Lihat, Buat, Ubah, Foto, Cetak/PDF.</p>';
      if (!users.length) h += '<p class="mdc-empty">Belum ada akun Teknisi.</p>';
      users.forEach(function (x) {
        var list = cur[x.userId] || ['view', 'create', 'edit', 'photo', 'pdf'];
        h += '<fieldset class="mdc-fs" data-uid="' + q(x.userId) + '"><legend>' + q(x.fullName) + '</legend><div class="mdc-perm">' +
          PERM_KEYS.map(function (k) { return '<label><input type="checkbox" value="' + k[0] + '"' + (list.indexOf(k[0]) >= 0 ? ' checked' : '') + '> ' + k[1] + '</label>'; }).join('') +
          '</div><div class="mdc-foot"><button type="button" class="btn sec" data-perm-save="' + q(x.userId) + '">Simpan izin</button></div></fieldset>';
      });
      h += '<h3 class="mdc-sec">Pengingat DCP terlambat</h3><p class="mdc-note">Mengirim notifikasi harian pukul 09.00 untuk DCP keluar yang belum kembali lebih dari batas hari (Script Property DCP_OVERDUE_HARI, default 7).</p>' +
        '<div class="mdc-foot"><button type="button" class="btn" id="dcpjob">Pasang pengingat harian</button></div>' +
        '<h3 class="mdc-sec">Sheet tidak terpakai</h3><p class="mdc-note">Memeriksa semua sheet di Spreadsheet. Sheet yang tidak dipakai kode aplikasi diberi warna tab merah supaya aman Anda hapus sendiri. Tidak ada sheet yang dihapus otomatis.</p>' +
        '<div class="mdc-foot"><button type="button" class="btn sec" id="shaud">Periksa dan tandai sheet</button></div><div id="shout" aria-live="polite"></div>';
      modal(h);
      $('shaud').onclick = function () {
        var b = this; b.disabled = true;
        api('sheet_audit', { tandai: true }).then(function (r) {
          b.disabled = false;
          var bad = r.tidakTerpakai || [];
          $('shout').innerHTML = (bad.length ? '<p><b>' + bad.length + ' sheet tidak terpakai (tab diwarnai merah, aman dihapus):</b></p><ul>' + bad.map(function (n) { return '<li>' + q(n) + '</li>'; }).join('') + '</ul>' : '<p><b>Tidak ada sheet tidak terpakai.</b> Semua sheet dipakai aplikasi.</p>') +
            '<p class="mdc-note">Sheet dipakai: ' + (r.sheets || []).filter(function (x) { return x.dipakai; }).map(function (x) { return q(x.sheet); }).join(', ') + '.</p>';
        }).catch(function (e) { b.disabled = false; toast(e.message, 1); });
      };
      document.querySelectorAll('[data-perm-save]').forEach(function (b) {
        b.onclick = function () {
          var fs = b.closest('fieldset'), perms = Array.prototype.map.call(fs.querySelectorAll('input:checked'), function (c) { return c.value; });
          api('perm_save', { userId: b.dataset.permSave, perms: perms }).then(function () { toast('Izin disimpan'); }).catch(function (e) { toast(e.message, 1); });
        };
      });
      $('dcpjob').onclick = function () { api('dcp_job_install', {}).then(function () { toast('Pengingat harian dipasang'); }).catch(function (e) { toast(e.message, 1); }); };
    }).catch(function (e) { toast(e.message, 1); });
  }

  /* ================= DAILY FILM TESTING =================
     SATU LAPORAN = semua studio yang dites pada satu hari/pengiriman (batchId yang sama) beserta pengetesan ulangnya.
     Studio boleh 4 atau lebih dan opsional (centang yang dites). Tampilan, detail, dan ekspor memakai satu laporan,
     bukan satu laporan per studio. Di server tiap studio tetap satu baris (FT_LAPORAN) agar data lama tidak berubah. */
  var FST = { q: '', status: '', from: '', to: '', sel: null };
  var FT_TMP = null, FT_VIEW = null, FT_CACHE = null;
  /* daftar testing disimpan 30 detik di memori: mengetik filter atau memilih studio tidak lagi memanggil server.
     Setiap membuka detail (yang selalu terjadi setelah simpan, hapus, atau foto) membuang cache agar daftar selalu segar. */
  function ftRows() {
    if (FT_CACHE && Date.now() - FT_CACHE.at < 30000) return Promise.resolve(FT_CACHE.rows);
    return api('ft_list', { quiet: true }).then(function (rows) { FT_CACHE = { rows: rows || [], at: Date.now() }; return FT_CACHE.rows; });
  }
  function studioKey(a, b) { var x = Number(a), y = Number(b); if (!isNaN(x) && !isNaN(y) && x !== y) return x - y; return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0; }
  function studioList(data) {
    var set = { '1': 1, '2': 1, '3': 1, '4': 1 };
    try { JSON.parse(localStorage.getItem('nova_studios') || '[]').forEach(function (z) { if (z) set[String(z)] = 1; }); } catch (e) {}
    (data || []).forEach(function (t) { if (t.studio !== '' && t.studio != null) set[String(t.studio)] = 1; });
    return Object.keys(set).sort(studioKey);
  }
  function addStudioPrompt() {
    var v = (prompt('Nomor atau nama studio yang ditambahkan (mis. 5):') || '').trim().slice(0, 20);
    if (!v) return false;
    if (/[<>"'&]/.test(v)) { toast('Nama studio tidak boleh memuat karakter < > " \' &.', 1); return false; }
    try { var a = JSON.parse(localStorage.getItem('nova_studios') || '[]'); if (a.indexOf(v) < 0) a.push(v); localStorage.setItem('nova_studios', JSON.stringify(a)); } catch (e) {}
    if (FST.sel && FST.sel.indexOf(v) < 0) FST.sel.push(v);
    return true;
  }
  /* statistik dari daftar baris studio (hasil terkini tiap studio) */
  function ftStat(list) {
    var today = jkt(), o = { n: list.length, passed: 0, failed: 0, retest: 0, hari: 0 };
    list.forEach(function (t) { if (t.status === 'PASSED') o.passed++; else if (t.status === 'FAILED') o.failed++; else if (t.status === 'RETEST') o.retest++; if (t.tanggal === today) o.hari++; });
    return o;
  }
  function ftTemuan(t, items) {
    var f = (t.checklist || []).filter(function (c) { return c.val === 'FAIL'; }).map(function (c) {
      var it = (items || []).filter(function (i) { return i.id === c.id; })[0]; return (it ? it.label : c.id) + (c.ket ? ': ' + c.ket : '');
    });
    if (t.masalah) f.push('Masalah: ' + t.masalah);
    return f.join('; ');
  }
  /* hasil gabungan satu laporan: FAILED bila ada studio FAILED, RETEST bila ada RETEST, selain itu PASSED */
  function aggStatus(list) {
    if (list.some(function (t) { return t.status === 'FAILED'; })) return 'FAILED';
    if (list.some(function (t) { return t.status === 'RETEST'; })) return 'RETEST';
    return list.length ? 'PASSED' : '-';
  }
  /* kelompokkan baris FT_LAPORAN menjadi laporan: kunci = batchId akar (atau id bila laporan tunggal lama);
     pengetesan ulang (parentId) ikut laporan induknya. Mengembalikan laporan terbaru dulu. */
  function ftGroup(rows) {
    var byId = {}, kids = {};
    rows.forEach(function (r) { byId[r.id] = r; if (r.parentId) kids[r.parentId] = r; });
    function root(r) { var c = r, g = 0; while (c.parentId && byId[c.parentId] && g++ < 50) c = byId[c.parentId]; return c; }
    /* data lama tanpa batchId (satu baris per studio): disatukan per hari; studio yang sama pada hari yang sama membuka laporan baru.
       Aturan sama dengan ftKeys_ di server (dcp.gs) supaya detail laporan cocok dengan daftar. */
    var legacy = {}, bk = {};
    rows.filter(function (r) { return root(r) === r && !r.batchId; })
      .sort(function (a, b) { return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0) || String(a.id).localeCompare(String(b.id)); })
      .forEach(function (r) {
        var d = String(r.tanggal), bs = bk[d] = bk[d] || [], i = 0;
        while (i < bs.length && bs[i][String(r.studio)]) i++;
        if (i === bs.length) bs.push({});
        bs[i][String(r.studio)] = 1; legacy[r.id] = 'D' + d + (i ? '-' + (i + 1) : '');
      });
    var map = {}, order = [];
    rows.forEach(function (r) {
      var rt = root(r), key = rt.batchId || legacy[rt.id];
      if (!map[key]) { map[key] = { key: key, roots: [], rows: [] }; order.push(key); }
      map[key].rows.push(r);
      if (r === rt) map[key].roots.push(r);
    });
    return order.map(function (k) {
      var g = map[k], seen = {};
      /* studio ganda dalam satu laporan (data tidak normal): ambil yang pertama agar tampilan tetap rapi */
      var entries = g.roots.filter(function (r) { var z = String(r.studio); if (seen[z]) return false; seen[z] = 1; return true; })
        .sort(function (a, b) { return studioKey(a.studio, b.studio); })
        .map(function (rt) {
          var chain = [rt], c = rt, guard = 0;
          while (kids[c.id] && guard++ < 50) { c = kids[c.id]; chain.push(c); }
          return { z: String(rt.studio), root: rt, chain: chain, latest: chain[chain.length - 1] };
        });
      var latest = entries.map(function (e) { return e.latest; });
      var first = g.roots.slice().sort(function (a, b) { return (String(a.tanggal) + String(a.jam)).localeCompare(String(b.tanggal) + String(b.jam)) || String(a.id).localeCompare(String(b.id)); })[0] || g.rows[0];
      var films = []; latest.forEach(function (t) { if (t.film && films.indexOf(t.film) < 0) films.push(t.film); });
      var fc = 0; g.rows.forEach(function (r) { fc += r.fotoCount || 0; });
      return { key: k, id: first.id, tanggal: first.tanggal, jam: first.jam, tester: first.tester, entries: entries, rows: g.rows, films: films, status: aggStatus(latest), fotoCount: fc, createdAt: Math.max.apply(null, g.rows.map(function (r) { return r.createdAt || 0; })) };
    }).sort(function (a, b) { return (String(b.tanggal) + String(b.jam) + String(b.createdAt)).localeCompare(String(a.tanggal) + String(a.jam) + String(a.createdAt)); });
  }
  function chipHtml(e) {
    var s = String(e.latest.status || '').toLowerCase();
    return '<span class="ftr-chip ' + q(s) + '" title="Studio ' + q(e.z) + ': ' + q(e.latest.status) + '"><i></i>Studio ' + q(e.z) + '</span>';
  }

  window.vFt = function () {
    var v = $('view');
    Promise.all([ftRows(), getMeta(), loadMyPerm()]).then(function (r) {
      var all = r[0] || [], studios = studioList(all);
      var sel = (FST.sel || studios).filter(function (z) { return studios.indexOf(z) >= 0; });
      if (!sel.length) sel = studios.slice();
      var allSel = sel.length === studios.length;
      var items = (META && META.checklistItem) || [];
      var reports = ftGroup(all);
      /* filter studio (hanya studio terpilih ikut tampil dan dihitung), lalu cari, status, dan tanggal */
      var term = FST.q.trim().toLowerCase();
      var view = [];
      reports.forEach(function (rp) {
        var ents = rp.entries.filter(function (e) { return sel.indexOf(e.z) >= 0; });
        if (!ents.length) return;
        if (FST.from && String(rp.tanggal) < FST.from) return;
        if (FST.to && String(rp.tanggal) > FST.to) return;
        if (FST.status && !ents.some(function (e) { return e.latest.status === FST.status; })) return;
        if (term && !(rp.rows.some(function (x) { return (String(x.film) + ' ' + x.id + ' ' + (x.batchId || '')).toLowerCase().indexOf(term) >= 0; }))) return;
        var lat = ents.map(function (e) { return e.latest; });
        view.push(Object.assign({}, rp, { shown: ents, shownStatus: aggStatus(lat) }));
      });
      var cnt = {}; studios.forEach(function (z) { cnt[z] = 0; });
      reports.forEach(function (rp) { rp.entries.forEach(function (e) { if (cnt[e.z] != null) cnt[e.z]++; }); });
      var shownLatest = []; view.forEach(function (rp) { rp.shown.forEach(function (e) { shownLatest.push(e.latest); }); });
      var tot = ftStat(shownLatest);
      var hasRe = {}; all.forEach(function (t) { if (t.parentId) hasRe[t.parentId] = 1; });
      var perlu = []; view.forEach(function (rp) { rp.shown.forEach(function (e) { var t = e.latest; if ((t.status === 'FAILED' || t.status === 'RETEST') && !hasRe[t.id]) perlu.push({ t: t, rp: rp }); }); });
      FT_VIEW = { sel: sel, studios: studios, items: items, reports: view, all: reports };

      var h = '<div class="mdc-studio-tabs" role="group" aria-label="Pilih studio (boleh lebih dari satu)">' +
        '<button type="button" class="mdc-stab' + (allSel ? ' on' : '') + '" aria-pressed="' + allSel + '" data-stu-all="1">Semua studio</button>' +
        studios.map(function (z) { var on = sel.indexOf(z) >= 0; return '<button type="button" class="mdc-stab' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-stu="' + q(z) + '">Studio ' + q(z) + ' <small>' + cnt[z] + '</small></button>'; }).join('') +
        (canWrite() ? '<button type="button" class="mdc-stab add" id="stuadd" aria-label="Tambah studio">+ Studio</button>' : '') + '</div>' +
        '<div class="mdc-top"><div class="mdc-kpis">' + kpi('Laporan', view.length, '') + kpi('Studio dipilih', sel.length, '') + kpi('PASSED', tot.passed, 'ok') + kpi('FAILED', tot.failed, tot.failed ? 'bad' : '') + kpi('RETEST', tot.retest, tot.retest ? 'warn' : '') + kpi('Studio dites hari ini', tot.hari, '') + '</div>' +
        '<div class="mdc-acts">' + (canWrite() ? '<button type="button" class="btn" id="ftnew">Mulai film testing</button>' : '') + (can('pdf') ? dlMenu('ft', 'Download laporan gabungan') : '') + '</div></div>';
      if (perlu.length) {
        h += '<div class="mdc-alert bad"><b>Perlu tindakan / tes ulang (' + perlu.length + ')</b><ul>' +
          perlu.map(function (p) { return '<li><button type="button" class="mdc-link" data-ft-open="' + q(p.t.id) + '">Studio ' + q(p.t.studio) + ' · ' + q(p.t.film) + ' · ' + q(p.t.tanggal) + '</button> ' + stFt(p.t.status) + '</li>'; }).join('') + '</ul></div>';
      }
      h += '<div class="mdc-filter"><input id="ftq" type="search" placeholder="Cari film atau ID" value="' + q(FST.q) + '" aria-label="Cari testing">' +
        '<select id="fts" aria-label="Status"><option value="">Semua status</option>' + ['PASSED', 'FAILED', 'RETEST'].map(function (z) { return '<option' + (FST.status === z ? ' selected' : '') + '>' + z + '</option>'; }).join('') + '</select>' +
        '<label class="mdc-fd">Dari<input id="ftf1" type="date" value="' + q(FST.from) + '"></label><label class="mdc-fd">Sampai<input id="ftf2" type="date" value="' + q(FST.to) + '"></label>' +
        ((FST.q || FST.status || FST.from || FST.to) ? '<button type="button" class="btn sec" id="ftrst">Reset</button>' : '') + '</div>';
      /* rekap gabungan: satu baris per studio (hasil terkini tiap studio pada laporan yang tampil) */
      h += '<section class="ft-rekap" aria-label="Rekap gabungan"><h3>Rekap gabungan (' + sel.length + ' studio)</h3><div class="mdc-tbl stack"><table><thead><tr><th>Studio</th><th>Total</th><th>PASSED</th><th>FAILED</th><th>RETEST</th><th>Hari ini</th></tr></thead><tbody>' +
        sel.map(function (z) {
          var l = []; view.forEach(function (rp) { rp.shown.forEach(function (e) { if (e.z === z) l.push(e.latest); }); });
          var o = ftStat(l);
          return '<tr><td data-l="Studio"><b>Studio ' + q(z) + '</b></td><td data-l="Total">' + o.n + '</td><td data-l="PASSED">' + o.passed + '</td><td data-l="FAILED">' + o.failed + '</td><td data-l="RETEST">' + o.retest + '</td><td data-l="Hari ini">' + o.hari + '</td></tr>';
        }).join('') +
        '</tbody><tfoot><tr><td data-l="Studio"><b>Total</b></td><td data-l="Total"><b>' + tot.n + '</b></td><td data-l="PASSED"><b>' + tot.passed + '</b></td><td data-l="FAILED"><b>' + tot.failed + '</b></td><td data-l="RETEST"><b>' + tot.retest + '</b></td><td data-l="Hari ini"><b>' + tot.hari + '</b></td></tr></tfoot></table></div></section>';
      /* SATU daftar: satu baris = satu laporan harian berisi semua studionya */
      h += '<section class="ft-studio ftr-list" aria-label="Daftar laporan testing"><div class="ft-sh"><h3>Laporan Daily Film Testing</h3><span class="ft-sm">' + view.length + ' laporan · tiap laporan memuat semua studio yang dites pada hari itu</span></div>' +
        '<div class="mdc-tbl stack" role="region" aria-label="Daftar laporan testing"><table><thead><tr><th>Tanggal</th><th>Laporan</th><th>Film</th><th>Studio dan hasil</th><th>Hasil</th><th>Foto</th></tr></thead><tbody>' +
        (view.length ? view.map(function (rp) {
          var fl = rp.films.length > 2 ? rp.films.slice(0, 2).join(', ') + ' +' + (rp.films.length - 2) : rp.films.join(', ');
          var nre = rp.rows.filter(function (x) { return x.parentId; }).length;
          return '<tr data-ft-open="' + q(rp.id) + '" tabindex="0"><td data-l="Tanggal">' + q(rp.tanggal) + ' ' + q(rp.jam) + '</td>' +
            '<td data-l="Laporan" class="mdc-mono">' + q(rp.id) + ' <span class="mdc-st mdc-info">' + rp.shown.length + ' studio</span></td>' +
            '<td data-l="Film">' + q(fl) + '</td>' +
            '<td data-l="Studio"><div class="ftr-chips">' + rp.shown.map(chipHtml).join('') + '</div>' + (nre ? '<div class="ftr-sum">' + nre + ' pengetesan ulang</div>' : '') + '</td>' +
            '<td data-l="Hasil">' + stFt(rp.shownStatus) + '</td><td data-l="Foto">' + (rp.fotoCount || 0) + '</td></tr>';
        }).join('') : '<tr><td colspan="6" class="mdc-empty">Belum ada laporan testing' + ((FST.q || FST.status || FST.from || FST.to) ? ' yang cocok dengan filter' : '') + '.</td></tr>') + '</tbody></table></div></section>';
      v.innerHTML = h;
      mselFt(view);
      var t;
      $('ftq').oninput = function (e) { FST.q = e.target.value; clearTimeout(t); t = setTimeout(vFt, 350); };
      $('fts').onchange = function (e) { FST.status = e.target.value; vFt(); };
      $('ftf1').onchange = function (e) { FST.from = e.target.value; vFt(); };
      $('ftf2').onchange = function (e) { FST.to = e.target.value; vFt(); };
      if ($('ftrst')) $('ftrst').onclick = function () { FST.q = ''; FST.status = ''; FST.from = ''; FST.to = ''; vFt(); };
      [].forEach.call(v.querySelectorAll('[data-stu]'), function (b) {
        b.onclick = function () {
          var z = b.getAttribute('data-stu'), cur = (FST.sel || studios).filter(function (k) { return studios.indexOf(k) >= 0; });
          var i2 = cur.indexOf(z); if (i2 >= 0) { if (cur.length === 1) { toast('Minimal satu studio harus dipilih.', 1); return; } cur.splice(i2, 1); } else cur.push(z);
          cur.sort(studioKey); FST.sel = cur.length === studios.length ? null : cur; vFt();
        };
      });
      if (v.querySelector('[data-stu-all]')) v.querySelector('[data-stu-all]').onclick = function () { FST.sel = null; vFt(); };
      if ($('stuadd')) $('stuadd').onclick = function () { if (addStudioPrompt()) vFt(); };
      if ($('ftnew')) $('ftnew').onclick = function () { ftForm(null, null); };
      if ($('ftxl')) $('ftxl').onclick = function () { ftExport('xlsx'); };
      if ($('ftpdf')) $('ftpdf').onclick = function () { ftExport('pdf'); };
      document.querySelectorAll('[data-ft-open]').forEach(function (rw) {
        rw.onclick = function () { ftDetail(rw.dataset.ftOpen); };
        rw.onkeydown = function (e) { if (e.key === 'Enter') ftDetail(rw.dataset.ftOpen); };
      });
    }).catch(function (e) { v.innerHTML = '<div class="mdc-alert bad" role="alert">' + q(e.message) + '</div>'; });
  };

  function mselFt(view) {
    var host = document.querySelector('#view .ftr-list .mdc-tbl'), M = S.msel;
    if (!M || !host) return;
    M.mount({ key: 'ft', admin: (curU() || {}).role === 'ADMIN', host: host, rows: 'tbody tr[data-ft-open]', id: function (el) { return el.getAttribute('data-ft-open'); },
      anchor: document.querySelector('#view .ftr-list .ft-sh'), reload: function () { vFt(); },
      actions: [{ label: 'Hapus laporan', danger: true, run: function (ids) {
        var del = [];
        view.forEach(function (rp) { if (ids.indexOf(rp.id) >= 0) rp.entries.forEach(function (e) { e.chain.slice().reverse().forEach(function (x) { del.push(x.id); }); }); });
        if (!del.length) return false;
        if (!confirm('Hapus ' + ids.length + ' laporan testing (' + del.length + ' baris termasuk pengetesan ulang)? Foto ikut dihapus dan tidak dapat dibatalkan.')) return false;
        FT_CACHE = null;
        return M.seq(del, function (id) { return api('ft_del', { id: id, quiet: true }); }, 'Menghapus');
      } }] });
  }
  /* ---------- detail: SATU laporan memuat semua studio ---------- */
  function ftDetail(id) {
    FT_CACHE = null;
    getMeta().then(function () { return api('ft_report_get', { id: id }); }).then(function (r) {
      var items = (META && META.checklistItem) || [], rp = ftGroup(r.laporan || [])[0], FOTO = r.foto || {};
      if (!rp) { toast('Laporan tidak ditemukan.', 1); return; }
      rp.rows.forEach(function (x) { x.fotoCount = (FOTO[x.id] || []).length; });
      var tot = ftStat(rp.entries.map(function (e) { return e.latest; }));
      var h = '<h2>Laporan Daily Film Testing</h2><p class="mdc-mono">' + q(rp.id) + (rp.rows.length > rp.entries.length ? '' : '') + '</p>' +
        '<div class="mdc-grid"><div><small>Tanggal & jam</small><b>' + q(rp.tanggal) + ' ' + q(rp.jam) + '</b></div><div><small>Hasil gabungan</small>' + stFt(rp.status) + '</div>' +
        '<div><small>Jumlah studio</small><b>' + rp.entries.length + ' studio</b></div><div><small>Tester</small><b>' + q(rp.tester) + '</b></div></div>' +
        '<div class="ftr-chips" aria-label="Ringkasan studio">' + rp.entries.map(chipHtml).join('') + '</div>' +
        '<p class="ftr-sum">' + tot.passed + ' PASSED · ' + tot.failed + ' FAILED · ' + tot.retest + ' RETEST</p>';
      rp.entries.forEach(function (e, ei) {
        var L = e.latest, fails = (L.checklist || []).filter(function (c) { return c.val === 'FAIL'; });
        h += '<section class="ftr-st" data-studio="' + q(e.z) + '"><header><h3>Studio ' + q(e.z) + '</h3>' + stFt(L.status) + '</header>' +
          '<div class="mdc-grid"><div><small>Film</small><b>' + q(L.film) + '</b></div><div><small>Format</small><b>' + q(L.format) + '</b></div>' +
          '<div><small>Server / proyektor</small><b>' + q(L.server || '-') + ' / ' + q(L.projector || '-') + '</b></div><div><small>Tester</small><b>' + q(L.tester) + ' · ' + q(L.tanggal) + ' ' + q(L.jam) + '</b></div></div>';
        if (fails.length) h += '<h4>Item gagal</h4><ul class="mdc-chk">' + fails.map(function (c) { var it = items.filter(function (i) { return i.id === c.id; })[0]; return '<li><span>' + q(it ? it.label : c.id) + '</span>' + st('bad', 'FAIL') + '<em>' + q(c.ket) + '</em></li>'; }).join('') + '</ul>';
        if (L.masalah) h += '<h4>Masalah</h4><p>' + q(L.masalah) + '</p>';
        if (L.tindakan) h += '<h4>Tindakan</h4><p>' + q(L.tindakan) + '</p>';
        if (L.hasilUlang) h += '<h4>Hasil ulang</h4><p>' + q(L.hasilUlang) + '</p>';
        if (L.catatanTeknisi) h += '<h4>Catatan teknisi</h4><p>' + q(L.catatanTeknisi) + '</p>';
        if (e.chain.length > 1) h += '<h4>Riwayat pengetesan</h4><ol class="mdc-tl">' + e.chain.map(function (x) { return '<li><b>' + q(x.id) + '</b> ' + stFt(x.status) + ' · ' + q(x.tester) + ' · ' + q(x.tanggal) + '</li>'; }).join('') + '</ol>';
        var fotos = []; e.chain.forEach(function (x) { (FOTO[x.id] || []).forEach(function (p) { fotos.push({ p: p, id: x.id }); }); });
        h += '<h3 class="ft-dokt"><b>Dokumentasi Studio ' + q(e.z) + '</b> (' + fotos.length + ')</h3>' + (L.ketDok ? '<p class="mdc-note">' + q(L.ketDok) + '</p>' : '') + '<div class="mdc-ph">' + fotos.map(function (f) {
          var p = f.p;
          return '<figure><img loading="lazy" data-fid="' + q(p.fotoId) + '" data-fk="ft" alt="' + q(p.kind) + '"><figcaption><b>' + q(p.kind) + '</b></figcaption>' + (can('photo') ? '<button type="button" class="mdc-pdel" data-pdel="' + q(p.fotoId) + '" data-pk="ft" data-id="' + q(rp.id) + '" aria-label="Hapus foto ' + q(p.kind) + '">Hapus</button>' : '') + '</figure>';
        }).join('') + '</div>';
        if (canWrite()) h += '<label class="mdc-up"><b>Tambah dokumentasi Studio ' + q(e.z) + '</b><input type="file" accept="image/*" multiple data-ftph="' + ei + '"></label>';
        h += '<div class="ftr-acts">' +
          (canWrite() && (L.status === 'FAILED' || L.status === 'RETEST') ? '<button type="button" class="btn" data-ftre="' + ei + '">Tes ulang Studio ' + q(e.z) + '</button>' : '') +
          (canWrite() ? '<button type="button" class="btn sec" data-ftedit="' + ei + '">Ubah Studio ' + q(e.z) + '</button>' : '') +
          (canDel() ? '<button type="button" class="btn danger" data-ftdel="' + ei + '">Hapus Studio ' + q(e.z) + '</button>' : '') + '</div></section>';
      });
      var have = {}; rp.entries.forEach(function (e) { have[e.z] = 1; });
      var remain = studioList(FT_VIEW ? FT_VIEW.all.reduce(function (a, x) { return a.concat(x.rows); }, []) : []).filter(function (z) { return !have[z]; });
      h += '<div class="mdc-foot">' + dlMenu('mdc', 'Download laporan ini') +
        (canWrite() && remain.length ? '<button type="button" class="btn sec" id="ftadd">+ Tambah studio ke laporan ini</button>' : '') +
        (canDel() ? '<button type="button" class="btn danger" id="ftdelall">Hapus seluruh laporan</button>' : '') + '</div>';
      modal(h);
      bindPhotoDel();
      loadPhotos();
      if ($('mdcxl')) $('mdcxl').onclick = function () { ftReportExport(rp, items, 'xlsx', FOTO); };
      if ($('mdcpdf')) $('mdcpdf').onclick = function () { ftReportExport(rp, items, 'pdf', FOTO); };
      [].forEach.call(document.querySelectorAll('[data-ftph]'), function (inp) {
        inp.onchange = function (ev) { var e = rp.entries[Number(inp.getAttribute('data-ftph'))]; sendPhotos(e.latest.id, ev.target.files, 'Dokumentasi Studio ' + e.z, 'ft_photo_save', function () { ftDetail(rp.id); }); };
      });
      [].forEach.call(document.querySelectorAll('[data-ftre]'), function (b) { b.onclick = function () { ftForm(null, rp.entries[Number(b.getAttribute('data-ftre'))].latest, null, rp); }; });
      [].forEach.call(document.querySelectorAll('[data-ftedit]'), function (b) { b.onclick = function () { ftForm(rp.entries[Number(b.getAttribute('data-ftedit'))].latest, null, null, rp); }; });
      [].forEach.call(document.querySelectorAll('[data-ftdel]'), function (b) {
        b.onclick = function () {
          var e = rp.entries[Number(b.getAttribute('data-ftdel'))], rev = e.chain.slice().reverse();
          if (!confirm('Hapus Studio ' + e.z + ' dari laporan ini' + (rev.length > 1 ? ' (termasuk ' + (rev.length - 1) + ' pengetesan ulang)' : '') + '? Foto Studio ini ikut dihapus.')) return;
          b.disabled = true;
          rev.reduce(function (p, x) { return p.then(function () { return api('ft_del', { id: x.id }); }); }, Promise.resolve())
            .then(function () { toast('Studio ' + e.z + ' dihapus'); vFt(); if (rp.entries.length > 1) ftDetail(rp.entries.filter(function (z) { return z !== e; })[0].root.id); else closeM(); })
            .catch(function (er) { b.disabled = false; toast(er.message, 1); });
        };
      });
      if ($('ftadd')) $('ftadd').onclick = function () { ftForm(null, null, { key: rp.key, tanggal: rp.tanggal, have: have, id: rp.id }); };
      if ($('ftdelall')) $('ftdelall').onclick = function () {
        if (!confirm('Hapus SELURUH laporan ini (' + rp.entries.length + ' studio, ' + rp.rows.length + ' baris termasuk pengetesan ulang)? Tindakan ini tidak dapat dibatalkan.')) return;
        var del = []; rp.entries.forEach(function (e) { e.chain.slice().reverse().forEach(function (x) { del.push(x.id); }); });
        $('ftdelall').disabled = true;
        del.reduce(function (p, id2) { return p.then(function () { return api('ft_del', { id: id2 }); }); }, Promise.resolve())
          .then(function () { closeM(); toast('Laporan dihapus'); vFt(); })
          .catch(function (er) { $('ftdelall').disabled = false; toast(er.message, 1); vFt(); });
      };
    }).catch(function (e) { toast(e.message, 1); });
  }

  /* form: edit satu studio (row), retest (parent), tambah studio ke laporan yang ada (append), atau laporan baru.
     Laporan baru: semua studio tersedia, centang yang dites (opsional, 4 atau lebih). */
  function ftForm(row, parent, append, rpCtx) {
    getMeta().then(function (m) {
      var x = row || {}, items = m.checklistItem || [], groups = m.checklist || [];
      var single = !!(row || parent);
      var allData = FT_VIEW ? FT_VIEW.all.reduce(function (a, r) { return a.concat(r.rows); }, []) : [];
      var studios = single ? [String(x.studio || parent.studio)] : studioList(allData).filter(function (z) { return !(append && append.have[z]); });
      if (!studios.length) { toast('Semua studio sudah ada di laporan ini.', 1); return; }
      var pre = parent ? (parent.checklist || []) : [];
      var cur = {};
      (x.checklist || []).forEach(function (c) { cur[c.id] = c; });
      var dateFix = append ? append.tanggal : '';
      function panel(z, i) {
        var sv_ = single ? x : {}, pv_ = single && parent ? parent : {};
        var h = '<fieldset class="mdc-fs ft-pn" data-i="' + i + '"><legend>Studio ' + q(z) + '</legend>' +
          (single ? '' : '<label>Judul film Studio ' + q(z) + ' <small>(kosong = sama dengan judul film di atas)</small><input name="fm' + i + '" maxlength="200" value=""></label>') +
          '<div class="mdc-row"><label>Server<input name="sv' + i + '" maxlength="80" value="' + q(sv_.server || pv_.server || '') + '"></label>' +
          '<label>Proyektor<input name="pj' + i + '" maxlength="80" value="' + q(sv_.projector || pv_.projector || '') + '"></label></div>';
        groups.forEach(function (g) {
          h += '<div class="mdc-sec">' + q(g.name) + '</div>';
          items.filter(function (it) { return it.grp === g.name; }).forEach(function (it) {
            var c = cur[it.id] || (pre.filter(function (p) { return p.id === it.id; })[0] || {});
            var pOn = c.val === 'PASS' || !c.val, nOn = c.val === 'N/A';
            h += '<div class="mdc-ck" data-id="' + it.id + '"><span>' + q(it.label) + '</span>' +
              '<div class="mdc-cb" role="group" aria-label="Hasil ' + q(it.label) + ' Studio ' + q(z) + '">' +
              '<label class="mdc-cbx"><input type="checkbox" name="p_' + i + '_' + it.id + '"' + (pOn ? ' checked' : '') + '> Lulus</label>' +
              '<label class="mdc-cbx"><input type="checkbox" name="n_' + i + '_' + it.id + '"' + (nOn ? ' checked' : '') + '> Tidak diuji</label></div>' +
              '<input class="mdc-ket" name="k_' + i + '_' + it.id + '" maxlength="500" placeholder="Keterangan (opsional; wajib jika gagal)" value="' + q(c.ket || '') + '" aria-label="Keterangan ' + q(it.label) + ' Studio ' + q(z) + '"></div>';
          });
        });
        h += '<div class="mdc-sec">Catatan</div>' +
          '<div class="ft-fail" hidden><label>Deskripsi masalah (wajib karena ada FAIL)<textarea name="ms' + i + '" maxlength="2000" rows="2">' + q(sv_.masalah || '') + '</textarea></label>' +
          '<label>Tindakan perbaikan (wajib karena ada FAIL)<textarea name="td' + i + '" maxlength="2000" rows="2">' + q(sv_.tindakan || '') + '</textarea></label></div>' +
          '<label>Catatan teknisi<textarea name="ct' + i + '" maxlength="2000" rows="2">' + q(sv_.catatanTeknisi || '') + '</textarea></label>' +
          '<label class="mdc-chkbox"><input type="checkbox" name="rt' + i + '"' + (sv_.status === 'RETEST' ? ' checked' : '') + '> Perlu pengetesan ulang (hasil RETEST)</label></fieldset>';
        return h;
      }
      /* dokumentasi: bagian paling akhir formulir; keterangan dan foto terpisah untuk tiap studio. Judulnya TEBAL. */
      function docPanel(z, i) {
        return '<fieldset class="mdc-fs ft-doc" data-i="' + i + '"><legend><b>Dokumentasi Studio ' + q(z) + '</b></legend>' +
          '<label>Keterangan dokumentasi<textarea name="kd' + i + '" maxlength="1000" rows="2" placeholder="Opsional: apa yang ditunjukkan foto Studio ' + q(z) + '">' + q((single ? x.ketDok : '') || '') + '</textarea></label>' +
          photoBox('ft' + i, true) + '</fieldset>';
      }
      var h = '<h3>' + (row ? 'Ubah Studio ' + q(x.studio) : parent ? 'Pengetesan ulang Studio ' + q(parent.studio) : append ? 'Tambah studio ke laporan' : 'Input Testing') + '</h3>' +
        (parent ? '<p class="mdc-note">Pengetesan ulang untuk <b class="mdc-mono">' + q(parent.id) + '</b>. Hasil lama tetap tersimpan sebagai riwayat dalam laporan yang sama.</p>' : '') +
        (append ? '<p class="mdc-note">Studio baru ini masuk ke laporan <b class="mdc-mono">' + q(append.id) + '</b> tanggal ' + q(append.tanggal) + ' (satu laporan, bukan laporan terpisah).</p>' : '') +
        '<form id="ftf" class="mdc-form" novalidate>' +
        '<div class="mdc-sec">Jadwal dan film</div>' +
        '<div class="mdc-row"><label>Tanggal<input name="tanggal" type="date" required value="' + q(x.tanggal || dateFix || jkt()) + '"' + (append ? ' readonly' : '') + '></label>' +
        '<label>Jam<input name="jam" type="time" required value="' + q(x.jam || jam()) + '"></label></div>' +
        '<label>Judul film' + (single ? '' : ' <small>(untuk semua studio; tiap studio boleh punya judul sendiri di bawah)</small>') + '<input name="film" required maxlength="200" value="' + q(x.film || (parent && parent.film) || '') + '"></label>' +
        '<div class="mdc-row"><label>Format<select name="format">' + FMT_FT.map(function (f) { return '<option' + ((x.format || (parent && parent.format) || '2D') === f ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select></label>' +
        '<label>Tester<input name="tester" required maxlength="120" value="' + q(x.tester || (curU() && curU().name) || '') + '"></label></div>';
      if (!single) {
        h += '<div class="mdc-sec">Studio yang dites</div><div class="ft-chips" id="ftchips" role="group" aria-label="Pilih studio">' +
          studios.map(function (z, i) { return '<label class="mdc-cbx"><input type="checkbox" name="stu" value="' + q(z) + '" data-i="' + i + '" checked> Studio ' + q(z) + '</label>'; }).join('') +
          '<button type="button" class="btn sec" id="ftall">Pilih semua</button><button type="button" class="btn sec" id="ftnone">Kosongkan</button></div>' +
          '<p class="mdc-note">Semua studio masuk dalam SATU laporan. Hasil, checklist, dan foto tiap studio tetap terpisah di dalam laporan itu; hilangkan centang studio yang tidak dites.</p>';
      }
      h += '<p class="mdc-note">Hasil dihitung otomatis per studio: ada item FAIL = FAILED; tanpa FAIL dan ditandai tes ulang = RETEST; selain itu = PASSED.</p>' +
        studios.map(panel).join('') +
        '<div class="mdc-sec"><b>Dokumentasi foto</b></div>' + studios.map(docPanel).join('') +
        '<p class="mdc-err" id="ftferr" role="alert"></p>' +
        '<div class="mdc-foot"><button type="button" class="btn sec" id="ftx">Batal</button><button type="submit" class="btn" id="ftok">Simpan</button></div></form>';
      modal(h);
      var phs = studios.map(function (z, i) { return photoBind('ft' + i); });
      $('ftx').onclick = function () { if (rpCtx || append) ftDetail((rpCtx && rpCtx.id) || append.id); else closeM(); };
      var f = $('ftf');
      function pn(i) { return f.querySelector('.ft-pn[data-i="' + i + '"]'); }
      function chosen() { return studios.map(function (z, i) { return i; }).filter(function (i) { return single || f.querySelector('input[name=stu][data-i="' + i + '"]').checked; }); }
      function showPanels() { studios.forEach(function (z, i) { var hid = !single && !f.querySelector('input[name=stu][data-i="' + i + '"]').checked; pn(i).hidden = hid; f.querySelector('.ft-doc[data-i="' + i + '"]').hidden = hid; }); }
      function updFail(i) { var any = items.some(function (it) { return !f['p_' + i + '_' + it.id].checked && !f['n_' + i + '_' + it.id].checked; }); pn(i).querySelector('.ft-fail').hidden = !any; }
      showPanels(); studios.forEach(function (z, i) { updFail(i); });
      if ($('ftall')) {
        $('ftall').onclick = function () { [].forEach.call(f.querySelectorAll('input[name=stu]'), function (c) { c.checked = true; }); showPanels(); };
        $('ftnone').onclick = function () { [].forEach.call(f.querySelectorAll('input[name=stu]'), function (c) { c.checked = false; }); showPanels(); };
      }
      f.onchange = function (e) {
        var nm = e.target.name || '';
        if (nm === 'stu') { showPanels(); return; }
        if (nm.indexOf('p_') === 0 && e.target.checked) f['n_' + nm.slice(2)].checked = false;
        if (nm.indexOf('n_') === 0 && e.target.checked) f['p_' + nm.slice(2)].checked = false;
        if (nm.indexOf('p_') === 0 || nm.indexOf('n_') === 0) {
          var id = nm.slice(2), gagal = !f['p_' + id].checked && !f['n_' + id].checked;
          f['k_' + id].placeholder = gagal ? 'Keterangan masalah (wajib karena gagal)' : 'Keterangan (opsional)';
          updFail(Number(id.split('_')[0]));
        }
      };
      f.onsubmit = function (e) {
        e.preventDefault();
        var err = $('ftferr'), sel = chosen(), bad = '', out = [];
        if (!sel.length) { err.textContent = 'Pilih minimal satu studio.'; return; }
        sel.forEach(function (i) {
          if (bad) return;
          var z = studios[i], pre_ = 'Studio ' + z + ': ';
          var film = (single ? '' : f['fm' + i].value.trim()) || f.film.value.trim();
          if (!film) { bad = pre_ + 'isi judul film.'; return; }
          var chk = items.map(function (it) {
            var val = f['p_' + i + '_' + it.id].checked ? 'PASS' : (f['n_' + i + '_' + it.id].checked ? 'N/A' : 'FAIL');
            return { id: it.id, val: val, ket: f['k_' + i + '_' + it.id].value.trim(), label: it.label };
          });
          var fl = chk.filter(function (c) { return c.val === 'FAIL' && !c.ket; });
          if (fl.length) { bad = pre_ + 'item FAIL wajib diberi keterangan: ' + fl[0].label + '.'; return; }
          var anyFail = chk.some(function (c) { return c.val === 'FAIL'; });
          if (anyFail && (!f['ms' + i].value.trim() || !f['td' + i].value.trim())) { bad = pre_ + 'hasil FAILED, isi deskripsi masalah dan tindakan perbaikan.'; return; }
          out.push({
            id: x.id || '', tanggal: f.tanggal.value, jam: f.jam.value, film: film, studio: z, format: f.format.value,
            server: f['sv' + i].value.trim(), projector: f['pj' + i].value.trim(), tester: f.tester.value.trim(),
            checklist: chk.map(function (c) { return { id: c.id, val: c.val, ket: c.ket }; }),
            masalah: f['ms' + i].value.trim(), tindakan: f['td' + i].value.trim(), catatanTeknisi: f['ct' + i].value.trim(), ketDok: f['kd' + i].value.trim(),
            retest: !!f['rt' + i].checked, parentId: parent ? parent.id : ''
          });
        });
        if (bad) { err.textContent = bad; return; }
        err.textContent = '';
        $('ftok').disabled = true;
        /* satu studio: ft_save; banyak studio: ft_batch_save (atomik di server, satu batchId = satu laporan) */
        var bid = append ? append.key : S.mi.uid();
        if (append) out.forEach(function (o) { o.batchId = bid; });
        var run = out.length === 1 ? api('ft_save', out[0]).then(function (id) { return [id]; })
          : api('ft_batch_save', { batchId: bid, items: out }).then(function (r) { return r.ids; });
        run.then(function (ids) {
          toast(ids.length > 1 ? 'Testing ' + ids.length + ' studio tersimpan dalam satu laporan' : 'Testing tersimpan'); vFt();
          return sel.reduce(function (p, i, k) {
            var pf = phs[i].get();
            return p.then(function () { return pf.length ? new Promise(function (res) { sendPhotos(ids[k], pf, 'Dokumentasi Studio ' + studios[i], 'ft_photo_save', res); }) : 0; });
          }, Promise.resolve()).then(function () { ftDetail(append ? append.id : ids[0]); });
        }).catch(function (er) { $('ftok').disabled = false; err.textContent = er.message; });
      };
    });
  }
  /* helper bersama untuk modul Pelaporan DCP (pelaporan.js) */
  S.dcpUI = { form: dcpForm, detail: dcpDetail, reload: function () { return vDcp(); } };
  S.pel = { collectPhotos: collectPhotos, uname: uname, photoBox: photoBox, photoBind: photoBind, sendPhotos: sendPhotos, loadPhotos: loadPhotos, loadThumbs: loadThumbs, canWrite: canWrite, loadMyPerm: loadMyPerm, dlMenu: dlMenu, recSave: recSave, jkt: jkt, KOMP_DEF: KOMP_DEF };
})();
