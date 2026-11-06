// Génération des PDF : rapport complet, aide-mémoire de porte et étiquettes (feuille Avery 5160).
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {sortCircuits,designation,slotOrder,slotPos,stats,siteAddress,panelTitle,tagGroups,formatOf,breakerFormats} from '../../public/model.js';

const SIZES={letter:[612,792],legal:[612,1008]};
const C={ink:rgb(.094,.235,.196),green:rgb(.133,.416,.318),muted:rgb(.42,.47,.44),line:rgb(.80,.84,.80),soft:rgb(.93,.95,.92),white:rgb(1,1,1),amber:rgb(.70,.52,.22),free:rgb(.62,.66,.62),lime:rgb(.89,.97,.66)};
const M=40;

class Doc{
 static async create(format='letter',title='Mon Panneau'){
  const d=new Doc();d.pdf=await PDFDocument.create();d.size=SIZES[format]||SIZES.letter;
  d.font=await d.pdf.embedFont(StandardFonts.Helvetica);d.bold=await d.pdf.embedFont(StandardFonts.HelveticaBold);
  d.pdf.setTitle(title);d.pdf.setCreator('Mon Panneau');d.pdf.setProducer('Mon Panneau');d.pdf.setLanguage('fr-CA');
  d.cache=new Map();return d;
 }
 // Remplace les caractères absents de l'encodage WinAnsi des polices standard.
 safe(text){
  let out='';
  for(const ch of String(text??'').replace(/[\t\r]/g,' ')){
   if(ch==='\n'){out+=ch;continue;}
   if(!this.cache.has(ch)){let ok=true;try{this.font.encodeText(ch);}catch{ok=false;}this.cache.set(ch,ok);}
   out+=this.cache.get(ch)?ch:'?';
  }
  return out;
 }
 width(t,size,f=this.font){return f.widthOfTextAtSize(this.safe(t),size);}
 fit(t,size,max,f=this.font){
  t=this.safe(t).replace(/\n/g,' ');
  if(f.widthOfTextAtSize(t,size)<=max)return t;
  while(t.length&&f.widthOfTextAtSize(t+'…',size)>max)t=t.slice(0,-1);
  return t.trimEnd()+'…';
 }
 wrap(t,size,max,f=this.font){
  const lines=[];
  for(const para of this.safe(t).split('\n')){
   let line='';
   for(const word of para.split(/\s+/).filter(Boolean)){
    const test=line?line+' '+word:word;
    if(f.widthOfTextAtSize(test,size)<=max){line=test;continue;}
    if(line)lines.push(line);
    line=f.widthOfTextAtSize(word,size)>max?this.fit(word,size,max,f):word;
   }
   lines.push(line);
  }
  return lines;
 }
 page(){this.p=this.pdf.addPage(this.size);this.y=this.size[1]-M;return this.p;}
 text(t,x,y,{size=10,f=this.font,color=C.ink,max}={}){this.p.drawText(max?this.fit(t,size,max,f):this.safe(t),{x,y,size,font:f,color});}
 rect(x,y,w,h,opts){this.p.drawRectangle({x,y,width:w,height:h,...opts});}
 line(x1,y1,x2,y2,color=C.line,t=.6){this.p.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},color,thickness:t});}
 get W(){return this.size[0];}
 get H(){return this.size[1];}
 ensure(h,onBreak){if(this.y-h<M+28){this.page();onBreak?.();return true;}return false;}
}

const fmtDate=d=>new Intl.DateTimeFormat('fr-CA',{dateStyle:'long'}).format(d);
const fmtDateTime=d=>new Intl.DateTimeFormat('fr-CA',{dateStyle:'long',timeStyle:'short',timeZone:'America/Toronto'}).format(d);
const surveyDate=v=>v?fmtDate(new Date(v+'T12:00:00')):'';
function preparedBy(user){
 const p=user.profile||{};
 if(p.accountType==='pro'&&p.company)return {title:p.company,lines:[p.licence&&'Licence RBQ : '+p.licence,'Responsable : '+user.name,[p.phone,p.proEmail].filter(Boolean).join(' · '),p.address].filter(Boolean),pro:true};
 return {title:user.name,lines:[user.email],pro:false};
}

function footers(d,label){
 const pages=d.pdf.getPages();
 pages.forEach((p,i)=>{
  p.drawLine({start:{x:M,y:M+8},end:{x:d.W-M,y:M+8},color:C.line,thickness:.6});
  p.drawText(d.fit(label,7,d.W-2*M-80),{x:M,y:M-4,size:7,font:d.font,color:C.muted});
  const n=`Page ${i+1} / ${pages.length}`;
  p.drawText(n,{x:d.W-M-d.width(n,7),y:M-4,size:7,font:d.font,color:C.muted});
 });
}

function header(d,{overline,title,subtitle,right}){
 const h=78;
 d.rect(0,d.H-h,d.W,h,{color:C.ink});
 d.rect(M,d.H-h+16,4,h-32,{color:C.lime});
 d.text(overline,M+14,d.H-28,{size:8,f:d.bold,color:C.lime,max:d.W-2*M-180});
 d.text(title,M+14,d.H-48,{size:18,f:d.bold,color:C.white,max:d.W-2*M-170});
 if(subtitle)d.text(subtitle,M+14,d.H-64,{size:9,color:rgb(.8,.87,.83),max:d.W-2*M-170});
 right.forEach((r,i)=>{const s=d.safe(r);d.text(s,d.W-M-d.width(s,8),d.H-30-i*12,{size:8,color:rgb(.8,.87,.83)});});
 d.y=d.H-h-20;
}

// Bloc d'informations à deux colonnes (libellé / valeur).
function infoGrid(d,rows){
 const colW=(d.W-2*M-16)/2;const half=Math.ceil(rows.length/2);
 const startY=d.y;let maxDrop=0;
 [rows.slice(0,half),rows.slice(half)].forEach((col,ci)=>{
  let y=startY;const x=M+ci*(colW+16);
  for(const [k,v] of col){
   d.text(k.toUpperCase(),x,y,{size:6.5,f:d.bold,color:C.muted});
   const lines=d.wrap(v||'—',9,colW).slice(0,2);
   lines.forEach((l,i)=>d.text(l,x,y-11-i*11,{size:9}));
   y-=14+lines.length*11;
  }
  maxDrop=Math.max(maxDrop,startY-y);
 });
 d.y=startY-maxDrop-4;
}

function preparedBlock(d,user,generatedAt){
 const pb=preparedBy(user);
 const lines=pb.lines.slice(0,3);const h=36+lines.length*10;
 d.ensure(h+10);
 d.rect(M,d.y-h,d.W-2*M,h,{color:C.soft,borderColor:C.line,borderWidth:.6});
 d.text(pb.pro?'PRÉPARÉ PAR L’ENTREPRENEUR':'PRÉPARÉ PAR',M+12,d.y-14,{size:6.5,f:d.bold,color:C.muted});
 d.text(pb.title,M+12,d.y-26,{size:10,f:d.bold,max:300});
 lines.forEach((l,i)=>d.text(l,M+12,d.y-38-i*10,{size:8,color:C.muted,max:320}));
 const g='Document généré le '+fmtDateTime(generatedAt);
 d.text(g,d.W-M-12-d.width(g,7.5),d.y-14,{size:7.5,color:C.muted});
 d.y-=h+14;
}

function sectionTitle(d,t,sub){
 d.ensure(40);
 d.text(t,M,d.y-12,{size:12.5,f:d.bold});
 if(sub)d.text(sub,M,d.y-25,{size:8,color:C.muted,max:d.W-2*M});
 d.y-=sub?36:22;
}

const statusColor=c=>c.status==='Identifié'?C.green:c.status==='Libre'?C.free:C.amber;

// Répertoire en deux colonnes (impairs à gauche, pairs à droite), comme sur la porte du panneau.
function directory(d,panel,{rowH=18,compact=false}={}){
 const circuits=sortCircuits(panel.circuits);
 const rows=Math.ceil(panel.positions/2);
 const gap=10,colW=(d.W-2*M-gap)/2;
 // Une seule taille de police : elle doit tenir dans un demi-emplacement (disjoncteur jumelé) s'il y en a.
 const hasHalf=circuits.some(c=>c.slots.length%2===1);
 const fs=Math.min(compact?7.6:8.2,hasHalf?rowH/2-1.6:rowH-6);
 const posW=Math.max(28,...circuits.map(c=>d.width(designation(c),fs,d.bold)))+10;
 const ampsW=Math.max(...circuits.map(c=>d.width(c.amps?c.amps+' A':'— A',fs,d.bold)));
 // Découpe en blocs de lignes si le répertoire dépasse la page.
 let row=0;
 while(row<rows){
  const avail=Math.floor((d.y-(M+30)-16)/rowH);
  if(avail<3){d.page();continue;}
  const end=Math.min(rows,row+avail),top=d.y-16;
  d.text('IMPAIRS',M,d.y-8,{size:6.5,f:d.bold,color:C.muted});
  d.text('PAIRS',M+colW+gap,d.y-8,{size:6.5,f:d.bold,color:C.muted});
  for(const c of circuits){
   const first=slotOrder(c.slots[0]),last=slotOrder(c.slots.at(-1));
   const startRow=first/2,endRow=(last+1)/2;
   if(endRow<=row||startRow>=end)continue;
   const a=Math.max(startRow,row),b=Math.min(endRow,end);
   const side=slotPos(c.slots[0])%2===0?1:0,x=M+side*(colW+gap);
   const y=top-(b-row)*rowH,h=(b-a)*rowH;
   d.rect(x,y+.8,colW,h-1.6,{color:c.status==='Libre'?C.soft:C.white,borderColor:C.line,borderWidth:.6});
   d.rect(x,y+.8,3,h-1.6,{color:statusColor(c)});
   // Mise en page uniforme : même police, colonnes fixes (position, désignation, calibre) pour toutes les cases.
   const by=y+h/2-fs*.35;
   d.text(designation(c),x+8,by,{size:fs,f:d.bold,color:C.green,max:posW-4});
   const amps=c.amps?c.amps+' A':'— A';
   d.text(amps,x+colW-7-d.width(amps,fs,d.bold),by,{size:fs,f:d.bold});
   const label=c.status==='Libre'?'LIBRE':c.label||'À identifier';
   d.text(label,x+8+posW,by,{size:fs,color:c.label||c.status==='Libre'?C.ink:C.muted,max:colW-posW-ampsW-22});
  }
  d.y=top-(end-row)*rowH-10;
  row=end;
  if(row<rows)d.page();
 }
}

function legend(d){
 d.ensure(16);
 let x=M;
 for(const [t,col] of [['Identifié',C.green],['À confirmer',C.amber],['Libre',C.free]]){d.rect(x,d.y-7,6,6,{color:col});d.text(t,x+10,d.y-7,{size:7,color:C.muted});x+=70;}
 d.y-=16;
}

function detailTable(d,panel){
 const cols=[['Pos.',50],['Désignation',142],['Pièce / zone',92],['Type',78],['Calibre',42],['Protection',64],['Statut',64]];
 const head=()=>{d.rect(M,d.y-16,d.W-2*M,16,{color:C.ink});let x=M+5;for(const [t,w] of cols){d.text(t.toUpperCase(),x,d.y-11,{size:6.5,f:d.bold,color:C.white});x+=w;}d.y-=18;};
 head();
 let zebra=false;
 for(const c of sortCircuits(panel.circuits)){
  const extra=[c.exceptions&&'Exceptions : '+c.exceptions,c.notes&&'Notes : '+c.notes,...tagGroups.map(k=>(c.tags?.[k]||[]).length?({locations:'Emplacements',functions:'Fonctions',devices:'Appareils'}[k]+' : '+c.tags[k].join(', ')):'').filter(Boolean),formatOf(c)!=='single'?'Format : '+breakerFormats[formatOf(c)]:''].filter(Boolean);
  const extraLines=extra.flatMap(e=>d.wrap(e,7,d.W-2*M-cols[0][1]-10)).slice(0,8);
  // Désignation complète sur deux lignes au besoin (les autres colonnes restent sur la première ligne).
  const desig=d.wrap(c.status==='Libre'?'Libre':c.label||'À identifier',7.8,cols[1][1]-6,d.bold);
  const desigLines=desig.length>2?[desig[0],d.fit(desig.slice(1).join(' '),7.8,cols[1][1]-6,d.bold)]:desig;
  const dh=(desigLines.length-1)*9.5;
  const h=15+dh+extraLines.length*9;
  if(d.ensure(h+2,head))zebra=false;
  if(zebra)d.rect(M,d.y-h,d.W-2*M,h,{color:C.soft});
  zebra=!zebra;
  const vals=[designation(c),c.status==='Libre'?'Libre':c.label||'À identifier',c.room,c.usage,c.amps?c.amps+' A':'—',c.protection||'—',c.status];
  let x=M+5;
  vals.forEach((v,i)=>{if(i===1)desigLines.forEach((l,j)=>d.text(l,x,d.y-10-j*9.5,{size:7.8,f:d.bold}));else d.text(v||'—',x,d.y-10,{size:7.8,f:i<2?d.bold:d.font,color:i===6?statusColor(c):C.ink,max:cols[i][1]-6});x+=cols[i][1];});
  // Notes alignées sur le début de la désignation.
  extraLines.forEach((l,i)=>d.text(l,M+5+cols[0][1],d.y-20-dh-i*9,{size:7,color:C.muted}));
  d.y-=h;
  d.line(M,d.y,d.W-M,d.y);
 }
 d.y-=10;
}

function signature(d,user){
 const pb=preparedBy(user);
 d.ensure(70);
 d.y-=14;
 d.text('Attestation',M,d.y,{size:10,f:d.bold});
 const msg=pb.pro?'Je confirme que ce répertoire reflète l’identification des circuits réalisée à la date du relevé.':'Répertoire établi par le propriétaire. Faire valider par un maître électricien au besoin.';
 d.text(msg,M,d.y-13,{size:8,color:C.muted,max:d.W-2*M});
 const y=d.y-48;
 d.line(M,y,M+230,y,C.ink,.8);d.line(M+290,y,M+430,y,C.ink,.8);
 d.text('Signature',M,y-10,{size:7,color:C.muted});d.text('Date',M+290,y-10,{size:7,color:C.muted});
 d.y=y-24;
}

function panelInfoRows(panel,site,fedFromLabel){
 const det=panel.details||{};
 const s=stats(panel.circuits);
 return [
  ['Site',site.name+(site.client?' — '+site.client:'')],['Adresse',siteAddress(site)],
  ['Bâtiment',det.building],['Emplacement du panneau',panel.location],
  ['Type de panneau',panel.kind],['Alimenté par',fedFromLabel?(fedFromLabel+(det.fedFromCircuit?' — circuit '+det.fedFromCircuit:'')):'Réseau / entrée électrique'],
  ['Marque et modèle',[det.brand,det.model].filter(Boolean).join(' ')],['Principal et tension',[det.mainAmps?det.mainAmps+' A':'',det.voltage].filter(Boolean).join(' · ')],
  ['Positions',`${panel.positions} positions · ${s.total} circuits/groupes`],['Avancement',`${s.identified} identifié(s) · ${s.free} libre(s) · ${s.toConfirm} à confirmer (${s.progress} %)`],
  ['Relevé effectué',[surveyDate(det.surveyDate),det.surveyedBy&&'par '+det.surveyedBy].filter(Boolean).join(' ')],
 ];
}

function panelPages(d,{panel,site,fedFromLabel,user,kind,generatedAt,version}){
 d.page();
 header(d,{overline:kind==='door'?'AIDE-MÉMOIRE DU PANNEAU ÉLECTRIQUE':'RAPPORT DE PANNEAU ÉLECTRIQUE',title:panelTitle(panel),subtitle:[panel.location,site.name].filter(Boolean).join(' · '),right:[fmtDate(generatedAt),'Mon Panneau v'+version]});
 if(kind==='door'){
  const det=panel.details||{};
  const info=[siteAddress(site),[det.brand,det.model].filter(Boolean).join(' '),det.mainAmps&&'Principal '+det.mainAmps+' A',det.voltage,fedFromLabel&&'Alimenté par '+fedFromLabel+(det.fedFromCircuit?' (circuit '+det.fedFromCircuit+')':'')].filter(Boolean).join('  ·  ');
  d.wrap(info,8.5,d.W-2*M).slice(0,2).forEach((l,i)=>d.text(l,M,d.y-i*11,{size:8.5,color:C.muted}));
  d.y-=30;
  const pb=preparedBy(user);
  const rows=Math.ceil(panel.positions/2),footer=58;
  const rowH=Math.max(10,Math.min(24,(d.y-M-footer-26)/rows));
  directory(d,panel,{rowH,compact:rowH<16});
  legend(d);
  // Coordonnées de la personne ou de l'entreprise qui a préparé l'aide-mémoire.
  const y=Math.max(M+20,d.y-6);
  d.line(M,y+4,d.W-M,y+4);
  d.text((pb.pro?'Préparé par ':'Établi par ')+pb.title,M,y-8,{size:8,f:d.bold,max:300});
  d.text(pb.lines.join(' · '),M,y-19,{size:7,color:C.muted,max:d.W-2*M});
  return;
 }
 infoGrid(d,panelInfoRows(panel,site,fedFromLabel));
 preparedBlock(d,user,generatedAt);
 sectionTitle(d,'Répertoire des circuits','Vue de face : positions impaires à gauche, paires à droite.');
 directory(d,panel,{rowH:panel.positions>60?14:18});
 legend(d);
 if(panel.details?.notes){sectionTitle(d,'Notes sur le panneau');d.wrap(panel.details.notes,8.5,d.W-2*M).forEach(l=>{d.ensure(12);d.text(l,M,d.y,{size:8.5});d.y-=11;});d.y-=8;}
 d.page();
 sectionTitle(d,'Détail des circuits — '+panelTitle(panel),'Désignation, pièce desservie, calibre, protection, notes et exceptions.');
 detailTable(d,panel);
 signature(d,user);
}

export async function buildReport({kind='report',format='letter',user,site,panels,generatedAt=new Date(),version}){
 const d=await Doc.create(format,(kind==='door'?'Aide-mémoire — ':'Rapport — ')+(panels.length===1?panelTitle(panels[0].panel):site.name));
 if(panels.length>1&&kind==='report'){
  d.page();
  header(d,{overline:'RAPPORT DES PANNEAUX ÉLECTRIQUES',title:site.name,subtitle:siteAddress(site),right:[fmtDate(generatedAt),'Mon Panneau v'+version]});
  infoGrid(d,[['Site',site.name],['Client',site.client],['Adresse',siteAddress(site)],['Panneaux',String(panels.length)]]);
  preparedBlock(d,user,generatedAt);
  sectionTitle(d,'Panneaux du site','Hiérarchie d’alimentation et avancement de l’identification.');
  const head=()=>{d.rect(M,d.y-16,d.W-2*M,16,{color:C.ink});[['Panneau',M+5],['Type',M+200],['Emplacement',M+290],['Alimenté par',M+420]].forEach(([t,x])=>d.text(t.toUpperCase(),x,d.y-11,{size:6.5,f:d.bold,color:C.white}));d.y-=18;};
  head();
  for(const {panel,fedFromLabel} of panels){
   d.ensure(20,head);const s=stats(panel.circuits);
   d.text(panelTitle(panel),M+5,d.y-10,{size:8.5,f:d.bold,max:190});
   d.text(`${s.progress} % identifié`,M+5,d.y-19,{size:6.5,color:C.muted});
   d.text(panel.kind,M+200,d.y-10,{size:8,max:85});
   d.text(panel.location||'—',M+290,d.y-10,{size:8,max:125});
   d.text(fedFromLabel||'Entrée électrique',M+420,d.y-10,{size:8,max:d.W-M-(M+420)});
   d.y-=24;d.line(M,d.y+2,d.W-M,d.y+2);
  }
  if(site.notes){d.y-=10;sectionTitle(d,'Notes sur le site');d.wrap(site.notes,8.5,d.W-2*M).forEach(l=>{d.ensure(12);d.text(l,M,d.y,{size:8.5});d.y-=11;});}
 }
 for(const p of panels)panelPages(d,{...p,site,user,kind,generatedAt,version});
 footers(d,'Mon Panneau · Répertoire indicatif établi à partir d’un relevé visuel — ne remplace pas une inspection par un maître électricien.');
 return d.pdf.save();
}

// Étiquettes autocollantes : gabarit Avery 5160 / 8160 (30 par feuille Lettre, 2⅝ × 1 po).
export async function buildLabels({site,panel,fedFromLabel,skipFree=false}){
 const d=await Doc.create('letter','Étiquettes — '+panelTitle(panel));
 const W=189,H=72,left=13.5,top=36,pitchX=198;
 const items=[{type:'panel'},...sortCircuits(panel.circuits).filter(c=>!(skipFree&&c.status==='Libre')).map(c=>({type:'circuit',c}))];
 items.forEach((it,i)=>{
  const k=i%30;if(k===0)d.page();
  const col=k%3,row=Math.floor(k/3),x=left+col*pitchX,y=d.H-top-(row+1)*H;
  d.rect(x+2,y+2,W-4,H-4,{borderColor:rgb(.88,.9,.88),borderWidth:.4});
  if(it.type==='panel'){
   const det=panel.details||{};
   d.rect(x+8,y+10,W-16,H-20,{color:C.ink});
   d.text('PANNEAU '+(panel.kind||'').toUpperCase(),x+14,y+H-22,{size:6,f:d.bold,color:C.lime,max:W-28});
   d.text(panel.tag||panel.name,x+14,y+H-38,{size:15,f:d.bold,color:C.white,max:W-28});
   d.text(panel.tag?panel.name:panel.location,x+14,y+H-48,{size:7,color:C.white,max:W-28});
   d.text([det.mainAmps&&det.mainAmps+' A',fedFromLabel&&'Alim. : '+fedFromLabel+(det.fedFromCircuit?' #'+det.fedFromCircuit:'')].filter(Boolean).join(' · ')||site.name,x+14,y+16,{size:6.5,color:rgb(.8,.87,.83),max:W-28});
   return;
  }
  const c=it.c,pos=designation(c);
  let posSize=16;while(posSize>7&&d.width(pos,posSize,d.bold)>46)posSize--;
  d.text(pos,x+10,y+H/2-posSize/3,{size:posSize,f:d.bold,color:C.green});
  const tx=x+62,tw=W-72;
  const label=c.status==='Libre'?'LIBRE':c.label||'________________';
  const lines=d.wrap(label,9,tw,d.bold).slice(0,2);
  lines.forEach((l,j)=>d.text(l,tx,y+H-22-j*11,{size:9,f:d.bold}));
  const meta=[c.amps&&c.amps+' A',c.room,c.protection&&c.protection!=='Standard'?c.protection:''].filter(Boolean).join(' · ');
  if(meta)d.text(meta,tx,y+14,{size:7,color:C.muted,max:tw});
 });
 return d.pdf.save();
}

// Bilan de charges et liste de matériel d'un panneau (mode planification).
export async function buildLoads({user,site,panel,fedFromLabel,children=[],generatedAt=new Date(),version}){
 const {panelReport,materials}=await import('../../public/loadcalc.js');
 const {modelLabel,LOADS_SOURCES}=await import('../../public/catalog.js');
 const rep=panelReport(panel,{children});
 const mat=materials(panel);
 const d=await Doc.create('letter','Bilan de charges — '+panelTitle(panel));
 const kw=w=>(w/1000).toLocaleString('fr-CA',{maximumFractionDigits:2})+' kW';
 d.page();
 header(d,{overline:'BILAN DE CHARGES ET LISTE DE MATÉRIEL',title:panelTitle(panel),subtitle:[panel.location,site.name].filter(Boolean).join(' · '),right:[fmtDate(generatedAt),'Mon Panneau v'+version,(panel.details?.state||'Existant').toUpperCase()]});
 infoGrid(d,[['Site',site.name],['Adresse',siteAddress(site)],['Modèle',rep.model?modelLabel(rep.model):[panel.details?.brand,panel.details?.model].filter(Boolean).join(' ')],['Principal',rep.mainAmps?rep.mainAmps+' A':'—'],['Alimenté par',fedFromLabel||'Entrée électrique'],['Superficie habitable',panel.details?.livingArea?panel.details.livingArea+' m²':'—']]);
 preparedBlock(d,user,generatedAt);
 // Synthèse.
 sectionTitle(d,'Synthèse','Charge de calcul comparée au disjoncteur principal ; seuil recommandé : 80 %.');
 const boxes=[['Capacité utilisée',rep.percent!=null?rep.percent+' %':'—'],['Charge de calcul',rep.designAmps+' A'],['Charge branchée',kw(rep.connectedW)],['Phase L1 / L2',`${rep.balance.L1} / ${rep.balance.L2} A`],['Marge avant 80 %',rep.remainingAmps!=null?rep.remainingAmps+' A':'—']];
 const bw=(d.W-2*M-4*8)/5;
 boxes.forEach(([k,v],i)=>{const x=M+i*(bw+8);d.rect(x,d.y-42,bw,42,{color:C.soft,borderColor:C.line,borderWidth:.6});d.text(k.toUpperCase(),x+7,d.y-13,{size:6,f:d.bold,color:C.muted,max:bw-14});d.text(v,x+7,d.y-32,{size:12,f:d.bold,color:i===0&&rep.percent>80?rgb(.64,.24,.2):C.ink,max:bw-14});});
 d.y-=56;
 if(rep.percent!=null){const w=d.W-2*M;d.rect(M,d.y-8,w,8,{color:rgb(.89,.91,.88)});d.rect(M,d.y-8,w*Math.min(1,rep.percent/100),8,{color:rep.percent>100?rgb(.64,.24,.2):rep.percent>80?C.amber:C.green});d.line(M+w*.8,d.y+2,M+w*.8,d.y-12,C.ink,1);d.text('80 %',M+w*.8-8,d.y-22,{size:6.5,color:C.muted});d.y-=34;}
 // Alertes.
 sectionTitle(d,`Alertes (${rep.issues.length})`);
 if(!rep.issues.length){d.text('Aucune alerte.',M,d.y,{size:8.5,color:C.muted});d.y-=14;}
 for(const i of rep.issues){const lines=d.wrap((i.circuit?`Circuit ${i.circuit} : `:'')+i.text,8.5,d.W-2*M-16);d.ensure(lines.length*11+4);d.rect(M,d.y-(lines.length-1)*11-3,3,(lines.length-1)*11+11,{color:i.level==='error'?rgb(.64,.24,.2):C.amber});lines.forEach((l,j)=>d.text(l,M+10,d.y-j*11,{size:8.5}));d.y-=lines.length*11+4;}
 d.y-=6;
 // Calcul 8-200.
 if(panel.kind==='Principal'){
  sectionTitle(d,'Calcul de charge du logement (règle 8-200, simplifié)');
  for(const l of [...rep.calc.lines,{label:'Charge calculée',w:rep.calc.totalW,b:true}]){const lines=d.wrap(l.label,8.5,d.W-2*M-90);d.ensure(lines.length*11+4);lines.forEach((t,j)=>d.text(t,M,d.y-j*11,{size:8.5,f:l.b?d.bold:d.font}));const v=kw(l.w)+(l.b?` · ${rep.calc.amps} A`:'');d.text(v,d.W-M-d.width(v,8.5,d.bold),d.y,{size:8.5,f:d.bold});const base=d.y-(lines.length-1)*11;d.line(M,base-4,d.W-M,base-4);d.y=base-15;}
  d.text(`Entrée minimale : ${rep.calc.minService} A · recommandée selon le calcul : ${rep.calc.recommended??'—'} A.`,M,d.y-4,{size:8,color:C.muted});d.y-=20;
 }
 // Liste de charges.
 d.page();
 sectionTitle(d,'Liste de charges par circuit','Charge de calcul, taux de charge du disjoncteur (charges continues limitées à 80 %) et conducteur.');
 const cols=[['Pos.',44],['Circuit et charges',196],['kW',42],['A',38],['Disj.',40],['%',34],['Fil',58],['Ph.',30],['État',50]];
 const head=()=>{d.rect(M,d.y-16,d.W-2*M,16,{color:C.ink});let x=M+5;for(const [t,w] of cols){d.text(t.toUpperCase(),x,d.y-11,{size:6.5,f:d.bold,color:C.white});x+=w;}d.y-=18;};
 head();
 const {legOf}=await import('../../public/loadcalc.js');
 for(const {c,r} of rep.rows){
  if(!r.watts&&c.amps==null)continue;
  const sub=(c.loads||[]).map(l=>(l.qty>1?l.qty+' × ':'')+l.name+` (${kw(l.w*(l.qty||1))})`).join(', ');
  const subLines=sub?d.wrap(sub,6.8,cols[1][1]-6).slice(0,4):[];
  const h=14+subLines.length*8.5;d.ensure(h+2,head);
  const err=r.issues.some(i=>i.level==='error'),warn=r.issues.some(i=>i.level==='warn');
  const vals=[designation(c),c.label||'—',r.watts?(r.watts/1000).toLocaleString('fr-CA',{maximumFractionDigits:2}):'—',r.watts?String(r.demandAmps):'—',c.amps?c.amps+' A':'—',r.percent!=null?r.percent+' %':'—',c.wire?.gauge||(r.suggestedWire?'~ '+r.suggestedWire:'—'),r.volts===240?'L1+L2':legOf(parseInt(c.slots[0])),err?'À corriger':warn?'À surveiller':'OK'];
  let x=M+5;vals.forEach((v,i)=>{d.text(v,x,d.y-10,{size:7.6,f:i<2?d.bold:d.font,color:i===8?(err?rgb(.64,.24,.2):warn?C.amber:C.green):C.ink,max:cols[i][1]-5});x+=cols[i][1];});
  subLines.forEach((l,j)=>d.text(l,M+49,d.y-19-j*8.5,{size:6.8,color:C.muted}));
  d.y-=h;d.line(M,d.y,d.W-M,d.y);
 }
 // Matériel.
 d.y-=16;
 sectionTitle(d,'Liste de matériel — disjoncteurs','Famille : '+mat.family+'. Références indicatives, à valider auprès du fabricant et selon l’étiquette du panneau.');
 if(!mat.items.length){d.text('Aucun disjoncteur avec calibre.',M,d.y,{size:8.5,color:C.muted});d.y-=14;}
 for(const i of mat.items){d.ensure(14);d.text(String(i.qty)+' ×',M,d.y,{size:9,f:d.bold});d.text(`${i.tandem?'Jumelé 2 × ':i.poles===3?'Tripolaire ':i.poles===2?'Bipolaire ':'Unipolaire '}${i.amps} A${i.protection!=='Standard'?' · '+i.protection:''}`,M+34,d.y,{size:9});if(i.ref)d.text(i.ref,d.W-M-d.width(i.ref,9,d.bold),d.y,{size:9,f:d.bold,color:C.green});d.line(M,d.y-4,d.W-M,d.y-4);d.y-=16;}
 d.y-=10;
 d.ensure(60);
 d.text('Hypothèses et sources',M,d.y,{size:9,f:d.bold});d.y-=12;
 for(const t of ['Charges : valeurs saisies ou valeurs typiques de la bibliothèque. La plaque signalétique de chaque appareil a préséance.','Phases : les rangées alternent L1 / L2 (positions 1-2 sur L1, 3-4 sur L2, etc.).','Calcul simplifié inspiré du Code canadien de l’électricité (règles 8-104, 8-106, 8-200, section 86) et du Code de construction du Québec, chapitre V. Ne remplace pas l’analyse d’un maître électricien.',...LOADS_SOURCES.map(s=>'Source : '+s)])for(const l of d.wrap('• '+t,7.5,d.W-2*M)){d.ensure(10);d.text(l,M,d.y,{size:7.5,color:C.muted});d.y-=9.5;}
 signature(d,user);
 footers(d,'Mon Panneau · Bilan de charges indicatif — la conformité de l’installation relève d’un maître électricien.');
 return d.pdf.save();
}
