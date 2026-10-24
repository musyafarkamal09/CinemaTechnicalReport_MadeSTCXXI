/* STC XXI Technical Report - penyempurnaan UX (hanya perilaku tampilan, tidak mengubah app.js).
   1) Menu akun di header (Profil / Keluar) dibuka dari sudut kanan atas.
   2) Lebar sidebar dapat digeser / diatur dengan keyboard; pilihan diingat di perangkat ini.
   3) Konten muncul bertahap saat di-scroll, plus bilah progres dan bayangan header.
   Semua fitur bersifat progresif: bila browser tidak mendukung, konten tetap tampil normal. */
(function(){
'use strict';
var root=document.documentElement,body=document.body;
var reduce=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
var DEF=272,KEY='stc_sbw';

function store(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}}
function load(k){try{return localStorage.getItem(k)}catch(e){return null}}

/* ---------- 1) MENU AKUN ---------- */
var uh=document.getElementById('uhead'),tg=document.getElementById('uhtg');
function setUh(open){
 if(!uh||!tg)return;
 uh.classList.toggle('open',open);
 tg.setAttribute('aria-expanded',open?'true':'false');
}
if(uh&&tg){
 uh.addEventListener('click',function(e){
  if(e.target.closest('#uhmenu')){if(e.target.closest('button'))setUh(false);return}
  setUh(!uh.classList.contains('open'));
 });
 document.addEventListener('click',function(e){if(!uh.contains(e.target))setUh(false)});
 document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&uh.classList.contains('open')){setUh(false);tg.focus()}
 });
}

/* ---------- 2) LEBAR SIDEBAR ---------- */
var side=document.getElementById('side'),rz=null;
function limits(){
 var w=window.innerWidth||1280;
 if(w<=820)return{min:220,max:Math.max(220,Math.min(420,Math.round(w*0.86)))};
 return{min:208,max:Math.max(240,Math.min(440,Math.round(w*0.42)))};
}
function clampW(v){var l=limits();return Math.min(l.max,Math.max(l.min,Math.round(v)))}
function curW(){var v=parseFloat(getComputedStyle(root).getPropertyValue('--sbw'));return isNaN(v)?DEF:v}
function applyW(v,save){
 var w=clampW(v);
 root.style.setProperty('--sbw',w+'px');
 if(rz){
  var l=limits();
  rz.setAttribute('aria-valuemin',String(l.min));
  rz.setAttribute('aria-valuemax',String(l.max));
  rz.setAttribute('aria-valuenow',String(w));
  rz.setAttribute('aria-valuetext',w+' piksel');
 }
 if(save)store(KEY,String(w));
 return w;
}
if(side){
 rz=document.createElement('div');
 rz.className='sb-rz';
 rz.setAttribute('role','separator');
 rz.setAttribute('aria-orientation','vertical');
 rz.setAttribute('aria-label','Ubah lebar menu samping');
 rz.tabIndex=0;
 rz.title='Geser untuk mengubah lebar menu. Klik ganda untuk ukuran standar.';
 side.appendChild(rz);

 var saved=parseFloat(load(KEY));
 applyW(isNaN(saved)?DEF:saved,false);

 var drag=null,pending=0;
 function move(){pending=0;if(drag)applyW(drag.w+(drag.x2-drag.x),false)}
 rz.addEventListener('pointerdown',function(e){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  drag={x:e.clientX,x2:e.clientX,w:curW()};
  try{rz.setPointerCapture(e.pointerId)}catch(err){}
  rz.classList.add('drag');
  body.classList.add('sb-resizing');
  rz.focus({preventScroll:true});
  e.preventDefault();
 });
 rz.addEventListener('pointermove',function(e){
  if(!drag)return;
  drag.x2=e.clientX;
  if(!pending)pending=requestAnimationFrame(move);
 });
 function endDrag(){
  if(!drag)return;
  if(pending){cancelAnimationFrame(pending);pending=0}
  drag=null;
  rz.classList.remove('drag');
  body.classList.remove('sb-resizing');
  applyW(curW(),true);
 }
 rz.addEventListener('pointerup',endDrag);
 rz.addEventListener('pointercancel',endDrag);
 rz.addEventListener('dblclick',function(){applyW(DEF,true)});
 rz.addEventListener('keydown',function(e){
  var step=e.shiftKey?48:16,w=curW(),n=null;
  if(e.key==='ArrowLeft')n=w-step;
  else if(e.key==='ArrowRight')n=w+step;
  else if(e.key==='Home')n=limits().min;
  else if(e.key==='End')n=limits().max;
  else if(e.key==='Enter'||e.key==='0')n=DEF;
  if(n!==null){e.preventDefault();applyW(n,true)}
 });
 window.addEventListener('resize',function(){applyW(curW(),false)});
}

/* ---------- 3) ANIMASI SAAT SCROLL ---------- */
var header=document.querySelector('#main>header');
var fill=null;
if(header){
 var bar=document.createElement('div');
 bar.className='sprog';
 bar.setAttribute('aria-hidden','true');
 bar.innerHTML='<i></i>';
 header.appendChild(bar);
 fill=bar.firstChild;
}
var ticking=false;
function onScroll(){
 if(ticking)return;
 ticking=true;
 requestAnimationFrame(function(){
  ticking=false;
  var y=window.pageYOffset||root.scrollTop||0;
  var max=root.scrollHeight-window.innerHeight;
  var p=max>0?Math.min(1,Math.max(0,y/max)):0;
  if(fill)fill.style.transform='scaleX('+p.toFixed(4)+')';
  if(header)header.classList.toggle('is-scrolled',y>8);
 });
}
window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('resize',onScroll);
onScroll();

/* konten yang muncul di halaman diberi kelas .rv; saat masuk layar ia naik & memudar */
var TARGETS='#view > *:not(.dx), #view .dx > *, #view .grid > *, #phero, #cp';
var io=null,scanQueued=false;
function scan(){
 scanQueued=false;
 if(!io)return;
 document.querySelectorAll(TARGETS).forEach(function(el){
  if(el.dataset.rvd)return;
  el.dataset.rvd='1';
  el.classList.add('rv');
  io.observe(el);
 });
}
function queueScan(){
 if(scanQueued)return;
 scanQueued=true;
 requestAnimationFrame(scan);
}
if(!reduce&&'IntersectionObserver' in window){
 root.classList.add('anim-ready');
 io=new IntersectionObserver(function(entries){
  var i=0;
  entries.forEach(function(en){
   if(!en.isIntersecting)return;
   var el=en.target,d=Math.min(i*70,350);
   i++;
   io.unobserve(el);
   el.style.setProperty('--d',d+'ms');
   el.classList.add('rv-in');
   setTimeout(function(){
    el.classList.remove('rv','rv-in');
    el.style.removeProperty('--d');
   },1000+d);
  });
 },{threshold:0.06,rootMargin:'0px 0px -4% 0px'});

 var view=document.getElementById('view'),phero=document.getElementById('phero');
 if(view&&window.MutationObserver)new MutationObserver(queueScan).observe(view,{childList:true,subtree:true});
 if(phero&&window.MutationObserver){
  /* banner diganti setiap pindah halaman -> boleh muncul lagi */
  new MutationObserver(function(){delete phero.dataset.rvd;queueScan()}).observe(phero,{childList:true});
 }
 scan();
}

/* ---------- 4) MENU HP: tombol tutup, Esc, dan penanda tab aktif ---------- */
(function(){
 var sideEl=document.getElementById('side'),shade=document.getElementById('shade'),tabs=document.getElementById('tabs');
 function closeDrawer(){
  if(!sideEl||!sideEl.classList.contains('open'))return;
  sideEl.classList.remove('open');
  if(shade)shade.classList.remove('open');
  var m=tabs&&tabs.querySelector('a[data-p=menu]');
  if(m)m.focus({preventScroll:true});
 }
 if(sideEl){
  var brand=sideEl.querySelector('.brand');
  if(brand){
   var x=document.createElement('button');
   x.type='button';
   x.className='sb-close';
   x.setAttribute('aria-label','Tutup menu');
   x.innerHTML='<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
   x.addEventListener('click',closeDrawer);
   brand.appendChild(x);
  }
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDrawer()});
 }
 if(tabs&&window.MutationObserver){
  var mark=function(){
   var on=tabs.querySelector('a.on');
   tabs.querySelectorAll('a').forEach(function(a){
    if(a===on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
   });
  };
  new MutationObserver(mark).observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  mark();
 }
})();

/* ---------- 6) APLIKASI (PWA): service worker, pasang ke layar utama, offline ---------- */
(function(){
 if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
 }
 var btn=document.getElementById('pwainst'),deferred=null;
 window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();deferred=e;if(btn)btn.hidden=false;
 });
 if(btn){
  btn.addEventListener('click',function(){
   if(!deferred)return;
   deferred.prompt();
   deferred.userChoice.finally(function(){deferred=null;btn.hidden=true});
  });
 }
 window.addEventListener('appinstalled',function(){deferred=null;if(btn)btn.hidden=true});
})();
})();
