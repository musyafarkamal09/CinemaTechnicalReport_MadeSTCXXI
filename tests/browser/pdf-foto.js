/* NOVA v16 — repPdf() (laporan tunggal) dengan berbagai jumlah/rasio foto, memakai jsPDF tiruan perekam. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const { install } = require('./mockapi');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Uji',username:'admin',role:'ADMIN'}));
    window.__rec = null;
    class D { constructor(){ this.pages=1; this.im=[]; this.fy=0; this.internal={pageSize:{getWidth:()=>210,getHeight:()=>297}}; }
      getNumberOfPages(){return this.pages} setPage(){} addPage(){this.pages++} addImage(d,f,x,y,w,h){this.im.push({page:this.pages,x,y,w,h})}
      autoTable(o){ const y=(o.startY||40)+((o.body||[]).length+1)*7; this.lastAutoTable={finalY:y}; }
      splitTextToSize(s){return [String(s)]} text(){} save(f){window.__rec={f,pages:this.pages,im:this.im}}
      setFillColor(){} rect(){} roundedRect(){} setTextColor(){} setFont(){} setFontSize(){} setDrawColor(){} setLineWidth(){} line(){} setProperties(){} addImageX(){} }
    window.jspdf = { jsPDF: D }; });
  const page = await ctx.newPage(); await page.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await install(page);
  /* uji saja: buka repPdf dari dalam IIFE app.js tanpa mengubah file sumber */
  await page.route(/\/app\.js/, async r => { const resp = await r.fetch(); let t = await resp.text(); t = t.replace('window.STC={', 'window.__T={repPdf:repPdf};window.STC={'); await r.fulfill({ response: resp, body: t }); });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto((process.env.BASE||'http://localhost:8765') + '/index.html'); await page.waitForTimeout(1200);
  const R = { p:[800,1200], l:[1200,800], s:[1000,1000], w:[1600,900] };
  const res = []; const ok = (n,c,d) => res.push((c?'PASS ':'FAIL ')+n+(c?'':' :: '+d));
  for (const seq of ['', 'l', 'p', 'll', 'ppp', 'plsw', 'pllps', 'plswplswplsw', 'lllllllllllllllllllllllll']) {
    const out = await page.evaluate(async ({seq, R}) => {
      const imgs = seq.split('').map((c,i) => ({ data:'data:image/jpeg;base64,/9j/', w:R[c][0], h:R[c][1], p:{ kind:'Sebelum', capturedAt:Date.now() } }));
      const r = { id:'WRK-TEST', type:'work', data:{ date:'2026-11-07', title:'Uji', category:'AC', location:'Studio 1', status:'Completed', team:['A'] }, reporter:'Uji', status:'Completed' };
      try { window.__T.repPdf(r, imgs); } catch (e) { return { err: String(e && e.stack || e) }; }
      return window.__rec;
    }, {seq, R});
    if (out.err) { ok('repPdf '+seq.length+' foto tanpa error', false, out.err.slice(0,200)); continue; }
    const im = out.im, bad = [];
    if (im.length !== seq.length) bad.push('jumlah '+im.length);
    im.forEach((g,i) => { const a = R[seq[i]][0]/R[seq[i]][1]; if (Math.abs(g.w/g.h-a)>1e-6) bad.push('rasio#'+i); if (g.x<14-1e-6||g.x+g.w>196+1e-6) bad.push('lebar#'+i); if (g.y+g.h>297-14+1e-6) bad.push('bawah#'+i); if (im.length>1 && (g.h<45.9||g.w<31.9)) bad.push('kecil#'+i); });
    if (im.length && im[0].page !== 1) bad.push('foto tidak di halaman 1 (di bawah tabel)');
    ok('repPdf '+seq.length+' foto ('+seq.slice(0,12)+') -> '+out.pages+' hal, foto pertama hal '+(im[0]?im[0].page:'-'), !bad.length, bad.join(','));
  }
  ok('tanpa error JS', !errs.length, errs.join('|'));
  console.log(res.join('\n')); const f = res.filter(x=>x.startsWith('FAIL')).length; console.log('HASIL: '+(res.length-f)+'/'+res.length); await b.close(); process.exit(f?1:0);
})();
