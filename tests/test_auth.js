/* Uji keamanan login backend: case-sensitive, blokir 10x salah sampai reset Admin, idle 30 menit. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','backend','Code.gs'),'utf8');
const cache={};
const ctx={console,Logger:{log(){}},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>'secret',setProperty(){},setProperties(){}})},
 SpreadsheetApp:{openById:()=>({getSheetByName:()=>({getDataRange:()=>({getValues:()=>[]}),getLastRow:()=>0})})},
 Utilities:{formatDate:()=>'2026-11-06',getUuid:()=>'uuid-1234567890abcdef',base64Decode:()=>[],computeDigest:(a,s)=>Array.from(Buffer.from(require('crypto').createHash('sha256').update(String(s)).digest())),computeHmacSha256Signature:(m,k)=>Array.from(require('crypto').createHmac('sha256',k).update(m).digest()),DigestAlgorithm:{SHA_256:0},Charset:{UTF_8:0}},
 DriveApp:{},CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})},
 ScriptApp:{},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){},tryLock:()=>true})},ContentService:{},UrlFetchApp:{}};
vm.createContext(ctx);vm.runInContext(src,ctx);
const users=[];
ctx.all_=n=>n==='USERS'?users:[];
ctx.upd_=(n,row,o)=>{Object.assign(users.find(u=>u._row===row),o)};
ctx.log_=()=>{};ctx.Utilities.sleep=()=>{};
const salt='s1',hash=ctx.hash_('Rahasia123',salt);
users.push({_row:2,userId:'U1',fullName:'Admin',username:'Admin',role:'USER',status:'Aktif',salt,hash,mustChange:'N',failCount:'',lockedAt:''});
const r=[];const ck=(n,c)=>r.push([n,!!c]);
const tryLogin=(u,p)=>{try{return {ok:vm.runInContext('H.login',ctx)({username:u,password:p})}}catch(e){return {err:String(e.message||e)}}};
ck('username beda huruf besar/kecil ditolak',tryLogin('admin','Rahasia123').err);
ck('password beda huruf ditolak',tryLogin('Admin','rahasia123').err);
ck('login benar berhasil',tryLogin('Admin','Rahasia123').ok);
for(let i=1;i<=9;i++)tryLogin('Admin','salah'+i);
ck('9 kali salah: belum terblokir',!(Number(users[0].lockedAt)>0));
const t10=tryLogin('Admin','salah10');
ck('kali ke-10: terblokir',Number(users[0].lockedAt)>0&&/dikunci/i.test(t10.err||''));
ck('terkunci meski password benar',/dikunci/i.test(tryLogin('Admin','Rahasia123').err||''));
// reset Admin membuka blokir
const adm={role:'ADMIN',userId:'U9',fullName:'Admin2'};
vm.runInContext('H.usr_reset',ctx)(adm,{userId:'U1',password:'BaruBaru123'});
ck('reset Admin membuka blokir',!(Number(users[0].lockedAt)>0)&&Number(users[0].failCount)===0);
ck('login dengan password baru berhasil',tryLogin('Admin','BaruBaru123').ok);
// idle 30 menit
const tok=tryLogin('Admin','BaruBaru123').ok.token;
ck('sesi aktif diterima',ctx.session_(tok));
const D=vm.runInContext('Date',ctx),realNow=D.now;D.now=()=>realNow()+31*60*1000;
let idleErr='';try{ctx.session_(tok)}catch(e){idleErr=String(e.message||e)}
D.now=realNow;
ck('idle >30 menit ditolak',/tidak aktif|berakhir/i.test(idleErr));
/* kunci sementara: habis sendiri setelah 15 menit, berlaku juga untuk Admin, dan tidak mematikan sesi Admin yang sudah aktif */
users.push({_row:3,userId:'U2',fullName:'Adm',username:'Adm',role:'ADMIN',status:'Aktif',salt,hash,mustChange:'N',failCount:'',lockedAt:''});
const admTok=tryLogin('Adm','Rahasia123').ok.token;
for(let i=1;i<=10;i++)tryLogin('Adm','salah'+i);
ck('Admin ikut terkunci sementara setelah 10x salah',Number(users[1].lockedAt)>0&&/dikunci/i.test(tryLogin('Adm','Rahasia123').err||''));
ck('sesi Admin yang sudah aktif tidak ikut mati',!!ctx.session_(admTok));
users.push({_row:4,userId:'U3',fullName:'Usr',username:'Usr',role:'USER',status:'Aktif',salt,hash,mustChange:'N',failCount:'',lockedAt:''});
const tokU=tryLogin('Usr','Rahasia123').ok.token;
for(let i=1;i<=10;i++)tryLogin('Usr','salah'+i);
let lockedSess='';try{ctx.session_(tokU)}catch(e){lockedSess=String(e.message||e)}
ck('sesi akun non-Admin yang terkunci berakhir',/berakhir/i.test(lockedSess));
D.now=()=>realNow()+16*60*1000;
const after=tryLogin('Adm','Rahasia123'),afterU=tryLogin('Usr','Rahasia123');
D.now=realNow;
ck('kunci habis sendiri setelah 15 menit dan hitungan salah kembali 0',after.ok&&afterU.ok&&Number(users[1].failCount)===0&&Number(users[1].lockedAt)===0);
r.forEach(x=>console.log((x[1]?'PASS ':'FAIL ')+x[0]));
const f=r.filter(x=>!x[1]).length;console.log('HASIL: '+(r.length-f)+'/'+r.length+' lulus');process.exit(f?1:0);
