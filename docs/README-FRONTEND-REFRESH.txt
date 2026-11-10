STC XXI Technical Report — Frontend Refresh
============================================

Paket ini dibuat dari ZIP yang Anda kirim. Perubahan dibatasi pada:
- index.html: menambahkan stylesheet style-reference.css sebagai layer visual terakhir.
- style-reference.css: tema premium hijau gelap/teal + aksen emas, panel lebih rapi, login dan dashboard responsive.
- app.js: menambahkan slide Teori Manajemen "Visi & Misi" sebelum materi yang sudah ada.

Backend Google Apps Script / Code.gs tidak diubah. appsscript.json, config.js, modul laporan, fungsi navigasi, integrasi, dan aset lama tetap disertakan.

Cara pasang ke repo:
1. Backup repo/branch saat ini terlebih dahulu.
2. Ekstrak ZIP ini, lalu unggah seluruh isi folder CinemaTechnicalReport_MadeSTCXXI-main ke repo (replace file yang sama).
3. Pastikan style-reference.css ikut terunggah.
4. Commit lalu deploy seperti alur repo Anda biasa.
5. Uji login, navigasi, input/edit/hapus laporan, upload foto, ekspor PDF/Excel, grafik meteran, ATS, dan laporan film.

Catatan:
- Jangan mengunggah Code.gs dari paket lain; gunakan Code.gs aktif Anda karena backend tidak disentuh oleh paket frontend ini.
- Poster ATS tetap menggunakan data/gambar poster yang disediakan aplikasi. Jumlah kursi per studio ditata sebagai kartu statis; nilai kursi tetap mengikuti konfigurasi STUDIOS di app.js.
- Gambar referensi UI bukan dipakai sebagai background halaman karena itu screenshot mockup dengan teks raster; halaman memakai foto proyektor asli yang sudah ada di folder img agar teks aplikasi tetap tajam.

Aset proyektor 4K:
- Lokasi repo: img/projector-hero-4k.webp
- Resolusi file: 3840 x 2160 (UHD 4K)
- Dipakai oleh style-reference.css sebagai foto hero/login.
- File ini merupakan gambar hasil generasi yang di-upscale ke dimensi UHD; resolusi 4K tidak berarti detail optik setara foto kamera native 4K.
