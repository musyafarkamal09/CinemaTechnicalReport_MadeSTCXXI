# NOVA v14 — Ringkasan Perubahan, Bug, Pengujian, dan Penerapan

NOVA — An Innovation by MK · Designed & Developed by MK

## Cakupan & batasan audit
- Diaudit: frontend (app.js, modul-dcp.js, pelaporan.js, CSS), backend Apps Script (Code.gs, dcp.gs), routing/dispatch, PDF/Excel, PWA (sw.js), 3 screenshot yang dilampirkan.
- **Tidak ikut terunggah:** file Figma, logo terbaru, dan screenshot lain. Standar visual memakai `figma.css` dan aset logo yang ada di ZIP (logo-xxi.png, nova-logo.png, logo.png). Jika logo terbaru berbeda, cukup timpa file aset dengan nama yang sama.
- **PDF belum diuji dengan jsPDF asli:** sandbox tidak punya akses jaringan ke CDN. Logika PDF diuji dengan jsPDF tiruan (isi, urutan, header/footer tiap halaman). **Wajib cek visual** satu kali di browser (lihat "Penerapan").

## Bug yang diperbaiki
| # | Bug | Perbaikan |
|---|-----|-----------|
| 1 | Menu Download tertimpa/terpotong (hanya "Excel" terlihat; "Dokumen PDF" tertimpa tombol Edit/Arsipkan/Tutup) — container tombol punya animasi `transform` sehingga membentuk stacking context | z-index container diangkat saat menu terbuka; menu membuka ke atas bila ruang bawah kurang; di HP menjadi bottom-sheet (nova.css, app.js) |
| 2 | Menu Download di panel item DCP tertimpa judul "Timeline" (ditemukan oleh test baru) | Aturan z-index diperluas ke `.mi-sib/.mi-bfoot` |
| 3 | Tombol aksi utama (mis. "Catat pekerjaan") hilang di HP | Tombol tetap di bar filter di HP |
| 4 | Tombol "Buat" di tab bawah HP: seluruh tab jadi lingkaran ungu, label gelap | Lingkaran hanya di ikon, label normal |
| 5 | Filter laporan di HP bertumpuk/terpotong, input <16px (zoom iOS) | Grid 2 kolom, input 16px, target sentuh 44px |
| 6 | Teks "Menyiapkan ruang kerja NOVA" tampil di dasar halaman; `id="oosMsg"` ganda; `</div>` berlebih (sisa merge di index.html) | Fragmen dihapus; HTML tervalidasi seimbang |
| 7 | Kolom date di filter Film Testing melar ±215px (`flex:1 1 240px` pada input dalam label kolom) | `flex:none`, tinggi 44px |
| 8 | Simpan multi-item DCP **tidak atomik**: item ke-3 gagal → item 1–2 tetap tersimpan (laporan setengah jadi) | `dcp_batch_save` di server: validasi semua, tulis di bawah lock, **rollback** bila gagal (DCP Management & Pelaporan DCP) |
| 9 | Tabel di HP menyembunyikan kolom (Film/Tester) | Tabel jadi kartu berlabel (class `stack`) di DCP, Film Testing, panel item |
| 10 | PDF: logo hanya halaman 1 (daftar), footer tanpa identitas, tanpa header berulang, karakter seperti "→" rusak | `pdfkit.js`: header logo XXI + NOVA, footer "NOVA — An Innovation by MK / Designed & Developed by MK", "Halaman k / n" di SETIAP halaman, sanitasi karakter, header tabel berulang |
| 11 | PDF DCP hanya memuat 1 item per laporan dan tanpa foto | PDF/Excel laporan lengkap: ringkasan semua item + kelengkapan tiap item + foto tiap item |
| 12 | Label versi footer masih v13.0 | v14.0; cache service worker `nova-v14` |

## Fitur baru / disempurnakan
- **DCP multi-item:** panel "Item DCP dalam laporan ini" — lihat, **tambah**, **ubah**, **hapus** per item; tambah item ke laporan lama (laporan tunggal otomatis diikat ke batch tanpa mengubah data lain); penanda "Multi-item (n)" di daftar; judul film, kode disk, format, status per item; PDF/Excel lengkap. Pelaporan DCP: panel laporan multi-item + unduhan lengkap.
- **Daily Film Testing multi-studio:** pilih **studio berapa pun** (default semua; tombol "+ Studio" untuk studio ke-5, ke-6, dst.); KPI gabungan; **rekap per studio + total**; satu bagian/tabel terpisah per studio; filter tanggal; daftar "perlu tindakan" lintas studio. **Ekspor gabungan:** PDF (info → rekap → satu tabel per studio, termasuk temuan FAIL) dan Excel (lembar *Rekap* + satu lembar per studio). Data antar studio tidak dicampur.
- PDF detail DCP/Film Testing menyertakan foto dokumentasi.

## Integritas data
Tidak ada perubahan skema sheet. Data, histori, dan ID lama tidak diubah. Satu-satunya penulisan data lama: saat Admin menekan "+ Tambah item" pada laporan tunggal lama, kolom `batchId` yang sebelumnya kosong diisi.

## Hasil pengujian
| Suite | Hasil |
|---|---|
| Test lama: auth, backend, cellsafe, draft, uniq | semua lulus (tanpa regresi) |
| `tests/test_dcp_batch.js` (atomik, rollback, duplikat, batas 30, lock) | 9/9 |
| `tests/test_pdfkit.js` (header/logo/footer tiap halaman, sanitasi) | 6/6 |
| `tests/browser/v14.js` — desktop 1440, tablet 820, HP 390 | 25/25 per ukuran |
| `tests/browser/run.js` (semua modul), ac-download-sidebar, ats-countdown, buat, forms2, meter-chart | tanpa error JS, tanpa overflow horizontal |
Cakupan v14.js: menu Download tidak tertimpa; FT 5 studio, subset studio, rekap & total, isolasi data studio, ekspor PDF/Excel gabungan, tambah studio; DCP panel item, hapus, tambah item ke batch (satu `dcp_batch_save`), PDF/Excel lengkap.

## Penerapan
1. **Backend:** buka Apps Script → ganti isi `backend/Code.gs` dan `backend/dcp.gs` dengan versi ZIP ini → Deploy → *Manage deployments* → versi baru (URL Web App tetap). Tidak ada migrasi data.
2. **Frontend:** unggah seluruh isi folder `nova/` ke hosting (menimpa v13). File baru: `pdfkit.js`, `nova.css` (diperbarui).
3. Buka NOVA, lalu muat ulang paksa (service worker `nova-v14` otomatis membersihkan cache lama).
4. **Verifikasi PDF (5 menit):** (a) DCP multi-item → Download laporan lengkap → PDF; (b) Film Testing → pilih ≥4 studio → Download laporan gabungan → PDF; periksa logo XXI + NOVA dan footer MK di tiap halaman. Laporkan bila ada yang terpotong.
5. Rollback: kembalikan file v13; tidak ada perubahan skema.
