/* ===== CENTURY SOLUTION v13 — Cloud / Team Package layer ===== */
/* Designed so data can move: Browser → Google Drive / OneDrive / Server → other logins */

const CS_PACKAGE_VER = 13;

function collectAllDataStores(){
  const keys = (typeof vaultKeys==='function') ? vaultKeys() : [
    'cs4_saved','cs4_custom_items','cs7_sow','cs7_custom_cats','cs7_user','cs7_company',
    'cs7_custom_scopes','cs7_scope_maps','cs7_prices','cs7_clients','cs7_vendors',
    'cs9_users','cs10_employees','cs9_orders','cs10_default_admin_quota',
    'cs11_site_engineers','cs11_site_projects','cs11_site_daily','cs11_site_nearmiss',
    'cs11_site_proj_perms','cs11_custom_lists'
  ];
  const data = {};
  keys.forEach(k=>{
    try{
      const v = localStorage.getItem(k);
      if(v != null) data[k] = v;
    }catch(e){}
  });
  // never export active session
  delete data.cs9_session;
  return data;
}

function exportTeamPackage(){
  const pkg = {
    app: 'CENTURY SOLUTION',
    version: CS_PACKAGE_VER,
    exportedAt: new Date().toISOString(),
    exportedBy: (typeof getSession==='function' && getSession()) ? (getSession().name||getSession().id) : '',
    note: 'Import this file in Settings → Import Team Package. Users keep their own login passwords from cs9_users inside the package.',
    data: collectAllDataStores()
  };
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'CENTURY_SOLUTION_v13_Team_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  try{ toast('Team package ready — upload to Drive / OneDrive / Server'); }catch(e){}
}

function applyPackageData(data){
  if(!data || typeof data !== 'object') return 0;
  let n = 0;
  Object.keys(data).forEach(k=>{
    if(k === 'cs9_session') return;
    try{
      if(typeof safeSetItem==='function'){
        if(safeSetItem(k, data[k])) n++;
      } else {
        localStorage.setItem(k, data[k]); n++;
      }
    }catch(e){}
  });
  if(data.cs10_employees && typeof idbPutAllEmployees==='function'){
    try{ idbPutAllEmployees(JSON.parse(data.cs10_employees)); }catch(e){}
  }
  return n;
}

function importTeamPackage(ev){
  const f = ev.target.files && ev.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = function(){
    try{
      const pkg = JSON.parse(reader.result);
      const data = pkg.data || pkg; // accept raw vault too
      const n = applyPackageData(data);
      try{ toast('Imported '+n+' stores (v'+(pkg.version||'?')+'). Reloading…'); }catch(e){}
      setTimeout(function(){ location.reload(); }, 600);
    }catch(err){
      console.error(err);
      try{ toast('Invalid package file'); }catch(e){}
    }
  };
  reader.readAsText(f);
  ev.target.value = '';
}

/** Convert common share links to direct download where possible */
function normalizeCloudUrl(url){
  url = (url||'').trim();
  if(!url) return '';
  // Google Drive: https://drive.google.com/file/d/FILE_ID/view?...
  let m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if(m) return 'https://drive.google.com/uc?export=download&id=' + m[1];
  m = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if(m) return 'https://drive.google.com/uc?export=download&id=' + m[1];
  // Dropbox: replace dl=0 with dl=1
  if(url.indexOf('dropbox.com') >= 0) return url.replace('dl=0','dl=1').replace('www.dropbox.com','dl.dropboxusercontent.com');
  return url;
}

function pullFromCloudUrl(){
  const input = document.getElementById('cloudSyncUrl');
  let url = input ? input.value.trim() : '';
  if(!url){
    try{ url = localStorage.getItem('cs12_cloud_url')||''; }catch(e){}
  }
  if(!url){ toast('Paste a shared package URL first'); return; }
  try{ localStorage.setItem('cs12_cloud_url', url); }catch(e){}
  const fetchUrl = normalizeCloudUrl(url);
  toast('Pulling package…');
  fetch(fetchUrl, { mode: 'cors', cache: 'no-store' })
    .then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.text();
    })
    .then(function(text){
      const pkg = JSON.parse(text);
      const data = pkg.data || pkg;
      const n = applyPackageData(data);
      toast('Cloud pull OK — '+n+' stores. Reloading…');
      setTimeout(function(){ location.reload(); }, 600);
    })
    .catch(function(err){
      console.error(err);
      toast('Pull failed (CORS/network). Download the JSON manually, then Import Team Package. '+((err&&err.message)||''));
    });
}

// Remember URL field
document.addEventListener('DOMContentLoaded', function(){
  try{
    const u = localStorage.getItem('cs12_cloud_url');
    const el = document.getElementById('cloudSyncUrl');
    if(u && el) el.value = u;
  }catch(e){}
});
