// Rendu réaliste d'un panneau électrique et de ses disjoncteurs (SVG).
// Styles par famille (couleurs, pas de 3/4" ou 1") tirés de catalog.js ; marques via plaque et logo facultatif.
import {h} from './dom.js';
import {familyOf} from '../catalog.js';
import {slotPos,slotOrder,designation} from '../model.js';

const NS='http://www.w3.org/2000/svg';
function s(tag,attrs={},...kids){
 const el=document.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))if(v!=null&&v!==false)el.setAttribute(k,v===true?'':String(v));
 for(const k of kids.flat())if(k!=null&&k!==false)el.append(k instanceof Node?k:document.createTextNode(String(k)));
 return el;
}
const PROT_COLOR={'Anti-arc':'#2f7de1','DDFT':'#e8a317','DDFT + anti-arc':'#8b5cf6','Protection équipement':'#8f9aa3'};
const STATUS_COLOR={'Identifié':'#3f9a62','Libre':'#a7afa9','À confirmer':'#d0a04a','Non visible':'#d0a04a'};
const fit=(text,px,size)=>{const max=Math.max(0,Math.floor(px/(size*.55)));return text.length>max?text.slice(0,Math.max(0,max-1))+'…':text;};
const slug=b=>String(b||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

// Plaque de marque : logo officiel si le fichier existe (assets/brands/<marque>.svg), sinon nom de marque.
// Le fichier n'est demandé qu'une fois par marque et par session.
const logoState=new Map();
function probeLogo(brand){
 if(logoState.has(brand))return;
 logoState.set(brand,'pending');
 const img=new Image();
 img.onload=()=>{logoState.set(brand,'ok');document.querySelectorAll(`.brand-badge[data-brand="${slug(brand)}"]`).forEach(addLogo);};
 img.onerror=()=>logoState.set(brand,'missing');
 img.src=`assets/brands/${slug(brand)}.svg`;
}
function addLogo(box){if(box.querySelector('img'))return;box.replaceChildren(h('img',{src:`assets/brands/${box.dataset.brand}.svg`,alt:box.title}));}
export function brandBadge(familyId,{size='md'}={}){
 const f=familyOf(familyId);
 const box=h('span',{class:'brand-badge '+size,title:f.brand||f.name,dataset:{brand:slug(f.brand)}},h('span',{class:'brand-text',text:f.brand||'Panneau'}));
 box.style.setProperty('--accent',f.accent);
 if(f.brand){probeLogo(f.brand);if(logoState.get(f.brand)==='ok')addLogo(box);}
 return box;
}

// circuits vides = obturateurs (aucun calibre, aucune référence, aucune description).
export const isEmptySlot=c=>!c.amps&&!c.breakerRef&&!c.label&&c.status!=='Libre'&&!(c.loads&&c.loads.length);

/**
 * opts : {panel, breakersByCat?, highlight?:Set<number> (positions de départ valides), selectedId?, onCircuit(id), onPosition(p)}
 */
export function panelArt(opts){
 const {panel,breakersByCat=new Map(),highlight=null,onCircuit,onPosition,showLabels=true}=opts;
 const det=panel.details||{};
 const fam=familyOf(det.family);
 const rows=Math.ceil(panel.positions/2);
 const rh=fam.pitch<1?30:36;           // hauteur d'un espace (3/4" plus serré que 1")
 const W=560,colW=190,gap=52,x0=(W-colW*2-gap)/2,xR=x0+colW+gap;
 const top=196,H=top+rows*rh+46;
 const isMain=det.mainAmps&&!/cosses|sans principal/i.test(det.modelInfo||'')&&panel.kind!=='Sous-panneau'||(/principal/i.test(det.modelInfo||''));
 const svg=s('svg',{viewBox:`0 0 ${W} ${H}`,class:'panel-art',role:'img','aria-label':`Panneau ${panel.name}, ${panel.positions} positions`});
 const defs=s('defs',{},
  s('linearGradient',{id:'pa-steel',x1:0,y1:0,x2:1,y2:1},s('stop',{offset:0,'stop-color':'#d9dcd8'}),s('stop',{offset:.45,'stop-color':'#c3c7c2'}),s('stop',{offset:1,'stop-color':'#aeb3ad'})),
  s('linearGradient',{id:'pa-front',x1:0,y1:0,x2:0,y2:1},s('stop',{offset:0,'stop-color':'#eceeea'}),s('stop',{offset:1,'stop-color':'#dadeda'})),
  s('linearGradient',{id:'pa-shine',x1:0,y1:0,x2:0,y2:1},s('stop',{offset:0,'stop-color':'#fff','stop-opacity':.16}),s('stop',{offset:.5,'stop-color':'#fff','stop-opacity':0}),s('stop',{offset:1,'stop-color':'#000','stop-opacity':.18})),
  s('linearGradient',{id:'pa-handle',x1:0,y1:0,x2:0,y2:1},s('stop',{offset:0,'stop-color':'#fff','stop-opacity':.22}),s('stop',{offset:.55,'stop-color':'#fff','stop-opacity':0}),s('stop',{offset:1,'stop-color':'#000','stop-opacity':.35})),
  s('filter',{id:'pa-shadow',x:'-10%',y:'-10%',width:'120%',height:'130%'},s('feDropShadow',{dx:0,dy:1.2,stdDeviation:1.1,'flood-opacity':.35})));
 svg.append(defs);
 // Boîtier et plaque frontale.
 svg.append(s('rect',{x:4,y:4,width:W-8,height:H-8,rx:10,fill:'url(#pa-steel)',stroke:'#8f958e','stroke-width':2}));
 svg.append(s('rect',{x:20,y:20,width:W-40,height:H-40,rx:6,fill:'url(#pa-front)',stroke:'#b7bcb6','stroke-width':1.5}));
 for(const [cx,cy] of [[34,34],[W-34,34],[34,H-34],[W-34,H-34]])svg.append(s('g',{},s('circle',{cx,cy,r:6,fill:'#c9cdc7',stroke:'#8e948c'}),s('line',{x1:cx-3.5,y1:cy+2,x2:cx+3.5,y2:cy-2,stroke:'#7d847b','stroke-width':1.2})));
 // Étiquette du fabricant (texte ; le logo officiel s'affiche au-dessus du dessin).
 svg.append(s('rect',{x:W/2-120,y:34,width:240,height:34,rx:4,fill:'#f7f8f5',stroke:'#c3c8c1'}));
 svg.append(s('text',{x:W/2,y:50,'text-anchor':'middle','font-size':12,'font-weight':800,fill:fam.accent,'letter-spacing':1.5},(fam.brand||'PANNEAU').toUpperCase()));
 svg.append(s('text',{x:W/2,y:62,'text-anchor':'middle','font-size':8,fill:'#5d665f','letter-spacing':.8},fit(`${det.modelId||fam.name}${det.maxCircuits?` · ${panel.positions}/${det.maxCircuits}`:` · ${panel.positions} pos.`}`,230,8)));
 // Principal ou cosses.
 if(det.mainAmps&&isMain){
  const mx=W/2-70,my=82;
  svg.append(s('g',{filter:'url(#pa-shadow)'},
   s('rect',{x:mx,y:my,width:140,height:84,rx:5,fill:'#121212'}),s('rect',{x:mx,y:my,width:140,height:84,rx:5,fill:'url(#pa-shine)'}),
   s('rect',{x:mx+30,y:my+22,width:80,height:40,rx:4,fill:'#262626',stroke:'#050505'}),s('rect',{x:mx+30,y:my+22,width:80,height:40,rx:4,fill:'url(#pa-handle)'}),
   s('text',{x:W/2,y:my+48,'text-anchor':'middle','font-size':17,'font-weight':800,fill:'#f2f2f2'},String(det.mainAmps)),
   s('text',{x:W/2,y:my+15,'text-anchor':'middle','font-size':7.5,'font-weight':700,fill:'#bdbdbd','letter-spacing':1.4},'PRINCIPAL'),
   s('text',{x:W/2,y:my+76,'text-anchor':'middle','font-size':7,fill:'#a8a8a8'},'ON ▲   OFF ▼')));
 }else{
  for(const x of [W/2-62,W/2+14])svg.append(s('g',{},s('rect',{x,y:96,width:48,height:52,rx:4,fill:'#b98a3c',stroke:'#7e5d24'}),s('rect',{x:x+10,y:106,width:28,height:14,rx:2,fill:'#e9c56d'}),s('circle',{cx:x+24,cy:134,r:6,fill:'#7e5d24'})));
  svg.append(s('text',{x:W/2,y:172,'text-anchor':'middle','font-size':8,fill:'#5d665f','letter-spacing':1},'COSSES PRINCIPALES · SANS DISJONCTEUR PRINCIPAL'));
 }
 // Barres omnibus centrales.
 svg.append(s('rect',{x:x0+colW+8,y:top-8,width:gap-16,height:rows*rh+16,rx:3,fill:'#8d938c'}));
 for(const dx of [14,gap-28])svg.append(s('rect',{x:x0+colW+dx,y:top-4,width:6,height:rows*rh+8,fill:'#c7a46a',opacity:.85}));
 // Numéros imprimés sur la plaque frontale.
 for(let r=0;r<rows;r++){
  const y=top+r*rh+rh/2+3.5;
  svg.append(s('text',{x:x0-16,y,'text-anchor':'end','font-size':9,'font-weight':700,fill:'#56605a'},String(r*2+1)));
  svg.append(s('text',{x:xR+colW+16,y,'font-size':9,'font-weight':700,fill:'#56605a'},String(r*2+2)));
 }
 const yOf=slot=>top+slotOrder(slot)*rh/2;
 const layer=s('g',{});svg.append(layer);
 for(const c of panel.circuits){
  const n=slotPos(c.slots[0]),right=n%2===0,x=right?xR:x0;
  const y=yOf(c.slots[0]),hh=c.slots.length*rh/2;
  const g=s('g',{class:'pa-item','data-id':c.id,tabindex:0,role:'button','aria-label':`${designation(c)} : ${c.label||(isEmptySlot(c)?'espace libre':'à identifier')}${c.amps?', '+c.amps+' A':''}`});
  if(isEmptySlot(c)){
   // Obturateur (espace libre).
   g.append(s('rect',{x:x+3,y:y+1.5,width:colW-6,height:hh-3,rx:2,fill:'#cfd3ce',stroke:'#b2b8b1'}));
   g.append(s('rect',{x:right?x+colW-22:x+10,y:y+hh/2-2.5,width:12,height:5,rx:1,fill:'#b9bfb8'}));
  }else drawBreaker(g,{c,x,y,w:colW,h:hh,right,fam,rh,yOf,meta:c.breakerRef?breakersByCat.get(c.breakerRef):null,showLabels});
  layer.append(g);
 }
 // Positions de départ proposées pour placer le disjoncteur choisi.
 if(highlight&&highlight.size){
  const hl=s('g',{class:'pa-targets'});
  for(const p of highlight){
   const right=p%2===0,x=right?xR:x0,y=top+Math.floor((p-1)/2)*rh;
   hl.append(s('rect',{class:'pa-target','data-pos':p,x:x+1,y:y+1,width:colW-2,height:rh-2,rx:3}));
  }
  svg.append(hl);
 }
 svg.addEventListener('click',e=>{
  const t=e.target.closest('[data-pos]');if(t&&onPosition)return onPosition(Number(t.dataset.pos));
  const g=e.target.closest('.pa-item');if(g&&onCircuit)onCircuit(g.dataset.id);
 });
 svg.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest?.('.pa-item')){e.preventDefault();onCircuit?.(e.target.closest('.pa-item').dataset.id);}});
 const wrap=h('div',{class:'panel-art-wrap'});
 const plate=h('div',{class:'panel-art-brand'},brandBadge(det.family,{size:'sm'}));
 wrap.append(plate,svg);
 return wrap;
}

function drawBreaker(g,{c,x,y,w,h,right,fam,rh,yOf,meta,showLabels}){
 const bx=x+3,by=y+1.2,bw=w-6,bh=h-2.4;
 g.append(s('rect',{x:bx,y:by,width:bw,height:bh,rx:3,fill:fam.body,filter:'url(#pa-shadow)'}));
 g.append(s('rect',{x:bx,y:by,width:bw,height:bh,rx:3,fill:'url(#pa-shine)'}));
 // Bande d'état (identifié / à confirmer / libre) côté extérieur.
 g.append(s('rect',{x:right?bx+bw-4:bx,y:by+2,width:4,height:bh-4,rx:1.5,fill:STATUS_COLOR[c.status]||'#d0a04a'}));
 // Manette(s) côté barres omnibus, reliées pour un multipolaire.
 const hw=46,hx=right?bx+14:bx+bw-hw-14;
 const handleH=Math.min(18,(c.slots.length===1?rh/2-3:rh-10));
 // Une manette par pôle : centre de la position (ou du demi-emplacement pour un jumelé).
 const byPos=new Map();for(const sl of c.slots){const n=slotPos(sl);byPos.set(n,[...(byPos.get(n)||[]),sl]);}
 const cs=[...byPos.values()].map(sls=>yOf(sls[0])+sls.length*rh/4).sort((a,b)=>a-b);
 if(cs.length>1)g.append(s('rect',{x:hx+hw/2-3,y:cs[0],width:6,height:cs.at(-1)-cs[0],fill:fam.handle,opacity:.9}));
 for(const cy of cs){
  g.append(s('rect',{x:hx,y:cy-handleH/2,width:hw,height:handleH,rx:2.5,fill:fam.handle,stroke:'#000','stroke-opacity':.45}));
  g.append(s('rect',{x:hx,y:cy-handleH/2,width:hw,height:handleH,rx:2.5,fill:'url(#pa-handle)'}));
 }
 const amps=c.amps?String(c.amps):'?';
 g.append(s('text',{x:hx+hw/2,y:cs[0]+(cs.length>1?(cs.at(-1)-cs[0])/2:0)+4,'text-anchor':'middle','font-size':Math.max(7,Math.min(11,handleH-2)),'font-weight':800,fill:fam.ink},amps));
 // Bouton TEST (anti-arc, DDFT, double fonction, protection d'équipement).
 const prot=c.protection;
 let extraX=right?hx+hw+6:hx-6;
 if(prot&&PROT_COLOR[prot]&&bh>=11){
  const tw=18,tx=right?extraX:extraX-tw,ty=by+bh/2-5;
  g.append(s('rect',{x:tx,y:ty,width:tw,height:10,rx:2,fill:'#f4f4f2',stroke:PROT_COLOR[prot],'stroke-width':1.6}));
  g.append(s('text',{x:tx+tw/2,y:ty+7.2,'text-anchor':'middle','font-size':5,'font-weight':800,fill:'#333'},'TEST'));
  extraX=right?extraX+tw+5:extraX-tw-5;
 }
 // Témoin lumineux des disjoncteurs intelligents.
 if(meta?.smart)g.append(s('circle',{cx:right?extraX+3:extraX-3,cy:by+bh/2,r:2.6,fill:'#39d36b',stroke:'#1d7a3c','stroke-width':.6}));
 // Queue de cochon (neutre) des disjoncteurs anti-arc / DDFT à fil.
 if(meta?.neutre==='Pigtail'){
  const ex=right?bx+bw:bx,cy=by+bh/2,dir=right?1:-1;
  g.append(s('path',{d:`M${ex} ${cy} c ${4*dir} -5 ${7*dir} 5 ${10*dir} 0`,fill:'none',stroke:'#f4f4f4','stroke-width':2.2,'stroke-linecap':'round'}));
 }
 // Repère du fabricant et description du circuit.
 const textStart=right?hx+hw+(prot?30:10):bx+10;
 const textEnd=right?bx+bw-10:hx-(prot?30:10);
 const fs=c.slots.length===1?7.4:8.6;
 const ty=by+bh/2+(showLabels&&bh>=18?-1:3);
 const room=Math.max(0,textEnd-textStart);
 if(showLabels){
  const label=c.status==='Libre'?'LIBRE':c.label||'À identifier';
  g.append(s('text',{x:right?textEnd:textStart,y:ty+(bh>=18?0:0),'text-anchor':right?'end':'start','font-size':fs,'font-weight':600,fill:fam.ink,opacity:c.label?1:.7},fit(label,room,fs)));
  if(bh>=18)g.append(s('text',{x:right?textEnd:textStart,y:ty+9,'text-anchor':right?'end':'start','font-size':6.2,fill:fam.ink,opacity:.6},fit(`${designation(c)}${c.breakerRef?' · '+c.breakerRef:''}`,room,6.2)));
 }
 if(fam.mark&&bh>=rh*1.5&&room>70)g.append(s('text',{x:right?bx+bw-9:bx+9,y:by+bh-3,'text-anchor':right?'end':'start','font-size':5.5,'font-weight':800,fill:fam.ink,opacity:.35},fam.mark));
}
