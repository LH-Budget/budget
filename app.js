
function forceMoneyInputsTextKeyboard(){
  document.querySelectorAll('input').forEach(inp=>{
    inp.setAttribute('type','text');
    inp.setAttribute('inputmode','text');
    inp.setAttribute('autocomplete','off');
  });
}


function prevMonthTransferLabel(){
  const prev = month === 1 ? 12 : month - 1;
  return `Overført fra ${monthNames[prev-1]}`;
}


function parseAmountLoose(value){
  if(value === null || value === undefined) return 0;
  let s = String(value).trim();
  if(!s) return 0;
  s = s.replace(/\s/g,'').replace(/\./g,'').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const VERSION='v5.2';
const SUPABASE_URL='https://oudjjqvhvgxouoanqvjb.supabase.co';
const SUPABASE_KEY='sb_publishable_vXbOB_8s8GJVWaJMR5eF8w_R2Dl3WPQ';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const months=['JAN','FEB','MAR','APR','MAJ','JUN','JUL','AUG','SEP','OKT','NOV','DEC'];
const monthNames=['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December'];
let user=null, year=new Date().getFullYear(), month=new Date().getMonth()+1, settings=null, items=[];
const $=id=>document.getElementById(id);
function parseAmount(v){return Number(String(v||'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''))||0}
function fmt(n){return Math.round(Number(n)||0).toLocaleString('da-DK')}
function monthKey(y,m){return `${y}-${String(m).padStart(2,'0')}`}
function prevMonthLabel(){let pm=month-1, py=year; if(pm<1){pm=12;py--} return `Lønkonto ${monthNames[pm-1]}`}
async function boot(){const {data}=await sb.auth.getSession();user=data.session?.user||null; if(user) showBudget(); else showLogin();}
function showLogin(){ $('loginView').classList.remove('hidden'); $('budgetView').classList.add('hidden')}
async function showBudget(){ $('loginView').classList.add('hidden'); $('budgetView').classList.remove('hidden'); initYears(); renderMonths(); await loadMonth();}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='Logger ind...';const email=$('email').value.trim();const password=$('password').value;const {data,error}=await sb.auth.signInWithPassword({email,password}); if(error){$('loginError').textContent=error.message; return} user=data.user; $('loginError').textContent=''; await showBudget();});
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();user=null;showLogin()};
function initYears(){const sel=$('yearSelect'); sel.innerHTML=''; for(let y=2024;y<=2035;y++){const o=document.createElement('option');o.value=y;o.textContent=y;if(y===year)o.selected=true;sel.appendChild(o)} sel.onchange=async()=>{year=Number(sel.value); await loadMonth()}}
function renderMonths(){const wrap=$('monthTabs');wrap.innerHTML=''; let start=Math.min(Math.max(month-2,1),9); for(let m=start;m<start+4;m++){const b=document.createElement('button');b.className='month-tab'+(m===month?' active':'');b.textContent=months[m-1];b.onclick=async()=>{month=m;renderMonths();await loadMonth()};wrap.appendChild(b)} $('prevMonth').onclick=async()=>{month--;if(month<1){month=12;year--;initYears()}renderMonths();await loadMonth()}; $('nextMonth').onclick=async()=>{month++;if(month>12){month=1;year++;initYears()}renderMonths();await loadMonth()};}
async function loadMonth(){const key=monthKey(year,month);$('openingLabel').textContent=prevMonthTransferLabel();if($('saldoLabel'))$('saldoLabel').textContent=`SALDO VED UDGANG AF ${monthNames[month-1].toUpperCase()}`;let res=await sb.from('month_settings').select('*').eq('month_key',key).maybeSingle(); if(res.error){alert('Databasefejl: '+res.error.message);return} settings=res.data; if(!settings){const opening=await getPreviousBalance(); const ins=await sb.from('month_settings').insert({user_id:user.id,month_key:key,year,month,salary_amount:0,opening_balance:opening}).select('*').single(); if(ins.error){alert('Databasefejl: '+ins.error.message);return} settings=ins.data}
let r=await sb.from('budget_items').select('*').eq('month_key',key).order('sort_order',{ascending:true}); if(r.error){alert('Databasefejl: '+r.error.message);return} items=r.data||[]; render();}
async function getPreviousBalance(){let pm=month-1, py=year; if(pm<1){pm=12;py--} const key=monthKey(py,pm); const s=await sb.from('month_settings').select('*').eq('month_key',key).maybeSingle(); const it=await sb.from('budget_items').select('*').eq('month_key',key); if(s.error||it.error||!s.data)return 0; return calcTotals(s.data,it.data||[]).balance;}
function calcTotals(s,it){const incomeExtra=it.filter(x=>x.section==='income').reduce((a,b)=>a+Number(b.amount),0); const expense=it.filter(x=>x.section==='expense').reduce((a,b)=>a+Number(b.amount),0); const adj=it.filter(x=>x.section==='adjustment').reduce((a,b)=>a+Number(b.amount),0); const income=Number(s.salary_amount)+Number(s.opening_balance)+incomeExtra; return{income,expense,adj,balance:income-expense+adj}}
function setAmountClass(el,n){ if(!el)return; el.classList.remove('positive','negative'); if(Number(n)<0)el.classList.add('negative'); else if(Number(n)>0)el.classList.add('positive'); }
function render(){ $('salaryInput').value=fmt(settings.salary_amount); $('openingInput').value=fmt(settings.opening_balance); renderList('incomeList','income'); renderList('adjustmentList','adjustment'); renderList('expenseList','expense'); const t=calcTotals(settings,items); $('incomeTotal').textContent=fmt(t.income); $('balanceIncome').textContent=fmt(t.income); $('balanceExpense').textContent=t.expense?'-'+fmt(t.expense):'0'; $('expenseTotal').textContent=fmt(t.expense); $('balanceTotal').textContent=fmt(t.balance); if($('saldoValue'))$('saldoValue').textContent=fmt(t.balance); setAmountClass($('incomeTotal'),t.income); setAmountClass($('balanceIncome'),t.income); setAmountClass($('balanceExpense'),-t.expense); setAmountClass($('expenseTotal'),t.expense); setAmountClass($('balanceTotal'),t.balance); setAmountClass($('saldoValue'),t.balance);
  forceMoneyInputsTextKeyboard();
}
function renderList(id,section){const el=$(id);el.innerHTML='';items.filter(x=>x.section===section).forEach(item=>{const row=document.createElement('div');row.className='item-row';const label=document.createElement('input');label.value=item.label;label.placeholder='Tekst';const amount=document.createElement('input');amount.value=fmt(item.amount);amount.inputMode='decimal';const del=document.createElement('button');del.className='del';del.textContent='×';del.onclick=()=>deleteItem(item.id);label.onchange=()=>updateItem(item.id,{label:label.value});amount.onchange=()=>updateItem(item.id,{amount:parseAmountLoose(amount.value)});const right=document.createElement('div');right.style.display='grid';right.style.gridTemplateColumns='1fr 24px';right.style.alignItems='center';right.append(amount,del);row.append(label,right);el.appendChild(row)})}
async function updateSettings(patch){const {data,error}=await sb.from('month_settings').update(patch).eq('id',settings.id).select('*').single(); if(error){alert('Databasefejl: '+error.message);return} settings=data; render()}
$('salaryInput').onchange=()=>updateSettings({salary_amount:parseAmountLoose($('salaryInput').value)});$('openingInput').onchange=()=>updateSettings({opening_balance:parseAmountLoose($('openingInput').value)});
async function addItem(section){
  const key=monthKey(year,month);
  const nextOrder=(items.filter(x=>x.section===section).reduce((m,x)=>Math.max(m,Number(x.sort_order)||0),0)+1);
  const txt=section==='expense'?'Ny udgift':section==='income'?'Ny indtægt':'Ny post';
  const payload={user_id:user.id,month_key:key,year,month,section,label:txt,title:txt,amount:0,sort_order:nextOrder};
  const {data,error}=await sb.from('budget_items').insert(payload).select('*').single();
  if(error){alert('Databasefejl: '+error.message);return}
  if(data){items.push(data);render()}else{await loadMonth()}
}
async function updateItem(id,patch){const {error}=await sb.from('budget_items').update(patch).eq('id',id); if(error){alert('Databasefejl: '+error.message);return} const it=items.find(x=>x.id===id); if(it)Object.assign(it,patch); render()}
async function deleteItem(id){const {error}=await sb.from('budget_items').delete().eq('id',id); if(error){alert('Databasefejl: '+error.message);return} items=items.filter(x=>x.id!==id); render()}
$('addIncome').onclick=()=>addItem('income');$('addExpense').onclick=()=>addItem('expense');$('addAdjustment').onclick=()=>addItem('adjustment');
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});boot();



async function transferSection(section){
  if(!user){ showError('Du er ikke logget ind'); return; }
  if(month >= 12){ alert('Der er ingen efterfølgende måneder i dette år.'); return; }

  const source = items
    .filter(x => x.section === section)
    .map((x, idx) => ({
      user_id: user.id,
      year: year,
      section: section,
      label: x.label || '',
      amount: Number(x.amount || 0),
      sort_order: idx + 1
    }));

  if(!source.length){
    alert('Der er ingen poster at overføre.');
    return;
  }

  const sectionName = section === 'income' ? 'indtægter' : section === 'expense' ? 'udgifter' : 'poster';
  if(!confirm(`Overfør ${sectionName} fra ${monthNames[month-1]} til resten af året?`)) return;

  for(let m = month + 1; m <= 12; m++){
    const key = monthKey(year, m);

    const del = await sb.from('budget_items')
      .delete()
      .eq('user_id', user.id)
      .eq('month_key', key)
      .eq('section', section);

    if(del.error){ showError(del.error.message); return; }

    const rows = source.map((x, idx) => ({
      ...x,
      month: m,
      month_key: key,
      sort_order: idx + 1
    }));

    const ins = await sb.from('budget_items').insert(rows);
    if(ins.error){ showError(ins.error.message); return; }
  }

  await saveAndPropagateFromCurrentMonth();
  alert('Data er overført.');
}

window.addEventListener('load',()=>{
 const a=document.getElementById('transferIncome');
 const b=document.getElementById('transferAdjustment');
 const c=document.getElementById('transferExpense');
 if(a) a.onclick=()=>transferSection('income');
 if(b) b.onclick=()=>transferSection('adjustment');
 if(c) c.onclick=()=>transferSection('expense');
});


async function getMonthDataForCascade(y, m){
  const key = monthKey(y, m);
  const ms = await sb.from('month_settings')
    .select('*')
    .eq('user_id', user.id)
    .eq('month_key', key)
    .maybeSingle();

  const bi = await sb.from('budget_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('month_key', key);

  return {
    settings: ms.data || {salary_amount:0, opening_balance:0},
    items: bi.data || []
  };
}

function calcCascadeBalance(s, arr){
  const incomeItems = arr.filter(x=>x.section==='income').reduce((sum,x)=>sum+Number(x.amount||0),0);
  const expenseItems = arr.filter(x=>x.section==='expense').reduce((sum,x)=>sum+Number(x.amount||0),0);
  const adjustmentItems = arr.filter(x=>x.section==='adjustment').reduce((sum,x)=>sum+Number(x.amount||0),0);

  return Number(s.salary_amount||0) + Number(s.opening_balance||0) + incomeItems - expenseItems + adjustmentItems;
}

async function propagateOpeningBalancesFrom(startMonth){
  if(!user) return;

  let previousBalance = null;

  for(let m=startMonth; m<=12; m++){
    const data = await getMonthDataForCascade(year, m);
    const s = data.settings;
    const arr = data.items;

    if(m === startMonth){
      previousBalance = calcCascadeBalance(s, arr);
      continue;
    }

    const key = monthKey(year, m);

    await sb.from('month_settings').upsert({
      user_id: user.id,
      month_key: key,
      year: year,
      month: m,
      salary_amount: Number(s.salary_amount || 0),
      opening_balance: previousBalance
    }, { onConflict: 'user_id,month_key' });

    s.opening_balance = previousBalance;
    previousBalance = calcCascadeBalance(s, arr);
  }
}

async function saveAndPropagateFromCurrentMonth(){
  await propagateOpeningBalancesFrom(month);
}


let propagateTimer = null;
function schedulePropagate(){
  clearTimeout(propagateTimer);
  propagateTimer = setTimeout(async ()=>{
    if(user) await saveAndPropagateFromCurrentMonth();
  }, 350);
}


window.addEventListener('load',()=>{
  document.addEventListener('change', (e)=>{
    if(e.target && e.target.tagName === 'INPUT') schedulePropagate();
  });
  document.addEventListener('blur', (e)=>{
    if(e.target && e.target.tagName === 'INPUT') schedulePropagate();
  }, true);
});




async function getActiveUserForCustomBudget(){
  if(user && user.id) return user;
  const sessionResult = await sb.auth.getSession();
  const sessionUser = sessionResult?.data?.session?.user || null;
  if(sessionUser){
    user = sessionUser;
    return user;
  }
  const userResult = await sb.auth.getUser();
  if(userResult?.data?.user){
    user = userResult.data.user;
    return user;
  }
  return null;
}

/* v5.0 custom budgets */
let customBudgetId = null;
let customBudget = null;
let customSections = [];
let customItems = [];

function customMoney(n){
  return fmt(Number(n || 0));
}

function showSideMenu(){
  $('sideMenu').classList.remove('hidden');
  if($('customBudgetStatus')) $('customBudgetStatus').textContent='';
  loadCustomBudgetList();
}
function hideSideMenu(){
  $('sideMenu').classList.add('hidden');
}

async function loadCustomBudgetList(){
  const activeUser = await getActiveUserForCustomBudget();
  if(!activeUser || !activeUser.id) return;

  const {data,error} = await sb.from('custom_budgets')
    .select('*')
    .eq('user_id', activeUser.id)
    .order('created_at', {ascending:false});

  if(error){
    alert('Budgetlisten kunne ikke hentes.\n\n' + error.message);
    return;
  }

  const box = $('customBudgetList');
  box.innerHTML = '';

  (data || []).forEach(b=>{
    const row = document.createElement('button');
    row.className = 'budget-list-item';
    row.textContent = b.title || 'Uden navn';
    row.onclick = ()=>openCustomBudget(b.id);
    box.appendChild(row);
  });
}

async function createCustomBudget(){
  const activeUser = await getActiveUserForCustomBudget();
  if(!activeUser || !activeUser.id){
    alert('Du er ikke logget ind i LH Budget.');
    return;
  }

  const title = prompt('Navn på budget?');
  if(!title || !title.trim()) return;

  const payload = {
    user_id: activeUser.id,
    title: title.trim()
  };

  const result = await sb.from('custom_budgets')
    .insert(payload)
    .select('id,title,user_id')
    .single();

  if(result.error){
    alert(
      'Budget kunne ikke gemmes i Supabase.\n\n' +
      'Tjek at supabase-custom-budgets-v5.0.sql er kørt.\n\n' +
      result.error.message
    );
    return;
  }

  if(!result.data || !result.data.id){
    alert('Budget blev ikke gemt. Supabase returnerede ingen data.');
    return;
  }

  await loadCustomBudgetList();
  await openCustomBudget(result.data.id);
}

async function openCustomBudget(id){
  const activeUser = await getActiveUserForCustomBudget();
  if(!activeUser || !activeUser.id){
    alert('Du er ikke logget ind i LH Budget.');
    return;
  }

  customBudgetId = id;
  hideSideMenu();

  const b = await sb.from('custom_budgets')
    .select('*')
    .eq('id', id)
    .eq('user_id', activeUser.id)
    .single();

  if(b.error){
    alert('Budget kunne ikke åbnes.\n\n' + b.error.message);
    return;
  }

  customBudget = b.data;

  await loadCustomBudgetData();

  $('customBudgetTitle').value = customBudget.title || '';
  document.querySelector('.budget-view').classList.add('hidden');
  $('customBudgetView').classList.remove('hidden');
  renderCustomBudget();
}

async function loadCustomBudgetData(){
  const s = await sb.from('custom_budget_sections')
    .select('*')
    .eq('budget_id', customBudgetId)
    .eq('user_id', user.id)
    .order('sort_order', {ascending:true});

  const i = await sb.from('custom_budget_items')
    .select('*')
    .eq('budget_id', customBudgetId)
    .eq('user_id', user.id)
    .order('sort_order', {ascending:true});

  if(s.error){ alert('Sektioner kunne ikke hentes.\n\n' + s.error.message); return; }
  if(i.error){ alert('Linjer kunne ikke hentes.\n\n' + i.error.message); return; }

  customSections = s.data || [];
  customItems = i.data || [];
}

function renderCustomBudget(){
  const root = $('customSections');
  root.innerHTML = '';

  customSections.forEach(section=>{
    const items = customItems.filter(x=>x.section_id === section.id);
    const total = items.reduce((sum,x)=>sum+Number(x.amount||0),0);

    const card = document.createElement('div');
    card.className = 'custom-card';

    card.innerHTML = `
      <div class="custom-card-head">
        <input class="section-title" value="${escapeHtml(section.title || '')}">
        <button class="section-add">+ Linje</button>
        <button class="section-del">×</button>
      </div>
      <div class="section-lines"></div>
      <div class="section-total"><span>I alt</span><strong>${customMoney(total)}</strong></div>
    `;

    const titleInput = card.querySelector('.section-title');
    titleInput.onchange = async ()=>{
      await sb.from('custom_budget_sections').update({title:titleInput.value}).eq('id', section.id).eq('user_id', user.id);
    };

    card.querySelector('.section-add').onclick = ()=>addCustomItem(section.id);
    card.querySelector('.section-del').onclick = ()=>deleteCustomSection(section.id);

    const lines = card.querySelector('.section-lines');
    items.forEach(item=>{
      const row = document.createElement('div');
      row.className = 'custom-line';
      row.innerHTML = `
        <input class="custom-label" value="${escapeHtml(item.label || '')}" placeholder="Beskrivelse">
        <input class="custom-amount" type="text" inputmode="text" value="${customMoney(item.amount)}">
        <button class="custom-del">×</button>
      `;

      const label = row.querySelector('.custom-label');
      const amount = row.querySelector('.custom-amount');

      label.onchange = async ()=>{
        await sb.from('custom_budget_items').update({label:label.value}).eq('id', item.id).eq('user_id', user.id);
      };

      amount.onchange = async ()=>{
        await sb.from('custom_budget_items').update({amount:parseAmountLoose(amount.value)}).eq('id', item.id).eq('user_id', user.id);
        await loadCustomBudgetData();
        renderCustomBudget();
      };

      row.querySelector('.custom-del').onclick = ()=>deleteCustomItem(item.id);
      lines.appendChild(row);
    });

    root.appendChild(card);
  });
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

async function addCustomSection(){
  if(!customBudgetId) return;
  const title = prompt('Navn på sektion?');
  if(!title) return;

  const order = customSections.length + 1;
  const {error} = await sb.from('custom_budget_sections')
    .insert({user_id:user.id,budget_id:customBudgetId,title:title.trim(),sort_order:order});
  if(error){ showError(error.message); return; }

  await loadCustomBudgetData();
  renderCustomBudget();
}

async function addCustomItem(sectionId){
  const order = customItems.filter(x=>x.section_id === sectionId).length + 1;
  const {error} = await sb.from('custom_budget_items')
    .insert({user_id:user.id,budget_id:customBudgetId,section_id:sectionId,label:'Ny linje',amount:0,sort_order:order});
  if(error){ showError(error.message); return; }

  await loadCustomBudgetData();
  renderCustomBudget();
}

async function deleteCustomItem(id){
  if(!confirm('Slet linjen?')) return;
  const {error} = await sb.from('custom_budget_items').delete().eq('id', id).eq('user_id', user.id);
  if(error){ showError(error.message); return; }
  await loadCustomBudgetData();
  renderCustomBudget();
}

async function deleteCustomSection(id){
  if(!confirm('Slet sektion og alle linjer?')) return;
  const {error} = await sb.from('custom_budget_sections').delete().eq('id', id).eq('user_id', user.id);
  if(error){ showError(error.message); return; }
  await loadCustomBudgetData();
  renderCustomBudget();
}

async function deleteCurrentCustomBudget(){
  if(!customBudgetId) return;
  if(!confirm('Slet hele budgettet?')) return;
  const {error} = await sb.from('custom_budgets').delete().eq('id', customBudgetId).eq('user_id', user.id);
  if(error){ showError(error.message); return; }
  closeCustomBudget();
}

function closeCustomBudget(){
  customBudgetId = null;
  customBudget = null;
  customSections = [];
  customItems = [];
  $('customBudgetView').classList.add('hidden');
  document.querySelector('.budget-view').classList.remove('hidden');
}

window.addEventListener('load',()=>{
  const menuBtn = document.querySelector('.icon-btn');
  if(menuBtn) menuBtn.onclick = showSideMenu;

  $('sideBackdrop')?.addEventListener('click', hideSideMenu);
  $('closeMenu')?.addEventListener('click', hideSideMenu);
  $('newCustomBudget')?.addEventListener('click', createCustomBudget);
  $('backToMain')?.addEventListener('click', closeCustomBudget);
  $('addCustomSection')?.addEventListener('click', addCustomSection);
  $('deleteCustomBudget')?.addEventListener('click', deleteCurrentCustomBudget);

  $('customBudgetTitle')?.addEventListener('change', async ()=>{
    if(!customBudgetId) return;
    await sb.from('custom_budgets').update({title:$('customBudgetTitle').value}).eq('id', customBudgetId).eq('user_id', user.id);
  });
});
