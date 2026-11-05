// Page publique des tarifs.
import {h} from './dom.js';
import {pricingGrid} from './pricing.js';
const box=document.getElementById('pricing');
fetch('/api/billing?action=plans').then(r=>r.json()).then(d=>{
 box.replaceChildren(pricingGrid({plans:d.plans,packs:d.packs,ctaFor:(p,iv)=>h('a',{class:'btn '+(p.priceMonth||p.priceYear?'primary':''),href:p.priceMonth||p.priceYear?`/app#/abonnement/choisir/${p.id}/${iv}`:'/app#/inscription'},p.priceMonth||p.priceYear?'Choisir ce forfait':'Commencer gratuitement')}));
}).catch(()=>{box.replaceChildren(h('p',{class:'notice',text:'Impossible de charger les forfaits pour le moment.'}));});
