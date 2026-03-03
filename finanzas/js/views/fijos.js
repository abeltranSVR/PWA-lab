// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  fijos.js — View Gastos Fijos: renderGastosFijos, gestión de asignaciones        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// Función de formato específico para este módulo
function fmtClpGF(n) {
  if (n === null || n === undefined) return '—';
  return '$' + Math.round(n).toLocaleString('es-CL');
}

// Índice del período activo en gastos fijos (empieza en el último)
let gfPeriodoIdx  = UC_CORTES.length - 1;
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
    match: ['Claude'] },
  { id: 'gf-08', nombre: 'Coursera',             categoria: 'Servicios y Transporte', obligatorio: true,  monto: 9990,    icono: '🎓',
    match: ['Coursera'] },
  { id: 'gf-09', nombre: 'Netflix',              categoria: 'Entretenimiento',        obligatorio: true,  monto: 4190,    icono: '🎬',
    match: ['Netflix'] },
  { id: 'gf-10', nombre: 'Spotify',              categoria: 'Entretenimiento',        obligatorio: true,  monto: 4190,    icono: '🎧',
    match: ['Spotify'] },
  { id: 'gf-11', nombre: 'Amazon Prime',         categoria: 'Servicios y Transporte', obligatorio: true,  monto: 2990,    icono: '📦',
    match: ['Amazon Prime'] },
  { id: 'gf-12', nombre: 'Gastos Vida',          categoria: 'Hogar',                  obligatorio: true,  monto: 150000,  icono: '🏠',
    match: ['Gastos Vida'] },
  { id: 'gf-13', nombre: 'YouTube Premium',      categoria: 'Entretenimiento',        obligatorio: true,  monto: 6290,    icono: '🎥',
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

function gfAsignadasEnPeriodo(periodo, exceptoGfId) {
  const usadas = new Set();
  GASTOS_FIJOS.forEach(gf => {
    if (gf.id === exceptoGfId) return;
    (gfAsignaciones[gfKey(periodo, gf.id)] || []).forEach(id => usadas.add(id));
  });
  return usadas;
}

function gfChangePeriodo(delta) {
  const newIdx = gfPeriodoIdx + delta;
  if (newIdx < 0 || newIdx >= UC_CORTES.length) return;
  gfPeriodoIdx = newIdx;
  renderGastosFijos();
}

function gfTogglePicker(gfId) {
  const el = document.getElementById('gf-picker-' + gfId);
  if (!el) return;
  const isOpen = el.classList.toggle('gf-picker-open');
  if (isOpen) gfRenderPicker(gfId);
}

function gfRenderPicker(gfId) {
  const periodo   = UC_CORTES[gfPeriodoIdx].id;
  const usadas    = gfAsignadasEnPeriodo(periodo, gfId);
  const asignadas = new Set(gfAsignaciones[gfKey(periodo, gfId)] || []);
  const gf        = GASTOS_FIJOS.find(g => g.id === gfId);
  const patterns  = gf ? (gf.match || []) : [];

  // Si matchAllPeriodos, usar pool global precalculado
  let pool = gf && gf.matchAllPeriodos ? gfTodosMovsGlobal : gfTodosMovs;

  const matchDesc = (desc) => patterns.some(p =>
    p.endsWith('*') ? desc.startsWith(p.slice(0,-1)) : desc === p
  );

  const candidatos = pool.filter(m => {
    if (usadas.has(m.id)) return false;
    const desc = (m.nombre_descriptivo || '').trim();
    return matchDesc(desc) || asignadas.has(m.id);
  });

  const otros = gfTodosMovs.filter(m =>
    !usadas.has(m.id) && !candidatos.find(c => c.id === m.id)
  );

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

  let html = '';
  if (!candidatos.length && !otros.length) {
    html = '<div class="gf-pick-empty">Sin transacciones disponibles</div>';
  } else {
    html += candidatos.map(m => row(m, '')).join('');
    if (otros.length) {
      html += '<div class="gf-pick-sep">Otras transacciones del período</div>';
      html += otros.map(m => row(m, 'gf-pick-other')).join('');
    }
  }

  const picker = document.getElementById('gf-picker-' + gfId);
  if (picker) picker.querySelector('.gf-pick-list').innerHTML = html;
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

async function renderGastosFijos(mantenerPickers) {
  if (!renderGastosFijos._loaded) {
    await gfLoadAsignaciones();
    renderGastosFijos._loaded = true;
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
    const pool     = gf.matchAllPeriodos ? gfTodosMovsGlobal : gfTodosMovs;
    const matches  = pool.filter(m => idsAsig.includes(m.id));
    const confirmed = matches.length > 0;
    const totalPagado = matches.reduce((s, m) => s + (m.valor || 0), 0);

    if (gf.monto) presupuesto += gf.monto;
    if (confirmed) { confirmados++; if (gf.monto) montoOk += gf.monto; }
    else pendientes++;

    const amountClass = gf.monto === null ? 'gf-sin-monto' : '';
    const statusClass = confirmed ? 'gf-confirmed' : 'gf-pending';

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
      <div class="gf-icon">${gf.icono}</div>
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

  const total = GASTOS_FIJOS.length;
  const pct   = total > 0 ? Math.round((confirmados / total) * 100) : 0;

  const el = id => document.getElementById(id);
  if (el('gf-total-presupuesto')) el('gf-total-presupuesto').textContent = fmtClpGF(presupuesto);
  if (el('gf-total-ok'))          el('gf-total-ok').textContent          = fmtClpGF(montoOk);
  if (el('gf-total-pend'))        el('gf-total-pend').textContent        = `${pendientes} pendientes`;
  if (el('gf-progress-fill'))     el('gf-progress-fill').style.width     = pct + '%';
  if (el('gf-progress-label'))    el('gf-progress-label').textContent    = `${confirmados} / ${total} verificados`;

  const hd = el('header-date-fijos');
  if (hd) { const c = UC_CORTES[gfPeriodoIdx]; hd.textContent = c ? c.id : ''; }

  const prevBtn = el('gf-prev-btn');
  const nextBtn = el('gf-next-btn');
  if (prevBtn) prevBtn.disabled = gfPeriodoIdx <= 0;
  if (nextBtn) nextBtn.disabled = gfPeriodoIdx >= UC_CORTES.length - 1;
}

// Enganchar en navegación existente
document.addEventListener('click', function(e) {
  const item = e.target.closest('[data-view]');
  if (item && item.dataset.view === 'fijos') {
    setTimeout(renderGastosFijos, 30);
  }
}, true);
