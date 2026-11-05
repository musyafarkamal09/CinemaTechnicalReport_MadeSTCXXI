/* Outlet Operation System - indikator muat (frontend saja, tidak menyentuh backend).
   1. Garis tipis di tepi atas  -> ada permintaan ke server yang berjalan di belakang layar.
   2. Kerangka (skeleton)        -> bentuk halaman/daftar/detail yang akan tampil, dipakai saat pindah halaman
                                    dan saat laporan dimuat. OOS.skel(jenis) mengembalikan HTML-nya.
   3. Layar masuk                -> logo dan garis progres; tanpa animasi berputar atau pesan yang berganti. */
(function () {
  'use strict';

  var busy = 0;

  function el(id) { return document.getElementById(id); }

  /* jumlah permintaan aktif -> garis progres di atas */
  function busyDelta(d) {
    busy = Math.max(0, busy + d);
    var b = el('oosBeam');
    if (b) b.classList.toggle('on', busy > 0);
  }

  /* layar masuk: hanya menampilkan pesan statis */
  function splash(on, label) {
    var s = el('oosSplash');
    if (!s) return;
    if (label) { var m = el('oosMsg'); if (m) m.textContent = label; }
    s.classList.toggle('hidden', !on);
    s.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function bar(w, h, mt) {
    return '<i class="oos-sk" style="width:' + w + ';height:' + (h || 12) + 'px;margin-top:' + (mt || 0) + 'px"></i>';
  }

  var KIND = {
    /* pindah halaman: judul, kartu ringkasan, lalu baris daftar */
    page: function () {
      var kpi = '<div class="oos-sk-kpi">' + [0, 1, 2, 3].map(function () { return '<div class="oos-sk-card">' + bar('40%', 10) + bar('60%', 22, 14) + '</div>'; }).join('') + '</div>';
      return '<div class="oos-sk-wrap" role="status" aria-label="Memuat halaman">' + bar('260px', 26) + bar('180px', 10, 8) + kpi +
        '<div class="oos-sk-card oos-sk-list">' + [0, 1, 2, 3, 4].map(function () { return '<div class="oos-sk-row">' + bar('34px', 34) + '<div class="oos-sk-txt">' + bar('46%', 12) + bar('28%', 9, 6) + '</div></div>'; }).join('') + '</div></div>';
    },
    /* daftar laporan (tabel) */
    list: function () {
      return '<div class="oos-sk-wrap" role="status" aria-label="Memuat laporan">' +
        '<div class="oos-sk-card oos-sk-list">' + [0, 1, 2, 3, 4, 5].map(function () {
          return '<div class="oos-sk-row oos-sk-tr">' + bar('18%', 10) + bar('22%', 10) + bar('30%', 10) + bar('14%', 10) + '</div>';
        }).join('') + '</div></div>';
    },
    /* detail laporan di dalam modal */
    detail: function () {
      var rows = [0, 1, 2, 3, 4, 5].map(function () { return '<div class="oos-sk-kv">' + bar('34%', 10) + bar('52%', 12) + '</div>'; }).join('');
      return '<div class="oos-sk-wrap" role="status" aria-label="Memuat laporan">' + bar('55%', 22) + bar('22%', 10, 8) +
        '<div style="margin-top:18px">' + rows + '</div>' + bar('100%', 90, 18) + '</div>';
    }
  };

  function skel(kind) { return (KIND[kind] || KIND.page)(); }

  window.OOS = { busy: busyDelta, splash: splash, skel: skel, inline: function () { return skel('detail'); } };
})();
