// Page publique « Comprendre le calcul de charge ».
import {h} from './dom.js';
import {GUIDE_INTRO,GUIDE_STEPS,GUIDE_RULES,GUIDE_DISCLAIMER,GUIDE_REFS} from '../loadguide.js';
import {dwellingCalc} from '../loadcalc.js';
import {loadById} from '../catalog.js';
import {blank} from '../model.js';

document.getElementById('g-what').textContent=GUIDE_INTRO.what;
const list=(title,items,cls)=>items.length?h('div',{class:'g-list '+cls},h('b',{text:title}),h('ul',{},items.map(t=>h('li',{text:t})))):null;
const steps=Object.entries(GUIDE_STEPS);
document.getElementById('g-toc').replaceChildren(...steps.map(([id,s])=>h('a',{href:'#'+id,text:s.title.replace(/^\d+\.\s*/,'')})),h('a',{href:'#regles',text:'Autres règles'}),h('a',{href:'#exemple',text:'Exemple complet'}));
// Exemple complet calculé avec le même moteur que l'application.
const L=(id,qty=1)=>{const l=loadById(id);return {name:l.name,w:l.w,v:l.v,qty,cat:l.cat,cont:l.cont};};
const c=blank(30);c[0].loads=[L('range-12')];c[1].loads=[L('dryer')];c[2].loads=[L('wh-4500')];c[3].loads=[L('bb-2000',7)];c[4].loads=[L('hp-3t')];c[5].loads=[L('ev-l2-30')];c[6].loads=[L('fridge'),L('dishwasher')];
const ex=dwellingCalc(c,{livingArea:100,basementArea:80});
const kw=w=>(w/1000).toLocaleString('fr-CA',{maximumFractionDigits:2})+' kW';
document.getElementById('g-body').replaceChildren(
 h('div',{class:'notice info'},h('p',{text:GUIDE_INTRO.why}),h('p',{class:'small',text:GUIDE_INTRO.scope})),
 ...steps.map(([id,s])=>h('section',{id,class:'g-step'},h('h2',{},s.title,h('span',{class:'badge',text:'Règle '+s.rule})),h('p',{text:s.plain}),
  h('div',{class:'g-cols'},list('✓ Ce qui est compté',s.includes,'inc'),list('✗ Ce qui est exclu ou non additionné',s.excludes,'exc')),s.tip&&h('p',{class:'g-tip',text:'Exemple : '+s.tip}))),
 h('h2',{id:'regles',text:'Autres règles importantes'}),
 ...GUIDE_RULES.map(r=>h('div',{class:'card g-rule'},h('b',{text:r.title}),h('span',{class:'badge',text:r.rule}),h('p',{text:r.plain}))),
 h('h2',{id:'exemple',text:'Exemple complet'}),
 h('p',{text:'Maison de 100 m² hors sol avec sous-sol de 80 m² ; cuisinière 12 kW, sécheuse 5,6 kW, chauffe-eau 4,5 kW, 7 plinthes de 2000 W, thermopompe 3 tonnes, borne de recharge 30 A, réfrigérateur et lave-vaisselle.'}),
 h('div',{class:'table-wrap'},h('table',{class:'data'},h('thead',{},h('tr',{},['Étape','Calcul','Charge'].map(t=>h('th',{text:t})))),
  h('tbody',{},ex.steps.map(s=>h('tr',{},h('td',{text:s.title}),h('td',{class:'small',text:s.formula}),h('td',{text:s.id==='area'?s.value+' m²':kw(s.w)}))),
   h('tr',{},h('td',{},h('b',{text:'Total'})),h('td',{class:'small',text:`${ex.totalW} W ÷ 240 V`}),h('td',{},h('b',{text:`${ex.amps} A`})))))),
 h('p',{text:`Résultat : ${ex.amps} A. Minimum du Code pour cette superficie : ${ex.minService} A. Entrée recommandée : ${ex.recommended} A (200 A pour garder une marge).`}),
 h('p',{class:'small muted',text:'Le réfrigérateur et le lave-vaisselle (1500 W ou moins) ne sont pas additionnés : ils sont couverts par la charge de base. La thermopompe (climatisation) n’est pas comptée, car le chauffage est plus élevé.'}),
 h('div',{class:'cta-band mt'},h('div',{},h('h2',{text:'Faites le calcul de votre panneau'}),h('p',{text:'L’onglet « Planification et charges » applique ces étapes automatiquement et génère une note de calcul PDF.'})),h('a',{class:'btn lg',href:'/app#/sites'},'Ouvrir Mon Panneau')),
 h('p',{class:'notice mt',text:'⚠️ '+GUIDE_DISCLAIMER}),
 h('details',{class:'faq'},h('summary',{text:'Références'}),h('ul',{},GUIDE_REFS.map(r=>h('li',{text:r})))));
