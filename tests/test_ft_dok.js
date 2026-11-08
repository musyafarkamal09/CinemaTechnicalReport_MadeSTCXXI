/* Uji v19: tanggal/jam konsisten (WIB), keterangan dokumentasi per studio, jumlah foto di daftar. */
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

/* 1. Date dari Spreadsheet -> teks WIB; teks tetap teks */
const d1=new Date('2026-11-07T20:30:00Z'); /* 08 Nov 2026 03:30 WIB: tanggal UTC berbeda dengan WIB */
check('tanggal Date -> yyyy-MM-dd WIB (bukan tanggal UTC)',ctx.dcpNormDT_('tanggal',d1)==='2026-11-08',ctx.dcpNormDT_('tanggal',d1));
check('jam Date -> HH:mm WIB',ctx.dcpNormDT_('jam',d1)==='03:30',ctx.dcpNormDT_('jam',d1));
check('teks tanggal tidak diubah',ctx.dcpNormDT_('tanggal','2026-11-08')==='2026-11-08');
check('kolom lain tidak disentuh',ctx.dcpNormDT_('film',d1)===ctx.dcpNormDT_('film',d1)&&typeof ctx.dcpNormDT_('film','A')==='string');
check('Date tidak valid dibiarkan',String(ctx.dcpNormDT_('tanggal',new Date('x')))==='Invalid Date');

/* 2. skema: ketDok ada di ujung FT_LAPORAN (aditif) dan tanggal/jam diformat teks */
const cols=vm.runInContext('DCP_SH.FT_LAPORAN',ctx);
check('ketDok kolom terakhir FT_LAPORAN',cols[cols.length-1]==='ketDok'&&cols.indexOf('batchId')===cols.length-2,cols.join());
check('dcpSheets_ memakai penanda sekali-per-eksekusi',/DCP_READY_/.test(L('dcp.gs'))&&/setNumberFormat\('@'\)/.test(L('dcp.gs')));

/* 3. ftSave_ menyimpan ketDok; ftList_/ftShape_ mengembalikan ketDok + fotoCount */
let written=null; ctx.dcpCan_=()=>{}; ctx.dcpRows_=n=>n==='FT_LAPORAN'?[]:[]; ctx.dcpNext_=()=> 'FT-2026-0001'; ctx.dcpAdd_=(n,o)=>{written=o}; ctx.log_=()=>{};
ctx.ftSave_({role:'ADMIN',userId:'1',fullName:'A'},{tanggal:'2026-11-08',jam:'03:30',film:'F',studio:'2',format:'2D',tester:'T',checklist:vm.runInContext('ftItemIds_()',ctx).map(i=>({id:i.id,val:'PASS'})),ketDok:'Layar Studio 2 bagian kiri'});
check('ketDok tersimpan',written&&written.ketDok==='Layar Studio 2 bagian kiri',JSON.stringify(written&&written.ketDok));
written=null; ctx.ftSave_({role:'ADMIN',userId:'1',fullName:'A'},{tanggal:'2026-11-08',jam:'03:30',film:'F',studio:'3',format:'2D',tester:'T',checklist:vm.runInContext('ftItemIds_()',ctx).map(i=>({id:i.id,val:'PASS'})),ketDok:'x'.repeat(2000)});
check('ketDok dibatasi 1000 karakter',written&&written.ketDok.length<=1000,String(written&&written.ketDok.length));
const lap=[{id:'A',tanggal:new Date('2026-11-07T20:30:00Z'),jam:'03:30',studio:'1',ketDok:'k1',film:'F',checklist:'[]'},{id:'B',tanggal:'2026-11-08',jam:'03:31',studio:'2',film:'F',checklist:'[]'}];
const foto=[{ftId:'A',fileId:'f1'},{ftId:'A',fileId:'f2'},{ftId:'B',fileId:''}];
ctx.dcpRows_=n=>(n==='FT_LAPORAN'?lap:foto).map(x=>({...x}));
const lst=ctx.ftList_({}, {});
const a=lst.find(x=>x.id==='A'),b=lst.find(x=>x.id==='B');
check('daftar: fotoCount tiap studio terhubung ke laporannya',a.fotoCount===2&&b.fotoCount===0,JSON.stringify([a.fotoCount,b.fotoCount]));
check('daftar: ketDok ikut',a.ketDok==='k1'&&b.ketDok==='');
r.forEach(z=>console.log((z.c?'PASS ':'FAIL ')+z.a+(z.c?'':' -> '+z.d)));
const f=r.filter(z=>!z.c); console.log('\nHASIL: '+(r.length-f.length)+'/'+r.length+' lulus'); process.exit(f.length?1:0);
