# NOVA v15 — Penyempurnaan UI/UX dengan Impeccable

NOVA — An Innovation by MK · Designed & Developed by MK

Lanjutan v14 (semua perbaikan bug, DCP, Film Testing, PDF tetap). v15 hanya mengubah tampilan dan sedikit markup dashboard; backend dan data tidak berubah.

## Audit (Impeccable, mode Operate) → perbaikan
| Temuan | Perbaikan |
|---|---|
| Dashboard = template SaaS: 5 kartu aksi (ikon+judul+teks) + 5 kartu KPI (ikon+angka besar), sel kosong di tablet/HP | Aksi cepat jadi satu deretan tombol; KPI jadi satu ledger (tablet 2+3, HP 2 kolom), tanpa slot kosong |
| Label "CATAT CEPAT" (eyebrow, dilarang) | Dihapus; `aria-label` dipertahankan |
| Sapaan dashboard terpotong header; di HP rata kanan dan teks terpotong | Padding atas, tata letak kolom di HP |
| Tile Monitoring AC memakai garis tepi tebal 4px; panel bersarang | Titik status + teks; panel tidak bersarang |
| Netral abu kebiruan bertabrakan dengan violet; tidak ada identitas | Netral violet + satu aksen emas dari logo + **cue mark** (cincin emas) sebagai signature |
| Tipe 10–12px untuk input/label; placeholder 3.6:1 | Skala 12/13/14/16/20/24; placeholder 4.9:1; semua teks ≥ 4.5:1 (terang & gelap) |
| Teks putih di tombol utama mode gelap 3:1 | Token `--on-brand` (6.1:1) |
| KPI DCP/Film Testing: kartu terpisah, angka tipis, tidak konsisten | Ledger bergaris tipis, bobot 650, tabular |
| Chip studio sama-sama ungu pekat | Cincin kosong = tidak dipilih, terisi = dipilih |
| Tab bawah HP: label "Buat" turun 3px, halo berwarna | Disejajarkan; bayangan bertumpu |
| Permukaan browser default (seleksi, caret, scrollbar, fokus) | Ikut palet |
| Bug: grafik meteran error "reading 'total'" bila respons kosong | Dijaga (`(r.count||{}).total`) |

## File
- Baru: `nova-ds.css` (sistem desain), `DESIGN.md` (dokumentasi sistem).
- Diubah: `index.html` (memuat `nova-ds.css`, versi v15.0), `app.js` (markup aksi cepat, guard meteran), `sw.js` (cache `nova-v15`), `nova.css` (aturan KPI lama dihapus), `tests/browser/ac-download-sidebar.js` (ekspektasi visual diperbarui ke spesifikasi baru).

## Pengujian
Test unit lama dan baru: semua lulus (auth 10, backend 22, dcp_batch 9, pdfkit 6, cellsafe, draft, uniq). `v14.js` 25/25 di desktop, tablet, HP. `run.js` (semua modul): 0 error JS, 0 overflow. `ac-download-sidebar`, `ats-countdown`, `buat`, `forms2`: lulus.

## Catatan jujur
- Figma tidak terunggah; struktur Figma dari `figma.css` dipertahankan, namun **warna netral digeser** dari abu kebiruan (#f5f6fa) ke netral violet (#f6f4f9) dan violet utama sedikit digelapkan (#8064e9 → #6a4bdc) demi kontras 5.7:1. Kembalikan nilai ini di `nova-ds.css` bila Figma mewajibkan nilai lama.
- Font tetap Inter (standar Figma). Tidak ditambah keluarga font kedua karena tidak ada peran yang hanya bisa dipenuhi font lain.
- Halaman yang tidak diaudit mendalam: Pengaturan Sistem, Glossarium, Audit Log, Penyimpanan Data. Mereka mewarisi token baru dan tampil konsisten, tetapi belum dirancang ulang per layar.
- PDF tetap perlu dicek visual sekali dengan jsPDF asli (lihat catatan v14).

## Penerapan
Unggah seluruh folder `nova/` (menimpa v14), muat ulang paksa. Tidak ada perubahan backend/skema. Rollback: kembalikan `index.html`, `app.js`, `nova.css`, `sw.js` v14 dan hapus `nova-ds.css`.
