# Laporan Verifikasi – STC XXI Technical Report (FINAL)

## Cakupan perubahan
Frontend (folder frontend/):
- Pemilih mode segmen Gelap / Kaca / Terang (pengganti tombol bulan satu-klik) – mode.js
- Font Inter di seluruh teks halaman – style-mode-final.css
- Hero "Advance Ticket Sales" dan banner ATS mengikuti tema
- Warna seri grafik meteran menyesuaikan mode (diterapkan ulang saat mode berganti)
- Tabel di modal/halaman dipaksa berwarna teks yang terbaca di tiap mode
- Daily Monitoring AC: kotak centang "AC Eror" per area, peringatan dashboard berisi nama area error
- Tombol tunggal "Download" dengan pilihan PDF / Excel (laporan detail)
- Ketahanan parsing data edit laporan (rows string, data kosong)

Backend (folder backend/Code.gs):
- BUG DIPERBAIKI: flag err per area AC kini disimpan di clean_() (sebelumnya dibuang)
- Kolom "AC ERROR" ditambahkan di rincian sheet AC_MONITORING
- Notifikasi push "AC error terdeteksi" ke Admin & Teknisi berisi nama area
- Versi di doGet: v10-ac-err

## Hasil pemeriksaan
| Pemeriksaan | Hasil |
|---|---|
| Sintaks Code.gs (node --check) | LULUS |
| Sintaks app.js, mode.js, ux.js, sidebar.js, drafts.js, notify.js, nav-back.js, sw.js, config.js | LULUS (semua) |
| Uji fungsi backend dengan stub Apps Script (tests/test_backend.js) | 22/22 LULUS |
| Uji isolasi draf per akun (tests/test_draft.js) | 5/5 LULUS |

Cakupan uji: penyimpanan flag err (true/'Ya'/'true'/false), baris kondisi Studio kosong,
parsing koma desimal, status suhu (APPROVED / TOO-WARM / TOO-COLD) dan batas tepat 23 dan 23,5,
pembagian pemakaian meteran per hari, dan perlindungan selisih negatif saat meter reset.

## Isolasi draf per akun (versi ini)
- Kunci draf memakai userId akun yang login. Tanpa akun tidak ada draf yang disimpan (fallback 'guest' dihapus).
- Draf foto di IndexedDB menyimpan pemilik; foto hanya dipulihkan bila pemiliknya cocok dengan akun yang login.
- Draf 'guest' dari versi lama dihapus saat login (localStorage dan IndexedDB).
- Pengujian: tests/test_draft.js 5/5 lulus (kunci berbeda per akun, tanpa akun = null, pembersihan guest, draf akun lain tetap).

## Label suhu AC (versi ini)
- Tampilan: TOO-WARM menjadi PANAS, TOO-COLD menjadi DINGIN (dashboard, detail laporan, standar suhu, dan kolom sheet AC_MONITORING).
- Kode status tersimpan tidak diubah, sehingga data lama tetap terbaca.
- Pengujian: pemetaan label 5/5 lulus.

## Yang BELUM diverifikasi (wajib diuji manual)
- Tampilan di browser (ketiga mode, mobile dan desktop): belum dijalankan di browser.
- Operasi Google Sheets, Drive, dan OneSignal: hanya diuji sebagai fungsi murni dengan stub, bukan terhadap layanan Google asli.
- Edit laporan yang sebelumnya menampilkan tabel kosong: penyebab pasti belum dapat direproduksi tanpa data nyata.
- Foto di sheet kategori tetap berupa tautan (tidak tertanam) – keputusan belum diambil.

## Langkah deploy
1. Tempel isi backend/Code.gs ke proyek Apps Script (satu file). Jika notifikasi dipisah ke notifikasi.gs, pastikan urutannya setelah Code.gs.
2. Jalankan sekali dari editor: perbaikiLinkFoto() (opsional, untuk data lama) dan periksa log.
3. Deploy ulang Web App.
4. Unggah isi folder frontend/ ke hosting (Cloudflare Pages).
