// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  db.js — Capa IndexedDB para Finanzas PWA                                   ║
// ║  Flujo:                                                                     ║
// ║  1. openDB()   → abre/crea la base finanzasDB v1                            ║
// ║  2. seedIfEmpty() → si está vacía, carga desde servidor o JSON              ║
// ║  3. loadData() → lee las stores y asigna las variables globales             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const IDB_NAME    = 'finanzasDB';
const IDB_VERSION = 1;
const STORES = ['movimientos', 'cc_movimientos', 'deudas', 'config'];
// 'config' guarda objetos con clave string: 'CUPOS', 'CORTES_PERIODO'

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          if (name === 'config') {
            db.createObjectStore(name); // keyPath manual (out-of-line)
          } else {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        }
      });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

function idbPutAll(storeName, records) {
  return new Promise((resolve, reject) => {
    const tx    = _db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach(r => store.put(r));
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

function idbPut(storeName, key, value) {
  return new Promise((resolve, reject) => {
    const tx    = _db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(value, key);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

function idbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx    = _db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function idbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx    = _db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req   = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function idbCount(storeName) {
  return new Promise((resolve, reject) => {
    const tx    = _db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req   = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e => reject(e.target.error);
  });
}

/** Carga el JSON y puebla IndexedDB (solo si las stores están vacías). */
async function seedIfEmpty() {
  const count = await idbCount('movimientos');
  if (count > 0) return;

  // Intentar servidor primero, luego el archivo JSON directo
  for (const source of [`${SERVER_API}/data`, `${BASE_URL}/finanzas-data.json`]) {
    try {
      console.log(`[finanzasDB] Cargando desde ${source} …`);
      const res = await fetch(source, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) continue;
      const data = await res.json();

      await idbPutAll('movimientos',    data.MOVIMIENTOS    || []);
      await idbPutAll('cc_movimientos', data.CC_MOVIMIENTOS || []);
      await idbPutAll('deudas',         data.DEUDAS         || []);
      await idbPut('config', 'CUPOS',          data.CUPOS          || {});
      await idbPut('config', 'CORTES_PERIODO', data.CORTES_PERIODO || []);
      console.log(`[finanzasDB] Sembrado desde ${source}`);
      return;
    } catch (err) {
      console.warn(`[finanzasDB] No disponible: ${source}`, err.message);
    }
  }
  console.warn('[finanzasDB] Sin fuente de datos disponible. IndexedDB vacía.');
}

/** Lee IndexedDB y asigna las variables globales. */
async function loadData() {
  [MOVIMIENTOS, CC_MOVIMIENTOS, DEUDAS] = await Promise.all([
    idbGetAll('movimientos'),
    idbGetAll('cc_movimientos'),
    idbGetAll('deudas'),
  ]);
  CUPOS          = await idbGet('config', 'CUPOS')          || {};
  CORTES_PERIODO = await idbGet('config', 'CORTES_PERIODO') || [];
}

// ── API pública de escritura ───────────────────────────────────────────────────

/** Guarda o actualiza un movimiento TC en IndexedDB. */
async function idbSaveMovimiento(mov) {
  await openDB();
  await idbPutAll('movimientos', [mov]);
}

/** Guarda o actualiza un movimiento CC en IndexedDB. */
async function idbSaveCC(mov) {
  await openDB();
  await idbPutAll('cc_movimientos', [mov]);
}

/** Guarda o actualiza una deuda en IndexedDB. */
async function idbSaveDeuda(deuda) {
  await openDB();
  await idbPutAll('deudas', [deuda]);
}

/** Actualiza CORTES_PERIODO en IndexedDB y recalcula datos derivados. */
async function idbSaveCortes(cortes) {
  await openDB();
  CORTES_PERIODO = cortes;
  await idbPut('config', 'CORTES_PERIODO', cortes);
  computeDerivedData();
}

/** Vacía todas las stores (útil para forzar recarga del JSON). Llamar desde consola + F5. */
function idbClearAll() {
  openDB().then(db => {
    STORES.forEach(name => {
      const tx = db.transaction(name, 'readwrite');
      tx.objectStore(name).clear();
    });
    console.log('[finanzasDB] Stores vaciadas. Recargá la página (F5) para re-sembrar desde JSON.');
  });
}

/** Sincroniza las variables globales de vuelta a IndexedDB (después de cambios en memoria). */
async function syncMemoryToIDB() {
  try {
    await openDB();
    await Promise.all([
      idbPutAll('movimientos',    MOVIMIENTOS),
      idbPutAll('cc_movimientos', CC_MOVIMIENTOS),
      idbPutAll('deudas',         DEUDAS),
    ]);
    await idbPut('config', 'CUPOS',          CUPOS);
    await idbPut('config', 'CORTES_PERIODO', CORTES_PERIODO);
  } catch (err) {
    console.warn('[idb] error al sincronizar memoria → IDB:', err);
  }
}
