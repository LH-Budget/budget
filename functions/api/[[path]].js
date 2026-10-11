const TABLES = {
  month_settings: ['id','user_id','month_key','year','month','salary_amount','opening_balance','created_at','updated_at'],
  budget_items: ['id','user_id','year','month','section','title','amount','sort_order','created_at','month_key','label'],
  custom_budgets: ['id','user_id','title','created_at'],
  custom_budget_sections: ['id','user_id','budget_id','title','sort_order','include_in_total','created_at'],
  custom_budget_items: ['id','user_id','budget_id','section_id','label','amount','sort_order','created_at']
};
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const uuid = () => crypto.randomUUID();
async function bodyJson(req){ try{return await req.json()}catch{return {}} }
async function getSession(req, env){
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if(!token) return null;
  return await env.DB.prepare('SELECT token,user_id FROM sessions WHERE token=?').bind(token).first();
}
function validTable(t){return Object.prototype.hasOwnProperty.call(TABLES,t)}
function ident(s){if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) throw new Error('Ugyldigt feltnavn'); return '"'+s+'"'}
async function handle(request, env){
  const url = new URL(request.url);
  if(url.pathname.startsWith('/api/')){
   if(!env.DB) return json({error:'D1-databasen er ikke tilsluttet.'},500);
   if(url.pathname==='/api/auth/login' && request.method==='POST'){
    const b=await bodyJson(request); const email=String(b.email||'').trim().toLowerCase(); const password=String(b.password||'');
    if(!env.LH_LOGIN_EMAIL || !env.LH_LOGIN_PASSWORD) return json({error:'Login er ikke konfigureret i Cloudflare.'},500);
    if(email!==String(env.LH_LOGIN_EMAIL).trim().toLowerCase() || password!==env.LH_LOGIN_PASSWORD) return json({error:'Forkert e-mail eller adgangskode.'},401);
    const userId=env.LH_USER_ID || '791fbb62-09fd-4309-9217-3f633d4764be'; const token=uuid()+uuid().replaceAll('-','');
    await env.DB.prepare('INSERT INTO sessions(token,user_id) VALUES(?,?)').bind(token,userId).run();
    return json({session:{access_token:token,user:{id:userId,email:env.LH_LOGIN_EMAIL}}});
   }
   if(url.pathname==='/api/auth/session' && request.method==='GET'){
    const s=await getSession(request,env); if(!s)return json({session:null});
    return json({session:{access_token:s.token,user:{id:s.user_id,email:env.LH_LOGIN_EMAIL||''}}});
   }
   if(url.pathname==='/api/auth/logout' && request.method==='POST'){
    const s=await getSession(request,env); if(s) await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(s.token).run(); return json({ok:true});
   }
   if(url.pathname==='/api/db' && request.method==='POST'){
    const s=await getSession(request,env); if(!s)return json({error:'Du er logget ud. Log ind igen.'},401);
    const b=await bodyJson(request); const table=b.table; if(!validTable(table))return json({error:'Ukendt tabel.'},400);
    const cols=TABLES[table]; const filters=Array.isArray(b.filters)?b.filters:[];
    // Every request is constrained to the active account, regardless of client filters.
    const where=[ '"user_id" = ?' ]; const values=[s.user_id];
    for(const f of filters){ if(!cols.includes(f.column) || f.op!=='eq')return json({error:'Ugyldigt filter.'},400); where.push(`${ident(f.column)} = ?`); values.push(f.value); }
    try{
     if(b.action==='select'){
      const selected=(b.columns==='*'||!b.columns)?cols:b.columns.split(',').map(x=>x.trim());
      if(selected.some(c=>!cols.includes(c)))return json({error:'Ugyldigt felt i select.'},400);
      let sql=`SELECT ${selected.map(ident).join(',')} FROM ${ident(table)} WHERE ${where.join(' AND ')}`;
      if(b.order && cols.includes(b.order.column))sql+=` ORDER BY ${ident(b.order.column)} ${b.order.ascending===false?'DESC':'ASC'}`;
      const result=await env.DB.prepare(sql).bind(...values).all(); const rows=(result.results||[]).map(r=>table==='custom_budget_sections'?{...r,include_in_total:!!r.include_in_total}:r); return json({data:rows,error:null});
     }
     if(b.action==='insert'){
      const rows=Array.isArray(b.data)?b.data:[b.data]; if(!rows.length||!rows[0])return json({data:[],error:null});
      const out=[];
      for(const row of rows){const item={...row,user_id:s.user_id}; if(!item.id)item.id=uuid(); if(table==='custom_budget_sections' && typeof item.include_in_total==='boolean')item.include_in_total=item.include_in_total?1:0;
       const keys=Object.keys(item).filter(k=>cols.includes(k)); if(keys.some(k=>!cols.includes(k)))throw new Error('Ugyldigt felt');
       const sql=`INSERT INTO ${ident(table)} (${keys.map(ident).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`;
       await env.DB.prepare(sql).bind(...keys.map(k=>item[k]===undefined?null:item[k])).run(); out.push(item);
      } return json({data:out,error:null});
     }
     if(b.action==='update'){
      const data=b.data||{}; const keys=Object.keys(data).filter(k=>cols.includes(k)&&k!=='id'&&k!=='user_id');
      if(!keys.length)return json({data:[],error:null});
      const sql=`UPDATE ${ident(table)} SET ${keys.map(k=>`${ident(k)} = ?`).join(',')} ${table==='month_settings'?', "updated_at" = CURRENT_TIMESTAMP':''} WHERE ${where.join(' AND ')}`;
      const result=await env.DB.prepare(sql).bind(...keys.map(k=>data[k]),...values).run(); const rows=await env.DB.prepare(`SELECT * FROM ${ident(table)} WHERE ${where.join(' AND ')}`).bind(...values).all(); const returned=(rows.results||[]).map(r=>table==='custom_budget_sections'?{...r,include_in_total:!!r.include_in_total}:r); return json({data:returned,count:result.meta?.changes||0,error:null});
     }
     if(b.action==='delete'){
      if(table==='custom_budgets'){
       const rows=await env.DB.prepare(`SELECT id FROM custom_budgets WHERE ${where.join(' AND ')}`).bind(...values).all();
       for(const row of rows.results||[]){await env.DB.prepare('DELETE FROM custom_budget_items WHERE budget_id=? AND user_id=?').bind(row.id,s.user_id).run();await env.DB.prepare('DELETE FROM custom_budget_sections WHERE budget_id=? AND user_id=?').bind(row.id,s.user_id).run();}
      }
      if(table==='custom_budget_sections'){
       const rows=await env.DB.prepare(`SELECT id FROM custom_budget_sections WHERE ${where.join(' AND ')}`).bind(...values).all();
       for(const row of rows.results||[])await env.DB.prepare('DELETE FROM custom_budget_items WHERE section_id=? AND user_id=?').bind(row.id,s.user_id).run();
      }
      const result=await env.DB.prepare(`DELETE FROM ${ident(table)} WHERE ${where.join(' AND ')}`).bind(...values).run();return json({data:[],count:result.meta?.changes||0,error:null});
     }
     if(b.action==='upsert'){
      const row={...(b.data||{}),user_id:s.user_id}; if(!row.id)row.id=uuid(); const keys=Object.keys(row).filter(k=>cols.includes(k));
      const conflict=String(b.onConflict||'').split(',').map(x=>x.trim()).filter(x=>cols.includes(x));
      if(!conflict.length)return json({error:'Upsert mangler gyldige konfliktfelter.'},400);
      const updates=keys.filter(k=>!conflict.includes(k)&&k!=='user_id'&&k!=='id');
      const sql=`INSERT INTO ${ident(table)} (${keys.map(ident).join(',')}) VALUES (${keys.map(()=>'?').join(',')}) ON CONFLICT (${conflict.map(ident).join(',')}) DO UPDATE SET ${updates.map(k=>`${ident(k)}=excluded.${ident(k)}`).join(',')||`${ident(conflict[0])}=excluded.${ident(conflict[0])}`}`;
      await env.DB.prepare(sql).bind(...keys.map(k=>row[k]===undefined?null:row[k])).run(); return json({data:[row],error:null});
     }
     return json({error:'Ukendt databasehandling.'},400);
    }catch(e){return json({error:e?.message||'Databasefejl.'},400)}
   }
   return json({error:'API-rute findes ikke.'},404);
  }
  return json({error:'API-rute findes ikke.'},404);
}

export async function onRequest(context){
  return handle(context.request, context.env);
}
