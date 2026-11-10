# Redesign frontend (Figma → Tailwind CSS)

Hanya **frontend** yang diubah. `app.js`, `config.js`, `ux.js`, `sidebar.js`, `drafts.js`, `notify.js`, `nav-back.js`,
`modul-dcp.js`, `pelaporan.js` dan backend Apps Script (endpoint, autentikasi, session, hak akses) **tidak diubah**.

## Yang berubah
- `index.html`  : shell baru (login, sidebar, header, tab bawah) dengan Tailwind. Semua `id` yang dipakai JS dipertahankan. Tema bawaan kini Terang.
- `tailwind.css`: hasil build dari `src/tailwind.input.css` (token Figma, komponen: tombol, kartu, tabel, status, formulir, modal, dashboard).
- `legacy-modules.css`: CSS isi modul lama (DCP, Film Testing, Pelaporan, AC, Glossarium, slider dashboard, dll.) yang disaring dari 3 CSS lama (275 KB → 80 KB) dan di-retheme lewat token.
- `shell.js`     : tombol menu di tablet/HP membuka sidebar.
- `sw.js`        : daftar cache diperbarui (versi v64). Dihapus: `style-app.css`, `ui-system.css`, `responsive-fix.css`.

## Build ulang CSS (opsional, hanya bila mengubah `src/tailwind.input.css` atau kelas di HTML/JS)
    npm i -D tailwindcss@4
    node tools/build-css.mjs

## Catatan
- Grafik "Aktivitas laporan" pada Figma tidak dibuat: API tidak menyediakan datanya.
- `legacy-modules.css` masih CSS biasa (bukan Tailwind) untuk isi modul; migrasi bertahap ke utilitas Tailwind bisa dilakukan per modul.
- CSS Tailwind v4 memerlukan browser modern (Chrome 111+, Safari 16.4+, Firefox 128+).
- Setelah deploy, hard-refresh sekali agar service worker memuat cache baru.

## Revisi Figma v3 (lapisan `figma.css`)
- Sumber desain: `Untitled (1).fig`, dibaca langsung dari berkas (decoder Kiwi + zstd). Nilai yang dipakai: sidebar 244px `#26164b`, item menu 34px radius 6 (aktif `#49337b`), topbar 72px, padding konten 32px, judul 26px semibold, kartu radius 10px dengan garis `#ebedf3`, font Inter dan Lora (logo XXI), aksen `#8064e9`.
- `figma.css` dimuat paling akhir di `index.html`. Hanya menata tampilan; ID dan kelas yang dipakai JS tidak diubah.
- `index.html`: font Manrope diganti Inter + Lora; brand "Technical Report / STC XXI"; blok "Outlet terpilih"; footer.
- `app.js`: hanya label grup navigasi (`GRP`): MENU UTAMA, LAPORAN TEKNIK, FILM & DIGITAL, ADMINISTRASI. Logika tidak diubah.
- `sw.js`: cache `oos-v67`, `figma.css` ditambahkan.
- Header HP: jam, status, dan kolom cari disembunyikan di bawah 768px agar tidak overflow (menu Cari tetap di navigasi bawah).
- Tombol "Buat" di navigasi bawah HP diberi kontras yang benar.
- Tidak diubah: `Code.gs`, `DCP.gs`, endpoint API, autentikasi, role, izin, Google Sheets/Drive, upload foto, laporan, notifikasi, dan PWA.

Catatan: grafik tren Monitoring AC pada Figma belum dibuat karena API tidak menyediakan riwayat suhu per jam. Data contoh Figma ("Gandaria City XXI") tidak dipakai; nama outlet tetap dari konfigurasi aplikasi.

## Revisi v4: grafik suhu AC per show dan verifikasi modal
- Grafik "Grafik suhu per show" di panel Monitoring AC (dashboard), sesuai bagian "Grafik tren" pada Figma.
  - Aturan: maksimal 5 show per studio (area) per hari. Setiap pengukuran suhu AC yang terisi menjadi satu show, diurutkan menurut waktu input. Show yang belum diisi dibiarkan kosong (garis terputus).
  - Data: laporan AC hari ini yang sudah dimuat panel tersebut. Backend tidak diubah dan tidak ada panggilan API tambahan.
  - Pita hijau menunjukkan standar suhu (default 23–23,5 °C, atau mengikuti `tempStd` dari data).
  - Area yang lebih dari 5 pengukuran per hari hanya menampilkan 5 show pertama.
  - Berkas: `ac-trend.js` (dimuat setelah `modul-dcp.js`), hook satu baris di `dAc()` pada `app.js`.
- Verifikasi modal: 11 opsi pada lembar "Buat" membuka formulir di desktop dan mobile (DCP Keluar/Masuk, Pelaporan DCP Keluar/Masuk, Input Testing, Laporan Pekerjaan/Meteran/Pembelian/Monitoring AC/Perlu Diperbaiki/Inspeksi & Patroli). Detail laporan, tombol "+ Pengumuman", dan detail AC juga diuji.
- `sw.js`: cache `oos-v68`. `app.js?v=93`, `ac-trend.js?v=2`.

## Revisi v5: nama aplikasi NOVA
- Nama aplikasi diganti menjadi NOVA di judul tab, sidebar, layar masuk, manifest (PWA), dan header PDF/Excel.
- Di sidebar, nama outlet (Sukaramai Trade Center XXI) ditampilkan tepat di bawah NOVA. Blok "Outlet terpilih" yang terpisah dihapus agar tidak dobel.
- `sw.js`: cache `oos-v69`. `app.js?v=94`, `modul-dcp.js?v=14`, `figma.css?v=2`.

## Revisi v6: alignment header dan label dengan Figma
- Urutan header halaman sesuai Figma: breadcrumb ("NOVA / Nama Halaman") → judul → subjudul.
- Subjudul tiap halaman diambil dari teks Figma (berlaku untuk 18 modul).
- Label tombol aksi utama disesuaikan dengan Figma pada fungsi yang sama: "Catat pekerjaan", "Lapor perbaikan", "Catat meteran", "Catat monitoring", "Ajukan pembelian", "Mulai inspeksi", "Buat pengumuman", "Tambah jadwal ATS", "Unggah berkas", "Tambah pengguna", "Tambah DCP", "Mulai film testing". ID tombol tidak berubah.
- Ikon cari di topbar dipusatkan.
- Backend, data, akun, password, role, dan hak akses tidak diubah.
- Belum sepenuhnya sesuai Figma: KPI ringkas per modul, tab/filter (mis. Pengumuman, Pengguna, Pengaturan), A–Z Glosarium, dan angka contoh Figma (tidak dipakai karena data dummy dilarang).
- `sw.js`: cache `oos-v71`. `app.js?v=95`, `modul-dcp.js?v=15`, `figma.css?v=4`.
