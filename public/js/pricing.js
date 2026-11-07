// Grille des forfaits, partagée par la page publique /tarifs et la page Abonnement de l'application.
import {h,money,planFeatures} from './dom.js';

const AUD={gratuit:'Pour essayer',proprietaire:'Propriétaire de maison ou condo',gestionnaire:'Gestionnaire d’immeuble',electricien:'Électricien'};
export function pricingGrid({plans,packs=[],currentPlan,interval='month',onChoose,onPack,ctaFor}){
 const wrap=h('div');
 let iv=interval;
 const toggle=h('div',{class:'billing-toggle',role:'group','aria-label':'Périodicité'});
 const grid=h('div',{class:'plans'});
 const draw=()=>{
  toggle.replaceChildren(...[['month','Mensuel'],['year','Annuel · économisez']].map(([v,t])=>h('button',{type:'button','aria-pressed':String(iv===v),onclick:()=>{iv=v;draw();}},t)));
  grid.replaceChildren(...plans.map(p=>{
   const price=iv==='year'?p.priceYear:p.priceMonth;
   const free=!p.priceMonth&&!p.priceYear;
   const unavailable=!free&&!(price>0);
   const save=iv==='year'&&p.priceMonth>0&&p.priceYear>0?Math.round((1-p.priceYear/(p.priceMonth*12))*100):0;
   const current=currentPlan===p.id;
   const cta=ctaFor?ctaFor(p,iv,current):null;
   return h('article',{class:'card plan'+(p.id==='electricien-solo'?' highlight':'')+(current?' current':'')},
    p.id==='electricien-solo'&&h('span',{class:'ribbon',text:'POUR LES PROS'}),
    h('div',{class:'aud',text:AUD[p.audience]||p.audience}),
    h('h3',{text:p.name}),
    h('div',{class:'price'},free?'0 $':unavailable?'—':money(price),!free&&!unavailable&&h('small',{text:iv==='year'?' / an':' / mois'})),
    h('div',{class:'save',text:save>0?`≈ ${save} % de rabais`:p.trialDays?`${p.trialDays} jours d’essai`:''}),
    h('p',{text:p.description}),
    h('ul',{},planFeatures(p).map(f=>h('li',{text:f}))),
    cta||(onChoose&&h('button',{type:'button',class:current?'':'primary',disabled:current||unavailable,onclick:()=>onChoose(p,iv)},current?'Forfait actuel':free?'Choisir':'S’abonner')));
  }));
 };
 draw();
 wrap.append(toggle,grid);
 if(packs.length)wrap.append(h('div',{class:'card plan mt'},h('div',{class:'aud',text:'Sans abonnement'}),h('h3',{text:'Forfaits de panneaux'}),
  h('p',{text:'Pour un besoin ponctuel : des panneaux supplémentaires utilisables avec n’importe quel forfait, y compris le gratuit.'}),
  h('div',{class:'chips'},packs.map(k=>h('span',{class:'badge',text:`${k.name} · ${money(k.price)} · valables ${Math.round(k.validityDays/30)} mois`}))),
  onPack&&h('div',{class:'page-actions'},packs.map(k=>h('button',{type:'button',onclick:()=>onPack(k)},`Acheter ${k.name} (${money(k.price)})`)))));
 wrap.append(h('p',{class:'small muted mt',text:'Prix en dollars canadiens, taxes en sus (TPS et TVQ). Annulation en tout temps : l’accès demeure jusqu’à la fin de la période payée. Vos données ne sont jamais supprimées si vous changez de forfait.'}));
 return wrap;
}
