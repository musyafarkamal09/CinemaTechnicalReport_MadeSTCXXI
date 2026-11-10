# NOVA v20.0.1 — Header menyambung ke sidebar, hapus sheet tidak terpakai

- Celah kosong antara sidebar dan header dihapus. Penyebab: `figma.css` memaksa lebar sidebar 244px, sedangkan `#main` memakai `--sbw` (bawaan 272px atau hasil geser). Sekarang lebar sidebar mengikuti `--sbw`, jadi penggeser lebar sidebar berfungsi lagi.
- Header memanjang ke bawah sidebar (margin negatif) dan sidebar berada di depannya. Bila sidebar disembunyikan, header kembali penuh.
- Urutan lapisan: konten laporan <= 70, header 80, sidebar 85, lembar "Buat laporan" 90. Di HP, header tidak lagi menutupi bagian atas sidebar yang terbuka.
- Lebar standar sidebar 244px; kunci simpanan diganti `stc_sbw2` supaya nilai lama tidak ikut.

File berubah: `nova.css` (?v=21), `ux.js` (?v=17), `index.html`, `sw.js` (nova-v20.0.1-header-sidebar).
Penerapan: unggah isi `nova/`, muat ulang paksa (Ctrl+Shift+R).

## Pembersihan sheet tidak terpakai (diperbaiki)
**Koreksi penting:** versi lama `periksaSheetTidakTerpakai` di `Code.gs` menganggap 5 sheet modul DCP & Film Testing (`DCP_TRANSAKSI`, `DCP_FOTO`, `USER_PERMS`, `FT_LAPORAN`, `FT_FOTO`) sebagai "tidak terpakai", padahal dipakai aplikasi. Menjalankan `hapusSheetTidakTerpakai` versi lama akan menghapus semua data DCP dan Testing. Sekarang registri (`sheetPakai_()`) memuat `DCP_SH`, jadi sheet itu tidak pernah terdeteksi sebagai sampah.

Urutan aman di editor Apps Script (semua di `Code.gs`):
1. `periksaSheetTidakTerpakai` — daftar di Log, tidak mengubah apa pun.
2. `sembunyikanSheetTidakTerpakai` — menyembunyikan (bisa dibatalkan lewat Tampilkan > Sheet tersembunyi).
3. `hapusSheetTidakTerpakai` — menghapus permanen. Sekarang membuat salinan penuh di Drive lebih dulu ("BACKUP sebelum hapus sheet ..."); bila gagal tidak ada yang dihapus; minimal satu sheet tersisa.
Tombol web "Periksa dan tandai sheet" memakai registri yang sama, hanya menandai tab merah, tidak menghapus. `dcp.gs` tidak lagi mendefinisikan fungsi pembersih agar tidak bentrok nama dengan `Code.gs`.

## Perbaikan bug dari audit (masih 20.0.1)
1. **Kebocoran hash/salt lewat nama aksi bawaan JavaScript** (`Code.gs` `route_`): aksi seperti `constructor` dulu ikut ditemukan dan mengembalikan data akun sendiri termasuk `hash` dan `salt`. Sekarang hanya aksi yang benar-benar didefinisikan (`hasOwnProperty`) yang berjalan.
2. **Studio ganda tersembunyi dalam satu laporan** (`dcp.gs` `ftSave_`): menambah atau mengganti nomor studio yang sudah ada di laporan yang sama kini ditolak ("Studio N sudah ada di laporan ini"), termasuk untuk laporan lama yang disatukan per hari.
3. **Daftar Film Testing tidak lagi memanggil server di setiap filter** (`modul-dcp.js`): daftar disimpan 30 detik di memori; membuka detail (setelah simpan/hapus/foto) membuang cache.
4. **Simpan banyak studio membaca sheet sekali** (`ftBatchSave_`), bukan sekali per studio.
5. Tes baru: `route_` nama bawaan, studio ganda (tambah, ganti, laporan lama), batch membaca sekali, dan `tests/browser/ft-cache.js`.
Belum dikerjakan (nice to have): merapikan 17 berkas dokumen di akar repo dan skrip penaik versi cache.

## Audit ulang (masih 20.0.1)
- `backend/Code.gs`: hapus variabel mati `wasSub` di `rep_save` (tidak mengubah perilaku). Ganti `Code.gs` saja, lalu deploy versi baru.
- Alur Data Penonton (draf, Kirim, batas 30 menit, `audComplete_`) sudah dibaca: tidak ada bug.
