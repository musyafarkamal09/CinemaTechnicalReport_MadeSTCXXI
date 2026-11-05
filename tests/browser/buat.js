const { chromium } = require('playwright');
const { install } = require('./mockapi');
const W = process.argv[2] || 'phone';
const VP = { desktop:{width:1440,height:900}, tablet:{width:820,height:1180}, phone:{width:390,height:844} }[W];
const OPTS = ['work','patrol','issue','meter','ac','purchase','ftest','dcp','pel','pengumuman','ats','film'];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: VP, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Musyafar Kamal',username:'admin',role:'ADMIN'})); });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await install(page);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('' + (process.env.BASE||'http://localhost:8765') + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const res = {};
  for (const o of OPTS) {
    await page.evaluate(() => { const t=document.querySelector('#tabs a[data-p="new"]'); if(t) t.click(); });
    await page.waitForTimeout(300);
    const clicked = await page.evaluate(o => { const b=document.querySelector('#nsgrid button[data-p="'+o+'"]'); if(!b) return false; b.click(); return true; }, o);
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => ({ open: !!document.querySelector('#modal:not(.hidden)'), inputs: document.querySelectorAll('#modal:not(.hidden) input:not([type=hidden]),#modal:not(.hidden) select,#modal:not(.hidden) textarea').length, title: ((document.querySelector('#modal:not(.hidden) h3')||{}).textContent||'').slice(0,34) }));
    if (W !== 'desktop' && o === 'work') await page.screenshot({ path: `shots/buat-open-${W}-work.png` });
    res[o] = { inBuatSheet: clicked, ...st };
    await page.evaluate(() => { const x=document.getElementById('mx'); if (x) x.click(); });
    await page.waitForTimeout(250);
  }
  res.pageErrors = errs.slice(0,3);
  console.log(JSON.stringify(res, null, 1)); await b.close();
})().catch(e => { console.error('FATAL', e.stack); process.exit(1); });
