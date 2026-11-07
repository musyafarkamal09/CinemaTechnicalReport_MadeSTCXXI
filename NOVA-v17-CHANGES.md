# NOVA v17 — Data Penonton

Lanjutan v16. Fitur lama tidak diubah. Satu kategori baru: **Data Penonton**.

## Fitur
- Menu baru **Data Penonton** (grup "Film & digital", di bawah Laporan Film) dan tombol **Buat (+)**. Untuk Admin dan Teknisi. Pelapor dan Guide/Security tetap tidak punya akses.
- Formulir meniru lembar kertas: **Tanggal**, lalu tabel per studio dengan kolom Show, Nama Film, Jam Show, Tiket Terjual, Penonton Masuk, Petugas, Keterangan.
- Bawaan **Studio 1–4, masing-masing SHOW1–SHOW5**.
- Opsional: **+ Tambah show** (per studio, sampai 15) dan **+ Tambah studio** (sampai 12, diberi nama Studio 5, 6, ...). Hanya show dan studio tambahan yang bisa dihapus.
- Baris kosong tidak ikut disimpan (tidak semua show tayang). Total show, tiket, dan penonton dihitung langsung di formulir dan dihitung ulang di server.
- **Foto dokumentasi opsional**: pilih dari galeri atau ambil dengan kamera (komponen yang sama dengan laporan lain, kamera memakai watermark waktu). Laporan boleh disimpan tanpa foto.
- Autosave draf ikut memulihkan studio/show tambahan.
- Daftar, detail (tabel per studio + total), edit (batas 30 menit untuk non-Admin, sama seperti laporan lain), Excel (satu baris per show), PDF daftar, PDF/Excel laporan tunggal, pencarian global.

## Validasi (frontend dan server)
- Tanggal wajib. Minimal satu show terisi.
- Baris terisi wajib punya Nama Film. Tiket dan penonton: bilangan bulat ≥ 0 (boleh kosong). Jam: format HH:MM.
- Maksimal 12 studio, 15 show per studio. Nama studio tidak boleh ganda.

## File berubah
`app.js`, `nova-ds.css` (gaya tabel), `index.html` (versi aset), `sw.js` (cache `nova-v17-data-penonton`), `backend/Code.gs`, `tests/test_backend.js`, `tests/run-all.sh`.
Baru: `tests/browser/audience.js`, `tests/browser/audience-export.js`, `NOVA-v17-CHANGES.md`.

## Backend (Apps Script) — WAJIB diterapkan
Tanpa langkah ini, simpan laporan Data Penonton ditolak server ("Jenis laporan tidak valid").
1. Tempel isi `backend/Code.gs` ke editor Apps Script (menggantikan Code.gs lama; berkas `Code (1).gs.txt` lama sudah digantikan).
2. Simpan, lalu **Terapkan → Kelola penerapan → ikon pensil → Versi: Versi baru → Terapkan**. URL Web App tetap sama.
3. `SCHEMA` naik ke 16: pada panggilan API berikutnya sheet baru dibuat otomatis: `DATA_PENONTON` (satu baris per laporan, rincian di satu kolom) dan `FOTO_DATA_PENONTON`. Foto laporan tersimpan di folder Drive `DATA PENONTON`.
4. Nomor laporan berawalan `DP-`.

## Penerapan frontend
Unggah isi folder `nova/` menimpa v16 (GitHub Pages), lalu muat ulang paksa (Ctrl+Shift+R).
Rollback: kembalikan `app.js`, `nova-ds.css`, `index.html`, `sw.js` dari v16.

## Hasil uji (dijalankan)
- Unit backend: 38/38 (termasuk 16 tes baru Data Penonton). Tes unit lain tidak berubah.
- Browser Data Penonton (mock backend): 27/27 di desktop, tablet, dan HP. Mencakup form, tambah studio/show, draf, foto galeri + kamera, simpan dengan dan tanpa foto, validasi, daftar, detail, edit.
- Ekspor: 12/12 dengan library XLSX/jsPDF tiruan (isi baris dan kolom diperiksa).
- Regresi: `run.js` 18 modul, 0 bermasalah, 0 galat JS, di desktop dan HP.

## Catatan jujur
- **Gagal sebelum perubahan ini, tidak disentuh**: `tests/test_auth.js` (2 tes blokir login ke-10) dan `tests/browser/v14.js` ("FT form: pilihan studio 1-6"). Sudah dicek: hasil sama pada v16 asli.
- **Belum diuji**: backend Apps Script sungguhan (hanya tes unit/mock), berkas .xlsx/.pdf asli dibuka visual (library CDN tidak ada saat uji), kamera perangkat nyata (diuji lewat input file), dan Excel laporan tunggal (butuh ExcelJS). Mohon unduh satu laporan (PDF dan Excel) dan buat satu laporan dengan foto kamera di HP untuk memeriksa.
- Draf: studio/show tambahan ikut dipulihkan, tetapi foto draf mengikuti perilaku lama (IndexedDB).
- Sheet spreadsheet menyimpan rincian show dalam satu sel per laporan (pola sama dengan Laporan Pembelian). Untuk satu baris per show, pakai unduhan Excel dari website.
