const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('/home/claude/release/CinemaTechnicalReport_FINAL/frontend/app.js','utf8');
function fnSrc(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('missing '+name);let d=0,j=src.indexOf('{',i);for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'){d--;if(d===0)break;}}return src.slice(i,j+1);}
const store={};
const LS={get length(){return Object.keys(store).length},key:i=>Object.keys(store)[i]??null,getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
const ctx={LS,window:{},U:null,Object,JSON,console};
vm.createContext(ctx);
// load needed functions
['draftOwner','draftKey','draftPurgeGuest'].forEach(n=>vm.runInContext(fnSrc(n),ctx));
vm.runInContext('window.draftOwner=draftOwner;',ctx);
const out=[];const t=(n,c,d)=>out.push((c?'PASS ':'FAIL ')+n+(d&&!c?' :: '+d:''));
// 1. no user -> no key (no 'guest' fallback)
ctx.U=null; t('tanpa akun: kunci null', vm.runInContext('draftKey("report_work")',ctx)===null);
// 2. user A and B get different keys
ctx.U={userId:'U-A',name:'A'}; const ka=vm.runInContext('draftKey("report_work")',ctx);
ctx.U={userId:'U-B',name:'B'}; const kb=vm.runInContext('draftKey("report_work")',ctx);
t('kunci A berbeda dari B', ka!==kb, ka+' vs '+kb); t('kunci mengandung userId', ka.includes('U-A'));
// 3. legacy guest drafts purged
store['stc_draft_v1_guest_report_work']='{"x":1}'; store['stc_draft_v1_U-A_report_work']='{"keep":1}';
vm.runInContext('draftPurgeGuest()',ctx);
t('draf guest dihapus', store['stc_draft_v1_guest_report_work']===undefined);
t('draf akun A tetap', store['stc_draft_v1_U-A_report_work']==='{"keep":1}');
out.forEach(x=>console.log(x));
process.exit(out.every(x=>x.startsWith('PASS'))?0:1);
