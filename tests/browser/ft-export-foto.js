/* Uji v20: PDF gabungan (satu tabel harian) Daily Film Testing memuat foto tiap studio, terhubung ke studio + ID laporannya, dan kolom Foto/Keterangan dokumentasi. */
const { chromium } = require(process.env.PW || 'playwright');
const { install, handlers } = require('./mockapi');
const LAP = [
  { id: 'FT-2026-0001', tanggal: '2026-11-08', jam: '09:00', film: 'FILM A', studio: '1', format: '2D', server: '', projector: '', tester: 'T', status: 'PASSED', checklist: [], masalah: '', parentId: '', batchId: 'B1', ketDok: 'Layar S1', fotoCount: 2 },
  { id: 'FT-2026-0002', tanggal: '2026-11-08', jam: '09:00', film: 'FILM A', studio: '2', format: '2D', server: '', projector: '', tester: 'T', status: 'PASSED', checklist: [], masalah: '', parentId: '', batchId: 'B1', ketDok: '', fotoCount: 0 },
  { id: 'FT-2026-0003', tanggal: '2026-11-08', jam: '09:00', film: 'FILM A', studio: '3', format: '2D', server: '', projector: '', tester: 'T', status: 'FAILED', checklist: [], masalah: 'x', parentId: '', batchId: 'B1', ketDok: 'Layar S3', fotoCount: 1 },
  { id: 'FT-2026-0004', tanggal: '2026-11-08', jam: '09:00', film: 'FILM A', studio: '4', format: '2D', server: '', projector: '', tester: 'T', status: 'PASSED', checklist: [], masalah: '', parentId: '', batchId: 'B1', ketDok: '', fotoCount: 0 }
];
const getCalls = [];
handlers.ft_list = () => LAP;
handlers.ft_report_get = b => { getCalls.push(b.id); const foto = {}; LAP.forEach(l => { if (l.fotoCount) foto[l.id] = Array.from({ length: l.fotoCount }, (_, i) => ({ fotoId: l.id + '-F' + i, kind: 'Dokumentasi Studio ' + l.studio })); }); return { key: 'B1', laporan: LAP, foto }; };
handlers.ft_photo_get = b => ({ fotoId: b.fotoId, url: 'data:image/jpeg;base64,/9j/' });
handlers.dcp_meta = () => ({ komponen: [], komponenStatus: [], formatDcp: [], statusDcp: [], formatFt: [], status: [], checklist: [], checklistItem: [] });
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Admin',username:'admin',role:'ADMIN'}));
    window.jspdf = { jsPDF: function () {} }; });
  const page = await ctx.newPage(); await page.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await install(page);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto((process.env.BASE || 'http://localhost:8766') + '/index.html'); await page.waitForTimeout(1000);
  await page.evaluate(() => { const a = document.querySelector('#nav a[data-p="ftest"]') || document.querySelector('#tabs a[data-p="ftest"]'); a.click(); });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__doc = null; window.NovaPDF.render = o => { window.__doc = o; return { save() {} }; }; window.NovaPDF.loadPhoto = (u, cap) => Promise.resolve({ data: u, w: 800, h: 600, cap }); document.getElementById('ftpdf').click(); });
  await page.waitForTimeout(1500);
  const doc = await page.evaluate(() => window.__doc);
  const r = {};
  const pb = (doc ? doc.blocks : []).filter(x => x.t === 'photos');
  r.photoTitles = pb.map(x => x.title + ' [' + x.list.length + ']');
  r.getCalls = getCalls;
  const det = doc.blocks.find(x => x.t === 'table' && /^Laporan harian/.test(x.title || ''));
  r.head = det && det.head.slice(-2); r.s1 = det && det.rows[0].slice(-2); r.s3 = det && det.rows[2].slice(-2); r.nrows = det && det.rows.length;
  const pairs = doc.blocks.find(x => x.t === 'pairs');
  r.total = pairs && (pairs.rows.find(p => /Total foto/.test(p[0])) || [])[1];
  r.errs = errs; console.log(JSON.stringify(r)); await b.close();
  const ok = pb.length === 2 && /^Dokumentasi Studio 1 - FILM A/.test(pb[0].title) && pb[0].list.length === 2 && /^Dokumentasi Studio 3 - FILM A/.test(pb[1].title) && pb[1].list.length === 1 &&
    getCalls.join() === 'FT-2026-0001' && r.head.join() === 'Foto,Keterangan dokumentasi' && r.nrows === 4 && r.s1.join() === '2,Layar S1' && r.s3.join() === '1,Layar S3' && String(r.total) === '3' && !errs.length;
  console.log(ok ? 'LULUS' : 'GAGAL'); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
