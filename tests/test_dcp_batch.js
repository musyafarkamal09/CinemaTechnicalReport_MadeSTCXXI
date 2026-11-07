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
/* gudang tiruan: baris = {id,_row,...}; dcpSave_/pelSave_ ditiru agar menolak film 'GAGAL' */
let rows=[],n=0; const sheet={deleteRow:r=>{rows=rows.filter(x=>x._row!==r);rows.forEach((x,i)=>x._row=i+2)}};
ctx.ss_=()=>({getSheetByName:()=>sheet}); ctx.dcpRows_=()=>rows.slice(); ctx.log_=()=>{};
const fake=(u,q)=>{ if(q.film==='GAGAL') throw new Error('!Kode disk tidak valid'); const id='ID'+(++n); rows.push({id,_row:rows.length+2,batchId:q.batchId,film:q.film}); return id; };
ctx.dcpSave_=fake; ctx.pelSave_=fake;
const r=[]; const check=(a,c,d)=>r.push({a,c:!!c,d:d||''});
const run=(q)=>{try{return {ok:ctx.dcpBatchSave_({},q)}}catch(e){return {err:String(e.message)}}};

let x=run({kind:'dcp',items:[{film:'A',kodeDisk:'K1'},{film:'B',kodeDisk:'K2'},{film:'C',kodeDisk:'K3'}]});
check('3 item tersimpan, batchId sama',x.ok&&x.ok.ids.length===3&&rows.length===3&&rows.every(z=>z.batchId===x.ok.batchId),JSON.stringify(x));
rows=[];
x=run({kind:'dcp',items:[{film:'A',kodeDisk:'K1'},{film:'GAGAL',kodeDisk:'K2'},{film:'C',kodeDisk:'K3'}]});
check('item ke-2 gagal: rollback total (0 baris tersisa)',x.err&&rows.length===0,JSON.stringify(x)+' rows='+rows.length);
check('pesan error menyebut nomor item',/^!Item 2 \(GAGAL\)/.test(x.err||''),x.err);
x=run({kind:'dcp',items:[{film:'A',kodeDisk:'k1'},{film:'B',kodeDisk:'K1'}]});
check('kode disk ganda dalam satu laporan ditolak sebelum menulis',x.err&&/sama dengan item 1/.test(x.err)&&rows.length===0,x.err);
check('daftar kosong ditolak',!!run({kind:'dcp',items:[]}).err);
check('lebih dari 30 item ditolak',!!run({kind:'dcp',items:Array.from({length:31},(_,i)=>({film:'F'+i,kodeDisk:'K'+i}))}).err);
rows=[]; x=run({kind:'pel',batchId:'BTEST1',items:[{film:'A',kodeDisk:'K1'},{film:'B',kodeDisk:'K2'}]});
check('kind pel + batchId dari klien dipakai',x.ok&&x.ok.batchId==='BTEST1'&&rows.length===2,JSON.stringify(x));
rows=[]; x=run({kind:'dcp',items:[{film:'A',kodeDisk:'K1'},{film:'B',kodeDisk:'K2',batchId:'PALSU',id:'DCP-1'}]});
check('batchId/id di dalam item tidak bisa menimpa batch server',x.ok&&rows.every(z=>z.batchId===x.ok.batchId),JSON.stringify(rows));
check('dcp_batch_save terdaftar & terkunci (_save)',/dcp_batch_save/.test(L('dcp.gs'))&&/_\(save\|del\)\$/.test(L('Code.gs')));
r.forEach(z=>console.log((z.c?'PASS ':'FAIL ')+z.a+(z.c?'':' -> '+z.d)));
const f=r.filter(z=>!z.c); console.log('\nHASIL: '+(r.length-f.length)+'/'+r.length+' lulus'); process.exit(f.length?1:0);
