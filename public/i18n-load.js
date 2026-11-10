// Dictionnaires secondaires (PDF, pages publiques, console d'administration), chargés à la demande en anglais.
export async function readyDictionaries(){
 const [docs,admin]=await Promise.all([import('./i18n-en-docs.js'),import('./i18n-en-admin.js')]);
 return [...docs.default,...admin.default];
}
