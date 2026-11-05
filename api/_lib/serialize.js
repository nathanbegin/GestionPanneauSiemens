// Conversion des lignes SQL en objets JSON publics.
import {stats} from '../../public/model.js';
export const siteOut=r=>({id:r.id,name:r.name,client:r.client,street:r.street,city:r.city,province:r.province,postalCode:r.postal_code,notes:r.notes,createdAt:r.created_at,updatedAt:r.updated_at,...(r.panel_count!==undefined?{panelCount:r.panel_count}:{})});
export const panelSummary=r=>({id:r.id,siteId:r.site_id,name:r.name,tag:r.tag,kind:r.kind,location:r.location,positions:r.positions,details:r.details,updatedAt:r.updated_at,stats:stats(r.circuits)});
export const panelOut=r=>({...panelSummary(r),circuits:r.circuits,revision:r.revision,createdAt:r.created_at});
