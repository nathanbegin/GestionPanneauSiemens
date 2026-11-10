// Textes des courriels transactionnels, dans la langue du destinataire (préférence du compte) : français ou anglais.
import {normLang} from './i18n.js';

const T={
 reset:{
  fr:({name,url})=>({subject:'Mon Panneau — réinitialisation du mot de passe',text:`Bonjour ${name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valide 1 heure) :\n${url}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.\n\nMon Panneau`}),
  en:({name,url})=>({subject:'Mon Panneau — password reset',text:`Hello ${name},\n\nTo choose a new password, open this link (valid for 1 hour):\n${url}\n\nIf you did not make this request, ignore this message.\n\nMon Panneau`}),
 },
 invite:{
  fr:({who,owner,days,url})=>({subject:`${owner} vous invite dans son équipe sur Mon Panneau`,text:`Bonjour,\n\n${who} (${owner}) vous invite à rejoindre son équipe sur Mon Panneau.\n\nOuvrez ce lien (valide ${days} jours), puis connectez-vous ou créez un compte gratuit :\n${url}\n\nMon Panneau`}),
  en:({who,owner,days,url})=>({subject:`${owner} invites you to their team on Mon Panneau`,text:`Hello,\n\n${who} (${owner}) invites you to join their team on Mon Panneau.\n\nOpen this link (valid for ${days} days), then sign in or create a free account:\n${url}\n\nMon Panneau`}),
 },
 joinRequest:{
  fr:({name,email,url})=>({subject:`${name} demande à rejoindre votre équipe Mon Panneau`,text:`Bonjour,\n\n${name} (${email}) demande à rejoindre votre équipe.\nAcceptez ou refusez la demande dans Mon Panneau → Mon équipe :\n${url}\n\nMon Panneau`}),
  en:({name,email,url})=>({subject:`${name} asks to join your Mon Panneau team`,text:`Hello,\n\n${name} (${email}) asks to join your team.\nAccept or decline the request in Mon Panneau → My team:\n${url}\n\nMon Panneau`}),
 },
};
/** mailText('reset','en',{name,url}) → {subject, text} */
export const mailText=(key,lang,vars)=>T[key][normLang(lang)](vars);
