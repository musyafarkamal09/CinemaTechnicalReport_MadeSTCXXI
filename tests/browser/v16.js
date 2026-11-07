/* NOVA v16 — uji regresi: XSS, reset password tanpa prompt(), fokus formulir, label terhubung, tanpa overflow. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const mock = require('./mockapi');
const W = process.argv[2] || 'desktop';
const VP = { desktop:{width:1440,height:900}, tablet:{width:820,height:1180}, phone:{width:390,height:844} }[W];
const BASE = process.env.BASE || 'http://localhost:8765';
const EVIL = '"><img src=x onerror="window.__xss=1">';
const H = mock.handlers;
H.ats_list = () => [{ ...mock.films[0], poster: EVIL, deleteAt: EVIL }, ...mock.films.slice(1)];
H.usr_list = () => [{ userId: EVIL, fullName: 'Uji <b>XSS</b>', username: 'uji', role: EVIL, status: EVIL, locked: false }];
H.audit = () => ({ items: [{ at: Date.now(), userName: 'Uji', role: EVIL, action: 'x', detail: '' }], total: 1, page: 1, size: 25 });
let resetCall = null; H.usr_reset = b => { resetCall = b; return true; };
const res = {}; const ok = (n, c, d) => { res[n] = { pass: !!c, detail: d }; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: VP });
  await ctx.addInitScript(() => {
    localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Musyafar Kamal',username:'admin',role:'ADMIN'}));
    window.__prompt = 0; window.prompt = () => { window.__prompt++; return null; };
  });
  const page = await ctx.newPage(); await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await mock.install(page); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/index.html'); await page.waitForTimeout(1200);
  const go = async m => { await page.evaluate(k => { const a = document.querySelector('#nav a[data-p="'+k+'"]') || document.querySelector('#tabs a[data-p="'+k+'"]'); a && a.click(); }, m); await page.waitForTimeout(800); };

  await go('film'); await go('pengguna'); await go('audit');
  ok('XSS: payload di poster/role/status/userId tidak tereksekusi', await page.evaluate(() => !window.__xss));
  await go('pengguna');
  const hasReset = await page.evaluate(() => !!document.querySelector('[data-r]'));
  if (hasReset) {
    await page.evaluate(() => document.querySelector('[data-r]').click()); await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({ type: (document.querySelector('#rpp') || {}).type, prompt: window.__prompt, title: (document.querySelector('#mbox h3') || {}).innerText }));
    ok('Reset password: modal dengan input tersamar, tanpa prompt()', st.type === 'password' && st.prompt === 0, JSON.stringify(st));
    await page.fill('#rpp', 'abc'); await page.click('#rpf button:not(.sec)'); await page.waitForTimeout(200);
    ok('Reset password: <8 karakter ditolak di klien (validasi bawaan atau pesan)', !resetCall && await page.evaluate(() => { const i = document.getElementById('rpp'); return i.validity.tooShort || /8/.test(document.getElementById('rpe').textContent); }));
    await page.fill('#rpp', 'Sementara123'); await page.click('#rpf button:not(.sec)'); await page.waitForTimeout(500);
    ok('Reset password: terkirim dengan userId & password', resetCall && resetCall.password === 'Sementara123' && resetCall.userId === EVIL, JSON.stringify(resetCall));
  } else ok('Reset password: tombol tersedia', false, 'tidak ada [data-r]');

  // formulir: fokus masuk ke form, kembali ke pemicu, label terhubung
  await page.evaluate(() => { const t = document.querySelector('#tabs a[data-p="new"]') || document.querySelector('#nav a[data-p="new"]'); t && t.click(); }); await page.waitForTimeout(300);
  await page.evaluate(() => { const b = document.querySelector('#nsgrid button[data-p="work"]'); b && b.click(); }); await page.waitForTimeout(800);
  const f = await page.evaluate(() => {
    const mb = document.getElementById('mbox'); const ae = document.activeElement;
    const ctl = [...mb.querySelectorAll('input:not([type=hidden]):not([type=file]),select,textarea')];
    const unnamed = ctl.filter(c => !(c.getAttribute('aria-labelledby') || c.getAttribute('aria-label') || c.id && document.querySelector('label[for="'+c.id+'"]') || c.closest('label'))).length;
    return { inside: mb.contains(ae), n: ctl.length, unnamed };
  });
  ok('Formulir: fokus berpindah ke dalam formulir saat dibuka', f.inside, JSON.stringify(f));
  ok('Formulir: setiap kolom punya nama aksesibel', f.n > 0 && f.unnamed === 0, JSON.stringify(f));
  await page.evaluate(() => document.getElementById('mx').click()); await page.waitForTimeout(300);
  ok('Formulir: ditutup, fokus tidak tertinggal di area tersembunyi', await page.evaluate(() => !document.getElementById('mbox').contains(document.activeElement)));
  for (const m of ['dashboard','film','dcp','ftest','pengguna','audit']) { await go(m); const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok('Tanpa overflow horizontal: '+m, o <= 0, o); }
  ok('Tanpa error JS', errs.length === 0, errs.join('|'));
  const lines = Object.entries(res).map(([k, v]) => (v.pass ? 'PASS ' : 'FAIL ') + k + (v.pass ? '' : ' -> ' + v.detail));
  console.log(W + '\n' + lines.join('\n')); console.log('HASIL ' + W + ': ' + Object.values(res).filter(v => v.pass).length + '/' + lines.length);
  await b.close(); process.exit(Object.values(res).every(v => v.pass) ? 0 : 1);
})().catch(e => { console.error('FATAL', e.stack); process.exit(2); });
