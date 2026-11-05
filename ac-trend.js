/* Grafik suhu AC per show di dashboard (Figma: "Grafik tren").
   Aturan: tiap area (studio) punya maksimal 5 show per hari. Setiap pengukuran AC yang terisi
   menjadi satu show, diurutkan menurut waktu input. Show yang belum diisi dibiarkan kosong (garis putus).
   Data diambil dari rep_list yang sama dengan panel "Monitoring AC hari ini"; backend tidak diubah.
   Dipanggil dari dAc() di app.js (window.acTrendHtml). Tidak memanggil API sendiri. */
(function () {
  'use strict';
  var SHOWS = 5;
  var ACD = ['TH1', 'TH2', 'TH3', 'TH4', 'KORIDOR', 'LOBBY'];
  var COL = { 'TH1': '#8064e9', 'TH2': '#218b69', 'TH3': '#c39339', 'TH4': '#2f6fd6', 'KORIDOR': '#be123c', 'LOBBY': '#71809b' };
  var W = 1000, H = 230, L = 52, R = 980, T = 16, B = 196;

  function acRowsOf(d) {
    d = d || {};
    if (Array.isArray(d.rows) && d.rows.length) return d.rows;
    return d.location ? [{ location: d.location, unit: d.unit, roomTemp: d.roomTemp }] : [];
  }
  function acV(a) {
    var v = a ? a.roomTemp : null;
    if (v === '' || v == null) return NaN;
    v = Number(String(v).replace(',', '.'));
    return isFinite(v) ? v : NaN;
  }
  function esc2(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function temp(v) { return String(Math.round(v * 100) / 100).replace('.', ','); }
  function hm(ms, fallback) {
    if (fallback) return fallback;
    var n = Number(ms); if (!n) return '';
    return new Date(n).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  }

  /* bangun seri per area: series[area][i] = {v, t} atau null (show i+1 belum diisi) */
  function build(items) {
    var sorted = items.slice().sort(function (a, b) { return (+a.createdAt || 0) - (+b.createdAt || 0); });
    var series = {}, std = null, count = {};
    sorted.forEach(function (x) {
      var d = x.data || {};
      if (!std && d.tempStd && isFinite(+d.tempStd.min) && isFinite(+d.tempStd.max)) std = { min: +d.tempStd.min, max: +d.tempStd.max };
      acRowsOf(d).forEach(function (a) {
        var k = String(a.location || '').trim().toUpperCase();
        if (ACD.indexOf(k) < 0) return;
        var v = acV(a);
        if (isNaN(v)) return;                       /* studio kosong / tidak ada show: tidak dihitung sebagai suhu */
        count[k] = count[k] || 0;
        if (count[k] >= SHOWS) return;              /* maksimal 5 show per area per hari */
        series[k] = series[k] || [];
        series[k][count[k]] = { v: v, t: hm(x.createdAt, d.time) };
        count[k]++;
      });
    });
    return { series: series, std: std || { min: 23, max: 23.5 } };
  }

  function svg(s) {
    var vals = [];
    Object.keys(s.series).forEach(function (k) { s.series[k].forEach(function (p) { if (p) vals.push(p.v); }); });
    var lo = Math.min.apply(null, vals.concat([s.std.min])) - 1, hi = Math.max.apply(null, vals.concat([s.std.max])) + 1;
    lo = Math.floor(lo); hi = Math.ceil(hi); if (hi - lo < 4) hi = lo + 4;
    function y(v) { return B - (v - lo) / (hi - lo) * (B - T); }
    function x(i) { return L + i * (R - L) / (SHOWS - 1); }
    var g = '';
    /* sumbu Y: garis bantu tiap 1 derajat dipilih secara adaptif */
    var step = Math.ceil((hi - lo) / 6);
    for (var v = lo; v <= hi; v += step) {
      g += '<line x1="' + L + '" x2="' + R + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" class="act-grid"/>';
      g += '<text x="' + (L - 10) + '" y="' + (y(v) + 4).toFixed(1) + '" class="act-ax" text-anchor="end">' + v + '°</text>';
    }
    /* pita standar suhu */
    g += '<rect x="' + L + '" y="' + y(s.std.max).toFixed(1) + '" width="' + (R - L) + '" height="' + (y(s.std.min) - y(s.std.max)).toFixed(1) + '" class="act-band"/>';
    for (var i = 0; i < SHOWS; i++) {
      g += '<text x="' + x(i).toFixed(1) + '" y="' + (B + 22) + '" class="act-ax" text-anchor="middle">Show ' + (i + 1) + '</text>';
    }
    Object.keys(COL).forEach(function (k) {
      var arr = s.series[k]; if (!arr) return;
      var seg = '', pts = '';
      for (var j = 0; j < SHOWS; j++) {
        var p = arr[j];
        if (!p) { seg = ''; continue; }
        var px = x(j).toFixed(1), py = y(p.v).toFixed(1);
        seg += (seg ? ' L' : 'M') + px + ' ' + py;
        pts += '<circle cx="' + px + '" cy="' + py + '" r="4.5" fill="' + COL[k] + '" stroke="#fff" stroke-width="2"><title>' + esc2(k) + ' · Show ' + (j + 1) + (p.t ? ' (' + esc2(p.t) + ')' : '') + ': ' + temp(p.v) + '°C</title></circle>';
      }
      /* garis hanya menghubungkan show yang berurutan; show kosong memutus garis */
      var paths = [], cur = '';
      for (var q = 0; q < SHOWS; q++) {
        var pp = arr[q];
        if (!pp) { if (cur) paths.push(cur); cur = ''; continue; }
        cur += (cur ? ' L' : 'M') + x(q).toFixed(1) + ' ' + y(pp.v).toFixed(1);
      }
      if (cur) paths.push(cur);
      paths.forEach(function (d) { g += '<path d="' + d + '" fill="none" stroke="' + COL[k] + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'; });
      g += pts;
    });
    return '<svg class="act-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafik suhu AC per show hari ini" preserveAspectRatio="xMidYMid meet">' + g + '</svg>';
  }

  function legend(s) {
    return '<div class="act-leg">' + ACD.map(function (k) {
      var n = (s.series[k] || []).filter(Boolean).length;
      return '<span class="act-chip' + (n ? '' : ' off') + '"><i style="background:' + (COL[k] || '#71809b') + '"></i>' + esc2(k) +
        '<small>' + (n ? n + ' dari ' + SHOWS + ' show' : 'belum diisi') + '</small></span>';
    }).join('') + '</div>';
  }

  function html(s) {
    var any = Object.keys(s.series).length > 0;
    return '<div class="act-head"><b>Grafik suhu per show</b><small>Maks. ' + SHOWS + ' show per studio per hari · standar ' +
      temp(s.std.min) + '–' + temp(s.std.max) + '°C</small></div>' +
      (any ? '<div class="act-scroll">' + svg(s) + '</div>' + legend(s) : '<p class="act-empty">Belum ada pengukuran suhu hari ini. Grafik terisi setelah pengukuran AC dicatat per show.</p>');
  }

  /* dipanggil dari dAc() (app.js) dengan daftar laporan AC hari ini yang sudah dimuat */
  window.acTrendHtml = function (items) {
    return '<div class="act-wrap">' + html(build(items || [])) + '</div>';
  };
})();
