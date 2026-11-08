/* NOVA v14 — uji browser: menu Download, Film Testing multi-studio (5 studio), DCP multi-item, ekspor (jsPDF/XLSX ditiru perekam). */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const mock = require('./mockapi');
const W = process.argv[2] || 'desktop';
const VP = { desktop:{width:1440,height:900}, tablet:{width:820,height:1180}, phone:{width:390,height:844} }[W];
const BASE = process.env.BASE || 'http://localhost:8765';
const today = new Date(Date.now()+7*36e5).toISOString().slice(0,10);
const CK = (id,v,k)=>({id,val:v,ket:k||''});
const ft = [
 {id:'FT-2026-0001',tanggal:today,jam:'10:00',film:'FILM A',studio:'1',format:'2D',server:'S1',projector:'P1',tester:'Budi',status:'PASSED',checklist:[CK('A1','PASS')],masalah:'',tindakan:'',parentId:''},
 {id:'FT-2026-0002',tanggal:today,jam:'10:30',film:'FILM B',studio:'2',format:'3D',server:'S2',projector:'P2',tester:'Budi',status:'FAILED',checklist:[CK('A1','FAIL','Audio pecah')],masalah:'Audio pecah',tindakan:'Ganti kabel',parentId:''},
 {id:'FT-2026-0003',tanggal:today,jam:'11:00',film:'FILM C',studio:'3',format:'2D',server:'',projector:'',tester:'Sari',status:'RETEST',checklist:[],masalah:'',tindakan:'',parentId:''},
 {id:'FT-2026-0004',tanggal:'2026-10-01',jam:'09:00',film:'FILM D',studio:'4',format:'ATMOS',server:'',projector:'',tester:'Sari',status:'PASSED',checklist:[],masalah:'',tindakan:'',parentId:''},
 {id:'FT-2026-0005',tanggal:today,jam:'12:00',film:'FILM E',studio:'5',format:'2D',server:'',projector:'',tester:'Dedi',status:'PASSED',checklist:[],masalah:'',tindakan:'',parentId:''},
 {id:'FT-2026-0006',tanggal:today,jam:'13:00',film:'FILM F',studio:'2',format:'2D',server:'',projector:'',tester:'Dedi',status:'PASSED',checklist:[],masalah:'',tindakan:'',parentId:''},
];
const dcpRows = [1,2,3].map(i=>({id:'DCP-OUT-2026-000'+i,jenis:'KELUAR',tanggal:today,jam:'10:0'+i,film:'FILM '+i,kodeDisk:'D-0'+i,ph:'PH '+i,format:'2D',penerima:'Rina',penyerah:'Andi',tujuan:'Outlet X',keterangan:'',status:'Diproses',kelengkapan:[{name:'HDD',status:'Lengkap',note:''},{name:'USB',status:'Lengkap',note:''}],relasiId:'',masukId:'',batchId:'BTEST1',incomplete:false,createdAt:1}));
const H = mock.handlers;
H.ft_list = () => ft; H.dcp_list = () => dcpRows;
H.dcp_dash = () => ({ totalKeluar:3,totalMasuk:0,belumKembali:3,dalamProses:3,bermasalah:0,overdue:[],terbaru:[],batasHari:7 });
H.dcp_get = (b) => ({ transaksi: dcpRows.find(r=>r.id===b.id)||dcpRows[0], foto:[], relasi:null });
H.dcp_meta = () => ({ komponen:['HDD','USB'],komponenStatus:['Lengkap','Tidak Ada','Rusak','Tidak Diperlukan'],formatDcp:['2D','3D'],statusDcp:['Diproses','Selesai','Bermasalah'],formatFt:['2D','3D','ATMOS'],checklist:[{name:'Audio',key:'A'}],checklistItem:[{id:'A1',grp:'Audio',label:'Suara'}],status:['PASSED','FAILED','RETEST'] });
const calls = [];
H.dcp_batch_save = (b) => { calls.push(['dcp_batch_save', b]); return { batchId:'B1', ids:b.items.map((_,i)=>'ID'+i) }; };
H.dcp_save = (b) => { calls.push(['dcp_save', b]); return 'ID0'; };
H.dcp_del = (b) => { calls.push(['dcp_del', b]); return true; };

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: VP, acceptDownloads:true });
  await ctx.addInitScript(() => {
    localStorage.setItem('stc_t','t'); localStorage.setItem('stc_u', JSON.stringify({userId:'U1',name:'Musyafar Kamal',username:'admin',role:'ADMIN'}));
    window.__pdf = []; window.__x = null;
    class FakeDoc { constructor(o){ this.o=o; this.pages=1; this.cur=1; this.t=[]; this.internal={pageSize:{getWidth:()=>o.orientation==='landscape'?297:210,getHeight:()=>o.orientation==='landscape'?210:297}}; this.at=[]; this.lastAutoTable={finalY:40}; }
      getNumberOfPages(){return this.pages} setPage(n){this.cur=n} addPage(){this.pages++;this.cur=this.pages} text(s,x,y){this.t.push({p:this.cur,s:String(Array.isArray(s)?s.join(' '):s)})}
      autoTable(o){ this.at.push({head:o.head,body:o.body,foot:o.foot}); this.lastAutoTable={finalY:(o.startY||40)+(o.body.length+2)*6}; if(this.lastAutoTable.finalY>250)this.pages++; }
      splitTextToSize(s){return [String(s)]} addImage(){} save(f){window.__pdf.push({file:f,pages:this.pages,orient:this.o.orientation,text:this.t,tables:this.at,logos:window.__logoCalls||0})}
      setFillColor(){} rect(){} roundedRect(){} setTextColor(){} setFont(){} setFontSize(){} setDrawColor(){} setLineWidth(){} line(){} setProperties(){} }
    window.jspdf = { jsPDF: FakeDoc };
    window.XLSX = { utils:{ aoa_to_sheet:a=>({aoa:a}), book_new:()=>({sheets:[]}), book_append_sheet:(wb,ws,n)=>wb.sheets.push({name:n,aoa:ws.aoa}) }, writeFile:(wb,f)=>{window.__x={file:f,sheets:wb.sheets}} };
  });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await mock.install(page);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept('6'));
  const res = {}; const ok = (n,c,d)=>{res[n]={pass:!!c,detail:d||''}};
  await page.goto(BASE + '/index.html'); await page.waitForTimeout(1300);
  const go = async (p) => { await page.evaluate(k=>{const a=document.querySelector('#nav a[data-p="'+k+'"]')||document.querySelector('#tabs a[data-p="'+k+'"]');a&&a.click()},p); await page.waitForTimeout(900); };

  /* 1. menu Download: item PDF tidak tertimpa */
  await go('work');
  await page.click('[data-dlt]'); await page.waitForTimeout(250);
  const dl = await page.evaluate(()=>{const m=document.querySelector('.dlm:not(.hidden)');const out=[];m.querySelectorAll('button').forEach(bt=>{const r=bt.getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);out.push(e===bt||bt.contains(e))});return out});
  ok('download-menu: semua item bisa diklik (tidak tertimpa)', dl.length===2 && dl.every(Boolean), JSON.stringify(dl));
  await page.keyboard.press('Escape'); await page.mouse.click(5,5);

  /* 2. Film Testing multi-studio */
  await go('ftest');
  const st = await page.evaluate(()=>({chips:[...document.querySelectorAll('.mdc-stab[data-stu]')].map(x=>x.dataset.stu),secs:[...document.querySelectorAll('.ftr-list tbody tr[data-ft-open]')].map(x=>x.dataset.ftOpen),rekap:[...document.querySelectorAll('.ft-rekap tbody tr')].map(r=>r.innerText.replace(/\s+/g,' ').trim()),foot:document.querySelector('.ft-rekap tfoot')?.innerText.replace(/\s+/g,' ').trim()}));
  ok('FT: 5 studio tampil (4+), semua terpilih default', st.chips.join()==='1,2,3,4,5' && st.secs.length===3, JSON.stringify(st.chips));
  ok('FT: rekap per studio terpisah & total benar', st.rekap[1].startsWith('Studio 2 2 1 1 0') && /Total 6 4 1 1/.test(st.foot), JSON.stringify(st.rekap)+st.foot);
  const sec2 = await page.evaluate(()=>[...document.querySelectorAll('.ftr-list tbody tr[data-ft-open]')].map(r=>r.dataset.ftOpen+':'+r.querySelectorAll('.ftr-chip').length));
  ok('FT: data lama per hari menyatu: 4 studio dalam SATU laporan hari ini, studio 2 kedua = laporan sendiri, laporan lama terpisah', sec2.join()==='FT-2026-0006:1,FT-2026-0001:4,FT-2026-0004:1', sec2.join());
  await page.click('.mdc-stab[data-stu="3"]'); await page.waitForTimeout(700);
  await page.click('.mdc-stab[data-stu="4"]'); await page.waitForTimeout(700);
  const secs2 = await page.evaluate(()=>[...document.querySelectorAll('.ft-rekap tbody tr td:first-child')].map(x=>x.innerText.replace('Studio ','').trim()));
  ok('FT: pilih subset studio (hapus 3 dan 4)', secs2.join()==='1,2,5', secs2.join());
  await page.click('.mdc-stab[data-stu-all]'); await page.waitForTimeout(700);
  await page.click('[data-dlt]'); await page.click('#ftpdf'); await page.waitForTimeout(500);
  await page.click('[data-dlt]'); await page.click('#ftxl'); await page.waitForTimeout(500);
  const ex = await page.evaluate(()=>({pdf:window.__pdf[window.__pdf.length-1],x:window.__x}));
  ok('FT PDF gabungan: info + rekap(5 studio) + SATU tabel harian', ex.pdf && ex.pdf.tables.length===3 && ex.pdf.tables[1].body.length===5 && ex.pdf.tables[2].body.length===6 && ex.pdf.orient==='landscape', ex.pdf&&ex.pdf.tables.length+' tabel '+ex.pdf.file);
  ok('FT PDF: header/footer identitas di tiap halaman', ex.pdf && ex.pdf.text.some(t=>/Innovation by MK/.test(t.s)) && ex.pdf.text.some(t=>/Designed & Developed by MK/.test(t.s)) && ex.pdf.text.some(t=>/Halaman 1 \//.test(t.s)));
  ok('FT Excel: SATU lembar Rekap (tidak dipecah per studio)', ex.x && ex.x.sheets.length===1 && ex.x.sheets[0].name==='Rekap', ex.x&&ex.x.sheets.map(s=>s.name).join('|'));
  const s2 = ex.x.sheets[0]; const flat = JSON.stringify(s2.aoa);
  ok('FT Excel: semua studio ada di lembar yang sama', flat.includes('FT-2026-0002')&&flat.includes('FT-2026-0006')&&flat.includes('FT-2026-0001')&&flat.includes('FILM E'));
  ok('FT: temuan FAIL masuk laporan', flat.includes('Audio pecah'));
  await page.screenshot({path:`shots/v14-${W}-ft.png`, fullPage:false});
  /* studio baru dapat ditambah */
  await page.click('#stuadd'); await page.waitForTimeout(700);
  const chips2 = await page.evaluate(()=>[...document.querySelectorAll('.mdc-stab[data-stu]')].map(x=>x.dataset.stu));
  ok('FT: tambah Studio 6', chips2.includes('6'), chips2.join());
  /* form baru memuat semua studio */
  await page.click('#ftnew'); await page.waitForTimeout(900);
  const opts = await page.evaluate(()=>[...document.querySelectorAll('#ftchips input[name=stu]')].map(o=>o.value)); /* form multi-studio: kotak centang, bukan select */
  ok('FT form: pilihan studio 1-6', opts.join()==='1,2,3,4,5,6', opts.join());
  await page.evaluate(()=>document.getElementById('ftx').click());

  /* 3. DCP multi-item */
  await go('dcp'); await page.waitForTimeout(400);
  const badge = await page.evaluate(()=>document.querySelectorAll('#view .mdc-tbl .mdc-info').length);
  ok('DCP: daftar menandai laporan multi-item', badge===3, String(badge));
  await page.evaluate(()=>document.querySelector('[data-dcp-open]').click()); await page.waitForTimeout(1200);
  const panel = await page.evaluate(()=>({rows:document.querySelectorAll('#mi-sib tbody tr').length,add:!!document.getElementById('mi-add2'),edit:document.querySelectorAll('[data-mi-edit]').length,del:document.querySelectorAll('[data-mi-del]').length,dl:!!document.getElementById('mibpdf')}));
  ok('DCP: panel item (3 item, tambah/ubah/hapus, unduh lengkap)', panel.rows===3&&panel.add&&panel.edit===3&&panel.del===3&&panel.dl, JSON.stringify(panel));
  await page.evaluate(()=>document.querySelector('#mi-sib [data-dlt]').click()); await page.click('#mibpdf'); await page.waitForTimeout(800);
  await page.evaluate(()=>document.querySelector('#mi-sib [data-dlt]').click()); await page.click('#mibxl'); await page.waitForTimeout(500);
  const ex2 = await page.evaluate(()=>({pdf:window.__pdf[window.__pdf.length-1],x:window.__x}));
  ok('DCP PDF lengkap: ringkasan 3 item + kelengkapan tiap item', ex2.pdf && ex2.pdf.tables.length===5 && ex2.pdf.tables[1].body.length===3, ex2.pdf&&ex2.pdf.tables.length+'');
  ok('DCP Excel lengkap: Ringkasan + lembar per item', ex2.x.sheets.length===4 && ex2.x.sheets[0].name==='Ringkasan', ex2.x.sheets.map(s=>s.name).join('|'));
  await page.evaluate(()=>document.querySelector('[data-mi-del]').click()); await page.waitForTimeout(500);
  ok('DCP: hapus item memanggil dcp_del', calls.some(c=>c[0]==='dcp_del'));
  /* tambah item ke laporan */
  await page.evaluate(()=>document.getElementById('mi-add2').click()); await page.waitForTimeout(900);
  const frm = await page.evaluate(()=>({title:document.querySelector('#mbox h3')?.innerText,pen:document.querySelector('#dcpf [name=penyerah]')?.value}));
  ok('DCP: form tambah item ke laporan (terisi dari laporan)', /Tambah item/.test(frm.title||'') && frm.pen==='Andi', JSON.stringify(frm));
  await page.fill('#dcpf [name=film]','FILM BARU'); await page.fill('#dcpf [name=kodeDisk]','D-99'); await page.fill('#dcpf [name=ph]','PH Z');
  await page.click('#dcpf .mi-add'); await page.fill('#dcpf .mi-film','FILM DUA'); await page.fill('#dcpf .mi-kd','D-98'); await page.fill('#dcpf .mi-ph','PH Y');
  await page.click('#dcpok'); await page.waitForTimeout(1500);
  const bs = calls.filter(c=>c[0]==='dcp_batch_save').pop();
  ok('DCP: 2 item baru -> satu dcp_batch_save dengan batchId laporan', bs && bs[1].items.length===2 && bs[1].batchId==='BTEST1', bs&&JSON.stringify([bs[1].items.length,bs[1].batchId]));

  /* 4. tanpa overflow horizontal + tanpa error */
  for (const m of ['ftest','dcp','pel','dashboard','work']) { await go(m); const o = await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth); ok('layout '+m+' tanpa scroll horizontal', o<=1, 'overflow '+o+'px'); }
  ok('tanpa error JS', errs.length===0, errs.join(' | '));
  const f = Object.entries(res).filter(([,v])=>!v.pass);
  console.log(W, Object.entries(res).map(([k,v])=>(v.pass?'PASS ':'FAIL ')+k+(v.pass?'':' -> '+v.detail)).join('\n'));
  console.log(`HASIL ${W}: ${Object.keys(res).length-f.length}/${Object.keys(res).length}`);
  await b.close(); process.exit(f.length?1:0);
})().catch(e => { console.error('FATAL', e.stack); process.exit(2); });
