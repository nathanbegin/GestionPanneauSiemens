// Console d'administration (réservée aux courriels de ADMIN_EMAILS).
import {h,toast,money,fmtDate,fmtRelative,field,select,dialog,confirmDialog} from './dom.js';
import {api} from './api.js';

const STATUS={active:'Actif',trialing:'Essai',past_due:'Paiement en retard',canceled:'Annulé',comp:'Offert',gratuit:'Gratuit'};
const tabs=[['tableau','Tableau de bord'],['abonnes','Abonnés'],['forfaits','Forfaits et prix'],['suggestions','Suggestions'],['ia','Intelligence artificielle'],['journal','Journal']];
const centsInput=(name,cents)=>h('input',{name,type:'number',step:'0.01',min:0,value:cents==null?'':(cents/100).toFixed(2),inputmode:'decimal'});
const toCents=v=>v===''||v==null?null:Math.round(Number(String(v).replace(',','.'))*100);

export async function adminView({ctx,tab='tableau',id}){
 ctx.crumbs([['Mes sites','#/sites'],['Administration']]);
 const nav=h('div',{class:'tabs',role:'tablist'},tabs.map(([k,t])=>h('a',{href:'#/admin/'+k,class:'btn ghost',role:'tab','aria-selected':String(tab===k||(tab==='abonne'&&k==='abonnes'))},t)));
 let content;
 if(tab==='abonne')content=await userDetail(id);
 else if(tab==='abonnes')content=await users();
 else if(tab==='forfaits')content=await plans();
 else if(tab==='journal')content=await journal();
 else if(tab==='ia')content=await aiSettings();
 else if(tab==='suggestions')content=await suggestions();
 else content=await overview();
 return h('div',{class:'container'},h('div',{class:'page-head'},h('div',{},h('div',{class:'eyebrow',text:'Console'}),h('h1',{text:'Administration'}))),nav,content);
}

async function overview(){
 const o=await api('/api/admin?action=overview');
 const stat=(v,l)=>h('div',{class:'card stat'},h('b',{text:v}),h('span',{text:l}));
 return h('div',{},
  h('p',{},'Paiement Stripe : ',h('span',{class:'mode'+(o.stripe==='live'?' live':''),text:{off:'non configuré',test:'mode test',live:'production'}[o.stripe]}),' · Webhook : ',o.webhook?'✓':'✗ non configuré',' · Taxes automatiques : ',o.tax?'✓':'✗',o.stripe!=='off'?h('span',{class:'small muted',text:` · API ${o.stripeVersion} · ${o.stripeKey==='restricted'?'clé restreinte ✓':'clé secrète (préférez une clé restreinte rk_…)'}`}):null),
  h('div',{class:'stats'},stat(money(o.mrr),'Revenu mensuel récurrent (estimé)'),stat(o.paying,'Abonnés payants'),stat(o.users,'Comptes'),stat(o.new30,'Nouveaux comptes (30 j)'),stat(o.canceled30,'Annulations (30 j)'),stat(o.panels,'Panneaux'),h('a',{class:'card stat link',href:'#/admin/suggestions'},h('b',{text:o.feedbackNew??0}),h('span',{text:'Suggestions nouvelles'})),stat(o.packPanels30,'Panneaux prépayés vendus (30 j)')),
  h('div',{class:'table-wrap'},h('table',{class:'data'},h('thead',{},h('tr',{},['Forfait','Statut','Périodicité','Abonnés'].map(t=>h('th',{text:t})))),
   h('tbody',{},o.byPlan.length?o.byPlan.map(r=>h('tr',{},h('td',{text:r.name}),h('td',{text:STATUS[r.status]||r.status}),h('td',{text:r.interval==='year'?'Annuel':r.interval==='month'?'Mensuel':'—'}),h('td',{text:r.n}))):h('tr',{},h('td',{colspan:4,class:'muted',text:'Aucun abonnement pour l’instant : tous les comptes sont au forfait gratuit.'}))))));
}

async function users(){
 const box=h('div');
 const form=h('form',{class:'inline-form'},field('Recherche',h('input',{name:'q',placeholder:'Courriel ou nom'})),field('Forfait',h('input',{name:'plan',placeholder:'ex. gratuit'})),
  field('Statut',select('status',[['','Tous'],['gratuit','Gratuit'],['active','Actif'],['trialing','Essai'],['past_due','En retard'],['comp','Offert'],['canceled','Annulé']])),h('button',{type:'submit',class:'primary'},'Filtrer'));
 const load=async()=>{
  const p=new URLSearchParams(new FormData(form));
  const {users}=await api('/api/admin?action=users&'+p);
  box.replaceChildren(h('div',{class:'table-wrap'},h('table',{class:'data'},h('thead',{},h('tr',{},['Nom','Courriel','Forfait','Statut','Panneaux','Sites','Inscrit'].map(t=>h('th',{text:t})))),
   h('tbody',{},users.map(u=>h('tr',{class:'click',onclick:()=>{location.hash='#/admin/abonne/'+u.id;}},h('td',{text:u.name}),h('td',{text:u.email}),h('td',{text:u.plan_id||'gratuit'}),h('td',{text:(STATUS[u.status]||'Gratuit')+(u.cancel_at_period_end?' (fin programmée)':'')}),h('td',{text:u.panels}),h('td',{text:u.sites}),h('td',{text:fmtDate(u.created_at)})))))),users.length===50?h('p',{class:'small muted',text:'50 premiers résultats : précisez la recherche.'}):'');
 };
 form.addEventListener('submit',e=>{e.preventDefault();load().catch(x=>toast(x.message));});
 await load();
 return h('div',{class:'stack'},form,box);
}

async function userDetail(id){
 const [d,catalog]=await Promise.all([api('/api/admin?action=user&id='+encodeURIComponent(id)),api('/api/admin?action=plans')]);
 const u=d.user,e=d.entitlement,s=e.subscription;
 const stripeSub=s?.hasStripe&&['active','trialing','past_due'].includes(s.status);
 const act=async(action,body,msg)=>{try{const out=await api('/api/admin?action='+action,{method:'POST',body:{userId:u.id,...body}});toast(msg||'Fait.');window.dispatchEvent(new HashChangeEvent('hashchange'));return out;}catch(x){toast(x.message,7000);return false;}};
 const planOpts=catalog.plans.map(p=>[p.id,p.name]);
 const formCard=(title,fields,label,onSubmit,hint)=>{const f=h('form',{class:'stack'},hint&&h('p',{class:'small muted',text:hint}),h('div',{class:'inline-form'},fields,h('button',{type:'submit',text:label})));f.addEventListener('submit',ev=>{ev.preventDefault();onSubmit(Object.fromEntries(new FormData(f)));});return h('div',{class:'card'},h('h3',{text:title}),f);};
 const cards=[
  h('div',{class:'card'},h('h3',{text:'Droits actuels'}),h('dl',{class:'facts'},
   h('dt',{text:'Forfait'}),h('dd',{text:e.plan.name}),h('dt',{text:'Statut'}),h('dd',{text:s?(STATUS[s.status]||s.status)+(s.source==='admin'?' (attribué manuellement)':''):'Gratuit'}),
   h('dt',{text:'Utilisation'}),h('dd',{text:`${e.used} / ${e.limit??'∞'}${s?.limitOverride!=null?' (limite personnalisée)':''}`}),h('dt',{text:'Crédits'}),h('dd',{text:String(e.credits)}),
   h('dt',{text:'Période'}),h('dd',{text:s?.currentPeriodEnd?'jusqu’au '+fmtDate(s.currentPeriodEnd):'—'}),h('dt',{text:'Client Stripe'}),h('dd',{text:u.stripeCustomer||'—'}),s?.note&&[h('dt',{text:'Note'}),h('dd',{text:s.note})])),
  stripeSub
   ?formCard('Changer le forfait (Stripe)',[field('Forfait',select('planId',planOpts,s.planId)),field('Périodicité',select('interval',[['month','Mensuel'],['year','Annuel']],s.interval||'month')),field('Prorata',select('prorate',[['1','Oui'],['0','Non']]))],'Appliquer',v=>act('stripe-change',{planId:v.planId,interval:v.interval,prorate:v.prorate==='1'},'Forfait Stripe modifié.'),'Modifie l’abonnement payant; la différence apparaît sur la prochaine facture.')
   :formCard('Attribuer un forfait (offert)',[field('Forfait',select('planId',planOpts,s?.planId||'proprietaire')),field('Jusqu’au',h('input',{name:'until',type:'date'}),{hint:'Vide = sans fin'}),field('Note',h('input',{name:'note',maxlength:300,placeholder:'Raison'}))],'Attribuer',v=>act('set-plan',v,'Forfait attribué.'),'Sans paiement : partenaire, compensation, test…'),
  formCard('Limite personnalisée',[field('Panneaux',h('input',{name:'limit',type:'number',min:0,value:s?.limitOverride??'',placeholder:'Vide = limite du forfait'}))],'Enregistrer',v=>act('override',{limit:v.limit===''?null:Number(v.limit)},'Limite enregistrée.')),
  formCard('Offrir des panneaux',[field('Nombre',h('input',{name:'panels',type:'number',min:1,value:5})),field('Validité (jours)',h('input',{name:'days',type:'number',min:1,value:365})),field('Note',h('input',{name:'note'}))],'Offrir',v=>act('credits',{panels:Number(v.panels),days:Number(v.days),note:v.note},'Crédits ajoutés.')),
  h('div',{class:'card'},h('h3',{text:'Annulation'}),h('div',{class:'page-actions'},
   stripeSub&&!s.cancelAtPeriodEnd&&h('button',{type:'button',onclick:async()=>{if(await confirmDialog('Annuler à la fin de la période en cours ?'))act('cancel',{immediate:false},'Annulation programmée.');}},'À la fin de la période'),
   stripeSub&&s.cancelAtPeriodEnd&&h('button',{type:'button',onclick:()=>act('resume',{},'Abonnement réactivé.')},'Réactiver'),
   s&&s.status!=='canceled'&&h('button',{type:'button',class:'danger',onclick:async()=>{if(await confirmDialog('Annuler immédiatement ? Le compte revient au forfait gratuit.',{danger:true,confirm:'Annuler maintenant'}))act('cancel',{immediate:true},'Abonnement annulé.');}},'Immédiatement')),
   !s&&h('p',{class:'small muted',text:'Aucun abonnement.'})),
 ];
 const charges=h('div',{class:'card side-card'},h('h3',{text:'Paiements et remboursements'}),
  !d.charges.length?h('p',{class:'small muted',text:u.stripeCustomer?'Aucun paiement.':'Aucun paiement Stripe pour ce compte.'})
  :d.charges[0].error?h('p',{class:'error',text:d.charges[0].error})
  :h('div',{class:'table-wrap'},h('table',{class:'data'},h('thead',{},h('tr',{},['Date','Description','Montant','Remboursé',''].map(t=>h('th',{text:t})))),h('tbody',{},d.charges.map(c=>h('tr',{},h('td',{text:fmtDate(c.created)}),h('td',{text:c.description||'—'}),h('td',{text:money(c.amount)}),h('td',{text:c.refunded?money(c.refunded):'—'}),
   h('td',{},c.refunded<c.amount&&c.status==='succeeded'&&h('button',{type:'button',class:'sm',onclick:()=>refund(c)},'Rembourser'),c.receipt&&h('a',{href:c.receipt,target:'_blank',class:'btn sm ghost'},'Reçu'))))))));
 function refund(c){
  const max=c.amount-c.refunded;
  const dl=dialog({title:'Rembourser',eyebrow:u.email,form:true,body:[h('p',{text:`Paiement du ${fmtDate(c.created)} : ${money(c.amount)} (remboursable : ${money(max)}).`}),field('Montant ($)',centsInput('amount',max),{hint:'Laissez le montant maximal pour un remboursement complet.'}),field('Note interne',h('input',{name:'note'}))],actions:[{label:'Annuler',kind:'ghost'},{label:'Rembourser',kind:'danger',submit:true}]});
  dl.form.addEventListener('submit',async ev=>{ev.preventDefault();const f=Object.fromEntries(new FormData(dl.form));const amount=toCents(f.amount);if(!(amount>0&&amount<=max))return toast('Montant invalide.');
   const out=await act('refund',{charge:c.id,amount:amount===max?null:amount,note:f.note});if(out)dl.close();});
 }
 return h('div',{class:'stack'},
  h('div',{class:'card side-card'},h('h2',{text:u.name}),h('p',{class:'muted',text:`${u.email} · ${u.profile?.accountType==='pro'?'Électricien / pro':'Particulier'} · inscrit le ${fmtDate(u.createdAt)}`}),
   h('p',{class:'small',text:d.sites.map(x=>`${x.name} (${x.panels})`).join(' · ')||'Aucun site'})),
  h('div',{class:'admin-grid'},cards),charges,
  h('div',{class:'card side-card'},h('h3',{text:'Historique des actions'}),d.log.length?h('ul',{class:'small'},d.log.map(l=>h('li',{text:`${fmtRelative(l.at)} · ${l.admin_email} · ${l.action} ${JSON.stringify(l.details)}`}))):h('p',{class:'small muted',text:'Aucune action.'})));
}

async function plans(){
 const d=await api('/api/admin?action=plans');
 const edit=(p={})=>{
  const isNew=!p.id;
  const dl=dialog({title:isNew?'Nouveau forfait':'Modifier « '+p.name+' »',form:true,wide:true,body:[h('div',{class:'fields'},
   field('Identifiant',h('input',{name:'id',value:p.id||'',readOnly:!isNew,required:true,placeholder:'ex. proprietaire-plus'}),{hint:'Minuscules et tirets; non modifiable.'}),
   field('Nom affiché',h('input',{name:'name',value:p.name||'',required:true})),
   field('Public cible',select('audience',Object.entries(d.audiences),p.audience||'proprietaire')),
   field('Ordre d’affichage',h('input',{name:'sort',type:'number',value:p.sort??50})),
   field('Description',h('input',{name:'description',value:p.description||'',maxlength:300}),{full:true}),
   field('Prix mensuel ($)',centsInput('priceMonth',p.priceMonth),{hint:'Vide = non offert au mois'}),
   field('Prix annuel ($)',centsInput('priceYear',p.priceYear),{hint:'Vide = non offert à l’année'}),
   field('Type de quota',select('quotaType',Object.entries(d.quotaTypes),p.quotaType||'active')),
   field('Limite de panneaux',h('input',{name:'panelLimit',type:'number',min:0,value:p.panelLimit??''}),{hint:'Vide = illimité'}),
   field('Limite de sites',h('input',{name:'siteLimit',type:'number',min:0,value:p.siteLimit??''}),{hint:'Vide = illimité'}),
   field('Utilisateurs',h('input',{name:'seats',type:'number',min:1,value:p.seats||1})),
   field('Jours d’essai gratuit',h('input',{name:'trialDays',type:'number',min:0,max:90,value:p.trialDays||0})),
   h('div',{class:'full stack'},...[['planning','Planification avancée'],['branding','Rapports à l’image de l’entreprise'],['team','Équipe'],['qr','Codes QR']].map(([k,t])=>h('label',{class:'check'},h('input',{type:'checkbox',name:'f_'+k,checked:!!p.features?.[k]}),t)),
    h('label',{class:'check'},h('input',{type:'checkbox',name:'active',checked:p.active!==false}),'Actif (peut être souscrit)'),h('label',{class:'check'},h('input',{type:'checkbox',name:'public',checked:p.public!==false}),'Visible sur la page Tarifs')),
   !isNew&&p.subscribers>0&&h('p',{class:'notice full',text:`${p.subscribers} abonné(s) actif(s). Un changement de prix ne s’applique qu’aux nouveaux abonnements; les limites s’appliquent immédiatement à tous.`}))],
   actions:[{label:'Annuler',kind:'ghost'},{label:'Enregistrer',kind:'primary',submit:true}]});
  dl.form.addEventListener('submit',async ev=>{ev.preventDefault();const f=Object.fromEntries(new FormData(dl.form));const num=v=>v===''?null:Number(v);
   try{const out=await api('/api/admin?action=plan',{method:'POST',body:{id:f.id,name:f.name,audience:f.audience,description:f.description,sort:Number(f.sort||0),priceMonth:toCents(f.priceMonth),priceYear:toCents(f.priceYear),quotaType:f.quotaType,panelLimit:num(f.panelLimit),siteLimit:num(f.siteLimit),seats:Number(f.seats||1),trialDays:Number(f.trialDays||0),active:!!f.active,public:!!f.public,features:{planning:!!f.f_planning,branding:!!f.f_branding,team:!!f.f_team,qr:!!f.f_qr}}});
    dl.close();toast(out.warning||out.note||'Forfait enregistré.',7000);window.dispatchEvent(new HashChangeEvent('hashchange'));}catch(x){toast(x.message,7000);}});
 };
 const editPack=(k={})=>{
  const dl=dialog({title:k.id?'Modifier le forfait de panneaux':'Nouveau forfait de panneaux',form:true,body:[h('div',{class:'fields'},
   field('Identifiant',h('input',{name:'id',value:k.id||'',readOnly:!!k.id,placeholder:'ex. pack-25'})),field('Nom',h('input',{name:'name',value:k.name||''})),
   field('Panneaux',h('input',{name:'panels',type:'number',min:1,value:k.panels||10})),field('Prix ($)',centsInput('price',k.price??2900)),
   field('Validité (jours)',h('input',{name:'validityDays',type:'number',min:1,value:k.validityDays||365})),h('label',{class:'check'},h('input',{type:'checkbox',name:'active',checked:k.active!==false}),'Actif'))],
   actions:[{label:'Annuler',kind:'ghost'},{label:'Enregistrer',kind:'primary',submit:true}]});
  dl.form.addEventListener('submit',async ev=>{ev.preventDefault();const f=Object.fromEntries(new FormData(dl.form));
   try{const out=await api('/api/admin?action=pack',{method:'POST',body:{id:f.id,name:f.name,panels:Number(f.panels),price:toCents(f.price),validityDays:Number(f.validityDays),active:!!f.active}});dl.close();toast(out.warning||'Enregistré.');window.dispatchEvent(new HashChangeEvent('hashchange'));}catch(x){toast(x.message,7000);}});
 };
 const qt={active:'actifs',monthly:'/ mois',yearly:'/ an'};
 return h('div',{class:'stack'},
  h('div',{class:'page-actions'},h('button',{type:'button',class:'primary',onclick:()=>edit()},'+ Nouveau forfait'),h('button',{type:'button',onclick:()=>editPack()},'+ Forfait de panneaux')),
  h('div',{class:'table-wrap'},h('table',{class:'data'},h('thead',{},h('tr',{},['Forfait','Public','Mensuel','Annuel','Panneaux','Sites','Abonnés','État','Stripe'].map(t=>h('th',{text:t})))),
   h('tbody',{},d.plans.map(p=>h('tr',{class:'click',onclick:()=>edit(p)},h('td',{},h('b',{text:p.name}),h('div',{class:'small muted',text:p.id})),h('td',{text:d.audiences[p.audience]}),h('td',{text:money(p.priceMonth)}),h('td',{text:money(p.priceYear)}),
    h('td',{text:p.panelLimit==null?'∞':`${p.panelLimit} ${qt[p.quotaType]}`}),h('td',{text:p.siteLimit??'∞'}),h('td',{text:p.subscribers}),h('td',{text:(p.active?'Actif':'Inactif')+(p.public?'':' · masqué')}),h('td',{class:'small',text:p.stripePriceMonth||p.stripePriceYear?'✓ synchronisé':'—'})))))),
  h('h2',{class:'mt',text:'Forfaits de panneaux (sans abonnement)'}),
  h('div',{class:'table-wrap'},h('table',{class:'data'},h('thead',{},h('tr',{},['Nom','Panneaux','Prix','Validité','État'].map(t=>h('th',{text:t})))),
   h('tbody',{},d.packs.map(k=>h('tr',{class:'click',onclick:()=>editPack(k)},h('td',{text:k.name}),h('td',{text:k.panels}),h('td',{text:money(k.price)}),h('td',{text:k.validityDays+' jours'}),h('td',{text:k.active?'Actif':'Inactif'})))))),
  h('p',{class:'small muted',text:'Stripe : à l’enregistrement, le produit et les prix sont créés ou mis à jour automatiquement dès que la clé Stripe est configurée. Un prix Stripe ne se modifie pas : un nouveau prix est créé et l’ancien est archivé, les abonnés existants le conservent.'}));
}

async function journal(){
 const {log}=await api('/api/admin?action=audit');
 return h('div',{class:'table-wrap'},h('table',{class:'data'},h('thead',{},h('tr',{},['Date','Administrateur','Action','Cible','Détails'].map(t=>h('th',{text:t})))),
  h('tbody',{},log.length?log.map(l=>h('tr',{},h('td',{text:new Date(l.at).toLocaleString('fr-CA')}),h('td',{text:l.admin_email}),h('td',{text:l.action}),h('td',{text:l.target_email||l.target}),h('td',{class:'small',text:JSON.stringify(l.details).slice(0,200)}))):h('tr',{},h('td',{colspan:5,class:'muted',text:'Aucune action.'})))));
}

// ---------- Intelligence artificielle : choix et ordre des modèles ----------
const DETAIL_LABELS={high:'Élevé (recommandé)',original:'Original : pleine résolution, pour les très petites étiquettes',auto:'Automatique',low:'Faible : moins cher, lecture des calibres moins fiable'};
async function aiSettings(){
 const box=h('div',{class:'stack'});
 const load=async()=>{const d=await api('/api/admin?action=ai');render(d);};
 function render(d){
  const known=new Map(d.catalog.map(m=>[m.id,m]));
  // Liste ordonnée : modèles actifs d'abord (dans l'ordre actuel), puis les autres modèles connus.
  let list=[...d.models.map(id=>({id,on:true})),...d.catalog.filter(m=>!d.models.includes(m.id)).map(m=>({id:m.id,on:false}))];
  const results=new Map();
  const rowsBox=h('div',{class:'ai-models'});
  const detail=select('detail',d.details.map(k=>[k,DETAIL_LABELS[k]||k]),d.detail);
  const err=h('p',{class:'error',role:'alert'});
  const price=m=>m&&m.input!=null?`${m.input} $ / ${m.output} $`:'—';
  const test=async id=>{results.set(id,{pending:true});draw();const r=await api('/api/admin?action=ai-test',{method:'POST',body:{model:id}}).catch(e=>({ok:false,message:e.message}));results.set(id,r);draw();};
  function draw(){
   let rank=0;
   rowsBox.replaceChildren(...list.map((it,i)=>{
    const m=known.get(it.id),r=results.get(it.id);
    const move=dir=>{const j=i+dir;if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];draw();};
    const cb=h('input',{type:'checkbox',checked:it.on,'aria-label':'Utiliser '+it.id,onchange:e=>{it.on=e.target.checked;draw();}});
    return h('div',{class:'ai-model'+(it.on?'':' off')},
     h('span',{class:'ai-rank',text:it.on?String(++rank):'—'}),cb,
     h('div',{class:'ai-model-name'},h('b',{text:m?.label||it.id}),h('code',{text:it.id}),m?.note&&h('span',{class:'small muted',text:m.note}),d.denied.includes(it.id)&&h('span',{class:'badge warn',text:'refusé récemment'})),
     h('span',{class:'small',title:'Prix par million de jetons (entrée / sortie, $ US)',text:price(m)}),
     h('span',{class:'ai-move'},h('button',{type:'button',class:'ghost sm','aria-label':'Monter',disabled:i===0,onclick:()=>move(-1)},'▲'),h('button',{type:'button',class:'ghost sm','aria-label':'Descendre',disabled:i===list.length-1,onclick:()=>move(1)},'▼')),
     h('button',{type:'button',class:'sm',disabled:!d.configured||r?.pending,onclick:()=>test(it.id)},r?.pending?'Test…':'Tester l’accès'),
     h('span',{class:'ai-test '+(r?.pending?'':r?(r.ok?'ok':'ko'):''),text:r&&!r.pending?(r.ok?`✓ ${r.message}${r.ms?' ('+r.ms+' ms)':''}`:'✗ '+r.message):''}));
   }));
  }
  const custom=h('input',{placeholder:'Autre identifiant de modèle (ex. gpt-6.2-terra)',maxlength:64});
  const addCustom=()=>{const id=custom.value.trim();if(!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(id))return toast('Identifiant invalide.');if(!list.some(x=>x.id===id))list.unshift({id,on:true});custom.value='';draw();};
  const save=async(models,det)=>{err.textContent='';try{await api('/api/admin?action=ai',{method:'POST',body:{models,detail:det}});toast('Réglages de l’IA enregistrés : ils s’appliquent dès la prochaine analyse.');await load();}catch(e){err.textContent=e.message;}};
  const srcText={console:'réglage de cette console',variable:`variable Vercel OPENAI_MODEL (${d.envModel})`,defaut:'valeurs par défaut de l’application'}[d.source];
  const usage=d.usage.map(u=>{const m=known.get(u.model);const cost=m&&m.input!=null?(u.input*m.input+u.output*m.output)/1e6:null;return h('tr',{},h('td',{text:u.model}),h('td',{text:u.ok}),h('td',{text:u.failed}),h('td',{text:u.input.toLocaleString('fr-CA')}),h('td',{text:u.output.toLocaleString('fr-CA')}),h('td',{text:cost==null?'—':cost.toLocaleString('fr-CA',{style:'currency',currency:'USD'})}));});
  box.replaceChildren(
   h('div',{class:'card form-card'},
    h('h2',{text:'Lecture de panneaux par IA'}),
    h('p',{},'Clé OpenAI : ',d.configured?h('b',{text:'✓ configurée'}):h('b',{class:'error',text:'✗ OPENAI_API_KEY manquante dans Vercel'}),' · Modèles utilisés selon : ',h('b',{text:srcText})),
    h('p',{class:'small muted',text:'Les modèles cochés sont essayés dans l’ordre. Si votre projet OpenAI n’a pas accès à un modèle, le suivant prend le relais, et le modèle refusé est réessayé après 10 minutes (délai d’activation chez OpenAI). Le réglage de cette console a priorité sur la variable OPENAI_MODEL.'}),
    rowsBox,
    h('div',{class:'inline-form'},custom,h('button',{type:'button',onclick:addCustom},'Ajouter')),
    h('div',{class:'fields'},field('Niveau de détail des photos',detail,{hint:'« Original » lit mieux les petites étiquettes mais consomme plus de jetons.'})),
    err,
    h('div',{class:'form-actions'},
     h('button',{type:'button',class:'ghost',onclick:async()=>{if(await confirmDialog('Revenir aux valeurs par défaut (ou à la variable OPENAI_MODEL si elle est définie) ?'))save([],'');}},'Valeurs par défaut'),
     h('button',{type:'button',class:'primary',onclick:()=>{const models=list.filter(x=>x.on).map(x=>x.id);if(!models.length)return toast('Cochez au moins un modèle.');save(models,detail.value);}},'Enregistrer'))),
   h('div',{class:'card form-card'},h('h2',{text:'Utilisation (30 derniers jours)'}),
    h('div',{class:'table-wrap'},h('table',{class:'data'},h('thead',{},h('tr',{},['Modèle','Analyses réussies','Échecs','Jetons en entrée','Jetons en sortie','Coût estimé'].map(t=>h('th',{text:t})))),
     h('tbody',{},usage.length?usage:[h('tr',{},h('td',{colspan:6,class:'muted',text:'Aucune analyse pour l’instant.'}))]))),
    h('p',{class:'small muted',text:'Coût estimé à partir des prix publics d’OpenAI ; la facture OpenAI fait foi.'})));
  draw();
 }
 await load();
 return box;
}

// ---------- Suggestions d'amélioration envoyées par les utilisateurs ----------
async function suggestions(){
 const box=h('div',{class:'stack'});
 let filter='nouveau';
 const load=async()=>{const d=await api('/api/admin?action=feedback&status='+encodeURIComponent(filter));render(d);};
 function render(d){
  const total=Object.values(d.counts).reduce((a,b)=>a+b,0);
  const tabsBar=h('div',{class:'gd-chips'},
   h('button',{type:'button',class:'gd-chip'+(filter===''?' on':''),onclick:()=>{filter='';load();}},`Toutes (${total})`),
   ...Object.entries(d.statuses).map(([k,l])=>h('button',{type:'button',class:'gd-chip'+(filter===k?' on':''),onclick:()=>{filter=k;load();}},`${l} (${d.counts[k]||0})`)));
  const item=f=>{
   const status=select('status',Object.entries(d.statuses),f.status);
   const note=h('textarea',{rows:2,maxlength:2000,placeholder:'Note interne (non visible par l’utilisateur)',value:f.admin_note||''});
   note.value=f.admin_note||'';
   const saveBtn=h('button',{type:'button',class:'sm primary',onclick:async()=>{saveBtn.disabled=true;try{await api('/api/admin?action=feedback-update',{method:'POST',body:{id:f.id,status:status.value,note:note.value}});toast('Suggestion mise à jour.');await load();}catch(e){toast(e.message);saveBtn.disabled=false;}}},'Enregistrer');
   return h('article',{class:'card fb-item fb-'+f.status},
    h('div',{class:'fb-head'},h('span',{class:'badge '+(f.category==='Problème'?'warn':''),text:f.category}),
     h('b',{},f.user_id?h('a',{href:'#/admin/abonne/'+f.user_id,text:f.name||f.email}):(f.name||f.email||'Compte supprimé')),
     h('span',{class:'small muted',text:[f.email,new Date(f.created_at).toLocaleString('fr-CA'),f.client!=='web'?f.client:'',f.app_version&&'v'+f.app_version].filter(Boolean).join(' · ')})),
    h('p',{class:'fb-msg',text:f.message}),
    f.page?h('p',{class:'small muted',text:'Page : '+f.page}):null,
    h('div',{class:'fb-actions'},status,note,saveBtn));
  };
  box.replaceChildren(
   h('div',{class:'card form-card'},h('h2',{text:'Suggestions d’amélioration'}),
    h('p',{class:'small muted',text:'Envoyées par les utilisateurs depuis le menu de leur compte (« 💡 Suggérer une amélioration »). Le statut et la note interne ne sont visibles que par l’administration.'}),tabsBar),
   ...(d.items.length?d.items.map(item):[h('p',{class:'card muted',text:'Aucune suggestion dans cette catégorie.'})]));
 }
 await load();
 return box;
}
