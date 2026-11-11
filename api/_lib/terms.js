// Version en vigueur des conditions d'utilisation et de la politique de confidentialité (date de la version publiée).
export const TERMS_VERSION='2026-11-11';
export const termsRecord=(now=new Date())=>({termsVersion:TERMS_VERSION,termsAcceptedAt:now.toISOString()});
