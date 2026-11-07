/* NOVA v16 — uji tata letak foto PDF (NovaPDF.photoFlow): geometri, rasio, tanpa tumpang tindih, tanpa halaman kosong. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const win = { OOS_BRAND: null }; const ctx = { window: win, console, Math, Date, Intl };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'pdfkit.js'), 'utf8'), ctx);
const NP = win.NovaPDF;
const PORTRAIT = { W: 210, H: 297, M: 12, TOP: 38, BOT: 297 - 16 - 2 }, LAND = { W: 297, H: 210, M: 10, TOP: 38, BOT: 210 - 16 - 2 };
const out = []; const t = (n, c, d) => out.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d));
function fake() { const d = { pages: 1, imgs: [], addPage() { d.pages++; }, getNumberOfPages() { return d.pages; }, addImage(data, f, x, y, w, h) { d.imgs.push({ page: d.pages, x, y, w, h, data }); },
  setDrawColor() {}, setLineWidth() {}, rect() {}, setFont() {}, setFontSize() {}, setTextColor() {}, text() {}, splitTextToSize: s => [String(s)] }; return d; }
const R = { p: [800, 1200], l: [1200, 800], s: [1000, 1000], w: [1600, 900], t: [900, 1600] };
function mk(seq) { return seq.split('').map((c, i) => ({ data: 'D' + i, w: R[c][0], h: R[c][1], caption: 'F' + i })); }
function run(name, seq, P, y0, extra) {
  const d = fake(), list = mk(seq), cap = 10, X = P.M, AW = P.W - 2 * P.M;
  const r = NP.photoFlow(d, list, Object.assign({ x: X, y: y0, w: AW, top: P.TOP, bottom: P.BOT, maxCols: P.W > 250 ? 4 : 3, target: 66, hmax: 110, capH: cap, headH: 8, drawHead() {} }, extra || {}));
  const im = d.imgs, why = [];
  if (im.length !== list.length) why.push('jumlah foto ' + im.length + '/' + list.length);
  im.forEach((g, i) => { const a = list[i].w / list[i].h; if (Math.abs(g.w / g.h - a) > 1e-6) why.push('rasio rusak #' + i); if (g.data !== list[i].data) why.push('urutan #' + i);
    if (g.x < X - 1e-6 || g.x + g.w > X + AW + 1e-6) why.push('keluar lebar #' + i); if (g.y < P.TOP - 1e-6 || g.y + g.h + cap > P.BOT + 1e-6) why.push('keluar halaman #' + i + ' (' + (g.y + g.h + cap).toFixed(1) + ')'); });
  for (let i = 0; i < im.length; i++) for (let j = i + 1; j < im.length; j++) { const a = im[i], b = im[j]; if (a.page === b.page && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h + cap && b.y < a.y + a.h + cap) why.push('tumpang tindih ' + i + '/' + j); }
  const used = new Set(im.map(g => g.page)); for (let p = (y0 === P.TOP ? 1 : 1); p <= d.pages; p++) if (!used.has(p) && p > 1) why.push('halaman kosong ' + p);
  const minH = Math.min.apply(null, im.map(g => g.h));
  const minW = Math.min.apply(null, im.map(g => g.w));
  if (im.length > 1 && (minH < 45.9 || minW < 31.9)) why.push('foto di bawah batas keterbacaan h=' + minH.toFixed(1) + ' w=' + minW.toFixed(1));
  // kepadatan: rata-rata sisa ruang vertikal pada halaman penuh (bukan halaman terakhir)
  const fills = []; for (let p = 1; p < d.pages; p++) { const g = im.filter(x => x.page === p); if (!g.length) continue; const top = p === 1 ? y0 + 8 : P.TOP, last = Math.max.apply(null, g.map(x => x.y + x.h + cap)); fills.push((last - top) / (P.BOT - top)); }
  const minFill = fills.length ? Math.min.apply(null, fills) : 1;
  if (minFill < 0.5) why.push('halaman terisi hanya ' + Math.round(minFill * 100) + '%');
  t(name + ' [' + list.length + ' foto, ' + d.pages + ' hal]', !why.length, why.join('; '));
  return { d, r };
}
const seqs = { '1 persegi': 's', '1 portrait': 'p', '1 landscape': 'l', '2 landscape': 'll', '2 portrait': 'pp', '3 portrait': 'ppp', '4 campuran': 'plsw', '5 campuran': 'pllps', '6 portrait': 'pppppp', '7 landscape': 'lllllll', '9 campuran': 'plswtpllp', '12 campuran': 'plswtplpwtsl', '25 campuran': 'plswtplpwtslplswtplpwtslp', '8 tinggi (9:16)': 'tttttttt' };
for (const [n, s] of Object.entries(seqs)) { run('A4 portrait, di bawah tabel (y=120): ' + n, s, PORTRAIT, 120); run('A4 portrait, awal halaman: ' + n, s, PORTRAIT, PORTRAIT.TOP); run('A4 landscape, di bawah tabel (y=110): ' + n, s, LAND, 110); }
run('sisa ruang sempit (y=255) tetap benar: 5 campuran', 'pllps', PORTRAIT, 255);
// foto langsung di halaman yang sama dengan tabel jika ruang cukup
{ const d = fake(); const r = NP.photoFlow(d, mk('ll'), { x: 12, y: 100, w: 186, top: 38, bottom: 279, capH: 10, headH: 8, drawHead() {} }); t('2 foto landscape muat di halaman 1 tanpa halaman baru', d.pages === 1 && r.pages === 0, d.pages); }
{ const d = fake(); NP.photoFlow(d, mk('pp'), { x: 12, y: 270, w: 186, top: 38, bottom: 279, capH: 10, headH: 8, drawHead() {} }); t('judul tidak yatim: sisa < judul+foto -> pindah halaman bersama judul', d.pages === 2 && d.imgs.every(g => g.page === 2), d.pages); }
{ const d = fake(); const r = NP.photoFlow(d, [{ data: 'x', w: 0, h: 0 }, { data: 'y', w: 500, h: 500 }], { x: 12, y: 100, w: 186, top: 38, bottom: 279, capH: 10 }); t('dimensi foto nol tidak merusak tata letak', d.imgs.length === 2 && d.imgs.every(g => isFinite(g.w) && isFinite(g.h) && g.h > 0), JSON.stringify(d.imgs)); }
// via render(): DCP/Film Testing — judul, tabel, foto, header/footer di semua halaman
{ const d = fake(); d.autoTable = o => { d.lastAutoTable = { finalY: (o.startY || 38) + (o.body.length + 1) * 6 }; }; d.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }; d.setProperties = () => {}; d.setPage = () => {}; d.setFillColor = () => {}; d.line = () => {};
  win.jspdf = { jsPDF: function () { return d; } };
  const doc = NP.render({ title: 'Uji', id: 'X-1', blocks: [{ t: 'pairs', rows: [['A', 'b'], ['C', 'd']] }, { t: 'photos', title: 'Foto', list: mk('plswtplpwts') }] });
  t('render(): foto ditempatkan tepat di bawah tabel informasi (halaman 1)', d.imgs.length === 11 && d.imgs[0].page === 1, JSON.stringify(d.imgs[0])); }
console.log(out.join('\n')); const f = out.filter(x => x.startsWith('FAIL')).length; console.log('\nHASIL: ' + (out.length - f) + '/' + out.length + ' lulus'); process.exit(f ? 1 : 0);
