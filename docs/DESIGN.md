# NOVA — Design System v2 ("Ruang Proyeksi")

Mode: **Operate** — alat kerja harian teknisi dan admin outlet XXI. Identitas lewat tipe, palet, kepadatan, dan satu signature move; bukan dekorasi. Implementasi: `nova-ds.css` (dimuat paling akhir). Struktur Figma (sidebar 244px, topbar 72px, padding konten 32px, radius 10/8) dipertahankan.

## Signature: cue mark
Cincin emas 9px (tanda pergantian reel di pojok frame film). **Kosong = tidak aktif, terisi = aktif.** Hanya untuk keadaan: menu aktif (kanan item), studio terpilih (chip), peringatan terbuka (ringkasan dashboard, "Perlu diperbaiki"). Tidak boleh dipakai sebagai hiasan.

## Palet
| Token | Terang | Gelap | Peran |
|---|---|---|---|
| `--brand` | #6a4bdc | #9a82f2 | Aksi utama, fokus, pilihan |
| `--cue` | #c79f45 | #d9b45a | Signature (cue mark), "data kosong" |
| `--side` | #26164b | #150f2e | Rangka sidebar |
| `--canvas/--surface` | #f6f4f9 / #fff | #100c20 / #181230 | Netral berwarna violet, bukan abu kebiruan |
| `--ink/--body/--mute/--faint` | #1b1630 / #2b2542 / #6a6482 / #736d8b | terang di gelap | Teks. Semua ≥ 4.5:1 |
| `--ok/--warn/--err/--info` | semantik | | Hanya untuk status |
| `--on-brand` | #fff | #140d2b | Teks di atas tombol utama |

## Tipe (satu keluarga: Inter)
Skala tetap: 12 (keterangan, kepala tabel) · 13 (UI, tabel, tombol) · 14 (isi) · 16 (judul bagian) · 20 · 24 (judul halaman). Angka tabular di semua tabel/KPI; ID memakai mono dengan nol bergaris. Di HP, kolom input 16px (tanpa zoom iOS).

## Komponen
- **Tombol:** 40px (44px di HP), satu utama per area; sekunder outline; bahaya outline merah.
- **Ringkasan angka (ledger):** satu panel bergaris tipis, sel tanpa ikon; di tablet 2+3, di HP 2 kolom (sel ganjil terakhir penuh). Tidak ada slot kosong.
- **Aksi cepat:** deretan tombol, bukan kartu ikon.
- **Tabel:** kepala 12px, baris 44px, hover, fokus keyboard; di HP menjadi kartu berlabel (`.stack`).
- **Status:** pil 11.5px, atau titik + teks (Monitoring AC). Tanpa garis tepi berwarna tebal.
- **Menu Download:** `z-index` terangkat saat terbuka, membuka ke atas bila kurang ruang, bottom-sheet di HP.
- **Gerak:** 150–250 ms, hanya untuk perubahan state; hormati `prefers-reduced-motion`.
- **Permukaan browser:** seleksi, caret, scrollbar, fokus, garis bawah tautan ikut palet.

## Larangan
Eyebrow/kicker di atas judul · kartu ikon+judul+teks sebagai struktur halaman · kartu bersarang · garis tepi samping > 1px · gradien pada teks · halo berwarna tanpa offset · cue mark sebagai dekorasi.
