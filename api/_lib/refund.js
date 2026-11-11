// Remboursement au prorata à l'annulation : montant réellement payé × part inutilisée de la période.
// Les taxes sont incluses dans le montant payé : le remboursement les ajuste donc dans la même proportion.
export function prorataRefund({amountPaid,alreadyRefunded=0,periodStart,periodEnd,now=Date.now()}){
 const a=+periodStart,b=+periodEnd,n=+now;
 if(!(amountPaid>0)||!(b>a))return {cents:0,ratio:0,reason:'no-payment'};
 const ratio=Math.max(0,Math.min(1,(b-n)/(b-a)));
 const cents=Math.max(0,Math.min(Math.floor(amountPaid*ratio),amountPaid-alreadyRefunded));
 return {cents,ratio:Math.round(ratio*10000)/10000,reason:cents?'ok':'nothing-unused'};
}
