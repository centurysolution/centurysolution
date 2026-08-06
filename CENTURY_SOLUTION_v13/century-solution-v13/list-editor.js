
/* ===== Editable category lists (add / remove) ===== */
const LIST_DEFAULTS = {
  workScopes: ['Supply','Service','Inspection','Testing','SITC','Maintenance','AMC'],
  designations: ['Manager Services','Asst. Manager (Sales & Services)','Senior Service Engineer','Service Engineer','Sales Manager','Manager Marketing','Site Engineer','Supervisor','Technician','Helper','Safety Officer'],
  departments: ['Services','Sales','Marketing','Projects','Accounts','HR','Stores','Admin'],
  qualifications: ['ITI','Diploma','B-Tech','B Tech','BE','M-Tech','Graduate','Other'],
  projectCategories: ['Supply Only','SITC','Testing & Commissioning','Preventive Maintenance','Breakdown Maintenance','AMC','Overhauling','Retrofitting','Upgradation','Relay Testing','Transformer Testing','GIS Maintenance','AIS Maintenance','RMU Work','CSS Work','Panel Work','Busduct Work','Other'],
  equipTypes: ['Transformer','GIS','AIS','RMU','VCB','ACB','MCC','PCC','LT Panel','HT Panel','CSS','Busduct','Other'],
  scopeOpts: ['Dismantling','Installation','Testing','Commissioning','Overhauling','Repair','Painting','Relay Setting','Cable Termination','Busbar Work','Earthing','SF6 Gas Handling','Vacuuming','Oil Filtration','Jointing','Replacement','Cleaning'],
  workTypes: ['Installation','Testing','Cable Laying','Commissioning','Overhauling','Breakdown','Inspection','Cleaning','Repair','Replacement','Others'],
  priorities: ['High','Medium','Low'],
  expenseTypes: ['Fuel','Hotel','Food','Travel','Local Transport','Labour','Crane','Vehicle','Miscellaneous']
};
const LIST_KEY = 'cs11_custom_lists';

function getList(name){
  let custom = {};
  try{ custom = JSON.parse(localStorage.getItem(LIST_KEY)||'{}'); }catch(e){}
  const base = LIST_DEFAULTS[name] ? LIST_DEFAULTS[name].slice() : [];
  const extra = custom[name] || [];
  const removed = custom['_rm_'+name] || [];
  let all = base.concat(extra).filter(x => removed.indexOf(x)<0);
  // unique
  return [...new Set(all.map(String))];
}
function addToList(name, value){
  value = (value||'').trim();
  if(!value) return;
  let custom = {};
  try{ custom = JSON.parse(localStorage.getItem(LIST_KEY)||'{}'); }catch(e){}
  if(!custom[name]) custom[name]=[];
  if(custom[name].indexOf(value)<0) custom[name].push(value);
  // if was removed, un-remove
  if(custom['_rm_'+name]) custom['_rm_'+name] = custom['_rm_'+name].filter(x=>x!==value);
  localStorage.setItem(LIST_KEY, JSON.stringify(custom));
}
function removeFromList(name, value){
  let custom = {};
  try{ custom = JSON.parse(localStorage.getItem(LIST_KEY)||'{}'); }catch(e){}
  if(custom[name]) custom[name] = custom[name].filter(x=>x!==value);
  if(!custom['_rm_'+name]) custom['_rm_'+name]=[];
  if(LIST_DEFAULTS[name] && LIST_DEFAULTS[name].indexOf(value)>=0 && custom['_rm_'+name].indexOf(value)<0)
    custom['_rm_'+name].push(value);
  localStorage.setItem(LIST_KEY, JSON.stringify(custom));
}
function openListEditor(name, title){
  const items = getList(name);
  const body = document.getElementById('listEditBody');
  document.getElementById('listEditTitle').textContent = title || ('Edit: '+name);
  document.getElementById('listEditName').value = name;
  body.innerHTML = items.map(it=>`
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:.8rem">
      <span style="flex:1">${it.replace(/</g,'&lt;')}</span>
      <button type="button" class="del-btn" style="width:24px;height:24px" onclick="removeFromList('${name}', this.previousElementSibling.textContent); openListEditor('${name}', document.getElementById('listEditTitle').textContent)">×</button>
    </div>`).join('') || '<p class="empty-msg">Empty list</p>';
  document.getElementById('listEditNew').value = '';
  document.getElementById('listEditModal').classList.add('show');
}
function closeListEditor(){ document.getElementById('listEditModal').classList.remove('show'); }
function confirmAddListItem(){
  const name = document.getElementById('listEditName').value;
  const val = document.getElementById('listEditNew').value;
  addToList(name, val);
  openListEditor(name, document.getElementById('listEditTitle').textContent);
  try{ refreshMasterDatalists(); }catch(e){}
  try{ toast('Added'); }catch(e){}
}
function refreshMasterDatalists(){
  const map = {dlDesig:'designations', dlQual:'qualifications', dlDept:'departments', empDeptList:'departments'};
  Object.keys(map).forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = getList(map[id]).map(v=>'<option value="'+v.replace(/"/g,'&quot;')+'">').join('');
  });
  // Project category select if open
  const cat = document.getElementById('spPfCategory');
  if(cat){
    const cur = cat.value;
    cat.innerHTML = getList('projectCategories').map(c=>'<option '+(c===cur?'selected':'')+'>'+c+'</option>').join('');
  }
}

document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){ try{ refreshMasterDatalists(); }catch(e){} }, 200);
});
