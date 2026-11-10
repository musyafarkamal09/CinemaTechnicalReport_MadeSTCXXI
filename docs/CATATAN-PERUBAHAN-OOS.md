# Outlet Operation System — catatan perubahan (frontend)

Backend Apps Script (`Code.gs`, endpoint, sesi, hak akses) **tidak diubah**. Seluruh perubahan ada di sisi frontend.

## 1. Rename
- Nama aplikasi menjadi **Outlet Operation System** di judul tab, layar masuk, sidebar, manifest (PWA), dan header/footer semua PDF & Excel.
- `STC XXI` tetap dipakai sebagai nama organisasi (sub-judul).
- `manifest.json`: warna tema disamakan dengan ungu aplikasi (#25164f); sebelumnya masih hijau lama.

## 2. Dashboard
- Bagian **Sorotan** (carousel) dihapus beserta kodenya (`dSlider`, `dSlides`, `dSlideInit`).
- Sisa dashboard (catat cepat, ringkasan, AC, ATS, pengumuman, studio) tidak berubah.

## 3. Bug yang diperbaiki
- Detail laporan: judul dan nomor laporan menempel (`Laporan MeteranLM-2026-0021`) → kini berupa lencana.
- Detail laporan: label dan nilai tidak punya jarak; tabel "Pembacaan meteran" menyatu (`13.29313.282`) dan judul tabelnya tidak tampil sebagai judul → diberi jarak dan gaya tabel.
- Layar kecil: kolom keempat tabel meteran terpotong → sel dipadatkan dan judul kolom boleh turun baris.
- Keterangan waktu dokumentasi foto tidak ikut ke PDF/Excel (kode membaca properti yang salah) → kini tercantum di setiap foto.
- Warna ekspor PDF/Excel masih hijau lama → disamakan dengan identitas ungu.
- Warna tema browser (`theme-color`) masih hijau pada mode terang → ungu.
- Kolom angka di iOS memicu zoom saat diketuk → ukuran isian 16px pada layar kecil.

## 4. Formulir laporan (berlaku untuk semua jenis laporan)
- Tombol **Enter** berpindah ke kolom berikutnya; Enter di kolom terakhir langsung menyimpan.
- Isi kolom langsung terpilih saat diketuk (cepat menimpa angka lama).
- Keyboard angka otomatis untuk kolom meteran, harga, dan jumlah.
- Tombol **Sekarang** untuk mengisi tanggal dan jam saat ini.
- Tombol **Simpan / Batal** menempel di bawah formulir, tetap terlihat saat digulir.

## 5. Indikator muat baru (`loader.js`, `oos.css`)
- **Layar lensa proyektor** saat proses masuk: lensa dengan berkas cahaya berputar, pita film bergerak, dan pesan yang berganti.
- **Garis cahaya** tipis di tepi atas layar setiap ada permintaan ke server yang berjalan di belakang layar.
- **Lensa kecil** di dalam modal saat detail laporan dimuat (menggantikan teks "Memuat...").
- Semua animasi dimatikan bila sistem meminta "kurangi gerakan".

## 6. PDF dan Excel per laporan (tombol Download di detail laporan)
- **PDF**: header ungu di setiap halaman dengan nama aplikasi dan nomor laporan, tabel data, tabel pembacaan meteran, lalu bukti foto 1–2 kolom. Setiap foto diberi bingkai, nomor urut, jenis foto, dan **waktu dokumentasi**. Footer berisi waktu ekspor, nama pengekspor, dan nomor halaman.
- **Excel**: judul berwarna dengan baris identitas, tabel bergaris dengan header ungu, pengaturan cetak satu lebar kertas A4, footer halaman, dan sheet **Foto Dokumentasi** berisi foto beserta keterangan waktu.
- Ekspor daftar (PDF/Excel dari halaman kategori) memakai palet yang sama.

## Catatan
- Pengujian yang dilakukan: sintaks seluruh skrip; tampilan dashboard, detail, formulir, dan layar masuk (desktop & 390px) dengan API ditiru; jalur ekspor PDF dan Excel per laporan dijalankan dengan pustaka tiruan.
- Pustaka PDF/Excel asli (jsPDF, ExcelJS) dan layout hasil akhir **belum diuji** pada lingkungan ini. Silakan unduh satu laporan contoh dan periksa tampilannya.
- Folder `src/` dan `img/frontend/` adalah salinan lama dan tidak dipakai oleh `index.html`; tidak diubah.
- Setelah deploy, muat ulang sekali (hard refresh) agar service worker `oos-v65` mengambil berkas baru.

## Revisi 2 (sama dengan paket ini)
- **Formulir semua kategori** (semua modal berisi formulir): Enter pindah kolom, Ctrl/⌘+Enter langsung simpan, isi kolom terpilih saat diketuk, keyboard angka untuk kolom angka.
- **Salin dari laporan terakhir saya** (Laporan Pekerjaan, Perlu Diperbaiki, Pembelian, Meteran): menyalin lokasi dan informasi tetap saja. Angka meteran, tanggal, dan jam tetap diisi baru. Daftar barang pembelian dan area AC belum ikut disalin.
- **Pindah halaman dan memuat laporan** memakai kerangka (skeleton) sesuai bentuk halaman, daftar, dan detail. Halaman masuk dengan lembut. Lensa berputar dan pesan yang berganti sudah dihapus.
- **Layar masuk** hanya logo dan garis progres; garis progres di atas juga polos, tanpa cahaya atau warna emas.
