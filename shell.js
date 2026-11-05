/* Shell frontend (Tailwind redesign): di layar <1024px tombol menu di header membuka sidebar (di desktop tetap menyembunyikan/menampilkan). Hanya tampilan, tidak menyentuh API. */
(function(){'use strict';
var b=document.getElementById('sbtn'),s=document.getElementById('side'),h=document.getElementById('shade');
if(!b||!s)return;
b.addEventListener('click',function(){if(!matchMedia('(max-width:1023px)').matches)return;s.classList.add('open');if(h)h.classList.add('open')});
})();
