/* Orders module + Dashboard */
let ordersDB = [];
let ordScopesSelected = [];
let _trackOrderId = null;
let _trackSchedule = [];

const ORD_SCOPES = ['Supply','Service','Inspection','Testing','SITC','Installation','Maintenance','AMC'];

function loadOrders(){
  try{ ordersDB=JSON.parse(localStorage.getItem('cs9_orders')||'[]'); }catch(e){ ordersDB=[]; }
}
function saveOrdersDB(){
  localStorage.setItem('cs9_orders', JSON.stringify(ordersDB));
}

function isOrderDelayed(o){
  if(o.status==='completed'||o.status==='cancelled') return false;
  const today=new Date().toISOString().slice(0,10);
  if(o.planEnd && o.planEnd < today) return true;
  return (o.schedule||[]).some(s=>s.planDate && s.planDate < today && s.status!=='done');
}

function renderDashboard(){
  try{
  // Company
  const addrEl=document.getElementById('dashCompanyAddr');
  const contactEl=document.getElementById('dashCompanyContact');
  let c={};
  try{ c=JSON.parse(localStorage.getItem('cs7_company')||'null')||{}; }catch(e){ c={}; }
  if(typeof COMPANY_DEFAULTS!=='undefined') c=Object.assign({}, COMPANY_DEFAULTS, c||{});
  if(addrEl) addrEl.textContent=c.address||'210 Shagun Palace\n3 Sapru Marg, Hazratganj, Lucknow 226001';
  if(contactEl){
    const ph1 = c.phone || '0522 4049754';
    const ph2 = c.phone2 || '7458014000';
    const em = c.email || 'info@centurysolution.co.in';
    const parts = [];
    if(ph1) parts.push(ph1);
    if(ph2) parts.push(ph2);
    if(em) parts.push(em);
    if(c.gst) parts.push('GSTIN: '+c.gst);
    contactEl.textContent = parts.join('  ·  ');
  }

  // Logged in as
  let sess=null, p=null;
  try{ sess=typeof getSession==='function'?getSession():null; }catch(e){}
  try{ p=typeof getUserProfile==='function'?getUserProfile():null; }catch(e){}
  const un=document.getElementById('dashUserName');
  const ud=document.getElementById('dashUserDesig');
  const uc=document.getElementById('dashUserContact');
  const side=document.getElementById('sidebarSig');
  const name=(sess&&sess.name)||(p&&p.name)||(side&&side.textContent)||'—';
  const desig=(sess&&sess.desig)||(p&&p.desig)||'';
  if(un) un.textContent=name;
  if(ud) ud.textContent=desig+(sess&&sess.role==='admin'?' · Admin':'');
  if(uc){
    const bits=[];
    let mobile = (p&&p.mobile)||'';
    let mobile2 = (p&&p.mobile2)||'';
    let email = (p&&p.email)||(sess&&sess.id)||'';
    let reportsTo = (sess&&sess.reportsToName)||'';
    try{
      const users = typeof getUsers==='function'?getUsers():[];
      const me = users.find(u=>sess&&String(u.id).toLowerCase()===String(sess.id).toLowerCase());
      if(me){
        if(!mobile && me.mobile) mobile = me.mobile;
        if(!mobile2 && me.mobile2) mobile2 = me.mobile2;
        if(me.reportsToName) reportsTo = me.reportsToName;
        if(me.email && !email) email = me.email;
      }
    }catch(e){}
    if(mobile) bits.push(mobile);
    if(mobile2) bits.push(mobile2);
    if(email) bits.push(email);
    if(reportsTo) bits.push('Reports to: '+reportsTo);
    uc.textContent = bits.join(' · ') || '—';
  }

  // Counts
  try{ if(typeof loadOrders==='function') loadOrders(); }catch(e){}
  const docs=(typeof saved!=='undefined' && Array.isArray(saved))?saved:[];
  const offers=docs.filter(d=>d.type==='offer');
  const pos=docs.filter(d=>d.type==='po');
  const pis=docs.filter(d=>d.type==='pi');
  const ords=(typeof ordersDB!=='undefined' && Array.isArray(ordersDB))?ordersDB:[];
  const live=ords.filter(o=>o.status==='live'||o.status==='onhold');
  const delayed=ords.filter(o=>{ try{ return typeof isOrderDelayed==='function'&&isOrderDelayed(o);}catch(e){return false;} });
  const completed=ords.filter(o=>o.status==='completed');
  const liveVal=live.reduce((s,o)=>s+(parseFloat(o.value)||0),0);
  const clientsN=(typeof clientsDB!=='undefined'&&Array.isArray(clientsDB))?clientsDB.length:0;

  const cards=document.getElementById('dashCards');
  if(cards){
    cards.innerHTML=
      '<div class="dash-card"><div class="dc-label">Offers</div><div class="dc-value">'+offers.length+'</div></div>'+
      '<div class="dash-card"><div class="dc-label">PO / PI</div><div class="dc-value">'+pos.length+' / '+pis.length+'</div></div>'+
      '<div class="dash-card"><div class="dc-label">Live Orders</div><div class="dc-value">'+live.length+'</div><div class="dc-sub">₹ '+(typeof fmt==='function'?fmt(liveVal):liveVal)+'</div></div>'+
      '<div class="dash-card"><div class="dc-label">Delayed</div><div class="dc-value" style="color:'+(delayed.length?'#b91c1c':'inherit')+'">'+delayed.length+'</div></div>'+
      '<div class="dash-card"><div class="dc-label">Completed</div><div class="dc-value">'+completed.length+'</div></div>'+
      '<div class="dash-card"><div class="dc-label">Clients</div><div class="dc-value">'+clientsN+'</div></div>';
  }

  const dd=document.getElementById('dashDate');
  if(dd) dd.textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});

  const liveEl=document.getElementById('dashLiveOrders');
  if(liveEl){
    if(!live.length) liveEl.innerHTML='<span style="color:var(--muted);font-size:.75rem">No live orders</span>';
    else liveEl.innerHTML=live.slice(0,8).map(function(o){
      var del=false; try{ del=typeof isOrderDelayed==='function'&&isOrderDelayed(o);}catch(e){}
      return '<div style="padding:5px 0;border-bottom:1px solid var(--line);font-size:.75rem;cursor:pointer" onclick="showView(\'orders\');openTrackModal(\''+o.id+'\')">'+
        '<b>'+esc(o.orderNo)+'</b> · '+esc(o.client)+(del?' <span style="color:#b91c1c;font-weight:700">DELAYED</span>':'')+
        '<div style="color:var(--muted)">'+esc((o.scopes||[]).join(', '))+' · Plan end: '+esc(o.planEnd||'—')+'</div></div>';
    }).join('');
  }
  const rec=document.getElementById('dashRecentDocs');
  if(rec){
    if(!docs.length) rec.innerHTML='<span style="color:var(--muted);font-size:.75rem">No documents yet</span>';
    else rec.innerHTML=docs.slice(0,8).map(function(d){
      var id=String(d.id);
      return '<div style="padding:5px 0;border-bottom:1px solid var(--line);font-size:.75rem;display:flex;justify-content:space-between;gap:6px;align-items:center">'+
        '<div><b>'+esc(d.ref)+'</b> · '+esc(d.type)+' · '+esc(d.client)+' · ₹ '+(typeof fmt==='function'?fmt(d.amount):d.amount)+'</div>'+
        '<span style="white-space:nowrap"><button class="btn-xs" onclick="viewSavedDoc(\''+id+'\')">View</button> <button class="btn-xs" onclick="editSavedDoc(\''+id+'\')">Edit</button></span></div>';
    }).join('');
  }
  }catch(err){ console.error('renderDashboard', err); }
}

/* ===== ORDER FORM ===== */
function openOrderForm(id){
  const o=id?ordersDB.find(x=>String(x.id)===String(id)):null;
  document.getElementById('orderModalTitle').textContent=o?'Edit Order':'New Order';
  document.getElementById('ordId').value=o?o.id:'';
  const t=new Date().toISOString().slice(0,10);
  document.getElementById('ordNo').value=o?o.orderNo:('ORD/'+t.slice(0,4)+'/'+String(Math.floor(Math.random()*900)+100));
  document.getElementById('ordDate').value=o?o.date:t;
  document.getElementById('ordLinkRef').value=o?o.linkRef||'':'';
  const lpi=document.getElementById('ordLinkPI'); if(lpi) lpi.value=o?o.linkPI||'':'';
  document.getElementById('ordStatus').value=o?o.status:'live';
  document.getElementById('ordClient').value=o?o.client:'';
  document.getElementById('ordContact').value=o?o.contact||'':'';
  document.getElementById('ordMobile').value=o?o.mobile||'':'';
  document.getElementById('ordProject').value=o?o.project||'':'';
  document.getElementById('ordEndClient').value=o?o.endClient||'':'';
  document.getElementById('ordAddress').value=o?o.address||'':'';
  document.getElementById('ordDesc').value=o?o.desc||'':'';
  document.getElementById('ordValue').value=o?o.value||0:0;
  document.getElementById('ordPlanStart').value=o?o.planStart||'':'';
  document.getElementById('ordPlanEnd').value=o?o.planEnd||'':'';
  document.getElementById('ordRemarks').value=o?o.remarks||'':'';
  ordScopesSelected=o&&o.scopes?o.scopes.slice():['Service'];
  renderOrdScopeChips();
  window._ordSchedule=o&&o.schedule?JSON.parse(JSON.stringify(o.schedule)):[];
  if(!window._ordSchedule.length) window._ordSchedule=[{activity:'Mobilization',planDate:'',actualDate:'',status:'pending',notes:''}];
  renderOrdSchedRows();
  document.getElementById('orderModal').classList.add('show');
}
function closeOrderModal(){ document.getElementById('orderModal').classList.remove('show'); }

function renderOrdScopeChips(){
  const el=document.getElementById('ordScopeChips');
  if(!el) return;
  el.innerHTML=ORD_SCOPES.map(s=>{
    const on=ordScopesSelected.includes(s);
    return `<span class="chip ${on?'on':''}" onclick="toggleOrdScope('${s}')">${s}</span>`;
  }).join('');
}
function toggleOrdScope(s){
  if(ordScopesSelected.includes(s)) ordScopesSelected=ordScopesSelected.filter(x=>x!==s);
  else ordScopesSelected.push(s);
  if(!ordScopesSelected.length) ordScopesSelected=['Supply'];
  renderOrdScopeChips();
}

function renderOrdSchedRows(){
  const el=document.getElementById('ordSchedRows');
  if(!el) return;
  el.innerHTML=window._ordSchedule.map((r,i)=>`
    <div style="display:grid;grid-template-columns:1.4fr 100px 100px 100px 1fr 28px;gap:4px;margin-bottom:4px;align-items:center">
      <input value="${esc(r.activity)}" onchange="_ordSchedule[${i}].activity=this.value" placeholder="Activity">
      <input type="date" value="${esc(r.planDate||'')}" onchange="_ordSchedule[${i}].planDate=this.value" title="Plan date">
      <input type="date" value="${esc(r.actualDate||'')}" onchange="_ordSchedule[${i}].actualDate=this.value" title="Actual date">
      <select onchange="_ordSchedule[${i}].status=this.value">
        <option value="pending" ${r.status==='pending'?'selected':''}>Pending</option>
        <option value="ongoing" ${r.status==='ongoing'?'selected':''}>Ongoing</option>
        <option value="done" ${r.status==='done'?'selected':''}>Done</option>
        <option value="delayed" ${r.status==='delayed'?'selected':''}>Delayed</option>
      </select>
      <input value="${esc(r.notes||'')}" onchange="_ordSchedule[${i}].notes=this.value" placeholder="Notes">
      <button class="del-btn" style="width:24px;height:24px" onclick="_ordSchedule.splice(${i},1);renderOrdSchedRows()">×</button>
    </div>
    <div style="font-size:.6rem;color:var(--muted);margin:-2px 0 6px 2px">Activity · Plan · Actual · Status · Notes</div>
  `).join('');
}
function addOrdSchedRow(){
  window._ordSchedule.push({activity:'',planDate:'',actualDate:'',status:'pending',notes:''});
  renderOrdSchedRows();
}


function syncOrderToSiteProjects(order){
  try{
    if(typeof spProjects!=='function') return;
    const projs = spProjects();
    let changed = false;
    projs.forEach(p=>{
      if(String(p.orderId)===String(order.id) || (p.poNumber && order.orderNo && String(p.poNumber)===String(order.orderNo))){
        if(order.schedule) p.importedSchedule = order.schedule;
        // progress from done activities
        if(order.schedule && order.schedule.length){
          const done = order.schedule.filter(s=>s.status==='done').length;
          const pct = Math.round((done/order.schedule.length)*100);
          if(pct > (parseFloat(p.overallProgress)||0)) p.overallProgress = pct;
        }
        if(order.status==='completed') p.status = 'Closed';
        changed = true;
      }
    });
    if(changed){
      if(typeof spSave==='function' && typeof SP_PROJ!=='undefined') spSave(SP_PROJ, projs);
      else localStorage.setItem('cs11_site_projects', JSON.stringify(projs));
    }
  }catch(e){}
}

function saveOrder(){
  const orderNo=(document.getElementById('ordNo').value||'').trim();
  const client=(document.getElementById('ordClient').value||'').trim();
  if(!orderNo||!client){ toast('Order No and Client required'); return; }
  const id=document.getElementById('ordId').value||(Date.now()+Math.random());
  const row={
    id, orderNo,
    date:document.getElementById('ordDate').value,
    linkRef:document.getElementById('ordLinkRef').value,
    linkPI:(document.getElementById('ordLinkPI')||{}).value||'',
    status:document.getElementById('ordStatus').value,
    client, contact:document.getElementById('ordContact').value,
    mobile:document.getElementById('ordMobile').value,
    project:document.getElementById('ordProject').value,
    endClient:document.getElementById('ordEndClient').value,
    address:document.getElementById('ordAddress').value,
    scopes:ordScopesSelected.slice(),
    desc:document.getElementById('ordDesc').value,
    value:parseFloat(document.getElementById('ordValue').value)||0,
    planStart:document.getElementById('ordPlanStart').value,
    planEnd:document.getElementById('ordPlanEnd').value,
    remarks:document.getElementById('ordRemarks').value,
    schedule:JSON.parse(JSON.stringify(window._ordSchedule||[])),
    updatedAt:new Date().toISOString()
  };
  // auto mark delayed activities
  const today=new Date().toISOString().slice(0,10);
  row.schedule.forEach(s=>{
    if(s.status!=='done' && s.planDate && s.planDate < today && !s.actualDate) s.status='delayed';
  });
  const ix=ordersDB.findIndex(x=>String(x.id)===String(id));
  if(ix>=0) ordersDB[ix]=row; else ordersDB.unshift(row);
  saveOrdersDB();
  try{ syncOrderToSiteProjects(row); }catch(e){}
  closeOrderModal();
  renderOrdersList();
  toast('Order saved');
}

function renderOrdersList(){
  const filter=(document.getElementById('ordFilter')||{}).value||'live';
  const el=document.getElementById('ordersList');
  if(!el) return;
  let list=ordersDB.slice();
  if(filter==='live') list=list.filter(o=>o.status==='live'||o.status==='onhold');
  else if(filter==='completed') list=list.filter(o=>o.status==='completed');
  else if(filter==='delayed') list=list.filter(isOrderDelayed);

  if(!list.length){ el.innerHTML='<p class="empty-msg">No orders in this filter</p>'; return; }

  el.innerHTML=list.map(o=>{
    const del=isOrderDelayed(o);
    const done=(o.schedule||[]).filter(s=>s.status==='done').length;
    const total=(o.schedule||[]).length;
    const pct=total?Math.round(done/total*100):0;
    const badge=o.status==='completed'?'#0f766e':del?'#b91c1c':o.status==='onhold'?'#a16207':'#1a56a8';
    return `<div class="block" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <b style="color:var(--blue)">${esc(o.orderNo)}</b>
            <span style="font-size:.65rem;font-weight:700;padding:2px 8px;border-radius:10px;background:${badge};color:#fff">${esc(o.status)}${del&&o.status==='live'?' · DELAYED':''}</span>
            <span style="font-size:.7rem;color:var(--muted)">${esc(o.date)}</span>
          </div>
          <div style="margin-top:4px;font-size:.8rem"><b style="cursor:pointer;color:var(--blue)" title="Open Customer 360°" onclick="event.stopPropagation();if(typeof openCustomer360==='function')openCustomer360('${String(o.client||'').replace(/'/g,"\\'")}')">${esc(o.client)}</b>${o.project?' · '+esc(o.project):''}</div>
          <div style="font-size:.72rem;color:var(--muted);margin-top:2px">${esc((o.scopes||[]).join(' + '))} · ₹ ${typeof fmt==='function'?fmt(o.value):o.value}</div>
          <div style="margin-top:6px;height:6px;background:#e5eaf2;border-radius:3px;max-width:220px">
            <div style="height:100%;width:${pct}%;background:${pct===100?'#0f766e':'#1a56a8'};border-radius:3px"></div>
          </div>
          <div style="font-size:.65rem;color:var(--muted);margin-top:2px">Progress ${done}/${total} activities (${pct}%)</div>
        </div>
        <div style="display:flex;gap:4px;align-items:flex-start;flex-wrap:wrap">
          <button class="btn-sm" onclick="viewOrder('${o.id}')">View</button>
          <button class="btn-sm" onclick="openTrackModal('${o.id}')">Tracking</button>
          <button class="btn-sm" onclick="createPIFromOrder('${o.id}')">Create PI</button>
          <button class="btn-sm" onclick="openOrder360('${o.id}')">360°</button>
          <button class="btn-sm" onclick="openOrderForm('${o.id}')">Edit</button>
          ${o.status!=='completed'?`<button class="btn-sm" style="background:#ecfdf5;color:#0f766e;border-color:#a7f3d0" onclick="markOrderDone('${o.id}')">Complete</button>`:''}
          <button class="del-btn" style="width:auto;padding:4px 8px;height:auto" onclick="deleteOrder('${o.id}')">×</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function viewOrder(id){
  const o=ordersDB.find(x=>String(x.id)===String(id));
  if(!o) return;
  const lines=[
    'Order: '+(o.orderNo||''),
    'Date: '+(o.date||''),
    'Status: '+(o.status||''),
    'Client: '+(o.client||''),
    'Contact: '+(o.contact||'')+' '+(o.mobile||''),
    'Project: '+(o.project||''),
    'End Client: '+(o.endClient||''),
    'Scopes: '+((o.scopes||[]).join(', ')),
    'Value: ₹ '+(o.value||0),
    'Plan: '+(o.planStart||'')+' → '+(o.planEnd||''),
    'Linked: '+(o.linkRef||'')+' / PI: '+(o.linkPI||''),
    'Address: '+(o.address||''),
    'Remarks: '+(o.remarks||''),
    '',
    'Schedule:',
    ...(o.schedule||[]).map((s,i)=>(i+1)+'. '+(s.activity||'')+' | Plan '+(s.planDate||'—')+' | Actual '+(s.actualDate||'—')+' | '+(s.status||''))
  ].join('\\n');
  alert(lines);
}
function markOrderDone(id){
  const o=ordersDB.find(x=>String(x.id)===String(id));
  if(!o) return;
  if(!confirm('Mark order '+o.orderNo+' as Completed? It will leave Live list.')) return;
  o.status='completed';
  (o.schedule||[]).forEach(s=>{ if(s.status!=='done'){ s.status='done'; if(!s.actualDate) s.actualDate=new Date().toISOString().slice(0,10); }});
  o.updatedAt=new Date().toISOString();
  saveOrdersDB(); renderOrdersList(); toast('Order completed');
}
function deleteOrder(id){
  if(!confirm('Delete this order?')) return;
  ordersDB=ordersDB.filter(x=>String(x.id)!==String(id));
  saveOrdersDB(); renderOrdersList();
}

/* Tracking modal */
function openTrackModal(id){
  const o=ordersDB.find(x=>String(x.id)===String(id));
  if(!o) return;
  _trackOrderId=o.id;
  _trackSchedule=JSON.parse(JSON.stringify(o.schedule||[]));
  document.getElementById('trackTitle').textContent='Tracking — '+o.orderNo+' · '+o.client;
  const body=document.getElementById('trackBody');
  const today=new Date().toISOString().slice(0,10);
  body.innerHTML=`
    <div style="font-size:.78rem;margin-bottom:10px">
      <b>Scopes:</b> ${esc((o.scopes||[]).join(', '))} ·
      <b>Plan:</b> ${esc(o.planStart||'—')} → ${esc(o.planEnd||'—')} ·
      <b>Status:</b> ${esc(o.status)}
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <b style="font-size:.8rem">Activity Tracking Sheet</b>
      <button class="btn-sm" onclick="addTrackRow()">+ Activity</button>
    </div>
    <div style="overflow:auto">
      <table class="rpt-table" style="font-size:.72rem">
        <thead><tr><th>#</th><th>Activity</th><th>Plan Date</th><th>Actual Date</th><th>Status</th><th>Delay (days)</th><th>Notes</th><th></th></tr></thead>
        <tbody id="trackTableBody"></tbody>
      </table>
    </div>
  `;
  renderTrackTable();
  document.getElementById('trackModal').classList.add('show');
}
function closeTrackModal(){ document.getElementById('trackModal').classList.remove('show'); }
function delayDays(plan, actual){
  if(!plan) return '';
  const end=actual||new Date().toISOString().slice(0,10);
  const d=Math.round((new Date(end)-new Date(plan))/(1000*60*60*24));
  if(d>0) return d;
  if(d<0) return d;
  return 0;
}
function renderTrackTable(){
  const tb=document.getElementById('trackTableBody');
  if(!tb) return;
  const today=new Date().toISOString().slice(0,10);
  tb.innerHTML=_trackSchedule.map((r,i)=>{
    const del=delayDays(r.planDate, r.actualDate||(r.status==='done'?r.actualDate:today));
    const delShow=r.planDate?(del>0?`<span style="color:#b91c1c;font-weight:700">+${del}</span>`:del<0?`<span style="color:#0f766e">${del}</span>`:'0'):'—';
    return `<tr>
      <td>${i+1}</td>
      <td><input value="${esc(r.activity)}" onchange="_trackSchedule[${i}].activity=this.value" style="min-width:120px"></td>
      <td><input type="date" value="${esc(r.planDate||'')}" onchange="_trackSchedule[${i}].planDate=this.value"></td>
      <td><input type="date" value="${esc(r.actualDate||'')}" onchange="_trackSchedule[${i}].actualDate=this.value"></td>
      <td><select onchange="_trackSchedule[${i}].status=this.value">
        <option value="pending" ${r.status==='pending'?'selected':''}>Pending</option>
        <option value="ongoing" ${r.status==='ongoing'?'selected':''}>Ongoing</option>
        <option value="done" ${r.status==='done'?'selected':''}>Done</option>
        <option value="delayed" ${r.status==='delayed'?'selected':''}>Delayed</option>
      </select></td>
      <td>${delShow}</td>
      <td><input value="${esc(r.notes||'')}" onchange="_trackSchedule[${i}].notes=this.value" style="min-width:100px"></td>
      <td><button class="del-btn" style="width:22px;height:22px" onclick="_trackSchedule.splice(${i},1);renderTrackTable()">×</button></td>
    </tr>`;
  }).join('');
}
function addTrackRow(){
  _trackSchedule.push({activity:'',planDate:'',actualDate:'',status:'pending',notes:''});
  renderTrackTable();
}
function saveTrackFromModal(){
  const o=ordersDB.find(x=>String(x.id)===String(_trackOrderId));
  if(!o) return;
  const today=new Date().toISOString().slice(0,10);
  _trackSchedule.forEach(s=>{
    if(s.status!=='done' && s.planDate && s.planDate < today && !s.actualDate) s.status='delayed';
  });
  o.schedule=_trackSchedule;
  o.updatedAt=new Date().toISOString();
  // auto complete if all done
  if(_trackSchedule.length && _trackSchedule.every(s=>s.status==='done')){
    if(confirm('All activities done. Mark order as Completed?')) o.status='completed';
  }
  saveOrdersDB();
  closeTrackModal();
  renderOrdersList();
  toast('Tracking saved');
}

/* Excel exports */
function exportOrdersExcel(){
  if(!ordersDB.length){ toast('No orders'); return; }
  const headers=['Order No','Date','Status','Client','Contact','Mobile','Project','End Client','Scopes','Value','Plan Start','Plan End','Link Ref','Link PI','Address','Remarks'];
  const rows=ordersDB.map(function(o){
    return [o.orderNo||'', o.date||'', o.status||'', o.client||'', o.contact||'', o.mobile||'', o.project||'', o.endClient||'', (o.scopes||[]).join(' + '), parseFloat(o.value)||0, o.planStart||'', o.planEnd||'', o.linkRef||'', o.linkPI||'', o.address||'', o.remarks||''];
  });
  if(typeof downloadColorExcel==='function'){
    downloadColorExcel('CENTURY_Orders_'+new Date().toISOString().slice(0,10)+'.xls','Orders',headers,rows);
  } else {
    downloadCSV('orders.csv', headers, rows);
  }
  toast('Orders Excel downloaded');
}

function exportTrackingExcel(){
  const headers=['Order No','Client','Activity','Plan Date','Actual Date','Status','Notes','Delay Days'];
  const rows=[];
  const today=new Date().toISOString().slice(0,10);
  ordersDB.forEach(function(o){
    (o.schedule||[]).forEach(function(s){
      let delay='';
      if(s.planDate && s.status!=='done' && s.planDate < today){
        delay=Math.round((new Date(today)-new Date(s.planDate))/86400000);
      } else if(s.planDate && s.actualDate && s.actualDate > s.planDate){
        delay=Math.round((new Date(s.actualDate)-new Date(s.planDate))/86400000);
      }
      rows.push([o.orderNo||'', o.client||'', s.activity||'', s.planDate||'', s.actualDate||'', s.status||'', s.notes||'', delay]);
    });
  });
  if(!rows.length){ toast('No tracking rows'); return; }
  if(typeof downloadColorExcel==='function'){
    downloadColorExcel('CENTURY_Tracking_'+new Date().toISOString().slice(0,10)+'.xls','Tracking',headers,rows);
  } else downloadCSV('tracking.csv', headers, rows);
  toast('Tracking Excel downloaded');
}

function createPIFromOrder(orderId){
  const o=ordersDB.find(x=>String(x.id)===String(orderId));
  if(!o) return;
  showView('create');
  setDocType('pi');
  document.getElementById('refNo').value=nextDocRef('pi');
  document.getElementById('clientName').value=o.client||'';
  document.getElementById('clientContact').value=o.contact||'';
  document.getElementById('clientPhone').value=o.mobile||'';
  document.getElementById('clientAddress').value=o.address||'';
  document.getElementById('project').value=o.project||'';
  document.getElementById('subject').value='Proforma Invoice against Order '+o.orderNo;
  document.getElementById('subject').dataset.auto='0';
  // scopes
  if(o.scopes&&o.scopes.length){ scopes=o.scopes.slice(); renderScopes(); updateIntro(); updateAddButtons(); }
  // store link on order
  o.linkPI = document.getElementById('refNo').value;
  o.linkRef = o.linkRef || document.getElementById('refNo').value;
  saveOrdersDB();
  toast('PI opened for order '+o.orderNo+' — complete items & save');
}

function importOrdersExcel(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file) return;
  toast('Reading Orders…');
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      if(typeof parseExcelFile!=='function' && typeof parseExcelWorkbook!=='function'){
        if(typeof XLSX==='undefined'){ toast('Excel library needed'); return; }
      }
      let rows=[];
      if(typeof parseExcelWorkbook==='function'){
        parseExcelWorkbook(file, e.target.result).forEach(p=>{ rows=rows.concat(p.rows); });
      } else if(typeof XLSX!=='undefined'){
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
        const aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
        let hi=0;
        for(let i=0;i<Math.min(15,aoa.length);i++){ if(String(aoa[i]).toLowerCase().includes('client')||String(aoa[i]).toLowerCase().includes('order')){ hi=i; break; } }
        const headers=aoa[hi]||[];
        for(let i=hi+1;i<aoa.length;i++){ const o={}; headers.forEach((h,j)=>{ if(h) o[h]=aoa[i][j]; }); rows.push(o); }
      }
      let added=0, updated=0;
      rows.forEach(r=>{
        const get=(...ns)=> (typeof rowGet==='function'? rowGet(r,ns): (function(){
          const keys=Object.keys(r); for(const n of ns){ const k=keys.find(x=>String(x).toLowerCase().includes(n.toLowerCase())); if(k&&String(r[k]).trim()) return r[k]; } return '';
        })());
        const orderNo=String(get('Order No','Order Number','Ord No','Ref','Order Ref')||'').trim();
        const client=String(get('Client','Customer','Party')||'').trim();
        if(!orderNo && !client) return;
        if(/^s\s*\.?no/i.test(client)||client==='Client') return;
        const finalNo=orderNo||('ORD/'+Date.now());
        const existing=ordersDB.find(x=>String(x.orderNo)===String(finalNo));
        const st=String(get('Status')||'live').toLowerCase();
        const status=st.includes('complete')?'completed':st.includes('hold')?'onhold':st.includes('cancel')?'cancelled':'live';
        const scopes=String(get('Scopes','Scope','Enq Type','Type')||'Service').split(/[+\/,&]/).map(s=>s.trim()).filter(Boolean);
        const row={
          id: existing?existing.id:(Date.now()+Math.random()+added),
          orderNo: finalNo,
          date: (typeof excelCellDate==='function'?excelCellDate(get('Date','Order Date')):'')||new Date().toISOString().slice(0,10),
          status,
          client: client||'—',
          contact: String(get('Contact Person','Contact')||'').trim(),
          mobile: String(get('Mobile','Phone','Contact No')||'').trim(),
          project: String(get('Project')||'').trim(),
          endClient: String(get('End Client')||'').trim(),
          address: String(get('Address','Site')||'').trim(),
          scopes,
          desc: String(get('Description','Desc','Product')||'').trim(),
          value: parseFloat(String(get('Value','Amount','Order Value')).replace(/[₹,\s]/g,''))||0,
          planStart: (typeof excelCellDate==='function'?excelCellDate(get('Plan Start','Start')):'')||'',
          planEnd: (typeof excelCellDate==='function'?excelCellDate(get('Plan End','End')):'')||'',
          remarks: String(get('Remarks','Remark')||'').trim(),
          schedule: existing?(existing.schedule||[]):[],
          linkRef: String(get('Link','Offer','PI','Linked')||'').trim(),
          linkPI: existing?(existing.linkPI||''):'',
          updatedAt: new Date().toISOString()
        };
        if(existing){
          const ix=ordersDB.findIndex(x=>x.id===existing.id);
          ordersDB[ix]=Object.assign({}, existing, row, {schedule: existing.schedule&&existing.schedule.length?existing.schedule:row.schedule});
          updated++;
        } else { ordersDB.unshift(row); added++; }
      });
      saveOrdersDB();
      renderOrdersList();
      toast('Orders saved permanently: '+added+' new, '+updated+' updated');
    }catch(err){ console.error(err); toast('Orders import failed'); }
    ev.target.value='';
  };
  if(file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}
function downloadCSV(csv, name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));
  a.download=name; a.click();
}

/* Hook showView */
(function(){
  const prev=window.showView;
  window.showView=function(v){
    document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
    const view=document.getElementById('view-'+v);
    if(view) view.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
    if(v==='dashboard') renderDashboard();
    if(v==='orders') renderOrdersList();
    if(v==='reports' && typeof renderReports==='function') renderReports();
    if(v==='clients' && typeof renderCRM==='function') renderCRM('clients');
    if(v==='vendors' && typeof renderCRM==='function') renderCRM('vendors');
    if(typeof prev==='function' && v!=='dashboard' && v!=='orders'){
      // masters etc handled by prev if needed
    }
    if(v==='masters' && typeof renderMasterScopes==='function'){
      renderMasterScopes(); renderMasterCats(); renderMasterSOW();
      const ic=document.getElementById('itemCount');
      if(ic && typeof ITEMS!=='undefined') ic.textContent=ITEMS.length.toLocaleString();
      const cc=document.getElementById('catCount');
      if(cc && typeof CATEGORIES!=='undefined') cc.textContent=CATEGORIES.length;
    }
    if(v==='settings'){ /* settings page static */ }
  };
})();

document.addEventListener('DOMContentLoaded', function(){
  loadOrders();
  setTimeout(function(){
    if(document.getElementById('view-dashboard')) showView('dashboard');
  }, 80);
});
