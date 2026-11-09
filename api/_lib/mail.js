// Envoi de courriels transactionnels (facultatif) via l'API Resend.
export const mailConfigured=()=>!!(process.env.RESEND_API_KEY&&process.env.MAIL_FROM);
export async function sendMail({to,subject,text}){
 if(!mailConfigured())return false;
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM,to:[to],subject,text})});
 if(!r.ok)console.error('mail',r.status);
 return r.ok;
}
export function appUrl(req){
 if(process.env.APP_URL)return process.env.APP_URL.replace(/\/$/,'');
 const host=req.headers['x-forwarded-host']||req.headers.host;
 const proto=req.headers['x-forwarded-proto']||(/^localhost|^127\./.test(host)?'http':'https');
 return `${proto}://${host}`;
}
