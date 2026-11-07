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
check('doGet version string matches current build (v17-data-penonton)', /versi: v17-data-penonton/.test(src));

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

const pass=r.filter(x=>x.pass).length;
console.log(r.map(x=>(x.pass?'PASS ':'FAIL ')+x.name+(x.detail&&!x.pass?' :: '+x.detail:'')).join('\n'));
console.log(`\nHASIL: ${pass}/${r.length} lulus`);
process.exit(pass===r.length?0:1);
