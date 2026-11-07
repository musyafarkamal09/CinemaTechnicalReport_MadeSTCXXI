# NOVA v13 — Ringkasan perubahan

Basis: `NOVA-v12-FINAL.zip`. Backend Apps Script berubah (`backend/Code.gs`, `backend/dcp.gs`) — **wajib deploy ulang**.

## Yang dikerjakan
| # | Permintaan | Status | Catatan |
|---|---|---|---|
| 1 | Logo NOVA menggantikan XXI di website | Selesai | PNG NOVA dibersihkan (latar kotak-kotak aslinya tidak transparan). Dibuat `logo.png` (ikon), `logo-light.png` (untuk latar gelap), `nova-logo*.png`, ikon PWA. `logo-xxi.png` = logo XXI lama, dipakai khusus PDF. |
| 1 | PDF menampilkan kedua logo | Selesai (belum diuji render) | Logo XXI + NOVA di PDF detail laporan, PDF daftar, dan PDF DCP/Testing/Pelaporan. |
| 2 | Footer + identitas | Selesai | "NOVA — An Innovation by MK" dan "Designed & Developed by MK" di footer semua halaman dan di kartu login; footer PDF memuat identitas yang sama. |
| 3 | Formulir di halaman tersendiri | Selesai | Semua `modal()` (formulir dan detail) kini tampil sebagai halaman (konten utama diganti, bukan overlay). Tombol "← Kembali", tombol Back browser/HP menutupnya, klik menu menutupnya, posisi scroll dipulihkan. |
| 4 | Multi-item DCP | Selesai | DCP Management dan Pelaporan DCP: "+ Tambah item" / "Hapus item"; tiap item punya judul film, kode disk, format/jenis, PH, kelengkapan, keterangan sendiri. Tiap item = satu transaksi (validasi server tidak berubah) yang diikat `batchId`; detail DCP Management menampilkan item lain dalam laporan yang sama. Validasi semua item dilakukan sebelum simpan; kode disk ganda di satu laporan ditolak. |
| 5 | Film Testing per studio | Selesai | Tab Studio 1–4; daftar, KPI, peringatan, dan ekspor hanya untuk studio terpilih; laporan baru terkunci ke studio tab aktif. |
| 6 | Figma sebagai acuan | **Sebagian** | Lapisan `figma.css` dari revisi sebelumnya dipertahankan. Sesi ini hanya menambah identitas NOVA, footer, login, halaman formulir. Audit piksel tiap halaman terhadap PDF Figma **belum dilakukan**. Hero poster ATS tidak diubah. |
| 7 | Login & keamanan | Selesai | Login di tengah halaman; username & password case-sensitive; blokir setelah 10 kali salah password (disimpan di database, bertahan sampai Admin reset password atau "Buka blokir"); logout otomatis 30 menit tidak aktif — ditegakkan di server dan di klien (pengecualian PWA dihapus). |
| 8 | Bug PDF | **Sebagian** | Header PDF ditata ulang agar logo tidak bertabrakan dengan judul/ID; header tabel DCP diseragamkan. Pustaka jsPDF tidak bisa dimuat di lingkungan uji (tanpa internet), jadi hasil PDF **belum diperiksa visual**. |
| 9 | Responsif | Diuji | 18 modul × desktop/tablet/HP: tanpa error JS dan tanpa scroll horizontal. Formulir 1 kolom di bawah 720 px. |
| 10 | Audit sistem | Sebagian | Dibuang: `img/frontend/` (salinan lama tak terpakai). Test `test_draft.js` diperbaiki (path). Tidak ada rebuild arsitektur. |

## Bug/risiko yang diperbaiki
- Blokir login lama hanya di cache 15 menit (otomatis terbuka); kini permanen sampai Admin reset.
- Username sebelumnya tidak case-sensitive.
- Sesi berlaku 14 hari tanpa batas idle di server; kini 30 menit idle.
- Pesan "Sesi ditolak server (aksi, kode, …)" yang membocorkan detail teknis diganti pesan bersih.
- Logo XXI di sidebar berupa teks; diganti logo NOVA.
- Test `test_draft.js` gagal karena path absolut.

## Hasil uji
- `tests/test_backend.js` 22/22, `tests/test_draft.js` lulus, **`tests/test_auth.js` 10/10 (baru)**: case-sensitive, 9 salah belum blokir, ke-10 blokir, blokir meski password benar, reset Admin membuka, idle 31 menit ditolak.
- Browser (Playwright, API ditiru): login berada tepat di tengah (720,450 pada 1440×900); formulir terbuka sebagai halaman; tombol Back menutupnya; 2 item DCP memicu 2× `dcp_save`; tab Studio 1–4 dan kunci studio pada formulir; regresi 18 modul × 3 ukuran layar bersih.
- **Belum diuji**: backend Apps Script asli, jsPDF/ExcelJS, notifikasi OneSignal, tampilan dengan data produksi.

## Petunjuk penerapan backend
1. Buka proyek Apps Script → ganti isi `Code.gs` dan `dcp.gs` dengan versi di folder `backend/`.
2. Deploy → Kelola deployment → versi baru (Web App). URL `/exec` tetap.
3. Kolom baru ditambahkan otomatis saat request pertama: `failCount`, `lockedAt` (sheet USERS), `batchId` (DCP_TRANSAKSI).
4. Frontend: unggah seluruh isi paket; hard-refresh sekali (cache SW `nova-v13`).
5. Beri tahu pengguna: username kini membedakan huruf besar/kecil persis seperti yang terdaftar.

## Keterbatasan yang perlu Anda ketahui
- Foto pada laporan multi-item melekat ke Item 1.
- Idle server memakai cache Apps Script; jika cache terhapus, token diterima hanya 30 menit sejak login.
- Ekspor PDF per laporan DCP (satu item) belum menggabungkan semua item dalam satu PDF.
