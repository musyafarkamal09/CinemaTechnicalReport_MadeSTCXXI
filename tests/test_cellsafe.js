// Uji: teks pengguna yang diawali = + - @ tab/CR diberi apostrof saat add_/upd_; angka dan teks biasa tidak berubah.
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','backend','Code.gs'),'utf8');
const writes=[];
const sheet=()=>({appendRow:r=>writes.push(['append',r]),getRange:(r,c)=>({setValue:v=>writes.push(['set',r,c,v])})});
const ctx={console,Logger:{log(){}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='SHEET_ID'?'sid':null,setProperty(){}})},
 SpreadsheetApp:{openById:()=>({getSheetByName:sheet})},
 Utilities:{formatDate:()=>'2026-10-29',getUuid:()=>'uuid-1234567890abcdef',computeDigest:()=>[],DigestAlgorithm:{SHA_256:0},Charset:{UTF_8:0},base64Decode:()=>[]},
 DriveApp:{},CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},ScriptApp:{},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},ContentService:{},UrlFetchApp:{}};
vm.createContext(ctx);vm.runInContext(src,ctx);
let fail=0;const ok=(n,c,d)=>{console.log((c?'PASS ':'FAIL ')+n+(d?' '+d:''));if(!c)fail++;};
const sf=ctx.cellSafe_;
ok('formula "=" diberi apostrof',sf('=HYPERLINK("x")')==="'=HYPERLINK(\"x\")");
ok('"+", "-", "@" diberi apostrof',sf('+1')==="'+1"&&sf('-x')==="'-x"&&sf('@a')==="'@a");
ok('tab/CR diberi apostrof',sf('\tx')==="'\tx"&&sf('\rx')==="'\rx");
ok('teks biasa tidak berubah',sf('Lagi Probation')==='Lagi Probation');
ok('angka (termasuk negatif) tidak berubah',sf(-3)===-3&&sf(23.5)===23.5);
ok('string kosong & tanggal tidak berubah',sf('')===''&&sf('2026-10-29')==='2026-10-29');
writes.length=0;ctx.add_('USERS',{fullName:'=1+1',username:'x'});
const row=writes[0][1];
ok('add_ menulis nilai aman',row.indexOf("'=1+1")>=0,JSON.stringify(row));
writes.length=0;ctx.upd_('USERS',5,{fullName:'-cmd',updatedAt:12});
ok('upd_ menulis nilai aman & angka utuh',writes.some(w=>w[3]==="'-cmd")&&writes.some(w=>w[3]===12));
console.log(fail?`\nGAGAL: ${fail}`:'\nSEMUA LULUS');process.exit(fail?1:0);
