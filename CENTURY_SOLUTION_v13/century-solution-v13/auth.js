/* ===== AUTH v10: Login / Signup / Roles / Idle / Session ===== */
const UNIVERSAL_ADMIN = {
  id: 'husain@centurysolution.co.in',
  password: 'Husain@122050',
  name: 'Husain Abbas',
  desig: 'Manager Marketing',
  role: 'admin'
};
const SECURITY_QUESTIONS = [
  'What is your favourite city?',
  'What is your first school name?',
  'What is your pet name?',
  "What is your mother's maiden name?",
  'In which city were you born?'
];
const IDLE_MS = 30 * 60 * 1000; // 30 minutes
const SS_KEY = 'cs10_tab_alive';
const ACT_KEY = 'cs10_last_activity';

function getUsers(){
  try{ return JSON.parse(localStorage.getItem('cs9_users')||'[]'); }catch(e){ return []; }
}
function saveUsers(list){ localStorage.setItem('cs9_users', JSON.stringify(list)); }

function getSession(){
  try{ return JSON.parse(localStorage.getItem('cs9_session')||'null'); }catch(e){ return null; }
}
function setSession(s){
  if(s){
    localStorage.setItem('cs9_session', JSON.stringify(s));
    try{ sessionStorage.setItem(SS_KEY, '1'); }catch(e){}
    touchActivity();
  } else {
    localStorage.removeItem('cs9_session');
    localStorage.removeItem(ACT_KEY);
    try{ sessionStorage.removeItem(SS_KEY); }catch(e){}
  }
}
function isAdmin(){
  const s=getSession();
  return !!(s && (s.role==='admin' || (s.id||'').toLowerCase()===UNIVERSAL_ADMIN.id.toLowerCase()));
}
function isSuperAdmin(){
  const s=getSession();
  return !!(s && (s.id||'').toLowerCase()===UNIVERSAL_ADMIN.id.toLowerCase());
}
function getDefaultAdminQuota(){
  try{ return parseInt(localStorage.getItem('cs10_default_admin_quota')||'5',10); }catch(e){ return 5; }
}
function saveDefaultAdminQuota(){
  if(!isSuperAdmin()){ authToast('Super Admin only'); return; }
  const v=parseInt((document.getElementById('defaultAdminQuota')||{}).value||'5',10);
  localStorage.setItem('cs10_default_admin_quota', String(isNaN(v)?5:Math.max(0,v)));
  authToast('Default admin quota saved');
  renderAdminQuotaList();
}
function countUsersCreatedBy(adminId){
  return getUsers().filter(u=>(u.createdBy||'').toLowerCase()===(adminId||'').toLowerCase()).length;
}

function currentUserId(){
  const s=getSession();
  return s?s.id:'';
}
function touchActivity(){
  try{ localStorage.setItem(ACT_KEY, String(Date.now())); }catch(e){}
}
function getLastActivity(){
  try{ return parseInt(localStorage.getItem(ACT_KEY)||'0',10)||0; }catch(e){ return 0; }
}

function showLoginError(msg){
  const el=document.getElementById('loginError');
  if(el){
    el.textContent=msg||'';
    el.style.display=msg?'block':'none';
  }
  if(msg) authToast(msg);
}
function clearLoginError(){ showLoginError(''); }

function requireAuth(){
  const s=getSession();
  if(s && s.id){
    // Idle check
    const last=getLastActivity();
    if(last && (Date.now()-last > IDLE_MS)){
      setSession(null);
      showLogin('login');
      showLoginError('Session expired (30 min idle). Please login again.');
      return false;
    }
    // Browser fully closed: sessionStorage cleared; tab-only close then new tab
    // also loses sessionStorage. Use: if session exists but no tab marker AND idle was recent,
    // treat as same-day restore within idle window — user asked tab close should restore.
    // We restore as long as within idle window.
    try{ sessionStorage.setItem(SS_KEY, '1'); }catch(e){}
    touchActivity();
    hideLogin();
    applySessionToUI(s);
    startIdleWatcher();
    return true;
  }
  showLogin('login');
  return false;
}

function showLogin(panel){
  stopIdleWatcher();
  const gate=document.getElementById('loginGate');
  if(gate) gate.style.display='flex';
  const app=document.getElementById('app');
  if(app) app.style.display='none';
  ['loginPanel','signupPanel','forgotPanel','resetPanel'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='none';
  });
  const p=document.getElementById((panel||'login')+'Panel')||document.getElementById('loginPanel');
  if(p) p.style.display='block';
  clearLoginError();
  const sq=document.getElementById('suQuestion');
  if(sq && !sq.options.length){
    SECURITY_QUESTIONS.forEach(q=>{ const o=document.createElement('option'); o.value=q; o.textContent=q; sq.appendChild(o); });
  }
}
function hideLogin(){
  const gate=document.getElementById('loginGate');
  if(gate) gate.style.display='none';
  const app=document.getElementById('app');
  if(app) app.style.display='flex';
  clearLoginError();
}
function applySessionToUI(s){
  if(!s) return;
  const side=document.getElementById('sidebarSig');
  if(side) side.textContent=s.name||s.id||'—';
  const role=document.querySelector('.sig-role');
  if(role) role.textContent=s.desig||(s.role==='admin'?'Administrator':'User');
  document.querySelectorAll('[data-admin-only]').forEach(el=>{
    el.style.display=isAdmin()?'':'none';
  });
  const um=document.getElementById('userMgmtBlock');
  if(um) um.style.display=isAdmin()?'block':'none';
  const lim=document.getElementById('userLimitedBlock');
  if(lim) lim.style.display=isAdmin()?'none':'block';
  const sap=document.getElementById('superAdminPanel');
  if(sap) sap.style.display=isSuperAdmin()?'block':'none';
  const qw=document.getElementById('admQuotaWrap');
  if(qw) qw.style.display=isSuperAdmin()?'block':'none';
  const daq=document.getElementById('defaultAdminQuota');
  if(daq && isSuperAdmin()) daq.value=String(getDefaultAdminQuota());
  const sn=document.getElementById('sigName');
  const sd=document.getElementById('sigDesig');
  if(sn && !sn.value) sn.value=s.name||'';
  if(sd && !sd.value) sd.value=s.desig||'';
  if(typeof renderUserList==='function' && isAdmin()) renderUserList();
  if(typeof renderAdminQuotaList==='function' && isSuperAdmin()) renderAdminQuotaList();
  if(typeof renderDashboard==='function') try{ renderDashboard(); }catch(e){}
}

function completeUserLogin(u){
  if(u.disabled){
    showLoginError('Account is disabled. Please contact Admin.');
    return;
  }
  setSession({id:u.id, name:u.name||u.id, desig:u.desig||'User', role:u.role||'user', siteWorkerId:u.siteWorkerId||'', siteAccess:!!u.siteAccess, reportsToId:u.reportsToId||'', reportsToName:u.reportsToName||''});
  try{
    localStorage.setItem('cs7_user', JSON.stringify({name:u.name||'', desig:u.desig||'User', mobile:u.mobile||'', mobile2:u.mobile2||'', email:u.email||u.id}));
  }catch(e){}
  hideLogin(); applySessionToUI(getSession()); startIdleWatcher();
  if(typeof showView==='function') showView('dashboard');
  authToast('Welcome, '+(u.name||u.id)+(u.role==='admin'?' (Admin)':''));
  // Background: pull full data if cloud ready
  try{
    if(typeof cloudPullAll==='function' && typeof isCloudConfigured==='function' && isCloudConfigured()){
      cloudPullAll().catch(function(){});
    }
  }catch(e){}
}

function tryLocalUserLogin(id, pass){
  const users=getUsers();
  const u=users.find(x=>(x.id||'').toLowerCase()===id.toLowerCase());
  if(u && u.password===pass){ completeUserLogin(u); return true; }
  return false;
}

async function doLogin(){
  clearLoginError();
  const id=(document.getElementById('loginId').value||'').trim();
  const pass=document.getElementById('loginPass').value||'';
  if(!id||!pass){
    showLoginError('Please enter both User ID and Password.');
    return;
  }

  // Universal admin always works offline/online
  if(id.toLowerCase()===UNIVERSAL_ADMIN.id.toLowerCase() && pass===UNIVERSAL_ADMIN.password){
    setSession({id:UNIVERSAL_ADMIN.id, name:UNIVERSAL_ADMIN.name, desig:UNIVERSAL_ADMIN.desig, role:'admin'});
    try{
      localStorage.setItem('cs7_user', JSON.stringify({name:UNIVERSAL_ADMIN.name, desig:UNIVERSAL_ADMIN.desig, mobile:'', mobile2:'', email:UNIVERSAL_ADMIN.id}));
    }catch(e){}
    hideLogin(); applySessionToUI(getSession()); startIdleWatcher();
    if(typeof showView==='function') showView('dashboard');
    authToast('Welcome, Admin');
    try{
      if(typeof cloudPullAll==='function' && typeof isCloudConfigured==='function' && isCloudConfigured()){
        cloudPullAll().then(function(){ if(typeof renderDashboard==='function') renderDashboard(); }).catch(function(){});
      }
    }catch(e){}
    return;
  }

  // 1) Local users first
  if(tryLocalUserLogin(id, pass)) return;

  // 2) New device: pull users from shared cloud DB then retry
  if(typeof isCloudConfigured==='function' && isCloudConfigured() && typeof cloudPullUsers==='function'){
    showLoginError('Checking shared database…');
    try{
      await cloudPullUsers();
      if(tryLocalUserLogin(id, pass)) return;
      // full pull once more if only users missing other context
      if(typeof cloudPullAll==='function'){
        await cloudPullAll();
        if(tryLocalUserLogin(id, pass)) return;
      }
    }catch(e){
      console.error(e);
      showLoginError('Cloud check failed. Admin must Push users and set URL/key in config.js. '+(e.message||''));
      return;
    }
  }

  showLoginError('Incorrect User ID or Password. On a new device, ask Admin to Push users and set Supabase keys in config.js.');
}

function doSignup(){
  clearLoginError();
  const id=(document.getElementById('suId').value||'').trim();
  const pass=document.getElementById('suPass').value||'';
  const pass2=document.getElementById('suPass2').value||'';
  const name=(document.getElementById('suName').value||'').trim();
  const q=document.getElementById('suQuestion').value;
  const ans=(document.getElementById('suAnswer').value||'').trim().toLowerCase();
  // Public signup always creates normal user (admin only via Settings)
  const role='user';
  if(!id||!pass||!name||!ans){ authToast('Fill all required fields'); return; }
  if(pass.length<6){ authToast('Password min 6 characters'); return; }
  if(pass!==pass2){ authToast('Passwords do not match'); return; }
  if(id.toLowerCase()===UNIVERSAL_ADMIN.id.toLowerCase()){ authToast('This ID is reserved'); return; }
  const users=getUsers();
  if(users.find(x=>(x.id||'').toLowerCase()===id.toLowerCase())){ authToast('User ID already exists'); return; }
  users.push({id, password:pass, name, desig:(document.getElementById('suDesig').value||'User').trim(), question:q, answer:ans, role:role, createdAt:new Date().toISOString()});
  saveUsers(users);
  authToast('Account created — please login');
  showLogin('login');
  document.getElementById('loginId').value=id;
}

function startForgot(){
  const id=(document.getElementById('fpId').value||'').trim();
  if(!id){ authToast('Enter User ID'); return; }
  if(id.toLowerCase()===UNIVERSAL_ADMIN.id.toLowerCase()){ authToast('Contact system owner for admin password'); return; }
  const u=getUsers().find(x=>(x.id||'').toLowerCase()===id.toLowerCase());
  if(!u){ authToast('User not found'); return; }
  window._fpUser=u;
  document.getElementById('fpQLabel').textContent=u.question||'Security question';
  showLogin('reset');
}
function doResetPassword(){
  const ans=(document.getElementById('fpAnswer').value||'').trim().toLowerCase();
  const pass=document.getElementById('fpNewPass').value||'';
  const pass2=document.getElementById('fpNewPass2').value||'';
  const u=window._fpUser;
  if(!u){ showLogin('forgot'); return; }
  if(ans!==(u.answer||'').toLowerCase()){ authToast('Wrong answer'); return; }
  if(pass.length<6){ authToast('Password min 6 characters'); return; }
  if(pass!==pass2){ authToast('Passwords do not match'); return; }
  const users=getUsers();
  const ix=users.findIndex(x=>(x.id||'').toLowerCase()===(u.id||'').toLowerCase());
  if(ix>=0){ users[ix].password=pass; saveUsers(users); }
  authToast('Password updated — login now');
  showLogin('login');
}

function doLogout(){
  setSession(null);
  stopIdleWatcher();
  showLogin('login');
  authToast('Logged out');
}

function changeOwnPassword(){
  const cur=document.getElementById('chgCurPass').value||'';
  const n1=document.getElementById('chgNewPass').value||'';
  const n2=document.getElementById('chgNewPass2').value||'';
  const s=getSession();
  if(!s) return;
  if(n1.length<6){ authToast('Min 6 characters'); return; }
  if(n1!==n2){ authToast('Passwords do not match'); return; }
  if((s.id||'').toLowerCase()===UNIVERSAL_ADMIN.id.toLowerCase() && s.role==='admin' && !getUsers().find(x=>(x.id||'').toLowerCase()===s.id.toLowerCase())){
    authToast('Universal admin password is fixed in this version');
    return;
  }
  const users=getUsers();
  const ix=users.findIndex(x=>(x.id||'').toLowerCase()===(s.id||'').toLowerCase());
  if(ix<0){ authToast('User not found in directory'); return; }
  if(users[ix].password!==cur){ authToast('Current password wrong'); return; }
  users[ix].password=n1;
  saveUsers(users);
  authToast('Password changed');
  document.getElementById('chgCurPass').value='';
  document.getElementById('chgNewPass').value='';
  document.getElementById('chgNewPass2').value='';
}



function openUserEmpPicker(){
  try{ if(typeof loadEmployees==='function') loadEmployees(); }catch(e){}
  try{ if(typeof seedEmployeesIfNeeded==='function') seedEmployeesIfNeeded(); }catch(e){}
  try{ if(typeof loadEmployees==='function') loadEmployees(); }catch(e){}
  let emps = (typeof employeesDB!=='undefined' && Array.isArray(employeesDB)) ? employeesDB.slice() : [];
  if(!emps.length){
    try{ seedEmployeesIfNeeded(); loadEmployees(); emps = employeesDB.slice(); }catch(e){}
  }
  emps.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const body = document.getElementById('userEmpPickBody');
  if(!body){ toast('Picker not ready'); return; }
  if(!emps.length){ body.innerHTML='<p class="empty-msg">No employees. Add in Employees first.</p>'; }
  else {
    body.innerHTML = emps.map(e=>`
      <div class="c360-row" style="cursor:pointer" onclick="selectEmpForUser('${e.id}')">
        <div>
          <b>${(e.code||'')}</b> ${(e.name||'').replace(/</g,'&lt;')}
          <div style="font-size:.7rem;color:var(--muted)">${(e.desig||'')} · ${(e.mobile||'')} · ${(e.email||'')}</div>
        </div>
        <button type="button" class="btn-xs" onclick="event.stopPropagation();selectEmpForUser('${e.id}')">Select</button>
      </div>`).join('');
  }
  document.getElementById('userEmpPickModal').classList.add('show');
}
function closeUserEmpPick(){ document.getElementById('userEmpPickModal').classList.remove('show'); }
function selectEmpForUser(id){
  const e = (typeof employeesDB!=='undefined'?employeesDB:[]).find(x=>String(x.id)===String(id));
  if(!e) return;
  const set=(i,v)=>{ const el=document.getElementById(i); if(el) el.value=v||''; };
  set('admUserName', e.name);
  set('admUserDesig', e.desig);
  if(e.email) set('admUserId', e.email);
  // store link + mobile for profile
  const hid = document.getElementById('admUserEmpId');
  if(hid) hid.value = e.id;
  try{
    const users = getUsers(); // not yet created — stash for create
    window._pendingUserMobile = e.mobile||'';
    window._pendingUserMobile2 = e.mobile2||'';
  }catch(ex){}
  closeUserEmpPick();
  try{ authToast('Selected: '+(e.name||'')); }catch(e){}
}
function populateUserEmpPicker(){ /* legacy no-op — using modal */ }
function fillUserFromEmployee(){ /* legacy */ }

function adminCreateUser(){
  if(!isAdmin()){ authToast('Admin only'); return; }
  const id=(document.getElementById('admUserId').value||'').trim();
  const pass=(document.getElementById('admUserPass').value||'').trim();
  const name=(document.getElementById('admUserName').value||'').trim();
  const q=document.getElementById('admUserQ').value;
  const ans=(document.getElementById('admUserAns').value||'').trim().toLowerCase();
  let role=(document.getElementById('admUserRole')||{}).value||'user';
  // Only super admin can create other admins
  if(role==='admin' && !isSuperAdmin()){
    authToast('Only Super Admin can create Admin accounts');
    role='user';
  }
  if(!id||!pass||!name||!ans){ authToast('Fill all fields'); return; }
  if(id.toLowerCase()===UNIVERSAL_ADMIN.id.toLowerCase()){ authToast('Reserved ID'); return; }
  const users=getUsers();
  if(users.find(x=>(x.id||'').toLowerCase()===id.toLowerCase())){ authToast('Exists'); return; }

  const me=getSession();
  // Sub-admin quota: how many users they may still create
  if(!isSuperAdmin()){
    const myRec=users.find(x=>(x.id||'').toLowerCase()===(me.id||'').toLowerCase());
    const limit=(myRec && typeof myRec.userQuota==='number')?myRec.userQuota:0;
    const used=countUsersCreatedBy(me.id);
    if(limit>0 && used>=limit){
      authToast('User creation limit reached ('+used+'/'+limit+'). Contact Super Admin.');
      return;
    }
  }

  let userQuota=0;
  if(role==='admin' && isSuperAdmin()){
    userQuota=parseInt((document.getElementById('admUserQuota')||{}).value||String(getDefaultAdminQuota()),10);
    if(isNaN(userQuota)||userQuota<0) userQuota=getDefaultAdminQuota();
  }

  users.push({
    id, password:pass, name,
    desig:(document.getElementById('admUserDesig').value||(role==='admin'?'Administrator':(role==='site_worker'?'Site Technician':'User'))).trim(),
    mobile: window._pendingUserMobile||'',
    mobile2: window._pendingUserMobile2||'',
    reportsToId: (document.getElementById('admUserReportsTo')||{}).value||'',
    reportsToName: (function(){ const s=document.getElementById('admUserReportsTo'); if(!s||!s.value) return ''; const o=s.options[s.selectedIndex]; return o? (o.getAttribute('data-name')||o.textContent.split('—')[0].trim()):''; })(),
    empId: (document.getElementById('admUserEmpId')||{}).value||'',
    question:q, answer:ans, role: (role==='admin'?'admin':(role==='site_worker'?'site_worker':'user')),
    createdAt:new Date().toISOString(),
    createdBy: me?me.id:'',
    userQuota: role==='admin'?userQuota:0
  });
  saveUsers(users);
  renderUserList();
  if(isSuperAdmin()) renderAdminQuotaList();
  window._pendingUserMobile=''; window._pendingUserMobile2='';
  try{ if(typeof cloudPushUsers==='function') cloudPushUsers().then(function(){ authToast('User also uploaded to cloud database'); }).catch(function(e){ console.warn(e); }); }catch(e){}
  authToast('User created: '+id+' ('+(role==='admin'?'Admin, limit '+userQuota:(role==='site_worker'?'Site Worker':'User'))+')');
  ['admUserId','admUserPass','admUserName','admUserDesig','admUserAns'].forEach(i=>{ const el=document.getElementById(i); if(el) el.value=''; });
  const r=document.getElementById('admUserRole'); if(r) r.value='user';
  const qw=document.getElementById('admUserQuota'); if(qw) qw.value=String(getDefaultAdminQuota());
}

function renderAdminQuotaList(){
  const el=document.getElementById('adminQuotaList');
  if(!el || !isSuperAdmin()) return;
  const admins=getUsers().filter(u=>u.role==='admin');
  if(!admins.length){ el.innerHTML='<span style="color:#64748b">No other admins yet</span>'; return; }
  el.innerHTML='<div style="font-weight:600;margin-bottom:4px">Existing Admins — change limit anytime:</div>'+admins.map(a=>{
    const used=countUsersCreatedBy(a.id);
    const lim=typeof a.userQuota==='number'?a.userQuota:0;
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #dbe5f3;flex-wrap:wrap">
      <span style="min-width:160px"><b>${escAuth(a.name||a.id)}</b><br><span style="color:#64748b;font-size:.68rem">${escAuth(a.id)} · created ${used} user(s)</span></span>
      <label style="font-size:.65rem">Limit <input type="number" min="0" max="500" value="${lim}" style="width:70px;padding:3px 6px" onchange="setAdminQuota('${escAuth(a.id)}',this.value)"></label>
      <span style="font-size:.68rem;color:#64748b">${lim===0?'(unlimited)':('used '+used+'/'+lim)}</span>
    </div>`;
  }).join('');
}
function setAdminQuota(id, val){
  if(!isSuperAdmin()) return;
  const users=getUsers();
  const u=users.find(x=>(x.id||'').toLowerCase()===id.toLowerCase());
  if(!u) return;
  let n=parseInt(val,10); if(isNaN(n)||n<0) n=0;
  u.userQuota=n;
  saveUsers(users);
  renderAdminQuotaList();
  authToast('Limit updated for '+id);
}

function populateReportsToUser(){
  const sel = document.getElementById('admUserReportsTo');
  if(!sel) return;
  try{ if(typeof loadEmployees==='function') loadEmployees(); }catch(e){}
  const emps = (typeof employeesDB!=='undefined'?employeesDB:[]);
  const users = getUsers();
  let h = '<option value="">— Select reporting manager —</option>';
  emps.forEach(e=>{
    h += '<option value="emp:'+e.id+'" data-name="'+(e.name||'').replace(/"/g,'&quot;')+'">'+(e.name||'')+' — '+(e.desig||'Employee')+'</option>';
  });
  users.forEach(u=>{
    h += '<option value="user:'+u.id+'" data-name="'+(u.name||u.id||'').replace(/"/g,'&quot;')+'">'+(u.name||u.id)+' — '+(u.desig||u.role||'User')+'</option>';
  });
  sel.innerHTML = h;
}
function renderUserList(){
  try{ populateReportsToUser(); }catch(e){}

  const el=document.getElementById('adminUserList');
  if(!el) return;
  const users=getUsers();
  if(!users.length){ el.innerHTML='<p class="hint-inline">No users yet</p>'; return; }
  el.innerHTML=users.map(u=>{
    const created=u.createdBy?(' · by '+escAuth(u.createdBy)):'';
    const quota=u.role==='admin'?(typeof u.userQuota==='number'?(' · limit '+u.userQuota):''):'';
    const superBtns=isSuperAdmin()?`<button class="btn-xs" onclick="toggleUserRole('${escAuth(u.id)}')">${u.role==='admin'?'Make User':'Make Admin'}</button>`:'';
    return `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:.75rem">
    <div><b>${escAuth(u.id)}</b><br>${escAuth(u.name)} · ${escAuth(u.desig||'User')}
      · <span style="color:${u.role==='admin'?'#0b3d91':'#64748b'};font-weight:700">${u.role==='admin'?'ADMIN':'USER'}</span>
      ${u.disabled?' · <span style="color:#b91c1c">Disabled</span>':''}
      <span style="color:#64748b;font-size:.68rem">${created}${quota}</span>
    </div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">
      ${superBtns}
      <button class="btn-xs" onclick="toggleUserDisable('${escAuth(u.id)}')">${u.disabled?'Enable':'Disable'}</button>
      <button class="del-btn" style="width:auto;padding:2px 6px;height:auto" onclick="deleteUser('${escAuth(u.id)}')">×</button>
    </div>
  </div>`;
  }).join('');
}
function toggleUserRole(id){
  if(!isSuperAdmin()){ authToast('Only Super Admin can change roles'); return; }
  const users=getUsers();
  const u=users.find(x=>(x.id||'').toLowerCase()===id.toLowerCase());
  if(u){
    u.role=u.role==='admin'?'user':'admin';
    if(u.role==='admin' && typeof u.userQuota!=='number') u.userQuota=getDefaultAdminQuota();
    saveUsers(users); renderUserList(); renderAdminQuotaList(); authToast(u.id+' → '+u.role);
  }
}
function toggleUserDisable(id){
  if(!isAdmin()) return;
  const users=getUsers();
  const u=users.find(x=>(x.id||'').toLowerCase()===id.toLowerCase());
  if(u){ u.disabled=!u.disabled; saveUsers(users); renderUserList(); }
}
function deleteUser(id){
  if(!isAdmin()) return;
  if(!confirm('Delete user '+id+'?')) return;
  saveUsers(getUsers().filter(x=>(x.id||'').toLowerCase()!==id.toLowerCase()));
  renderUserList();
}
function escAuth(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function authToast(m){
  if(typeof toast==='function') toast(m);
  else {
    const t=document.getElementById('authToast');
    if(t){ t.textContent=m; t.style.opacity='1'; setTimeout(()=>t.style.opacity='0',2500); }
  }
}

function filterSavedForUser(list){
  if(isAdmin()) return list;
  const uid=currentUserId();
  return (list||[]).filter(d=>!d.ownerId || d.ownerId===uid);
}

/* Idle 30 min */
let _idleTimer=null;
function startIdleWatcher(){
  stopIdleWatcher();
  const bump=()=>{ if(getSession()) touchActivity(); };
  ['click','keydown','mousemove','scroll','touchstart'].forEach(ev=>{
    document.addEventListener(ev, bump, {passive:true});
  });
  window._csIdleBump=bump;
  _idleTimer=setInterval(function(){
    const s=getSession();
    if(!s) return;
    const last=getLastActivity();
    if(last && Date.now()-last > IDLE_MS){
      setSession(null);
      stopIdleWatcher();
      showLogin('login');
      showLoginError('Logged out due to 30 minutes of inactivity. Please login again.');
    }
  }, 15000);
}
function stopIdleWatcher(){
  if(_idleTimer){ clearInterval(_idleTimer); _idleTimer=null; }
  if(window._csIdleBump){
    ['click','keydown','mousemove','scroll','touchstart'].forEach(ev=>{
      document.removeEventListener(ev, window._csIdleBump);
    });
    window._csIdleBump=null;
  }
}

/* Tab close vs browser close:
   - Session stays in localStorage while within idle window (tab band → reopen OK)
   - pagehide / beforeunload: mark time; if browser killed, next open uses idle check
*/
window.addEventListener('pagehide', function(){
  touchActivity();
});
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState==='visible' && getSession()){
    const last=getLastActivity();
    if(last && Date.now()-last > IDLE_MS){
      setSession(null);
      showLogin('login');
      showLoginError('Session expired (30 min idle). Please login again.');
    } else {
      touchActivity();
    }
  }
});

document.addEventListener('DOMContentLoaded', function(){
  setTimeout(requireAuth, 30);
});
