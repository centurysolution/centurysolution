/* CENTURY SOLUTION v4 */
let docType='offer', scopes=['Supply'], lines=[], taxes=[{name:'GST',pct:18}];
/* Optional price columns: make, catNo, plus custom extraCols */
let showMake=true, showCatNo=true, showDisc=true;
let extraCols=[]; // [{id,label}]

let schedule=[], customScopes=[], sowPackages=[], sitcPoints=[];
let tcList=JSON.parse(JSON.stringify(DEFAULT_TCS));
let saved=JSON.parse(localStorage.getItem('cs4_saved')||'[]');
let pickerMode='master', pickerSel=null;

const TITLES={offer:'COMMERCIAL OFFER',po:'PURCHASE ORDER',pi:'PROFORMA INVOICE'};

const COMPANY_DEFAULTS = {
  address: '210 Shagun Palace\n3 Sapru Marg, Hazratganj, Lucknow 226001',
  phone: '0522 4049754',
  phone2: '7458014000',
  email: 'info@centurysolution.co.in',
  gst: ''
};

let scopeMappings = {}; // scope name -> master|sow|maint|custom
let noteBlocks = [{title:'Additional Notes', text:'', position:'after', serial:'', tables:[]}];
let priceMemory = {}; // desc key -> {rate, disc, unit}
let clientsDB = [];
let vendorsDB = [];



/* Category name → equipment codes in ITEMS */
const CAT_TO_EQ = {
  'IPAN / MV SWITCHGEAR PANEL':['IPAN'],
  'CURRENT TRANSFORMERS (CTs)':['CT'],
  'VOLTAGE TRANSFORMERS (VTs / PTs)':['PT / VT','PT','VT'],
  'CONTROL & PROTECTION RELAYS':['PROTECTION RELAY','AUXILIARY RELAY'],
  'BUSBARS':['BUSBAR'],
  'METERS & INDICATORS':['INDICATING LAMP','METER'],
  'CONTROL SWITCHES & BUTTONS':['PUSH BUTTON','ROTARY SWITCH','SELECTOR'],
  'CABLE TERMINATION KITS':['CABLE TERMINATION'],
  'INTERLOCKING MECHANISMS':['INTERLOCK'],
  'AUXILIARY CONTACTS':['AUXILIARY'],
  'SURGE ARRESTERS':['SURGE ARRESTER'],
  'INSULATORS':['INSULATOR'],
  'PANEL MOUNTING HARDWARE':['HARDWARE'],
  'VENTILATION & COOLING':['HEATER','FAN','THERMOSTAT'],
  'SHROUDS AND COVERS':['SHROUD','COVER'],
  'COMMUNICATION INTERFACES':['COMMUNICATION','RS485','ETHERNET'],
  'TERMINAL BLOCKS':['TERMINAL'],
  'GROUNDING SYSTEM':['EARTH','GROUND'],
  'FAULT INDICATORS':['FAULT'],
  'POWER SUPPLIES':['POWER SUPPLY','CHARGER','SMPS'],
  'ACB':['ACB'],
  'MCCB':['MCCB'],
  'MCB / RCCB / RCBO / ISOLATOR':['MCB','RCCB','RCBO','ISOLATOR','DC MCB'],
  'SDFU / SWITCH DISCONNECTOR':['SDFU','SWITCH DISCONNECTOR'],
  'MPCB / CONTACTOR / OLR':['MPCB','CONTACTOR','OVERLOAD RELAY','CAPACITOR CONTACTOR'],
  'HRC FUSE':['HRC FUSE'],
  'SPD':['SPD'],
  'TRANSFORMER':['TRANSFORMER']
};

function guessUoM(desc, mode){
  const d=(desc||'').toLowerCase();
  if(mode==='sow' || mode==='service' || /service|testing|inspection|installation|maintenance|commissioning|overhaul|amc|job/.test(d))
    return 'Job';
  if(/busbar|bus duct|busduct|cable tray|trunking|conductor|wire|cable \(/.test(d) || /\bm\b.*length|length.*\bm\b|per meter|per metre/.test(d))
    return 'm';
  if(/kg|weight/.test(d)) return 'Kg';
  if(/set|kit/.test(d)) return 'Set';
  if(/lot|lump/.test(d)) return 'Lot';
  return 'Nos';
}

function matchEquipment(it, catName){
  const codes = CAT_TO_EQ[catName];
  const e = (it.e||'').toUpperCase().trim();
  const d = (it.d||'').toUpperCase();
  if(codes){
    // strict: equipment field must match one of the codes
    for(const c of codes){
      const cu=c.toUpperCase();
      if(e === cu) return true;
      // exact equipment match only, not loose description (prevents ACB matching MCCB)
    }
    // special: for multi-code categories allow e match
    return false;
  }
  // direct match: category name equals equipment
  if(e === catName.toUpperCase()) return true;
  if(e === catName) return true;
  return false;
}

function init(){
  const t=new Date();
  document.getElementById('docDate').value=t.toISOString().slice(0,10);
  document.getElementById('refNo').value='CS/'+t.getFullYear()+'/'+String(t.getMonth()+1).padStart(2,'0')+'/'+String(Math.floor(Math.random()*900)+100);
  loadCustomItems(); loadCustomCats(); loadSOWOverrides(); loadWorkspace(); loadCompanyDefaults(); loadCRM(); loadPriceMemory(); try{seedEmployeesIfNeeded();}catch(e){} renderScopes(); renderTCs(); renderTaxes(); updateIntro(); updateAddButtons(); updateSitcVisibility(); updateScheduleVisibility(); renderSched();
  document.getElementById('itemCount').textContent=ITEMS.length.toLocaleString();
  if(typeof renderDashboard==='function') try{ renderDashboard(); }catch(e){ console.error(e); }
  document.getElementById('catCount').textContent=CATEGORIES.length;
  renderMasterScopes(); renderMasterCats(); renderMasterSOW();
}

/* VIEWS */
function showView(v){
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  const view=document.getElementById('view-'+v);
  if(view) view.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  if(v==='dashboard' && typeof renderDashboard==='function') renderDashboard();
  if(v==='orders' && typeof renderOrdersList==='function') renderOrdersList();
  if(v==='reports') renderReports();
  if(v==='clients') renderCRM('clients');
  if(v==='vendors') renderCRM('vendors');
  if(v==='employees') renderEmployees();
  if(v==='masters'){
    if(typeof renderMasterScopes==='function') renderMasterScopes();
    if(typeof renderMasterCats==='function') renderMasterCats();
    if(typeof renderMasterSOW==='function') renderMasterSOW();
  }
}

/* DOC TYPE */
function setDocType(t){
  docType=t;
  document.querySelectorAll('.dtype').forEach(b=>b.classList.toggle('active',b.dataset.t===t));
  document.getElementById('lblRef').textContent=t==='po'?'PO Number':t==='pi'?'PI Number':'Offer Ref. No.';
  const cb=document.getElementById('consigneeBlock');
  if(cb) cb.style.display=(t==='po'||t==='pi')?'block':'none';
  // refresh ref series for new docs
  const cur=document.getElementById('refNo').value||'';
  if(!cur || cur.startsWith('CS/') || cur.startsWith('PO/') || cur.startsWith('PI/') || /^\d{4,}$/.test(cur)){
    document.getElementById('refNo').value=nextDocRef(t);
  }
  updateIntro();
}

/* SCOPES */
function renderScopes(){
  const all=[...WORK_SCOPES,...customScopes];
  const el=document.getElementById('scopeChips');
  el.innerHTML='';
  all.forEach(s=>{
    const on=scopes.includes(s)?'on':'';
    el.innerHTML+=`<span class="chip ${on}" onclick="toggleScope('${s}')">${s}</span>`;
  });
  el.innerHTML+=`<span class="chip" style="border-style:dashed" onclick="addScopePrompt()">＋ Custom</span>`;
}
function toggleScope(s){
  if(scopes.includes(s)){ if(scopes.length>1) scopes=scopes.filter(x=>x!==s); }
  else scopes.push(s);
  renderScopes(); updateIntro(); updateAddButtons(); updateSitcVisibility(); updateScheduleVisibility();
}

function updateAddButtons(){
  const el=document.getElementById('addButtons');
  if(!el) return;
  let html='';
  const has=s=>scopes.includes(s);
  const shown=new Set();
  function addBtn(key,label,mode){
    if(shown.has(mode+label)) return;
    shown.add(mode+label);
    html+=`<button class="btn-sm" onclick="openItemPicker('${mode}')">${label}</button>`;
  }
  scopes.forEach(s=>{
    const map=scopeMappings[s]||(
      s==='Supply'?'master':
      (s==='Service'||s==='Testing'||s==='Inspection'||s==='Installation')?'sow':
      (s==='Maintenance'||s==='AMC')?'maint':
      s==='SITC'?'sitc':'custom'
    );
    if(map==='master') addBtn(s,'+ '+s+' (Master)','master');
    else if(map==='sow') addBtn(s,'+ '+s+' (SOW)','sow');
    else if(map==='maint') addBtn(s,'+ '+s,'maint');
    else if(map==='sitc') addBtn(s,'+ SITC','sitc');
    else addBtn(s,'+ '+s+' (Custom)','custom');
  });
  if(!html) html+=`<button class="btn-sm" onclick="openItemPicker('custom')">+ Custom</button>`;
  else if(!shown.has('customCustom') && !scopes.every(s=>(scopeMappings[s]||'')==='custom'))
    html+=`<button class="btn-sm" onclick="openItemPicker('custom')">+ Custom</button>`;
  el.innerHTML=html;
}
function updateSitcVisibility(){
  const b=document.getElementById('sitcBlock');
  if(b) b.style.display=scopes.includes('SITC')?'block':'none';
}
function addSitcPoint(){
  const t=prompt('Work scope point:');
  if(!t||!t.trim()) return;
  sitcPoints.push(t.trim());
  renderSitc();
}
function renderSitc(){
  const el=document.getElementById('sitcList');
  if(!el) return;
  el.innerHTML='';
  sitcPoints.forEach((p,i)=>{
    el.innerHTML+=`<div class="sched-row"><input value="${esc(p)}" onchange="sitcPoints[${i}]=this.value" style="flex:1"><button class="del-btn" style="width:28px;height:28px" onclick="sitcPoints.splice(${i},1);renderSitc()">×</button></div>`;
  });
}
function renderSowPkgPreview(){
  const box=document.getElementById('sowPkgPreview');
  const content=document.getElementById('sowPkgContent');
  if(!box||!content) return;
  if(!sowPackages.length){ box.style.display='none'; return; }
  box.style.display='block';
  let h='';
  sowPackages.forEach((pkg,i)=>{
    if(!pkg.excluded) pkg.excluded={};
    h+=`<div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px dashed #c7d9f5">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
        <b>${esc(pkg.equipment)}</b>
        <button class="del-btn" style="width:24px;height:24px;font-size:.7rem" onclick="removeSowPkg(${i})">×</button>
      </div>
      <label style="font-size:.65rem;margin-top:6px;display:block">Offer description (only this text appears if filled — optional)</label>
      <textarea rows="2" style="width:100%;font-size:.75rem" placeholder="Write custom description for this equipment in the offer…"
        onchange="sowPackages[${i}].description=this.value">${esc(pkg.description||'')}</textarea>
      <div style="font-size:.68rem;color:var(--muted);margin:4px 0">Activities (tick to include in Schedule of Work):</div>`;
    Object.keys(pkg.activities||{}).forEach(typ=>{
      h+=`<div style="margin:4px 0 2px 4px;font-weight:600;font-size:.78rem;color:#0047AB">${esc(typ)}</div>`;
      (pkg.activities[typ]||[]).forEach((a,ai)=>{
        const ex=pkg.excluded[typ]&&pkg.excluded[typ].includes(a);
        h+=`<label style="display:flex;align-items:flex-start;gap:6px;font-size:.72rem;margin:2px 0 2px 12px;font-weight:400">
          <input type="checkbox" ${ex?'':'checked'} onchange="toggleSowActivity(${i},'${esc(typ).replace(/'/g,"\'")}',${ai},this.checked)">
          <span>${esc(a)}</span>
        </label>`;
      });
    });
    h+=`</div>`;
  });
  content.innerHTML=h;
}
function toggleSowActivity(pkgIdx, typ, actIdx, checked){
  const pkg=sowPackages[pkgIdx];
  if(!pkg) return;
  if(!pkg.excluded) pkg.excluded={};
  if(!pkg.excluded[typ]) pkg.excluded[typ]=[];
  const act=(pkg.activities[typ]||[])[actIdx];
  if(!act) return;
  if(checked) pkg.excluded[typ]=pkg.excluded[typ].filter(x=>x!==act);
  else if(!pkg.excluded[typ].includes(act)) pkg.excluded[typ].push(act);
}

function removeSowPkg(i){
  const pkg=sowPackages[i];
  // remove matching line item
  lines=lines.filter(l=>l.sowId!==pkg.id);
  sowPackages.splice(i,1);
  renderLines(); renderSowPkgPreview();
}

function addScopePrompt(){
  const n=prompt('New work scope name:');
  if(!n||!n.trim()) return;
  customScopes.push(n.trim()); scopes.push(n.trim());
  persistWorkspace();
  renderScopes(); updateIntro(); updateAddButtons(); renderMasterScopes();
}
function updateIntro(){
  autoFillLanguage();
  autoSelectTCs();
  autoSubject();
}

function autoFillLanguage(){
  const s=scopes.join(' + ');
  const hasSupply=scopes.includes('Supply');
  const hasSite=scopes.some(x=>['Service','Inspection','Testing','SITC','Maintenance','AMC','Installation'].includes(x));
  let intro='';
  if(docType==='offer'){
    if(hasSite && hasSupply)
      intro=`We thank you for your enquiry and are pleased to submit our most competitive commercial offer for ${s} as detailed below. Our scope covers both supply of materials and site-related activities.`;
    else if(hasSite)
      intro=`We thank you for your enquiry and are pleased to submit our most competitive commercial offer for ${s}. All work shall be carried out by our experienced engineers using calibrated instruments, as detailed below.`;
    else
      intro=`We thank you for your enquiry and are pleased to submit our most competitive commercial offer for the Supply of the following items, as detailed below.`;
  } else if(docType==='po'){
    intro=`Please arrange to ${hasSite?'execute the following work':'supply the following items'} under ${s} as per the terms and conditions stated herein.`;
  } else {
    intro=`We are pleased to submit this Proforma Invoice for ${s}. Kindly arrange the advance payment to enable us to proceed.`;
  }
  document.getElementById('introText').value=intro;

  let close='';
  if(hasSite)
    close='We look forward to your valued Work Order and assure you of our best services and professional workmanship. Should you require any further clarification, please feel free to contact the undersigned.';
  else
    close='We look forward to receiving your valued Purchase Order and assuring you of our best attention and quality products at all times.';
  document.getElementById('closeText').value=close;
}

function autoSubject(){
  const client=document.getElementById('clientName').value.trim();
  const s=scopes.join(', ');
  let sub='';
  if(docType==='offer') sub=`Commercial Offer for ${s}`;
  else if(docType==='po') sub=`Purchase Order — ${s}`;
  else sub=`Proforma Invoice — ${s}`;
  if(client) sub+=` — ${client}`;
  const el=document.getElementById('subject');
  // only auto-fill if empty or previously auto
  if(!el.value || el.dataset.auto==='1'){
    el.value=sub;
    el.dataset.auto='1';
  }
}

function autoSelectTCs(){
  const hasSite=scopes.some(x=>['Service','Inspection','Testing','SITC','Maintenance','AMC','Installation'].includes(x));
  const hasSupply=scopes.includes('Supply');
  // keywords that indicate site T&Cs
  const siteKeys=['Boarding','Site Facilities','Lifting','Working Hours','Outage','Safety','Extra Work'];
  const supplyKeys=['Packing','Freight','materials supplied remain'];
  tcList.forEach(t=>{
    const txt=t.text;
    if(siteKeys.some(k=>txt.includes(k))) t.checked=hasSite;
    else if(supplyKeys.some(k=>txt.includes(k))) t.checked=hasSupply || !hasSite;
    // always keep core commercial T&Cs checked
    else if(txt.includes('Prices are')||txt.includes('valid for')||txt.includes('Payment Terms')||txt.includes('GST shall')||txt.includes('Warranty')||txt.includes('Force Majeure')||txt.includes('supersedes'))
      t.checked=true;
  });
  renderTCs();
}

/* T&C */
function renderTCs(){
  const el=document.getElementById('tcBox');
  if(!el) return;
  el.innerHTML='';
  let on=0;
  tcList.forEach((t,i)=>{
    if(t.checked) on++;
    el.innerHTML+=`<div class="tc-row" style="display:grid;grid-template-columns:16px 1fr 24px;gap:6px;align-items:start;padding:3px 2px;border-bottom:1px solid #f0f2f5">
      <input type="checkbox" id="tc${i}" ${t.checked?'checked':''} onchange="tcList[${i}].checked=this.checked;renderTCs()">
      <label for="tc${i}" style="margin:0;font-size:.65rem;font-weight:400;line-height:1.3;cursor:pointer">${esc(t.text)}</label>
      <button type="button" class="del-btn" title="Remove this clause" style="width:22px;height:22px;font-size:.7rem" onclick="deleteTC(${i})">×</button>
    </div>`;
  });
  const c=document.getElementById('tcCount');
  if(c) c.textContent='('+on+' of '+tcList.length+' selected)';
}
function deleteTC(i){
  if(i<0||i>=tcList.length) return;
  if(!confirm('Remove this Terms & Conditions clause?')) return;
  tcList.splice(i,1);
  renderTCs();
}
function addTC(){
  const t=prompt('New Terms & Conditions clause:');
  if(!t||!t.trim()) return;
  tcList.push({id:Date.now(),text:t.trim(),checked:true}); renderTCs();
}

/* TAX */
function renderTaxes(){
  const el=document.getElementById('taxChips'); el.innerHTML='';
  taxes.forEach((t,i)=>{
    el.innerHTML+=`<span class="tax-chip">${esc(t.name)} <input type="number" value="${t.pct}" min="0" max="100" step="0.01" onchange="taxes[${i}].pct=parseFloat(this.value)||0;recalc()">% <button onclick="taxes.splice(${i},1);renderTaxes();recalc()">×</button></span>`;
  });
  recalc();
}
function addTax(){
  const n=prompt('Tax name (e.g. CGST):','GST');
  if(!n) return;
  const p=parseFloat(prompt('Percentage:','18'))||0;
  taxes.push({name:n,pct:p}); renderTaxes();
}

/* SCHEDULE */
function renderSched(){
  const el=document.getElementById('schedList'); el.innerHTML='';
  if(!schedule.length) schedule=[{activity:'Mobilization',duration:'1 Day'},{activity:'Execution',duration:'As per site'},{activity:'Handover / Report',duration:'1–2 Days'}];
  schedule.forEach((r,i)=>{
    el.innerHTML+=`<div class="sched-row">
      <input value="${esc(r.activity)}" onchange="schedule[${i}].activity=this.value" placeholder="Activity">
      <input value="${esc(r.duration)}" onchange="schedule[${i}].duration=this.value" placeholder="Duration">
      <button class="item-card del-btn" style="width:28px;height:28px" onclick="schedule.splice(${i},1);renderSched()">×</button>
    </div>`;
  });
}
function addSched(){ schedule.push({activity:'',duration:''}); renderSched(); }
function pushScheduleToProject(){
  if(!schedule.length){ toast('No activities'); return; }
  const projs = typeof spProjects==='function'?spProjects():[];
  if(!projs.length){ toast('No site projects yet'); return; }
  // pick latest active or prompt
  let list = projs.filter(p=>p.status!=='Closed');
  if(!list.length) list = projs;
  const names = list.map((p,i)=>(i+1)+'. '+(p.projectId||'')+' '+(p.name||'')).join('\n');
  const n = prompt('Push schedule to which project?\n'+names+'\n\nEnter number:','1');
  const ix = (parseInt(n,10)||1)-1;
  if(ix<0||ix>=list.length) return;
  const p = list[ix];
  p.executionSchedule = schedule.map(s=>({activity:s.activity, duration:s.duration}));
  const all = spProjects();
  const pi = all.findIndex(x=>String(x.id)===String(p.id));
  if(pi>=0){ all[pi]=p; spSave(SP_PROJ, all); }
  toast('Schedule linked to '+(p.projectId||p.name));
}


/* ===== ITEM PICKER ===== */

function openItemPicker(mode){
  pickerMode=mode; pickerSel=null;
  document.getElementById('pickerTitle').textContent=
    mode==='master'?'Add from Master List':
    mode==='sow'?'Add SOW Package (Service / Testing)':'Add Custom Item';
  const body=document.getElementById('pickerBody');

  if(mode==='master'){
    // Hierarchical: Equipment → Type filter → Rating filter → Item
    let eqOpts='<option value="">— Select Equipment —</option>';
    // unique equipment from ITEMS sorted
    const eqs=[...new Set(ITEMS.map(i=>i.e).filter(Boolean))].sort();
    eqs.forEach(e=>{ eqOpts+=`<option value="${esc(e)}">${esc(e)}</option>`; });
    // also category names as groups
    let catOpts='<option value="">— Or by Category —</option>';
    CATEGORIES.forEach(c=>{ catOpts+=`<option value="CAT:${esc(c.name)}">${esc(c.name)}</option>`; });

    body.innerHTML=`
      <div class="form-grid">
        <div class="fg"><label>1. Equipment</label><select id="pEquip" onchange="onMasterEquip()">${eqOpts}</select></div>
        <div class="fg"><label>Or Category</label><select id="pCat" onchange="onMasterCat()">${catOpts}</select></div>
        <div class="fg"><label>2. Type / Poles</label><select id="pType" onchange="onMasterType()"><option value="">— All —</option></select></div>
        <div class="fg"><label>3. Rating</label><select id="pRating" onchange="runSearch()"><option value="">— All —</option></select></div>
        <div class="fg full"><label>Search</label><input id="pSearch" placeholder="Type to search description…" oninput="runSearch()"></div>
      </div>
      <div class="picker-results" id="pResults"><div class="pres" style="color:#64748b">Select Equipment or Category to list items</div></div>
      <div class="picker-form" id="pForm" style="display:none">
        <div class="full"><label>Description (editable)</label><textarea id="pDesc" rows="2"></textarea></div>
        <div><label>Make</label><input type="text" id="pMake" placeholder="e.g. ABB / Siemens"></div>
        <div><label>Cat No</label><input type="text" id="pCatNo" placeholder="Catalogue / Part No"></div>
        <div><label>Unit (UoM)</label><select id="pUnit"><option>Nos</option><option>Set</option><option>m</option><option>Job</option><option>Lot</option><option>Kg</option></select></div>
        <div><label>Qty</label><input type="number" id="pQty" value="1" min="0.01" step="0.01"></div>
        <div><label>Rate (₹)</label><input type="number" id="pRate" value="0" min="0" step="0.01"></div>
        <div><label>Disc %</label><input type="number" id="pDisc" value="0" min="0" max="100" step="0.1"></div>
      </div>`;
  } else if(mode==='sow'){
    let eqOpts=''; Object.keys(SOW).forEach(e=>{ eqOpts+=`<option value="${esc(e)}">${esc(e)}</option>`; });
    // filter types based on selected scopes
    let typeOpts='';
    if(scopes.includes('Service')||scopes.includes('Installation')) typeOpts+=`<option value="Service">Service</option>`;
    if(scopes.includes('Testing')||scopes.includes('Inspection')) typeOpts+=`<option value="Testing">Testing</option>`;
    if((scopes.includes('Service')||scopes.includes('Installation')) && (scopes.includes('Testing')||scopes.includes('Inspection')))
      typeOpts+=`<option value="Both">Service + Testing</option>`;
    if(!typeOpts) typeOpts=`<option value="Service">Service</option><option value="Testing">Testing</option><option value="Both">Service + Testing</option>`;
    body.innerHTML=`
      <div class="form-grid">
        <div class="fg"><label>Equipment</label><select id="pEquip" onchange="previewSOWPackage()">${eqOpts}</select></div>
        <div class="fg"><label>Type</label><select id="pSOWType" onchange="previewSOWPackage()">${typeOpts}</select></div>
      </div>
      <div style="margin:10px 0 6px;font-weight:600;font-size:.82rem;color:var(--blue)">Activities (will appear under Schedule of Work in offer — NOT as line items)</div>
      <div class="picker-results" id="pResults" style="max-height:200px"></div>
      <div class="picker-form" id="pForm" style="display:grid;margin-top:10px">
        <div class="full"><label>Package Price (₹)</label><input type="number" id="pPkgRate" value="0" min="0" step="0.01" placeholder="One price for this package"></div>
        <div class="full" style="font-size:.75rem;color:#64748b">Line item will show as e.g. "Service and Testing of Air Circuit Breaker (ACB)" — activities listed under Schedule of Work</div>
      </div>`;
    previewSOWPackage();
  } else if(mode==='maint'){
    // Maintenance / AMC — pick equipment from SOW keys or ITEMS equipment
    let eqOpts='';
    const eqs=[...new Set([...Object.keys(SOW), ...ITEMS.map(i=>i.e).filter(Boolean)])].sort();
    eqs.forEach(e=>{ eqOpts+=`<option value="${esc(e)}">${esc(e)}</option>`; });
    const label=scopes.includes('AMC')&&!scopes.includes('Maintenance')?'AMC':scopes.includes('Maintenance')&&!scopes.includes('AMC')?'Maintenance':'Maintenance / AMC';
    body.innerHTML=`
      <div class="form-grid">
        <div class="fg full"><label>Equipment</label><select id="pEquip">${eqOpts}</select></div>
        <div class="fg full"><label>Line description</label><input id="pDesc" value="${label} of "></div>
        <div><label>Make</label><input type="text" id="pMake" placeholder="Optional"></div>
        <div><label>Cat No</label><input type="text" id="pCatNo" placeholder="Optional"></div>
        <div><label>UoM</label><select id="pUnit"><option>Job</option><option>Nos</option><option>Lot</option></select></div>
        <div><label>Qty</label><input type="number" id="pQty" value="1" min="0.01"></div>
        <div><label>Rate (₹)</label><input type="number" id="pRate" value="0" min="0" step="0.01"></div>
        <div><label>Disc %</label><input type="number" id="pDisc" value="0" min="0" max="100" step="0.1"></div>
      </div>`;
    // auto fill description when equip changes
    setTimeout(()=>{
      const eq=document.getElementById('pEquip');
      const upd=()=>{ document.getElementById('pDesc').value=label+' of '+eq.value; };
      eq.onchange=upd; upd();
    },50);
  } else if(mode==='sitc'){
    body.innerHTML=`
      <div class="picker-form" style="display:grid">
        <div class="full"><label>SITC Description</label><textarea id="pDesc" rows="2" placeholder="e.g. Supply, Installation, Testing & Commissioning of 11kV Panel"></textarea></div>
        <div><label>Make</label><input type="text" id="pMake" placeholder="Optional"></div>
        <div><label>Cat No</label><input type="text" id="pCatNo" placeholder="Optional"></div>
        <div><label>UoM</label><select id="pUnit"><option>Job</option><option>Nos</option><option>Set</option><option>Lot</option></select></div>
        <div><label>Qty</label><input type="number" id="pQty" value="1" min="0.01"></div>
        <div><label>Rate (₹)</label><input type="number" id="pRate" value="0" min="0" step="0.01"></div>
        <div><label>Disc %</label><input type="number" id="pDisc" value="0" min="0" max="100" step="0.1"></div>
      </div>`;
  } else {
    body.innerHTML=`
      <div class="picker-form" style="display:grid">
        <div class="full"><label>Description</label><textarea id="pDesc" rows="3" placeholder="Enter full description"></textarea></div>
        <div><label>Make</label><input type="text" id="pMake" placeholder="e.g. ABB / Siemens"></div>
        <div><label>Cat No</label><input type="text" id="pCatNo" placeholder="Catalogue / Part No"></div>
        <div><label>Unit (UoM)</label><select id="pUnit"><option>Nos</option><option>Set</option><option>m</option><option>Job</option><option>Lot</option><option>Kg</option></select></div>
        <div><label>Qty</label><input type="number" id="pQty" value="1" min="0.01"></div>
        <div><label>Rate (₹)</label><input type="number" id="pRate" value="0" min="0" step="0.01"></div>
        <div><label>Disc %</label><input type="number" id="pDisc" value="0" min="0" max="100" step="0.1"></div>
      </div>`;
  }
  document.getElementById('pickerModal').classList.add('show');
}
function closePicker(){ document.getElementById('pickerModal').classList.remove('show'); }

function onMasterEquip(){
  document.getElementById('pCat').value='';
  fillTypeRating(); runSearch();
}
function onMasterCat(){
  document.getElementById('pEquip').value='';
  fillTypeRating(); runSearch();
}
function onMasterType(){ fillRatingsOnly(); runSearch(); }

function getFilteredItems(){
  const equip=document.getElementById('pEquip').value;
  const catRaw=document.getElementById('pCat').value;
  const cat=catRaw.startsWith('CAT:')?catRaw.slice(4):'';
  const type=(document.getElementById('pType')||{}).value||'';
  const rating=(document.getElementById('pRating')||{}).value||'';
  const q=((document.getElementById('pSearch')||{}).value||'').toLowerCase().trim();
  const out=[];
  for(let i=0;i<ITEMS.length;i++){
    const it=ITEMS[i];
    if(equip){
      if((it.e||'')!==equip) continue;
    } else if(cat){
      if(!matchEquipment(it, cat)) continue;
    } else {
      continue; // must select equip or cat
    }
    if(type && (it.t||'')!==type && !(it.d||'').includes(type)) continue;
    if(rating && (it.r||'')!==rating) continue;
    if(q){
      const t=((it.d||'')+' '+(it.r||'')+' '+(it.s||'')+' '+(it.e||'')).toLowerCase();
      if(!t.includes(q)) continue;
    }
    out.push({idx:i, it});
  }
  return out;
}

function fillTypeRating(){
  const items=getFilteredItems();
  const types=new Set(); const ratings=new Set();
  items.forEach(({it})=>{
    if(it.t) types.add(it.t);
    // extract poles from description e.g. 3P 4P
    const m=(it.d||'').match(/\b([234]P|TP|FP|SP)\b/);
    if(m) types.add(m[1]);
    if(it.r) ratings.add(it.r);
  });
  const tSel=document.getElementById('pType');
  const rSel=document.getElementById('pRating');
  const curT=tSel.value, curR=rSel.value;
  tSel.innerHTML='<option value="">— All —</option>';
  [...types].sort().forEach(t=>{ tSel.innerHTML+=`<option value="${esc(t)}">${esc(t)}</option>`; });
  if(curT) tSel.value=curT;
  rSel.innerHTML='<option value="">— All —</option>';
  [...ratings].sort((a,b)=>parseFloat(a)-parseFloat(b)||a.localeCompare(b)).forEach(r=>{
    rSel.innerHTML+=`<option value="${esc(r)}">${esc(r)}</option>`;
  });
  if(curR) rSel.value=curR;
}
function fillRatingsOnly(){
  // re-filter ratings based on type
  const items=getFilteredItems();
  const ratings=new Set();
  items.forEach(({it})=>{ if(it.r) ratings.add(it.r); });
  const rSel=document.getElementById('pRating');
  const curR=rSel.value;
  rSel.innerHTML='<option value="">— All —</option>';
  [...ratings].sort((a,b)=>parseFloat(a)-parseFloat(b)||a.localeCompare(b)).forEach(r=>{
    rSel.innerHTML+=`<option value="${esc(r)}">${esc(r)}</option>`;
  });
  if(curR) rSel.value=curR;
}

function runSearch(){
  const res=document.getElementById('pResults');
  if(!res) return;
  const items=getFilteredItems();
  res.innerHTML='';
  if(!items.length){
    res.innerHTML='<div class="pres" style="color:#64748b">No items found. Select Equipment (e.g. MCCB) first.</div>';
    return;
  }
  let n=0;
  for(const {idx,it} of items){
    const sub=[it.r,it.t,it.s,it.e].filter(Boolean).join(' · ');
    res.innerHTML+=`<div class="pres" onclick="selectMaster(${idx},this)"><div class="pr-title">${esc(it.d)}</div><div class="pr-sub">${esc(sub)}</div></div>`;
    n++;
    if(n>=100){ res.innerHTML+=`<div class="pres" style="color:#64748b">Showing first 100 of ${items.length} — refine filters</div>`; break; }
  }
}

function selectMaster(idx,el){
  document.querySelectorAll('.pres').forEach(p=>p.classList.remove('sel'));
  el.classList.add('sel');
  const it=ITEMS[idx]; pickerSel=it;
  let d=it.d;
  if(it.r) d+=' | Rating: '+it.r;
  if(it.s) d+=' | '+it.s;
  if(it.t) d+=' | '+it.t;
  document.getElementById('pForm').style.display='grid';
  document.getElementById('pDesc').value=d;
  document.getElementById('pUnit').value=guessUoM(d,'supply');
}

function previewSOWPackage(){
  const eq=document.getElementById('pEquip').value;
  const typ=document.getElementById('pSOWType').value;
  const res=document.getElementById('pResults');
  res.innerHTML='';
  let acts=[];
  if(typ==='Both'){
    acts=[...(SOW[eq]?.Service||[]).map(a=>({cat:'Service',a})), ...(SOW[eq]?.Testing||[]).map(a=>({cat:'Testing',a}))];
  } else {
    acts=(SOW[eq]?.[typ]||[]).map(a=>({cat:typ,a}));
  }
  if(!acts.length){ res.innerHTML='<div class="pres" style="color:#64748b">No activities</div>'; return; }
  acts.forEach((x,i)=>{
    res.innerHTML+=`<div class="pres" style="cursor:default"><div class="pr-title">${i+1}. ${esc(x.a)}</div><div class="pr-sub">${esc(x.cat)}</div></div>`;
  });
  res.innerHTML+=`<div class="pres" style="color:var(--blue);font-weight:600">${acts.length} activities in package</div>`;
  pickerSel={eq,typ,acts};
}

function confirmAddItem(){
  if(pickerMode==='sow'){
    addSOWPackage();
    return;
  }
  const desc=(document.getElementById('pDesc')||{}).value;
  if(!desc||!desc.trim()){ toast('Select / enter description'); return; }
  const unit=(document.getElementById('pUnit')||{}).value||guessUoM(desc,pickerMode);
  let rate=parseFloat((document.getElementById('pRate')||{}).value)||0;
  let disc=parseFloat((document.getElementById('pDisc')||{}).value)||0;
  let uom=unit;
  const mem=recallPrice(desc.trim());
  if(mem){
    if(!rate) rate=mem.rate;
    if(!disc) disc=mem.disc;
    if(mem.unit) uom=mem.unit;
  }
  const makeVal=(document.getElementById('pMake')||{}).value||'';
  const catVal=(document.getElementById('pCatNo')||{}).value||'';
  const extras={};
  (extraCols||[]).forEach(c=>{
    const el=document.getElementById('pExtra_'+c.id);
    if(el && el.value) extras[c.id]=el.value;
  });
  lines.push({
    id:Date.now()+Math.random(),
    desc:desc.trim(),
    unit:uom,
    qty:parseFloat((document.getElementById('pQty')||{}).value)||1,
    rate:rate,
    disc:disc,
    make:makeVal.trim(),
    catNo:catVal.trim(),
    extras:extras
  });
  rememberPrice(desc.trim(), rate, disc, uom);
  closePicker(); renderLines(); toast('Item added');
}

function addSOWPackage(){
  const eq=document.getElementById('pEquip').value;
  const typ=document.getElementById('pSOWType').value;
  let activities={};
  if(typ==='Both' || typ==='Service'){
    activities.Service=[...(SOW[eq]?.Service||[])];
  }
  if(typ==='Both' || typ==='Testing'){
    activities.Testing=[...(SOW[eq]?.Testing||[])];
  }
  const types=Object.keys(activities).filter(k=>activities[k].length);
  if(!types.length){ toast('No activities'); return; }
  const pkgRate=parseFloat(document.getElementById('pPkgRate').value)||0;
  // Line item name only
  let lineName='';
  if(types.length===2) lineName=`Service and Testing of ${eq}`;
  else if(types[0]==='Service') lineName=`Service of ${eq}`;
  else lineName=`Testing of ${eq}`;
  const pkgId=Date.now()+Math.random();
  sowPackages.push({id:pkgId, equipment:eq, types:types, activities:activities, rate:pkgRate});
  lines.push({
    id:Date.now()+Math.random(),
    sowId:pkgId,
    desc:lineName,
    unit:'Job', qty:1, rate:pkgRate, disc:0,
    make:'', catNo:'', extras:{}
  });
  closePicker(); renderLines(); renderSowPkgPreview();
  toast(lineName+' added');
}


function renderLines(){
  const list=document.getElementById('itemsList');
  const empty=document.getElementById('itemsEmpty');
  const bar=document.getElementById('bottomBar');
  if(!lines.length){
    empty.style.display='block'; list.innerHTML=''; bar.style.display='none'; return;
  }
  empty.style.display='none'; bar.style.display='flex';

  // Column visibility controls
  let colCtrl = `<div class="line-col-ctrl" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px;font-size:.68rem">
    <span style="color:var(--muted);font-weight:600">Columns:</span>
    <label style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;text-transform:none;font-size:.68rem;font-weight:500;color:var(--text)">
      <input type="checkbox" ${showMake?'checked':''} onchange="showMake=this.checked;renderLines()"> Make
    </label>
    <label style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;text-transform:none;font-size:.68rem;font-weight:500;color:var(--text)">
      <input type="checkbox" ${showCatNo?'checked':''} onchange="showCatNo=this.checked;renderLines()"> Cat No
    </label>
    <label style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;text-transform:none;font-size:.68rem;font-weight:500;color:var(--text)">
      <input type="checkbox" ${showDisc?'checked':''} onchange="showDisc=this.checked;renderLines()"> Disc %
    </label>`;
  (extraCols||[]).forEach((c,ci)=>{
    colCtrl += `<span class="chip on" style="padding:2px 8px;font-size:.65rem">${esc(c.label)} <button type="button" style="background:none;border:none;color:#fff;cursor:pointer;font-size:.75rem;padding:0 0 0 4px" onclick="removeExtraCol(${ci})" title="Remove column">×</button></span>`;
  });
  colCtrl += `<button type="button" class="btn-xs" onclick="addExtraCol()">+ Custom column</button></div>`;

  // Header
  let head = `<div class="item-head item-head-dyn" style="display:grid;gap:4px;grid-template-columns:${buildLineGridCols()}">
    <span>#</span><span>Description</span>`;
  if(showMake) head += `<span>Make</span>`;
  if(showCatNo) head += `<span>Cat No</span>`;
  (extraCols||[]).forEach(c=>{ head += `<span>${esc(c.label)}</span>`; });
  head += `<span>Qty</span><span>UoM</span><span>Rate</span>`;
  if(showDisc) head += `<span>Disc%</span>`;
  head += `<span>Amount</span><span></span></div>`;

  list.innerHTML = colCtrl + head;
  lines.forEach((l,i)=>{
    if(!l.extras) l.extras={};
    const amt=l.qty*l.rate*(1-l.disc/100);
    let row = `<div class="item-card item-card-dyn" style="display:grid;gap:4px;align-items:start;grid-template-columns:${buildLineGridCols()}">
      <div class="num">${i+1}</div>
      <textarea onchange="lines[${i}].desc=this.value" onpaste="enhanceDescPaste(event,${i})">${esc(l.desc)}</textarea>`;
    if(showMake) row += `<input type="text" value="${esc(l.make||'')}" placeholder="Make" onchange="lines[${i}].make=this.value" style="font-size:.7rem;padding:3px 4px">`;
    if(showCatNo) row += `<input type="text" value="${esc(l.catNo||'')}" placeholder="Cat No" onchange="lines[${i}].catNo=this.value" style="font-size:.7rem;padding:3px 4px">`;
    (extraCols||[]).forEach(c=>{
      row += `<input type="text" value="${esc((l.extras&&l.extras[c.id])||'')}" placeholder="${esc(c.label)}" onchange="if(!lines[${i}].extras)lines[${i}].extras={};lines[${i}].extras['${c.id}']=this.value" style="font-size:.7rem;padding:3px 4px">`;
    });
    row += `
      <input type="number" value="${l.qty}" min="0.01" step="0.01" onchange="lines[${i}].qty=parseFloat(this.value)||0;renderLines()">
      <select onchange="lines[${i}].unit=this.value">
        ${['Nos','Set','m','Job','Lot','Kg'].map(u=>'<option value="'+u+'"'+(l.unit===u?' selected':'')+'>'+u+'</option>').join('')}
      </select>
      <input type="number" value="${l.rate}" min="0" step="0.01" onchange="lines[${i}].rate=parseFloat(this.value)||0;rememberPrice(lines[${i}].desc,lines[${i}].rate,lines[${i}].disc,lines[${i}].unit);renderLines()">
      ${showDisc?`<input type="number" value="${l.disc}" min="0" max="100" step="0.1" onchange="lines[${i}].disc=parseFloat(this.value)||0;rememberPrice(lines[${i}].desc,lines[${i}].rate,lines[${i}].disc,lines[${i}].unit);renderLines()">`:''}
      <div class="amt">₹ ${fmt(amt)}</div>
      <button class="del-btn" onclick="lines.splice(${i},1);renderLines()">×</button>
    </div>`;
    list.innerHTML += row;
  });
  recalc();
}
function buildLineGridCols(){
  // # | desc | [make] [catNo] [extras...] | qty | uom | rate | disc | amt | del
  let parts = ['22px','minmax(140px,1.6fr)'];
  if(showMake) parts.push('70px');
  if(showCatNo) parts.push('70px');
  (extraCols||[]).forEach(()=>parts.push('70px'));
  parts.push('48px','52px','72px');
  if(showDisc) parts.push('48px');
  parts.push('72px','28px');
  return parts.join(' ');
}
function addExtraCol(){
  const label = prompt('Custom column name (e.g. HSN, Warranty, Model):');
  if(!label || !label.trim()) return;
  const id = 'x'+Date.now();
  extraCols.push({id, label: label.trim()});
  lines.forEach(l=>{ if(!l.extras) l.extras={}; });
  renderLines();
  toast('Column "'+label.trim()+'" added — fill values on each line');
}
function removeExtraCol(idx){
  if(idx<0||idx>=extraCols.length) return;
  const c = extraCols[idx];
  if(!confirm('Remove column "'+c.label+'" from all lines?')) return;
  extraCols.splice(idx,1);
  lines.forEach(l=>{ if(l.extras) delete l.extras[c.id]; });
  renderLines();
}

function recalc(){
  let sub=0,disc=0;
  lines.forEach(l=>{sub+=l.qty*l.rate;disc+=l.qty*l.rate*(l.disc/100);});
  const taxable=sub-disc;
  document.getElementById('vSub').textContent='₹ '+fmt(sub);
  document.getElementById('vDisc').textContent='₹ '+fmt(disc);
  let th='',ts=0;
  taxes.forEach(t=>{const a=taxable*t.pct/100;ts+=a;th+=`<div class="tot-line"><span>${esc(t.name)} ${t.pct}%</span><strong>₹ ${fmt(a)}</strong></div>`;});
  document.getElementById('vTaxLines').innerHTML=th;
  document.getElementById('vGrand').textContent='₹ '+fmt(taxable+ts);
}
function fmt(n){return Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* PREVIEW & BUILD */
function openPreview(){
  if(!lines.length){ toast('Add at least one item'); return; }
  document.getElementById('previewContent').innerHTML=`<div class="offer-doc" id="printDoc">${buildDoc()}</div>`;
  document.getElementById('prevTitle').textContent=TITLES[docType]+' Preview';
  document.getElementById('previewModal').classList.add('show');
}
function closePreview(){ document.getElementById('previewModal').classList.remove('show'); }

function buildDoc(){
  const co='CENTURY SOLUTION';
  const addr=document.getElementById('ourAddress').value;
  const phone=formatPhones(document.getElementById('ourPhone').value, (document.getElementById('ourPhone2')||{}).value);
  const ourEmail=(document.getElementById('ourEmail')||{}).value||'';
  const gst=document.getElementById('ourGST').value;
  const cn=document.getElementById('clientName').value||'[Client Name]';
  const cc=document.getElementById('clientContact').value;
  const ca=document.getElementById('clientAddress').value;
  const cp=formatPhones(document.getElementById('clientPhone').value, (document.getElementById('clientPhone2')||{}).value);
  const ce=document.getElementById('clientEmail').value;
  const sn=document.getElementById('sigName').value;
  const sd=document.getElementById('sigDesig').value;
  const sm=formatPhones(document.getElementById('sigMobile').value, (document.getElementById('sigMobile2')||{}).value);
  const se=document.getElementById('sigEmail').value;
  const intro=document.getElementById('introText').value;
  const closing=document.getElementById('closeText').value;
  const extraNotes=(document.getElementById('extraNotes')||{}).value||'';
  const consName=(document.getElementById('consigneeName')||{}).value||'';
  const consAddr=(document.getElementById('consigneeAddress')||{}).value||'';
  const consPh=formatPhones((document.getElementById('consigneePhone')||{}).value, (document.getElementById('consigneePhone2')||{}).value);
  const clientGST=(document.getElementById('clientGST')||{}).value||'';
  const consGST=(document.getElementById('consigneeGST')||{}).value||'';
  const ref=document.getElementById('refNo').value;
  const dt=document.getElementById('docDate').value;
  const val=document.getElementById('validity').value||'30';
  const proj=document.getElementById('project').value;
  const subj=document.getElementById('subject').value;
  const dateFmt=dt?new Date(dt).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}):'';

  let sub=0,discT=0;
  lines.forEach(l=>{sub+=l.qty*l.rate;discT+=l.qty*l.rate*(l.disc/100);});
  const taxable=sub-discT; let taxSum=0; taxes.forEach(t=>taxSum+=taxable*t.pct/100);
  const grand=taxable+taxSum;

  let h=`<div class="co">${esc(co)}</div>`;
  if(addr) h+=`<div class="co-sub" style="white-space:pre-line">${esc(addr)}</div>`;
  h+=`<div class="co-sub" style="font-size:9pt">${phone?'Tel: '+esc(phone):''}${ourEmail?(phone?' | ':'')+'Email: '+esc(ourEmail):''}${gst?' | GSTIN: '+esc(gst):''}</div>`;
  h+=`<hr class="hl"><hr class="hl2">`;

  /* ===== DIFFERENT FORMATS: OFFER vs PO vs PI ===== */
  if(docType==='po'){
    h+=`<div class="title">PURCHASE ORDER</div>`;
    h+=`<table class="meta"><tr><td class="lbl">PO No.</td><td>${esc(ref)}</td><td class="lbl">Date</td><td>${dateFmt}</td></tr>`;
    h+=`<tr><td class="lbl">Project</td><td>${esc(proj)||'—'}</td><td class="lbl">Validity</td><td>${esc(val)} Days</td></tr></table>`;
    // Tabular parties - no "To,"
    h+=`<table class="meta" style="margin-top:10px"><tr>
      <td class="lbl" style="width:20%">Buyer (Bill To)</td>
      <td style="width:30%"><b>${esc(co)}</b>${addr?'<br>'+esc(addr):''}${phone?'<br>'+esc(phone):''}${gst?'<br>GSTIN: '+esc(gst):''}</td>
      <td class="lbl" style="width:20%">Supplier (Vendor)</td>
      <td style="width:30%"><b>${esc(cn)}</b>${cc?'<br>'+esc(cc):''}${ca?'<br>'+esc(ca).replace(/\\n/g,'<br>'):''}${cp?'<br>'+esc(cp):''}${ce?'<br>'+esc(ce):''}${clientGST?'<br>GSTIN: '+esc(clientGST):''}</td>
    </tr></table>`;
    h+=`<table class="meta" style="margin-top:8px"><tr>
        <td class="lbl" style="width:20%">Consignee (Ship To)</td>
        <td><b>${esc(consName||'—')}</b>${consAddr?'<br>'+esc(String(consAddr)).replace(/\n/g,'<br>'):''}${consPh?'<br>Mobile: '+esc(consPh):''}${consGST?'<br>GSTIN: '+esc(consGST):''}</td>
      </tr></table>`;

    if(subj) h+=`<div style="margin:8px 0"><b>Subject:</b> ${esc(subj)}</div>`;
    h+=`<div style="margin:8px 0;font-size:10pt">${esc(intro)}</div>`;
  } else if(docType==='pi'){
    h+=`<div class="title">PROFORMA INVOICE</div>`;
    h+=`<div style="text-align:center;font-size:9pt;color:#666;margin-bottom:8px"><i>This is not a tax invoice</i></div>`;
    h+=`<table class="meta"><tr><td class="lbl">PI No.</td><td>${esc(ref)}</td><td class="lbl">Date</td><td>${dateFmt}</td></tr>`;
    h+=`<tr><td class="lbl">Valid Until</td><td>${esc(val)} Days from date</td><td class="lbl">Project</td><td>${esc(proj)||'—'}</td></tr></table>`;
    h+=`<table class="meta" style="margin-top:10px"><tr>
      <td class="lbl" style="width:20%">Seller</td>
      <td style="width:30%"><b>${esc(co)}</b>${addr?'<br>'+esc(addr):''}${phone?'<br>'+esc(phone):''}${gst?'<br>GSTIN: '+esc(gst):''}</td>
      <td class="lbl" style="width:20%">Buyer</td>
      <td style="width:30%"><b>${esc(cn)}</b>${cc?'<br>'+esc(cc):''}${ca?'<br>'+esc(ca).replace(/\\n/g,'<br>'):''}${cp?'<br>'+esc(cp):''}${ce?'<br>'+esc(ce):''}</td>
    </tr></table>`;
    h+=`<table class="meta" style="margin-top:8px"><tr>
        <td class="lbl" style="width:20%">Consignee (Ship To)</td>
        <td><b>${esc(consName||'—')}</b>${consAddr?'<br>'+esc(String(consAddr)).replace(/\n/g,'<br>'):''}${consPh?'<br>Mobile: '+esc(consPh):''}${consGST?'<br>GSTIN: '+esc(consGST):''}</td>
      </tr></table>`;

    if(subj) h+=`<div style="margin:8px 0"><b>Subject:</b> ${esc(subj)}</div>`;
    h+=`<div style="margin:8px 0;font-size:10pt">${esc(intro)}</div>`;
  } else {
    // OFFER - tabular client block instead of To,
    h+=`<table class="meta"><tr><td class="lbl">Offer Ref. No.</td><td>${esc(ref)}</td><td class="lbl">Date</td><td>${dateFmt}</td></tr>`;
    h+=`<tr><td class="lbl">Validity</td><td>${esc(val)} Days from date of offer</td><td class="lbl">Project</td><td>${esc(proj)||'—'}</td></tr></table>`;
    h+=`<div class="title">${TITLES.offer}</div>`;
    h+=`<div style="text-align:center;font-size:10pt;margin-bottom:8px"><b>Scope:</b> ${esc(scopes.join(' + '))}</div>`;
    h+=`<table class="meta"><tr>
      <td class="lbl" style="width:18%">Client</td>
      <td><b>${esc(cn)}</b>${cc?' &nbsp;|&nbsp; '+esc(cc):''}${ca?'<br>'+esc(ca).replace(/\\n/g,'<br>'):''}${cp||ce||clientGST?'<br>':''}${cp?esc(cp):''}${cp&&ce?' | ':''}${ce?esc(ce):''}${clientGST?(cp||ce?' | ':'')+'GSTIN: '+esc(clientGST):''}</td>
    </tr></table>`;
    if(subj) h+=`<div style="margin:8px 0"><b>Subject:</b> ${esc(subj)}</div>`;
    h+=`<div style="margin:8px 0">Dear Sir / Madam,</div><div style="margin-bottom:10px">${esc(intro)}</div>`;
  }

  let sec=1;

  // SITC custom work scope
  if(scopes.includes('SITC') && sitcPoints.length){
    h+=`<div class="sec">${sec}. WORK SCOPE (SITC)</div><ol style="margin:4px 0 10px 18px;font-size:9.5pt">`;
    sitcPoints.forEach(p=>{ h+=`<li>${esc(p)}</li>`; });
    h+=`</ol>`; sec++;
  }

  // SCHEDULE OF WORK from SOW packages
  if(sowPackages.length){
    h+=`<div class="sec">${sec}. SCHEDULE OF WORK</div>`;
    sowPackages.forEach((pkg,pi)=>{
      h+=`<div style="margin:8px 0 4px;font-weight:bold;font-size:10.5pt">${pi+1}. ${esc(pkg.equipment)}</div>`;
      if(pkg.description && String(pkg.description).trim()){
        h+=`<div style="margin:2px 0 6px 8px;font-size:9.5pt;white-space:pre-line">${esc(pkg.description.trim())}</div>`;
      }
      Object.keys(pkg.activities||{}).forEach(typ=>{
        const acts=(pkg.activities[typ]||[]).filter(a=>{
          if(pkg.excluded && pkg.excluded[typ] && pkg.excluded[typ].includes(a)) return false;
          return true;
        });
        if(!acts.length) return;
        h+=`<div style="margin:4px 0 2px 12px;font-weight:bold;font-size:10pt;text-decoration:underline">${esc(typ)}</div>`;
        h+=`<ul style="margin:2px 0 8px 28px;font-size:9.5pt">`;
        acts.forEach(a=>{ h+=`<li>${esc(a)}</li>`; });
        h+=`</ul>`;
      });
    });
    sec++;
  }

  // Time schedule — not for Supply / AMC only
  if(schedule.length && needsSchedule()){
    h+=`<div class="sec">${sec}. TENTATIVE TIME SCHEDULE</div>`;
    h+=`<table class="pt"><thead><tr><th style="width:40px">S.No</th><th>Activity</th><th style="width:160px">Duration</th></tr></thead><tbody>`;
    schedule.forEach((r,i)=>h+=`<tr><td style="text-align:center">${i+1}</td><td>${esc(r.activity)}</td><td>${esc(r.duration)}</td></tr>`);
    h+=`</tbody></table>`; sec++;
  }


  // Custom sections ABOVE Schedule of Prices (user serial if set)
  (noteBlocks||[]).filter(nb=>nb.position==='before' && noteBlockHasContent(nb)).forEach(nb=>{
    const sn = (nb.serial!==''&&nb.serial!=null) ? String(nb.serial) : String(sec);
    h+=buildNoteSectionHTML(nb, sn);
    if(!(nb.serial!==''&&nb.serial!=null)) sec++;
    else sec = Math.max(sec, parseInt(nb.serial,10)+1) || sec+1;
  });

  // Price table
  const priceTitle=docType==='pi'?'INVOICE DETAILS':docType==='po'?'ORDER DETAILS':'COMMERCIAL PROPOSAL';
  h+=`<div class="sec">${sec}. ${priceTitle}</div>`;
  // Dynamic columns: include Make / Cat No / extras only when used or toggled on
  const anyMake = showMake && lines.some(l=>(l.make||'').trim());
  const anyCat = showCatNo && lines.some(l=>(l.catNo||'').trim());
  const usedExtras = (extraCols||[]).filter(c=>lines.some(l=>l.extras && (l.extras[c.id]||'').trim()));
  let thCols = `<th style="width:32px">Sr.</th><th>Description</th>`;
  if(anyMake) thCols += `<th style="width:70px">Make</th>`;
  if(anyCat) thCols += `<th style="width:70px">Cat No</th>`;
  usedExtras.forEach(c=>{ thCols += `<th style="width:70px">${esc(c.label)}</th>`; });
  const anyDisc = showDisc && lines.some(l=>(parseFloat(l.disc)||0)>0);
  thCols += `<th style="width:42px">Qty</th><th style="width:48px">UoM</th><th style="width:85px">Unit Rate (₹)</th>`;
  if(anyDisc) thCols += `<th style="width:48px">Disc%</th>`;
  thCols += `<th style="width:90px">Amount (₹)</th>`;
  h+=`<table class="pt"><thead><tr>${thCols}</tr></thead><tbody>`;
  lines.forEach((l,i)=>{
    const a=l.qty*l.rate*(1-l.disc/100);
    let row=`<tr><td style="text-align:center">${i+1}</td><td style="white-space:pre-line">${esc(l.desc)}</td>`;
    if(anyMake) row+=`<td style="text-align:center;font-size:9pt">${esc(l.make||'—')}</td>`;
    if(anyCat) row+=`<td style="text-align:center;font-size:9pt">${esc(l.catNo||'—')}</td>`;
    usedExtras.forEach(c=>{ row+=`<td style="text-align:center;font-size:9pt">${esc((l.extras&&l.extras[c.id])||'—')}</td>`; });
    row+=`<td style="text-align:center">${l.qty}</td><td style="text-align:center">${esc(l.unit)}</td><td style="text-align:right">${fmt(l.rate)}</td>`;
    if(anyDisc) row+=`<td style="text-align:center">${l.disc||'—'}</td>`;
    row+=`<td style="text-align:right">${fmt(a)}</td></tr>`;
    h+=row;
  });
  h+=`</tbody></table>`;
  h+=`<table style="width:46%;margin-left:auto;border-collapse:collapse;font-size:10pt">`;
  h+=`<tr><td style="text-align:right;padding:2px 8px;border:none">Sub Total</td><td style="border:1px solid #333;text-align:right;padding:3px 8px">₹ ${fmt(sub)}</td></tr>`;
  if(discT>0) h+=`<tr><td style="text-align:right;padding:2px 8px;border:none">Discount</td><td style="border:1px solid #333;text-align:right;padding:3px 8px">₹ ${fmt(discT)}</td></tr>`;
  h+=`<tr><td style="text-align:right;padding:2px 8px;border:none">Taxable</td><td style="border:1px solid #333;text-align:right;padding:3px 8px">₹ ${fmt(taxable)}</td></tr>`;
  taxes.forEach(t=>h+=`<tr><td style="text-align:right;padding:2px 8px;border:none">${esc(t.name)} @ ${t.pct}%</td><td style="border:1px solid #333;text-align:right;padding:3px 8px">₹ ${fmt(taxable*t.pct/100)}</td></tr>`);
  h+=`<tr><td style="text-align:right;padding:2px 8px;border:none;font-weight:bold">Grand Total</td><td style="border:1px solid #333;text-align:right;padding:3px 8px;font-weight:bold">₹ ${fmt(grand)}</td></tr></table>`;
  h+=`<div style="margin-top:4px;font-size:9.5pt"><b>Amount in Words:</b> ${n2w(Math.round(grand))} Rupees Only</div>`;
  sec++;

  // Custom sections BELOW Schedule of Prices (user serial if set)
  (noteBlocks||[]).filter(nb=>nb.position!=='before' && noteBlockHasContent(nb)).forEach(nb=>{
    const sn = (nb.serial!==''&&nb.serial!=null) ? String(nb.serial) : String(sec);
    h+=buildNoteSectionHTML(nb, sn);
    if(!(nb.serial!==''&&nb.serial!=null)) sec++;
    else sec = Math.max(sec, parseInt(nb.serial,10)+1) || sec+1;
  });

  // T&C
  const sel=tcList.filter(t=>t.checked);
  if(sel.length){
    h+=`<div class="sec">${sec}. TERMS &amp; CONDITIONS</div><ol class="tc">`;
    sel.forEach(t=>h+=`<li>${esc(t.text)}</li>`); h+=`</ol>`; sec++;
  }

  if(docType==='offer'){
    h+=`<div class="sec">${sec}. CLOSING</div><div>${esc(closing)}</div>`;
  }
  h+=`<div class="sig">Regards,<br>For <b>${esc(co)}</b><br><br><br>____________________________<br><b>Authorized Signatory</b><br>`;
  if(sn) h+=`Name: ${esc(sn)}<br>`; if(sd) h+=`Designation: ${esc(sd)}<br>`;
  if(sm) h+=`Mobile: ${esc(sm)}<br>`; if(se) h+=`Email: ${esc(se)}`;
  h+=`</div>`;

  if(docType==='offer'){
    h+=`<div class="accept"><b>ACCEPTANCE</b><br><span style="font-size:9.5pt">We hereby accept the above including Scope, Prices and Terms &amp; Conditions.</span>
    <table><tr><td><b>For Client:</b><br><br>Signature: ____________<br><br>Name:<br><br>Designation:<br><br>Date:<br><br>Seal:</td>
    <td><b>For ${esc(co)}:</b><br><br>Signature: ____________<br><br>Name:<br><br>Designation:<br><br>Date:<br><br>Seal:</td></tr></table></div>`;
  } else if(docType==='po'){
    h+=`<div class="accept"><b>ORDER ACKNOWLEDGEMENT</b><br><span style="font-size:9.5pt">Please acknowledge receipt of this Purchase Order and confirm delivery schedule.</span>
    <table><tr><td><b>For Supplier:</b><br><br>Signature: ____________<br><br>Name / Date:</td>
    <td><b>Authorized By (Buyer):</b><br><br>Signature: ____________<br><br>Name / Date:</td></tr></table></div>`;
  }


return h;
}


function n2w(num){
  if(!num) return 'Zero';
  const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function w(n){if(n<20)return a[n];if(n<100)return b[Math.floor(n/10)]+(n%10?' '+a[n%10]:'');if(n<1000)return a[Math.floor(n/100)]+' Hundred'+(n%100?' and '+w(n%100):'');if(n<100000)return w(Math.floor(n/1000))+' Thousand'+(n%1000?' '+w(n%1000):'');if(n<10000000)return w(Math.floor(n/100000))+' Lakh'+(n%100000?' '+w(n%100000):'');return w(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+w(n%10000000):'');}
  return w(num);
}

/* EXPORT */
function css(){return `body{font-family:"Times New Roman",Times,serif;font-size:11pt;margin:15mm 18mm;color:#000}.co{text-align:center;font-family:"Century Gothic",CenturyGothic,sans-serif;font-weight:700;font-size:18pt;color:#0047AB;letter-spacing:1px}.co-sub{text-align:center;font-size:9.5pt}.hl{border:none;border-top:2.5px solid #0047AB;margin:8px 0 3px}.hl2{border:none;border-top:1px solid #0047AB;margin:0 0 12px}.meta{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10pt}.meta td{border:1px solid #333;padding:4px 8px}.meta .lbl{font-weight:bold;background:#f0f0f0;width:16%}.title{text-align:center;font-size:13pt;font-weight:bold;text-decoration:underline;margin:10px 0}.sec{font-weight:bold;font-size:11pt;margin:14px 0 6px;border-bottom:1px solid #999;padding-bottom:2px}table.pt{width:100%;border-collapse:collapse;margin:8px 0}table.pt th,table.pt td{border:1px solid #333;padding:5px 6px;font-size:9.5pt}table.pt th{background:#e8e8e8}ol.tc{margin-left:18px;font-size:9.5pt}ol.tc li{margin-bottom:3px}.sig{margin-top:28px}.accept{margin-top:28px;border:1px solid #333;padding:12px}.accept table{width:100%;border:none}.accept td{border:none;width:50%;vertical-align:top;padding:6px;font-size:9.5pt}`;}
function dlPDF(){
  const c=document.getElementById('printDoc').innerHTML;
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>CENTURY SOLUTION</title><style>${css()}</style></head><body>${c}<script>onload=()=>print()<\/script></body></html>`);
  w.document.close(); toast('Use Print → Save as PDF');
}
function dlWord(){
  const c=document.getElementById('printDoc').innerHTML;
  const blob=new Blob(['\ufeff',`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>${css()}</style></head><body>${c}</body></html>`],{type:'application/msword'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=(document.getElementById('refNo').value||'Doc').replace(/\//g,'-')+'.doc'; a.click();
  toast('Word downloaded');
}
function dlExcel(){
  let csv='Sr,Description,Unit,Qty,Rate,Disc%,Amount\n';
  lines.forEach((l,i)=>{csv+=`${i+1},"${l.desc.replace(/"/g,'""')}",${l.unit},${l.qty},${l.rate},${l.disc},${(l.qty*l.rate*(1-l.disc/100)).toFixed(2)}\n`;});
  let sub=0,d=0; lines.forEach(l=>{sub+=l.qty*l.rate;d+=l.qty*l.rate*(l.disc/100);});
  const tax=sub-d; let ts=0; taxes.forEach(t=>ts+=tax*t.pct/100);
  csv+=`\n,,,,"Sub Total",,${sub.toFixed(2)}\n,,,,"Discount",,${d.toFixed(2)}\n`;
  taxes.forEach(t=>csv+=`,,,,"${t.name} ${t.pct}%",,${(tax*t.pct/100).toFixed(2)}\n`);
  csv+=`,,,,"Grand Total",,${(tax+ts).toFixed(2)}\n`;
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));
  a.download=(document.getElementById('refNo').value||'Doc').replace(/\//g,'-')+'.csv'; a.click();
  toast('Excel downloaded');
}

/* SAVE */
function saveDoc(){
  let sub=0,d=0; lines.forEach(l=>{
    sub+=l.qty*l.rate;d+=l.qty*l.rate*(l.disc/100);
    rememberPrice(l.desc, l.rate, l.disc, l.unit);
  });
  const tax=sub-d; let ts=0; taxes.forEach(t=>ts+=tax*t.pct/100);
  const productShort=lines.slice(0,4).map(l=>(l.desc||'').split(/[|\n]/)[0].trim().slice(0,40)).join('; ');
  const existingMis=saved.find(x=>(window._editingDocId && String(x.id)===String(window._editingDocId)) || (x.ref===document.getElementById('refNo').value&&x.type===docType));
  const mis=existingMis||{};
  const doc={
    id:existingMis?existingMis.id:Date.now(),
    type:docType,
    ref:document.getElementById('refNo').value,
    date:document.getElementById('docDate').value,
    enqDate:mis.enqDate||'',
    project:document.getElementById('project').value,
    subject:document.getElementById('subject').value,
    client:document.getElementById('clientName').value||'—',
    endClient:mis.endClient||'',
    enqType:mis.enqType||scopes.join('+'),
    contact:document.getElementById('clientContact').value,
    contactPhone:formatPhones(document.getElementById('clientPhone').value,(document.getElementById('clientPhone2')||{}).value),
    clientGST:(document.getElementById('clientGST')||{}).value||'',
    consignee:document.getElementById('consigneeName')?document.getElementById('consigneeName').value:'',
    consigneeAddress:document.getElementById('consigneeAddress')?document.getElementById('consigneeAddress').value:'',
    consigneePhone:formatPhones((document.getElementById('consigneePhone')||{}).value,(document.getElementById('consigneePhone2')||{}).value),
    consigneeGST:(document.getElementById('consigneeGST')||{}).value||'',
    product:productShort,
    scopes:[...scopes], amount:tax+ts,
    lines:JSON.parse(JSON.stringify(lines)),
    taxes:JSON.parse(JSON.stringify(taxes)),
    noteBlocks:JSON.parse(JSON.stringify(noteBlocks)),
    sowPackages:JSON.parse(JSON.stringify(sowPackages)),
    extraCols:JSON.parse(JSON.stringify(extraCols||[])),
    showMake:!!showMake, showCatNo:!!showCatNo, showDisc:!!showDisc,
    sig:document.getElementById('sigName').value,
    ownerId:(typeof currentUserId==='function'?currentUserId():'')
  };
  if(existingMis){
    const ix=saved.findIndex(x=>x.id===existingMis.id);
    // preserve MIS-only fields
    doc.enqDate=existingMis.enqDate||doc.enqDate;
    doc.endClient=existingMis.endClient||doc.endClient;
    doc.enqType=existingMis.enqType||doc.enqType;
    doc.status=existingMis.status||doc.status;
    doc.remarks=existingMis.remarks||doc.remarks;
    doc.email=existingMis.email||doc.email;
    doc.address=document.getElementById('clientAddress').value||existingMis.address||'';
    saved[ix]=doc;
    window._editingDocId=doc.id;
  } else saved.unshift(doc);
  localStorage.setItem('cs4_saved',JSON.stringify(saved));
  toast('Document saved');
}


function loadSavedDoc(id, mode){
  try{
    const doc = saved.find(x => String(x.id) === String(id));
    if(!doc){ toast('Document not found'); console.warn('id', id, saved.map(s=>s.id)); return; }
    showView('create');
    docType = doc.type || 'offer';
    document.querySelectorAll('.dtype').forEach(b => b.classList.toggle('active', b.dataset.t === docType));
    const lbl = document.getElementById('lblRef');
    if(lbl) lbl.textContent = docType==='po'?'PO Number':docType==='pi'?'PI Number':'Offer Ref. No.';
    const cb = document.getElementById('consigneeBlock');
    if(cb) cb.style.display = (docType==='po'||docType==='pi') ? 'block' : 'none';

    const set = (eid, v) => { const el = document.getElementById(eid); if(el) el.value = (v != null && v !== undefined) ? v : ''; };
    set('refNo', doc.ref || '');
    set('docDate', doc.date || new Date().toISOString().slice(0,10));
    set('project', doc.project || '');
    set('subject', doc.subject || '');
    set('clientName', doc.client || '');
    set('clientContact', doc.contact || '');
    set('clientAddress', doc.address || '');
    set('clientEmail', doc.email || '');
    const phones = String(doc.contactPhone || '').split(/\s*\/\s*/);
    set('clientPhone', phones[0] || '');
    set('clientPhone2', phones[1] || '');
    set('clientGST', doc.clientGST || '');
    set('consigneeName', doc.consignee || '');
    set('consigneeAddress', doc.consigneeAddress || '');
    const cph = String(doc.consigneePhone || '').split(/\s*\/\s*/);
    set('consigneePhone', cph[0] || '');
    set('consigneePhone2', cph[1] || '');
    set('consigneeGST', doc.consigneeGST || '');
    set('validity', doc.validity || '30');

    scopes = (doc.scopes && doc.scopes.length) ? doc.scopes.slice() : (doc.enqType ? String(doc.enqType).split(/[+&,/]/).map(s=>s.trim()).filter(Boolean) : ['Supply']);
    if(!scopes.length) scopes = ['Supply'];
    if(typeof renderScopes === 'function') renderScopes();

    lines = (doc.lines && doc.lines.length) ? JSON.parse(JSON.stringify(doc.lines)) : [];
    if(typeof doc.showMake==='boolean') showMake=doc.showMake;
    else showMake = lines.some(l=>(l.make||'').trim()) || showMake;
    if(typeof doc.showCatNo==='boolean') showCatNo=doc.showCatNo;
    else showCatNo = lines.some(l=>(l.catNo||'').trim()) || showCatNo;
    if(typeof doc.showDisc==='boolean') showDisc=doc.showDisc;
    else showDisc = lines.some(l=>(parseFloat(l.disc)||0)>0) || showDisc;
    // rebuild extraCols from line extras keys
    const ek = new Set();
    lines.forEach(l=>{ if(l.extras) Object.keys(l.extras).forEach(k=>ek.add(k)); });
    if(doc.extraCols && doc.extraCols.length) extraCols = JSON.parse(JSON.stringify(doc.extraCols));
    else if(ek.size) extraCols = [...ek].map(id=>({id, label:id}));

    if(!lines.length){
      const desc = [doc.product, doc.remarks].filter(Boolean).join('\n') || (doc.subject || 'Item');
      lines = [{ desc: desc, qty: 1, unit: 'Job', rate: parseFloat(doc.amount) || 0, disc: 0 }];
    }
    taxes = (doc.taxes && doc.taxes.length) ? JSON.parse(JSON.stringify(doc.taxes)) : [{ name: 'GST', pct: 18 }];
    sowPackages = (doc.sowPackages && doc.sowPackages.length) ? JSON.parse(JSON.stringify(doc.sowPackages)) : [];
    noteBlocks = (doc.noteBlocks && doc.noteBlocks.length) ? JSON.parse(JSON.stringify(doc.noteBlocks)) : [{ title: 'Additional Notes', text: '' }];
    sitcPoints = (doc.sitcPoints && doc.sitcPoints.length) ? doc.sitcPoints.slice() : [];
    schedule = (doc.schedule && doc.schedule.length) ? JSON.parse(JSON.stringify(doc.schedule)) : [];

    if(doc.intro) set('introText', doc.intro);
    else if(typeof updateIntro === 'function') updateIntro();
    if(doc.closing) set('closeText', doc.closing);

    if(typeof renderLines === 'function') renderLines();
    if(typeof renderTaxes === 'function') renderTaxes();
    if(typeof renderSowPkgPreview === 'function') renderSowPkgPreview();
    if(typeof renderNoteBlocks === 'function') renderNoteBlocks();
    if(typeof renderSitc === 'function') renderSitc();
    if(typeof renderSched === 'function') renderSched();
    if(typeof updateAddButtons === 'function') updateAddButtons();
    if(typeof updateSitcVisibility === 'function') updateSitcVisibility();
    if(typeof updateScheduleVisibility === 'function') updateScheduleVisibility();
    if(typeof renderTCs === 'function') renderTCs();

    window._editingDocId = doc.id;

    if(mode === 'view'){
      setTimeout(function(){ if(typeof openPreview === 'function') openPreview(); }, 80);
      toast('Viewing: ' + (doc.ref || doc.type));
    } else {
      toast('Editing: ' + (doc.ref || doc.type) + ' — ' + (doc.type || '').toUpperCase());
    }
  }catch(err){
    console.error(err);
    toast('Open failed: ' + (err.message || err));
  }
}
function viewSavedDoc(id){ loadSavedDoc(id, 'view'); }
function editSavedDoc(id){ loadSavedDoc(id, 'edit'); }
function deleteSavedDoc(id){
  if(!confirm('Delete this document from MIS?')) return;
  saved = saved.filter(x => String(x.id) !== String(id));
  localStorage.setItem('cs4_saved', JSON.stringify(saved));
  if(typeof renderReports === 'function') renderReports();
  if(typeof renderDashboard === 'function') renderDashboard();
  toast('Deleted');
}


function downloadColorExcel(filename, sheetName, headers, rows){
  // Build HTML table Excel can open — colored header
  let h = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8">';
  h += '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>'+sheetName+'</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
  h += '<style>table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt}';
  h += 'th{background:#0b3d91;color:#ffffff;font-weight:bold;padding:6px 10px;border:1px solid #072a66;text-align:left}';
  h += 'td{padding:5px 8px;border:1px solid #c5d0e0}';
  h += 'tr:nth-child(even) td{background:#eef4fc}';
  h += 'tr:nth-child(odd) td{background:#ffffff}';
  h += '.num{mso-number-format:"0.00";text-align:right}';
  h += '.title{font-size:14pt;font-weight:bold;color:#0b3d91}</style></head><body>';
  h += '<div class="title">CENTURY SOLUTION — '+sheetName+'</div>';
  h += '<div style="color:#64748b;font-size:9pt;margin:4px 0 10px">Generated: '+new Date().toLocaleString('en-IN')+'</div>';
  h += '<table><thead><tr>';
  headers.forEach(function(hd){ h += '<th>'+String(hd).replace(/</g,'&lt;')+'</th>'; });
  h += '</tr></thead><tbody>';
  rows.forEach(function(row){
    h += '<tr>';
    row.forEach(function(cell, i){
      var v = cell==null?'':cell;
      var cls = (typeof cell==='number') ? ' class="num"' : '';
      h += '<td'+cls+'>'+String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table></body></html>';
  const blob = new Blob([h], {type: 'application/vnd.ms-excel'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.replace(/\.csv$/i,'.xls');
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
}


function renderReports(){
  const type=(document.getElementById('repType')||{}).value||'';
  const q=((document.getElementById('repQ')||{}).value||'').toLowerCase();
  const tb=document.getElementById('rptBody');
  const empty=document.getElementById('rptEmpty');
  if(!tb) return;
  const base=(typeof filterSavedForUser==='function'?filterSavedForUser(saved):saved);
  const list=base.filter(d=>(!type||d.type===type)&&(!q||(d.ref+d.client+(d.project||'')+(d.endClient||'')+(d.status||'')+(d.product||'')).toLowerCase().includes(q)));
  tb.innerHTML='';
  if(!list.length){ if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  list.forEach((d,si)=>{
    const st = d.status||'Open';
    const stCol = /won|closed|completed/i.test(st)?'#0f766e':/lost|cancel/i.test(st)?'#b91c1c':/hold/i.test(st)?'#a16207':'#1a56a8';
    tb.innerHTML+=`<tr class="mis-row" style="cursor:pointer" onclick="openMISFullDetails('${d.id}')">
      <td>${si+1}</td>
      <td><b style="color:var(--blue)">${esc(d.ref||'—')}</b></td>
      <td>${esc(d.client||'—')}</td>
      <td>${esc(d.endClient||'—')}</td>
      <td>${esc(d.project||'—')}</td>
      <td>₹ ${fmt(d.amount)}</td>
      <td><span class="status-pill" style="background:${stCol}">${esc(st)}</span></td>
      <td style="white-space:nowrap" onclick="event.stopPropagation()">
        <button class="btn-xs" onclick="openMISFullDetails('${d.id}')">Details</button>
        <button class="btn-xs" onclick="if(typeof openCustomer360==='function')openCustomer360('${String(d.client||'').replace(/'/g,"\\'")}')">360°</button>
      </td>
    </tr>`;
  });
}

function openMISFullDetails(id){
  const d=saved.find(x=>String(x.id)===String(id));
  if(!d){ toast('Not found'); return; }
  window._misEditId=id;
  const set=(eid,v)=>{ const el=document.getElementById(eid); if(el) el.value=v!=null?v:''; };
  set('misFd_enqDate', d.enqDate||'');
  set('misFd_ref', d.ref||'');
  set('misFd_quoteDate', d.date||'');
  set('misFd_status', d.status||'');
  set('misFd_client', d.client||'');
  set('misFd_project', d.project||'');
  set('misFd_endClient', d.endClient||'');
  set('misFd_enqType', d.enqType||(d.scopes||[]).join('+')||'');
  set('misFd_product', d.product||'');
  set('misFd_amount', d.amount||0);
  set('misFd_contact', d.contact||'');
  set('misFd_phone', d.contactPhone||'');
  set('misFd_email', d.email||'');
  set('misFd_address', d.address||'');
  set('misFd_remarks', d.remarks||'');
  document.getElementById('misFullModal').classList.add('show');
}
function closeMISFull(){ document.getElementById('misFullModal').classList.remove('show'); }
function saveMISFullDetails(){
  const id=window._misEditId;
  const d=saved.find(x=>String(x.id)===String(id));
  if(!d){ toast('Not found'); return; }
  const get=eid=>(document.getElementById(eid)||{}).value||'';
  d.enqDate=get('misFd_enqDate');
  d.ref=get('misFd_ref')||d.ref;
  d.date=get('misFd_quoteDate')||d.date;
  d.status=get('misFd_status');
  d.client=get('misFd_client')||d.client;
  d.project=get('misFd_project');
  d.endClient=get('misFd_endClient');
  d.enqType=get('misFd_enqType');
  d.product=get('misFd_product');
  d.amount=parseFloat(get('misFd_amount'))||0;
  d.contact=get('misFd_contact');
  d.contactPhone=get('misFd_phone');
  d.email=get('misFd_email');
  d.address=get('misFd_address');
  d.remarks=get('misFd_remarks');
  localStorage.setItem('cs4_saved', JSON.stringify(saved));
  closeMISFull();
  renderReports();
  if(typeof renderDashboard==='function') renderDashboard();
  toast('Full details saved — will appear in MIS download');
}

function updateMIS(id, field, val){
  const d=saved.find(x=>String(x.id)===String(id));
  if(!d) return;
  d[field]=val;
  localStorage.setItem('cs4_saved',JSON.stringify(saved));
}
function exportMISFull(){
  if(!saved.length){ toast('Nothing to export'); return; }
  const headers=['S No','Date of Enq','Enq Ref No','Date of Quote','Status','Client','Project','End Client','Enq Type','Product','Quotation','Contact Person','Contact No','Email id','Address','Remarks'];
  const rows=saved.map(function(d,i){
    return [
      i+1,
      d.enqDate||'',
      d.ref||'',
      d.date||'',
      d.status||'',
      d.client||'',
      d.project||'',
      d.endClient||'',
      d.enqType||(d.scopes||[]).join('+')||'',
      d.product||'',
      parseFloat(d.amount)||0,
      d.contact||'',
      d.contactPhone||'',
      d.email||'',
      d.address||'',
      d.remarks||''
    ];
  });
  downloadColorExcel('CENTURY_MIS_Full_'+new Date().toISOString().slice(0,10)+'.xls', 'Live Enq MIS', headers, rows);
  toast('MIS Excel downloaded with all columns');
}

function delSaved(id){
  saved=saved.filter(d=>d.id!==id);
  localStorage.setItem('cs4_saved',JSON.stringify(saved));
  renderReports(); toast('Deleted');
}
function exportReport(){
  const type=(document.getElementById('repType')||{}).value||'';
  const q=((document.getElementById('repQ')||{}).value||'').toLowerCase();
  const base=(typeof filterSavedForUser==='function'?filterSavedForUser(saved):saved);
  const list=base.filter(d=>(!type||d.type===type)&&(!q||(d.ref+d.client+(d.project||'')+(d.product||'')+(d.endClient||'')+(d.status||'')).toLowerCase().includes(q)));
  if(!list.length){ toast('No rows to export'); return; }
  const headers=['S No','Date of Enq','Enq Ref No','Date of Quote','Status','Client','Project','End Client','Enq Type','Product','Quotation','Contact Person','Contact No','Email id','Address','Remarks'];
  const rows=list.map(function(d,i){
    return [i+1, d.enqDate||'', d.ref||'', d.date||'', d.status||'', d.client||'', d.project||'', d.endClient||'', d.enqType||'', d.product||'', parseFloat(d.amount)||0, d.contact||'', d.contactPhone||'', d.email||'', d.address||'', d.remarks||''];
  });
  downloadColorExcel('CENTURY_MIS_Report_'+new Date().toISOString().slice(0,10)+'.xls', 'MIS Report', headers, rows);
  toast('Report downloaded');
}

/* MASTERS */
function renderMasterScopes(){
  const el=document.getElementById('masterScopes');
  if(!el) return;
  const all=[...WORK_SCOPES,...customScopes];
  el.innerHTML=all.map(s=>{
    const map=scopeMappings[s]||'—';
    const canDel=customScopes.includes(s);
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
      <span>• ${esc(s)} <span style="color:#64748b;font-size:.65rem">[${esc(map)}]</span></span>
      ${canDel?`<button class="del-btn" style="width:20px;height:20px;font-size:.65rem" onclick="removeCustomScope('${esc(s)}')">×</button>`:''}
    </div>`;
  }).join('');
  const sel=document.getElementById('mapScopeName');
  if(sel){
    sel.innerHTML=all.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  }
  renderScopeMapList();
}
function removeCustomScope(n){
  customScopes=customScopes.filter(x=>x!==n);
  delete scopeMappings[n];
  persistWorkspace();
  renderMasterScopes(); renderScopes(); updateAddButtons();
  toast('Scope removed');
}
function addMasterScope(){
  const n=document.getElementById('newScope').value.trim();
  if(!n) return;
  if([...WORK_SCOPES,...customScopes].includes(n)){ toast('Already exists'); return; }
  customScopes.push(n);
  document.getElementById('newScope').value='';
  persistWorkspace();
  renderMasterScopes(); renderScopes(); toast('Scope added');
}
function saveScopeMapping(){
  const n=document.getElementById('mapScopeName').value;
  const src=document.getElementById('mapScopeSource').value;
  if(!n) return;
  scopeMappings[n]=src;
  persistWorkspace();
  renderMasterScopes(); updateAddButtons();
  toast('Mapping saved: '+n+' → '+src);
}
function renderScopeMapList(){
  const el=document.getElementById('scopeMapList');
  if(!el) return;
  const keys=Object.keys(scopeMappings);
  if(!keys.length){ el.innerHTML='<span style="color:#64748b">No custom mappings yet</span>'; return; }
  el.innerHTML=keys.map(k=>`<div>${esc(k)} → <b>${esc(scopeMappings[k])}</b></div>`).join('');
}
function renderMasterCats(){
  const el=document.getElementById('masterCats');
  if(!el) return;
  el.innerHTML=CATEGORIES.map(c=>`<div><b>${esc(c.name)}</b><br><span style="color:#64748b;font-size:.72rem">${esc(c.desc)}</span></div>`).join('');
}
function renderMasterSOW(){
  const el=document.getElementById('masterSOW');
  if(!el) return;
  el.innerHTML=Object.keys(SOW).map(e=>{
    const s=SOW[e];
    const svc=(s.Service||[]).length, tst=(s.Testing||[]).length;
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:4px 0;border-bottom:1px solid #eef1f5">
      <div><b>${esc(e)}</b><br><span style="color:#64748b;font-size:.65rem">Service: ${svc} · Testing: ${tst}</span></div>
      <button class="del-btn" style="width:22px;height:22px;font-size:.65rem;flex-shrink:0" onclick="removeSOWEquipment('${esc(e).replace(/'/g,"\\'")}')" title="Remove">×</button>
    </div>`;
  }).join('')||'<span style="color:#64748b">No SOW equipment</span>';
}
function addSOWEquipment(){
  const eq=(document.getElementById('sowNewEq')||{}).value||'';
  if(!eq.trim()){ toast('Enter equipment name'); return; }
  if(SOW[eq.trim()]){ toast('Already exists'); return; }
  const svc=((document.getElementById('sowNewService')||{}).value||'').split('\n').map(x=>x.trim()).filter(Boolean);
  const tst=((document.getElementById('sowNewTesting')||{}).value||'').split('\n').map(x=>x.trim()).filter(Boolean);
  SOW[eq.trim()]={Service:svc, Testing:tst};
  persistSOW();
  document.getElementById('sowNewEq').value='';
  document.getElementById('sowNewService').value='';
  document.getElementById('sowNewTesting').value='';
  renderMasterSOW();
  toast('SOW equipment added');
}
function removeSOWEquipment(name){
  if(!confirm('Remove SOW for '+name+'?')) return;
  delete SOW[name];
  persistSOW();
  renderMasterSOW();
  toast('Removed');
}
function persistSOW(){
  try{ localStorage.setItem('cs7_sow', JSON.stringify(SOW)); }catch(e){}
}
function loadSOWOverrides(){
  try{
    const raw=localStorage.getItem('cs7_sow');
    if(raw){
      const o=JSON.parse(raw);
      Object.keys(o).forEach(k=>{ SOW[k]=o[k]; });
    }
  }catch(e){}
}


function resetAll(){
  window._editingDocId=null;
  if((lines.length||sowPackages.length||sitcPoints.length) && !confirm('Start a completely new quotation? All items, SOW packages and details will be cleared.')) return;
  lines=[];
  sowPackages=[];
  sitcPoints=[];
  schedule=[];
  taxes=[{name:'GST',pct:18}];
  scopes=['Supply'];
  const t=new Date();
  document.getElementById('docDate').value=t.toISOString().slice(0,10);
  document.getElementById('refNo').value='CS/'+t.getFullYear()+'/'+String(t.getMonth()+1).padStart(2,'0')+'/'+String(Math.floor(Math.random()*900)+100);
  document.getElementById('project').value='';
  document.getElementById('subject').value='';
  document.getElementById('subject').dataset.auto='1';
  document.getElementById('clientName').value='';
  document.getElementById('clientContact').value='';
  document.getElementById('clientAddress').value='';
  document.getElementById('clientPhone').value='';
  const cp2=document.getElementById('clientPhone2'); if(cp2) cp2.value='';
  document.getElementById('clientEmail').value='';
  noteBlocks=[{title:'Additional Notes',text:'',position:'after',serial:'',tables:[]}]; renderNoteBlocks();
  ['consigneeName','consigneeAddress','consigneePhone','consigneePhone2','consigneeGST','clientGST'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  renderScopes(); updateIntro(); updateAddButtons(); updateSitcVisibility(); updateScheduleVisibility();
  renderLines(); renderTaxes(); renderSowPkgPreview(); renderSitc();
  updateScheduleVisibility();
  renderSched();
  toast('New quotation ready');
}

function needsSchedule(){
  // Hide time schedule for Supply-only and AMC-only (and combinations of only those)
  const siteScopes=['Service','Inspection','Testing','SITC','Maintenance','Installation'];
  return scopes.some(s=>siteScopes.includes(s));
}
function updateScheduleVisibility(){
  const b=document.getElementById('schedBlock');
  if(!b) return;
  if(needsSchedule()){
    b.style.display='block';
    if(!schedule.length){
      schedule=[{activity:'Mobilization',duration:'1 Day'},{activity:'Execution',duration:'As per site'},{activity:'Handover / Report',duration:'1–2 Days'}];
      renderSched();
    }
  } else {
    b.style.display='none';
  }
}

function addMasterItem(){
  const e=(document.getElementById('miEquip')||{}).value||'';
  const d=(document.getElementById('miDesc')||{}).value||'';
  const r=(document.getElementById('miRating')||{}).value||'';
  const t=(document.getElementById('miType')||{}).value||'';
  const s=(document.getElementById('miSpec')||{}).value||'';
  if(!e.trim()||!d.trim()){ toast('Equipment and Description required'); return; }
  ITEMS.push({d:d.trim(), r:r.trim(), s:s.trim(), t:t.trim(), e:e.trim(), sh:'Custom'});
  // persist custom items
  try{
    const custom=JSON.parse(localStorage.getItem('cs4_custom_items')||'[]');
    custom.push({d:d.trim(), r:r.trim(), s:s.trim(), t:t.trim(), e:e.trim(), sh:'Custom'});
    localStorage.setItem('cs4_custom_items', JSON.stringify(custom));
  }catch(err){}
  document.getElementById('miDesc').value='';
  document.getElementById('miRating').value='';
  document.getElementById('miType').value='';
  document.getElementById('miSpec').value='';
  document.getElementById('itemCount').textContent=ITEMS.length.toLocaleString();
  if(typeof renderDashboard==='function') try{ renderDashboard(); }catch(e){ console.error(e); }
  toast('Item added to master');
}


function addCategory(){
  const name=(document.getElementById('newCatName')||{}).value||'';
  const desc=(document.getElementById('newCatDesc')||{}).value||'';
  if(!name.trim()){ toast('Enter category name'); return; }
  if(CATEGORIES.find(c=>c.name.toLowerCase()===name.trim().toLowerCase())){
    toast('Category already exists'); return;
  }
  CATEGORIES.push({name:name.trim(), desc:desc.trim()});
  // also map to equipment code for filtering
  CAT_TO_EQ[name.trim()]=[name.trim()];
  try{
    const custom=JSON.parse(localStorage.getItem('cs7_custom_cats')||'[]');
    custom.push({name:name.trim(), desc:desc.trim()});
    localStorage.setItem('cs7_custom_cats', JSON.stringify(custom));
  }catch(e){}
  document.getElementById('newCatName').value='';
  document.getElementById('newCatDesc').value='';
  document.getElementById('catCount').textContent=CATEGORIES.length;
  renderMasterCats();
  toast('Category added');
}

function loadCustomCats(){
  try{
    const custom=JSON.parse(localStorage.getItem('cs7_custom_cats')||'[]');
    custom.forEach(c=>{
      if(!CATEGORIES.find(x=>x.name===c.name)){
        CATEGORIES.push(c);
        CAT_TO_EQ[c.name]=[c.name];
      }
    });
  }catch(e){}
}

function importItemMaster(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file) return;
  toast('Importing items…');
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      let rows=[];
      const name=file.name.toLowerCase();
      if(name.endsWith('.csv')){
        const text=e.target.result;
        const lines=text.split(/\r?\n/).filter(l=>l.trim());
        if(!lines.length){ toast('Empty file'); return; }
        const headers=lines[0].split(',').map(h=>h.replace(/^"|"$/g,'').trim().toLowerCase());
        for(let i=1;i<lines.length;i++){
          const cols=lines[i].match(/("([^"]|"")*"|[^,]*)/g)||[];
          const vals=cols.map(c=>c.replace(/^"|"$/g,'').replace(/""/g,'"').trim());
          const obj={};
          headers.forEach((h,j)=>obj[h]=vals[j]||'');
          rows.push(obj);
        }
      } else {
        if(typeof XLSX==='undefined'){ toast('Excel library not loaded — use CSV or check internet'); return; }
        const data=new Uint8Array(e.target.result);
        const wb=XLSX.read(data,{type:'array'});
        const sheet=wb.Sheets[wb.SheetNames[0]];
        rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
      }
      let added=0, skipped=0;
      const keySet=new Set(ITEMS.map(it=>((it.e||'')+'||'+(it.d||'')).toLowerCase()));
      rows.forEach(row=>{
        // flexible column names
        const keys=Object.keys(row);
        const get=(...names)=>{
          for(const n of names){
            const k=keys.find(x=>x.toLowerCase().replace(/\s+/g,'')===n.toLowerCase().replace(/\s+/g,''));
            if(k!=null && String(row[k]).trim()) return String(row[k]).trim();
          }
          // partial
          for(const n of names){
            const k=keys.find(x=>x.toLowerCase().includes(n.toLowerCase().slice(0,4)));
            if(k!=null && String(row[k]).trim()) return String(row[k]).trim();
          }
          return '';
        };
        const desc=get('Description','Item Description','Item','Name','d');
        const equip=get('Equipment','Category','Equip','e')||'General';
        if(!desc) return;
        const rating=get('Rating','Rating / Size','Size','r');
        const typ=get('Type','Type / Poles','Poles','t');
        const spec=get('Spec','Breaking Capacity','Breaking Capacity / Spec','s');
        const key=(equip+'||'+desc).toLowerCase();
        if(keySet.has(key)){ skipped++; return; }
        keySet.add(key);
        ITEMS.push({d:desc, r:rating, s:spec, t:typ, e:equip, sh:'Imported'});
        added++;
      });
      // persist imported
      try{
        const custom=JSON.parse(localStorage.getItem('cs4_custom_items')||'[]');
        // only store newly added from this session count - re-save all custom+imported is heavy; append last added
        const newOnes=ITEMS.filter(it=>it.sh==='Imported'||it.sh==='Custom');
        localStorage.setItem('cs4_custom_items', JSON.stringify(newOnes.slice(-5000)));
      }catch(err){}
      document.getElementById('itemCount').textContent=ITEMS.length.toLocaleString();
  if(typeof renderDashboard==='function') try{ renderDashboard(); }catch(e){ console.error(e); }
      toast('Added '+added+' items'+(skipped?' · '+skipped+' duplicates skipped':''));
    }catch(err){
      console.error(err);
      toast('Import failed: '+(err.message||err));
    }
    ev.target.value='';
  };
  if(file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}


function downloadItemMaster(){
  let csv='S.No,Equipment,Description,Rating,Type / Poles,Spec / Breaking Capacity,Sheet\n';
  ITEMS.forEach((it,i)=>{
    csv+=`${i+1},"${(it.e||'').replace(/"/g,'""')}","${(it.d||'').replace(/"/g,'""')}","${(it.r||'').replace(/"/g,'""')}","${(it.t||'').replace(/"/g,'""')}","${(it.s||'').replace(/"/g,'""')}","${(it.sh||'').replace(/"/g,'""')}"\n`;
  });
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download='CENTURY_SOLUTION_Item_Master_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast('Item Master downloaded ('+ITEMS.length+' items)');
}

function loadCustomItems(){
  try{
    const custom=JSON.parse(localStorage.getItem('cs4_custom_items')||'[]');
    custom.forEach(it=>{
      if(!ITEMS.find(x=>x.d===it.d && x.e===it.e)) ITEMS.push(it);
    });
  }catch(err){}
}



/* ===== USER / SIGNATORY (first-run + settings) ===== */
function getUserProfile(){
  try{ return JSON.parse(localStorage.getItem('cs7_user')||'null'); }catch(e){ return null; }
}
function setUserProfile(p){
  localStorage.setItem('cs7_user', JSON.stringify(p));
  applyUserProfile(p);
}
function applyUserProfile(p){
  if(!p) return;
  // Document signatory fields only — sidebar stays as login session (permanent)
  const sn=document.getElementById('sigName');
  const sd=document.getElementById('sigDesig');
  const sm=document.getElementById('sigMobile');
  const sm2=document.getElementById('sigMobile2');
  const se=document.getElementById('sigEmail');
  if(sn) sn.value=p.name||'';
  if(sd) sd.value=p.desig||'';
  if(sm) sm.value=p.mobile||'';
  if(sm2) sm2.value=p.mobile2||'';
  if(se) se.value=p.email||'';
  // Sidebar ONLY refreshed from session
  if(typeof getSession==='function' && typeof applySessionToUI==='function'){
    const s=getSession();
    if(s){
      const side=document.getElementById('sidebarSig');
      if(side) side.textContent=s.name||s.id||'—';
      const role=document.querySelector('.sig-role');
      if(role) role.textContent=s.desig||(s.role==='admin'?'Administrator':'User');
    }
  }
}
function checkUserSetup(){
  const sess=(typeof getSession==='function')?getSession():null;
  if(sess && sess.id){
    // Logged in: sidebar from session; signatory from profile or session
    if(typeof applySessionToUI==='function') applySessionToUI(sess);
    const p=getUserProfile();
    if(p && p.name) applyUserProfile(p);
    else applyUserProfile({name:sess.name, desig:sess.desig, mobile:'', mobile2:'', email:sess.id});
    return;
  }
  const p=getUserProfile();
  if(p && p.name && p.desig){
    applyUserProfile(p);
    return;
  }
  const modal=document.getElementById('userSetupModal');
  if(modal) modal.classList.add('show');
}
function saveUserSetup(){
  const name=(document.getElementById('setupName').value||'').trim();
  const desig=(document.getElementById('setupDesig').value||'').trim();
  if(!name||!desig){ toast('Name and Designation are mandatory'); return; }
  const p={
    name:name,
    desig:desig,
    mobile:(document.getElementById('setupMobile').value||'').trim(),
    mobile2:(document.getElementById('setupMobile2')||{}).value||'',
    email:(document.getElementById('setupEmail').value||'').trim()
  };
  setUserProfile(p);
  document.getElementById('userSetupModal').classList.remove('show');
  toast('Profile saved');
}
function openSettings(){
  const p=getUserProfile()||{};
  document.getElementById('setName').value=p.name||'';
  document.getElementById('setDesig').value=p.desig||'';
  document.getElementById('setMobile').value=p.mobile||'';
  const sm2=document.getElementById('setMobile2'); if(sm2) sm2.value=p.mobile2||'';
  document.getElementById('setEmail').value=p.email||'';
  document.getElementById('settingsModal').classList.add('show');
}
function closeSettings(){
  document.getElementById('settingsModal').classList.remove('show');
}
function saveSettings(){
  const name=(document.getElementById('setName').value||'').trim();
  const desig=(document.getElementById('setDesig').value||'').trim();
  if(!name||!desig){ toast('Name and Designation required'); return; }
  const profile={
    name:name,
    desig:desig,
    mobile:(document.getElementById('setMobile').value||'').trim(),
    mobile2:(document.getElementById('setMobile2')||{}).value||'',
    email:(document.getElementById('setEmail').value||'').trim()
  };
  setUserProfile(profile);
  // Only Admin can change the permanent left-bar / login display name
  if(typeof isAdmin==='function' && isAdmin() && typeof getSession==='function' && typeof setSession==='function'){
    const s=getSession()||{};
    s.name=name;
    s.desig=desig;
    setSession(s);
    if(typeof applySessionToUI==='function') applySessionToUI(s);
  } else if(typeof getSession==='function' && typeof applySessionToUI==='function'){
    // non-admin: restore sidebar from session (ignore profile name for left bar)
    applySessionToUI(getSession());
  }
  closeSettings();
  toast('Settings saved');
}



function loadCompanyDefaults(){
  let c=null;
  try{ c=JSON.parse(localStorage.getItem('cs7_company')||'null'); }catch(e){}
  if(!c) c=Object.assign({}, COMPANY_DEFAULTS);
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
  set('ourAddress', c.address||COMPANY_DEFAULTS.address);
  set('ourPhone', c.phone||COMPANY_DEFAULTS.phone);
  set('ourPhone2', c.phone2||COMPANY_DEFAULTS.phone2);
  set('ourEmail', c.email||COMPANY_DEFAULTS.email);
  set('ourGST', c.gst||'');
  // save on change
  ['ourAddress','ourPhone','ourPhone2','ourEmail','ourGST'].forEach(id=>{
    const el=document.getElementById(id);
    if(el && !el._bound){
      el.addEventListener('change', saveCompanyProfile);
      el._bound=true;
    }
  });
}
function saveCompanyProfile(){
  const c={
    address:document.getElementById('ourAddress').value,
    phone:document.getElementById('ourPhone').value,
    phone2:(document.getElementById('ourPhone2')||{}).value||'',
    email:(document.getElementById('ourEmail')||{}).value||'',
    gst:document.getElementById('ourGST').value
  };
  localStorage.setItem('cs7_company', JSON.stringify(c));
}
function persistWorkspace(){
  try{
    localStorage.setItem('cs7_custom_scopes', JSON.stringify(customScopes));
    localStorage.setItem('cs7_scope_maps', JSON.stringify(scopeMappings));
  }catch(e){}
}
function loadWorkspace(){
  try{
    const cs=JSON.parse(localStorage.getItem('cs7_custom_scopes')||'[]');
    if(Array.isArray(cs)) customScopes=cs;
    const sm=JSON.parse(localStorage.getItem('cs7_scope_maps')||'{}');
    if(sm && typeof sm==='object') scopeMappings=sm;
  }catch(e){}
}
function formatPhones(p1,p2){
  const a=[p1,p2].filter(Boolean);
  return a.join(' / ');
}



/* ===== NOTES BLOCKS + TABLE BUILDER ===== */
function renderNoteBlocks(){
  const el=document.getElementById('notesBlocks');
  if(!el) return;
  if(!noteBlocks.length) noteBlocks=[{title:'Additional Notes', text:'', position:'after', serial:'', html:'', tables:[]}];
  el.innerHTML=noteBlocks.map((n,i)=>{
    if(!n.tables) n.tables=[];
    const serialVal = n.serial!=null && n.serial!=='' ? n.serial : '';
    let tablesHtml = (n.tables||[]).map((tb,ti)=>renderSectionTableEditor(i, ti, tb)).join('');
    return `<div class="sec-block" data-i="${i}" style="border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:10px;background:#fafbfd">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
        <label style="font-size:.62rem;font-weight:700;color:var(--muted)">Serial No.</label>
        <input type="number" min="1" max="99" value="${esc(String(serialVal))}" placeholder="Auto"
          style="width:64px;font-weight:700" title="Print section number (blank = automatic)"
          onchange="noteBlocks[${i}].serial=this.value">
        <input value="${esc(n.title||'')}" onchange="noteBlocks[${i}].title=this.value" placeholder="Section heading" style="flex:1;min-width:140px;font-weight:700">
        <select onchange="noteBlocks[${i}].position=this.value" style="max-width:170px;font-size:.72rem">
          <option value="before" ${n.position==='before'?'selected':''}>Above Schedule of Prices</option>
          <option value="after" ${n.position!=='before'?'selected':''}>Below Schedule of Prices</option>
        </select>
        <button type="button" class="btn-xs" onclick="moveNoteBlock(${i},-1)">↑</button>
        <button type="button" class="btn-xs" onclick="moveNoteBlock(${i},1)">↓</button>
        <button type="button" class="del-btn" style="width:22px;height:22px" onclick="noteBlocks.splice(${i},1);renderNoteBlocks()">×</button>
      </div>
      <textarea rows="2" style="width:100%;margin-bottom:6px" placeholder="Optional text matter…"
        onchange="noteBlocks[${i}].text=this.value">${esc(n.text||'')}</textarea>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
        <button type="button" class="btn-sm" onclick="addSectionTable(${i})">+ Add Table</button>
      </div>
      <div id="secTables${i}">${tablesHtml}</div>
    </div>`;
  }).join('');
}
function moveNoteBlock(i, dir){
  const j=i+dir;
  if(j<0||j>=noteBlocks.length) return;
  const t=noteBlocks[i]; noteBlocks[i]=noteBlocks[j]; noteBlocks[j]=t;
  renderNoteBlocks();
}
function addNoteBlock(){
  noteBlocks.push({title:'Notes', text:'', position:'after', serial:'', html:'', tables:[]});
  renderNoteBlocks();
}

function addSectionTable(secIdx){
  if(!noteBlocks[secIdx].tables) noteBlocks[secIdx].tables=[];
  noteBlocks[secIdx].tables.push({
    id: Date.now(),
    heading: 'Table',
    cols: ['Column 1','Column 2','Column 3'],
    rows: [['','',''],['','','']],
    colWidths: [120,120,120],
    totalCols: [], // column indexes to total
    totalLabels: {}, // colIdx -> label override
    totalValues: {}, // colIdx -> manual total override (string)
    showTotal: false
  });
  renderNoteBlocks();
}
function removeSectionTable(secIdx, ti){
  noteBlocks[secIdx].tables.splice(ti,1);
  renderNoteBlocks();
}
function renderSectionTableEditor(secIdx, ti, tb){
  const cols=tb.cols||['Col1'];
  const rows=tb.rows||[['' ]];
  const widths=tb.colWidths||cols.map(()=>100);
  let headCells = cols.map((c,ci)=>`
    <th style="min-width:${widths[ci]||80}px;padding:2px">
      <input value="${esc(c)}" style="width:100%;font-size:.68rem;font-weight:700;border:1px solid #ccc;padding:2px"
        onchange="noteBlocks[${secIdx}].tables[${ti}].cols[${ci}]=this.value">
      <input type="number" min="40" max="400" value="${widths[ci]||100}" title="Width px" style="width:56px;font-size:.6rem;margin-top:2px"
        onchange="noteBlocks[${secIdx}].tables[${ti}].colWidths[${ci}]=parseInt(this.value)||100;renderNoteBlocks()">
    </th>`).join('');
  let bodyRows = rows.map((row,ri)=>`
    <tr>
      ${cols.map((_,ci)=>`<td style="padding:2px"><input value="${esc((row||[])[ci]||'')}" style="width:100%;font-size:.7rem;border:1px solid #ddd;padding:2px 4px"
        onchange="ensureTableCell(${secIdx},${ti},${ri},${ci});noteBlocks[${secIdx}].tables[${ti}].rows[${ri}][${ci}]=this.value;recalcSectionTable(${secIdx},${ti})"></td>`).join('')}
      <td style="width:28px"><button type="button" class="del-btn" style="width:20px;height:20px;font-size:.65rem" onclick="removeTableRow(${secIdx},${ti},${ri})">×</button></td>
    </tr>`).join('');

  const totalChecks = cols.map((c,ci)=>{
    const on=(tb.totalCols||[]).map(Number).includes(ci);
    return `<label style="font-size:.65rem;margin-right:8px;font-weight:400">
      <input type="checkbox" ${on?'checked':''} onchange="toggleTableTotalCol(${secIdx},${ti},${ci},this.checked)"> Total: ${esc(c||('Col '+(ci+1)))}
    </label>`;
  }).join('');

  let totalRow = '';
  if(tb.showTotal && (tb.totalCols||[]).length){
    totalRow = `<tr style="background:#eef4fc;font-weight:700">
      ${cols.map((_,ci)=>{
        if(!(tb.totalCols||[]).map(Number).includes(ci)) return `<td style="padding:4px 6px;border:1px solid #333;font-size:.72rem"></td>`;
        const auto = computeColTotal(tb, ci);
        const manual = (tb.totalValues&&tb.totalValues[ci]!=null&&tb.totalValues[ci]!=='') ? tb.totalValues[ci] : '';
        const display = manual!=='' ? manual : auto;
        return `<td style="padding:2px;border:1px solid #333">
          <input value="${esc(String(display))}" style="width:100%;font-size:.72rem;font-weight:700;border:1px solid #0b3d91;padding:2px 4px;background:#fff"
            onchange="noteBlocks[${secIdx}].tables[${ti}].totalValues=noteBlocks[${secIdx}].tables[${ti}].totalValues||{};noteBlocks[${secIdx}].tables[${ti}].totalValues[${ci}]=this.value"
            title="Editable total (auto: ${auto})">
        </td>`;
      }).join('')}
      <td></td>
    </tr>`;
  }

  return `<div style="border:1px dashed #b0bccf;border-radius:6px;padding:8px;margin-bottom:8px;background:#fff">
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
      <input value="${esc(tb.heading||'Table')}" onchange="noteBlocks[${secIdx}].tables[${ti}].heading=this.value" placeholder="Table heading" style="flex:1;font-weight:700;font-size:.78rem">
      <button type="button" class="btn-xs" onclick="addTableCol(${secIdx},${ti})">+ Col</button>
      <button type="button" class="btn-xs" onclick="addTableRow(${secIdx},${ti})">+ Row</button>
      <button type="button" class="btn-xs" onclick="removeTableCol(${secIdx},${ti})">− Col</button>
      <label style="font-size:.68rem;font-weight:600"><input type="checkbox" ${tb.showTotal?'checked':''} onchange="noteBlocks[${secIdx}].tables[${ti}].showTotal=this.checked;renderNoteBlocks()"> Show Total row</label>
      <button type="button" class="del-btn" style="width:22px;height:22px" onclick="removeSectionTable(${secIdx},${ti})">×</button>
    </div>
    ${tb.showTotal?`<div style="margin-bottom:6px">${totalChecks}</div>`:''}
    <div style="overflow-x:auto">
      <table style="border-collapse:collapse;width:100%;min-width:200px">
        <thead><tr style="background:#e8eef8">${headCells}<th style="width:28px"></th></tr></thead>
        <tbody>${bodyRows}${totalRow}</tbody>
      </table>
    </div>
  </div>`;
}
function ensureTableCell(secIdx,ti,ri,ci){
  const tb=noteBlocks[secIdx].tables[ti];
  if(!tb.rows[ri]) tb.rows[ri]=[];
  while(tb.rows[ri].length<=ci) tb.rows[ri].push('');
}
function addTableRow(secIdx,ti){
  const tb=noteBlocks[secIdx].tables[ti];
  const n=(tb.cols||[]).length||1;
  tb.rows.push(Array(n).fill(''));
  renderNoteBlocks();
}
function removeTableRow(secIdx,ti,ri){
  noteBlocks[secIdx].tables[ti].rows.splice(ri,1);
  renderNoteBlocks();
}
function addTableCol(secIdx,ti){
  const tb=noteBlocks[secIdx].tables[ti];
  const n=(tb.cols||[]).length+1;
  tb.cols.push('Column '+n);
  if(!tb.colWidths) tb.colWidths=[];
  tb.colWidths.push(100);
  (tb.rows||[]).forEach(r=>r.push(''));
  renderNoteBlocks();
}
function removeTableCol(secIdx,ti){
  const tb=noteBlocks[secIdx].tables[ti];
  if((tb.cols||[]).length<=1) return;
  tb.cols.pop();
  if(tb.colWidths) tb.colWidths.pop();
  (tb.rows||[]).forEach(r=>{ if(r.length) r.pop(); });
  if(tb.totalCols) tb.totalCols=tb.totalCols.filter(c=>c<tb.cols.length);
  renderNoteBlocks();
}
function toggleTableTotalCol(secIdx,ti,ci,on){
  const tb=noteBlocks[secIdx].tables[ti];
  if(!tb.totalCols) tb.totalCols=[];
  tb.totalCols=tb.totalCols.map(Number).filter(x=>x!==ci);
  if(on) tb.totalCols.push(ci);
  tb.showTotal=true;
  renderNoteBlocks();
}
function computeColTotal(tb, ci){
  let s=0;
  (tb.rows||[]).forEach(r=>{
    const v=String((r||[])[ci]||'').replace(/[,₹\s]/g,'');
    const n=parseFloat(v);
    if(!isNaN(n)) s+=n;
  });
  return Math.round(s*100)/100;
}
function recalcSectionTable(secIdx,ti){
  // live totals refresh only when showTotal - avoid full re-render while typing
}

function buildNoteSectionHTML(nb, secNum){
  let h=`<div class="sec">${secNum}. ${esc(nb.title||'NOTES')}</div>`;
  if(nb.text && nb.text.trim())
    h+=`<div style="font-size:9.5pt;white-space:pre-line;margin-bottom:8px">${esc(nb.text.trim())}</div>`;
  (nb.tables||[]).forEach(tb=>{
    if(tb.heading) h+=`<div style="font-weight:bold;font-size:10pt;margin:8px 0 4px">${esc(tb.heading)}</div>`;
    const cols=tb.cols||[];
    const widths=tb.colWidths||[];
    h+=`<table class="pt" style="margin-bottom:10px"><thead><tr>`;
    cols.forEach((c,ci)=>{
      const w=widths[ci]?` style="width:${widths[ci]}px"`:'';
      h+=`<th${w}>${esc(c)}</th>`;
    });
    h+=`</tr></thead><tbody>`;
    (tb.rows||[]).forEach(row=>{
      h+=`<tr>`;
      cols.forEach((_,ci)=>h+=`<td>${esc((row||[])[ci]||'')}</td>`);
      h+=`</tr>`;
    });
    if(tb.showTotal && (tb.totalCols||[]).length){
      h+=`<tr style="font-weight:bold;background:#f0f0f0">`;
      cols.forEach((_,ci)=>{
        if(!(tb.totalCols||[]).map(Number).includes(ci)){ h+=`<td></td>`; return; }
        const manual=tb.totalValues&&tb.totalValues[ci]!=null&&tb.totalValues[ci]!==''?tb.totalValues[ci]:null;
        const val=manual!=null?manual:computeColTotal(tb,ci);
        h+=`<td style="text-align:right">${esc(String(val))}</td>`;
      });
      h+=`</tr>`;
    }
    h+=`</tbody></table>`;
  });
  return h;
}
function noteBlockHasContent(nb){
  if(!nb) return false;
  if(nb.text && nb.text.trim()) return true;
  if(nb.html && String(nb.html).trim()) return true;
  if((nb.tables||[]).some(tb=>(tb.rows||[]).length || (tb.heading||'').trim())) return true;
  return false;
}

/* ===== PRICE MEMORY ===== */
function loadPriceMemory(){
  try{ priceMemory=JSON.parse(localStorage.getItem('cs7_prices')||'{}'); }catch(e){ priceMemory={}; }
}
function savePriceMemory(){
  try{ localStorage.setItem('cs7_prices', JSON.stringify(priceMemory)); }catch(e){}
}
function rememberPrice(desc, rate, disc, unit){
  if(!desc) return;
  const key=desc.trim().toLowerCase().slice(0,120);
  priceMemory[key]={rate:rate||0, disc:disc||0, unit:unit||'Nos'};
  savePriceMemory();
}
function recallPrice(desc){
  if(!desc) return null;
  const key=desc.trim().toLowerCase().slice(0,120);
  return priceMemory[key]||null;
}
function applyPriceMemoryToLines(){
  lines.forEach(l=>{
    const m=recallPrice(l.desc);
    if(m && (!l.rate || l.rate===0)){
      l.rate=m.rate; l.disc=m.disc; if(m.unit) l.unit=m.unit;
    }
  });
}

/* ===== CRM CLIENTS / VENDORS ===== */
function loadCRM(){
  try{ clientsDB=JSON.parse(localStorage.getItem('cs7_clients')||'[]'); }catch(e){ clientsDB=[]; }
  try{ vendorsDB=JSON.parse(localStorage.getItem('cs7_vendors')||'[]'); }catch(e){ vendorsDB=[]; }
  refreshClientDatalist();
}
function saveCRMDB(){
  localStorage.setItem('cs7_clients', JSON.stringify(clientsDB));
  localStorage.setItem('cs7_vendors', JSON.stringify(vendorsDB));
  refreshClientDatalist();
}
function nextCRMCode(kind){
  const db=kind==='clients'?clientsDB:vendorsDB;
  const prefix=kind==='clients'?'CL':'VN';
  let max=0;
  db.forEach(c=>{
    const m=String(c.code||'').match(/(\d+)$/);
    if(m) max=Math.max(max, parseInt(m[1],10));
  });
  return prefix+String(max+1).padStart(4,'0');
}
function openCRMForm(kind, id){
  document.getElementById('crmKind').value=kind;
  document.getElementById('crmTitle').textContent=(id?'Edit ':'Add ')+(kind==='clients'?'Client':'Vendor');
  const db=kind==='clients'?clientsDB:vendorsDB;
  let row=null;
  if(id!==undefined && id!==null && id!==''){
    row=db.find(x=>String(x.id)===String(id));
    if(!row) row=db.find(x=>String(x.code)===String(id));
  }
  const set=(eid,val)=>{ const el=document.getElementById(eid); if(el) el.value=val!=null?val:''; };
  set('crmId', row?row.id:'');
  set('crmCode', row?row.code:nextCRMCode(kind));
  set('crmCompany', row?row.company:'');
  set('crmAddress', row?row.address:'');
  set('crmEmail', row?row.email:'');
  set('crmGST', row?row.gst:'');
  set('crmRemarks', row?row.remarks:'');
  set('crmCity', row?(row.city||extractCity(row.address||'')||''):'');
  set('crmPin', row?(row.pin||''):'');
  set('crmPAN', row?(row.pan||''):'');
  set('crmOfficePhone', row?(row.officePhone||''):'');
  set('crmWebsite', row?(row.website||''):'');
  set('crmState', row?(row.state||''):'');
  set('crmBankHolder', row?(row.bankHolder||''):'');
  set('crmBankName', row?(row.bankName||''):'');
  set('crmBankBranch', row?(row.bankBranch||''):'');
  set('crmBankAcct', row?(row.bankAcct||''):'');
  set('crmBankIFSC', row?(row.bankIFSC||''):'');
  set('crmBankType', row?(row.bankType||''):'');
  const isVen = kind==='vendors';
  const bank=document.getElementById('crmBankBlock');
  if(bank) bank.style.display=isVen?'block':'none';
  const va=document.getElementById('crmVendorActions');
  if(va) va.style.display=isVen?'block':'none';
  const cl=document.getElementById('crmCompanyLbl');
  if(cl) cl.textContent=isVen?'Vendor Name *':'Company Name *';
  window._crmContacts=(row&&row.contacts&&row.contacts.length)
    ? JSON.parse(JSON.stringify(row.contacts))
    : [{name:'', mobile:'', mobile2:'', email:''}];
  renderCRMContacts();
  document.getElementById('crmModal').classList.add('show');
}
function autoFillCityPinFromAddress(){
  const addr=(document.getElementById('crmAddress')||{}).value||'';
  const cityEl=document.getElementById('crmCity');
  const pinEl=document.getElementById('crmPin');
  if(cityEl && !cityEl.value && typeof extractCity==='function') cityEl.value=extractCity(addr)||'';
  if(pinEl && !pinEl.value){
    const m=String(addr).match(/\b(\d{6})\b/);
    if(m) pinEl.value=m[1];
  }
}

function closeCRM(){ document.getElementById('crmModal').classList.remove('show'); }
function renderCRMContacts(){
  const el=document.getElementById('crmContacts');
  if(!el) return;
  el.innerHTML=window._crmContacts.map((c,i)=>`
    <div style="border:1px solid var(--line);border-radius:5px;padding:6px;margin-top:4px">
      <div class="form-grid">
        <div class="fg"><label>Name</label><input value="${esc(c.name)}" onchange="_crmContacts[${i}].name=this.value"></div>
        <div class="fg"><label>Email</label><input value="${esc(c.email||'')}" onchange="_crmContacts[${i}].email=this.value"></div>
        <div class="fg"><label>Mobile 1</label><input value="${esc(c.mobile||'')}" onchange="_crmContacts[${i}].mobile=this.value"></div>
        <div class="fg"><label>Mobile 2</label><input value="${esc(c.mobile2||'')}" onchange="_crmContacts[${i}].mobile2=this.value"></div>
      </div>
      <button class="del-btn" style="margin-top:4px;width:auto;padding:2px 8px;height:auto" onclick="_crmContacts.splice(${i},1);renderCRMContacts()">Remove contact</button>
    </div>`).join('');
}
function addCRMContactRow(){
  window._crmContacts.push({name:'', mobile:'', mobile2:'', email:''});
  renderCRMContacts();
}
function saveCRM(){
  const kind=document.getElementById('crmKind').value;
  const company=(document.getElementById('crmCompany').value||'').trim();
  if(!company){ toast('Company name required'); return; }
  let city=(document.getElementById('crmCity')||{}).value||'';
  city=city.trim()||extractCity(document.getElementById('crmAddress').value)||'';
  const pin=(document.getElementById('crmPin')||{}).value||'';
  const row={
    id:document.getElementById('crmId').value|| (Date.now()+Math.random()),
    code:document.getElementById('crmCode').value,
    company, address:document.getElementById('crmAddress').value,
    city, pin, state:(document.getElementById('crmState')||{}).value||'',
    email:document.getElementById('crmEmail').value,
    officePhone:(document.getElementById('crmOfficePhone')||{}).value||'',
    website:(document.getElementById('crmWebsite')||{}).value||'',
    gst:document.getElementById('crmGST').value,
    pan:(document.getElementById('crmPAN')||{}).value||'',
    remarks:document.getElementById('crmRemarks').value,
    bankHolder:(document.getElementById('crmBankHolder')||{}).value||'',
    bankName:(document.getElementById('crmBankName')||{}).value||'',
    bankBranch:(document.getElementById('crmBankBranch')||{}).value||'',
    bankAcct:(document.getElementById('crmBankAcct')||{}).value||'',
    bankIFSC:(document.getElementById('crmBankIFSC')||{}).value||'',
    bankType:(document.getElementById('crmBankType')||{}).value||'',
    contacts:(window._crmContacts||[]).filter(c=>c.name||c.mobile)
  };
  const db=kind==='clients'?clientsDB:vendorsDB;
  const ix=db.findIndex(x=>String(x.id)===String(row.id));
  if(ix>=0) db[ix]=Object.assign({}, db[ix], row); else db.push(row);
  saveCRMDB();
  closeCRM();
  renderCRM(kind);
  toast('Saved '+row.code);
}

function extractCity(address){
  if(!address) return '';
  const a=String(address).replace(/\n/g,' ').trim();
  const known=['Lucknow','Kanpur','Varanasi','Noida','Ghaziabad','Agra','Meerut','Prayagraj','Allahabad','Bareilly','Gorakhpur','Unnao','Lakhimpur','Dehradun','Chandigarh','Mumbai','Delhi','New Delhi','Gurgaon','Gurugram','Pune','Hyderabad','Bangalore','Bengaluru','Chennai','Kolkata','Jaipur','Indore','Bhopal','Patna','Ranchi','Bhubaneswar','Ahmedabad','Surat','Nagpur','Raipur','Jabalpur','Gwalior','Aligarh','Moradabad','Saharanpur','Firozabad','Jhansi','Muzaffarnagar','Mathura','Rampur','Shahjahanpur','Farrukhabad','Hapur','Etawah','Mirzapur','Bulandshahr','Sambhal','Amroha','Hardoi','Bahraich','Sitapur','Rae Bareli','Ayodhya','Faizabad','Azamgarh','Ballia','Basti','Sultanpur','Jaunpur','Ghazipur'];
  const low=a.toLowerCase();
  for(const city of known){
    if(low.includes(city.toLowerCase())) return city;
  }
  const pin=a.match(/([A-Za-z][A-Za-z\s]{2,40}?)\s*[-,]?\s*\d{6}/);
  if(pin){
    const parts=pin[1].trim().split(/[\s,]+/).filter(Boolean);
    if(parts.length) return parts[parts.length-1];
  }
  const segs=a.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
  for(let i=segs.length-1;i>=0;i--){
    if(!/\d{5,}/.test(segs[i]) && segs[i].length>2 && segs[i].length<30){
      const t=segs[i].replace(/\d+/g,'').trim();
      if(t) return t;
    }
  }
  return '';
}
function getCity(c){
  if(c.city && String(c.city).trim()) return String(c.city).trim();
  return extractCity(c.address)||'Unknown';
}
function renderCRM(kind){
  const db=kind==='clients'?clientsDB:vendorsDB;
  const q=((document.getElementById(kind==='clients'?'clientSearch':'vendorSearch')||{}).value||'').toLowerCase();
  const citySel=document.getElementById(kind==='clients'?'clientCityFilter':'vendorCityFilter');
  const groupEl=document.getElementById(kind==='clients'?'clientGroupCity':'vendorGroupCity');
  const cityFilter=citySel?citySel.value:'';
  const groupByCity=groupEl?groupEl.checked:false;
  const el=document.getElementById(kind==='clients'?'clientsList':'vendorsList');
  if(!el) return;

  const enriched=db.map(c=>({...c, _city:getCity(c)}));

  if(citySel){
    const cities=[...new Set(enriched.map(c=>c._city))].sort((a,b)=>a.localeCompare(b));
    const prev=citySel.value;
    citySel.innerHTML='<option value="">All cities</option>'+cities.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if(prev && cities.includes(prev)) citySel.value=prev;
  }

  let list=enriched.filter(c=>{
    if(cityFilter && c._city!==cityFilter) return false;
    if(!q) return true;
    const blob=(c.company+c.code+c.email+(c.address||'')+c._city+(c.contacts||[]).map(x=>x.name+(x.mobile||'')).join(' ')).toLowerCase();
    return blob.includes(q);
  });
  if(!list.length){ el.innerHTML='<p class="empty-msg">No records</p>'; return; }

  const head=`<div class="crm-row crm-head"><span>Code</span><span>Company</span><span>City</span><span>Contact</span><span>Actions</span></div>`;

  function rowHtml(c){
    const ct=(c.contacts&&c.contacts[0])?`${esc(c.contacts[0].name||'')}${c.contacts[0].mobile?' · '+esc(c.contacts[0].mobile):''}`:'—';
    const more=(c.contacts&&c.contacts.length>1)?` +${c.contacts.length-1}`:'';
    return `<div class="crm-row">
      <span class="crm-code">${esc(c.code)}</span>
      <span class="crm-name" title="${esc(c.address||'')}">${esc(c.company)}</span>
      <span class="crm-city">${esc(c._city)}</span>
      <span class="crm-ct">${ct}${more}</span>
      <span class="crm-acts">
        ${kind==='clients'?`<button class="btn-xs" style="background:#0b3d91;color:#fff" onclick="openCustomer360('${esc(c.company).replace(/'/g,"\\'")}')">360°</button>`:`<button class="btn-xs" style="background:#b45309;color:#fff" onclick="openVendor360('${esc(c.company).replace(/'/g,"\\'")}')">360°</button>`}
        <button class="btn-xs" onclick="viewCRM('${kind}','${c.id}')">View</button>
        <button class="btn-xs" onclick="openCRMForm('${kind}','${c.id}')">Edit</button>
        <button class="del-btn" style="width:20px;height:20px;font-size:.65rem" onclick="deleteCRM('${kind}','${c.id}')">×</button>
      </span>
    </div>`;
  }

  if(!groupByCity){
    list.sort((a,b)=>{
      const ca=String(a.code||''), cb=String(b.code||'');
      const na=parseInt((ca.match(/(\d+)/)||[])[1]||'0',10), nb=parseInt((cb.match(/(\d+)/)||[])[1]||'0',10);
      if(na!==nb) return na-nb;
      return ca.localeCompare(cb);
    });
    el.innerHTML=`<div class="crm-list">${head}${list.map(rowHtml).join('')}</div>`;
    return;
  }

  const by={};
  list.forEach(c=>{ (by[c._city]=by[c._city]||[]).push(c); });
  const cities=Object.keys(by).sort((a,b)=>a.localeCompare(b));
  el.innerHTML=cities.map(city=>{
    const items=by[city].sort((a,b)=>a.company.localeCompare(b.company));
    return `<div class="crm-city-group">
      <div class="crm-city-title">${esc(city)} <span>(${items.length})</span></div>
      <div class="crm-list">${head}${items.map(rowHtml).join('')}</div>
    </div>`;
  }).join('');
}
function viewCRM(kind, id){
  const db=kind==='clients'?clientsDB:vendorsDB;
  const c=db.find(x=>String(x.id)===String(id));
  if(!c) return;
  const city=getCity(c);
  const contacts=(c.contacts||[]).map((x,i)=>`
    <tr><td style="padding:3px 6px;border-bottom:1px solid #eee">${i+1}. ${esc(x.name||'—')}</td>
    <td style="padding:3px 6px;border-bottom:1px solid #eee">${esc(x.mobile||'')}${x.mobile2?' / '+esc(x.mobile2):''}</td>
    <td style="padding:3px 6px;border-bottom:1px solid #eee">${esc(x.email||'')}</td></tr>`).join('')||'<tr><td colspan="3" style="padding:6px;color:#64748b">No contacts</td></tr>';
  document.getElementById('crmViewTitle').textContent=(kind==='clients'?'Client':'Vendor')+' — '+c.code;
  document.getElementById('crmViewBody').innerHTML=`
    <div class="form-grid" style="gap:8px">
      <div class="fg"><label>Code</label><div style="font-weight:700;color:var(--blue)">${esc(c.code)}</div></div>
      <div class="fg"><label>City</label><div style="font-weight:600">${esc(city)}</div></div>
      <div class="fg full"><label>Company</label><div style="font-weight:700;font-size:.9rem">${esc(c.company)}</div></div>
      <div class="fg full"><label>Address</label><div style="white-space:pre-line;font-size:.8rem">${esc(c.address||'—')}</div></div>
      <div class="fg"><label>Email</label><div>${esc(c.email||'—')}</div></div>
      <div class="fg"><label>GSTIN</label><div>${esc(c.gst||'—')}</div></div>
      <div class="fg"><label>PIN</label><div>${esc(c.pin||'—')}</div></div>
      <div class="fg"><label>PAN</label><div>${esc(c.pan||'—')}</div></div>
      <div class="fg"><label>Office Phone</label><div>${esc(c.officePhone||'—')}</div></div>
      <div class="fg full"><label>Remarks</label><div style="font-size:.8rem;color:#475569">${esc(c.remarks||'—')}</div></div>
      ${c.bankName||c.bankAcct?`<div class="fg full" style="margin-top:8px;font-weight:700">Bank</div>
      <div class="fg"><label>Holder</label><div>${esc(c.bankHolder||'—')}</div></div>
      <div class="fg"><label>Bank</label><div>${esc(c.bankName||'—')}</div></div>
      <div class="fg"><label>A/c</label><div>${esc(c.bankAcct||'—')}</div></div>
      <div class="fg"><label>IFSC</label><div>${esc(c.bankIFSC||'—')}</div></div>`:''}
    </div>
    <div style="margin-top:12px;font-weight:700;font-size:.78rem">Contacts</div>
    <table style="width:100%;border-collapse:collapse;font-size:.75rem;margin-top:4px">
      <thead><tr style="background:#f1f5f9;text-align:left"><th style="padding:4px 6px">Name</th><th style="padding:4px 6px">Mobile</th><th style="padding:4px 6px">Email</th></tr></thead>
      <tbody>${contacts}</tbody>
    </table>
  `;
  document.getElementById('crmViewEditBtn').onclick=function(){ closeCRMView(); openCRMForm(kind, id); };
  document.getElementById('crmViewModal').classList.add('show');
}
function closeCRMView(){ document.getElementById('crmViewModal').classList.remove('show'); }

function deleteCRM(kind,id){
  if(!confirm('Delete this record?')) return;
  if(kind==='clients') clientsDB=clientsDB.filter(x=>String(x.id)!==String(id));
  else vendorsDB=vendorsDB.filter(x=>String(x.id)!==String(id));
  saveCRMDB(); renderCRM(kind);
}
function refreshClientDatalist(){
  const dl=document.getElementById('clientDatalist');
  if(!dl) return;
  dl.innerHTML=clientsDB.map(c=>`<option value="${esc(c.company)}">`).join('');
}
function pickFromCRM(kind){
  window._pickCRMKind = kind||'clients';
  const db = kind==='vendors' ? vendorsDB : clientsDB;
  if(!db || !db.length){
    toast(kind==='vendors'?'No vendors saved — add in Vendors module':'No clients saved — add in Clients module');
    return;
  }
  const modal=document.getElementById('crmPickModal');
  const list=document.getElementById('crmPickList');
  const title=document.getElementById('crmPickTitle');
  const qel=document.getElementById('crmPickQ');
  if(title) title.textContent = kind==='vendors' ? 'Select Vendor' : 'Select Client';
  if(qel) qel.value='';
  window._pickCRMRender = function(){
    const q=((document.getElementById('crmPickQ')||{}).value||'').toLowerCase();
    let rows=db.slice();
    if(q) rows=rows.filter(c=>(c.company+c.code+(c.city||'')+(c.gst||'')+(c.email||'')).toLowerCase().includes(q));
    list.innerHTML = rows.map(c=>{
      const ct=(c.contacts&&c.contacts[0])?c.contacts[0]:{};
      return `<div class="pres" style="cursor:pointer" onclick="applyCRMPick('${String(c.id).replace(/'/g,"\'")}')">
        <div class="pr-title">${esc(c.code||'')} — ${esc(c.company||'')}</div>
        <div class="pr-sub">${esc(c.city||'')} ${c.gst?'· GST '+esc(c.gst):''} ${ct.name?'· '+esc(ct.name):''} ${ct.mobile?'· '+esc(ct.mobile):''}</div>
      </div>`;
    }).join('') || '<div class="pres">No matches</div>';
  };
  window._pickCRMRender();
  if(modal) modal.classList.add('show');
}
function closeCRMPick(){
  const modal=document.getElementById('crmPickModal');
  if(modal) modal.classList.remove('show');
}
function applyCRMPick(id){
  const kind=window._pickCRMKind||'clients';
  const db=kind==='vendors'?vendorsDB:clientsDB;
  const c=db.find(x=>String(x.id)===String(id));
  if(!c){ toast('Not found'); return; }
  const set=(eid,v)=>{ const el=document.getElementById(eid); if(el) el.value=v!=null?v:''; };
  set('clientName', c.company||'');
  set('clientAddress', c.address||'');
  set('clientEmail', c.email||c.contacts&&c.contacts[0]&&c.contacts[0].email||'');
  set('clientGST', c.gst||'');
  if(c.contacts&&c.contacts[0]){
    set('clientContact', c.contacts[0].name||'');
    set('clientPhone', c.contacts[0].mobile||'');
    set('clientPhone2', c.contacts[0].mobile2||'');
  } else {
    set('clientContact',''); set('clientPhone',''); set('clientPhone2','');
  }
  // office phone fallback
  if(!(document.getElementById('clientPhone')||{}).value && c.officePhone) set('clientPhone', c.officePhone);
  if(typeof autoSubject==='function') autoSubject();
  closeCRMPick();
  if(typeof showView==='function') showView('create');
  toast((kind==='vendors'?'Vendor':'Client')+' loaded: '+(c.company||''));
}

function exportVendorRegForm(fmt){
  const get=id=>(document.getElementById(id)||{}).value||'';
  // Prefer current form values; else blank template for sending to vendor
  const data={
    code: get('crmCode'),
    company: get('crmCompany'),
    address: get('crmAddress'),
    city: get('crmCity'),
    pin: get('crmPin'),
    state: get('crmState'),
    gst: get('crmGST'),
    pan: get('crmPAN'),
    email: get('crmEmail'),
    officePhone: get('crmOfficePhone'),
    website: get('crmWebsite'),
    bankHolder: get('crmBankHolder'),
    bankName: get('crmBankName'),
    bankBranch: get('crmBankBranch'),
    bankAcct: get('crmBankAcct'),
    bankIFSC: get('crmBankIFSC'),
    bankType: get('crmBankType'),
    contacts: window._crmContacts||[]
  };
  const fields=[
    ['Vendor Code', data.code],
    ['Vendor Name', data.company],
    ['Full Address', data.address],
    ['City', data.city],
    ['PIN Code', data.pin],
    ['State', data.state],
    ['GSTIN', data.gst],
    ['PAN', data.pan],
    ['Email', data.email],
    ['Office Phone', data.officePhone],
    ['Website', data.website],
    ['Account Holder', data.bankHolder],
    ['Bank Name', data.bankName],
    ['Branch', data.bankBranch],
    ['Account Number', data.bankAcct],
    ['IFSC', data.bankIFSC],
    ['Account Type', data.bankType]
  ];
  (data.contacts||[]).forEach(function(c,i){
    fields.push(['Contact '+(i+1)+' Name', c.name||'']);
    fields.push(['Contact '+(i+1)+' Mobile', c.mobile||'']);
    fields.push(['Contact '+(i+1)+' Mobile 2', c.mobile2||'']);
    fields.push(['Contact '+(i+1)+' Email', c.email||'']);
  });
  if(!data.contacts||!data.contacts.length){
    fields.push(['Contact 1 Name','']); fields.push(['Contact 1 Mobile','']); fields.push(['Contact 1 Email','']);
  }

  if(fmt==='excel'){
    const headers=['Field','Value'];
    const rows=fields.map(f=>[f[0], f[1]]);
    if(typeof downloadColorExcel==='function')
      downloadColorExcel('Vendor_Registration_Form.xls','Vendor Registration',headers,rows);
    else {
      let csv='Field,Value\\n'+rows.map(r=>'"'+r[0]+'","'+String(r[1]).replace(/"/g,'""')+'"').join('\\n');
      const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\\ufeff'+csv],{type:'text/csv'})); a.download='Vendor_Registration_Form.csv'; a.click();
    }
    toast('Vendor Registration Excel downloaded');
    return;
  }

  let body='<div style="font-family:Calibri,Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px">';
  body+='<div style="text-align:center;font-family:Century Gothic,sans-serif;font-weight:700;font-size:18pt;color:#0b3d91">CENTURY SOLUTION</div>';
  body+='<div style="text-align:center;font-size:9pt;color:#333;margin:4px 0">210 Shagun Palace, 3 Sapru Marg, Hazratganj, Lucknow 226001<br>0522 4049754 / 7458014000 · info@centurysolution.co.in</div>';
  body+='<hr style="border:none;border-top:2px solid #0b3d91">';
  body+='<div style="text-align:center;font-weight:700;font-size:14pt;margin:12px 0;text-decoration:underline">VENDOR REGISTRATION FORM</div>';
  body+='<p style="font-size:10pt">Please fill all details and return. Fields marked * are mandatory.</p>';
  body+='<table style="width:100%;border-collapse:collapse;font-size:10pt">';
  fields.forEach(function(f){
    body+='<tr><td style="border:1px solid #333;padding:6px 8px;width:35%;background:#eef4fc;font-weight:600">'+f[0]+'</td>';
    body+='<td style="border:1px solid #333;padding:6px 8px;min-height:22px">'+(f[1]?String(f[1]).replace(/</g,'&lt;'):'&nbsp;')+'</td></tr>';
  });
  body+='</table>';
  body+='<p style="margin-top:20px;font-size:9pt">Declaration: Information provided is true and correct.</p>';
  body+='<p style="margin-top:24px">Authorized Signatory: ________________ &nbsp;&nbsp; Date: ________</p>';
  body+='<p style="margin-top:8px;font-size:8pt;color:#666">CENTURY SOLUTION — Vendor Registration</p></div>';

  if(fmt==='word'){
    const html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Vendor Registration</title></head><body>'+body+'</body></html>';
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['\\ufeff'+html],{type:'application/msword'}));
    a.download='Vendor_Registration_Form.doc'; a.click();
    toast('Word form downloaded');
  } else {
    // PDF via print window
    const w=window.open('','_blank');
    w.document.write('<html><head><title>Vendor Registration</title></head><body>'+body+'<script>setTimeout(function(){window.print()},400)<\\/script></body></html>');
    w.document.close();
    toast('PDF — use Print → Save as PDF');
  }
}

function importVendorRegForm(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file) return;
  toast('Reading vendor form…');
  const reader=new FileReader();
  const name=file.name.toLowerCase();
  reader.onload=function(e){
    try{
      let map={};
      if(name.endsWith('.csv')||name.endsWith('.txt')){
        const text=String(e.target.result);
        text.split(/\\r?\\n/).forEach(function(line){
          const m=line.match(/^"?([^",]+)"?\\s*[,\\t]\\s*"?([^"]*)"?/);
          if(m) map[m[1].trim().toLowerCase()]=m[2].trim();
        });
      } else if(name.endsWith('.xlsx')||name.endsWith('.xls')){
        if(typeof XLSX==='undefined'){ toast('Excel library needed (internet once)'); return; }
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
        // Field | Value pairs OR header row
        rows.forEach(function(r){
          if(!r||!r.length) return;
          if(r.length>=2 && r[0]) map[String(r[0]).trim().toLowerCase()]=String(r[1]||'').trim();
        });
        // also try object keys if sheet_to_json objects better
        const objs=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
        objs.forEach(function(o){
          Object.keys(o).forEach(function(k){
            const kl=k.toLowerCase();
            if(/field|label|description/.test(kl) && o[k]){
              const valKey=Object.keys(o).find(x=>/value|detail|data/i.test(x));
              if(valKey) map[String(o[k]).toLowerCase()]=String(o[valKey]||'');
            }
            // flat vendor columns
            map[kl]=String(o[k]||'');
          });
        });
      } else {
        // doc/pdf/txt as text extract
        const text=typeof e.target.result==='string'?e.target.result:new TextDecoder().decode(e.target.result);
        // label: value patterns
        text.split(/\\r?\\n/).forEach(function(line){
          const m=line.match(/^\\s*([^:]{3,40})\\s*[:\\-]\\s*(.+)$/);
          if(m) map[m[1].trim().toLowerCase()]=m[2].trim();
        });
        // html table cells skipped for safety

      }
      function pick(){
        const keys=Object.keys(map);
        for(let i=0;i<arguments.length;i++){
          const want=arguments[i].toLowerCase();
          const k=keys.find(x=>x===want||x.includes(want)||want.includes(x));
          if(k && map[k]) return map[k];
        }
        return '';
      }
      openCRMForm('vendors');
      const set=(id,v)=>{ const el=document.getElementById(id); if(el&&v) el.value=v; };
      set('crmCompany', pick('vendor name','company name','company','vendor'));
      set('crmAddress', pick('full address','address'));
      set('crmCity', pick('city'));
      set('crmPin', pick('pin code','pincode','pin'));
      set('crmState', pick('state'));
      set('crmGST', pick('gstin','gst'));
      set('crmPAN', pick('pan'));
      set('crmEmail', pick('email'));
      set('crmOfficePhone', pick('office phone','phone','landline'));
      set('crmWebsite', pick('website'));
      set('crmBankHolder', pick('account holder','beneficiary'));
      set('crmBankName', pick('bank name','bank'));
      set('crmBankBranch', pick('branch'));
      set('crmBankAcct', pick('account number','a/c','acct'));
      set('crmBankIFSC', pick('ifsc'));
      set('crmBankType', pick('account type'));
      if(typeof extractCity==='function' && !document.getElementById('crmCity').value)
        document.getElementById('crmCity').value=extractCity(document.getElementById('crmAddress').value)||'';
      // contacts
      const c1n=pick('contact 1 name','contact name','contact person');
      const c1m=pick('contact 1 mobile','mobile','contact mobile');
      const c1e=pick('contact 1 email','contact email');
      if(c1n||c1m){
        window._crmContacts=[{name:c1n, mobile:c1m, mobile2:pick('contact 1 mobile 2'), email:c1e}];
        const c2n=pick('contact 2 name');
        if(c2n) window._crmContacts.push({name:c2n, mobile:pick('contact 2 mobile'), mobile2:'', email:pick('contact 2 email')});
        renderCRMContacts();
      }
      toast('Vendor form loaded — review & Save');
    }catch(err){ console.error(err); toast('Could not read file: '+(err.message||err)); }
    ev.target.value='';
  };
  if(name.endsWith('.csv')||name.endsWith('.txt')||name.endsWith('.doc')||name.endsWith('.html')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function exportCRM(kind){
  const db=kind==='clients'?clientsDB:vendorsDB;
  if(!db.length){ toast('No records to export'); return; }
  const isVen=kind==='vendors';
  const headers=[
    'Code','Company / Name','Address','City','PIN','State','Email','Office Phone','Website',
    'GSTIN','PAN','Remarks',
    'Contact 1 Name','Contact 1 Mobile','Contact 1 Mobile 2','Contact 1 Email',
    'Contact 2 Name','Contact 2 Mobile','Contact 2 Email'
  ];
  if(isVen){
    headers.push('Bank Holder','Bank Name','Branch','Account No','IFSC','Account Type');
  }
  const rows=db.map(function(c){
    const ct=c.contacts||[];
    const c1=ct[0]||{}, c2=ct[1]||{};
    const row=[
      c.code||'', c.company||'', c.address||'', c.city||'', c.pin||'', c.state||'',
      c.email||'', c.officePhone||'', c.website||'',
      c.gst||'', c.pan||'', c.remarks||'',
      c1.name||'', c1.mobile||'', c1.mobile2||'', c1.email||'',
      c2.name||'', c2.mobile||'', c2.email||''
    ];
    if(isVen){
      row.push(c.bankHolder||'', c.bankName||'', c.bankBranch||'', c.bankAcct||'', c.bankIFSC||'', c.bankType||'');
    }
    return row;
  });
  const title=isVen?'Vendors List':'Clients List';
  if(typeof downloadColorExcel==='function'){
    downloadColorExcel('CENTURY_'+kind+'_'+new Date().toISOString().slice(0,10)+'.xls', title, headers, rows);
  } else {
    let csv=headers.join(',')+'\n';
    rows.forEach(r=>{ csv+=r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')+'\n'; });
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));
    a.download='CENTURY_'+kind+'.csv'; a.click();
  }
  toast(title+' downloaded ('+rows.length+' rows)');
}
function importCRM(kind, ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      let rows=[];
      if(file.name.toLowerCase().endsWith('.csv')){
        const lines=e.target.result.split(/\\r?\\n/).filter(l=>l.trim());
        const headers=lines[0].split(',').map(h=>h.replace(/^"|"$/g,'').toLowerCase());
        for(let i=1;i<lines.length;i++){
          const cols=lines[i].match(/("([^"]|"")*"|[^,]*)/g)||[];
          const vals=cols.map(c=>c.replace(/^"|"$/g,'').replace(/""/g,'"'));
          const o={}; headers.forEach((h,j)=>o[h]=vals[j]||''); rows.push(o);
        }
      } else {
        if(typeof XLSX==='undefined'){ toast('Excel lib not loaded'); return; }
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      }
      const db=kind==='clients'?clientsDB:vendorsDB;
      const byCompany={};
      db.forEach(c=>{ byCompany[c.company.toLowerCase()]=c; });
      rows.forEach(r=>{
        const keys=Object.keys(r);
        const get=(...ns)=>{ for(const n of ns){ const k=keys.find(x=>x.toLowerCase().includes(n.toLowerCase())); if(k&&String(r[k]).trim()) return String(r[k]).trim(); } return ''; };
        const company=get('company','name');
        if(!company) return;
        let c=byCompany[company.toLowerCase()];
        if(!c){
          c={id:Date.now()+Math.random(), code:get('code')||nextCRMCode(kind), company, address:get('address'), email:get('email'), gst:get('gst'), remarks:get('remarks'), contacts:[]};
          db.push(c); byCompany[company.toLowerCase()]=c;
        }
        const cn=get('contact name','contact');
        const m1=get('mobile1','mobile');
        if(cn||m1) c.contacts.push({name:cn, mobile:m1, mobile2:get('mobile2'), email:get('contact email')});
      });
      saveCRMDB(); renderCRM(kind); toast('Imported');
    }catch(err){ toast('Import failed'); console.error(err); }
    ev.target.value='';
  };
  if(file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}



/* ===== Settings → Masters add popups ===== */
function settingsAddMaster(kind){
  showView('masters');
  setTimeout(function(){ openMasterAddPopup(kind); }, 120);
}
function closeMasterAdd(){ document.getElementById('masterAddModal').classList.remove('show'); }
function closeModalEl(id){ const el=document.getElementById(id); if(el) el.classList.remove('show'); }

function openMasterAddPopup(kind){
  window._masterAddKind=kind;
  const title=document.getElementById('masterAddTitle');
  const body=document.getElementById('masterAddBody');
  const saveBtn=document.getElementById('masterAddSaveBtn');
  if(kind==='itemimport'){
    document.getElementById('itemMasterFileSettings').click();
    return;
  }
  saveBtn.style.display='inline-block';
  if(kind==='scope'){
    title.textContent='Add Work Scope';
    body.innerHTML=`<label>Scope Name *</label><input id="popupScopeName" placeholder="e.g. Calibration">`;
  } else if(kind==='mapping'){
    title.textContent='Scope Mapping';
    const all=[...(typeof WORK_SCOPES!=='undefined'?WORK_SCOPES:[]),...(typeof customScopes!=='undefined'?customScopes:[])];
    body.innerHTML=`
      <label>Scope</label>
      <select id="popupMapScope">${all.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
      <label style="margin-top:8px">Link to</label>
      <select id="popupMapSource">
        <option value="master">Item Master (Supply)</option>
        <option value="sow">SOW Package</option>
        <option value="maint">Maintenance line</option>
        <option value="custom">Custom only</option>
      </select>`;
  } else if(kind==='category'){
    title.textContent='Add Category';
    body.innerHTML=`<label>Category Name *</label><input id="popupCatName">
      <label style="margin-top:8px">Description</label><input id="popupCatDesc">`;
  } else if(kind==='sow'){
    title.textContent='Add SOW Equipment';
    body.innerHTML=`
      <label>Equipment Name *</label><input id="popupSowEq" placeholder="e.g. RMU">
      <label style="margin-top:8px">Service activities (one per line)</label><textarea id="popupSowSvc" rows="3"></textarea>
      <label style="margin-top:8px">Testing activities (one per line)</label><textarea id="popupSowTst" rows="3"></textarea>`;
  } else if(kind==='item'){
    title.textContent='Add Item to Master';
    body.innerHTML=`
      <label>Equipment *</label><input id="popupMiEquip" placeholder="MCCB">
      <label style="margin-top:8px">Description *</label><input id="popupMiDesc">
      <label style="margin-top:8px">Rating</label><input id="popupMiRating">
      <label style="margin-top:8px">Type</label><input id="popupMiType">
      <label style="margin-top:8px">Spec</label><input id="popupMiSpec">`;
  }
  document.getElementById('masterAddModal').classList.add('show');
}
function confirmMasterAdd(){
  const kind=window._masterAddKind;
  if(kind==='scope'){
    const n=(document.getElementById('popupScopeName').value||'').trim();
    if(!n){ toast('Enter name'); return; }
    if([...WORK_SCOPES,...customScopes].includes(n)){ toast('Exists'); return; }
    customScopes.push(n); persistWorkspace(); renderMasterScopes(); renderScopes();
    toast('Scope added');
  } else if(kind==='mapping'){
    const n=document.getElementById('popupMapScope').value;
    const src=document.getElementById('popupMapSource').value;
    scopeMappings[n]=src; persistWorkspace(); renderMasterScopes(); updateAddButtons();
    toast('Mapping saved');
  } else if(kind==='category'){
    const name=(document.getElementById('popupCatName').value||'').trim();
    if(!name){ toast('Name required'); return; }
    if(CATEGORIES.find(c=>c.name.toLowerCase()===name.toLowerCase())){ toast('Exists'); return; }
    CATEGORIES.push({name, desc:(document.getElementById('popupCatDesc').value||'').trim()});
    CAT_TO_EQ[name]=[name];
    try{ const custom=JSON.parse(localStorage.getItem('cs7_custom_cats')||'[]'); custom.push({name,desc:document.getElementById('popupCatDesc').value||''}); localStorage.setItem('cs7_custom_cats',JSON.stringify(custom)); }catch(e){}
    document.getElementById('catCount').textContent=CATEGORIES.length;
    renderMasterCats(); toast('Category added');
  } else if(kind==='sow'){
    const eq=(document.getElementById('popupSowEq').value||'').trim();
    if(!eq){ toast('Equipment required'); return; }
    if(SOW[eq]){ toast('Exists'); return; }
    SOW[eq]={
      Service:(document.getElementById('popupSowSvc').value||'').split('\\n').map(x=>x.trim()).filter(Boolean),
      Testing:(document.getElementById('popupSowTst').value||'').split('\\n').map(x=>x.trim()).filter(Boolean)
    };
    persistSOW(); renderMasterSOW(); toast('SOW added');
  } else if(kind==='item'){
    const e=(document.getElementById('popupMiEquip').value||'').trim();
    const d=(document.getElementById('popupMiDesc').value||'').trim();
    if(!e||!d){ toast('Equipment & Description required'); return; }
    ITEMS.push({d,e,r:(document.getElementById('popupMiRating').value||'').trim(),t:(document.getElementById('popupMiType').value||'').trim(),s:(document.getElementById('popupMiSpec').value||'').trim(),sh:'Custom'});
    try{ const custom=JSON.parse(localStorage.getItem('cs4_custom_items')||'[]'); custom.push(ITEMS[ITEMS.length-1]); localStorage.setItem('cs4_custom_items',JSON.stringify(custom)); }catch(err){}
    document.getElementById('itemCount').textContent=ITEMS.length.toLocaleString();
  if(typeof renderDashboard==='function') try{ renderDashboard(); }catch(e){ console.error(e); }
    toast('Item added');
  }
  closeMasterAdd();
}
function openCompanySettings(){
  let c={};
  try{ c=JSON.parse(localStorage.getItem('cs7_company')||'null')||COMPANY_DEFAULTS; }catch(e){ c=COMPANY_DEFAULTS; }
  document.getElementById('setOurAddress').value=c.address||COMPANY_DEFAULTS.address;
  document.getElementById('setOurPhone').value=c.phone||COMPANY_DEFAULTS.phone;
  document.getElementById('setOurPhone2').value=c.phone2||COMPANY_DEFAULTS.phone2;
  document.getElementById('setOurEmail').value=c.email||COMPANY_DEFAULTS.email;
  document.getElementById('setOurGST').value=c.gst||'';
  document.getElementById('companyModal').classList.add('show');
}
function saveCompanySettings(){
  const c={
    address:document.getElementById('setOurAddress').value,
    phone:document.getElementById('setOurPhone').value,
    phone2:document.getElementById('setOurPhone2').value,
    email:document.getElementById('setOurEmail').value,
    gst:document.getElementById('setOurGST').value
  };
  localStorage.setItem('cs7_company', JSON.stringify(c));
  // sync form fields if present
  const map={ourAddress:'address',ourPhone:'phone',ourPhone2:'phone2',ourEmail:'email',ourGST:'gst'};
  Object.keys(map).forEach(id=>{ const el=document.getElementById(id); if(el) el.value=c[map[id]]||''; });
  closeModalEl('companyModal');
  toast('Company saved');
  if(typeof renderDashboard==='function') renderDashboard();
}
function downloadScopesMaster(){
  const all=[...WORK_SCOPES,...customScopes];
  let csv='Scope,Mapping\\n';
  all.forEach(s=>{ csv+=`"${s}","${scopeMappings[s]||''}"\\n`; });
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\\ufeff'+csv],{type:'text/csv'}));
  a.download='CENTURY_Scopes.csv'; a.click();
}
function downloadSOWMaster(){
  let csv='Equipment,Type,Activity\\n';
  Object.keys(SOW).forEach(eq=>{
    (SOW[eq].Service||[]).forEach(a=>{ csv+=`"${eq}","Service","${a.replace(/"/g,'""')}"\\n`; });
    (SOW[eq].Testing||[]).forEach(a=>{ csv+=`"${eq}","Testing","${a.replace(/"/g,'""')}"\\n`; });
  });
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\\ufeff'+csv],{type:'text/csv'}));
  a.download='CENTURY_SOW.csv'; a.click();
}





function excelCellDate(v){
  if(v===null||v===undefined||v==='') return '';
  if(Object.prototype.toString.call(v)==='[object Date]' && !isNaN(v)) return v.toISOString().slice(0,10);
  if(typeof v==='number' && v>20000 && v<60000){
    const d=new Date(Math.round((v-25569)*86400*1000));
    return isNaN(d.getTime())?'':d.toISOString().slice(0,10);
  }
  const s=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  // dd/mm/yyyy or dd-mm-yyyy
  const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(m){
    const y=m[3].length===2?('20'+m[3]):m[3];
    return y+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  }
  const t=Date.parse(s);
  if(!isNaN(t)) return new Date(t).toISOString().slice(0,10);
  return '';
}
function normKey(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
}
function rowGet(r, names){
  const keys=Object.keys(r||{});
  const nkeys=keys.map(k=>({k, n:normKey(k)}));
  for(const name of names){
    const want=normKey(name);
    let hit=nkeys.find(x=>x.n===want);
    if(!hit) hit=nkeys.find(x=>x.n.includes(want) || want.includes(x.n));
    if(hit){
      const val=r[hit.k];
      if(val!==null && val!==undefined && String(val).trim()!=='') return val;
    }
  }
  return '';
}
/** Full scan: all sheets, auto-detect header row, return {sheetName, rows}[] */
function parseExcelWorkbook(file, data){
  const results=[];
  if(file.name.toLowerCase().endsWith('.csv')){
    const text=typeof data==='string'?data:new TextDecoder().decode(data);
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    let hi=0;
    for(let i=0;i<Math.min(15,lines.length);i++){
      const low=lines[i].toLowerCase();
      if(low.includes('client')||low.includes('s no')||low.includes('order')){ hi=i; break; }
    }
    const headers=parseCsvLine(lines[hi]);
    const rows=[];
    for(let i=hi+1;i<lines.length;i++){
      const vals=parseCsvLine(lines[i]);
      const o={}; headers.forEach((h,j)=>{ if(h) o[h]=vals[j]||''; });
      rows.push(o);
    }
    results.push({sheet:'CSV', rows});
    return results;
  }
  if(typeof XLSX==='undefined') throw new Error('Excel library not loaded — open app once with internet');
  const wb=XLSX.read(data instanceof ArrayBuffer?new Uint8Array(data):data,{type:'array', cellDates:true, raw:false});
  wb.SheetNames.forEach(sn=>{
    const sheet=wb.Sheets[sn];
    const aoa=XLSX.utils.sheet_to_json(sheet,{header:1, defval:'', raw:false});
    if(!aoa||!aoa.length) return;
    // find header row: has Client or S No or Order
    let hi=-1;
    for(let i=0;i<Math.min(20,aoa.length);i++){
      const cells=(aoa[i]||[]).map(c=>String(c||'').toLowerCase());
      const joined=cells.join('|');
      if((joined.includes('client')||joined.includes('customer')) && (joined.includes('s no')||joined.includes('sno')||joined.includes('sr')||joined.includes('enq')||joined.includes('order')||joined.includes('product')||joined.includes('status'))){
        hi=i; break;
      }
      if(cells.filter(c=>c.length>1).length>=5 && (joined.includes('client')||joined.includes('order no'))){
        hi=i; break;
      }
    }
    if(hi<0){
      // fallback first non-empty row
      for(let i=0;i<Math.min(10,aoa.length);i++){
        if((aoa[i]||[]).some(c=>String(c||'').trim())){ hi=i; break; }
      }
    }
    if(hi<0) return;
    const headers=(aoa[hi]||[]).map(h=>String(h||'').trim());
    const rows=[];
    for(let i=hi+1;i<aoa.length;i++){
      const line=aoa[i]||[];
      if(!line.some(c=>String(c||'').trim())) continue;
      const o={};
      headers.forEach((h,j)=>{ if(h) o[h]=line[j]!==undefined&&line[j]!==null?line[j]:''; });
      rows.push(o);
    }
    results.push({sheet:sn, rows, headers});
  });
  return results;
}
function parseCsvLine(line){
  const cols=line.match(/("([^"]|"")*"|[^,]*)/g)||[];
  return cols.map(c=>c.replace(/^"|"$/g,'').replace(/""/g,'"').trim());
}
function ensureClientFromRow(client, contact, phone, email, address, remarks){
  if(!client||!String(client).trim()) return null;
  if(typeof clientsDB==='undefined') return null;
  const name=String(client).trim();
  let c=clientsDB.find(x=>(x.company||'').toLowerCase()===name.toLowerCase());
  if(!c){
    // next code
    let max=0;
    clientsDB.forEach(x=>{ const m=String(x.code||'').match(/(\d+)$/); if(m) max=Math.max(max,parseInt(m[1],10)); });
    c={
      id:Date.now()+Math.random(),
      code:'CL'+String(max+1).padStart(4,'0'),
      company:name,
      address:address||'',
      city:extractCity(address||'')||'',
      email:email||'',
      gst:'',
      remarks:remarks||'',
      contacts:[]
    };
    clientsDB.push(c);
  }
  if(contact||phone){
    const exists=(c.contacts||[]).some(ct=>(ct.name||'')===(contact||'') && (ct.mobile||'')===(phone||''));
    if(!exists){
      c.contacts=c.contacts||[];
      c.contacts.push({name:contact||'', mobile:phone||'', mobile2:'', email:email||''});
    }
  }
  if(address && !c.address) c.address=address;
  if(email && !c.email) c.email=email;
  if(typeof saveCRMDB==='function') saveCRMDB();
  return c;
}
function persistSaved(){ localStorage.setItem('cs4_saved', JSON.stringify(saved)); }

function importOfferMIS(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file) return;
  toast('Scanning Excel…');
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const packs=parseExcelWorkbook(file, e.target.result);
      if(!packs.length){ toast('No data sheets found'); return; }
      // prefer Live Enq sheet
      packs.sort((a,b)=>{
        const score=s=>/live\s*enq/i.test(s.sheet)?0:/lead/i.test(s.sheet)?2:1;
        return score(a)-score(b);
      });
      let added=0, updated=0, clientsN=0;
      packs.forEach(pack=>{
        // skip pure tender follow-up if no Client-like offers? still try
        pack.rows.forEach(r=>{
          const client=String(rowGet(r,['Client','Customer','Company'])||'').trim();
          const ref=String(rowGet(r,['Enq Ref No','Enq Ref','Ref No','Offer No','Offer Ref','Reference','Tender Ref No'])||'').trim();
          if(!client && !ref) return;
          if(/^s\.?\s*no$/i.test(client)||/^client$/i.test(client)) return;
          if(/total|grand total/i.test(client)) return;

          const enqDate=excelCellDate(rowGet(r,['Date of Enq','Enq Date','Enquiry Date','Published Date']));
          const quoteDate=excelCellDate(rowGet(r,['Date of Quote','Quote Date','Quotation Date']))||enqDate||new Date().toISOString().slice(0,10);
          const status=String(rowGet(r,['Status','Tender Status'])||'').trim();
          const project=String(rowGet(r,['Project','Tender Title','Location'])||'').trim();
          const endClient=String(rowGet(r,['End Client','EndClient'])||'').trim();
          const enqType=String(rowGet(r,['Enq Type','Enquiry Type','Type','Scope'])||'').trim();
          const product=String(rowGet(r,['Product','Product Interested','Item'])||'').trim();
          const amount=parseFloat(String(rowGet(r,['Quotation','Quote Amount','Amount','Price','Value','Estimated Amt'])||'').replace(/[₹,\s]/g,''))||0;
          const contact=String(rowGet(r,['Contact Person','Contact'])||'').trim();
          const phone=String(rowGet(r,['Contact No','Mobile','Phone'])||'').trim();
          const email=String(rowGet(r,['Email id','Email','Email ID'])||'').trim();
          const address=String(rowGet(r,['Address','Site Address'])||'').trim();
          const remarks=String(rowGet(r,['Remarks','Remark','Notes'])||'').trim();
          const sno=String(rowGet(r,['S No','S.No','Sr','Sr No'])||'').trim();

          const cl=ensureClientFromRow(client, contact, phone, email, address, remarks);
          if(cl) clientsN++;

          const finalRef=ref || (sno?('ENQ-'+sno):'') || nextDocRef('offer');
          const existing=saved.find(x=>x.type==='offer' && String(x.ref)===String(finalRef));
          const doc={
            id:existing?existing.id:(Date.now()+Math.random()+added),
            type:'offer', ref:String(finalRef),
            date:quoteDate, enqDate,
            project, subject: product?('Offer — '+product):(project||''),
            client: client||'—', endClient,
            enqType: enqType||'Supply',
            contact, contactPhone:phone, email, address, remarks, status,
            product, amount,
            scopes: enqType?enqType.split(/[+&,/]/).map(s=>s.trim()).filter(Boolean):['Supply'],
            lines: existing&&existing.lines&&existing.lines.length?existing.lines:[],
            taxes:[{name:'GST',pct:18}],
            clientCode: cl?cl.code:'',
            ownerId: typeof currentUserId==='function'?currentUserId():'',
            importedAt: new Date().toISOString(),
            importSheet: pack.sheet
          };
          if(existing){
            const ix=saved.findIndex(x=>x.id===existing.id);
            saved[ix]=Object.assign({}, existing, doc, {lines:existing.lines&&existing.lines.length?existing.lines:doc.lines});
            updated++;
          } else { saved.unshift(doc); added++; }
          const m=String(finalRef).match(/(\d{4,})/);
          if(m){
            const n=parseInt(m[1],10);
            const cur=parseInt(localStorage.getItem('cs9_offer_seq')||'2600',10);
            if(n>cur) localStorage.setItem('cs9_offer_seq', String(n));
          }
        });
      });
      persistSaved();
      if(typeof renderReports==='function') renderReports();
      if(typeof renderCRM==='function') try{ renderCRM('clients'); }catch(e){}
      toast('Excel done: '+added+' offers, '+updated+' updated, clients synced. Saved permanently.');
    }catch(err){
      console.error(err);
      toast('Import failed: '+(err.message||err));
    }
    ev.target.value='';
  };
  if(file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}
function importPOExcel(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file) return;
  toast('Scanning PO Excel…');
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const packs=parseExcelWorkbook(file, e.target.result);
      let added=0, updated=0;
      packs.forEach(pack=>{
        pack.rows.forEach(r=>{
          const ref=String(rowGet(r,['PO No','PO Number','PO Ref','Order No','Ref','Reference'])||'').trim();
          const client=String(rowGet(r,['Client','Vendor','Supplier','Party','Customer'])||'').trim();
          if(!ref && !client) return;
          if(/^s\.?\s*no$/i.test(client)||/^client$/i.test(client)) return;
          ensureClientFromRow(client,
            String(rowGet(r,['Contact Person','Contact'])||''),
            String(rowGet(r,['Contact No','Mobile','Phone'])||''),
            String(rowGet(r,['Email'])||''),
            String(rowGet(r,['Address'])||''), '');
          const finalRef=ref||nextDocRef('po');
          const existing=saved.find(x=>x.type==='po'&&String(x.ref)===String(finalRef));
          const doc={
            id:existing?existing.id:(Date.now()+Math.random()+added),
            type:'po', ref:finalRef,
            date:excelCellDate(rowGet(r,['Date','PO Date','Order Date']))||new Date().toISOString().slice(0,10),
            client:client||'—',
            project:String(rowGet(r,['Project'])||''),
            contact:String(rowGet(r,['Contact Person','Contact'])||''),
            contactPhone:String(rowGet(r,['Contact No','Mobile','Phone'])||''),
            product:String(rowGet(r,['Product','Item','Description'])||''),
            amount:parseFloat(String(rowGet(r,['Amount','Value','Total'])||'').replace(/[₹,\s]/g,''))||0,
            consignee:String(rowGet(r,['Consignee'])||''),
            remarks:String(rowGet(r,['Remarks'])||''),
            scopes:['Supply'], lines:[], taxes:[{name:'GST',pct:18}],
            ownerId:typeof currentUserId==='function'?currentUserId():'',
            importedAt:new Date().toISOString()
          };
          if(existing){ saved[saved.findIndex(x=>x.id===existing.id)]=Object.assign({},existing,doc); updated++; }
          else { saved.unshift(doc); added++; }
        });
      });
      persistSaved();
      if(typeof renderReports==='function') renderReports();
      toast('PO import: '+added+' new, '+updated+' updated — saved');
    }catch(err){ console.error(err); toast('PO import failed: '+(err.message||err)); }
    ev.target.value='';
  };
  if(file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}

init();


/* ===== EMPLOYEES ===== */
let employeesDB = [];

const SEED_EMPLOYEES = [
  {code:'CS0001', name:'Ravi Pratap Singh', mobile:'6389714000', email:'ravi@centurysolution.co.in', desig:'Manager Services', qualification:'Diploma'},
  {code:'CS0002', name:'Sharawan Kumar Verma', mobile:'6389914000', email:'Sharawan@centurysolution.co.in', desig:'Asst. Manager (Sales & Services)', qualification:'Diploma'},
  {code:'CS0003', name:'Ajendra Gaur', mobile:'9450469533', email:'ajgaur111@gmail.com', desig:'Senior Service Engineer', qualification:'Diploma'},
  {code:'CS0004', name:'Kutbuddin', mobile:'7071969906', email:'kutbuddin3012@gmail.com', desig:'Senior Service Engineer', qualification:'ITI'},
  {code:'CS0007', name:'Sunil Dutt Kuldeep', mobile:'9554463074', email:'sunilkuldeep9554@gmail.com', desig:'Senior Service Engineer', qualification:'Diploma'},
  {code:'CS0009', name:'Jawed Alam', mobile:'6389514000', email:'jawed@centurysolution.co.in', desig:'Sales Manager', qualification:'Diploma'},
  {code:'CS0012', name:'Amit Singh', mobile:'9807681132', email:'amitsinghstp32@gmail.com', desig:'Service Engineer', qualification:'ITI'},
  {code:'CS0019', name:'Alok Yadav', mobile:'8299225328', email:'alokyadav20141996@gmail.com', desig:'Senior Service Engineer', qualification:'Diploma'},
  {code:'CS0020', name:'Aniket Singh', mobile:'7905247023', email:'aniketsingh564@gmail.com', desig:'Senior Service Engineer', qualification:'B-Tech'},
  {code:'CS0021', name:'Dheeraj Pandey', mobile:'9696495831', email:'8545dheerajpandey@gmail.com', desig:'Senior Service Engineer', qualification:'B-Tech'},
  {code:'CS0022', name:'Gulam Mustafa', mobile:'9354595322', email:'mustafagulam789@gamil.com', desig:'Service Engineer', qualification:'Diploma'},
  {code:'CS0023', name:'Sandeep Pal', mobile:'9695140652', email:'sandeeppal9750@gmail.com', desig:'Service Engineer', qualification:'ITI'},
  {code:'CS0024', name:'Arun Pal', mobile:'7523929606', email:'arun5252pal@gmail.com', desig:'Service Engineer', qualification:'Diploma'},
  {code:'CS0025', name:'Utkarsh', mobile:'7239086959', email:'utkarshgangwar15@gmail.com', desig:'Service Engineer', qualification:'Diploma'},
  {code:'CS0026', name:'Mohit Kumar Chaurasiya', mobile:'7785019435', email:'Mohitchaurasia94@gmail.com', desig:'Service Engineer', qualification:'ITI'},
  {code:'CS0027', name:'Dharmendra Yadav', mobile:'9956254655', email:'gulluyadav9956@gmail.com', desig:'Service Engineer', qualification:'ITI'},
  {code:'CS0028', name:'Ashish kumar', mobile:'7905625400', email:'kumarashishg73@gmail.com', desig:'Service Engineer', qualification:'Diploma'},
  {code:'', name:'Husain Abbas', mobile:'6390614000', email:'husain@centurysolution.co.in', desig:'Manager Marketing', qualification:'B Tech'}
];
function seedEmployeesIfNeeded(){
  loadEmployees();
  let changed = false;
  SEED_EMPLOYEES.forEach(s=>{
    const key = (s.email||'').toLowerCase();
    const code = (s.code||'').toUpperCase();
    const exists = employeesDB.find(e =>
      (key && (e.email||'').toLowerCase()===key) ||
      (code && (e.code||'').toUpperCase()===code) ||
      ((e.name||'').toLowerCase()===(s.name||'').toLowerCase() && (e.mobile||'')===(s.mobile||''))
    );
    if(exists){
      // fill missing fields only
      if(!exists.email && s.email){ exists.email=s.email; changed=true; }
      if(!exists.mobile && s.mobile){ exists.mobile=s.mobile; changed=true; }
      if(!exists.desig && s.desig){ exists.desig=s.desig; changed=true; }
      if(!exists.qualification && s.qualification){ exists.qualification=s.qualification; changed=true; }
      if(!exists.code && s.code){ exists.code=s.code; changed=true; }
    } else {
      employeesDB.push({
        id: Date.now()+Math.random()+Math.random(),
        code: s.code || '',
        name: s.name,
        desig: s.desig||'',
        dept: 'Services',
        mobile: s.mobile||'',
        mobile2: '',
        email: s.email||'',
        qualification: s.qualification||'',
        doj: '',
        status: 'Active',
        address: '', city: '', pin: '',
        emgName: '', emgMobile: '', blood: '', aadhaar: '',
        remarks: 'Imported from company roster'
      });
      changed = true;
    }
  });
  saveEmployeesDB(); // always persist after seed pass
  try{ if(typeof vaultSnapshot==='function') vaultSnapshot(); }catch(e){}
}



function loadEmployees(){
  try{
    const raw = localStorage.getItem('cs10_employees');
    employeesDB = raw ? JSON.parse(raw) : [];
    if(!Array.isArray(employeesDB)) employeesDB = [];
  }catch(e){ employeesDB = []; }
}
function saveEmployeesDB(){
  if(!Array.isArray(employeesDB)) employeesDB = [];
  const payload = JSON.stringify(employeesDB);
  let ok = false;
  try{
    if(typeof safeSetItem==='function') ok = safeSetItem('cs10_employees', payload);
    else { localStorage.setItem('cs10_employees', payload); ok = true; }
  }catch(e){
    console.error('saveEmployeesDB localStorage', e);
    try{ localStorage.removeItem('cs11_vault_backup'); localStorage.setItem('cs10_employees', payload); ok = true; }catch(e2){}
  }
  // IndexedDB mirror (survives better on some browsers)
  try{ if(typeof idbPutAllEmployees==='function') idbPutAllEmployees(employeesDB); }catch(e){}
  // verify
  try{
    const check = JSON.parse(localStorage.getItem('cs10_employees')||'[]');
    if(!ok || check.length !== employeesDB.length){
      console.warn('Employee save verify mismatch', check.length, employeesDB.length);
    }
  }catch(e){}
  return ok;
}
async function loadEmployeesAsync(){
  loadEmployees();
  if(employeesDB.length) return employeesDB;
  try{
    if(typeof idbGetAllEmployees==='function'){
      const fromIdb = await idbGetAllEmployees();
      if(fromIdb && fromIdb.length){
        employeesDB = fromIdb;
        try{ localStorage.setItem('cs10_employees', JSON.stringify(employeesDB)); }catch(e){}
      }
    }
  }catch(e){}
  return employeesDB;
}

function nextEmpCode(){
  loadEmployees();
  let max = 0;
  employeesDB.forEach(e=>{
    const m = String(e.code||'').match(/CS0*(\d+)/i) || String(e.code||'').match(/CSE-?0*(\d+)/i) || String(e.code||'').match(/(\d+)/);
    if(m) max = Math.max(max, parseInt(m[1],10));
  });
  return 'CS'+String(max+1).padStart(4,'0');
}
function sortEmployeesAlpha(){
  loadEmployees();
  employeesDB.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base'}));
  saveEmployeesDB();
  renderEmployees();
  toast('Sorted A–Z by name');
}


function openEmployeeForm(id){
  loadEmployees();
  const row=id?employeesDB.find(x=>String(x.id)===String(id)):null;
  document.getElementById('empModalTitle').textContent=row?'Edit Employee':'Add Employee';
  document.getElementById('empId').value=row?row.id:'';
  const set=(i,v)=>{ const el=document.getElementById(i); if(el) el.value=v!=null?v:''; };
  set('empCode', row?row.code:nextEmpCode());
  set('empName', row?row.name:'');
  set('empDesig', row?row.desig:'');
  set('empDept', row?row.dept:'');
  set('empMobile', row?row.mobile:'');
  set('empMobile2', row?row.mobile2:'');
  set('empEmail', row?row.email:'');
  set('empDoj', row?row.doj:'');
  set('empStatus', row?row.status:'Active');
  set('empAddress', row?row.address:'');
  set('empCity', row?row.city:'');
  set('empPin', row?row.pin:'');
  set('empEmgName', row?row.emgName:'');
  set('empEmgMobile', row?row.emgMobile:'');
  set('empBlood', row?row.blood:'');
  set('empAadhaar', row?row.aadhaar:'');
  set('empRemarks', row?row.remarks:'');
  set('empQual', row?row.qualification:'');
  document.getElementById('empModal').classList.add('show');
}
function closeEmployeeForm(){ document.getElementById('empModal').classList.remove('show'); }

function saveEmployee(){
  const name=(document.getElementById('empName').value||'').trim();
  if(!name){ toast('Name required'); return; }
  let code=(document.getElementById('empCode').value||'').trim()||nextEmpCode();
  const id=document.getElementById('empId').value||(Date.now()+Math.random());
  const row={
    id, code, name,
    desig:document.getElementById('empDesig').value||'',
    dept:document.getElementById('empDept').value||'',
    mobile:document.getElementById('empMobile').value||'',
    mobile2:document.getElementById('empMobile2').value||'',
    email:document.getElementById('empEmail').value||'',
    doj:document.getElementById('empDoj').value||'',
    status:document.getElementById('empStatus').value||'Active',
    address:document.getElementById('empAddress').value||'',
    city:document.getElementById('empCity').value||'',
    pin:document.getElementById('empPin').value||'',
    emgName:document.getElementById('empEmgName').value||'',
    emgMobile:document.getElementById('empEmgMobile').value||'',
    blood:document.getElementById('empBlood').value||'',
    aadhaar:document.getElementById('empAadhaar').value||'',
    remarks:document.getElementById('empRemarks').value||'',
    qualification:(document.getElementById('empQual')||{}).value||''
  };
  loadEmployees();
  const ix=employeesDB.findIndex(x=>String(x.id)===String(id));
  if(ix>=0) employeesDB[ix]=row; else employeesDB.unshift(row);
  saveEmployeesDB();
  try{ if(typeof vaultSnapshot==='function') vaultSnapshot(); }catch(e){}
  closeEmployeeForm();
  renderEmployees();
  toast('Employee saved — stored permanently');
}

function renderEmployees(){
  loadEmployees();
  try{ seedEmployeesIfNeeded(); loadEmployees(); }catch(e){}
  // If still empty, try IndexedDB recovery
  if(!employeesDB.length && typeof idbGetAllEmployees==='function'){
    idbGetAllEmployees().then(function(list){
      if(list && list.length){
        employeesDB = list;
        try{ localStorage.setItem('cs10_employees', JSON.stringify(list)); }catch(e){}
        renderEmployees();
      }
    });
  }
  const st = document.getElementById('empSaveStatus');
  if(st){
    let stored = 0;
    try{ stored = JSON.parse(localStorage.getItem('cs10_employees')||'[]').length; }catch(e){}
    st.innerHTML = '<b style="color:#0f766e">'+employeesDB.length+' employees in memory</b> · <b>'+stored+' saved in browser</b> · data remains until you clear browser storage';
  }
  const q=((document.getElementById('empQ')||{}).value||'').toLowerCase();
  const dept=((document.getElementById('empDeptFilter')||{}).value||'');
  const body=document.getElementById('empListBody');
  const empty=document.getElementById('empEmpty');
  if(!body) return;
  // fill dept filter
  const depts=[...new Set(employeesDB.map(e=>e.dept).filter(Boolean))].sort();
  const sel=document.getElementById('empDeptFilter');
  if(sel){
    const cur=sel.value;
    sel.innerHTML='<option value="">All departments</option>'+depts.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');
    sel.value=cur;
  }
  let list=employeesDB.slice();
  if(dept) list=list.filter(e=>e.dept===dept);
  if(q) list=list.filter(e=>(e.code+e.name+e.dept+e.desig+e.mobile+e.email).toLowerCase().includes(q));
  if(!list.length){ body.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  body.innerHTML=list.map(e=>`<div class="crm-row">
    <div class="crm-code">${esc(e.code)}</div>
    <div class="crm-name">${esc(e.name)}<div style="font-size:.65rem;color:var(--muted)">${esc(e.desig||'')}</div></div>
    <div class="crm-city">${esc(e.dept||'—')}</div>
    <div class="crm-ct">${esc(e.mobile||'')} ${e.email?'· '+esc(e.email):''}</div>
    <div class="crm-acts">
      <button class="btn-xs" onclick="openEmployeeForm('${e.id}')">Edit</button> <button class="btn-xs" onclick="openEmployee360('${e.id}')">360°</button>
      <button class="del-btn" style="width:auto;padding:2px 6px;height:auto" onclick="deleteEmployee('${e.id}')">×</button>
    </div>
  </div>`).join('');
}
function deleteEmployee(id){
  if(!confirm('Delete this employee?')) return;
  loadEmployees();
  employeesDB=employeesDB.filter(x=>String(x.id)!==String(id));
  saveEmployeesDB();
  renderEmployees();
}
function exportEmployees(){
  loadEmployees();
  if(!employeesDB.length){ toast('No employees'); return; }
  const headers=['Employee Code','Full Name','Designation','Department','Mobile 1','Mobile 2','Email','Date of Joining','Status','Address','City','PIN','Emergency Contact','Emergency Mobile','Blood Group','Aadhaar','Remarks'];
  const rows=employeesDB.map(e=>[e.code,e.name,e.desig,e.dept,e.mobile,e.mobile2,e.email,e.doj,e.status,e.address,e.city,e.pin,e.emgName,e.emgMobile,e.blood,e.aadhaar,e.remarks]);
  if(typeof downloadColorExcel==='function') downloadColorExcel('CENTURY_Employees.xls','Employees',headers,rows);
  else toast('Export helper missing');
}
function importEmployees(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file) return;
  const name=(file.name||'').toLowerCase();
  const finish = function(rows){
    try{
      loadEmployees();
      let added=0, updated=0;
      const norm = s => String(s||'').trim();
      const get = (r, ...ns) => {
        const keys = Object.keys(r||{});
        for(const want of ns){
          const w = want.toLowerCase().replace(/[\s_\-]/g,'');
          const k = keys.find(x => {
            const kx = String(x).toLowerCase().replace(/[\s_\-]/g,'');
            return kx===w || kx.includes(w) || w.includes(kx);
          });
          if(k && norm(r[k])) return norm(r[k]);
        }
        return '';
      };
      rows.forEach((r, idx)=>{
        const empName = get(r, 'Full Name', 'Name', 'Employee Name', 'Emp Name');
        if(!empName || /^(name|full name|employee name|sr\.? ?no|s\.?no)$/i.test(empName)) return;
        if(/^\d+$/.test(empName) && empName.length < 3) return; // skip pure serial
        let code = get(r, 'Employee Code', 'Emp Code', 'Code', 'Employee', 'Emp No', 'Emp ID');
        // if "Employee" column was actually name-like, ignore
        if(code && code.toLowerCase()===empName.toLowerCase()) code = '';
        // skip if code looks like a person name (has space and no digit)
        if(code && /\s/.test(code) && !/\d/.test(code)) code = '';
        const mobile = get(r, 'Contact No', 'Contact', 'Mobile 1', 'Mobile', 'Phone', 'Phone No', 'Mobile No');
        const email = get(r, 'E-Mail', 'E Mail', 'Email', 'Mail');
        const desig = get(r, 'Designation', 'Desig', 'Position', 'Title');
        const qual = get(r, 'Qualification', 'Qual', 'Education');
        const dept = get(r, 'Department', 'Dept');
        // find existing by code or email or name+mobile
        let existing = null;
        if(code) existing = employeesDB.find(x => String(x.code||'').toUpperCase()===code.toUpperCase());
        if(!existing && email) existing = employeesDB.find(x => String(x.email||'').toLowerCase()===email.toLowerCase());
        if(!existing) existing = employeesDB.find(x => String(x.name||'').toLowerCase()===empName.toLowerCase() && (!mobile || String(x.mobile||'')===mobile));
        if(existing){
          if(code && !existing.code) existing.code = code;
          if(mobile) existing.mobile = mobile;
          if(email) existing.email = email;
          if(desig) existing.desig = desig;
          if(qual) existing.qualification = qual;
          if(dept) existing.dept = dept;
          updated++;
        } else {
          if(!code) code = nextEmpCode();
          employeesDB.unshift({
            id: Date.now()+Math.random()+idx,
            code, name: empName,
            desig, dept: dept||'Services',
            mobile, mobile2: get(r,'Mobile 2'),
            email, qualification: qual,
            doj: get(r,'Date of Joining','DOJ','Joining'),
            status: get(r,'Status')||'Active',
            address: get(r,'Address'), city: get(r,'City'),
            pin: get(r,'PIN','Pincode','Pin'),
            emgName: get(r,'Emergency Contact'), emgMobile: get(r,'Emergency Mobile'),
            blood: get(r,'Blood'), aadhaar: get(r,'Aadhaar'),
            remarks: get(r,'Remarks')||'Imported'
          });
          added++;
        }
      });
      saveEmployeesDB();
      // verify write
      try{
        const check = JSON.parse(localStorage.getItem('cs10_employees')||'[]');
        if(check.length < employeesDB.length){
          localStorage.setItem('cs10_employees', JSON.stringify(employeesDB));
        }
      }catch(e){}
      try{ if(typeof vaultSnapshot==='function') vaultSnapshot(); }catch(e){}
      renderEmployees();
      toast((added+updated) ? (added+' added, '+updated+' updated — saved permanently') : 'No valid rows found. Check column headers: Name, Employee, Contact No, E-Mail…');
    }catch(err){ console.error(err); toast('Import failed: '+(err.message||err)); }
  };

  const reader = new FileReader();
  if(name.endsWith('.csv') || name.endsWith('.txt')){
    reader.onload = function(e){
      const text = e.target.result||'';
      const lines = text.replace(/\r/g,'').split('\n').filter(l=>l.trim());
      if(lines.length<2){ toast('Empty CSV'); return; }
      // detect delimiter
      const delim = (lines[0].split('\t').length > lines[0].split(',').length) ? '\t' : ',';
      const headers = lines[0].split(delim).map(h=>h.replace(/^"|"$/g,'').trim());
      const rows = lines.slice(1).map(line=>{
        const cols = line.split(delim).map(c=>c.replace(/^"|"$/g,'').trim());
        const o={}; headers.forEach((h,i)=>o[h]=cols[i]||''); return o;
      });
      finish(rows);
    };
    reader.readAsText(file);
  } else {
    reader.onload = function(e){
      try{
        if(typeof XLSX==='undefined'){
          toast('Excel library not loaded. Use CSV, or open with internet once so SheetJS can load.');
          return;
        }
        const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''});
        finish(rows);
      }catch(err){ console.error(err); toast('Excel read failed — try Save As CSV and import'); }
    };
    reader.readAsArrayBuffer(file);
  }
  ev.target.value='';
}

function reseedCompanyEmployees(){
  try{
    seedEmployeesIfNeeded();
    saveEmployeesDB();
    loadEmployees();
    renderEmployees();
    const n = employeesDB.length;
    toast('Roster saved: '+n+' employees. Close and reopen to verify.');
  }catch(e){ toast('Seed failed'); console.error(e); }
}


function toggleNavGroup(btn){
  const g=btn.closest('.nav-group');
  if(!g) return;
  g.classList.toggle('open');
}
function openCreateDoc(type){
  showView('create');
  if(typeof setDocType==='function') setDocType(type||'offer');
}


function enhanceDescPaste(e, idx){
  const html=(e.clipboardData||window.clipboardData).getData('text/html');
  const text=(e.clipboardData||window.clipboardData).getData('text/plain');
  if(html && /<table/i.test(html)){
    e.preventDefault();
    // Convert simple table to tab-separated text for textarea
    const tmp=document.createElement('div'); tmp.innerHTML=html;
    const rows=[...tmp.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('td,th')].map(c=>c.innerText.trim()).join('\t'));
    const ins=rows.join('\n');
    const ta=e.target;
    const start=ta.selectionStart, end=ta.selectionEnd;
    const v=ta.value;
    ta.value=v.slice(0,start)+ins+v.slice(end);
    if(typeof lines!=='undefined' && lines[idx]) lines[idx].desc=ta.value;
    ta.dispatchEvent(new Event('input'));
  }
}


function openEmployee360(id){
  loadEmployees();
  const e = employeesDB.find(x=>String(x.id)===String(id));
  if(!e) return;
  const eng = (typeof spEngineers==='function'?spEngineers():[]).find(x=>String(x.empId)===String(e.id));
  const projs = eng && typeof spProjects==='function' ? spProjects().filter(p=>String(p.engineerId)===String(eng.id)) : [];
  const body = document.getElementById('emp360Body');
  if(!body){ toast(e.name+' · '+(e.desig||'')+' · '+(e.mobile||'')); return; }
  body.innerHTML = `
    <div class="c360-kpis" style="padding:0 0 10px">
      <div class="c360-kpi"><div class="k-lab">Code</div><div class="k-val" style="font-size:.9rem">${esc(e.code)}</div></div>
      <div class="c360-kpi"><div class="k-lab">Status</div><div class="k-val" style="font-size:.9rem">${esc(e.status||'Active')}</div></div>
      <div class="c360-kpi"><div class="k-lab">Projects</div><div class="k-val">${projs.length}</div></div>
      <div class="c360-kpi"><div class="k-lab">Dept</div><div class="k-val" style="font-size:.8rem">${esc(e.dept||'—')}</div></div>
    </div>
    <div class="c360-grid">
      <div><label>Name</label><div class="c360-v">${esc(e.name)}</div></div>
      <div><label>Designation</label><div class="c360-v">${esc(e.desig)}</div></div>
      <div><label>Mobile</label><div class="c360-v">${esc(e.mobile)} ${esc(e.mobile2)}</div></div>
      <div><label>Email</label><div class="c360-v">${esc(e.email)}</div></div>
      <div><label>Qualification</label><div class="c360-v">${esc(e.qualification)}</div></div>
      <div><label>DOJ</label><div class="c360-v">${esc(e.doj)}</div></div>
      <div class="full"><label>Address</label><div class="c360-v">${esc(e.address)} ${esc(e.city)} ${esc(e.pin)}</div></div>
    </div>
    ${projs.length?`<div class="block-title" style="margin-top:10px">Linked Site Projects</div>
      ${projs.map(p=>`<div class="c360-row"><div>${esc(p.projectId)} · ${esc(p.name)} · ${calcProjectProgress?calcProjectProgress(p.id):p.overallProgress||0}%</div>
        <button class="btn-xs" onclick="closeEmp360();openProjectHub('${p.id}')">Open</button></div>`).join('')}`:''}
    <div style="margin-top:10px;display:flex;gap:6px">
      <button class="btn-sm" onclick="closeEmp360();openEmployeeForm('${e.id}')">Edit</button> <button class="btn-xs" onclick="openEmployee360('${e.id}')">360°</button>
      ${eng?`<button class="btn-sm" onclick="closeEmp360();openEngineerProjects('${eng.id}')">Site Projects</button>`:''}
    </div>`;
  document.getElementById('emp360Modal').classList.add('show');
}
function closeEmp360(){ const m=document.getElementById('emp360Modal'); if(m) m.classList.remove('show'); }

document.addEventListener('DOMContentLoaded',function(){ try{ seedEmployeesIfNeeded(); }catch(e){} });
