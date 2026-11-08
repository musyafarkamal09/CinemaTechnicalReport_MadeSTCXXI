/* Uji v20: satu laporan testing = batch + retest + data lama sehari; audit sheet tidak terpakai. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const L=f=>fs.readFileSync(path.join(__dirname,'..','backend',f),'utf8');
const store={};
const fmt=(d,p)=>{const o={timeZone:'Asia/Jakarta',hour12:false};const P=new Intl.DateTimeFormat('en-GB',{...o,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});return p==='HH:mm'?P.hour+':'+P.minute:P.year+'-'+P.month+'-'+P.day;};
const ctx={console,Logger:{log(){}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>store[k]??null,setProperty:(k,v)=>{store[k]=v},setProperties:o=>Object.assign(store,o)})},
 SpreadsheetApp:{openById:()=>({})},Utilities:{formatDate:(d,tz,p)=>fmt(d,p),getUuid:()=>'u',base64Decode:()=>[],computeDigest:()=>[],DigestAlgorithm:{SHA_256:0},Charset:{UTF_8:0}},
 DriveApp:{},CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},ScriptApp:{},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){},tryLock:()=>true})},ContentService:{},UrlFetchApp:{}};
vm.createContext(ctx); vm.runInContext(L('Code.gs'),ctx); vm.runInContext(L('dcp.gs'),ctx);
const r=[]; const check=(a,c,d)=>r.push({a,c:!!c,d:d||''});
ctx.dcpCan_=()=>{}; ctx.log_=()=>{};
const mk=(id,studio,x)=>({id,tanggal:'2026-11-08',jam:'09:00',film:'F',studio,format:'2D',tester:'T',status:'PASSED',checklist:'[]',parentId:'',batchId:'',createdAt:1,...x});
/* data: batch B1 (4 studio) + retest studio 2 + 2 data lama tanpa batchId di hari sama (studio 1 dan 5) + studio 1 ganda hari sama + hari lain */
const lap=[mk('A1','1',{batchId:'B1',createdAt:1}),mk('A2','2',{batchId:'B1',status:'FAILED'}),mk('A3','3',{batchId:'B1'}),mk('A4','4',{batchId:'B1'}),
 mk('A5','2',{parentId:'A2',tanggal:'2026-11-09'}),
 mk('L1','1',{createdAt:10}),mk('L2','5',{createdAt:11}),mk('L3','1',{createdAt:12}),mk('L4','1',{tanggal:'2026-11-01',createdAt:13})];
const foto=[{ftId:'A1',fileId:'f1',fotoId:'p1',kind:'Dokumentasi Studio 1',uploadedAt:1},{ftId:'A5',fileId:'f5',fotoId:'p5',kind:'Dokumentasi Studio 2',uploadedAt:2},{ftId:'L1',fileId:'',fotoId:'x'}];
ctx.dcpRows_=n=>(n==='FT_LAPORAN'?lap:foto).map(x=>({...x}));
const k=ctx.ftKeys_(lap.map(x=>({...x})));
check('batch: 4 studio satu kunci, retest ikut induknya',k.A1==='B1'&&k.A2==='B1'&&k.A3==='B1'&&k.A4==='B1'&&k.A5==='B1',JSON.stringify(k));
check('data lama sehari disatukan (studio 1 dan 5 satu laporan)',k.L1===k.L2&&/^D2026-11-08$/.test(k.L1),k.L1+' '+k.L2);
check('studio ganda di hari sama membuka laporan baru',k.L3==='D2026-11-08-2'&&k.L3!==k.L1,k.L3);
check('hari lain = laporan lain',k.L4==='D2026-11-01');
const g=ctx.ftReportGet_({},{id:'A3'});
check('ft_report_get: semua studio batch + retest dalam satu panggilan',g.key==='B1'&&g.laporan.map(x=>x.id).sort().join()==='A1,A2,A3,A4,A5',g.laporan.map(x=>x.id).join());
check('ft_report_get: foto per baris laporan (tanpa fileId diabaikan)',g.foto.A1.length===1&&g.foto.A5.length===1&&!g.foto.L1,JSON.stringify(Object.keys(g.foto)));
check('ft_report_get: tidak memuat data laporan lain',!g.laporan.some(x=>/^L/.test(x.id)));
const g2=ctx.ftReportGet_({},{id:'L2'});
check('ft_report_get: data lama sehari terbuka sebagai satu laporan',g2.laporan.map(x=>x.id).sort().join()==='L1,L2',g2.laporan.map(x=>x.id).join());
let err='';try{ctx.ftReportGet_({},{id:'ZZZ'});}catch(e){err=e.message;}
check('ft_report_get: id tidak ada ditolak',/tidak ditemukan/.test(err),err);
check('ft_report_get terdaftar di router',typeof vm.runInContext('DCP_H.ft_report_get',ctx)==='function');
/* audit sheet tidak terpakai */
const used=ctx.sheetsDipakai_();
['USERS','REPORTS','FT_LAPORAN','FT_FOTO','DCP_TRANSAKSI','USER_PERMS','FOTO_PEKERJAAN','WORK_REPORTS','METER_LISTRIK'].forEach(n=>check('sheet dipakai: '+n,used.hasOwnProperty(n)));
check('Sheet1 bukan sheet dipakai',!used.hasOwnProperty('Sheet1'));
const tabs=[];const mkSheet=(n,rows)=>({getName:()=>n,getLastRow:()=>rows,setTabColor:c=>tabs.push(n+':'+c)});
const sheets=[mkSheet('USERS',5),mkSheet('Sheet1',1),mkSheet('Salinan USERS lama',9),mkSheet('FT_LAPORAN',3)];
ctx.ss_=()=>({getSheets:()=>sheets});
ctx.adm_=u=>{if(u.role!=='ADMIN')throw new Error('!Akses ditolak');};
const au=ctx.sheetAudit_({role:'ADMIN'},{});
check('audit: daftar tidak terpakai benar',au.tidakTerpakai.join()==='Sheet1,Salinan USERS lama',au.tidakTerpakai.join());
check('audit: tanpa tandai tidak mengubah apa pun',tabs.length===0&&au.ditandai===0);
const au2=ctx.sheetAudit_({role:'ADMIN'},{tandai:true});
check('audit: tandai hanya sheet tidak terpakai (merah)',au2.ditandai===2&&tabs.join()==='Sheet1:#dc2626,Salinan USERS lama:#dc2626',tabs.join());
let e2='';try{ctx.sheetAudit_({role:'USER'},{});}catch(e){e2=e.message;}
check('audit: hanya Admin',/Akses ditolak/.test(e2));
check('audit web tidak pernah menghapus sheet',!/deleteSheet/.test(L('dcp.gs').slice(L('dcp.gs').indexOf('function sheetAudit_'),L('dcp.gs').indexOf('var SHEET_MARK'))));

/* hapus sheet tidak terpakai: hanya yang tidak dipakai DAN merah; backup dulu; sheet dipakai tidak pernah dihapus */
const logs=[];ctx.Logger={log:m=>logs.push(m)};
const order=[];
const mkS=(n,rows,color)=>({n,getName:()=>n,getLastRow:()=>rows,getTabColor:()=>color||null,setTabColor(c){color=c;this.col=c;},get col2(){return color;}});
const sh2=[mkS('USERS',5,'#dc2626'),mkS('Sheet1',1,'#dc2626'),mkS('Catatan saya',3,null),mkS('Eksperimen',9,'#DC2626'),mkS('FT_LAPORAN',4,'#00ff00')];
const deleted=[];
ctx.ss_=()=>({getId:()=>'SSID',getName:()=>'NOVA',getSheets:()=>sh2.filter(x=>deleted.indexOf(x.n)<0),deleteSheet:s=>{order.push('hapus '+s.n);deleted.push(s.n);}});
ctx.DriveApp={getFileById:id=>({makeCopy:nm=>{order.push('backup');ctx.__bak=nm;return {getUrl:()=>'https://drive/bak'};}})};
const hs=ctx.hapusSheetTidakTerpakai();
check('hapus: hanya sheet tidak terpakai DAN merah (Sheet1, Eksperimen)',deleted.join()==='Sheet1,Eksperimen',deleted.join());
check('hapus: sheet dipakai bertab merah (USERS) tidak dihapus',deleted.indexOf('USERS')<0);
check('hapus: sheet tidak terpakai tanpa merah dilewati (Catatan saya)',hs.dilewati.join()==='Catatan saya'&&deleted.indexOf('Catatan saya')<0);
check('hapus: backup dibuat SEBELUM penghapusan pertama',order[0]==='backup'&&/^BACKUP sebelum hapus sheet /.test(ctx.__bak),order.join('|'));
check('hapus: hasil memuat jumlah baris dan URL backup',hs.dihapus[0]==='Sheet1 (0 baris)'&&hs.backup==='https://drive/bak'&&hs.dihapus[1]==='Eksperimen (8 baris)',JSON.stringify(hs.dihapus));
order.length=0;deleted.length=0;
ctx.DriveApp={getFileById:()=>({makeCopy:()=>{throw new Error('Drive penuh');}})};
let eb='';try{ctx.hapusSheetTidakTerpakai();}catch(e){eb=e.message;}
check('hapus: backup gagal -> tidak ada sheet dihapus',/Drive penuh/.test(eb)&&deleted.length===0,eb+' '+deleted.join());
const only=[mkS('Sheet1',1,'#dc2626')];
ctx.ss_=()=>({getId:()=>'X',getName:()=>'N',getSheets:()=>only,deleteSheet:()=>{order.push('x');}});
let e3='';try{ctx.hapusSheetTidakTerpakai();}catch(e){e3=e.message;}
check('hapus: tidak boleh menghapus semua sheet',/minimal satu sheet/.test(e3)&&order.length===0,e3);
const sh3=[mkS('USERS',1,'#dc2626'),mkS('FT_LAPORAN',1,'#00ff00'),mkS('Sheet1',1,null)];
ctx.ss_=()=>({getSheets:()=>sh3});
ctx.sinkronSheetTidakTerpakai();
check('sinkron: tanda merah lama pada sheet dipakai dibersihkan, warna lain dipertahankan, sheet tak terpakai jadi merah',sh3[0].col2===null&&sh3[1].col2==='#00ff00'&&sh3[2].col2==='#dc2626',[sh3[0].col2,sh3[1].col2,sh3[2].col2].join());
check('hapus: tidak ada hapus lewat tombol web (hanya fungsi editor)',!/deleteSheet/.test(L('dcp.gs').slice(L('dcp.gs').indexOf('var DCP_H'))));
r.forEach(z=>console.log((z.c?'PASS ':'FAIL ')+z.a+(z.c?'':' -> '+z.d)));
const f=r.filter(z=>!z.c); console.log('\nHASIL: '+(r.length-f.length)+'/'+r.length+' lulus'); process.exit(f.length?1:0);
