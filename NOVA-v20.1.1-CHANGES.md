# NOVA v20.1.1 — DCP: integrasi, foto, hak Admin, keamanan

## Perubahan
**Backend (`backend/dcp.gs`)** — tabel `DCP_TRANSAKSI`/`DCP_FOTO` tetap satu sumber data; tanpa migrasi, tanpa kolom baru.
- Baris Pelaporan (modul PEL) yang diubah lewat `dcp_save` kini diteruskan ke `pel_save`; baris DCP Management yang diubah lewat `pel_save` diteruskan ke `dcp_save`. Tidak ada lagi baris rusak/ganda akibat dua aturan validasi.
- `dcp_list`/`dcp_get`: bentuk data memuat `modul, outlet, outletTujuan, jenisDcp, asalDari, namaPengirim`.
- Admin: ubah, tambah foto, hapus foto, dan hapus transaksi tervalidasi/tertaut. Hapus KELUAR tertaut melepas tautan MASUK (MASUK tidak hilang).
- **Keamanan**: `dcp_photo_save` kini memeriksa pemilik di server (sebelumnya Teknisi mana pun bisa menambah foto ke laporan orang lain bila tahu ID).
- Foto: batas per foto 4 MB → 12 MB (file asli); thumbnail disimpan di `CacheService` 6 jam.

**Frontend**
- `modul-dcp.js`: pemuat foto baru (skeleton, 3 permintaan paralel, 6 foto/permintaan, coba ulang otomatis 2x, gambar pengganti + ketuk untuk coba lagi). Foto Management memakai jalur thumbnail yang sama dengan Pelaporan. Prefetch foto penuh otomatis dihapus (boros data).
- Unggah foto: file **asli** dikirim apa adanya (JPG/PNG/WebP ≤ 10 MB). Hanya format lain/lebih besar diubah ke JPEG q0.95 (maks 4096 px) dengan pemberitahuan. Batch ≤ 6 foto dan ≤ ~8 MB.
- `app.js`: batas waktu unggah/ambil foto DCP 45 dtk → 120 dtk.
- `pelaporan.js`: Admin punya Ubah / Tambah foto / Hapus pada semua baris (termasuk data lama, tervalidasi, milik pengguna lain). Pengguna lain tetap hanya laporan miliknya.
- Ubah baris Pelaporan dari Management memakai formulir Pelaporan, lalu kembali ke Management; sebaliknya untuk data lama.
- Ekspor: foto PDF 1400 px q0.82 → 2400 px q0.92 (rasio asli); foto gagal diambil dicoba ulang 1x dan pengguna diberi tahu jumlah yang tidak masuk; lebar kolom Excel mengikuti isi.
- `nova-ds.css` (v35): chip status tidak pecah, daftar kelengkapan rapi, kolom Aksi item rapi, tombol/foto responsif di HP.
- Versi cache: `index.html`, `sw.js` (`nova-v20.1.1-dcp-r1`).

## Pengujian
- `node tests/test_dcp.js` (baru, 11 tes) dan `node tests/test_audience.js` (36 tes): lulus.
- Browser (Chromium, API tiruan), HP 390 px dan desktop 1366 px: detail Pelaporan dan Management, skeleton, retry otomatis, error + ketuk ulang, lightbox, tombol Admin/Teknisi, 19 menu dibuka tanpa error JS, tanpa overflow horizontal.

## Belum diuji / batas
- Tidak ada Google Apps Script/Drive asli: kecepatan nyata, `getThumbnail()`, `CacheService`, dan batas ukuran POST Apps Script untuk foto asli ±10 MB belum terbukti.
- PDF/Excel nyata tidak dapat dibuat (pustaka jsPDF/SheetJS tidak tersedia di lingkungan uji): perubahan ekspor hanya diperiksa sintaks.
- Foto lama yang sudah dikompresi sebelumnya tidak dapat dipulihkan.
- Excel (SheetJS CE) tidak memuat foto; foto hanya di PDF (tidak berubah).
- Unggah foto berjalan di bawah ScriptLock (`*_save`); unggahan besar dapat menahan penyimpanan lain beberapa detik.
- `ft_photo_save` (Daily Film Testing) belum memeriksa pemilik; tidak diubah sesuai permintaan.

Penerapan: tempel `backend/dcp.gs` → Terapkan > Versi baru; unggah isi ZIP; Ctrl+Shift+R.
