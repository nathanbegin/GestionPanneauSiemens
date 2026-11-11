// Service worker : réseau d'abord, copie en cache pour l'ouverture hors ligne de l'interface.
const CACHE='mon-panneau-v2.41.3';
const SHELL=['/app','/app.html','/config.js','/assets/mp.css','/model.js','/catalog.js','/loadcalc.js','/js/app.js','/js/api.js','/js/dom.js','/js/forms.js','/js/panel.js','/js/panelart.js','/js/library.js','/js/assign.js','/js/feeds.js','/units.js','/loadguide.js','/js/billing.js','/js/admin.js','/js/pricing.js','/js/branding.js','/js/sso.js','/js/offline.js','/js/trash.js','/js/history.js','/js/checklist.js','/js/handoff.js','/js/icons.js','/js/sitefont.js','/fonts/manrope-latin-wght-normal.woff2','/fonts/inter-latin-wght-normal.woff2','/js/demo.js','/js/demo-data.js','/js/aiimport.js','/aiscan.js','/js/guided.js','/guided.js','/js/feedback.js','/js/panelreal.js','/js/team.js','/js/update.js','/i18n.js','/i18n-core.js','/i18n-en.js','/i18n-load.js','/i18n-en-docs.js','/i18n-en-admin.js','/js/appliances.js','/appliances.js','/js/design.js','/design.js','/voltage.js','/js/compare.js','/qr.js','/vendor/qrcode.mjs','/assets/icon.svg','/branding/disjonio/svg/disjonio-symbol-simple-on-light.svg','/branding/disjonio/svg/outlined/disjonio-horizontal-no-tagline-on-light.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/sso/')||url.pathname==='/version.json')return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('/app'))));
});
