// Traduction de l'interface (sans DOM) : dictionnaire français → autre langue.
// Entrées : [français, traduction]. « {} » = valeur variable ; la traduction peut utiliser {} (dans l'ordre) ou {1}, {2}… (pour réordonner).
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const fill=(tpl,groups)=>{let i=0;return tpl.replace(/\{(\d*)\}/g,(_,n)=>groups[(n?Number(n):++i)-1]??'');};

export function makeTranslator(entries){
 const exact=new Map(),lowerExact=new Map(),wild=[],prefixes=[],wildPrefixes=[];
 for(const [fr,en] of entries){
  if(fr.includes('{}')){
   const parts=fr.split('{}');
   // Un motif presque sans texte fixe (« {} panneaux ») n'accepte que des valeurs courtes (nombres), pour ne pas avaler une phrase.
   const fixed=fr.replace(/\{\}/g,'').length,grp=fixed<16?'([\\d\\s.,/+%$-]{0,14})':'([\\s\\S]*?)';
   wild.push({re:new RegExp('^'+parts.map(esc).join(grp)+'$'),en,weight:fixed});
   // « Circuit {} : » + message : un motif qui finit par un séparateur sert aussi de préfixe.
   if(/[\s:·—(]$/.test(fr))wildPrefixes.push({re:new RegExp('^'+parts.map(esc).join('([\\s\\S]*?)')+'([\\s\\S]+)$'),en,n:parts.length-1,weight:fr.replace(/\{\}/g,'').length});
  }else{
   exact.set(fr,en);lowerExact.set(fr.toLowerCase(),en);
   // « Modifié » + durée : une clé qui finit par un séparateur sert de préfixe.
   if(/[\s:·—(]$/.test(fr)&&fr.trim().length>=3)prefixes.push([fr,en]);
  }
 }
 wild.sort((a,b)=>b.weight-a.weight);wildPrefixes.sort((a,b)=>b.weight-a.weight);
 prefixes.sort((a,b)=>b[0].length-a[0].length);
 const cache=new Map();
 function core(s,depth=0){
  if(exact.has(s))return exact.get(s);
  const t=s.trim();
  if(t&&t!==s&&exact.has(t)){const m=/^(\s*)[\s\S]*?(\s*)$/.exec(s);return m[1]+exact.get(t)+m[2];}
  for(const w of wild){const m=w.re.exec(t||s);if(m){const groups=m.slice(1).map(g=>depth<3?translate(g,depth+1):g);const out=fill(w.en,groups);return t&&t!==s?s.replace(t,out):out;}}
  if(depth<3)for(const w of wildPrefixes){const m=w.re.exec(s);if(m){const groups=m.slice(1,1+w.n).map(g=>translate(g,depth+1));const o=fill(w.en,groups)+translate(m[1+w.n],depth+1);if(o!==s)return o;}}
  if(depth<3)for(const [k,en] of prefixes)if(s.startsWith(k)&&s.length>k.length){const o=en+translate(s.slice(k.length),depth+1);if(o!==s)return o;}
  if(depth<3){
   // Décorations : « ✓ Enregistré », « Retour au relevé → », « Texte… ».
   const lead=/^([^\p{L}\p{N}{]+)([\s\S]*\p{L}[\s\S]*)$/u.exec(s);
   if(lead&&lead[2]){const o=translate(lead[2],depth+1);if(o!==lead[2])return lead[1]+o;}
   const tail=/^([\s\S]*?\p{L}[\s\S]*?)(\s*[→›»…:]+\s*)$/u.exec(s);
   if(tail){const o=translate(tail[1],depth+1);if(o!==tail[1])return o+tail[2];}
   // Texte en majuscules (« MONOPHASÉ ») : on traduit la version habituelle puis on remet en majuscules.
   if(s===s.toUpperCase()&&/\p{L}{3}/u.test(s)){const le=lowerExact.get(s.toLowerCase());if(le)return le.toUpperCase();const low=s.toLowerCase(),cap=low.charAt(0).toUpperCase()+low.slice(1);const o=translate(cap,depth+1);if(o!==cap)return o.toUpperCase();}
   // Parenthèse finale : « Titre (règle) ».
   const par=/^([\s\S]*?\p{L}[\s\S]*?) \(([^()]*)\)(\.?)$/u.exec(s);
   if(par){const h=translate(par[1],depth+1),i=translate(par[2],depth+1);if(h!==par[1]||i!==par[2])return h+' ('+i+')'+par[3];}
   // Segments séparés par « ; » : « Phrase 1 ; Phrase 2 ».
   if(s.includes(' ; ')){const parts=s.split(' ; ');const out=parts.map(x=>translate(x,depth+1));if(out.some((x,i)=>x!==parts[i]))return out.join('; ');}
   // Segments séparés par « — » : « Charge de base — formule ».
   if(s.includes(' — ')){const parts=s.split(' — ');const out=parts.map(x=>translate(x,depth+1));if(out.some((x,i)=>x!==parts[i]))return out.join(' — ');}
   // Segments séparés par « · » : « Principal · Emplacement à préciser ».
   if(s.includes(' · ')){const parts=s.split(' · ');const out=parts.map(x=>translate(x,depth+1));if(out.some((x,i)=>x!==parts[i]))return out.join(' · ');}
  }
  return s;
 }
 function translate(s,depth=0){
  if(typeof s!=='string'||!s.trim())return s;
  if(depth===0&&cache.has(s))return cache.get(s);
  const out=core(s,depth);
  if(depth===0){if(cache.size>5000)cache.clear();cache.set(s,out);}
  return out;
 }
 translate.exact=s=>exact.get(s);
 return translate;
}
