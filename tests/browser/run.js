const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const { install } = require('./mockapi');
const MODS = ['dashboard','pengumuman','ats','work','patrol','issue','meter','ac','purchase','film','dcp','ftest','pel','glosarium','penyimpanan','pengguna','audit','pengaturan'];
const W = process.argv[2] || 'desktop';
const VP = { desktop:{width:1440,height:900}, tablet:{width:820,height:1180}, phone:{width:390,height:844} }[W];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: VP, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Musyafar Kamal',username:'admin',role:'ADMIN'})); } catch(e){} });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await install(page);
  const errs = {};
  page.on('pageerror', e => { (errs.__global = errs.__global || []).push(e.message); });
  page.on('console', m => { if (m.type()==='error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) (errs.__console = errs.__console || []).push(m.text()); });
  await page.goto('' + (process.env.BASE||'http://localhost:8765') + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const out = {};
  for (const m of MODS) {
    const cur = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', e => cur.push(e.message));
    const hit = await page.evaluate(k => { const a = document.querySelector('#nav a[data-p="'+k+'"]') || document.querySelector('#tabs a[data-p="'+k+'"]'); if (!a) return false; a.click(); return true; }, m);
    if (!hit) cur.push('no nav link for ' + m);
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      view: (document.querySelector('#view')||{}).innerText ? document.querySelector('#view').innerText.trim().slice(0,80) : '',
      goErr: null,
    }));
    await page.screenshot({ path: `shots/${W}-${m}.png` });
    out[m] = { overflowPx: r.overflow, goErr: r.goErr, pageErrors: cur, viewPreview: r.view.replace(/\s+/g,' ') };
  }
  console.log(JSON.stringify({ viewport: W, globalErrors: errs.__global||[], consoleErrors: (errs.__console||[]).slice(0,5), modules: out }, null, 1));
  await b.close();
})().catch(e => { console.error('FATAL', e.stack); process.exit(1); });
