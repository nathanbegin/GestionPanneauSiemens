// Textes des courriels transactionnels, dans la langue du destinataire (préférence du compte) : français ou anglais.
import {normLang} from './i18n.js';

const T={
 reset:{
  fr:({name,url})=>({subject:'Disjonio — réinitialisation du mot de passe',text:`Bonjour ${name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valide 1 heure) :\n${url}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.\n\nDisjonio`}),
  en:({name,url})=>({subject:'Disjonio — password reset',text:`Hello ${name},\n\nTo choose a new password, open this link (valid for 1 hour):\n${url}\n\nIf you did not make this request, ignore this message.\n\nDisjonio`}),
 },
 invite:{
  fr:({who,owner,days,url})=>({subject:`${owner} vous invite dans son équipe sur Disjonio`,text:`Bonjour,\n\n${who} (${owner}) vous invite à rejoindre son équipe sur Disjonio.\n\nOuvrez ce lien (valide ${days} jours), puis connectez-vous ou créez un compte gratuit :\n${url}\n\nDisjonio`}),
  en:({who,owner,days,url})=>({subject:`${owner} invites you to their team on Disjonio`,text:`Hello,\n\n${who} (${owner}) invites you to join their team on Disjonio.\n\nOpen this link (valid for ${days} days), then sign in or create a free account:\n${url}\n\nDisjonio`}),
 },
 handoffAccess:{
  fr:({who,site,url,days})=>({subject:`${who} vous donne accès à un dossier sur Disjonio`,text:`Bonjour,\n\n${who} vous donne un accès en consultation (lecture seule) au dossier « ${site} » sur Disjonio. Vous ne rejoignez pas son équipe et il peut retirer cet accès en tout temps.\n\nOuvrez ce lien (valide ${days} jours) et connectez-vous avec cette adresse courriel :\n${url}`}),
  en:({who,site,url,days})=>({subject:`${who} is giving you access to a file on Disjonio`,text:`Hello,\n\n${who} is giving you read-only access to the file “${site}” on Disjonio. You do not join their team and they can remove this access at any time.\n\nOpen this link (valid for ${days} days) and sign in with this email address:\n${url}`}),
 },
 handoffTransfer:{
  fr:({who,site,url,days})=>({subject:`${who} vous remet une copie d’un dossier sur Disjonio`,text:`Bonjour,\n\n${who} vous remet une copie du dossier « ${site} » sur Disjonio. Après acceptation, la copie vous appartient : ${who} garde sa propre copie, les deux copies ne se synchronisent pas et la suppression de l’une n’efface pas l’autre.\n\nOuvrez ce lien (valide ${days} jours) et connectez-vous avec cette adresse courriel :\n${url}`}),
  en:({who,site,url,days})=>({subject:`${who} is handing you a copy of a file on Disjonio`,text:`Hello,\n\n${who} is handing you a copy of the file “${site}” on Disjonio. Once accepted, the copy belongs to you: ${who} keeps their own copy, the two copies do not sync, and deleting one does not delete the other.\n\nOpen this link (valid for ${days} days) and sign in with this email address:\n${url}`}),
 },
 joinRequest:{
  fr:({name,email,url})=>({subject:`${name} demande à rejoindre votre équipe Disjonio`,text:`Bonjour,\n\n${name} (${email}) demande à rejoindre votre équipe.\nAcceptez ou refusez la demande dans Disjonio → Mon équipe :\n${url}\n\nDisjonio`}),
  en:({name,email,url})=>({subject:`${name} asks to join your Disjonio team`,text:`Hello,\n\n${name} (${email}) asks to join your team.\nAccept or decline the request in Disjonio → My team:\n${url}\n\nDisjonio`}),
 },
};
/** mailText('reset','en',{name,url}) → {subject, text} */
export const mailText=(key,lang,vars)=>T[key][normLang(lang)](vars);
