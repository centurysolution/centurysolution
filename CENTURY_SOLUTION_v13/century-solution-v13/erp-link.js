/* ===== CENTURY SOLUTION — Customer ↔ Work Mapping & Linking ===== */
/* Tight bidirectional links between Clients, Documents (Offer/PO/PI), Orders */

function getClientByName(name){
  if(!name) return null;
  const n = String(name).trim().toLowerCase();
  if(!n) return null;
  const list = (typeof clientsDB !== 'undefined' && Array.isArray(clientsDB)) ? clientsDB : [];
  return list.find(c => String(c.company||c.name||'').trim().toLowerCase() === n) ||
         list.find(c => String(c.company||c.name||'').toLowerCase().includes(n)) || null;
}

function getDocsForClient(clientName){
  const n = String(clientName||'').trim().toLowerCase();
  if(!n) return [];
  const base = (typeof saved !== 'undefined' && Array.isArray(saved)) ? saved : [];
  return base.filter(d => String(d.client||'').toLowerCase().includes(n) || String(d.endClient||'').toLowerCase().includes(n));
}

function getOrdersForClient(clientName){
  const n = String(clientName||'').trim().toLowerCase();
  if(!n) return [];
  const ords = (typeof ordersDB !== 'undefined' && Array.isArray(ordersDB)) ? ordersDB : [];
  return ords.filter(o => String(o.client||'').toLowerCase().includes(n) || String(o.endClient||'').toLowerCase().includes(n));
}

function clientTotalValue(clientName){
  let t = 0;
  getDocsForClient(clientName).forEach(d => t += parseFloat(d.amount)||0);
  getOrdersForClient(clientName).forEach(o => t += parseFloat(o.value)||0);
  return t;
}

/* ===== CUSTOMER 360° MODAL ===== */
function openCustomer360(clientNameOrId){
  let client = null;
  let name = '';
  if(typeof clientNameOrId === 'object' && clientNameOrId){
    client = clientNameOrId;
    name = client.company || client.name || '';
  } else {
    name = String(clientNameOrId||'').trim();
    client = getClientByName(name);
  }
  if(!name && !client){ toast('No client selected'); return; }
  if(!name) name = client.company || client.name || '';

  const docs = getDocsForClient(name);
  const ords = getOrdersForClient(name);
  const offers = docs.filter(d=>d.type==='offer');
  const pos = docs.filter(d=>d.type==='po');
  const pis = docs.filter(d=>d.type==='pi');
  const liveOrds = ords.filter(o=>o.status==='live'||o.status==='onhold');
  const totalVal = clientTotalValue(name);
  const siteProjs = (typeof getSiteProjectsForClient==='function') ? getSiteProjectsForClient(name) : [];

  const modal = document.getElementById('customer360Modal');
  if(!modal){ console.warn('customer360Modal missing'); return; }

  document.getElementById('c360Title').textContent = name || 'Customer 360°';
  document.getElementById('c360Sub').textContent = (client && client.city) ? (client.city + (client.gstin ? ' · GSTIN: '+client.gstin : '')) : (client ? 'Registered client' : 'Not in master — create from Contacts');

  // KPIs
  const kpi = document.getElementById('c360Kpis');
  kpi.innerHTML = `
    <div class="c360-kpi"><div class="k-lab">Offers</div><div class="k-val">${offers.length}</div></div>
    <div class="c360-kpi"><div class="k-lab">PO / PI</div><div class="k-val">${pos.length} / ${pis.length}</div></div>
    <div class="c360-kpi"><div class="k-lab">Live Orders</div><div class="k-val">${liveOrds.length}</div></div>
    <div class="c360-kpi"><div class="k-lab">Total Value</div><div class="k-val">₹ ${typeof fmt==='function'?fmt(totalVal):totalVal.toLocaleString('en-IN')}</div></div>
  `;

  // Profile
  const prof = document.getElementById('c360Profile');
  if(client){
    const contacts = (client.contacts||[]).map(c=>`${esc(c.name||'')} ${c.mobile?'· '+esc(c.mobile):''}`).join('<br>') || '—';
    prof.innerHTML = `
      <div class="c360-grid">
        <div><label>Company</label><div class="c360-v">${esc(client.company||client.name||'')}</div></div>
        <div><label>Code</label><div class="c360-v">${esc(client.code||'—')}</div></div>
        <div><label>City / PIN</label><div class="c360-v">${esc(client.city||'—')} ${client.pin||''}</div></div>
        <div><label>GSTIN / PAN</label><div class="c360-v">${esc(client.gstin||'—')} / ${esc(client.pan||'—')}</div></div>
        <div class="full"><label>Address</label><div class="c360-v">${esc(client.address||'—')}</div></div>
        <div><label>Email</label><div class="c360-v">${esc(client.email||'—')}</div></div>
        <div><label>Phone</label><div class="c360-v">${esc(client.phone||'—')}</div></div>
        <div class="full"><label>Contacts</label><div class="c360-v">${contacts}</div></div>
      </div>`;
  } else {
    prof.innerHTML = `<p style="color:var(--muted);font-size:.8rem">This name is not yet in Clients master. You can still create documents. <button class="btn-sm" onclick="closeCustomer360();showView('clients');setTimeout(()=>openCRMForm('clients'),200)">+ Add to Clients</button></p>`;
  }

  // Documents
  const docEl = document.getElementById('c360Docs');
  if(!docs.length){
    docEl.innerHTML = '<p class="empty-msg" style="padding:12px">No offers / PO / PI yet</p>';
  } else {
    docEl.innerHTML = docs.slice(0,30).map(d=>{
      const id = String(d.id);
      return `<div class="c360-row">
        <div><b>${esc(d.ref||'—')}</b> <span class="badge badge-${d.type}">${(d.type||'').toUpperCase()}</span>
          <div style="font-size:.7rem;color:var(--muted)">${esc(d.date||'')} · ${esc(d.project||'')} · ₹ ${typeof fmt==='function'?fmt(d.amount):d.amount}</div>
        </div>
        <div class="c360-acts">
          <button class="btn-xs" onclick="closeCustomer360();viewSavedDoc('${id}')">View</button>
          <button class="btn-xs" onclick="closeCustomer360();editSavedDoc('${id}')">Edit</button>
        </div>
      </div>`;
    }).join('');
  }

  // Orders
  const ordEl = document.getElementById('c360Orders');
  if(!ords.length){
    ordEl.innerHTML = '<p class="empty-msg" style="padding:12px">No orders yet</p>';
  } else {
    ordEl.innerHTML = ords.slice(0,20).map(o=>{
      const del = (typeof isOrderDelayed==='function' && isOrderDelayed(o));
      return `<div class="c360-row">
        <div><b>${esc(o.orderNo)}</b> <span class="badge" style="background:${o.status==='completed'?'#0f766e':del?'#b91c1c':'#1a56a8'}">${esc(o.status)}${del?' · DELAYED':''}</span>
          <div style="font-size:.7rem;color:var(--muted)">${esc((o.scopes||[]).join(', '))} · ₹ ${typeof fmt==='function'?fmt(o.value):o.value} · Plan end: ${esc(o.planEnd||'—')}</div>
        </div>
        <div class="c360-acts">
          <button class="btn-xs" onclick="closeCustomer360();showView('orders');setTimeout(()=>openTrackModal('${o.id}'),150)">Track</button>
          <button class="btn-xs" onclick="closeCustomer360();showView('orders');setTimeout(()=>openOrderForm('${o.id}'),150)">Edit</button>
        </div>
      </div>`;
    }).join('');
  }

  // Quick actions
  document.getElementById('c360Actions').innerHTML = `
    <button class="btn-main" onclick="closeCustomer360();startDocForClient('${esc(name).replace(/'/g,"\\'")}','offer')">+ New Offer</button>
    <button class="btn-ghost" onclick="closeCustomer360();startDocForClient('${esc(name).replace(/'/g,"\\'")}','po')">+ PO</button>
    <button class="btn-ghost" onclick="closeCustomer360();startDocForClient('${esc(name).replace(/'/g,"\\'")}','pi')">+ PI</button>
    <button class="btn-ok" onclick="closeCustomer360();startOrderForClient('${esc(name).replace(/'/g,"\\'")}')">+ New Order</button>
    ${client ? `<button class="btn-ghost" onclick="closeCustomer360();showView('clients');setTimeout(()=>{ if(typeof openCRMForm==='function') openCRMForm('clients', client); },200)">Edit Profile</button>` : ''}
  `;

  // Tabs default
  switchC360Tab('profile');
  modal.classList.add('show');
}

function closeCustomer360(){
  const m = document.getElementById('customer360Modal');
  if(m) m.classList.remove('show');
}

function switchC360Tab(tab){
  ['profile','docs','orders'].forEach(t=>{
    const panel = document.getElementById('c360Tab-'+t);
    const btn = document.querySelector('[data-c360="'+t+'"]');
    if(panel) panel.style.display = (t===tab) ? 'block' : 'none';
    if(btn) btn.classList.toggle('active', t===tab);
  });
}

function startDocForClient(clientName, type){
  showView('create');
  if(typeof setDocType==='function') setDocType(type||'offer');
  const el = document.getElementById('clientName');
  if(el){
    el.value = clientName;
    // try auto-fill from master
    const c = getClientByName(clientName);
    if(c){
      const set = (id,v)=>{ const e=document.getElementById(id); if(e&&v) e.value=v; };
      set('clientAddress', c.address);
      set('clientEmail', c.email);
      set('clientPhone', c.phone || (c.contacts&&c.contacts[0]&&c.contacts[0].mobile));
      set('clientGST', c.gstin);
      if(c.contacts && c.contacts[0]) set('clientContact', c.contacts[0].name);
    }
  }
  if(typeof updateIntro==='function') updateIntro();
  toast('Document ready for '+clientName);
}

function startOrderForClient(clientName){
  showView('orders');
  setTimeout(()=>{
    if(typeof openOrderForm==='function'){
      openOrderForm();
      const el = document.getElementById('ordClient');
      if(el) el.value = clientName;
      const c = getClientByName(clientName);
      if(c){
        const set = (id,v)=>{ const e=document.getElementById(id); if(e&&v) e.value=v; };
        set('ordAddress', c.address);
        set('ordMobile', c.phone || (c.contacts&&c.contacts[0]&&c.contacts[0].mobile));
        if(c.contacts&&c.contacts[0]) set('ordContact', c.contacts[0].name);
      }
    }
  }, 120);
}

/* ===== GLOBAL SEARCH ===== */
function runGlobalSearch(q){
  q = (q||'').trim().toLowerCase();
  const box = document.getElementById('globalSearchResults');
  if(!box) return;
  if(!q || q.length < 2){ box.style.display='none'; box.innerHTML=''; return; }

  const results = [];
  // Clients
  (typeof clientsDB!=='undefined'?clientsDB:[]).forEach(c=>{
    if((c.name||'').toLowerCase().includes(q) || (c.city||'').toLowerCase().includes(q) || (c.code||'').toLowerCase().includes(q)){
      results.push({type:'client', label:c.name, sub:(c.city||'')+' · Client', action:()=>openCustomer360(c)});
    }
  });
  // Docs
  (typeof saved!=='undefined'?saved:[]).slice(0,200).forEach(d=>{
    const hay = ((d.ref||'')+' '+(d.client||'')+' '+(d.project||'')+' '+(d.product||'')).toLowerCase();
    if(hay.includes(q)){
      results.push({type:d.type, label:d.ref||d.type, sub:(d.client||'')+' · ₹'+(d.amount||0), action:()=>{closeGlobalSearch();viewSavedDoc(String(d.id));}});
    }
  });
  // Orders
  (typeof ordersDB!=='undefined'?ordersDB:[]).forEach(o=>{
    const hay = ((o.orderNo||'')+' '+(o.client||'')+' '+(o.project||'')).toLowerCase();
    if(hay.includes(q)){
      results.push({type:'order', label:o.orderNo, sub:(o.client||'')+' · '+o.status, action:()=>{closeGlobalSearch();showView('orders');setTimeout(()=>openTrackModal(o.id),100);}});
    }
  });

  if(!results.length){
    box.innerHTML = '<div class="gs-item" style="color:var(--muted)">No matches</div>';
  } else {
    box.innerHTML = results.slice(0,18).map((r,i)=>`
      <div class="gs-item" onclick="globalSearchPick(${i})">
        <span class="badge badge-${r.type||'client'}">${(r.type||'client').toUpperCase()}</span>
        <div><b>${esc(r.label)}</b><div style="font-size:.68rem;color:var(--muted)">${esc(r.sub)}</div></div>
      </div>`).join('');
    window._gsResults = results;
  }
  box.style.display = 'block';
}

function globalSearchPick(i){
  const r = (window._gsResults||[])[i];
  if(r && r.action) r.action();
  closeGlobalSearch();
}

function closeGlobalSearch(){
  const box = document.getElementById('globalSearchResults');
  if(box){ box.style.display='none'; box.innerHTML=''; }
  const inp = document.getElementById('globalSearch');
  if(inp) inp.value='';
}

/* ===== DASHBOARD INTERACTIVITY ===== */
function dashGo(filter){
  if(filter==='offers'){ showView('reports'); setTimeout(()=>{ const s=document.getElementById('repType'); if(s){s.value='offer'; if(typeof renderReports==='function')renderReports();} },80); }
  else if(filter==='po'){ showView('reports'); setTimeout(()=>{ const s=document.getElementById('repType'); if(s){s.value='po'; if(typeof renderReports==='function')renderReports();} },80); }
  else if(filter==='pi'){ showView('reports'); setTimeout(()=>{ const s=document.getElementById('repType'); if(s){s.value='pi'; if(typeof renderReports==='function')renderReports();} },80); }
  else if(filter==='live'){ showView('orders'); setTimeout(()=>{ const s=document.getElementById('ordFilter'); if(s){s.value='live'; if(typeof renderOrdersList==='function')renderOrdersList();} },80); }
  else if(filter==='delayed'){ showView('orders'); setTimeout(()=>{ const s=document.getElementById('ordFilter'); if(s){s.value='delayed'; if(typeof renderOrdersList==='function')renderOrdersList();} },80); }
  else if(filter==='completed'){ showView('orders'); setTimeout(()=>{ const s=document.getElementById('ordFilter'); if(s){s.value='completed'; if(typeof renderOrdersList==='function')renderOrdersList();} },80); }
  else if(filter==='clients'){ showView('clients'); }
}

/* Enhance existing renderDashboard when present */
(function enhanceDashboard(){
  const prev = window.renderDashboard;
  window.renderDashboard = function(){
    if(typeof prev === 'function') prev();
    // Make cards clickable
    const cards = document.getElementById('dashCards');
    if(cards){
      const children = cards.querySelectorAll('.dash-card');
      const map = ['offers','po','live','delayed','completed','clients'];
      children.forEach((card,i)=>{
        card.style.cursor = 'pointer';
        card.onclick = function(){ dashGo(map[i]||'offers'); };
        card.title = 'Click to open';
      });
    }
  };
})();

/* Hook client rows to open 360 when possible */
function openClientFromRow(name){
  openCustomer360(name);
}

console.log('CENTURY SOLUTION Link layer loaded');


/* ===== v13 UNIFIED 360° — Vendor / Order / Project links ===== */
function getSiteProjectsForClient(clientName){
  const n = String(clientName||'').toLowerCase();
  if(!n || typeof spProjects!=='function') return [];
  try{ return spProjects().filter(p=>String(p.customer||'').toLowerCase().includes(n)); }catch(e){ return []; }
}

function openVendor360(nameOrObj){
  let v = null, name = '';
  if(typeof nameOrObj==='object' && nameOrObj){ v = nameOrObj; name = v.company||v.name||''; }
  else {
    name = String(nameOrObj||'').trim();
    const list = (typeof vendorsDB!=='undefined'?vendorsDB:[]);
    v = list.find(x=>String(x.company||x.name||'').toLowerCase()===name.toLowerCase()) ||
        list.find(x=>String(x.company||x.name||'').toLowerCase().includes(name.toLowerCase()));
  }
  if(!name && v) name = v.company||v.name||'';
  if(!name){ toast('No vendor'); return; }
  const modal = document.getElementById('customer360Modal');
  if(!modal) return;
  document.getElementById('c360Title').textContent = name + ' — Vendor 360°';
  const sub = document.getElementById('c360Sub');
  if(sub) sub.textContent = (v && (v.city||v.gst)) ? ((v.city||'')+' · '+(v.gst||'')) : 'Vendor';
  const body = document.getElementById('c360Body') || document.querySelector('#customer360Modal .modal-body');
  // Use tabs area
  const kpis = document.getElementById('c360Kpis') || document.querySelector('#customer360Modal .c360-kpis');
  const contacts = (v && v.contacts) ? v.contacts : [];
  let html = '';
  if(kpis){
    kpis.innerHTML = '<div class="c360-kpi"><div class="k-lab">Contacts</div><div class="k-val">'+(contacts.length||0)+'</div></div>'+
      '<div class="c360-kpi"><div class="k-lab">GST</div><div class="k-val" style="font-size:.75rem">'+(v&&v.gst?v.gst:'—')+'</div></div>';
  }
  const panel = document.getElementById('c360Panel') || body;
  if(panel){
    panel.innerHTML = '<div class="c360-grid">'+
      '<div><label>Company</label><div class="c360-v">'+esc360(name)+'</div></div>'+
      '<div><label>Email</label><div class="c360-v">'+esc360(v&&v.email)+'</div></div>'+
      '<div class="full"><label>Address</label><div class="c360-v">'+esc360(v&&v.address)+'</div></div>'+
      '<div class="full"><label>Contacts</label><div class="c360-v">'+(contacts.map(c=>esc360(c.name)+' '+esc360(c.mobile)).join('<br>')||'—')+'</div></div>'+
      '</div>';
  }
  modal.classList.add('show');
}
function esc360(s){ if(s==null) return '—'; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

function openOrder360(orderId){
  try{ if(typeof loadOrders==='function') loadOrders(); }catch(e){}
  const o = (typeof ordersDB!=='undefined'?ordersDB:[]).find(x=>String(x.id)===String(orderId));
  if(!o){ toast('Order not found'); return; }
  const modal = document.getElementById('customer360Modal');
  if(!modal) return;
  document.getElementById('c360Title').textContent = (o.orderNo||'Order') + ' — 360°';
  const sub = document.getElementById('c360Sub');
  if(sub) sub.textContent = (o.client||'')+' · '+(o.status||'');
  const kpis = document.getElementById('c360Kpis') || document.querySelector('#customer360Modal .c360-kpis');
  const sched = o.schedule||[];
  const done = sched.filter(s=>s.status==='done').length;
  if(kpis){
    kpis.innerHTML = '<div class="c360-kpi"><div class="k-lab">Value</div><div class="k-val" style="font-size:.95rem">₹ '+(o.value||0)+'</div></div>'+
      '<div class="c360-kpi"><div class="k-lab">Schedule</div><div class="k-val">'+done+'/'+sched.length+'</div></div>'+
      '<div class="c360-kpi"><div class="k-lab">Status</div><div class="k-val" style="font-size:.8rem">'+(o.status||'—')+'</div></div>';
  }
  const panel = document.getElementById('c360Panel');
  const body = panel || document.querySelector('#customer360Modal .modal-body');
  // Linked site projects
  let projs = [];
  try{
    if(typeof spProjects==='function')
      projs = spProjects().filter(p=>String(p.orderId)===String(o.id) || (p.poNumber && o.orderNo && String(p.poNumber)===String(o.orderNo)));
  }catch(e){}
  if(body){
    body.innerHTML = (kpis?kpis.outerHTML:'') +
      '<div class="c360-grid" style="padding:12px">'+
      '<div><label>Client</label><div class="c360-v"><a href="#" onclick="openCustomer360(\''+String(o.client||'').replace(/'/g,"\\'")+'\');return false">'+esc360(o.client)+'</a></div></div>'+
      '<div><label>Project</label><div class="c360-v">'+esc360(o.project)+'</div></div>'+
      '<div><label>Site</label><div class="c360-v">'+esc360(o.address||o.site)+'</div></div>'+
      '<div><label>Contact</label><div class="c360-v">'+esc360(o.contact)+' '+esc360(o.mobile)+'</div></div>'+
      '</div>'+
      '<div style="padding:8px 12px"><b style="font-size:.75rem">Execution Schedule</b>'+
      (sched.length?sched.map(s=>'<div class="c360-row"><div>'+esc360(s.activity)+' · '+esc360(s.status)+'</div></div>').join(''):'<p class="empty-msg">No activities</p>')+
      '</div>'+
      '<div style="padding:8px 12px"><b style="font-size:.75rem">Site Projects</b>'+
      (projs.length?projs.map(p=>'<div class="c360-row"><div>'+esc360(p.projectId)+' '+esc360(p.name)+'</div><button class="btn-xs" onclick="closeCustomer360();openProjectHub(\''+p.id+'\')">Open</button></div>').join(''):'<p class="empty-msg">None linked</p>')+
      '</div>'+
      '<div id="c360Actions" style="padding:10px"><button class="btn-sm" onclick="closeCustomer360();openOrderForm(\''+o.id+'\')">Edit Order</button> '+
      '<button class="btn-sm" onclick="openCustomer360(\''+String(o.client||'').replace(/'/g,"\\'")+'\')">Client 360°</button></div>';
  }
  modal.classList.add('show');
}

function closeCustomer360(){
  const m = document.getElementById('customer360Modal');
  if(m) m.classList.remove('show');
}

(function(){
  const _o = window.openCustomer360;
  if(typeof _o !== 'function') return;
  window.openCustomer360 = function(a){
    _o(a);
    try{
      const name = typeof a==='object' && a ? (a.company||a.name||'') : String(a||'');
      const projs = typeof getSiteProjectsForClient==='function' ? getSiteProjectsForClient(name) : [];
      const actions = document.getElementById('c360Actions');
      if(actions && projs.length){
        let box = document.getElementById('c360SiteProjs');
        if(!box){
          box = document.createElement('div');
          box.id = 'c360SiteProjs';
          box.style.cssText = 'padding:8px 14px;border-top:1px solid var(--line)';
          actions.parentNode.insertBefore(box, actions);
        }
        box.innerHTML = '<b style="font-size:.75rem">Site Projects ('+projs.length+')</b>'+
          projs.map(function(p){
            return '<div class="c360-row"><div>'+String(p.projectId||'')+' · '+String(p.name||'')+' · '+(p.overallProgress||0)+'%</div>'+
              '<button class="btn-xs" onclick="closeCustomer360();if(typeof openProjectHub===\'function\')openProjectHub(\''+p.id+'\')">Open</button></div>';
          }).join('');
      }
    }catch(e){}
  };
})();
