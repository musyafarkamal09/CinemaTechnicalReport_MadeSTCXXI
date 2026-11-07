# NOVA v18 — Data Penonton: simpan draf, Kirim, edit 30 menit

## Alur
1. **Simpan** (kapan saja, boleh belum lengkap, minimal 1 show) → data tersimpan di server sebagai **Draf**.
2. Draf dapat **dilihat dan diunduh** (Excel/PDF) seperti laporan biasa, dan **diubah pemiliknya kapan saja** (Admin juga).
3. Tombol **Kirim (Submit)** muncul di sebelah Simpan bila **SHOW1–SHOW5 semua studio** terisi (nama film, tiket terjual, penonton masuk). Ada konfirmasi sebelum kirim.
4. Setelah Kirim → status **Terkirim**; pemilik dapat mengubah **30 menit sejak Kirim** (bukan sejak dibuat). Admin tetap kapan saja. Data terkirim tidak bisa menjadi tidak lengkap saat diedit.

## Aturan penting
- Server memeriksa kelengkapan saat Kirim (tidak hanya di browser).
- Show yang tidak tayang: isi "Tidak tayang" di Nama Film, tiket 0, penonton 0 (karena Kirim mewajibkan 5 show per studio). **Asumsi — ubah bila aturan berbeda.**
- Data lama (sebelum v18) dianggap Terkirim dengan aturan 30 menit lama.
- Notifikasi ke Admin/Teknisi hanya dikirim saat Kirim, bukan tiap Simpan draf.
- Kolom Status (Draf/Terkirim) ditambahkan di daftar, detail, Excel, PDF, dan sheet DATA_PENONTON.

## File berubah
`app.js`, `backend/Code.gs`, `index.html` (app.js?v=166), `sw.js`, `legacy-modules.css`, tes (`tests/test_backend.js`, `tests/browser/audience-draft.js` baru, `audience-export.js`, `run-all.sh`).

## Penerapan
1. Tempel `backend/Code.gs` ke Apps Script → Terapkan → Kelola penerapan → Versi baru. (Tanpa ini Simpan langsung dianggap terkirim, tanpa draf.)
2. Unggah isi `nova/` ke hosting, muat ulang paksa (Ctrl+Shift+R).

## Pengujian
Backend 62/62 lulus (20 tes baru draf/kirim/30 menit). Browser Data Penonton: desktop/tablet/phone lulus; `audience-draft.js` 12/12. `test_auth.js` 2 gagal sejak versi sebelumnya (bukan dari perubahan ini). Belum diuji di Apps Script nyata.
