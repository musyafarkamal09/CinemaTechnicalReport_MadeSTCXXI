# NOVA v17c — Data Penonton untuk semua pengguna

Lanjutan v17. Semua role kini dapat **melihat** dan **mengunggah (membuat)** laporan Data Penonton.

| Role | Lihat semua Data Penonton | Buat laporan + foto | Edit | Download Excel/PDF |
|---|---|---|---|---|
| Admin | ya | ya | semua, kapan saja | ya |
| Teknisi (USER) | ya | ya | milik sendiri, 30 menit | ya |
| Guide/Security | ya (baru) | ya (baru) | milik sendiri, 30 menit | ya (baru) |
| Pelapor (REPORTER) | ya (baru) | ya (baru) | milik sendiri, 30 menit | tidak (sama seperti sebelumnya) |

Laporan jenis lain tidak berubah: Pelapor tetap hanya melihat laporan "Perlu Diperbaiki" miliknya sendiri; Guide/Security tetap hanya Inspeksi & Patroli Studio selain Data Penonton.

## File berubah
- `app.js`: menu dan tombol Buat (+) untuk Pelapor dan Guide/Security, pintasan di dashboard Pelapor, pencarian global ikut memuat Data Penonton.
- `backend/Code.gs`: izin `rep_list`, `rep_get`, `rep_save`, `rep_export` (Guide/Security), `rep_zip`, `img`, `dashboard`; filter daftar Pelapor.
- `tests/test_backend.js`: 4 tes baru.
- `index.html` (`app.js?v=165`), `sw.js` (cache `nova-v17c-penonton-semua-user`).

## Penerapan
1. **Backend wajib diperbarui**: tempel `backend/Code.gs` ke Apps Script, lalu Terapkan → Kelola penerapan → Versi baru. Tanpa ini, Pelapor dan Guide/Security ditolak server.
2. Unggah isi folder `nova/` ke hosting, lalu muat ulang paksa (Ctrl+Shift+R).

## Pengujian
- Unit backend: 42/42 lulus.
- Sintaks `app.js` dan `Code.gs`: valid.
- Belum diuji: login nyata per role di Apps Script, dan tes browser Playwright untuk role Pelapor/Guide.
