/* ===== CENTURY SOLUTION v13 — Shared Database =====
   Priority:
   1) Netlify Functions + Blobs  →  /.netlify/functions/store  (zero config on Netlify)
   2) Supabase (optional) via config.js or Settings
*/

const CS_CLOUD_CFG = 'cs12_supabase_cfg';
const CS_SYNC_KEYS = [
  'cs4_saved','cs4_custom_items','cs7_sow','cs7_custom_cats','cs7_company',
  'cs7_custom_scopes','cs7_scope_maps','cs7_prices','cs7_clients','cs7_vendors',
  'cs9_users','cs10_employees','cs9_orders','cs10_default_admin_quota',
  'cs11_site_engineers','cs11_site_projects','cs11_site_daily','cs11_site_nearmiss',
  'cs11_site_proj_perms','cs11_custom_lists'
];

function getNetlifyStoreUrl(){
  try{
    if(typeof location==='undefined') return '';
    // Only when hosted (http/https), not file://
    if(location.protocol!=='http:' && location.protocol!=='https:') return '';
    // Prefer same-origin Netlify function
    return location.origin + '/.netlify/functions/store';
  }catch(e){ return ''; }
}

function getCloudCfg(){
  try{
    if(typeof CS_CLOUD_DEFAULTS==='object' && CS_CLOUD_DEFAULTS && CS_CLOUD_DEFAULTS.url && CS_CLOUD_DEFAULTS.key){
      return { url: String(CS_CLOUD_DEFAULTS.url).trim(), key: String(CS_CLOUD_DEFAULTS.key).trim(), mode: 'supabase' };
    }
  }catch(e){}
  try{
    const c = JSON.parse(localStorage.getItem(CS_CLOUD_CFG)||'null');
    if(c && c.url && c.key) return Object.assign({ mode: 'supabase' }, c);
  }catch(e){}
  const n = getNetlifyStoreUrl();
  if(n) return { mode: 'netlify', url: n };
  return null;
}

function saveCloudCfg(cfg){
  localStorage.setItem(CS_CLOUD_CFG, JSON.stringify(cfg||{}));
}

function isCloudConfigured(){
  const c = getCloudCfg();
  return !!(c && (c.mode==='netlify' || (c.url && c.key)));
}

async function netlifyFetch(url, opts){
  const res = await fetch(url, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, opts||{}));
  if(!res.ok){
    const t = await res.text().catch(()=> '');
    throw new Error('Netlify store '+res.status+': '+t.slice(0,180));
  }
  return res.json();
}

async function sbFetch(path, opts){
  const c = getCloudCfg();
  if(!c || c.mode==='netlify' || !c.key) throw new Error('Supabase not configured');
  const url = c.url.replace(/\/$/,'') + path;
  const headers = Object.assign({
    'apikey': c.key,
    'Authorization': 'Bearer ' + c.key,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  }, (opts && opts.headers)||{});
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  if(!res.ok){
    const t = await res.text().catch(()=> '');
    throw new Error('Cloud DB '+res.status+': '+t.slice(0,200));
  }
  if(res.status===204) return null;
  const ct = res.headers.get('content-type')||'';
  if(ct.indexOf('json')>=0) return res.json();
  return res.text();
}

async function cloudPushAll(){
  const c = getCloudCfg();
  if(!c) throw new Error('Cloud not available');

  const data = {};
  CS_SYNC_KEYS.forEach(function(k){
    try{
      const v = localStorage.getItem(k);
      if(v != null) data[k] = v;
    }catch(e){}
  });

  if(c.mode==='netlify'){
    await netlifyFetch(c.url, { method: 'POST', body: JSON.stringify({ data }) });
    return Object.keys(data).length;
  }

  // Supabase path
  const rows = Object.keys(data).map(function(k){
    return { key: k, value: data[k], updated_at: new Date().toISOString() };
  });
  for(let i=0;i<rows.length;i+=20){
    const batch = rows.slice(i,i+20);
    await sbFetch('/rest/v1/cs_store?on_conflict=key', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch)
    });
  }
  return rows.length;
}

async function cloudPullAll(){
  const c = getCloudCfg();
  if(!c) throw new Error('Cloud not available');
  let n = 0;

  if(c.mode==='netlify'){
    const res = await netlifyFetch(c.url, { method: 'GET' });
    const data = (res && res.data) || {};
    Object.keys(data).forEach(function(k){
      if(k==='cs9_session') return;
      try{ localStorage.setItem(k, data[k]); n++; }catch(e){}
    });
  } else {
    const rows = await sbFetch('/rest/v1/cs_store?select=key,value', { method: 'GET' });
    (rows||[]).forEach(function(r){
      if(!r || !r.key || r.key==='cs9_session') return;
      try{ localStorage.setItem(r.key, r.value); n++; }catch(e){}
    });
  }

  if(typeof idbPutAllEmployees==='function'){
    try{
      const emp = localStorage.getItem('cs10_employees');
      if(emp) idbPutAllEmployees(JSON.parse(emp));
    }catch(e){}
  }
  return n;
}

async function cloudPullUsers(){
  const c = getCloudCfg();
  if(!c) return false;

  if(c.mode==='netlify'){
    const res = await netlifyFetch(c.url + '?key=cs9_users', { method: 'GET' });
    if(res && res.value){
      localStorage.setItem('cs9_users', res.value);
      return true;
    }
    return false;
  }

  const rows = await sbFetch('/rest/v1/cs_store?key=eq.cs9_users&select=key,value', { method: 'GET' });
  if(rows && rows[0] && rows[0].value){
    localStorage.setItem('cs9_users', rows[0].value);
    return true;
  }
  return false;
}

async function cloudPushUsers(){
  const c = getCloudCfg();
  if(!c) return false;
  const v = localStorage.getItem('cs9_users');
  if(v == null) return false;

  if(c.mode==='netlify'){
    await netlifyFetch(c.url, {
      method: 'POST',
      body: JSON.stringify({ key: 'cs9_users', value: v })
    });
    return true;
  }

  await sbFetch('/rest/v1/cs_store?on_conflict=key', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: 'cs9_users', value: v, updated_at: new Date().toISOString() }])
  });
  return true;
}

function saveCloudSettingsFromForm(){
  const url = (document.getElementById('sbUrl')||{}).value||'';
  const key = (document.getElementById('sbKey')||{}).value||'';
  if(url.trim() && key.trim()){
    saveCloudCfg({ url: url.trim(), key: key.trim(), mode: 'supabase' });
    try{ toast('Supabase settings saved'); }catch(e){}
  } else {
    try{ toast('Netlify mode: no extra keys needed when deployed with Netlify functions'); }catch(e){}
  }
  updateCloudStatusUI();
}

function loadCloudSettingsToForm(){
  try{
    const c = JSON.parse(localStorage.getItem(CS_CLOUD_CFG)||'null')||{};
    const u = document.getElementById('sbUrl');
    const k = document.getElementById('sbKey');
    if(u) u.value = c.url||'';
    if(k) k.value = c.key||'';
  }catch(e){}
  updateCloudStatusUI();
}

function updateCloudStatusUI(){
  const el = document.getElementById('cloudDbStatus');
  if(!el) return;
  const c = getCloudCfg();
  if(c && c.mode==='netlify'){
    el.innerHTML = '<span style="color:#0f766e;font-weight:700">● Netlify shared DB active</span> — users auto-save after create; login works on other devices';
  } else if(c && c.mode==='supabase'){
    el.innerHTML = '<span style="color:#0f766e;font-weight:700">● Supabase connected</span> — use Push/Pull to sync';
  } else {
    el.innerHTML = '<span style="color:#a16207;font-weight:700">○ Local only</span> — host on Cloudflare/Netlify with config.js Supabase keys, or enter keys below';
  }
}

async function uiCloudPush(){
  try{
    toast('Uploading…');
    const n = await cloudPushAll();
    toast('Uploaded '+n+' keys to shared database');
  }catch(e){
    console.error(e);
    toast('Push failed: '+(e.message||e));
  }
}

async function uiCloudPull(){
  try{
    toast('Downloading…');
    const n = await cloudPullAll();
    toast('Downloaded '+n+' keys. Reloading…');
    setTimeout(function(){ location.reload(); }, 700);
  }catch(e){
    console.error(e);
    toast('Pull failed: '+(e.message||e));
  }
}

document.addEventListener('DOMContentLoaded', function(){
  setTimeout(loadCloudSettingsToForm, 300);
});


function downloadConfigJs(){
  const url = ((document.getElementById('sbUrl')||{}).value||'').trim();
  const key = ((document.getElementById('sbKey')||{}).value||'').trim();
  if(!url || !key){
    try{ toast('Enter URL and anon key first, then Save'); }catch(e){}
    return;
  }
  saveCloudCfg({ url, key, mode: 'supabase' });
  const body = '/* CENTURY SOLUTION — auto config for Netlify Drop */\n'
    + 'var CS_CLOUD_DEFAULTS = {\n'
    + '  url: ' + JSON.stringify(url) + ',\n'
    + '  key: ' + JSON.stringify(key) + '\n'
    + '};\n';
  const blob = new Blob([body], { type: 'application/javascript' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'config.js';
  a.click();
  try{ toast('config.js downloaded — place it in the folder and re-upload to Netlify Drop'); }catch(e){}
}
