/* STC XXI Technical Report - tambahan sidebar (hanya perilaku tampilan).
   1) Kolom "Cari menu" menyaring daftar menu.
   2) Tombol Profil / Keluar di bawah sidebar meneruskan klik ke tombol aslinya (di header).
   Tidak mengubah fungsi app.js. Hapus file ini + 1 baris <script> untuk menonaktifkan. */
(function(){
'use strict';
var inp=document.getElementById('ssearch'),nav=document.getElementById('nav');
if(!nav)return;

function filt(){
 var q=(inp&&inp.value||'').trim().toLowerCase(),kids=nav.children,i,el;
 for(i=0;i<kids.length;i++){
  el=kids[i];
  if(!q){el.style.display='';continue}
  if(el.tagName==='A')el.style.display=(el.textContent||'').toLowerCase().indexOf(q)>=0?'':'none';
  else el.style.display='none'; /* judul grup disembunyikan saat mencari */
 }
}
function firstMatch(){
 var a=nav.querySelectorAll('a'),i;
 for(i=0;i<a.length;i++)if(a[i].style.display!=='none')return a[i];
 return null;
}

if(inp){
 inp.addEventListener('input',filt);
 inp.addEventListener('keydown',function(e){
  if(e.key==='Escape'){inp.value='';filt();inp.blur()}
  else if(e.key==='Enter'){var a=firstMatch();if(a){e.preventDefault();a.click();inp.value='';filt();inp.blur()}}
 });
 /* menu dirender ulang setiap pindah halaman -> kosongkan pencarian */
 if(window.MutationObserver)new MutationObserver(function(){if(inp.value){inp.value='';filt()}}).observe(nav,{childList:true});
}

/* tombol bawah: teruskan ke #prof / #logout asli */
document.querySelectorAll('#side [data-proxy]').forEach(function(b){
 b.addEventListener('click',function(){var t=document.getElementById(b.getAttribute('data-proxy'));if(t)t.click()});
});
})();
