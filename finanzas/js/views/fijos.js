// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  fijos.js — View Gastos Fijos: renderGastosFijos, gestión de asignaciones        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// Función de formato específico para este módulo
function fmtClpGF(n) {
  if (n === null || n === undefined) return '—';
  return '$' + Math.round(n).toLocaleString('es-CL');
}

// Índice del período activo en gastos fijos (null = inicializar al último cuando UC_CORTES esté listo)
let gfPeriodoIdx  = null;
let gfAsignaciones = {};
let gfTodosMovs   = [];
let gfTodosMovsGlobal = [];

const GF_STORAGE_KEY = 'gf-asignaciones-v1';

// Lista de gastos fijos y reglas de detección
const GASTOS_FIJOS = [
  // match: lista de nombre_descriptivo exactos (o prefijos con *)
  // Prefijo con * al final = coincidencia por startsWith
  { id: 'gf-01', nombre: 'Arriendo',            categoria: 'Hogar',                  obligatorio: true,  monto: 300000,  icono: '🏠',
    match: ['Arriendo Depto'] },
  { id: 'gf-02', nombre: 'Transporte BIP',       categoria: 'Servicios y Transporte', obligatorio: true,  monto: 40000,   icono: '📱',
    match: ['BIP QR', 'Recarga Pagoya (Transporte)', 'MercadoPago BIPQR - Transporte'] },
  { id: 'gf-03', nombre: 'Lavandería',           categoria: 'Hogar',                  obligatorio: false, monto: 10000,   icono: '🏠',
    match: ['Prontomatic Lavandería'] },
  { id: 'gf-04', nombre: 'Deuda UCH',            categoria: 'Deudas',                 obligatorio: true,  monto: 100000,  icono: '🏦',
    match: ['Deuda Universidad Decreto 8565 (cuota 1/3)', 'Deuda Universidad Decreto 8565 (cuota 2/3)', 'Deuda Universidad Decreto 8565 (cuota 3/3)', 'Deuda Universidad Decreto 8565'],
    matchAllPeriodos: true },
  { id: 'gf-05', nombre: 'Deuda CAE',            categoria: 'Deudas',                 obligatorio: true,  monto: 26000,   icono: '🏦',
    match: ['Scotiabank CAE'] },
  { id: 'gf-06', nombre: 'Deuda FSCU',           categoria: 'Deudas',                 obligatorio: true,  monto: 163126,  icono: '🏦',
    match: ['Deuda Universidad Decreto 8565 - Cuota 3/3 (última)'] },
  { id: 'gf-07', nombre: 'Claude AI',            categoria: 'Servicios y Transporte', obligatorio: true,  monto: null,    icono: '🤖',
    match: ['Comisión Compra Internacional', 'Pago TC Internacional'] },
  { id: 'gf-08', nombre: 'Deuda BCH',            categoria: 'Deudas',                 obligatorio: true,  monto: 298793,  icono: '🏦',
    match: ['Crédito Consumo BCH Cuota 6', 'Crédito Consumo BCH Cuota 7', 'Crédito Consumo BCH Cuota 8'] },
  { id: 'gf-09', nombre: 'Supermercado',         categoria: 'Alimentación',           obligatorio: true,  monto: 200000,  icono: '🛒',
    match: ['Jumbo Oneclick - Supermercado', 'Granja Magdalena', 'Salmón y Alimentos - Marketplace',
            'Unimarc Escuela Militar', 'Unimarc Escuela Militar - Alimentos', 'Santa Isabel Pajaritos',
            'Express Isabel La Católica'] },
  { id: 'gf-10', nombre: 'Ahorro Bancoestado',   categoria: 'Ahorro',                 obligatorio: false, monto: 50000,   icono: '💰',
    match: [] },
  { id: 'gf-11', nombre: 'Psicóloga',            categoria: 'Salud',                  obligatorio: true,  monto: 80000,   icono: '🧠',
    match: ['Psicóloga Paulina Diciembre', 'Psicóloga Paulina Enero', 'Psicóloga Paulina*'] },
  { id: 'gf-12', nombre: 'Team running UC',      categoria: 'Salud',                  obligatorio: true,  monto: 15000,   icono: '🏃',
    match: [] },
  { id: 'gf-13', nombre: 'YouTube Premium',      categoria: 'Servicios y Transporte', obligatorio: true,  monto: 11000,   icono: '▶️',
    match: ['YouTube', 'Google Play YouTube'] },
  { id: 'gf-14', nombre: 'Gastos comunes',       categoria: 'Hogar',                  obligatorio: true,  monto: 120000,  icono: '🏠',
    match: ['Gastos Comunes Depto'] },
  { id: 'gf-15', nombre: 'Plan celular',         categoria: 'Servicios y Transporte', obligatorio: true,  monto: 5000,    icono: '📱',
    match: ['Claro Telefonía - Celular Personal'] },
];

// almacenamiento de asignaciones
async function gfLoadAsignaciones() {
  try {
    const r = await window.storage.get(GF_STORAGE_KEY);
    gfAsignaciones = r ? JSON.parse(r.value) : {};
  } catch(_) { gfAsignaciones = {}; }
}

async function gfSaveAsignaciones() {
  try { await window.storage.set(GF_STORAGE_KEY, JSON.stringify(gfAsignaciones)); } catch(_) {}
}

function gfKey(periodo, gfId) { return `${periodo}:${gfId}`; }
function gfIgnoredKey(periodo, gfId) { return `${periodo}:${gfId}:ignored`; }

function gfIsIgnored(periodo, gfId) {
  return !!gfAsignaciones[gfIgnoredKey(periodo, gfId)];
}

async function gfToggleIgnored(gfId) {
  const periodo = UC_CORTES[gfPeriodoIdx].id;
  const k = gfIgnoredKey(periodo, gfId);
  if (gfAsignaciones[k]) {
    delete gfAsignaciones[k];
  } else {
    gfAsignaciones[k] = true;
  }
  await gfSaveAsignaciones();
  renderGastosFijos(true);
}

function gfAsignadasEnPeriodo(periodo, exceptoGfId) {
  const usadas = new Set();
  GASTOS_FIJOS.forEach(gf => {
    if (gf.id === exceptoGfId) return;
    (gfAsignaciones[gfKey(periodo, gf.id)] || []).forEach(id => usadas.add(id));
  });
  return usadas;
}

function buildGfPeriodTabs() {
  const container = document.getElementById('gf-period-tabs');
  if (!container) return;
  const periods = efGetPeriods();
  const periodoActivo = UC_CORTES[gfPeriodoIdx] ? UC_CORTES[gfPeriodoIdx].id : null;
  container.innerHTML = periods.map(p => `
    <button class="ef-period-tab ${p === periodoActivo ? 'active' : ''}" data-period="${p}">
      <span class="tab-label">${efPeriodLabel(p, true)}</span>
      <span class="tab-dot"></span>
    </button>
  `).join('');
  container.querySelectorAll('.ef-period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = UC_CORTES.findIndex(c => c.id === btn.dataset.period);
      if (idx >= 0) gfPeriodoIdx = idx;
      buildGfPeriodTabs();
      renderGastosFijos();
    });
  });
}

function gfTogglePicker(gfId) {
  const el = document.getElementById('gf-picker-' + gfId);
  if (!el) return;
  const isOpen = el.classList.toggle('gf-picker-open');
  if (isOpen) gfRenderPicker(gfId);
}

function gfRenderPicker(gfId, query) {
  const periodo   = UC_CORTES[gfPeriodoIdx].id;
  const usadas    = gfAsignadasEnPeriodo(periodo, gfId);
  const asignadas = new Set(gfAsignaciones[gfKey(periodo, gfId)] || []);
  const gf        = GASTOS_FIJOS.find(g => g.id === gfId);
  const patterns  = gf ? (gf.match || []) : [];

  const matchDesc = (desc) => patterns.some(p =>
    p.endsWith('*') ? desc.startsWith(p.slice(0,-1)) : desc === p
  );

  // Ya asignados a este gasto (se muestran separados arriba)
  const yaAsignados = gfTodosMovsGlobal.filter(m => asignadas.has(m.id));

  // Candidatos: coinciden por nombre, excluye ya asignados y usados por otros
  const poolPrincipal = gf && gf.matchAllPeriodos ? gfTodosMovsGlobal : gfTodosMovs;
  const candidatos = poolPrincipal.filter(m => {
    if (usadas.has(m.id) || asignadas.has(m.id)) return false;
    return matchDesc((m.nombre_descriptivo || '').trim());
  });

  // Otros: período anterior, actual y siguiente, excluye ya asignados, usados y candidatos
  const prevPeriodo = gfPeriodoIdx > 0 ? UC_CORTES[gfPeriodoIdx - 1].id : null;
  const nextPeriodo = gfPeriodoIdx < UC_CORTES.length - 1 ? UC_CORTES[gfPeriodoIdx + 1].id : null;
  const candidatosIds = new Set(candidatos.map(m => m.id));
  const otros = gfTodosMovsGlobal.filter(m =>
    !usadas.has(m.id) && !asignadas.has(m.id) && !candidatosIds.has(m.id) &&
    (m.periodo === prevPeriodo || m.periodo === nextPeriodo || m.periodo === periodo)
  );

  // Filtro por búsqueda
  const q = (query || '').toLowerCase().trim();
  const filtrar = arr => q
    ? arr.filter(m => (m.nombre_descriptivo || '').toLowerCase().includes(q))
    : arr;

  const fmtF = (f, p) => {
    const fecha = f ? (() => { const d = new Date(f + 'T00:00:00'); return `${d.getDate()} ${d.toLocaleString('es-CL',{month:'short'})}`; })() : '';
    const perTag = (p && p !== periodo) ? ` <span style="color:var(--text-muted);font-size:9px">${p}</span>` : '';
    return fecha + perTag;
  };

  const row = (m, cls) => `
    <label class="gf-pick-row ${cls}" onclick="event.stopPropagation()">
      <input type="checkbox" ${asignadas.has(m.id)?'checked':''} onchange="gfToggleAsignacion('${gfId}','${m.id}')">
      <span class="gf-pick-fecha">${fmtF(m.fecha, m.periodo)}</span>
      <span class="gf-pick-desc">${m.nombre_descriptivo}</span>
      <span class="gf-pick-val">${fmtClpGF(m.valor)}</span>
    </label>`;

  const yaFilt    = filtrar(yaAsignados);
  const candFilt  = filtrar(candidatos);
  const otrosFilt = filtrar(otros);

  let html = '';
  if (yaFilt.length) {
    html += '<div class="gf-pick-sep gf-pick-sep-assigned">Seleccionados</div>';
    html += yaFilt.map(m => row(m, 'gf-pick-assigned')).join('');
  }
  if (!candFilt.length && !otrosFilt.length && !yaFilt.length) {
    html = `<div class="gf-pick-empty">${q ? 'Sin resultados para "' + q + '"' : 'Sin transacciones disponibles'}</div>`;
  } else {
    html += candFilt.map(m => row(m, '')).join('');
    if (q && otrosFilt.length) {
      html += '<div class="gf-pick-sep">Otras transacciones</div>';
      html += otrosFilt.map(m => row(m, 'gf-pick-other')).join('');
    }
  }
  html += `<div class="gf-pick-search-more"><button class="gf-pick-search-more-btn" onclick="event.stopPropagation();gfOpenSearchForGF('${gfId}')">Buscar en todos los movimientos…</button></div>`;

  const picker = document.getElementById('gf-picker-' + gfId);
  if (!picker) return;

  // Preservar o crear el buscador
  let list = picker.querySelector('.gf-pick-list');
  if (!picker.querySelector('.gf-pick-search')) {
    const searchEl = document.createElement('div');
    searchEl.className = 'gf-pick-search';
    searchEl.innerHTML = `<input type="text" placeholder="Buscar…" oninput="gfRenderPicker('${gfId}',this.value)" onclick="event.stopPropagation()">`;
    picker.insertBefore(searchEl, list);
  }
  list.innerHTML = html;
}

async function gfToggleAsignacion(gfId, movId) {
  const periodo = UC_CORTES[gfPeriodoIdx].id;
  const key = gfKey(periodo, gfId);
  const arr = [...(gfAsignaciones[key] || [])];
  const idx = arr.indexOf(movId);
  if (idx >= 0) arr.splice(idx, 1); else arr.push(movId);
  gfAsignaciones[key] = arr;
  await gfSaveAsignaciones();
  renderGastosFijos(true);
}

function gfOpenSearchForGF(gfId) {
  const periodo  = UC_CORTES[gfPeriodoIdx].id;
  const key      = gfKey(periodo, gfId);
  const preselected = new Set(gfAsignaciones[key] || []);
  srOpen({
    selectionMode: true,
    preselected,
    onConfirm: async (ids) => {
      // Replace current assignments with confirmed selection
      gfAsignaciones[key] = ids;
      await gfSaveAsignaciones();
      renderGastosFijos(true);
    },
  });
}

async function renderGastosFijos(mantenerPickers) {
  if (!renderGastosFijos._loaded) {
    await gfLoadAsignaciones();
    renderGastosFijos._loaded = true;
  }

  // Inicializar al período más reciente con datos si aún no se ha establecido
  if (gfPeriodoIdx === null) {
    const periods = efGetPeriods();
    const defaultP = periods[periods.length - 1] || UC_CORTES[UC_CORTES.length - 1].id;
    gfPeriodoIdx = UC_CORTES.findIndex(c => c.id === defaultP);
    if (gfPeriodoIdx < 0) gfPeriodoIdx = UC_CORTES.length - 1;
  }

  const periodoActivo = UC_CORTES[gfPeriodoIdx].id;

  const movsPeriodo = (typeof MOVIMIENTOS !== 'undefined' ? MOVIMIENTOS : [])
    .filter(m => m.periodo === periodoActivo && m.valor_cuota > 0);

  const ccMovs = (typeof CC_MOVIMIENTOS !== 'undefined' ? CC_MOVIMIENTOS : [])
    .filter(m => m.periodo === periodoActivo && m.monto !== 0
              && m.categoria !== 'Pagos TC' && m.categoria !== 'Sueldo');

  const mapTC = m => ({
    id:                 m.id,
    nombre_descriptivo: m.nombre_descriptivo || '',
    categoria:          m.categoria          || '',
    valor:              m.valor_cuota,
    fecha:              m.fecha_transaccion  || '',
    periodo:            m.periodo,
  });
  const mapCC = m => ({
    id:                 m.id,
    nombre_descriptivo: m.descripcion || m.nombre_descriptivo || '',
    categoria:          m.categoria   || '',
    valor:              Math.abs(m.monto),
    fecha:              m.fecha       || '',
    periodo:            m.periodo,
  });

  gfTodosMovs = [
    ...movsPeriodo.map(mapTC),
    ...ccMovs.map(mapCC),
  ];

  // Pool global para gastos con matchAllPeriodos
  gfTodosMovsGlobal = [
    ...(typeof MOVIMIENTOS !== 'undefined' ? MOVIMIENTOS : [])
      .filter(m => m.valor_cuota > 0).map(mapTC),
    ...(typeof CC_MOVIMIENTOS !== 'undefined' ? CC_MOVIMIENTOS : [])
      .filter(m => m.monto !== 0 && m.categoria !== 'Pagos TC' && m.categoria !== 'Sueldo').map(mapCC),
  ];

  const fmtFecha = f => {
    if (!f) return '';
    const d = new Date(f + 'T00:00:00');
    return `${d.getDate()} ${d.toLocaleString('es-CL',{month:'short'})} · `;
  };

  const abiertos = new Set();
  if (mantenerPickers) {
    GASTOS_FIJOS.forEach(gf => {
      const el = document.getElementById('gf-picker-' + gf.id);
      if (el && el.classList.contains('gf-picker-open')) abiertos.add(gf.id);
    });
  }

  let presupuesto = 0, montoOk = 0, confirmados = 0, pendientes = 0;

  const items = GASTOS_FIJOS.map(gf => {
    const key      = gfKey(periodoActivo, gf.id);
    const idsAsig  = gfAsignaciones[key] || [];
    const matches  = gfTodosMovsGlobal.filter(m => idsAsig.includes(m.id));
    const confirmed = matches.length > 0;
    const totalPagado = matches.reduce((s, m) => s + (m.valor || 0), 0);

    const ignored = gfIsIgnored(periodoActivo, gf.id);

    if (!ignored && gf.monto) presupuesto += gf.monto;
    if (ignored) { /* excluido */ }
    else if (confirmed) { confirmados++; if (gf.monto) montoOk += gf.monto; }
    else pendientes++;

    const amountClass = gf.monto === null ? 'gf-sin-monto' : '';
    const statusClass = ignored ? 'gf-ignored' : confirmed ? 'gf-confirmed' : 'gf-pending';

    let matchHint = '';
    if (confirmed) {
      const txnLines = matches.map(m => {
        const periodoTag = m.periodo && m.periodo !== periodoActivo
          ? ` <span style="opacity:.5;font-size:9px">${m.periodo}</span>` : '';
        return `<span class="gf-match-txn">${fmtFecha(m.fecha)}${m.nombre_descriptivo}${periodoTag}</span>`;
      }).join('');
      const countTxt = matches.length > 1 ? ` (${matches.length})` : '';
      matchHint = `
        <div class="gf-match-hint">
          ✓ <span class="gf-match-amount">${fmtClpGF(totalPagado)}</span>${countTxt}
          <span class="gf-match-txns">${txnLines}</span>
        </div>`;
    }

    return `
    <div class="gf-item ${statusClass}" onclick="gfTogglePicker('${gf.id}')">
      <div class="gf-body">
        <div class="gf-name">${gf.nombre}</div>
        <div class="gf-meta">
          <span>${gf.categoria}</span>
          <span>·</span>
          <span class="${gf.obligatorio ? 'gf-badge-obl' : 'gf-badge-opt'}">${gf.obligatorio ? 'obligatorio' : 'opcional'}</span>
        </div>
        ${matchHint}
      </div>
      <div class="gf-right">
        <span class="gf-amount ${amountClass}">${fmtClpGF(gf.monto)}</span>
        <div class="gf-status-dot"></div>
        <span class="gf-ignore-btn" onclick="event.stopPropagation();gfToggleIgnored('${gf.id}')">${ignored ? 'Dejar de ignorar' : 'Ignorar'}</span>
      </div>
    </div>
    <div class="gf-picker" id="gf-picker-${gf.id}">
      <div class="gf-pick-list"></div>
    </div>`;
  });

  const listEl = document.getElementById('gf-list');
  if (listEl) listEl.innerHTML = items.join('');

  abiertos.forEach(gfId => {
    const el = document.getElementById('gf-picker-' + gfId);
    if (el) { el.classList.add('gf-picker-open'); gfRenderPicker(gfId); }
  });

  const total = confirmados + pendientes; // excluye ignorados
  const pct   = total > 0 ? Math.round((confirmados / total) * 100) : 0;

  const el = id => document.getElementById(id);
  if (el('gf-total-presupuesto')) el('gf-total-presupuesto').textContent = fmtClpGF(presupuesto);
  if (el('gf-total-ok'))          el('gf-total-ok').textContent          = fmtClpGF(montoOk);
  if (el('gf-total-pend'))        el('gf-total-pend').textContent        = `${pendientes} pendientes`;
  if (el('gf-progress-fill'))     el('gf-progress-fill').style.width     = pct + '%';
  if (el('gf-progress-label'))    el('gf-progress-label').textContent    = `${confirmados} / ${total} verificados`;

  buildGfPeriodTabs();
}

// Enganchar en navegación existente
document.addEventListener('click', function(e) {
  const item = e.target.closest('[data-view]');
  if (item && item.dataset.view === 'fijos') {
    setTimeout(renderGastosFijos, 30);
  }
}, true);
