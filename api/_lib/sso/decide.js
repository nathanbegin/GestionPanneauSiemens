// Règle de décision pure : que faire quand un fournisseur confirme une identité ? (testée sans base de données)
// identityUser : utilisateur déjà lié à (fournisseur, sujet) · emailUser : utilisateur ayant ce courriel · currentUserId : mode « lier »
export function decide({identityUser,emailUser,emailVerified,hasEmail,currentUserId}){
 if(currentUserId){
  if(identityUser&&identityUser.id!==currentUserId)return {action:'refuse',reason:'taken'};
  return identityUser?{action:'noop-link'}:{action:'link'};
 }
 if(identityUser)return {action:'login',user:identityUser};
 if(!hasEmail)return {action:'refuse',reason:'no_email'};
 if(emailUser)return emailVerified?{action:'link-login',user:emailUser}:{action:'refuse',reason:'unverified_exists'};
 if(!emailVerified)return {action:'refuse',reason:'unverified'};
 return {action:'create'};
}
