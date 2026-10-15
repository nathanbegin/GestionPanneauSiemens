import {blank,validate,parentOf} from './model.js';
const $=id=>document.getElementById(id), cacheKey='siemens-eq-v1';
let circuits=blank(),revision=0,key='',connected=false,dirty=false,selected=1,busy=false;
try{const cached=JSON.parse(localStorage.getItem(cacheKey));if(cached){circuits=validate(cached.circuits);dirty=!!cached.dirty;revision=cached.revision||0;}}catch{}
const statusClass=c=>c.status==='Identifié'?'identified':c.status==='Libre'?'free':'unknown';
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function toast(message){$('toast').textContent=message;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',5500);}
function persist(){try{localStorage.setItem(cacheKey,JSON.stringify({circuits,revision,dirty}));return true;}catch{toast('Stockage local indisponible. Exportez une copie avant de quitter.');return false;}}
function syncLabel(message){$('sync').textContent=message|| (connected?(dirty?'Modifications locales · synchronisation en attente':'● Synchronisé avec votre base'):'○ Brouillon local · connexion requise pour synchroniser');$('connect').textContent=connected?'Déconnexion':'Connexion';}
function render(){
 const claimed=new Set(circuits.filter(c=>c.poles===2).map(c=>c.position+2));
 $('breakers').replaceChildren();$('directoryList').replaceChildren();
 const q=$('search').value.toLocaleLowerCase('fr'),filter=$('filter').value;let shown=0;
 for(const c of circuits){const parent=parentOf(circuits,c.position),entry=parent||c;
 const b=node('button','breaker '+statusClass(entry)+(c.position%2===0?' even':'')+(parent?' linked':''));b.type='button';b.setAttribute('aria-label',`Position ${c.position} : ${entry.label||entry.status}${parent?', liée au circuit '+parent.position:''}`);
 b.append(node('span','num',String(c.position).padStart(2,'0')),node('span','lever',entry.status==='Libre'?'—':entry.amps),node('span','short',parent?'↳ '+parent.position:entry.label||entry.status),node('i','dot'));b.onclick=()=>edit(entry.position);$('breakers').append(b);
 if(claimed.has(c.position))continue;
 if(filter&&c.status!==filter)continue;if(q&&!`${c.position} ${c.label} ${c.room} ${c.usage} ${c.notes}`.toLocaleLowerCase('fr').includes(q))continue;
 shown++;const card=node('button','circuit-card '+statusClass(c));card.type='button';const text=node('span','card-text');text.append(node('strong','',c.label|| (c.status==='Libre'?'Emplacement libre':'Circuit à identifier')),node('small','',c.room?`${c.room} · ${c.usage}`:c.status==='Libre'?'Disponible':`Position ${c.position} · ${c.usage}`));const meta=node('span','card-meta',c.status==='Libre'?'—':c.amps+' A');meta.append(node('small','',c.status));card.append(node('span','card-number',c.poles===2?`${c.position}/${c.position+2}`:String(c.position).padStart(2,'0')),text,meta);card.onclick=()=>edit(c.position);$('directoryList').append(card);
 }
 if(!shown)$('directoryList').append(node('p','empty','Aucun circuit ne correspond à votre recherche.'));
 $('results').textContent=shown+' entrées';const n=circuits.filter(c=>c.status==='Identifié'&&!claimed.has(c.position)).reduce((sum,c)=>sum+c.poles,0);$('count').textContent=`${n} / 40 positions identifiées`;syncLabel();
}
function edit(n){selected=n;const c=circuits[n-1];$('editorTitle').textContent=`Circuit ${n}${c.poles===2?' / '+(n+2):''}`;for(const k of ['label','room','usage','amps','poles','status','notes'])$('circuitForm').elements[k].value=c[k];$('formError').textContent='';$('editor').showModal();}
for(const a of [15,20,25,30,40,50,60,70,80,90,100,125])$('circuitForm').elements.amps.append(new Option(a+' A',a));
$('circuitForm').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.target),next=structuredClone(circuits);next[selected-1]={position:selected,label:f.get('label').trim(),room:f.get('room').trim(),usage:f.get('usage'),amps:Number(f.get('amps')),poles:Number(f.get('poles')),status:f.get('status'),notes:f.get('notes').trim()};try{if(next[selected-1].status==='Libre'&&next[selected-1].poles===2)throw Error('Un emplacement libre doit être configuré en simple.');validate(next);}catch(err){$('formError').textContent=err.message;return;}circuits=next;dirty=true;const saved=persist();$('editor').close();render();if(connected)await save();else toast(saved?'Circuit enregistré dans ce navigateur.':'Modification en mémoire uniquement : exportez une copie.');};
$('close').onclick=$('cancel').onclick=()=>$('editor').close();
$('search').oninput=$('filter').onchange=render;
$('panelView').onclick=()=>{document.querySelector('.workspace').classList.remove('list-only');$('panelView').classList.add('active');$('listView').classList.remove('active');};
$('listView').onclick=()=>{document.querySelector('.workspace').classList.add('list-only');$('listView').classList.add('active');$('panelView').classList.remove('active');};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({schema:1,panel:'Siemens EQ',positions:40,mainAmps:200,circuits},null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='GestionPanneauSiemens.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onchange=async e=>{try{if(busy)throw Error('Attendez la fin de la synchronisation.');const file=e.target.files[0];if(!file)return;if(file.size>150000)throw Error('Fichier trop volumineux.');const data=JSON.parse(await file.text());if(data.schema!==1)throw Error('Format non pris en charge.');validate(data.circuits);if(!confirm('Remplacer le répertoire actuel par ce fichier ?'))return;circuits=data.circuits;dirty=true;persist();render();if(connected)await save();else toast('Répertoire importé dans ce navigateur.');}catch(err){toast(err.message);}finally{e.target.value='';}};
$('print').onclick=()=>{const q=$('search').value,f=$('filter').value;$('search').value='';$('filter').value='';render();window.print();$('search').value=q;$('filter').value=f;render();};
async function request(method='GET',data){const response=await fetch('/api/panel',{method,headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});let result;try{result=await response.json();}catch{throw Error('Réponse du serveur indisponible.');}if(!response.ok)throw Error(result.error||'Échec de la synchronisation.');return result;}
async function save(){if(busy)return;busy=true;syncLabel('Synchronisation…');try{const out=await request('PUT',{circuits,revision});revision=out.revision;dirty=false;persist();syncLabel();toast('Circuit synchronisé.');}catch(err){syncLabel('⚠ '+err.message);toast(err.message);}finally{busy=false;}}
$('connect').onclick=()=>{if(connected){key='';connected=false;syncLabel();toast('Déconnecté. La copie locale est conservée.');return;}$('loginError').textContent='';$('login').showModal();};
$('loginClose').onclick=()=>$('login').close();
$('loginForm').onsubmit=async e=>{e.preventDefault();if(busy)return;key=e.target.elements.key.value;busy=true;const button=e.target.querySelector('.primary');button.disabled=true;try{const data=await request();validate(data.circuits);if(dirty&&!confirm('Charger la version de la base et remplacer votre brouillon local ? Annulez pour exporter votre brouillon d’abord.')){key='';return;}circuits=data.circuits;revision=data.revision;connected=true;dirty=false;persist();render();$('login').close();e.target.reset();toast('Panneau chargé.');}catch(err){key='';$('loginError').textContent=err.message;}finally{busy=false;button.disabled=false;}};
render();
