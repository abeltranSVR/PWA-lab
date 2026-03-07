// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  app.js — Bootstrap, navegación, sync con servidor, SW y PWA install       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// Base URL relativa al subdirectorio donde está servida la app
const BASE_URL     = new URL('.', document.baseURI).href.replace(/\/$/, '');
const SERVER_API   = 'http://localhost:3000/api';
let   serverOnline = false;
let   _deferredInstallPrompt = null;

// ── Bootstrap principal ────────────────────────────────────────────────────────
async function initApp() {
  try {
    await openDB();
    await seedIfEmpty();
    await loadData();
  } catch (err) {
    console.error('[finanzasDB] Error en inicialización:', err);
  }

  // Calcular derivados (UC_CORTES, TC_NORM, CC_NORM)
  computeDerivedData();

  // Bootstrapping original
  renderHeader();
  renderDeudas();
  fetchIndicadores();
  switchView('deudas');
  renderBCH();
  renderSAN();
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ── NAV ───────────────────────────────────────────────────────────────────────
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const view = document.getElementById('view-' + viewId);
  if (view) view.classList.add('active');
  const navItem = document.querySelector(`[data-view="${viewId}"]`);
  if (navItem) navItem.classList.add('active');
  // Lazy renders
  if (viewId === 'efectivo') efRender();
  if (viewId === 'resumen') resRender();
  if (viewId === 'fijos') renderGastosFijos();
}

document.getElementById('main-nav').addEventListener('click', e => {
  const item = e.target.closest('[data-view]');
  if (item) switchView(item.dataset.view);
});

const _navAddBtn = document.getElementById('nav-add-btn');
_navAddBtn.addEventListener('click', e => { e.stopPropagation(); cmOpen(); });
_navAddBtn.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); cmOpen(); });

// ── Service Worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        console.log('[SW] registrado:', reg.scope);
        // Si hay una nueva versión disponible, notificar
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('Nueva versión disponible — recargá para actualizar');
            }
          });
        });
      })
      .catch(err => console.warn('[SW] error al registrar:', err));
  });
}

// ── Sincronización con servidor local ─────────────────────────────────────────

/** Verifica si el servidor está disponible. */
async function checkServer() {
  try {
    const res = await fetch(`${SERVER_API}/status`, { signal: AbortSignal.timeout(2000) });
    serverOnline = res.ok;
  } catch {
    serverOnline = false;
  }
  updateSyncBar();
}

/** Actualiza la sync bar según el estado del servidor. */
function updateSyncBar() {
  const bar   = document.getElementById('sync-bar');
  const dot   = document.getElementById('sync-dot');
  const label = document.getElementById('sync-label');
  const btnSave = document.getElementById('btn-save');

  if (!bar) return;

  if (serverOnline) {
    bar.classList.add('visible');
    document.body.classList.add('sync-visible');
    dot.className   = 'sync-dot online';
    label.textContent = 'Servidor local activo';
    if (btnSave) btnSave.disabled = false;
  } else {
    bar.classList.add('visible');  // siempre visible para acceder a export/import
    document.body.classList.add('sync-visible');
    dot.className   = 'sync-dot';
    label.textContent = 'Sin servidor — modo offline';
    if (btnSave) { btnSave.disabled = true; btnSave.title = 'Servidor no disponible'; }
  }
}

/**
 * Arma el objeto de datos completo desde las variables globales en memoria.
 * Este objeto es lo que se guarda en el JSON / se envía al servidor.
 */
function buildDataPayload() {
  return {
    _meta: {
      version:      '1.0',
      lastModified: new Date().toISOString(),
      description:  'Finanzas personal — exportado desde PWA',
    },
    MOVIMIENTOS:     MOVIMIENTOS,
    CC_MOVIMIENTOS:  CC_MOVIMIENTOS,
    DEUDAS:          DEUDAS,
    CUPOS:           CUPOS,
    CORTES_PERIODO:  CORTES_PERIODO,
    GF_ASIGNACIONES: gfAsignaciones,
  };
}

/** Guarda los datos en el servidor local (POST /api/data). */
async function saveToServer() {
  if (!serverOnline) { showToast('⚠️ Servidor no disponible'); return; }

  const dot   = document.getElementById('sync-dot');
  const label = document.getElementById('sync-label');
  if (dot)   dot.className   = 'sync-dot saving';
  if (label) label.textContent = 'Guardando…';

  try {
    const payload = buildDataPayload();
    const res     = await fetch(`${SERVER_API}/data`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();

    // También actualizar IndexedDB con los datos actuales
    await syncMemoryToIDB();

    if (dot)   dot.className   = 'sync-dot online';
    if (label) label.textContent = `Guardado ${new Date(result.savedAt).toLocaleTimeString('es-CL')}`;
    showToast('✓ Datos guardados en servidor');
  } catch (err) {
    if (dot)   dot.className   = 'sync-dot error';
    if (label) label.textContent = 'Error al guardar';
    showToast('✗ Error: ' + err.message);
    console.error('[sync] error al guardar:', err);
  }
}

// ── Exportar JSON ────────────────────────────────────────────────────────────
function exportJSON() {
  const payload  = buildDataPayload();
  const json     = JSON.stringify(payload, null, 2);
  const blob     = new Blob([json], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const date     = new Date().toISOString().slice(0, 10);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `finanzas-data-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('↓ JSON exportado');
}

// ── Importar JSON ────────────────────────────────────────────────────────────
async function importJSON(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validación mínima
    if (!data.MOVIMIENTOS || !Array.isArray(data.MOVIMIENTOS)) {
      throw new Error('El archivo no tiene el formato esperado (falta MOVIMIENTOS)');
    }

    // Cargar en variables globales
    MOVIMIENTOS    = data.MOVIMIENTOS    || [];
    CC_MOVIMIENTOS = data.CC_MOVIMIENTOS || [];
    DEUDAS         = data.DEUDAS         || [];
    CUPOS          = data.CUPOS          || {};
    CORTES_PERIODO = data.CORTES_PERIODO || [];

    // Persistir en IndexedDB
    await openDB();
    // Limpiar stores primero
    for (const store of ['movimientos', 'cc_movimientos', 'deudas']) {
      await new Promise((res, rej) => {
        const tx = _db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = res;
        tx.onerror    = e => rej(e.target.error);
      });
    }
    await idbPutAll('movimientos',    MOVIMIENTOS);
    await idbPutAll('cc_movimientos', CC_MOVIMIENTOS);
    await idbPutAll('deudas',         DEUDAS);
    await idbPut('config', 'CUPOS',          CUPOS);
    await idbPut('config', 'CORTES_PERIODO', CORTES_PERIODO);

    // Restaurar asignaciones de gastos fijos
    if (data.GF_ASIGNACIONES) {
      gfAsignaciones = data.GF_ASIGNACIONES;
      await gfSaveAsignaciones();
    }

    // Recalcular derivados y re-renderizar
    computeDerivedData();
    renderHeader();
    renderDeudas();
    renderBCH();
    renderSAN();
    if (document.querySelector('[data-view="resumen"].active')) resRender();

    showToast(`✓ Importado: ${MOVIMIENTOS.length} movimientos TC, ${CC_MOVIMIENTOS.length} CC`);

    // Si el servidor está disponible, guardar automáticamente
    if (serverOnline) {
      await saveToServer();
    }
  } catch (err) {
    showToast('✗ Error al importar: ' + err.message);
    console.error('[import]', err);
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── Install PWA ───────────────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstallPrompt = e;
  // Mostrar banner después de 3 segundos
  setTimeout(() => {
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('visible');
  }, 3000);
});

window.addEventListener('appinstalled', () => {
  _deferredInstallPrompt = null;
  const banner = document.getElementById('install-banner');
  if (banner) banner.classList.remove('visible');
  showToast('✓ App instalada correctamente');
});

// ── Event listeners ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-save')?.addEventListener('click', saveToServer);
  document.getElementById('btn-export')?.addEventListener('click', exportJSON);

  document.getElementById('import-file')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (file) {
      await importJSON(file);
      e.target.value = ''; // reset para poder importar el mismo archivo de nuevo
    }
  });

  document.getElementById('btn-install')?.addEventListener('click', async () => {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    const { outcome } = await _deferredInstallPrompt.userChoice;
    _deferredInstallPrompt = null;
    document.getElementById('install-banner')?.classList.remove('visible');
    if (outcome === 'accepted') showToast('✓ Instalando app…');
  });

  document.getElementById('btn-install-dismiss')?.addEventListener('click', () => {
    document.getElementById('install-banner')?.classList.remove('visible');
  });

  // Verificar servidor al cargar y cada 30 segundos
  checkServer();
  setInterval(checkServer, 30000);
});
