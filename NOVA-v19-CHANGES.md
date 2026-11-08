# NOVA v19 — Audit tanggal, Daily Film Testing: dokumentasi per studio

## Temuan dan perbaikan
1. **Tanggal/jam di sheet Film Testing dan DCP bisa berubah jadi Date oleh Spreadsheet.** Kolom `tanggal` (yyyy-MM-dd) dan `jam` (HH:mm) sheet `FT_LAPORAN` dan `DCP_TRANSAKSI` tidak diformat teks, sehingga Spreadsheet dapat mengubahnya menjadi tipe Date. Akibatnya filter tanggal, hitungan "hari ini", dan pengurutan tidak cocok antar perangkat. Perbaikan di `backend/dcp.gs`: kolom `tanggal` dan `jam` diformat teks sekali (penanda `DCP_TXTFMT` di Script Properties), dan `dcpRows_` mengembalikan nilai Date lama ke teks WIB (`dcpNormDT_`). Data lama tidak diubah.
2. **Jam perangkat dipakai untuk tanggal default formulir Film Testing/DCP.** Sekarang memakai jam server yang sudah disinkronkan (`STC.now`) dengan zona tetap Asia/Jakarta.
3. **`app.js`: dua tampilan waktu memakai zona perangkat** (pemulihan draf dan "Diperbarui" di Laporan Meteran). Sekarang memakai Asia/Jakarta dan jam server.

## Daily Film Testing
- Foto/dokumentasi dipindah ke **bagian paling akhir formulir**, setelah semua checklist dan catatan.
- Setiap studio punya **blok dokumentasi sendiri**: kolom Keterangan dokumentasi (maks. 1000 karakter, kolom baru `ketDok` di `FT_LAPORAN`, ditambahkan otomatis di ujung header) dan foto sendiri. Blok ikut tampil/sembunyi saat studio dicentang.
- Foto tersimpan ke laporan studio masing-masing, dengan label "Dokumentasi Studio N".
- **Ekspor gabungan:** PDF kini memuat foto tiap studio, urut studio lalu laporan, dengan judul Studio + ID + film + keterangan. Tabel tiap studio (PDF dan Excel) punya kolom **Foto** (jumlah) dan **Keterangan dokumentasi**. Ringkasan memuat total foto. Excel tidak menanamkan gambar (library Excel tidak mendukung); foto ada di PDF.
- Ekspor satuan memuat keterangan dokumentasi dan jumlah foto. Detail laporan menampilkan keterangan.
- Alur lebih cepat: kolom "Deskripsi masalah" dan "Tindakan perbaikan" hanya muncul bila ada item FAIL di studio itu (validasi server tidak berubah).

## Performa
- `dcpSheets_` berjalan sekali per eksekusi (sebelumnya membaca header semua sheet di setiap pembacaan).
- `ft_list` menghitung jumlah foto dengan satu kali baca `FT_FOTO`, jadi ekspor tahu studio mana yang punya foto tanpa memanggil `ft_get` untuk semuanya.
- Pengambilan foto untuk PDF berurutan per studio, 3 foto sekaligus (sebelumnya semua foto serentak: berat di HP dan Apps Script).
- Pratinjau foto di formulir membebaskan URL objek (`revokeObjectURL`), mencegah memori membengkak di HP.

## UI formulir
- Kotak foto di semua formulir bermodul DCP/Testing/Pelaporan: tombol dua kolom, penghitung satu baris, thumbnail dengan tombol hapus di sudut (sebelumnya terlipat sebagai grid 120 px).

## File berubah
`backend/dcp.gs`, `modul-dcp.js` (?v=18), `app.js` (?v=169), `legacy-modules.css` (?v=18), `index.html`, `sw.js` (nova-v19-film-testing-dok), `tests/run-all.sh`, `tests/browser/v14.js` (tes usang diperbarui). Baru: `tests/test_ft_dok.js`, `tests/browser/ft-dok.js`, `tests/browser/ft-export-foto.js`.

## Penerapan
1. Tempel `backend/dcp.gs` ke Apps Script → Terapkan → Kelola penerapan → Versi baru. Kolom `ketDok` dan format teks dibuat otomatis pada pemanggilan pertama.
2. Unggah isi `nova/` ke hosting, muat ulang paksa (Ctrl+Shift+R).

## Pengujian
Backend: `test_backend` 62/62, `test_ft_batch` 10/10, `test_dcp_batch` 9/9, `test_photoflow` 47/47, `test_ft_dok` 11/11 (baru), lainnya lulus. Browser (desktop, tablet, phone): semua modul tanpa overflow dan tanpa error JS (18 modul), `v14` 25/25, `v16` 14/14, `audience` 27/27, `audience-draft` 14/14, `ft-multistudio` lulus, `ft-dok` lulus (desktop dan phone, baru), `ft-export-foto` lulus (baru), `pdf-foto` 10/10, `audience-export` 16/16.
`test_auth.js` kini 11/11: tes lama memakai akun Admin yang memang dikecualikan dari blokir, jadi diubah ke akun biasa dan ditambah cek Admin tidak terkunci (tidak ada perubahan kode backend).
Belum diuji: Apps Script nyata (backend diuji dengan tiruan), PDF/Excel asli dibuka visual (library CDN tidak tersedia saat uji; PDF diuji dengan perekam), dan perangkat fisik.
