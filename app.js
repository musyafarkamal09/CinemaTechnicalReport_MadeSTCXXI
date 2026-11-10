(function(){
'use strict';
/* potongan foto proyektor ditanam langsung agar selalu tampil (tanpa file terpisah) */
var CUT={christie:'img/cut-christie.webp',barco:'img/cut-barco.webp'};
var $=function(i){return document.getElementById(i)};
var API_URL='https://script.google.com/macros/s/AKfycbwxTDqs3z6tyCDFeUSQZpbOBIdV6w-4TXSmbYonPmGiqKo1ft_7zfjPKbteOSlsrprT/exec';
var LS=(function(){try{localStorage.setItem('_t','1');localStorage.removeItem('_t');return localStorage}catch(e){return sessionStorage}})();
var TOKEN=LS.getItem('stc_t')||sessionStorage.getItem('stc_t'),U=null,CUR='dashboard',ST={},SKEW=0,TZ='Asia/Jakarta';
var TSL={'APPROVED':['\u2713 APPROVED','ts-ok'],'TOO-WARM':['\u26A0 PANAS','ts-warm'],'TOO-COLD':['\u26A0 DINGIN','ts-cold']};
function tsb(s){var m=TSL[s];return m?'<span class="st '+m[1]+'">'+m[0]+'</span>':''}
function tsl(s){var m=TSL[s];return m?m[0]:''}
/* status suhu AC: memakai tempStatus dari server bila ada; bila tidak ada dihitung dari standar laporan (tempStd) atau default 23-23,5. Data suhu kosong/tidak valid TIDAK pernah dianggap APPROVED. */
var ACSTD={min:23,max:23.5},TSP={'APPROVED':'APPROVED','TOO-WARM':'PANAS','TOO-COLD':'DINGIN','NODATA':'DATA KOSONG'};
TSL.NODATA=['\u26A0 DATA KOSONG','ts-na'];
function acV(a){var v=a?a.roomTemp:null;if(v===''||v==null)return NaN;v=Number(String(v).replace(',','.'));return isFinite(v)?v:NaN}
var ACCND={EMPTY:'Studio kosong',NOSHOW:'Tidak ada show'};
function acCnd(a){var c=a&&a.cond;return c&&ACCND[c]?c:''}
function acSt(a,d){if(acCnd(a))return 'APPROVED';var v=acV(a);if(isNaN(v))return 'NODATA';if(a.tempStatus==='APPROVED'||a.tempStatus==='TOO-WARM'||a.tempStatus==='TOO-COLD')return a.tempStatus;var s=d&&d.tempStd,mn=s&&isFinite(Number(s.min))?Number(s.min):ACSTD.min,mx=s&&isFinite(Number(s.max))?Number(s.max):ACSTD.max;v=Math.round(v*100)/100;return v>mx?'TOO-WARM':(v<mn?'TOO-COLD':'APPROVED')}
function acAll(d){var rs=acRowsOf(d),h={};if(!rs.length)h.NODATA=1;rs.forEach(function(a){h[acSt(a,d)]=1});if(h.NODATA||h['TOO-WARM']||h['TOO-COLD'])delete h.APPROVED;return ['TOO-WARM','TOO-COLD','NODATA','APPROVED'].filter(function(k){return h[k]})}
function acBadges(d){return acAll(d).map(function(k){return k==='NODATA'?'<span class="st ts-na">\u26A0 DATA INCOMPLETE</span>':tsb(k)}).join(' ')}
function acLine(d){var rs=acRowsOf(d);return rs.length+' area'+rs.map(function(a){var v=acV(a);return ' \u2022 '+esc(a.location)+' '+(acCnd(a)?esc(ACCND[a.cond]):(isNaN(v)?'\u2013':String(v).replace('.',',')+'\u00B0C'))}).join('')}
function acTxt(d){return acAll(d).map(tsl).join(' + ')}
function acErr(a){var v=a&&a.err;return v===true||v==='true'||v===1||v==='1'||v==='Ya'}
function acErrList(d){return acRowsOf(d).filter(acErr).map(function(a){return a.location})}
function avSet(el){if(!el)return;el.textContent='';if(U&&U.photo){var i=document.createElement('img');i.alt='';el.appendChild(i);loadImg(i,'avatar',U.userId)}else el.textContent=String(U&&U.name||'?').charAt(0).toUpperCase()}
function stb(s){return '<span class="st st-'+String(s||'').replace(/[^A-Za-z0-9]+/g,'-')+'">'+esc(s)+'</span>'}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var F1=new Intl.DateTimeFormat('id-ID',{timeZone:TZ,dateStyle:'medium',timeStyle:'short'}),F2=new Intl.DateTimeFormat('id-ID',{timeZone:TZ,dateStyle:'full',timeStyle:'medium'});
function dt(ms){return ms?F1.format(new Date(Number(ms))):'-'}
var RP=new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0});
function now(){return Date.now()+SKEW}
function toast(m,e){var t=$('toast');t.textContent=m;t.className=e?'err show':'show';clearTimeout(toast.h);toast.h=setTimeout(function(){t.className=''},4500)}
function saveSess(t,u){TOKEN=t;LS.setItem('stc_t',t);if(u)LS.setItem('stc_u',JSON.stringify(u))}
function clearSess(){TOKEN=null;['stc_t','stc_u','stc_p'].forEach(function(k){LS.removeItem(k);sessionStorage.removeItem(k)})}
function normU(u){u=u&&u.user?u.user:(u||{});var o=Object.assign({},u);o.name=u.name||u.fullName||u.username||'-';o.role=u.role||'USER';o.mustChange=!!u.mustChange;delete o.token;return o}
function conn(s){$('conn').textContent=s;$('conn').className=/gagal/i.test(s)?'bad':''}
function uuid(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2)}

function api(a,p){var q=!!(p&&p.quiet),sp=a==='login',O=window.OOS;if(!q&&O)O.busy(1);if(sp&&O)O.splash(true,'Memeriksa akun Anda');
 return api0(a,p).finally(function(){if(!q&&O)O.busy(-1);if(sp&&O)O.splash(false)})}
function api0(a,p){
 p=p||{};var qt=p.quiet,qn=qt?function(){}:conn;delete p.quiet;p.action=a;p.token=TOKEN;qn('Memuat data...');
 if(navigator.onLine===false){qn('Gagal terhubung');return Promise.reject(new Error('Tidak ada koneksi internet. Periksa jaringan Anda lalu coba lagi.'))}
 var ac=window.AbortController?new AbortController():null,to=ac?setTimeout(function(){ac.abort()},a==='photo_save'||a==='rep_zip'||a==='rep_export'||a==='store_save'||a==='store_get'?120000:45000):0;
  return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(p),signal:ac?ac.signal:undefined})
 .then(function(r){clearTimeout(to);return r.json().catch(function(){qn('Gagal');throw new Error('Respons server tidak valid. Pastikan Web App Apps Script sudah di-deploy ulang (versi baru).')})},function(e){clearTimeout(to);qn('Gagal terhubung');throw new Error(e&&e.name==='AbortError'?'Koneksi terlalu lambat (waktu habis). Periksa sinyal lalu coba lagi.':'Gagal terhubung ke server. Periksa koneksi lalu coba lagi.')})
 .then(function(j){qn('Terhubung');if(j.now)SKEW=j.now-Date.now();
  if(j.ok)return j.data;
  if(TOKEN&&a!=='login'&&(j.code==='AUTH'||/sesi.*(berakhir|habis|tidak valid)|token|kedaluwarsa|expired/i.test(j.message||''))){clearSess();showLogin();$('lerr').textContent=/tidak aktif/i.test(j.message||'')?j.message:'Sesi berakhir. Silakan masuk kembali.'}
  throw new Error(j.message||'Gagal')});
}
var IMGC={},IMGQ=[],IMGB=0,IMGW=0;
function imgSrc(u){if(u&&typeof u==='object')u=u.url||u.dataUrl||u.data||(u.b64?'data:'+(u.mime||'image/jpeg')+';base64,'+u.b64:'');u=String(u||'');if(!u)return '';if(/^(data:|https?:)/i.test(u))return u;return 'data:image/jpeg;base64,'+u}
function imgPump(){while(IMGB<2&&IMGQ.length){IMGB++;imgRun(IMGQ.shift())}}
function imgRun(j){var k=j.kind+':'+j.id;
 (IMGC[k]?Promise.resolve(IMGC[k]):api('img',{kind:j.kind,id:j.id}).then(function(u){var s=imgSrc(u);if(!s)throw new Error('Data foto kosong dari server.');IMGC[k]=s;return s}))
 .then(function(s){j.img.src=s;j.img.dataset.ok='1'},function(e){
  if(j.tries<2){j.tries++;IMGQ.push(j)}else{j.img.alt='Gagal';j.img.title=e.message;j.img.style.background='#fbdde2';if(!IMGW){IMGW=1;toast('Foto gagal dimuat: '+e.message,1);setTimeout(function(){IMGW=0},6000)}}})
 .then(function(){IMGB--;imgPump()})}
function loadImg(img,kind,id){IMGQ.push({img:img,kind:kind,id:id,tries:0});imgPump()}
function fillImg(i,kind){var u=i.dataset.u;if(u){i.src=u;i.dataset.ok='1';i.onerror=function(){i.onerror=null;delete i.dataset.ok;i.removeAttribute('src');loadImg(i,kind,i.dataset.p)}}else loadImg(i,kind,i.dataset.p)}
function acGal(r){var ps=r.photos||[];if(!ps.length)return '<div id="gal"></div>';return '<div id="gal"><div class="gg gg-full"><b>Foto dokumentasi area<span>'+ps.length+'</span></b><div class="ph acg">'+ps.map(function(p){var k=esc(p.kind||'Foto');return '<figure><img loading="lazy" data-p="'+p.id+'" data-u="'+esc(p.url||'')+'" alt="Foto area '+k+'" title="Klik untuk memperbesar"><figcaption>'+k+'<small>Diunggah: '+dt(p.capturedAt||p.uploadedAt)+'</small></figcaption></figure>'}).join('')+'</div></div></div>'}
function lightbox(src){var d=document.createElement('div');d.style.cssText='position:fixed;inset:0;background:#000d;z-index:120;display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out';var i=document.createElement('img');i.style.cssText='max-width:100%;max-height:100%;border-radius:8px;background:#fff';i.src=src;d.appendChild(i);d.onclick=function(){d.remove()};document.body.appendChild(d)}

/* ---- modal ---- */
/* Formulir/detail tampil sebagai HALAMAN tersendiri (bukan overlay). #view disembunyikan sementara,
   tombol "Kembali" (#mx) dan tombol Back browser/HP (nav-back.js) menutupnya dan kembali ke halaman asal. */
function modal(h){var m=$('modal'),was=!m.classList.contains('hidden'),pc=$('pcrumb')&&$('pcrumb').textContent||'NOVA';
 if(!was){modal.sy=window.scrollY||0;modal.opener=document.activeElement}
 $('mbox').innerHTML='<button type="button" class="fp-back" id="mx" aria-label="Kembali ke halaman sebelumnya">&larr; Kembali</button>'+h;
 $('mx').onclick=closeM;m.classList.remove('hidden');document.body.classList.add('form-open');
 [].forEach.call($('mbox').querySelectorAll('form'),function(f){oosFormUX(f)});
 try{window.scrollTo(0,0);var mn=$('main');if(mn)mn.scrollTop=0}catch(e){}
 try{var mb=$('mbox');mb.setAttribute('tabindex','-1');var ff=mb.querySelector('input:not([type=hidden]):not([type=file]),select,textarea');(ff||mb).focus({preventScroll:true})}catch(e){}}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('modal').classList.contains('hidden'))closeM()});
/* BUSY: true selama laporan sedang dikirim; modal tidak boleh ditutup agar tidak terjadi kirim ganda / upload terputus */
var BUSY=false;
window.addEventListener('beforeunload',function(e){if(BUSY){e.preventDefault();e.returnValue=''}});
function hideForm(){var m=$('modal'),was=m&&!m.classList.contains('hidden');if(m)m.classList.add('hidden');var b=$('mbox');if(b)b.innerHTML='';document.body.classList.remove('form-open');try{var o=modal.opener;modal.opener=null;if(was&&o&&document.contains(o)&&o.focus)o.focus({preventScroll:true})}catch(e){}}
function closeM(){if(BUSY){toast('Laporan sedang dikirim, mohon tunggu sampai selesai.',1);return}hideForm();try{window.scrollTo(0,modal.sy||0)}catch(e){}}
/* ---- autosave draf lokal: mencegah isian laporan hilang saat modal tertutup ---- */
var DRAFT_TIMER=null;
/* Draf hanya untuk akun yang sedang login. Tanpa akun (mis. belum login) tidak ada draf yang disimpan/dipulihkan. */
function draftOwner(){return (U&&(U.userId||U.username))||null}
window.draftOwner=draftOwner;
function draftKey(name){var o=draftOwner();return o?'stc_draft_v1_'+o+'_'+name:null}
/* membuang draf lama tanpa pemilik (kunci 'guest' dari versi sebelumnya) agar tidak terlihat oleh akun mana pun */
function draftPurgeGuest(){try{var ks=[];for(var i=0;i<LS.length;i++){var k=LS.key(i);if(k&&k.indexOf('stc_draft_v1_guest_')===0)ks.push(k)}ks.forEach(function(k){LS.removeItem(k)})}catch(e){}if(window.draftPurgeGuestDb)window.draftPurgeGuestDb()}
function draftRead(key){try{return JSON.parse(LS.getItem(key)||'null')}catch(e){return null}}
function draftControls(form,restore){var els=[].slice.call(form.querySelectorAll('input,textarea,select')),seen={},out=[];els.forEach(function(el){var base=el.id?'#'+el.id:(el.tagName.toLowerCase()+'.'+String(el.className||'').trim().replace(/\s+/g,'.')+'.'+(el.type||''));var ix=seen[base]||0;seen[base]=ix+1;var key=base+'['+ix+']';if(restore){var d=restore[key];if(!d||el.type==='file'||el.type==='password')return;if(el.type==='checkbox'||el.type==='radio')el.checked=!!d.value;else if(d.value!==undefined)el.value=d.value;}else out.push([key,{type:el.type||el.tagName.toLowerCase(),value:(el.type==='checkbox'||el.type==='radio')?!!el.checked:el.value,disabled:!!el.disabled}]);});return out}
function draftSave(form){if(!form||!form.dataset.draftKey)return;try{var controls={};draftControls(form).forEach(function(x){controls[x[0]]=x[1]});LS.setItem(form.dataset.draftKey,JSON.stringify({savedAt:Date.now(),controls:controls}));var st=form.querySelector('.stc-draft-status');if(st)st.textContent='Draf tersimpan otomatis di perangkat ini';}catch(e){var st=form.querySelector('.stc-draft-status');if(st)st.textContent='Autosave tidak tersedia: penyimpanan browser penuh';}}
function draftRestore(form,key){if(!form)return;form.dataset.draftKey=key||'';if(!key)return;var d=draftRead(key);if(d&&d.controls){draftControls(form,d.controls);var st=form.querySelector('.stc-draft-status');if(st)st.textContent='Draf sebelumnya dipulihkan dari '+new Date(d.savedAt).toLocaleString('id-ID',{timeZone:TZ});}}
function draftClear(form){if(!form||!form.dataset.draftKey)return;var k=form.dataset.draftKey;try{LS.removeItem(k)}catch(e){}form.dataset.draftKey='';if(window.draftPhotosClear)window.draftPhotosClear(k)}
document.addEventListener('input',function(e){var f=e.target&&e.target.closest&&e.target.closest('form[data-draft-key]');if(!f)return;clearTimeout(DRAFT_TIMER);DRAFT_TIMER=setTimeout(function(){draftSave(f)},250)});
document.addEventListener('change',function(e){var f=e.target&&e.target.closest&&e.target.closest('form[data-draft-key]');if(f)draftSave(f)});
/* Menu Download (satu tombol -> PDF / Excel). Satu handler untuk semua halaman. */
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target:null;if(!t)return;
  var b=t.closest('[data-dlt]');
  if(b){var w=b.closest('.dlw'),m=w&&w.querySelector('.dlm');
    document.querySelectorAll('.dlm').forEach(function(x){if(x!==m)x.classList.add('hidden')});
    if(m){var open=m.classList.toggle('hidden');b.setAttribute('aria-expanded',String(!open));if(!open){m.classList.remove('up');var br=b.getBoundingClientRect(),mh=m.offsetHeight;if(innerWidth>720&&br.bottom+mh+16>innerHeight&&br.top>mh+16)m.classList.add('up')}}
    e.stopPropagation();return}
  if(t.closest('.dlm button')){document.querySelectorAll('.dlm').forEach(function(x){x.classList.add('hidden')});document.querySelectorAll('[data-dlt]').forEach(function(x){x.setAttribute('aria-expanded','false')});return}
  if(!t.closest('.dlw'))document.querySelectorAll('.dlm').forEach(function(x){x.classList.add('hidden')});
});

$('modal').onclick=function(e){if(e.target===this)closeM()};

/* ---- definisi laporan ---- */
var WC=['Electrical','Mechanical','HVAC / AC','Plumbing','Audio','Projector','Building Maintenance','Preventive Maintenance','Corrective Maintenance','Lainnya'];
var WS=['Open','In Progress','Completed','Pending','Need Follow-up'];
var ACA=['TH1','TH2','TH3','TH4','KORIDOR','LOBBY','Lainnya'],ACU=['Daikin','York'],ACD=['TH1','TH2','TH3','TH4','KORIDOR','LOBBY'];
var ISPR=['Rendah','Sedang','Tinggi','Darurat'],IST=['Menunggu','Ditanggapi','Sedang Dikerjakan','Selesai'];
var RN={ADMIN:'Admin',USER:'Teknisi',REPORTER:'Pelapor',GUIDE_SECURITY:'Guide/Security'};function rn(r){return RN[r]||r}
function acRowsOf(d){d=d||{};var rs=d.rows;if(typeof rs==='string'){try{rs=JSON.parse(rs)}catch(e){rs=null}}if(Array.isArray(rs)&&rs.length)return rs;return d.location?[{location:d.location,unit:d.unit,roomTemp:d.roomTemp,note:''}]:[]}
var T={
 work:{label:'Laporan Pekerjaan',f:[['title','Judul pekerjaan','text',1],['category','Kategori','select',1,WC],['location','Lokasi','text',1],['date','Tanggal pekerjaan','date',1],['time','Jam pekerjaan','time'],['status','Status','select',1,WS],['desc','Deskripsi','textarea'],['note','Catatan','textarea']],team:1},
 meter:{label:'Laporan Meteran',f:[['location','Lokasi meteran','text',1],['date','Tanggal pencatatan','date',1],['time','Jam pencatatan','time',1],['lwbp','Angka LWBP (kWh)','number',1,null,'Listrik'],['wbp','Angka WBP (kWh)','number',1,null,'Listrik'],['genset','Angka Genset (kWh)','number',1,null,'Listrik'],['reading','Angka meteran air (m³)','number',1,null,'Air'],['note','Catatan','textarea']]},
 ac:{label:'Daily Monitoring AC',f:[['note','Catatan umum','textarea']],rows:1},
 purchase:{label:'Laporan Pembelian Barang',f:[['date','Tanggal pembelian','date',1],['time','Jam pembelian','time'],['store','Nama toko / pemasok','text',1],['buyer','Nama pembeli','text',1],['receiver','Nama penerima barang','text'],['purpose','Keperluan','text'],['note','Catatan','textarea']],items:1},
 issue:{label:'Perlu Diperbaiki',f:[['title','Judul masalah','text',1],['location','Lokasi','text',1],['priority','Prioritas','select',1,ISPR],['desc','Uraian masalah','textarea',1]]},
 patrol:{label:'Inspeksi & Patroli Studio',f:[['date','Tanggal inspeksi','date',1],['time','Jam inspeksi','time',1],['note','Catatan umum','textarea']],studios:1},
 audience:{label:'Data Penonton',f:[['date','Tanggal','date',1],['note','Catatan','textarea']],aud:1}
};
var FS=['Upcoming ATS','ATS Open','Coming Soon','Coming to Theater','Now Showing','Completed'];
var MENU=[['dashboard','Dashboard',0],['pengumuman','Pengumuman',0],['ats','Advance Ticket Sales',0],['work','Laporan Pekerjaan',0],['patrol','Inspeksi & Patroli Studio',0],['issue','Perlu Diperbaiki',0],['meter','Laporan Meteran',0],['ac','Daily Monitoring AC',0],['purchase','Laporan Pembelian',0],['film','Laporan Film',0],['audience','Data Penonton',0],['dcp','DCP Management',1],['ftest','Daily Film Testing',0],['pel','Pelaporan DCP',0],['glosarium','Glossarium',0],['penyimpanan','Penyimpanan Data',0],['pengguna','Manajemen Pengguna',1],['audit','Audit Log',1],['pengaturan','Pengaturan Sistem',1]];

var DESC={patrol:'Pastikan seluruh studio aman, nyaman, dan siap sebelum pertunjukan.',dashboard:'Ringkasan aktivitas dan informasi terkini',pengumuman:'Informasi dan arahan terbaru untuk seluruh tim operasional outlet.',ats:'Pantau kesiapan teknis film yang telah dibuka untuk penjualan tiket awal.',work:'Dokumentasi perawatan, pemeriksaan, dan pekerjaan teknis di outlet.',issue:'Kelola temuan kerusakan, penugasan teknisi, dan tindak lanjut perbaikan.',meter:'Pencatatan dan pemantauan konsumsi listrik serta air outlet setiap hari.',ac:'Pantau suhu dan kondisi pendingin udara untuk kenyamanan seluruh studio.',purchase:'Catat pengadaan suku cadang, material, dan kebutuhan teknis outlet.',pengguna:'Kelola akun, peran, dan hak akses tim pada NOVA.',audit:'Telusuri jejak aktivitas pengguna dan perubahan data untuk keamanan serta akuntabilitas.',pengaturan:'Konfigurasi identitas outlet, preferensi operasional, dan notifikasi sistem.',film:'Rekap pertunjukan dan catatan teknis pemutaran film di setiap studio.',dcp:'Kelola paket DCP, proses ingest, dan masa berlaku KDM di seluruh studio.',ftest:'Verifikasi kualitas gambar, audio, subtitle, dan playlist sebelum film ditayangkan.',pel:'Laporkan kendala paket film, ingest, dan KDM untuk ditindaklanjuti tim distribusi.',glosarium:'Referensi istilah teknis untuk mendukung pekerjaan dan pelaporan tim STC XXI.',penyimpanan:'Arsip dokumen, dokumentasi pekerjaan, dan panduan teknis outlet dalam satu tempat.'};
/* label tombol buat laporan per jenis (sesuai Figma); ID tombol tidak berubah */
var RA_LBL={work:'Catat pekerjaan',issue:'Lapor perbaikan',meter:'Catat meteran',ac:'Catat monitoring',purchase:'Ajukan pembelian',audience:'Catat data penonton',patrol:'Mulai inspeksi'};
var IC={dashboard:'<svg class="ic" viewBox="0 0 24 24"><path d="M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z"/></svg>',pengumuman:'<svg class="ic" viewBox="0 0 24 24"><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8"/></svg>',ats:'<svg class="ic" viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/></svg>',work:'<svg class="ic" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.2-.6-.6-2.2z"/></svg>',meter:'<svg class="ic" viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',purchase:'<svg class="ic" viewBox="0 0 24 24"><path d="M6 6h15l-2 9H8zM6 6 5 3H2M9 20h.01M18 20h.01"/></svg>',pengguna:'<svg class="ic" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.9"/></svg>',audit:'<svg class="ic" viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h8"/></svg>',pengaturan:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>'};
IC.pel = '<svg class="ic" viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>';
IC.dcp = '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></svg>';
IC.ftest = '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14"/><path d="M10.5 9.5v5l3.5-2.5z"/></svg>';
Object.assign(DESC,{dcp:'Catat DCP keluar dan masuk, kelengkapan komponen, dan foto',ftest:'Pengetesan harian film: checklist PASS/FAIL, status, dan riwayat ulang'});
IC.patrol='<svg class="ic" viewBox="0 0 24 24"><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6zM8 12l2.5 2.5L16 9"/></svg>';IC.issue='<svg class="ic" viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/></svg>';
IC.today='<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>';
IC.ac='<svg class="ic" viewBox="0 0 24 24"><path d="M12 2v20M4.9 7l14.2 10M4.9 17 19.1 7M9 4l3 2 3-2M9 20l3-2 3 2"/></svg>';
IC.water='<svg class="ic" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>';
IC.film='<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>';
IC.menu='<svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
var GRP={dashboard:'Menu utama',work:'Laporan teknik',film:'Film & digital',glosarium:'Administrasi'},TB=[['dashboard','Beranda'],['work','Pekerjaan'],['meter','Meteran']],TBR=[['dashboard','Beranda'],['issue','Perbaikan'],['pengumuman','Pengumuman']],RO=['dashboard','pengumuman','ats','issue','audience','glosarium'];var GSR=['dashboard','pengumuman','ats','patrol','audience'];
function tbFor(){return U&&(U.role==='REPORTER'||U.role==='GUIDE_SECURITY')?TBR:TB}
function can(m){if(m[2])return U.role==='ADMIN';if(U.role==='REPORTER')return RO.indexOf(m[0])>=0;if(U.role==='GUIDE_SECURITY')return GSR.indexOf(m[0])>=0;return true}
/* ---- shell ---- */
function showLogin(){hideForm();ntStop();U=null;$('app').classList.add('hidden');$('login').classList.remove('hidden');$('lform').reset()}
function enter(u,page){u=normU(u);U=u;draftPurgeGuest();LS.setItem('stc_u',JSON.stringify(u));$('hname').textContent=u.name;$('hrole').textContent=rn(u.role);avSet($('av'));$('login').classList.add('hidden');$('app').classList.remove('hidden');
 if(u.mustChange){pwModal(true)}IDLE_L=0;idleMark();go(page||'dashboard');ntStart()}
var SOON_MSG='Fitur belum tersedia';
function soonOf(p){return MENU.filter(function(m){return m[0]===p&&m[3]})[0]}
function go(p){if(soonOf(p)){toast(SOON_MSG);return}if(!$('modal').classList.contains('hidden')){if(BUSY){toast('Laporan sedang dikirim, mohon tunggu sampai selesai.',1);return}hideForm()}if(!MENU.some(function(m){return m[0]===p&&can(m)}))p='dashboard';CUR=p;LS.setItem('stc_p',p);var oldFab=document.querySelector('body>#ra');if(oldFab)oldFab.remove();var adm=U.role==='ADMIN',h='';
 MENU.forEach(function(m){if(!can(m))return;if(GRP[m[0]])h+='<div class="ng">'+GRP[m[0]]+'</div>';h+='<a data-p="'+m[0]+'" class="'+(p===m[0]?'on':'')+(m[3]?' soon':'')+'"'+(m[3]?' aria-disabled="true"':'')+'><i>'+(IC[m[0]]||'')+'</i>'+m[1]+(m[3]?'<span class="sb">'+m[3]+'</span>':'')+'</a>'});
 var TBX=tbFor();var TABI=function(k,l,ic,on){return '<a data-p="'+k+'" class="'+(on?'on':'')+'" aria-label="'+l+'"><i>'+ic+'</i>'+l+'</a>'};$('tabs').innerHTML=TABI('dashboard','Beranda',IC.dashboard,p==='dashboard')+'<a data-p="search" aria-label="Cari laporan"><i>'+IC.search+'</i>Cari</a>'+NEWBTN+TABI('ats','ATS',IC.ats,p==='ats')+TABI('menu','Menu',IC.menu,p!=='dashboard'&&p!=='ats');
 $('nav').innerHTML=h;pHero(p);$('ptitle').textContent=(MENU.filter(function(m){return m[0]===p})[0]||[0,''])[1];$('psub').textContent=DESC[p]||'';var pc=$('pcrumb');if(pc)pc.textContent='NOVA / '+$('ptitle').textContent;closeMenu();var v=$('view');v.innerHTML=OOS.skel('page');
 /* modul tambahan (modul-dcp.js) dimuat terpisah; bila belum termuat, tampilkan pesan jelas, bukan layar kosong */
 function modOr_(fn,nama){
 if(typeof window[fn]==='function')return window[fn]();
 /* saat refresh, rute halaman terakhir jalan sebelum modul (modul-dcp.js, pelaporan.js) selesai dimuat: tunggu sampai halaman lengkap */
 if(document.readyState!=='complete'){$('view').innerHTML=OOS.skel('page');window.addEventListener('load',function(){modOr_(fn,nama)},{once:true});return}
 $('view').innerHTML='<div class="mdc-alert bad" role="alert"><b>Modul '+nama+' belum termuat.</b><br>Muat ulang halaman (Ctrl+F5 atau tarik ke bawah di HP). Jika tetap, pastikan berkas modul sudah diunggah ke repo.</div>'
}

 ({dashboard:vDash,pengumuman:vAnn,ats:vAts,film:vFilm,dcp:function(){modOr_('vDcp','DCP Management')},ftest:function(){modOr_('vFt','Daily Film Testing')},pel:function(){modOr_('vPel','Pelaporan DCP')},patrol:function(){vRep('patrol')},audience:function(){vRep('audience')},work:function(){vRep('work')},issue:function(){vRep('issue')},meter:function(){vRep('meter')},ac:function(){vRep('ac')},purchase:function(){vRep('purchase')},glosarium:vGloss,penyimpanan:vStore,pengguna:vUsers,audit:vAudit,pengaturan:vSet})[p]()}

/* ---- banner halaman: foto proyektor dengan potongan berbeda per halaman (hanya tampilan) ---- */
var PH={pengumuman:['christie','80% 62%','a'],ats:['christie','24% 58%','b'],work:['barco','30% 52%','a'],issue:['christie','14% 40%','w'],meter:['barco','100% 8%','g'],ac:['christie','50% 4%','a'],purchase:['barco','8% 62%','b'],pengguna:['','','a'],audit:['','','b'],pengaturan:['','','g']};
IC.glosarium='<svg class="ic" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 8h7M8 12h5"/></svg>';
IC.audience='<svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 6"/></svg>';
IC.penyimpanan='<svg class="ic" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
Object.assign(DESC,{audience:'Catat tiket terjual dan penonton masuk per show di setiap studio, lengkap dengan petugas dan keterangan.',glosarium:'Istilah teknis proyektor, suara, dan operasional bioskop',penyimpanan:'Penyimpanan berkas multi-format (dokumen, spreadsheet, gambar, data)'});
Object.assign(PH,{audience:['christie','50% 24%','b'],glosarium:['barco','60% 40%','g'],penyimpanan:['christie','40% 50%','b']});
function pHero(p){var el=$('phero');if(!el)return;if(p==='dashboard'){el.className='hidden';el.innerHTML='';return}
 var m=MENU.filter(function(x){return x[0]===p})[0]||[0,''],c=PH[p]||['','','a'],img=c[0]?'<picture class="ph-img" aria-hidden="true"><img src="'+CUT[c[0]]+'" alt="" decoding="async" style="object-position:'+c[1]+'"></picture>':'';
 el.className='ph-'+c[2]+(c[0]?'':' noph');el.innerHTML=img+'<div class="ph-t"><i>'+(IC[p]||'')+'</i><div><h1>'+esc(m[1])+'</h1><p>'+esc(DESC[p]||'')+'</p></div></div>';el.style.animation='none';void el.offsetWidth;el.style.animation=''}
function closeMenu(){$('side').classList.remove('open');$('shade').classList.remove('open')}
$('nav').onclick=function(e){var a=e.target.closest('a');if(a)go(a.dataset.p)};
function openMenu(){$('side').classList.add('open');$('shade').classList.add('open')}
/* ---- tombol "+" (buat laporan) di tengah navigasi bawah ---- */
IC.search='<svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
var NEWBTN='<a data-p="new" class="pl" role="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Buat laporan baru"><span class="pl-b" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><em>Buat</em></a>';
var NEWI={ADMIN:[['dcpk','DCP Keluar','Catat pengiriman DCP','dcp'],['dcpm','DCP Masuk','Catat pengembalian DCP','dcp'],['pelk','Pelaporan DCP Keluar','Tujuan, penerima, dokumentasi','pel'],['pelm','Pelaporan DCP Masuk','Outlet, dokumentasi','pel'],['ftest','Input Testing','Pengetesan harian film'],['work','Laporan Pekerjaan','Pekerjaan teknis harian'],['meter','Laporan Meteran','Listrik & air'],['ac','Daily Monitoring AC','Suhu & kondisi AC'],['purchase','Laporan Pembelian','Barang & jasa'],['audience','Data Penonton','Penonton per show & studio'],['issue','Perlu Diperbaiki','Lapor kerusakan'],['patrol','Inspeksi & Patroli Studio','Catat hasil patroli']],
 REPORTER:[['issue','Perlu Diperbaiki','Lapor kerusakan'],['audience','Data Penonton','Penonton per show & studio']],
 GUIDE_SECURITY:[['patrol','Inspeksi & Patroli Studio','Catat hasil patroli'],['audience','Data Penonton','Penonton per show & studio']]};
var NEWCREATE={work:'ra',meter:'ra',ac:'ra',purchase:'ra',audience:'ra',issue:'ra',patrol:'ra',ftest:'ftnew'};
var NEWDCP={dcpk:'KELUAR',dcpm:'MASUK'};
var NEWPEL={pelk:'KELUAR',pelm:'MASUK'};
function newOpen(){
 var list=(NEWI[U.role]||NEWI.ADMIN).filter(function(x){var m=MENU.filter(function(q){return q[0]===(x[3]||x[0])})[0];return m&&can(m)});
 $('nsgrid').innerHTML=list.map(function(x,i){return '<button type="button" class="nsi" style="--i:'+i+'" data-p="'+x[0]+'"><i>'+(IC[x[3]||x[0]]||'')+'</i><b>'+esc(x[1])+'</b><small>'+esc(x[2])+'</small></button>'}).join('');
 $('nsheet').classList.remove('hidden');
 var t=document.querySelector('#tabs a[data-p=new]');if(t)t.setAttribute('aria-expanded','true');
 }
function newClose(){
 $('nsheet').classList.add('hidden');
 var t=document.querySelector('#tabs a[data-p=new]');if(t)t.setAttribute('aria-expanded','false');
}
function toggleNew(){if($('nsheet').classList.contains('hidden'))newOpen();else newClose()}
function newCreate(p){
 newClose();
 if(NEWPEL[p]){ /* Pelaporan DCP: buka modul lalu formulir sesuai jenis */
  go('pel');if(window.pelOpenForm)window.pelOpenForm(NEWPEL[p]);return;
 }
 if(NEWDCP[p]){ /* DCP Keluar/Masuk: buka modul DCP lalu pilih jenis di toggle, lalu klik Input */
  go('dcp');var k=0;
  (function wait(){var r=document.querySelector('input[name=dcpjt][value='+NEWDCP[p]+']'),b=document.getElementById('dcpnew');if(r&&b){r.checked=true;b.click();return}if(++k<60)setTimeout(wait,100)})();
  return;
 }
 go(p);
 var id=NEWCREATE[p]||'ra',tries=0;
 (function wait(){var b=document.getElementById(id);if(b){b.click();return}if(++tries<50)setTimeout(wait,100)})();
}
/* ---- tombol Cari: fokus ke kolom pencarian laporan di Beranda ---- */
var dqRepOnly=false; /* true = dibuka dari tombol Cari di navigasi: hanya cari laporan, bukan kategori */
function focusDq(){var i=document.getElementById('dq');if(!i)return false;try{i.focus({preventScroll:true});i.scrollIntoView({block:'center',behavior:'smooth'})}catch(e){}return true}
function searchTab(){
 dqRepOnly=true;
 if(CUR==='dashboard'){focusDq();return}
 go('dashboard');var t=0;
 (function w(){if(focusDq()||++t>60)return;setTimeout(w,100)})();
}
$('nsgrid').onclick=function(e){var b=e.target.closest('button[data-p]');if(b)newCreate(b.dataset.p)};
$('nshade').onclick=newClose;
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('nsheet').classList.contains('hidden'))newClose()});
$('tabs').onclick=function(e){var a=e.target.closest('a');if(!a)return;if(a.dataset.p!=='new')newClose();if(a.dataset.p==='menu')openMenu();else if(a.dataset.p==='new')toggleNew();else if(a.dataset.p==='search')searchTab();else go(a.dataset.p)};$('shade').onclick=closeMenu;
$('tp').onclick=function(){var p=$('p'),s=p.type==='password';p.type=s?'text':'password';this.textContent=s?'Sembunyikan':'Tampilkan'};
/* ---- tema terang/gelap ---- */
function applyTheme(t){document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('stc_theme',t)}catch(e){}
 document.querySelectorAll('[data-thm]').forEach(function(b){b.textContent=t==='dark'?'\u2600\uFE0F':'\uD83C\uDF19';b.title=t==='dark'?'Beralih ke mode terang':'Beralih ke mode gelap'});
 var m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='dark'?'#150f2e':'#25164f'}
document.querySelectorAll('[data-thm]').forEach(function(b){b.onclick=function(){applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark')}});
applyTheme(document.documentElement.getAttribute('data-theme')||'dark');
/* ---- menu samping (hijau): tutup / buka di desktop, pilihan diingat ---- */
function applySb(off){document.body.classList.toggle('sb-off',off);var b=$('sbtn');if(b){b.title=off?'Tampilkan menu':'Sembunyikan menu';b.setAttribute('aria-label',b.title);b.setAttribute('aria-expanded',off?'false':'true')}try{LS.setItem('stc_sb',off?'1':'0')}catch(e){}}
$('sbtn').onclick=function(){applySb(!document.body.classList.contains('sb-off'))};
applySb(LS.getItem('stc_sb')==='1');
$('logout').onclick=function(){api('logout').catch(function(){});clearSess();showLogin()};
$('prof').onclick=function(){pwModal(false)};
setInterval(function(){$('clock').textContent=F2.format(new Date())+' WIB';tickCd();tickDel()},1000);
function err(x){$('view').innerHTML='<div class="empty">'+esc(x.message)+'<br><br><button class="btn" id="retry">Coba lagi</button></div>';$('retry').onclick=function(){go(CUR)}}

$('lform').onsubmit=function(e){e.preventDefault();$('lerr').textContent='';var b=$('lbtn');b.disabled=true;b.textContent='Memproses...';
 api('login',{username:$('u').value.trim(),password:$('p').value}).then(function(r){saveSess(r.token,normU(r.user));b.textContent='Berhasil';$('login').classList.add('ok');return new Promise(function(z){setTimeout(function(){z(r)},650)})}).then(function(r){$('login').classList.remove('ok');enter(r.user);var ap=$('app');ap.classList.remove('enter');void ap.offsetWidth;ap.classList.add('enter');setTimeout(function(){ap.classList.remove('enter')},700)})
 .catch(function(x){$('lerr').textContent=x.message}).then(function(){b.disabled=false;b.textContent='Masuk'})};

/* ---- pangkas foto profil (lingkaran): geser + zoom, keluaran 512x512 JPEG persegi yang ditampilkan bulat di semua avatar ---- */
var CR=null,CS=260,CM=4;
function crLoad(f){return new Promise(function(res,rej){if(!f||f.size>15e6)return rej(new Error('Ukuran foto maksimal 15 MB.'));var u=URL.createObjectURL(f),im=new Image();im.onload=function(){URL.revokeObjectURL(u);if(!im.width||!im.height)return rej(new Error('Foto tidak dapat dibaca.'));res(im)};im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.'))};im.src=u})}
function crClamp(){var w=CR.im.width*CR.sc,h=CR.im.height*CR.sc;CR.ox=Math.min(CM,Math.max(CS-CM-w,CR.ox));CR.oy=Math.min(CM,Math.max(CS-CM-h,CR.oy))}
function crInit(im){CR={im:im,base:(CS-2*CM)/Math.min(im.width,im.height),z:1};CR.sc=CR.base;CR.ox=(CS-im.width*CR.sc)/2;CR.oy=(CS-im.height*CR.sc)/2;$('crz').value=1;crClamp();crDraw()}
function crZoom(z){var cx=(CS/2-CR.ox)/CR.sc,cy=(CS/2-CR.oy)/CR.sc;CR.z=z;CR.sc=CR.base*z;CR.ox=CS/2-cx*CR.sc;CR.oy=CS/2-cy*CR.sc;crClamp();crDraw()}
function crDraw(){var c=$('crc'),x=c.getContext('2d');x.fillStyle='#111';x.fillRect(0,0,CS,CS);if(!CR)return;x.drawImage(CR.im,CR.ox,CR.oy,CR.im.width*CR.sc,CR.im.height*CR.sc);x.fillStyle='rgba(0,0,0,.55)';x.beginPath();x.rect(0,0,CS,CS);x.arc(CS/2,CS/2,CS/2-CM,0,Math.PI*2,true);x.fill('evenodd');x.strokeStyle='#fff';x.lineWidth=2;x.beginPath();x.arc(CS/2,CS/2,CS/2-CM,0,Math.PI*2);x.stroke()}
function crOut(){var o=document.createElement('canvas'),k=512/(CS-2*CM),x;o.width=o.height=512;x=o.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,512,512);x.drawImage(CR.im,(CR.ox-CM)*k,(CR.oy-CM)*k,CR.im.width*CR.sc*k,CR.im.height*CR.sc*k);return o.toDataURL('image/jpeg',.88).split(',')[1]}
function pwModal(force){
 modal('<h3>'+(force?'Ganti password awal':'Ganti password')+'</h3>'+(force?'<div class="info">Password awal harus diganti sebelum melanjutkan.</div>':'')+
 (force?'':'<div class="pfoto"><span class="av" id="pav"></span><div><label for="pph" style="margin-top:0">Foto profil (JPG/PNG/WebP)</label><input type="file" id="pph" accept="image/jpeg,image/png,image/webp"></div><button type="button" class="btn sec" id="pphb">Simpan foto</button></div><div class="crp hidden" id="crp"><canvas id="crc" width="260" height="260"></canvas><input id="crz" type="range" min="1" max="4" step="0.01" value="1" aria-label="Perbesar atau perkecil foto"><small>Geser foto untuk mengatur posisi, gunakan slider untuk memperbesar/memperkecil.</small></div><div class="merr" id="ppe"></div>')+'<form id="pf"><label>Password lama</label><input id="po" type="password" required><label>Password baru (min. 8 karakter)</label><input id="pn" type="password" minlength="8" required>'+
 '<div class="merr" id="pe"></div><div class="fact"><button class="btn">Simpan password</button>'+(force?'':'<button type="button" class="btn sec" id="pc">Batal</button>')+'</div></form>');
 if(!force)$('pc').onclick=closeM;
 if(!force){avSet($('pav'));CR=null;
  $('pph').onchange=function(){var e=$('ppe');e.textContent='';var f=this.files[0];if(!f)return;crLoad(f).then(function(im){$('crp').classList.remove('hidden');crInit(im)},function(x){CR=null;$('crp').classList.add('hidden');$('pph').value='';e.textContent=x.message})};
  $('crz').oninput=function(){if(CR)crZoom(+this.value)};
  (function(){var c=$('crc'),dr=null;c.onpointerdown=function(ev){if(!CR)return;dr={x:ev.clientX,y:ev.clientY};try{c.setPointerCapture(ev.pointerId)}catch(z){}c.style.cursor='grabbing'};
   c.onpointermove=function(ev){if(!dr||!CR)return;var k=c.width/c.getBoundingClientRect().width;CR.ox+=(ev.clientX-dr.x)*k;CR.oy+=(ev.clientY-dr.y)*k;dr={x:ev.clientX,y:ev.clientY};crClamp();crDraw()};
   c.onpointerup=c.onpointercancel=function(){dr=null;c.style.cursor='grab'}})();
  $('pphb').onclick=function(){var b=this,e=$('ppe');e.textContent='';if(!CR){e.textContent='Pilih foto terlebih dahulu.';return}
   var b64;try{b64=crOut()}catch(x){e.textContent='Foto tidak dapat diproses. Coba foto lain.';return}
   b.disabled=true;b.textContent='Menyimpan...';
   api('profile_photo_save',{b64:b64})
   .then(function(){delete IMGC['avatar:'+U.userId];U.photo=true;LS.setItem('stc_u',JSON.stringify(U));avSet($('av'));avSet($('pav'));$('pph').value='';CR=null;$('crp').classList.add('hidden');toast('Foto profil diperbarui.')})
   .catch(function(x){e.textContent=x.message})
   .then(function(){b.disabled=false;b.textContent='Simpan foto'})}}
 $('pf').onsubmit=function(e){e.preventDefault();api('changepw',{old:$('po').value,pw:$('pn').value}).then(function(r){if(r&&r.token)saveSess(r.token,U);U.mustChange=false;LS.setItem('stc_u',JSON.stringify(U));closeM();toast('Password berhasil diganti.');if(force)go(CUR)}).catch(function(x){$('pe').textContent=x.message})}}

/* ---- dashboard ---- */
function vDash(){Promise.all([api('dashboard'),api('ats_list')]).then(function(r){var d=r[0],fl=(Array.isArray(r[1])?r[1]:[]).filter(function(f){return f.status!=='Completed'}),
 hr=Number(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',hour12:false}).format(new Date()))%24,
 gr=hr<11?'Selamat pagi':hr<15?'Selamat siang':hr<18?'Selamat sore':'Selamat malam',rr=U.role==='REPORTER',
 open=Number(d.issueOpen)||0,
 qa=rr?[['issue','Laporkan masalah','Kerusakan atau kendala yang perlu ditangani'],['audience','Catat data penonton','Tiket dan penonton per show']]:[['work','Catat pekerjaan','Perawatan dan perbaikan hari ini'],['issue','Lapor perbaikan','Ada perangkat yang bermasalah'],['meter','Catat meteran','Angka listrik dan air'],['ac','Monitoring AC','Suhu ruangan harian'],['purchase','Catat pembelian','Barang dan perlengkapan']],
 tot=rr?[['Laporan saya',d.issue,'issue']]:[['Pekerjaan',d.work,'work'],['Meteran',d.meter,'meter'],['Pembelian',d.purchase,'purchase']],
 mx=Math.max.apply(null,tot.map(function(x){return Number(x[1])||0}).concat([1])),
 sum=open>0?open+' laporan perbaikan masih terbuka.':'Tidak ada laporan perbaikan yang terbuka.',
 tix=fl.length?fl.slice(0,3).map(function(f){return '<div class="tk">'+(f.posterUrl?'<img class="tk-poster" src="'+esc(f.posterUrl)+'" alt="Poster '+esc(f.title)+'" loading="lazy">':'')+'<div class="tl"><span class="pri">'+esc(f.status)+'</span><b>'+esc(f.title)+'</b><small>'+esc([f.genre,f.duration,f.rating].filter(Boolean).join(', ')||'Detail film belum diisi')+'</small><div class="tm"><div><small>Mulai ATS</small><span>'+dt(f.atsAt)+'</span></div><div><small>Mulai tayang</small><span>'+dt(f.showAt)+'</span></div></div></div><div class="tr"><div class="cdl" data-f=\''+esc(JSON.stringify({id:f.id,status:f.status,atsAt:f.atsAt,showAt:f.showAt}))+'\'></div></div></div>'}).join(''):'<div class="empty"><b>Belum ada film ATS</b>Film yang dijadwalkan Admin akan tampil di sini.</div>';
 var CAL='<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
 kpOpen='<button type="button" class="dx-k '+(open>0?'warn':'good')+'" data-go="issue"><i class="dx-ki">'+IC.issue+'</i><span class="l">Perlu diperbaiki</span><strong class="n">'+open+'</strong><small>'+(open>0?'Buka daftar dan tanggapi':'Semua sudah ditangani')+'</small></button>',
 kpTot=tot.map(function(x){return '<button type="button" class="dx-k" data-go="'+x[2]+'"><i class="dx-ki">'+IC[x[2]]+'</i><span class="l">'+(rr?'Laporan saya':'Total '+x[0].toLowerCase())+'</span><strong class="n">'+(Number(x[1])||0)+'</strong><small>Lihat semua</small></button>'}).join(''),
 acSec=rr?'':'<section class="dx-sec dac" id="dac"><div class="sh"><h2>Monitoring AC hari ini</h2><button class="lnk" data-go="ac">Buka halaman AC</button></div><div class="dac-b"><div class="sk" style="height:84px"></div></div></section>',
 chSec=rr?'':'<section class="dx-sec dchart" id="dchart"><div class="sh"><h2>Pemakaian listrik</h2><button class="lnk" data-go="meter">Lihat meteran</button></div><div class="dc-b"><div class="sk" style="height:150px"></div></div></section>',
 actSec='<section class="dx-sec"><div class="sh"><h2>Aktivitas terbaru</h2></div>'+(d.recent.length?'<div class="dx-al">'+d.recent.map(function(x){return '<button type="button" class="dx-ai" data-d="'+esc(x.id)+'"><span class="kat">'+T[x.type].label+'</span><span class="m"><b>'+esc(x.title)+'</b><small>'+esc(x.id)+' · '+esc(x.reporter)+' · '+dt(x.createdAt)+'</small></span><em aria-hidden="true">›</em></button>'}).join('')+'</div>':'<div class="empty"><b>Belum ada laporan</b>Pilih salah satu tombol di Catat cepat untuk membuat laporan pertama.</div>')+'</section>',
 atsSec='<section class="dx-sec"><div class="sh"><h2>Advanced Ticket Sales</h2><button class="lnk" data-go="ats">Lihat semua</button></div>'+tix+'</section>',
 annSec='<section class="dx-sec dx-ann"><div class="sh"><h2>Pengumuman terbaru</h2><button class="lnk" data-go="pengumuman">Lihat semua</button></div>'+(d.announcements.length?d.announcements.slice(0,3).map(annCard).join(''):'<div class="empty"><b>Belum ada pengumuman</b>Informasi dari Admin akan tampil di sini.</div>')+'</section>';
 $('view').innerHTML=SEAT_SPRITE+'<div class="dx">'+
 '<div class="dx-top"><div><small>'+new Intl.DateTimeFormat('id-ID',{timeZone:TZ,dateStyle:'full'}).format(new Date())+'</small><h1>'+gr+', '+esc(U.name)+'</h1></div><p class="dx-sum '+(open>0?'warn':'good')+'"><i aria-hidden="true"></i>'+sum+'</p></div>'+
 
 dSearch()+
 '<section class="dx-qa" aria-label="Catat cepat"><div class="dx-qg">'+qa.map(function(x){return '<button type="button" class="dx-q" data-new="'+x[0]+'" title="'+esc(x[2])+'"><i>'+IC[x[0]]+'</i><span>'+x[1]+'</span></button>'}).join('')+'</div></section>'+
 '<section class="dx-kpi" aria-label="Ringkasan"><div class="dx-k day"><i class="dx-ki">'+CAL+'</i><span class="l">Laporan hari ini</span><strong class="n">'+(Number(d.today)||0)+'</strong><small>Sejak 00.00 WIB</small></div>'+kpOpen+kpTot+'</section>'+
 acSec+
 '<div class="dx-cols"><div class="dx-col">'+atsSec+'</div><div class="dx-col">'+annSec+'</div></div>'+
 '<div class="dx-cols"><div class="dx-col">'+dStudios()+'</div><div class="dx-col">'+chSec+'</div></div>'+
 (U.role==='ADMIN'?actSec:'')+'</div>';
 document.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){go(b.dataset.go)}});
 document.querySelectorAll('[data-new]').forEach(function(b){b.onclick=function(){repForm(b.dataset.new,null,function(){go('dashboard')})}});
 document.querySelectorAll('[data-d]').forEach(function(b){b.onclick=function(){detail(b.dataset.d,function(){go('dashboard')})}});
 if(!rr){dAc();dChart()}tickCd();dExtra(d,fl)}).catch(err)}

/* ---- TAMBAHAN DASHBOARD v2: info bioskop + kursi animasi, slider Teori Management XXI, pencarian semua laporan (tidak mengubah fungsi lama) ---- */
/* Ubah jumlah kursi cukup di sini. Studio 3 dan 4 masing-masing 137 kursi. */
var STUDIOS=[['Studio 1',214],['Studio 2',154],['Studio 3',137],['Studio 4',137]],DQI=[],DQP=null,RPC={t:0,busy:null,items:[],fail:0};
/* Materi Teori Management XXI (dari file zip). Format: [judul, sub, [[judul kartu, isi],...]]. Hapus satu baris untuk menghilangkan satu slide. */
var KB=[
['Visi & Misi Cinema XXI','PT. Nusantara Sejahtera Raya Tbk',[
['Visi','Menjadi salah satu jaringan bioskop terbaik di dunia, sekaligus menjadi kebanggaan Indonesia.'],
['Misi: Uncompromised Quality','Menghadirkan kualitas terbaik.'],
['Misi: Affordable Entertainment','Menghadirkan hiburan yang terjangkau.'],
['Misi: Forever Better','Selalu lebih baik.']]]
];
var DGRP={bioskop:'Bioskop',budaya:'Visi & Misi',film:'Film ATS',info:'Pengumuman'};
function nrm(s){return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function nq(s){return nrm(s).replace(/[^a-z0-9]+/g,' ').trim()}
function dStuTotal(){return STUDIOS.reduce(function(a,s){return a+s[1]},0)}
function dStuGroups(){var g=[];STUDIOS.forEach(function(s){var l=g[g.length-1];if(l&&l.seat===s[1])l.names.push(s[0]);else g.push({names:[s[0]],seat:s[1]})});return g}
var SEAT_SPRITE='<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><symbol id="stc-seat" viewBox="0 0 24 24"><path d="M6 3h12a3 3 0 0 1 3 3v7H3V6a3 3 0 0 1 3-3z"/><rect x="2" y="12" width="20" height="7" rx="3" opacity=".82"/><rect x=".5" y="9" width="3.6" height="10.5" rx="1.8"/><rect x="19.9" y="9" width="3.6" height="10.5" rx="1.8"/><rect x="9" y="19" width="6" height="3" rx="1.2" opacity=".6"/></symbol></defs></svg>';
/* ilustrasi kursi bioskop beranimasi (gelombang cahaya emas), opsional dengan layar */
function seatArt(rows,cols,screen){var s=20,g=5,aisle=cols>8?Math.floor(cols/2):0,aw=10,W=cols*(s+g)+(aisle?aw:0),top=screen?28:2,H=top+rows*(s+g)+2,o='',r,c,x,y;
 for(r=0;r<rows;r++)for(c=0;c<cols;c++){x=c*(s+g)+(aisle&&c>=aisle?aw:0);y=top+r*(s+g);o+='<use class="s" href="#stc-seat" x="'+x+'" y="'+y+'" width="'+s+'" height="'+s+'" style="animation-delay:'+(c*.11+r*.38).toFixed(2)+'s"/>'}
 return '<svg class="seatart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Ilustrasi kursi bioskop">'+(screen?'<path class="scr" d="M4 22Q'+(W/2)+' 2 '+(W-4)+' 22" fill="none"/>':'')+o+'</svg>'}
function seatRow(n,sz,delay){var g=3,o='',c;for(c=0;c<n;c++)o+='<use class="s" href="#stc-seat" x="'+c*(sz+g)+'" y="0" width="'+sz+'" height="'+sz+'" style="animation-delay:'+(delay+c*.12).toFixed(2)+'s"/>';return '<svg class="seatrow" viewBox="0 0 '+(n*(sz+g)-g)+' '+sz+'" aria-hidden="true">'+o+'</svg>'}
function dStudios(){
 return '<section class="dx-sec dstu" id="dstu"><div class="sh"><h2>Kapasitas Kursi per Studio</h2><small class="dstu-n">Sukaramai Trade Center XXI</small></div><div class="dstu-b dstu-grid">'+
 STUDIOS.map(function(s,i){return '<article class="dstu-card" id="dstu'+i+'"><span class="dstu-icon" aria-hidden="true">▦</span><span class="nm">'+esc(s[0])+'</span><strong>'+s[1]+'</strong><small>kursi tetap</small></article>'}).join('')+
 '<div class="dstu-t"><span>Total seluruh kursi</span><strong>'+dStuTotal()+' <small>kursi · '+STUDIOS.length+' studio</small></strong></div></div></section>'}
function dKbOpen(i){var k=KB[i];if(!k)return;modal('<h3>'+esc(k[0])+'<span class="mid">Teori Management XXI</span></h3><p class="kbs">'+esc(k[1])+'</p>'+k[2].map(function(x){return '<div class="kbm"><b>'+esc(x[0])+'</b><p>'+esc(x[1])+'</p></div>'}).join(''))}
function dSearch(){return '<section class="dsx" role="search"><label class="dsr-lb" for="dq">Pencarian</label><div class="dsr-b"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="dq" type="search" autocomplete="off" spellcheck="false" placeholder="Cari laporan tertentu (nomor, judul, pelapor, lokasi)..." aria-controls="dqr" aria-expanded="false"><button type="button" id="dqc" class="dsr-x hidden" aria-label="Hapus pencarian">&times;</button><kbd aria-hidden="true">/</kbd></div><div id="dqr" class="dsr-r hidden"></div></section>'}
function dGoTo(t){if(String(t).charAt(0)==='#'){var e=document.getElementById(t.slice(1));if(e){e.scrollIntoView({behavior:'smooth',block:'center'});e.classList.add('flash');setTimeout(function(){e.classList.remove('flash')},1800)}}else go(t)}
/* ---- pencarian: halaman, studio, materi XXI + SEMUA laporan (dimuat sekali, dicari di perangkat = instan) ---- */
function dFlat(o,out){if(o==null)return;var t=typeof o;if(t==='string'||t==='number'){var s=String(o);if(s&&s.length<600)out.push(s);return}if(Array.isArray(o)){o.forEach(function(v){dFlat(v,out)});return}if(t==='object')for(var p in o){if(p==='ph'||p==='photos'||p==='photo'||p==='img'||p==='diffs')continue;dFlat(o[p],out)}}
function dRepTitle(x){var d=x.data||{};return x.title||d.title||d.location||d.store||x.id}
function dRepBuild(t,x){var L=[];dFlat(x.data,L);return {t:t,x:x,L:L,n:nq([x.id,x.reporter,x.title,T[t]?T[t].label:t,dt(x.createdAt)].concat(L).join(' '))}}
function dLoadRep(force){if(RPC.busy)return RPC.busy;if(!force&&RPC.t&&Date.now()-RPC.t<60000)return Promise.resolve();
 var rp=U.role==='REPORTER',ts=rp?['issue','audience']:U.role==='GUIDE_SECURITY'?['patrol','audience']:['work','issue','meter','ac','purchase','audience'],fail=0;
 var P=ts.map(function(t){return api(rp?'rep_list':'rep_export',{type:t,q:'',from:'',to:'',status:'',page:1,quiet:1}).then(function(r){return {t:t,items:(r&&r.items)||[]}},function(){fail++;return {t:t,items:[]}})});
 if(!rp)P.push(api('filmrep_list',{q:'',quiet:1}).then(function(l){return {t:'film',items:l||[]}},function(){fail++;return {t:'film',items:[]}}));
 RPC.busy=Promise.all(P).then(function(R){var out=[];R.forEach(function(g){g.items.forEach(function(x){if(g.t==='film'){var L=[];dFlat(x,L);out.push({t:'film',x:{id:x.id,title:x.title,reporter:'',createdAt:0,data:x},L:L,n:nq(L.join(' ')+' laporan film')})}else out.push(dRepBuild(g.t,x))})});RPC.items=out;RPC.fail=fail;RPC.t=Date.now();RPC.busy=null;if(DQP)DQP()},function(){RPC.busy=null});
 return RPC.busy}
function dBuildIndex(d,fl){var q=[];
 MENU.forEach(function(m){if(!can(m)||m[3]||soonOf(m[0]))return;q.push({g:'Halaman',t:m[1],s:DESC[m[0]]||'',k:'',a:function(){go(m[0])}})});
 STUDIOS.forEach(function(s,i){q.push({g:'Studio',t:s[0],s:s[1]+' kursi',k:'kursi seat kapasitas bioskop studio',a:function(){dGoTo('#dstu'+i)}})});
 q.push({g:'Studio',t:'Total kapasitas bioskop',s:dStuTotal()+' kursi \u00b7 '+STUDIOS.length+' studio',k:'jumlah semua kursi studio',a:function(){dGoTo('#dstu')}});
 KB.forEach(function(k,i){q.push({g:'Info XXI',t:k[0],s:k[2].map(function(x){return x[0]}).join(', '),k:k[1],a:function(){dKbOpen(i)}});k[2].forEach(function(x){q.push({g:'Info XXI',t:x[0],s:k[0]+' \u00b7 '+x[1].replace(/\s+/g,' ').slice(0,80),k:x[1],a:function(){dKbOpen(i)}})})});
 q.forEach(function(r){r.n=nq(r.t);r.h=nq(r.t+' '+r.s+' '+r.k)});return q}
function dHit(h,qs){return qs.every(function(w){return w.length<3?(' '+h).indexOf(' '+w)>=0:h.indexOf(w)>=0})}
function dMark(t,qs){var e=esc(t),n=nrm(t);if(n.length!==t.length)return e;var at=-1,L=0;qs.forEach(function(w){var p=n.indexOf(w);if(p>=0&&(at<0||p<at)){at=p;L=w.length}});return at<0?e:esc(t.slice(0,at))+'<mark>'+esc(t.slice(at,at+L))+'</mark>'+esc(t.slice(at+L))}
function dExportAll(fmt,list,q,btn){var by={},b0=btn.textContent;list.forEach(function(r){(by[r.t]=by[r.t]||[]).push(r.x)});var ts=Object.keys(by),ch=Promise.resolve();btn.disabled=true;
 ts.forEach(function(t){by[t].sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0)});ch=ch.then(function(){return exportXls(t,fmt,{items:by[t],FT:'Pencarian: '+q,btn:btn})})});
 ch.catch(function(e){toast(e.message,1)}).then(function(){btn.disabled=false;btn.textContent=b0})}
function dSearchInit(){var inp=$('dq'),box=$('dqr'),clr=$('dqc');if(!inp||!box)return;var cat='all',lim=40,rows=[],cur=-1,qs=[],qv='',rpl=[];
 function close(){box.classList.add('hidden');inp.setAttribute('aria-expanded','false');dqRepOnly=false}
 function snip(r){var w=qs.filter(function(x){return x.length>1}),meta=nq([r.x.id,r.x.reporter,dRepTitle(r.x)].join(' '));if(!w.length)return '';for(var j=0;j<r.L.length;j++){var a=nq(r.L[j]);if(w.some(function(x){return a.indexOf(x)>=0})&&!w.every(function(x){return meta.indexOf(x)>=0})){var s=r.L[j];return s.length>90?s.slice(0,87)+'...':s}}return ''}
 function paint(){if(!document.body.contains(inp))return;clr.classList.toggle('hidden',!inp.value);qv=nq(inp.value);qs=qv?qv.split(' '):[];var st=RPC.busy?'Memuat data laporan...':(RPC.t&&RPC.fail?RPC.fail+' kategori gagal dimuat':'');
  if(!qs.length){box.innerHTML='';box.classList.add('hidden');inp.setAttribute('aria-expanded','false');rows=[];cur=-1;return}
  var rep=dqRepOnly,A=[],Rr=[],cn={Laporan:0,Halaman:0,Studio:0,'Info XXI':0};
  if(!rep)DQI.forEach(function(r){if(dHit(r.h,qs)){A.push({c:r.g,r:r,sc:r.n.indexOf(qv)===0?0:1});cn[r.g]++}});A.sort(function(a,b){return a.sc-b.sc});
  RPC.items.forEach(function(r){if(dHit(r.n,qs))Rr.push(r)});cn.Laporan=Rr.length;Rr.sort(function(a,b){return (b.x.createdAt||0)-(a.x.createdAt||0)});
  var ex=U.role!=='REPORTER'?Rr.filter(function(r){return r.t!=='film'}):[];
  var list=cat==='all'?A.slice(0,6).map(function(a){return {k:'a',r:a.r}}).concat(Rr.map(function(r){return {k:'r',r:r}})):cat==='Laporan'?Rr.map(function(r){return {k:'r',r:r}}):A.filter(function(a){return a.c===cat}).map(function(a){return {k:'a',r:a.r}});
  var total=list.length;rows=list.slice(0,lim);cur=rows.length?0:-1;
  var chips=[['all','Semua',A.slice(0,6).length+Rr.length]].concat(rep?[]:['Laporan','Halaman','Studio','Info XXI'].map(function(c){return [c,c,cn[c]]})).filter(function(c){return c[0]==='all'||c[2]>0});
  var h='<div class="dsr-h"><span class="dsr-s">'+(Rr.length?'<b>'+Rr.length+'</b> laporan cocok':'Hasil pencarian')+(st?' \u00b7 '+esc(st):'')+'</span>'+(ex.length?'<span class="dsr-ex"><div class="dlw"><button type="button" class="btn sec" data-dlt aria-haspopup="menu" aria-expanded="false">Download ('+ex.length+')</button><div class="dlm hidden" role="menu"><button type="button" role="menuitem" data-ex="xlsx">Excel (.xlsx)</button><button type="button" role="menuitem" data-ex="pdf">PDF (.pdf)</button></div></div></span>':'')+'</div>'+
  '<div class="dsr-tabs">'+chips.map(function(c){return '<button type="button" data-c="'+c[0]+'" class="'+(c[0]===cat?'on':'')+'">'+c[1]+' <em>'+c[2]+'</em></button>'}).join('')+'</div>';
  h+=rows.length?'<div class="dsr-list" role="listbox">'+rows.map(function(w,i){var r=w.r;if(w.k==='a')return '<div class="dsr-i'+(i===0?' on':'')+'" role="option" data-i="'+i+'"><span class="g">'+esc(r.g)+'</span><div><b>'+dMark(r.t,qs)+'</b>'+(r.s?'<small>'+esc(r.s)+'</small>':'')+'</div></div>';
   var x=r.x,lb=r.t==='film'?'Laporan Film':(T[r.t]?T[r.t].label.replace(/^Laporan /,''):r.t),sn=snip(r);
   return '<div class="dsr-i rp'+(i===0?' on':'')+'" role="option" data-i="'+i+'"><span class="g">'+esc(lb)+'</span><div><b>'+dMark(String(dRepTitle(x)),qs)+'</b><small>'+(r.t==='film'?esc([x.data.status,x.data.format,x.data.reportDate].filter(Boolean).join(' \u00b7 ')):esc(x.id)+' \u00b7 '+dMark(String(x.reporter||'-'),qs)+' \u00b7 '+dt(x.createdAt))+'</small>'+(sn?'<small class="mt">Cocok: '+dMark(sn,qs)+'</small>':'')+'</div></div>'}).join('')+'</div>'+(total>lim?'<button type="button" class="dsr-more" data-more="1">Tampilkan '+Math.min(40,total-lim)+' lagi (sisa '+(total-lim)+')</button>':''):'<div class="dsr-e">'+(RPC.busy?'Memuat data laporan...':'Tidak ada hasil untuk \u201c'+esc(inp.value.trim())+'\u201d')+'</div>';
  box.innerHTML=h;box.classList.remove('hidden');inp.setAttribute('aria-expanded','true');box.dataset.exl=ex.length;box._ex=ex}
 DQP=paint;
 function pick(i){var w=rows[i];if(!w)return;var r=w.r;if(w.k==='a'){close();inp.value='';clr.classList.add('hidden');box.innerHTML='';r.a()}else{close();if(r.t==='film')go('film');else detail(r.x.id,function(){go('dashboard')})}}
 function mv(k){var it=box.querySelectorAll('.dsr-i');if(!it.length)return;cur=(cur+k+it.length)%it.length;it.forEach(function(e,j){e.classList.toggle('on',j===cur)});it[cur].scrollIntoView({block:'nearest'})}
 inp.addEventListener('input',function(){cat='all';lim=40;paint()});
 inp.addEventListener('focus',function(){dLoadRep();paint()});
 inp.addEventListener('keydown',function(e){if(e.key==='ArrowDown'){e.preventDefault();mv(1)}else if(e.key==='ArrowUp'){e.preventDefault();mv(-1)}else if(e.key==='Enter'){e.preventDefault();if(cur>=0)pick(cur)}else if(e.key==='Escape'){if(inp.value){inp.value='';paint()}close()}});
 clr.addEventListener('click',function(){inp.value='';cat='all';paint();inp.focus()});
 box.addEventListener('mousedown',function(e){e.preventDefault()});
 box.addEventListener('click',function(e){var t=e.target,b;if((b=t.closest('[data-ex]'))){dExportAll(b.dataset.ex,box._ex||[],inp.value.trim(),b);return}if((b=t.closest('[data-c]'))){cat=b.dataset.c;lim=40;paint();return}if(t.closest('[data-more]')){lim+=40;paint();return}var it=t.closest('.dsr-i');if(it)pick(Number(it.dataset.i))});
 document.addEventListener('mousedown',function f(e){if(!document.body.contains(inp)){document.removeEventListener('mousedown',f);return}if(!e.target.closest('.dsx'))close()})}
function dExtra(d,fl){try{DQI=dBuildIndex(d,fl);dSearchInit();dLoadRep();
 if(!window.__dqk){window.__dqk=1;document.addEventListener('keydown',function(e){var t=e.target,tag=t&&t.tagName;if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT'&&!(t&&t.isContentEditable)){var q=$('dq');if(q){e.preventDefault();q.focus()}}})}
 }catch(x){if(window.console)console.warn('Tambahan dashboard gagal:',x)}}

/* ---- status Daily Monitoring AC hari ini di dashboard: per area, sudah/belum diisi + suhu + status ---- */
function dAc(){var el=$('dac');if(!el)return;var td=jkd(0),box=el.querySelector('.dac-b');
 return api('rep_list',{type:'ac',q:'',from:td,to:td,status:'',page:1,quiet:1}).then(function(r){
  var it=((r&&r.items)||[]).slice().sort(function(a,b){return(+b.createdAt||0)-(+a.createdAt||0)}),got={};
  it.forEach(function(x){acRowsOf(x.data).forEach(function(a){var k=String(a.location||'').trim().toUpperCase();if(k&&!got[k])got[k]={a:a,d:x.data}})});
  var n=0,bad=0,chips=ACD.map(function(z){var g=got[z];
   if(!g)return '<button class="dac-c na" data-go="ac"><b>'+z+'</b><span>Belum diisi</span></button>';
   var cd=acCnd(g.a),v=acV(g.a),st=acSt(g.a,g.d);if(cd||!isNaN(v))n++;var cls=st==='APPROVED'?'ok':st==='NODATA'?'na2':st==='TOO-COLD'?'cold':'bad';if(st==='TOO-WARM'||st==='TOO-COLD')bad++;
   return '<button class="dac-c '+cls+(acErr(g.a)?' err':'')+'" data-go="ac"><b>'+z+'</b><span class="dac-t'+(cd?' dac-cn':'')+'">'+(cd?esc(ACCND[g.a.cond]):(isNaN(v)?'\u2013':String(v).replace('.',',')+'\u00B0C'))+'</span><small>'+(tsl(st)||'')+'</small></button>'}).join('');
  var EL=ACD.filter(function(z){return got[z]&&acErr(got[z].a)});var ms=n===ACD.length?(bad?bad+' area di luar standar suhu.':'Semua area sudah diisi.'):n+' dari '+ACD.length+' area sudah diisi hari ini.';
  box.innerHTML=(EL.length?'<div class="dac-alert" role="alert">&#9888; AC error di '+EL.length+' area: <b>'+EL.join(', ')+'</b></div>':'')+'<div class="dac-s">'+ms+(n<ACD.length?' <button class="lnk" data-new="ac">Isi sekarang</button>':'')+'</div><div class="dac-g">'+chips+'</div>';if(window.acTrendHtml)box.insertAdjacentHTML('beforeend',window.acTrendHtml(it));
  box.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){go(b.dataset.go)}});
  box.querySelectorAll('[data-new]').forEach(function(b){b.onclick=function(){repForm('ac',null,function(){go('dashboard')})}})
 }).catch(function(){if(el.parentNode)el.remove()})}

/* ---- grafik ringkas listrik di dashboard (data dari meter_stats yang sama dengan halaman Meteran) ---- */
function dChart(){mAll('','day').then(function(r){var el=$('dchart');if(!el)return;
 var s=r&&r.series?r.series.map(addL).slice(-30):[];if(s.length<2){el.remove();return}
 var W=720,H=170,PX=6,PY=14,mx=Math.max.apply(null,s.map(function(x){return x.listrik||0}).concat([1])),tot=0,
 pt=s.map(function(x,i){tot+=x.listrik||0;return [PX+i*(W-2*PX)/(s.length-1),H-PY-((x.listrik||0)/mx)*(H-2*PY)]}),
 ln='M'+pt.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1)}).join(' L'),ar=ln+' L'+pt[pt.length-1][0].toFixed(1)+' '+H+' L'+pt[0][0].toFixed(1)+' '+H+' Z',lp=pt[pt.length-1];
 el.querySelector('.dc-b').innerHTML='<div class="dc-k"><b>'+nf(tot)+' kWh</b><small>total '+s.length+' hari terakhir ('+tl(s[0].k,'day')+' - '+tl(s[s.length-1].k,'day')+'), puncak '+nf(mx)+' kWh/hari</small></div>'+
 '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="Grafik pemakaian listrik harian"><defs><linearGradient id="dcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8913f" stop-opacity=".38"/><stop offset="1" stop-color="#b8913f" stop-opacity="0"/></linearGradient></defs><path d="'+ar+'" fill="url(#dcg)"/><path class="ln" pathLength="1" d="'+ln+'"/></svg>'}).catch(function(){var e=$('dchart');if(e)e.remove()})}
function dxPic(){return '<div class="dx-img" aria-hidden="true"><img src="img/christie-cut.webp?v=2" data-fb="christie" alt="" width="1240" height="968" decoding="async"><span class="lens-glow"></span><span class="lens-flare"></span></div>'}
function heroPic(){return '<div class="dh-img" aria-hidden="true"><img src="img/christie-cut.webp?v=2" data-fb="christie" alt="" width="1240" height="968" decoding="async"><span class="lens-glow"></span><span class="lens-flare"></span></div>'}
document.addEventListener('error',function(e){var t=e.target;if(t&&t.dataset&&t.dataset.fb&&CUT[t.dataset.fb]){var k=t.dataset.fb;t.removeAttribute('data-fb');t.src=CUT[k]}},true);
function annCard(a){return '<div class="card ann ann-'+esc(a.priority)+'" style="margin-bottom:10px"><b>'+esc(a.title)+'</b> <span class="pri '+esc(a.priority)+'">'+esc(a.priority)+'</span>'+(a.status!=='Aktif'?' <span class="pri">Diarsipkan</span>':'')+'<div style="white-space:pre-wrap;margin:6px 0">'+esc(a.body)+'</div><small>'+dt(a.publishedAt)+' · '+esc(a.createdBy)+'</small></div>'}

/* ---- pengumuman ---- */
function vAnn(){api('ann_list').then(function(l){var adm=U.role==='ADMIN';
 $('view').innerHTML='<h2>Pengumuman</h2>'+(adm?'<p><button class="btn" id="aa">Buat pengumuman</button></p>':'')+(l.length?l.map(function(a){return annCard(a)+(adm?'<p style="margin:-4px 0 12px"><button class="btn sec" data-e="'+a.id+'">Edit</button> <button class="btn sec" data-x="'+a.id+'">'+(a.status==='Aktif'?'Arsipkan':'Aktifkan')+'</button></p>':'')}).join(''):'<div class="empty"><b>Belum ada pengumuman</b>Admin dapat menambahkan pengumuman lewat tombol di atas.</div>');
 if(!adm)return;$('aa').onclick=function(){annForm()};
 document.querySelectorAll('[data-e]').forEach(function(b){b.onclick=function(){annForm(l.filter(function(a){return a.id===b.dataset.e})[0])}});
 document.querySelectorAll('[data-x]').forEach(function(b){b.onclick=function(){api('ann_del',{id:b.dataset.x}).then(vAnn).catch(function(x){toast(x.message,1)})}})}).catch(err)}
function annForm(a){a=a||{};modal('<h3>'+(a.id?'Edit':'Tambah')+' pengumuman</h3><form id="af"><label>Judul *</label><input id="at" required value="'+esc(a.title)+'"><label>Isi *</label><textarea id="ab" rows="5" required>'+esc(a.body)+'</textarea><label>Prioritas</label><select id="ap">'+['Informasi','Penting','Mendesak'].map(function(o){return '<option'+(o===a.priority?' selected':'')+'>'+o+'</option>'}).join('')+'</select><div class="merr" id="ae"></div><div class="fact"><button class="btn">Simpan pengumuman</button><button type="button" class="btn sec" id="ac">Batal</button></div></form>');
 $('ac').onclick=closeM;$('af').onsubmit=function(e){e.preventDefault();api('ann_save',{id:a.id,title:$('at').value,body:$('ab').value,priority:$('ap').value}).then(function(){closeM();toast('Pengumuman disimpan.');vAnn()}).catch(function(x){$('ae').textContent=x.message})}}

/* ---- laporan data film di server ---- */
var FILM_STATUS=['SEDANG TAYANG','SUDAH TAYANG','BELUM TAYANG'],FILM_FORMAT=['2D','3D','ATMOS','3D-ATMOS','2D-ATMOS'];
function filmStatusNorm(v){var s=String(v||'').trim().toUpperCase().replace(/[ _-]+/g,' ');if(['SEDANG TAYANG','SEDANG MAIN','NOW SHOWING','TAYANG'].includes(s))return 'SEDANG TAYANG';if(['SUDAH TAYANG','SELESAI TAYANG','ENDED','FINISHED'].includes(s))return 'SUDAH TAYANG';if(['BELUM TAYANG','AKAN TAYANG','COMING SOON','UPCOMING'].includes(s))return 'BELUM TAYANG';return s||'STATUS BELUM DIKENALI'}
function filmSort(l){var o={'SEDANG TAYANG':0,'SUDAH TAYANG':1,'BELUM TAYANG':2};return l.slice().map(function(f){return Object.assign({},f,{status:filmStatusNorm(f.status)})}).sort(function(a,b){return (o[a.status]??9)-(o[b.status]??9)||String(a.title||'').localeCompare(String(b.title||''),'id',{sensitivity:'base'})})}
function vFilm(){api('filmrep_list',{q:($('filmq')||{}).value||''}).then(function(l){l=filmSort(l);var adm=U.role==='ADMIN',imp=U.role!=='REPORTER'; /* impor Excel/PDF: semua pengguna (kecuali Pelapor); tambah/edit/hapus tetap Admin */
 $('view').innerHTML='<div class="sh"><div><h2>Laporan Data Film di Server</h2><p class="muted">Data tersimpan di database website dan digunakan langsung untuk ekspor.</p></div>'+((imp||adm)?'<div class="film-actions">'+(imp?'<button class="btn sec" id="frimport">⇧ Impor Excel/PDF</button>':'')+(adm?'<button class="btn sec" id="frbulk">＋ Input Banyak Film</button><button class="btn" id="frnew">＋ Tambah Film</button>':'')+'</div>':'')+'</div><div class="bar filmbar"><input id="filmq" placeholder="Cari judul, status, format, KDM, outlet..." value="'+esc(($('filmq')||{}).value||'')+'"><input id="frdate" type="date" aria-label="Tanggal laporan"><input id="froutlet" placeholder="Nama outlet" value="SUKARAMAI TRADE CENTER XXI"><label class="btn sec" for="frsigfile" style="display:inline-flex;align-items:center;cursor:pointer">Unggah TTD Pembuat</label><input id="frsigfile" type="file" accept="image/png,image/jpeg,image/webp" style="display:none"><button class="btn sec" id="frpdf">Ekspor PDF</button><button class="btn sec" id="frxlsx">Ekspor Excel</button></div>'+
 (l.length?'<div class="film-groups">'+FILM_STATUS.map(function(status){var group=l.filter(function(f){return filmStatusNorm(f.status)===status});if(!group.length)return '';var cls=status==='BELUM TAYANG'?'belum':status==='SEDANG TAYANG'?'sedang':'sudah';return '<section class="film-group fg-'+cls+'"><div class="film-group-head"><span class="film-status fs-'+status.toLowerCase().replace(/ /g,'-')+'">'+esc(status)+'</span><b>'+group.length+' film</b></div><div class="scroll cards"><table class="rt film-table"><thead><tr><th>No.</th><th>Judul Film</th><th>Status</th><th>Format</th><th>KDM</th><th>Tanggal</th><th>Outlet</th><th>Pembuat / TTD</th>'+(adm?'<th>Aksi</th>':'')+'</tr></thead><tbody>'+group.map(function(f,i){return '<tr><td data-l="No">'+(i+1)+'</td><td class="sm" data-l="Judul Film"><b>'+esc(f.title)+'</b></td><td data-l="Status"><span class="film-status fs-'+f.status.toLowerCase().replace(/ /g,'-')+'">'+esc(f.status)+'</span></td><td data-l="Format">'+esc(f.format)+'</td><td data-l="KDM">'+esc(f.kdm||'TIDAK ADA')+'</td><td data-l="Tanggal">'+esc(f.reportDate)+'</td><td data-l="Outlet">'+esc(f.outlet)+'</td><td data-l="Pembuat / TTD">'+esc(f.createdBy||'-')+(f.signature?'<br><img loading="lazy" alt="Tanda tangan" src="'+esc(f.signature)+'" style="max-width:100px;max-height:34px;object-fit:contain">':'')+'</td>'+(adm?'<td class="act"><button class="btn sec" data-fedit="'+f.id+'">Edit</button><button class="btn sec" data-fdel="'+f.id+'">Hapus</button></td>':'')+'</tr>'}).join('')+'</tbody></table></div></section>'}).join('')+'</div>':'<div class="empty"><b>Belum ada data film</b>Tambahkan data untuk mulai membuat laporan.</div>')+
 '<div class="film-capacity"><b>NOTE — Sisa kapasitas penyimpanan server</b><p>Kapasitas ditambahkan pada data laporan dan dicantumkan di ekspor jika tersedia.</p></div>';
 var q=$('filmq');q.oninput=function(){var pos=this.selectionStart;vFilm();var nq=$('filmq');nq.focus();nq.setSelectionRange(pos,pos)};
 if(imp)$('frimport').onclick=filmImportForm;
 if(adm){$('frnew').onclick=function(){filmFormReport(null)};$('frbulk').onclick=filmBulkForm;document.querySelectorAll('[data-fedit]').forEach(function(b){b.onclick=function(){filmFormReport(l.filter(function(x){return x.id===b.dataset.fedit})[0])}});document.querySelectorAll('[data-fdel]').forEach(function(b){b.onclick=function(){if(confirm('Hapus data film ini?'))api('filmrep_del',{id:b.dataset.fdel}).then(vFilm).catch(function(e){toast(e.message,1)})}})}
 window._filmExportSignature=window._filmExportSignature||'';var sigInput=$('frsigfile');if(sigInput)sigInput.onchange=function(){var file=this.files&&this.files[0];if(!file)return;if(file.size>1000000){toast('Gambar tanda tangan maksimal 1 MB.',1);this.value='';return}var reader=new FileReader();reader.onload=function(){window._filmExportSignature=reader.result;toast('Tanda tangan pembuat siap digunakan pada ekspor PDF.')};reader.readAsDataURL(file)};
 $('frpdf').onclick=function(){filmExport(l,'pdf',$('froutlet').value,$('frdate').value)};$('frxlsx').onclick=function(){filmExport(l,'xlsx',$('froutlet').value,$('frdate').value)};
 }).catch(err)}
function filmFormReport(f){f=f||{};modal('<h3>'+(f.id?'Edit':'Tambah')+' data film</h3><form id="filmrf"><label>Judul film *</label><input id="filmrt" required maxlength="200" value="'+esc(f.title)+'"><div class="row2"><div><label>Status *</label><select id="filmrs">'+FILM_STATUS.map(function(x){return '<option'+(x===f.status?' selected':'')+'>'+x+'</option>'}).join('')+'</select></div><div><label>Format *</label><select id="filmrfmt">'+FILM_FORMAT.map(function(x){return '<option'+(x===(f.format||'2D')?' selected':'')+'>'+x+'</option>'}).join('')+'</select></div><div><label>KDM / periode / keterangan</label><input id="film-rkdm" placeholder="07-10-2026 s/d 09-11-2026 / HABIS / TIDAK ADA" value="'+esc(f.kdm)+'"></div><div><label>Tanggal laporan *</label><input id="filmrd" type="date" required value="'+esc(f.reportDate||new Date(now()+7*3600000).toISOString().slice(0,10))+'"></div><div class="full"><label>Nama outlet *</label><input id="filmro" required value="'+esc(f.outlet||'SUKARAMAI TRADE CENTER XXI')+'"></div><div class="full"><label>Nama pembuat laporan *</label><input id="filmcreator" required value="'+esc(f.createdBy||U.name)+'"></div><div class="full"><label>Tanda tangan pembuat (gambar, opsional)</label><input id="filmsigfile" type="file" accept="image/png,image/jpeg,image/webp"><div class="ph" id="filmsigpreview">'+(f.signature?'<img alt="Tanda tangan tersimpan" style="max-width:240px;max-height:90px" src="'+esc(f.signature)+'">':'')+'</div><small class="muted">Tanda tangan disimpan bersama laporan dan digunakan pada ekspor PDF jika browser mengizinkan pemuatan gambar.</small></div><div class="full"><label>NOTE — Sisa kapasitas penyimpanan server (opsional)</label><textarea id="filmrc" rows="3" placeholder="AAM LIBRARY : 9239 GB    33%&#10;STD 1 IMS 3000 : 10736 GB    80%&#10;STD 2 IMS 3000 : 10736 GB    84%&#10;STD 3 IMS 3000 : 10736 GB    74%&#10;STD 4 IMS 3000 : 10736 GB    75%">'+esc(f.capacity)+'</textarea></div></div><div class="merr" id="filmre"></div><div class="fact"><button class="btn">Simpan</button><button type="button" class="btn sec" id="filmrcancel">Batal</button></div></form>');
 var filmDraftForm=$('filmrf');if(!f.id){draftRestore(filmDraftForm,draftKey('film_single'));var filmDraftNote=document.createElement('div');filmDraftNote.className='info stc-draft-status';filmDraftNote.textContent='Autosave aktif untuk data teks. Tanda tangan berupa file perlu dipilih kembali jika jendela ditutup.';filmDraftForm.insertBefore(filmDraftNote,filmDraftForm.firstChild)}$('filmrcancel').onclick=closeM;var sigData=f.signature||'';$('filmsigfile').onchange=function(){var file=this.files&&this.files[0];if(!file)return;if(file.size>1000000){$('filmre').textContent='Tanda tangan maksimal 1 MB.';this.value='';return}var rd=new FileReader();rd.onload=function(){sigData=rd.result;$('filmsigpreview').innerHTML='<img alt="Pratinjau tanda tangan" style="max-width:240px;max-height:90px" src="'+sigData+'">'};rd.readAsDataURL(file)};$('filmrf').onsubmit=function(e){e.preventDefault();api('filmrep_save',{id:f.id,title:$('filmrt').value,status:$('filmrs').value,format:$('filmrfmt').value,kdm:$('film-rkdm').value,reportDate:$('filmrd').value,outlet:$('filmro').value,createdBy:$('filmcreator').value,signature:sigData,capacity:$('filmrc').value}).then(function(){draftClear(filmDraftForm);closeM();toast('Data film tersimpan.');vFilm()}).catch(function(x){$('filmre').textContent=x.message})}}
function filmBulkForm(){
 var today=new Date(now()+7*3600000).toISOString().slice(0,10);
 modal('<h3>Input banyak film</h3><p class="muted">Tempel daftar film apa adanya, satu film per baris. Urutan status boleh acak: sistem mendeteksi status yang tertulis pada setiap baris, lalu otomatis mengelompokkan hasilnya menjadi SEDANG TAYANG, SUDAH TAYANG, dan BELUM TAYANG. Format yang didukung: <b>Judul | Status | Format | KDM</b> atau teks baris yang mengandung status.</p><form id="film-bulk-form"><label>Daftar film *</label><textarea id="film-bulk-lines" rows="9" required placeholder="Film A | SEDANG TAYANG | 2D | TIDAK ADA&#10;Film B | BELUM TAYANG | 3D | 07-10-2026 s/d 09-11-2026&#10;Film C"></textarea><div class="row2"><div><label>Status default</label><select id="film-bulk-status">'+FILM_STATUS.map(function(x){return '<option>'+x+'</option>'}).join('')+'</select></div><div><label>Format default</label><select id="film-bulk-format">'+FILM_FORMAT.map(function(x){return '<option>'+x+'</option>'}).join('')+'</select></div><div><label>Tanggal laporan</label><input id="film-bulk-date" type="date" required value="'+today+'"></div><div><label>Nama outlet</label><input id="film-bulk-outlet" required value="SUKARAMAI TRADE CENTER XXI"></div><div class="full"><label>NOTE — Sisa kapasitas penyimpanan server (dipakai untuk semua baris)</label><textarea id="film-bulk-capacity" rows="2" placeholder="Opsional"></textarea></div></div><p class="muted">Data dikirim satu per satu ke backend lama agar tidak memerlukan perubahan API. Jangan tutup jendela sampai proses selesai.</p><div class="merr" id="film-bulk-error"></div><div class="fact"><button class="btn" id="film-bulk-save">Simpan semua film</button><button type="button" class="btn sec" id="film-bulk-cancel">Batal</button></div></form>');
 var bulkDraftForm=$('film-bulk-form');draftRestore(bulkDraftForm,draftKey('film_bulk'));var bulkDraftNote=document.createElement('div');bulkDraftNote.className='info stc-draft-status';bulkDraftNote.textContent='Autosave aktif: daftar film dan pengaturan disimpan otomatis di perangkat ini.';bulkDraftForm.insertBefore(bulkDraftNote,bulkDraftForm.firstChild);$('film-bulk-cancel').onclick=closeM;
 $('film-bulk-form').onsubmit=function(e){e.preventDefault();var lines=$('film-bulk-lines').value.split(/\r?\n/).map(function(x){return x.trim()}).filter(Boolean),statusDefault=$('film-bulk-status').value,formatDefault=$('film-bulk-format').value,date=$('film-bulk-date').value,outlet=$('film-bulk-outlet').value.trim(),capacity=$('film-bulk-capacity').value,records=[];
 for(var i=0;i<lines.length;i++){var raw=lines[i].trim(),c=raw.split('|').map(function(x){return x.trim()}),status='',format='',title=c[0],kdm='TIDAK ADA';if(!title)continue;
  // Deteksi status di kolom mana pun agar urutan input bebas; juga dukung salin-tempel teks tabular.
  var statusIndex=-1,formatIndex=-1;for(var j=0;j<c.length;j++){var v=c[j].toUpperCase().replace(/\s+/g,' ').trim();if(FILM_STATUS.indexOf(v)>=0){status=v;statusIndex=j}if(FILM_FORMAT.indexOf(v)>=0){format=v;formatIndex=j}}
  if(!status){var up=raw.toUpperCase();for(var z=0;z<FILM_STATUS.length;z++)if(up.indexOf(FILM_STATUS[z])>=0){status=FILM_STATUS[z];break}}
  if(!format){var upf=raw.toUpperCase();for(var zf=0;zf<FILM_FORMAT.length;zf++)if(upf.indexOf(FILM_FORMAT[zf])>=0){format=FILM_FORMAT[zf];break}}
  if(statusIndex===0){title=c.filter(function(v,j){return j!==statusIndex&&j!==formatIndex}).slice(0,1).join(' ').trim()||title}else{title=c[0]}
  status=status||statusDefault;format=format||formatDefault;
  if(FILM_STATUS.indexOf(status)<0||FILM_FORMAT.indexOf(format)<0){$('film-bulk-error').textContent='Baris '+(i+1)+': status atau format tidak dikenal. Periksa ejaan/status dan format.';return}
  if(c.length>3)kdm=c.slice(3).filter(function(v,j){return j!==statusIndex&&j!==formatIndex}).join(' | ')||'TIDAK ADA';records.push({title:title,status:status,format:format,kdm:kdm,reportDate:date,outlet:outlet,capacity:capacity})}
 if(!records.length){$('film-bulk-error').textContent='Masukkan minimal satu judul film.';return}
 var btn=$('film-bulk-save');btn.disabled=true;btn.textContent='Menyimpan 0/'+records.length+'…';var done=0;
 records.reduce(function(chain,r){return chain.then(function(){btn.textContent='Menyimpan '+done+'/'+records.length+'…';return api('filmrep_save',r).then(function(){done++})})},Promise.resolve()).then(function(){draftClear(bulkDraftForm);closeM();toast(done+' data film berhasil disimpan.');vFilm()}).catch(function(err){btn.disabled=false;btn.textContent='Simpan ulang';$('film-bulk-error').textContent='Berhasil menyimpan '+done+' dari '+records.length+' film. Gagal: '+(err.message||err)+'. Data yang sudah tersimpan tidak dibatalkan; periksa daftar sebelum mencoba ulang.';vFilm()})
 }
}
function filmExport(l,kind,outlet,date,_sigReady){
 if(kind==='pdf'&&!_sigReady&&(l||[]).some(function(f){return f.signature&&/^https?:/i.test(f.signature)})){var cp=(l||[]).map(function(f){return Object.assign({},f)});Promise.all(cp.map(function(f){return new Promise(function(resolve){if(!f.signature||!/^https?:/i.test(f.signature)){resolve();return}var im=new Image();im.crossOrigin='anonymous';im.onload=function(){try{var c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);f.signature=c.toDataURL('image/png')}catch(e){}resolve()};im.onerror=resolve;im.src=f.signature})})).then(function(){filmExport(cp,kind,outlet,date,true)});return}
 var statusOrder={'SEDANG TAYANG':0,'SEDANG MAIN':0,'SUDAH TAYANG':1,'BELUM TAYANG':2};
 l=(l||[]).slice().sort(function(a,b){var sa=String(a.status||'').toUpperCase(),sb=String(b.status||'').toUpperCase();return (statusOrder[sa]??9)-(statusOrder[sb]??9)||String(a.title||'').localeCompare(String(b.title||''),'id',{sensitivity:'base'})});
 var repDate=date||((l[0]&&l[0].reportDate)||new Date(now()+7*3600000).toISOString().slice(0,10));
 if(/^\d{4}-\d{2}-\d{2}$/.test(repDate)){var dt=repDate.split('-');repDate=dt[2]+' '+['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'][Number(dt[1])-1]+' '+dt[0]}
 var out=outlet||((l[0]&&l[0].outlet)||'SUKARAMAI TRADE CENTER XXI'),cap=l.map(function(x){return x.capacity}).filter(Boolean).slice(-1)[0]||'';
 if(kind==='xlsx'){
  var rows=[['Format Laporan Data Film di Server'],['Nama Outlet            : '+out],['Periode                : '+repDate],[],['No','Judul Film','Keterangan (Belum/Sedang/Sudah)','Format Film','KDM (ada/tidak)']];
  l.forEach(function(f,i){rows.push([i+1,f.title,String(f.status||'').toUpperCase()==='SEDANG MAIN'?'SEDANG TAYANG':f.status,f.format,f.kdm||'TIDAK ADA'])});
  rows.push([],['NOTE :'],['SISA KAPASITAS PENYIMPANAN SERVER']);if(cap)cap.split(/\r?\n/).forEach(function(x){rows.push([x])});
  rows.push([],['Yang Membuat,','','','','Mengetahui,'],[],[],[(l[0]&&l[0].createdBy)||U.name,'','','','FERRY FERNANDO'],['TECHNICAL','','','','CINEMA MANAGER'],[],['KETERANGAN :'],['FONT HITAM ( FILM BELUM TAYANG )'],['FONT HIJAU ( FILM SEDANG TAYANG)'],['FONT MERAH ( FILM SUDAH TAYANG )']);
  var ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:6},{wch:32},{wch:27},{wch:14},{wch:36}];ws['!pageSetup']={orientation:'portrait',paperSize:9,fitToWidth:1,fitToHeight:1};ws['!margins']={left:.35,right:.35,top:.35,bottom:.35,header:.15,footer:.15};
  var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Laporan Film');XLSX.writeFile(wb,uniq_('Laporan_Film_STCXXI_'+repDate.replace(/\s+/g,'_')+'.xlsx'));return
 }
var doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 var BLK=[0,0,0],GRN=[0,176,80],RED=[255,0,0],ORG=[255,153,0],X0=14,CW=[10,66,40,24,42],CX=[X0],PB=272,LH=3.5,PADY=1.5,HL=[['No'],['Judul Film'],['Keterangan','( Belum/Sedang/Sudah )'],['Format Film','2D/3D-ATMOS'],['KDM ( ada/tidak)']];
 CW.forEach(function(w,i){CX.push(CX[i]+w)});var TW=CX[5]-X0;
 function cell(i,top,h){doc.setDrawColor(0,0,0);doc.setLineWidth(.3);doc.rect(CX[i],top,CW[i],h)}
 function ctext(lines,i,top,h){var n=lines.length,y0=top+(h-n*LH)/2+LH*.78;lines.forEach(function(t,k){doc.text(String(t),CX[i]+CW[i]/2,y0+k*LH,{align:'center'})})}
 doc.setTextColor(0,0,0);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('Format Laporan Data Film di Server',X0,16);
 doc.text('Nama Outlet',X0,22);doc.text(': '+out,X0+36,22);doc.text('Periode',X0,28);doc.text(': '+repDate,X0+36,28);
 var y=34;
 function drawHead(){var h=10;doc.setFillColor(ORG[0],ORG[1],ORG[2]);doc.rect(X0,y,TW,h,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8);HL.forEach(function(t,i){cell(i,y,h);ctext(t,i,y,h)});y+=h}
 drawHead();
 doc.setFontSize(8);
 l.forEach(function(f,i){
  var status=filmStatusNorm(f.status),color=status==='SEDANG TAYANG'?GRN:status==='SUDAH TAYANG'?RED:BLK;
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);
  var tl=doc.splitTextToSize(String(f.title||'').toUpperCase(),CW[1]-5),kl=doc.splitTextToSize(String(f.kdm||'TIDAK ADA').toUpperCase(),CW[4]-5),
   sl=doc.splitTextToSize(status,CW[2]-4),fl=[String(f.format||'2D').toUpperCase()],
   rh=Math.max(tl.length,kl.length,sl.length)*LH+PADY*2;
  if(y+rh>PB){doc.addPage('a4','portrait');y=16;drawHead();doc.setFont('helvetica','normal');doc.setFontSize(7.5)}
  doc.setTextColor(color[0],color[1],color[2]);
  [[String(i+1)],tl,sl,fl,kl].forEach(function(t,k){cell(k,y,rh);ctext(t,k,y,rh)});
  y+=rh;
 });
 doc.setTextColor(0,0,0);doc.setFont('helvetica','normal');
 // Dua kolom informasi profesional: NOTE kapasitas di kiri, KETERANGAN status film di kanan.
 y+=7;
 var noteLeft=X0,noteW=88,infoLeft=116,infoW=80;
 if(y>PB-55){doc.addPage('a4','portrait');y=18;}
 var noteTop=y;
 doc.setDrawColor(205,205,205);doc.setLineWidth(.25);doc.line(noteLeft,noteTop-3,196,noteTop-3);
 doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(0,0,0);
 doc.text('NOTE',noteLeft,noteTop);
 doc.setFontSize(7.5);doc.text('SISA KAPASITAS PENYIMPANAN SERVER',noteLeft,noteTop+5);
 doc.setFont('helvetica','normal');doc.setFontSize(8);
 var capText=cap||'Belum diisi';
 // Render kapasitas sebagai baris tabel mini: nama server | kapasitas | persentase.
 // Mendukung input contoh: "AAM LIBRARY : 9239 GB    33%".
 var capRows=String(capText).split(/\r?\n/).map(function(line){
  line=String(line||'').trim();if(!line)return null;
  var m=line.match(/^(.+?)\s*:\s*(.*?)\s+(\d{1,3}\s*%)\s*$/);
  if(m)return {name:m[1].trim(),capacity:m[2].trim(),percent:m[3].replace(/\s+/g,'')};
  m=line.match(/^(.+?)\s{2,}(.+?)\s{2,}(\d{1,3}\s*%)\s*$/);
  if(m)return {name:m[1].trim().replace(/\s*:\s*$/,''),capacity:m[2].trim(),percent:m[3].replace(/\s+/g,'')};
  return {raw:line};
 });
 var noteY=noteTop+10, rowH=4.4, nameW=43, capacityW=22, percentW=13;
 doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(0,0,0);
 capRows.forEach(function(r){
  if(!r)return;
  if(r.raw){var wrapped=doc.splitTextToSize(r.raw,noteW);doc.text(wrapped,noteLeft,noteY);noteY+=Math.max(1,wrapped.length)*rowH;return;}
  var names=doc.splitTextToSize(r.name,nameW), capacities=doc.splitTextToSize(r.capacity,capacityW);
  var lines=Math.max(names.length,capacities.length,1);
  doc.text(names,noteLeft,noteY);
  doc.text(capacities,noteLeft+nameW+1,noteY);
  doc.text(r.percent,noteLeft+nameW+capacityW+3,noteY);
  noteY+=lines*rowH;
 });
 doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(0,0,0);
 doc.text('KETERANGAN',infoLeft,noteTop);
 doc.setFont('helvetica','normal');doc.setFontSize(7.7);
 doc.setTextColor(0,0,0);doc.text(doc.splitTextToSize('FONT HITAM ( FILM BELUM TAYANG )',infoW),infoLeft,noteTop+6);
 doc.setTextColor(GRN[0],GRN[1],GRN[2]);doc.text(doc.splitTextToSize('FONT HIJAU ( FILM SEDANG TAYANG )',infoW),infoLeft,noteTop+12);
 doc.setTextColor(RED[0],RED[1],RED[2]);doc.text(doc.splitTextToSize('FONT MERAH ( FILM SUDAH TAYANG )',infoW),infoLeft,noteTop+18);
 doc.setTextColor(0,0,0);
 var noteBlockH=Math.max(25,noteY-noteTop+2);
 y=noteTop+noteBlockH+8;
 if(y>PB-35){doc.addPage('a4','portrait');y=18;}
 doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text('Yang Membuat,',20,y);doc.text('Mengetahui,',145,y);
 var maker=(l[0]&&l[0].createdBy)||U.name,sig=(l[0]&&l[0].signature)||'';
 if(window._filmExportSignature){sig=window._filmExportSignature;}
 if(sig&&/^data:image\/(png|jpeg|webp);base64,/i.test(sig)){try{var fmt=/^data:image\/png/i.test(sig)?'PNG':/^data:image\/webp/i.test(sig)?'WEBP':'JPEG';doc.addImage(sig,fmt,20,y+3,42,15)}catch(se){}}
 doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(maker,20,y+25);doc.text('FERRY FERNANDO',145,y+25);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text('TECHNICAL',20,y+30);doc.text('CINEMA MANAGER',145,y+30);
 doc.save(uniq_('Laporan_Film_STCXXI_'+repDate.replace(/\s+/g,'_')+'.pdf'))
}

/* ---- Impor dan rapikan laporan film dari Excel/PDF ---- */
function filmImportForm(){
 modal('<h3>Impor & rapikan laporan film</h3><p class="muted">Unggah Excel (.xlsx/.xls) atau PDF laporan. Sistem akan membaca data, mempertahankan status dan KDM per film, lalu mengurutkan SEDANG TAYANG → SUDAH TAYANG → BELUM TAYANG. Periksa pratinjau sebelum ekspor atau menyimpan ke database.</p><form id="film-import-form"><label>File laporan *</label><input id="film-import-file" type="file" accept=".xlsx,.xls,.pdf" required><div class="row2"><div><label>Tanggal laporan</label><input id="film-import-date" type="date" required value="'+new Date(now()+7*3600000).toISOString().slice(0,10)+'"></div><div><label>Nama outlet</label><input id="film-import-outlet" value="SUKARAMAI TRADE CENTER XXI" required></div><div class="full"><label>NOTE — Sisa kapasitas penyimpanan server (opsional)</label><textarea id="film-import-capacity" rows="2" placeholder="AAM LIBRARY: 9239 GB 41%"></textarea></div></div><div class="fact"><button class="btn" type="submit" id="film-import-read">Baca & pratinjau</button><button class="btn sec" type="button" id="film-import-cancel">Batal</button></div><div class="merr" id="film-import-error"></div><div id="film-import-preview"></div></form>');
 $('film-import-cancel').onclick=closeM;
 $('film-import-form').onsubmit=function(e){e.preventDefault();var file=$('film-import-file').files[0];if(!file)return;var btn=$('film-import-read'),err=$('film-import-error');btn.disabled=true;btn.textContent='Membaca file…';err.textContent='';
 filmReadFile(file).then(function(rows){var parsed=filmParseRows(rows);if(!parsed.length)throw Error('Tidak ada baris film yang dikenali. Pastikan file berisi kolom judul, status, format, dan/atau KDM. PDF hasil scan memerlukan OCR terlebih dahulu.');filmShowImportPreview(parsed)}).catch(function(x){err.textContent=x.message||String(x)}).finally(function(){btn.disabled=false;btn.textContent='Baca & pratinjau'})};
}
function filmReadFile(file){
 return new Promise(function(resolve,reject){
  var ext=(file.name.split('.').pop()||'').toLowerCase(),reader=new FileReader();
  reader.onerror=function(){reject(Error('File tidak dapat dibaca.'))};
  reader.onload=function(){
   try{
    if(ext==='xlsx'||ext==='xls'){
     if(typeof XLSX==='undefined')throw Error('Library Excel belum termuat.');
     var wb=XLSX.read(reader.result,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];
     resolve(XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false}));return;
    }
    if(ext==='pdf'){
     if(!window.pdfjsLib)throw Error('Library pembaca PDF belum termuat. Muat ulang halaman dan coba lagi.');
     window.pdfjsLib.getDocument({data:new Uint8Array(reader.result)}).promise.then(function(pdf){
      var jobs=[];
      for(var i=1;i<=pdf.numPages;i++)jobs.push(pdf.getPage(i).then(function(pg){
       return pg.getTextContent().then(function(content){
        var lines={};
        content.items.forEach(function(it){var y=Math.round(it.transform[5]);if(!lines[y])lines[y]=[];lines[y].push({x:it.transform[4],t:it.str})});
        return Object.keys(lines).sort(function(a,b){return Number(b)-Number(a)}).map(function(y){
         return lines[y].sort(function(a,b){return a.x-b.x}).map(function(v){return v.t}).join(' ').trim();
        }).filter(Boolean);
       });
      }));
      Promise.all(jobs).then(function(pages){resolve([].concat.apply([],pages).map(function(line){return [line]}))}).catch(reject);
     }).catch(reject);return;
    }
    throw Error('Format file tidak didukung. Gunakan Excel .xlsx/.xls atau PDF.');
   }catch(e){reject(e)}
  };
  reader.readAsArrayBuffer(file);
 });
}
function filmParseRows(rows){var out=[],header=null;function norm(v){return String(v==null?'':v).trim()}function statusOf(t){t=norm(t).toUpperCase();if(/SEDANG\s+MAIN/.test(t))return 'SEDANG TAYANG';return FILM_STATUS.find(function(s){return t.indexOf(s)>=0})||''}function fmtOf(t){t=norm(t).toUpperCase().replace(/\s+/g,'');return FILM_FORMAT.find(function(f){return t===f||t.indexOf(f)>=0})||''}function kdmOf(t){t=norm(t);if(/TIDAK\s+ADA/i.test(t))return 'TIDAK ADA';if(/\bHABIS\b/i.test(t))return 'HABIS';var m=t.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}\s*(?:s\s*\/\s*d|s\/d|s\.d\.)\s*\d{1,2}[-/]\d{1,2}[-/]\d{4}/i);return m?m[0].replace(/\s+/g,' '):''}
 rows.forEach(function(row){var cells=Array.isArray(row)?row.map(norm):[norm(row)];var line=cells.join(' ').replace(/\s+/g,' ').trim();if(!line)return;var up=line.toUpperCase();if(/JUDUL FILM|KETERANGAN \(BELUM|FORMAT FILM|KDM \(ADA|NAMA OUTLET|FORMAT LAPORAN|SISA KAPASITAS|KETERANGAN :|YANG MEMBUAT|MENGETAHUI|MUSYAFAR KAMAL|FERRY FERNANDO|TECHNICAL|CINEMA MANAGER/.test(up))return;
 var status=statusOf(line);if(!status){ // PDF sometimes status text is separated across cells, or row contains a leading number
 return}
 var format='';cells.forEach(function(c){if(!format)format=fmtOf(c)});if(!format)format=fmtOf(line)||'2D';var kdm=kdmOf(line);if(!kdm&&/TIDAK\s+ADA/i.test(line))kdm='TIDAK ADA';
 var title='';if(cells.length>1){title=cells.filter(function(c){return c&&!statusOf(c)&&!fmtOf(c)&&!kdmOf(c)&&!/^(\d+|NO\.?|JUDUL FILM)$/i.test(c)}).join(' ').trim()}if(!title){title=line.replace(/^\d+\s*/, '').replace(new RegExp(status,'i'),' ').replace(new RegExp(format.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),' ').replace(/\d{1,2}[-/]\d{1,2}[-/]\d{4}\s*(?:s\s*\/\s*d|s\/d)\s*\d{1,2}[-/]\d{1,2}[-/]\d{4}/i,' ').replace(/\b(TIDAK\s+ADA|HABIS)\b/i,' ').replace(/\s+/g,' ').trim()}
 title=title.replace(/^[-|:\s]+|[-|:\s]+$/g,'').trim();if(!title||title.length<2||FILM_STATUS.indexOf(title.toUpperCase())>=0)return;out.push({title:title,status:status,format:format,kdm:kdm||'TIDAK ADA'})});
 var seen={};return out.filter(function(x){var k=(x.title+'|'+x.status+'|'+x.format+'|'+x.kdm).toUpperCase();if(seen[k])return false;seen[k]=1;return true})}
function filmShowImportPreview(records){records=filmSort(records);var date=$('film-import-date').value,outlet=$('film-import-outlet').value.trim(),capacity=$('film-import-capacity').value;window._filmImportRecords=records.map(function(r){return Object.assign({},r,{reportDate:date,outlet:outlet,capacity:capacity})});var counts={};FILM_STATUS.forEach(function(s){counts[s]=records.filter(function(r){return r.status===s}).length});$('film-import-preview').innerHTML='<div class="film-import-summary"><b>Pratinjau: '+records.length+' film</b><p>'+FILM_STATUS.map(function(s){return esc(s)+': '+counts[s]}).join(' · ')+'</p><p class="muted">Periksa judul, status, format, dan KDM. Hasil belum disimpan ke database.</p></div><div class="scroll"><table class="rt"><thead><tr><th>No.</th><th>Judul</th><th>Status</th><th>Format</th><th>KDM</th></tr></thead><tbody>'+records.map(function(r,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(r.title)+'</td><td>'+esc(r.status)+'</td><td>'+esc(r.format)+'</td><td>'+esc(r.kdm)+'</td></tr>'}).join('')+'</tbody></table></div><label class="checkline"><input id="film-import-save-db" type="checkbox"> Simpan juga seluruh data ini ke database website</label><div class="fact"><button type="button" class="btn sec" id="film-import-xlsx">Unduh Excel terstruktur</button><button type="button" class="btn sec" id="film-import-pdf">Unduh PDF terstruktur</button><button type="button" class="btn" id="film-import-finish">Selesai</button></div><div class="merr" id="film-import-save-error"></div>';
 $('film-import-xlsx').onclick=function(){filmExport(window._filmImportRecords,'xlsx',outlet,date)};$('film-import-pdf').onclick=function(){filmExport(window._filmImportRecords,'pdf',outlet,date)};$('film-import-finish').onclick=closeM;
 $('film-import-save-db').onchange=function(){if(!this.checked)return;if(!confirm('Simpan '+window._filmImportRecords.length+' film ke database? Periksa data dan duplikasi terlebih dahulu.')){this.checked=false;return}var cb=this,err=$('film-import-save-error');cb.disabled=true;var done=0;window._filmImportRecords.reduce(function(chain,r){return chain.then(function(){return api('filmrep_save',r).then(function(){done++})})},Promise.resolve()).then(function(){err.textContent='Berhasil menyimpan '+done+' film.';toast(done+' film tersimpan ke database.');vFilm()}).catch(function(e){err.textContent='Tersimpan '+done+' dari '+window._filmImportRecords.length+'. Gagal: '+(e.message||e)+'. Periksa data sebelum mengulang agar tidak duplikat.';cb.disabled=false})}
}

/* ---- ATS ---- */
function cdInfo(f){var n=now();if(f.status==='Completed'||f.status==='Now Showing')return null;
 if(f.atsAt&&n<f.atsAt&&f.status!=='ATS Open')return ['Tiket mulai dijual dalam',f.atsAt];
 if(f.showAt&&n<f.showAt)return ['Film tayang dalam',f.showAt];return null}
function p2(n){return String(n).padStart(2,'0')}
/* ATS_GONE: id film yang countdown-nya sudah habis; dipertahankan selama sesi agar tidak muncul lagi saat data dimuat ulang */
var ATS_GONE={};
function tickCd(){document.querySelectorAll('.cdl').forEach(function(e){var f=JSON.parse(e.dataset.f),i=cdInfo(f);
 if(!i&&f.showAt&&now()>=f.showAt&&f.status!=='Completed'&&f.status!=='Now Showing'){ATS_GONE[f.id]=1;var c=e.closest('.film,.tk');if(c)c.remove();if(CUR==='ats'&&c&&c.classList.contains('film')&&!document.querySelector('#view .film')){vAts()}return}
 if(!i){e.textContent=(f.atsAt||f.showAt)?'Waktu target tercapai. Status diperbarui Admin.':'Jadwal belum tersedia';return}
 var s=Math.max(0,Math.floor((i[1]-now())/1000));e.innerHTML='<small>'+i[0]+'</small><div class="cd"><span><b>'+p2(Math.floor(s/86400))+'</b>hari</span><span><b>'+p2(Math.floor(s%86400/3600))+'</b>jam</span><span><b>'+p2(Math.floor(s%3600/60))+'</b>menit</span><span><b>'+p2(s%60)+'</b>detik</span></div>'})}
function tickDel(){document.querySelectorAll('.cdx').forEach(function(e){var s=Math.floor((Number(e.dataset.t)-now())/1000);
 if(s<=0){e.innerHTML='<b>Countdown habis. Menghapus data ATS...</b>';if(CUR==='ats'&&!tickDel.rl){tickDel.rl=1;setTimeout(function(){tickDel.rl=0;if(CUR==='ats')vAts()},3000)}return}
 e.innerHTML='<small>Dihapus permanen otomatis dalam</small><div class="cd'+(s<86400?' warn':'')+'"><span><b>'+p2(Math.floor(s/86400))+'</b>hari</span><span><b>'+p2(Math.floor(s%86400/3600))+'</b>jam</span><span><b>'+p2(Math.floor(s%3600/60))+'</b>menit</span><span><b>'+p2(s%60)+'</b>detik</span></div>'})}
function jk(ms){return ms?new Date(ms+7*3600000).toISOString().slice(0,16):''}
function vAts(){api('ats_list').then(function(l){var adm=U.role==='ADMIN';l=l.filter(function(f){return !ATS_GONE[f.id]});
 $('view').innerHTML='<h2>Advanced Ticket Sales</h2><div class="info">Informasi bukan jadwal resmi sampai dikonfirmasi Admin.</div>'+(adm?'<p><button class="btn" id="fa">Tambah jadwal ATS</button></p>':'')+
 (l.length?'<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,370px),1fr))">'+l.map(function(f){return '<div class="card film">'+(f.poster?'<img data-p="'+esc(f.poster)+'" data-u="'+esc(f.posterUrl||'')+'" alt="poster">':'<div class="noimg"></div>')+
 '<div><b>'+esc(f.title)+'</b><br><small>'+esc([f.genre,f.duration,f.rating].filter(Boolean).join(' · '))+'</small><br><span class="pri">'+esc(f.status)+'</span><br><small>ATS: '+dt(f.atsAt)+'<br>Tayang: '+dt(f.showAt)+'</small>'+(f.note?'<br><small>'+esc(f.note)+'</small>':'')+
 '<div class="cdl" data-f=\''+esc(JSON.stringify({id:f.id,status:f.status,atsAt:f.atsAt,showAt:f.showAt}))+'\'></div>'+(f.deleteAt?'<div class="cdx" data-t="'+esc(f.deleteAt)+'"></div>':'')+(adm?'<div class="macts"><button class="btn sec" data-e="'+f.id+'">Edit</button><button class="btn sec" data-x="'+f.id+'">Hapus</button></div>':'')+'</div></div>'}).join('')+'</div>':'<div class="empty"><b>Belum ada film ATS</b>Admin dapat menambahkan film dan jadwal tiketnya.</div>');
 document.querySelectorAll('img[data-p]').forEach(function(i){fillImg(i,'poster')});tickCd();if(!adm)return;
 $('fa').onclick=function(){filmForm()};
 document.querySelectorAll('[data-e]').forEach(function(b){b.onclick=function(){filmForm(l.filter(function(f){return f.id===b.dataset.e})[0])}});
 document.querySelectorAll('[data-x]').forEach(function(b){b.onclick=function(){if(confirm('Hapus film ini?'))api('ats_del',{id:b.dataset.x}).then(vAts).catch(function(x){toast(x.message,1)})}})}).catch(err)}
function filmForm(f){f=f||{};var poster=null;
 modal('<h3>'+(f.id?'Edit':'Tambah')+' film</h3><form id="ff"><label>Judul *</label><input id="ft" required value="'+esc(f.title)+'"><div class="row2"><div><label>Genre</label><input id="fg" value="'+esc(f.genre)+'"></div><div><label>Durasi</label><input id="fd" placeholder="120 menit" value="'+esc(f.duration)+'"></div><div><label>Klasifikasi usia</label><input id="fr" placeholder="13+" value="'+esc(f.rating)+'"></div><div><label>Status</label><select id="fs">'+FS.map(function(o){return '<option'+(o===f.status?' selected':'')+'>'+o+'</option>'}).join('')+'</select></div><div><label>Mulai ATS (WIB)</label><input type="datetime-local" id="fa1" value="'+jk(f.atsAt)+'"></div><div><label>Mulai tayang (WIB)</label><input type="datetime-local" id="fa2" value="'+jk(f.showAt)+'"></div></div><label>Hapus otomatis pada (WIB) — opsional</label><input type="datetime-local" id="fdl" value="'+jk(f.deleteAt)+'"><small class="hint">Saat countdown habis, data film dan posternya dihapus permanen oleh sistem. Kosongkan untuk menonaktifkan.</small><label>Poster (JPG/PNG/WebP)</label><input type="file" id="fp" accept="image/jpeg,image/png,image/webp"><label>Catatan</label><textarea id="fn" rows="2">'+esc(f.note)+'</textarea><div class="merr" id="fe"></div><div class="fact"><button class="btn">Simpan film</button><button type="button" class="btn sec" id="fc">Batal</button></div></form>');
 $('fc').onclick=closeM;
 $('fp').onchange=function(){if(this.files[0])comp(this.files[0]).then(function(p){poster=p},function(){$('fe').textContent='Poster tidak valid.'})};
 var ms=function(v){return v?Date.parse(v+':00+07:00'):''};
 $('ff').onsubmit=function(e){e.preventDefault();if($('fdl').value&&!confirm('Data film ini akan DIHAPUS PERMANEN pada '+dt(ms($('fdl').value))+'. Lanjutkan?'))return;api('ats_save',{id:f.id,title:$('ft').value,genre:$('fg').value,duration:$('fd').value,rating:$('fr').value,status:$('fs').value,atsAt:ms($('fa1').value),showAt:ms($('fa2').value),deleteAt:ms($('fdl').value),note:$('fn').value,poster:poster&&{mime:poster.mime,b64:poster.b64}})
 .then(function(){closeM();toast('Film disimpan.');vAts()}).catch(function(x){$('fe').textContent=x.message})}}

/* ---- Glossarium (semua pengguna membaca; Admin menambah/mengedit/menghapus) ---- */
var GL=[];
function vGloss(){api('gloss_list').then(function(l){GL=l;var adm=U.role==='ADMIN',cats=[];l.forEach(function(g){if(g.category&&cats.indexOf(g.category)<0)cats.push(g.category)});cats.sort();
 $('view').innerHTML='<h2>Glossarium</h2><div class="bar"><label class="fl">Cari istilah<input id="gq" type="search" placeholder="Ketik istilah atau definisi" autocomplete="off"></label><label class="fl">Kategori<select id="gc"><option value="">Semua</option>'+cats.map(function(c){return '<option>'+esc(c)+'</option>'}).join('')+'</select></label>'+(adm?'<button class="btn" id="ga">Tambah istilah</button>':'')+'</div><div class="gcount" id="gn"></div><div id="gl"></div>';
 $('gq').oninput=glDraw;$('gc').onchange=glDraw;glDraw();if(adm)$('ga').onclick=function(){glForm()}}).catch(err)}
function glDraw(){var q=$('gq').value.trim().toLowerCase(),c=$('gc').value,adm=U.role==='ADMIN',
 l=GL.filter(function(g){return(!c||g.category===c)&&(!q||(g.term+' '+g.definition).toLowerCase().indexOf(q)>=0)});
 l=l.slice().sort(function(a,b){return String(a.term).localeCompare(String(b.term),'id',{numeric:true,sensitivity:'base'})});var pl='';
 $('gn').textContent=l.length+' dari '+GL.length+' istilah';
 $('gl').innerHTML=l.length?l.map(function(g){var ch=String(g.term||'').trim().charAt(0).toUpperCase(),hd='';if(!/[A-Z]/.test(ch))ch='#';if(ch!==pl){pl=ch;hd='<div class="gl-h">'+esc(ch)+'</div>'}return hd+'<div class="card gl"><div><b>'+esc(g.term)+'</b> <span class="pri">'+esc(g.category||'Umum')+'</span><p>'+esc(g.definition)+'</p>'+(g.source?'<small>Sumber: '+esc(g.source)+'</small>':'')+'</div>'+(adm?'<div class="macts"><button class="btn sec" data-e="'+g.id+'">Edit</button><button class="btn sec" data-x="'+g.id+'">Hapus</button></div>':'')+'</div>'}).join(''):'<div class="empty"><b>Istilah tidak ditemukan</b>Coba kata kunci atau kategori lain.</div>';
 if(!adm)return;
 document.querySelectorAll('#gl [data-e]').forEach(function(b){b.onclick=function(){glForm(GL.filter(function(g){return g.id===b.dataset.e})[0])}});
 document.querySelectorAll('#gl [data-x]').forEach(function(b){b.onclick=function(){var g=GL.filter(function(x){return x.id===b.dataset.x})[0];if(confirm('Hapus istilah "'+g.term+'"?'))api('gloss_del',{id:g.id}).then(function(){toast('Istilah dihapus.');vGloss()}).catch(function(x){toast(x.message,1)})}})}
function glForm(g){g=g||{};var cats=['Operasional & Projectionist','Proyektor, Suara & Pendukung','Umum (kedua sumber)'];
 modal('<h3>'+(g.id?'Edit':'Tambah')+' istilah</h3><form id="gf"><label>Istilah *</label><input id="gt" required maxlength="120" value="'+esc(g.term)+'"><label>Definisi / keterangan *</label><textarea id="gd" rows="5" required maxlength="2000">'+esc(g.definition)+'</textarea><div class="row2"><div><label>Kategori</label><input id="gk" list="gkl" maxlength="60" value="'+esc(g.category)+'"><datalist id="gkl">'+cats.map(function(c){return '<option value="'+esc(c)+'">'}).join('')+'</datalist></div><div><label>Sumber</label><input id="gs" maxlength="120" value="'+esc(g.source)+'"></div></div><div class="merr" id="ge"></div><div class="fact"><button class="btn">Simpan istilah</button><button type="button" class="btn sec" id="gx">Batal</button></div></form>');
 $('gx').onclick=closeM;$('gf').onsubmit=function(e){e.preventDefault();api('gloss_save',{id:g.id,term:$('gt').value,definition:$('gd').value,category:$('gk').value,source:$('gs').value}).then(function(){closeM();toast('Istilah disimpan.');vGloss()}).catch(function(x){$('ge').textContent=x.message})}}

/* ---- Penyimpanan Data multi-format (Admin & Teknisi melihat/mengunduh; Admin menambah/mengedit/menghapus) ---- */
var SF=[],STMAX=6000000,STEXT='pdf, doc, docx, xls, xlsx, ppt, pptx, csv, txt, json, png, jpg, jpeg, webp, zip';
function fsz(n){n=Number(n)||0;return n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB'}
function vStore(){api('store_list').then(function(l){SF=l;var adm=U.role==='ADMIN',cats=[];l.forEach(function(r){if(r.category&&cats.indexOf(r.category)<0)cats.push(r.category)});cats.sort();
 $('view').innerHTML='<h2>Penyimpanan Data</h2><div class="info">Format: '+STEXT+' (maks. 6 MB per berkas). '+(adm?'Hanya Admin yang dapat menambah, mengedit, dan menghapus.':'Anda dapat melihat dan mengunduh. Perubahan hanya oleh Admin.')+'</div><div class="bar"><label class="fl">Cari berkas<input id="sq" type="search" placeholder="Judul, nama berkas, atau deskripsi" autocomplete="off"></label><label class="fl">Kategori<select id="sc"><option value="">Semua</option>'+cats.map(function(c){return '<option>'+esc(c)+'</option>'}).join('')+'</select></label>'+(adm?'<button class="btn" id="sa">Unggah berkas</button>':'')+'</div><div class="gcount" id="sn"></div><div id="sl"></div>';
 $('sq').oninput=stDraw;$('sc').onchange=stDraw;stDraw();if(adm)$('sa').onclick=function(){stForm()}}).catch(err)}
function stDraw(){var q=$('sq').value.trim().toLowerCase(),c=$('sc').value,adm=U.role==='ADMIN',
 l=SF.filter(function(r){return(!c||r.category===c)&&(!q||[r.title,r.fileName,r.description].join(' ').toLowerCase().indexOf(q)>=0)});
 $('sn').textContent=l.length+' dari '+SF.length+' berkas';
 $('sl').innerHTML=l.length?l.map(function(r){return '<div class="card sf"><div class="sx">'+esc(r.ext)+'</div><div><b>'+esc(r.title)+'</b> <span class="pri">'+esc(r.category||'Lainnya')+'</span><br><small>'+esc(r.fileName)+' \u00b7 '+fsz(r.size)+' \u00b7 v'+esc(r.version)+' \u00b7 '+dt(r.updatedAt)+(r.updatedBy?' \u00b7 '+esc(r.updatedBy):'')+'</small>'+(r.description?'<p>'+esc(r.description)+'</p>':'')+'</div><div class="macts"><button class="btn sec" data-d="'+r.id+'">Unduh</button>'+(adm?'<button class="btn sec" data-e="'+r.id+'">Edit</button><button class="btn sec" data-x="'+r.id+'">Hapus</button>':'')+'</div></div>'}).join(''):'<div class="empty"><b>Belum ada berkas</b>'+(adm?'Tambahkan berkas lewat tombol di atas.':'Admin belum menambahkan berkas.')+'</div>';
 document.querySelectorAll('#sl [data-d]').forEach(function(b){b.onclick=function(){stDown(b.dataset.d,b)}});
 if(!adm)return;
 document.querySelectorAll('#sl [data-e]').forEach(function(b){b.onclick=function(){stForm(SF.filter(function(r){return r.id===b.dataset.e})[0])}});
 document.querySelectorAll('#sl [data-x]').forEach(function(b){b.onclick=function(){var r=SF.filter(function(x){return x.id===b.dataset.x})[0];if(confirm('Hapus "'+r.title+'" beserta berkasnya?'))api('store_del',{id:r.id}).then(function(){toast('Berkas dihapus.');vStore()}).catch(function(x){toast(x.message,1)})}})}
function stDown(id,btn){btn.disabled=true;api('store_get',{id:id}).then(function(r){var a=atob(r.b64),u=new Uint8Array(a.length);for(var i=0;i<a.length;i++)u[i]=a.charCodeAt(i);dlBlob(new Blob([u],{type:r.mime}),r.name)}).catch(function(x){toast(x.message,1)}).then(function(){btn.disabled=false})}
function stForm(r){r=r||{};var cats=['Dokumen','Manual','Data Teknis','Spreadsheet','Gambar','Lainnya'];
 modal('<h3>'+(r.id?'Edit':'Tambah')+' berkas</h3><form id="sf"><label>Judul *</label><input id="st" required maxlength="150" value="'+esc(r.title)+'"><label>Kategori</label><input id="sk" list="skl" maxlength="60" value="'+esc(r.category)+'"><datalist id="skl">'+cats.map(function(c){return '<option value="'+c+'">'}).join('')+'</datalist><label>Deskripsi</label><textarea id="sd" rows="3" maxlength="1000">'+esc(r.description)+'</textarea><label>Berkas'+(r.id?' (kosongkan jika tidak diganti)':' *')+'</label><input type="file" id="sfl" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.json,.png,.jpg,.jpeg,.webp,.zip">'+(r.id?'<small class="hint">Saat ini: '+esc(r.fileName)+' ('+fsz(r.size)+'). Berkas lama dibuang setelah yang baru berhasil disimpan.</small>':'')+'<div class="merr" id="se"></div><div class="fact"><button class="btn" id="ss">Simpan</button><button type="button" class="btn sec" id="sx2">Batal</button></div></form>');
 $('sx2').onclick=closeM;
 $('sf').onsubmit=function(e){e.preventDefault();var f=$('sfl').files[0],er=$('se');er.textContent='';
  if(!r.id&&!f){er.textContent='Pilih berkas terlebih dahulu.';return}
  if(f&&f.size>STMAX){er.textContent='Ukuran berkas maksimal 6 MB.';return}
  var rd=f?new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){res({name:f.name,b64:String(fr.result).split(',')[1]})};fr.onerror=function(){rej(new Error('Gagal membaca berkas.'))};fr.readAsDataURL(f)}):Promise.resolve(null);
  $('ss').disabled=true;BUSY=true;
  rd.then(function(file){return api('store_save',{id:r.id,title:$('st').value,category:$('sk').value,description:$('sd').value,file:file})})
  .then(function(){BUSY=false;closeM();toast('Berkas disimpan.');vStore()},function(x){BUSY=false;$('ss').disabled=false;er.textContent=x.message})}}

/* ---- foto ---- */
function comp(file){return new Promise(function(res,rej){
 if(['image/jpeg','image/png','image/webp'].indexOf(file.type)<0||file.size>15e6)return rej();
 var im=new Image(),u=URL.createObjectURL(file);im.onload=function(){var s=Math.min(1,1280/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);var url=c.toDataURL('image/jpeg',.8);res({mime:'image/jpeg',b64:url.split(',')[1],url:url})};im.onerror=rej;im.src=u})}
/* Watermark dibakar ke piksel foto khusus foto yang diambil dengan kamera browser. */
function compWatermarked(file,kind,capturedAt){return comp(file).then(function(x){return new Promise(function(res,rej){var im=new Image();im.onload=function(){try{var c=document.createElement('canvas');c.width=im.naturalWidth||im.width;c.height=im.naturalHeight||im.height;var g=c.getContext('2d');g.drawImage(im,0,0,c.width,c.height);var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(capturedAt)).reduce(function(a,p){a[p.type]=p.value;return a},{});var dtm=parts.day+'/'+parts.month+'/'+parts.year+', '+parts.hour+':'+parts.minute+':'+parts.second;var lines=['NOVA  |  STC XXI',String(kind||'DOKUMENTASI').toUpperCase(),dtm+' WIB'];var pad=Math.max(8,Math.round(c.width*.014)),fs=Math.max(13,Math.round(c.width*.022)),lh=Math.round(fs*1.3),bh=pad*2+lh*lines.length,by=c.height-bh;g.fillStyle='rgba(0,0,0,.68)';g.fillRect(0,by,c.width,bh);g.font='600 '+fs+'px Arial, sans-serif';g.textBaseline='top';g.fillStyle='#fff';lines.forEach(function(line,i){g.fillText(line,pad,by+pad+i*lh, c.width-pad*2)});var url=c.toDataURL('image/jpeg',.88);res({mime:'image/jpeg',b64:url.split(',')[1],url:url,capturedAt:capturedAt,watermarked:true})}catch(e){rej(e)}};im.onerror=rej;im.src=x.url})})}

/* unggah foto bertahap untuk laporan yang sudah ada; mengembalikan jumlah foto yang gagal */
function upTxt(b,n,t){b.textContent='Mengunggah foto '+n+'/'+t+'...';b.classList.add('prog');b.style.setProperty('--p',Math.round(n/Math.max(1,t)*100)+'%')}
function upOff(b){b.classList.remove('prog');b.style.removeProperty('--p')}
function upPh(id,phs,prog){var failed=0,sent=0;if(!phs.length)return Promise.resolve(0);
 var chunks=[],i;for(i=0;i<phs.length;i+=PHBATCH)chunks.push(phs.slice(i,i+PHBATCH));
 function send(ch,n){return api('photo_save',{id:id,photos:ch.map(function(p){return {mime:p.mime,b64:p.b64,kind:p.kind,capturedAt:p.capturedAt||Date.now()}})}).then(function(x){failed+=x.failed},function(e){if(n<2)return send(ch,n+1);failed+=ch.length})}
 return chunks.reduce(function(p,ch){return p.then(function(){return send(ch,0).then(function(){sent+=ch.length;if(prog)prog(sent)})})},Promise.resolve())
  .then(function(){return api('photo_done',{id:id}).catch(function(){})}).then(function(){return failed})}
/* ---- meteran: detail, akumulasi, grafik ---- */
var NF=new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}),NF3=new Intl.NumberFormat('id-ID',{maximumFractionDigits:3}),MON=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],CC={listrik:'#c9a24d',lwbp:'#c9a24d',wbp:'#2fa476',genset:'#9a6fcf',air:'#2e9bd6'};
/* listrik = LWBP + WBP digabung; pemakaian harian = selisih total (LWBP+WBP) hari ini dengan sebelumnya */
function addL(o){var q=Object.assign({},o);q.listrik=Math.round(((+o.lwbp||0)+(+o.wbp||0))*1000)/1000;return q}
function addT(o){if(o)o.listrik=Math.round(((+o.lwbp||0)+(+o.wbp||0))*1000)/1000}
function nf(v){return v==null||isNaN(v)?'-':NF.format(v)}
function mfmt(v){return v==null?'-':NF3.format(v)}
function dd(s){return s?new Intl.DateTimeFormat('id-ID',{timeZone:TZ,dateStyle:'medium'}).format(new Date(s+'T12:00:00+07:00')):'-'}
function jkd(o){return new Date(now()+7*36e5+o*864e5).toISOString().slice(0,10)}
function nice(v){var p=Math.pow(10,Math.floor(Math.log(v)/Math.LN10)),f=v/p;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p}
function bl(k,g){return g==='month'?MON[+k.slice(5,7)-1]+' '+k.slice(2,4):k.slice(8,10)+'/'+k.slice(5,7)}
function tl(k,g){return g==='month'?MON[+k.slice(5,7)-1]+' '+k.slice(0,4):dd(k)}
function meterDetail(d){var rows=[],x=d.diffs||{},p=d.prevs||{};
 if(d.kind!=='Air'){if(d.lwbp!=null)[['LWBP','lwbp'],['WBP','wbp'],['Genset','genset']].forEach(function(m){rows.push([m[0]+' (kWh)',d[m[1]],p[m[1]],x[m[1]]])});else if(d.reading!=null)rows.push(['Listrik (data lama, kWh)',d.reading,null,null])}
 if(d.kind==='Air'||d.kind==='Gabungan')rows.push(['Air (m³)',d.reading,d.prev,d.diff]);
 return '<div class="mh">Pembacaan meteran</div><div class="scroll"><table class="mt"><tr><th>Meter</th><th>Angka</th><th>Sebelumnya</th><th>Pemakaian</th></tr>'+rows.map(function(r){return '<tr><td>'+r[0]+'</td><td>'+mfmt(r[1])+'</td><td>'+mfmt(r[2])+'</td><td>'+(r[3]!=null?'<b>+'+mfmt(r[3])+'</b>':'-')+'</td></tr>'}).join('')+'</table></div>'+(rows.every(function(r){return r[3]==null})?'<small class="mnote">Belum ada pencatatan sebelumnya di lokasi ini, atau angka lebih kecil dari sebelumnya.</small>':'')+'<div id="mcum"></div>'}
function meterCum(d){api('meter_prev',{location:d.location,until:d.date+' '+(d.time||'00:00'),inclusive:1}).then(function(s){var b=$('mcum');if(!b||!s.count)return;addT(s.cum);
 var M=[['listrik','Listrik (LWBP+WBP)','kWh','e'],['genset','Genset','kWh','e'],['air','Air','m³','w']].filter(function(m){return s.has[m[3]]});
 b.innerHTML='<div class="mh">Akumulasi pemakaian di '+esc(d.location)+'</div><div class="macc">'+M.map(function(m){return '<div><small>'+m[1]+'</small><b>'+nf(s.cum[m[0]])+' '+m[2]+'</b></div>'}).join('')+'</div><small class="mnote">Total selisih antar laporan sejak '+dd(s.since)+' sampai laporan ini ('+s.count+' laporan terkirim).</small>'}).catch(function(){})}
var DAY=864e5,CH=null;
function tm(k){return Date.parse(k.length===7?k+'-01T00:00:00Z':k+'T00:00:00Z')}
function fx(t,gr,sp){var d=new Date(t);return gr==='month'?MON[d.getUTCMonth()]+' '+String(d.getUTCFullYear()).slice(2):('0'+d.getUTCDate()).slice(-2)+' '+MON[d.getUTCMonth()]+(sp>240*DAY?' '+String(d.getUTCFullYear()):'')}
function xt(a,b,n,gr){var o=[],i,t,d;
 if(gr==='month'){var S=[1,2,3,6,12,24],st=24;for(i=0;i<S.length;i++)if((b-a)/(S[i]*30.44*DAY)<=n){st=S[i];break}
  d=new Date(a);var y=d.getUTCFullYear(),m=d.getUTCMonth();if(Date.UTC(y,m,1)<a)m++;
  for(;;m+=st){t=Date.UTC(y,m,1);if(t>b)break;o.push(t)}}
 else{var D=[1,2,3,7,14,30,60,90,180,365],s=365;for(i=0;i<D.length;i++)if((b-a)/(D[i]*DAY)<=n){s=D[i];break}
  for(t=Math.ceil(a/(s*DAY))*s*DAY;t<=b;t+=s*DAY)o.push(t)}
 return o}
/* grafik garis gabungan (LWBP, WBP, Genset = kWh di sumbu kiri; Air = m³ di sumbu kanan) dengan zoom & geser.
   Data: seri dari server (seluruh riwayat bila tersedia), tampilan awal = periode yang dipilih. */
var MMODE='listrik',MNM={listrik:'Pemakaian listrik',avg:'Rata-rata harian',genset:'Genset (kWh)',air:'Air (m\u00b3)'};
/* seri yang ditampilkan menurut pilihan grafik: Listrik (LWBP+WBP + Genset) atau Air */
function mSeriesKeys(m,P){var K=m==='air'?['air']:['listrik','avg','genset'],on=K.filter(function(k){return P.some(function(p){return p.o[k]>0})});return on.length?on:[K[0]]}
function mTitle(gr){return MMODE==='air'?'Tren pemakaian air':'Tren pemakaian listrik'}
function mSub(gr){return 'Konsumsi '+(gr==='month'?'bulanan':'harian')+' dalam '+(MMODE==='air'?'m\u00b3':'kWh')+(CH&&CH.n?' \u2022 '+CH.n+' hari terakhir':'')}
function mRange(a,b,gr){var f=function(t){var d=new Date(t);return gr==='month'?MON[d.getUTCMonth()]:('0'+d.getUTCDate()).slice(-2)+' '+MON[d.getUTCMonth()]},ya=new Date(a).getUTCFullYear(),yb=new Date(b).getUTCFullYear();return f(a)+(ya===yb?'':' '+ya)+'\u2013'+f(b)+' '+yb}
var FC={listrik:'#6d4fd6',avg:'#b8a6ec',genset:'#c9b8f5',air:'#2e9bd6'};
function mNote(){return 'Geser dengan mouse atau jari. Zoom: tombol +/&minus;, cubit layar, atau Ctrl+scroll. Nilai tampil di setiap titik'+(MMODE==='air'?': biru = air (m\u00b3).':': ungu tua = pemakaian listrik (kWh), ungu muda = rata-rata harian. Genset dapat ditampilkan lewat legenda.')}
function mLegend(){return CH.on.map(function(k){return '<button type="button" class="mlb" data-k="'+k+'" aria-pressed="'+(CH.hid[k]?'false':'true')+'"><i style="background:'+FC[k]+'"></i>'+MNM[k]+'</button>'}).join('')}
function mModeSet(m){var c=CH;if(!c||m===MMODE)return;MMODE=m;c.on=mSeriesKeys(m,c.P);c.hid=m==='air'?{}:{genset:1};c.sel=-1;c.anim=1;
 var q=function(id){return $(id)};
 if(q('mlg'))q('mlg').innerHTML=mLegend();if(q('mctitle'))q('mctitle').textContent=mTitle(c.gr);if(q('msub'))q('msub').textContent=mSub(c.gr);if(q('mnote'))q('mnote').innerHTML=mNote();
 var b=document.querySelectorAll('#mmode [data-m]');for(var i=0;i<b.length;i++){var on=b[i].dataset.m===m;b[i].classList.toggle('on',on);b[i].setAttribute('aria-pressed',String(on))}
 var ch=$('mchart');if(ch)ch.setAttribute('aria-label','Grafik pemakaian '+(m==='air'?'air':'listrik'));
 mDraw()}
function mChartInit(r,all){
 all=all||r; var gr=r.group,S=mFill(all.series||[],gr,all.since||r.since,r).map(addL),K=['listrik','avg','genset','air'],
  on=K.filter(function(k){return S.some(function(o){return o[k]>0})}),W7=7;
 /* rata-rata harian: rata-rata pemakaian listrik 7 hari terakhir (hari tanpa data dihitung 0 seperti grafik) */
 S.forEach(function(o,i){var t=0,n=0;for(var j=Math.max(0,i-W7+1);j<=i;j++){t+=S[j].listrik||0;n++}o.avg=Math.round(t/n*1000)/1000});
 var P=S.map(function(o){return {t:tm(o.k),o:o}}),pad=gr==='month'?16*DAY:0,mn=P[0].t,mx=P[P.length-1].t,f0=r.from?tm(r.from):mn,f1=r.to?tm(r.to):mx;
 if(gr==='month'){var d0=new Date(f0),d1=new Date(f1);f0=Date.UTC(d0.getUTCFullYear(),d0.getUTCMonth(),1);f1=Date.UTC(d1.getUTCFullYear(),d1.getUTCMonth(),1)}
 CH={P:P,on:on,hid:{genset:1},sel:-1,gr:gr,i0:f0-pad,i1:f1+pad,F0:Math.min(mn-pad,f0-pad),F1:Math.max(mx+pad,f1+pad),minSp:gr==='month'?50*DAY:4*DAY,
  NM:{listrik:'Pemakaian listrik',avg:'Rata-rata harian',genset:'Genset',air:'Air'},UN:{listrik:'kWh',avg:'kWh',genset:'kWh',air:'m³'},raf:0,
  n:gr==='month'?0:Math.round((f1-f0)/DAY)+1,rng:mRange(f0,f1,gr)};
 CH.on=mSeriesKeys(MMODE,P);mSet(CH.i0,CH.i1)}
function mSet(a,b){var c=CH,sp=Math.min(Math.max(b-a,c.minSp),c.F1-c.F0),ct=(a+b)/2;a=ct-sp/2;
 if(a<c.F0)a=c.F0;if(a+sp>c.F1)a=c.F1-sp;c.a=a;c.b=a+sp}
function mZoom(f,fr){var c=CH,sp=c.b-c.a,an=c.a+fr*sp,ns=sp*f;mSet(an-fr*ns,an-fr*ns+ns)}
function mReq(){var c=CH;if(!c||c.raf)return;c.raf=requestAnimationFrame(function(){c.raf=0;mDraw()})}
/* kurva halus (Catmull-Rom ke Bezier) seperti desain Figma */
function smD(p){if(!p.length)return '';var d='M'+p[0][0].toFixed(1)+','+p[0][1].toFixed(1),i,a,b,c1,c2;
 for(i=0;i<p.length-1;i++){a=p[i-1]||p[i];b=p[i];c1=p[i+1];c2=p[i+2]||c1;
  d+=' C'+(b[0]+(c1[0]-a[0])/6).toFixed(1)+','+(b[1]+(c1[1]-a[1])/6).toFixed(1)+' '+(c1[0]-(c2[0]-b[0])/6).toFixed(1)+','+(c1[1]-(c2[1]-b[1])/6).toFixed(1)+' '+c1[0].toFixed(1)+','+c1[1].toFixed(1)}
 return d}
function mDraw(){var c=CH,el=$('mchart');if(!c||!el)return;
 var W=Math.max(280,el.clientWidth||600),H=W<520?200:230,vis=c.on.filter(function(k){return !c.hid[k]}),
  E=vis.filter(function(k){return k!=='air'}),A=vis.filter(function(k){return k==='air'}),
  top=function(ks){var m=0;c.P.forEach(function(p){if(p.t>=c.a&&p.t<=c.b)ks.forEach(function(k){if(p.o[k]>m)m=p.o[k]})});var st=(m||1)/3,q=Math.pow(10,Math.floor(Math.log(st)/Math.LN10));return Math.ceil(st/q)*q*3},
  ax=[];
 if(E.length)ax.push({tp:top(E),u:'kWh'});if(A.length)ax.push({tp:top(A),u:'m³'});if(!ax.length)ax.push({tp:3,u:''});
 var tE=E.length?ax[0].tp:0,tA=A.length?ax[ax.length-1].tp:0,tk=E.length?tE:tA,
  L=40,R=26,T=14,B=26,pw=W-L-R,ph=H-T-B,g='',i,
  X=function(t){return L+(t-c.a)/(c.b-c.a)*pw},Y=function(v,tp){return T+ph-v/tp*ph};
 c.g={L:L,pw:pw};
 for(i=0;i<=3;i++){var y=T+ph-i*ph/3;g+='<line class="cgr" x1="'+L+'" x2="'+(W-R)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'"/><text class="cyl" x="'+(L-10)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+nf(tk*i/3)+'</text>'}
 xt(c.a,c.b,Math.max(2,Math.floor(pw/62)),c.gr).forEach(function(t){var x=X(t).toFixed(1);g+='<text class="ctx" x="'+x+'" y="'+(H-6)+'" text-anchor="middle">'+fx(t,c.gr,c.b-c.a)+'</text>'});
 var inV=c.P.filter(function(p){return p.t>=c.a&&p.t<=c.b});
 g+='<clipPath id="mclip"><rect x="'+(L-4)+'" y="'+(T-6)+'" width="'+(pw+8)+'" height="'+(ph+8)+'"/></clipPath><g clip-path="url(#mclip)">';
 vis.forEach(function(k){var tp=k==='air'?tA:tE;
  g+='<path pathLength="1" d="'+smD(c.P.map(function(p){return [X(p.t),Y(p.o[k],tp)]}))+'" fill="none" stroke="'+FC[k]+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'});
 g+='</g>';
 if(!inV.length)g+='<text class="ctx" x="'+(L+pw/2)+'" y="'+(T+ph/2)+'" text-anchor="middle">Tidak ada pemakaian pada rentang ini. Geser untuk melihat periode lain.</text>';else if(inV.length===1)g+='<text class="ctx" x="'+(L+pw/2)+'" y="'+(T+ph-8)+'" text-anchor="middle">1 titik data — garis tren muncul setelah ada data pada tanggal/periode lain.</text>';
 var sp=c.sel>=0&&c.P[c.sel];
 if(sp&&sp.t>=c.a&&sp.t<=c.b&&vis.length){var sx=X(sp.t),rows=vis.map(function(k){return {k:k,t:c.NM[k]+': '+nf(sp.o[k])+' '+c.UN[k]}}),ttl=tl(sp.o.k,c.gr),
   bw=Math.max(ttl.length,rows.reduce(function(m,o){return Math.max(m,o.t.length)},0)+3)*6.3+16,bh=rows.length*15+22,bx=sx+10+bw<W-R+8?sx+10:sx-10-bw;
  g+='<line class="ctl" x1="'+sx.toFixed(1)+'" x2="'+sx.toFixed(1)+'" y1="'+T+'" y2="'+(T+ph)+'"/>';
  vis.forEach(function(k){g+='<circle cx="'+sx.toFixed(1)+'" cy="'+Y(sp.o[k],k==='air'?tA:tE).toFixed(1)+'" r="4.5" fill="'+FC[k]+'" stroke="var(--card)" stroke-width="1.5"/>'});
  g+='<rect class="ctb" x="'+bx.toFixed(1)+'" y="'+(T+2)+'" width="'+bw.toFixed(1)+'" height="'+bh+'" rx="6"/><text class="ctt" x="'+(bx+8).toFixed(1)+'" y="'+(T+16)+'">'+esc(ttl)+'</text>'+
   rows.map(function(o,j){var yy=T+31+j*15;return '<circle cx="'+(bx+12).toFixed(1)+'" cy="'+(yy-3.5)+'" r="3.5" fill="'+FC[o.k]+'"/><text class="cts" x="'+(bx+20).toFixed(1)+'" y="'+yy+'">'+esc(o.t)+'</text>'}).join('')}
 el.innerHTML='<svg'+(c.anim?' class="anim"':'')+' viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Grafik garis pemakaian '+(MMODE==='air'?'air':'listrik')+'">'+g+'</svg>';c.anim=0}
function mBind(){var c=CH,el=$('mchart');if(!c||!el)return;
 var ptr={},moved=0,pd=0,xin=function(ev){return ev.clientX-el.getBoundingClientRect().left},
  fr=function(x){return Math.min(1,Math.max(0,(x-c.g.L)/c.g.pw))},
  pick=function(x){var t=c.a+fr(x)*(c.b-c.a),bi=-1,bd=1e18;c.P.forEach(function(p,j){var d=Math.abs(p.t-t);if(d<bd){bd=d;bi=j}});c.sel=bi;mReq()},
  cnt=function(){return Object.keys(ptr).length},
  dist=function(){var k=Object.keys(ptr);return Math.abs(ptr[k[0]]-ptr[k[1]])||1};
 el.onpointerdown=function(ev){try{el.setPointerCapture(ev.pointerId)}catch(e){}ptr[ev.pointerId]=ev.clientX;moved=0;if(cnt()===2)pd=dist()};
 el.onpointermove=function(ev){
  if(ptr[ev.pointerId]==null){if(ev.pointerType==='mouse')pick(xin(ev));return}
  var n=cnt();
  if(n===1){var dx=ev.clientX-ptr[ev.pointerId];ptr[ev.pointerId]=ev.clientX;moved+=Math.abs(dx);
   if(moved>5){var sp=c.b-c.a,dt=-dx/c.g.pw*sp;mSet(c.a+dt,c.b+dt);c.sel=-1;mReq()}}
  else if(n===2){ptr[ev.pointerId]=ev.clientX;var k=Object.keys(ptr),d=dist(),mid=(ptr[k[0]]+ptr[k[1]])/2-el.getBoundingClientRect().left;mZoom(pd/d,fr(mid));pd=d;moved=99;c.sel=-1;mReq()}};
 var up=function(ev){if(ptr[ev.pointerId]==null)return;var tap=cnt()===1&&moved<=5;delete ptr[ev.pointerId];
  try{el.releasePointerCapture(ev.pointerId)}catch(e){}
  if(tap)pick(xin(ev));if(cnt()===1)moved=99};
 el.onpointerup=up;el.onpointercancel=up;
 el.onpointerleave=function(ev){if(ev.pointerType==='mouse'&&!cnt()){c.sel=-1;mReq()}};
 el.onwheel=function(ev){
  if(ev.ctrlKey){ev.preventDefault();mZoom(Math.exp(ev.deltaY*.002),fr(xin(ev)));c.sel=-1;mReq()}
  else if(Math.abs(ev.deltaX)>Math.abs(ev.deltaY)){ev.preventDefault();var dt=ev.deltaX/c.g.pw*(c.b-c.a);mSet(c.a+dt,c.b+dt);c.sel=-1;mReq()}};
 var ct=$('mctl');
 if(ct)ct.onclick=function(ev){var b=ev.target.closest('[data-a]');if(!b)return;var a=b.dataset.a,sp=c.b-c.a;
  if(a==='zi')mZoom(.6,.5);else if(a==='zo')mZoom(1/.6,.5);else if(a==='pl')mSet(c.a-sp*.3,c.b-sp*.3);else if(a==='pr')mSet(c.a+sp*.3,c.b+sp*.3);else mSet(c.i0,c.i1);
  c.sel=-1;mDraw()};
 var md=$('mmode');
 if(md)md.onclick=function(ev){var b=ev.target.closest('[data-m]');if(b)mModeSet(b.dataset.m)};
 var lg=$('mlg');
 if(lg)lg.onclick=function(ev){var b=ev.target.closest('[data-k]');if(!b)return;var k=b.dataset.k;c.hid[k]=!c.hid[k];b.classList.toggle('off',!!c.hid[k]);b.setAttribute('aria-pressed',String(!c.hid[k]));c.sel=-1;mDraw()};
 if(!window.__mrz){window.__mrz=1;window.addEventListener('resize',function(){mReq()})}}
function mChartHtml(r,all){
 mChartInit(r,all);CH.anim=1;
 var MB=[['listrik','Grafik Listrik'],['air','Grafik Air']];
 return '<div class="mhd"><div><div class="mh" id="mctitle">'+mTitle(r.group)+'</div><div class="msub" id="msub">'+mSub(r.group)+'</div></div><span class="mrange" id="mrange">'+CH.rng+'</span></div>'+
  '<div class="mmode" id="mmode" role="group" aria-label="Pilih grafik yang ditampilkan">'+MB.map(function(m){var on=m[0]===MMODE;return '<button type="button" class="mmb'+(on?' on':'')+'" data-m="'+m[0]+'" aria-pressed="'+on+'">'+m[1]+'</button>'}).join('')+'</div>'+
  '<div class="mcc"><div class="mlg" id="mlg">'+mLegend()+'</div>'+
  '<div class="mct" id="mctl"><button type="button" class="btn sec" data-a="pl" aria-label="Geser ke kiri" title="Geser ke kiri">&#9664;</button><button type="button" class="btn sec" data-a="pr" aria-label="Geser ke kanan" title="Geser ke kanan">&#9654;</button><button type="button" class="btn sec" data-a="zi" aria-label="Perbesar" title="Perbesar">+</button><button type="button" class="btn sec" data-a="zo" aria-label="Perkecil" title="Perkecil">&minus;</button><button type="button" class="btn sec" data-a="rs" title="Kembali ke periode yang dipilih">Reset zoom</button></div></div>'+
  '<div class="mch" id="mchart"></div><small class="mnote" id="mnote">'+mNote()+'</small>'}
function mRender(r,all){var U2=[['listrik','Listrik (LWBP+WBP)','kWh'],['genset','Genset','kWh'],['air','Air','m³']];addT(r.cum);addT(r.per);r.series=(r.series||[]).map(addL);
 if(!(r.count||{}).total&&!(all&&all.series&&all.series.length))return '<div class="empty"><b>Belum ada data meteran</b>Data meteran belum diterima backend untuk lokasi/periode ini. Periksa koneksi API dan data spreadsheet.</div>';
 if(!r.latest)r.latest=[]; if(!r.cum)r.cum={listrik:0,genset:0,air:0}; if(!r.per)r.per={listrik:0,genset:0,air:0}; if(!r.count)r.count={total:0,period:0};
 var h='<div class="mlts">'+r.latest.map(function(o){var e=o.elec,w=o.water;return '<div class="mlt"><b>'+esc(o.loc)+'</b><small>Pembacaan terakhir</small><span>'+(e?'LWBP '+mfmt(e.lwbp)+' · WBP '+mfmt(e.wbp)+' · Genset '+mfmt(e.genset)+' kWh ('+dd(e.date)+')':'')+(e&&w?'<br>':'')+(w?'Air '+mfmt(w.reading)+' m³ ('+dd(w.date)+')':'')+'</span></div>'}).join('')+'</div>';
 h+='<div class="mh">Akumulasi pemakaian <small>(total selisih antar laporan sejak '+dd(r.since)+', '+(r.count||{}).total+' laporan)</small></div><div class="macc">'+U2.map(function(m){return '<div><small>'+m[1]+'</small><b>'+nf(r.cum[m[0]])+' '+m[2]+'</b><span>Periode ini: '+(r.per[m[0]]>0?'+':'')+nf(r.per[m[0]])+' '+m[2]+'</span></div>'}).join('')+'</div>';
 h+='<small class="mnote">Periode '+dd(r.from)+' – '+dd(r.to)+' · '+r.count.period+' laporan. Pemakaian dihitung dari selisih angka antar pencatatan di lokasi yang sama dan dicatat pada tanggal laporan yang lebih baru.</small>';
 var src=(all&&all.series&&all.series.length)?all:r,NM=[['listrik','Listrik (LWBP+WBP)'],['genset','Genset']],gr=r.group;
 if(!src.series.length){CH=null;return h+'<div class="empty" style="margin-top:12px"><b>Tidak ada pemakaian pada periode ini</b>Ubah rentang tanggal. Pemakaian baru terhitung dari selisih minimal dua pencatatan pada lokasi yang sama. Garis tren membutuhkan lebih dari satu tanggal/periode dengan pemakaian tercatat.</div>'}
 if(!r.series.length)h+='<div class="empty" style="margin-top:12px"><b>Tidak ada pemakaian pada periode ini</b>Geser grafik untuk melihat periode lain yang punya data.</div>';
 h+=mChartHtml(r,src);
 h+='<div class="mh">Tabel pemakaian '+(gr==='month'?'bulanan':'harian')+'</div><div class="scroll meter-data-table"><table class="mt"><thead><tr><th>'+(gr==='month'?'Bulan':'Tanggal')+'</th>'+NM.map(function(m){return '<th>'+m[1]+' (kWh)</th>'}).join('')+'<th>Air (m³)</th></tr></thead><tbody>'+(r.series.length?r.series.map(function(o){return '<tr><td>'+tl(o.k,gr)+'</td>'+NM.map(function(m){return '<td>'+nf(o[m[0]])+'</td>'}).join('')+'<td>'+nf(o.air)+'</td></tr>'}).join(''):'<tr><td colspan="4">Belum ada pemakaian yang dapat dihitung pada periode ini. Dibutuhkan minimal dua pencatatan berurutan di lokasi yang sama.</td></tr>')+'</tbody></table></div>';
 return h}
var MS={loc:'',pre:'o',from:'',to:'',group:'day'},MALL={};
function mAll(loc,gr){var k=loc+'|'+gr;return api('meter_stats',{location:loc,from:'',to:'',group:gr,quiet:1}).then(function(r){MALL[k]=r;return r},function(){return MALL[k]||null})}
var M_START='2026-10-01';
function mPre(v){var s=MS,t=jkd(0),y=+t.slice(0,4),m=+t.slice(5,7)-1,iso=function(x){return x.toISOString().slice(0,10)};
 s.pre=v;if(v==='c')return;s.to=t;
 if(v==='o')s.from=M_START;
 else if(v==='m0')s.from=t.slice(0,8)+'01';
 else if(v==='m1'){s.from=iso(new Date(Date.UTC(y,m-1,1)));s.to=iso(new Date(Date.UTC(y,m,0)))}
 else if(v==='y')s.from=y+'-01-01';
 else s.from=jkd(1-Number(v))}
function meterPanel(){var b=$('mstat');if(!b)return;var s=MS;if(!s.from)mPre(s.pre||'o');
 var PR=[['o','Sejak 1 Oktober 2026'],['7','7 hari terakhir'],['30','30 hari terakhir'],['90','90 hari terakhir'],['m0','Bulan ini'],['m1','Bulan lalu'],['y','Tahun ini'],['c','Kustom']];
 b.innerHTML='<div class="card mp"><h3>Akumulasi &amp; grafik pemakaian <small id="meter-refresh-time" class="mnote">Memuat data…</small></h3><div class="bar mbar"><label class="fl">Lokasi<select id="ml"><option value="">Semua lokasi</option>'+(s.loc?'<option selected>'+esc(s.loc)+'</option>':'')+'</select></label><label class="fl">Periode<select id="mpr">'+PR.map(function(p){return '<option value="'+p[0]+'"'+(p[0]===s.pre?' selected':'')+'>'+p[1]+'</option>'}).join('')+'</select></label><label class="fl">Dari tanggal<input type="date" id="mf" value="'+esc(s.from)+'"></label><label class="fl">Sampai tanggal<input type="date" id="mto" value="'+esc(s.to)+'"></label><label class="fl">Tampilan<select id="mg"><option value="day"'+(s.group==='day'?' selected':'')+'>Harian</option><option value="month"'+(s.group==='month'?' selected':'')+'>Bulanan</option></select></label></div><div id="mres"><div class="sk" style="height:160px"></div></div></div>';
 var meterLoading=false;var run=function(silent){if(meterLoading||CUR!=='meter'||!$('mres'))return;meterLoading=true;if(s.pre&&s.pre!=='c'){mPre(s.pre);$('mf').value=s.from;$('mto').value=s.to}s.loc=$('ml').value;s.from=$('mf').value;s.to=$('mto').value;s.group=$('mg').value;
  Promise.all([api('meter_stats',{location:s.loc,from:s.from,to:s.to,group:s.group,quiet:!!silent}),mAll(s.loc,s.group)]).then(function(ar){var r=ar[0];if(!$('mres')||CUR!=='meter')return;
   $('ml').innerHTML='<option value="">Semua lokasi</option>'+r.locations.map(function(n){return '<option'+(n===s.loc?' selected':'')+'>'+esc(n)+'</option>'}).join('');
   $('mres').innerHTML=mRender(r,ar[1]);mDraw();mBind();if(silent&&window.__mdg){var rr=$('mres');rr.insertAdjacentHTML('beforeend',window.__mdg);rr.lastChild.id='mdiag'}else mDiag(s.loc);var stamp=$('meter-refresh-time');if(stamp)stamp.textContent='Diperbarui '+new Date(now()).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:TZ});}).catch(function(x){if($('mres'))$('mres').innerHTML='<div class="empty">'+esc(x.message)+'</div>'}).finally(function(){meterLoading=false})};
 $('ml').onchange=run;$('mg').onchange=run;
 $('mpr').onchange=function(){mPre(this.value);$('mf').value=s.from;$('mto').value=s.to;run()};
 $('mf').onchange=$('mto').onchange=function(){s.pre='c';$('mpr').value='c';run()};
 if(window.__stcMeterRefresh)clearInterval(window.__stcMeterRefresh);run();window.__stcMeterRefresh=setInterval(function(){if(CUR==='meter'&&document.visibilityState==='visible')run(true)},30000)}


/* ---- grafik batang per hari (listrik & air) dari 1 Oktober; hari tanpa pemakaian tampil nol ---- */
function mKeys(r){var gr=r.group==='month'?'month':'day',out=[],S=r.series||[],a=r.from||(S[0]&&S[0].k)||M_START,b=r.to||jkd(0);
 if(gr==='month'){var y=+a.slice(0,4),m=+a.slice(5,7)-1,y2=+b.slice(0,4),m2=+b.slice(5,7)-1;while((y<y2||(y===y2&&m<=m2))&&out.length<120){out.push(y+'-'+('0'+(m+1)).slice(-2));m++;if(m>11){m=0;y++}}}
 else{var t=Date.parse(a+'T00:00:00Z'),e=Date.parse(b+'T00:00:00Z');for(;t<=e&&out.length<400;t+=864e5)out.push(new Date(t).toISOString().slice(0,10))}
 return out}
/* isi hari/bulan tanpa pemakaian dengan nol, mulai dari tanggal pencatatan pertama (angka awal) sampai hari ini,
   agar garis grafik terbentuk per hari dan pencatatan pertama (mis. 12 Okt) ikut tampil */
function mFill(S,gr,since,r){if(!S.length)return S;var by={};S.forEach(function(o){by[o.k]=o});
 var cut=gr==='month'?7:10,a=since?String(since).slice(0,cut):S[0].k,first=S[0].k<a?S[0].k:a,last=S[S.length-1].k,td=jkd(0).slice(0,cut);if(td>last)last=td;
 var keys=mKeys({group:gr,from:first.length===7?first+'-01':first,to:last.length===7?last+'-01':last}),out=[];
 keys.forEach(function(k){out.push(by[k]||{k:k,lwbp:0,wbp:0,genset:0,air:0})});return out.length?out:S}
/* ---- pemeriksaan data meteran: berapa laporan yang terbaca & mana yang bermasalah ---- */
function mDiag(loc){var host=$('mres');if(!host)return;
 api('rep_export',{type:'meter',q:'',from:'',to:'',status:'',quiet:1}).then(function(x){if(!$('mres'))return;
  var items=(x&&x.items)||[],bad=[],ok=[],num=function(v){return v!=null&&v!==''&&isFinite(Number(v))};
  items.forEach(function(it){var d=it.data||{},lc=String(d.location||'').trim(),why='';
   if(!lc)why='lokasi kosong';else if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date||'')))why='tanggal tidak valid';
   else{var e=d.kind!=='Air'&&num(d.lwbp)&&num(d.wbp)&&num(d.genset),w=d.kind!=='Listrik'&&num(d.reading);if(!e&&!w)why='angka meteran kosong/tidak valid'}
   if(why)bad.push({id:it.id,why:why});else ok.push({id:it.id,date:d.date,time:d.time||'00:00',lk:String(d.location).trim().toLowerCase(),loc:String(d.location).trim(),d:d})});
  ok.sort(function(a,b){var p=a.date+' '+a.time,q=b.date+' '+b.time;return p<q?-1:p>q?1:a.id<b.id?-1:1});
  var last={},rst=[];
  ok.forEach(function(o){[['lwbp','LWBP'],['wbp','WBP'],['genset','Genset'],['reading','Air']].forEach(function(m){var v=o.d[m[0]];if(!num(v)||(m[0]!=='reading'&&o.d.kind==='Air')||(m[0]==='reading'&&o.d.kind==='Listrik'))return;v=Number(v);var k=o.lk+'|'+m[0];
   if(last[k]!==undefined&&v<last[k].v)rst.push({id:o.id,loc:o.loc,m:m[1],date:o.date,from:last[k].v,to:v});last[k]={v:v}})});
  var locs={};ok.forEach(function(o){locs[o.lk]=o.loc});var dates=ok.map(function(o){return o.date}).sort(),
   h='<div class="card mdiag"><b>Pemeriksaan data meteran</b><p>'+ok.length+' dari '+items.length+' laporan meteran terbaca'+(ok.length?' · '+Object.keys(locs).length+' lokasi · '+dd(dates[0])+' – '+dd(dates[dates.length-1]):'')+'.</p>'+
   (items.length?'':'<p class="mwarn">Backend tidak mengembalikan laporan meteran. Periksa URL API di config.js dan pastikan Code.gs terbaru sudah di-deploy ulang (Deploy &gt; Kelola deployment &gt; Edit &gt; Versi baru).</p>')+
   (bad.length?'<p class="mwarn">Tidak terbaca ('+bad.length+'): '+bad.slice(0,8).map(function(b){return esc(b.id)+' ('+b.why+')'}).join(', ')+(bad.length>8?' …':'')+'</p>':'')+
   (rst.length?'<p class="mwarn">Angka lebih kecil dari pencatatan sebelumnya (tidak dihitung sebagai pemakaian; periksa salah ketik atau meteran diganti): '+rst.slice(0,6).map(function(c){return esc(c.id)+' '+esc(c.loc)+' '+c.m+' '+mfmt(c.from)+' → '+mfmt(c.to)}).join('; ')+(rst.length>6?' …':'')+'</p>':'')+
   (ok.length&&!bad.length&&!rst.length?'<p class="mok">Semua laporan meteran terbaca dengan benar.</p>':'')+'</div>';
  window.__mdg=h;var o=$('mdiag');if(o)o.remove();var res=$('mres');res.insertAdjacentHTML('beforeend',h);res.lastChild.id='mdiag'}).catch(function(){})}

/* ---- laporan: daftar ---- */
function kl(d){return d.kind==='Gabungan'?'Listrik & Air':d.kind}
function mtr(d){var f=function(v,x){return v==null?'-':v+(x!=null?' (+'+x+')':'')},x=d.diffs||{};
 if(d.kind==='Gabungan')return 'LWBP '+f(d.lwbp,x.lwbp)+' · WBP '+f(d.wbp,x.wbp)+' · Genset '+f(d.genset,x.genset)+' kWh<br>Air '+f(d.reading,d.diff)+' m³';
 if(d.kind==='Listrik'){if(d.lwbp==null)return d.reading+' kWh (data lama)';return 'LWBP '+f(d.lwbp,x.lwbp)+' · WBP '+f(d.wbp,x.wbp)+' · Genset '+f(d.genset,x.genset)+' kWh'}
 return d.reading+' '+d.unit+(d.diff!=null?' (selisih '+d.diff+')':'')}
/* ---- Data Penonton: helper ringkasan, detail, ekspor ---- */
var AUD_SMAX=12,AUD_RMAX=15,AUD_REQ=5,AUD_STD=['Studio 1','Studio 2','Studio 3','Studio 4'];
function audN(v){return v===''||v==null||isNaN(v)?'':NF.format(+v)}
function audTot(d){var s=0,tk=0,pn=0;((d&&d.studios)||[]).forEach(function(a){(a.shows||[]).forEach(function(w){s++;tk+=+w.tiket||0;pn+=+w.penonton||0})});return {show:s,tiket:tk,penonton:pn}}
function audRows(d){var R=[];((d&&d.studios)||[]).forEach(function(a){(a.shows||[]).forEach(function(w){R.push([a.studio,w.show,w.film||'',w.jam||'',w.tiket===''||w.tiket==null?'':+w.tiket,w.penonton===''||w.penonton==null?'':+w.penonton,w.petugas||'',w.ket||''])})});return R}
function audSum(d){var o=audTot(d),sg=audStat(d),ov=audOverList(d).length;return (sg?stb(sg)+' ':'')+(ov?'<span class="st st-Rusak" title="Penonton masuk lebih besar dari tiket terjual">&#9888; '+ov+' show berlebih</span> ':'')+'<b>'+o.show+' show</b> · '+NF.format(o.tiket)+' tiket · '+NF.format(o.penonton)+' penonton<br><small>'+esc(((d.studios||[]).map(function(a){return a.studio})).join(', ')||'-')+'</small>'}
function audDetail(d){var o=audTot(d);
 var ovl=audOverList(d);return (ovl.length?'<div class="ac-errbox">&#9888; Penonton masuk melebihi tiket terjual pada '+ovl.length+' show: <b>'+esc(ovl.join('; '))+'</b></div>':'')+'<p class="acs"><b>Ringkasan:</b> '+o.show+' show · '+NF.format(o.tiket)+' tiket terjual · '+NF.format(o.penonton)+' penonton masuk</p>'+(d.studios||[]).map(function(a){var st=audTot({studios:[a]});
  return '<h4>'+esc(a.studio)+'</h4><div class="scroll"><table><tr><th>Show</th><th>Nama film</th><th>Jam</th><th>Tiket terjual</th><th>Penonton masuk</th><th>Petugas</th><th>Keterangan</th></tr>'+(a.shows||[]).map(function(w){return '<tr'+(audOver(w)?' class="aud-over-r"':'')+'><td>'+esc(w.show)+(audOver(w)?' <span title="Penonton melebihi tiket">&#9888;</span>':'')+'</td><td>'+esc(w.film||'-')+'</td><td>'+esc(w.jam||'-')+'</td><td>'+(audN(w.tiket)||'-')+'</td><td>'+(audN(w.penonton)||'-')+'</td><td>'+esc(w.petugas||'-')+'</td><td>'+esc(w.ket||'-')+'</td></tr>'}).join('')+'<tr><th colspan="3">Total '+esc(a.studio)+'</th><th>'+NF.format(st.tiket)+'</th><th>'+NF.format(st.penonton)+'</th><th colspan="2"></th></tr></table></div>'}).join('')}
/* susunan formulir: 4 studio x 5 show (sesuai lembar kerja), studio/show tambahan bersifat opsional */
function audLayout(d,saved){var by={},names=AUD_STD.slice();
 if(saved&&saved.length){return saved.map(function(p){var rows=[];for(var j=1;j<=p[1];j++)rows.push({show:'SHOW'+j});return {s:p[0],rows:rows}})}
 ((d&&d.studios)||[]).forEach(function(a){by[a.studio]=a.shows||[];if(names.indexOf(a.studio)<0)names.push(a.studio)});
 return names.map(function(nm){var m={},mx=5;(by[nm]||[]).forEach(function(w){m[w.show]=w;var k=+String(w.show).replace(/\D/g,'');if(k>mx)mx=k});
  var rows=[];for(var j=1;j<=mx;j++)rows.push(m['SHOW'+j]||{show:'SHOW'+j});return {s:nm,rows:rows}})}
function audRowHtml(w){var v=function(k){return w[k]==null?'':esc(w[k])},n=String(w.show).replace(/\D/g,'')||'0',x=(+n>5)?'<button type="button" class="aud-rm" aria-label="Hapus '+esc(w.show)+'">×</button>':'';
 return '<div class="aud-row" data-show="'+esc(w.show)+'"><b class="aud-n">'+esc(w.show)+x+'</b>'+
  '<label class="aud-f aud-film"><span>Nama film</span><input class="af-film" type="text" maxlength="200" autocomplete="off" value="'+v('film')+'"></label>'+
  '<label class="aud-f"><span>Jam show</span><input class="af-jam" type="time" value="'+v('jam')+'"></label>'+
  '<label class="aud-f"><span>Tiket terjual</span><input class="af-tiket" type="number" min="0" step="1" inputmode="numeric" value="'+v('tiket')+'"></label>'+
  '<label class="aud-f"><span>Penonton masuk</span><input class="af-pen" type="number" min="0" step="1" inputmode="numeric" value="'+v('penonton')+'"></label>'+
  '<label class="aud-f"><span>Petugas</span><input class="af-ptg" type="text" maxlength="100" autocomplete="off" value="'+v('petugas')+'"></label>'+
  '<label class="aud-f aud-ket"><span>Keterangan</span><input class="af-ket" type="text" maxlength="500" autocomplete="off" value="'+v('ket')+'"></label></div>'}
function audStudioHtml(st){var rm=AUD_STD.indexOf(st.s)<0;
 return '<section class="aud-st" data-s="'+esc(st.s)+'"><div class="aud-sh"><h4>'+esc(st.s)+'</h4><span class="aud-sum"></span>'+(rm?'<button type="button" class="btn sec aud-rs">Hapus studio</button>':'')+'</div>'+
  '<div class="aud-head" aria-hidden="true"><span>Show</span><span>Nama film</span><span>Jam show</span><span>Tiket terjual</span><span>Penonton masuk</span><span>Petugas</span><span>Keterangan</span></div>'+
  '<div class="aud-rows">'+st.rows.map(audRowHtml).join('')+'</div><button type="button" class="btn sec aud-as">+ Tambah show</button></section>'}
function audOver(w){var t=w&&w.tiket,p=w&&w.penonton;return t!==''&&t!=null&&p!==''&&p!=null&&!isNaN(t)&&!isNaN(p)&&+p>+t}
function audOverList(d){var L=[];((d&&d.studios)||[]).forEach(function(a){(a.shows||[]).forEach(function(w){if(audOver(w))L.push(a.studio+' '+w.show+': penonton '+NF.format(+w.penonton)+' > tiket '+NF.format(+w.tiket))})});return L}
function audStat(d){return d&&d.draft===true?'Draf':(d&&d.draft===false?'Terkirim':'')}
/* kelengkapan: SHOW1-5 tiap studio terisi (film, tiket, penonton). Mengembalikan {ok, miss, total} */
function audProg(root){var miss=0,total=0;
 [].forEach.call(root.querySelectorAll('.aud-st'),function(sec){[].forEach.call(sec.querySelectorAll('.aud-row'),function(r){var n=+String(r.dataset.show).replace(/\D/g,'')||0;if(n<1||n>AUD_REQ)return;total++;
  if(!r.querySelector('.af-film').value.trim()||r.querySelector('.af-tiket').value.trim()===''||r.querySelector('.af-pen').value.trim()==='')miss++})});
 return {ok:total>0&&miss===0,miss:miss,total:total}}
function audCollect(fm){var er='',studios=[];
 [].forEach.call(fm.querySelectorAll('.aud-st'),function(sec){var nm=sec.dataset.s,shows=[];
  [].forEach.call(sec.querySelectorAll('.aud-row'),function(r){var g=function(c){return r.querySelector(c).value.trim()},
   o={show:r.dataset.show,film:g('.af-film'),jam:g('.af-jam'),tiket:g('.af-tiket'),penonton:g('.af-pen'),petugas:g('.af-ptg'),ket:g('.af-ket')};
   if(!o.film&&!o.jam&&o.tiket===''&&o.penonton===''&&!o.petugas&&!o.ket)return;
   if(!er){if(!o.film)er='Nama film wajib diisi ('+nm+', '+o.show+').';else if((o.tiket!==''&&!/^\d+$/.test(o.tiket))||(o.penonton!==''&&!/^\d+$/.test(o.penonton)))er='Tiket terjual dan penonton masuk harus bilangan bulat 0 atau lebih ('+nm+', '+o.show+').'}
   shows.push(o)});
  if(shows.length)studios.push({studio:nm,shows:shows})});
 if(!er&&!studios.length)er='Isi minimal satu show (nama film) pada salah satu studio.';
 return {er:er,studios:studios}}
function audWire(fm){var au=$('aud'),tot=$('aud-tot'),hs=$('aud_struct'),add=$('aud-as');if(!au)return;
 var note=fm.elements.note&&fm.elements.note.closest('div');if(note)au.insertAdjacentElement('afterend',note);
 function num(el){var v=el.value.trim();return /^\d+$/.test(v)?+v:0}
 function sync(init){var T0=0,T1=0,T2=0,st=[];
  [].forEach.call(au.querySelectorAll('.aud-st'),function(sec){var rows=sec.querySelectorAll('.aud-row'),s0=0,s1=0,s2=0;
   [].forEach.call(rows,function(r){if(r.querySelector('.af-film').value.trim()||r.querySelector('.af-tiket').value!==''||r.querySelector('.af-pen').value!==''){s0++;s1+=num(r.querySelector('.af-tiket'));s2+=num(r.querySelector('.af-pen'))}});
   sec.querySelector('.aud-sum').textContent=s0?s0+' show · '+NF.format(s1)+' tiket · '+NF.format(s2)+' penonton':'Belum diisi';
   T0+=s0;T1+=s1;T2+=s2;st.push([sec.dataset.s,rows.length])});
  tot.textContent='Total: '+T0+' show · '+NF.format(T1)+' tiket terjual · '+NF.format(T2)+' penonton masuk';
  var js=JSON.stringify(st);if(hs.value!==js){hs.value=js;if(!init)fm.dispatchEvent(new Event('input',{bubbles:true}))}
  if(add)add.disabled=au.querySelectorAll('.aud-st').length>=AUD_SMAX;
  var ovl=[];[].forEach.call(au.querySelectorAll('.aud-st'),function(sec){[].forEach.call(sec.querySelectorAll('.aud-row'),function(r){var tk=r.querySelector('.af-tiket').value.trim(),pn=r.querySelector('.af-pen').value.trim(),o=/^\d+$/.test(tk)&&/^\d+$/.test(pn)&&+pn>+tk;r.classList.toggle('aud-over',o);if(o)ovl.push(sec.dataset.s+' '+r.dataset.show+': penonton '+NF.format(+pn)+' > tiket '+NF.format(+tk))})});
  var wn=$('aud-warn');if(wn){wn.style.display=ovl.length?'':'none';wn.innerHTML=ovl.length?'&#9888; Penonton masuk melebihi tiket terjual ('+ovl.length+' show): '+esc(ovl.join('; '))+'. Periksa kembali, atau jelaskan di Keterangan. Data tetap dapat disimpan.':''}
  var pg=audProg(au),sb=$('rsub'),pt=$('aud-prog');
  if(sb)sb.style.display=pg.ok?'':'none';
  if(pt)pt.textContent=pg.ok?'Semua show sudah terisi. Tombol Kirim tersedia di sebelah Simpan.':'Terisi '+(pg.total-pg.miss)+' dari '+pg.total+' show wajib (SHOW1 sampai SHOW5 tiap studio). Tombol Kirim muncul setelah semuanya terisi.'}
 au.addEventListener('input',function(){sync()});
 au.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var sec=b.closest('.aud-st');
  if(b.classList.contains('aud-as')){var rows=sec.querySelector('.aud-rows'),last=rows.lastElementChild,k=last?(+String(last.dataset.show).replace(/\D/g,'')||rows.children.length):0;
   if(rows.children.length>=AUD_RMAX){$('re').textContent='Maksimal '+AUD_RMAX+' show per studio.';return}
   rows.insertAdjacentHTML('beforeend',audRowHtml({show:'SHOW'+(k+1)}));$('re').textContent='';rows.lastElementChild.querySelector('.af-film').focus();sync()}
  else if(b.classList.contains('aud-rm')){b.closest('.aud-row').remove();sync()}
  else if(b.classList.contains('aud-rs')){var has=[].some.call(sec.querySelectorAll('input'),function(i){return i.value!==''});if(has&&!window.confirm('Hapus '+sec.dataset.s+' beserta isinya?'))return;sec.remove();sync()}});
 if(add)add.onclick=function(){var ss=au.querySelectorAll('.aud-st');if(ss.length>=AUD_SMAX){$('re').textContent='Maksimal '+AUD_SMAX+' studio.';return}
  var mx=0;[].forEach.call(ss,function(x){mx=Math.max(mx,+String(x.dataset.s).replace(/\D/g,'')||0)});
  var rows=[];for(var j=1;j<=5;j++)rows.push({show:'SHOW'+j});au.querySelector('#aud-list').insertAdjacentHTML('beforeend',audStudioHtml({s:'Studio '+(mx+1),rows:rows}));
  $('re').textContent='';var ns=au.querySelector('#aud-list').lastElementChild;ns.scrollIntoView({block:'center',behavior:'smooth'});sync()};
 sync(true)}
function sum(t,r){var d=r.data;return t==='issue'?esc(r.title)+'<br><small>'+esc(d.location)+' · '+esc(d.priority)+'</small> '+stb(d.status):t==='work'?esc(r.title)+'<br><small>'+esc(d.location)+'</small> '+stb(d.status):t==='meter'?esc(kl(d))+' – '+esc(d.location)+'<br><small>'+mtr(d)+'</small>':t==='ac'?'<div class="acsum">'+acBadges(d)+'<small>'+acLine(d)+'</small></div>':t==='audience'?audSum(d):t==='patrol'?esc(d.studios.map(function(a){return a.studio+': '+(a.status||'Belum diisi')}).join(' · '))+'<br><small>'+esc(d.otherInfo||d.note||'')+'</small>':esc(d.store)+'<br><small>'+RP.format(d.total)+' · '+d.items.length+' barang</small>'}
function fabMove(){var b=$('ra');if(b)b.classList.remove('fab')}if(!window.__fabrz){window.__fabrz=1;window.addEventListener('resize',function(){var b=document.getElementById('ra');if(!b)return;if(window.innerWidth>820){b.classList.remove('fab');var br=document.querySelector('#view .bar');if(br&&b.parentNode!==br)br.appendChild(b)}else{b.classList.add('fab');document.body.appendChild(b)}})}
function vRep(t){var s=ST[t]=ST[t]||{page:1,q:'',from:'',to:'',status:''},c=T[t];
 $('view').innerHTML='<h2>'+c.label+'</h2><div class="bar"><input id="rq" type="search" placeholder="Cari nomor, judul, lokasi, atau pelapor" value="'+esc(s.q)+'"><label class="fl">Dari tanggal<input type="date" id="rf" value="'+esc(s.from)+'"></label><label class="fl">Sampai tanggal<input type="date" id="rt" value="'+esc(s.to)+'"></label>'+(t==='work'||t==='issue'?'<select id="rs"><option value="">Semua status</option>'+(t==='issue'?IST:WS).map(function(o){return '<option'+(o===s.status?' selected':'')+'>'+o+'</option>'}).join('')+'</select>':'')+'<button class="btn sec" id="rg">Cari</button>'+(U.role==='REPORTER'?'':'<div class="dlw"><button type="button" class="btn sec" data-dlt aria-haspopup="menu" aria-expanded="false">Download</button><div class="dlm hidden" role="menu"><button type="button" role="menuitem" id="rx">Excel (.xlsx)</button><button type="button" role="menuitem" id="rpdf">PDF (.pdf)</button></div></div>')+'<button class="btn" id="ra">'+esc(RA_LBL[t]||'Buat laporan')+'</button></div>'+(t==='meter'?'<div id="mstat"></div>':'')+'<div id="rl">'+OOS.skel('list')+'</div>';
 function load(){s.q=$('rq').value;s.from=$('rf').value;s.to=$('rt').value;s.status=$('rs')?$('rs').value:'';
  api('rep_list',{type:t,q:s.q,from:s.from,to:s.to,status:s.status,page:s.page}).then(function(r){
   $('rl').className='';$('rl').innerHTML=r.items.length?'<div class="scroll cards"><table class="rt"><tr><th>No. Laporan</th><th>Waktu</th><th>Ringkasan</th><th>Pelapor</th><th>Aksi</th></tr>'+r.items.map(function(x){return '<tr><td data-l="No. laporan">'+esc(x.id)+'</td><td data-l="Waktu">'+dt(x.createdAt)+'</td><td class="sm">'+sum(t,x)+'</td><td data-l="Pelapor">'+esc(x.reporter)+'</td><td class="act"><button class="btn sec" data-d="'+x.id+'">Lihat detail</button></td></tr>'}).join('')+'</table></div><div class="pg"><button class="btn sec" id="pp"'+(r.page<2?' disabled':'')+'>‹</button> Hal. '+r.page+' / '+Math.ceil(r.total/r.size)+' ('+r.total+') <button class="btn sec" id="pn"'+(r.page*r.size>=r.total?' disabled':'')+'>›</button></div>':'<div class="empty"><b>Belum ada laporan</b>Ubah filter pencarian atau klik "'+(RA_LBL[t]||'Buat laporan')+'" untuk mulai mencatat.</div>';
   document.querySelectorAll('[data-d]').forEach(function(b){b.onclick=function(){detail(b.dataset.d,load)}});
   if($('pp')){$('pp').onclick=function(){s.page--;load()};$('pn').onclick=function(){s.page++;load()}}}).catch(function(x){$('rl').className='empty';$('rl').innerHTML=esc(x.message)+'<br><br><button class="btn" id="rr">Coba lagi</button>';$('rr').onclick=load})}
 $('rg').onclick=function(){s.page=1;load()};$('ra').onclick=function(){repForm(t,null,load)};if($('rx'))$('rx').onclick=function(){exportXls(t)};if($('rpdf'))$('rpdf').onclick=function(){exportXls(t,'pdf')};if(t==='meter')meterPanel();fabMove();load()}


/* ---- unduh Excel per kategori (mengikuti filter yang sedang aktif) ---- */
function exportXls(t,fmt,ov){
 var pdf=fmt==='pdf';
 if(pdf?!(window.jspdf&&window.jspdf.jsPDF):typeof XLSX==='undefined'){toast('Library '+(pdf?'PDF':'Excel')+' belum termuat. Periksa koneksi internet lalu muat ulang halaman.',1);return}
 var b=ov?ov.btn:$(pdf?'rpdf':'rx'),b0=b.textContent,FT=ov?ov.FT:fltTxt();b.disabled=true;b.textContent='Menyiapkan...';
 return (ov?Promise.resolve({items:ov.items}):api('rep_export',{type:t,q:$('rq').value,from:$('rf').value,to:$('rt').value,status:$('rs')?$('rs').value:''})).then(function(r){
  if(!r.items.length){toast('Tidak ada data untuk diunduh.',1);return}
  return (ov?Promise.resolve({g:{},lost:0,n:0}):gatherPhotos(r.items.slice().reverse(),function(n,tt){b.textContent='Memuat foto '+n+'/'+tt+'...'})).then(function(G){b.textContent='Membuat file...';return (function(){
  if(pdf)return pdfOut(t,r.items.slice().reverse(),FT,G.g,G.lost);
  var it=r.items.slice().reverse(),wb=XLSX.utils.book_new(),n=function(v){return v==null?'':v},W=t==='work';
  var lk=function(u,l){return u?{t:'s',v:l,l:{Target:u}}:''};
  var pH=W?['Jumlah Foto','Foto Before','Foto After','Folder Foto','ZIP Foto']:['Jumlah Foto','Foto Pertama','Folder Foto','ZIP Foto'],pW=W?[11,13,13,16,14]:[11,13,16,14];
  var pC=function(x){var p=x.ph||{};return W?[p.n||0,lk(p.before,'Buka foto'),lk(p.after,'Buka foto'),lk(p.folder,'Buka folder'),lk(p.zip,'Unduh ZIP')]:[p.n||0,lk(p.first,'Buka foto'),lk(p.folder,'Buka folder'),lk(p.zip,'Unduh ZIP')]};
  var add=function(name,head,list,fn,w,ph){var hd=ph?head.concat(pH):head,rows=list.map(function(x){var a=fn(x);return ph?a.concat(pC(x)):a});var ws=XLSX.utils.aoa_to_sheet([[T[t].label+' - NOVA'],['Tanggal ekspor: '+exTs()+(FT?' | Filter: '+FT:'')],[],hd].concat(rows));ws['!cols']=(ph?w.concat(pW):w).map(function(x){return {wch:x}});ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:hd.length-1}},{s:{r:1,c:0},e:{r:1,c:hd.length-1}}];ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:3,c:0},e:{r:3+rows.length,c:hd.length-1}})};XLSX.utils.book_append_sheet(wb,ws,name)};
  if(t==='work'){
   add('Laporan Pekerjaan',['No. Laporan','Tanggal','Jam','Judul Pekerjaan','Kategori','Lokasi','Status','Tim','Deskripsi','Catatan','Pelapor','Dibuat','Diubah'],it,
    function(x){var d=x.data;return [x.id,d.date,d.time,d.title,d.category,d.location,d.status,(d.team||[]).join(', '),d.desc,d.note,x.reporter,dt(x.createdAt),dt(x.updatedAt)]},
    [22,12,8,32,22,24,16,28,45,30,16,20,20],1);
  }else if(t==='meter'){
   var L=it.filter(function(x){return x.data.kind==='Listrik'}),A=it.filter(function(x){return x.data.kind==='Air'}),GB=it.filter(function(x){return x.data.kind==='Gabungan'});
   if(GB.length)add('Listrik & Air',['No. Laporan','Tanggal','Jam','Lokasi','LWBP (kWh)','WBP (kWh)','Genset (kWh)','Selisih LWBP','Selisih WBP','Selisih Genset','Meteran Air (m³)','Air Sebelumnya','Selisih Air (m³)','Catatan','Pelapor','Dibuat'],GB,
    function(x){var d=x.data,f=d.diffs||{};return [x.id,d.date,d.time,d.location,n(d.lwbp),n(d.wbp),n(d.genset),n(f.lwbp),n(f.wbp),n(f.genset),n(d.reading),n(d.prev),n(d.diff),n(d.note),x.reporter,dt(x.createdAt)]},
    [22,12,8,26,13,13,14,13,13,15,16,15,15,30,16,20],1);
   if(L.length)add('Listrik',['No. Laporan','Tanggal','Jam','Lokasi','LWBP (kWh)','WBP (kWh)','Genset (kWh)','Selisih LWBP','Selisih WBP','Selisih Genset','Catatan','Pelapor','Dibuat'],L,
    function(x){var d=x.data,f=d.diffs||{},old=d.lwbp==null&&d.reading!=null?'Data lama: '+d.reading+' kWh'+(d.meterNo?' (meteran '+d.meterNo+')':'')+(d.note?' | ':''):'';
     return [x.id,d.date,d.time,d.location,n(d.lwbp),n(d.wbp),n(d.genset),n(f.lwbp),n(f.wbp),n(f.genset),old+n(d.note),x.reporter,dt(x.createdAt)]},
    [22,12,8,26,13,13,14,13,13,15,30,16,20],1);
   if(A.length)add('Air',['No. Laporan','Tanggal','Jam','Lokasi','Angka Meteran (m³)','Angka Sebelumnya','Selisih (m³)','Catatan','Pelapor','Dibuat'],A,
    function(x){var d=x.data;return [x.id,d.date,d.time,d.location,n(d.reading),n(d.prev),n(d.diff),n(d.note),x.reporter,dt(x.createdAt)]},
    [22,12,8,26,18,17,13,30,16,20],1);
  }else if(t==='ac'){
   var fl=[];it.forEach(function(x){acRowsOf(x.data).forEach(function(a){fl.push({id:x.id,reporter:x.reporter,createdAt:x.createdAt,ph:x.ph,data:{date:x.data.date,time:x.data.time,note:x.data.note,a:a,std:x.data.tempStd,rep:acTxt(x.data)}})})});
   add('Daily Monitoring AC',['No. Laporan','Tanggal','Jam','Area / Ruangan','Merk AC','Suhu AC (°C)','Status Suhu','Status Laporan','Standar Suhu (°C)','Catatan Area','Catatan Umum','Pelapor','Dibuat'],fl,
    function(x){var d=x.data,a=d.a;return [x.id,d.date,d.time,a.location,a.unit,acCnd(a)?ACCND[a.cond]:n(a.roomTemp),tsl(acSt(a,{tempStd:d.std})),d.rep,d.std?d.std.min+' - '+d.std.max:'',n(a.note),n(d.note),x.reporter,dt(x.createdAt)]},
    [22,12,8,18,12,13,16,24,17,28,30,16,20],1);
  }else if(t==='issue'){
   add('Perlu Diperbaiki',['No. Laporan','Tanggal','Jam','Judul Masalah','Lokasi','Prioritas','Status','Uraian','Tanggapan','Pelapor','Dibuat','Diubah'],it,
    function(x){var d=x.data;return [x.id,d.date,d.time,d.title,d.location,d.priority,d.status,d.desc,(d.responses||[]).map(function(r){return dt(r.at)+' | '+r.by+' | '+r.status+' | '+r.text}).join('\n'),x.reporter,dt(x.createdAt),dt(x.updatedAt)]},
    [22,12,8,32,22,12,18,45,60,16,20,20],1);
  }else if(t==='audience'){
   var fa=[];it.forEach(function(x){audRows(x.data).forEach(function(r){fa.push({id:x.id,reporter:x.reporter,createdAt:x.createdAt,ph:x.ph,st:audStat(x.data)||'Terkirim',data:{date:x.data.date,note:x.data.note,r:r}})})});
   add('Data Penonton',['No. Laporan','Tanggal','Studio','Show','Nama Film','Jam Show','Tiket Terjual','Penonton Masuk','Petugas','Keterangan','Catatan Laporan','Pelapor','Dibuat','Status','Peringatan'],fa,
    function(x){var d=x.data,r=d.r;return [x.id,d.date,r[0],r[1],r[2],r[3],r[4],r[5],r[6],r[7],n(d.note),x.reporter,dt(x.createdAt),x.st||'Terkirim',audOver({tiket:r[4],penonton:r[5]})?'Penonton melebihi tiket':'']},
    [22,12,12,10,32,10,14,16,20,30,30,16,20,12,24],1);
  }else{
   add('Laporan Pembelian',['No. Laporan','Tanggal','Jam','Toko / Pemasok','Pembeli','Penerima','Keperluan','Jumlah Item','Total (Rp)','Catatan','Pelapor','Dibuat'],it,
    function(x){var d=x.data;return [x.id,d.date,d.time,d.store,d.buyer,d.receiver,d.purpose,(d.items||[]).length,d.total,d.note,x.reporter,dt(x.createdAt)]},
    [22,12,8,28,18,18,26,12,14,30,16,20],1);
   var rows=[];it.forEach(function(x){(x.data.items||[]).forEach(function(i){rows.push([x.id,x.data.date,x.data.store,i.name,n(i.category),i.qty,n(i.unit),i.price,i.total])})});
   add('Rincian Barang',['No. Laporan','Tanggal','Toko / Pemasok','Nama Barang','Kategori','Jumlah','Satuan','Harga Satuan (Rp)','Total (Rp)'],rows,function(a){return a},[22,12,28,34,20,10,10,18,14],0);
  }
  var nm={work:'Pekerjaan',meter:'Meteran',ac:'Monitoring_AC',purchase:'Pembelian',audience:'Data_Penonton',issue:'Perbaikan'}[t];
  return xlsFinish(wb,it,G,'Laporan_'+nm+'_'+new Date(now()+7*36e5).toISOString().slice(0,10)+'.xlsx').then(function(){toast('File Excel berhasil dibuat ('+it.length+' laporan'+(G.n?', '+G.n+' foto':'')+').'+(G.lost?' '+G.lost+' foto gagal dimuat.':''),!!G.lost)});
 })()});
 }).catch(function(x){toast(x.message,1)}).then(function(){b.disabled=false;b.textContent=b0})}

/* ---- ekspor: ringkasan filter, PDF ---- */
function exTs(){return F1.format(new Date())+' WIB'}
function fltTxt(){var a=[],q=$('rq').value.trim(),f=$('rf').value,to=$('rt').value,s=$('rs')?$('rs').value:'';if(f||to)a.push('Periode: '+(f?dd(f):'awal')+' s.d. '+(to?dd(to):'sekarang'));if(s)a.push('Status: '+s);if(q)a.push('Pencarian: '+q);return a.join(' | ')}
function pdfOut(t,it,FT,G,L){
 var J=window.jspdf.jsPDF,doc=new J({orientation:'landscape',unit:'mm',format:'a4'}),n=function(v){return v==null?'':v},H,R,sub='',OV=[];
 if(t==='work'){H=['No. Laporan','Tanggal','Jam','Judul Pekerjaan','Kategori','Lokasi','Status','Tim','Pelapor'];R=it.map(function(x){var d=x.data;return [x.id,d.date,n(d.time),d.title,d.category,d.location,d.status,(d.team||[]).join(', '),x.reporter]})}
 else if(t==='meter'){H=['No. Laporan','Tanggal','Jam','Lokasi','LWBP (kWh)','WBP (kWh)','Genset (kWh)','Air (m\u00B3)','Pelapor'];R=it.map(function(x){var d=x.data;return [x.id,d.date,n(d.time),d.location,mfmt(d.lwbp),mfmt(d.wbp),mfmt(d.genset),d.kind==='Listrik'?'-':mfmt(d.reading),x.reporter]})}
 else if(t==='ac'){H=['No. Laporan','Tanggal','Jam','Area / Ruangan','Merk AC','Suhu (\u00B0C)','Status Suhu','Catatan','Pelapor'];R=[];
  it.forEach(function(x){acRowsOf(x.data).forEach(function(a){R.push([x.id,x.data.date,n(x.data.time),a.location,a.unit,acCnd(a)?ACCND[a.cond]:(a.roomTemp===''||a.roomTemp==null?'':NF.format(a.roomTemp)),TSP[acSt(a,x.data)],[a.note,x.data.note].filter(Boolean).join(' | '),x.reporter])})});
  if(it.length&&it[0].data.tempStd)sub='Standar suhu: '+NF.format(it[0].data.tempStd.min)+' - '+NF.format(it[0].data.tempStd.max)+' \u00B0C'}
 else if(t==='issue'){H=['No. Laporan','Tanggal','Judul Masalah','Lokasi','Prioritas','Status','Pelapor'];R=it.map(function(x){var d=x.data;return [x.id,d.date,d.title,d.location,d.priority,d.status,x.reporter]})}
 else if(t==='audience'){H=['No. Laporan','Tanggal','Status','Studio','Show','Nama Film','Jam','Tiket Terjual','Penonton Masuk','Petugas','Keterangan'];R=[];
  it.forEach(function(x){audRows(x.data).forEach(function(r){OV.push(audOver({tiket:r[4],penonton:r[5]}));R.push([x.id,x.data.date,audStat(x.data)||'Terkirim',r[0],r[1],r[2],r[3],audN(r[4]),audN(r[5]),r[6],r[7]])})});
  var ta=it.reduce(function(a,x){var o=audTot(x.data);return {t:a.t+o.tiket,p:a.p+o.penonton}},{t:0,p:0});sub='Total tiket terjual: '+NF.format(ta.t)+'  |  Total penonton masuk: '+NF.format(ta.p);var nov=OV.filter(Boolean).length;if(nov)sub+='  |  PERINGATAN: '+nov+' show penonton melebihi tiket (baris merah)'}
 else{H=['No. Laporan','Tanggal','Toko / Pemasok','Pembeli','Keperluan','Jumlah Item','Total'];R=it.map(function(x){var d=x.data;return [x.id,d.date,d.store,d.buyer,n(d.purpose),(d.items||[]).length,RP.format(d.total)]})}
 var NP=window.NovaPDF,HD=NP.HEAD,FT=NP.FOOT,W=doc.internal.pageSize.getWidth(),Hh=doc.internal.pageSize.getHeight(),y=HD+9;
 R=R.map(function(r){return r.map(NP.clean)});H=H.map(NP.clean);
 doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(30,27,46);
 doc.text('Tanggal ekspor: '+exTs()+'  |  Diekspor oleh: '+U.name+'  |  Jumlah data: '+R.length,10,y);
 if(FT){y+=5;doc.text('Filter: '+FT,10,y)}
 if(sub){y+=5;doc.text(sub,10,y)}
 doc.autoTable({head:[H],body:R,startY:y+4,margin:{top:HD+6,right:10,bottom:FT+2,left:10},theme:'grid',styles:{fontSize:8,cellPadding:1.8,overflow:'linebreak',valign:'top'},headStyles:{fillColor:[37,22,79],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[246,244,252]},showHead:'everyPage',rowPageBreak:'avoid',didParseCell:function(h){if(t==='audience'&&h.section==='body'&&OV[h.row.index]){h.cell.styles.fillColor=[253,226,226];if(h.column.index===7||h.column.index===8){h.cell.styles.fontStyle='bold';h.cell.styles.textColor=[176,30,30]}}if(t==='ac'&&h.section==='body'&&h.column.index===6){var v=String(h.cell.raw);h.cell.styles.fontStyle='bold';h.cell.styles.textColor=/WARM/.test(v)?[176,30,30]:/COLD/.test(v)?[122,91,0]:/APPROVED/.test(v)?[15,110,60]:[90,90,90]}}});
 var g=G||{},gids=it.filter(function(x){return g[x.id]&&g[x.id].length}),nph=gids.reduce(function(s,x){return s+g[x.id].length},0);
 if(gids.length){var GM=10,GBOT=Hh-FT-2,yy=doc.lastAutoTable.finalY+8;
  if(yy+8+7+42+9>GBOT){doc.addPage();yy=HD+8}
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(0);doc.text('Lampiran Foto Dokumentasi',GM,yy+4);yy+=9;
  gids.forEach(function(x){var im=g[x.id],gt=x.id+' - '+String(x.title||'').slice(0,90)+' ('+im.length+' foto)';
   var gl=im.map(function(q,k){return {data:q.data,w:q.w,h:q.h,p:q.p,k:k}});
   var rr=NP.photoFlow(doc,gl,{x:GM,y:yy,w:W-2*GM,top:HD+6,bottom:GBOT,maxCols:4,target:60,hmax:90,capH:6,headH:7,
    drawHead:function(y0){doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(0);doc.text(gt,GM,y0+4)},
    caption:function(q,k,cx,cy,cw){doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(0);doc.text('Foto '+(k+1)+' - '+((q.p&&q.p.kind)||'Foto'),cx,cy+3.5,{maxWidth:cw})}});
   yy=rr.y+2})}
 NP.stamp(doc,{title:T[t].label,id:R.length+' data',user:U.name,margin:10});
 var nm={work:'Pekerjaan',meter:'Meteran',ac:'Monitoring_AC',purchase:'Pembelian',audience:'Data_Penonton',issue:'Perbaikan'}[t];
 doc.save(uniq_('Laporan_'+nm+'_'+new Date(now()+7*36e5).toISOString().slice(0,10)+'.pdf'));
 toast('File PDF berhasil dibuat ('+it.length+' laporan'+(nph?', '+nph+' foto':'')+').'+(L?' '+L+' foto gagal dimuat.':''),!!L)}

/* ---- laporan: detail ---- */
function detail(id,after){modal(window.OOS?OOS.skel('detail'):'<div class="empty">Memuat...</div>');api('rep_get',{id:id}).then(function(r){var t=r.type,d=r.data||{},h='<h3>'+T[t].label+'<span class="mid">'+esc(r.id)+'</span></h3><table>';
 T[t].f.forEach(function(f){if(f[5])return;if(d[f[0]]!==''&&d[f[0]]!=null)h+='<tr><th>'+f[1]+'</th><td>'+(f[0]==='status'?stb(d[f[0]]):esc(d[f[0]]))+'</td></tr>'});
 if(t==='issue')h+='<tr><th>Status perbaikan</th><td>'+stb(d.status)+'</td></tr>';
 if(t==='work')h+='<tr><th>Anggota tim</th><td>'+esc((d.team||[]).join(', ')||'-')+'</td></tr>';
 if(t==='meter'){h+='<tr><th>Jenis laporan</th><td>'+esc(kl(d))+'</td></tr>';if(d.meterNo)h+='<tr><th>Nomor meteran (data lama)</th><td>'+esc(d.meterNo)+'</td></tr>'}
 if(t==='audience'&&audStat(d))h+='<tr><th>Status data</th><td>'+stb(audStat(d))+(d.submittedAt?' <small>dikirim '+dt(d.submittedAt)+'</small>':'')+'</td></tr>';h+='<tr><th>Pelapor</th><td>'+esc(r.reporter)+'</td></tr><tr><th>Dibuat</th><td>'+dt(r.createdAt)+'</td></tr><tr><th>Diubah</th><td>'+dt(r.updatedAt)+'</td></tr></table>';
 if(t==='meter')h+=meterDetail(d);
 if(t==='patrol')h+='<div class="scroll"><table><tr><th>Studio</th><th>Status / kondisi</th><th>Catatan</th></tr>'+(d.studios||[]).map(function(a){return '<tr><td>'+esc(a.studio)+'</td><td>'+esc(a.status||'-')+'</td><td>'+esc(a.note||'-')+'</td></tr>'}).join('')+'</table></div><h4>Informasi lainnya</h4><p>'+esc(d.otherInfo||'-')+'</p>';
 if(t==='audience')h+=audDetail(d);
 if(t==='ac')h+='<p class="acs"><b>Status suhu laporan:</b> '+acBadges(d)+'</p>'+(acErrList(d).length?'<div class="ac-errbox">&#9888; AC error di: <b>'+esc(acErrList(d).join(', '))+'</b></div>':'')+'<div class="scroll"><table><tr><th>Area</th><th>Merk</th><th>Suhu</th><th>Status</th><th>AC Eror</th><th>Catatan</th></tr>'+acRowsOf(d).map(function(a){return '<tr><td>'+esc(a.location)+'</td><td>'+esc(a.unit)+'</td><td>'+(acCnd(a)?esc(ACCND[a.cond]):esc(a.roomTemp)+' °C')+'</td><td>'+(tsb(acSt(a,d))||'-')+'</td><td>'+(acErr(a)?'<span class="st ts-err">Ya</span>':'Tidak')+'</td><td>'+esc(a.note||'-')+'</td></tr>'}).join('')+'</table></div>'+(d.tempStd?'<small class="mnote">Standar suhu: '+esc(d.tempStd.min)+' - '+esc(d.tempStd.max)+' °C. Status dihitung otomatis oleh server.</small>':'');
 if(t==='purchase')h+='<div class="scroll"><table><tr><th>Barang</th><th>Jml</th><th>Harga</th><th>Total</th></tr>'+(d.items||[]).map(function(i){return '<tr><td>'+esc(i.name)+'<br><small>'+esc(i.category)+'</small></td><td>'+esc(i.qty)+' '+esc(i.unit)+'</td><td>'+RP.format(i.price)+'</td><td>'+RP.format(i.total)+'</td></tr>'}).join('')+'<tr><th colspan="3">Total transaksi</th><th>'+RP.format(d.total)+'</th></tr></table></div>';
 var gk=t==='issue'?[['Masalah','Foto masalah'],['Penyelesaian','Foto penyelesaian']]:t==='work'?[['Sebelum','Sebelum (Before)'],['Sesudah','Sesudah (After)'],['Foto','Lainnya']]:t==='ac'?(r.photos||[]).map(function(p){return p.kind||'Foto'}).filter(function(k,i,a){return a.indexOf(k)===i}).map(function(k){return [k,k==='Foto'?'Foto':'Foto area '+k]}):[['','Foto']];
 if(t==='ac')h+=acGal(r);else h+='<div id="gal">'+gk.map(function(g){var ps=(r.photos||[]).filter(function(p){return (t==='issue'&&(p.kind||'Masalah')===g[0])||(t!=='work'&&t!=='ac'&&t!=='issue')||(t==='ac'&&(p.kind||'Foto')===g[0])||(t==='work'&&p.kind===g[0])||(g[0]==='Foto'&&p.kind!=='Sebelum'&&p.kind!=='Sesudah')});return ps.length?'<div class="gg"><b>'+g[1]+'<span>'+ps.length+'</span></b><div class="ph">'+ps.map(function(p){return '<figure><img loading="lazy" data-p="'+p.id+'" data-u="'+esc(p.url||'')+'" alt="Foto dokumentasi" title="Klik untuk memperbesar"><figcaption>Waktu dokumentasi: '+dt(p.capturedAt||p.uploadedAt)+'</figcaption></figure>'}).join('')+'</div></div>':''}).join('')+'</div>';
 var np=(r.photos||[]).length;if(np)h+='<div class="zipbar"><span>'+np+' foto'+(np>10?' · ZIP dibuat otomatis':'')+'</span><button type="button" class="btn sec" id="dz">Unduh semua foto (ZIP)</button>'+(r.folder?'<a class="btn sec" href="'+esc(r.folder)+'" target="_blank" rel="noopener">Buka folder Drive</a>':'')+'</div>';
 if(t==='issue'){
  h+='<h4 style="margin:14px 0 6px">Tanggapan dan penyelesaian</h4>'+((d.responses||[]).length?d.responses.map(function(x){return '<div class="rsp"><b>'+esc(x.by)+'</b> '+stb(x.status)+'<br>'+esc(x.text).replace(/\n/g,'<br>')+'<br><small>'+dt(x.at)+'</small></div>'}).join(''):'<div class="info">Belum ada tanggapan. Teknisi yang melihat laporan ini dapat menanggapinya.</div>');
  if(U.role!=='REPORTER'){var nx=d.status==='Ditanggapi'?'Sedang Dikerjakan':d.status==='Sedang Dikerjakan'?'Selesai':'Ditanggapi';
   h+='<form id="rpf" class="acr"><label>Tanggapan / tindakan yang dilakukan *</label><textarea id="rpt" rows="3" required></textarea><label>Status</label><select id="rps">'+['Ditanggapi','Sedang Dikerjakan','Selesai'].map(function(o){return '<option'+(o===nx?' selected':'')+'>'+o+'</option>'}).join('')+'</select><label>Foto penyelesaian (opsional)</label><input type="file" id="rpp" accept="image/jpeg,image/png,image/webp" multiple><div class="merr" id="rpe"></div><button class="btn" id="rpb">Kirim tanggapan</button></form>'}
 }
 var left=r.remainMs,t0=Date.now();
 if(t==='audience'&&d.draft===true&&r.editable)h+='<div class="info">Ini draf'+(r.own?'':' milik '+esc(r.reporter)+'. Semua akun selain Pelapor boleh melengkapi dan mengubahnya')+'. Anda dapat mengubahnya kapan saja sebelum dikirim. Pilih Edit; tombol Kirim muncul di sebelah Simpan setelah SHOW1 sampai SHOW5 semua studio terisi. Draf tetap dapat dilihat dan diunduh.</div>';else if(U.role!=='ADMIN'&&r.own)h+=r.editable?'<div class="info">Anda dapat mengedit laporan ini selama 30 menit setelah '+(t==='audience'?'data dikirim':'laporan berhasil disimpan')+'. Sisa: <b id="lf"></b></div>':'<div class="info">Batas waktu edit telah berakhir. Hubungi Admin jika diperlukan koreksi.</div>';
 h+='<div class="zipbar"><span>Bukti laporan + foto dokumentasi</span><div class="dlw"><button type="button" class="btn" data-dlt aria-haspopup="menu" aria-expanded="false">Download</button><div class="dlm hidden" id="dlm" role="menu"><button type="button" role="menuitem" id="dpdf">Dokumen PDF (.pdf)</button><button type="button" role="menuitem" id="dxl">Spreadsheet Excel (.xlsx)</button></div></div></div><div class="macts fact">'+(r.editable?'<button class="btn" id="de">Edit</button> ':'')+(U.role==='ADMIN'?'<button class="btn sec" id="dx">Arsipkan</button> ':'')+'<button class="btn sec" id="dc">Tutup</button></div>';
 modal(h);$('dc').onclick=closeM;if(t==='meter')meterCum(d);
if($('rpf'))$('rpf').onsubmit=function(e){e.preventDefault();var b=$('rpb'),fs=[].slice.call($('rpp').files),phs=[],bad=0;b.disabled=true;b.textContent='Mengirim...';$('rpe').textContent='';
  fs.reduce(function(p,f){return p.then(function(){return comp(f).then(function(x){x.kind='Penyelesaian';phs.push(x)},function(){bad++})})},Promise.resolve())
  .then(function(){return api('resp_save',{id:r.id,text:$('rpt').value,status:$('rps').value})})
  .then(function(){return upPh(r.id,phs,function(n){upTxt(b,n,phs.length)})})
  .then(function(f){toast(f?'Tanggapan tersimpan, tetapi '+f+' foto gagal diunggah.':(bad?'Tanggapan tersimpan; '+bad+' file foto ditolak.':'Tanggapan tersimpan.'),!!(f||bad));detail(r.id,after);if(after)after()})
  .catch(function(x){$('rpe').textContent=x.message;upOff(b);b.disabled=false;b.textContent='Kirim tanggapan'})};
  if($('dpdf'))$('dpdf').onclick=function(){$('dlm').classList.add('hidden');repDoc(r,'pdf')};if($('dxl'))$('dxl').onclick=function(){$('dlm').classList.add('hidden');repDoc(r,'xlsx')};
 if($('dz'))$('dz').onclick=function(){var bz=this;bz.disabled=true;bz.textContent='Menyiapkan ZIP...';api('rep_zip',{id:r.id}).then(function(z){toast('ZIP siap diunduh ('+z.count+' foto).');location.href=z.url}).catch(function(x){toast(x.message,1)}).then(function(){bz.disabled=false;bz.textContent='Unduh semua foto (ZIP)'})};
 document.querySelectorAll('#gal img').forEach(function(i){fillImg(i,'photo');i.onclick=function(){if(i.dataset.ok)lightbox(i.src)}});
 if($('lf')){var iv=setInterval(function(){var m=left-(Date.now()-t0);if(!$('lf')||m<=0){clearInterval(iv);if($('de')&&U.role!=='ADMIN')$('de').disabled=true;if($('lf'))$('lf').textContent='habis';return}$('lf').textContent=p2(Math.floor(m/60000))+':'+p2(Math.floor(m/1000)%60)},1000)}
 if($('de'))$('de').onclick=function(){repForm(t,r,after)};
 if($('dx'))$('dx').onclick=function(){var why=prompt('Arsipkan '+r.id+' ('+T[t].label+')? Alasan:');if(why===null)return;api('rep_del',{id:r.id,reason:why}).then(function(){closeM();toast('Laporan diarsipkan.');after&&after()}).catch(function(x){toast(x.message,1)})}
 }).catch(function(x){closeM();toast(x.message,1)})}

/* ---- unduh satu laporan + foto dokumentasi (PDF / Excel), sebagai bukti ---- */
/* nama unik per unduhan: waktu + penghitung sesi, sehingga unduhan berulang/bersamaan tidak pernah sama namanya */
var UQ_=0;function uniq_(n){var d=new Date(),p=function(x){return String(x).padStart(2,'0')},e=n.match(/\.[a-z]+$/)[0];return n.slice(0,-e.length)+'_'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds())+'-'+(++UQ_)+e}
function dlBlob(b,n){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=uniq_(n);document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},4000)}
function imgNorm(src){return new Promise(function(ok,no){var im=new Image();im.onload=function(){var s=Math.min(1,1100/Math.max(im.width,im.height)),c=document.createElement('canvas'),x;c.width=Math.max(1,Math.round(im.width*s));c.height=Math.max(1,Math.round(im.height*s));x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);ok({data:c.toDataURL('image/jpeg',.85),w:c.width,h:c.height})};im.onerror=function(){no(new Error('Foto tidak dapat dibaca'))};im.src=src})}
function fitBox(g,mw,mh){var s=Math.min(mw/g.w,mh/g.h);return {w:g.w*s,h:g.h*s}}
function fitPx(g,mw,mh){var s=Math.min(mw/g.w,mh/g.h);return {w:Math.round(g.w*s),h:Math.round(g.h*s)}}
function rowsFor(h){return Math.ceil(h/20)+2}
function repPhotos(r,prog){var RK={Sebelum:0,Sesudah:1,Masalah:0,Penyelesaian:1},
 ps=(r.photos||[]).map(function(p,i){return {p:p,i:i}}).sort(function(a,b){var x=RK[a.p.kind],y=RK[b.p.kind];x=x==null?5:x;y=y==null?5:y;return x-y||a.i-b.i}).map(function(o){return o.p});
 function one(p){var k='photo:'+p.id;return (IMGC[k]?Promise.resolve(IMGC[k]):api('img',{kind:'photo',id:p.id,quiet:1}).then(function(u){var s=imgSrc(u);if(!s)throw new Error('kosong');IMGC[k]=s;return s})).then(imgNorm).then(function(x){x.p=p;return x},function(){return null})}
 return new Promise(function(res){var out=[],nx=0,run=0,dn=0;function pump(){while(run<3&&nx<ps.length){(function(n){run++;one(ps[n]).then(function(x){out[n]=x;run--;dn++;if(prog)prog(dn,ps.length);pump()})})(nx++)}if(!run&&nx>=ps.length)res(out.filter(Boolean))}pump()})}
function gatherPhotos(items,prog){var jobs=items.filter(function(x){return x.ph&&x.ph.n>0}),total=jobs.reduce(function(s,x){return s+x.ph.n},0),G={g:{},lost:0,n:0},base=0;
 if(!total)return Promise.resolve(G);
 if(total>120&&!confirm('Ada '+total+' foto dari '+jobs.length+' laporan. Mengunduh dengan foto butuh beberapa menit dan file akan besar.\n\nOK = unduh dengan foto, Batal = unduh tanpa foto.'))return Promise.resolve(G);
 return jobs.reduce(function(p,x){return p.then(function(){return api('rep_get',{id:x.id,quiet:1}).then(function(r){return repPhotos(r,function(n){prog(base+n,total)}).then(function(imgs){G.g[x.id]=imgs;G.n+=imgs.length;G.lost+=Math.max(0,(r.photos||[]).length-imgs.length)})},function(){G.lost+=x.ph.n}).then(function(){base+=x.ph.n})})},Promise.resolve()).then(function(){return G})}
function xlsFinish(wb,it,G,fn){var ids=it.filter(function(x){return G.g[x.id]&&G.g[x.id].length});
 if(!ids.length||!window.ExcelJS){XLSX.writeFile(wb,uniq_(fn));return Promise.resolve()}
 var buf=XLSX.write(wb,{bookType:'xlsx',type:'array'}),e=new ExcelJS.Workbook();
 return e.xlsx.load(buf).then(function(){var ws=e.addWorksheet('Foto Dokumentasi'),row=1,BL=17;ws.columns=[{width:36},{width:100}];
  ids.forEach(function(x){var im=G.g[x.id];ws.getCell(row,1).value=x.id+' - '+String(x.title||'')+' ('+im.length+' foto)';ws.getCell(row,1).font={bold:true,size:12};row++;
   im.forEach(function(g,i){var fb=fitPx(g,640,480),c=ws.getCell(row,1),id;c.value='Foto '+(i+1)+' - '+(g.p.kind||'Foto');c.font={bold:true};c.alignment={vertical:'top',wrapText:true};
    id=e.addImage({base64:g.data.split(',')[1],extension:'jpeg'});ws.addImage(id,{tl:{col:1,row:row-1},ext:{width:fb.w,height:fb.h}});row+=rowsFor(fb.h)});row++});
  return e.xlsx.writeBuffer()}).then(function(b2){dlBlob(new Blob([b2],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),fn)})}
function repDocData(r){var t=r.type,d=r.data,P=[],TB=[],x=d.diffs||{},pv=d.prevs||{};
 P.push(['No. Laporan',r.id],['Jenis laporan',T[t].label]);
 T[t].f.forEach(function(f){if(t==='meter'&&f[5])return;var v=d[f[0]];if(v!==''&&v!=null)P.push([f[1],String(v)])});
 if(t==='work')P.push(['Anggota tim',(d.team||[]).join(', ')||'-']);
 if(t==='issue')P.push(['Status perbaikan',d.status||'-']);
 if(t==='meter'){var mr=[];
  if(d.kind!=='Air'&&d.lwbp!=null)[['LWBP (kWh)','lwbp'],['WBP (kWh)','wbp'],['Genset (kWh)','genset']].forEach(function(m){mr.push([m[0],d[m[1]],pv[m[1]]==null?'-':pv[m[1]],x[m[1]]==null?'-':x[m[1]]])});
  if(d.kind!=='Listrik')mr.push(['Air (m\u00B3)',d.reading,d.prev==null?'-':d.prev,d.diff==null?'-':d.diff]);
  TB.push({title:'Pembacaan meteran',head:['Meter','Angka','Sebelumnya','Pemakaian'],rows:mr})}
 if(t==='ac'){P.push(['Status suhu laporan',acTxt(d)||'-']);if(d.tempStd)P.push(['Standar suhu',d.tempStd.min+' - '+d.tempStd.max+' \u00B0C']);
  TB.push({title:'Rincian area',head:['Area','Merk AC','Suhu (\u00B0C)','Status','Catatan'],rows:acRowsOf(d).map(function(a){return [a.location,a.unit,acCnd(a)?ACCND[a.cond]:a.roomTemp,tsl(acSt(a,d))||'-',a.note||'-']})})}
 if(t==='purchase')TB.push({title:'Rincian barang',head:['Barang','Kategori','Jumlah','Harga satuan','Total'],rows:(d.items||[]).map(function(i){return [i.name,i.category||'-',i.qty+' '+(i.unit||''),RP.format(i.price),RP.format(i.total)]}).concat([['Total transaksi','','','',RP.format(d.total)]])});
 if(t==='audience'){var ao=audTot(d);if(audStat(d))P.push(['Status data',audStat(d)]);P.push(['Ringkasan',ao.show+' show, '+NF.format(ao.tiket)+' tiket terjual, '+NF.format(ao.penonton)+' penonton masuk']);
  if(audOverList(d).length)P.push(['Peringatan','Penonton masuk melebihi tiket terjual pada '+audOverList(d).length+' show (ditandai merah): '+audOverList(d).join('; ')]);TB.push({over:audRows(d).map(function(r){return audOver({tiket:r[4],penonton:r[5]})}),title:'Rincian per studio dan show',head:['Studio','Show','Nama film','Jam','Tiket terjual','Penonton masuk','Petugas','Keterangan'],rows:audRows(d).map(function(r){return [r[0],r[1],r[2]||'-',r[3]||'-',audN(r[4])||'-',audN(r[5])||'-',r[6]||'-',r[7]||'-']}).concat([['Total','','','',NF.format(ao.tiket),NF.format(ao.penonton),'','']])})}
 if(t==='issue'&&(d.responses||[]).length)TB.push({title:'Tanggapan dan penyelesaian',head:['Waktu','Oleh','Status','Tanggapan'],rows:d.responses.map(function(z){return [dt(z.at),z.by,z.status,z.text]})});
 P.push(['Pelapor',r.reporter],['Dibuat',dt(r.createdAt)],['Diubah',dt(r.updatedAt)]);
 return {P:P,TB:TB}}
/* ---- bukti laporan: PDF & Excel profesional (identitas Outlet Operation System, foto + waktu dokumentasi) ---- */
/* ---- logo untuk PDF: XXI dan NOVA keduanya ditampilkan (website hanya NOVA) ---- */
var PDFLG={xxi:null,nova:null};
function pdfLogoLoad(src,key){var im=new Image();im.onload=function(){try{var c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);PDFLG[key]={d:c.toDataURL('image/png'),w:im.naturalWidth,h:im.naturalHeight}}catch(e){}};im.src=src}
pdfLogoLoad('logo-xxi.png','xxi');pdfLogoLoad('nova-logo.png','nova');
/* Menggambar dua logo pada chip putih. align:'left'|'right'; kembali: lebar total yang terpakai (mm). Tidak menimpa konten lain: pemanggil memberi ruang. */
function pdfLogos(doc,x,y,h,align,pageW,margin){var L=[PDFLG.xxi,PDFLG.nova].filter(Boolean);if(!L.length)return 0;var gap=3,pad=1.8,ws=L.map(function(g){return (h-2*pad)*g.w/g.h+2*pad}),tot=ws.reduce(function(a,b){return a+b},0)+gap*(L.length-1),cx=align==='right'?pageW-margin-tot:x;
 L.forEach(function(g,i){doc.setFillColor(255,255,255);doc.roundedRect(cx,y,ws[i],h,1.6,1.6,'F');doc.addImage(g.d,'PNG',cx+pad,y+pad,ws[i]-2*pad,h-2*pad);cx+=ws[i]+gap});return tot}
var OOS_BRAND={name:'NOVA',sub:'STC XXI',vio:[37,22,79],acc:[98,70,217],ink:[30,27,46],mute:[110,104,130],tint:[243,240,252],line:[225,221,236]};
function oosCap(g){var t=g.p&&(g.p.capturedAt||g.p.uploadedAt||g.p.at);return 'Foto '+(g.n||'')+' · '+(g.p&&g.p.kind||'Foto')+(t?'\nWaktu dokumentasi: '+dt(t):'')}
function repPdf(r,imgs){var J=window.jspdf.jsPDF,B=OOS_BRAND,doc=new J({unit:'mm',format:'a4'}),W=210,H=297,M=14,HEAD=34,TOP=HEAD+8,FOOT=14,D=repDocData(r),y,k,pc;
 doc.setProperties({title:T[r.type].label+' - '+r.id,author:U.name,creator:B.name});
 doc.autoTable({startY:TOP,margin:{left:M,right:M,top:TOP,bottom:FOOT},body:D.P,theme:'grid',styles:{fontSize:9,cellPadding:2.2,overflow:'linebreak',valign:'middle',textColor:B.ink,lineColor:B.line,lineWidth:.2},columnStyles:{0:{cellWidth:50,fontStyle:'bold',fillColor:B.tint,textColor:B.vio}}});
 D.TB.forEach(function(t){y=doc.lastAutoTable.finalY+8;if(y>H-50){doc.addPage();y=TOP}
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor.apply(doc,B.vio);doc.text(t.title,M,y);
  doc.autoTable({startY:y+3,margin:{left:M,right:M,top:TOP,bottom:FOOT},head:[t.head],body:t.rows,theme:'grid',styles:{fontSize:8.5,cellPadding:2,overflow:'linebreak',valign:'middle',textColor:B.ink,lineColor:B.line,lineWidth:.2},headStyles:{fillColor:B.vio,textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[250,249,253]},didParseCell:function(h){if(t.over&&h.section==='body'&&t.over[h.row.index]){h.cell.styles.fillColor=[253,226,226];if(h.column.index===4||h.column.index===5){h.cell.styles.fontStyle='bold';h.cell.styles.textColor=[176,30,30]}}}})});
 y=doc.lastAutoTable.finalY+9;
 var ptitle='Bukti foto dokumentasi ('+imgs.length+')',pHead=function(yy){doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor.apply(doc,B.vio);doc.text(ptitle,M,yy+4)};
 var cap=function(g,n,x,yy,w){doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor.apply(doc,B.ink);doc.text('Foto '+(n+1)+' · '+((g.p&&g.p.kind)||'Foto'),x,yy+4,{maxWidth:w});
  if(g.p&&(g.p.capturedAt||g.p.uploadedAt||g.p.at)){doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor.apply(doc,B.mute);doc.text('Waktu dokumentasi: '+dt(g.p.capturedAt||g.p.uploadedAt||g.p.at),x,yy+8,{maxWidth:w})}};
 if(!imgs.length){if(y+20>H-FOOT){doc.addPage();y=TOP}pHead(y);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor.apply(doc,B.mute);doc.text('Laporan ini tidak memiliki foto dokumentasi.',M,y+12)}
 else window.NovaPDF.photoFlow(doc,imgs,{x:M,y:y,w:W-2*M,top:TOP,bottom:H-FOOT,maxCols:3,target:66,hmax:118,capH:10,headH:8,drawHead:pHead,caption:cap});
 window.NovaPDF.stamp(doc,{title:T[r.type].label,id:r.id,user:U.name,margin:M});
 doc.save(uniq_('Laporan_'+r.id+'_dengan_foto.pdf'))}
function repXlsx(r,imgs){if(!window.ExcelJS)return Promise.reject(new Error('Library Excel belum termuat. Periksa koneksi internet lalu muat ulang halaman.'));
 var B=OOS_BRAND,ARGB=function(c){return 'FF'+c.map(function(v){return ('0'+v.toString(16)).slice(-2)}).join('').toUpperCase()},
  wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Laporan'),D=repDocData(r),bd={top:{style:'thin',color:{argb:'FFDDD8EB'}},left:{style:'thin',color:{argb:'FFDDD8EB'}},bottom:{style:'thin',color:{argb:'FFDDD8EB'}},right:{style:'thin',color:{argb:'FFDDD8EB'}}},row,hd,wp,fill=function(c,rgb){c.fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB(rgb)}}},NC=5;
 wb.creator=U.name;wb.created=new Date();wb.properties=wb.properties||{};
 ws.columns=[{width:26},{width:30},{width:18},{width:22},{width:44}];
 row=ws.addRow([B.name+'  ·  '+B.sub]);ws.mergeCells(row.number,1,row.number,NC);row.height=20;fill(row.getCell(1),B.vio);row.getCell(1).font={bold:true,size:9,color:{argb:'FFFFFFFF'}};
 row=ws.addRow([T[r.type].label+' — '+r.id]);ws.mergeCells(row.number,1,row.number,NC);row.height=30;fill(row.getCell(1),B.vio);row.getCell(1).font={bold:true,size:16,color:{argb:'FFFFFFFF'}};row.getCell(1).alignment={vertical:'middle'};
 row=ws.addRow(['Diekspor: '+exTs()+'  |  Oleh: '+U.name+'  |  Foto dokumentasi: '+imgs.length]);ws.mergeCells(row.number,1,row.number,NC);row.getCell(1).font={italic:true,size:9,color:{argb:ARGB(B.mute)}};
 ws.addRow([]);
 D.P.forEach(function(p){row=ws.addRow([p[0],String(p[1])]);ws.mergeCells(row.number,2,row.number,NC);row.getCell(1).font={bold:true,color:{argb:ARGB(B.vio)}};fill(row.getCell(1),B.tint);
  row.eachCell({includeEmpty:true},function(c){c.border=bd;c.alignment={vertical:'top',wrapText:true}});row.height=Math.max(18,Math.ceil(String(p[1]).length/95)*15+4)});
 D.TB.forEach(function(t){ws.addRow([]);row=ws.addRow([t.title]);row.font={bold:true,size:12,color:{argb:ARGB(B.vio)}};row.height=20;
  hd=ws.addRow(t.head);hd.height=20;hd.eachCell(function(c){c.font={bold:true,color:{argb:'FFFFFFFF'}};fill(c,B.vio);c.border=bd;c.alignment={vertical:'middle',wrapText:true}});
  t.rows.forEach(function(a,ai){var rw=ws.addRow(a.map(function(v){return v==null?'':v}));rw.eachCell(function(c){c.border=bd;c.alignment={vertical:'top',wrapText:true};if(t.over&&t.over[ai])fill(c,[253,226,226]);else if(ai%2)fill(c,[250,249,253])})})});
 ws.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0};
 ws.headerFooter={oddFooter:'&L&8'+B.name+' '+B.sub+'&R&8Halaman &P / &N'};
 wp=wb.addWorksheet('Foto Dokumentasi');wp.columns=[{width:34},{width:100}];
 row=wp.addRow([B.name+'  ·  Foto dokumentasi '+r.id+' ('+imgs.length+' foto)']);wp.mergeCells(1,1,1,2);row.height=28;fill(row.getCell(1),B.vio);row.getCell(1).font={bold:true,size:12,color:{argb:'FFFFFFFF'}};row.getCell(1).alignment={vertical:'middle'};
 if(!imgs.length)wp.addRow(['Laporan ini tidak memiliki foto dokumentasi.']);
 wp.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0};
 var nr=3;imgs.forEach(function(g,i){var fb=fitPx(g,640,480),w=fb.w,h=fb.h,s=nr,c=wp.getCell(s,1),id;nr+=rowsFor(h);
  c.value=oosCap(Object.assign({},g,{n:i+1}));c.font={bold:true,color:{argb:ARGB(B.ink)}};c.alignment={vertical:'top',wrapText:true};
  id=wb.addImage({base64:g.data.split(',')[1],extension:'jpeg'});wp.addImage(id,{tl:{col:1,row:s-1},ext:{width:w,height:h}})});
 return wb.xlsx.writeBuffer().then(function(buf){return new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})})}
function repDoc(r,fmt){if(BUSY)return;var pdf=fmt==='pdf',bp=$('dpdf'),bx=$('dxl'),b=pdf?bp:bx,b0=b.textContent,np=(r.photos||[]).length,nm='Laporan_'+r.id+'_dengan_foto.xlsx';
 if(pdf?!(window.jspdf&&window.jspdf.jsPDF):!window.ExcelJS){toast('Library '+(pdf?'PDF':'Excel')+' belum termuat. Periksa koneksi internet lalu muat ulang halaman.',1);return}
 BUSY=true;bp.disabled=true;bx.disabled=true;b.textContent='Memuat foto...';
 repPhotos(r,function(n,t){b.textContent='Memuat foto '+n+'/'+t+'...'}).then(function(imgs){var lost=np-imgs.length;b.textContent='Membuat file...';
  return Promise.resolve(pdf?repPdf(r,imgs):repXlsx(r,imgs).then(function(bl){dlBlob(bl,nm)})).then(function(){return lost})})
 .then(function(lost){toast(lost?'File dibuat, tetapi '+lost+' foto gagal dimuat dan tidak tercantum. Coba unduh ulang.':(np?'File berhasil dibuat beserta '+np+' foto dokumentasi.':'File berhasil dibuat (laporan ini tidak memiliki foto).'),!!lost)})
 .catch(function(x){toast('Gagal membuat file: '+x.message,1)})
 .then(function(){BUSY=false;bp.disabled=false;bx.disabled=false;b.textContent=b0})}

/* ---- laporan: form ---- */
function fld(f,v){var k=f[0],q=f[3]?' required':'',h='<label>'+f[1]+(f[3]?' *':'')+'</label>',v2=v==null?'':v;
 if(f[2]==='select')return h+'<select name="'+k+'"'+q+'>'+f[4].map(function(o){return '<option'+(o===v2?' selected':'')+'>'+esc(o)+'</option>'}).join('')+'</select>';
 if(f[2]==='textarea')return h+'<textarea name="'+k+'" rows="3">'+esc(v2)+'</textarea>';
 return h+'<input name="'+k+'" type="'+f[2]+'"'+(f[2]==='number'?' step="any" min="0" inputmode="decimal"':'')+' value="'+esc(v2)+'"'+q+'>'}
function acRow(id,r){r=r||{};var loc=r.location||'',mm=ACA.filter(function(o){return o.toLowerCase()===String(loc).toLowerCase()})[0];if(mm)loc=mm;var ex=loc!==''&&ACA.indexOf(loc)<0,oth=ex||loc==='Lainnya';
 return '<div class="acr" data-r="'+id+'"><div class="acr-h"><select class="as" aria-label="Area / ruangan">'+ACA.map(function(o){return '<option'+((o===loc||(ex&&o==='Lainnya'))?' selected':'')+'>'+esc(o)+'</option>'}).join('')+'</select><button type="button" class="btn sec rm" aria-label="Hapus area">×</button></div>'
 +'<input class="ao" type="text" maxlength="100" placeholder="Ketik nama area" value="'+esc(ex?loc:'')+'"'+(oth?'':' style="display:none"')+'>'
 +'<div class="acr-g"><label>Merk AC<select class="au">'+ACU.map(function(o){return '<option'+(o===(r.unit||'Daikin')?' selected':'')+'>'+o+'</option>'}).join('')+'</select></label></div><label class="acc-l">Kondisi area<select class="ac"><option value="">Isi suhu AC</option>'+Object.keys(ACCND).map(function(k){return '<option value="'+k+'"'+(r.cond===k?' selected':'')+'>'+ACCND[k]+' (tanpa suhu)</option>'}).join('')+'</select></label><div class="acr-g acr-t"'+(acCnd(r)?' style="display:none"':'')+'><label>Suhu AC (°C)<input class="at" type="number" step="any" min="-10" max="80" inputmode="decimal" placeholder="mis. 24" value="'+(r.roomTemp==null?'':esc(r.roomTemp))+'"></label></div><p class="acc-n" style="margin:0 0 8px;font-size:.88em;opacity:.8;'+(acCnd(r)?'':'display:none')+'">Suhu tidak perlu diisi. Status area otomatis APPROVED.</p>'
 +'<input class="an" type="text" maxlength="300" placeholder="Catatan area (opsional)" value="'+esc(r.note)+'">'
 +'<label class="aerr"><input type="checkbox" class="ae"'+(acErr(r)?' checked':'')+'> AC Eror</label><div class="pick"><label class="btn sec pk" for="gi_'+id+'">Galeri</label><label class="btn sec pk" for="gc_'+id+'">Kamera</label></div><input class="vh" type="file" id="gi_'+id+'" accept="image/jpeg,image/png,image/webp" multiple><input class="vh" type="file" id="gc_'+id+'" accept="image/*" capture="environment"><div class="ph" id="pv_'+id+'"></div></div>'}
var PHMAX=50,PHBATCH=3; /* PHMAX sama dengan MAXPH di Code.gs; PHBATCH = jumlah foto per kiriman */
var UNITS=['Pcs','Unit','Buah','Batang','Kotak','Botol','Liter','Meter','Kg','Set'];
function unitSel(u){u=u||'';var known=UNITS.indexOf(u)>=0,other=u&&!known;
 return '<div class="iu"><select class="us" aria-label="Satuan">'+UNITS.map(function(o){return '<option'+(o===u?' selected':'')+'>'+o+'</option>'}).join('')+'<option value="__o"'+(other?' selected':'')+'>Lainnya</option></select><input class="uo" placeholder="Ketik satuan" maxlength="20" value="'+esc(other?u:'')+'"'+(other?'':' style="display:none"')+'></div>'}
function unitVal(r){var s=r.querySelector('.us');return s.value==='__o'?r.querySelector('.uo').value.trim():s.value}
function irow(i){i=i||{};return '<div class="irow"><input class="in" placeholder="Nama barang" value="'+esc(i.name)+'"><input class="ic" placeholder="Kategori" value="'+esc(i.category)+'"><input class="iq" type="number" step="any" min="0" placeholder="Jml" value="'+(i.qty||'')+'">'+unitSel(i.unit)+'<input class="ip" type="number" step="any" min="0" placeholder="Harga satuan" value="'+(i.price==null?'':i.price)+'"><b class="it"></b><button type="button" class="btn sec rm">×</button></div>'}
/* ---- formulir laporan: isian cepat (Enter berpindah kolom, pilih isi saat fokus, tombol Sekarang) ---- */
var OOS_COPY={work:['title','category','location','desc'],issue:['location','priority'],purchase:['store','buyer','receiver','purpose'],meter:['location']};
/* salin isian tetap dari laporan terakhir pengguna; angka meteran, tanggal, dan jam sengaja tidak disalin */
function oosCopyLast(fm,t){var K=OOS_COPY[t];if(!K)return;var bx=document.createElement('div');bx.className='oos-copy';
 bx.innerHTML='<button type="button" class="btn sec">Salin dari laporan terakhir saya</button><small>Hanya lokasi dan informasi tetap. Angka, tanggal, dan jam diisi baru.</small>';
 var b=bx.firstChild;fm.insertBefore(bx,fm.firstChild);
 b.onclick=function(){b.disabled=true;
  api('rep_list',{type:t,q:'',from:'',to:'',status:'',page:1}).then(function(r){var m=(r.items||[]).filter(function(x){return x.reporter===U.name})[0];if(!m){toast('Belum ada laporan sebelumnya dari Anda.',1);return null}return api('rep_get',{id:m.id})})
  .then(function(r){if(!r)return;var d=r.data||{};
   K.forEach(function(k){var e=fm.elements[k];if(e&&d[k]!=null){e.value=d[k];e.dispatchEvent(new Event('change',{bubbles:true}))}});
   if(d.team)[].forEach.call(document.querySelectorAll('#tm input'),function(c){c.checked=d.team.indexOf(c.value)>=0});
   toast('Isian disalin dari '+r.id+'. Periksa lalu simpan.')})
  .catch(function(x){toast(x.message,1)}).then(function(){b.disabled=false})}}
function oosFormUX(fm){if(!fm)return;
 var SEL='input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([disabled]):not([style*="display: none"]),select:not([disabled]),textarea:not([disabled])',
  all=function(){return [].slice.call(fm.querySelectorAll(SEL)).filter(function(x){return x.offsetParent!==null||x.type==='date'||x.type==='time'})};
 all().forEach(function(x){if(x.tagName!=='TEXTAREA')x.setAttribute('enterkeyhint','next');if(x.type==='number'||x.classList.contains('at')||x.classList.contains('iq')||x.classList.contains('ip'))x.setAttribute('inputmode','decimal');
  if(x.type==='number'||x.type==='text')x.addEventListener('focus',function(){try{x.select()}catch(e){}})});
 fm.addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();var sb=fm.querySelector('button:not([type=button])');if(sb&&!sb.disabled)sb.click();return}
  if(e.key!=='Enter'||e.shiftKey||e.isComposing)return;var el=e.target;
  if(!el.matches||!el.matches('input:not([type=file]):not([type=checkbox]):not([type=radio])'))return;
  e.preventDefault();var L=all(),k=L.indexOf(el);
  if(k>=0&&k<L.length-1)L[k+1].focus();else{var sv=$('rsv');if(sv)sv.click()}});
 var d=fm.elements.date,tm=fm.elements.time;
 if(d&&tm&&!d.dataset.oos){d.dataset.oos=1;var nb=document.createElement('button');nb.type='button';nb.className='btn sec oos-now';nb.textContent='Sekarang';
  nb.onclick=function(){var iso=new Date(Date.now()+7*36e5).toISOString();d.value=iso.slice(0,10);tm.value=iso.slice(11,16);d.dispatchEvent(new Event('change'));tm.dispatchEvent(new Event('change'))};
  tm.parentNode.insertBefore(nb,tm.nextSibling)}}
function repForm(t,rec,after){var c=T[t],d=rec?(rec.data||{}):(t==='issue'?{priority:'Sedang'}:{}),PH=[],rid=uuid(),team=[],GR=t==='work'?[['Sebelum','Foto Sebelum (Before)'],['Sesudah','Foto Sesudah (After)']]:t==='ac'?[]:t==='issue'?[['Masalah','Foto masalah']]:t==='patrol'?[['Studio 1','Dokumentasi wajib Studio 1'],['Studio 2','Dokumentasi wajib Studio 2'],['Studio 3','Dokumentasi wajib Studio 3'],['Studio 4','Dokumentasi wajib Studio 4']]:t==='audience'?[['Foto','Foto dokumentasi, opsional']]:[['Foto','Foto dokumentasi']],AR=[],ARN=0;
 var mk=t==='meter'?((rec&&d.kind)||'Gabungan'):'';
 var go2=function(){
  var h='<h3>'+(rec?'Edit '+esc(rec.id):(t==='issue'?'Laporkan masalah yang perlu diperbaiki':'Buat '+c.label))+'</h3><form id="rfm"><div class="row2">'+c.f.map(function(f){return '<div'+(f[5]?' data-k="'+f[5]+'"':'')+(f[2]==='textarea'||f[0]==='kind'?' class="full"':'')+'>'+fld(f,d[f[0]]!=null?d[f[0]]:(f[0]==='date'?new Date(now()+7*36e5).toISOString().slice(0,10):f[0]==='time'?new Date(now()+7*36e5).toISOString().slice(11,16):''))+'</div>'}).join('')+'</div>';
  if(t==='patrol'){var studios=rec&&d.studios?d.studios:[{studio:'Studio 1'},{studio:'Studio 2'},{studio:'Studio 3'},{studio:'Studio 4'}];h=h.replace('<div class="row2">','<div class="full patrol-studios"><h4>Hasil inspeksi 4 studio</h4>'+studios.slice(0,4).map(function(a,i){var pg=GR[i];var photo=pg?'<div class="full studio-photo-block patrol-photo-inline"><label>'+pg[1]+' * (JPG/PNG/WebP, maks '+PHMAX+' foto total)</label><div class="pick"><label class="btn sec pk" for="fi_'+pg[0]+'">Pilih dari galeri</label><label class="btn sec pk" for="fc_'+pg[0]+'">Ambil dengan kamera</label></div><input class="vh" type="file" id="fi_'+pg[0]+'" accept="image/jpeg,image/png,image/webp" multiple><input class="vh" type="file" id="fc_'+pg[0]+'" accept="image/*" capture="environment"><div class="ph" id="pv_'+pg[0]+'"></div></div>':'';return '<section class="patrol-studio-card"><div class="row2"><div><label>Studio '+(i+1)+'</label><input value="Studio '+(i+1)+'" disabled></div><div><label>Status / kondisi</label><input id="pst'+i+'" value="'+esc(a.status||'')+'" placeholder="Baik / Perlu tindak lanjut"></div><div class="full"><label>Catatan studio '+(i+1)+'</label><textarea id="pnote'+i+'" rows="2">'+esc(a.note||'')+'</textarea></div>'+photo+'</div></section>'}).join('')+'<div class="full"><label>Informasi lainnya</label><textarea id="pother" rows="3" placeholder="Informasi tambahan di luar empat studio">'+esc(d.otherInfo||'')+'</textarea></div></div><div class="row2">') }
  if(t==='ac'){var ir=rec&&acRowsOf(d).length?acRowsOf(d):ACD.map(function(n){return {location:n,unit:'Daikin'}});
   h=h.replace('<div class=\"row2\">','<p class=\"info\">Isi suhu seluruh area, lampirkan foto bukti per area, lalu kirim sekaligus. Jika studio sedang kosong atau tidak ada show, pilih kondisi tersebut pada area terkait (suhu tidak perlu diisi, status tetap APPROVED). Area tanpa suhu dan tanpa kondisi tidak ikut dikirim.</p><div id=\"acs\">'+ir.map(function(r){AR.push(++ARN);return acRow(ARN,r)}).join('')+'</div><div class=\"acbar\"><button type=\"button\" class=\"btn sec\" id=\"aad\">+ Tambah area</button><span id=\"apc\"></span></div><div class=\"row2\">')}
  if(c.team)h+='<label>Anggota tim yang mengerjakan</label><div id="tm">'+team.map(function(n){return '<label style="font-weight:400;margin:4px 0"><input type="checkbox" style="width:auto;min-height:0" value="'+esc(n)+'"'+((d.team||[]).indexOf(n)>=0?' checked':'')+'> '+esc(n)+'</label>'}).join('')+'</div>';
  if(c.aud){var aSaved=null;if(!rec){try{var dr0=draftRead(draftKey('report_audience')),sv0=dr0&&dr0.controls&&dr0.controls['#aud_struct[0]'];if(sv0&&sv0.value){var ps0=JSON.parse(sv0.value);if(Array.isArray(ps0)&&ps0.length&&ps0.length<=AUD_SMAX&&ps0.every(function(p){return Array.isArray(p)&&typeof p[0]==='string'&&p[0].length<=40&&p[1]>=1&&p[1]<=AUD_RMAX&&p[1]===Math.floor(p[1])}))aSaved=ps0}}catch(e){}}
   h+='<div class="full" id="aud"><h4>Data penonton per studio dan show</h4><p class="info">Klik <b>Simpan</b> kapan saja untuk menyimpan data yang sudah diisi per show; draf dapat dilihat, diunduh, dan diubah sampai dikirim. Tombol <b>Kirim</b> muncul di sebelah Simpan bila SHOW1 sampai SHOW5 pada semua studio sudah terisi. Setelah dikirim, data hanya dapat diubah selama 30 menit.</p><div id="aud-list">'+audLayout(d,aSaved).map(audStudioHtml).join('')+'</div><div class="acbar"><button type="button" class="btn sec" id="aud-as">+ Tambah studio</button><b id="aud-tot"></b></div><p class="info" id="aud-prog"></p><p class="merr" id="aud-warn" role="status" style="display:none"></p><input type="hidden" id="aud_struct"></div>'}
  if(c.items)h+='<label>Barang *</label><div id="its">'+(d.items||[{}]).map(irow).join('')+'</div><button type="button" class="btn sec" id="ai">+ Tambah Barang</button><p><b>Total transaksi: <span id="gt">Rp 0</span></b></p>';
  h+=(t==='patrol'?'':GR.map(function(g){return '<div class="full studio-photo-block"><label>'+g[1]+' (JPG/PNG/WebP, maks '+PHMAX+' foto total)</label><div class="pick"><label class="btn sec pk" for="fi_'+g[0]+'">Pilih dari galeri</label><label class="btn sec pk" for="fc_'+g[0]+'">Ambil dengan kamera</label></div><input class="vh" type="file" id="fi_'+g[0]+'" accept="image/jpeg,image/png,image/webp" multiple><input class="vh" type="file" id="fc_'+g[0]+'" accept="image/*" capture="environment"><div class="ph" id="pv_'+g[0]+'"></div></div>'}).join(''))+'<div class="merr" id="re"></div><div class="fact"><button class="btn" id="rsv">'+(t==='audience'?(!rec||d.draft===true?'Simpan':'Simpan perubahan'):'Simpan laporan')+'</button>'+(t==='audience'&&(!rec||d.draft===true)?'<button type="button" class="btn" id="rsub" style="display:none">Kirim (Submit)</button>':'')+'<button type="button" class="btn sec" id="rc">Batal</button></div></form>';
  modal(h);if(!rec)oosCopyLast($('rfm'),t);var draftForm=$('rfm');if(draftForm){draftForm._getPh=function(){return PH};draftForm._setPh=function(a){(a||[]).forEach(function(x){PH.push(x)})}}if(!rec){draftRestore(draftForm,draftKey('report_'+t));var draftNote=document.createElement('div');draftNote.className='info stc-draft-status';draftNote.textContent='Autosave aktif: isian teks dan foto yang sudah dipilih disimpan otomatis di perangkat ini sampai laporan dikirim.';draftForm.insertBefore(draftNote,draftForm.firstChild)}$('rc').onclick=closeM;
  if(c.aud){audWire($('rfm'));if($('rsub'))$('rsub').onclick=function(){var f=$('rfm');if(!f.reportValidity())return;if(!audProg(f).ok)return;if(!window.confirm('Kirim Data Penonton sekarang? Setelah dikirim, data hanya dapat diubah selama 30 menit.'))return;f._sub=true;f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}))}}
  if(draftForm&&!rec&&window.draftPhotosRestore)draftPhotosRestore(draftForm);
  if(t==='ac'){var acs=$('acs'),cnt=function(){$('apc').textContent='Foto: '+PH.length+' / '+PHMAX};
   var pv=function(id){var el=$('pv_'+id);if(el)el.innerHTML=PH.map(function(p,i){return p.rid===id?'<div><img src="'+esc(p.url)+'" alt="Foto lampiran"><button type="button" class="x" data-i="'+i+'">×</button></div>':''}).join('')};
   var allPv=function(){[].forEach.call(acs.children,function(el){pv(+el.dataset.r)});cnt()};
   var wire=function(el){var id=+el.dataset.r,sel=el.querySelector('.as'),oth=el.querySelector('.ao');
    sel.onchange=function(){var o=sel.value==='Lainnya';oth.style.display=o?'':'none';if(o)oth.focus()};
    var cs=el.querySelector('.ac'),tg=el.querySelector('.acr-t'),nt=el.querySelector('.acc-n');var syncCond=function(){var c=!!cs.value;tg.style.display=c?'none':'';nt.style.display=c?'':'none';oth.style.display=sel.value==='Lainnya'?'':'none'};cs.onchange=function(){if(cs.value)el.querySelector('.at').value='';syncCond()};syncCond();
    el.querySelector('.rm').onclick=function(){if(acs.children.length<2){$('re').textContent='Minimal harus ada satu area.';return}PH=PH.filter(function(p){return p.rid!==id});el.remove();allPv()};
    $('pv_'+id).onclick=function(e){if(e.target.dataset.i!=null){PH.splice(+e.target.dataset.i,1);allPv()}};
    var onPick=function(){var fs=[].slice.call(this.files),bad=0,isCamera=(this.id.indexOf('gc_')===0),capturedAt=Date.now();this.value='';
     fs.reduce(function(p,f){return p.then(function(){if(PH.length>=PHMAX){bad++;return}return (isCamera?compWatermarked(f,'Daily Monitoring AC',capturedAt):comp(f)).then(function(x){x.rid=id;x.capturedAt=capturedAt;PH.push(x)},function(){bad++})})},Promise.resolve()).then(function(){allPv();$('re').textContent=bad?bad+' foto gagal diproses. Coba JPG/PNG/WebP dan pastikan izin kamera aktif.':''})};
    $('gi_'+id).onchange=onPick;$('gc_'+id).onchange=onPick};
   [].forEach.call(acs.children,wire);cnt();
   $('aad').onclick=function(){if(acs.children.length>=20){$('re').textContent='Maksimal 20 area per laporan.';return}
    var used=[].map.call(acs.querySelectorAll('.as'),function(x){return x.value}),nx=ACD.filter(function(n){return used.indexOf(n)<0})[0]||'Lainnya';
    acs.insertAdjacentHTML('beforeend',acRow(++ARN,{location:nx,unit:'Daikin'}));var el=acs.lastElementChild;wire(el);el.scrollIntoView({block:'center',behavior:'smooth'})}}
  if(t==='meter'){var fm=$('rfm'),fe=function(n){return fm.elements[n]},LV=null,seq=0,tmr=0,
   MT=[['lwbp','LWBP','kWh','e'],['wbp','WBP','kWh','e'],['genset','Genset','kWh','e'],['reading','Air','m³','w']],
   fx=function(v){return v==null||v===''||isNaN(v)?'-':NF3.format(v)};
   [].forEach.call(fm.querySelectorAll('[data-k]'),function(w){var on=mk==='Gabungan'||w.dataset.k===mk;w.style.display=on?'':'none';[].forEach.call(w.querySelectorAll('input'),function(i){i.disabled=!on;i.required=on})});
   if(mk!=='Air')fe('lwbp').closest('div').insertAdjacentHTML('beforebegin','<div class="full msec"><i>'+IC.meter+'</i>Listrik (kWh)</div>');
   if(mk!=='Listrik')fe('reading').closest('div').insertAdjacentHTML('beforebegin','<div class="full msec"><i>'+IC.water+'</i>Air (m³)</div>');
   fe('note').closest('div').insertAdjacentHTML('beforebegin','<div class="full"><div id="mlive" class="mlive"></div></div>');
   fm.insertAdjacentHTML('afterbegin','<p class="info">'+(mk==='Gabungan'?'Isi meteran listrik dan air sekaligus dalam satu laporan. ':'Laporan lama (hanya '+mk.toLowerCase()+'). ')+'Pemakaian dihitung otomatis dari laporan sebelumnya di lokasi yang sama.</p><datalist id="mloc"></datalist>');
   fe('location').setAttribute('list','mloc');fe('location').setAttribute('autocomplete','off');
   var live=function(){var b=$('mlive');if(!b)return;
    if(!fe('location').value.trim()){b.innerHTML='<small>Isi lokasi meteran untuk melihat angka sebelumnya dan akumulasi pemakaian.</small>';return}
    if(!LV){b.innerHTML='<small>Memuat angka sebelumnya...</small>';return}
    if(!LV.count){b.innerHTML='<small>Belum ada laporan sebelumnya untuk lokasi ini. Laporan ini menjadi titik awal; pemakaian mulai dihitung dari laporan berikutnya.</small>';return}
    var warn=0,rows=MT.filter(function(m){return mk==='Gabungan'||(mk==='Air'?m[3]==='w':m[3]==='e')}).map(function(m){
     var pv=m[3]==='e'?(LV.elec&&LV.elec[m[0]]):(LV.water&&LV.water.reading),cv=fe(m[0]).value,cu=LV.cum[m[3]==='w'?'air':m[0]],
      df=(pv!=null&&cv!==''&&!isNaN(cv))?Math.round((+cv-pv)*1000)/1000:null,bad=df!=null&&df<0;if(bad)warn=1;
     return '<tr><td><b>'+m[1]+'</b> <small>'+m[2]+'</small></td><td>'+fx(pv)+'</td><td'+(bad?' class="neg"':'')+'>'+(df==null?'-':(bad?'⚠ ':'+')+NF3.format(df))+'</td><td>'+fx(df!=null&&!bad?cu+df:cu)+'</td></tr>'}).join('');
    b.innerHTML='<div class="mh" style="margin-top:0">Dibanding laporan sebelumnya <small>('+dd(LV.last.date)+' '+esc(LV.last.time)+', '+LV.count+' laporan sebelumnya)</small></div><div class="scroll"><table class="mt"><tr><th>Meter</th><th>Sebelumnya</th><th>Pemakaian</th><th>Akumulasi</th></tr>'+rows+'</table></div>'+(warn?'<small class="neg">Ada angka yang lebih kecil dari pencatatan sebelumnya. Periksa kembali, atau abaikan bila meteran diganti/direset.</small>':'<small class="mnote">Akumulasi = total pemakaian sejak '+dd(LV.since)+' sampai laporan ini.</small>')},
   load=function(){var my=++seq,loc=fe('location').value.trim();LV=null;live();
    api('meter_prev',{location:loc,until:fe('date').value+' '+fe('time').value,exclude:rec&&rec.id}).then(function(r){if(my!==seq)return;LV=r;var dl=$('mloc');if(dl)dl.innerHTML=r.locations.map(function(n){return '<option value="'+esc(n)+'">'}).join('');
     if(!loc&&!rec&&r.locations.length===1){fe('location').value=r.locations[0];load();return}live()},function(x){if(my===seq){var b=$('mlive');if(b)b.innerHTML='<small>Angka sebelumnya gagal dimuat: '+esc(x.message)+'</small>'}})};
   fe('location').oninput=function(){clearTimeout(tmr);tmr=setTimeout(load,450)};fe('date').onchange=load;fe('time').onchange=load;
   MT.forEach(function(m){fe(m[0]).oninput=live});load()}
  function calc(){var g=0;document.querySelectorAll('.irow').forEach(function(r){var tt=Math.round((+r.querySelector('.iq').value||0)*(+r.querySelector('.ip').value||0));g+=tt;r.querySelector('.it').textContent=RP.format(tt)});if($('gt'))$('gt').textContent=RP.format(g)}
  if(c.items){$('its').oninput=calc;$('its').onchange=function(e){if(e.target.classList.contains('us')){var o=e.target.parentNode.querySelector('.uo');o.style.display=e.target.value==='__o'?'':'none';if(e.target.value==='__o')o.focus()}};$('its').onclick=function(e){if(e.target.classList.contains('rm')&&document.querySelectorAll('.irow').length>1){e.target.parentNode.remove();calc()}};$('ai').onclick=function(){$('its').insertAdjacentHTML('beforeend',irow())};calc()}
  function prev(){GR.forEach(function(g){$('pv_'+g[0]).innerHTML=PH.map(function(p,i){return p.kind===g[0]?'<div><img src="'+esc(p.url)+'" alt="Foto lampiran"><button type="button" class="x" data-i="'+i+'">×</button></div>':''}).join('')})}
  GR.forEach(function(g){
   $('pv_'+g[0]).onclick=function(e){if(e.target.dataset.i!=null){PH.splice(+e.target.dataset.i,1);prev()}};
   var onPick=function(){var fs=[].slice.call(this.files),bad=0,isCamera=(this.id.indexOf('fc_')===0),capturedAt=Date.now();this.value='';
    fs.reduce(function(p,f){return p.then(function(){if(PH.length>=PHMAX){bad++;return}return (isCamera?compWatermarked(f,g[0],capturedAt):comp(f)).then(function(x){x.kind=g[0];x.capturedAt=capturedAt;PH.push(x)},function(){bad++})})},Promise.resolve()).then(function(){prev();$('re').textContent=bad?bad+' foto gagal diproses. Coba JPG/PNG/WebP dan pastikan izin kamera aktif.':''})};$('fi_'+g[0]).onchange=onPick;$('fc_'+g[0]).onchange=onPick});
  $('rfm').onsubmit=function(e){e.preventDefault();var f=e.target,data={};
   if(t==='meter')data.kind=mk;c.f.forEach(function(x){if(x[5]&&mk!=='Gabungan'&&x[5]!==mk)return;data[x[0]]=f.elements[x[0]].value});if(t==='patrol'){var missingStudio=GR.filter(function(g){return !PH.some(function(p){return p.kind===g[0]})});if(missingStudio.length){$('re').textContent='Dokumentasi foto wajib dilengkapi untuk: '+missingStudio.map(function(g){return g[0]}).join(', ')+'. Unggah minimal 1 foto untuk setiap studio sebelum menyimpan.';return}data.studios=[0,1,2,3].map(function(i){return {studio:'Studio '+(i+1),status:$('pst'+i).value.trim(),note:$('pnote'+i).value.trim()}});data.otherInfo=$('pother').value.trim()}
   if(t==='ac'){var er='',rs=[],rids={},seen={};
    [].forEach.call(acs.children,function(el,i){var id=+el.dataset.r,sv=el.querySelector('.as').value,loc=sv==='Lainnya'?el.querySelector('.ao').value.trim():sv,tp=el.querySelector('.at').value.trim(),cd=el.querySelector('.ac').value,hp=PH.some(function(p){return p.rid===id});
     if(cd){if(!loc||loc==='Lainnya'){if(!er)er='Nama area baris ke-'+(i+1)+' belum diisi.';return}
      if(seen[loc.toLowerCase()]){if(!er)er='Area '+loc+' terisi lebih dari satu kali.';return}
      seen[loc.toLowerCase()]=1;rs.push({location:loc,unit:el.querySelector('.au').value,roomTemp:'',cond:cd,note:el.querySelector('.an').value.trim(),err:el.querySelector('.ae').checked});rids[id]=loc;return}
     if(tp===''){if(hp&&!er)er='Area '+(loc||('ke-'+(i+1)))+' punya foto tetapi suhunya kosong. Isi suhu atau hapus fotonya.';return}
     if(!loc||loc==='Lainnya'){if(!er)er='Nama area baris ke-'+(i+1)+' belum diisi.';return}
     if(isNaN(+tp)||+tp<-10||+tp>80){if(!er)er='Suhu '+loc+' harus berupa angka -10 sampai 80.';return}
     if(seen[loc.toLowerCase()]){if(!er)er='Area '+loc+' terisi lebih dari satu kali.';return}
     seen[loc.toLowerCase()]=1;rs.push({location:loc,unit:el.querySelector('.au').value,roomTemp:tp,note:el.querySelector('.an').value.trim(),err:el.querySelector('.ae').checked});rids[id]=loc});
    if(!er&&!rs.length)er='Isi suhu atau pilih Studio kosong / Tidak ada show minimal untuk satu area.';
    if(er){$('re').textContent=er;return}
    data.rows=rs;var ce=rs.filter(function(x){return x.err}).map(function(x){return x.location});if(ce.length)toast('Perhatian: AC error di '+ce.join(', '),1);PH=PH.filter(function(p){return rids[p.rid]!=null});PH.forEach(function(p){p.kind=rids[p.rid]});
    var nw=new Date(now()+7*36e5).toISOString();data.date=rec&&d.date?d.date:nw.slice(0,10);data.time=rec&&d.time?d.time:nw.slice(11,16)}
   var subm=false;if(t==='audience'){subm=f._sub===true;f._sub=false;var ac_=audCollect(f);if(ac_.er){$('re').textContent=ac_.er;return}if((subm||(rec&&d.draft===false))&&!audProg(f).ok){$('re').textContent='Data belum lengkap: SHOW1 sampai SHOW5 pada semua studio wajib terisi (nama film, tiket terjual, penonton masuk).';return}data.studios=ac_.studios}
   if(c.team)data.team=[].map.call(document.querySelectorAll('#tm input:checked'),function(i){return i.value});
   if(c.items&&[].some.call(document.querySelectorAll('.irow'),function(r){return !unitVal(r)})){$('re').textContent='Isi satuan barang (untuk "Lainnya", ketik satuannya).';return}
   if(c.items)data.items=[].map.call(document.querySelectorAll('.irow'),function(r){return {name:r.querySelector('.in').value,category:r.querySelector('.ic').value,qty:r.querySelector('.iq').value,unit:unitVal(r),price:r.querySelector('.ip').value}});
   if(BUSY)return;
   if(navigator.onLine===false){$('re').textContent='Tidak ada koneksi internet. Isian Anda tidak dihapus; coba lagi saat koneksi kembali.';return}
   var b=$('rsv'),rc=$('rc'),phs=PH.slice(),sent=0,failed=0;BUSY=true;b.disabled=true;rc.disabled=true;if($('rsub'))$('rsub').disabled=true;b.textContent=t==='audience'?(subm?'Mengirim...':'Menyimpan...'):'Menyimpan laporan...';$('re').textContent='';
   api('rep_save',{type:t,id:rec&&rec.id,reqId:rid,data:data,submit:subm,baseAt:rec&&rec.updatedAt}).then(function(r){
    if(!phs.length)return r;
    var chunks=[],i;for(i=0;i<phs.length;i+=PHBATCH)chunks.push(phs.slice(i,i+PHBATCH));
    function send(ch,n){return api('photo_save',{id:r.id,photos:ch.map(function(p){return {mime:p.mime,b64:p.b64,kind:p.kind,capturedAt:p.capturedAt||Date.now()}})}).then(function(x){failed+=x.failed},function(e){if(n<2)return send(ch,n+1);failed+=ch.length})}
    return chunks.reduce(function(p,ch){return p.then(function(){upTxt(b,sent,phs.length);return send(ch,0).then(function(){sent+=ch.length;upTxt(b,sent,phs.length)})})},Promise.resolve())
     .then(function(){b.textContent='Menyelesaikan...';return api('photo_done',{id:r.id}).catch(function(){})}).then(function(){r.photoFailed=failed;return r})
   }).then(function(r){BUSY=false;MALL={};draftClear(draftForm);closeM();toast(r.photoFailed?'Laporan '+r.id+' tersimpan, tetapi '+r.photoFailed+' foto gagal diunggah. Buka laporan lalu pilih Edit untuk menambah foto lagi.':(t==='audience'&&subm?'Data Penonton berhasil dikirim: '+r.id+'. Dapat diubah 30 menit.':(t==='audience'&&r.draft?'Draf tersimpan: '+r.id+'. Lengkapi semua show lalu kirim.':'Laporan berhasil disimpan: '+r.id)),!!r.photoFailed);after&&after()},
   function(x){BUSY=false;var oldBe=t==='ac'&&/suhu AC \(angka -10 sampai 80\)\.?$/.test(x.message||'')&&(data.rows||[]).some(function(r){return r.cond});$('re').textContent=(oldBe?'Server Apps Script yang aktif masih versi lama dan belum mengenali pilihan Studio kosong / Tidak ada show (kode di editor belum diterapkan). Perbaiki: tempel Code.gs terbaru di editor Apps Script, simpan, lalu pilih Terapkan > Kelola penerapan > ikon pensil > Versi: Versi baru > Terapkan. URL Web App tetap sama. (Pesan server: '+x.message+')':x.message)+' Isian Anda tidak dihapus; silakan coba lagi.';
    if(oldBe){try{fetch(API_URL).then(function(r){return r.text()}).then(function(v){var e=$('re');if(e&&v&&v.length<200)e.textContent+=' Versi server saat ini: '+v.replace(/\s+/g,' ').trim()+' (alamat Web App yang dipakai situs berakhiran ...'+API_URL.slice(-14)+').'}).catch(function(){})}catch(e0){}}toast('Laporan gagal disimpan: '+x.message,1);upOff(b);b.disabled=false;rc.disabled=false;if($('rsub'))$('rsub').disabled=false;b.textContent=t==='audience'?(!rec||d.draft===true?'Simpan':'Simpan perubahan'):'Simpan laporan'})}};
 if(c.team)api('team').then(function(n){team=n;go2()}).catch(function(x){toast(x.message,1)});else go2()}

/* ---- pengguna, audit, pengaturan ---- */
function vUsers(){api('usr_list').then(function(l){
 $('view').innerHTML='<h2>Manajemen Pengguna</h2><div class="bar"><input id="uq" type="search" placeholder="Cari nama atau username"><button class="btn" id="ua">Tambah pengguna</button></div><div class="scroll cards"><table id="ut" class="rt"></table></div>';
 function draw(){var q=$('uq').value.toLowerCase();$('ut').innerHTML='<tr><th>Nama</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr>'+l.filter(function(u){return (u.fullName+' '+u.username).toLowerCase().indexOf(q)>=0}).map(function(u){return '<tr><td class="sm"><b>'+esc(u.fullName)+'</b></td><td data-l="Username">'+esc(u.username)+'</td><td data-l="Role">'+esc(rn(u.role))+'</td><td data-l="Status">'+(u.locked?'<span class="nv-lock">Terblokir</span>':esc(u.status))+'</td><td class="act"><button class="btn sec" data-e="'+esc(u.userId)+'">Edit</button>'+(u.locked?'<button class="btn sec" data-ul="'+esc(u.userId)+'">Buka blokir</button>':'')+'<button class="btn sec" data-r="'+esc(u.userId)+'">Reset password</button></td></tr>'}).join('');
  document.querySelectorAll('[data-e]').forEach(function(b){b.onclick=function(){uForm(l.filter(function(u){return u.userId===b.dataset.e})[0])}});
  document.querySelectorAll('[data-ul]').forEach(function(b){b.onclick=function(){api('usr_unlock',{userId:b.dataset.ul}).then(function(){toast('Blokir dibuka.');vUsers()}).catch(function(x){toast(x.message,1)})}});
  document.querySelectorAll('[data-r]').forEach(function(b){b.onclick=function(){var uid=b.dataset.r;modal('<h3>Reset password</h3><form id="rpf"><label for="rpp">Password sementara baru (min. 8 karakter)</label><input id="rpp" type="password" minlength="8" autocomplete="new-password" required><div class="merr" id="rpe" role="alert"></div><div class="fact"><button class="btn">Reset password</button><button type="button" class="btn sec" id="rpc">Batal</button></div></form>');$('rpc').onclick=closeM;$('rpp').focus();$('rpf').onsubmit=function(e){e.preventDefault();var p=$('rpp').value;if(p.length<8){$('rpe').textContent='Minimal 8 karakter.';return}api('usr_reset',{userId:uid,password:p}).then(function(){closeM();toast('Password direset dan blokir (jika ada) dibuka. Pengguna wajib menggantinya saat login.');vUsers()}).catch(function(x){$('rpe').textContent=x.message})}}})}
 $('uq').oninput=draw;$('ua').onclick=function(){uForm()};draw()}).catch(err)}
function uForm(u){var n=!u;u=u||{};modal('<h3>'+(n?'Akun baru':'Edit akun')+'</h3><form id="uf"><label>Nama lengkap *</label><input id="un" required value="'+esc(u.fullName)+'">'+(n?'<label>Username *</label><input id="uu" required><label>Password sementara * (min. 8)</label><input id="up" type="password" minlength="8" required>':'')+'<label>Role</label><select id="ur"><option value="USER"'+(u.role==='USER'?' selected':'')+'>Teknisi (USER)</option><option value="REPORTER"'+(u.role==='REPORTER'?' selected':'')+'>Pelapor (hanya melaporkan perbaikan)</option><option value="GUIDE_SECURITY"'+(u.role==='GUIDE_SECURITY'?' selected':'')+'>Guide/Security (Inspeksi & Patroli Studio)</option><option value="ADMIN"'+(u.role==='ADMIN'?' selected':'')+'>Admin</option></select>'+(n?'':'<label>Status</label><select id="us"><option'+(u.status==='Aktif'?' selected':'')+'>Aktif</option><option'+(u.status==='Nonaktif'?' selected':'')+'>Nonaktif</option></select>')+'<div class="merr" id="ue"></div><div class="fact"><button class="btn">Simpan akun</button><button type="button" class="btn sec" id="uc">Batal</button></div></form>');
 $('uc').onclick=closeM;$('uf').onsubmit=function(e){e.preventDefault();api('usr_save',{userId:u.userId,fullName:$('un').value,username:n&&$('uu').value,password:n&&$('up').value,role:$('ur').value,status:n?'Aktif':$('us').value}).then(function(){closeM();toast('Akun disimpan.');vUsers()}).catch(function(x){$('ue').textContent=x.message})}}
function vAudit(){var pg=1;(function load(){api('audit',{page:pg}).then(function(r){$('view').innerHTML='<h2>Audit Log</h2><div class="scroll cards"><table class="rt"><tr><th>Ringkasan</th><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Kategori</th><th>Record</th></tr>'+r.items.map(function(x){return '<tr><td class="sm">'+esc(x.summary||x.action)+'</td><td data-l="Waktu">'+dt(x.at)+'</td><td data-l="Pengguna">'+esc(x.userName)+' ('+esc(x.role)+')</td><td data-l="Aksi">'+esc(x.action)+'</td><td data-l="Kategori">'+esc(x.category)+'</td><td data-l="Record">'+esc(x.recordId)+'</td></tr>'}).join('')+'</table></div><div class="pg"><button class="btn sec" id="ap"'+(pg<2?' disabled':'')+'>‹</button> Hal. '+pg+' / '+Math.max(1,Math.ceil(r.total/r.size))+' <button class="btn sec" id="an"'+(pg*r.size>=r.total?' disabled':'')+'>›</button></div>';
  $('ap').onclick=function(){pg--;load()};$('an').onclick=function(){pg++;load()}}).catch(err)})()}
function vSet(){Promise.all([api('dashboard'),api('ac_cfg_get')]).then(function(r){var c=r[1];$('view').innerHTML='<h2>Pengaturan Sistem</h2><div class="card"><b>Integrasi</b><p>Google Apps Script: terhubung<br>Google Spreadsheet: terhubung (dashboard berhasil membaca data)<br>Zona waktu: Asia/Jakarta</p><p>Pengelolaan akun ada di menu Manajemen Pengguna. Ganti password lewat tombol Profil.</p></div>'+
 '<div class="card" style="margin-top:14px"><b>Standar Suhu AC</b><p>Dipakai untuk status otomatis pada Daily Monitoring AC: di dalam batas = \u2713 APPROVED, di atas batas atas = \u26A0 PANAS, di bawah batas bawah = \u26A0 DINGIN. Hanya Admin yang dapat mengubah. Bawaan: '+c.def.min+' - '+c.def.max+' \u00B0C.</p><form id="acf"><div class="row2"><div><label>Batas bawah (\u00B0C)</label><input id="acmin" type="number" step="0.1" min="-10" max="80" inputmode="decimal" required value="'+c.min+'"></div><div><label>Batas atas (\u00B0C)</label><input id="acmax" type="number" step="0.1" min="-10" max="80" inputmode="decimal" required value="'+c.max+'"></div></div><div class="merr" id="ace"></div><p><button class="btn">Simpan standar</button></p></form></div>';
 $('acf').onsubmit=function(e){e.preventDefault();$('ace').textContent='';api('ac_cfg_save',{min:$('acmin').value,max:$('acmax').value}).then(function(x){toast('Standar suhu AC disimpan: '+x.min+' - '+x.max+' \u00B0C.')}).catch(function(x){$('ace').textContent=x.message})}}).catch(err)}

/* ---- notifikasi: polling ringan (45 dtk, berhenti saat tab tersembunyi) memakai endpoint yang sudah ada.
   Data diambil dengan endpoint yang sama dengan halaman terkait, sehingga hak akses mengikuti filter server.
   Status baca disimpan per pengguna di browser ini (localStorage). ---- */
var NT={t:0,busy:0,src:{},st:null,list:[],seen:null,key:'',open:false},NTMS=45000,NTWIN=7*864e5;
function ntJ(){return [].filter.call(arguments,Boolean).join(' \u00b7 ')}
function ntLoad(){var s=null;try{s=JSON.parse(LS.getItem(NT.key)||'null')}catch(e){}
 if(!s||typeof s!=='object')s={i:now(),r:{},a:null,n:[]};s.r=s.r||{};s.n=s.n||[];NT.st=s}
function ntSave(){var st=NT.st,k=Object.keys(st.r);if(k.length>600)k.slice(0,200).forEach(function(x){delete st.r[x]});try{LS.setItem(NT.key,JSON.stringify(st))}catch(e){}}
function ago(ms){var s=Math.floor((now()-ms)/1000);return s<60?'Baru saja':s<3600?Math.floor(s/60)+' mnt lalu':s<86400?Math.floor(s/3600)+' jam lalu':''}
function ntAts(l){var st=NT.st,cur={};l.forEach(function(f){cur[f.id]=f.status});
 if(st.a)l.forEach(function(f){var o=st.a[f.id];if(o===f.status)return;
  st.n.unshift({k:'ats:'+f.id+':'+f.status+':'+now(),t:now(),h:o===undefined?'Film ATS baru':'Status tiket diperbarui',b:ntJ(f.title,o===undefined?f.status:o+' \u2192 '+f.status),p:'ats'})});
 st.a=cur;st.n=st.n.filter(function(n){return n.t>now()-NTWIN}).slice(0,30)}
function ntBuild(){var out=[],st=NT.st,S=NT.src,me=U.name,rp=U.role==='REPORTER';
 (S.ann||[]).forEach(function(a){if(a.status!=='Aktif'||!a.publishedAt||a.createdBy===me)return;
  out.push({k:'ann:'+a.id,t:+a.publishedAt,h:'Pengumuman baru'+(a.priority&&a.priority!=='Informasi'?' ('+a.priority+')':''),b:a.title,p:'pengumuman'})});
 (S.work||[]).forEach(function(x){var d=x.data||{};if(x.reporter===me)return;
  if(d.status==='Need Follow-up'){st.r['work:'+x.id]=1;out.push({k:'wfu:'+x.id,t:+(x.updatedAt||x.createdAt),h:'Pekerjaan perlu tindak lanjut',b:ntJ(x.title,d.location),p:'work',id:x.id})}
  else out.push({k:'work:'+x.id,t:+x.createdAt,h:'Laporan pekerjaan baru',b:ntJ(x.title,d.location),p:'work',id:x.id})});
 (S.issue||[]).forEach(function(x){var d=x.data||{},rs=d.responses||[],lr=rs.length?rs[rs.length-1]:null,b=ntJ(x.title,d.location,d.priority);
  if(d.status==='Menunggu'){if(rp||x.reporter===me)return;out.push({k:'iss:'+x.id+':Menunggu',t:+x.createdAt,h:'Perlu diperbaiki: laporan baru',b:b,p:'issue',id:x.id})}
  else if(!(lr&&lr.by===me))out.push({k:'iss:'+x.id+':'+d.status,t:+((lr&&lr.at)||x.updatedAt||x.createdAt),h:'Status tiket: '+d.status,b:b,p:'issue',id:x.id})});
 st.n.forEach(function(n){out.push(n)});return out}
function ntRefresh(fromPoll){var st=NT.st,l=ntBuild().filter(function(n){return n.t>now()-NTWIN}).sort(function(a,b){return b.t-a.t}).slice(0,40),nw=[];
 l.forEach(function(n){n.u=n.t>st.i&&!st.r[n.k]});NT.list=l;
 if(fromPoll&&NT.seen)l.forEach(function(n){if(n.u&&!NT.seen[n.k])nw.push(n)});
 NT.seen={};l.forEach(function(n){NT.seen[n.k]=1});
 if(nw.length)toast(nw.length>1?nw.length+' notifikasi baru':nw[0].h+': '+nw[0].b);
 ntSave();ntDraw()}
function ntDraw(){var l=NT.list,un=l.filter(function(n){return n.u}).length,b=$('bcnt');
 b.textContent=un>99?'99+':un;b.classList.toggle('hidden',!un);$('bell').setAttribute('aria-label','Notifikasi'+(un?', '+un+' belum dibaca':''));
 if(!NT.open)return;
 $('npanel').innerHTML='<div class="nh"><b>Notifikasi</b><button type="button" class="lnk" id="nall"'+(un?'':' disabled')+'>Tandai semua dibaca</button></div><div class="nl">'+(l.length?l.map(function(n){
  return '<div class="ni'+(n.u?' un':'')+'" role="button" tabindex="0" data-k="'+esc(n.k)+'"><span class="nd"></span><div class="nb"><b>'+esc(n.h)+'</b><span>'+esc(n.b)+'</span><small>'+[ago(n.t),dt(n.t),n.u?'Belum dibaca':'Sudah dibaca'].filter(Boolean).join(' \u00b7 ')+'</small></div>'+(n.u?'<button type="button" class="btn sec nr" data-r="'+esc(n.k)+'">Tandai dibaca</button>':'')+'</div>'}).join(''):'<div class="empty"><b>Belum ada notifikasi</b>Aktivitas baru akan muncul di sini.</div>')+'</div>'}
function ntRead(k){NT.st.r[k]=1;ntRefresh()}
function ntGo(n){if(n.id&&(n.p==='work'||n.p==='issue')){go(n.p);detail(n.id,function(){go(n.p)})}else go(n.p)}
function ntClose(){NT.open=false;$('npanel').classList.add('hidden');$('bell').setAttribute('aria-expanded','false')}
/* terapkan hasil notifikasi ke state (dipakai jalur gabungan dan jalur lama) */
function ntApply(key,r){if(!U||NT.key!==key)return;
 if(r.ann!=null)NT.src.ann=Array.isArray(r.ann)?r.ann:(r.ann.items||[]);
 if(r.issue!=null)NT.src.issue=Array.isArray(r.issue)?r.issue:(r.issue.items||[]);
 if(r.work!=null)NT.src.work=Array.isArray(r.work)?r.work:(r.work.items||[]);
 if(r.ats!=null)ntAts(Array.isArray(r.ats)?r.ats:[]);
 ntRefresh(true)}
/* satu panggilan notif_poll (server menggabungkan ann, issue, work, ats). Bila server belum di-deploy ulang, jalur lama dipakai. */
function ntPoll(){if(!TOKEN||!U||NT.busy||document.hidden)return;NT.busy=1;
 var key=NT.key,rp=U.role==='REPORTER',ad=U.role==='ADMIN';
 if(NT.legacy)return ntPollLegacy(key,rp,ad);
 api('notif_poll',{quiet:1}).then(function(r){NT.busy=0;ntApply(key,r||{})},function(e){
  NT.busy=0;
  if(/Aksi tidak dikenal/.test(e&&e.message||'')){NT.legacy=1;ntPoll()}});
}
function ntPollLegacy(key,rp,ad){
 var rl=function(t){return api('rep_list',{type:t,q:'',from:'',to:'',status:'',page:1,quiet:1})},
  jobs=[['ann',api('ann_list',{quiet:1})],['issue',rl('issue')]];
 if(!rp)jobs.push(['work',rl('work')]);if(!ad)jobs.push(['ats',api('ats_list',{quiet:1})]);
 Promise.all(jobs.map(function(j){return j[1].then(function(r){return [j[0],r]},function(){return null})})).then(function(rs){
  NT.busy=0;if(!U||NT.key!==key)return;
  rs.forEach(function(x){if(!x)return;var r=x[1];if(x[0]==='ats')ntAts(Array.isArray(r)?r:[]);else NT.src[x[0]]=Array.isArray(r)?r:((r&&r.items)||[])});
  ntRefresh(true)})}
function ntStart(){ntStop();NT.key='stc_nt_'+(U.userId||U.username||U.name);ntLoad();NT.src={};NT.seen=null;ntDraw();ntPoll();NT.t=setInterval(ntPoll,NTMS)}
function ntStop(){clearInterval(NT.t);NT.t=0;NT.busy=0;NT.list=[];NT.src={};NT.seen=null;NT.open=false;var p=$('npanel'),b=$('bcnt');if(p)p.classList.add('hidden');if(b)b.classList.add('hidden')}
$('bell').onclick=function(e){e.stopPropagation();if(NT.open){ntClose();return}NT.open=true;$('npanel').classList.remove('hidden');this.setAttribute('aria-expanded','true');ntDraw();ntPoll()};
$('npanel').onclick=function(e){var r=e.target.closest('[data-r]');if(r){e.stopPropagation();ntRead(r.dataset.r);return}
 if(e.target.closest('#nall')){NT.list.forEach(function(n){if(n.u)NT.st.r[n.k]=1});ntRefresh();return}
 var i=e.target.closest('.ni');if(!i)return;var n=NT.list.filter(function(x){return x.k===i.dataset.k})[0];if(!n)return;ntRead(n.k);ntClose();ntGo(n)};
$('npanel').onkeydown=function(e){if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('ni')){e.preventDefault();e.target.click()}};
document.addEventListener('click',function(e){if(NT.open&&!e.target.closest('#npanel,#bell'))ntClose()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&NT.open)ntClose()});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&NT.t)ntPoll()});
window.addEventListener('online',function(){if(NT.t)ntPoll()});


/* ---- logout otomatis: 10 menit tanpa aktivitas (peringatan 60 detik sebelumnya) ---- */
var IDLE_MS=30*60*1000,IDLE_WARN=60*1000,IDLE_TXT='Anda keluar otomatis karena tidak ada aktivitas selama 30 menit. Silakan masuk lagi.',IDLE_W=false,IDLE_L=0;
function idleGet(){return Number(LS.getItem('stc_act'))||0}
function idleMark(){var n=Date.now();if(n-IDLE_L<1000)return;IDLE_L=n;try{LS.setItem('stc_act',String(n))}catch(e){}}
/* Aplikasi yang sudah dipasang (ke layar utama / Chrome / Safari) tidak logout otomatis karena diam;
   pembukaan lewat browser biasa tetap logout setelah 10 menit tanpa aktivitas. */
function isInstalled(){try{if(window.matchMedia&&['standalone','fullscreen','minimal-ui'].some(function(m){return matchMedia('(display-mode: '+m+')').matches}))return true}catch(e){}return navigator.standalone===true}
function idleStale(){var l=idleGet();return !!l&&Date.now()-l>IDLE_MS}
function idleWarnHide(){IDLE_W=false;var w=$('idle');if(w)w.remove()}
function idleWarnShow(s){var w=$('idle');
 if(!w){w=document.createElement('div');w.id='idle';w.setAttribute('role','alertdialog');w.setAttribute('aria-live','assertive');
  w.innerHTML='<div class="idle-b"><b>Sesi akan berakhir</b><p>Tidak ada aktivitas. Anda akan keluar otomatis dalam <strong id="idles"></strong> detik.</p><div class="idle-a"><button type="button" class="btn" id="idlek">Tetap masuk</button><button type="button" class="btn sec" id="idlex">Keluar sekarang</button></div></div>';
  document.body.appendChild(w);
  $('idlek').onclick=function(){idleWarnHide();IDLE_L=0;idleMark()};
  $('idlex').onclick=function(){idleOut(true)};
  try{$('idlek').focus()}catch(e){}}
 IDLE_W=true;$('idles').textContent=s}
function idleOut(manual){idleWarnHide();if(BUSY)return;
 api('logout').catch(function(){});clearSess();try{LS.removeItem('stc_act')}catch(e){}
 hideForm();ntClose();showLogin();$('lerr').textContent=manual?'':IDLE_TXT}
function idleTick(){
 if(!TOKEN||!U){if(IDLE_W)idleWarnHide();return}
 if(BUSY){IDLE_L=0;idleMark();if(IDLE_W)idleWarnHide();return}
 if(!idleGet()){IDLE_L=0;idleMark()}
 var left=IDLE_MS-(Date.now()-idleGet());
 if(left<=0)idleOut();else if(left<=IDLE_WARN)idleWarnShow(Math.ceil(left/1000));else if(IDLE_W)idleWarnHide()}
['pointerdown','keydown','wheel','touchstart','scroll','mousemove'].forEach(function(ev){document.addEventListener(ev,function(){if(!IDLE_W&&TOKEN&&U)idleMark()},{passive:true,capture:true})});
document.addEventListener('visibilitychange',function(){if(!document.hidden)idleTick()});
setInterval(idleTick,1000);

/* ---- mulai ---- */
if(TOKEN&&idleStale()){clearSess();try{LS.removeItem('stc_act')}catch(e){}$('lerr').textContent=IDLE_TXT}
if(TOKEN){var cu=null,pg=LS.getItem('stc_p')||'dashboard';try{cu=JSON.parse(LS.getItem('stc_u')||'null')}catch(e){}
 if(cu&&cu.role)enter(cu,pg);
 api('me').then(function(r){var u=normU(r);if(r&&r.token)TOKEN=r.token;LS.setItem('stc_u',JSON.stringify(u));LS.setItem('stc_t',TOKEN);
  if(!U)enter(u,pg);else{U.name=u.name;U.role=u.role;$('hname').textContent=u.name;$('hrole').textContent=rn(u.role);U.photo=u.photo;avSet($('av'));if(u.mustChange&&!U.mustChange){U.mustChange=true;pwModal(true)}}})
 .catch(function(x){if(!TOKEN){showLogin();return}
  if(!U){$('lerr').textContent='Gagal memulihkan sesi: '+x.message}else toast('Koneksi ke server bermasalah: '+x.message,1)})}
setInterval(function(){if(TOKEN&&U)api('me').then(function(r){if(r&&r.token){TOKEN=r.token;LS.setItem('stc_t',TOKEN)}}).catch(function(){})},15*60*1000);
/* ekspor helper untuk modul tambahan (modul-dcp.js); tidak mengubah perilaku aplikasi */
window.STC={now:now,api:api,modal:modal,closeM:closeM,toast:toast,esc:esc,dt:dt,$:$,DESC:DESC,IC:IC,getU:function(){return U}};
})();
