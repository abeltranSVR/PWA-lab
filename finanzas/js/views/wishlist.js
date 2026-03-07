// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  wishlist.js — Vista "Lista de deseos"                                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const WL_KEY = 'finanzas_wishlist_v1';
let wlItems = [];
let wlPeriodoFiltro = 'todos';

// ── Persistencia ──────────────────────────────────────────────────────────────

function wlLoad() {
  try { wlItems = JSON.parse(localStorage.getItem(WL_KEY) || '[]'); } catch(_) { wlItems = []; }
}

function wlSave() {
  try { localStorage.setItem(WL_KEY, JSON.stringify(wlItems)); } catch(_) {}
}

// ── Render ────────────────────────────────────────────────────────────────────

function wlRender() {
  wlLoad();
  wlBuildTabs();
  wlBuildList();
}

function wlBuildTabs() {
  const container = document.getElementById('wl-period-tabs');
  if (!container) return;
  const periods = typeof efGetPeriods === 'function' ? efGetPeriods() : [];

  const tabs = [{ id: 'todos', label: 'Todos' },
    ...periods.map(p => ({ id: p, label: efPeriodLabel(p, true) }))];

  container.innerHTML = tabs.map(t => `
    <button class="ef-period-tab ${t.id === wlPeriodoFiltro ? 'active' : ''}" data-wlperiod="${t.id}">
      <span class="tab-label">${t.label}</span>
      <span class="tab-dot"></span>
    </button>`).join('');

  container.querySelectorAll('[data-wlperiod]').forEach(btn => {
    btn.addEventListener('click', () => {
      wlPeriodoFiltro = btn.dataset.wlperiod;
      wlBuildTabs();
      wlBuildList();
    });
  });
}

function wlBuildList() {
  const listEl = document.getElementById('wl-list');
  const resEl  = document.getElementById('wl-resumen');
  if (!listEl) return;

  const items = wlPeriodoFiltro === 'todos'
    ? wlItems
    : wlItems.filter(i => i.periodo === wlPeriodoFiltro);

  if (items.length === 0) {
    listEl.innerHTML = `<div class="wl-empty">Sin ítems${wlPeriodoFiltro !== 'todos' ? ' en este período' : ''}</div>`;
    if (resEl) resEl.style.display = 'none';
    return;
  }

  const mostrarPeriodo = wlPeriodoFiltro === 'todos';
  listEl.innerHTML = items.map(item => {
    const periodoTag = mostrarPeriodo && item.periodo
      ? `<span class="wl-period-tag">${efPeriodLabel(item.periodo, true)}</span>` : '';
    const notaTag = item.nota
      ? `<div class="wl-item-nota">${item.nota}</div>` : '';
    return `
    <div class="wl-item" data-wlid="${item.id}">
      <div class="wl-item-body">
        <div class="wl-item-nombre">${item.nombre}</div>
        <div class="wl-item-meta">
          <span class="ef-cat-pill" style="background:${catColor(item.categoria)}22;color:${catColor(item.categoria)};border:1px solid ${catColor(item.categoria)}44;">${item.categoria}</span>
          ${periodoTag}
        </div>
        ${notaTag}
      </div>
      <div class="wl-item-right">
        <span class="wl-item-monto">$${Math.round(item.monto).toLocaleString('es-CL')}</span>
        <div class="wl-item-actions">
          <button class="wl-item-convert" onclick="wlConvert('${item.id}')" title="Convertir en movimiento">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
          </button>
          <button class="wl-item-del" onclick="wlDelete('${item.id}')" title="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  const total = items.reduce((s, i) => s + (i.monto || 0), 0);
  if (resEl) {
    resEl.style.display = '';
    resEl.innerHTML = `
      <span class="wl-res-count">${items.length} ítem${items.length !== 1 ? 's' : ''}</span>
      <span class="wl-res-total">$${Math.round(total).toLocaleString('es-CL')}</span>`;
  }
}

// ── Eliminar ──────────────────────────────────────────────────────────────────

function wlDelete(id) {
  wlItems = wlItems.filter(i => i.id !== id);
  wlSave();
  wlBuildList();
}

// ── Convertir en movimiento ───────────────────────────────────────────────────

function wlConvert(id) {
  const item = wlItems.find(i => i.id === id);
  if (!item) return;
  cmOpen(
    {
      nombre_descriptivo: item.nombre,
      categoria:          item.categoria,
      monto:              item.monto,
      periodo:            item.periodo,
    },
    () => wlDelete(id)   // al crear el movimiento, saca el ítem de la wishlist
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function wlOpen() {
  wlReset();
  document.getElementById('wl-overlay').style.display = 'block';
  document.getElementById('main-nav').style.display = 'none';
}

function wlClose() {
  document.getElementById('wl-overlay').style.display = 'none';
  document.getElementById('main-nav').style.display = '';
}

function wlReset() {
  document.getElementById('wl-nombre').value   = '';
  document.getElementById('wl-categoria').value = '';
  document.getElementById('wl-monto').value    = '';
  document.getElementById('wl-nota').value     = '';

  // Período por defecto: el activo de la vista (si no es 'todos', usarlo)
  const sel = document.getElementById('wl-periodo');
  if (!sel) return;
  const periods = typeof efGetPeriods === 'function' ? efGetPeriods() : [];
  sel.innerHTML = periods.map(p =>
    `<option value="${p}">${efPeriodLabel(p)}</option>`
  ).join('');
  const defaultP = wlPeriodoFiltro !== 'todos' ? wlPeriodoFiltro : (periods[periods.length - 1] || '');
  sel.value = defaultP;
}

function wlSubmit() {
  const nombre    = document.getElementById('wl-nombre').value.trim();
  const categoria = document.getElementById('wl-categoria').value;
  const periodo   = document.getElementById('wl-periodo').value;
  const monto     = parseFloat(document.getElementById('wl-monto').value);
  const nota      = document.getElementById('wl-nota').value.trim();

  if (!nombre || !categoria || !periodo || isNaN(monto) || monto <= 0) {
    showToast('⚠️ Completa los campos obligatorios');
    return;
  }

  wlLoad();
  wlItems.push({
    id: crypto.randomUUID(),
    nombre,
    categoria,
    periodo,
    monto,
    nota,
  });
  wlSave();
  wlBuildList();
  showToast('✓ Ítem agregado');
  wlClose();
}

// ── Listeners ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('wl-close')?.addEventListener('click', wlClose);
  document.getElementById('wl-submit')?.addEventListener('click', wlSubmit);
  document.getElementById('wl-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('wl-overlay')) wlClose();
  });
});

// Enganchar en navegación
document.addEventListener('click', function(e) {
  const item = e.target.closest('[data-view]');
  if (item && item.dataset.view === 'ahorros') {
    setTimeout(wlRender, 30);
  }
}, true);
