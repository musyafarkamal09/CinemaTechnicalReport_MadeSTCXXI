/* Uji: form Daily Film Testing memuat semua studio sekaligus dan menyimpan satu laporan gabungan (ft_batch_save). */
const { chromium } = require(process.env.PW || 'playwright');
const { install, handlers } = require('./mockapi');
const W = process.argv[2] || 'desktop';
const VP = { desktop:{width:1440,height:900}, tablet:{width:820,height:1180}, phone:{width:390,height:844} }[W];
const calls = [];
handlers.dcp_meta = () => ({ komponen: [], komponenStatus: [], formatDcp: [], statusDcp: [], formatFt: [], status: [],
  checklist: [{ name: 'Gambar' }, { name: 'Suara' }],
  checklistItem: [{ id: 'g1', grp: 'Gambar', label: 'Fokus' }, { id: 'g2', grp: 'Gambar', label: 'Warna' }, { id: 's1', grp: 'Suara', label: 'Level' }] });
handlers.ft_batch_save = b => { calls.push(b); return { batchId: b.batchId, ids: b.items.map((_, i) => 'FT-2026-00' + (i + 1)) }; };
handlers.ft_get = b => ({ laporan: { id: b.id, film: 'X', studio: '1', format: '2D', status: 'PASSED', tanggal: '2026-11-07', jam: '10:00', tester: 'T', checklist: [] }, foto: [], riwayat: [], retestId: '', batch: [{ id: 'FT-2026-002', studio: '2', status: 'PASSED' }] });
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: VP });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Admin',username:'admin',role:'ADMIN'})); });
  const page = await ctx.newPage(); await page.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await install(page);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto((process.env.BASE || 'http://localhost:8766') + '/index.html'); await page.waitForTimeout(1000);
  await page.evaluate(() => { const a = document.querySelector('#nav a[data-p="ftest"]') || document.querySelector('#tabs a[data-p="ftest"]'); a.click(); });
  await page.waitForTimeout(900); await page.click('#ftnew'); await page.waitForTimeout(500);
  const r = {};
  r.chips = await page.$$eval('#ftchips input[name=stu]', e => e.map(x => x.checked));
  r.panelsVisible = await page.$$eval('.ft-pn', e => e.filter(x => !x.hidden && x.offsetParent).length);
  r.overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `shots/ft-form-${W}.png`, fullPage: false });
  await page.fill('[name=film]', 'FILM UJI');
  await page.uncheck('#ftchips input[data-i="3"]'); r.afterUncheck = await page.$$eval('.ft-pn', e => e.filter(x => !x.hidden && x.offsetParent).length);
  await page.check('#ftchips input[data-i="3"]');
  await page.uncheck('input[name="p_1_g2"]'); await page.click('#ftok'); await page.waitForTimeout(300);
  r.errFail = await page.textContent('#ftferr');
  await page.fill('[name=k_1_g2]', 'buram'); await page.fill('[name=ms1]', 'lensa kotor'); await page.fill('[name=td1]', 'bersihkan');
  await page.click('#ftok'); await page.waitForTimeout(1200);
  const c = calls[0] || {};
  r.sent = { n: (c.items || []).length, studios: (c.items || []).map(i => i.studio), sameFilm: (c.items || []).every(i => i.film === 'FILM UJI'), batchId: !!c.batchId, s2fail: ((c.items || [])[1] || {}).checklist && c.items[1].checklist.filter(x => x.val === 'FAIL').length, s1fail: c.items && c.items[0].checklist.filter(x => x.val === 'FAIL').length };
  r.sib = await page.$$eval('[data-ftsib]', e => e.length);
  r.errs = errs; console.log(JSON.stringify(r)); await b.close();
  const ok = r.chips.length === 4 && r.chips.every(Boolean) && r.panelsVisible === 4 && r.afterUncheck === 3 && /Studio 2/.test(r.errFail) && r.sent.n === 4 && r.sent.sameFilm && r.sent.batchId && r.sent.s2fail === 1 && r.sent.s1fail === 0 && r.overflow <= 0 && !errs.length;
  console.log(ok ? 'LULUS' : 'GAGAL'); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
