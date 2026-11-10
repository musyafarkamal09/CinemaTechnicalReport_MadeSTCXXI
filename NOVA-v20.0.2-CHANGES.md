# NOVA v20.0.2 — Draf Data Penonton bersama + perbaikan hasil audit

## Data Penonton
- Draf (belum Kirim) boleh diisi, diubah, dan diberi foto oleh Admin, Teknisi (User), dan Guide/Security. Pelapor hanya untuk draf miliknya sendiri.
- Setelah Kirim: hanya pemilik (30 menit) dan Admin. Admin dapat mengubah laporan apa pun kapan saja.
- Dua orang menyimpan draf yang sama: penyimpan kedua ditolak ("baru saja diubah oleh pengguna lain"), isian tidak hilang (`baseAt`).

## Keamanan dan keandalan (backend/Code.gs)
- Login: 10x salah password mengunci akun 15 menit (habis sendiri), berlaku juga untuk Admin. Orang luar tidak lagi dapat mengunci akun selamanya, dan tebakan password Admin kini dibatasi. Sesi Admin yang sudah aktif tidak ikut mati. Admin tetap bisa membuka kunci lebih awal.
- Hitungan salah password dibaca ulang di dalam kunci, sehingga tebakan bersamaan tidak terhitung sekali.
- Arsip otomatis harian ditandai selesai hanya bila berhasil; bila gagal dicoba ulang paling cepat 1 jam kemudian.
- Spreadsheet dibuka sekali per permintaan (sebelumnya puluhan kali).

## Frontend dan repo
- `app.js` 345 KB menjadi 236 KB: gambar latar disimpan sebagai `img/cut-christie.webp` dan `img/cut-barco.webp` (sudah masuk cache offline di `sw.js`).
- `config.js` dihapus (tidak dipakai). 19 berkas catatan lama dipindah ke `docs/`.
- Tes baru: `tests/browser/audience-shared.js`, `tests/test_auth.js` (kunci sementara), `tests/test_backend.js` (hak akses draf).

## Belum diubah (keputusan Anda)
- `PUBLIC_PHOTOS=true`: foto dapat dibuka siapa pun yang memegang tautan. Mematikannya juga mematikan miniatur foto di Google Sheets dan sebagian ekspor, jadi tidak diubah otomatis.

Penerapan: tempel `backend/Code.gs` ke Apps Script lalu Terapkan > Versi baru. Unggah isi zip ke hosting (hapus `config.js` lama bila ada), lalu muat ulang paksa (Ctrl+Shift+R).
