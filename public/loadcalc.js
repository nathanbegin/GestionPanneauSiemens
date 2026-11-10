// Calculs de charge : circuits, phases L1/L2, capacité du panneau, calcul d'un logement (règle 8-200),
// dimensionnement et suggestions. Outils d'aide : la conformité relève d'un maître électricien.
import {slotPos,designation,sortCircuits} from './model.js';
import {voltsOf,DEFAULT_VOLTS} from './voltage.js';
import {CONTINUOUS_FACTOR,STANDARD_BREAKERS,SERVICE_SIZES,WIRE_TABLE,wireAmps,LOAD_LIBRARY,familyOf,serviceCheck} from './catalog.js';
// Modèle de la bibliothèque, d'après l'instantané enregistré dans la fiche du panneau.
export const panelModel=det=>det?.modelId?{id:det.modelId,family:det.family,maxCircuits:det.maxCircuits??null,tandem:det.tandem!==false,pon:det.pon??null,label:det.modelInfo||det.modelId}:null;

export const polesOf=c=>c.slots.length===1?1:new Set(c.slots.map(slotPos)).size;
// Phases : les rangées alternent L1 / L2 (positions 1-2 = L1, 3-4 = L2, 5-6 = L1…).
export const legOf=pos=>Math.floor((pos-1)/2)%2===0?'L1':'L2';
export const circuitVolts=(c,vs=DEFAULT_VOLTS)=>polesOf(c)>=2?vs.bi:vs.uni;
const round=(n,d=1)=>Math.round(n*10**d)/10**d;
export const nextBreaker=a=>STANDARD_BREAKERS.find(b=>b>=a-1e-9)??null;
export const wireFor=amps=>WIRE_TABLE.find(w=>w.amps>=amps)?.gauge??null;

// Cuisinière sur son propre circuit : règle 8-300 — 8 000 W jusqu'à 12 kW, plus 40 % de l'excédent (jamais plus que la puissance de plaque).
// Pour l'entrée de la maison, la règle 8-200 est différente : 6 000 W + 40 % de l'excédent (voir dwellingCalc).
export const rangeCircuitDemand=w=>Math.min(w,8000+0.4*Math.max(0,w-12000));
// Appareils à moteur ou à compresseur : le courant de démarrage dépasse le nominal sans être une surcharge (section 28).
const MOTOR_RE=/pompe|thermopompe|climati|compresseur|moteur|ouvre-porte|aspirateur|r[ée]frig[ée]rateur|cong[ée]lateur|ventilat|vrc|vre|scie|perceuse/i;
// Puissance d'une charge en watts.
const lw=l=>(Number(l.w)||0)*(Number(l.qty)||1);

export function circuitLoad(c,vs=DEFAULT_VOLTS){
 const loads=c.loads||[];
 const volts=circuitVolts(c,vs);
 const watts=loads.reduce((s,l)=>s+lw(l),0);
 const contW=loads.filter(l=>l.cont).reduce((s,l)=>s+lw(l),0);
 // Cuisinière : 6000 W + 40 % de l'excédent de 12 kW (même logique que le calcul du logement).
 const rangeW=loads.filter(l=>l.cat==='range').reduce((s,l)=>s+lw(l),0);
 const demandW=watts-rangeW+(rangeW?rangeCircuitDemand(rangeW):0);
 const amps=watts/volts,demandAmps=Math.min(watts,demandW)/volts;
 // Disjoncteur minimal : 125 % de la partie continue + 100 % du reste.
 const minBreakerAmps=(contW/CONTINUOUS_FACTOR+(Math.min(watts,demandW)-contW))/volts;
 const breaker=c.amps||null;
 const wire=c.wire?.gauge||'';
 const issues=[];
 if(watts&&breaker){
  if(demandAmps>breaker)issues.push({level:'error',text:`Charge de ${round(demandAmps)} A supérieure au disjoncteur de ${breaker} A.`});
  else if(contW&&minBreakerAmps>breaker)issues.push({level:'error',text:`Charge continue au-delà de 80 % du disjoncteur (${round(demandAmps/breaker*100,0)} %) : le disjoncteur doit valoir au moins 125 % de la charge continue. Minimum suggéré : ${nextBreaker(minBreakerAmps)} A.`});
  // Charge non continue : admissible jusqu'à 100 % du calibre ; le 80 % n'est pas un seuil de déclenchement.
  else if(!contW&&demandAmps>breaker*CONTINUOUS_FACTOR)issues.push({level:'info',text:`Charge non continue à ${round(demandAmps/breaker*100,0)} % du disjoncteur : admissible jusqu’à 100 %. Vérifiez qu’aucun appareil du circuit ne fonctionne en continu (3 heures ou plus).`});
 }
 if(watts&&!breaker)issues.push({level:'warn',text:'Calibre du disjoncteur à préciser.'});
 if(loads.some(l=>MOTOR_RE.test(l.name||'')))issues.push({level:'info',text:'Appareil à moteur ou à compresseur : le courant de démarrage dépasse le nominal sans être une surcharge. Se fier à la plaque (MCA / MOCP) et, si le disjoncteur déclenche, chercher la cause plutôt qu’augmenter le calibre.'});
 const loadVolts=new Set(loads.map(l=>Number(l.v)||0).filter(Boolean));
 if([...loadVolts].some(v=>v>=208)&&volts===vs.uni)issues.push({level:'error',text:`Appareil ${[...loadVolts].find(v=>v>=208)} V sur un disjoncteur unipolaire : un bipolaire est requis.`});
 if(vs.bi===208&&loadVolts.has(240))issues.push({level:'info',text:'Appareil 240 V sur un réseau 208 V : un élément chauffant fournit environ 75 % de sa puissance. Vérifiez la plaque signalétique.'});
 if(wire&&breaker&&wireAmps(wire)!=null&&wireAmps(wire)<breaker)issues.push({level:'error',text:`Fil ${wire} (${wireAmps(wire)} A) trop petit pour un disjoncteur de ${breaker} A.`});
 if(breaker&&!wire&&watts)issues.push({level:'info',text:`Fil suggéré : ${wireFor(breaker)} cuivre.`});
 return {volts,watts,contW,amps:round(amps),demandAmps:round(demandAmps),minBreaker:watts?nextBreaker(minBreakerAmps):null,suggestedWire:breaker?wireFor(breaker):null,
  percent:breaker&&watts?round(demandAmps/breaker*100,0):null,issues};
}

// Charges par phase (A). Un circuit bipolaire 240 V charge L1 et L2 ; un 120 V charge sa phase.
export function phaseBalance(circuits,vs=DEFAULT_VOLTS){
 const legs={L1:0,L2:0};
 for(const c of circuits){
  const r=circuitLoad(c,vs);if(!r.watts)continue;
  if(r.volts===vs.bi){legs.L1+=r.watts/vs.bi;legs.L2+=r.watts/vs.bi;}
  else legs[legOf(slotPos(c.slots[0]))]+=r.watts/vs.uni;
 }
 const max=Math.max(legs.L1,legs.L2),min=Math.min(legs.L1,legs.L2);
 return {L1:round(legs.L1),L2:round(legs.L2),imbalance:max?round((max-min)/max*100,0):0};
}

// Calcul de charge d'un logement unifamilial (règle 8-200 du CCÉ, simplifiée), détaillé étape par étape.
// Chaque étape indique la règle, la formule, les appareils pris en compte et ceux qui sont exclus.
// children : sous-panneaux alimentés par ce panneau (leurs charges font partie du même logement).
export function dwellingCalc(circuits,{livingArea=0,basementArea=0,children=[],panelTag='',vs=DEFAULT_VOLTS}={}){
 const items=[];
 const collect=(cs,tag)=>{for(const c of cs)for(const l of c.loads||[])items.push({name:l.qty>1?`${l.qty} × ${l.name}`:l.name,w:lw(l),cat:l.cat,cont:l.cont,where:[tag,designation(c)].filter(Boolean).join(' · ')});};
 collect(circuits,panelTag);for(const p of children)collect(p.circuits||[],p.tag||p.name);
 const of=cat=>items.filter(i=>i.cat===cat);
 const sum=cat=>of(cat).reduce((t,i)=>t+i.w,0);
 const kw=w=>(Math.round(w/100)/10).toLocaleString('fr-CA')+' kW';
 const above=Math.max(0,Number(livingArea)||0),basement=Math.max(0,Number(basementArea)||0);
 const area=Math.round((above+0.75*basement)*10)/10;
 const steps=[];
 // 1. Superficie habitable (règle 8-110).
 steps.push({id:'area',title:'Superficie habitable',rule:'CCÉ 8-110',
  formula:basement?`${above} m² (rez-de-chaussée et étages) + 75 % × ${basement} m² (sous-sol) = ${area} m²`:`${above} m² (rez-de-chaussée et étages)`,value:area,unit:'m²',w:0,items:[]});
 // 2. Charge de base.
 const extra=Math.max(0,Math.ceil((area-90)/90));
 const basic=area?5000+1000*extra:0;
 steps.push({id:'basic',title:'Charge de base',rule:'CCÉ 8-200 1) a) i) et ii)',
  formula:area?`5000 W (90 premiers m²)${extra?` + ${extra} × 1000 W (tranches de 90 m² additionnelles)`:''} = ${basic} W`:'Indiquez la superficie habitable pour calculer la charge de base.',w:basic,
  items:of('basic'),itemsNote:'Couvert par la charge de base, non additionné : éclairage, prises, petits appareils et appareils de 1500 W ou moins.'});
 // 3. Chauffage et climatisation.
 const bb=sum('heating'),heat100=sum('heating100'),cool=sum('cooling');
 const heatBB=Math.min(bb,10000)+0.75*Math.max(0,bb-10000);
 const heat=heatBB+heat100,keep=Math.max(heat,cool);
 if(heat||cool)steps.push({id:'heat',title:'Chauffage ou climatisation (le plus élevé)',rule:'CCÉ 8-200 1) a) iii), 8-106 3) et section 62',
  formula:[bb?`plinthes ${kw(bb)} → 100 % de ${kw(Math.min(bb,10000))}${bb>10000?` + 75 % de ${kw(bb-10000)}`:''} = ${kw(heatBB)}`:'',heat100?`fournaise / accumulateur ${kw(heat100)} à 100 %`:'',`chauffage retenu ${kw(heat)}`,cool?`climatisation ${kw(cool)} à 100 %`:'',`on garde le plus élevé : ${kw(keep)}`].filter(Boolean).join(' ; '),
  w:keep,items:[...of('heating'),...of('heating100'),...of('cooling')],
  excluded:heat&&cool?[{name:heat>=cool?'Climatisation (non simultanée avec le chauffage)':'Chauffage (non simultané avec la climatisation)',w:Math.min(heat,cool)}]:[]});
 // 4. Cuisinière.
 const rangeW=sum('range'),range=rangeW?6000+0.4*Math.max(0,rangeW-12000):0;
 if(rangeW)steps.push({id:'range',title:'Cuisinière',rule:'CCÉ 8-200 1) a) iv)',formula:`6000 W${rangeW>12000?` + 40 % × (${kw(rangeW)} − 12 kW)`:` (cuisinière de ${kw(rangeW)}, 12 kW ou moins)`} = ${Math.round(range)} W`,w:range,items:of('range'),
  itemsNote:of('range').length>1?'Table de cuisson et four encastré : combinés comme une seule cuisinière selon les conditions du Code (8-300, 26-746).':''});
 // 5. Chauffe-eau instantané, piscine, spa.
 const w100=sum('water100');
 if(w100)steps.push({id:'water100',title:'Chauffe-eau instantané, piscine, spa, bain de vapeur',rule:'CCÉ 8-200 1) a) v)',formula:`100 % de ${kw(w100)}`,w:w100,items:of('water100')});
 // 6. Bornes de recharge.
 const ev=sum('ev');
 if(ev)steps.push({id:'ev',title:'Bornes de recharge de véhicule électrique',rule:'CCÉ 8-200 1) a) vi), 8-106 11) et section 86',formula:`100 % de ${kw(ev)}`,w:ev,items:of('ev'),
  itemsNote:'Avec un système de gestion de l’énergie (EVEMS) qui limite la borne, la charge retenue peut être réduite au réglage du système.'});
 // 7. Autres charges de plus de 1500 W.
 const other=sum('other');
 if(other){const w=rangeW?0.25*other:Math.min(other,6000)+0.25*Math.max(0,other-6000);
  steps.push({id:'other',title:'Autres appareils de plus de 1500 W',rule:'CCÉ 8-200 1) a) vii)',formula:rangeW?`25 % de ${kw(other)} (une cuisinière est prévue) = ${Math.round(w)} W`:`100 % des 6 premiers kW${other>6000?` + 25 % de ${kw(other-6000)}`:''} (aucune cuisinière) = ${Math.round(w)} W`,w,items:of('other')});}
 const total=steps.reduce((t,x)=>t+x.w,0);
 const amps=total/vs.bi;
 const minService=area>=80?100:60;
 const recommended=SERVICE_SIZES.find(v=>v>=Math.max(amps,minService))??null;
 const warnings=[];
 for(const i of of('basic'))if(i.w>1500)warnings.push(`« ${i.name} » (${i.w} W, ${i.where}) dépasse 1500 W : classez-le dans une autre catégorie.`);
 if(!area)warnings.push('Superficie habitable manquante : la charge de base vaut 0.');
 const lines=steps.filter(x=>x.id!=='area').map(x=>({label:`${x.title} — ${x.formula}`,w:Math.round(x.w)}));
 return {steps:steps.map(x=>({...x,w:Math.round(x.w)})),lines,area,totalW:Math.round(total),amps:round(amps),minService,recommended,warnings,items};
}

// Bilan complet d'un panneau.
export function panelReport(panel,{children=[]}={}){
 const det=panel.details||{};
 const vs=voltsOf(det);
 const model=panelModel(det);
 const circuits=sortCircuits(panel.circuits);
 const rows=circuits.map(c=>({c,r:circuitLoad(c,vs)}));
 const connectedW=rows.reduce((s,x)=>s+x.r.watts,0)+children.reduce((s,p)=>s+p.circuits.reduce((t,c)=>t+circuitLoad(c,vs).watts,0),0);
 const balance=phaseBalance(circuits,vs);
 // Sous-panneaux : charge répartie sur les deux phases.
 const childAmps=children.reduce((s,p)=>s+p.circuits.reduce((t,c)=>t+circuitLoad(c,vs).watts,0),0)/vs.bi;
 balance.L1=round(balance.L1+childAmps);balance.L2=round(balance.L2+childAmps);
 const mainAmps=Number(det.mainAmps)||null;
 const calc=dwellingCalc(circuits,{livingArea:det.livingArea,basementArea:det.basementArea,children,panelTag:panel.tag||'',vs});
 const isDwelling=panel.kind==='Principal'&&calc.area>0;
 const designAmps=isDwelling?calc.amps:Math.max(balance.L1,balance.L2);
 const percent=mainAmps&&designAmps?round(designAmps/mainAmps*100,0):null;
 const issues=[];
 for(const {c,r} of rows)for(const i of r.issues)if(i.level!=='info')issues.push({...i,circuit:designation(c)});
 const used=circuits.filter(c=>c.status!=='Libre'&&(c.label||c.loads?.length||c.amps)).length;
 if(model?.maxCircuits&&used>model.maxCircuits)issues.push({level:'error',text:`${used} circuits pour un maximum de ${model.maxCircuits} sur ce modèle.`});
 if(model&&!model.tandem&&circuits.some(c=>c.slots.length===1))issues.push({level:'error',text:'Ce modèle n’accepte pas de disjoncteurs jumelés.'});
 if(percent!=null&&percent>100)issues.push({level:'error',text:`Charge de calcul (${designAmps} A) supérieure au principal de ${mainAmps} A.`});
 else if(percent!=null&&percent>80)issues.push({level:'warn',text:`Charge de calcul à ${percent} % du principal : au-delà de 80 %, prévoyez une marge (gestionnaire de charge, augmentation de l’entrée).`});
 const service=det.fedFrom?null:serviceCheck(det);
 if(service?.status==='warn')issues.push({level:'warn',text:service.text});
 if(balance.imbalance>30&&Math.max(balance.L1,balance.L2)>20)issues.push({level:'warn',text:`Déséquilibre de ${balance.imbalance} % entre L1 et L2 : déplacez des circuits 120 V.`});
 const free=circuits.filter(c=>c.status==='Libre'||(!c.label&&!c.loads?.length&&c.amps==null)).length;
 return {vs,model,mainAmps,service,rows,connectedW,balance,calc,isDwelling,designAmps,percent,status:percent==null?'unknown':percent>100?'over':percent>80?'high':percent>70?'medium':'ok',issues,free,remainingAmps:mainAmps?round(mainAmps*CONTINUOUS_FACTOR-designAmps):null};
}

// Suggestions : quelle borne ou quel appareil peut encore être ajouté ?
export function suggestions(report){
 const out=[];
 const rem=report.remainingAmps;
 if(rem==null){out.push('Indiquez le calibre du disjoncteur principal pour obtenir des suggestions.');return out;}
 const bi=report.vs?.bi||240;
 const fits=LOAD_LIBRARY.filter(l=>l.cat==='ev'&&l.v===240).filter(l=>l.w/bi<=rem).sort((a,b)=>b.w-a.w)[0];
 if(fits)out.push(`Borne de recharge : jusqu’à « ${fits.name} » sans dépasser 80 % du principal (marge restante ≈ ${rem} A).`);
 else if(rem>12)out.push(`Borne de recharge : seule une borne de niveau 1 ou une borne de niveau 2 réglée à basse intensité est possible (marge ≈ ${rem} A). Un gestionnaire de charge (EVEMS, règle 8-106 11)) peut éviter l’augmentation de l’entrée.`);
 else out.push('Borne de recharge : capacité insuffisante. Envisagez un gestionnaire de charge (EVEMS) ou l’augmentation de l’entrée électrique.');
 for(const id of ['pool-hp','spa','hp-3t','wh-4500']){const l=LOAD_LIBRARY.find(x=>x.id===id);out.push(`${l.name} (${(l.w/1000).toLocaleString('fr-CA')} kW, ≈ ${round(l.w/bi)} A) : ${l.w/bi<=rem?'✓ possible':'✗ dépasserait 80 % du principal'}.`);}
 if(report.free===0)out.push('Plus aucune position libre : un sous-panneau ou des disjoncteurs jumelés (si permis) seront nécessaires.');
 if(report.isDwelling&&report.calc.recommended&&report.mainAmps&&report.calc.recommended>report.mainAmps)out.push(`Entrée électrique recommandée selon le calcul : ${report.calc.recommended} A (actuelle : ${report.mainAmps} A).`);
 return out;
}

// Liste de matériel : disjoncteurs regroupés par type, avec référence indicative.
export function materials(panel){
 const fam=panel.details?.family||panel.details?.breakerFamily||'generic';
 const groups=new Map();
 const seenTandem=new Set();
 for(const c of panel.circuits){
  if(c.amps==null||c.status==='Libre')continue;
  const tandem=c.slots.length===1;
  if(tandem){const p=slotPos(c.slots[0]);if(seenTandem.has(p))continue;seenTandem.add(p);}
  const poles=tandem?1:polesOf(c),protection=c.protection||'Standard';
  const key=[poles,c.amps,protection,tandem,c.breakerRef||''].join('|');
  const g=groups.get(key)||{poles,amps:c.amps,protection,tandem,qty:0,ref:c.breakerRef||''};
  g.qty++;groups.set(key,g);
 }
 return {family:familyOf(fam).name,items:[...groups.values()].sort((a,b)=>a.poles-b.poles||a.amps-b.amps)};
}
