// Fusion à trois voies d'un panneau modifié hors ligne : base (copie au départ), local (modifications faites hors ligne)
// et serveur (état actuel). Sans conflit, les deux jeux de modifications sont conservés ; sinon la valeur du serveur
// est gardée par défaut et le conflit est signalé pour que l'utilisateur choisisse.
const eq=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const META=['name','tag','kind','location'];

function pick(b,l,s){
 if(eq(l,b))return {v:s};
 if(eq(s,b)||eq(l,s))return {v:l};
 return {v:s,conflict:true};
}

export function mergeCircuits(base=[],local=[],server=[]){
 const B=new Map(base.map(c=>[c.id,c])),L=new Map(local.map(c=>[c.id,c])),S=new Map(server.map(c=>[c.id,c]));
 const order=[...server.map(c=>c.id),...local.map(c=>c.id).filter(id=>!S.has(id))];
 const out=[],conflicts=[];
 for(const id of order){
  const b=B.get(id),l=L.get(id),s=S.get(id);
  const r=pick(b,l,s);
  if(r.conflict)conflicts.push({type:'circuit',id,local:l,server:s});
  const chosen=r.conflict?s:(eq(l,b)?s:l);
  if(chosen)out.push(chosen);
 }
 return {circuits:out,conflicts};
}

// Retourne la fiche (name, tag, kind, location, details) fusionnée.
export function mergeMeta(base={},local={},server={}){
 const out={},conflicts=[];
 for(const k of META){const r=pick(base[k],local[k],server[k]);out[k]=r.conflict?server[k]:(eq(local[k],base[k])?server[k]:local[k]);if(r.conflict)conflicts.push({type:'meta',key:k,local:local[k],server:server[k]});}
 const bd=base.details||{},ld=local.details||{},sd=server.details||{};
 const details={...sd};
 for(const k of new Set([...Object.keys(bd),...Object.keys(ld),...Object.keys(sd)])){
  if(k==='calcRecord')continue;
  const r=pick(bd[k],ld[k],sd[k]);
  const v=r.conflict?sd[k]:(eq(ld[k],bd[k])?sd[k]:ld[k]);
  if(v===undefined)delete details[k];else details[k]=v;
  if(r.conflict)conflicts.push({type:'meta',key:'details.'+k,local:ld[k],server:sd[k]});
 }
 out.details=details;
 return {meta:out,conflicts};
}

export function mergePanel(base,local,server){
 const c=mergeCircuits(base.circuits,local.circuits,server.circuits);
 const m=mergeMeta(base,local,server);
 return {circuits:c.circuits,meta:m.meta,conflicts:[...c.conflicts,...m.conflicts],
  changed:!eq(base.circuits,local.circuits)||META.some(k=>!eq(base[k],local[k]))||!eq(base.details,local.details)};
}

// Applique les choix de l'utilisateur : choices[clé] === 'local' garde la version faite hors ligne.
export function applyChoices(merged,conflicts,choices){
 const circuits=merged.circuits.map(c=>c),meta={...merged.meta,details:{...merged.meta.details}};
 for(const x of conflicts){
  const key=x.type==='circuit'?'c:'+x.id:'m:'+x.key;
  if(choices[key]!=='local')continue;
  if(x.type==='circuit'){
   const i=circuits.findIndex(c=>c.id===x.id);
   if(x.local===undefined){if(i>=0)circuits.splice(i,1);}else if(i>=0)circuits[i]=x.local;else circuits.push(x.local);
  }else if(x.key.startsWith('details.')){const k=x.key.slice(8);if(x.local===undefined)delete meta.details[k];else meta.details[k]=x.local;}
  else meta[x.key]=x.local;
 }
 return {circuits,meta};
}
