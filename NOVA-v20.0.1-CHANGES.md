# NOVA v20.0.1 — Header menyambung ke sidebar, hapus sheet tidak terpakai

- Celah kosong antara sidebar dan header dihapus. Penyebab: `figma.css` memaksa lebar sidebar 244px, sedangkan `#main` memakai `--sbw` (bawaan 272px atau hasil geser). Sekarang lebar sidebar mengikuti `--sbw`, jadi penggeser lebar sidebar berfungsi lagi.
- Header memanjang ke bawah sidebar (margin negatif) dan sidebar berada di depannya. Bila sidebar disembunyikan, header kembali penuh.
- Urutan lapisan: konten laporan <= 70, header 80, sidebar 85, lembar "Buat laporan" 90. Di HP, header tidak lagi menutupi bagian atas sidebar yang terbuka.
- Lebar standar sidebar 244px; kunci simpanan diganti `stc_sbw2` supaya nilai lama tidak ikut.

File berubah: `nova.css` (?v=21), `ux.js` (?v=17), `index.html`, `sw.js` (nova-v20.0.1-header-sidebar).
Penerapan: unggah isi `nova/`, muat ulang paksa (Ctrl+Shift+R).

## Tambahan: hapus sheet tidak terpakai lewat script
`backend/dcp.gs` memuat dua fungsi yang dijalankan dari editor Apps Script:
1. `sinkronSheetTidakTerpakai()` — daftar di Log, tab sheet tidak terpakai diwarnai merah. Untuk mempertahankan sheet: hapus warna merahnya.
2. `hapusSheetTidakTerpakai()` — menghapus hanya sheet yang tidak dipakai kode DAN bertab merah. Salinan penuh Spreadsheet dibuat di Drive lebih dulu; bila gagal, tidak ada yang dihapus. Sheet yang dipakai kode tidak pernah dihapus; minimal satu sheet tersisa.
Tombol "Periksa dan tandai sheet" di DCP > Izin & pengingat hanya menandai merah, tidak menghapus.
