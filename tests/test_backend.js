const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','backend','Code.gs'),'utf8');
const store={};
const stubSheet=()=>({getDataRange:()=>({getValues:()=>[]}),getLastRow:()=>0});
const ctx={
 console, Logger:{log:()=>{}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>store[k]??null,setProperty:(k,v)=>{store[k]=v},setProperties:o=>Object.assign(store,o)})},
 SpreadsheetApp:{openById:()=>({getSheetByName:stubSheet})},
 Utilities:{formatDate:(d,tz,f)=>'2026-10-29',getUuid:()=>'uuid-1234567890abcdef',base64Decode:()=>[],computeDigest:()=>[],DigestAlgorithm:{SHA_256:0},Charset:{UTF_8:0}},
 DriveApp:{}, CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 ScriptApp:{}, LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){},tryLock:()=>true})},
 ContentService:{}, UrlFetchApp:{}
};
vm.createContext(ctx);
vm.runInContext(src,ctx);
// Use the context's own functions
const r=[];
function check(name,cond,detail){r.push({name,pass:!!cond,detail:detail||''});}

// 1. acErrIn_ semantics
const e=ctx.acErrIn_;
check('acErrIn_ true', e({err:true}));
check('acErrIn_ "Ya"', e({err:'Ya'}));
check('acErrIn_ "true"', e({err:'true'}));
check('acErrIn_ false when absent', !e({}));
check('acErrIn_ false for false', !e({err:false}));

// 2. clean_ ac keeps err flag (the bug fixed)
const d1=ctx.clean_('ac',{date:'2026-10-20',time:'10:00',rows:[
 {location:'TH1',unit:'Daikin',roomTemp:'24',err:true},
 {location:'TH2',unit:'York',roomTemp:'23,2',err:false},
 {location:'LOBBY',unit:'York',cond:'EMPTY',err:true}
]});
check('clean_ ac keeps err TH1', d1.rows[0].err===true, JSON.stringify(d1.rows[0]));
check('clean_ ac err false TH2', d1.rows[1].err===false);
check('clean_ ac cond row keeps err', d1.rows[2].err===true && d1.rows[2].tempStatus==='APPROVED');
check('clean_ ac comma decimal parsed', d1.rows[1].roomTemp===23.2, String(d1.rows[1].roomTemp));
check('clean_ ac status computed TOO-WARM', d1.rows[0].tempStatus==='TOO-WARM', d1.rows[0].tempStatus);

// 3. acErrList via acRowsOf
const errList=d1.rows.filter(ctx.acErrIn_).map(a=>a.location);
check('error areas list from saved rows', JSON.stringify(errList)===JSON.stringify(['TH1','LOBBY']), JSON.stringify(errList));

// 4. acRowsOf tolerant of JSON string rows (edit-empty-table robustness)
check('acRows_ legacy single location', ctx.acRows_({location:'TH4',unit:'York',roomTemp:22}).length===1);
check('acRows_ multi-area rows', ctx.acRows_({rows:[{location:'A'},{location:'B'}]}).length===2);

// 5. acEval_ boundaries (default 23-23.5)
check('acEval 23 APPROVED', ctx.acEval_(23)==='APPROVED');
check('acEval 23.5 APPROVED', ctx.acEval_(23.5)==='APPROVED');
check('acEval 23.6 TOO-WARM', ctx.acEval_(23.6)==='TOO-WARM');
check('acEval 22.9 TOO-COLD', ctx.acEval_(22.9)==='TOO-COLD');

// 6. meterUse_ per-day split across 4-day gap
const recs=[
 {id:'a',date:'2026-10-01',time:'08:00',createdAt:1,loc:'X',lk:'x',e:{lwbp:100,wbp:0,genset:0},w:null},
 {id:'b',date:'2026-10-05',time:'08:00',createdAt:2,loc:'X',lk:'x',e:{lwbp:110,wbp:0,genset:0},w:null}
];
const ev=ctx.meterUse_(recs).filter(x=>x.m==='lwbp');
const sum=ev.reduce((a,x)=>a+x.v,0);
check('meterUse_ split sums to delta', Math.abs(sum-10)<0.0001, 'sum='+sum);
check('meterUse_ spreads across days', ev.length===4, 'days='+ev.length);

// 7. meterDiff_ no negative on reset
const dd={location:'X',date:'2026-10-06',time:'08:00',kind:'Listrik',lwbp:5,wbp:0,genset:0};
ctx.meterDiff_(dd,'c',recs);
check('meterDiff_ null on reset (no negative)', dd.diffs.lwbp===null, JSON.stringify(dd.diffs));

// 8. Notification hook wraps H.rep_save
check('H.rep_save wrapped by hook', typeof ctx.H.rep_save==='function');
// Version string
check('doGet version string matches current build (v20.0.2-penonton-bersama)', /versi: v20.0.2-penonton-bersama/.test(src));

// 9. Data Penonton (audience)
const bad=(f)=>{try{f();return null}catch(e){return String(e&&e.message||e)}};
const mk=(o)=>Object.assign({date:'2026-11-07',studios:[]},o);
const A1=ctx.clean_('audience',mk({studios:[
 {studio:'Studio 1',shows:[{show:'SHOW1',film:'Film A',jam:'12:30',tiket:'10',penonton:'8',petugas:'Budi',ket:''},{show:'SHOW2'},{show:'SHOW3',film:'Film B',tiket:'',penonton:'3'}]},
 {studio:'Studio 2',shows:[{show:'SHOW1'},{show:'SHOW2'}]},
 {studio:'Studio 5',shows:[{show:'SHOW1',film:'Film C',tiket:'4',penonton:'4'},{show:'SHOW6',film:'Film D',penonton:'1'}]}
]}));
check('audience: baris kosong dan studio kosong dilewati', A1.studios.length===2 && A1.studios[0].shows.length===2, JSON.stringify(A1.studios.map(s=>s.shows.length)));
check('audience: studio tambahan (Studio 5) dan show ke-6 diterima', A1.studios[1].studio==='Studio 5' && A1.studios[1].shows[1].show==='SHOW6');
check('audience: total dihitung server (show/tiket/penonton)', A1.totalShow===4 && A1.totalTiket===14 && A1.totalPenonton===16, [A1.totalShow,A1.totalTiket,A1.totalPenonton].join('/'));
check('audience: tiket kosong tetap string kosong, bukan 0', A1.studios[0].shows[1].tiket==='');
check('audience: tanpa show terisi ditolak', /minimal satu show/.test(bad(()=>ctx.clean_('audience',mk({studios:[{studio:'Studio 1',shows:[{show:'SHOW1'}]}]})))||''));
check('audience: nama film wajib bila baris terisi', /Nama film wajib/.test(bad(()=>ctx.clean_('audience',mk({studios:[{studio:'Studio 1',shows:[{show:'SHOW1',tiket:'5'}]}]})))||''));
check('audience: tiket negatif/desimal/teks ditolak', ['-1','2.5','abc'].every(v=>/bilangan bulat/.test(bad(()=>ctx.clean_('audience',mk({studios:[{studio:'Studio 1',shows:[{show:'SHOW1',film:'X',tiket:v}]}]})))||'')));
check('audience: jam tidak valid ditolak', /Jam show/.test(bad(()=>ctx.clean_('audience',mk({studios:[{studio:'Studio 1',shows:[{show:'SHOW1',film:'X',jam:'25:99'}]}]})))||''));
check('audience: tanggal wajib', /Tanggal/.test(bad(()=>ctx.clean_('audience',{date:'',studios:[]}))||''));
check('audience: batas studio', /Maksimal/.test(bad(()=>ctx.clean_('audience',mk({studios:Array.from({length:13},(_,i)=>({studio:'Studio '+(i+1),shows:[{film:'X'}]}))})))||''));
check('audience: batas show per studio', /Maksimal/.test(bad(()=>ctx.clean_('audience',mk({studios:[{studio:'Studio 1',shows:Array.from({length:16},()=>({film:'X'}))}]})))||''));
check('audience: studio ganda ditolak', /lebih dari satu kali/.test(bad(()=>ctx.clean_('audience',mk({studios:[{studio:'Studio 1',shows:[{film:'X'}]},{studio:'studio 1',shows:[{film:'Y'}]}]})))||''));
check('audience: judul laporan', /Data Penonton - 2026-11-07 - 4 show, 16 penonton/.test(ctx.title_('audience',A1)), ctx.title_('audience',A1));
check('audience: terdaftar di PFX/PREFIX/FOLDERS/PHS/MIR', ctx.PFX.audience&&ctx.REPORT_PREFIX.audience==='DP'&&ctx.FOLDERS.audience&&ctx.PHS.audience&&ctx.MIR.audience);
const mr=ctx.MIR.audience.row({id:'DP-1',createdAt:0,updatedAt:0,reporter:'T',status:'Aktif'},A1);
check('audience: baris sheet cocok jumlah kolom header', mr.length===ctx.MIR.audience.head.length, mr.length+' vs '+ctx.MIR.audience.head.length);
check('audience: kolom numerik/wrap MIR valid', ctx.MIR.audience.num.concat(ctx.MIR.audience.wrap).every(c=>c>=1&&c<=ctx.MIR.audience.head.length));

// akses Data Penonton: semua role melihat semua laporan; laporan jenis lain tetap dibatasi
const rows=[{id:'DP-1',type:'audience',status:'Aktif',createdAt:1,userId:'u-admin',reporter:'A',title:'',data:'{}'},
 {id:'LPR-1',type:'issue',status:'Aktif',createdAt:2,userId:'u-admin',reporter:'A',title:'',data:'{}'},
 {id:'LPR-2',type:'issue',status:'Aktif',createdAt:3,userId:'u-rep',reporter:'R',title:'',data:'{}'}];
const uRep={role:'REPORTER',userId:'u-rep'},uGs={role:'GUIDE_SECURITY',userId:'u-gs'},uTek={role:'USER',userId:'u-tek'};
check('audience: Pelapor melihat Data Penonton milik orang lain', ctx.repFilter_({type:'audience'},uRep,rows).length===1);
check('audience: Guide/Security melihat Data Penonton', ctx.repFilter_({type:'audience'},uGs,rows).length===1);
check('audience: Teknisi melihat Data Penonton', ctx.repFilter_({type:'audience'},uTek,rows).length===1);
check('issue: Pelapor tetap hanya melihat laporan sendiri', ctx.repFilter_({type:'issue'},uRep,rows).length===1&&ctx.repFilter_({type:'issue'},uRep,rows)[0].id==='LPR-2');


// 10. Data Penonton: draf, submit, batas edit 30 menit setelah submit
(function(){
 const DB=[];let seq=0,logs=[];
 ctx.all_=n=>n==='REPORTS'?DB.map((x,i)=>Object.assign({_row:i+2},x)):[];
 ctx.add_=(n,o)=>{DB.push(Object.assign({},o));};
 ctx.upd_=(n,row,o)=>{Object.assign(DB[row-2],o);};
 ctx.nextId_=()=>'DP-T-'+(++seq);
 ctx.log_=(u,a)=>logs.push(a);
 ctx.mirrorSafe_=()=>{};ctx.osSend_=()=>{};
 const U1={role:'REPORTER',userId:'u1',fullName:'Satu'},U2={role:'GUIDE_SECURITY',userId:'u2',fullName:'Dua'},AD={role:'ADMIN',userId:'ad',fullName:'Adm'};
 const sh=(n,full)=>Array.from({length:n},(_,i)=>({show:'SHOW'+(i+1),film:'F'+i,tiket:'10',penonton:full===false&&i===4?'':'9'}));
 const mkS=(n,full)=>['Studio 1','Studio 2','Studio 3','Studio 4'].map(x=>({studio:x,shows:sh(n,full)}));
 /* akses foto per peran (aksi img) */
 const PH=[{photoId:'PH-w',reportId:'R-work',fileId:'F1'},{photoId:'PH-p',reportId:'R-pat',fileId:'F2'},{photoId:'PH-a',reportId:'R-aud',fileId:'F3'},{photoId:'PH-i',reportId:'R-iss',fileId:'F4'}];
 const RP=[{id:'R-work',type:'work',userId:'u1'},{id:'R-pat',type:'patrol',userId:'u1'},{id:'R-aud',type:'audience',userId:'u1'},{id:'R-iss',type:'issue',userId:'u3'}];
 const oldAll=ctx.all_;ctx.all_=n=>n==='PHOTOS'?PH:n==='REPORTS'?RP:oldAll(n);ctx.DriveApp={getFileById:()=>({getBlob:()=>({getContentType:()=>'image/png',getBytes:()=>[1]})})};ctx.Utilities.base64Encode=()=>'AA==';
 const img=(u,id)=>{try{return !!ctx.H.img(u,{kind:'foto',id});}catch(e){return false;}};
 const GS={role:'GUIDE_SECURITY',userId:'g1'},RPT={role:'REPORTER',userId:'u3'};
 check('img: Guide/Security tidak boleh foto laporan Pekerjaan/Isu', !img(GS,'PH-w')&&!img(GS,'PH-i'));
 check('img: Guide/Security boleh foto Patroli dan Data Penonton', img(GS,'PH-p')&&img(GS,'PH-a'));
 check('img: Pelapor boleh Data Penonton dan isunya sendiri, bukan Pekerjaan/Patroli', img(RPT,'PH-a')&&img(RPT,'PH-i')&&!img(RPT,'PH-w')&&!img(RPT,'PH-p'));
 check('img: Admin boleh semua', img({role:'ADMIN',userId:'a'},'PH-w'));
 ctx.all_=oldAll;
 const call=(u,q)=>{try{return ctx.H.rep_save(u,q);}catch(e){return {err:String(e&&e.message||e)};}};
 const dat='2026-11-07';
 const a=call(U1,{type:'audience',reqId:'r1',data:{date:dat,studios:[{studio:'Studio 1',shows:sh(2)}]}});
 check('draf: simpan sebagian berhasil sebagai draf', a.id&&a.draft===true&&JSON.parse(DB[0].data).draft===true, JSON.stringify(a));
 check('draf: bisa diedit pemilik tanpa batas 30 menit', (DB[0].editDeadline=1, !call(U1,{type:'audience',id:a.id,data:{date:dat,studios:[{studio:'Studio 1',shows:sh(3)}]}}).err));
 const U3={role:'REPORTER',userId:'u3',fullName:'Tiga'};
 check('draf: out_ editable untuk pemilik dan akun non-Pelapor lain, tidak untuk Pelapor lain', ctx.out_(U1,DB[0],Date.now()+9e9).editable===true&&ctx.out_(U2,DB[0],Date.now()).editable===true&&ctx.out_(U2,DB[0],Date.now()).own===false&&ctx.out_(U3,DB[0],Date.now()).editable===false&&ctx.out_(U3,DB[0],Date.now()).draft!==undefined);
 check('draf: Pelapor lain tidak boleh edit', /milik sendiri/.test(call(U3,{type:'audience',id:a.id,data:{date:dat,studios:mkS(5)}}).err||''));
 check('draf: Guide/Security lain boleh mengisi dan mengubah draf', (()=>{const r=call(U2,{type:'audience',id:a.id,data:{date:dat,studios:[{studio:'Studio 1',shows:sh(4)}]}});return !r.err&&DB[0].userId==='u1'&&JSON.parse(DB[0].data).studios[0].shows.length===4;})());
 check('draf: simpan ditolak bila data sudah diubah orang lain sejak dibuka', /baru saja diubah/.test(call(U1,{type:'audience',id:a.id,baseAt:1,data:{date:dat,studios:[{studio:'Studio 1',shows:sh(2)}]}}).err||'')&&!call(U1,{type:'audience',id:a.id,baseAt:DB[0].updatedAt,data:{date:dat,studios:[{studio:'Studio 1',shows:sh(3)}]}}).err);
 check('draf: foto boleh diunggah akun non-Pelapor lain, bukan Pelapor lain', (()=>{const r={type:'audience',userId:'u1',status:'Aktif',editDeadline:1,data:JSON.stringify({draft:true})};try{ctx.canPhoto_(U2,r);}catch(e){return false;}try{ctx.canPhoto_(U3,r);return false;}catch(e){return true;}})());
 check('submit: ditolak bila show belum lengkap', /Belum lengkap/.test(call(U1,{type:'audience',id:a.id,submit:true,data:{date:dat,studios:mkS(5,false)}}).err||''));
 check('submit: ditolak bila hanya 4 show', /Belum lengkap/.test(call(U1,{type:'audience',id:a.id,submit:true,data:{date:dat,studios:mkS(4)}}).err||''));
 check('submit: tetap draf setelah submit gagal', JSON.parse(DB[0].data).draft===true);
 const t0=Date.now(),sb=call(U1,{type:'audience',id:a.id,submit:true,data:{date:dat,studios:mkS(5)}});
 const d0=JSON.parse(DB[0].data);
 check('submit: lengkap berhasil, draft=false, submittedAt terisi', !sb.err&&d0.draft===false&&d0.submittedAt>=t0, JSON.stringify(sb));
 check('submit: batas edit 30 menit dihitung dari submit', Math.abs(DB[0].editDeadline-(d0.submittedAt+30*60000))<5, String(DB[0].editDeadline));
 check('submit: boleh edit dalam 30 menit', !call(U1,{type:'audience',id:a.id,data:{date:dat,studios:mkS(5)}}).err);
 check('terkirim: akun lain (bukan pemilik/Admin) tidak boleh edit', /milik sendiri|Batas waktu/.test(call(U2,{type:'audience',id:a.id,data:{date:dat,studios:mkS(5)}}).err||'')&&ctx.out_(U2,DB[0],Date.now()).editable===false);
 check('submit: edit setelah submit tidak boleh jadi tidak lengkap', /Belum lengkap/.test(call(U1,{type:'audience',id:a.id,data:{date:dat,studios:mkS(3)}}).err||''));
 check('submit: tetap terkirim dan deadline tidak diperpanjang', JSON.parse(DB[0].data).draft===false&&Math.abs(DB[0].editDeadline-(d0.submittedAt+30*60000))<5);
 DB[0].editDeadline=Date.now()-1000;
 check('submit: edit ditolak setelah 30 menit', /Batas waktu edit/.test(call(U1,{type:'audience',id:a.id,data:{date:dat,studios:mkS(5)}}).err||''));
 check('submit: Admin tetap boleh edit', !call(AD,{type:'audience',id:a.id,data:{date:dat,studios:mkS(5)}}).err);
 check('Admin: out_ editable pada laporan terkirim lewat batas', ctx.out_(AD,DB[0],Date.now()).editable===true);
 check('submit: out_ tidak editable pemilik setelah batas', ctx.out_(U1,DB[0],Date.now()).editable===false);
 const b=call(U2,{type:'audience',reqId:'r2',submit:true,data:{date:dat,studios:mkS(5)}});
 check('submit langsung saat buat baru lengkap', b.id&&b.submitted===true&&JSON.parse(DB[1].data).draft===false);
 check('submit langsung buat baru tidak lengkap ditolak', /Belum lengkap/.test(call(U2,{type:'audience',reqId:'r3',submit:true,data:{date:dat,studios:mkS(2)}}).err||''));
 DB.push({id:'OLD',type:'audience',userId:'u1',reporter:'x',status:'Aktif',createdAt:1,editDeadline:Date.now()+60000,data:JSON.stringify({date:dat,studios:[]})});
 check('data lama (tanpa flag) dianggap terkirim, aturan 30 menit lama', ctx.isDraft_(DB[2])===false&&ctx.out_(U1,DB[2],Date.now()).editable===true);
 check('mirror: kolom status menampilkan Draf/Terkirim', ctx.MIR.audience.row({id:'x',createdAt:0,updatedAt:0,reporter:'a',status:'Aktif'},{draft:true,studios:[]}).slice(-1)[0]==='Draf'&&ctx.MIR.audience.row({id:'x',createdAt:0,updatedAt:0,reporter:'a',status:'Aktif'},{draft:false,studios:[]}).slice(-1)[0]==='Terkirim');
 check('draf: foto boleh diunggah pemilik setelah deadline lama lewat', (()=>{const r={type:'audience',userId:'u1',status:'Aktif',editDeadline:1,data:JSON.stringify({draft:true})};try{ctx.canPhoto_(U1,r);return true;}catch(e){return false;}})());
})();

const pass=r.filter(x=>x.pass).length;
console.log(r.map(x=>(x.pass?'PASS ':'FAIL ')+x.name+(x.detail&&!x.pass?' :: '+x.detail:'')).join('\n'));
console.log(`\nHASIL: ${pass}/${r.length} lulus`);
process.exit(pass===r.length?0:1);
