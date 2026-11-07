/* Uji logika pdfkit.js dengan jsPDF tiruan: header/logo/footer di SETIAP halaman, sanitasi karakter, blok tabel/foto. */
const fs=require('fs'),vm=require('vm');
const calls=[];let logos=0;
class Doc{constructor(o){this.o=o;this.pages=1;this.cur=1;this.internal={pageSize:{getWidth:()=>o.orientation==='landscape'?297:210,getHeight:()=>o.orientation==='landscape'?210:297}};this.lastAutoTable={finalY:50}}
 getNumberOfPages(){return this.pages} setPage(n){this.cur=n} addPage(){this.pages++;this.cur=this.pages}
 text(s){calls.push({p:this.cur,s:String(s)})} autoTable(o){this.last=o;this.lastAutoTable={finalY:(o.startY||0)+60};if(this.lastAutoTable.finalY>240){this.pages++}}
 splitTextToSize(s){return [String(s)]} addImage(){calls.push({p:this.cur,s:'IMG'})} setProperties(){}
 setFillColor(){}rect(){}setTextColor(){}setFont(){}setFontSize(){}setDrawColor(){}setLineWidth(){}line(){}}
const win={jspdf:{jsPDF:Doc},pdfLogos:()=>{logos++;return 40}};
const ctx={window:win,document:{},Intl,Date,String,Image:function(){},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../pdfkit.js','utf8'),ctx);
const N=win.NovaPDF;const r=[];const ck=(a,c,d)=>r.push([a,!!c,d||'']);
ck('clean: panah & simbol non-Latin1 diganti',N.clean('A → B ✓ 😀 é')==='A -> B v  é',JSON.stringify(N.clean('A → B ✓ 😀 é')));
const rows=Array.from({length:60},(_,i)=>['R'+i,'x','y']);
const doc=N.render({title:'Uji',id:'ID-1',user:'MK',orient:'landscape',blocks:[{t:'pairs',rows:[['a','b']]},{t:'table',title:'T1',head:['a','b','c'],rows},{t:'table',title:'T2',head:['a','b','c'],rows}]});
const pc=doc.getNumberOfPages();
ck('dokumen multi-halaman',pc>=2,String(pc));
ck('logo digambar di SETIAP halaman',logos===pc,logos+' vs '+pc);
for(let p=1;p<=pc;p++){const t=calls.filter(c=>c.p===p).map(c=>c.s).join('|');
 ck('hal '+p+': identitas MK + nomor halaman',/NOVA — An Innovation by MK/.test(t)&&/Designed & Developed by MK/.test(t)&&t.includes('Halaman '+p+' / '+pc)&&/Uji/.test(t)&&/ID-1/.test(t));}
ck('tabel dirender dengan header berulang tiap halaman',doc.last.showHead==='everyPage'&&doc.last.rowPageBreak==='avoid');
r.forEach(x=>console.log((x[1]?'PASS ':'FAIL ')+x[0]+(x[1]?'':' -> '+x[2])));const f=r.filter(x=>!x[1]);console.log('\nHASIL: '+(r.length-f.length)+'/'+r.length+' lulus');process.exit(f.length?1:0);
