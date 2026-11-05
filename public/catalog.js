// Catalogue partagé (navigateur, serveur, mobile) : charges typiques, bornes de recharge,
// modèles de panneaux, familles de disjoncteurs et calibres de fils.
// ⚠ Valeurs TYPIQUES et INDICATIVES : la plaque signalétique de l'appareil, la fiche du fabricant
// et le Code de construction du Québec, chapitre V (CSA C22.1) ont toujours préséance.

// Catégories utilisées pour le calcul de charge d'un logement (règle 8-200).
export const LOAD_CATEGORIES={
 basic:'Incluse dans la charge de base (≤ 1500 W)',
 heating:'Chauffage par plinthes / convecteurs',
 heating100:'Fournaise, conduit ou accumulateur (100 %)',
 cooling:'Climatisation / thermopompe',
 range:'Cuisinière',
 water100:'Chauffe-eau instantané, piscine, spa (100 %)',
 ev:'Borne de recharge (100 %)',
 other:'Autre charge > 1500 W',
};
export const VOLTAGES=[120,208,240,347,600];

// g = groupe d'affichage ; w = watts typiques ; v = tension ; cont = charge continue ; b = disjoncteur typique (A)
export const LOAD_LIBRARY=[
 // Bornes de recharge
 {id:'ev-l1',g:'Borne de recharge',name:'Borne niveau 1 — prise 120 V (12 A)',w:1440,v:120,cat:'ev',cont:true,b:15,note:'Câble fourni avec le véhicule, circuit dédié recommandé. Environ 5 à 8 km d’autonomie par heure.'},
 {id:'ev-l2-16',g:'Borne de recharge',name:'Borne niveau 2 — 16 A (3,8 kW)',w:3840,v:240,cat:'ev',cont:true,b:20},
 {id:'ev-l2-24',g:'Borne de recharge',name:'Borne niveau 2 — 24 A (5,8 kW)',w:5760,v:240,cat:'ev',cont:true,b:30},
 {id:'ev-l2-30',g:'Borne de recharge',name:'Borne niveau 2 — 30 A (7,2 kW)',w:7200,v:240,cat:'ev',cont:true,b:40,note:'Puissance la plus répandue en résidentiel au Québec.'},
 {id:'ev-l2-32',g:'Borne de recharge',name:'Borne niveau 2 — 32 A (7,7 kW)',w:7680,v:240,cat:'ev',cont:true,b:40},
 {id:'ev-l2-40',g:'Borne de recharge',name:'Borne niveau 2 — 40 A (9,6 kW)',w:9600,v:240,cat:'ev',cont:true,b:50},
 {id:'ev-l2-48',g:'Borne de recharge',name:'Borne niveau 2 — 48 A (11,5 kW)',w:11520,v:240,cat:'ev',cont:true,b:60},
 // Chauffage et climatisation
 {id:'bb-1000',g:'Chauffage et climatisation',name:'Plinthe électrique 1000 W',w:1000,v:240,cat:'heating',cont:true,b:15},
 {id:'bb-1500',g:'Chauffage et climatisation',name:'Plinthe électrique 1500 W',w:1500,v:240,cat:'heating',cont:true,b:15},
 {id:'bb-2000',g:'Chauffage et climatisation',name:'Plinthe électrique 2000 W',w:2000,v:240,cat:'heating',cont:true,b:15},
 {id:'conv-2500',g:'Chauffage et climatisation',name:'Convecteur / aérotherme 2500 W',w:2500,v:240,cat:'heating',cont:true,b:20},
 {id:'floor-heat',g:'Chauffage et climatisation',name:'Plancher chauffant salle de bain (500 W)',w:500,v:120,cat:'heating',cont:true,b:15},
 {id:'furnace-10',g:'Chauffage et climatisation',name:'Fournaise électrique 10 kW',w:10000,v:240,cat:'heating100',cont:true,b:60},
 {id:'furnace-15',g:'Chauffage et climatisation',name:'Fournaise électrique 15 kW',w:15000,v:240,cat:'heating100',cont:true,b:80,note:'Les fournaises de 20 kW et plus sont souvent alimentées par deux circuits.'},
 {id:'hp-2t',g:'Chauffage et climatisation',name:'Thermopompe centrale 2 tonnes (typique)',w:3000,v:240,cat:'cooling',cont:true,b:20,note:'Utilisez le MCA (fil) et le MOP (disjoncteur max.) de la plaque, colonne 240 V.'},
 {id:'hp-3t',g:'Chauffage et climatisation',name:'Thermopompe centrale 3 tonnes (typique)',w:4200,v:240,cat:'cooling',cont:true,b:25,note:'Utilisez le MCA et le MOP de la plaque signalétique.'},
 {id:'hp-4t',g:'Chauffage et climatisation',name:'Thermopompe centrale 4 tonnes (typique)',w:5500,v:240,cat:'cooling',cont:true,b:30,note:'Utilisez le MCA et le MOP de la plaque signalétique.'},
 {id:'minisplit-12',g:'Chauffage et climatisation',name:'Thermopompe murale 12 000 BTU',w:1300,v:240,cat:'cooling',cont:true,b:15},
 {id:'minisplit-24',g:'Chauffage et climatisation',name:'Thermopompe murale 24 000 BTU',w:2600,v:240,cat:'cooling',cont:true,b:20},
 {id:'ac-window',g:'Chauffage et climatisation',name:'Climatiseur de fenêtre 120 V',w:1200,v:120,cat:'cooling',cont:true,b:15},
 {id:'erv',g:'Chauffage et climatisation',name:'Échangeur d’air (VRC / VRE)',w:200,v:120,cat:'basic',cont:true,b:15},
 // Eau chaude
 {id:'wh-3000',g:'Eau chaude',name:'Chauffe-eau 40 gal — 3000 W',w:3000,v:240,cat:'other',cont:true,b:20},
 {id:'wh-4500',g:'Eau chaude',name:'Chauffe-eau 60 gal — 4500 W',w:4500,v:240,cat:'other',cont:true,b:30,note:'Disjoncteur de 25 ou 30 A selon le fabricant.'},
 {id:'wh-tankless-18',g:'Eau chaude',name:'Chauffe-eau instantané 18 kW',w:18000,v:240,cat:'water100',cont:true,b:null,note:'Généralement plusieurs circuits (ex. 2 × 40 A) : suivez la notice du fabricant.'},
 {id:'wh-hp',g:'Eau chaude',name:'Chauffe-eau thermodynamique (thermopompe)',w:1000,v:240,cat:'other',cont:true,b:15,note:'Certains modèles ont un élément d’appoint de 4500 W : utilisez la plaque.'},
 // Piscine et spa
 {id:'pool-hp',g:'Piscine et spa',name:'Thermopompe de piscine (typique 50 000 BTU)',w:5000,v:240,cat:'water100',cont:true,b:30,note:'Puissance absorbée bien inférieure à la puissance restituée (COP). Disjoncteur de 20 à 40 A selon le modèle.'},
 {id:'pool-heater',g:'Piscine et spa',name:'Chauffe-piscine électrique 11 kW',w:11000,v:240,cat:'water100',cont:true,b:60},
 {id:'pool-pump',g:'Piscine et spa',name:'Pompe de piscine 1,5 HP',w:1800,v:240,cat:'other',cont:true,b:15,note:'Protection DDFT requise.'},
 {id:'spa',g:'Piscine et spa',name:'Spa 240 V (typique)',w:9600,v:240,cat:'water100',cont:true,b:50,note:'Souvent 40 ou 50 A, avec sectionneur DDFT.'},
 // Cuisine et lavage
 {id:'range-12',g:'Cuisine et lavage',name:'Cuisinière jusqu’à 12 kW',w:12000,v:240,cat:'range',cont:false,b:40,note:'Pratique courante : 40 A grâce au facteur de demande des cuisinières.'},
 {id:'cooktop',g:'Cuisine et lavage',name:'Table de cuisson 7 kW',w:7000,v:240,cat:'range',cont:false,b:40},
 {id:'wall-oven',g:'Cuisine et lavage',name:'Four encastré 5 kW',w:5000,v:240,cat:'other',cont:false,b:30},
 {id:'dryer',g:'Cuisine et lavage',name:'Sécheuse 5,6 kW',w:5600,v:240,cat:'other',cont:false,b:30},
 {id:'washer',g:'Cuisine et lavage',name:'Laveuse',w:1000,v:120,cat:'basic',cont:false,b:20},
 {id:'dishwasher',g:'Cuisine et lavage',name:'Lave-vaisselle',w:1200,v:120,cat:'basic',cont:false,b:15},
 {id:'fridge',g:'Cuisine et lavage',name:'Réfrigérateur',w:700,v:120,cat:'basic',cont:false,b:15},
 {id:'freezer',g:'Cuisine et lavage',name:'Congélateur',w:500,v:120,cat:'basic',cont:false,b:15},
 {id:'microwave',g:'Cuisine et lavage',name:'Micro-ondes',w:1500,v:120,cat:'basic',cont:false,b:20},
 {id:'counter',g:'Cuisine et lavage',name:'Prises de comptoir (petits appareils)',w:1500,v:120,cat:'basic',cont:false,b:20},
 // Général
 {id:'lighting',g:'Usage général',name:'Éclairage d’une pièce',w:400,v:120,cat:'basic',cont:true,b:15},
 {id:'receptacles',g:'Usage général',name:'Prises générales d’une pièce',w:1000,v:120,cat:'basic',cont:false,b:15},
 {id:'garage-door',g:'Usage général',name:'Ouvre-porte de garage',w:600,v:120,cat:'basic',cont:false,b:15},
 {id:'sump',g:'Usage général',name:'Pompe de puisard 1/2 HP',w:800,v:120,cat:'basic',cont:false,b:15},
 {id:'well-pump',g:'Usage général',name:'Pompe de puits 1 HP',w:1500,v:240,cat:'basic',cont:false,b:15},
 {id:'workshop',g:'Usage général',name:'Atelier (compresseur, scie)',w:2400,v:240,cat:'other',cont:false,b:20},
];
export const loadById=id=>LOAD_LIBRARY.find(l=>l.id===id);

// Guide des bornes de recharge (affiché dans l'onglet Planification).
export const EV_GUIDE=[
 {level:'Niveau 1',supply:'120 V, prise ordinaire',power:'1,4 à 1,9 kW',breaker:'15 ou 20 A, circuit dédié recommandé',range:'≈ 5 à 8 km par heure',use:'Hybrides rechargeables, faible kilométrage quotidien.'},
 {level:'Niveau 2',supply:'208 / 240 V, circuit dédié',power:'3,8 à 11,5 kW (7,2 kW le plus courant)',breaker:'Borne 30 A → 40 A · borne 40 A → 50 A · borne 48 A → 60 A',range:'≈ 35 à 60 km par heure',use:'Recharge résidentielle et publique standard (connecteur J1772).'},
 {level:'Niveau 3 (rapide, courant continu)',supply:'Triphasé 480 V ou 600 V',power:'50 à 350 kW',breaker:'Entrée électrique commerciale dédiée (ex. 250 A à 600 V pour 175 kW)',range:'80 % de la batterie en 20 à 40 min',use:'Bornes publiques. Pas installable sur un panneau résidentiel.'},
];

// Règle générale : une charge continue ne doit pas dépasser 80 % du calibre du disjoncteur
// (disjoncteur ≥ 125 % de la charge), sauf appareil homologué pour 100 %.
export const CONTINUOUS_FACTOR=0.8;
export const STANDARD_BREAKERS=[15,20,25,30,35,40,45,50,60,70,80,90,100,125,150,175,200];
export const SERVICE_SIZES=[60,100,125,150,200,320,400];
// Conducteurs en cuivre, isolant 90 °C, courant admissible à 60 °C (type NMD90 en résidentiel).
export const WIRE_TABLE=[
 {gauge:'14 AWG',amps:15},{gauge:'12 AWG',amps:20},{gauge:'10 AWG',amps:30},{gauge:'8 AWG',amps:40},
 {gauge:'6 AWG',amps:55},{gauge:'4 AWG',amps:70},{gauge:'3 AWG',amps:85},{gauge:'2 AWG',amps:95},
 {gauge:'1 AWG',amps:110},{gauge:'1/0 AWG',amps:125},{gauge:'2/0 AWG',amps:145},{gauge:'3/0 AWG',amps:165},{gauge:'4/0 AWG',amps:195},
];
export const WIRE_TYPES=['NMD90 (Loomex)','AC90 (BX)','TECK90','Conduit + T90','Aluminium (artère)','Autre'];
export const wireAmps=g=>WIRE_TABLE.find(w=>w.gauge===g)?.amps??null;

// Familles de disjoncteurs. Les références sont INDICATIVES (motif usuel du fabricant) : à valider.
// {a} = calibre ; p1/p2 = unipolaire/bipolaire ; t = jumelé ; af = anti-arc ; gf = DDFT ; df = anti-arc + DDFT.
export const BREAKER_FAMILIES={
 'siemens-q':{brand:'Siemens',name:'Siemens type QP / Q',p1:'Q1{a}',p2:'Q2{a}',p3:null,t:'Q{a}{a}',af:'QA1{a}AFC',gf:null,df:null},
 'squared-qo':{brand:'Square D',name:'Square D QO',p1:'QO1{a}',p2:'QO2{a}',p3:'QO3{a}',t:'QOT{a}{a}',af:'QO1{a}CAFI',gf:'QO1{a}GFI',df:'QO1{a}DF'},
 'squared-hom':{brand:'Square D',name:'Square D Homeline',p1:'HOM1{a}',p2:'HOM2{a}',p3:null,t:'HOMT{a}{a}',af:'HOM1{a}CAFI',gf:'HOM1{a}GFI',df:'HOM1{a}DF'},
 'eaton-br':{brand:'Eaton',name:'Eaton type BR',p1:'BR1{a}',p2:'BR2{a}',p3:null,t:'BD{a}{a}',af:null,gf:null,df:null},
 'eaton-ch':{brand:'Eaton / Cutler-Hammer',name:'Cutler-Hammer type CH',p1:'CH1{a}',p2:'CH2{a}',p3:'CH3{a}',t:'CHT{a}{a}',af:null,gf:null,df:null},
 'leviton-lb':{brand:'Leviton',name:'Leviton LB',p1:'LB1{a}',p2:'LB2{a}',p3:null,t:null,af:'LB1{a}-AF',gf:null,df:'LB1{a}-DF'},
 'generic':{brand:'',name:'Générique / autre marque',p1:null,p2:null,p3:null,t:null,af:null,gf:null,df:null},
};
export function breakerRef(familyId,{poles=1,amps,protection='Standard',tandem=false}){
 const f=BREAKER_FAMILIES[familyId];if(!f||!amps)return '';
 let pattern=tandem?f.t:poles===3?f.p3:poles===2?f.p2:protection==='Anti-arc'?f.af:protection==='DDFT'?f.gf:protection==='DDFT + anti-arc'?f.df:f.p1;
 if(poles===1&&!tandem&&protection!=='Standard'&&!pattern)return '';
 return pattern?pattern.replaceAll('{a}',String(amps)):'';
}
// Disjoncteurs proposés dans le constructeur pour une famille.
export function breakerChoices(familyId){
 const f=BREAKER_FAMILIES[familyId]||BREAKER_FAMILIES.generic;
 const out=[];
 for(const a of [15,20,30])out.push({key:`1-${a}`,poles:1,amps:a,protection:'Standard',tandem:false});
 if(f.af||familyId==='generic')for(const a of [15,20])out.push({key:`1-${a}-af`,poles:1,amps:a,protection:'Anti-arc',tandem:false});
 if(f.gf||familyId==='generic')for(const a of [15,20])out.push({key:`1-${a}-gf`,poles:1,amps:a,protection:'DDFT',tandem:false});
 if(f.df||familyId==='generic')for(const a of [15,20])out.push({key:`1-${a}-df`,poles:1,amps:a,protection:'DDFT + anti-arc',tandem:false});
 if(f.t||familyId==='generic')out.push({key:'t-15',poles:1,amps:15,protection:'Standard',tandem:true},{key:'t-20',poles:1,amps:20,protection:'Standard',tandem:true});
 for(const a of [15,20,25,30,40,50,60,70,80,100])out.push({key:`2-${a}`,poles:2,amps:a,protection:'Standard',tandem:false});
 if(f.p3)for(const a of [20,30,40,60])out.push({key:`3-${a}`,poles:3,amps:a,protection:'Standard',tandem:false});
 return out.map(c=>({...c,ref:breakerRef(familyId,c),label:`${c.tandem?'Jumelé 2 × ':c.poles===3?'Tripolaire ':c.poles===2?'Bipolaire ':'Unipolaire '}${c.amps} A${c.protection!=='Standard'?' · '+c.protection:''}`}));
}

// Modèles de panneaux courants (configurations typiques). Vérifiez toujours l'étiquette du panneau :
// nombre de positions, circuits maximaux, positions acceptant des disjoncteurs jumelés.
const M=(id,brand,series,family,mainAmps,positions,{main=true,tandem=true,maxCircuits,note}={})=>({id,brand,series,family,mainAmps,positions,main,tandem,maxCircuits:maxCircuits??(tandem?positions*2:positions),note:note||''});
export const PANEL_MODELS=[
 M('siemens-eq-100-24','Siemens','EQ','siemens-q',100,24),
 M('siemens-eq-125-30','Siemens','EQ','siemens-q',125,30),
 M('siemens-eq-200-32','Siemens','EQ','siemens-q',200,32),
 M('siemens-eq-200-40','Siemens','EQ','siemens-q',200,40),
 M('siemens-eq-200-42','Siemens','EQ','siemens-q',200,42),
 M('siemens-eq-ml-100-24','Siemens','EQ (sous-panneau, sans principal)','siemens-q',100,24,{main:false}),
 M('siemens-eq-ml-60-12','Siemens','EQ (sous-panneau, sans principal)','siemens-q',60,12,{main:false}),
 M('squared-qo-100-24','Square D','QO','squared-qo',100,24),
 M('squared-qo-200-40','Square D','QO','squared-qo',200,40),
 M('squared-qo-200-42','Square D','QO','squared-qo',200,42),
 M('squared-qo-ml-100-24','Square D','QO (sous-panneau, sans principal)','squared-qo',100,24,{main:false}),
 M('squared-hom-100-24','Square D','Homeline','squared-hom',100,24),
 M('squared-hom-200-40','Square D','Homeline','squared-hom',200,40),
 M('squared-hom-ml-60-12','Square D','Homeline (sous-panneau, sans principal)','squared-hom',60,12,{main:false}),
 M('eaton-br-100-24','Eaton','BR','eaton-br',100,24),
 M('eaton-br-200-40','Eaton','BR','eaton-br',200,40),
 M('eaton-br-ml-100-24','Eaton','BR (sous-panneau, sans principal)','eaton-br',100,24,{main:false}),
 M('eaton-ch-125-24','Eaton / Cutler-Hammer','CH','eaton-ch',125,24),
 M('eaton-ch-200-42','Eaton / Cutler-Hammer','CH','eaton-ch',200,42),
 M('leviton-200-40','Leviton','Centre de distribution résidentiel','leviton-lb',200,40,{tandem:false}),
 M('leviton-ml-100-24','Leviton','Centre de distribution (sous-panneau)','leviton-lb',100,24,{main:false,tandem:false}),
 M('federal-stablok-100-24','Federal Pioneer','Stab-Lok (ancien)','generic',100,24,{note:'Panneau ancien : faites évaluer son remplacement par un maître électricien.'}),
];
export const modelById=id=>PANEL_MODELS.find(m=>m.id===id);
export const modelLabel=m=>`${m.brand} ${m.series} — ${m.mainAmps} A · ${m.positions} positions${m.tandem?` (jusqu’à ${m.maxCircuits} circuits)`:''}`;

export const PANEL_STATES=['Existant','Planifié','Installé','Vérifié'];
export const LOADS_SOURCES=[
 'Gouvernement du Québec — Guide sur les bornes de recharge (niveaux 1, 2 et 3)',
 'Ressources naturelles Canada — Recharge des véhicules électriques',
 'Code canadien de l’électricité (CSA C22.1) : règles 8-104, 8-200, 8-106, section 86 ; feuilles de calcul municipales (Winnipeg, Burnaby)',
 'Fiches de fabricants (bornes, thermopompes de piscine, chauffe-eau)',
];
