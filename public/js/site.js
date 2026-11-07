// Pages publiques : menu mobile et lien « Mon espace » si une session est ouverte.
const toggle=document.querySelector('.nav-toggle'),nav=document.getElementById('siteNav');
toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});
nav?.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false');}});
fetch('/api/auth',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(d=>{
 if(!d?.user)return;
 document.querySelectorAll('[data-guest]').forEach(e=>e.hidden=true);
 document.querySelectorAll('[data-member]').forEach(e=>e.hidden=false);
}).catch(()=>{});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
