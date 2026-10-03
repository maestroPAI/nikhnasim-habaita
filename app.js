import { createClient } from 'https://esm.sh/@base44/sdk';

const APP_ID = '6ac0c4d39306549ee04c755b';
const base44 = createClient({ appId: APP_ID });
const state = { user:null, items:[], payments:[], view:'home', filter:'', category:'all', selected:null, busy:false, error:'', realtime:false };
let unsubscribeItems=null, unsubscribePayments=null;
const money = n => (Number(n||0)).toLocaleString('he-IL')+' ₪';
const esc = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function boot(){
  try{ state.user = await base44.auth.me(); await refresh(); wireRealtime(); }
  catch(e){ state.user=null; }
  render();
}
async function refresh(){
  const [items,payments] = await Promise.all([base44.entities.Item.list(), base44.entities.Payment.list()]);
  state.items=(items||[]).filter(x=>!x.archived).sort((a,b)=>(a.position||9999)-(b.position||9999));
  state.payments=(payments||[]).filter(x=>!x.archived);
}

function wireRealtime(){
  if(state.realtime) return;
  state.realtime=true;
  const onChange=async()=>{
    try{
      const selectedId=state.selected?.id;
      await refresh();
      if(selectedId) state.selected=state.items.find(x=>x.id===selectedId)||null;
      render();
    }catch(e){ console.warn('Realtime refresh failed',e); }
  };
  try{ unsubscribeItems=base44.entities.Item.subscribe(onChange); }catch(e){ console.warn('Item realtime unavailable',e); }
  try{ unsubscribePayments=base44.entities.Payment.subscribe(onChange); }catch(e){ console.warn('Payment realtime unavailable',e); }
}
function paidForItem(itemId){
  return state.payments.filter(p=>p.item_id===itemId&&p.status==='paid').reduce((s,p)=>s+Number(p.amount||0),0);
}
function depositForItem(itemId){
  return state.payments.filter(p=>p.item_id===itemId&&p.status==='paid'&&p.payment_type==='deposit').reduce((s,p)=>s+Number(p.amount||0),0);
}

function calc(){
  const estimate=state.items.reduce((s,x)=>s+Number(x.planned_price||0),0);
  const contracted=state.items.reduce((s,x)=>s+Number(x.actual_price||x.contract_price||0),0);
  const paid=state.payments.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount||0),0);
  const remaining=state.items.reduce((s,x)=>{const actual=Number(x.actual_price||x.contract_price||0);return s+(actual?Math.max(0,actual-paidForItem(x.id)):Number(x.remaining_to_pay||0));},0);
  const open=state.items.filter(x=>!Number(x.actual_price||x.contract_price||0)).length;
  const done=state.items.filter(x=>['paid','done'].includes(x.status)).length;
  return {estimate,contracted,paid,remaining,open,progress:state.items.length?Math.round(done/state.items.length*100):0};
}
function filtered(){
  return state.items.filter(x=>{
    const q=state.filter.trim().toLowerCase();
    const hit=!q||[x.name,x.category,x.kind,x.store,x.notes].some(v=>String(v||'').toLowerCase().includes(q));
    const cat=state.category==='all'||x.category===state.category;
    return hit&&cat;
  });
}
function loginView(){return `<div class="login"><div class="login-card"><h1>נכנסים הביתה</h1><p>התחברות לנתונים הקיימים שלך ב־Base44</p><form id="loginForm"><div class="field"><label>אימייל</label><input name="email" type="email" required autocomplete="email"></div><div class="field" style="margin-top:10px"><label>סיסמה</label><input name="password" type="password" required autocomplete="current-password"></div><button class="primary" style="width:100%;margin-top:16px">התחברות</button>${state.error?`<div class="error">${esc(state.error)}</div>`:''}</form></div></div>`}
function metric(label,val,sub,key){return `<button class="metric" data-metric="${key}"><small>${label}</small><strong>${val}</strong><div class="sub">${sub||''}</div></button>`}
function itemRow(x){const price=x.actual_price||x.contract_price||x.planned_price||0; return `<div class="item" data-item="${x.id}"><div><h3>${esc(x.name)}</h3><div class="meta"><span>${esc(x.category||'ללא קטגוריה')}</span><span class="status">${esc(x.status||'todo')}</span>${x.priority==='critical'?'<span class="status urgent">דחוף</span>':''}</div></div><div class="price">${money(price)}</div></div>`}
function homeView(){const c=calc(); const cats=[...new Set(state.items.map(x=>x.category).filter(Boolean))]; const urgent=state.items.filter(x=>['critical','high'].includes(x.priority)&&!['paid','done'].includes(x.status)).slice(0,6); return `<div class="shell"><div class="topbar"><div class="brand"><h1>נכנסים הביתה</h1><p>כל מה שצריך כדי לסגור את הבית בלי לאבד שליטה</p></div><div class="avatar">${esc((state.user?.name||state.user?.email||'A').slice(0,1).toUpperCase())}</div></div><div class="grid">${metric('הערכת מחיר',money(c.estimate),'כל התקציב המשוער','estimate')}${metric('הצעות מחיר בפועל',money(c.contracted),'מה שכבר נסגר','contracted')}${metric('שולם עד היום',money(c.paid),'כל התשלומים שבוצעו','paid')}${metric('נותר לתשלום',money(c.remaining),'יתרות פתוחות','remaining')}${metric('נשאר לסגור',c.open+' פריטים',c.progress+'% התקדמות','open')}</div><section class="section"><div class="section-head"><h2>מה דחוף עכשיו</h2><button class="pill" data-view="items">לכל הפריטים</button></div><div class="list">${urgent.length?urgent.map(itemRow).join(''):'<div class="empty">אין כרגע פריטים דחופים פתוחים</div>'}</div></section><section class="section"><div class="section-head"><h2>קטגוריות</h2></div><div class="toolbar">${cats.map(c=>`<button class="pill" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div></section></div>`}
function itemsView(){const cats=[...new Set(state.items.map(x=>x.category).filter(Boolean))]; const rows=filtered();return `<div class="shell"><div class="topbar"><div class="brand"><h1>כל הפריטים</h1><p>${rows.length} מתוך ${state.items.length}</p></div><button class="pill" id="refreshBtn">רענון</button></div><div class="toolbar"><input id="search" value="${esc(state.filter)}" placeholder="חיפוש פריט, קטגוריה, ספק..."><select id="category"><option value="all">כל הקטגוריות</option>${cats.map(c=>`<option ${state.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="list">${rows.map(itemRow).join('')||'<div class="empty">לא נמצאו פריטים</div>'}</div></div>`}
function paymentsView(){const paid=state.payments.filter(p=>p.status==='paid'); const scheduled=state.payments.filter(p=>p.status!=='paid'); const name=id=>state.items.find(x=>x.id===id)?.name||'פריט'; const rows=arr=>arr.map(p=>`<div class="item"><div><h3>${esc(name(p.item_id))}</h3><div class="meta"><span>${esc(p.payment_type||'תשלום')}</span><span>${esc(p.note||'')}</span></div></div><div class="price">${money(p.amount)}</div></div>`).join(''); return `<div class="shell"><div class="topbar"><div class="brand"><h1>תקציב ותשלומים</h1><p>מקדמות, תשלומים שבוצעו ויתרות</p></div></div><section class="section"><div class="section-head"><h2>שולם עד היום</h2></div><div class="list">${rows(paid)||'<div class="empty">אין תשלומים</div>'}</div></section><section class="section"><div class="section-head"><h2>נותר לתשלום</h2></div><div class="list">${rows(scheduled)||'<div class="empty">אין יתרות מתוזמנות</div>'}</div></section></div>`}
function settingsView(){return `<div class="shell"><div class="brand"><h1>הגדרות</h1><p>${esc(state.user?.email||'')}</p></div><div class="section"><button class="secondary" id="logout">התנתקות</button></div></div>`}
function modal(x){const paid=paidForItem(x.id); const actual=Number(x.actual_price||x.contract_price||0)||null; const deposit=depositForItem(x.id)||Number(x.deposit_amount||0); const remaining=actual!==null?Math.max(0,actual-paid):(x.remaining_to_pay??null); return `<div class="modal" id="modal"><div class="sheet"><div class="sheet-head"><div><h2 style="margin:0">${esc(x.name)}</h2><div class="meta" style="margin-top:6px">${esc(x.category||'')} · ${esc(x.status||'')}</div></div><button class="close" id="closeModal">×</button></div><div class="money-grid"><div class="money"><small>הערכת מחיר</small><strong>${money(x.planned_price)}</strong></div><div class="money"><small>הצעת מחיר בפועל</small><strong>${actual===null?'—':money(actual)}</strong></div><div class="money"><small>מקדמה</small><strong>${deposit?money(deposit):'—'}</strong></div><div class="money"><small>שולם עד היום</small><strong>${money(paid)}</strong></div><div class="money"><small>נותר לתשלום</small><strong>${remaining===null?'—':money(remaining)}</strong></div></div><form id="itemForm" data-id="${x.id}"><div class="form-grid"><div class="field"><label>הערכת מחיר</label><input name="planned_price" type="number" value="${x.planned_price??''}"></div><div class="field"><label>הצעת מחיר בפועל</label><input name="actual_price" type="number" value="${actual??''}"></div><div class="field"><label>קטגוריה</label><input name="category" value="${esc(x.category||'')}"></div><div class="field"><label>סטטוס</label><select name="status">${['todo','research','ordered','paid','done','deferred'].map(s=>`<option ${x.status===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field full"><label>הערות</label><textarea name="notes" rows="5">${esc(x.notes||'')}</textarea></div></div><div class="actions"><button class="primary">שמירה</button><button type="button" class="secondary" id="addPayment">הוסף תשלום</button></div></form></div></div>`}
function nav(){return `<nav class="bottom-nav"><div class="bottom-nav-inner">${[['home','בית'],['items','פריטים'],['payments','תשלומים'],['settings','הגדרות']].map(([k,l])=>`<button class="navbtn ${state.view===k?'active':''}" data-view="${k}">${l}</button>`).join('')}</div></nav>`}
function render(){const app=document.getElementById('app'); if(!state.user){app.innerHTML=loginView();bind();return;} const main=state.view==='home'?homeView():state.view==='items'?itemsView():state.view==='payments'?paymentsView():settingsView(); app.innerHTML=main+nav()+(state.selected?modal(state.selected):''); bind();}
function bind(){
  document.getElementById('loginForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{state.error='';await base44.auth.loginViaEmailPassword(f.get('email'),f.get('password'));state.user=await base44.auth.me();await refresh();wireRealtime();render();}catch(err){state.error='ההתחברות נכשלה. בדוק אימייל וסיסמה.';render();}});
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.selected=null;render();});
  document.querySelectorAll('[data-item]').forEach(el=>el.onclick=()=>{state.selected=state.items.find(x=>x.id===el.dataset.item);render();});
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{state.category=b.dataset.cat;state.view='items';render();});
  document.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>{const k=b.dataset.metric;if(k==='paid'||k==='remaining'){state.view='payments'}else if(k==='open'){state.view='items';state.filter=''}else{state.view='items'}render();});
  document.getElementById('search')?.addEventListener('input',e=>{state.filter=e.target.value;render();});
  document.getElementById('category')?.addEventListener('change',e=>{state.category=e.target.value;render();});
  document.getElementById('closeModal')?.addEventListener('click',()=>{state.selected=null;render();});
  document.getElementById('refreshBtn')?.addEventListener('click',async()=>{await refresh();render();});
  document.getElementById('logout')?.addEventListener('click',async()=>{try{await base44.auth.logout?.()}catch{} state.user=null;render();});
  document.getElementById('itemForm')?.addEventListener('submit',async e=>{e.preventDefault();const id=e.currentTarget.dataset.id;const f=new FormData(e.currentTarget);const actual=f.get('actual_price')?Number(f.get('actual_price')):null;const paid=paidForItem(id);const payload={planned_price:f.get('planned_price')?Number(f.get('planned_price')):null,actual_price:actual,contract_price:actual,paid_to_date:paid,remaining_to_pay:actual===null?null:Math.max(0,actual-paid),category:f.get('category'),status:f.get('status'),notes:f.get('notes')}; await base44.entities.Item.update(id,payload); await refresh(); state.selected=state.items.find(x=>x.id===id); render();});
  document.getElementById('addPayment')?.addEventListener('click',async()=>{const x=state.selected;const amount=prompt('סכום התשלום'); if(!amount||isNaN(Number(amount)))return; const type=prompt('סוג תשלום: deposit / installment / final','installment')||'installment'; await base44.entities.Payment.create({item_id:x.id,amount:Number(amount),status:'paid',payment_type:type,archived:false}); const all=await base44.entities.Payment.list(); const paid=(all||[]).filter(p=>!p.archived&&p.item_id===x.id&&p.status==='paid').reduce((s,p)=>s+Number(p.amount||0),0); const actual=Number(x.actual_price||x.contract_price||0); await base44.entities.Item.update(x.id,{paid_to_date:paid,remaining_to_pay:actual?Math.max(0,actual-paid):null,deposit_amount:type==='deposit'?Number(amount):(x.deposit_amount||null)}); await refresh(); state.selected=state.items.find(i=>i.id===x.id);render();});
}
boot();
