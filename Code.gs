/** STC XXI TECHNICAL REPORT - Backend (Google Apps Script). Tempel di proyek Apps Script yang dibuat dari Spreadsheet.
 *  Versi 8: STANDAR SUHU AC (default 23-23,5 C, hanya Admin yang dapat mengubah; status APPROVED / TOO-WARM / TOO-COLD dihitung di server,
 *  disimpan terpisah dari status lain), FOTO PROFIL dengan penggantian aman (foto lama dihapus hanya setelah foto baru + database berhasil).
 *  Versi 7: METERAN LISTRIK + AIR DALAM 1 LAPORAN (kind 'Gabungan'), akumulasi pemakaian, statistik untuk grafik periode
 *  (handler meter_prev & meter_stats). Laporan meteran lama (Listrik / Air terpisah) tetap terbaca dan ikut dihitung.
 *  Versi 6: foto sampai 50 per laporan (unggah bertahap), folder Drive per laporan, ZIP otomatis di atas 10 foto,
 *  Daily Monitoring AC multi-area, ekspor Excel, Report ID TR-YYYYMMDD-NNNN, validasi sisi server, migrasi skema otomatis,
 *  ARSIP BULANAN semua kategori, SHEET FOTO per kategori (setiap foto satu baris + pemeriksaan kelengkapan),
 *  role PELAPOR dan alur PERLU DIPERBAIKI (dilaporkan siapa saja, ditanggapi & diselesaikan Teknisi). */
var TZ='Asia/Jakarta', PAGE=15, MAXPH=50, PHBATCH=6, ZIP_AT=10, MAXB=4000000, EDIT_MIN=30, PUBLIC_PHOTOS=true, TOKEN_TTL=14*24*3600*1000, SCHEMA='10', MAXEXP=3000;
var SH={
 USERS:['userId','fullName','username','role','status','salt','hash','mustChange','createdAt','updatedAt','photoFileId'],
 ANNOUNCEMENTS:['id','title','body','priority','publishedAt','status','createdBy','updatedAt'],
 ATS_FILMS:['id','title','genre','duration','rating','atsAt','showAt','status','posterFileId','note','updatedAt'],
 REPORTS:['id','type','title','data','userId','reporter','createdAt','updatedAt','editDeadline','status','reqId','foto','folderId','zipId'],
 PHOTOS:['photoId','reportId','fileId','kind','uploadedAt','url','preview'],
 AUDIT_LOG:['logId','userId','userName','role','action','category','recordId','at','summary']
};
var PFX={work:'WORK',meter:'METER',purchase:'PURCHASE',ac:'AC',issue:'ISSUE'};
var FOLDERS={work:'WORK REPORTS',meter:'METER REPORTS',purchase:'PURCHASE REPORTS',ac:'AC MONITORING',issue:'ISSUE REPORTS',poster:'ATS POSTERS',avatar:'PROFILE PHOTOS'};
var WCAT=['Electrical','Mechanical','HVAC / AC','Plumbing','Audio','Projector','Building Maintenance','Preventive Maintenance','Corrective Maintenance','Lainnya'];
var WST=['Open','In Progress','Completed','Pending','Need Follow-up'];
var FST=['Upcoming ATS','ATS Open','Coming Soon','Coming to Theater','Now Showing','Completed'];
var ACUNIT=['Daikin','York'], ACMAX=20;
/* standar suhu AC: default 23 - 23,5 C; nilai aktif disimpan di Script Properties (AC_TMIN / AC_TMAX), hanya Admin yang dapat mengubah */
var ACMIN0=23, ACMAX0=23.5, AC_C_=null;
function acCfg_(){
 if(AC_C_)return AC_C_;
 var p=P_(),mn=parseFloat(p.getProperty('AC_TMIN')),mx=parseFloat(p.getProperty('AC_TMAX'));
 if(!isFinite(mn)||!isFinite(mx)||mn>mx){mn=ACMIN0;mx=ACMAX0;}
 AC_C_={min:mn,max:mx};return AC_C_;
}
/* APPROVED (di dalam batas, termasuk tepat di batas) | TOO-WARM (di atas batas atas) | TOO-COLD (di bawah batas bawah) */
function acEval_(v){var c=acCfg_(),t=Math.round(Number(v)*100)/100;return t>c.max?'TOO-WARM':(t<c.min?'TOO-COLD':'APPROVED');}
/* tampilan: hitung ulang status sesuai standar terbaru (hanya untuk output; data tersimpan tidak diubah) */
function acApply_(d){
 var c=acCfg_();
 d.rows=acRows_(d).map(function(a){var t=a.roomTemp,ok=t!==''&&t!=null&&isFinite(Number(t));a.tempStatus=ok?acEval_(t):'';return a;});
 d.tempStd={min:c.min,max:c.max};return d;
}
var ISP=['Rendah','Sedang','Tinggi','Darurat'];
var IST=['Menunggu','Ditanggapi','Sedang Dikerjakan','Selesai'];
var ROLES=['ADMIN','USER','REPORTER']; /* ADMIN=Admin, USER=Teknisi, REPORTER=Pelapor (hanya melaporkan "Perlu Diperbaiki") */
var PHS={work:'FOTO_PEKERJAAN',meter:'FOTO_METERAN',purchase:'FOTO_PEMBELIAN',ac:'FOTO_AC',issue:'FOTO_PERLU_DIPERBAIKI'};
var PHEAD=['ID Laporan','No','Kelompok / Area','Foto','Link Foto','Waktu Unggah','ID Foto'];
var ARCHL={work:'Laporan Pekerjaan',meter_listrik:'Meteran Listrik',meter_air:'Meteran Air',meter_gabungan:'Meteran Listrik dan Air',purchase:'Laporan Pembelian',ac:'Monitoring AC',issue:'Perlu Diperbaiki'};
/* laporan AC baru berisi banyak area (d.rows); laporan lama hanya satu area (location/unit/roomTemp) */
function acRows_(d){if(d&&Array.isArray(d.rows)&&d.rows.length)return d.rows;return (d&&d.location)?[{location:d.location,unit:d.unit,roomTemp:d.roomTemp,note:''}]:[];}

/* ===== SHEET PER KATEGORI =====
   REPORTS tetap menjadi database utama yang dibaca website. Setiap laporan juga ditulis otomatis
   ke sheet sesuai kategorinya (kolom terpisah + kolom foto/folder/ZIP). */
/* Menulis blok baris ke sheet. Sel berisi =HYPERLINK("url","label") ditulis sebagai TEKS BERTAUTAN (rich text),
   bukan rumus, sehingga tidak bergantung pada lokal spreadsheet (lokal Indonesia memakai ';' sebagai pemisah
   argumen rumus, sehingga rumus berkoma menjadi #ERROR!). Rumus lain (mis. =IMAGE) tetap ditulis seperti biasa. */
function putRows_(s,row,col,m){
 if(!m||!m.length)return;
 var re=/^=HYPERLINK\("([^"]+)","([^"]+)"\)$/,nr=m.length,nc=m[0].length,links={};
 var vals=m.map(function(r,i){return r.map(function(v,j){var x=typeof v==='string'&&re.exec(v);if(x){(links[j]=links[j]||{})[i]=x;return '';}return v;});});
 s.getRange(row,col,nr,nc).setValues(vals);
 Object.keys(links).forEach(function(j){
  var rv=m.map(function(r,i){var x=links[j][i],b=SpreadsheetApp.newRichTextValue();
   return [x?b.setText(x[2]).setLinkUrl(x[1]).build():b.setText(r[j]==null?'':String(r[j])).build()];});
  s.getRange(row,col+Number(j),nr,1).setRichTextValues(rv);
 });
}
/* JALANKAN sekali dari editor setelah kode ini dipasang: memperbaiki sel "#ERROR!" pada kolom Link Foto
   di semua sheet FOTO_*, serta kolom Folder/ZIP di sheet kategori. Tidak menghapus atau membangun ulang sheet. */
function perbaikiLinkFoto(){
 var t0=Date.now(),ph={},cnt=0,sh=0;
 all_('PHOTOS').forEach(function(p){if(p.fileId)ph[String(p.photoId)]=p.fileId;});
 Object.keys(PHS).forEach(function(t){
  var s=ss_().getSheetByName(PHS[t]);if(!s)return;var n=s.getLastRow();if(n<2)return;
  var ids=s.getRange(2,7,n-1,1).getValues(),
   rv=ids.map(function(r){var f=ph[String(r[0])],b=SpreadsheetApp.newRichTextValue();
    return [f?b.setText('Buka foto').setLinkUrl('https://drive.google.com/file/d/'+f+'/view').build():b.setText('').build()];});
  s.getRange(2,5,n-1,1).setRichTextValues(rv);cnt+=n-1;
 });
 all_('REPORTS').forEach(function(r){
  if(Date.now()-t0>300000||r.status==='Diarsipkan'||!PFX[r.type]||!r.folderId)return;
  try{syncFoto_(r.id);sh++;}catch(e){Logger.log('Gagal '+r.id+': '+e);}
 });
 Logger.log('Link foto diperbaiki: '+cnt+' baris di sheet FOTO_*; kolom folder/ZIP disinkronkan untuk '+sh+' laporan.'+((Date.now()-t0>300000)?' BATAS WAKTU TERCAPAI: jalankan sekali lagi.':''));
}

function fmtTs_(ms){var n=Number(ms);return n?Utilities.formatDate(new Date(n),TZ,'dd/MM/yyyy HH:mm'):'';}
function nz_(v){return v==null?'':v;}
function legacy_(d){var a=[];if(d.meterNo)a.push('No. meteran lama: '+d.meterNo);if(d.kind!=='Air'&&d.lwbp==null&&d.reading!=null)a.push('Pembacaan lama: '+d.reading+' kWh');if(d.note)a.push(d.note);return a.join(' | ');}
function mirKey_(t,d){return t==='meter'?(d&&d.kind==='Air'?'meter_air':(d&&d.kind==='Gabungan'?'meter_gabungan':'meter_listrik')):t;}
var MIR={
 work:{name:'WORK_REPORTS',num:[],wrap:[10],
  head:['ID Laporan','Dibuat','Tanggal','Jam','Judul Pekerjaan','Kategori','Lokasi','Status Pekerjaan','Tim','Deskripsi','Catatan','Pelapor','Terakhir Diubah','Status Data'],
  row:function(r,d){return [r.id,fmtTs_(r.createdAt),d.date,d.time,d.title,d.category,d.location,d.status,(d.team||[]).join(', '),d.desc,d.note,r.reporter,fmtTs_(r.updatedAt),r.status];}},
 meter_listrik:{name:'METER_LISTRIK',num:[6,7,8,9,10,11],wrap:[],
  head:['ID Laporan','Dibuat','Tanggal','Jam','Lokasi','LWBP (kWh)','WBP (kWh)','Genset (kWh)','Selisih LWBP','Selisih WBP','Selisih Genset','Catatan','Pelapor','Terakhir Diubah','Status Data'],
  row:function(r,d){var f=d.diffs||{};return [r.id,fmtTs_(r.createdAt),d.date,d.time,d.location,nz_(d.lwbp),nz_(d.wbp),nz_(d.genset),nz_(f.lwbp),nz_(f.wbp),nz_(f.genset),legacy_(d),r.reporter,fmtTs_(r.updatedAt),r.status];}},
 meter_air:{name:'METER_AIR',num:[6,7,8],wrap:[],
  head:['ID Laporan','Dibuat','Tanggal','Jam','Lokasi','Angka Meteran (m³)','Angka Sebelumnya','Selisih (m³)','Catatan','Pelapor','Terakhir Diubah','Status Data'],
  row:function(r,d){return [r.id,fmtTs_(r.createdAt),d.date,d.time,d.location,nz_(d.reading),nz_(d.prev),nz_(d.diff),legacy_(d),r.reporter,fmtTs_(r.updatedAt),r.status];}},
 meter_gabungan:{name:'METER_LISTRIK_AIR',num:[6,7,8,9,10,11,12,13,14],wrap:[],
  head:['ID Laporan','Dibuat','Tanggal','Jam','Lokasi','LWBP (kWh)','WBP (kWh)','Genset (kWh)','Selisih LWBP','Selisih WBP','Selisih Genset','Meteran Air (m³)','Air Sebelumnya','Selisih Air (m³)','Catatan','Pelapor','Terakhir Diubah','Status Data'],
  row:function(r,d){var f=d.diffs||{};return [r.id,fmtTs_(r.createdAt),d.date,d.time,d.location,nz_(d.lwbp),nz_(d.wbp),nz_(d.genset),nz_(f.lwbp),nz_(f.wbp),nz_(f.genset),nz_(d.reading),nz_(d.prev),nz_(d.diff),legacy_(d),r.reporter,fmtTs_(r.updatedAt),r.status];}},
 purchase:{name:'PURCHASE_REPORTS',num:[10,11],wrap:[9],
  head:['ID Laporan','Dibuat','Tanggal','Jam','Toko','Pembeli','Penerima','Keperluan','Rincian Barang','Jumlah Item','Total (Rp)','Catatan','Pelapor','Terakhir Diubah','Status Data'],
  row:function(r,d){var it=d.items||[];return [r.id,fmtTs_(r.createdAt),d.date,d.time,d.store,d.buyer,d.receiver,d.purpose,
   it.map(function(i,n){return (n+1)+'. '+i.name+(i.category?' ['+i.category+']':'')+' - '+i.qty+' '+(i.unit||'')+' x '+i.price+' = '+i.total;}).join('\n'),
   it.length,d.total,d.note,r.reporter,fmtTs_(r.updatedAt),r.status];}},
 ac:{name:'AC_MONITORING',num:[5],wrap:[6],
  head:['ID Laporan','Dibuat','Tanggal','Jam','Jumlah Area','Rincian (Area | Merk | Suhu | Catatan)','Catatan Umum','Pelapor','Terakhir Diubah','Status Data'],
  row:function(r,d){var rs=acRows_(d);return [r.id,fmtTs_(r.createdAt),d.date,d.time,rs.length,
   rs.map(function(a,i){return (i+1)+'. '+a.location+' | '+a.unit+' | '+nz_(a.roomTemp)+' °C'+(a.tempStatus?' ['+a.tempStatus+']':'')+(a.note?' | '+a.note:'');}).join('\n'),d.note,r.reporter,fmtTs_(r.updatedAt),r.status];}},
 issue:{name:'PERLU_DIPERBAIKI',num:[8],wrap:[6,9],
  head:['ID Laporan','Dibuat','Judul Masalah','Lokasi','Prioritas','Uraian Masalah','Status Perbaikan','Jumlah Tanggapan','Tanggapan Terakhir','Pelapor','Terakhir Diubah','Status Data'],
  row:function(r,d){var rp=d.responses||[],l=rp[rp.length-1];return [r.id,fmtTs_(r.createdAt),d.title,d.location,d.priority,d.desc,d.status,rp.length,
   l?(fmtTs_(l.at)+' | '+l.by+' | '+l.status+' | '+l.text):'',r.reporter,fmtTs_(r.updatedAt),r.status];}}
};
function mo_(ms){return Utilities.formatDate(new Date(Number(ms)),TZ,'yyyy-MM');}
function keyType_(k){return k.indexOf('meter')===0?'meter':k;}
/* bulan yang sudah diarsipkan per kategori: "<kunci>|YYYY-MM" disimpan di Script Properties */
function archDone_(){try{return JSON.parse(P_().getProperty('ARCH_DONE')||'[]');}catch(e){return [];}}
function isArch_(k,m){return archDone_().indexOf(k+'|'+m)>=0;}
function archMark_(k,m){var a=archDone_();if(a.indexOf(k+'|'+m)<0){a.push(k+'|'+m);P_().setProperty('ARCH_DONE',JSON.stringify(a));}}
function phHead_(k){return k==='work'?['Foto Before','Foto After','Jumlah Foto','Folder Foto','ZIP Foto']:['Foto','Jumlah Foto','Folder Foto','ZIP Foto'];}
function fullHead_(k){return MIR[k].head.concat(phHead_(k));}
function zipUrl_(id){return 'https://drive.google.com/uc?export=download&id='+id;}
function folderUrl_(id){return 'https://drive.google.com/drive/folders/'+id;}
/* info foto satu laporan: jumlah, foto pertama/Before/After, folder, ZIP */
function phInfo_(list,rep){
 list=list.slice().sort(function(a,b){return Number(a.uploadedAt)-Number(b.uploadedAt);});
 var f=function(k){return list.filter(function(p){return p.kind===k;})[0];},b=f('Sebelum'),a=f('Sesudah'),fi=list[0];
 return {n:list.length,first:fi&&fi.fileId,before:b&&b.fileId,after:a&&a.fileId,folder:(rep&&rep.folderId)||'',zip:(rep&&rep.zipId)||''};
}
function phCells_(k,i){
 var img=function(id){return (PUBLIC_PHOTOS&&id)?'=IMAGE("'+purl_(id,400)+'")':'';};
 var fo=i.folder?'=HYPERLINK("'+folderUrl_(i.folder)+'","Buka folder")':'',zp=i.zip?'=HYPERLINK("'+zipUrl_(i.zip)+'","Unduh ZIP")':'';
 return k==='work'?[img(i.before),img(i.after),i.n||'',fo,zp]:[img(i.first),i.n||'',fo,zp];
}
function mirrorSheet_(k){
 var m=MIR[k],ss=ss_(),s=ss.getSheetByName(m.name);if(s)return s;
 s=ss.insertSheet(m.name);var rows=Math.max(1,s.getMaxRows()-1),h=fullHead_(k),n=m.head.length;
 s.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold').setBackground('#0a3a2a').setFontColor('#ffffff');
 for(var c=1;c<=n;c++){if(m.num.indexOf(c)<0)s.getRange(2,c,rows,1).setNumberFormat('@');}
 m.wrap.forEach(function(c){s.getRange(2,c,rows,1).setWrap(true);s.setColumnWidth(c,320);});
 for(var j=n+1;j<=h.length;j++)s.setColumnWidth(j,j<=n+(k==='work'?2:1)?160:110);
 s.setFrozenRows(1);return s;
}
function mirrorLoc_(k,id){
 var s=ss_().getSheetByName(MIR[k].name);if(!s)return null;
 var n=s.getLastRow();if(n<2)return {s:s,row:0};
 var v=s.getRange(2,1,n-1,1).getValues();
 for(var i=0;i<v.length;i++)if(String(v[i][0])===String(id))return {s:s,row:i+2};
 return {s:s,row:0};
}
function mirror_(r,d){
 var k=mirKey_(r.type,d),m=MIR[k];if(!m)return;
 if(isArch_(k,mo_(r.createdAt)))return;
 var s=mirrorSheet_(k),loc=mirrorLoc_(k,r.id),v=m.row(r,d),row=(loc&&loc.row)?loc.row:s.getLastRow()+1;
 if(row>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),200);
 s.getRange(row,1,1,v.length).setValues([v]);
 /* bila jenis meteran berubah saat diedit, hapus baris lama di sheet meteran lainnya */
 if(r.type==='meter')['meter_listrik','meter_air','meter_gabungan'].forEach(function(o){if(o===k)return;var l=mirrorLoc_(o,r.id);if(l&&l.row)l.s.deleteRow(l.row);});
}
function mirrorSafe_(r,d){try{mirror_(r,d);}catch(e){Logger.log('Gagal menulis sheet kategori: '+e);}}
/* membangun ulang semua sheet kategori dari REPORTS + PHOTOS (aman dijalankan ulang) */
function rebuildMirrors_(){
 var ss=ss_(),ks=Object.keys(MIR),rows={},by={};
 ks.forEach(function(k){rows[k]=[];});
 all_('PHOTOS').forEach(function(p){if(p.fileId)(by[p.reportId]=by[p.reportId]||[]).push(p);});
 ks.forEach(function(k){var s=ss.getSheetByName(MIR[k].name);if(s)ss.deleteSheet(s);});
 all_('REPORTS').sort(function(a,b){return Number(a.createdAt)-Number(b.createdAt);}).forEach(function(r){
  var d,k;try{d=JSON.parse(r.data);k=mirKey_(r.type,d);}catch(e){Logger.log('Data rusak dilewati: '+r.id);return;}
  if(!MIR[k]||!PFX[r.type]||isArch_(k,mo_(r.createdAt)))return;
  var i=phInfo_(by[r.id]||[],r);rows[k].push({v:MIR[k].row(r,d).concat(phCells_(k,i)),has:i.n>0});
 });
 ks.forEach(function(k){
  var s=mirrorSheet_(k),list=rows[k],n=list.length;if(!n)return;
  if(n+1>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),n+1-s.getMaxRows()+50);
  putRows_(s,2,1,list.map(function(x){return x.v;}));
  list.forEach(function(x,j){if(x.has)s.setRowHeight(j+2,100);});
  Logger.log(MIR[k].name+': '+n+' laporan.');
 });
 rebuildPhotoSheets_();
}
/* JALANKAN dari editor bila ingin memaksa pembuatan ulang sheet kategori */
function pisahkanData(){rebuildMirrors_();Logger.log('Selesai. Sheet kategori dibangun ulang.');}

/* ===== SHEET FOTO PER KATEGORI =====
   Setiap foto dokumentasi = satu baris (gambar + tautan + kelompok/area). Dibuat saat foto diunggah, dan
   diperiksa kelengkapannya otomatis di akhir unggahan (photo_done) serta lewat periksaKelengkapanFoto(). */
function photoSheet_(t){
 var ss=ss_(),n=PHS[t],s=ss.getSheetByName(n);if(s)return s;
 s=ss.insertSheet(n);
 s.getRange(1,1,1,PHEAD.length).setValues([PHEAD]).setFontWeight('bold').setBackground('#0a3a2a').setFontColor('#ffffff');
 var rows=Math.max(1,s.getMaxRows()-1);
 s.getRange(2,1,rows,1).setNumberFormat('@');s.getRange(2,7,rows,1).setNumberFormat('@');
 s.setColumnWidth(1,170);s.setColumnWidth(3,170);s.setColumnWidth(4,160);s.setColumnWidth(5,110);s.setColumnWidth(6,130);s.setColumnWidth(7,160);
 s.setFrozenRows(1);return s;
}
function photoRow_(p,n){
 return [p.reportId,n,p.kind||'Foto',
  (PUBLIC_PHOTOS&&p.fileId)?'=IMAGE("'+purl_(p.fileId,400)+'")':'',
  p.fileId?'=HYPERLINK("https://drive.google.com/file/d/'+p.fileId+'/view","Buka foto")':'',
  fmtTs_(p.uploadedAt),p.photoId];
}
/* menambahkan baris foto yang belum ada untuk satu laporan; mengembalikan jumlah baris yang ditambahkan */
function syncPhotoRows_(rep,photosAll){
 if(!rep||!PHS[rep.type])return 0;
 var k;try{k=mirKey_(rep.type,JSON.parse(rep.data));}catch(e){k=rep.type;}
 if(isArch_(k,mo_(rep.createdAt)))return 0;
 var s=photoSheet_(rep.type),n=s.getLastRow(),have={},
  list=(photosAll||all_('PHOTOS')).filter(function(p){return p.reportId===rep.id&&p.fileId;}).sort(function(a,b){return Number(a.uploadedAt)-Number(b.uploadedAt);});
 if(n>1)s.getRange(2,7,n-1,1).getValues().forEach(function(r){have[String(r[0])]=1;});
 var miss=[];list.forEach(function(p,i){if(!have[String(p.photoId)])miss.push(photoRow_(p,i+1));});
 if(!miss.length)return 0;
 var start=s.getLastRow()+1;
 if(start+miss.length-1>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),miss.length+50);
 putRows_(s,start,1,miss);
 if(PUBLIC_PHOTOS)s.setRowHeights(start,miss.length,100);
 return miss.length;
}
/* JALANKAN dari editor kapan saja: memastikan SEMUA foto di tabel PHOTOS tampil di sheet foto kategorinya */
function periksaKelengkapanFoto(){
 var ph=all_('PHOTOS'),add=0,rp=0;
 all_('REPORTS').forEach(function(r){if(r.status==='Diarsipkan'||!PHS[r.type])return;rp++;
  try{add+=syncPhotoRows_(r,ph);}catch(e){Logger.log('Gagal memeriksa '+r.id+': '+e);}});
 Logger.log(rp+' laporan diperiksa, '+add+' baris foto yang kurang sudah ditambahkan.');return add;
}
function rebuildPhotoSheets_(){
 var ss=ss_(),by={},rows={};
 all_('PHOTOS').forEach(function(p){if(p.fileId)(by[p.reportId]=by[p.reportId]||[]).push(p);});
 Object.keys(PHS).forEach(function(t){var s=ss.getSheetByName(PHS[t]);if(s)ss.deleteSheet(s);rows[t]=[];});
 all_('REPORTS').sort(function(a,b){return Number(a.createdAt)-Number(b.createdAt);}).forEach(function(r){
  if(!rows[r.type]||r.status==='Diarsipkan')return;
  var k;try{k=mirKey_(r.type,JSON.parse(r.data));}catch(e){return;}
  if(isArch_(k,mo_(r.createdAt)))return;
  (by[r.id]||[]).sort(function(a,b){return Number(a.uploadedAt)-Number(b.uploadedAt);}).forEach(function(p,i){rows[r.type].push(photoRow_(p,i+1));});
 });
 Object.keys(PHS).forEach(function(t){
  var s=photoSheet_(t),n=rows[t].length;if(!n)return;
  if(n+1>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),n+1-s.getMaxRows()+50);
  putRows_(s,2,1,rows[t]);
  if(PUBLIC_PHOTOS)s.setRowHeights(2,n,100);
  Logger.log(PHS[t]+': '+n+' foto.');
 });
}

/* ===== ARSIP BULANAN (semua kategori) =====
   Awal bulan baru: laporan bulan lalu disalin ke file Google Sheets sendiri (Laporan + Foto + Rekap) di Drive,
   diverifikasi jumlah barisnya, lalu dihapus dari sheet kategori & sheet foto sehingga sheet mulai kosong lagi.
   Database utama REPORTS/PHOTOS TIDAK disentuh, jadi website tetap menyimpan semua riwayat. */
function archFolder_(k){
 var p=P_(),id=p.getProperty('F_arch_'+k);
 if(id)try{return DriveApp.getFolderById(id);}catch(e){}
 var f=folder_(folder_(folder_(null,'STC XXI TECHNICAL REPORT'),'ARSIP BULANAN'),ARCHL[k]);p.setProperty('F_arch_'+k,f.getId());return f;
}
/* hapus baris (kolom A cocok dengan ids) dari sheet, dari bawah ke atas, per blok berurutan */
function delRows_(name,ids){
 var s=ss_().getSheetByName(name);if(!s)return 0;
 var n=s.getLastRow();if(n<2)return 0;
 var v=s.getRange(2,1,n-1,1).getValues(),del=0,i=v.length-1;
 while(i>=0){
  if(ids[String(v[i][0])]){var j=i;while(j-1>=0&&ids[String(v[j-1][0])])j--;
   var c=i-j+1;if(s.getMaxRows()-c<2)s.insertRowsAfter(s.getMaxRows(),5);
   s.deleteRows(j+2,c);del+=c;i=j-1;}
  else i--;
 }
 return del;
}
function recap_(k,list){
 var R=[],ln=function(a){R.push(a);},num=function(v){v=Number(v);return isFinite(v)?v:0;},rd=function(v){return Math.round(v*1000)/1000;};
 var cnt=function(f){var o={};list.forEach(function(x){var v=f(x)||'-';o[v]=(o[v]||0)+1;});return o;};
 var sec=function(title,head,rows){ln([]);ln([title]);ln(head);rows.forEach(ln);};
 var cr=function(o){return Object.keys(o).sort().map(function(n){return [n,o[n]];});};
 ln(['Rekap '+ARCHL[k]]);ln(['Jumlah laporan',list.length]);
 if(k==='ac'){
  var a={};list.forEach(function(x){acRows_(x.d).forEach(function(r){var v=Number(r.roomTemp);if(!isFinite(v)||!r.location)return;
   var o=a[r.location]=a[r.location]||{n:0,s:0,mn:1e9,mx:-1e9};o.n++;o.s+=v;o.mn=Math.min(o.mn,v);o.mx=Math.max(o.mx,v);});});
  sec('Suhu per area',['Area','Jumlah data','Rata-rata (°C)','Terendah (°C)','Tertinggi (°C)'],Object.keys(a).sort().map(function(n){var o=a[n];return [n,o.n,Math.round(o.s/o.n*100)/100,o.mn,o.mx];}));
 }else if(k==='work'){
  sec('Berdasarkan status',['Status','Jumlah'],cr(cnt(function(x){return x.d.status;})));
  sec('Berdasarkan kategori',['Kategori','Jumlah'],cr(cnt(function(x){return x.d.category;})));
 }else if(k==='meter_listrik'){
  var l={};list.forEach(function(x){var f=x.d.diffs||{},o=l[x.d.location]=l[x.d.location]||{n:0,a:0,b:0,c:0};o.n++;o.a+=num(f.lwbp);o.b+=num(f.wbp);o.c+=num(f.genset);});
  sec('Pemakaian per lokasi (jumlah selisih)',['Lokasi','Jumlah pencatatan','LWBP (kWh)','WBP (kWh)','Genset (kWh)'],Object.keys(l).sort().map(function(n){var o=l[n];return [n,o.n,rd(o.a),rd(o.b),rd(o.c)];}));
 }else if(k==='meter_air'){
  var w={};list.forEach(function(x){var o=w[x.d.location]=w[x.d.location]||{n:0,a:0};o.n++;o.a+=num(x.d.diff);});
  sec('Pemakaian air per lokasi',['Lokasi','Jumlah pencatatan','Selisih total (m³)'],Object.keys(w).sort().map(function(n){return [n,w[n].n,rd(w[n].a)];}));
 }else if(k==='meter_gabungan'){
  var gb={};list.forEach(function(x){var f=x.d.diffs||{},o=gb[x.d.location]=gb[x.d.location]||{n:0,a:0,b:0,c:0,w:0};o.n++;o.a+=num(f.lwbp);o.b+=num(f.wbp);o.c+=num(f.genset);o.w+=num(x.d.diff);});
  sec('Pemakaian per lokasi (jumlah selisih)',['Lokasi','Jumlah pencatatan','LWBP (kWh)','WBP (kWh)','Genset (kWh)','Air (m³)'],Object.keys(gb).sort().map(function(n){var o=gb[n];return [n,o.n,rd(o.a),rd(o.b),rd(o.c),rd(o.w)];}));
 }else if(k==='purchase'){
  var g=0,st={};list.forEach(function(x){g+=num(x.d.total);var o=st[x.d.store]=st[x.d.store]||{n:0,t:0};o.n++;o.t+=num(x.d.total);});
  ln(['Total belanja (Rp)',g]);
  sec('Per toko / pemasok',['Toko','Jumlah transaksi','Total (Rp)'],Object.keys(st).sort().map(function(n){return [n,st[n].n,st[n].t];}));
 }else if(k==='issue'){
  sec('Berdasarkan status',['Status','Jumlah'],cr(cnt(function(x){return x.d.status;})));
  sec('Berdasarkan prioritas',['Prioritas','Jumlah'],cr(cnt(function(x){return x.d.priority;})));
 }
 var w2=0;R.forEach(function(r){if(r.length>w2)w2=r.length;});
 return R.map(function(r){var o=r.slice();while(o.length<w2)o.push('');return o;});
}
function arsipSatu_(k,m,list,by){
 var t=keyType_(k),mm=MIR[k],all={},res='',
  live=list.filter(function(x){return x.r.status!=='Diarsipkan';}).sort(function(a,b){return Number(a.r.createdAt)-Number(b.r.createdAt);});
 list.forEach(function(x){all[String(x.r.id)]=1;});
 if(live.length){
  var head=fullHead_(k),n=mm.head.length,prow=[],
   rows=live.map(function(x){return mm.row(x.r,x.d).concat(phCells_(k,phInfo_(by[x.r.id]||[],x.r)));});
  live.forEach(function(x){(by[x.r.id]||[]).slice().sort(function(a,b){return Number(a.uploadedAt)-Number(b.uploadedAt);}).forEach(function(p,i){prow.push(photoRow_(p,i+1));});});
  var nm='Arsip '+ARCHL[k]+' '+m,fol=archFolder_(k),it=fol.getFilesByName(nm);
  while(it.hasNext())it.next().setTrashed(true); /* sisa percobaan sebelumnya yang belum selesai */
  var ss=SpreadsheetApp.create(nm);DriveApp.getFileById(ss.getId()).moveTo(fol);
  var s1=ss.getSheets()[0].setName('Laporan');
  s1.getRange(1,1,1,head.length).setValues([head]).setFontWeight('bold').setBackground('#0a3a2a').setFontColor('#ffffff');
  for(var c=1;c<=n;c++){if(mm.num.indexOf(c)<0)s1.getRange(2,c,rows.length,1).setNumberFormat('@');}
  putRows_(s1,2,1,rows);
  mm.wrap.forEach(function(c){s1.getRange(2,c,rows.length,1).setWrap(true);s1.setColumnWidth(c,320);});
  s1.setFrozenRows(1);
  var s2=ss.insertSheet('Foto');
  s2.getRange(1,1,1,PHEAD.length).setValues([PHEAD]).setFontWeight('bold').setBackground('#0a3a2a').setFontColor('#ffffff');
  if(prow.length){
   s2.getRange(2,1,prow.length,1).setNumberFormat('@');s2.getRange(2,7,prow.length,1).setNumberFormat('@');
   putRows_(s2,2,1,prow);if(PUBLIC_PHOTOS)s2.setRowHeights(2,prow.length,100);
  }
  s2.setColumnWidth(4,160);s2.setFrozenRows(1);
  var rc=recap_(k,live),s3=ss.insertSheet('Rekap');
  s3.getRange(1,1,rc.length,rc[0].length).setValues(rc);s3.getRange(1,1).setFontWeight('bold').setFontSize(13);s3.setColumnWidth(1,220);
  SpreadsheetApp.flush();
  if(s1.getLastRow()-1!==live.length||s2.getLastRow()-1!==prow.length)throw new Error('Verifikasi arsip gagal: jumlah baris tidak sama.');
  res=nm+' ('+live.length+' laporan, '+prow.length+' foto)';
 }
 /* baru setelah terverifikasi: kosongkan dari sheet bulan berjalan */
 delRows_(mm.name,all);delRows_(PHS[t],all);archMark_(k,m);
 return res||('(tanpa laporan aktif) '+ARCHL[k]+' '+m);
}
function arsipBulan_(){
 var cur=mo_(Date.now()),reps=all_('REPORTS'),by={},made=[];
 all_('PHOTOS').forEach(function(p){if(p.fileId)(by[p.reportId]=by[p.reportId]||[]).push(p);});
 Object.keys(MIR).forEach(function(k){
  var t=keyType_(k),g={};
  reps.forEach(function(r){
   if(r.type!==t)return;var d;try{d=JSON.parse(r.data);}catch(e){return;}
   if(mirKey_(r.type,d)!==k)return;
   var m=mo_(r.createdAt);if(m>=cur||isArch_(k,m))return;
   (g[m]=g[m]||[]).push({r:r,d:d});
  });
  Object.keys(g).sort().forEach(function(m){
   try{made.push(arsipSatu_(k,m,g[m],by));}catch(e){Logger.log('Arsip GAGAL '+k+' '+m+': '+e);}
  });
 });
 return made;
}
function arsipBulananJob(){
 var lock=LockService.getScriptLock();lock.waitLock(60000);
 try{var r=arsipBulan_();Logger.log(r.length?('Arsip dibuat:\n'+r.join('\n')):'Tidak ada bulan yang perlu diarsipkan.');return r;}
 finally{lock.releaseLock();}
}
/* otomatis: dicek sekali per hari saat ada yang membuka website */
function autoArsip_(){
 var p=P_(),day=Utilities.formatDate(new Date(),TZ,'yyyyMMdd');
 if(p.getProperty('ARCH_DAY')===day)return;
 p.setProperty('ARCH_DAY',day);
 try{arsipBulananJob();}catch(e){Logger.log('Arsip otomatis gagal: '+e);}
}
/* JALANKAN SEKALI dari editor: pemicu tanggal 1 tiap bulan (sekitar pukul 01.00) + langsung mengarsipkan bulan lama */
function aktifkanArsipBulanan(){
 ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='arsipBulananJob')ScriptApp.deleteTrigger(t);});
 ScriptApp.newTrigger('arsipBulananJob').timeBased().onMonthDay(1).atHour(1).create();
 arsipBulananJob();Logger.log('Pemicu arsip bulanan aktif (tanggal 1, sekitar pukul 01.00).');
}

/* ===== migrasi skema otomatis (sekali setelah kode baru dipasang) ===== */
function ensureSchema_(){
 var p=P_();if(p.getProperty('SCHEMA')===SCHEMA)return;
 var lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  if(p.getProperty('SCHEMA')===SCHEMA)return;
  var ss=ss_();
  Object.keys(SH).forEach(function(n){var s=ss.getSheetByName(n);
   if(!s){s=ss.insertSheet(n);s.appendRow(SH[n]);s.setFrozenRows(1);return;}
   var h=s.getRange(1,1,1,Math.max(1,s.getLastColumn())).getValues()[0].map(String);
   SH[n].forEach(function(k){if(h.indexOf(k)<0){h.push(k);s.getRange(1,h.length).setValue(k);}});});
  var stale=Object.keys(MIR).some(function(k){var s=ss.getSheetByName(MIR[k].name);
   return s&&String(s.getRange(1,1,1,Math.max(1,s.getLastColumn())).getValues()[0])!==String(fullHead_(k));});
  var noPh=Object.keys(PHS).some(function(t){return !ss.getSheetByName(PHS[t]);});
  if(stale||noPh)try{rebuildMirrors_();}catch(e){Logger.log('Rebuild sheet kategori gagal: '+e);}
  p.setProperty('SCHEMA',SCHEMA);
 }finally{lock.releaseLock();}
}

/* ===== util ===== */
function bad_(m){throw new Error('!'+m);}
function P_(){return PropertiesService.getScriptProperties();}
function ss_(){var id=P_().getProperty('SHEET_ID');if(!id)bad_('Setup belum dijalankan.');return SpreadsheetApp.openById(id);}
function all_(n){var v=ss_().getSheetByName(n).getDataRange().getValues(),h=v.shift();return v.map(function(r,i){var o={_row:i+2};h.forEach(function(k,j){o[k]=r[j];});return o;});}
function add_(n,o){ss_().getSheetByName(n).appendRow(SH[n].map(function(k){return o[k]===undefined?'':o[k];}));}
function upd_(n,row,o){var s=ss_().getSheetByName(n);SH[n].forEach(function(k,j){if(o[k]!==undefined)s.getRange(row,j+1).setValue(o[k]);});}
function uid_(p){return p+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,10);}
function hx_(b){return b.map(function(x){return ('0'+(x&255).toString(16)).slice(-2);}).join('');}
function hash_(pw,salt){var h=pw;for(var i=0;i<1000;i++)h=hx_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+h+pw,Utilities.Charset.UTF_8));return h;}
function s_(v,m){return String(v==null?'':v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim().slice(0,m||500);}
function find_(un){un=String(un).toLowerCase();return all_('USERS').filter(function(u){return String(u.username).toLowerCase()===un;})[0];}
function pub_(u){return {userId:u.userId,name:u.fullName,username:u.username,role:u.role,mustChange:u.mustChange==='Y',photo:!!u.photoFileId};}
function log_(u,act,cat,rid,sum){add_('AUDIT_LOG',{logId:uid_('L'),userId:u.userId,userName:u.fullName,role:u.role,action:act,category:cat,recordId:rid||'',at:Date.now(),summary:s_(sum,300)});}
function folder_(parent,name){var it=parent?parent.getFoldersByName(name):DriveApp.getFoldersByName(name);return it.hasNext()?it.next():(parent?parent.createFolder(name):DriveApp.createFolder(name));}
function chkPw_(p){if(String(p||'').length<8)bad_('Password minimal 8 karakter.');}

/* ===== token & foto ===== */
function secret_(){var p=P_(),v=p.getProperty('TOKEN_SECRET');if(!v){v=Utilities.getUuid()+Utilities.getUuid();p.setProperty('TOKEN_SECRET',v);}return v;}
function purl_(fid,w){return 'https://lh3.googleusercontent.com/d/'+fid+'=w'+(w||800);}
function shareFile_(f){if(!PUBLIC_PHOTOS)return;try{f.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(e){Logger.log('Gagal mengatur berbagi: '+e);}}
/* folder kategori (dibuat otomatis bila belum ada) */
function catFolder_(t){
 var p=P_(),id=p.getProperty('F_'+t);
 if(id)try{return DriveApp.getFolderById(id);}catch(e){}
 var f=folder_(folder_(null,'STC XXI TECHNICAL REPORT'),FOLDERS[t]);p.setProperty('F_'+t,f.getId());return f;
}
/* satu folder Drive per laporan: <kategori>/<ID laporan> */
function repFolder_(rep){
 if(rep.folderId)try{return DriveApp.getFolderById(rep.folderId);}catch(e){}
 var f=folder_(catFolder_(rep.type),rep.id);shareFile_(f);upd_('REPORTS',rep._row,{folderId:f.getId()});rep.folderId=f.getId();return f;
}
function imgKind_(b){
 if(!b||b.length<12)return null;var a=b[0]&255,c=b[1]&255,d=b[2]&255,e=b[3]&255;
 if(a===0xFF&&c===0xD8)return 'image/jpeg';
 if(a===0x89&&c===0x50&&d===0x4E&&e===0x47)return 'image/png';
 if(a===0x52&&c===0x49&&d===0x46&&e===0x46&&(b[8]&255)===0x57)return 'image/webp';
 return null;
}
var EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
function addPhotos_(rid,photos){
 var rep=all_('REPORTS').filter(function(r){return r.id===rid;})[0];if(!rep)bad_('Laporan tidak ditemukan.');
 var fol=repFolder_(rep),n=all_('PHOTOS').filter(function(r){return r.reportId===rid;}).length,add=0,fail=0,ps=ss_().getSheetByName('PHOTOS');
 (photos||[]).slice(0,PHBATCH).forEach(function(ph){try{
  if(n>=MAXPH)throw new Error('melebihi batas '+MAXPH+' foto');
  var b=Utilities.base64Decode(String(ph&&ph.b64||'')),mime=imgKind_(b);if(!mime||b.length>MAXB)throw new Error('format/ukuran tidak valid');
  var kd=rep.type==='work'?(['Sebelum','Sesudah'].indexOf(ph&&ph.kind)>=0?ph.kind:'Foto'):rep.type==='ac'?(s_(ph&&ph.kind,60)||'Foto'):rep.type==='issue'?(['Masalah','Penyelesaian'].indexOf(ph&&ph.kind)>=0?ph.kind:'Masalah'):'Foto';
  var f=fol.createFile(Utilities.newBlob(b,mime,rid+'-'+('0'+(n+1)).slice(-2)+'.'+EXT[mime]));
  shareFile_(f);var fid=f.getId();n++;add++;
  add_('PHOTOS',{photoId:uid_('PH'),reportId:rid,fileId:fid,kind:kd,uploadedAt:Date.now(),url:PUBLIC_PHOTOS?purl_(fid,1200):'',preview:PUBLIC_PHOTOS?'=IMAGE("'+purl_(fid,300)+'")':''});
  try{ps.setRowHeight(ps.getLastRow(),90);}catch(e2){}
 }catch(e){fail++;Logger.log('foto gagal: '+e);}});
 return {added:add,failed:fail,total:n};
}
/* perbarui kolom foto di REPORTS dan di sheet kategori */
function syncFoto_(rid){
 var rep=all_('REPORTS').filter(function(r){return r.id===rid;})[0];if(!rep)return;
 var info=phInfo_(all_('PHOTOS').filter(function(p){return p.reportId===rid;}),rep);if(!info.n)return;
 var s=ss_().getSheetByName('REPORTS');
 if(PUBLIC_PHOTOS&&info.first){s.getRange(rep._row,SH.REPORTS.indexOf('foto')+1).setFormula('=IMAGE("'+purl_(info.first,400)+'")');s.setRowHeight(rep._row,100);}
 try{var mk=mirKey_(rep.type,JSON.parse(rep.data)),loc=mirrorLoc_(mk,rid);
  if(loc&&loc.row){var cells=phCells_(mk,info);putRows_(loc.s,loc.row,MIR[mk].head.length+1,[cells]);if(PUBLIC_PHOTOS)loc.s.setRowHeight(loc.row,100);}}
 catch(e){Logger.log(e);}
}
/* ZIP seluruh foto laporan, disimpan di folder laporan (dibuat ulang bila jumlah foto berubah) */
function makeZip_(rid){
 var lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  var rep=all_('REPORTS').filter(function(r){return r.id===rid;})[0];if(!rep)bad_('Laporan tidak ditemukan.');
  var ph=all_('PHOTOS').filter(function(p){return p.reportId===rid&&p.fileId;}).sort(function(a,b){return Number(a.uploadedAt)-Number(b.uploadedAt);});
  if(!ph.length)bad_('Laporan ini belum memiliki foto.');
  var fol=repFolder_(rep),it=fol.getFilesByName(rid+'.zip'),cur=null;
  while(it.hasNext()){var f=it.next();if(!cur&&f.getDescription()==='n='+ph.length)cur=f;else f.setTrashed(true);}
  if(!cur){var cnt={},blobs=ph.map(function(p){var b=DriveApp.getFileById(p.fileId).getBlob(),k=rep.type==='ac'?String(p.kind||'Foto').replace(/[^A-Za-z0-9_-]+/g,'_'):(p.kind==='Sebelum'||p.kind==='Sesudah')?p.kind:'Foto';
    cnt[k]=(cnt[k]||0)+1;b.setName(k+'_'+('0'+cnt[k]).slice(-2)+'.'+(EXT[b.getContentType()]||'jpg'));return b;});
   cur=fol.createFile(Utilities.zip(blobs,rid+'.zip'));cur.setDescription('n='+ph.length);shareFile_(cur);}
  upd_('REPORTS',rep._row,{zipId:cur.getId()});
  return {url:zipUrl_(cur.getId()),count:ph.length};
 }finally{lock.releaseLock();}
}
/* JALANKAN SEKALI bila perlu: membagikan ulang file foto lama & membangun ulang sheet kategori */
function perbaikiFoto(){
 var ps=ss_().getSheetByName('PHOTOS'),cu=SH.PHOTOS.indexOf('url')+1,cp=SH.PHOTOS.indexOf('preview')+1;
 all_('PHOTOS').forEach(function(p){if(!p.fileId)return;
  try{shareFile_(DriveApp.getFileById(p.fileId));}catch(e){Logger.log('File tidak ditemukan: '+p.fileId);return;}
  ps.getRange(p._row,cu).setValue(purl_(p.fileId,1200));ps.getRange(p._row,cp).setFormula('=IMAGE("'+purl_(p.fileId,300)+'")');ps.setRowHeight(p._row,90);});
 all_('ATS_FILMS').forEach(function(f){if(f.posterFileId)try{shareFile_(DriveApp.getFileById(f.posterFileId));}catch(e){}});
 ps.setColumnWidth(cp,160);rebuildMirrors_();Logger.log('Selesai.');
}
/* hapus foto profil LAMA milik pengguna ini (ke tempat sampah Drive, dapat dipulihkan 30 hari).
   Hanya dihapus bila: file ada di folder PROFILE PHOTOS, namanya diawali AVATAR-<userId>-, dan tidak dipakai pengguna lain.
   File default / aset bersama / file lain tidak pernah disentuh. Kegagalan hanya dicatat, tidak membatalkan penggantian. */
function delOldAvatar_(u,fid,fol){
 if(!fid)return false;
 try{
  if(all_('USERS').some(function(x){return x.userId!==u.userId&&String(x.photoFileId)===String(fid);}))return false;
  var f=DriveApp.getFileById(fid);
  if(f.getName().indexOf('AVATAR-'+u.userId+'-')!==0)return false;
  var ps=f.getParents(),ok=false;while(ps.hasNext()){if(ps.next().getId()===fol.getId())ok=true;}
  if(!ok)return false;
  f.setTrashed(true);return true;
 }catch(e){Logger.log('Foto profil lama tidak ditemukan / gagal dihapus: '+e);return false;}
}

/* ===== setup (jalankan sekali dari editor) ===== */
function setupAwal(){
 var p=P_(),ss=SpreadsheetApp.getActiveSpreadsheet();
 if(!ss)bad_('Proyek harus dibuat dari dalam Google Spreadsheet (Ekstensi > Apps Script).');
 var acc=[['Technical','Technical','USER','2121'],['Syafar','Syafar','ADMIN','master2121']];
 p.setProperty('SHEET_ID',ss.getId());
 Object.keys(SH).forEach(function(n){var s=ss.getSheetByName(n)||ss.insertSheet(n);
  if(s.getLastRow()===0){s.getRange(1,1,s.getMaxRows(),SH[n].length).setNumberFormat('@');s.appendRow(SH[n]);s.setFrozenRows(1);}});
 Object.keys(FOLDERS).forEach(function(k){catFolder_(k);});
 Object.keys(MIR).forEach(function(t){mirrorSheet_(t);});
 Object.keys(PHS).forEach(function(t){photoSheet_(t);});
 var made=[];
 acc.forEach(function(a){if(!find_(a[1])){var salt=Utilities.getUuid(),now=Date.now();
  add_('USERS',{userId:uid_('U'),fullName:a[0],username:a[1],role:a[2],status:'Aktif',salt:salt,hash:hash_(a[3],salt),mustChange:'Y',createdAt:now,updatedAt:now});made.push(a[1]);}});
 p.setProperty('SCHEMA',SCHEMA);
 Logger.log('Setup selesai. Akun baru: '+(made.join(', ')||'tidak ada (sudah ada)')+'. Password awal wajib diganti saat login pertama.');
}

/* ===== entry ===== */
function doGet(){return ContentService.createTextOutput('STC XXI API aktif | versi: v8-standar-suhu-ac');}
function doPost(e){
 var out;
 try{out={ok:true,data:route_(JSON.parse(e.postData.contents))};}
 catch(err){var m=(err&&err.message)||'';
  if(m.charAt(0)==='!'){out=m.charAt(1)==='@'?{ok:false,code:'AUTH',message:m.slice(2)}:{ok:false,message:m.slice(1)};}
  else{Logger.log(err&&err.stack||err);out={ok:false,message:'Terjadi kesalahan server: '+m};}}
 out.now=Date.now();
 return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function sig_(u,exp){return hx_(Utilities.computeHmacSha256Signature(u.userId+'.'+exp,secret_()+u.hash));}
function mk_(u){var exp=Date.now()+TOKEN_TTL;return u.userId+'.'+exp+'.'+sig_(u,exp);}
function session_(t){
 var p=String(t||'').split('.'),u=p.length===3&&all_('USERS').filter(function(x){return x.userId===p[0];})[0];
 if(!u||u.status!=='Aktif'||!(Number(p[1])>Date.now())||sig_(u,p[1])!==p[2])bad_('@Sesi berakhir, silakan login ulang.');
 return u;
}
function route_(q){
 var h=H[q.action];if(!h)bad_('Aksi tidak dikenal.');
 try{ensureSchema_();}catch(e){Logger.log('Migrasi skema gagal: '+e);}
 if(q.action==='login')return h(q);
 var u=session_(q.token);
 if(u.mustChange==='Y'&&['changepw','logout','me'].indexOf(q.action)<0)bad_('Anda harus mengganti password terlebih dahulu.');
 if(ROLES.indexOf(u.role)<0)bad_('Role akun tidak dikenal.');
 if(u.role==='REPORTER'&&RP_OK.indexOf(q.action)<0)bad_('Akses ditolak. Akun Pelapor hanya dapat melaporkan masalah yang perlu diperbaiki.');
 if(u.role!=='REPORTER')autoArsip_();
 var lock=null;
 if(/_(save|del)$|^(changepw|usr_reset)$/.test(q.action)){lock=LockService.getScriptLock();lock.waitLock(20000);}
 try{return h(u,q);}finally{if(lock)lock.releaseLock();}
}
var RP_OK=['me','logout','changepw','dashboard','ann_list','ats_list','rep_list','rep_get','rep_save','photo_save','photo_done','rep_zip','img','profile_photo_save'];
function adm_(u){if(u.role!=='ADMIN')bad_('Akses ditolak. Hanya Admin.');}

/* ===== laporan: validasi ===== */
function chkT_(t){if(!PFX[t])bad_('Jenis laporan tidak valid.');}
function dOk_(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v+'T00:00:00+07:00'))&&v>='2020-01-01'&&Date.parse(v+'T00:00:00+07:00')<=Date.now()+36*3600*1000;}
function tOk_(v){return !v||/^([01]\d|2[0-3]):[0-5]\d$/.test(v);}
function num_(v,min,max){if(v===''||v==null)return NaN;var n=Number(v);return (isFinite(n)&&n>=min&&n<=max)?n:NaN;}
function pick_(v,list,msg){v=s_(v,60);if(list.indexOf(v)<0)bad_(msg);return v;}
function clean_(t,x){
 var d={note:s_(x.note,2000),date:s_(x.date,10),time:s_(x.time,5),location:s_(x.location,200)};
 if(!dOk_(d.date)||!tOk_(d.time))bad_('Tanggal atau jam tidak valid.');
 if(t==='work'){
  d.title=s_(x.title,200);d.category=s_(x.category,50);d.status=s_(x.status,30);d.desc=s_(x.desc,4000);
  d.team=(Array.isArray(x.team)?x.team:[]).slice(0,20).map(function(n){return s_(n,100);}).filter(Boolean);
  if(!d.title||!d.location||WCAT.indexOf(d.category)<0||WST.indexOf(d.status)<0)bad_('Lengkapi judul, kategori, lokasi, dan status pekerjaan.');
 }else if(t==='meter'){
  /* laporan baru = 'Gabungan' (listrik + air sekaligus); 'Listrik' / 'Air' hanya untuk mengedit laporan lama */
  d.kind=(x.kind==='Air'||x.kind==='Listrik')?x.kind:'Gabungan';
  d.unit=d.kind==='Air'?'m³':(d.kind==='Listrik'?'kWh':'');
  if(!d.location||!d.time)bad_('Lengkapi lokasi dan jam pencatatan.');
  if(d.kind!=='Listrik'){d.reading=num_(x.reading,0,1e9);if(isNaN(d.reading))bad_('Isi angka meteran air dengan benar.');}
  if(d.kind!=='Air'){d.lwbp=num_(x.lwbp,0,1e9);d.wbp=num_(x.wbp,0,1e9);d.genset=num_(x.genset,0,1e9);
   if([d.lwbp,d.wbp,d.genset].some(isNaN))bad_('Isi angka LWBP, WBP, dan Genset dengan benar.');}
 }else if(t==='issue'){
  d.title=s_(x.title,200);d.desc=s_(x.desc,4000);d.priority=pick_(x.priority,ISP,'Pilih prioritas masalah.');d.status='Menunggu';d.responses=[];
  if(!d.title||!d.location||!d.desc)bad_('Lengkapi judul, lokasi, dan uraian masalah.');
 }else if(t==='ac'){
  var src=Array.isArray(x.rows)?x.rows:[];delete d.location;
  if(!src.length||src.length>ACMAX)bad_('Isi minimal satu area (maksimal '+ACMAX+' area).');
  /* suhu: hanya angka (titik atau koma desimal); status suhu SELALU dihitung di server dari standar aktif, nilai kiriman klien diabaikan */
  d.rows=src.map(function(r){r=r||{};var tv=String(r.roomTemp==null?'':r.roomTemp).trim().replace(',','.');tv=/^-?\d+(\.\d+)?$/.test(tv)?tv:'';
   var o={location:s_(r.location,100),unit:pick_(r.unit,ACUNIT,'Pilih merk AC (Daikin atau York).'),roomTemp:num_(tv,-10,80),note:s_(r.note,300)};
   if(!o.location||isNaN(o.roomTemp))bad_('Setiap area wajib punya nama dan suhu AC (angka -10 sampai 80).');
   o.tempStatus=acEval_(o.roomTemp);return o;});
  d.tempStd={min:acCfg_().min,max:acCfg_().max};
 }else{
  d.store=s_(x.store,200);d.buyer=s_(x.buyer,100);d.receiver=s_(x.receiver,100);d.purpose=s_(x.purpose,300);d.total=0;
  d.items=(Array.isArray(x.items)?x.items:[]).slice(0,50).map(function(i){var q=num_(i.qty,0,1e7),p=num_(i.price,0,1e10);
   if(!s_(i.name)||!(q>0)||isNaN(p))bad_('Setiap barang wajib punya nama, jumlah > 0, dan harga valid.');
   if(!s_(i.unit,20))bad_('Satuan barang wajib diisi.');
   var tot=Math.round(q*p);d.total+=tot;return {name:s_(i.name,200),category:s_(i.category,60),qty:q,unit:s_(i.unit,20),price:p,total:tot};});
  if(!d.items.length||!d.store||!d.buyer)bad_('Lengkapi toko, pembeli, dan minimal satu barang.');
 }
 return d;
}
function title_(t,d){return (t==='work'||t==='issue')?d.title:t==='meter'?'Meteran '+(d.kind==='Gabungan'?'Listrik & Air':d.kind)+' - '+d.location:t==='ac'?'Monitoring AC - '+d.rows.length+' area: '+d.rows.map(function(a){return a.location;}).join(', ').slice(0,120):d.store+' - '+d.items.map(function(i){return i.name;}).join(', ').slice(0,120);}

/* ===== METERAN: data, selisih, akumulasi =====
   Pemakaian = selisih angka antara dua pencatatan berurutan di LOKASI yang sama, dihitung terpisah untuk
   LWBP, WBP, Genset, dan Air. Laporan lama (Listrik / Air terpisah) dan laporan baru (Gabungan) dihitung bersama.
   Bila angka baru lebih kecil dari sebelumnya (meteran diganti/reset), selisih dikosongkan dan tidak diakumulasi. */
function rd3_(v){return Math.round(v*1000)/1000;}
/* seluruh pencatatan meteran yang aktif, urut waktu: e = angka listrik (atau null), w = angka air (atau null) */
function meterRecs_(){
 var out=[];
 all_('REPORTS').forEach(function(r){
  if(r.type!=='meter'||r.status==='Diarsipkan')return;
  var o;try{o=JSON.parse(r.data);}catch(e){return;}
  var loc=s_(o.location,200);if(!loc||!o.date)return;
  var k=o.kind==='Air'?'Air':(o.kind==='Gabungan'?'Gabungan':'Listrik');
  var e=(k!=='Air'&&o.lwbp!=null&&o.wbp!=null&&o.genset!=null&&isFinite(o.lwbp)&&isFinite(o.wbp)&&isFinite(o.genset))?{lwbp:Number(o.lwbp),wbp:Number(o.wbp),genset:Number(o.genset)}:null,
   w=(k!=='Listrik'&&o.reading!=null&&isFinite(o.reading))?Number(o.reading):null;
  if(!e&&w===null)return; /* data lama tanpa angka LWBP/WBP/Genset tidak bisa dihitung */
  out.push({id:r.id,date:String(o.date),time:o.time||'00:00',loc:loc,lk:loc.toLowerCase(),e:e,w:w});
 });
 out.sort(function(a,b){var x=a.date+' '+a.time,y=b.date+' '+b.time;return x<y?-1:(x>y?1:(a.id<b.id?-1:1));});
 return out;
}
/* peristiwa pemakaian dari daftar pencatatan yang sudah urut: [{d:tanggal, lk:lokasi, m:'lwbp|wbp|genset|air', v:selisih}] */
function meterUse_(recs){
 var ev=[],last={};
 recs.forEach(function(x){
  if(x.e)['lwbp','wbp','genset'].forEach(function(m){var k=x.lk+'|'+m,v=x.e[m];
   if(last[k]!==undefined&&v>=last[k])ev.push({d:x.date,lk:x.lk,m:m,v:rd3_(v-last[k])});last[k]=v;});
  if(x.w!==null){var k2=x.lk+'|air';
   if(last[k2]!==undefined&&x.w>=last[k2])ev.push({d:x.date,lk:x.lk,m:'air',v:rd3_(x.w-last[k2])});last[k2]=x.w;}
 });
 return ev;
}
/* mengisi d.prevs/d.diffs (listrik) dan d.prev/d.diff (air) terhadap pencatatan sebelumnya di lokasi yang sama */
function meterDiff_(d,selfId){
 var key=d.date+' '+d.time,lk=String(d.location).toLowerCase(),pe=null,pw=null;
 meterRecs_().forEach(function(x){
  if(x.id===selfId||x.lk!==lk||(x.date+' '+x.time)>=key)return;
  if(x.e)pe=x;
  if(x.w!==null)pw=x;});
 function df(a,b){return (a!=null&&isFinite(a)&&isFinite(b)&&b>=a)?rd3_(b-a):null;}
 if(d.kind!=='Air'){
  d.prevs=pe?{lwbp:pe.e.lwbp,wbp:pe.e.wbp,genset:pe.e.genset}:null;
  d.diffs={lwbp:df(pe&&pe.e.lwbp,d.lwbp),wbp:df(pe&&pe.e.wbp,d.wbp),genset:df(pe&&pe.e.genset,d.genset)};}
 if(d.kind!=='Listrik'){d.prev=pw?pw.w:null;d.diff=df(pw&&pw.w,d.reading);}
}
function editInfo_(u,r,now){
 if(u.role==='ADMIN')return {editable:true};
 var dl=Number(r.editDeadline);
 return (r.userId===u.userId&&now<=dl)?{editable:true,remainMs:dl-now}:{editable:false,own:r.userId===u.userId};
}
function out_(u,r,now){var o=editInfo_(u,r,now),d=JSON.parse(r.data);if(r.type==='ac')acApply_(d);return {id:r.id,type:r.type,title:r.title,reporter:r.reporter,createdAt:Number(r.createdAt),updatedAt:Number(r.updatedAt),data:d,editable:o.editable,remainMs:o.remainMs,own:o.own};}
/* Report ID unik: TR-YYYYMMDD-NNNN (urutan harian lintas semua kategori; dipanggil di dalam lock) */
function nextId_(now){
 var pre='TR-'+Utilities.formatDate(now,TZ,'yyyyMMdd')+'-',mx=0;
 all_('REPORTS').forEach(function(r){var id=String(r.id);if(id.indexOf(pre)===0){var n=parseInt(id.slice(pre.length),10);if(n>mx)mx=n;}});
 return pre+('0000'+(mx+1)).slice(-4);
}
function repFilter_(q,u){
 var s=s_(q.q,100).toLowerCase(),f=q.from?Date.parse(q.from+'T00:00:00+07:00'):0,to=q.to?Date.parse(q.to+'T23:59:59+07:00'):9e15;
 if(isNaN(f))f=0;if(isNaN(to))to=9e15;
 return all_('REPORTS').filter(function(r){
  if(r.type!==q.type||r.status==='Diarsipkan'||Number(r.createdAt)<f||Number(r.createdAt)>to)return false;
  if(u&&u.role==='REPORTER'&&r.userId!==u.userId)return false;
  if(s&&(r.id+' '+r.title+' '+r.reporter+' '+r.data).toLowerCase().indexOf(s)<0)return false;
  if(q.status&&JSON.parse(r.data).status!==q.status)return false;return true;}).sort(function(a,b){return b.createdAt-a.createdAt;});
}
function canPhoto_(u,rep){
 if(!rep||rep.status==='Diarsipkan')bad_('Laporan tidak ditemukan.');
 if(u.role==='ADMIN')return;
 if(rep.type==='issue'&&u.role==='USER')return; /* Teknisi boleh melampirkan foto penyelesaian */
 if(rep.userId!==u.userId)bad_('Anda hanya dapat menambah foto pada laporan milik sendiri.');
 if(Date.now()>Number(rep.editDeadline)+EDIT_MIN*60000)bad_('Batas waktu unggah foto telah berakhir. Hubungi Admin.');
}

/* ===== handler ===== */
var H={
 login:function(q){
  var un=s_(q.username,60),c=CacheService.getScriptCache(),k='f_'+un.toLowerCase(),u=un&&find_(un);
  if(Number(c.get(k)||0)>=5)bad_('Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  if(!u||u.status!=='Aktif'||hash_(String(q.password||''),u.salt)!==u.hash){c.put(k,String(Number(c.get(k)||0)+1),900);bad_('Username atau password salah.');}
  c.remove(k);var t=mk_(u);
  log_(u,'LOGIN','USERS',u.userId,'Login berhasil');return {token:t,user:pub_(u)};
 },
 logout:function(){return true;},
 me:function(u){var o=pub_(u);o.token=mk_(u);return o;},
 changepw:function(u,q){
  if(hash_(String(q.old||''),u.salt)!==u.hash)bad_('Password lama salah.');chkPw_(q.pw);
  var salt=Utilities.getUuid(),nh=hash_(q.pw,salt);upd_('USERS',u._row,{salt:salt,hash:nh,mustChange:'N',updatedAt:Date.now()});
  log_(u,'GANTI_PASSWORD','USERS',u.userId,'Pengguna mengganti password');return {token:mk_({userId:u.userId,hash:nh})};
 },
 /* FOTO PROFIL (milik sendiri). Urutan aman: validasi -> simpan file baru -> perbarui database -> verifikasi -> baru hapus foto lama.
    Bila langkah mana pun sebelum penghapusan gagal, file baru dibuang dan foto lama tetap dipakai. */
 profile_photo_save:function(u,q){
  var b;try{b=Utilities.base64Decode(String(q.b64||''));}catch(e0){bad_('Data foto tidak valid.');}
  var mime=imgKind_(b);if(!mime||b.length>MAXB)bad_('Foto harus JPG/PNG/WebP dan maksimal 4 MB.');
  var old=String(u.photoFileId||''),f=null,fol=catFolder_('avatar'),nid='';
  try{
   f=fol.createFile(Utilities.newBlob(b,mime,'AVATAR-'+u.userId+'-'+Date.now()+'.'+EXT[mime]));nid=f.getId();
   upd_('USERS',u._row,{photoFileId:nid,updatedAt:Date.now()});
   var chk=all_('USERS').filter(function(x){return x.userId===u.userId;})[0];
   if(!chk||String(chk.photoFileId)!==nid)throw new Error('verifikasi database gagal');
  }catch(e){
   Logger.log('Ganti foto profil gagal: '+e);
   if(old)try{upd_('USERS',u._row,{photoFileId:old});}catch(e1){} /* pastikan referensi lama utuh */
   if(f)try{f.setTrashed(true);}catch(e2){}
   bad_('Gagal menyimpan foto profil. Foto lama dipertahankan.');
  }
  var removed=old&&old!==nid?delOldAvatar_(u,old,fol):false;
  log_(u,'GANTI_FOTO_PROFIL','USERS',u.userId,removed?'Foto lama dihapus':'Foto profil diperbarui');
  return {photo:true,removedOld:removed};
 },
 /* STANDAR SUHU AC: dibaca semua non-Pelapor, diubah HANYA oleh Admin (dicek di sini, bukan di frontend) */
 ac_cfg_get:function(u){var c=acCfg_();return {min:c.min,max:c.max,def:{min:ACMIN0,max:ACMAX0}};},
 ac_cfg_save:function(u,q){adm_(u);
  var cv=function(v){v=String(v==null?'':v).trim().replace(',','.');return /^-?\d+(\.\d+)?$/.test(v)?Math.round(Number(v)*100)/100:NaN;},mn=cv(q.min),mx=cv(q.max);
  if(isNaN(mn)||isNaN(mx)||mn<-10||mx>80||mx<-10||mn>80)bad_('Isi batas suhu bawah dan atas dengan angka -10 sampai 80.');
  if(mn>mx)bad_('Batas bawah tidak boleh lebih besar dari batas atas.');
  P_().setProperties({AC_TMIN:String(mn),AC_TMAX:String(mx)});AC_C_=null;
  log_(u,'UBAH_STANDAR_SUHU_AC','SETTINGS','','Standar suhu AC: '+mn+' - '+mx+' C');
  return {min:mn,max:mx};},
 team:function(){return all_('USERS').filter(function(x){return x.status==='Aktif'&&x.role!=='REPORTER';}).map(function(x){return x.fullName;});},
 dashboard:function(u){
  var now=new Date(),day=Utilities.formatDate(now,TZ,'yyyyMMdd'),rep=u.role==='REPORTER',
   rp=all_('REPORTS').filter(function(r){return r.status!=='Diarsipkan'&&(!rep||(r.type==='issue'&&r.userId===u.userId));});
  var c=function(t){return rp.filter(function(r){return r.type===t;}).length;};
  var isOpen=rp.filter(function(r){return r.type==='issue'&&JSON.parse(r.data).status!=='Selesai';}).length;
  var films=all_('ATS_FILMS').filter(function(f){return ['Upcoming ATS','ATS Open','Coming Soon','Coming to Theater'].indexOf(f.status)>=0;});
  return {work:c('work'),meter:c('meter'),purchase:c('purchase'),ac:c('ac'),issue:c('issue'),issueOpen:isOpen,
   today:rp.filter(function(r){return Utilities.formatDate(new Date(Number(r.createdAt)),TZ,'yyyyMMdd')===day;}).length,
   films:films.length,
   announcements:all_('ANNOUNCEMENTS').filter(function(a){return a.status==='Aktif';}).sort(function(a,b){return b.publishedAt-a.publishedAt;}).slice(0,5).map(annOut_),
   recent:rp.sort(function(a,b){return b.createdAt-a.createdAt;}).slice(0,8).map(function(r){return out_(u,r,now.getTime());})};
 },
 ann_list:function(u){return all_('ANNOUNCEMENTS').filter(function(a){return u.role==='ADMIN'||a.status==='Aktif';}).sort(function(a,b){return b.publishedAt-a.publishedAt;}).map(annOut_);},
 ann_save:function(u,q){adm_(u);
  var o={title:s_(q.title,200),body:s_(q.body,4000),priority:['Informasi','Penting','Mendesak'].indexOf(q.priority)>=0?q.priority:'Informasi',updatedAt:Date.now()};
  if(!o.title||!o.body)bad_('Judul dan isi wajib diisi.');
  if(q.id){var a=all_('ANNOUNCEMENTS').filter(function(x){return x.id===q.id;})[0];if(!a)bad_('Pengumuman tidak ditemukan.');upd_('ANNOUNCEMENTS',a._row,o);log_(u,'EDIT_PENGUMUMAN','ANNOUNCEMENTS',q.id,o.title);return q.id;}
  o.id=uid_('A');o.publishedAt=Date.now();o.status='Aktif';o.createdBy=u.fullName;add_('ANNOUNCEMENTS',o);log_(u,'BUAT_PENGUMUMAN','ANNOUNCEMENTS',o.id,o.title);return o.id;
 },
 ann_del:function(u,q){adm_(u);var a=all_('ANNOUNCEMENTS').filter(function(x){return x.id===q.id;})[0];if(!a)bad_('Pengumuman tidak ditemukan.');
  var st=a.status==='Aktif'?'Diarsipkan':'Aktif';upd_('ANNOUNCEMENTS',a._row,{status:st,updatedAt:Date.now()});log_(u,'ARSIP_PENGUMUMAN','ANNOUNCEMENTS',q.id,'Status: '+st);return st;},
 ats_list:function(){return all_('ATS_FILMS').sort(function(a,b){return (Number(a.atsAt)||9e15)-(Number(b.atsAt)||9e15);}).map(function(f){
  return {id:f.id,title:f.title,genre:f.genre,duration:f.duration,rating:f.rating,atsAt:Number(f.atsAt)||0,showAt:Number(f.showAt)||0,status:f.status,poster:f.posterFileId,posterUrl:(PUBLIC_PHOTOS&&f.posterFileId)?purl_(f.posterFileId,700):'',note:f.note};});},
 ats_save:function(u,q){adm_(u);
  var o={title:s_(q.title,200),genre:s_(q.genre,100),duration:s_(q.duration,30),rating:s_(q.rating,20),atsAt:Number(q.atsAt)||'',showAt:Number(q.showAt)||'',status:FST.indexOf(q.status)>=0?q.status:'Coming Soon',note:s_(q.note,1000),updatedAt:Date.now()};
  if(!o.title)bad_('Judul film wajib diisi.');
  if(q.poster&&q.poster.b64){var pb=Utilities.base64Decode(String(q.poster.b64)),pm=imgKind_(pb);
   if(!pm||pb.length>MAXB)bad_('Poster harus JPG/PNG/WebP dan maks 4 MB.');
   var pf=catFolder_('poster').createFile(Utilities.newBlob(pb,pm,'POSTER-'+Date.now()+'.'+EXT[pm]));shareFile_(pf);o.posterFileId=pf.getId();}
  if(q.id){var f=all_('ATS_FILMS').filter(function(x){return x.id===q.id;})[0];if(!f)bad_('Film tidak ditemukan.');upd_('ATS_FILMS',f._row,o);log_(u,'EDIT_ATS','ATS_FILMS',q.id,o.title);return q.id;}
  o.id=uid_('F');add_('ATS_FILMS',o);log_(u,'BUAT_ATS','ATS_FILMS',o.id,o.title);return o.id;
 },
 ats_del:function(u,q){adm_(u);var f=all_('ATS_FILMS').filter(function(x){return x.id===q.id;})[0];if(!f)bad_('Film tidak ditemukan.');
  ss_().getSheetByName('ATS_FILMS').deleteRow(f._row);log_(u,'HAPUS_ATS','ATS_FILMS',q.id,f.title);return true;},
 rep_list:function(u,q){
  chkT_(q.type);if(u.role==='REPORTER'&&q.type!=='issue')bad_('Akses ditolak.');var pg=Math.max(1,Number(q.page)||1),now=Date.now(),rows=repFilter_(q,u);
  return {total:rows.length,page:pg,size:PAGE,items:rows.slice((pg-1)*PAGE,pg*PAGE).map(function(r){return out_(u,r,now);})};
 },
 /* ekspor Excel/PDF: semua laporan sesuai filter + info foto/folder/ZIP (Pelapor tidak boleh mengekspor) */
 rep_export:function(u,q){
  chkT_(q.type);if(u.role==='REPORTER')bad_('Akses ditolak.');var now=Date.now(),rows=repFilter_(q,u).slice(0,MAXEXP),by={};
  all_('PHOTOS').forEach(function(p){if(p.fileId)(by[p.reportId]=by[p.reportId]||[]).push(p);});
  return {total:rows.length,items:rows.map(function(r){var o=out_(u,r,now),i=phInfo_(by[r.id]||[],r),w=function(id){return id?purl_(id,1200):'';};
   o.ph={n:i.n,first:w(i.first),before:w(i.before),after:w(i.after),folder:i.folder?folderUrl_(i.folder):'',zip:i.zip?zipUrl_(i.zip):''};return o;})};
 },
 /* METERAN: angka sebelumnya + akumulasi pemakaian untuk satu lokasi.
    q.location, q.until ('YYYY-MM-DD HH:mm'; tanpa until = semua pencatatan), q.inclusive (sertakan pencatatan tepat di until),
    q.exclude (ID laporan yang sedang diedit). Selalu mengembalikan daftar lokasi yang pernah dipakai. */
 meter_prev:function(u,q){
  if(u.role==='REPORTER')bad_('Akses ditolak.');
  var lk=s_(q.location,200).toLowerCase(),until=s_(q.until,20),inc=!!q.inclusive,ex=s_(q.exclude,80),all=meterRecs_(),lm={};
  all.forEach(function(x){lm[x.lk]=x.loc;});
  var locations=Object.keys(lm).map(function(k){return lm[k];}).sort(),
   mine=all.filter(function(x){
    if(!lk||x.lk!==lk||(ex&&x.id===ex))return false;
    if(!until)return true;
    var k=x.date+' '+x.time;return inc?k<=until:k<until;}),
   le=null,lw=null,last=null,cum={lwbp:0,wbp:0,genset:0,air:0};
  mine.forEach(function(x){if(x.e)le=x;if(x.w!==null)lw=x;last=x;});
  meterUse_(mine).forEach(function(e){cum[e.m]+=e.v;});
  Object.keys(cum).forEach(function(k){cum[k]=rd3_(cum[k]);});
  return {locations:locations,count:mine.length,since:mine.length?mine[0].date:'',
   last:last?{date:last.date,time:last.time}:null,
   elec:le?{lwbp:le.e.lwbp,wbp:le.e.wbp,genset:le.e.genset,date:le.date,time:le.time}:null,
   water:lw?{reading:lw.w,date:lw.date,time:lw.time}:null,
   cum:cum,has:{e:mine.some(function(x){return !!x.e;}),w:mine.some(function(x){return x.w!==null;})}};
 },
 /* METERAN: statistik untuk grafik. q.location (kosong = semua lokasi), q.from/q.to ('YYYY-MM-DD'), q.group ('day'|'month').
    cum = akumulasi seluruh riwayat; per = pemakaian dalam periode; series = pemakaian per hari/bulan dalam periode. */
 meter_stats:function(u,q){
  if(u.role==='REPORTER')bad_('Akses ditolak.');
  var dr=function(v){v=s_(v,10);return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:'';},
   lk=s_(q.location,200).toLowerCase(),fromQ=dr(q.from),toQ=dr(q.to),from=fromQ||'0000-01-01',to=toQ||'9999-12-31',
   gr=q.group==='month'?'month':'day',all=meterRecs_(),recs=lk?all.filter(function(x){return x.lk===lk;}):all,lm={},
   M=['lwbp','wbp','genset','air'],cum={},per={},bk={},lt={};
  all.forEach(function(x){lm[x.lk]=x.loc;});
  M.forEach(function(m){cum[m]=0;per[m]=0;});
  meterUse_(recs).forEach(function(e){
   cum[e.m]+=e.v;if(e.d<from||e.d>to)return;
   per[e.m]+=e.v;var b=gr==='month'?e.d.slice(0,7):e.d;
   if(!bk[b]){bk[b]={k:b};M.forEach(function(m){bk[b][m]=0;});}
   bk[b][e.m]+=e.v;});
  M.forEach(function(m){cum[m]=rd3_(cum[m]);per[m]=rd3_(per[m]);});
  recs.forEach(function(x){var o=lt[x.lk]=lt[x.lk]||{loc:x.loc,elec:null,water:null};o.loc=x.loc;
   if(x.e)o.elec={lwbp:x.e.lwbp,wbp:x.e.wbp,genset:x.e.genset,date:x.date,time:x.time};
   if(x.w!==null)o.water={reading:x.w,date:x.date,time:x.time};});
  return {locations:Object.keys(lm).map(function(k){return lm[k];}).sort(),
   latest:Object.keys(lt).sort().map(function(k){return lt[k];}),
   cum:cum,per:per,
   series:Object.keys(bk).sort().map(function(k){var o=bk[k];M.forEach(function(m){o[m]=rd3_(o[m]);});return o;}),
   since:recs.length?recs[0].date:'',
   count:{total:recs.length,period:recs.filter(function(x){return x.date>=from&&x.date<=to;}).length},
   from:fromQ,to:toQ,group:gr};
 },
 rep_get:function(u,q){
  var r=all_('REPORTS').filter(function(x){return x.id===q.id&&x.status!=='Diarsipkan';})[0];if(!r)bad_('Laporan tidak ditemukan.');
  if(u.role==='REPORTER'&&(r.type!=='issue'||r.userId!==u.userId))bad_('Akses ditolak.');
  var o=out_(u,r,Date.now());o.photos=all_('PHOTOS').filter(function(p){return p.reportId===r.id;}).sort(function(a,b){return Number(a.uploadedAt)-Number(b.uploadedAt);}).map(function(p){return {id:p.photoId,kind:p.kind,url:PUBLIC_PHOTOS?purl_(p.fileId,1200):''};});
  o.folder=r.folderId?folderUrl_(r.folderId):'';return o;
 },
 rep_save:function(u,q){
  var t=q.type;chkT_(t);if(u.role==='REPORTER'&&t!=='issue')bad_('Akses ditolak. Pelapor hanya dapat membuat laporan Perlu Diperbaiki.');
  var ts=Date.now(),x0=q.data||{};
  if(t==='issue'){x0.date=Utilities.formatDate(new Date(ts),TZ,'yyyy-MM-dd');x0.time=Utilities.formatDate(new Date(ts),TZ,'HH:mm');}
  var d=clean_(t,x0),id,rep;
  if(q.id){
   rep=all_('REPORTS').filter(function(r){return r.id===q.id;})[0];
   if(!rep||rep.status==='Diarsipkan'||rep.type!==t)bad_('Laporan tidak ditemukan.');
   if(t==='issue'){var od=JSON.parse(rep.data);d.status=od.status;d.responses=od.responses||[];d.date=od.date;d.time=od.time;}
   if(u.role!=='ADMIN'){
    if(rep.userId!==u.userId)bad_('Anda hanya dapat mengedit laporan milik sendiri.');
    if(ts>Number(rep.editDeadline))bad_('Batas waktu edit telah berakhir. Hubungi Admin jika diperlukan koreksi.');}
   if(t==='meter')meterDiff_(d,rep.id);
   upd_('REPORTS',rep._row,{title:title_(t,d),data:JSON.stringify(d),updatedAt:ts});id=rep.id;
   mirrorSafe_({id:id,type:t,reporter:rep.reporter,createdAt:rep.createdAt,updatedAt:ts,status:'Aktif'},d);
   log_(u,'EDIT_LAPORAN',t,id,'Laporan diedit oleh '+u.role);
  }else{
   var rid=s_(q.reqId,80),dup=rid&&all_('REPORTS').filter(function(r){return r.reqId===rid;})[0];
   if(dup)return {id:dup.id,photoFailed:0,duplicate:true};
   id=nextId_(new Date(ts));if(t==='meter')meterDiff_(d,null);
   add_('REPORTS',{id:id,type:t,title:title_(t,d),data:JSON.stringify(d),userId:u.userId,reporter:u.fullName,createdAt:ts,updatedAt:ts,editDeadline:ts+EDIT_MIN*60000,status:'Aktif',reqId:rid});
   log_(u,'BUAT_LAPORAN',t,id,title_(t,d));
   mirrorSafe_({id:id,type:t,reporter:u.fullName,createdAt:ts,updatedAt:ts,status:'Aktif'},d);
  }
  return {id:id,photoFailed:0};
 },
 /* unggah foto bertahap: maks PHBATCH foto per panggilan, total MAXPH per laporan */
 photo_save:function(u,q){
  var rep=all_('REPORTS').filter(function(r){return r.id===q.id;})[0];canPhoto_(u,rep);
  var r=addPhotos_(rep.id,q.photos);
  if(r.added){try{syncFoto_(rep.id);}catch(e){Logger.log(e);}try{syncPhotoRows_(rep);}catch(e3){Logger.log('Sheet foto: '+e3);}}
  return r;
 },
 /* panggilan penutup setelah semua foto terunggah: sinkron sheet + ZIP otomatis bila foto > ZIP_AT */
 photo_done:function(u,q){
  var rep=all_('REPORTS').filter(function(r){return r.id===q.id;})[0];canPhoto_(u,rep);
  var n=all_('PHOTOS').filter(function(p){return p.reportId===rep.id;}).length,zip=false;
  if(n>ZIP_AT)try{makeZip_(rep.id);zip=true;}catch(e){Logger.log('ZIP gagal: '+e);}
  try{syncFoto_(rep.id);}catch(e2){Logger.log(e2);}
  var fixed=0;try{fixed=syncPhotoRows_(rep);}catch(e4){Logger.log('Pemeriksaan foto: '+e4);}
  log_(u,'FOTO_LAPORAN',rep.type,rep.id,n+' foto'+(zip?', ZIP dibuat':''));
  return {total:n,zip:zip,sheetFixed:fixed};
 },
 rep_zip:function(u,q){
  var r=all_('REPORTS').filter(function(x){return x.id===q.id&&x.status!=='Diarsipkan';})[0];if(!r)bad_('Laporan tidak ditemukan.');
  if(u.role==='REPORTER'&&(r.type!=='issue'||r.userId!==u.userId))bad_('Akses ditolak.');
  var z=makeZip_(r.id);try{syncFoto_(r.id);}catch(e){}return z;
 },
 /* tanggapan Teknisi/Admin pada laporan Perlu Diperbaiki; dapat mengubah status sampai Selesai */
 resp_save:function(u,q){
  if(u.role==='REPORTER')bad_('Akses ditolak. Hanya Teknisi atau Admin yang dapat menanggapi.');
  var r=all_('REPORTS').filter(function(x){return x.id===q.id&&x.type==='issue'&&x.status!=='Diarsipkan';})[0];if(!r)bad_('Laporan tidak ditemukan.');
  var text=s_(q.text,2000),st=s_(q.status,30);
  if(IST.indexOf(st)<1)bad_('Pilih status tanggapan (Ditanggapi, Sedang Dikerjakan, atau Selesai).');
  if(!text)bad_('Tulis tanggapan atau tindakan yang dilakukan.');
  var d=JSON.parse(r.data),ts=Date.now();d.responses=d.responses||[];
  d.responses.push({by:u.fullName,byId:u.userId,at:ts,text:text,status:st});d.status=st;
  if(st==='Selesai')d.doneAt=ts;else delete d.doneAt;
  upd_('REPORTS',r._row,{data:JSON.stringify(d),updatedAt:ts});
  mirrorSafe_({id:r.id,type:'issue',reporter:r.reporter,createdAt:r.createdAt,updatedAt:ts,status:r.status},d);
  log_(u,'TANGGAPAN_ISSUE','issue',r.id,st+': '+text.slice(0,120));
  return {id:r.id,status:st};
 },
 rep_del:function(u,q){adm_(u);
  var r=all_('REPORTS').filter(function(x){return x.id===q.id;})[0];if(!r)bad_('Laporan tidak ditemukan.');
  upd_('REPORTS',r._row,{status:'Diarsipkan',updatedAt:Date.now()});log_(u,'ARSIP_LAPORAN',r.type,r.id,'Alasan: '+s_(q.reason,200));
  try{mirrorSafe_({id:r.id,type:r.type,reporter:r.reporter,createdAt:r.createdAt,updatedAt:Date.now(),status:'Diarsipkan'},JSON.parse(r.data));}catch(e){}
  return true;},
 img:function(u,q){
  var fid;
  if(q.kind==='avatar'){var au=all_('USERS').filter(function(x){return x.userId===q.id;})[0];
   if(!au||(au.userId!==u.userId&&u.role!=='ADMIN'))bad_('Akses ditolak.');fid=au.photoFileId;}
  else if(q.kind==='poster'){var f=all_('ATS_FILMS').filter(function(x){return x.posterFileId===q.id;})[0];fid=f&&f.posterFileId;}
  else{var p=all_('PHOTOS').filter(function(x){return x.photoId===q.id;})[0];fid=p&&p.fileId;}
  if(!fid)bad_('Foto tidak ditemukan.');
  if(u.role==='REPORTER'&&q.kind!=='poster'&&q.kind!=='avatar'){var pr=all_('REPORTS').filter(function(x){return x.id===p.reportId;})[0];if(!pr||pr.userId!==u.userId)bad_('Akses ditolak.');}
  var b=DriveApp.getFileById(fid).getBlob();return 'data:'+b.getContentType()+';base64,'+Utilities.base64Encode(b.getBytes());
 },
 usr_list:function(u){adm_(u);return all_('USERS').map(function(x){return {userId:x.userId,fullName:x.fullName,username:x.username,role:x.role,status:x.status,createdAt:Number(x.createdAt)};});},
 usr_save:function(u,q){adm_(u);
  var role=ROLES.indexOf(q.role)>=0?q.role:'USER',name=s_(q.fullName,100),now=Date.now();
  if(!name)bad_('Nama lengkap wajib diisi.');
  if(q.userId){var x=all_('USERS').filter(function(y){return y.userId===q.userId;})[0];if(!x)bad_('Pengguna tidak ditemukan.');
   var st=q.status==='Nonaktif'?'Nonaktif':'Aktif';
   if(x.userId===u.userId&&(role!=='ADMIN'||st!=='Aktif'))bad_('Anda tidak dapat menurunkan atau menonaktifkan akun sendiri.');
   upd_('USERS',x._row,{fullName:name,role:role,status:st,updatedAt:now});
   log_(u,x.role!==role?'UBAH_ROLE':st!==x.status?'STATUS_AKUN':'EDIT_AKUN','USERS',x.userId,x.username+' -> '+role+'/'+st);return x.userId;}
  var un=s_(q.username,30);if(!/^[A-Za-z0-9_.-]{3,30}$/.test(un))bad_('Username 3-30 karakter (huruf, angka, . _ -).');
  if(find_(un))bad_('Username sudah dipakai.');chkPw_(q.password);
  var salt=Utilities.getUuid(),id=uid_('U');
  add_('USERS',{userId:id,fullName:name,username:un,role:role,status:'Aktif',salt:salt,hash:hash_(q.password,salt),mustChange:'Y',createdAt:now,updatedAt:now});
  log_(u,'BUAT_AKUN','USERS',id,un+' ('+role+')');return id;
 },
 usr_reset:function(u,q){adm_(u);chkPw_(q.password);var x=all_('USERS').filter(function(y){return y.userId===q.userId;})[0];if(!x)bad_('Pengguna tidak ditemukan.');
  var salt=Utilities.getUuid();upd_('USERS',x._row,{salt:salt,hash:hash_(q.password,salt),mustChange:'Y',updatedAt:Date.now()});
  log_(u,'RESET_PASSWORD','USERS',x.userId,'Reset untuk '+x.username);return true;},
 audit:function(u,q){adm_(u);var pg=Math.max(1,Number(q.page)||1),rows=all_('AUDIT_LOG').sort(function(a,b){return b.at-a.at;});
  return {total:rows.length,page:pg,size:25,items:rows.slice((pg-1)*25,pg*25).map(function(r){return {at:Number(r.at),userName:r.userName,role:r.role,action:r.action,category:r.category,recordId:r.recordId,summary:r.summary};})};}
};
function annOut_(a){return {id:a.id,title:a.title,body:a.body,priority:a.priority,publishedAt:Number(a.publishedAt),status:a.status,createdBy:a.createdBy};}

/* ===== PEMBERSIHAN SHEET YANG TIDAK TERPAKAI =====
   Sheet "terpakai" = semua sheet yang namanya dirujuk kode ini: database website (SH), sheet kategori (MIR)
   dan sheet foto (PHS). Selain itu (mis. Sheet1 bawaan atau sheet lama) dianggap tidak terpakai.
   Urutan aman: 1) periksaSheetTidakTerpakai  2) sembunyikanSheetTidakTerpakai (bisa dibatalkan)  3) hapusSheetTidakTerpakai. */
function sheetPakai_(){
 var o={};Object.keys(SH).forEach(function(n){o[n]=1;});
 Object.keys(MIR).forEach(function(k){o[MIR[k].name]=1;});
 Object.keys(PHS).forEach(function(t){o[PHS[t]]=1;});return o;
}
function sheetTakTerpakai_(){var use=sheetPakai_();return ss_().getSheets().filter(function(s){return !use[s.getName()];});}
function periksaSheetTidakTerpakai(){
 var use=sheetPakai_(),c=sheetTakTerpakai_();
 Logger.log('DIPAKAI (tidak akan disentuh): '+Object.keys(use).join(', '));
 Logger.log(c.length?('TIDAK TERPAKAI ('+c.length+'):\n'+c.map(function(s){return ' - '+s.getName()+' ('+Math.max(0,s.getLastRow())+' baris, '+s.getLastColumn()+' kolom)';}).join('\n')):'Tidak ada sheet yang tidak terpakai.');
 return c.map(function(s){return s.getName();});
}
function sembunyikanSheetTidakTerpakai(){
 var ss=ss_(),c=sheetTakTerpakai_();if(!c.length){Logger.log('Tidak ada sheet yang tidak terpakai.');return;}
 try{ss.setActiveSheet(ss.getSheetByName('REPORTS'));}catch(e){}
 c.forEach(function(s){try{s.hideSheet();}catch(e){Logger.log('Gagal menyembunyikan '+s.getName()+': '+e);}});
 Logger.log('Disembunyikan: '+c.map(function(s){return s.getName();}).join(', ')+'. Untuk menampilkan lagi: menu Tampilkan > Sheet tersembunyi.');
}
function hapusSheetTidakTerpakai(){
 var ss=ss_(),c=sheetTakTerpakai_(),del=[];
 try{ss.setActiveSheet(ss.getSheetByName('REPORTS'));}catch(e){}
 c.forEach(function(s){var n=s.getName();try{ss.deleteSheet(s);del.push(n);}catch(e){Logger.log('Gagal menghapus '+n+': '+e);}});
 Logger.log(del.length?('Dihapus permanen: '+del.join(', ')):'Tidak ada sheet yang dihapus.');
}
