/* Draf foto laporan: foto yang sudah dipilih disimpan di perangkat (IndexedDB) per akun dan per jenis laporan,
   sehingga tidak hilang jika aplikasi/halaman tertutup sebelum laporan dikirim. Draf dihapus setelah laporan tersimpan. */
(function () {
  var DBNAME = 'stc_drafts', STORE = 'kv', dbp = null, T = null;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DBNAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { dbp = null; rej(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, mode), q = fn(t.objectStore(STORE));
        t.oncomplete = function () { res(q ? q.result : undefined); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error); };
      });
    });
  }
  var kvPut = function (k, v) { return tx('readwrite', function (s) { return s.put(v, k); }); };
  var kvGet = function (k) { return tx('readonly', function (s) { return s.get(k); }); };
  var kvDel = function (k) { return tx('readwrite', function (s) { return s.delete(k); }); };

  function phSave(form) {
    var key = form.dataset.draftKey;
    if (!key || !form._getPh) return;
    var list = form._getPh().map(function (p) {
      return { rid: p.rid, kind: p.kind, mime: p.mime, b64: p.b64, capturedAt: p.capturedAt };
    });
    (list.length ? kvPut(key + '_photos', list) : kvDel(key + '_photos')).catch(function () {});
  }

  function thumb(p, i) {
    return '<div><img src="' + p.url + '" alt=""><button type="button" class="x" data-i="' + i + '">×</button></div>';
  }

  window.draftPhotosRestore = function (form) {
    var key = form.dataset.draftKey;
    if (!key || !form._setPh) return;
    kvGet(key + '_photos').then(function (list) {
      if (!Array.isArray(list) || !list.length) return;
      form._setPh(list.map(function (p) {
        return { rid: p.rid, kind: p.kind, mime: p.mime, b64: p.b64, capturedAt: p.capturedAt, url: 'data:' + p.mime + ';base64,' + p.b64 };
      }));
      var PH = form._getPh();
      [].forEach.call(document.querySelectorAll('[id^="pv_"]'), function (el) {
        var id = el.id.slice(3);
        el.innerHTML = PH.map(function (p, i) {
          return (String(p.kind) === id || String(p.rid) === id) ? thumb(p, i) : '';
        }).join('');
      });
      var apc = document.getElementById('apc');
      if (apc) apc.textContent = 'Foto: ' + PH.length + ' / 50';
      if (window.toast) toast('Foto draf laporan dipulihkan (' + PH.length + ' foto).');
    }).catch(function () {});
  };

  // Simpan otomatis setiap kali pratinjau foto berubah (tambah, hapus, atau baris dihapus)
  var mbox = document.getElementById('mbox');
  if (mbox && window.MutationObserver) {
    new MutationObserver(function () {
      var f = document.getElementById('rfm');
      if (!f || !f.dataset.draftKey) return;
      clearTimeout(T);
      T = setTimeout(function () { phSave(f); }, 300);
    }).observe(mbox, { childList: true, subtree: true });
  }

  // Setelah laporan berhasil dikirim, hapus draf teks sekaligus draf foto
  var _dc = window.draftClear;
  window.draftClear = function (f) {
    var k = f && f.dataset && f.dataset.draftKey;
    _dc(f);
    if (k) kvDel(k + '_photos').catch(function () {});
  };
})();
