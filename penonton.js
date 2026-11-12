/* NOVA - modul Data Penonton per-show (v20.1.0). Dimuat setelah app.js; memakai window.STC.
   Input per show dengan key Tanggal + Studio + Show. Semua show satu tanggal digabung menjadi 1 laporan harian.
   Semua validasi final ada di server (backend/Code.gs, aksi aud_*); klien hanya membantu pengisian. */
(function () {
  'use strict';
  var S = window.STC;
  if (!S) return;
  var api = S.api, modal = S.modal, closeM = S.closeM, toast = S.toast, esc = S.esc, dt = S.dt, $ = S.$;
  var NF = new Intl.NumberFormat('id-ID');
  var STD = ['Studio 1', 'Studio 2', 'Studio 3', 'Studio 4'], REQ = 5, SMAX = 12, RMAX = 15;
  var F = { page: 1, q: '', from: '', to: '' };
  var busy = false;

  Object.assign(S.DESC, { audience: 'Catat tiket terjual dan penonton masuk per show. Semua show pada tanggal yang sama digabung menjadi satu laporan harian.' });

  function curU() { return S.getU() || {}; }
  function today() { return new Date(S.now() + 7 * 36e5).toISOString().slice(0, 10); }
  function dlong(s) { try { return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s + 'T12:00:00+07:00')); } catch (e) { return s; } }
  function dshort(s) { try { return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(s + 'T12:00:00+07:00')); } catch (e) { return s; } }
  function nf(v) { return v === '' || v == null ? '-' : NF.format(+v); }
  function badge(s) { return '<span class="pn-b ' + (s === 'Terisi' ? 'pn-ok' : 'pn-no') + '">' + esc(s) + '</span>'; }
  function prog(p) {
    return '<div class="pn-pg"><div class="pn-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + p.total + '" aria-valuenow="' + p.filled + '" aria-label="Progres pengisian show"><i style="width:' + p.pct + '%"></i></div><small>' + p.filled + ' / ' + p.total + ' show (' + p.pct + '%)</small></div>';
  }
  function errBox(x, el, retry) { el.className = 'empty'; el.innerHTML = esc(x.message) + '<br><br><button class="btn" id="pn-retry">Coba lagi</button>'; $('pn-retry').onclick = retry; }

  /* ---------- daftar laporan harian ---------- */
  function vPnt() {
    var adm = curU().role === 'ADMIN';
    $('view').innerHTML = '<h2>Data Penonton</h2><div class="bar"><input id="pn-q" type="search" placeholder="Cari tanggal, film, studio, atau petugas" value="' + esc(F.q) + '"><label class="fl">Dari tanggal<input type="date" id="pn-f" value="' + esc(F.from) + '"></label><label class="fl">Sampai tanggal<input type="date" id="pn-t" value="' + esc(F.to) + '"></label><button class="btn sec" id="pn-go">Cari</button>' +
      '<div class="dlw"><button type="button" class="btn sec" data-dlt aria-haspopup="menu" aria-expanded="false">Download</button><div class="dlm hidden" role="menu"><button type="button" role="menuitem" id="pn-xls">Excel (.xlsx)</button><button type="button" role="menuitem" id="pn-pdf">PDF (.pdf)</button></div></div>' +
      '<button class="btn" id="ra">Isi data penonton</button></div>' +
      (adm ? '<div class="pn-adm" id="pn-adm"></div>' : '') + '<div id="rl">' + (window.OOS ? OOS.skel('list') : '') + '</div>';
    $('pn-go').onclick = function () { F.page = 1; load(); };
    $('pn-q').onkeydown = function (e) { if (e.key === 'Enter') { F.page = 1; load(); } };
    $('ra').onclick = function () { openForm(today()); };
    $('pn-xls').onclick = function () { exportRange('xlsx'); };
    $('pn-pdf').onclick = function () { exportRange('pdf'); };
    load();
  }
  function load() {
    F.q = $('pn-q').value; F.from = $('pn-f').value; F.to = $('pn-t').value;
    api('aud_list', { q: F.q, from: F.from, to: F.to, page: F.page }).then(function (r) {
      var box = $('rl'); if (!box) return;
      box.className = '';
      if (curU().role === 'ADMIN') admBar(r.reviewCount || 0);
      box.innerHTML = r.items.length ? '<div class="scroll cards"><table class="rt pn-list"><tr><th>Tanggal</th><th>Status & progres</th><th>Total</th><th>Petugas</th><th>Aksi</th></tr>' +
        r.items.map(function (x) {
          return '<tr><td data-l="Tanggal"><b>' + esc(dshort(x.date)) + '</b><br><small>' + esc(dlong(x.date).split(',')[0]) + '</small></td>' +
            '<td data-l="Status">' + badge(x.status) + prog(x.progress) + '</td>' +
            '<td data-l="Total"><b>' + NF.format(x.total.tiket) + '</b> tiket<br><b>' + NF.format(x.total.penonton) + '</b> penonton</td>' +
            '<td data-l="Petugas" class="sm">' + (x.petugas.length ? esc(x.petugas.join(', ')) : '<small>Belum ada</small>') + '</td>' +
            '<td class="act"><button class="btn sec" data-d="' + esc(x.date) + '">Lihat laporan</button> <button class="btn sec" data-p="' + esc(x.date) + '">PDF</button> <button class="btn" data-e="' + esc(x.date) + '">' + (x.status === 'Terisi' ? 'Ubah' : 'Isi show') + '</button></td></tr>';
        }).join('') + '</table></div><div class="pg"><button class="btn sec" id="pn-pp"' + (r.page < 2 ? ' disabled' : '') + '>‹</button> Hal. ' + r.page + ' / ' + Math.max(1, Math.ceil(r.total / r.size)) + ' (' + r.total + ') <button class="btn sec" id="pn-pn"' + (r.page * r.size >= r.total ? ' disabled' : '') + '>›</button></div>'
        : '<div class="empty"><b>Belum ada laporan harian</b>Ubah filter pencarian atau klik "Isi data penonton" untuk mulai mencatat.</div>';
      [].forEach.call(box.querySelectorAll('[data-d]'), function (b) { b.onclick = function () { openDay(b.dataset.d); }; });
      [].forEach.call(box.querySelectorAll('[data-p]'), function (b) { b.onclick = function () { var t0 = b.textContent; b.disabled = true; b.textContent = '...'; api('aud_day', { date: b.dataset.p }).then(dayPdf).catch(function (x) { toast(x.message, 1); }).then(function () { b.disabled = false; b.textContent = t0; }); }; });
      [].forEach.call(box.querySelectorAll('[data-e]'), function (b) { b.onclick = function () { openForm(b.dataset.e); }; });
      if ($('pn-pp')) { $('pn-pp').onclick = function () { F.page--; load(); }; $('pn-pn').onclick = function () { F.page++; load(); }; }
    }).catch(function (x) { if ($('rl')) errBox(x, $('rl'), load); });
  }
  function admBar(n) {
    var el = $('pn-adm'); if (!el) return;
    el.innerHTML = '<span>Admin:</span><button type="button" class="btn sec" id="pn-mig">Migrasi data lama</button><button type="button" class="btn sec" id="pn-rev">Perlu review' + (n ? ' (' + n + ')' : '') + '</button>';
    $('pn-mig').onclick = migrate; $('pn-rev').onclick = openReview;
  }

  /* ---------- laporan harian (baca) ---------- */
  function openDay(date) {
    modal(window.OOS ? OOS.skel('detail') : '<div class="empty">Memuat...</div>');
    api('aud_day', { date: date }).then(function (d) { modal(dayHtml(d)); wireDay(d); }).catch(function (x) { modal('<div class="empty">' + esc(x.message) + '</div>'); });
  }
  function dayHtml(d) {
    var over = [], adm = curU().role === 'ADMIN';
    var h = '<h3>Laporan Harian Data Penonton<span class="mid">' + esc(dlong(d.date)) + '</span></h3>' +
      '<div class="pn-sum"><div class="pn-k"><small>Status</small>' + badge(d.status) + '</div>' +
      '<div class="pn-k"><small>Progres</small>' + prog(d.progress) + '</div>' +
      '<div class="pn-k"><small>Tiket terjual</small><b>' + NF.format(d.total.tiket) + '</b></div>' +
      '<div class="pn-k"><small>Penonton masuk</small><b>' + NF.format(d.total.penonton) + '</b></div></div>' +
      '<p class="acs"><b>Petugas:</b> ' + (d.petugas.length ? esc(d.petugas.join(', ')) : 'Belum ada') + '</p>';
    if (adm && d.progress.filled) h += '<div class="pn-delbar"><label><input type="checkbox" id="pn-all"> Pilih semua show terisi</label><button type="button" class="btn danger" id="pn-del" disabled>Reset terpilih (0)</button></div>';
    d.studios.forEach(function (a) {
      h += '<h4>' + esc(a.studio) + ' ' + badge(a.status) + ' <small>' + a.filled + '/' + a.total + ' show</small></h4><div class="scroll cards"><table class="rt pn-t"><tr><th>Show</th><th>Status</th><th>Nama film</th><th>Jam</th><th>Tiket</th><th>Penonton</th><th>Petugas</th><th>Keterangan</th>' + (adm ? '<th>Aksi</th>' : '') + '</tr>';
      a.shows.forEach(function (w) {
        var ok = w.status === 'Terisi'; if (w.over) over.push(a.studio + ' ' + w.show);
        h += '<tr class="' + (ok ? '' : 'pn-empty') + (w.over ? ' aud-over-r' : '') + '"><td data-l="Show">' + (adm && ok ? '<label class="pn-sel"><input type="checkbox" data-del="' + esc(a.studio + '|' + w.show) + '" aria-label="Pilih ' + esc(a.studio + ' ' + w.show) + '"> <b>' + esc(w.show) + '</b></label>' : '<b>' + esc(w.show) + '</b>') + (w.over ? ' <span title="Penonton melebihi tiket">&#9888;</span>' : '') + '</td><td data-l="Status">' + badge(w.status) + '</td>' +
          '<td data-l="Nama film" class="dtl-w">' + esc(ok ? w.film : '-') + '</td><td data-l="Jam">' + esc(ok ? (w.jam || '-') : '-') + '</td><td data-l="Tiket">' + (ok ? nf(w.tiket) : '-') + '</td><td data-l="Penonton">' + (ok ? nf(w.penonton) : '-') + '</td>' +
          '<td data-l="Petugas">' + esc(ok ? (w.petugas || '-') : '-') + '</td><td data-l="Keterangan" class="dtl-w">' + esc(ok ? (w.ket || '-') : '-') + (ok && w.sourceId ? ' <button type="button" class="lnk" data-src="' + esc(w.sourceId) + '">Sumber ' + esc(w.sourceId) + '</button>' : '') + '</td>' +
          (adm ? '<td data-l="Aksi" class="pn-act">' + (ok ? '<button type="button" class="btn sec pn-ed" data-ed="' + esc(a.studio + '|' + w.show) + '">Koreksi</button><button type="button" class="btn sec pn-rs" data-rs="' + esc(a.studio + '|' + w.show) + '">Reset</button>' : '') + '</td>' : '') + '</tr>';
      });
      h += '<tr class="pn-tot"><td colspan="4" data-l="Total"><b>Total ' + esc(a.studio) + '</b></td><td data-l="Tiket"><b>' + NF.format(a.tiket) + '</b></td><td data-l="Penonton"><b>' + NF.format(a.penonton) + '</b></td><td colspan="' + (adm ? 3 : 2) + '"></td></tr></table></div>';
    });
    if (d.catatan && d.catatan.length) h += '<p class="acs"><b>Catatan (data lama):</b> ' + esc(d.catatan.join(' | ')) + '</p>';
    if (over.length) h = h.replace('<p class="acs"><b>Petugas', '<div class="ac-errbox">&#9888; Penonton masuk melebihi tiket terjual pada: <b>' + esc(over.join('; ')) + '</b></div><p class="acs"><b>Petugas');
    h += '<div class="fact"><button class="btn" id="pn-edit">' + (d.status === 'Terisi' ? 'Ubah data' : 'Isi / lengkapi show') + '</button><button class="btn sec" id="pn-dpdf">Unduh PDF</button><button class="btn sec" id="pn-close">Tutup</button></div>';
    return h;
  }
  function wireDay(d) {
    if ($('pn-close')) $('pn-close').onclick = closeM;
    if ($('pn-edit')) $('pn-edit').onclick = function () { openForm(d.date); };
    if ($('pn-dpdf')) $('pn-dpdf').onclick = function () { dayPdf(d); };
    wireDel(d);
    [].forEach.call(document.querySelectorAll('[data-ed]'), function (b) { b.onclick = function () { var k = b.dataset.ed.split('|'); openForm(d.date, { studio: k[0], show: k[1] }); }; });
    [].forEach.call(document.querySelectorAll('[data-rs]'), function (b) { b.onclick = function () { var k = b.dataset.rs.split('|'); resetShow(d, k[0], k[1], b); }; });
    [].forEach.call(document.querySelectorAll('[data-src]'), function (b) { b.onclick = function () { if (S.detail) S.detail(b.dataset.src, function () {}); }; });
  }

  /* ---------- PDF per laporan harian (format seragam, A4 portrait, 2 studio per halaman) ---------- */
  function dayPdf(d) {
    if (!window.jspdf || !window.jspdf.jsPDF || !window.NovaPDF) { toast('Library PDF belum termuat. Periksa koneksi internet lalu coba lagi.', 1); return; }
    var P = d.progress, blocks = [{ t: 'pairs', rows: [
      ['Tanggal', dlong(d.date)],
      ['Status', d.status + ' - ' + P.filled + ' dari ' + P.total + ' show terisi (' + P.pct + '%)'],
      ['Total tiket / penonton', NF.format(d.total.tiket) + ' tiket  |  ' + NF.format(d.total.penonton) + ' penonton'],
      ['Petugas', d.petugas.length ? d.petugas.join(', ') : '-']] }];
    d.studios.forEach(function (a, i) {
      if (i && i % 2 === 0) blocks.push({ t: 'page' });
      var flags = a.shows.map(function (w) { return { ok: w.status === 'Terisi', over: !!w.over }; });
      blocks.push({
        t: 'table', title: a.studio + '  (' + a.filled + '/' + a.total + ' show)', fs: 8,
        head: ['Show', 'Nama Film', 'Jam', 'Tiket', 'Penonton', 'Petugas', 'Keterangan'],
        rows: a.shows.map(function (w) { var ok = w.status === 'Terisi'; return [w.show, ok ? w.film : 'Belum terisi', ok ? (w.jam || '-') : '-', ok ? NF.format(w.tiket) : '-', ok ? NF.format(w.penonton) : '-', ok ? (w.petugas || '-') : '-', ok ? ((w.over ? '[!] Penonton > tiket. ' : '') + (w.ket || '')) : '-']; }),
        foot: ['Total', '', '', NF.format(a.tiket), NF.format(a.penonton), '', ''],
        colStyles: { 0: { cellWidth: 16 }, 2: { cellWidth: 13, halign: 'center' }, 3: { cellWidth: 17, halign: 'right' }, 4: { cellWidth: 20, halign: 'right' }, 5: { cellWidth: 30 } },
        onCell: function (h) {
          var f = flags[h.row.index];
          if (h.section === 'head' && (h.column.index === 3 || h.column.index === 4)) h.cell.styles.halign = 'right';
          if (h.section === 'foot' && (h.column.index === 3 || h.column.index === 4)) h.cell.styles.halign = 'right';
          if (h.section !== 'body' || !f) return;
          if (!f.ok) { h.cell.styles.textColor = [130, 124, 150]; h.cell.styles.fontStyle = 'italic'; }
          if (f.over) { h.cell.styles.fillColor = [253, 226, 226]; if (h.column.index === 3 || h.column.index === 4) h.cell.styles.fontStyle = 'bold'; }
        } });
    });
    if (d.catatan && d.catatan.length) blocks.push({ t: 'note', text: 'Catatan (data lama): ' + d.catatan.join(' | ') });
    var doc = window.NovaPDF.render({ title: 'Laporan Harian Data Penonton', id: dshort(d.date), user: curU().name || '', orient: 'portrait', blocks: blocks });
    doc.save('Laporan_Harian_Data_Penonton_' + d.date + '.pdf');
  }

  /* ---------- Admin: reset satu show (aud_del di server, Admin saja; isian show dikosongkan, struktur laporan harian tetap) ---------- */
  function resetShow(d, studio, show, btn) {
    if (curU().role !== 'ADMIN') return;
    var w = null; d.studios.forEach(function (a) { if (a.studio === studio) a.shows.forEach(function (x) { if (x.show === show) w = x; }); });
    if (!w) return;
    if (!window.confirm('Reset ' + studio + ' ' + show + ' tanggal ' + dshort(d.date) + '?\n\nFilm: ' + (w.film || '-') + '\nTiket: ' + nf(w.tiket) + '  |  Penonton: ' + nf(w.penonton) + '\nPetugas: ' + (w.petugas || '-') + '\n\nIsian show ini dikosongkan (kembali Belum Terisi) dan dapat diisi ulang petugas lain. Show lain, tanggal lain, dan laporan harian tidak berubah. Lanjutkan?')) return;
    if (btn) btn.disabled = true;
    api('aud_del', { date: d.date, studio: studio, show: show }).then(function () {
      toast(studio + ' ' + show + ' berhasil di-reset. Show dapat diisi ulang.');
      openDay(d.date); if ($('rl')) load();
    }).catch(function (x) { if (btn) btn.disabled = false; toast(x.message, 1); });
  }
  /* ---------- Admin: hapus satu atau beberapa show (aud_del per show; show lain tidak tersentuh) ---------- */
  function wireDel(d) {
    var bx = [].slice.call(document.querySelectorAll('[data-del]')), del = $('pn-del'), all = $('pn-all');
    if (!del || !bx.length) return;
    function upd() {
      var n = bx.filter(function (b) { return b.checked; }).length;
      del.disabled = !n; del.textContent = 'Reset terpilih (' + n + ')'; all.checked = n === bx.length; all.indeterminate = n > 0 && n < bx.length;
    }
    bx.forEach(function (b) { b.onchange = upd; });
    all.onchange = function () { bx.forEach(function (b) { b.checked = all.checked; }); upd(); };
    del.onclick = function () {
      var sel = bx.filter(function (b) { return b.checked; }).map(function (b) { var k = b.dataset.del.split('|'); return { studio: k[0], show: k[1] }; });
      if (!sel.length) return;
      var info = {}; d.studios.forEach(function (a) { a.shows.forEach(function (w) { info[a.studio + '|' + w.show] = w.film; }); });
      if (!window.confirm('Reset ' + sel.length + ' data show tanggal ' + dshort(d.date) + '?\n\n' + sel.map(function (x) { return '- ' + x.studio + ' ' + x.show + ' (' + (info[x.studio + '|' + x.show] || '-') + ')'; }).join('\n') + '\n\nIsian show di atas dikosongkan (kembali Belum Terisi). Show lain, tanggal lain, dan laporan harian tidak berubah; petugas lain dapat mengisinya kembali. Lanjutkan?')) return;
      del.disabled = true; all.disabled = true; var fail = [], ok = 0;
      sel.reduce(function (p, x) {
        return p.then(function () { return api('aud_del', { date: d.date, studio: x.studio, show: x.show, quiet: 1 }).then(function () { ok++; }, function (e) { fail.push(x.studio + ' ' + x.show + ': ' + e.message); }); });
      }, Promise.resolve()).then(function () {
        toast(fail.length ? ok + ' show di-reset, ' + fail.length + ' gagal: ' + fail.join('; ') : ok + ' data show berhasil di-reset.', !!fail.length);
        openDay(d.date); if ($('rl')) load();
      });
    };
  }

  /* ---------- formulir per show ---------- */
  function rowHtml(st, w) {
    var ok = w.status === 'Terisi', lock = ok && !w.editable, v = function (k) { return ok && w[k] != null ? esc(w[k]) : ''; }, dis = lock ? ' disabled' : '',
      n = +String(w.show).replace(/\D/g, '') || 0, rm = (!ok && n > REQ) ? '<button type="button" class="aud-rm" aria-label="Hapus ' + esc(w.show) + '">×</button>' : '';
    var orig = ok ? esc(JSON.stringify({ film: w.film, jam: w.jam, tiket: String(w.tiket), penonton: String(w.penonton), petugas: w.petugas, ket: w.ket, baseAt: w.baseAt })) : '';
    return '<div class="aud-row pn-r ' + (lock ? 'pn-lock' : '') + (ok ? ' pn-done' : '') + '" data-show="' + esc(w.show) + '" data-ok="' + (ok ? 1 : 0) + '" data-lock="' + (lock ? 1 : 0) + '" data-orig="' + orig + '"' + (lock ? ' title="Sudah diisi oleh ' + esc(w.petugas || '-') + '"' : '') + '>' +
      '<b class="aud-n"><span>' + esc(w.show) + ' <i class="pn-dot ' + (ok ? 'ok' : 'no') + '" aria-hidden="true"></i><span class="pn-vh">' + (ok ? 'Terisi' : 'Belum terisi') + '</span></span>' + rm + '</b>' +
      '<label class="aud-f aud-film"><span>Nama film</span><input class="af-film" type="text" maxlength="200" autocomplete="off" value="' + v('film') + '"' + dis + '></label>' +
      '<label class="aud-f"><span>Jam show</span><input class="af-jam" type="time" value="' + v('jam') + '"' + dis + '></label>' +
      '<label class="aud-f"><span>Tiket terjual</span><input class="af-tiket" type="number" min="0" step="1" inputmode="numeric" value="' + v('tiket') + '"' + dis + '></label>' +
      '<label class="aud-f"><span>Penonton masuk</span><input class="af-pen" type="number" min="0" step="1" inputmode="numeric" value="' + v('penonton') + '"' + dis + '></label>' +
      '<label class="aud-f"><span>Petugas</span><input class="af-ptg" type="text" maxlength="100" autocomplete="off" placeholder="' + esc(curU().name || '') + '" value="' + v('petugas') + '"' + dis + '></label>' +
      '<label class="aud-f aud-ket"><span>Keterangan</span><input class="af-ket" type="text" maxlength="500" autocomplete="off" value="' + v('ket') + '"' + dis + '></label></div>';
  }
  function studioHtml(a) {
    var rm = STD.indexOf(a.studio) < 0 && a.filled === 0;
    return '<section class="aud-st" data-s="' + esc(a.studio) + '"><div class="aud-sh"><h4>' + esc(a.studio) + '</h4><span class="aud-sum"></span>' + (rm ? '<button type="button" class="btn sec aud-rs">Hapus studio</button>' : '') + '</div>' +
      '<div class="aud-head" aria-hidden="true"><span>Show</span><span>Nama film</span><span>Jam show</span><span>Tiket terjual</span><span>Penonton masuk</span><span>Petugas</span><span>Keterangan</span></div>' +
      '<div class="aud-rows">' + a.shows.map(function (w) { return rowHtml(a.studio, w); }).join('') + '</div><button type="button" class="btn sec aud-as">+ Tambah show</button></section>';
  }
  function openForm(date, focus) {
    modal(window.OOS ? OOS.skel('detail') : '<div class="empty">Memuat...</div>');
    api('aud_day', { date: date }).then(function (d) { renderForm(d, focus); }).catch(function (x) { modal('<div class="empty">' + esc(x.message) + '</div>'); });
  }
  function renderForm(d, focus) {
    modal('<h3>Isi Data Penonton<span class="mid">per show</span></h3><form id="pnf" novalidate>' +
      '<label for="pnd">Tanggal *</label><input type="date" id="pnd" value="' + esc(d.date) + '" max="' + esc(today()) + '" required>' +
      '<p class="info">Setiap show (Tanggal + Studio + Show) hanya punya satu data. Anda boleh mengisi seluruh show, atau berbagi dengan petugas lain. Show yang sudah diisi petugas lain tampil terkunci; isi yang masih kosong. Data baru dapat diubah pengisinya selama 30 menit, selanjutnya oleh Admin.</p>' +
      '<div class="pn-sum pn-live"><div class="pn-k"><small>Status</small><span id="pn-st"></span></div><div class="pn-k"><small>Progres</small><span id="pn-pr"></span></div><div class="pn-k"><small>Tiket terjual</small><b id="pn-tt">0</b></div><div class="pn-k"><small>Penonton masuk</small><b id="pn-tp">0</b></div></div>' +
      '<div id="aud-list">' + d.studios.map(studioHtml).join('') + '</div>' +
      '<div class="acbar"><button type="button" class="btn sec" id="pn-as">+ Tambah studio</button></div>' +
      '<p class="merr" id="pn-warn" role="status" style="display:none"></p><div class="merr" id="re" role="alert"></div>' +
      '<div class="fact"><button type="submit" class="btn" id="pn-save">Simpan</button><button type="button" class="btn sec" id="pn-cancel">Batal</button></div></form>');
    wireForm(d, focus);
  }
  function rowVals(r) {
    var g = function (c) { return r.querySelector(c).value.trim(); };
    return { film: g('.af-film'), jam: g('.af-jam'), tiket: g('.af-tiket'), penonton: g('.af-pen'), petugas: g('.af-ptg'), ket: g('.af-ket') };
  }
  function origOf(r) { try { return JSON.parse(r.dataset.orig || 'null'); } catch (e) { return null; } }
  function changed(r) {
    if (r.dataset.lock === '1') return false;
    var v = rowVals(r), o = origOf(r);
    if (!o) return !!(v.film || v.jam || v.tiket !== '' || v.penonton !== '' || v.petugas || v.ket);
    return ['film', 'jam', 'tiket', 'penonton', 'petugas', 'ket'].some(function (k) { return String(v[k]) !== String(o[k] == null ? '' : o[k]); });
  }
  function wireForm(d0, focus) {
    var fm = $('pnf'), list = $('aud-list'), date = d0.date;
    function num(el) { var v = el.value.trim(); return /^\d+$/.test(v) ? +v : 0; }
    function sync() {
      var T = { f: 0, n: 0, tk: 0, pn: 0 }, ovl = [];
      [].forEach.call(list.querySelectorAll('.aud-st'), function (sec) {
        var f = 0, tk = 0, pn = 0, n = 0;
        [].forEach.call(sec.querySelectorAll('.aud-row'), function (r) {
          n++; T.n++;
          var has = r.dataset.ok === '1' || rowVals(r).film !== '';
          var dot = r.querySelector('.pn-dot'); if (dot) dot.className = 'pn-dot ' + (has ? 'ok' : 'no');
          if (has) { f++; tk += num(r.querySelector('.af-tiket')); pn += num(r.querySelector('.af-pen')); }
          var a = r.querySelector('.af-tiket').value.trim(), b = r.querySelector('.af-pen').value.trim(), o = /^\d+$/.test(a) && /^\d+$/.test(b) && +b > +a;
          r.classList.toggle('aud-over', o); if (o) ovl.push(sec.dataset.s + ' ' + r.dataset.show + ': penonton ' + NF.format(+b) + ' > tiket ' + NF.format(+a));
        });
        sec.querySelector('.aud-sum').textContent = f + '/' + n + ' show · ' + NF.format(tk) + ' tiket · ' + NF.format(pn) + ' penonton';
        T.f += f; T.tk += tk; T.pn += pn;
      });
      var p = { filled: T.f, total: T.n, pct: T.n ? Math.round(T.f * 100 / T.n) : 0 };
      $('pn-st').innerHTML = badge(T.f === T.n ? 'Terisi' : 'Belum Terisi'); $('pn-pr').innerHTML = prog(p);
      $('pn-tt').textContent = NF.format(T.tk); $('pn-tp').textContent = NF.format(T.pn);
      var wn = $('pn-warn'); wn.style.display = ovl.length ? '' : 'none';
      wn.innerHTML = ovl.length ? '&#9888; Penonton masuk melebihi tiket terjual (' + ovl.length + ' show): ' + esc(ovl.join('; ')) + '. Periksa kembali, atau jelaskan di Keterangan. Data tetap dapat disimpan.' : '';
      var as = $('pn-as'); if (as) as.disabled = list.querySelectorAll('.aud-st').length >= SMAX;
    }
    function newRow(sec) {
      var rows = sec.querySelector('.aud-rows'), last = rows.lastElementChild, k = last ? (+String(last.dataset.show).replace(/\D/g, '') || rows.children.length) : 0;
      if (rows.children.length >= RMAX) { $('re').textContent = 'Maksimal ' + RMAX + ' show per studio.'; return; }
      rows.insertAdjacentHTML('beforeend', rowHtml(sec.dataset.s, { show: 'SHOW' + (k + 1), status: 'Belum Terisi', editable: true }));
      $('re').textContent = ''; rows.lastElementChild.querySelector('.af-film').focus(); sync();
    }
    list.addEventListener('input', sync);
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var sec = b.closest('.aud-st');
      if (b.classList.contains('aud-as')) newRow(sec);
      else if (b.classList.contains('aud-rm')) { b.closest('.aud-row').remove(); sync(); }
      else if (b.classList.contains('aud-rs')) { var has = [].some.call(sec.querySelectorAll('input'), function (i) { return i.value !== ''; }); if (has && !window.confirm('Hapus ' + sec.dataset.s + ' beserta isinya?')) return; sec.remove(); sync(); }
    });
    $('pn-as').onclick = function () {
      var ss = list.querySelectorAll('.aud-st'), mx = 0;
      if (ss.length >= SMAX) { $('re').textContent = 'Maksimal ' + SMAX + ' studio.'; return; }
      [].forEach.call(ss, function (x) { mx = Math.max(mx, +String(x.dataset.s).replace(/\D/g, '') || 0); });
      var shows = []; for (var j = 1; j <= REQ; j++) shows.push({ show: 'SHOW' + j, status: 'Belum Terisi', editable: true });
      list.insertAdjacentHTML('beforeend', studioHtml({ studio: 'Studio ' + (mx + 1), filled: 0, shows: shows }));
      $('re').textContent = ''; list.lastElementChild.scrollIntoView({ block: 'center', behavior: 'smooth' }); sync();
    };
    $('pn-cancel').onclick = closeM;
    $('pnd').onchange = function () {
      var nd = $('pnd').value; if (!nd) { $('pnd').value = date; return; }
      var dirty = [].some.call(list.querySelectorAll('.aud-row'), changed);
      if (dirty && !window.confirm('Isian yang belum disimpan akan hilang. Ganti tanggal?')) { $('pnd').value = date; return; }
      openForm(nd);
    };
    fm.onsubmit = function (e) {
      e.preventDefault(); if (busy) return;
      var shows = [], er = '';
      [].forEach.call(list.querySelectorAll('.aud-st'), function (sec) {
        [].forEach.call(sec.querySelectorAll('.aud-row'), function (r) {
          if (er || !changed(r)) return;
          var v = rowVals(r), o = origOf(r), lbl = sec.dataset.s + ' ' + r.dataset.show;
          if (!v.film) er = 'Nama film wajib diisi (' + lbl + ').';
          else if (v.tiket === '' || v.penonton === '') er = 'Tiket terjual dan penonton masuk wajib diisi (' + lbl + ').';
          else if (!/^\d+$/.test(v.tiket) || !/^\d+$/.test(v.penonton)) er = 'Tiket terjual dan penonton masuk harus bilangan bulat 0 atau lebih (' + lbl + ').';
          else shows.push({ studio: sec.dataset.s, show: r.dataset.show, film: v.film, jam: v.jam, tiket: v.tiket, penonton: v.penonton, petugas: v.petugas, ket: v.ket, baseAt: o ? o.baseAt : 0 });
        });
      });
      var re = $('re'); re.textContent = er;
      if (er) return;
      if (!shows.length) { re.textContent = 'Belum ada show yang diisi atau diubah.'; return; }
      busy = true; var sb = $('pn-save'); sb.disabled = true; sb.textContent = 'Menyimpan...';
      api('aud_save', { date: $('pnd').value, shows: shows }).then(function (r) {
        busy = false; var s = r.saved || {};
        closeM(); toast('Data penonton tersimpan: ' + (s.created || 0) + ' show baru, ' + (s.updated || 0) + ' diubah. Terisi ' + r.progress.filled + ' dari ' + r.progress.total + ' show.');
        if ($('rl')) load();
      }).catch(function (x) {
        busy = false; sb.disabled = false; sb.textContent = 'Simpan';
        re.innerHTML = esc(x.message) + (/baru saja|sudah diisi oleh/.test(x.message) ? ' <button type="button" class="btn sec" id="pn-rl">Muat ulang data</button>' : '');
        if ($('pn-rl')) $('pn-rl').onclick = function () { openForm($('pnd').value); };
      });
    };
    sync();
    if (focus) {
      var sec = list.querySelector('.aud-st[data-s="' + focus.studio + '"]'), row = sec && sec.querySelector('.aud-row[data-show="' + focus.show + '"]');
      if (row) { row.classList.add('pn-focus'); row.scrollIntoView({ block: 'center' }); var fi = row.querySelector('.af-film'); if (fi && !fi.disabled) fi.focus(); }
    }
  }

  /* ---------- unduh Excel / PDF ---------- */
  function exportRange(fmt) {
    var f = $('pn-f').value, t = $('pn-t').value, td = today();
    if (!t) t = td; if (!f) f = t.slice(0, 8) + '01';
    var b = $(fmt === 'pdf' ? 'pn-pdf' : 'pn-xls'), b0 = b.textContent; b.textContent = 'Menyiapkan...';
    api('aud_range', { from: f, to: t }).then(function (r) {
      b.textContent = b0;
      if (!r.days.length) { toast('Tidak ada data penonton pada rentang ' + f + ' s/d ' + t + '.', 1); return; }
      if (fmt === 'pdf') toPdf(r); else toXlsx(r);
    }).catch(function (x) { b.textContent = b0; toast(x.message, 1); });
  }
  function flat(r) {
    var rows = [];
    r.days.forEach(function (d) { d.studios.forEach(function (a) { a.shows.forEach(function (w) { var ok = w.status === 'Terisi'; rows.push([d.date, a.studio, w.show, w.status, ok ? w.film : '', ok ? w.jam : '', ok ? w.tiket : '', ok ? w.penonton : '', ok ? w.petugas : '', ok ? w.ket : '', ok && w.over ? 'Penonton melebihi tiket' : '']); }); }); });
    return rows;
  }
  var HD = ['Tanggal', 'Studio', 'Show', 'Status', 'Nama Film', 'Jam', 'Tiket Terjual', 'Penonton Masuk', 'Petugas', 'Keterangan', 'Peringatan'];
  function toXlsx(r) {
    if (!window.XLSX) { toast('Library Excel belum termuat. Periksa koneksi internet lalu coba lagi.', 1); return; }
    var wb = XLSX.utils.book_new(), sum = [['Tanggal', 'Status', 'Show Terisi', 'Total Show', 'Progres (%)', 'Total Tiket Terjual', 'Total Penonton Masuk', 'Petugas']];
    r.days.forEach(function (d) { sum.push([d.date, d.status, d.progress.filled, d.progress.total, d.progress.pct, d.total.tiket, d.total.penonton, d.petugas.join(', ')]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), 'Laporan Harian');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HD].concat(flat(r))), 'Detail Show');
    XLSX.writeFile(wb, 'Data_Penonton_' + r.from + '_sd_' + r.to + '.xlsx');
  }
  function toPdf(r) {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('Library PDF belum termuat. Periksa koneksi internet lalu coba lagi.', 1); return; }
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    if (!doc.autoTable) { toast('Library PDF belum termuat. Periksa koneksi internet lalu coba lagi.', 1); return; }
    doc.setFontSize(14); doc.text('Laporan Harian Data Penonton', 14, 14); doc.setFontSize(9); doc.text(r.from + ' s/d ' + r.to, 14, 19);
    var y = 24;
    r.days.forEach(function (d, i) {
      if (i && y > 170) { doc.addPage(); y = 14; }
      doc.setFontSize(10); doc.text(d.date + '  |  ' + d.status + '  |  ' + d.progress.filled + '/' + d.progress.total + ' show  |  Tiket ' + NF.format(d.total.tiket) + '  |  Penonton ' + NF.format(d.total.penonton) + '  |  Petugas: ' + (d.petugas.join(', ') || '-'), 14, y);
      var body = []; d.studios.forEach(function (a) { a.shows.forEach(function (w) { var ok = w.status === 'Terisi'; body.push([a.studio, w.show, w.status, ok ? w.film : '', ok ? w.jam : '', ok ? w.tiket : '', ok ? w.penonton : '', ok ? w.petugas : '', ok ? w.ket : '']); }); });
      doc.autoTable({ startY: y + 2, head: [['Studio', 'Show', 'Status', 'Nama Film', 'Jam', 'Tiket', 'Penonton', 'Petugas', 'Keterangan']], body: body, styles: { fontSize: 7, cellPadding: 1 }, headStyles: { fillColor: [37, 22, 79] }, margin: { left: 14, right: 14 } });
      y = doc.lastAutoTable.finalY + 8; if (y > 180) { doc.addPage(); y = 14; }
    });
    doc.save('Data_Penonton_' + r.from + '_sd_' + r.to + '.pdf');
  }

  /* ---------- Admin: migrasi data lama + review ---------- */
  function sumTxt(r) { return 'Laporan lama: ' + r.laporanSumber + ' · item show: ' + r.itemSumber + '\nDipindahkan: ' + r.dimigrasi + '\nDuplikat identik digabung: ' + r.digabung + '\nPerlu review: ' + r.review + '\nSudah pernah dimigrasi (dilewati): ' + r.dilewati; }
  function migrate() {
    var b = $('pn-mig'); b.disabled = true;
    api('aud_migrate', { dryRun: true }).then(function (r) {
      b.disabled = false;
      if (!r.dimigrasi && !r.digabung && !r.review) { toast('Tidak ada data lama baru untuk dimigrasi (' + r.dilewati + ' item sudah pernah dimigrasi).'); return; }
      if (!window.confirm('Simulasi migrasi:\n\n' + sumTxt(r) + '\n\nData lama TIDAK dihapus atau diubah. Migrasi dapat dijalankan ulang tanpa duplikasi.\nLanjutkan migrasi?')) return;
      b.disabled = true;
      return api('aud_migrate', {}).then(function (x) { b.disabled = false; toast('Migrasi selesai. Dipindahkan ' + x.dimigrasi + ', digabung ' + x.digabung + ', perlu review ' + x.review + '.'); load(); });
    }).catch(function (x) { b.disabled = false; toast(x.message, 1); });
  }
  function openReview() {
    modal(window.OOS ? OOS.skel('detail') : '<div class="empty">Memuat...</div>');
    api('aud_review_list').then(function (l) {
      var h = '<h3>Review Migrasi Data Penonton<span class="mid">' + l.length + ' item</span></h3><p class="info">Item di bawah tidak aman dipetakan otomatis (tanggal/studio/show tidak valid, belum lengkap, atau bentrok dengan data lain). Koreksi bila perlu lalu <b>Terapkan</b>, atau <b>Abaikan</b>. Laporan lama tetap utuh.</p>';
      if (!l.length) h += '<div class="empty"><b>Tidak ada item review</b></div>';
      l.slice(0, 100).forEach(function (r, i) {
        h += '<section class="pn-rv" data-k="' + esc(r.sourceKey) + '"><p class="pn-why">&#9888; ' + esc(r.review) + '<br><small>Sumber: ' + esc(r.sourceId) + ' · ' + esc(r.reporter || '-') + '</small></p><div class="pn-rvf">' +
          [['date', 'Tanggal', r.date, 'text'], ['studio', 'Studio', r.studio, 'text'], ['show', 'Show', r.show, 'text'], ['film', 'Nama film', r.film, 'text'], ['jam', 'Jam', r.jam, 'time'], ['tiket', 'Tiket', r.tiket, 'number'], ['penonton', 'Penonton', r.penonton, 'number'], ['petugas', 'Petugas', r.petugas, 'text'], ['ket', 'Keterangan', r.ket, 'text']].map(function (f) {
            return '<label class="aud-f"><span>' + f[1] + '</span><input data-f="' + f[0] + '" type="' + f[3] + '" value="' + esc(f[2]) + '"' + (f[3] === 'number' ? ' min="0" step="1"' : '') + (f[0] === 'date' ? ' placeholder="YYYY-MM-DD"' : '') + '></label>';
          }).join('') + '</div><div class="fact"><button type="button" class="btn" data-a="ok">Terapkan</button><button type="button" class="btn sec" data-a="no">Abaikan</button></div><div class="merr"></div></section>';
      });
      if (l.length > 100) h += '<p class="info">Menampilkan 100 item pertama. Selesaikan, lalu buka ulang untuk melihat sisanya.</p>';
      h += '<div class="fact"><button type="button" class="btn sec" id="pn-close">Tutup</button></div>';
      modal(h);
      $('pn-close').onclick = function () { closeM(); if ($('rl')) load(); };
      [].forEach.call(document.querySelectorAll('.pn-rv [data-a]'), function (b) {
        b.onclick = function () {
          var sec = b.closest('.pn-rv'), k = sec.dataset.k, er = sec.querySelector('.merr'), fix = {};
          [].forEach.call(sec.querySelectorAll('[data-f]'), function (i) { fix[i.dataset.f] = i.value.trim(); });
          b.disabled = true; er.textContent = '';
          api(b.dataset.a === 'ok' ? 'aud_review_save' : 'aud_review_del', { sourceKey: k, fix: fix }).then(function (r) {
            sec.innerHTML = '<p class="acs">' + (b.dataset.a === 'ok' ? '&#10003; Diterapkan' + (r.replaced ? ' (menggantikan data aktif sebelumnya)' : '') + ': ' + esc(r.key) : 'Diabaikan.') + '</p>';
          }).catch(function (x) { b.disabled = false; er.textContent = x.message; });
        };
      });
    }).catch(function (x) { modal('<div class="empty">' + esc(x.message) + '</div>'); });
  }

  window.vPnt = vPnt;
  window.pntOpenForm = function () { openForm(today()); };
})();
