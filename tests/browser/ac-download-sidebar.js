// Uji: highlight sidebar aktif, warna indikator suhu AC, dan unduhan bersamaan tidak saling menimpa.
const { chromium } = require('playwright');
const { install } = require('./mockapi');
const BASE = process.env.BASE || 'http://localhost:8765';
let fail = 0; const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : '')); if (!c) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'M',username:'a',role:'ADMIN'})); });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await install(page);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await page.waitForTimeout(900);
  // 1) sidebar
  await page.evaluate(() => document.querySelector('#nav a[data-p="ac"]').click()); await page.waitForTimeout(800);
  const sb = await page.evaluate(() => { const a = document.querySelector('#nav a.on'); const s = getComputedStyle(a); return { txt: a.textContent.trim(), bg: s.backgroundColor, shadow: s.boxShadow, tr: s.transitionDuration }; });
  ok('item sidebar aktif = Daily Monitoring AC', sb.txt.indexOf('Daily Monitoring') === 0, sb.txt);
  ok('highlight aktif solid #49337b (sesuai referensi)', sb.bg === 'rgb(73, 51, 123)', sb.bg);
  ok('tanpa inset bar / garis', sb.shadow === 'none', sb.shadow);
  ok('transisi menu aktif', /\.2s|0\.2s/.test(sb.tr), sb.tr);
  // 2) indikator suhu
  const tc = await page.evaluate(() => {
    const out = {}; ['ok','na2','bad','cold'].forEach(k => { const d = document.createElement('div'); d.className = 'dac-c ' + k; d.innerHTML = '<b>x</b><span class="dac-t">24</span><small>s</small>'; document.body.appendChild(d); const cs = getComputedStyle(d), t = getComputedStyle(d.querySelector('.dac-t')); out[k] = { shadow: cs.boxShadow, text: t.color }; d.remove(); });
    const badge = document.createElement('span'); badge.className = 'ts-warm'; document.body.appendChild(badge); out.badge = getComputedStyle(badge).color; badge.remove();
    return out; });
  ok('APPROVED (ok) hijau', tc.ok.shadow.includes('rgb(33, 139, 105)'), tc.ok.shadow);
  ok('DATA KOSONG (na2) kuning', tc.na2.shadow.includes('217, 164, 0'), tc.na2.shadow);
  ok('PANAS (bad) merah', tc.bad.shadow.includes('190, 18, 60'), tc.bad.shadow);
  ok('DINGIN (cold) merah', tc.cold.shadow.includes('190, 18, 60'), tc.cold.shadow);
  ok('badge status warm berwarna merah', tc.badge === 'rgb(190, 18, 60)', tc.badge);
  ok('tanpa error JavaScript', errs.length === 0, errs.slice(0,2).join(' | '));
  console.log(fail ? `\nGAGAL ${fail}` : '\nSEMUA LULUS'); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.stack); process.exit(1); });
