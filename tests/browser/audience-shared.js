// Uji browser draf Data Penonton bersama: akun non-Pelapor boleh mengedit draf orang lain, Pelapor lain tidak.
// Jalankan: node tests/browser/audience-shared.js [desktop|phone]
const { chromium } = require('playwright');
const { install } = require('./mockapi');
const W = process.argv[2] || 'desktop';
const VP = { desktop:{width:1440,height:900}, phone:{width:390,height:844} }[W];
const R = []; const ck = (n, c, d) => R.push({ n, ok: !!c, d: c ? '' : (d || '') });
async function run(b, role, editable, conflict) {
  const ctx = await b.newContext({ viewport: VP });
  await ctx.addInitScript(r => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U2',name:'Dua',username:'dua',role:r})); }, role);
  const page = await ctx.newPage(); await page.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await install(page);
  const calls = []; const UPD = 1700000000000;
  const rec = { id: 'DP-1', type: 'audience', title: 'DP', reporter: 'Budi', createdAt: UPD - 5e5, updatedAt: UPD, own: false, editable, draft: true,
    data: { date: '2026-11-09', draft: true, studios: [{ studio: 'Studio 1', shows: [{ show: 'SHOW1', film: 'Film A', tiket: 5, penonton: 4 }] }] } };
  await page.route('https://script.google.com/**', async route => {
    const req = route.request(); if (req.method() !== 'POST') return route.fallback();
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
    const send = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: d, now: Date.now() }) });
    const fail = m => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, message: m, now: Date.now() }) });
    if (body.action === 'me') return send({ userId: 'U2', fullName: 'Dua', username: 'dua', role, mustChange: false, token: 't' });
    if (body.action === 'rep_save') { calls.push(body); return conflict ? fail('Data ini baru saja diubah oleh pengguna lain. Tutup lalu buka lagi laporan ini agar data terbaru tampil.') : send({ id: 'DP-1', photoFailed: 0, draft: true }); }
    if (body.action === 'rep_list') return send({ items: [rec], total: 1, page: 1, size: 15 });
    if (body.action === 'rep_get') return send(Object.assign({}, rec, { photos: [] }));
    return route.fallback();
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' }); await page.waitForTimeout(900);
  await page.evaluate(() => { const a = document.querySelector('#nav a[data-p=audience]'); a && a.click(); }); await page.waitForTimeout(600);
  await page.evaluate(() => { const els = [...document.querySelectorAll('#rl button, #rl a')].filter(e => /detail/i.test(e.textContent)); els[0] && els[0].click() }); await page.waitForTimeout(500);
  const txt = await page.evaluate(() => document.getElementById('modal').textContent);
  const hasEdit = !!(await page.$('#de'));
  return { page, calls, txt, hasEdit, errs, UPD };
}
(async () => {
  const b = await chromium.launch();
  { const o = await run(b, 'GUIDE_SECURITY', true, false);
    ck('non-Pelapor: detail draf orang lain menyebut pemilik dan boleh dilengkapi', /milik Budi/.test(o.txt) && /selain Pelapor/.test(o.txt), o.txt.slice(0, 160));
    ck('non-Pelapor: tombol Edit tampil', o.hasEdit);
    await o.page.click('#de'); await o.page.waitForTimeout(500);
    ck('formulir terisi data draf orang lain', (await o.page.inputValue('.aud-st >> nth=0 >> .aud-row >> nth=0 >> .af-film')) === 'Film A');
    await o.page.fill('.aud-st >> nth=0 >> .aud-row >> nth=0 >> .af-pen', '5'); await o.page.click('#rsv'); await o.page.waitForTimeout(500);
    ck('rep_save mengirim baseAt = updatedAt yang dibuka', o.calls.length === 1 && o.calls[0].baseAt === o.UPD && o.calls[0].id === 'DP-1', JSON.stringify(o.calls.map(c => c.baseAt)));
    await o.page.screenshot({ path: `shots/aud-shared-${W}.png` });
    ck('tanpa error JS (non-Pelapor)', o.errs.length === 0, o.errs.join('|')); }
  { const o = await run(b, 'GUIDE_SECURITY', true, true);
    await o.page.click('#de'); await o.page.waitForTimeout(500);
    await o.page.fill('.aud-st >> nth=0 >> .aud-row >> nth=0 >> .af-film', 'Film Baru'); await o.page.click('#rsv'); await o.page.waitForTimeout(500);
    ck('bentrok: pesan jelas tampil dan isian tidak hilang', /baru saja diubah/.test(await o.page.textContent('#re')) && (await o.page.inputValue('.aud-st >> nth=0 >> .aud-row >> nth=0 >> .af-film')) === 'Film Baru');
    ck('bentrok: tombol Simpan aktif kembali', await o.page.isEnabled('#rsv')); }
  { const o = await run(b, 'REPORTER', false, false);
    ck('Pelapor lain: tanpa tombol Edit', !o.hasEdit, o.txt.slice(0, 160));
    ck('Pelapor lain: tanpa error JS', o.errs.length === 0, o.errs.join('|')); }
  await b.close();
  const f = R.filter(x => !x.ok); R.forEach(x => console.log((x.ok ? 'PASS ' : 'FAIL ') + x.n + (x.d ? ' :: ' + x.d : '')));
  console.log(`HASIL ${W}: ${R.length - f.length}/${R.length} lulus`); process.exit(f.length ? 1 : 0);
})();
