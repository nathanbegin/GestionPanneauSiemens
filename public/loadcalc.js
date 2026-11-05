// Calculs de charge : circuits, phases L1/L2, capacité du panneau, calcul d'un logement (règle 8-200),
// dimensionnement et suggestions. Outils d'aide : la conformité relève d'un maître électricien.
import {slotPos,designation,sortCircuits} from './model.js';
import {CONTINUOUS_FACTOR,STANDARD_BREAKERS,SERVICE_SIZES,WIRE_TABLE,wireAmps,LOAD_LIBRARY,BREAKER_FAMILIES,breakerRef,modelById} from './catalog.js';

export const polesOf=c=>c.slots.length===1?1:new Set(c.slots.map(slotPos)).size;
// Phases : les rangées alternent L1 / L2 (positions 1-2 = L1, 3-4 = L2, 5-6 = L1…).
export const legOf=pos=>Math.floor((pos-1)/2)%2===0?'L1':'L2';
export const circuitVolts=c=>polesOf(c)>=2?240:120;
const round=(n,d=1)=>Math.round(n*10**d)/10**d;
export const nextBreaker=a=>STANDARD_BREAKERS.find(b=>b>=a-1e-9)??null;
export const wireFor=amps=>WIRE_TABLE.find(w=>w.amps>=amps)?.gauge??null;

// Puissance d'une charge en watts.
const lw=l=>(Number(l.w)||0)*(Number(l.qty)||1);

export function circuitLoad(c){
 const loads=c.loads||[];
 const volts=circuitVolts(c);
 const watts=loads.reduce((s,l)=>s+lw(l),0);
 const contW=loads.filter(l=>l.cont).reduce((s,l)=>s+lw(l),0);
 // Cuisinière : 6000 W + 40 % de l'excédent de 12 kW (même logique que le calcul du logement).
 const rangeW=loads.filter(l=>l.cat==='range').reduce((s,l)=>s+lw(l),0);
 const demandW=watts-rangeW+(rangeW?6000+0.4*Math.max(0,rangeW-12000):0);
 const amps=watts/volts,demandAmps=Math.min(watts,demandW)/volts;
 // Disjoncteur minimal : 125 % de la partie continue + 100 % du reste.
 const minBreakerAmps=(contW/CONTINUOUS_FACTOR+(Math.min(watts,demandW)-contW))/volts;
 const breaker=c.amps||null;
 const wire=c.wire?.gauge||'';
 const issues=[];
 if(watts&&breaker){
  if(demandAmps>breaker)issues.push({level:'error',text:`Charge de ${round(demandAmps)} A supérieure au disjoncteur de ${breaker} A.`});
  else if(contW&&minBreakerAmps>breaker)issues.push({level:'error',text:`Charge continue au-delà de 80 % du disjoncteur (${round(demandAmps/breaker*100,0)} %). Minimum suggéré : ${nextBreaker(minBreakerAmps)} A.`});
  else if(demandAmps>breaker*CONTINUOUS_FACTOR)issues.push({level:'warn',text:`Circuit chargé à ${round(demandAmps/breaker*100,0)} % du disjoncteur.`});
 }
 if(watts&&!breaker)issues.push({level:'warn',text:'Calibre du disjoncteur à préciser.'});
 const loadVolts=new Set(loads.map(l=>Number(l.v)||0).filter(Boolean));
 if(loadVolts.has(240)&&volts===120)issues.push({level:'error',text:'Appareil 240 V sur un disjoncteur unipolaire : un bipolaire est requis.'});
 if(wire&&breaker&&wireAmps(wire)!=null&&wireAmps(wire)<breaker)issues.push({level:'error',text:`Fil ${wire} (${wireAmps(wire)} A) trop petit pour un disjoncteur de ${breaker} A.`});
 if(breaker&&!wire&&watts)issues.push({level:'info',text:`Fil suggéré : ${wireFor(breaker)} cuivre.`});
 return {volts,watts,contW,amps:round(amps),demandAmps:round(demandAmps),minBreaker:watts?nextBreaker(minBreakerAmps):null,suggestedWire:breaker?wireFor(breaker):null,
  percent:breaker&&watts?round(demandAmps/breaker*100,0):null,issues};
}

// Charges par phase (A). Un circuit bipolaire 240 V charge L1 et L2 ; un 120 V charge sa phase.
export function phaseBalance(circuits){
 const legs={L1:0,L2:0};
 for(const c of circuits){
  const r=circuitLoad(c);if(!r.watts)continue;
  if(r.volts===240){legs.L1+=r.watts/240;legs.L2+=r.watts/240;}
  else legs[legOf(slotPos(c.slots[0]))]+=r.watts/120;
 }
 const max=Math.max(legs.L1,legs.L2),min=Math.min(legs.L1,legs.L2);
 return {L1:round(legs.L1),L2:round(legs.L2),imbalance:max?round((max-min)/max*100,0):0};
}

// Calcul de charge d'un logement unifamilial (règle 8-200 du CCÉ, simplifiée).
// children : sous-panneaux alimentés par ce panneau (leurs charges s'ajoutent).
export function dwellingCalc(circuits,{livingArea=0,children=[]}={}){
 const all=[...circuits,...children.flatMap(p=>p.circuits||[])].flatMap(c=>c.loads||[]);
 const sum=cat=>all.filter(l=>l.cat===cat).reduce((s,l)=>s+lw(l),0);
 const area=Math.max(0,Number(livingArea)||0);
 const lines=[];
 const basic=area?5000+1000*Math.ceil(Math.max(0,area-90)/90):0;
 lines.push({label:area?`Charge de base (${area} m²) : 5000 W pour 90 m² + 1000 W par 90 m² additionnels`:'Charge de base : indiquez la superficie habitable',w:basic});
 const bb=sum('heating'),heatBB=Math.min(bb,10000)+0.75*Math.max(0,bb-10000);
 const heat=heatBB+sum('heating100'),cool=sum('cooling');
 // Chauffage et climatisation non simultanés : on retient le plus élevé (règle 8-106 3)).
 if(heat||cool)lines.push({label:`Chauffage (${round(bb/1000)} kW plinthes : 100 % des 10 premiers kW, 75 % au-delà${sum('heating100')?' + fournaise 100 %':''}) ou climatisation (100 %) : le plus élevé`,w:Math.max(heat,cool)});
 const rangeW=sum('range');
 const range=rangeW?6000+0.4*Math.max(0,rangeW-12000):0;
 if(rangeW)lines.push({label:`Cuisinière ${round(rangeW/1000)} kW : 6000 W + 40 % au-delà de 12 kW`,w:range});
 const w100=sum('water100');if(w100)lines.push({label:'Chauffe-eau instantané, piscine, spa : 100 %',w:w100});
 const ev=sum('ev');if(ev)lines.push({label:'Bornes de recharge : 100 % (sauf gestionnaire de charge)',w:ev});
 const other=sum('other');
 if(other){const w=rangeW?0.25*other:Math.min(other,6000)+0.25*Math.max(0,other-6000);lines.push({label:rangeW?`Autres charges > 1500 W (${round(other/1000)} kW) : 25 % (cuisinière présente)`:`Autres charges > 1500 W (${round(other/1000)} kW) : 100 % jusqu’à 6000 W, 25 % au-delà`,w});}
 const total=lines.reduce((s,l)=>s+l.w,0);
 const amps=total/240;
 const minService=area>=80?100:60;
 const recommended=SERVICE_SIZES.find(s=>s>=Math.max(amps,minService))??null;
 return {lines:lines.map(l=>({...l,w:Math.round(l.w)})),totalW:Math.round(total),amps:round(amps),minService,recommended};
}

// Bilan complet d'un panneau.
export function panelReport(panel,{children=[]}={}){
 const det=panel.details||{};
 const model=modelById(det.modelId);
 const circuits=sortCircuits(panel.circuits);
 const rows=circuits.map(c=>({c,r:circuitLoad(c)}));
 const connectedW=rows.reduce((s,x)=>s+x.r.watts,0)+children.reduce((s,p)=>s+p.circuits.reduce((t,c)=>t+circuitLoad(c).watts,0),0);
 const balance=phaseBalance(circuits);
 // Sous-panneaux : charge répartie sur les deux phases.
 const childAmps=children.reduce((s,p)=>s+p.circuits.reduce((t,c)=>t+circuitLoad(c).watts,0),0)/240;
 balance.L1=round(balance.L1+childAmps);balance.L2=round(balance.L2+childAmps);
 const mainAmps=Number(det.mainAmps)||model?.mainAmps||null;
 const calc=dwellingCalc(circuits,{livingArea:det.livingArea,children});
 const isDwelling=panel.kind==='Principal'&&Number(det.livingArea)>0;
 const designAmps=isDwelling?calc.amps:Math.max(balance.L1,balance.L2);
 const percent=mainAmps&&designAmps?round(designAmps/mainAmps*100,0):null;
 const issues=[];
 for(const {c,r} of rows)for(const i of r.issues)if(i.level!=='info')issues.push({...i,circuit:designation(c)});
 const used=circuits.filter(c=>c.status!=='Libre'&&(c.label||c.loads?.length||c.amps)).length;
 if(model&&used>model.maxCircuits)issues.push({level:'error',text:`${used} circuits pour un maximum de ${model.maxCircuits} sur ce modèle.`});
 if(model&&!model.tandem&&circuits.some(c=>c.slots.length===1))issues.push({level:'error',text:'Ce modèle n’accepte pas de disjoncteurs jumelés.'});
 if(percent!=null&&percent>100)issues.push({level:'error',text:`Charge de calcul (${designAmps} A) supérieure au principal de ${mainAmps} A.`});
 else if(percent!=null&&percent>80)issues.push({level:'warn',text:`Charge de calcul à ${percent} % du principal : au-delà de 80 %, prévoyez une marge (gestionnaire de charge, augmentation de l’entrée).`});
 if(balance.imbalance>30&&Math.max(balance.L1,balance.L2)>20)issues.push({level:'warn',text:`Déséquilibre de ${balance.imbalance} % entre L1 et L2 : déplacez des circuits 120 V.`});
 const free=circuits.filter(c=>c.status==='Libre'||(!c.label&&!c.loads?.length&&c.amps==null)).length;
 return {model,mainAmps,rows,connectedW,balance,calc,isDwelling,designAmps,percent,status:percent==null?'unknown':percent>100?'over':percent>80?'high':percent>70?'medium':'ok',issues,free,remainingAmps:mainAmps?round(mainAmps*CONTINUOUS_FACTOR-designAmps):null};
}

// Suggestions : quelle borne ou quel appareil peut encore être ajouté ?
export function suggestions(report){
 const out=[];
 const rem=report.remainingAmps;
 if(rem==null){out.push('Indiquez le calibre du disjoncteur principal pour obtenir des suggestions.');return out;}
 const fits=LOAD_LIBRARY.filter(l=>l.cat==='ev'&&l.v===240).filter(l=>l.w/240<=rem).sort((a,b)=>b.w-a.w)[0];
 if(fits)out.push(`Borne de recharge : jusqu’à « ${fits.name} » sans dépasser 80 % du principal (marge restante ≈ ${rem} A).`);
 else if(rem>12)out.push(`Borne de recharge : seule une borne de niveau 1 ou une borne de niveau 2 réglée à basse intensité est possible (marge ≈ ${rem} A). Un gestionnaire de charge (EVEMS, règle 8-106 11)) peut éviter l’augmentation de l’entrée.`);
 else out.push('Borne de recharge : capacité insuffisante. Envisagez un gestionnaire de charge (EVEMS) ou l’augmentation de l’entrée électrique.');
 for(const id of ['pool-hp','spa','hp-3t','wh-4500']){const l=LOAD_LIBRARY.find(x=>x.id===id);out.push(`${l.name} (${(l.w/1000).toLocaleString('fr-CA')} kW, ≈ ${round(l.w/240)} A) : ${l.w/240<=rem?'✓ possible':'✗ dépasserait 80 % du principal'}.`);}
 if(report.free===0)out.push('Plus aucune position libre : un sous-panneau ou des disjoncteurs jumelés (si permis) seront nécessaires.');
 if(report.isDwelling&&report.calc.recommended&&report.mainAmps&&report.calc.recommended>report.mainAmps)out.push(`Entrée électrique recommandée selon le calcul : ${report.calc.recommended} A (actuelle : ${report.mainAmps} A).`);
 return out;
}

// Liste de matériel : disjoncteurs regroupés par type, avec référence indicative.
export function materials(panel){
 const fam=panel.details?.breakerFamily||modelById(panel.details?.modelId)?.family||'generic';
 const groups=new Map();
 const seenTandem=new Set();
 for(const c of panel.circuits){
  if(c.amps==null||c.status==='Libre')continue;
  const tandem=c.slots.length===1;
  if(tandem){const p=slotPos(c.slots[0]);if(seenTandem.has(p))continue;seenTandem.add(p);}
  const poles=tandem?1:polesOf(c),protection=c.protection||'Standard';
  const key=[poles,c.amps,protection,tandem].join('|');
  const g=groups.get(key)||{poles,amps:c.amps,protection,tandem,qty:0,ref:c.breakerRef||breakerRef(fam,{poles,amps:c.amps,protection,tandem})};
  g.qty++;groups.set(key,g);
 }
 return {family:BREAKER_FAMILIES[fam]?.name||fam,items:[...groups.values()].sort((a,b)=>a.poles-b.poles||a.amps-b.amps)};
}
