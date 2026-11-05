const { chromium } = require('playwright');
const { install } = require('./mockapi');
const W = process.argv[2] || 'desktop';
const VP = { desktop:{width:1440,height:900}, tablet:{width:820,height:1180}, phone:{width:390,height:844} }[W];
const TYPES = ['work','patrol','issue','meter','ac','purchase'];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: VP, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Musyafar Kamal',username:'admin',role:'ADMIN'})); });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await install(page);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('' + (process.env.BASE||'http://localhost:8765') + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const modalInfo = () => page.evaluate(() => ({ open: !!document.querySelector('#modal:not(.hidden)'), inputs: document.querySelectorAll('#modal:not(.hidden) input:not([type=hidden]),#modal:not(.hidden) select,#modal:not(.hidden) textarea').length, title: (document.querySelector('#modal:not(.hidden) h3')||{}).textContent || '' }));
  const closeAll = async () => { await page.keyboard.press('Escape'); await page.evaluate(() => { const x=document.getElementById('mx'); if (x) x.click(); }); await page.waitForTimeout(250); };
  const res = {};
  // 1) Tombol Catat cepat di dashboard (semua viewport)
  await page.evaluate(() => { const a = document.querySelector('#nav a[data-p="dashboard"]')||document.querySelector('#tabs a[data-p="dashboard"]'); if(a) a.click(); });
  await page.waitForTimeout(800);
  for (const t of TYPES) {
    const had = await page.evaluate(t => { const b = document.querySelector('[data-new="'+t+'"]'); if (!b) return false; b.click(); return true; }, t);
    await page.waitForTimeout(500);
    const m = await modalInfo();
    if (had) await page.screenshot({ path: `shots/formq-${W}-${t}.png` });
    res['dash:'+t] = { had, ...m };
    await closeAll();
  }
  // 2) Sheet "Buat" (tab Buat) - hanya relevan untuk layar sempit
  const tabBuat = await page.evaluate(() => { const a = document.querySelector('#tabs a[data-p="new"]'); if (a) { a.click(); return true; } return false; });
  await page.waitForTimeout(500);
  const sheetItems = await page.evaluate(() => [...document.querySelectorAll('[data-new],[data-p]')].filter(x => x.offsetParent !== null).map(x => (x.dataset.new ? 'new:' : 'p:') + (x.dataset.new || x.dataset.p) ).slice(0,30));
  res.buatTab = { clicked: tabBuat, visibleActions: sheetItems };
  await page.screenshot({ path: `shots/buat-${W}.png` });
  await closeAll();
  // 3) Form film & DCP Masuk dari modulnya
  for (const [mod, sel] of [['film','#frnew'],['pel','#plMasuk']]) {
    await page.evaluate(k => { const a = document.querySelector('#nav a[data-p="'+k+'"]')||document.querySelector('#tabs a[data-p="'+k+'"]'); if(a) a.click(); }, mod);
    await page.waitForTimeout(800);
    const ok = await page.evaluate(s => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel);
    await page.waitForTimeout(500);
    res[mod+':'+sel] = { had: ok, ...(await modalInfo()) };
    await page.screenshot({ path: `shots/formq-${W}-${mod}.png` });
    await closeAll();
  }
  res.pageErrors = errs.slice(0,3);
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})().catch(e => { console.error('FATAL', e.stack); process.exit(1); });
