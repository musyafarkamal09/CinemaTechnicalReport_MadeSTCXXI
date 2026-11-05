// Uji nama unduhan unik: fungsi uniq_ dari app.js dijalankan langsung (tanpa browser).
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const m = src.match(/var UQ_=0;function uniq_\(n\)\{.*\}/);
if (!m) { console.log('FAIL fungsi uniq_ tidak ditemukan'); process.exit(1); }
const uniq_ = new Function(m[0] + '; return uniq_;')();
let fail = 0; const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : '')); if (!c) fail++; };
const names = Array.from({ length: 500 }, () => uniq_('Laporan_AC_2026-11-05.xlsx'));
ok('500 unduhan nama sama -> 500 nama unik', new Set(names).size === 500, 'unik ' + new Set(names).size);
ok('ekstensi .xlsx dipertahankan', names.every(n => /\.xlsx$/.test(n)), names[0]);
ok('ekstensi .pdf dipertahankan', /\.pdf$/.test(uniq_('Laporan_X.pdf')), uniq_('Laporan_X.pdf'));
ok('nama dasar tetap ada di depan', names[0].indexOf('Laporan_AC_2026-11-05_') === 0, names[0]);
ok('tanpa karakter spasi/aneh', names.every(n => /^[\w\-.]+$/.test(n)), names[0]);
const callSites = (src.match(/uniq_\(/g) || []).length - 1;
ok('semua titik simpan memakai uniq_ (6 pemanggilan)', callSites === 6, 'pemanggilan ' + callSites);
console.log(fail ? `\nGAGAL ${fail}` : '\nSEMUA LULUS'); process.exit(fail ? 1 : 0);
