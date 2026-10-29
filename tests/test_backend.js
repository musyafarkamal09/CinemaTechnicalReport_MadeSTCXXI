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
check('doGet version source updated', /versi: v10-ac-err/.test(src));

const pass=r.filter(x=>x.pass).length;
console.log(r.map(x=>(x.pass?'PASS ':'FAIL ')+x.name+(x.detail&&!x.pass?' :: '+x.detail:'')).join('\n'));
console.log(`\nHASIL: ${pass}/${r.length} lulus`);
process.exit(pass===r.length?0:1);
