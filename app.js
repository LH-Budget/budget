const VERSION = 'v1.2';
const SUPABASE_URL = 'https://oudjjqvhvgxouoanqvjb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vXbOB_8s8GJVWaJMR5eF8w_R2Dl3WPQ';
const SESSION_KEY = 'lh_budget_session_v1';
const months = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December'];
let user=null, session=null, year=new Date().getFullYear(), month=new Date().getMonth(), monthStart=Math.max(0, Math.min(8, month-1));
let settings={}, items=[]; let saveTimer=null;
const $=id=>document.getElementById(id);
function kr(n){const v=Number(n)||0; return new Intl.NumberFormat('da-DK',{maximumFractionDigits:0}).format(v)}
function num(v){return Number(String(v||'').replaceAll('.','').replace(',','.'))||0}
function monthKey(y=year,m=month){return `${y}-${String(m+1).padStart(2,'0')}`}
function setStatus(t){const el=$('saveStatus'); if(el) el.textContent=t}
function setLoginError(t){$('loginError').textContent=t||''}
function authHeaders(){return {'apikey':SUPABASE_KEY,'Authorization':'Bearer '+session.access_token,'Content-Type':'application/json'}}
function anonHeaders(){return {'apikey':SUPABASE_KEY,'Content-Type':'application/json'}}
function encodeParams(obj){return Object.entries(obj).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}
async function apiFetch(url, opts={}){const r=await fetch(url,opts); const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{data=text} if(!r.ok){throw new Error((data&&data.message)||text||('HTTP '+r.status))} return data}
async function signIn(email,password){const data=await apiFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:anonHeaders(),body:JSON.stringify({email,password})}); data.expires_at=Date.now()+((data.expires_in||3600)-60)*1000; localStorage.setItem(SESSION_KEY,JSON.stringify(data)); session=data; user=data.user; return data}
function loadSession(){try{const s=JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); if(s&&s.access_token&&s.expires_at>Date.now()){session=s; user=s.user; return true}}catch{} localStorage.removeItem(SESSION_KEY); return false}
async function signOut(){localStorage.removeItem(SESSION_KEY); session=null; user=null}
async function selectRows(table, filters={}, extra=''){let q='select=*'; for(const [k,v] of Object.entries(filters)) q+=`&${k}=eq.${encodeURIComponent(v)}`; if(extra) q+='&'+extra; return apiFetch(`${SUPABASE_URL}/rest/v1/${table}?${q}`,{headers:authHeaders()})}
async function upsertMonth(row){return apiFetch(`${SUPABASE_URL}/rest/v1/month_settings?on_conflict=user_id,month_key`,{method:'POST',headers:{...authHeaders(),'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)})}
async function insertItem(row){return apiFetch(`${SUPABASE_URL}/rest/v1/budget_items`,{method:'POST',headers:{...authHeaders(),'Prefer':'return=representation'},body:JSON.stringify(row)})}
async function updateItem(row){return apiFetch(`${SUPABASE_URL}/rest/v1/budget_items?id=eq.${row.id}&user_id=eq.${user.id}`,{method:'PATCH',headers:{...authHeaders(),'Prefer':'return=representation'},body:JSON.stringify(row)})}
async function deleteItem(id){return apiFetch(`${SUPABASE_URL}/rest/v1/budget_items?id=eq.${id}&user_id=eq.${user.id}`,{method:'DELETE',headers:authHeaders()})}
async function init(){ if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{}); loadSession()?showApp():showLogin(); }
function showLogin(){ $('loginView').classList.remove('hidden'); $('appView').classList.add('hidden'); setLoginError('') }
async function showApp(){ $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden'); $('yearInput').value=year; renderMonths(); await loadMonth(); }
$('loginForm').addEventListener('submit',async e=>{ e.preventDefault(); setLoginError('Logger ind...'); const btn=$('loginForm').querySelector('button[type="submit"]'); btn.disabled=true; try{ await signIn($('email').value.trim(), $('password').value); setLoginError(''); await showApp(); }catch(err){ setLoginError('Login fejlede: '+err.message); } finally{ btn.disabled=false; } });
$('logoutBtn').onclick=async()=>{await signOut(); showLogin();};
$('prevYear').onclick=()=>{year--; $('yearInput').value=year; loadMonth()}; $('nextYear').onclick=()=>{year++; $('yearInput').value=year; loadMonth()}; $('yearInput').onchange=()=>{year=num($('yearInput').value)||year; loadMonth()};
$('prevMonths').onclick=()=>{monthStart=Math.max(0,monthStart-4);renderMonths()}; $('nextMonths').onclick=()=>{monthStart=Math.min(8,monthStart+4);renderMonths()};
function renderMonths(){const strip=$('monthStrip'); strip.innerHTML=''; for(let i=monthStart;i<Math.min(12,monthStart+4);i++){const b=document.createElement('button'); b.className='month-btn'+(i===month?' active':''); b.textContent=months[i].slice(0,3); b.onclick=()=>{month=i;renderMonths();loadMonth()}; strip.appendChild(b);} }
async function loadMonth(){ if(!user)return; setStatus('Henter...'); const key=monthKey(); const prevName=months[(month+11)%12]; $('prevBalanceLabel').textContent=`Lønkonto ${prevName}`; $('saldoLabel').textContent=`Saldo ${months[month]}`; try{
 let rows=await selectRows('month_settings',{user_id:user.id,month_key:key}); let s=rows[0];
 if(!s){ const opening=await getPreviousBalance(); s={user_id:user.id,month_key:key,year,month:month+1,salary_amount:0,opening_balance:opening}; await upsertMonth(s); }
 settings=s;
 items=await selectRows('budget_items',{user_id:user.id,month_key:key},'order=sort_order.asc');
 $('salaryInput').value=kr(settings.salary_amount); $('openingInput').value=kr(settings.opening_balance); renderLists(); calc(); setStatus('Klar');
 }catch(err){ setStatus('Fejl'); alert('Databasefejl: '+err.message); }
}
async function getPreviousBalance(){ let py=year, pm=month-1; if(pm<0){pm=11;py--} const key=`${py}-${String(pm+1).padStart(2,'0')}`; const s=(await selectRows('month_settings',{user_id:user.id,month_key:key}))[0]; const i=await selectRows('budget_items',{user_id:user.id,month_key:key}); if(!s)return 0; return calculateFinal(s,i||[]); }
function calculateFinal(s,it){ const income=(Number(s.salary_amount)||0)+(Number(s.opening_balance)||0)+it.filter(x=>x.section==='income').reduce((a,x)=>a+Number(x.amount||0),0); const exp=it.filter(x=>x.section==='expense').reduce((a,x)=>a+Number(x.amount||0),0); const adj=it.filter(x=>x.section==='adjustment').reduce((a,x)=>a+Number(x.amount||0),0); return income-exp+adj; }
function renderLists(){ renderList('incomeList','income'); renderList('expenseList','expense'); renderList('adjustmentList','adjustment'); }
function renderList(id,section){ const box=$(id); box.innerHTML=''; items.filter(x=>x.section===section).forEach(item=>{ const t=$('itemTemplate').content.cloneNode(true); const lab=t.querySelector('.label-input'), amt=t.querySelector('.amount-input'); lab.value=item.label||''; amt.value=kr(item.amount); lab.oninput=()=>{item.label=lab.value; queueSaveItem()}; amt.oninput=()=>{item.amount=num(amt.value); calc(); queueSaveItem()}; t.querySelector('.delete-btn').onclick=async()=>{ if(item.id) await deleteItem(item.id); items=items.filter(x=>x!==item); renderLists(); calc(); }; box.appendChild(t); }); }
function calc(){ settings.salary_amount=num($('salaryInput').value); settings.opening_balance=num($('openingInput').value); const incomeTotal=(settings.salary_amount||0)+(settings.opening_balance||0)+sum('income'); const expenseTotal=sum('expense'); const adj=sum('adjustment'); const final=incomeTotal-expenseTotal+adj; $('incomeTotal').textContent=kr(incomeTotal); $('expenseTotal').textContent=kr(expenseTotal); $('balanceIncome').textContent=kr(incomeTotal); $('balanceExpenses').textContent='-'+kr(expenseTotal); $('finalBalance').textContent=kr(final); $('bottomSaldo').textContent=kr(final); [$('finalBalance'),$('bottomSaldo')].forEach(el=>{el.classList.toggle('negative',final<0);el.classList.toggle('positive',final>=0)}); queueSaveSettings(); }
function sum(section){return items.filter(x=>x.section===section).reduce((a,x)=>a+Number(x.amount||0),0)}
$('salaryInput').oninput=calc; $('openingInput').oninput=calc;
$('addIncome').onclick=()=>addItem('income','',0); $('addExpense').onclick=()=>addItem('expense','',0); $('addAdjustment').onclick=()=>addItem('adjustment','',0); $('syncBtn').onclick=()=>saveAll();
function addItem(section,label,amount){items.push({section,label,amount,sort_order:Date.now()});renderLists();calc();saveAll()}
function queueSaveSettings(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveAll,700); }
function queueSaveItem(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveAll,700); }
async function saveAll(){ if(!user)return; setStatus('Gemmer...'); const key=monthKey(); try{ await upsertMonth({user_id:user.id,month_key:key,year,month:month+1,salary_amount:settings.salary_amount||0,opening_balance:settings.opening_balance||0,updated_at:new Date().toISOString()}); for(const it of items){ const row={user_id:user.id,month_key:key,year,month:month+1,section:it.section,label:it.label||'',amount:Number(it.amount)||0,sort_order:it.sort_order||0,updated_at:new Date().toISOString()}; let data; if(it.id){row.id=it.id; data=await updateItem(row)} else {data=await insertItem(row)} if(data&&data[0]) it.id=data[0].id; } setStatus('Gemt'); }catch(err){ setStatus('Gem fejl'); console.error(err); }
}
init();
