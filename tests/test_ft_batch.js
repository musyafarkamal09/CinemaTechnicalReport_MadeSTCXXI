/* Uji atomik dcp_batch_save: semua item tersimpan, atau tidak sama sekali (rollback). */
const fs=require('fs'),vm=require('vm'),path=require('path');
const L=f=>fs.readFileSync(path.join(__dirname,'..','backend',f),'utf8');
const store={};
const ctx={console,Logger:{log(){}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>store[k]??null,setProperty:(k,v)=>{store[k]=v},setProperties:o=>Object.assign(store,o)})},
 SpreadsheetApp:{openById:()=>({getSheetByName:()=>({getDataRange:()=>({getValues:()=>[]}),getLastRow:()=>0})})},
 Utilities:{formatDate:()=>'2026-11-06',getUuid:()=>'u',base64Decode:()=>[],computeDigest:()=>[],DigestAlgorithm:{SHA_256:0},Charset:{UTF_8:0}},
 DriveApp:{},CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},ScriptApp:{},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){},tryLock:()=>true})},ContentService:{},UrlFetchApp:{}};
vm.createContext(ctx); vm.runInContext(L('Code.gs'),ctx); vm.runInContext(L('dcp.gs'),ctx);
/* gudang tiruan FT_LAPORAN: ftSave_ ditiru agar menolak film 'GAGAL' dan studio '3' pada film 'S3GAGAL' */
let rows=[],n=0; const sheet={deleteRow:r=>{rows=rows.filter(x=>x._row!==r);rows.forEach((x,i)=>x._row=i+2)}};
ctx.ss_=()=>({getSheetByName:()=>sheet}); ctx.dcpRows_=()=>rows.slice(); ctx.log_=()=>{};
ctx.ftSave_=(u,q)=>{ if(q.film==='GAGAL'||(q.film==='S3GAGAL'&&String(q.studio)==='3')) throw new Error('!Hasil FAILED: isi deskripsi masalah.'); const id='FT'+(++n); rows.push({id,_row:rows.length+2,batchId:q.batchId,studio:q.studio,parentId:q.parentId}); return id; };
const r=[]; const check=(a,c,d)=>r.push({a,c:!!c,d:d||''});
const run=q=>{try{return {ok:ctx.ftBatchSave_({},q)}}catch(e){return {err:String(e.message)}}};
const four=film=>['1','2','3','4'].map(s=>({film,studio:s}));
let x=run({items:four('A')});
check('4 studio tersimpan dalam satu batchId',x.ok&&x.ok.ids.length===4&&rows.length===4&&rows.every(z=>z.batchId===x.ok.batchId),JSON.stringify(x));
check('tiap studio tetap satu baris sendiri',new Set(rows.map(z=>z.studio)).size===4);
rows=[]; x=run({items:four('S3GAGAL')});
check('studio ke-3 gagal: rollback total',x.err&&rows.length===0,JSON.stringify(x)+' rows='+rows.length);
check('pesan error menyebut nomor studio',/^!Studio 3:/.test(x.err||''),x.err);
rows=[]; x=run({items:[{film:'A',studio:'1'},{film:'A',studio:'1'}]});
check('studio ganda ditolak sebelum menulis',x.err&&/dua kali/.test(x.err)&&rows.length===0,x.err);
check('studio kosong ditolak',!!run({items:[{film:'A',studio:''}]}).err);
check('daftar kosong ditolak',!!run({items:[]}).err);
check('lebih dari 20 studio ditolak',!!run({items:Array.from({length:21},(_,i)=>({film:'A',studio:String(i+1)}))}).err);
rows=[]; x=run({items:[{film:'A',studio:'1',batchId:'PALSU',id:'FT-1',parentId:'P'},{film:'A',studio:'2'}]});
check('batchId/id/parentId di dalam item tidak menimpa batch server',x.ok&&rows.every(z=>z.batchId===x.ok.batchId&&!z.parentId),JSON.stringify(rows));
check('ft_batch_save terdaftar & terkunci (_save)',/ft_batch_save/.test(L('dcp.gs'))&&/_\(save\|del\)\$/.test(L('Code.gs')));
r.forEach(z=>console.log((z.c?'PASS ':'FAIL ')+z.a+(z.c?'':' -> '+z.d)));
const f=r.filter(z=>!z.c); console.log('\nHASIL: '+(r.length-f.length)+'/'+r.length+' lulus'); process.exit(f.length?1:0);
