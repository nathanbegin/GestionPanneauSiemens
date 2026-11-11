// Démonstration sans inscription : un faux serveur en mémoire (rien n'est envoyé ni enregistré).
import {DEMO_SITE,DEMO_PANEL} from './demo-data.js';
import {stats,validate,normalize,cleanPanelMeta,panelTitle} from '../model.js';

export const DEMO_USER={id:'demo',name:'Visiteur',email:'demo@exemple.ca',profile:{accountType:'pro',lang:'fr'},isAdmin:false,hasPassword:true};
const PLAN={id:'demo',name:'Démonstration',audience:'electricien',features:{planning:true,branding:false,team:false},panelLimit:null,siteLimit:null,quotaType:'active'};
const fail=(status,message)=>Object.assign(new Error(message),{status});

export function createDemoApi(){
 let panel=structuredClone(DEMO_PANEL);
 const summary=()=>({id:panel.id,name:panel.name,tag:panel.tag,kind:panel.kind,location:panel.location,positions:panel.positions,details:panel.details,stats:stats(panel.circuits),updatedAt:new Date().toISOString(),progress:stats(panel.circuits).progress});
 const siteOut=()=>({...DEMO_SITE,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 return async function demoApi(path,{method='GET',body}={}){
  const u=new URL(path,'http://demo.local'),p=u.pathname,q=u.searchParams;
  if(p==='/api/auth')return {user:DEMO_USER,features:{}};
  if(p==='/api/billing')return {plan:PLAN,live:true,subscription:null,limit:null,used:1,activePanels:1,sites:1,credits:0,canCreatePanel:true,canCreateSite:true,seats:1,teamSize:1,creditPacks:[],promo:false};
  if(p==='/api/sites'&&q.get('search')!==null)return {results:[]};
  if(p==='/api/sites'&&!q.get('id'))return {sites:[{...siteOut(),panelCount:1,panels:[summary()]}]};
  if(p==='/api/sites'&&q.get('id'))return {site:siteOut(),panels:[summary()],access:'owner'};
  if(p==='/api/panels'&&q.get('id')){
   if(method==='GET'&&q.get('action')==='history')return {versions:[]};
   if(method==='GET')return {panel,site:siteOut(),siblings:[{id:panel.id,name:panel.name,tag:panel.tag,kind:panel.kind,fedFrom:'',fedFromCircuit:''}],children:[],access:'owner',sharedBy:null};
   if(method==='PUT'){
    if(body.circuits!==undefined)panel={...panel,circuits:validate(normalize(body.circuits,{positions:panel.positions}),{positions:panel.positions})};
    if(body.meta){const m=cleanPanelMeta(body.meta);panel={...panel,name:m.name,tag:m.tag,kind:m.kind,location:m.location,details:m.details};}
    panel.revision++;return {panel};
   }
  }
  throw fail(404,'Cette fonction n’est pas disponible dans la démonstration. Créez un compte gratuit pour l’essayer.');
 };
}
