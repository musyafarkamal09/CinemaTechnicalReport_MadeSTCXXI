// Uji ekspor Data Penonton (Excel & PDF) dengan library XLSX/jsPDF tiruan (CDN tidak tersedia saat uji offline).
// Yang diuji: isi baris/kolom yang dikirim ke library. Berkas .xlsx/.pdf asli belum dibuka secara visual.
const { chromium } = require('playwright');
const { install } = require('./mockapi');
const R = []; const ck = (n, c, d) => R.push({ n, ok: !!c, d: c ? '' : (d || '') });
const items = [
  { id: 'DP-20261107-0002', type: 'audience', title: 'Data Penonton - 2026-11-07', reporter: 'Budi', createdAt: Date.now(), updatedAt: Date.now(), ph: { n: 0 },
    data: { date: '2026-11-07', note: 'Ramai', totalShow: 2, totalTiket: 30, totalPenonton: 25, studios: [
      { studio: 'Studio 2', shows: [{ show: 'SHOW1', film: 'Film <b>X</b>', jam: '10:00', tiket: 30, penonton: 25, petugas: 'Sari', ket: '' }] },
      { studio: 'Studio 5', shows: [{ show: 'SHOW6', film: 'Film Y', jam: '', tiket: '', penonton: 4, petugas: '', ket: 'tes' }] }] } },
  { id: 'DP-20261107-0001', type: 'audience', title: 'Data Penonton - 2026-11-07', reporter: 'Musyafar Kamal', createdAt: Date.now() - 1000, updatedAt: Date.now(), ph: { n: 0 },
    data: { date: '2026-11-07', note: '', totalShow: 1, totalTiket: 10, totalPenonton: 8, studios: [{ studio: 'Studio 1', shows: [{ show: 'SHOW1', film: 'Film A', jam: '12:30', tiket: 10, penonton: 8, petugas: 'Budi', ket: 'ok' }] }] } }
];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('stc_t', 't'); localStorage.setItem('stc_u', JSON.stringify({ userId: 'U1', name: 'Musyafar Kamal', username: 'admin', role: 'ADMIN' }));
    window.__cap = { tables: [], sheets: [], saved: [] };
    window.XLSX = { utils: { book_new: () => ({}), aoa_to_sheet: a => ({ aoa: a }), encode_range: () => 'A1', book_append_sheet: (wb, ws, name) => window.__cap.sheets.push({ name, aoa: ws.aoa }) }, writeFile: (wb, n) => window.__cap.saved.push(n), write: () => [] };
    const doc = new Proxy({ internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } }, lastAutoTable: { finalY: 60 }, autoTable: o => window.__cap.tables.push(o), save: n => window.__cap.saved.push(n), getNumberOfPages: () => 1 }, { get: (t, k) => (k in t) ? t[k] : () => doc });
    window.jspdf = { jsPDF: function () { return doc; } };
  });
  const page = await ctx.newPage(); await page.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await install(page);
  await page.route('https://script.google.com/**', async route => {
    const req = route.request(); if (req.method() !== 'POST') return route.fallback();
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
    const send = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: d, now: Date.now() }) });
    if (body.action === 'rep_export' && body.type === 'audience') return send({ items });
    if (body.action === 'rep_list' && body.type === 'audience') return send({ items, total: 2, page: 1, size: 15 });
    if (body.action === 'rep_get') return send(Object.assign({}, items[0], { photos: [], editable: true }));
    return route.fallback();
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto((process.env.BASE || 'http://localhost:8765') + '/index.html', { waitUntil: 'load' }); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#nav a[data-p=audience]').click()); await page.waitForTimeout(700);
  // daftar: ringkasan XSS-aman
  const lst = await page.evaluate(() => document.querySelector('#rl').innerHTML);
  ck('daftar: nama studio tampil, tanpa tag mentah', /Studio 2, Studio 5/.test(lst) && !/<b>X<\/b>/.test(lst));
  // Excel daftar
  await page.evaluate(() => { document.querySelector('[data-dlt]').click(); }); await page.click('#rx'); await page.waitForTimeout(800);
  let cap = await page.evaluate(() => window.__cap); let sh = cap.sheets.find(s => s.name === 'Data Penonton');
  ck('excel: sheet "Data Penonton" dibuat', !!sh, JSON.stringify(cap.sheets.map(s => s.name)));
  const hd = sh && sh.aoa[3], rows = sh ? sh.aoa.slice(4) : [];
  ck('excel: header kolom sesuai tabel kertas', hd && hd.slice(2, 10).join('|') === 'Studio|Show|Nama Film|Jam Show|Tiket Terjual|Penonton Masuk|Petugas|Keterangan', hd && hd.join('|'));
  ck('excel: satu baris per show (3 baris), urut lama -> baru', rows.length === 3 && rows[0][0] === 'DP-20261107-0001' && rows[2][2] === 'Studio 5', JSON.stringify(rows.map(r => r.slice(0, 4))));
  ck('excel: angka tersimpan sebagai angka, kosong tetap kosong', rows[0][6] === 10 && rows[0][7] === 8 && rows[2][6] === '' && rows[2][7] === 4, JSON.stringify(rows.map(r => [r[6], r[7]])));
  ck('excel: nama file Data_Penonton', cap.saved.some(n => /^Laporan_Data_Penonton_/.test(n)), JSON.stringify(cap.saved));
  // PDF daftar
  await page.evaluate(() => { window.__cap.tables.length = 0; window.__cap.saved.length = 0; document.querySelector('[data-dlt]').click(); });
  await page.click('#rpdf'); await page.waitForTimeout(800);
  cap = await page.evaluate(() => ({ t: window.__cap.tables.map(o => ({ head: o.head, body: o.body })), saved: window.__cap.saved }));
  const t0 = cap.t[0];
  ck('pdf daftar: tabel dibuat dengan 10 kolom, 3 baris', t0 && t0.head[0].length === 10 && t0.body.length === 3, JSON.stringify(t0 && [t0.head[0].length, t0.body.length]));
  ck('pdf daftar: angka format id-ID dan sel kosong', t0 && t0.body[0][6] === '10' && t0.body[2][6] === '' && t0.body[2][7] === '4', JSON.stringify(t0 && t0.body.map(r => [r[6], r[7]])));
  ck('pdf daftar: nama file Data_Penonton', cap.saved.some(n => /^Laporan_Data_Penonton_.*\.pdf$/.test(n)), JSON.stringify(cap.saved));
  // PDF laporan tunggal
  await page.evaluate(() => { window.__cap.tables.length = 0; window.__cap.saved.length = 0; });
  await page.locator('[data-d]').first().click(); await page.waitForTimeout(700);
  await page.evaluate(() => { document.querySelector('#modal [data-dlt]').click(); }); await page.click('#dpdf'); await page.waitForTimeout(1200);
  cap = await page.evaluate(() => ({ t: window.__cap.tables.map(o => ({ head: o.head, body: o.body })), saved: window.__cap.saved }));
  const tb = cap.t.find(x => x.head && x.head[0] && x.head[0][0] === 'Studio');
  ck('pdf tunggal: tabel "Rincian per studio dan show" + baris total', tb && tb.body.length === 3 && tb.body[2][0] === 'Total' && tb.body[2][4] === '30' && tb.body[2][5] === '29', JSON.stringify(tb && tb.body));
  ck('pdf tunggal: sel kosong jadi "-"', tb && tb.body[1][3] === '-' && tb.body[1][4] === '-', JSON.stringify(tb && tb.body[1]));
  ck('tanpa galat JS', errs.length === 0, errs.join(' | '));
  const bad = R.filter(x => !x.ok);
  console.log(R.map(x => (x.ok ? 'PASS ' : 'FAIL ') + x.n + (x.ok ? '' : ' :: ' + x.d)).join('\n')); console.log(`HASIL ekspor: ${R.length - bad.length}/${R.length} lulus`);
  await b.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.stack); process.exit(1); });
