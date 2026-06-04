const VERSION = 'v1.1';
const SUPABASE_URL = 'https://oudjjqvhvgxouoanqvjb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vXbOB_8s8GJVWaJMR5eF8w_R2Dl3WPQ';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const months = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December'];
let user=null, year=new Date().getFullYear(), month=new Date().getMonth(), monthStart=Math.max(0, Math.min(8, month-1));
let settings={}, items=[]; let saveTimer=null;
const $=id=>document.getElementById(id);
function kr(n){const v=Number(n)||0; return new Intl.NumberFormat('da-DK',{maximumFractionDigits:0}).format(v)}
function num(v){return Number(String(v||'').replaceAll('.','').replace(',','.'))||0}
function monthKey(y=year,m=month){return `${y}-${String(m+1).padStart(2,'0')}`}
function setStatus(t){$('saveStatus').textContent=t}
async function init(){ if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{}); const {data}=await supabase.auth.getSession(); user=data.session?.user||null; user?showApp():showLogin(); }
function showLogin(){ $('loginView').classList.remove('hidden'); $('appView').classList.add('hidden') }
async function showApp(){ $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden'); $('yearInput').value=year; renderMonths(); await loadMonth(); }
$('loginForm').addEventListener('submit',async e=>{e.preventDefault(); $('loginError').textContent=''; const {data,error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}); if(error){$('loginError').textContent='Login fejlede: '+error.message;return} user=data.user; showApp();});
$('logoutBtn').onclick=async()=>{await supabase.auth.signOut(); user=null; showLogin();};
$('prevYear').onclick=()=>{year--; $('yearInput').value=year; loadMonth()}; $('nextYear').onclick=()=>{year++; $('yearInput').value=year; loadMonth()}; $('yearInput').onchange=()=>{year=num($('yearInput').value)||year; loadMonth()};
$('prevMonths').onclick=()=>{monthStart=Math.max(0,monthStart-4);renderMonths()}; $('nextMonths').onclick=()=>{monthStart=Math.min(8,monthStart+4);renderMonths()};
function renderMonths(){const strip=$('monthStrip'); strip.innerHTML=''; for(let i=monthStart;i<Math.min(12,monthStart+4);i++){const b=document.createElement('button'); b.className='month-btn'+(i===month?' active':''); b.textContent=months[i].slice(0,3); b.onclick=()=>{month=i;renderMonths();loadMonth()}; strip.appendChild(b);} }
async function loadMonth(){ if(!user)return; setStatus('Henter...'); const key=monthKey(); const prevName=months[(month+11)%12]; $('prevBalanceLabel').textContent=`Lønkonto ${prevName}`; $('saldoLabel').textContent=`Saldo ${months[month]}`;
 let {data:s}=await supabase.from('month_settings').select('*').eq('user_id',user.id).eq('month_key',key).maybeSingle();
 let opening=0; if(!s){ opening=await getPreviousBalance(); s={salary_amount:0, opening_balance:opening}; await supabase.from('month_settings').upsert({user_id:user.id,month_key:key,year,month:month+1,salary_amount:0,opening_balance:opening}); } settings=s;
 const {data:i,error}=await supabase.from('budget_items').select('*').eq('user_id',user.id).eq('month_key',key).order('sort_order'); if(error){setStatus('SQL mangler?');return} items=i||[]; $('salaryInput').value=kr(settings.salary_amount); $('openingInput').value=kr(settings.opening_balance); renderLists(); calc(); setStatus('Klar'); }
async function getPreviousBalance(){ let py=year, pm=month-1; if(pm<0){pm=11;py--} const key=`${py}-${String(pm+1).padStart(2,'0')}`; const {data:s}=await supabase.from('month_settings').select('*').eq('user_id',user.id).eq('month_key',key).maybeSingle(); const {data:i}=await supabase.from('budget_items').select('*').eq('user_id',user.id).eq('month_key',key); if(!s)return 0; return calculateFinal(s,i||[]); }
function calculateFinal(s,it){ const income=(Number(s.salary_amount)||0)+(Number(s.opening_balance)||0)+it.filter(x=>x.section==='income').reduce((a,x)=>a+Number(x.amount||0),0); const exp=it.filter(x=>x.section==='expense').reduce((a,x)=>a+Number(x.amount||0),0); const adj=it.filter(x=>x.section==='adjustment').reduce((a,x)=>a+Number(x.amount||0),0); return income-exp+adj; }
function renderLists(){ renderList('incomeList','income'); renderList('expenseList','expense'); renderList('adjustmentList','adjustment'); }
function renderList(id,section){ const box=$(id); box.innerHTML=''; items.filter(x=>x.section===section).forEach(item=>{ const t=$('itemTemplate').content.cloneNode(true); const row=t.querySelector('.item-row'), lab=t.querySelector('.label-input'), amt=t.querySelector('.amount-input'); lab.value=item.label||''; amt.value=kr(item.amount); lab.oninput=()=>{item.label=lab.value; queueSaveItem(item)}; amt.oninput=()=>{item.amount=num(amt.value); calc(); queueSaveItem(item)}; t.querySelector('.delete-btn').onclick=async()=>{ if(item.id) await supabase.from('budget_items').delete().eq('id',item.id).eq('user_id',user.id); items=items.filter(x=>x!==item); renderLists(); calc(); }; box.appendChild(t); }); }
function calc(){ settings.salary_amount=num($('salaryInput').value); settings.opening_balance=num($('openingInput').value); const incomeTotal=(settings.salary_amount||0)+(settings.opening_balance||0)+sum('income'); const expenseTotal=sum('expense'); const adj=sum('adjustment'); const final=incomeTotal-expenseTotal+adj; $('incomeTotal').textContent=kr(incomeTotal); $('expenseTotal').textContent=kr(expenseTotal); $('balanceIncome').textContent=kr(incomeTotal); $('balanceExpenses').textContent='-'+kr(expenseTotal); $('finalBalance').textContent=kr(final); $('bottomSaldo').textContent=kr(final); [$('finalBalance'),$('bottomSaldo')].forEach(el=>{el.classList.toggle('negative',final<0);el.classList.toggle('positive',final>=0)}); queueSaveSettings(); }
function sum(section){return items.filter(x=>x.section===section).reduce((a,x)=>a+Number(x.amount||0),0)}
$('salaryInput').oninput=calc; $('openingInput').oninput=calc;
$('addIncome').onclick=()=>addItem('income','',0); $('addExpense').onclick=()=>addItem('expense','',0); $('addAdjustment').onclick=()=>addItem('adjustment','',0); $('syncBtn').onclick=()=>saveAll();
function addItem(section,label,amount){items.push({section,label,amount,sort_order:Date.now()});renderLists();calc();saveAll()}
function queueSaveSettings(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveAll,600); }
function queueSaveItem(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveAll,600); }
async function saveAll(){ if(!user)return; setStatus('Gemmer...'); const key=monthKey(); await supabase.from('month_settings').upsert({user_id:user.id,month_key:key,year,month:month+1,salary_amount:settings.salary_amount||0,opening_balance:settings.opening_balance||0,updated_at:new Date().toISOString()},{onConflict:'user_id,month_key'}); for(const it of items){ const row={id:it.id,user_id:user.id,month_key:key,year,month:month+1,section:it.section,label:it.label||'',amount:Number(it.amount)||0,sort_order:it.sort_order||0,updated_at:new Date().toISOString()}; const {data}=await supabase.from('budget_items').upsert(row).select().single(); if(data) it.id=data.id; } setStatus('Gemt'); }
init();
