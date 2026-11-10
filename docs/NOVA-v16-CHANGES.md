# NOVA v16 — Professional Refinement

NOVA — An Innovation by MK · Designed & Developed by MK

Lanjutan v15. Semua fitur, histori, integrasi, dan skema data dipertahankan. v16 fokus pada keamanan tampilan data, aksesibilitas, pembersihan CSS mati, dan pengujian regresi.

## Temuan dan perbaikan
| # | Temuan (akar masalah) | Perbaikan |
|---|---|---|
| 1 | **XSS tersimpan** di halaman Pengguna: nama role yang tidak dikenal ditulis ke HTML tanpa escape (`rn()` mengembalikan teks mentah). Ditemukan oleh tes regresi baru. | `esc(rn(u.role))` pada tabel pengguna |
| 2 | Nilai dari server ditulis ke atribut/HTML tanpa `esc()`: `poster`, `deleteAt` (kartu film), `userId` (tombol Edit/Buka blokir/Reset), `status` pengguna, `role` (Audit Log), `version` (Penyimpanan Data), `qty` (Pembelian), `from/to` (filter meteran), `p.url` (pratinjau foto) | Semua dibungkus `esc()`; `drafts.js` menetralkan tanda kutip pada URL pratinjau |
| 3 | Reset password memakai `prompt()` bawaan browser: password tampil jelas di layar, tidak bisa divalidasi, tidak konsisten dengan UI | Modal NOVA dengan input tersamar, `minlength=8`, `autocomplete=new-password`, pesan galat `role="alert"` |
| 4 | Formulir: fokus keyboard tertinggal di halaman belakang saat formulir dibuka; setelah ditutup fokus hilang | Fokus masuk ke kolom pertama saat dibuka, kembali ke tombol pemicu saat ditutup |
| 5 | Banyak `<label>` tanpa `for`/id sehingga kolom tidak punya nama aksesibel dan mengetuk label tidak memfokuskan kolom | `ux.js`: `aria-labelledby` otomatis + klik label memfokuskan kolom. **id kolom sengaja tidak diubah** karena kunci draf lokal memakai id kolom |
| 6 | Foto lampiran tanpa `alt` | `alt="Foto lampiran"` |
| 7 | Versi backend masih tertulis `v12-notif-cache` | `v16-refinement` (tes disesuaikan) |

## Pembersihan kode
- CSS mati dihapus setelah dipastikan tidak ada di JS/HTML (juga tidak dibangun dinamis lewat awalan string): `lthm sfoot dh-main dh-t qrow ds ds-big ds-list ds-st dm dact ai-m cax mdet outlet-sel lpane fp-crumb pel-bar dx-lb dng ghost cue`.
- 149 aturan dihapus: `legacy-modules.css` 80.085 → 73.193 B, `figma.css` 23.091 → 22.109 B, `nova.css` 15.478 → 15.307 B, `nova-ds.css` 19.172 → 19.058 B (total ≈ 8,2 KB).
- Kelas yang dibentuk dinamis (`st-*`, `ann-*`, `mdc-*`, `fs-*`) **tidak** disentuh.
- Lora dipertahankan: dipakai logo "XXI" sesuai spesifikasi Figma (3–4 elemen).

## Pengoptimalan
- `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- Cache service worker `nova-v16`; versi aset dinaikkan (cache-busting).

## File berubah
`app.js`, `ux.js`, `drafts.js`, `index.html`, `sw.js`, `legacy-modules.css`, `figma.css`, `nova.css`, `nova-ds.css`, `backend/Code.gs` (hanya string versi), `tests/test_backend.js`.
Baru: `tests/browser/v16.js`, `tests/run-all.sh`, `NOVA-v16-CHANGES.md`, `TEST-RESULTS-v16.md`.

## Tata letak foto dokumentasi di PDF (tambahan v16)
Satu mesin tata letak bersama, `NovaPDF.photoFlow` (di `pdfkit.js`), kini dipakai oleh semua generator PDF: laporan tunggal (`repPdf`), lampiran foto pada ekspor daftar laporan, serta DCP, Daily Film Testing, dan Pelaporan DCP (blok `photos`).

| Permintaan | Penerapan |
|---|---|
| Foto tepat di bawah tabel, bukan otomatis halaman baru | Foto mulai di halaman yang sama dengan tabel selama judul + satu baris foto masih muat. Sebelumnya `repPdf` pindah halaman bila sisa < 70 mm, dan ekspor daftar selalu memakai halaman baru |
| Rasio otomatis tanpa crop | Baris "rata": setiap baris berisi 1–3 foto (4 di landscape) dengan tinggi sama dan lebar mengikuti rasio asli. Portrait, landscape, dan persegi bercampur tanpa dipotong atau diregangkan |
| Ruang halaman dimanfaatkan | Jumlah foto per baris dipilih agar tinggi mendekati target. Sisa ruang diisi dengan menyesuaikan jumlah kolom atau mengecilkan baris |
| Dinamis menurut jumlah/dimensi/ruang | Mesin mencoba beberapa skala dan jumlah kolom, memilih susunan dengan halaman paling sedikit, lalu memakai foto terbesar di antara yang sama |
| Lanjut ke halaman berikutnya konsisten | Foto dan keterangannya tidak pernah terpecah antarhalaman; judul tidak ditinggal sendirian di dasar halaman; tidak ada halaman kosong |
| Foto tetap jelas | **Batas keterbacaan keras:** tinggi ≥ 46 mm dan lebar foto tersempit ≥ 32 mm. Mengejar halaman lebih sedikit tidak pernah mengecilkan foto di bawah batas ini. Foto disimpan sampai 1400 px (≥ 300 dpi pada ukuran cetak maksimum) |
| Logo, header, footer, identitas | Tidak diubah (`stamp()` tetap dipanggil setelah isi digambar) |

Konsekuensinya: foto sangat tinggi (mis. 9:16) bisa membuat halaman terisi sekitar 50–60% karena batas lebar minimum; ini disengaja demi keterbacaan.

File: `pdfkit.js`, `app.js` (`repPdf`, ekspor daftar), `index.html` (versi aset). Tes baru: `tests/test_photoflow.js` (47 skenario geometri), `tests/browser/pdf-foto.js` (`repPdf` dengan 0–25 foto, berbagai rasio).
Belum diuji: PDF hasil jsPDF asli secara visual (tes memakai perekam jsPDF dan skema tata letak); mohon unduh satu laporan dengan banyak foto campuran dan periksa sekali.

## Catatan jujur (batas pekerjaan)
- **Desain tidak diubah besar-besaran**: sesuai ketentuan "hindari redesign yang tidak perlu", tampilan v15 (nova-ds.css, DESIGN.md) dipertahankan. Tidak ada perubahan visual baru kecuali penghapusan aturan mati.
- **Skill Impeccable**: skrip `impeccable context` tidak dijalankan; panduan dan DESIGN.md dibaca langsung dan dipakai sebagai acuan.
- **Belum diverifikasi**: tampilan PDF dengan jsPDF asli (tes memakai perekam jsPDF), backend Apps Script yang sungguhan di-deploy (hanya diuji lewat tes unit/mock), dan file Figma (tidak terunggah).
- Tidak dilakukan: minifikasi `app.js` (327 KB) dan pemecahan modul — berisiko merusak tanpa alat build/jaringan; disarankan untuk v17.

## Penerapan
1. Unggah isi folder `nova/` menimpa v15, muat ulang paksa (Ctrl+Shift+R).
2. Backend: salin `backend/Code.gs` ke Apps Script hanya jika ingin string versi baru (tidak ada perubahan perilaku), lalu *Deploy → Manage deployments → New version*.
3. Rollback: kembalikan `app.js`, `ux.js`, `drafts.js`, `index.html`, `sw.js`, dan keempat CSS dari v15.

## Tambahan: logo NOVA terbaru + Daily Film Testing multi-studio
- **Logo & ikon:** logo NOVA terbaru (latar kotak-kotak dibersihkan jadi transparan) menggantikan `logo*.png`, `nova-logo*.png`, ikon PWA/Android (`icon-192`, `icon-512`, maskable) dan `apple-touch-icon`. Nama file dan ukuran tetap. Cache SW dinaikkan (`nova-v16-logo-ft`).
- **Bug:** formulir Daily Film Testing hanya mengisi satu studio (dropdown) per input. Kini satu formulir memuat semua studio: pilih/lepas studio dengan kotak centang (bawaan: semua studio), tiap studio punya panel sendiri (server, proyektor, checklist, masalah, tindakan, catatan, RETEST, foto). Data tiap studio tetap baris terpisah; semuanya diikat `batchId`.
- **Backend (`dcp.gs`, wajib deploy ulang):** kolom baru `batchId` (FT_LAPORAN, otomatis), aksi `ft_batch_save` atomik (satu studio gagal = semua dibatalkan, pesan menyebut nomor studio; maks 20 studio, studio ganda ditolak), `ft_get` mengembalikan `batch` (studio lain dalam laporan). Detail laporan menampilkan tautan studio lain. Edit dan tes ulang tetap per studio.
- **Uji:** `tests/test_ft_batch.js` 10/10, `tests/browser/ft-multistudio.js` (desktop & HP) lulus, regresi 18 modul × 3 ukuran layar tanpa error JS/scroll horizontal, semua tes backend lulus.
- **Belum diuji:** Apps Script asli, jsPDF/ExcelJS di lingkungan uji, ikon pada perangkat Android sungguhan. Tombol "+ Studio" belum ada di dalam formulir (tetap di tab daftar).
