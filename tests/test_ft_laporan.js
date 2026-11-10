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


/* temuan audit 1: nama bawaan JavaScript bukan aksi (tidak membocorkan hash/salt) */
let er='';try{ctx.route_({action:'constructor',token:'x'});}catch(e){er=e.message;}
check('route_: "constructor" ditolak sebagai aksi tidak dikenal',/Aksi tidak dikenal/.test(er),er);
er='';try{ctx.route_({action:'toString'});}catch(e){er=e.message;}
check('route_: "toString" ditolak',/Aksi tidak dikenal/.test(er),er);
er='';try{ctx.route_({action:'hasOwnProperty'});}catch(e){er=e.message;}
check('route_: "hasOwnProperty" ditolak',/Aksi tidak dikenal/.test(er),er);
/* temuan audit 2: studio ganda dalam satu laporan ditolak (tambah studio ke laporan yang ada) */
{
 const added=[];const base=[mk('A1','1',{batchId:'B1'}),mk('A2','2',{batchId:'B1'}),mk('L1','1',{createdAt:10}),mk('L2','5',{createdAt:11})];
 ctx.dcpRows_=n=>n==='FT_LAPORAN'?base.map(x=>({...x})):[];ctx.dcpAdd_=(n,o)=>{added.push(o);};ctx.dcpUpd_=()=>{};
 const U={role:'ADMIN',userId:'1',fullName:'A'},ck=vm.runInContext('ftItemIds_()',ctx).map(i=>({id:i.id,val:'PASS'}));
 const mkq=(z,b,x)=>({tanggal:'2026-11-08',jam:'09:00',film:'F',studio:z,format:'2D',tester:'T',checklist:ck,batchId:b,...x});
 const tryS=q=>{try{return {id:ctx.ftSave_(U,q)};}catch(e){return {err:e.message};}};
 check('tambah studio yang sudah ada di batch ditolak',/sudah ada di laporan ini/.test(tryS(mkq('2','B1')).err||''));
 check('studio sama dengan huruf/spasi beda juga ditolak',/sudah ada/.test(tryS(mkq(' 2 ','B1')).err||''));
 check('studio baru ke batch diterima',!!tryS(mkq('3','B1')).id&&added.length===1&&added[0].batchId==='B1',JSON.stringify(added.map(a=>a.studio)));
 check('laporan lama sehari (kunci D...): studio ada ditolak, studio baru diterima',/sudah ada/.test(tryS(mkq('1','D2026-11-08')).err||'')&&!!tryS(mkq('6','D2026-11-08')).id);
 check('batch baru (kunci belum ada) bebas',!!tryS(mkq('1','FBBARU')).id);
 /* ubah nomor studio menabrak studio lain dalam laporan yang sama */
 ctx.dcpRows_=n=>n==='FT_LAPORAN'?base.map(x=>({...x,createdByUserId:'1'})):[];
 check('ubah studio 2 menjadi 1 (sudah ada) ditolak',/sudah ada/.test(tryS(mkq('1','B1',{id:'A2'})).err||''));
 check('ubah studio 2 menjadi 7 diterima',!!tryS(mkq('7','B1',{id:'A2'})).id);
 check('simpan ulang tanpa ganti studio diterima',!!tryS(mkq('2','B1',{id:'A2'})).id);
 /* temuan audit 4: batch membaca sheet sekali */
 let reads=0;const rows2=[];ctx.dcpRows_=n=>{if(n==='FT_LAPORAN')reads++;return rows2.map(x=>({...x}));};
 ctx.dcpAdd_=(n,o)=>{rows2.push(o);};
 const rb=ctx.ftBatchSave_(U,{batchId:'FBX',items:['1','2','3','4','5'].map(z=>mkq(z,'',{}))});
 check('batch 5 studio: sheet dibaca sekali dan ID berurutan unik',reads===1&&new Set(rb.ids).size===5&&rb.ids.map(i=>i.slice(-4)).join()==='0001,0002,0003,0004,0005',reads+' '+rb.ids.join());
}

/* pembersihan sheet (Code.gs): sheet modul DCP/Film Testing TIDAK PERNAH dianggap tidak terpakai; backup dulu; minimal satu sheet tersisa */
const logs=[];ctx.Logger={log:m=>logs.push(m)};
const DCPN=['DCP_TRANSAKSI','DCP_FOTO','USER_PERMS','FT_LAPORAN','FT_FOTO'];
check('registri Code.gs memuat semua sheet DCP/Film Testing',DCPN.every(n=>ctx.sheetPakai_().hasOwnProperty(n)),Object.keys(ctx.sheetPakai_()).join());
const order=[],deleted=[];
const mkS=n=>({n,getName:()=>n,getLastRow:()=>5,getLastColumn:()=>3,hideSheet(){order.push('sembunyi '+n);}});
const sh2=['USERS','FT_LAPORAN','DCP_TRANSAKSI','USER_PERMS','DCP_FOTO','FT_FOTO','REPORTS','Sheet1','Eksperimen'].map(mkS);
ctx.ss_=()=>({getId:()=>'SSID',getName:()=>'NOVA',getSheets:()=>sh2.filter(x=>deleted.indexOf(x.n)<0),getSheetByName:n=>sh2.filter(x=>x.n===n)[0],setActiveSheet(){},deleteSheet:s=>{order.push('hapus '+s.n);deleted.push(s.n);}});
ctx.DriveApp={getFileById:()=>({makeCopy:nm=>{order.push('backup');ctx.__bak=nm;return {getUrl:()=>'https://drive/bak'};}})};
const per=ctx.periksaSheetTidakTerpakai();
check('periksa: hanya Sheet1 dan Eksperimen yang tidak terpakai (DCP/Testing TIDAK ikut)',per.join()==='Sheet1,Eksperimen',per.join());
ctx.sembunyikanSheetTidakTerpakai();
check('sembunyikan: tidak menyentuh sheet DCP/Testing',order.join('|')==='sembunyi Sheet1|sembunyi Eksperimen',order.join('|'));
order.length=0;
ctx.hapusSheetTidakTerpakai();
check('hapus: hanya Sheet1 dan Eksperimen; semua sheet DCP/Testing aman',deleted.join()==='Sheet1,Eksperimen'&&DCPN.every(n=>deleted.indexOf(n)<0),deleted.join());
check('hapus: backup dibuat SEBELUM penghapusan pertama',order[0]==='backup'&&/^BACKUP sebelum hapus sheet /.test(ctx.__bak),order.join('|'));
deleted.length=0;order.length=0;
ctx.DriveApp={getFileById:()=>({makeCopy:()=>{throw new Error('Drive penuh');}})};
let eb='';try{ctx.hapusSheetTidakTerpakai();}catch(e){eb=e.message;}
check('hapus: backup gagal -> tidak ada sheet dihapus',/Drive penuh/.test(eb)&&deleted.length===0,eb+' '+deleted.join());
const only=[mkS('Sheet1')];
ctx.ss_=()=>({getId:()=>'X',getName:()=>'N',getSheets:()=>only,getSheetByName:()=>null,setActiveSheet(){},deleteSheet:()=>{order.push('x');}});
let e3='';try{ctx.hapusSheetTidakTerpakai();}catch(e){e3=e.message;}
check('hapus: tidak boleh menghapus semua sheet',/minimal satu sheet/.test(e3)&&order.length===0,e3);
const dsrc=L('dcp.gs');
check('dcp.gs tidak lagi mendefinisikan fungsi pembersih bernama sama (tidak bentrok dengan Code.gs)',!/function hapusSheetTidakTerpakai|function sinkronSheetTidakTerpakai/.test(dsrc));
check('tombol web tidak menghapus',!/deleteSheet/.test(dsrc.slice(dsrc.indexOf('function sheetAudit_'),dsrc.indexOf('var DCP_H'))));
r.forEach(z=>console.log((z.c?'PASS ':'FAIL ')+z.a+(z.c?'':' -> '+z.d)));
const f=r.filter(z=>!z.c); console.log('\nHASIL: '+(r.length-f.length)+'/'+r.length+' lulus'); process.exit(f.length?1:0);
