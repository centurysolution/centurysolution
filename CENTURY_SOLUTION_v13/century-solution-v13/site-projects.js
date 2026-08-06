
function openOrderPickForProject(){
  try{ if(typeof loadOrders==='function') loadOrders(); }catch(e){}
  const ords = (typeof ordersDB!=='undefined' && Array.isArray(ordersDB)) ? ordersDB.slice() : [];
  const body = document.getElementById('orderPickProjBody');
  if(!body) return;
  if(!ords.length){ body.innerHTML='<p class="empty-msg">No orders. Create in Orders module first.</p>'; }
  else {
    body.innerHTML = ords.map(o=>`
      <div class="c360-row" style="cursor:pointer" onclick="selectOrderForProject('${o.id}')">
        <div>
          <b>${(o.orderNo||o.ref||o.id||'')}</b> · ${(o.client||o.customer||'').replace(/</g,'&lt;')}
          <div style="font-size:.7rem;color:var(--muted)">₹ ${(o.value||o.amount||'—')} · ${(o.status||'')} · ${(o.site||o.location||'')}</div>
        </div>
        <button type="button" class="btn-xs" onclick="event.stopPropagation();selectOrderForProject('${o.id}')">Use</button>
      </div>`).join('');
  }
  document.getElementById('orderPickProjModal').classList.add('show');
}
function closeOrderPickProj(){ document.getElementById('orderPickProjModal').classList.remove('show'); }
function selectOrderForProject(oid){
  const o = (typeof ordersDB!=='undefined'?ordersDB:[]).find(x=>String(x.id)===String(oid));
  if(!o) return;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el && v!=null && v!=='') el.value=v; };
  set('spPfOrderId', o.id);
  set('spPfName', o.project||o.title||o.orderNo||('Order '+(o.orderNo||'')));
  set('spPfCustomer', o.client||o.customer||'');
  set('spPfContact', o.contact||o.contactPerson||'');
  set('spPfPhone', o.phone||o.mobile||'');
  set('spPfEmail', o.email||'');
  set('spPfAddress', o.site||o.location||o.address||'');
  set('spPfPoNo', o.poNo||o.poNumber||o.orderNo||'');
  set('spPfPoDate', o.poDate||o.date||'');
  set('spPfPoValue', o.value||o.amount||'');
  set('spPfProjValue', o.value||o.amount||'');
  set('spPfExpected', o.due||o.delivery||o.expectedCompletion||'');
  const lab = document.getElementById('spPfOrderLabel');
  if(lab) lab.innerHTML = 'Linked order: <b>'+(o.orderNo||o.ref||o.id)+'</b> — '+(o.client||'');
  // Import execution schedule activities into project notes / instructions
  if(o.schedule && o.schedule.length){
    const lines = o.schedule.map(s => (s.activity||'')+(s.planDate?' (plan '+s.planDate+')':'')+(s.status?' ['+s.status+']':'')).filter(Boolean);
    const instr = document.getElementById('spPfInstructions');
    if(instr && lines.length){
      const prev = instr.value ? instr.value+'\n' : '';
      instr.value = prev + 'From Order Schedule:\n'+lines.join('\n');
    }
    window._spImportedSchedule = o.schedule;
  }
  // scopes from order
  if(o.scopes && o.scopes.length && document.getElementById('spPfScopes')){
    document.querySelectorAll('#spPfScopes input[type=checkbox]').forEach(cb=>{
      if(o.scopes.indexOf(cb.value)>=0) cb.checked = true;
    });
  }
  closeOrderPickProj();
  try{ toast('Order details + schedule linked'); }catch(e){}
}

/* ===== CENTURY SOLUTION — Site Engineers & Project Management ===== */
/* Hierarchy: Site Engineer → Projects → Equipment → Daily Log / Progress */

const SP_ENG = 'cs11_site_engineers';
const SP_PROJ = 'cs11_site_projects';
const SP_DAILY = 'cs11_site_daily';
const SP_NEAR = 'cs11_site_nearmiss';
const SP_PERM = 'cs11_site_proj_perms';

const PROJ_CATEGORIES = [
  'Supply Only','SITC','Testing & Commissioning','Preventive Maintenance','Breakdown Maintenance',
  'AMC','Overhauling','Retrofitting','Upgradation','Relay Testing','Transformer Testing',
  'GIS Maintenance','AIS Maintenance','RMU Work','CSS Work','Panel Work','Busduct Work','Other'
];
const EQUIP_TYPES = ['Transformer','GIS','AIS','RMU','VCB','ACB','MCC','PCC','LT Panel','HT Panel','CSS','Busduct','Other'];
const SCOPE_OPTS = ['Dismantling','Installation','Testing','Commissioning','Overhauling','Repair','Painting','Relay Setting','Cable Termination','Busbar Work','Earthing','SF6 Gas Handling','Vacuuming','Oil Filtration','Jointing','Replacement','Cleaning'];
const WORK_TYPES = ['Installation','Testing','Cable Laying','Commissioning','Overhauling','Breakdown','Inspection','Cleaning','Repair','Replacement','Others'];
const TEST_TYPES = ['IR Test','Contact Resistance','Timing Test','Primary Injection','Secondary Injection','CT Ratio','PT Ratio','Breaker Timing','SF6 Density','Oil BDV','Transformer Ratio','Relay Testing','Functional Test','Others'];
const ISSUE_OPTS = ['Material Delay','Power Shutdown','Customer Delay','Rain','Tool Problem','Manpower Shortage','Equipment Fault','Other'];
const REQ_OPTS = ['Need Material','Need Spare','Need Drawing','Need Engineer','Need Approval','Need Vehicle','Need Crane','Need Vendor'];
const PRIORITIES = ['High','Medium','Low'];
const WORKFLOW = ['Enquiry','Quotation','PO Received','Project Created','Engineer Assigned','Material Planning','Site Mobilization','Daily Progress','Testing & Commissioning','Customer Approval','Billing','Project Closure'];

function spLoad(k, d){ try{ return JSON.parse(localStorage.getItem(k)||JSON.stringify(d)); }catch(e){ return d; } }
function spSave(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function spEngineers(){ return spLoad(SP_ENG, []); }
function spProjects(){ return spLoad(SP_PROJ, []); }
function spDaily(){ return spLoad(SP_DAILY, []); }
function spNearMiss(){ return spLoad(SP_NEAR, []); }
function spPerms(){ return spLoad(SP_PERM, {}); }

function canManageProjects(){
  if(typeof isAdmin==='function' && isAdmin()) return true;
  const s = typeof getSession==='function' ? getSession() : null;
  if(!s) return false;
  if(s.role==='site_worker') return false; // site engineers cannot allot
  if(s.siteAccess || spPerms()[String(s.id||'').toLowerCase()]) return true;
  return true; // office users can manage by default
}
function isSiteEngineerLogin(){
  const s = typeof getSession==='function' ? getSession() : null;
  return !!(s && s.role==='site_worker');
}
function currentEngineerId(){
  const s = typeof getSession==='function' ? getSession() : null;
  if(!s) return null;
  const eng = spEngineers().find(e => String(e.userId||'').toLowerCase()===String(s.id||'').toLowerCase() || String(e.empId)===String(s.siteWorkerId||''));
  return eng ? eng.id : null;
}
function nextProjId(){
  const list = spProjects();
  let max = 0;
  list.forEach(p=>{ const m=String(p.projectId||'').match(/(\d+)/); if(m) max=Math.max(max,parseInt(m[1],10)); });
  return 'PRJ/'+new Date().getFullYear()+'/'+String(max+1).padStart(3,'0');
}
function esc(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ===== ACCESS ===== */
function canAccessSiteProjects(){
  if(typeof isAdmin==='function' && isAdmin()) return true;
  const s = typeof getSession==='function' ? getSession() : null;
  if(!s) return false;
  if(s.role==='site_worker') return true;
  return true;
}
function applySiteProjAccess(){
  document.querySelectorAll('[data-sp-nav]').forEach(el=>{
    el.style.display = canAccessSiteProjects() ? '' : 'none';
  });
  if(isSiteEngineerLogin()){
    document.querySelectorAll('.nav-btn, .nav-group').forEach(el=>{
      if(el.hasAttribute('data-sp-nav')) return;
      if(el.dataset && el.dataset.view==='settings') return;
      if(el.dataset && el.dataset.view==='dashboard') return;
      el.style.display = 'none';
    });
    document.querySelectorAll('[data-sp-nav]').forEach(el=>{ el.style.display=''; });
  }
}

/* ===== ENGINEERS (from Employees) ===== */
function renderSiteEngineers(){
  if(!canAccessSiteProjects()) return;
  const q = ((document.getElementById('spEngQ')||{}).value||'').toLowerCase();
  let list = spEngineers();
  if(isSiteEngineerLogin()){
    const eid = currentEngineerId();
    list = list.filter(e=>String(e.id)===String(eid));
  }
  if(q) list = list.filter(e=>((e.name||'')+' '+(e.code||'')+' '+(e.mobile||'')).toLowerCase().includes(q));
  const el = document.getElementById('spEngList');
  if(!el) return;
  if(!list.length){
    el.innerHTML = '<p class="empty-msg">No site engineers yet. Add from Employees list.</p>';
    return;
  }
  el.innerHTML = list.map(e=>{
    const projs = spProjects().filter(p=>String(p.engineerId)===String(e.id));
    const active = projs.filter(p=>p.status!=='Closed' && p.status!=='Cancelled').length;
    return `<div class="block" style="margin-bottom:8px;cursor:pointer" onclick="openEngineerProjects('${e.id}')">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
        <div>
          <b style="color:var(--blue)">${esc(e.code||'')}</b> <span style="font-weight:700">${esc(e.name)}</span>
          <div style="font-size:.72rem;color:var(--muted);margin-top:2px">${esc(e.desig||'Site Engineer')} · ${esc(e.mobile||'')} · ${esc(e.dept||'')}</div>
          <div style="font-size:.75rem;margin-top:4px"><b>${projs.length}</b> project(s) · <b>${active}</b> active</div>
        </div>
        <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
          <button class="btn-sm" onclick="openEngineerProjects('${e.id}')">Projects</button>
          ${canManageProjects()?`<button class="btn-sm" onclick="openPEReport('${e.id}')">PE Report</button>
          <button class="del-btn" style="width:auto;padding:4px 8px;height:auto" onclick="removeSiteEngineer('${e.id}')">×</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function openAddEngineerFromEmp(){
  if(!canManageProjects()){ toast('Not allowed'); return; }
  try{ if(typeof loadEmployees==='function') loadEmployees(); }catch(e){}
  const emps = (typeof employeesDB!=='undefined'?employeesDB:[]);
  const existing = new Set(spEngineers().map(e=>String(e.empId)));
  const avail = emps.filter(e=>!existing.has(String(e.id)));
  if(!avail.length){ toast('No more employees to add (or Employees list empty)'); return; }
  const body = document.getElementById('spAddEngBody');
  body.innerHTML = avail.map(e=>`
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;font-weight:500;text-transform:none;font-size:.8rem;color:var(--text)">
      <input type="checkbox" value="${e.id}" data-name="${esc(e.name)}" data-code="${esc(e.code||'')}" data-desig="${esc(e.desig||'')}" data-mobile="${esc(e.mobile||'')}" data-dept="${esc(e.dept||'')}">
      <span><b>${esc(e.code||'')}</b> ${esc(e.name)} <span style="color:var(--muted);font-size:.7rem">${esc(e.desig||'')} · ${esc(e.dept||'')}</span></span>
    </label>`).join('');
  document.getElementById('spAddEngModal').classList.add('show');
}
function closeAddEng(){ document.getElementById('spAddEngModal').classList.remove('show'); }
function confirmAddEngineers(){
  const box = document.getElementById('spAddEngBody');
  const checks = box.querySelectorAll('input[type=checkbox]:checked');
  if(!checks.length){ toast('Select at least one'); return; }
  let list = spEngineers();
  checks.forEach(c=>{
    list.unshift({
      id: Date.now()+Math.random(),
      empId: c.value,
      code: c.dataset.code||'',
      name: c.dataset.name||'',
      desig: c.dataset.desig||'Site Engineer',
      mobile: c.dataset.mobile||'',
      dept: c.dataset.dept||'',
      userId: '',
      addedAt: new Date().toISOString()
    });
  });
  spSave(SP_ENG, list);
  closeAddEng();
  renderSiteEngineers();
  toast(checks.length+' site engineer(s) added');
}
function removeSiteEngineer(id){
  if(!confirm('Remove this site engineer from the module? Projects remain.')) return;
  spSave(SP_ENG, spEngineers().filter(e=>String(e.id)!==String(id)));
  renderSiteEngineers();
}

/* ===== ENGINEER → PROJECTS LIST ===== */
let _spEngId = null;
function openEngineerProjects(engId){
  _spEngId = engId;
  const eng = spEngineers().find(e=>String(e.id)===String(engId));
  if(!eng) return;
  showView('sp-projects');
  document.getElementById('spProjTitle').textContent = eng.name+' — Projects';
  document.getElementById('spProjSub').textContent = (eng.code||'')+' · '+(eng.desig||'')+' · '+(eng.mobile||'');
  document.getElementById('spProjEngId').value = engId;
  const addBtn = document.getElementById('spAddProjBtn');
  if(addBtn) addBtn.style.display = canManageProjects() ? '' : 'none';
  renderProjectsForEngineer(engId);
}
function renderProjectsForEngineer(engId){
  let projs = spProjects().filter(p=>String(p.engineerId)===String(engId));
  if(isSiteEngineerLogin()){
    // only assigned to them
    projs = projs.filter(p=>String(p.engineerId)===String(currentEngineerId()));
  }
  const el = document.getElementById('spProjList');
  if(!projs.length){
    el.innerHTML = '<p class="empty-msg">No projects. '+(canManageProjects()?'Click + Allot Project.':'')+'</p>';
    return;
  }
  el.innerHTML = projs.map(p=>{
    const prog = calcProjectProgress(p.id);
    const stColor = p.status==='Closed'?'#0f766e':p.status==='On Hold'?'#a16207':p.priority==='High'?'#b91c1c':'#1a56a8';
    return `<div class="block" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px;cursor:pointer" onclick="openProjectHub('${p.id}')">
          <div><b style="color:var(--blue)">${esc(p.projectId)}</b> · <span style="font-weight:700">${esc(p.name)}</span>
            <span class="status-pill" style="background:${stColor};margin-left:6px">${esc(p.status||'Active')}</span>
            ${p.priority?`<span class="badge" style="background:${p.priority==='High'?'#b91c1c':p.priority==='Medium'?'#a16207':'#64748b'}">${esc(p.priority)}</span>`:''}
          </div>
          <div style="font-size:.72rem;color:var(--muted);margin-top:3px">${esc(p.customer||'')} · ${esc(p.category||'')} · ${esc(p.siteAddress||'').slice(0,40)}</div>
          <div style="margin-top:6px;height:6px;background:#e5eaf2;border-radius:3px;max-width:220px">
            <div style="height:100%;width:${prog}%;background:linear-gradient(90deg,#1a56a8,#3b82f6);border-radius:3px"></div>
          </div>
          <div style="font-size:.65rem;color:var(--muted)">Progress ${prog}%</div>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:flex-start">
          <button class="btn-sm" onclick="openProjectHub('${p.id}')">Open</button>
          <button class="btn-sm" onclick="openDailyForm('${p.id}')">+ Daily Report</button>
          ${canManageProjects()?`<button class="btn-sm" onclick="openProjectForm('${p.id}')">Edit</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function calcProjectProgress(projId){
  const p = spProjects().find(x=>String(x.id)===String(projId));
  if(p && p.overallProgress!=null && p.overallProgress!=='') return Math.min(100, Math.max(0, parseFloat(p.overallProgress)||0));
  const logs = spDaily().filter(d=>String(d.projectId)===String(projId));
  if(!logs.length) return 0;
  const latest = logs.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
  return Math.min(100, Math.max(0, parseFloat(latest.overallProgress)||0));
}

/* ===== PROJECT FORM (Allotment + Full Details) ===== */
function openProjectForm(projId){
  if(!canManageProjects() && projId){ toast('View via Open'); return; }
  if(!canManageProjects()){ toast('Only office can allot projects'); return; }
  const engId = document.getElementById('spProjEngId')?.value || _spEngId;
  const p = projId ? spProjects().find(x=>String(x.id)===String(projId)) : null;
  document.getElementById('spPfTitle').textContent = p ? 'Edit Project' : 'Allot New Project';
  document.getElementById('spPfId').value = p ? p.id : '';
  document.getElementById('spPfEngId').value = p ? p.engineerId : engId;

  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.value = v!=null?v:''; };
  set('spPfProjectId', p?p.projectId:nextProjId());
  set('spPfName', p?p.name:'');
  set('spPfCustomer', p?p.customer:'');
  set('spPfContact', p?p.contactPerson:'');
  set('spPfPhone', p?p.phone:'');
  set('spPfEmail', p?p.email:'');
  set('spPfAddress', p?p.siteAddress:'');
  set('spPfMaps', p?p.googleLocation:'');
  set('spPfPlant', p?p.plantName:'');
  set('spPfState', p?p.state:'');
  set('spPfRegion', p?p.region:'');
  if(typeof getList==='function'){
    const catEl=document.getElementById('spPfCategory');
    if(catEl){ const cur=p?p.category:'SITC'; catEl.innerHTML=getList('projectCategories').map(c=>'<option '+(c===cur?'selected':'')+'>'+c+'</option>').join(''); }
  } else set('spPfCategory', p?p.category:'SITC');
  set('spPfStatus', p?p.status:'Active');
  set('spPfPoNo', p?p.poNumber:'');
  set('spPfPoDate', p?p.poDate:'');
  set('spPfPoValue', p?p.poValue:'');
  set('spPfProjValue', p?p.projectValue:'');
  set('spPfPayTerms', p?p.paymentTerms:'');
  set('spPfWarranty', p?p.warranty:'');
  set('spPfDelivery', p?p.deliveryDate:'');
  set('spPfCompletion', p?p.completionDate:'');
  set('spPfAssignDate', p?p.assignedDate:new Date().toISOString().slice(0,10));
  set('spPfReportDate', p?p.reportingDate:'');
  set('spPfExpected', p?p.expectedCompletion:'');
  set('spPfPriority', p?p.priority:'Medium');
  set('spPfInstructions', p?p.instructions:'');
  set('spPfSpecial', p?p.specialInstructions:'');
  set('spPfCustReq', p?p.customerRequirements:'');
  set('spPfPermit', p?p.permitRequirement:'');
  set('spPfShutdown', p?p.shutdownTiming:'');
  set('spPfHours', p?p.workingHours:'');
  set('spPfSafety', p?p.safetyNotes:'');
  set('spPfPM', p?p.projectManager:'');
  set('spPfSupervisor', p?p.supervisor:'');
  set('spPfTechnicians', p?p.technicians:'');
  set('spPfHelpers', p?p.helpers:'');
  set('spPfSafetyOff', p?p.safetyOfficer:'');
  set('spPfVendor', p?p.vendor:'');
  set('spPfContractor', p?p.contractor:'');
  set('spPfProgress', p?p.overallProgress:0);
  set('spPfWorkflow', p?p.workflowStage:'Project Created');

  // Scope checkboxes
  const scopes = p && p.scopes ? p.scopes : [];
  const SCOPE_OPTS_DYN = (typeof getList==='function'?getList('scopeOpts'):SCOPE_OPTS);
  document.getElementById('spPfScopes').innerHTML = SCOPE_OPTS_DYN.map(s=>`
    <label style="display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0;font-size:.72rem;font-weight:500;text-transform:none;color:var(--text)">
      <input type="checkbox" value="${s}" ${scopes.includes(s)?'checked':''}> ${s}
    </label>`).join('');

  // Equipment rows
  window._spEquip = p && p.equipment ? JSON.parse(JSON.stringify(p.equipment)) : [];
  renderEquipRows();
  // Materials
  window._spMat = p && p.materials ? JSON.parse(JSON.stringify(p.materials)) : [];
  renderMatRows();

  document.getElementById('spProjectModal').classList.add('show');
}
function closeProjectForm(){ document.getElementById('spProjectModal').classList.remove('show'); }

function renderEquipRows(){
  const el = document.getElementById('spEquipRows');
  if(!el) return;
  if(!window._spEquip.length) window._spEquip = [{type:'',make:'',model:'',rating:'',voltage:'',capacity:'',serial:'',year:'',qty:1}];
  el.innerHTML = window._spEquip.map((eq,i)=>`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 60px 28px;gap:4px;margin-bottom:4px">
      <select onchange="_spEquip[${i}].type=this.value">${(typeof getList==='function'?getList('equipTypes'):EQUIP_TYPES).map(t=>`<option ${eq.type===t?'selected':''}>${t}</option>`).join('')}</select>
      <input placeholder="Make" value="${esc(eq.make||'')}" onchange="_spEquip[${i}].make=this.value">
      <input placeholder="Model" value="${esc(eq.model||'')}" onchange="_spEquip[${i}].model=this.value">
      <input placeholder="Rating / Voltage" value="${esc(eq.rating||eq.voltage||'')}" onchange="_spEquip[${i}].rating=this.value">
      <input type="number" placeholder="Qty" value="${eq.qty||1}" onchange="_spEquip[${i}].qty=parseFloat(this.value)||1">
      <button class="del-btn" style="width:24px;height:24px" onclick="_spEquip.splice(${i},1);renderEquipRows()">×</button>
    </div>`).join('');
}
function addEquipRow(){ window._spEquip.push({type:'VCB',make:'',model:'',rating:'',qty:1}); renderEquipRows(); }

function renderMatRows(){
  const el = document.getElementById('spMatRows');
  if(!el) return;
  if(!window._spMat.length) window._spMat = [{name:'',code:'',required:0,issued:0,balance:0,store:''}];
  el.innerHTML = window._spMat.map((m,i)=>`
    <div style="display:grid;grid-template-columns:1.2fr 70px 60px 60px 60px 80px 28px;gap:4px;margin-bottom:4px;font-size:.72rem">
      <input placeholder="Material" value="${esc(m.name||'')}" onchange="_spMat[${i}].name=this.value">
      <input placeholder="Code" value="${esc(m.code||'')}" onchange="_spMat[${i}].code=this.value">
      <input type="number" placeholder="Req" value="${m.required||''}" onchange="_spMat[${i}].required=parseFloat(this.value)||0;_spMat[${i}].balance=(_spMat[${i}].required||0)-(_spMat[${i}].issued||0)">
      <input type="number" placeholder="Iss" value="${m.issued||''}" onchange="_spMat[${i}].issued=parseFloat(this.value)||0;_spMat[${i}].balance=(_spMat[${i}].required||0)-(_spMat[${i}].issued||0)">
      <input type="number" placeholder="Bal" value="${m.balance||''}" onchange="_spMat[${i}].balance=parseFloat(this.value)||0">
      <input placeholder="Store" value="${esc(m.store||'')}" onchange="_spMat[${i}].store=this.value">
      <button class="del-btn" style="width:24px;height:24px" onclick="_spMat.splice(${i},1);renderMatRows()">×</button>
    </div>`).join('');
}
function addMatRow(){ window._spMat.push({name:'',code:'',required:0,issued:0,balance:0,store:''}); renderMatRows(); }

function saveProject(){
  const name = (document.getElementById('spPfName').value||'').trim();
  if(!name){ toast('Project name required'); return; }
  const engId = document.getElementById('spPfEngId').value;
  if(!engId){ toast('Engineer missing'); return; }
  const scopes = [...document.querySelectorAll('#spPfScopes input:checked')].map(c=>c.value);
  const id = document.getElementById('spPfId').value || (Date.now()+Math.random());
  const get = id => (document.getElementById(id)||{}).value||'';
  const row = {
    id, engineerId: engId,
    projectId: get('spPfProjectId')||nextProjId(),
    name, customer: get('spPfCustomer'), contactPerson: get('spPfContact'),
    phone: get('spPfPhone'), email: get('spPfEmail'), siteAddress: get('spPfAddress'),
    googleLocation: get('spPfMaps'), plantName: get('spPfPlant'), state: get('spPfState'), region: get('spPfRegion'),
    category: get('spPfCategory'), status: get('spPfStatus')||'Active',
    poNumber: get('spPfPoNo'), poDate: get('spPfPoDate'), poValue: get('spPfPoValue'),
    projectValue: get('spPfProjValue'), paymentTerms: get('spPfPayTerms'), warranty: get('spPfWarranty'),
    deliveryDate: get('spPfDelivery'), completionDate: get('spPfCompletion'),
    assignedDate: get('spPfAssignDate'), reportingDate: get('spPfReportDate'),
    expectedCompletion: get('spPfExpected'), priority: get('spPfPriority'),
    instructions: get('spPfInstructions'), specialInstructions: get('spPfSpecial'),
    customerRequirements: get('spPfCustReq'), permitRequirement: get('spPfPermit'),
    shutdownTiming: get('spPfShutdown'), workingHours: get('spPfHours'), safetyNotes: get('spPfSafety'),
    projectManager: get('spPfPM'), supervisor: get('spPfSupervisor'),
    technicians: get('spPfTechnicians'), helpers: get('spPfHelpers'),
    safetyOfficer: get('spPfSafetyOff'), vendor: get('spPfVendor'), contractor: get('spPfContractor'),
    overallProgress: parseFloat(get('spPfProgress'))||0,
    workflowStage: get('spPfWorkflow')||'Project Created',
    orderId: get('spPfOrderId')||'',
    importedSchedule: window._spImportedSchedule||[],
    scopes, equipment: window._spEquip||[], materials: window._spMat||[],
    updatedAt: new Date().toISOString()
  };
  let list = spProjects();
  const ix = list.findIndex(x=>String(x.id)===String(id));
  if(ix>=0) list[ix]=row; else list.unshift(row);
  spSave(SP_PROJ, list);
  closeProjectForm();
  renderProjectsForEngineer(engId);
  toast('Project saved');
}

/* ===== PROJECT HUB (tabs: Overview, Daily, Progress, Near Miss, Material, Expense, Tools, Quality, Completion, Billing, Closure) ===== */
let _hubProjId = null;
function openProjectHub(projId){
  _hubProjId = projId;
  const p = spProjects().find(x=>String(x.id)===String(projId));
  if(!p) return;
  showView('sp-hub');
  document.getElementById('spHubTitle').textContent = p.projectId+' · '+p.name;
  document.getElementById('spHubSub').textContent = (p.customer||'')+' · '+(p.category||'')+' · '+(p.status||'');
  document.getElementById('spHubProjId').value = projId;
  switchHubTab('overview');
}
function switchHubTab(tab){
  ['overview','daily','progress','nearmiss','material','expense','tools','quality','completion','billing','closure'].forEach(t=>{
    const panel = document.getElementById('spHub-'+t);
    const btn = document.querySelector('[data-hub="'+t+'"]');
    if(panel) panel.style.display = t===tab ? 'block' : 'none';
    if(btn) btn.classList.toggle('active', t===tab);
  });
  if(tab==='overview') renderHubOverview();
  if(tab==='daily') renderHubDaily();
  if(tab==='progress') renderHubProgress();
  if(tab==='nearmiss') renderHubNearMiss();
  if(tab==='material') renderHubMaterial();
  if(tab==='expense') renderHubExpense();
  if(tab==='tools') renderHubTools();
  if(tab==='quality') renderHubQuality();
  if(tab==='completion') renderHubCompletion();
  if(tab==='billing') renderHubBilling();
  if(tab==='closure') renderHubClosure();
}

function renderHubOverview(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  if(!p) return;
  const prog = calcProjectProgress(p.id);
  const el = document.getElementById('spHub-overview');
  el.innerHTML = `
    <div class="c360-kpis" style="padding:0 0 12px">
      <div class="c360-kpi"><div class="k-lab">Progress</div><div class="k-val">${prog}%</div></div>
      <div class="c360-kpi"><div class="k-lab">Priority</div><div class="k-val" style="font-size:.95rem">${esc(p.priority||'—')}</div></div>
      <div class="c360-kpi"><div class="k-lab">Status</div><div class="k-val" style="font-size:.95rem">${esc(p.status||'—')}</div></div>
      <div class="c360-kpi"><div class="k-lab">Stage</div><div class="k-val" style="font-size:.75rem">${esc(p.workflowStage||'—')}</div></div>
    </div>
    <div class="c360-grid">
      <div><label>Customer</label><div class="c360-v">${esc(p.customer)}</div></div>
      <div><label>Contact</label><div class="c360-v">${esc(p.contactPerson)} ${esc(p.phone)}</div></div>
      <div class="full"><label>Site</label><div class="c360-v">${esc(p.siteAddress)}</div></div>
      <div><label>Category</label><div class="c360-v">${esc(p.category)}</div></div>
      <div><label>PO</label><div class="c360-v">${esc(p.poNumber)} · ₹ ${esc(p.poValue)}</div></div>
      <div><label>Expected completion</label><div class="c360-v">${esc(p.expectedCompletion)}</div></div>
      <div><label>Project Manager</label><div class="c360-v">${esc(p.projectManager)}</div></div>
      <div class="full"><label>Scope</label><div class="c360-v">${(p.scopes||[]).map(esc).join(', ')||'—'}</div></div>
      <div class="full"><label>Equipment</label><div class="c360-v">${(p.equipment||[]).map(e=>esc(e.type)+' '+(e.make||'')+' ×'+(e.qty||1)).join(' · ')||'—'}</div></div>
      <div class="full"><label>Instructions</label><div class="c360-v">${esc(p.instructions||p.specialInstructions||'—')}</div></div>
    </div>
    ${(p.executionSchedule&&p.executionSchedule.length)?`<div class="block-title" style="margin-top:10px">Execution Schedule (from Offer)</div>
      <table class="rpt-table" style="font-size:.72rem"><thead><tr><th>#</th><th>Activity</th><th>Duration</th></tr></thead>
      <tbody>${p.executionSchedule.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(s.activity)+'</td><td>'+esc(s.duration)+'</td></tr>').join('')}</tbody></table>`:''}
    <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn-main" onclick="openDailyForm('${p.id}')">+ Daily Site Report</button>
      <button class="btn-sm" onclick="openNearMissForm('${p.id}')">+ Near Miss</button>
      ${canManageProjects()?`<button class="btn-sm" onclick="openProjectForm('${p.id}')">Edit Project</button>
      <button class="btn-sm" onclick="generateProjectMIS('${p.id}')">⬇ Project MIS</button>`:''}
    </div>`;
}

function renderHubDaily(){
  const logs = spDaily().filter(d=>String(d.projectId)===String(_hubProjId)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const el = document.getElementById('spHub-daily');
  el.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <b style="font-size:.8rem">Daily Site Reports</b>
    <button class="btn-sm" onclick="openDailyForm('${_hubProjId}')">+ New Report</button>
  </div>` + (logs.length ? logs.map(l=>`
    <div class="c360-row">
      <div><b>${esc(l.date)}</b> · ${esc(l.workType||'')} · Progress ${esc(l.overallProgress||'0')}%
        <div style="font-size:.7rem;color:var(--muted)">${esc((l.workDesc||'').slice(0,100))}</div>
      </div>
      <button class="btn-xs" onclick="openDailyForm('${_hubProjId}','${l.id}')">Open</button>
    </div>`).join('') : '<p class="empty-msg">No daily reports yet</p>');
}

function renderHubProgress(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  const logs = spDaily().filter(d=>String(d.projectId)===String(_hubProjId));
  const prog = calcProjectProgress(_hubProjId);
  const el = document.getElementById('spHub-progress');
  el.innerHTML = `
    <div class="c360-kpis" style="padding:0 0 12px">
      <div class="c360-kpi"><div class="k-lab">Site Progress</div><div class="k-val">${prog}%</div></div>
      <div class="c360-kpi"><div class="k-lab">Daily logs</div><div class="k-val">${logs.length}</div></div>
      <div class="c360-kpi"><div class="k-lab">Expected</div><div class="k-val" style="font-size:.75rem">${esc(p?.expectedCompletion||'—')}</div></div>
      <div class="c360-kpi"><div class="k-lab">Workflow</div><div class="k-val" style="font-size:.7rem">${esc(p?.workflowStage||'—')}</div></div>
    </div>
    <p style="font-size:.75rem;color:var(--muted)">Progress updates automatically from the latest Daily Site Report (Overall Project Progress %). Office can also set it on Edit Project.</p>
    <div style="margin-top:8px">${WORKFLOW.map(s=>{
      const on = (p?.workflowStage||'')===s;
      return `<span class="chip ${on?'on':''}" style="margin:2px">${s}</span>`;
    }).join('')}</div>
    ${(p.importedSchedule&&p.importedSchedule.length)?`<div style="margin-top:12px"><b style="font-size:.75rem">Linked Order — Execution Schedule</b>
      <table class="rpt-table" style="margin-top:6px;font-size:.7rem"><thead><tr><th>Activity</th><th>Plan</th><th>Actual</th><th>Status</th></tr></thead>
      <tbody>${p.importedSchedule.map(s=>`<tr><td>${esc(s.activity)}</td><td>${esc(s.planDate)}</td><td>${esc(s.actualDate)}</td><td>${esc(s.status)}</td></tr>`).join('')}</tbody></table></div>`:''}`;
}

function renderHubNearMiss(){
  const list = spNearMiss().filter(n=>String(n.projectId)===String(_hubProjId)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const el = document.getElementById('spHub-nearmiss');
  el.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <b style="font-size:.8rem;color:#b91c1c">Near Miss / Safety</b>
    <button class="btn-sm" onclick="openNearMissForm('${_hubProjId}')">+ Report Near Miss</button>
  </div>` + (list.length ? list.map(n=>`
    <div class="c360-row" style="border-left:3px solid #b91c1c;padding-left:8px">
      <div><b>${esc(n.date)}</b> · ${esc(n.severity||'Medium')}
        <div style="font-size:.72rem">${esc(n.description||'')}</div>
        <div style="font-size:.68rem;color:var(--muted)">Action: ${esc(n.correctiveAction||'—')} · Status: ${esc(n.status||'Open')}</div>
      </div>
    </div>`).join('') : '<p class="empty-msg">No near miss reports — good safety record</p>');
}

function renderHubMaterial(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  const mats = p?.materials||[];
  document.getElementById('spHub-material').innerHTML = `
    <b style="font-size:.8rem">Material status</b>
    <table class="rpt-table" style="margin-top:8px;font-size:.72rem"><thead><tr><th>Material</th><th>Code</th><th>Req</th><th>Issued</th><th>Balance</th><th>Store</th></tr></thead>
    <tbody>${mats.length?mats.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.code)}</td><td>${m.required||0}</td><td>${m.issued||0}</td><td>${m.balance||0}</td><td>${esc(m.store)}</td></tr>`).join(''):'<tr><td colspan="6">No materials listed — edit project</td></tr>'}</tbody></table>`;
}
function renderHubExpense(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  const exp = p?.expenses || [];
  document.getElementById('spHub-expense').innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><b style="font-size:.8rem">Site Expenses</b>
      <button class="btn-sm" onclick="addExpenseRow()">+ Expense</button></div>
    <div id="spExpList">${exp.length?exp.map((e,i)=>`<div class="c360-row"><div>${esc(e.type)} · ₹ ${esc(e.amount)} · ${esc(e.date)}<div style="font-size:.68rem;color:var(--muted)">${esc(e.remarks||'')}</div></div></div>`).join(''):'<p class="empty-msg">No expenses</p>'}</div>
    <p style="font-size:.68rem;color:var(--muted);margin-top:8px">Types: Fuel, Hotel, Food, Travel, Local Transport, Labour, Crane, Vehicle, Miscellaneous</p>`;
}
function addExpenseRow(){
  const type = prompt('Expense type (Fuel/Hotel/Food/Travel/Labour/Crane/Vehicle/Misc):','Fuel');
  if(!type) return;
  const amount = prompt('Amount (₹):','0');
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  if(!p) return;
  if(!p.expenses) p.expenses = [];
  p.expenses.push({type, amount: parseFloat(amount)||0, date: new Date().toISOString().slice(0,10), remarks:''});
  const list = spProjects(); const ix = list.findIndex(x=>String(x.id)===String(p.id)); list[ix]=p; spSave(SP_PROJ, list);
  renderHubExpense(); toast('Expense added');
}
function renderHubTools(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  const tools = p?.tools || [];
  document.getElementById('spHub-tools').innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><b style="font-size:.8rem">Tools Issued</b>
      <button class="btn-sm" onclick="addToolRow()">+ Tool</button></div>
    ${tools.length?tools.map(t=>`<div class="c360-row"><div>${esc(t.name)} · ${esc(t.condition||'OK')} · Return: ${esc(t.returnStatus||'Out')}</div></div>`).join(''):'<p class="empty-msg">No tools logged</p>'}
    <p style="font-size:.68rem;color:var(--muted);margin-top:6px">Megger, CRM Kit, Primary/Secondary Injection, Breaker Analyzer, Torque Wrench, Earth Tester, Laptop…</p>`;
}
function addToolRow(){
  const name = prompt('Tool name:','Megger');
  if(!name) return;
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  if(!p) return;
  if(!p.tools) p.tools = [];
  p.tools.push({name, condition:'Good', returnStatus:'Issued'});
  const list = spProjects(); const ix = list.findIndex(x=>String(x.id)===String(p.id)); list[ix]=p; spSave(SP_PROJ, list);
  renderHubTools();
}
function renderHubQuality(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  document.getElementById('spHub-quality').innerHTML = `
    <b style="font-size:.8rem">Quality &amp; Punch Points</b>
    <textarea id="spQualityNotes" rows="4" style="width:100%;margin-top:8px" placeholder="Installation / Torque / Testing / Commissioning checklist notes, NCR, observations, corrective actions…">${esc(p?.qualityNotes||'')}</textarea>
    <button class="btn-sm" style="margin-top:6px" onclick="saveQualityNotes()">Save Notes</button>`;
}
function saveQualityNotes(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  if(!p) return;
  p.qualityNotes = document.getElementById('spQualityNotes').value;
  const list = spProjects(); const ix = list.findIndex(x=>String(x.id)===String(p.id)); list[ix]=p; spSave(SP_PROJ, list);
  toast('Quality notes saved');
}
function renderHubCompletion(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  document.getElementById('spHub-completion').innerHTML = `
    <div class="form-grid">
      <div class="fg"><label>Completion Date</label><input type="date" id="spCompDate" value="${esc(p?.completionDate||'')}"></div>
      <div class="fg"><label>Work Completed</label><input id="spCompDone" value="${esc(p?.workCompleted||'')}"></div>
      <div class="fg full"><label>Pending / Punch List</label><textarea id="spCompPending" rows="2">${esc(p?.pendingPoints||'')}</textarea></div>
      <div class="fg full"><label>Customer Feedback</label><textarea id="spCompFeedback" rows="2">${esc(p?.customerFeedback||'')}</textarea></div>
    </div>
    <button class="btn-sm" style="margin-top:8px" onclick="saveCompletion()">Save Completion</button>`;
}
function saveCompletion(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  if(!p) return;
  p.completionDate = document.getElementById('spCompDate').value;
  p.workCompleted = document.getElementById('spCompDone').value;
  p.pendingPoints = document.getElementById('spCompPending').value;
  p.customerFeedback = document.getElementById('spCompFeedback').value;
  const list = spProjects(); const ix = list.findIndex(x=>String(x.id)===String(p.id)); list[ix]=p; spSave(SP_PROJ, list);
  toast('Completion saved');
}
function renderHubBilling(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  document.getElementById('spHub-billing').innerHTML = `
    <div class="form-grid">
      <div class="fg"><label>Invoice No</label><input id="spBillInv" value="${esc(p?.invoiceNo||'')}"></div>
      <div class="fg"><label>Invoice Date</label><input type="date" id="spBillDate" value="${esc(p?.invoiceDate||'')}"></div>
      <div class="fg"><label>Payment Received ₹</label><input type="number" id="spBillRecv" value="${esc(p?.paymentReceived||'')}"></div>
      <div class="fg"><label>Outstanding ₹</label><input type="number" id="spBillOut" value="${esc(p?.outstanding||'')}"></div>
      <div class="fg"><label>Retention ₹</label><input type="number" id="spBillRet" value="${esc(p?.retention||'')}"></div>
      <div class="fg"><label>RA / Final</label><select id="spBillType"><option ${p?.billType==='RA'?'selected':''}>RA Bill</option><option ${p?.billType==='Final'?'selected':''}>Final Bill</option></select></div>
    </div>
    <button class="btn-sm" style="margin-top:8px" onclick="saveBilling()">Save Billing</button>`;
}
function saveBilling(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  if(!p) return;
  p.invoiceNo = document.getElementById('spBillInv').value;
  p.invoiceDate = document.getElementById('spBillDate').value;
  p.paymentReceived = document.getElementById('spBillRecv').value;
  p.outstanding = document.getElementById('spBillOut').value;
  p.retention = document.getElementById('spBillRet').value;
  p.billType = document.getElementById('spBillType').value;
  const list = spProjects(); const ix = list.findIndex(x=>String(x.id)===String(p.id)); list[ix]=p; spSave(SP_PROJ, list);
  toast('Billing saved');
}
function renderHubClosure(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  document.getElementById('spHub-closure').innerHTML = `
    <div class="form-grid">
      <div class="fg full"><label>Lessons Learned</label><textarea id="spClLessons" rows="2">${esc(p?.lessonsLearned||'')}</textarea></div>
      <div class="fg full"><label>Problems Faced</label><textarea id="spClProblems" rows="2">${esc(p?.problemsFaced||'')}</textarea></div>
      <div class="fg"><label>Warranty Start</label><input type="date" id="spClWStart" value="${esc(p?.warrantyStart||'')}"></div>
      <div class="fg"><label>Warranty End</label><input type="date" id="spClWEnd" value="${esc(p?.warrantyEnd||'')}"></div>
      <div class="fg"><label>AMC Start</label><input type="date" id="spClAStart" value="${esc(p?.amcStart||'')}"></div>
      <div class="fg"><label>AMC End</label><input type="date" id="spClAEnd" value="${esc(p?.amcEnd||'')}"></div>
      <div class="fg"><label>Closed By</label><input id="spClBy" value="${esc(p?.closedBy||'')}"></div>
      <div class="fg"><label>Closure Date</label><input type="date" id="spClDate" value="${esc(p?.closureDate||'')}"></div>
    </div>
    <button class="btn-main" style="margin-top:8px" onclick="saveClosure()">Save &amp; Mark Closed</button>`;
}
function saveClosure(){
  const p = spProjects().find(x=>String(x.id)===String(_hubProjId));
  if(!p) return;
  p.lessonsLearned = document.getElementById('spClLessons').value;
  p.problemsFaced = document.getElementById('spClProblems').value;
  p.warrantyStart = document.getElementById('spClWStart').value;
  p.warrantyEnd = document.getElementById('spClWEnd').value;
  p.amcStart = document.getElementById('spClAStart').value;
  p.amcEnd = document.getElementById('spClAEnd').value;
  p.closedBy = document.getElementById('spClBy').value;
  p.closureDate = document.getElementById('spClDate').value;
  p.status = 'Closed';
  p.workflowStage = 'Project Closure';
  const list = spProjects(); const ix = list.findIndex(x=>String(x.id)===String(p.id)); list[ix]=p; spSave(SP_PROJ, list);
  toast('Project closed');
  renderHubOverview();
}

/* ===== DAILY SITE REPORT ===== */
function openDailyForm(projId, logId){
  const p = spProjects().find(x=>String(x.id)===String(projId));
  if(!p) return;
  const logs = spDaily();
  const log = logId ? logs.find(l=>String(l.id)===String(logId)) : null;
  document.getElementById('spDailyTitle').textContent = 'Daily Site Report — '+p.projectId;
  document.getElementById('spDailyProjId').value = projId;
  document.getElementById('spDailyLogId').value = log ? log.id : '';
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.value=v!=null?v:''; };
  set('spDDate', log?log.date:new Date().toISOString().slice(0,10));
  set('spDShift', log?log.shift:'General');
  const wtSel=document.getElementById('spDWorkType');
  if(wtSel && typeof getList==='function'){
    const cur = log?log.workType:'Installation';
    wtSel.innerHTML = getList('workTypes').map(w=>'<option '+(w===cur?'selected':'')+'>'+w+'</option>').join('');
  } else set('spDWorkType', log?log.workType:'Installation');
  set('spDDesc', log?log.workDesc:'');
  set('spDOverall', log?log.overallProgress:p.overallProgress||0);
  set('spDToday', log?log.todayProgress:0);
  set('spDEquip', log?log.equipmentWorked:'');
  set('spDEng', log?log.manEng:1);
  set('spDSup', log?log.manSup:0);
  set('spDTech', log?log.manTech:0);
  set('spDHelp', log?log.manHelp:0);
  set('spDStart', log?log.startTime:'09:00');
  set('spDEnd', log?log.endTime:'18:00');
  set('spDTests', log?log.tests:'');
  set('spDTestResult', log?log.testResult:'Pass');
  set('spDIssues', log?log.issues:'');
  set('spDReq', log?log.requirements:'');
  set('spDTomorrow', log?log.tomorrowPlan:'');
  set('spDSafety', log?log.safetyNotes:'');
  set('spDPPE', log?log.ppe:'Yes');
  set('spDPermit', log?log.permit:'Yes');
  set('spDCustName', log?log.customerName:'');
  set('spDCustDesig', log?log.customerDesig:'');
  set('spDRemarks', log?log.remarks:'');
  document.getElementById('spDailyModal').classList.add('show');
}
function closeDailyForm(){ document.getElementById('spDailyModal').classList.remove('show'); }
function saveDaily(){
  const projId = document.getElementById('spDailyProjId').value;
  const logId = document.getElementById('spDailyLogId').value || (Date.now()+Math.random());
  const get = id => (document.getElementById(id)||{}).value||'';
  const row = {
    id: logId, projectId: projId,
    date: get('spDDate'), time: new Date().toLocaleTimeString('en-IN'),
    shift: get('spDShift'), workType: get('spDWorkType'), workDesc: get('spDDesc'),
    overallProgress: parseFloat(get('spDOverall'))||0, todayProgress: parseFloat(get('spDToday'))||0,
    equipmentWorked: get('spDEquip'),
    manEng: parseFloat(get('spDEng'))||0, manSup: parseFloat(get('spDSup'))||0,
    manTech: parseFloat(get('spDTech'))||0, manHelp: parseFloat(get('spDHelp'))||0,
    startTime: get('spDStart'), endTime: get('spDEnd'),
    tests: get('spDTests'), testResult: get('spDTestResult'),
    issues: get('spDIssues'), requirements: get('spDReq'), tomorrowPlan: get('spDTomorrow'),
    safetyNotes: get('spDSafety'), ppe: get('spDPPE'), permit: get('spDPermit'),
    customerName: get('spDCustName'), customerDesig: get('spDCustDesig'), remarks: get('spDRemarks'),
    filledBy: (typeof getSession==='function'&&getSession())?(getSession().name||getSession().id):'',
    updatedAt: new Date().toISOString()
  };
  let logs = spDaily();
  const ix = logs.findIndex(l=>String(l.id)===String(logId));
  if(ix>=0) logs[ix]=row; else logs.unshift(row);
  spSave(SP_DAILY, logs);
  // Update project overall progress
  const projs = spProjects();
  const pix = projs.findIndex(x=>String(x.id)===String(projId));
  if(pix>=0){ projs[pix].overallProgress = row.overallProgress; spSave(SP_PROJ, projs); }
  closeDailyForm();
  if(_hubProjId) renderHubDaily();
  toast('Daily report saved · Progress '+row.overallProgress+'%');
}

/* ===== NEAR MISS ===== */
function openNearMissForm(projId){
  document.getElementById('spNmProjId').value = projId;
  document.getElementById('spNmDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('spNmDesc').value = '';
  document.getElementById('spNmLocation').value = '';
  document.getElementById('spNmSeverity').value = 'Medium';
  document.getElementById('spNmAction').value = '';
  document.getElementById('spNmStatus').value = 'Open';
  document.getElementById('spNmPersons').value = '';
  document.getElementById('spNearModal').classList.add('show');
}
function closeNearMiss(){ document.getElementById('spNearModal').classList.remove('show'); }
function saveNearMiss(){
  const desc = (document.getElementById('spNmDesc').value||'').trim();
  if(!desc){ toast('Description required'); return; }
  const row = {
    id: Date.now()+Math.random(),
    projectId: document.getElementById('spNmProjId').value,
    date: document.getElementById('spNmDate').value,
    location: document.getElementById('spNmLocation').value,
    description: desc,
    severity: document.getElementById('spNmSeverity').value,
    correctiveAction: document.getElementById('spNmAction').value,
    status: document.getElementById('spNmStatus').value,
    personsInvolved: document.getElementById('spNmPersons').value,
    reportedBy: (typeof getSession==='function'&&getSession())?(getSession().name||''):'',
    updatedAt: new Date().toISOString()
  };
  const list = spNearMiss(); list.unshift(row); spSave(SP_NEAR, list);
  closeNearMiss();
  if(_hubProjId) renderHubNearMiss();
  toast('Near miss recorded');
}

/* ===== PERFORMANCE EVALUATION (from daily data) ===== */
function openPEReport(engId){
  const eng = spEngineers().find(e=>String(e.id)===String(engId));
  if(!eng) return;
  const projs = spProjects().filter(p=>String(p.engineerId)===String(engId));
  const projIds = new Set(projs.map(p=>String(p.id)));
  const logs = spDaily().filter(d=>projIds.has(String(d.projectId)));
  const near = spNearMiss().filter(n=>projIds.has(String(n.projectId)));

  // Scoring 0-100 from operational data
  let score = 70; // base
  // Progress contribution
  const avgProg = projs.length ? projs.reduce((s,p)=>s+calcProjectProgress(p.id),0)/projs.length : 0;
  score += (avgProg/100)*15;
  // Daily reporting discipline
  const daysWithLog = new Set(logs.map(l=>l.date)).size;
  score += Math.min(10, daysWithLog);
  // Safety - near miss open reduces
  const openNM = near.filter(n=>n.status==='Open').length;
  score -= openNM * 5;
  // Test pass rate
  const tests = logs.filter(l=>l.testResult);
  const pass = tests.filter(l=>l.testResult==='Pass').length;
  if(tests.length) score += (pass/tests.length)*5;
  score = Math.max(0, Math.min(100, Math.round(score*10)/10));

  const hold = score < 85;
  const grade = score>=95?'A+':score>=90?'A':score>=85?'B+':score>=75?'B':score>=60?'C':'D';
  const color = hold?'#b91c1c':score>=90?'#0f766e':'#1a56a8';

  let h = `<div class="co">CENTURY SOLUTION</div>
    <div class="co-sub">Site Engineer Performance Evaluation</div>
    <div class="co-sub" style="font-size:9pt">${esc(eng.name)} · ${esc(eng.code)} · Generated ${new Date().toLocaleString('en-IN')}</div>
    <hr class="hl"><hr class="hl2">
    <table class="meta"><tr><td class="lbl">Projects</td><td>${projs.length}</td><td class="lbl">Daily logs</td><td>${logs.length}</td></tr>
    <tr><td class="lbl">Near miss</td><td>${near.length} (${openNM} open)</td><td class="lbl">Avg site progress</td><td>${avgProg.toFixed(0)}%</td></tr></table>
    <div style="text-align:center;margin:16px 0;padding:16px;border:2px solid ${color}">
      <div style="font-size:28pt;font-weight:800;color:${color}">${score}%</div>
      <div style="font-size:14pt;font-weight:700;color:${color}">Grade ${grade}</div>
      <div style="margin-top:8px;font-weight:700;color:${hold?'#b91c1c':'#0f766e'}">${hold?'⚠ SALARY HOLD — Score below 85%. Improve reporting, safety & progress.':'✓ Cleared for salary release'}</div>
    </div>
    <div class="sec">Projects</div>
    <table class="pt"><thead><tr><th>Project</th><th>Customer</th><th>Progress</th><th>Status</th></tr></thead><tbody>
    ${projs.map(p=>`<tr><td>${esc(p.projectId)} ${esc(p.name)}</td><td>${esc(p.customer)}</td><td>${calcProjectProgress(p.id)}%</td><td>${esc(p.status)}</td></tr>`).join('')||'<tr><td colspan="4">None</td></tr>'}
    </tbody></table>
    <p style="font-size:9pt;margin-top:12px"><b>Scoring basis:</b> Base 70 + progress up to 15 + daily discipline up to 10 + test quality up to 5 − open near-miss ×5. Threshold 85%.</p>
    <div class="sig">For <b>CENTURY SOLUTION</b><br><br>________________________<br>Authorized Signatory</div>`;

  window._peReportHtml = h;
  window._peReportTitle = 'PE — '+(eng.name||'');
  window._peReportMeta = {score, grade, hold, name: eng.name, code: eng.code};
  openPEViewer(h, window._peReportTitle, window._peReportMeta);
}

/* ===== PROJECT MIS ===== */
function generateProjectMIS(projId){
  const p = spProjects().find(x=>String(x.id)===String(projId));
  if(!p) return;
  const logs = spDaily().filter(d=>String(d.projectId)===String(projId));
  const near = spNearMiss().filter(n=>String(n.projectId)===String(projId));
  const eng = spEngineers().find(e=>String(e.id)===String(p.engineerId));
  let h = `<div class="co">CENTURY SOLUTION</div>
    <div class="co-sub">Project MIS Report</div>
    <div class="co-sub" style="font-size:9pt">${esc(p.projectId)} · ${esc(p.name)} · ${new Date().toLocaleString('en-IN')}</div>
    <hr class="hl"><hr class="hl2">
    <table class="meta">
      <tr><td class="lbl">Customer</td><td>${esc(p.customer)}</td><td class="lbl">Category</td><td>${esc(p.category)}</td></tr>
      <tr><td class="lbl">Site</td><td colspan="3">${esc(p.siteAddress)}</td></tr>
      <tr><td class="lbl">Engineer</td><td>${esc(eng?.name||'')}</td><td class="lbl">Progress</td><td>${calcProjectProgress(p.id)}%</td></tr>
      <tr><td class="lbl">PO</td><td>${esc(p.poNumber)}</td><td class="lbl">Value</td><td>₹ ${esc(p.projectValue||p.poValue)}</td></tr>
      <tr><td class="lbl">Priority</td><td>${esc(p.priority)}</td><td class="lbl">Status</td><td>${esc(p.status)}</td></tr>
    </table>
    <div class="sec">Scope</div><p style="font-size:9.5pt">${(p.scopes||[]).join(', ')||'—'}</p>
    <div class="sec">Equipment</div>
    <table class="pt"><thead><tr><th>Type</th><th>Make</th><th>Model</th><th>Rating</th><th>Qty</th></tr></thead><tbody>
    ${(p.equipment||[]).map(e=>`<tr><td>${esc(e.type)}</td><td>${esc(e.make)}</td><td>${esc(e.model)}</td><td>${esc(e.rating)}</td><td>${e.qty||1}</td></tr>`).join('')||'<tr><td colspan="5">—</td></tr>'}
    </tbody></table>
    <div class="sec">Daily Reports (${logs.length})</div>
    <table class="pt"><thead><tr><th>Date</th><th>Work</th><th>Progress</th><th>Result</th></tr></thead><tbody>
    ${logs.slice(0,30).map(l=>`<tr><td>${esc(l.date)}</td><td>${esc(l.workType)} — ${esc((l.workDesc||'').slice(0,50))}</td><td>${esc(l.overallProgress)}%</td><td>${esc(l.testResult||'—')}</td></tr>`).join('')||'<tr><td colspan="4">None</td></tr>'}
    </tbody></table>
    <div class="sec">Near Miss (${near.length})</div>
    ${near.length?`<table class="pt"><thead><tr><th>Date</th><th>Severity</th><th>Description</th><th>Status</th></tr></thead><tbody>
    ${near.map(n=>`<tr><td>${esc(n.date)}</td><td>${esc(n.severity)}</td><td>${esc(n.description)}</td><td>${esc(n.status)}</td></tr>`).join('')}
    </tbody></table>`:'<p style="font-size:9.5pt">None reported</p>'}
    <div class="sig">For <b>CENTURY SOLUTION</b><br><br>________________________</div>`;
  openPEViewer(h, 'Project MIS — '+(p.projectId||''), {project:true});
}

function generateAllPEReport(){
  if(!canManageProjects()){ toast('Office only'); return; }
  const engs = spEngineers();
  if(!engs.length){ toast('No site engineers'); return; }
  const rows = engs.map((eng,i)=>{
    const projs = spProjects().filter(p=>String(p.engineerId)===String(eng.id));
    const projIds = new Set(projs.map(p=>String(p.id)));
    const logs = spDaily().filter(d=>projIds.has(String(d.projectId)));
    const near = spNearMiss().filter(n=>projIds.has(String(n.projectId)));
    let score = 70;
    const avgProg = projs.length ? projs.reduce((s,p)=>s+calcProjectProgress(p.id),0)/projs.length : 0;
    score += (avgProg/100)*15;
    score += Math.min(10, new Set(logs.map(l=>l.date)).size);
    score -= near.filter(n=>n.status==='Open').length * 5;
    const tests = logs.filter(l=>l.testResult);
    if(tests.length) score += (tests.filter(l=>l.testResult==='Pass').length/tests.length)*5;
    score = Math.max(0, Math.min(100, Math.round(score*10)/10));
    const hold = score < 85;
    const grade = score>=95?'A+':score>=90?'A':score>=85?'B+':score>=75?'B':score>=60?'C':'D';
    return {sno:i+1, name:eng.name, code:eng.code, projects:projs.length, logs:logs.length, score, grade, status:hold?'SALARY HOLD':'Cleared'};
  });
  let h = `<div class="co">CENTURY SOLUTION</div>
    <div class="co-sub">All Site Engineers — Performance Report</div>
    <div class="co-sub" style="font-size:9pt">${new Date().toLocaleString('en-IN')} · Threshold 85%</div>
    <hr class="hl"><hr class="hl2">
    <table class="pt"><thead><tr><th>#</th><th>Code</th><th>Name</th><th>Projects</th><th>Logs</th><th>Score %</th><th>Grade</th><th>Status</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td>${r.sno}</td><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${r.projects}</td><td>${r.logs}</td><td><b>${r.score}</b></td><td>${r.grade}</td><td style="color:${r.status==='SALARY HOLD'?'#b91c1c':'#0f766e'};font-weight:700">${r.status}</td></tr>`).join('')}
    </tbody></table>
    <div class="sig">For <b>CENTURY SOLUTION</b></div>`;
  window._peAllRows = rows;
  window._peReportHtml = h;
  window._peReportTitle = 'All Site Engineers — PE Report';
  openPEViewer(h, window._peReportTitle, {all:true, rows:rows});
}

/* ===== VIEW HOOKS ===== */
(function(){
  const prev = window.showView;
  window.showView = function(v){
    if(typeof prev==='function') prev(v);
    if(v==='sp-engineers') renderSiteEngineers();
    if(v==='sp-projects' && _spEngId) renderProjectsForEngineer(_spEngId);
  };
})();

document.addEventListener('DOMContentLoaded', function(){
  setTimeout(applySiteProjAccess, 150);
});
(function(){
  const prev = window.applySessionToUI;
  if(typeof prev==='function'){
    window.applySessionToUI = function(s){
      prev(s);
      setTimeout(applySiteProjAccess, 60);
      if(s && s.role==='site_worker'){
        setTimeout(function(){ if(typeof showView==='function') showView('sp-engineers'); }, 120);
      }
    };
  }
})();

console.log('Site Projects module loaded');


function openPEViewer(html, title, meta){
  const modal = document.getElementById('peViewerModal');
  const body = document.getElementById('peViewerBody');
  const tit = document.getElementById('peViewerTitle');
  if(!modal||!body){
    // fallback: open window without auto-print
    const w=window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>'+title+'</title><style>'+(typeof css==='function'?css():'')+'</style></head><body>'+html+'</body></html>');
    w.document.close();
    return;
  }
  if(tit) tit.textContent = title||'Report';
  body.innerHTML = html;
  window._peLastHtml = html;
  window._peLastMeta = meta||{};
  modal.classList.add('show');
}
function closePEViewer(){ document.getElementById('peViewerModal').classList.remove('show'); }
function peExportPDF(){
  const w=window.open('','_blank');
  w.document.write('<!DOCTYPE html><html><head><title>'+(window._peReportTitle||'Report')+'</title><style>'+(typeof css==='function'?css():'body{font-family:Georgia,serif;margin:15mm;font-size:10pt}')+
    '@media print{body{margin:12mm}}</style></head><body>'+(window._peLastHtml||'')+'</body></html>');
  w.document.close();
  setTimeout(function(){ try{ w.print(); }catch(e){} }, 300);
}
function peExportWord(){
  const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Report</title></head><body>'+(window._peLastHtml||'')+'</body></html>';
  const blob = new Blob(['\ufeff'+html], {type:'application/msword'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=(window._peReportTitle||'Report').replace(/[^\w\-]+/g,'_')+'.doc'; a.click();
  try{ toast('Word file downloaded'); }catch(e){}
}
function peExportExcel(){
  const meta = window._peLastMeta||{};
  if(meta.all && meta.rows && typeof downloadColorExcel==='function'){
    downloadColorExcel('CENTURY_SitePE_'+new Date().toISOString().slice(0,10)+'.xls','PE',
      ['#','Code','Name','Projects','Logs','Score %','Grade','Status'],
      meta.rows.map(r=>[r.sno,r.code,r.name,r.projects,r.logs,r.score,r.grade,r.status]));
    return;
  }
  // single engineer — simple sheet
  const m = meta;
  if(typeof downloadColorExcel==='function'){
    downloadColorExcel('PE_'+(m.name||'report')+'.xls','PE',
      ['Field','Value'],
      [['Name',m.name||''],['Code',m.code||''],['Score %',m.score||''],['Grade',m.grade||''],['Status',m.hold?'SALARY HOLD':'Cleared']]);
  } else try{ toast('Excel helper not available'); }catch(e){}
}
