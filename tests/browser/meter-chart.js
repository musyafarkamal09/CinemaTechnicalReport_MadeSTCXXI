// Uji: grafik Laporan Meteran sesuai desain Figma (kurva halus, sumbu Y, legenda, rentang tanggal).
const { chromium } = require('playwright');
const { install, handlers } = require('./mockapi');
const BASE = process.env.BASE || 'http://localhost:8765';
const days = ['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05'];
const L = [520, 640, 310, 790, 420, 680, 684], W = [0,0,0,0,0,0,0];
const series = days.map((k, i) => ({ k, lwbp: L[i] * 0.5, wbp: L[i] * 0.5, genset: 0, air: 12.8 * 0 + [10,12,8,14,11,13,12.8][i], listrik: 0 }));
handlers.meter_stats = (b) => ({
  location: 'Gandaria City XXI', group: 'day', from: days[0], to: days[6], since: days[0],
  series, locations: ['Gandaria City XXI'], rows: [], total: 22,
  count: { total: 22, period: 7 }, cum: { listrik: 4120, genset: 0, air: 80 }, per: { listrik: 4120, genset: 0, air: 80 },
  latest: [], count2: 0,
});
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'M',username:'a',role:'ADMIN'})); });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await install(page);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#nav a[data-p="meter"]').click()); await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const svg = document.querySelector('#mchart svg'); if (!svg) return { none: true };
    const paths = [...svg.querySelectorAll('path')].map(p => ({ stroke: p.getAttribute('stroke'), d: p.getAttribute('d').slice(0, 60) }));
    const ticks = [...svg.querySelectorAll('text.ctx')].map(t => t.textContent);
    const yl = [...svg.querySelectorAll('text.cyl')].map(t => t.textContent);
    return { paths, ticks, yl, title: document.querySelector('#mctitle')?.textContent, sub: document.querySelector('#msub')?.textContent, range: document.querySelector('#mrange')?.textContent, legend: [...document.querySelectorAll('#mlg .mlb')].map(x => x.textContent) };
  });
  console.log(JSON.stringify(info, null, 1));
  console.log('pageerrors:', errs);
  const card = await page.evaluate(() => { const el = document.querySelector('#mchart'); el.scrollIntoView({ block: 'center' }); const r = el.closest('.card,section,div').getBoundingClientRect(); return null; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: __dirname + '/shots/meter-chart-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('#mchart').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
  await page.screenshot({ path: __dirname + '/shots/meter-chart-mobile.png' });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
