/* NOVA — pembangun PDF bersama (DCP Management, Pelaporan DCP, Daily Film Testing, daftar laporan).
   Satu tempat untuk: header (logo XXI + NOVA, judul, nomor), footer identitas ("NOVA — An Innovation by MK",
   "Designed & Developed by MK"), nomor halaman "k / n" di SETIAP halaman, tabel yang berlanjut antarhalaman
   dengan header berulang, bagian foto dokumentasi, dan pembersihan karakter yang tidak didukung font bawaan jsPDF.
   Bergantung pada jsPDF + autoTable (dimuat lazy di index.html) dan pdfLogos()/OOS_BRAND dari app.js. */
(function () {
  'use strict';
  var HEAD = 32, FOOT = 16;
  var FALLBACK = { vio: [37, 22, 79], acc: [98, 70, 217], ink: [30, 27, 46], mute: [110, 104, 130], tint: [243, 240, 252], line: [225, 221, 236] };
  function B() { return window.OOS_BRAND || FALLBACK; }

  /* font bawaan jsPDF (WinAnsi) menampilkan karakter di luar Latin-1 sebagai sampah (mis. "→"). */
  function clean(v) {
    if (v == null) return '';
    return String(v)
      .replace(/→/g, '->').replace(/←/g, '<-').replace(/[≥]/g, '>=').replace(/[≤]/g, '<=')
      .replace(/[✓✔]/g, 'v').replace(/[✗✘]/g, 'x').replace(/[   ]/g, ' ')
      .replace(/[^\u0009\u000A -~¡-ÿ–—‘’“”•…€]/g, '');
  }
  function cleanRows(rows) { return (rows || []).map(function (r) { return r.map(clean); }); }
  function ts() {
    try { return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).replace(/\./g, ':') + ' WIB'; }
    catch (e) { return new Date().toISOString(); }
  }

  /* Header + footer pada semua halaman. Dipanggil SETELAH seluruh isi digambar. */
  function stamp(doc, o) {
    o = o || {};
    var c = B(), pc = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = o.margin || 12, k;
    for (k = 1; k <= pc; k++) {
      doc.setPage(k);
      doc.setFillColor.apply(doc, c.vio); doc.rect(0, 0, W, HEAD - 3, 'F');
      doc.setFillColor.apply(doc, c.acc); doc.rect(0, HEAD - 3, W, 1.2, 'F');
      var lw = 0;
      try { if (window.pdfLogos) lw = window.pdfLogos(doc, M, 3.5, 12, 'left', W, M) || 0; } catch (e) { lw = 0; }
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('NOVA Operational Management System  |  Sukaramai Trade Center XXI', W - M, 9, { align: 'right' });
      doc.setFontSize(13);
      doc.text(clean(o.title || ''), M, 25, { maxWidth: W - 2 * M - 52 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      if (o.id) doc.text(clean(o.id), W - M, 25, { align: 'right' });
      doc.setDrawColor.apply(doc, c.line); doc.setLineWidth(.2); doc.line(M, H - 13, W - M, H - 13);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, c.vio);
      doc.text('NOVA — An Innovation by MK', M, H - 8.5);
      doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, c.mute);
      doc.text('Designed & Developed by MK', M, H - 4.5);
      doc.text('Diekspor ' + ts() + (o.user ? '  |  ' + clean(o.user) : ''), W / 2, H - 4.5, { align: 'center' });
      doc.text('Halaman ' + k + ' / ' + pc, W - M, H - 8.5, { align: 'right' });
    }
  }

  function heading(doc, text, x, y, size) {
    var c = B();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(size || 11); doc.setTextColor.apply(doc, c.vio); doc.text(clean(text), x, y);
  }


  /* ---- Tata letak foto otomatis (satu mesin untuk semua PDF NOVA) ----
     Baris "rata" (justified): tiap baris berisi 1..maxCols foto dengan TINGGI SAMA dan lebar sesuai rasio aslinya,
     sehingga portrait, landscape, dan persegi tersusun rapat tanpa dipotong (tidak ada crop, rasio tidak diubah).
     Jumlah foto per baris dipilih agar tinggi baris mendekati `target`. Bila baris tidak muat di sisa halaman,
     urutan upaya: (1) jumlah kolom lain yang muat penuh, (2) kecilkan, tetapi tidak pernah di bawah batas keterbacaan minH/minW (default 46 mm tinggi, 32 mm lebar), (3) pindah halaman.
     Foto tidak pernah dipecah antarhalaman, dan halaman baru tidak dibuat selama masih ada ruang layak.
     o: {x,y,w,top,bottom,gap,capH,maxCols,target,hmax,fitMin,rowGap,headH,drawHead(y),caption(g,i,x,y,w),frame(g,x,y,w,h)}
     list: [{data,w,h,...}]  Mengembalikan {y,pages,rows,placed:[{i,page,x,y,w,h}]} */
  function photoPlan(list, o, scale) {
    var X = o.x, AW = o.w, gap = o.gap == null ? 5 : o.gap, capH = o.capH == null ? 9 : o.capH, rowGap = o.rowGap == null ? 4 : o.rowGap,
        maxCols = o.maxCols || 3, target = (o.target || 66) * scale, hmax = o.hmax || 110, minH = o.minH || 46, minW = o.minW || 32,
        top = o.top, bot = o.bottom, y = o.y, i = 0, pg = 0, items = [], startNew = false, rows = 0;
    var L = list.map(function (g) { return (g && g.w > 0 && g.h > 0) ? g.w / g.h : 1; });
    /* batas keterbacaan: tinggi >= minH dan lebar foto tersempit >= minW. Foto tidak pernah dikecilkan di bawah batas ini. */
    function cand(k, from) {
      var sa = 0, mina = 1e9, j; for (j = 0; j < k; j++) { sa += L[from + j]; if (L[from + j] < mina) mina = L[from + j]; }
      return { k: k, h: Math.min((AW - gap * (k - 1)) / sa, hmax), req: Math.max(minH, minW / mina) };
    }
    if (o.headH) {
      if (y + o.headH + minH + capH > bot && y > top + 1) { startNew = true; y = top; }
      y += o.headH;
    }
    while (i < L.length) {
      var K = Math.min(maxCols, L.length - i), cs = [], k, best, pick, ok;
      for (k = 1; k <= K; k++) cs.push(cand(k, i));
      ok = cs.filter(function (c) { return c.h >= c.req - 1e-6; }); if (!ok.length) ok = [cs[0]];
      best = ok.reduce(function (a, b) { return Math.abs(b.h - target) < Math.abs(a.h - target) ? b : a; });
      var avail = bot - y - capH; pick = best;
      if (best.h > avail) {
        var fit = ok.filter(function (c) { return c.h <= avail; }).sort(function (a, b) { return b.h - a.h; })[0];
        if (fit && fit.h >= avail * 0.85) pick = fit;                                              /* (1) jumlah kolom lain yang muat penuh */
        else if (avail >= Math.max(best.req, best.h * 0.6)) pick = { k: best.k, h: avail };        /* (2) kecilkan, tetap >= batas keterbacaan */
        else if (fit) pick = fit;
        else if (y > top + 1) { pg++; y = top; continue; }                                         /* (3) halaman baru */
        else pick = { k: best.k, h: Math.max(avail, 10) };
      }
      var cx = X, j;
      for (j = 0; j < pick.k; j++) { var w = pick.h * L[i + j]; items.push({ i: i + j, page: pg, x: cx, y: y, w: w, h: pick.h }); cx += w + gap; }
      y += pick.h + capH + rowGap; i += pick.k; rows++;
    }
    return { items: items, pages: pg + (startNew ? 1 : 0), startNew: startNew, endY: y, rows: rows, scale: scale };
  }
  function photoFlow(doc, list, o) {
    var mc = o.maxCols || 3, cands = [], plan = null, ci, mn = 1e9, pl, cols, sc,
        SC = [1.2, 1.1, 1, .92, .85, .78, .7, .62, .55];
    /* Cari jumlah halaman minimum (kolom normal, lalu +1 kolom). Dari susunan yang mencapai jumlah halaman itu,
       ambil yang fotonya TERBESAR (skala tertinggi, kolom paling sedikit) agar ruang halaman terpakai optimal. */
    for (cols = mc; cols <= mc + 1; cols++) for (sc = 0; sc < SC.length; sc++) {
      pl = photoPlan(list, Object.assign({}, o, { maxCols: cols }), SC[sc]); cands.push(pl); if (pl.pages < mn) mn = pl.pages;
    }
    for (ci = 0; ci < cands.length && !plan; ci++) if (cands[ci].pages === mn) plan = cands[ci];
    var pg0 = doc.getNumberOfPages ? doc.getNumberOfPages() : 1, cur = 0, placed = [];
    function defFrame(g, x, yy, w, h) {
      doc.setDrawColor(200, 194, 220); doc.setLineWidth(.25); doc.rect(x - .5, yy - .5, w + 1, h + 1);
      try { doc.addImage(g.data, 'JPEG', x, yy, w, h); } catch (e) {}
    }
    function defCap(g, idx, x, yy, w) {
      if (!g.caption) return;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(30, 27, 46);
      doc.text(doc.splitTextToSize((idx + 1) + '. ' + clean(g.caption), w).slice(0, 2), x, yy + 4);
    }
    if (plan.startNew) { doc.addPage(); cur++; }
    if (o.headH && o.drawHead) o.drawHead(plan.startNew ? o.top : o.y);
    plan.items.forEach(function (it) {
      while (cur < it.page + (plan.startNew ? 1 : 0)) { doc.addPage(); cur++; }
      var g = list[it.i];
      placed.push({ i: it.i, page: pg0 + cur, x: it.x, y: it.y, w: it.w, h: it.h });
      (o.frame || defFrame)(g, it.x, it.y, it.w, it.h);
      (o.caption || defCap)(g, it.i, it.x, it.y + it.h, it.w);
    });
    return { y: plan.endY, pages: plan.pages, rows: plan.rows, placed: placed, scale: plan.scale };
  }

  /* spec: {title,id,user,orient,file,margin,blocks:[...]}  blok:
     {t:'pairs',rows:[[k,v]]} | {t:'table',title,head,rows,fs,colStyles,foot} | {t:'h',text} | {t:'note',text} | {t:'photos',title,list:[{data,w,h,caption}]} | {t:'page'} */
  function render(spec) {
    var J = window.jspdf.jsPDF, c = B();
    var doc = new J({ unit: 'mm', format: 'a4', orientation: spec.orient === 'landscape' ? 'landscape' : 'portrait' });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = spec.margin || 12, TOP = HEAD + 6, BOT = H - FOOT - 2;
    var y = TOP;
    doc.setProperties({ title: clean(spec.title), author: clean(spec.user || 'NOVA'), creator: 'NOVA — An Innovation by MK' });
    function need(h) { if (y + h > BOT) { doc.addPage(); y = TOP; } }
    (spec.blocks || []).forEach(function (b) {
      if (b.t === 'page') { doc.addPage(); y = TOP; return; }
      if (b.t === 'h') { need(b.keep || 12); heading(doc, b.text, M, y + 4, b.size); y += 9; return; }
      if (b.t === 'note') {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, c.mute);
        var ln = doc.splitTextToSize(clean(b.text), W - 2 * M); need(ln.length * 4.5 + 2); doc.text(ln, M, y + 3); y += ln.length * 4.5 + 3; return;
      }
      if (b.t === 'pairs') {
        doc.autoTable({ startY: y, margin: { left: M, right: M, top: TOP, bottom: FOOT + 2 }, body: cleanRows(b.rows), theme: 'grid', styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak', valign: 'middle', textColor: c.ink, lineColor: c.line, lineWidth: .2 }, columnStyles: { 0: { cellWidth: b.keyW || 46, fontStyle: 'bold', fillColor: c.tint, textColor: c.vio } } });
        y = doc.lastAutoTable.finalY + 7; return;
      }
      if (b.t === 'table') {
        /* tabel kecil (<= 8 baris) dijaga utuh di satu halaman; judul tidak ditinggal sendirian di dasar halaman */
        if (b.rows.length <= 8) need(b.rows.length * 7 + 22); else if (b.title) need(24);
        if (b.title) { heading(doc, b.title, M, y + 4); y += 7; }
        doc.autoTable({
          startY: y, margin: { left: M, right: M, top: TOP, bottom: FOOT + 2 }, head: [b.head.map(clean)], body: cleanRows(b.rows), foot: b.foot ? [b.foot.map(clean)] : undefined,
          theme: 'grid', showHead: 'everyPage', rowPageBreak: 'avoid',
          styles: { fontSize: b.fs || 8.5, cellPadding: 1.8, overflow: 'linebreak', valign: 'top', textColor: c.ink, lineColor: c.line, lineWidth: .2 },
          headStyles: { fillColor: c.vio, textColor: 255, fontStyle: 'bold' }, footStyles: { fillColor: c.tint, textColor: c.vio, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [250, 249, 253] }, columnStyles: b.colStyles || {},
          didParseCell: b.onCell
        });
        y = doc.lastAutoTable.finalY + 7; return;
      }
      if (b.t === 'photos') {
        var list = b.list || [], ttl = (b.title || 'Foto dokumentasi') + ' (' + list.length + ')';
        if (!list.length) { need(24); heading(doc, ttl, M, y + 4); y += 8; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, c.mute); doc.text('Tidak ada foto dokumentasi.', M, y + 3); y += 8; return; }
        var r = photoFlow(doc, list, { x: M, y: y, w: W - 2 * M, top: TOP, bottom: BOT, maxCols: W > 250 ? 4 : 3, target: W > 250 ? 62 : 66, hmax: W > 250 ? 90 : 110,
          headH: 8, drawHead: function (yy) { heading(doc, ttl, M, yy + 4); } });
        y = r.y; return;
      }
    });
    stamp(doc, { title: spec.title, id: spec.id, user: spec.user, margin: M });
    return doc;
  }

  /* foto: URL data: -> {data(JPEG),w,h}; maksimum sisi 2400px, JPEG q0.92 (rasio asli, tanpa crop) */
  function loadPhoto(url, caption) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        try {
          var s = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas');
          cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
          var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
          res({ data: cv.toDataURL('image/jpeg', .92), w: cv.width, h: cv.height, caption: caption });
        } catch (e) { res(null); }
      };
      im.onerror = function () { res(null); };
      im.src = url;
    });
  }

  window.NovaPDF = { HEAD: HEAD, FOOT: FOOT, clean: clean, stamp: stamp, render: render, photoFlow: photoFlow, loadPhoto: loadPhoto, ts: ts };
})();
