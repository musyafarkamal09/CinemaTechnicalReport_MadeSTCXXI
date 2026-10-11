(function(){
'use strict';
var $=function(i){return document.getElementById(i)};
var API_URL='https://script.google.com/macros/s/AKfycbxHkmS36zyh7--9ard24rTJpsD8iG8DF7SUkltpYl04Igi4iqD614zhO3xqVyjk5bUy/exec';
var LS=(function(){try{localStorage.setItem('_t','1');localStorage.removeItem('_t');return localStorage}catch(e){return sessionStorage}})();
var TOKEN=LS.getItem('stc_t')||sessionStorage.getItem('stc_t'),U=null,CUR='dashboard',ST={},SKEW=0,TZ='Asia/Jakarta';
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

function api(a,p){
 p=p||{};p.action=a;p.token=TOKEN;conn('Memuat data...');
  return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(p)})
 .then(function(r){return r.json().catch(function(){conn('Gagal');throw new Error('Respons server tidak valid. Pastikan Web App Apps Script sudah di-deploy ulang (versi baru).')})},function(){conn('Gagal terhubung');throw new Error('Gagal terhubung ke server. Periksa koneksi lalu coba lagi.')})
 .then(function(j){conn('Terhubung');if(j.now)SKEW=j.now-Date.now();
  if(j.ok)return j.data;
  if(TOKEN&&a!=='login'&&(j.code==='AUTH'||/sesi.*(berakhir|habis|tidak valid)|token|kedaluwarsa|expired/i.test(j.message||''))){clearSess();showLogin();$('lerr').textContent='Sesi ditolak server (aksi: '+a+', kode: '+(j.code||'-')+', pesan: '+(j.message||'-')+'). Silakan login lagi.'}
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
function lightbox(src){var d=document.createElement('div');d.style.cssText='position:fixed;inset:0;background:#000d;z-index:120;display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out';var i=document.createElement('img');i.style.cssText='max-width:100%;max-height:100%;border-radius:8px;background:#fff';i.src=src;d.appendChild(i);d.onclick=function(){d.remove()};document.body.appendChild(d)}

/* ---- modal ---- */
function modal(h){$('mbox').innerHTML='<button type="button" class="mx" id="mx" aria-label="Tutup">&times;</button>'+h;$('mx').onclick=closeM;$('modal').classList.remove('hidden')}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('modal').classList.contains('hidden'))closeM()});
function closeM(){$('modal').classList.add('hidden');$('mbox').innerHTML=''}
$('modal').onclick=function(e){if(e.target===this)closeM()};

/* ---- definisi laporan ---- */
var WC=['Electrical','Mechanical','HVAC / AC','Plumbing','Audio','Projector','Building Maintenance','Preventive Maintenance','Corrective Maintenance','Lainnya'];
var WS=['Open','In Progress','Completed','Pending','Need Follow-up'];
var T={
 work:{label:'Laporan Pekerjaan',f:[['title','Judul pekerjaan','text',1],['category','Kategori','select',1,WC],['location','Lokasi','text',1],['date','Tanggal pekerjaan','date',1],['time','Jam pekerjaan','time'],['status','Status','select',1,WS],['desc','Deskripsi','textarea'],['note','Catatan','textarea']],team:1},
 meter:{label:'Laporan Meteran',f:[['kind','Jenis meteran','select',1,['Listrik','Air']],['location','Lokasi meteran','text',1],['date','Tanggal pencatatan','date',1],['time','Jam pencatatan','time',1],['lwbp','Angka LWBP (kWh)','number',1,null,'Listrik'],['wbp','Angka WBP (kWh)','number',1,null,'Listrik'],['genset','Angka Genset (kWh)','number',1,null,'Listrik'],['reading','Angka meteran air (m³)','number',1,null,'Air'],['note','Catatan','textarea']]},
 purchase:{label:'Laporan Pembelian Barang',f:[['date','Tanggal pembelian','date',1],['time','Jam pembelian','time'],['store','Nama toko / pemasok','text',1],['buyer','Nama pembeli','text',1],['receiver','Nama penerima barang','text'],['purpose','Keperluan','text'],['note','Catatan','textarea']],items:1}
};
var FS=['Upcoming ATS','ATS Open','Coming Soon','Coming to Theater','Now Showing','Completed'];
var MENU=[['dashboard','Dashboard',0],['pengumuman','Pengumuman',0],['ats','Advanced Ticket Sales',0],['work','Laporan Pekerjaan',0],['meter','Laporan Meteran',0],['purchase','Laporan Pembelian',0],['pengguna','Manajemen Pengguna',1],['audit','Audit Log',1],['pengaturan','Pengaturan Sistem',1]];

var DESC={dashboard:'Ringkasan aktivitas dan informasi terkini',pengumuman:'Informasi internal untuk Tim Teknikal',ats:'Jadwal penjualan tiket dan film mendatang',work:'Pencatatan pekerjaan teknikal dan perawatan',meter:'Pencatatan pembacaan meteran listrik dan air',purchase:'Pencatatan pembelian barang dan perlengkapan',pengguna:'Kelola akun dan hak akses',audit:'Riwayat aktivitas sistem',pengaturan:'Status integrasi sistem'};
var IC={dashboard:'<svg class="ic" viewBox="0 0 24 24"><path d="M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z"/></svg>',pengumuman:'<svg class="ic" viewBox="0 0 24 24"><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8"/></svg>',ats:'<svg class="ic" viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/></svg>',work:'<svg class="ic" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.2-.6-.6-2.2z"/></svg>',meter:'<svg class="ic" viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',purchase:'<svg class="ic" viewBox="0 0 24 24"><path d="M6 6h15l-2 9H8zM6 6 5 3H2M9 20h.01M18 20h.01"/></svg>',pengguna:'<svg class="ic" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.9"/></svg>',audit:'<svg class="ic" viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h8"/></svg>',pengaturan:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>'};
IC.today='<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>';
IC.water='<svg class="ic" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>';
IC.menu='<svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
var GRP={dashboard:'Utama',work:'Laporan',pengguna:'Administrasi'},TB=[['dashboard','Beranda'],['work','Pekerjaan'],['meter','Meteran'],['purchase','Pembelian']];
/* ---- shell ---- */
function showLogin(){U=null;$('app').classList.add('hidden');$('login').classList.remove('hidden');$('lform').reset()}
function enter(u,page){u=normU(u);U=u;LS.setItem('stc_u',JSON.stringify(u));$('hname').textContent=u.name;$('hrole').textContent=u.role;$('av').textContent=String(u.name||'?').charAt(0).toUpperCase();$('login').classList.add('hidden');$('app').classList.remove('hidden');
 if(u.mustChange){pwModal(true)}go(MENU.some(function(m){return m[0]===page&&(!m[2]||u.role==='ADMIN')})?page:'dashboard')}
function go(p){CUR=p;LS.setItem('stc_p',p);var adm=U.role==='ADMIN',h='';
 MENU.forEach(function(m){if(m[2]&&!adm)return;if(GRP[m[0]])h+='<div class="ng">'+GRP[m[0]]+'</div>';h+='<a data-p="'+m[0]+'" class="'+(p===m[0]?'on':'')+'"><i>'+(IC[m[0]]||'')+'</i>'+m[1]+'</a>'});
 $('tabs').innerHTML=TB.map(function(m){return '<a data-p="'+m[0]+'" class="'+(p===m[0]?'on':'')+'"><i>'+IC[m[0]]+'</i>'+m[1]+'</a>'}).join('')+'<a data-p="menu" class="'+(TB.some(function(m){return m[0]===p})?'':'on')+'"><i>'+IC.menu+'</i>Menu</a>';
 $('nav').innerHTML=h;$('ptitle').textContent=(MENU.filter(function(m){return m[0]===p})[0]||[0,''])[1];$('psub').textContent=DESC[p]||'';closeMenu();var v=$('view');v.innerHTML='<div class="sk" style="height:30px;width:240px"></div><div class="sk" style="height:110px;margin-top:18px"></div><div class="sk" style="height:280px;margin-top:18px"></div>';
 ({dashboard:vDash,pengumuman:vAnn,ats:vAts,work:function(){vRep('work')},meter:function(){vRep('meter')},purchase:function(){vRep('purchase')},pengguna:vUsers,audit:vAudit,pengaturan:vSet})[p]()}
function closeMenu(){$('side').classList.remove('open');$('shade').classList.remove('open')}
$('nav').onclick=function(e){var a=e.target.closest('a');if(a)go(a.dataset.p)};
function openMenu(){$('side').classList.add('open');$('shade').classList.add('open')}
$('tabs').onclick=function(e){var a=e.target.closest('a');if(!a)return;if(a.dataset.p==='menu')openMenu();else go(a.dataset.p)};$('shade').onclick=closeMenu;
$('tp').onclick=function(){var p=$('p'),s=p.type==='password';p.type=s?'text':'password';this.textContent=s?'Sembunyikan':'Tampilkan'};
$('logout').onclick=function(){api('logout').catch(function(){});clearSess();showLogin()};
$('prof').onclick=function(){pwModal(false)};
setInterval(function(){$('clock').textContent=F2.format(new Date())+' WIB';tickCd()},1000);
function err(x){$('view').innerHTML='<div class="empty">'+esc(x.message)+'<br><br><button class="btn" id="retry">Coba lagi</button></div>';$('retry').onclick=function(){go(CUR)}}

$('lform').onsubmit=function(e){e.preventDefault();$('lerr').textContent='';var b=$('lbtn');b.disabled=true;b.textContent='Memproses...';
 api('login',{username:$('u').value.trim(),password:$('p').value}).then(function(r){saveSess(r.token,normU(r.user));enter(r.user)})
 .catch(function(x){$('lerr').textContent=x.message}).then(function(){b.disabled=false;b.textContent='Login'})};

function pwModal(force){
 modal('<h3>'+(force?'Ganti password awal':'Ganti password')+'</h3>'+(force?'<div class="info">Password awal harus diganti sebelum melanjutkan.</div>':'')+
 '<form id="pf"><label>Password lama</label><input id="po" type="password" required><label>Password baru (min. 8 karakter)</label><input id="pn" type="password" minlength="8" required>'+
 '<div class="merr" id="pe"></div><div class="fact"><button class="btn">Simpan password</button>'+(force?'':'<button type="button" class="btn sec" id="pc">Batal</button>')+'</div></form>');
 if(!force)$('pc').onclick=closeM;
 $('pf').onsubmit=function(e){e.preventDefault();api('changepw',{old:$('po').value,pw:$('pn').value}).then(function(r){if(r&&r.token)saveSess(r.token,U);U.mustChange=false;LS.setItem('stc_u',JSON.stringify(U));closeM();toast('Password berhasil diganti.')}).catch(function(x){$('pe').textContent=x.message})}}

/* ---- dashboard ---- */
function vDash(){Promise.all([api('dashboard'),api('ats_list')]).then(function(r){var d=r[0],fl=r[1].filter(function(f){return f.status!=='Completed'}),
 hr=Number(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',hour12:false}).format(new Date()))%24,
 gr=hr<11?'Selamat pagi':hr<15?'Selamat siang':hr<18?'Selamat sore':'Selamat malam',
 kp=[['Laporan hari ini',d.today,'','today'],['Laporan pekerjaan',d.work,'work','work'],['Laporan meteran',d.meter,'meter','meter'],['Laporan pembelian',d.purchase,'purchase','purchase']],
 qa=[['work','Catat pekerjaan'],['meter','Catat meteran'],['purchase','Catat pembelian']];
 var tix=fl.length?fl.slice(0,3).map(function(f){return '<div class="tk"><div class="tl"><span class="pri">'+esc(f.status)+'</span><b>'+esc(f.title)+'</b><small>'+esc([f.genre,f.duration,f.rating].filter(Boolean).join(', ')||'Detail film belum diisi')+'</small><div class="tm"><div><small>Mulai ATS</small><span>'+dt(f.atsAt)+'</span></div><div><small>Mulai tayang</small><span>'+dt(f.showAt)+'</span></div></div></div><div class="tr"><div class="cdl" data-f=\''+esc(JSON.stringify({status:f.status,atsAt:f.atsAt,showAt:f.showAt}))+'\'></div></div></div>'}).join(''):'<div class="empty"><b>Belum ada film ATS</b>Film yang dijadwalkan Admin akan tampil di sini.</div>';
 $('view').innerHTML='<h2>Dashboard</h2><div class="welcome"><div><b>'+gr+', '+esc(U.name)+'</b><small>'+new Intl.DateTimeFormat('id-ID',{timeZone:TZ,dateStyle:'full'}).format(new Date())+'</small></div><div class="quick">'+qa.map(function(x){return '<button class="qa" data-new="'+x[0]+'"><i>'+IC[x[0]]+'</i>'+x[1]+'</button>'}).join('')+'</div></div>'+
 '<div class="grid">'+kp.map(function(x){var tg=x[2]?'button':'div';return '<'+tg+' class="card kpi"'+(x[2]?' data-go="'+x[2]+'"':'')+'><div class="kt"><span class="l">'+x[0]+'</span><i class="ki">'+IC[x[3]]+'</i></div><div class="n">'+x[1]+'</div>'+(x[2]?'<span class="kf">Buka daftar</span>':'<span class="kf" style="color:var(--mut)">Sejak 00.00 WIB</span>')+'</'+tg+'>'}).join('')+'</div>'+
 '<div class="two"><div><div class="sh"><h2>Pengumuman terbaru</h2><button class="lnk" data-go="pengumuman">Lihat semua</button></div>'+(d.announcements.length?d.announcements.map(annCard).join(''):'<div class="empty"><b>Belum ada pengumuman</b>Informasi dari Admin akan tampil di sini.</div>')+'</div><div><div class="sh"><h2>Advanced Ticket Sales</h2><button class="lnk" data-go="ats">Lihat semua</button></div>'+tix+'</div></div>'+
 '<div class="sh"><h2>Aktivitas terbaru</h2></div>'+(d.recent.length?'<div class="scroll cards"><table class="rt"><tr><th>No. laporan</th><th>Kategori</th><th>Judul</th><th>Pelapor</th><th>Waktu</th><th></th></tr>'+
 d.recent.map(function(x){return '<tr><td data-l="No. laporan">'+esc(x.id)+'</td><td data-l="Kategori"><span class="tag">'+T[x.type].label+'</span></td><td class="sm">'+esc(x.title)+'</td><td data-l="Pelapor">'+esc(x.reporter)+'</td><td data-l="Waktu">'+dt(x.createdAt)+'</td><td class="act"><button class="btn sec" data-d="'+x.id+'">Detail</button></td></tr>'}).join('')+'</table></div>':'<div class="empty"><b>Belum ada laporan</b>Gunakan tombol "Catat" di atas untuk membuat laporan pertama.</div>');
 document.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){go(b.dataset.go)}});
 document.querySelectorAll('[data-new]').forEach(function(b){b.onclick=function(){repForm(b.dataset.new,null,function(){go('dashboard')})}});
 document.querySelectorAll('[data-d]').forEach(function(b){b.onclick=function(){detail(b.dataset.d,function(){go('dashboard')})}});
 tickCd()}).catch(err)}
function annCard(a){return '<div class="card ann ann-'+esc(a.priority)+'" style="margin-bottom:10px"><b>'+esc(a.title)+'</b> <span class="pri '+esc(a.priority)+'">'+esc(a.priority)+'</span>'+(a.status!=='Aktif'?' <span class="pri">Diarsipkan</span>':'')+'<div style="white-space:pre-wrap;margin:6px 0">'+esc(a.body)+'</div><small>'+dt(a.publishedAt)+' · '+esc(a.createdBy)+'</small></div>'}

/* ---- pengumuman ---- */
function vAnn(){api('ann_list').then(function(l){var adm=U.role==='ADMIN';
 $('view').innerHTML='<h2>Pengumuman</h2>'+(adm?'<p><button class="btn" id="aa">+ Pengumuman</button></p>':'')+(l.length?l.map(function(a){return annCard(a)+(adm?'<p style="margin:-4px 0 12px"><button class="btn sec" data-e="'+a.id+'">Edit</button> <button class="btn sec" data-x="'+a.id+'">'+(a.status==='Aktif'?'Arsipkan':'Aktifkan')+'</button></p>':'')}).join(''):'<div class="empty"><b>Belum ada pengumuman</b>Admin dapat menambahkan pengumuman lewat tombol di atas.</div>');
 if(!adm)return;$('aa').onclick=function(){annForm()};
 document.querySelectorAll('[data-e]').forEach(function(b){b.onclick=function(){annForm(l.filter(function(a){return a.id===b.dataset.e})[0])}});
 document.querySelectorAll('[data-x]').forEach(function(b){b.onclick=function(){api('ann_del',{id:b.dataset.x}).then(vAnn).catch(function(x){toast(x.message,1)})}})}).catch(err)}
function annForm(a){a=a||{};modal('<h3>'+(a.id?'Edit':'Tambah')+' pengumuman</h3><form id="af"><label>Judul *</label><input id="at" required value="'+esc(a.title)+'"><label>Isi *</label><textarea id="ab" rows="5" required>'+esc(a.body)+'</textarea><label>Prioritas</label><select id="ap">'+['Informasi','Penting','Mendesak'].map(function(o){return '<option'+(o===a.priority?' selected':'')+'>'+o+'</option>'}).join('')+'</select><div class="merr" id="ae"></div><div class="fact"><button class="btn">Simpan pengumuman</button><button type="button" class="btn sec" id="ac">Batal</button></div></form>');
 $('ac').onclick=closeM;$('af').onsubmit=function(e){e.preventDefault();api('ann_save',{id:a.id,title:$('at').value,body:$('ab').value,priority:$('ap').value}).then(function(){closeM();toast('Pengumuman disimpan.');vAnn()}).catch(function(x){$('ae').textContent=x.message})}}

/* ---- ATS ---- */
function cdInfo(f){var n=now();if(f.status==='Completed'||f.status==='Now Showing')return null;
 if(f.atsAt&&n<f.atsAt&&f.status!=='ATS Open')return ['Tiket mulai dijual dalam',f.atsAt];
 if(f.showAt&&n<f.showAt)return ['Film tayang dalam',f.showAt];return null}
function p2(n){return String(n).padStart(2,'0')}
function tickCd(){document.querySelectorAll('.cdl').forEach(function(e){var f=JSON.parse(e.dataset.f),i=cdInfo(f);
 if(!i){e.textContent=(f.atsAt||f.showAt)?'Waktu target tercapai. Status diperbarui Admin.':'Jadwal belum tersedia';return}
 var s=Math.max(0,Math.floor((i[1]-now())/1000));e.innerHTML='<small>'+i[0]+'</small><div class="cd"><span><b>'+p2(Math.floor(s/86400))+'</b>hari</span><span><b>'+p2(Math.floor(s%86400/3600))+'</b>jam</span><span><b>'+p2(Math.floor(s%3600/60))+'</b>menit</span><span><b>'+p2(s%60)+'</b>detik</span></div>'})}
function jk(ms){return ms?new Date(ms+7*3600000).toISOString().slice(0,16):''}
function vAts(){api('ats_list').then(function(l){var adm=U.role==='ADMIN';
 $('view').innerHTML='<h2>Advanced Ticket Sales</h2><div class="info">Informasi bukan jadwal resmi sampai dikonfirmasi Admin.</div>'+(adm?'<p><button class="btn" id="fa">+ Tambah film</button></p>':'')+
 (l.length?'<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">'+l.map(function(f){return '<div class="card film">'+(f.poster?'<img data-p="'+f.poster+'" data-u="'+esc(f.posterUrl||'')+'" alt="poster">':'<div class="noimg"></div>')+
 '<div><b>'+esc(f.title)+'</b><br><small>'+esc([f.genre,f.duration,f.rating].filter(Boolean).join(' · '))+'</small><br><span class="pri">'+esc(f.status)+'</span><br><small>ATS: '+dt(f.atsAt)+'<br>Tayang: '+dt(f.showAt)+'</small>'+(f.note?'<br><small>'+esc(f.note)+'</small>':'')+
 '<div class="cdl" data-f=\''+esc(JSON.stringify({status:f.status,atsAt:f.atsAt,showAt:f.showAt}))+'\'></div>'+(adm?'<div class="macts"><button class="btn sec" data-e="'+f.id+'">Edit</button><button class="btn sec" data-x="'+f.id+'">Hapus</button></div>':'')+'</div></div>'}).join('')+'</div>':'<div class="empty"><b>Belum ada film ATS</b>Admin dapat menambahkan film dan jadwal tiketnya.</div>');
 document.querySelectorAll('img[data-p]').forEach(function(i){fillImg(i,'poster')});tickCd();if(!adm)return;
 $('fa').onclick=function(){filmForm()};
 document.querySelectorAll('[data-e]').forEach(function(b){b.onclick=function(){filmForm(l.filter(function(f){return f.id===b.dataset.e})[0])}});
 document.querySelectorAll('[data-x]').forEach(function(b){b.onclick=function(){if(confirm('Hapus film ini?'))api('ats_del',{id:b.dataset.x}).then(vAts).catch(function(x){toast(x.message,1)})}})}).catch(err)}
function filmForm(f){f=f||{};var poster=null;
 modal('<h3>'+(f.id?'Edit':'Tambah')+' film</h3><form id="ff"><label>Judul *</label><input id="ft" required value="'+esc(f.title)+'"><div class="row2"><div><label>Genre</label><input id="fg" value="'+esc(f.genre)+'"></div><div><label>Durasi</label><input id="fd" placeholder="120 menit" value="'+esc(f.duration)+'"></div><div><label>Klasifikasi usia</label><input id="fr" placeholder="13+" value="'+esc(f.rating)+'"></div><div><label>Status</label><select id="fs">'+FS.map(function(o){return '<option'+(o===f.status?' selected':'')+'>'+o+'</option>'}).join('')+'</select></div><div><label>Mulai ATS (WIB)</label><input type="datetime-local" id="fa1" value="'+jk(f.atsAt)+'"></div><div><label>Mulai tayang (WIB)</label><input type="datetime-local" id="fa2" value="'+jk(f.showAt)+'"></div></div><label>Poster (JPG/PNG/WebP)</label><input type="file" id="fp" accept="image/jpeg,image/png,image/webp"><label>Catatan</label><textarea id="fn" rows="2">'+esc(f.note)+'</textarea><div class="merr" id="fe"></div><div class="fact"><button class="btn">Simpan film</button><button type="button" class="btn sec" id="fc">Batal</button></div></form>');
 $('fc').onclick=closeM;
 $('fp').onchange=function(){if(this.files[0])comp(this.files[0]).then(function(p){poster=p},function(){$('fe').textContent='Poster tidak valid.'})};
 var ms=function(v){return v?Date.parse(v+':00+07:00'):''};
 $('ff').onsubmit=function(e){e.preventDefault();api('ats_save',{id:f.id,title:$('ft').value,genre:$('fg').value,duration:$('fd').value,rating:$('fr').value,status:$('fs').value,atsAt:ms($('fa1').value),showAt:ms($('fa2').value),note:$('fn').value,poster:poster&&{mime:poster.mime,b64:poster.b64}})
 .then(function(){closeM();toast('Film disimpan.');vAts()}).catch(function(x){$('fe').textContent=x.message})}}

/* ---- foto ---- */
function comp(file){return new Promise(function(res,rej){
 if(['image/jpeg','image/png','image/webp'].indexOf(file.type)<0||file.size>15e6)return rej();
 var im=new Image(),u=URL.createObjectURL(file);im.onload=function(){var s=Math.min(1,1280/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);var url=c.toDataURL('image/jpeg',.8);res({mime:'image/jpeg',b64:url.split(',')[1],url:url})};im.onerror=rej;im.src=u})}

/* ---- laporan: daftar ---- */
function mtr(d){var f=function(v,x){return v==null?'-':v+(x!=null?' (+'+x+')':'')};
 if(d.kind==='Listrik'){if(d.lwbp==null)return d.reading+' kWh (data lama)';var x=d.diffs||{};return 'LWBP '+f(d.lwbp,x.lwbp)+' · WBP '+f(d.wbp,x.wbp)+' · Genset '+f(d.genset,x.genset)+' kWh'}
 return d.reading+' '+d.unit+(d.diff!=null?' (selisih '+d.diff+')':'')}
function sum(t,r){var d=r.data;return t==='work'?esc(r.title)+'<br><small>'+esc(d.location)+'</small> '+stb(d.status):t==='meter'?esc(d.kind)+' – '+esc(d.location)+'<br><small>'+mtr(d)+'</small>':esc(d.store)+'<br><small>'+RP.format(d.total)+' · '+d.items.length+' barang</small>'}
function vRep(t){var s=ST[t]=ST[t]||{page:1,q:'',from:'',to:'',status:''},c=T[t];
 $('view').innerHTML='<h2>'+c.label+'</h2><div class="bar"><input id="rq" type="search" placeholder="Cari nomor, judul, lokasi, atau pelapor" value="'+esc(s.q)+'"><label class="fl">Dari tanggal<input type="date" id="rf" value="'+s.from+'"></label><label class="fl">Sampai tanggal<input type="date" id="rt" value="'+s.to+'"></label>'+(t==='work'?'<select id="rs"><option value="">Semua status</option>'+WS.map(function(o){return '<option'+(o===s.status?' selected':'')+'>'+o+'</option>'}).join('')+'</select>':'')+'<button class="btn sec" id="rg">Cari</button><button class="btn sec" id="rx">Unduh Excel</button><button class="btn" id="ra">+ Buat laporan</button></div><div id="rl"><div class="sk" style="height:84px"></div><div class="sk" style="height:84px;margin-top:10px"></div><div class="sk" style="height:84px;margin-top:10px"></div></div>';
 function load(){s.q=$('rq').value;s.from=$('rf').value;s.to=$('rt').value;s.status=$('rs')?$('rs').value:'';
  api('rep_list',{type:t,q:s.q,from:s.from,to:s.to,status:s.status,page:s.page}).then(function(r){
   $('rl').className='';$('rl').innerHTML=r.items.length?'<div class="scroll cards"><table class="rt"><tr><th>No. Laporan</th><th>Waktu</th><th>Ringkasan</th><th>Pelapor</th><th>Aksi</th></tr>'+r.items.map(function(x){return '<tr><td data-l="No. laporan">'+esc(x.id)+'</td><td data-l="Waktu">'+dt(x.createdAt)+'</td><td class="sm">'+sum(t,x)+'</td><td data-l="Pelapor">'+esc(x.reporter)+'</td><td class="act"><button class="btn sec" data-d="'+x.id+'">Lihat detail</button></td></tr>'}).join('')+'</table></div><div class="pg"><button class="btn sec" id="pp"'+(r.page<2?' disabled':'')+'>‹</button> Hal. '+r.page+' / '+Math.ceil(r.total/r.size)+' ('+r.total+') <button class="btn sec" id="pn"'+(r.page*r.size>=r.total?' disabled':'')+'>›</button></div>':'<div class="empty"><b>Belum ada laporan</b>Ubah filter pencarian atau klik "+ Buat laporan" untuk mulai mencatat.</div>';
   document.querySelectorAll('[data-d]').forEach(function(b){b.onclick=function(){detail(b.dataset.d,load)}});
   if($('pp')){$('pp').onclick=function(){s.page--;load()};$('pn').onclick=function(){s.page++;load()}}}).catch(function(x){$('rl').className='empty';$('rl').innerHTML=esc(x.message)+'<br><br><button class="btn" id="rr">Coba lagi</button>';$('rr').onclick=load})}
 $('rg').onclick=function(){s.page=1;load()};$('ra').onclick=function(){repForm(t,null,load)};$('rx').onclick=function(){exportXls(t)};load()}


/* ---- unduh Excel per kategori (mengikuti filter yang sedang aktif) ---- */
function exportXls(t){
 if(typeof XLSX==='undefined'){toast('Library Excel belum termuat. Periksa koneksi internet lalu muat ulang halaman.',1);return}
 var b=$('rx');b.disabled=true;b.textContent='Menyiapkan...';
 api('rep_export',{type:t,q:$('rq').value,from:$('rf').value,to:$('rt').value,status:$('rs')?$('rs').value:''}).then(function(r){
  if(!r.items.length){toast('Tidak ada data untuk diunduh.',1);return}
  var it=r.items.slice().reverse(),wb=XLSX.utils.book_new(),n=function(v){return v==null?'':v};
  var add=function(name,head,rows,w){var ws=XLSX.utils.aoa_to_sheet([head].concat(rows));ws['!cols']=w.map(function(x){return {wch:x}});XLSX.utils.book_append_sheet(wb,ws,name)};
  if(t==='work'){
   add('Laporan Pekerjaan',['No. Laporan','Tanggal','Jam','Judul Pekerjaan','Kategori','Lokasi','Status','Tim','Deskripsi','Catatan','Pelapor','Dibuat','Diubah'],
    it.map(function(x){var d=x.data;return [x.id,d.date,d.time,d.title,d.category,d.location,d.status,(d.team||[]).join(', '),d.desc,d.note,x.reporter,dt(x.createdAt),dt(x.updatedAt)]}),
    [22,12,8,32,22,24,16,28,45,30,16,20,20]);
  }else if(t==='meter'){
   var L=it.filter(function(x){return x.data.kind!=='Air'}),A=it.filter(function(x){return x.data.kind==='Air'});
   if(L.length)add('Listrik',['No. Laporan','Tanggal','Jam','Lokasi','LWBP (kWh)','WBP (kWh)','Genset (kWh)','Selisih LWBP','Selisih WBP','Selisih Genset','Catatan','Pelapor','Dibuat'],
    L.map(function(x){var d=x.data,f=d.diffs||{},old=d.lwbp==null&&d.reading!=null?'Data lama: '+d.reading+' kWh'+(d.meterNo?' (meteran '+d.meterNo+')':'')+(d.note?' | ':''):'';
     return [x.id,d.date,d.time,d.location,n(d.lwbp),n(d.wbp),n(d.genset),n(f.lwbp),n(f.wbp),n(f.genset),old+n(d.note),x.reporter,dt(x.createdAt)]}),
    [22,12,8,26,13,13,14,13,13,15,30,16,20]);
   if(A.length)add('Air',['No. Laporan','Tanggal','Jam','Lokasi','Angka Meteran (m³)','Angka Sebelumnya','Selisih (m³)','Catatan','Pelapor','Dibuat'],
    A.map(function(x){var d=x.data;return [x.id,d.date,d.time,d.location,n(d.reading),n(d.prev),n(d.diff),n(d.note),x.reporter,dt(x.createdAt)]}),
    [22,12,8,26,18,17,13,30,16,20]);
  }else{
   add('Laporan Pembelian',['No. Laporan','Tanggal','Jam','Toko / Pemasok','Pembeli','Penerima','Keperluan','Jumlah Item','Total (Rp)','Catatan','Pelapor','Dibuat'],
    it.map(function(x){var d=x.data;return [x.id,d.date,d.time,d.store,d.buyer,d.receiver,d.purpose,(d.items||[]).length,d.total,d.note,x.reporter,dt(x.createdAt)]}),
    [22,12,8,28,18,18,26,12,14,30,16,20]);
   var rows=[];it.forEach(function(x){(x.data.items||[]).forEach(function(i){rows.push([x.id,x.data.date,x.data.store,i.name,n(i.category),i.qty,n(i.unit),i.price,i.total])})});
   add('Rincian Barang',['No. Laporan','Tanggal','Toko / Pemasok','Nama Barang','Kategori','Jumlah','Satuan','Harga Satuan (Rp)','Total (Rp)'],rows,[22,12,28,34,20,10,10,18,14]);
  }
  var nm={work:'Pekerjaan',meter:'Meteran',purchase:'Pembelian'}[t];
  XLSX.writeFile(wb,'Laporan_'+nm+'_'+new Date(now()+7*36e5).toISOString().slice(0,10)+'.xlsx');
  toast('File Excel berhasil dibuat ('+it.length+' laporan).');
 }).catch(function(x){toast(x.message,1)}).then(function(){b.disabled=false;b.textContent='Unduh Excel'})}

/* ---- laporan: detail ---- */
function detail(id,after){modal('<div class="empty">Memuat...</div>');api('rep_get',{id:id}).then(function(r){var t=r.type,d=r.data,h='<h3>'+T[t].label+'<span class="mid">'+esc(r.id)+'</span></h3><table>';
 T[t].f.forEach(function(f){if(f[5]&&f[5]!==d.kind)return;if(d[f[0]]!==''&&d[f[0]]!=null)h+='<tr><th>'+f[1]+'</th><td>'+(f[0]==='status'?stb(d[f[0]]):esc(d[f[0]]))+'</td></tr>'});
 if(t==='work')h+='<tr><th>Anggota tim</th><td>'+esc((d.team||[]).join(', ')||'-')+'</td></tr>';
 if(t==='meter'){if(d.meterNo)h+='<tr><th>Nomor meteran (data lama)</th><td>'+esc(d.meterNo)+'</td></tr>';
  if(d.kind==='Air')h+='<tr><th>Angka sebelumnya</th><td>'+(d.prev!=null?d.prev+' '+d.unit:'Belum tersedia')+'</td></tr><tr><th>Selisih</th><td>'+(d.diff!=null?d.diff+' '+d.unit:'-')+'</td></tr>';
  else if(d.lwbp==null&&d.reading!=null)h+='<tr><th>Pembacaan (data lama)</th><td>'+d.reading+' kWh</td></tr>';
  else if(d.lwbp!=null){var xf=d.diffs||{},ff=function(v){return v!=null?v+' kWh':'-'};h+='<tr><th>Selisih pemakaian</th><td>LWBP: '+ff(xf.lwbp)+'<br>WBP: '+ff(xf.wbp)+'<br>Genset: '+ff(xf.genset)+(d.prevs?'':'<br><small>Belum ada pencatatan sebelumnya</small>')+'</td></tr>'}}
 h+='<tr><th>Pelapor</th><td>'+esc(r.reporter)+'</td></tr><tr><th>Dibuat</th><td>'+dt(r.createdAt)+'</td></tr><tr><th>Diubah</th><td>'+dt(r.updatedAt)+'</td></tr></table>';
 if(t==='purchase')h+='<div class="scroll"><table><tr><th>Barang</th><th>Jml</th><th>Harga</th><th>Total</th></tr>'+d.items.map(function(i){return '<tr><td>'+esc(i.name)+'<br><small>'+esc(i.category)+'</small></td><td>'+i.qty+' '+esc(i.unit)+'</td><td>'+RP.format(i.price)+'</td><td>'+RP.format(i.total)+'</td></tr>'}).join('')+'<tr><th colspan="3">Total transaksi</th><th>'+RP.format(d.total)+'</th></tr></table></div>';
 var gk=t==='work'?[['Sebelum','Sebelum (Before)'],['Sesudah','Sesudah (After)'],['Foto','Lainnya']]:[['','Foto']];
 h+='<div id="gal">'+gk.map(function(g){var ps=(r.photos||[]).filter(function(p){return t!=='work'||p.kind===g[0]||(g[0]==='Foto'&&p.kind!=='Sebelum'&&p.kind!=='Sesudah')});return ps.length?'<b>'+g[1]+'</b><div class="ph">'+ps.map(function(p){return '<div><img data-p="'+p.id+'" data-u="'+esc(p.url||'')+'" alt="Foto dokumentasi" title="Klik untuk memperbesar"></div>'}).join('')+'</div>':''}).join('')+'</div>';
 var left=r.remainMs,t0=Date.now();
 if(U.role!=='ADMIN'&&r.own)h+=r.editable?'<div class="info">Anda dapat mengedit laporan ini selama 30 menit setelah laporan berhasil disimpan. Sisa: <b id="lf"></b></div>':'<div class="info">Batas waktu edit telah berakhir. Hubungi Admin jika diperlukan koreksi.</div>';
 h+='<div class="macts fact">'+(r.editable?'<button class="btn" id="de">Edit</button> ':'')+(U.role==='ADMIN'?'<button class="btn sec" id="dx">Arsipkan</button> ':'')+'<button class="btn sec" id="dc">Tutup</button></div>';
 modal(h);$('dc').onclick=closeM;
 document.querySelectorAll('#gal img').forEach(function(i){fillImg(i,'photo');i.onclick=function(){if(i.dataset.ok)lightbox(i.src)}});
 if($('lf')){var iv=setInterval(function(){var m=left-(Date.now()-t0);if(!$('lf')||m<=0){clearInterval(iv);if($('de')&&U.role!=='ADMIN')$('de').disabled=true;if($('lf'))$('lf').textContent='habis';return}$('lf').textContent=p2(Math.floor(m/60000))+':'+p2(Math.floor(m/1000)%60)},1000)}
 if($('de'))$('de').onclick=function(){repForm(t,r,after)};
 if($('dx'))$('dx').onclick=function(){var why=prompt('Arsipkan '+r.id+' ('+T[t].label+')? Alasan:');if(why===null)return;api('rep_del',{id:r.id,reason:why}).then(function(){closeM();toast('Laporan diarsipkan.');after&&after()}).catch(function(x){toast(x.message,1)})}
 }).catch(function(x){closeM();toast(x.message,1)})}

/* ---- laporan: form ---- */
function fld(f,v){var k=f[0],q=f[3]?' required':'',h='<label>'+f[1]+(f[3]?' *':'')+'</label>',v2=v==null?'':v;
 if(f[2]==='select')return h+'<select name="'+k+'"'+q+'>'+f[4].map(function(o){return '<option'+(o===v2?' selected':'')+'>'+esc(o)+'</option>'}).join('')+'</select>';
 if(f[2]==='textarea')return h+'<textarea name="'+k+'" rows="3">'+esc(v2)+'</textarea>';
 return h+'<input name="'+k+'" type="'+f[2]+'"'+(f[2]==='number'?' step="any" min="0"':'')+' value="'+esc(v2)+'"'+q+'>'}
function irow(i){i=i||{};return '<div class="irow"><input class="in" placeholder="Nama barang" value="'+esc(i.name)+'"><input class="ic" placeholder="Kategori" value="'+esc(i.category)+'"><input class="iq" type="number" step="any" min="0" placeholder="Jml" value="'+(i.qty||'')+'"><input class="iu" placeholder="Satuan" value="'+esc(i.unit)+'"><input class="ip" type="number" step="any" min="0" placeholder="Harga satuan" value="'+(i.price==null?'':i.price)+'"><b class="it"></b><button type="button" class="btn sec rm">×</button></div>'}
function repForm(t,rec,after){var c=T[t],d=rec?rec.data:{},PH=[],rid=uuid(),team=[],GR=t==='work'?[['Sebelum','Foto Sebelum (Before)'],['Sesudah','Foto Sesudah (After)']]:[['Foto','Foto dokumentasi']];
 var go2=function(){
  var h='<h3>'+(rec?'Edit '+esc(rec.id):'Buat '+c.label)+'</h3><form id="rfm"><div class="row2">'+c.f.map(function(f){return '<div'+(f[5]?' data-k="'+f[5]+'"':'')+(f[2]==='textarea'||f[0]==='kind'?' class="full"':'')+'>'+fld(f,d[f[0]]!=null?d[f[0]]:(f[0]==='date'?new Date(now()+7*36e5).toISOString().slice(0,10):f[0]==='time'?new Date(now()+7*36e5).toISOString().slice(11,16):''))+'</div>'}).join('')+'</div>';
  if(c.team)h+='<label>Anggota tim yang mengerjakan</label><div id="tm">'+team.map(function(n){return '<label style="font-weight:400;margin:4px 0"><input type="checkbox" style="width:auto;min-height:0" value="'+esc(n)+'"'+((d.team||[]).indexOf(n)>=0?' checked':'')+'> '+esc(n)+'</label>'}).join('')+'</div>';
  if(c.items)h+='<label>Barang *</label><div id="its">'+(d.items||[{}]).map(irow).join('')+'</div><button type="button" class="btn sec" id="ai">+ Tambah Barang</button><p><b>Total transaksi: <span id="gt">Rp 0</span></b></p>';
  h+=GR.map(function(g){return '<label>'+g[1]+' (JPG/PNG/WebP, maks 10 foto total)</label><input type="file" id="fi_'+g[0]+'" accept="image/jpeg,image/png,image/webp" multiple><div class="ph" id="pv_'+g[0]+'"></div>'}).join('')+'<div class="merr" id="re"></div><div class="fact"><button class="btn" id="rsv">Simpan laporan</button><button type="button" class="btn sec" id="rc">Batal</button></div></form>';
  modal(h);$('rc').onclick=closeM;
  if(t==='meter'){var ks=$('rfm').elements['kind'],tk=function(){document.querySelectorAll('#rfm [data-k]').forEach(function(w){var on=w.dataset.k===ks.value;w.style.display=on?'':'none';w.querySelectorAll('input').forEach(function(i){i.disabled=!on;i.required=on})})};ks.onchange=tk;tk();
   var sg=document.createElement('div');sg.className='seg';sg.innerHTML=['Listrik','Air'].map(function(o){return '<button type="button" data-v="'+o+'"><i>'+(o==='Air'?IC.water:IC.meter)+'</i>'+o+'</button>'}).join('');ks.style.display='none';ks.parentNode.appendChild(sg);
   var sy=function(){[].forEach.call(sg.children,function(b){b.classList.toggle('on',b.dataset.v===ks.value)})};sg.onclick=function(e){var b=e.target.closest('button');if(!b)return;ks.value=b.dataset.v;tk();sy()};sy()}
  function calc(){var g=0;document.querySelectorAll('.irow').forEach(function(r){var tt=Math.round((+r.querySelector('.iq').value||0)*(+r.querySelector('.ip').value||0));g+=tt;r.querySelector('.it').textContent=RP.format(tt)});if($('gt'))$('gt').textContent=RP.format(g)}
  if(c.items){$('its').oninput=calc;$('its').onclick=function(e){if(e.target.classList.contains('rm')&&document.querySelectorAll('.irow').length>1){e.target.parentNode.remove();calc()}};$('ai').onclick=function(){$('its').insertAdjacentHTML('beforeend',irow())};calc()}
  function prev(){GR.forEach(function(g){$('pv_'+g[0]).innerHTML=PH.map(function(p,i){return p.kind===g[0]?'<div><img src="'+p.url+'"><button type="button" class="x" data-i="'+i+'">×</button></div>':''}).join('')})}
  GR.forEach(function(g){
   $('pv_'+g[0]).onclick=function(e){if(e.target.dataset.i!=null){PH.splice(+e.target.dataset.i,1);prev()}};
   $('fi_'+g[0]).onchange=function(){var fs=[].slice.call(this.files),bad=0;this.value='';
    fs.reduce(function(p,f){return p.then(function(){if(PH.length>=10){bad++;return}return comp(f).then(function(x){x.kind=g[0];PH.push(x)},function(){bad++})})},Promise.resolve()).then(function(){prev();$('re').textContent=bad?bad+' file ditolak (format/ukuran tidak valid atau melebihi 10 foto).':''})}});
  $('rfm').onsubmit=function(e){e.preventDefault();var f=e.target,data={};
   c.f.forEach(function(x){if(x[5]&&x[5]!==data.kind)return;data[x[0]]=f.elements[x[0]].value});
   if(c.team)data.team=[].map.call(document.querySelectorAll('#tm input:checked'),function(i){return i.value});
   if(c.items)data.items=[].map.call(document.querySelectorAll('.irow'),function(r){return {name:r.querySelector('.in').value,category:r.querySelector('.ic').value,qty:r.querySelector('.iq').value,unit:r.querySelector('.iu').value,price:r.querySelector('.ip').value}});
   var b=$('rsv');b.disabled=true;b.textContent='Menyimpan...';$('re').textContent='';
   api('rep_save',{type:t,id:rec&&rec.id,reqId:rid,data:data,photos:PH.map(function(p){return {mime:p.mime,b64:p.b64,kind:p.kind}})}).then(function(r){closeM();toast(r.photoFailed?'Laporan tersimpan, '+r.photoFailed+' foto gagal diunggah.':'Laporan berhasil disimpan: '+r.id,!!r.photoFailed);after&&after()})
   .catch(function(x){$('re').textContent=x.message+' Isian Anda tidak dihapus; silakan coba lagi.';b.disabled=false;b.textContent='Simpan laporan'})}};
 if(c.team)api('team').then(function(n){team=n;go2()}).catch(function(x){toast(x.message,1)});else go2()}

/* ---- pengguna, audit, pengaturan ---- */
function vUsers(){api('usr_list').then(function(l){
 $('view').innerHTML='<h2>Manajemen Pengguna</h2><div class="bar"><input id="uq" type="search" placeholder="Cari nama atau username"><button class="btn" id="ua">+ Akun baru</button></div><div class="scroll cards"><table id="ut" class="rt"></table></div>';
 function draw(){var q=$('uq').value.toLowerCase();$('ut').innerHTML='<tr><th>Nama</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr>'+l.filter(function(u){return (u.fullName+' '+u.username).toLowerCase().indexOf(q)>=0}).map(function(u){return '<tr><td class="sm"><b>'+esc(u.fullName)+'</b></td><td data-l="Username">'+esc(u.username)+'</td><td data-l="Role">'+u.role+'</td><td data-l="Status">'+u.status+'</td><td class="act"><button class="btn sec" data-e="'+u.userId+'">Edit</button><button class="btn sec" data-r="'+u.userId+'">Reset password</button></td></tr>'}).join('');
  document.querySelectorAll('[data-e]').forEach(function(b){b.onclick=function(){uForm(l.filter(function(u){return u.userId===b.dataset.e})[0])}});
  document.querySelectorAll('[data-r]').forEach(function(b){b.onclick=function(){var p=prompt('Password sementara baru (min. 8 karakter):');if(p)api('usr_reset',{userId:b.dataset.r,password:p}).then(function(){toast('Password direset. Pengguna wajib menggantinya saat login.')}).catch(function(x){toast(x.message,1)})}})}
 $('uq').oninput=draw;$('ua').onclick=function(){uForm()};draw()}).catch(err)}
function uForm(u){var n=!u;u=u||{};modal('<h3>'+(n?'Akun baru':'Edit akun')+'</h3><form id="uf"><label>Nama lengkap *</label><input id="un" required value="'+esc(u.fullName)+'">'+(n?'<label>Username *</label><input id="uu" required><label>Password sementara * (min. 8)</label><input id="up" type="password" minlength="8" required>':'')+'<label>Role</label><select id="ur"><option'+(u.role==='USER'?' selected':'')+'>USER</option><option'+(u.role==='ADMIN'?' selected':'')+'>ADMIN</option></select>'+(n?'':'<label>Status</label><select id="us"><option'+(u.status==='Aktif'?' selected':'')+'>Aktif</option><option'+(u.status==='Nonaktif'?' selected':'')+'>Nonaktif</option></select>')+'<div class="merr" id="ue"></div><div class="fact"><button class="btn">Simpan akun</button><button type="button" class="btn sec" id="uc">Batal</button></div></form>');
 $('uc').onclick=closeM;$('uf').onsubmit=function(e){e.preventDefault();api('usr_save',{userId:u.userId,fullName:$('un').value,username:n&&$('uu').value,password:n&&$('up').value,role:$('ur').value,status:n?'Aktif':$('us').value}).then(function(){closeM();toast('Akun disimpan.');vUsers()}).catch(function(x){$('ue').textContent=x.message})}}
function vAudit(){var pg=1;(function load(){api('audit',{page:pg}).then(function(r){$('view').innerHTML='<h2>Audit Log</h2><div class="scroll cards"><table class="rt"><tr><th>Ringkasan</th><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Kategori</th><th>Record</th></tr>'+r.items.map(function(x){return '<tr><td class="sm">'+esc(x.summary||x.action)+'</td><td data-l="Waktu">'+dt(x.at)+'</td><td data-l="Pengguna">'+esc(x.userName)+' ('+x.role+')</td><td data-l="Aksi">'+esc(x.action)+'</td><td data-l="Kategori">'+esc(x.category)+'</td><td data-l="Record">'+esc(x.recordId)+'</td></tr>'}).join('')+'</table></div><div class="pg"><button class="btn sec" id="ap"'+(pg<2?' disabled':'')+'>‹</button> Hal. '+pg+' / '+Math.max(1,Math.ceil(r.total/r.size))+' <button class="btn sec" id="an"'+(pg*r.size>=r.total?' disabled':'')+'>›</button></div>';
  $('ap').onclick=function(){pg--;load()};$('an').onclick=function(){pg++;load()}}).catch(err)})()}
function vSet(){api('dashboard').then(function(){$('view').innerHTML='<h2>Pengaturan Sistem</h2><div class="card"><b>Integrasi</b><p>Google Apps Script: terhubung<br>Google Spreadsheet: terhubung (dashboard berhasil membaca data)<br>Zona waktu: Asia/Jakarta</p><p>Pengelolaan akun ada di menu Manajemen Pengguna. Ganti password lewat tombol Profil.</p></div>'}).catch(err)}

/* ---- mulai ---- */
if(TOKEN){var cu=null,pg=LS.getItem('stc_p')||'dashboard';try{cu=JSON.parse(LS.getItem('stc_u')||'null')}catch(e){}
 if(cu&&cu.role)enter(cu,pg);
 api('me').then(function(r){var u=normU(r);if(r&&r.token)TOKEN=r.token;LS.setItem('stc_u',JSON.stringify(u));LS.setItem('stc_t',TOKEN);
  if(!U)enter(u,pg);else{U.name=u.name;U.role=u.role;$('hname').textContent=u.name;$('hrole').textContent=u.role;$('av').textContent=String(u.name||'?').charAt(0).toUpperCase();if(u.mustChange&&!U.mustChange){U.mustChange=true;pwModal(true)}}})
 .catch(function(x){if(!TOKEN){showLogin();return}
  if(!U){$('lerr').textContent='Gagal memulihkan sesi: '+x.message}else toast('Koneksi ke server bermasalah: '+x.message,1)})}
setInterval(function(){if(TOKEN&&U)api('me').then(function(r){if(r&&r.token){TOKEN=r.token;LS.setItem('stc_t',TOKEN)}}).catch(function(){})},15*60*1000);
})();
