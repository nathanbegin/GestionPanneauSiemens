// Historique des versions d'un panneau : instantané après chaque enregistrement, regroupé par rafales de 10 minutes
// (même personne) pour rester léger ; 60 versions conservées par panneau.
const WINDOW_MIN=10,KEEP=60;
export const snapshotOf=p=>{const {calcRecord,...details}=p.details||{};return {name:p.name,tag:p.tag||'',kind:p.kind,location:p.location||'',positions:p.positions,details,circuits:p.circuits};};

// previous : état avant cette modification (sert de « version initiale » au tout premier enregistrement).
export async function recordHistory(sql,{panel,userId,previous=null}){
 const [{n}]=await sql`SELECT count(*)::int AS n FROM app_panel_history WHERE panel_id=${panel.id}`;
 if(n===0&&previous)await sql`INSERT INTO app_panel_history(panel_id,user_id,at,revision,initial,snap) VALUES(${panel.id},${null},${previous.updated_at||panel.created_at},${previous.revision||0},true,${JSON.stringify(snapshotOf(previous))}::jsonb)`;
 const [last]=await sql`SELECT id,user_id,initial FROM app_panel_history WHERE panel_id=${panel.id} ORDER BY id DESC LIMIT 1`;
 const snap=JSON.stringify(snapshotOf(panel));
 const same=last&&!last.initial&&last.user_id===userId&&(await sql`SELECT 1 FROM app_panel_history WHERE id=${last.id} AND at>now()-make_interval(mins=>${WINDOW_MIN})`).length;
 if(same)await sql`UPDATE app_panel_history SET at=now(),revision=${panel.revision},snap=${snap}::jsonb WHERE id=${last.id}`;
 else await sql`INSERT INTO app_panel_history(panel_id,user_id,revision,snap) VALUES(${panel.id},${userId},${panel.revision},${snap}::jsonb)`;
 await sql`DELETE FROM app_panel_history WHERE panel_id=${panel.id} AND id NOT IN (SELECT id FROM app_panel_history WHERE panel_id=${panel.id} ORDER BY id DESC LIMIT ${KEEP})`;
}
export async function listHistory(sql,panelId){
 const rows=await sql`SELECT h.id,h.at,h.revision,h.initial,h.user_id,u.name AS by_name,jsonb_array_length(h.snap->'circuits') AS circuits FROM app_panel_history h LEFT JOIN app_users u ON u.id=h.user_id WHERE h.panel_id=${panelId} ORDER BY h.id DESC`;
 return rows.map(r=>({id:Number(r.id),at:r.at,revision:r.revision,initial:r.initial,by:r.by_name||'',circuits:r.circuits}));
}
// Une version et celle qui la précède (pour afficher ce qui a changé).
export async function getVersion(sql,panelId,hid){
 const [cur]=await sql`SELECT id,at,snap,initial FROM app_panel_history WHERE panel_id=${panelId} AND id=${hid}`;
 if(!cur)return null;
 const [prev]=await sql`SELECT snap FROM app_panel_history WHERE panel_id=${panelId} AND id<${hid} ORDER BY id DESC LIMIT 1`;
 return {id:Number(cur.id),at:cur.at,initial:cur.initial,snapshot:cur.snap,previous:prev?.snap||null};
}
