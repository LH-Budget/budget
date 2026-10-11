/* Lightweight Supabase-compatible client for the Cloudflare Worker API. */
(function(){
  const TOKEN_KEY='lh_budget_cloudflare_token';
  let token=localStorage.getItem(TOKEN_KEY)||'';
  let session=null;
  async function api(path,body,method='POST'){
    const headers={'content-type':'application/json'}; if(token)headers.authorization='Bearer '+token;
    const res=await fetch(path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const data=await res.json().catch(()=>({error:'Ugyldigt svar fra serveren.'}));
    if(!res.ok)throw new Error(data.error||'Serverfejl ('+res.status+')'); return data;
  }
  function makeResult(data,error=null){return {data,error};}
  class Query {
    constructor(table){this.table=table;this.action='select';this.filters=[];this.columns='*';this.data=null;this.orderBy=null;this.conflict=null;this.wantSingle=false;this.wantMaybeSingle=false;}
    select(columns='*'){this.columns=columns;return this;}
    insert(data){this.action='insert';this.data=data;return this;}
    update(data){this.action='update';this.data=data;return this;}
    delete(){this.action='delete';return this;}
    upsert(data,opts={}){this.action='upsert';this.data=data;this.conflict=opts.onConflict||'';return this;}
    eq(column,value){this.filters.push({column,op:'eq',value});return this;}
    order(column,opts={}){this.orderBy={column,ascending:opts.ascending!==false};return this;}
    single(){this.wantSingle=true;return this;}
    maybeSingle(){this.wantMaybeSingle=true;return this;}
    async execute(){
      try{
        const payload={table:this.table,action:this.action,filters:this.filters,columns:this.columns,order:this.orderBy,data:this.data,onConflict:this.conflict};
        const result=await api('/api/db',payload);
        let data=result.data??[];
        if(this.action==='select' && this.columns!=='*' && Array.isArray(data)){
          const wanted=this.columns.split(',').map(x=>x.trim()); data=data.map(row=>Object.fromEntries(wanted.filter(k=>k in row).map(k=>[k,row[k]])));
        }
        if(this.wantSingle){if(!Array.isArray(data)||!data.length)return makeResult(null,{message:'Ingen række fundet.'});return makeResult(data[0]);}
        if(this.wantMaybeSingle){if(!Array.isArray(data)||!data.length)return makeResult(null);return makeResult(data[0]);}
        return makeResult(data);
      }catch(e){return makeResult(null,{message:e.message});}
    }
    then(resolve,reject){return this.execute().then(resolve,reject);}
  }
  window.supabase={createClient:function(){
    return {
      from:(table)=>new Query(table),
      auth:{
        getSession:async()=>{try{const r=await api('/api/auth/session',undefined,'GET');session=r.session||null;if(!session){token='';localStorage.removeItem(TOKEN_KEY);}return {data:{session},error:null};}catch(e){return {data:{session:null},error:{message:e.message}};}},
        getUser:async()=>{const r=await this.getSession();return {data:{user:r.data.session?.user||null},error:r.error||null};},
        signInWithPassword:async({email,password})=>{try{const r=await api('/api/auth/login',{email,password});session=r.session;token=session.access_token;localStorage.setItem(TOKEN_KEY,token);return {data:{user:session.user,session},error:null};}catch(e){return {data:{user:null,session:null},error:{message:e.message}};}},
        signOut:async()=>{try{await api('/api/auth/logout',{});}catch{}session=null;token='';localStorage.removeItem(TOKEN_KEY);return {error:null};}
      }
    };
  }};
})();
