/* Uji v19: dokumentasi di bagian paling akhir form Film Testing, keterangan + foto terpisah per studio,
   foto terkirim ke laporan studio masing-masing, kolom masalah/tindakan hanya muncul saat ada FAIL. */
const { chromium } = require(process.env.PW || 'playwright');
const { install, handlers } = require('./mockapi');
const W = process.argv[2] || 'desktop';
const VP = { desktop:{width:1440,height:900}, tablet:{width:820,height:1180}, phone:{width:390,height:844} }[W];
const calls = [], photos = [];
handlers.dcp_meta = () => ({ komponen: [], komponenStatus: [], formatDcp: [], statusDcp: [], formatFt: [], status: [],
  checklist: [{ name: 'Gambar' }, { name: 'Suara' }],
  checklistItem: [{ id: 'g1', grp: 'Gambar', label: 'Fokus' }, { id: 'g2', grp: 'Gambar', label: 'Warna' }, { id: 's1', grp: 'Suara', label: 'Level' }] });
handlers.ft_batch_save = b => { calls.push(b); return { batchId: b.batchId, ids: b.items.map((_, i) => 'FT-2026-00' + (i + 1)) }; };
handlers.ft_photo_save = b => { photos.push({ id: b.id, kinds: (b.photos || []).map(p => p.kind), n: (b.photos || []).length }); return { added: (b.photos || []).length, failed: 0, total: 1 }; };
handlers.ft_get = b => ({ laporan: { id: b.id, film: 'X', studio: '1', format: '2D', status: 'PASSED', tanggal: '2026-11-07', jam: '10:00', tester: 'T', checklist: [] }, foto: [], riwayat: [], retestId: '', batch: [] });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: VP });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Admin',username:'admin',role:'ADMIN'})); });
  const page = await ctx.newPage(); await page.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await install(page);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto((process.env.BASE || 'http://localhost:8766') + '/index.html'); await page.waitForTimeout(1000);
  await page.evaluate(() => { const a = document.querySelector('#nav a[data-p="ftest"]') || document.querySelector('#tabs a[data-p="ftest"]'); a.click(); });
  await page.waitForTimeout(900); await page.click('#ftnew'); await page.waitForTimeout(500);
  const r = {};
  r.photoInsidePanel = await page.$$eval('.ft-pn input[type=file]', e => e.length);
  r.docCount = await page.$$eval('.ft-doc', e => e.length);
  r.docAfterPanels = await page.evaluate(() => { const f = document.getElementById('ftf'), all = [...f.querySelectorAll('.ft-pn,.ft-doc')]; const lastPn = all.map(x => x.classList.contains('ft-pn')).lastIndexOf(true), firstDoc = all.findIndex(x => x.classList.contains('ft-doc')); return firstDoc > lastPn; });
  r.docBeforeFooter = await page.evaluate(() => { const f = document.getElementById('ftf'), docs = f.querySelectorAll('.ft-doc'), foot = f.querySelector('.mdc-foot'); return !!(docs[docs.length - 1].compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING); });
  r.ownCaption = await page.$$eval('.ft-doc textarea', e => e.map(x => x.name).join());
  r.failHiddenAtStart = await page.$$eval('.ft-fail', e => e.every(x => x.hidden));
  await page.uncheck('input[name="p_1_g2"]'); r.failShown = await page.$eval('.ft-pn[data-i="1"] .ft-fail', e => !e.hidden); r.failOtherHidden = await page.$eval('.ft-pn[data-i="0"] .ft-fail', e => e.hidden);
  await page.check('input[name="p_1_g2"]'); r.failHiddenAgain = await page.$eval('.ft-pn[data-i="1"] .ft-fail', e => e.hidden);
  await page.uncheck('#ftchips input[data-i="3"]'); r.docHiddenWhenUnchecked = await page.$eval('.ft-doc[data-i="3"]', e => e.hidden); await page.check('#ftchips input[data-i="3"]');
  r.overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.fill('[name=film]', 'FILM UJI');
  await page.fill('[name=kd1]', 'Layar Studio 2'); await page.fill('[name=kd2]', 'Layar Studio 3');
  await page.setInputFiles('#ft1gi', { name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await page.setInputFiles('#ft2gi', [{ name: 'b.png', mimeType: 'image/png', buffer: PNG }, { name: 'c.png', mimeType: 'image/png', buffer: PNG }]);
  await page.screenshot({ path: `shots/ft-dok-${W}.png`, fullPage: false });
  await page.click('#ftok'); await page.waitForTimeout(2500);
  const c = calls[0] || {}, it = c.items || [];
  r.kd = it.map(i => i.ketDok);
  r.photos = photos.map(p => p.id + ':' + p.n + ':' + p.kinds[0]).join('|');
  r.errs = errs; console.log(JSON.stringify(r)); await b.close();
  const ok = r.photoInsidePanel === 0 && r.docCount === 4 && r.docAfterPanels && r.docBeforeFooter && r.ownCaption === 'kd0,kd1,kd2,kd3' && r.failHiddenAtStart && r.failShown && r.failOtherHidden && r.failHiddenAgain && r.docHiddenWhenUnchecked && r.overflow <= 0 &&
    r.kd.length === 4 && r.kd[1] === 'Layar Studio 2' && r.kd[2] === 'Layar Studio 3' && r.kd[0] === '' && r.photos === 'FT-2026-002:1:Dokumentasi Studio 2|FT-2026-003:2:Dokumentasi Studio 3' && !errs.length;
  console.log(ok ? 'LULUS' : 'GAGAL'); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
