# NOVA v20 — Header tidak tertimpa, Daily Film Testing jadi SATU laporan, audit sheet

## Bug pada foto (header tertimpa judul/tabel)
Penyebab: kontainer laporan (`.mdc-top`, `.mdc-filter`, `.ft-rekap`, `.mdc-foot`, ...) diberi `z-index: 30` (agar menu Download tidak terpotong), sama dengan header sticky (`z-index: 30`). Elemen yang muncul belakangan menang, sehingga "Rekap gabungan (4 studio)" dan tabelnya tampil DI ATAS header saat halaman di-scroll. Bug ini berlaku di semua halaman laporan yang memakai kontainer tersebut (DCP, Pelaporan DCP, Film Testing, dll.).
Perbaikan (`nova.css`): header `z-index: 80`, konten halaman maksimal 70 (menu Download terbuka).

## Daily Film Testing: satu laporan per hari
- **Daftar**: satu baris = satu laporan harian yang memuat semua studio (chip hasil per studio). Tidak ada lagi bagian terpisah per studio. Studio opsional (centang yang dites), 4 studio atau lebih.
- **Detail**: satu halaman memuat semua studio; tiap studio punya hasil, item gagal, masalah/tindakan, riwayat tes ulang, dokumentasi, dan tombol Ubah / Tes ulang / Hapus sendiri. Tombol **+ Tambah studio ke laporan ini** menambah studio ke laporan yang sama (tanggal terkunci). **Hapus seluruh laporan** tersedia untuk Admin.
- **Data lama** (satu baris per studio tanpa batchId) otomatis disatukan per hari. Studio yang sama dua kali pada hari yang sama menjadi laporan terpisah agar tidak ada data hilang. Data di Spreadsheet tidak diubah.
- **Judul film per studio** (opsional); kosong = sama dengan judul film utama.
- **Unduh**: satu laporan = satu PDF/Excel berisi ringkasan, checklist tiap studio, dan foto tiap studio. Laporan gabungan (periode) = satu tabel harian (tanggal, laporan, studio, ID studio), bukan satu lembar per studio.
- **"Dokumentasi Studio ..." tebal** di formulir, detail, keterangan foto, dan PDF.
- Backend baru: `ft_report_get` (semua studio + foto dalam satu panggilan, menggantikan `ft_get` per studio untuk ekspor).

## Bug lain yang ditemukan dan diperbaiki
1. **Tes ulang memakai tanggal laporan lama** (bukan hari ini). Sekarang tanggal default = hari ini.
2. Ekspor gabungan memanggil `ft_get` satu per studio (lambat di HP/Apps Script); sekarang satu panggilan per laporan.
3. Filter status/tanggal/cari di server memotong rantai tes ulang; sekarang filter dilakukan per laporan di klien.

## Sheet tidak terpakai (aman dihapus)
- Admin: halaman DCP → **Izin & pengingat** → **Periksa dan tandai sheet**. Sheet yang tidak dipakai kode diberi warna tab **merah** dan daftarnya ditampilkan.
- Editor Apps Script: jalankan `sinkronSheetTidakTerpakai()`, lihat hasil di Log.
- Tidak ada sheet yang dihapus otomatis. Sheet yang DIPAKAI: USERS, ANNOUNCEMENTS, ATS_FILMS, REPORTS, PHOTOS, AUDIT_LOG, FILM_REPORTS, GLOSSARY, STORAGE, WORK_REPORTS, METER_LISTRIK, METER_AIR, METER_LISTRIK_AIR, PURCHASE_REPORTS, AC_MONITORING, DATA_PENONTON, PERLU_DIPERBAIKI, FOTO_PEKERJAAN, FOTO_METERAN, FOTO_PEMBELIAN, FOTO_AC, FOTO_PERLU_DIPERBAIKI, FOTO_INSPEKSI_PATROLI, FOTO_DATA_PENONTON, DCP_TRANSAKSI, DCP_FOTO, USER_PERMS, FT_LAPORAN, FT_FOTO. Selain itu (mis. "Sheet1", salinan, sheet percobaan) tidak dipakai.

## File berubah
`backend/dcp.gs`, `modul-dcp.js` (?v=20), `nova.css` (?v=20), `index.html`, `sw.js` (nova-v20-laporan-satu), `tests/run-all.sh`, `tests/browser/v14.js`, `tests/browser/ft-export-foto.js`. Baru: `tests/test_ft_laporan.js`, `tests/browser/ft-laporan-satu.js`.

## Penerapan
1. Tempel `backend/dcp.gs` ke Apps Script → Terapkan → Kelola penerapan → Versi baru.
2. Unggah isi `nova/` ke hosting, muat ulang paksa (Ctrl+Shift+R).
