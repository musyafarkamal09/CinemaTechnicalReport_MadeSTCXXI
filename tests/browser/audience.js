// Uji browser fitur Data Penonton (mock backend). Jalankan: node tests/browser/audience.js [desktop|tablet|phone]
const { chromium } = require('playwright');
const { install } = require('./mockapi');
const W = process.argv[2] || 'desktop';
const VP = { desktop:{width:1440,height:900}, tablet:{width:820,height:1180}, phone:{width:390,height:844} }[W];
const R = []; const ck = (n, c, d) => R.push({ n, ok: !!c, d: c ? '' : (d || '') });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADq0t1/0kAAAAAElFTkSuQmCC', 'base64');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: VP });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Musyafar Kamal',username:'admin',role:'ADMIN'})); });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await install(page);
  const calls = []; const saved = { items: [] };
  await page.route('https://script.google.com/**', async route => {
    const req = route.request(); if (req.method() !== 'POST') return route.fallback();
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
    const send = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: d, now: Date.now() }) });
    if (body.action === 'rep_save') { calls.push(body); const id = 'DP-20261107-000' + (saved.items.length + 1);
      const d = Object.assign({}, body.data, { totalShow: 0 });
      saved.items.push({ id, type: 'audience', title: 'Data Penonton', reporter: 'Musyafar Kamal', createdAt: Date.now(), updatedAt: Date.now(), data: d, ph: {} }); return send({ id, photoFailed: 0 }); }
    if (body.action === 'photo_save') { calls.push(body); return send({ failed: 0 }); }
    if (body.action === 'photo_done') return send({});
    if (body.action === 'rep_list' && body.type === 'audience') return send({ items: saved.items, total: saved.items.length, page: 1, size: 15 });
    if (body.action === 'rep_get') { const it = saved.items.find(x => x.id === body.id) || saved.items[0]; return send(Object.assign({}, it, { photos: [] })); }
    return route.fallback();
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto((process.env.BASE || 'http://localhost:8765') + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#nav a[data-p=audience]').click()); await page.waitForTimeout(600);
  ck('halaman Data Penonton terbuka', await page.evaluate(() => /Data Penonton/.test(document.querySelector('#view h2').textContent)));
  ck('menu sidebar memuat Data Penonton', await page.evaluate(() => !!document.querySelector('#nav a[data-p=audience]')));
  await page.click('#ra'); await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({ studios: document.querySelectorAll('.aud-st').length, rows: document.querySelectorAll('.aud-row').length,
    first: [...document.querySelectorAll('.aud-st')].map(s => s.querySelectorAll('.aud-row').length).join(','), date: document.querySelector('#rfm [name=date], #rfm #date')?.value,
    gal: !!document.querySelector('label[for=fi_Foto]'), cam: !!document.querySelector('label[for=fc_Foto]'), req: document.querySelector('#fi_Foto')?.required,
    ovf: document.documentElement.scrollWidth - innerWidth, mo: (() => { const m = document.querySelector('#modal'); return m ? m.scrollWidth - m.clientWidth : 0 })(),
    noteAfter: document.getElementById('aud').nextElementSibling?.querySelector('textarea')?.name }));
  ck('default 4 studio x 5 show', st.studios === 4 && st.rows === 20 && st.first === '5,5,5,5', JSON.stringify(st));
  ck('tanggal terisi otomatis', /^\d{4}-\d{2}-\d{2}$/.test(st.date || ''), st.date);
  ck('foto: galeri + kamera tersedia', st.gal && st.cam);
  ck('foto opsional (tidak wajib)', !st.req);
  ck('catatan dipindah ke bawah tabel', st.noteAfter === 'note', String(st.noteAfter));
  ck('tidak ada overflow horizontal', st.ovf <= 1 && st.mo <= 1, st.ovf + '/' + st.mo);
  await page.screenshot({ path: `shots/aud-form-${W}.png` });
  // kirim kosong -> ditolak
  await page.click('#rsv'); await page.waitForTimeout(200);
  ck('kirim kosong ditolak', /minimal satu show/.test(await page.textContent('#re')), await page.textContent('#re'));
  // isi
  const fill = async (studioIdx, rowIdx, v) => { const row = page.locator('.aud-st').nth(studioIdx).locator('.aud-row').nth(rowIdx);
    for (const [k, val] of Object.entries(v)) await row.locator('.af-' + k).fill(val); };
  await fill(0, 0, { film: 'Film A', jam: '12:30', tiket: '10', pen: '8', ptg: 'Budi', ket: 'ok' });
  await fill(0, 2, { film: 'Film B', tiket: '5', pen: '5' });
  await fill(3, 4, { film: 'Film Z', tiket: '2', pen: '1' });
  await page.locator('.aud-st').nth(0).locator('.aud-as').click();
  ck('tambah show -> SHOW6', await page.locator('.aud-st').nth(0).locator('.aud-row').count() === 6 && (await page.locator('.aud-st').nth(0).locator('.aud-row').nth(5).getAttribute('data-show')) === 'SHOW6');
  await fill(0, 5, { film: 'Film C', tiket: '1', pen: '1' });
  await page.click('#aud-as'); await page.waitForTimeout(200);
  ck('tambah studio -> Studio 5 (5 show)', await page.locator('.aud-st').count() === 5 && await page.locator('.aud-st').nth(4).locator('.aud-row').count() === 5 && (await page.locator('.aud-st').nth(4).getAttribute('data-s')) === 'Studio 5');
  await fill(4, 0, { film: 'Film Y', tiket: '3', pen: '3' });
  ck('total langsung dihitung', /5 show · 21 tiket terjual · 18 penonton masuk/.test(await page.textContent('#aud-tot')), await page.textContent('#aud-tot'));
  ck('studio bawaan tidak bisa dihapus, tambahan bisa', await page.locator('.aud-st').nth(0).locator('.aud-rs').count() === 0 && await page.locator('.aud-st').nth(4).locator('.aud-rs').count() === 1);
  // draf: tutup lalu buka lagi
  await page.waitForTimeout(500);
  await page.click('#rc'); await page.waitForTimeout(300);
  await page.click('#ra'); await page.waitForTimeout(500);
  const dr = await page.evaluate(() => ({ s: document.querySelectorAll('.aud-st').length, r0: document.querySelectorAll('.aud-st')[0].querySelectorAll('.aud-row').length,
    f: document.querySelector('.aud-st .af-film').value, y: document.querySelectorAll('.aud-st')[4]?.querySelector('.af-film').value, st: document.querySelector('.stc-draft-status')?.textContent }));
  ck('draf memulihkan studio/show tambahan + isian', dr.s === 5 && dr.r0 === 6 && dr.f === 'Film A' && dr.y === 'Film Y', JSON.stringify(dr));
  // foto + simpan
  await page.setInputFiles('#fi_Foto', { name: 'a.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(700);
  ck('foto dari galeri tampil di pratinjau', await page.locator('#pv_Foto img').count() === 1);
  await page.setInputFiles('#fc_Foto', { name: 'b.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(900);
  ck('foto dari kamera tampil di pratinjau', await page.locator('#pv_Foto img').count() === 2, String(await page.locator('#pv_Foto img').count()));
  await page.click('#rsv'); await page.waitForTimeout(1200);
  const rs = calls.find(c => c.action === 'rep_save'), ps = calls.filter(c => c.action === 'photo_save');
  ck('rep_save terkirim tipe audience', rs && rs.type === 'audience', JSON.stringify(rs || {}).slice(0, 200));
  const sd = rs && rs.data.studios;
  ck('payload: hanya studio berisi (1,4,5), baris kosong dibuang', sd && sd.map(s => s.studio + ':' + s.shows.length).join(',') === 'Studio 1:3,Studio 4:1,Studio 5:1', JSON.stringify(sd && sd.map(s => s.studio + ':' + s.shows.length)));
  ck('payload: field sesuai tabel', sd && sd[0].shows[0].film === 'Film A' && sd[0].shows[0].jam === '12:30' && sd[0].shows[0].tiket === '10' && sd[0].shows[0].penonton === '8' && sd[0].shows[0].petugas === 'Budi' && sd[0].shows[0].ket === 'ok' && sd[0].shows[2].show === 'SHOW6');
  ck('foto terkirim (2) bersama laporan', ps.reduce((a, c) => a + c.photos.length, 0) === 2, String(ps.length));
  ck('modal tertutup setelah simpan', await page.evaluate(() => document.querySelector('#modal').classList.contains('hidden')));
  // laporan tanpa foto
  calls.length = 0;
  await page.click('#ra'); await page.waitForTimeout(500);
  await fill(1, 0, { film: 'Solo', tiket: '1', pen: '1' });
  await page.click('#rsv'); await page.waitForTimeout(1000);
  ck('simpan tanpa foto berhasil (opsional)', calls.some(c => c.action === 'rep_save') && !calls.some(c => c.action === 'photo_save'));
  // validasi sisi klien
  await page.click('#ra'); await page.waitForTimeout(500);
  await fill(0, 0, { tiket: '5' }); await page.click('#rsv'); await page.waitForTimeout(200);
  ck('film kosong tapi tiket terisi ditolak', /Nama film wajib/.test(await page.textContent('#re')), await page.textContent('#re'));
  await page.locator('.aud-st').nth(0).locator('.aud-row').nth(0).locator('.af-film').fill('X'); await page.locator('.aud-st').nth(0).locator('.aud-row').nth(0).locator('.af-tiket').fill('1.5');
  ck('tiket desimal/negatif ditolak oleh validasi bawaan browser', await page.evaluate(() => { const i = document.querySelector('.aud-st .af-tiket'); const a = !i.checkValidity(); i.value = '-1'; return a && !i.checkValidity(); }));
  await page.click('#rc'); await page.waitForTimeout(300);
  // daftar + detail
  await page.evaluate(() => document.querySelector('#nav a[data-p=audience]').click()); await page.waitForTimeout(700);
  const li = await page.evaluate(() => document.querySelector('#rl')?.textContent || '');
  ck('daftar menampilkan ringkasan show/tiket/penonton', /show/.test(li) && /tiket/.test(li) && /penonton/.test(li), li.slice(0, 160));
  await page.locator('[data-d]').first().click(); await page.waitForTimeout(700);
  const dt = await page.evaluate(() => ({ h: document.querySelector('#modal h3')?.textContent, rows: document.querySelectorAll('#modal table').length, txt: document.querySelector('#modal')?.textContent || '' }));
  ck('detail: tabel per studio + total', /Data Penonton/.test(dt.h) && dt.rows >= 3 && /Total Studio 1/.test(dt.txt) && /Film A/.test(dt.txt), dt.h + ' ' + dt.rows);
  await page.screenshot({ path: `shots/aud-detail-${W}.png` });
  // edit: nilai terisi + show kosong tersedia
  const eb = await page.locator('#modal button', { hasText: /^Edit/ }).count();
  if (eb) { await page.locator('#modal button', { hasText: /^Edit/ }).first().click(); await page.waitForTimeout(600);
    const ed = await page.evaluate(() => ({ s: document.querySelectorAll('.aud-st').length, f: document.querySelector('.aud-st .af-film').value, r: document.querySelectorAll('.aud-st')[0].querySelectorAll('.aud-row').length }));
    ck('edit: nilai lama + 5 show bawaan + show tambahan', ed.f === 'Film A' && ed.r === 6 && ed.s === 5, JSON.stringify(ed)); }
  ck('tanpa galat JS', errs.length === 0, errs.join(' | '));
  const bad = R.filter(x => !x.ok);
  console.log(`[${W}] ` + R.map(x => (x.ok ? 'PASS ' : 'FAIL ') + x.n + (x.ok ? '' : ' :: ' + x.d)).join('\n'));
  console.log(`HASIL ${W}: ${R.length - bad.length}/${R.length} lulus`);
  await b.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.stack); process.exit(1); });
