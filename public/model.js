export const blank = () => Array.from({length:40}, (_,i)=>({position:i+1,label:'',room:'',usage:'Autre',amps:15,poles:1,status:'À identifier',notes:''}));
export function validate(circuits){
 if(!Array.isArray(circuits)||circuits.length!==40)throw Error('Le panneau doit contenir exactement 40 positions.');
 const claimed=new Set();
 for(let i=0;i<40;i++){
 const c=circuits[i];
 if(!c||c.position!==i+1)throw Error('Numérotation invalide.');
 for(const [key,max] of [['label',100],['room',80],['notes',2000]])if(typeof c[key]!=='string'||c[key].length>max)throw Error('Champ invalide : '+key);
 if(!['Éclairage','Prises','Électroménager','Chauffage','Extérieur','Autre'].includes(c.usage)||!['À identifier','Identifié','Libre'].includes(c.status)||![15,20,25,30,40,50,60,70,80,90,100,125].includes(c.amps)||![1,2].includes(c.poles))throw Error('Caractéristiques invalides.');
 if(c.status==='Libre'&&c.poles===2)throw Error('Un emplacement libre doit être simple.');
 if(c.poles===2){if(c.position>38||claimed.has(c.position)||circuits[i+2].status!=='Libre'||circuits[i+2].poles!==1)throw Error('Un bipolaire nécessite la position suivante du même côté libre (numéro + 2).');claimed.add(c.position+2);}
 }
 return circuits;
}
export const parentOf=(data,n)=>data.find(c=>c.poles===2&&c.position+2===n);
