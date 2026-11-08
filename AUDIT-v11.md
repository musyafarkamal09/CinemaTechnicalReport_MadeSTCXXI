# NOVA – Audit v11: Sidebar (ukuran sesuai referensi)

## Akar masalah
1. Item navigasi mengecil menjadi 16 px, karena `#nav` adalah flex column dengan `overflow-y: auto` dan item bisa menyusut (`flex-shrink`). Pill aktif tampak kecil dan tidak rapi.
2. Jarak antar item 53 px, karena `#nav { gap: 16px }` berlaku juga untuk setiap item.
3. Label "Inspeksi & Patroli Studio" pecah dua baris dan membuat pill makin tinggi.
4. Sumber gaya saling bertabrakan: `tailwind.css` dan `figma.css` sama-sama mengatur `#nav a`.

## Perbaikan (figma.css, di dalam `@media (min-width: 821px)`)
- Item: `flex: none`, tinggi 32 px, radius 10 px, teks 11.5 px tanpa wrap, jarak antar item 2.5 px (pitch 37 px).
- Pill aktif: `#49337b` solid, tanpa bar kiri (inset).
- Lebar pill sekitar 204 px, dibandingkan referensi sekitar 208 px.
- Label grup: `margin: 18px 12px 6px`.
- Mobile (≤820 px) tidak diubah.

Ukuran diambil dari piksel screenshot referensi (skala 225 px ke 244 px, faktor 1.084).

## Hasil uji
- `tests/browser/ac-download-sidebar.js`: lulus, termasuk warna aktif, tanpa inset, dan transisi.
- Regresi 18 modul desktop dan HP: tanpa error, tanpa overflow.
- Tinggi item 32 px untuk semua item; teks aktif muat dalam pill.

## Keputusan yang perlu Anda konfirmasi
- **Gradasi transparan:** referensi terbaru memakai `#49337b` solid, bukan gradasi putih transparan. Saya mengikuti referensi. Jika Anda ingin gradasi, beri nilai warna awal dan akhir.
- **Brand dan blok outlet:** referensi memperlihatkan blok "Outlet Operation System · Gandaria City XXI" dan judul "Technical Report". Saya tidak mengubahnya, karena identitas NOVA dan outlet Sukaramai sudah Anda tetapkan. Konfirmasi jika Anda ingin brand itu diganti.

## Belum diverifikasi
- Ukuran sidebar diukur pada viewport 1440 px. Pengujian pada lebar lain hanya untuk overflow dan error.
- Warna dan ukuran dibandingkan dengan screenshot, bukan file Figma (`.fig` tidak bisa dibaca di sesi ini).
