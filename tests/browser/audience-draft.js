// Uji browser Data Penonton: simpan draf, tombol Kirim muncul bila 5 show lengkap. Jalankan: node tests/browser/audience-draft.js [desktop|phone]
const { chromium } = require('playwright');
const { install } = require('./mockapi');
const W = process.argv[2] || 'desktop';
const VP = { desktop:{width:1440,height:900}, phone:{width:390,height:844} }[W];
const R = []; const ck = (n, c, d) => R.push({ n, ok: !!c, d: c ? '' : (d || '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: VP });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Budi',username:'budi',role:'REPORTER'})); });
  const page = await ctx.newPage(); await page.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await install(page);
  const calls = []; let rec = null;
  await page.route('https://script.google.com/**', async route => {
    const req = route.request(); if (req.method() !== 'POST') return route.fallback();
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
    const send = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: d, now: Date.now() }) });
    if (body.action === 'rep_save') { calls.push(body); const d = Object.assign({}, body.data, { draft: !body.submit });
      rec = { id: 'DP-1', type: 'audience', title: 'DP', reporter: 'Budi', createdAt: Date.now(), updatedAt: Date.now(), data: d, own: true, editable: true, draft: d.draft, remainMs: d.draft ? undefined : 1800000 }; return send({ id: 'DP-1', photoFailed: 0, draft: d.draft, submitted: !d.draft }); }
    if (body.action === 'rep_list') return send({ items: rec ? [rec] : [], total: rec ? 1 : 0, page: 1, size: 15 });
    if (body.action === 'rep_get') return send(Object.assign({}, rec, { photos: [] }));
    return route.fallback();
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' }); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#nav a[data-p=audience], .bnav [data-p=audience]') && document.querySelector('#nav a[data-p=audience]').click()); await page.waitForTimeout(600);
  await page.click('#ra'); await page.waitForTimeout(500);
  const vis = () => page.evaluate(() => { const s = document.getElementById('rsub'); return !!s && getComputedStyle(s).display !== 'none'; });
  { const row = page.locator('.aud-st').nth(0).locator('.aud-row').nth(0); await row.locator('.af-film').fill('X'); await row.locator('.af-tiket').fill('10'); await row.locator('.af-pen').fill('12');
    ck('penonton > tiket: baris ditandai + peringatan', await row.evaluate(e => e.classList.contains('aud-over')) && /melebihi tiket/.test(await page.textContent('#aud-warn')) && await page.isVisible('#aud-warn'));
    await row.locator('.af-pen').fill('10');
    ck('penonton = tiket: tanda hilang', !(await row.evaluate(e => e.classList.contains('aud-over'))) && !(await page.isVisible('#aud-warn')));
    await row.locator('.af-film').fill(''); await row.locator('.af-tiket').fill(''); await row.locator('.af-pen').fill(''); }
  ck('tombol Kirim ada tapi tersembunyi saat kosong', !(await vis()) && !!(await page.$('#rsub')));
  const fill = async (si, ri, v) => { const row = page.locator('.aud-st').nth(si).locator('.aud-row').nth(ri); for (const [k, val] of Object.entries(v)) await row.locator('.af-' + k).fill(val); };
  await fill(0, 0, { film: 'A', tiket: '3', pen: '2' });
  await page.click('#rsv'); await page.waitForTimeout(500);
  ck('simpan sebagian dikirim sebagai draf (submit=false)', calls.length === 1 && calls[0].submit === false, JSON.stringify(calls.map(c => c.submit)));
  ck('modal tertutup setelah simpan', await page.evaluate(() => document.getElementById('modal').classList.contains('hidden')));
  // buka detail -> edit
  await page.evaluate(() => { const b = document.querySelector('[data-v],[data-id],.lv, button.btn.sec'); });
  const opened = await page.evaluate(() => { const els = [...document.querySelectorAll('#rl button, #rl a')].filter(e => /detail/i.test(e.textContent)); if (els[0]) { els[0].click(); return true } return false });
  await page.waitForTimeout(500);
  ck('detail terbuka', opened);
  const txt = await page.evaluate(() => document.getElementById('modal').textContent);
  ck('detail menampilkan status Draf + petunjuk', /Draf/.test(txt) && /kapan saja sebelum dikirim/.test(txt), txt.slice(0, 200));
  await page.click('#de'); await page.waitForTimeout(500);
  ck('edit draf: tombol Simpan ada, Kirim tersembunyi (belum lengkap)', !(await vis()) && /^Simpan$/.test(await page.textContent('#rsv')));
  for (let s = 0; s < 4; s++) for (let r = 0; r < 5; r++) if (!(s === 0 && r === 0)) await fill(s, r, { film: 'F' + s + r, tiket: '4', pen: '3' });
  ck('semua 20 show terisi -> tombol Kirim muncul', await vis());
  await page.screenshot({ path: `shots/aud-draft-${W}.png` });
  await fill(2, 3, { film: '' });
  ck('kosongkan satu film -> Kirim hilang lagi', !(await vis()));
  await fill(2, 3, { film: 'Z' });
  await page.click('#rsub'); await page.waitForTimeout(600);
  ck('Kirim memanggil rep_save submit=true', calls[calls.length - 1].submit === true, JSON.stringify(calls.map(c => c.submit)));
  await page.evaluate(() => { const els = [...document.querySelectorAll('#rl button, #rl a')].filter(e => /detail/i.test(e.textContent)); els[0] && els[0].click() }); await page.waitForTimeout(500);
  const t2 = await page.evaluate(() => document.getElementById('modal').textContent);
  ck('detail terkirim: status Terkirim', /Terkirim/.test(t2), t2.slice(-300));
  await page.click('#de'); await page.waitForTimeout(400);
  ck('edit setelah kirim: tanpa tombol Kirim, label Simpan perubahan', !(await page.$('#rsub')) && /Simpan perubahan/.test(await page.textContent('#rsv')));
  ck('tanpa error JS', errs.length === 0, errs.join('|'));
  const f = R.filter(x => !x.ok); console.log(R.map(x => (x.ok ? 'PASS ' : 'FAIL ') + x.n + (x.d ? ' :: ' + x.d : '')).join('\n')); console.log(`HASIL ${W}: ${R.length - f.length}/${R.length} lulus`); await b.close();
})();
