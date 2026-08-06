/* ===== CENTURY SOLUTION — Reliable Persistence ===== */
const IDB_NAME = 'century_solution_db';
const IDB_VER = 1;
const EMP_STORE = 'employees';
const META_STORE = 'meta';

function idbOpen(){
  return new Promise(function(resolve, reject){
    try{
      const req = indexedDB.open(IDB_NAME, IDB_VER);
      req.onupgradeneeded = function(e){
        const db = e.target.result;
        if(!db.objectStoreNames.contains(EMP_STORE)) db.createObjectStore(EMP_STORE, {keyPath: 'id'});
        if(!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, {keyPath: 'key'});
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    }catch(err){ reject(err); }
  });
}

function idbPutAllEmployees(list){
  return idbOpen().then(function(db){
    return new Promise(function(resolve, reject){
      try{
        const tx = db.transaction([META_STORE], 'readwrite');
        tx.objectStore(META_STORE).put({ key: 'employees_json', value: JSON.stringify(list||[]) });
        tx.oncomplete = function(){ resolve(true); };
        tx.onerror = function(){ reject(tx.error); };
      }catch(e){ reject(e); }
    });
  }).catch(function(e){ console.warn('IDB put employees', e); return false; });
}

function idbGetAllEmployees(){
  return idbOpen().then(function(db){
    return new Promise(function(resolve){
      try{
        const tx = db.transaction([META_STORE], 'readonly');
        const req = tx.objectStore(META_STORE).get('employees_json');
        req.onsuccess = function(){
          if(req.result && req.result.value){
            try{ resolve(JSON.parse(req.result.value)); return; }catch(e){}
          }
          resolve(null);
        };
        req.onerror = function(){ resolve(null); };
      }catch(e){ resolve(null); }
    });
  }).catch(function(){ return null; });
}

function safeSetItem(key, value){
  try{
    localStorage.setItem(key, value);
    return true;
  }catch(e){
    console.warn('localStorage error', key, e);
    try{ localStorage.removeItem('cs11_vault_backup'); }catch(e2){}
    try{ localStorage.removeItem('cs11_vault_meta'); }catch(e2){}
    try{ localStorage.setItem(key, value); return true; }catch(e3){ return false; }
  }
}

function vaultKeys(){
  return [
    'cs4_saved','cs4_custom_items','cs7_sow','cs7_custom_cats','cs7_user','cs7_company',
    'cs7_custom_scopes','cs7_scope_maps','cs7_prices','cs7_clients','cs7_vendors',
    'cs9_users','cs9_session','cs10_employees','cs9_orders','cs10_default_admin_quota',
    'cs11_site_engineers','cs11_site_projects','cs11_site_daily','cs11_site_nearmiss',
    'cs11_site_proj_perms','cs11_custom_lists'
  ];
}

function vaultSnapshot(){
  const snap = { at: new Date().toISOString(), data: {} };
  vaultKeys().forEach(function(k){
    try{ const v = localStorage.getItem(k); if(v != null) snap.data[k] = v; }catch(e){}
  });
  try{ safeSetItem('cs11_vault_meta', JSON.stringify({ lastSave: snap.at, keys: Object.keys(snap.data).length })); }catch(e){}
  return snap;
}

function exportFullBackup(){
  const snap = vaultSnapshot();
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'CENTURY_SOLUTION_Backup_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  try{ toast('Full backup downloaded'); }catch(e){}
}

function importFullBackup(ev){
  const f = ev.target.files && ev.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = function(){
    try{
      const snap = JSON.parse(reader.result);
      let n = 0;
      if(snap && snap.data){
        Object.keys(snap.data).forEach(function(k){
          if(safeSetItem(k, snap.data[k])) n++;
        });
        if(snap.data.cs10_employees){
          try{ idbPutAllEmployees(JSON.parse(snap.data.cs10_employees)); }catch(e){}
        }
      }
      try{ toast('Restored ' + n + ' stores. Reloading…'); }catch(e){}
      setTimeout(function(){ location.reload(); }, 500);
    }catch(err){
      try{ toast('Invalid backup file'); }catch(e){}
      console.error(err);
    }
  };
  reader.readAsText(f);
  ev.target.value = '';
}

try{ localStorage.removeItem('cs11_vault_backup'); }catch(e){}
document.addEventListener('DOMContentLoaded', function(){ try{ vaultSnapshot(); }catch(e){} });
