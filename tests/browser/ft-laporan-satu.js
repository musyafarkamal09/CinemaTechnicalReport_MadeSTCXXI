/* Uji v20: Daily Film Testing = SATU laporan per hari berisi banyak studio (daftar, detail, tambah studio, header tidak tertimpa, judul dokumentasi tebal). */
const { chromium } = require(process.env.PW || 'playwright');
const { install, handlers } = require('./mockapi');
const W = process.argv[2] || 'desktop';
const VP = { desktop:{width:1440,height:900}, tablet:{width:820,height:1180}, phone:{width:390,height:844} }[W];
const mk = (id, z, st, extra) => Object.assign({ id, tanggal: '2026-11-08', jam: '09:00', film: 'FILM A', studio: z, format: '2D', server: 'S', projector: 'P', tester: 'T', status: st, checklist: [], masalah: '', tindakan: '', hasilUlang: '', catatanTeknisi: '', parentId: '', batchId: 'B1', ketDok: '', fotoCount: 0, createdAt: 1 }, extra || {});
let LAP = [mk('FT-1', '1', 'PASSED', { ketDok: 'Layar 1', fotoCount: 1 }), mk('FT-2', '2', 'FAILED', { masalah: 'buram', tindakan: 'lensa' }), mk('FT-3', '3', 'PASSED'), mk('FT-4', '4', 'PASSED'),
  mk('FT-5', '2', 'PASSED', { parentId: 'FT-2', batchId: '', tanggal: '2026-11-09' }),
  mk('FT-9', '1', 'PASSED', { tanggal: '2026-11-07', batchId: '', film: 'FILM LAMA' })];
const saved = [];
handlers.ft_list = () => LAP;
handlers.dcp_meta = () => ({ komponen: [], komponenStatus: [], formatDcp: [], statusDcp: [], formatFt: ['2D'], status: [], checklist: [{ name: 'G' }], checklistItem: [{ id: 'g1', grp: 'G', label: 'Fokus' }] });
handlers.ft_report_get = b => { const seed = LAP.find(x => x.id === b.id); const root = x => { let c = x; while (c.parentId) c = LAP.find(y => y.id === c.parentId); return c; }; const k = root(seed).batchId || root(seed).id; const g = LAP.filter(x => (root(x).batchId || root(x).id) === k); const foto = {}; g.forEach(l => { if (l.fotoCount) foto[l.id] = [{ fotoId: l.id + 'F', kind: 'Dokumentasi Studio ' + l.studio }]; }); return { key: k, laporan: g, foto }; };
handlers.ft_photo_get = b => ({ fotoId: b.fotoId, url: 'data:image/jpeg;base64,/9j/' });
handlers.ft_save = b => { saved.push(b); return 'FT-NEW'; };
handlers.ft_batch_save = b => { saved.push(b); return { batchId: b.batchId, ids: b.items.map((_, i) => 'FT-N' + i) }; };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: VP });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('nova_studios', '["5"]'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Admin',username:'admin',role:'ADMIN'})); });
  const page = await ctx.newPage(); await page.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await install(page);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto((process.env.BASE || 'http://localhost:8766') + '/index.html'); await page.waitForTimeout(1000);
  await page.evaluate(() => { const a = document.querySelector('#nav a[data-p="ftest"]') || document.querySelector('#tabs a[data-p="ftest"]'); a.click(); });
  await page.waitForTimeout(900);
  const r = {};
  r.rows = await page.$$eval('.ftr-list tbody tr[data-ft-open]', e => e.length);              /* 2 laporan: B1 (retest ikut) + laporan lama tunggal */
  r.chips = await page.$$eval('.ftr-list tbody tr:first-child .ftr-chip', e => e.length);   /* 4 studio dalam satu baris */
  r.firstStatus = await page.$eval('.ftr-list tbody tr:first-child td[data-l="Hasil"]', e => e.textContent.trim());
  r.sections = await page.$$eval('section.ft-studio', e => e.length);                         /* tidak dipecah per studio */
  r.overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  r.hdrZ = await page.evaluate(() => [getComputedStyle(document.querySelector('#main > header')).zIndex, getComputedStyle(document.querySelector('.ft-rekap')).zIndex].map(Number));
  await page.click('.ftr-list tbody tr:first-child'); await page.waitForTimeout(700);
  r.detailStudios = await page.$$eval('.ftr-st', e => e.length);
  r.detailTitles = await page.$$eval('.ft-dokt b', e => e.map(x => x.textContent.trim() + '|' + getComputedStyle(x).fontWeight));
  r.retestHist = await page.$$eval('.ftr-st[data-studio="2"] .mdc-tl li', e => e.length);
  r.s2status = await page.$eval('.ftr-st[data-studio="2"] header', e => e.textContent.trim());
  r.addBtn = await page.$$eval('#ftadd', e => e.length);
  await page.click('#ftadd'); await page.waitForTimeout(500);
  r.appendChips = await page.$$eval('#ftchips input[name=stu]', e => e.map(x => x.value));
  r.dateRO = await page.$eval('[name=tanggal]', e => e.readOnly + ':' + e.value);
  r.legend = await page.$$eval('.ft-doc > legend', e => e.map(x => x.textContent.trim() + '|' + getComputedStyle(x).fontWeight));
  await page.fill('[name=film]', 'FILM A'); await page.click('#ftok'); await page.waitForTimeout(800);
  r.saved = saved.map(s => s.items ? { batch: s.batchId, st: s.items.map(i => i.studio) } : { batch: s.batchId, st: [s.studio] });
  r.errs = errs; console.log(JSON.stringify(r));
  await page.screenshot({ path: `shots/ft-laporan-${W}.png` });
  await b.close();
  const ok = r.rows === 2 && r.chips === 4 && r.sections === 1 && r.overflow === 0 && r.hdrZ[0] > r.hdrZ[1] && r.detailStudios === 4 &&
    r.detailTitles.length === 4 && r.detailTitles.every(t => /^Dokumentasi Studio \d\|(7|8|9)00$/.test(t)) && r.retestHist === 2 && /PASSED/.test(r.s2status) && r.addBtn === 1 &&
    r.appendChips.join() === '5' && /^true:2026-11-08/.test(r.dateRO) && r.legend.every(t => /\|(7|8|9)00$/.test(t)) && r.saved.length === 1 && r.saved[0].batch === 'B1' && r.saved[0].st.join() === '5' && !errs.length;
  console.log(ok ? 'LULUS' : 'GAGAL'); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
