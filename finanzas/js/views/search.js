// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  search.js — Modal de búsqueda global de movimientos (con modo selección)  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── Estado ────────────────────────────────────────────────────────────────────
let srQuery         = '';
let srFilterDesde   = '';
let srFilterHasta   = '';
let srFilterCats    = new Set();
let srFilterOrigins = new Set();
let srSortMode      = 'fecha';

// Modo selección
let srSelectionMode  = false;
let srSeleccionados  = new Set(); // ids seleccionados
let srOnConfirm      = null;      // callback(ids[])

// ── Abrir / cerrar ────────────────────────────────────────────────────────────
/**
 * srOpen(opts?)
 * opts.selectionMode  = true  → muestra checkboxes + botón confirmar
 * opts.preselected    = Set   → ids pre-seleccionados
 * opts.onConfirm      = fn    → callback(ids[]) al confirmar
 */
function srOpen(opts) {
  opts = opts || {};
  srSelectionMode = !!opts.selectionMode;
  srSeleccionados = opts.preselected ? new Set(opts.preselected) : new Set();
  srOnConfirm     = opts.onConfirm || null;

  document.getElementById('sr-overlay').style.display  = 'block';
  document.getElementById('main-nav').style.display    = 'none';
  document.getElementById('fab-group').style.display   = 'none';
  document.getElementById('sr-confirm-bar').style.display = srSelectionMode ? '' : 'none';
  srUpdateConfirmBtn();
  srRender();
  setTimeout(() => document.getElementById('sr-search').focus(), 50);
}

function srClose() {
  document.getElementById('sr-overlay').style.display = 'none';
  document.getElementById('main-nav').style.display   = '';
  document.getElementById('fab-group').style.display  = '';
  srSelectionMode = false;
  srSeleccionados = new Set();
  srOnConfirm     = null;
}

function srConfirm() {
  const ids = [...srSeleccionados];
  const cb  = srOnConfirm;
  srClose();
  if (cb) cb(ids);
}

// ── Filtrar movimientos ───────────────────────────────────────────────────────
function srFilterMovs() {
  let movs = efAllMovs();
  const q = normalizeQ(srQuery);
  if (q) movs = movs.filter(m =>
    normalizeQ(m.descripcion || m.nombre_descriptivo).includes(q) ||
    normalizeQ(m.nombre_original).includes(q) ||
    normalizeQ(m.id).includes(q) ||
    normalizeQ(m.categoria).includes(q) ||
    normalizeQ(m.medio_pago).includes(q)
  );
  if (srFilterDesde)       movs = movs.filter(m => m.fecha >= srFilterDesde);
  if (srFilterHasta)       movs = movs.filter(m => m.fecha <= srFilterHasta);
  if (srFilterCats.size)   movs = movs.filter(m => srFilterCats.has(m.categoria || 'Por Clasificar'));
  if (srFilterOrigins.size) movs = movs.filter(m => srFilterOrigins.has(efMovOrigen(m)));

  return [...movs].sort((a, b) =>
    srSortMode === 'fecha'
      ? new Date(b.fecha) - new Date(a.fecha)
      : (a.categoria || '').localeCompare(b.categoria || '')
  );
}

// ── Render ────────────────────────────────────────────────────────────────────
function srRender() {
  srUpdateFilterBadge();
  const container = document.getElementById('sr-results');
  const q = srQuery.trim();
  const hasFilter = q || srFilterCats.size || srFilterOrigins.size || srFilterDesde || srFilterHasta;

  if (!hasFilter) {
    container.innerHTML = '<div class="ef-empty-state">Escribe para buscar o aplica un filtro</div>';
    return;
  }

  const movs = srFilterMovs();

  if (movs.length === 0) {
    container.innerHTML = `<div class="ef-empty-state">Sin resultados${q ? ' para "' + q + '"' : ''}</div>`;
    return;
  }

  const sumEgr = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
  const sumIng = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);

  const rows = srSelectionMode
    ? movs.map(m => srSelectRow(m)).join('')
    : movs.map(m => efMovRow(m)).join('');

  container.innerHTML = `
    <div class="sr-summary">
      <span class="sr-summary-count">${movs.length} resultado${movs.length !== 1 ? 's' : ''}</span>
      ${sumEgr ? `<span class="sr-summary-egr">-$${sumEgr.toLocaleString('es-CL')}</span>` : ''}
      ${sumIng ? `<span class="sr-summary-ing">+$${sumIng.toLocaleString('es-CL')}</span>` : ''}
    </div>
    <div class="ef-movimientos-list">${rows}</div>`;

  // Edit button — always active regardless of mode
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const m = efAllMovs().find(x => x.id === btn.dataset.edit);
      if (m) emOpen(m);
    });
  });

  if (srSelectionMode) {
    container.querySelectorAll('.sr-select-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('[data-edit]')) return;
        const id = row.dataset.id;
        srSeleccionados.has(id) ? srSeleccionados.delete(id) : srSeleccionados.add(id);
        row.classList.toggle('sr-selected', srSeleccionados.has(id));
        row.querySelector('.sr-checkbox').classList.toggle('checked', srSeleccionados.has(id));
        srUpdateConfirmBtn();
      });
    });
  }
}

function srSelectRow(m) {
  const desc  = m.descripcion || m.nombre_descriptivo || '';
  const fecha = fmtDateShort(m.fecha, m.periodo, m.cuotas_totales > 1);
  const sel   = srSeleccionados.has(m.id);
  return `
    <div class="sr-select-row ${sel ? 'sr-selected' : ''}" data-id="${m.id}">
      <div class="sr-checkbox ${sel ? 'checked' : ''}"></div>
      <div class="ef-mov-info" style="flex:1;min-width:0;">
        <div class="ef-mov-desc">${desc}</div>
        <div class="ef-mov-meta">
          <span class="ef-mov-date">${fecha}</span>
          ${m.categoria ? `<span class="ef-cat-pill">${m.categoria}</span>` : ''}
        </div>
      </div>
      <span class="ef-mov-amount ${m.tipo}">${m.tipo === 'egreso' ? '-' : '+'}$${m.monto.toLocaleString('es-CL')}</span>
      <button class="ef-mov-edit" data-edit="${m.id}" title="Editar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>`;
}

function srUpdateConfirmBtn() {
  if (!srSelectionMode) return;
  const n   = srSeleccionados.size;
  const btn = document.getElementById('sr-confirm-btn');
  btn.textContent = n > 0 ? `Confirmar (${n})` : 'Confirmar';
  btn.disabled    = n === 0;
  btn.style.opacity = n === 0 ? '.4' : '1';
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function srUpdateFilterBadge() {
  let count = 0;
  if (srFilterDesde || srFilterHasta) count++;
  if (srFilterCats.size)   count++;
  if (srFilterOrigins.size) count++;
  const btn = document.getElementById('sr-filter-btn');
  if (count > 0) {
    btn.style.cssText += ';border-color:var(--danger);color:var(--danger);background:rgba(192,57,43,0.06)';
    btn.textContent = `Filtros (${count})`;
  } else {
    btn.style.cssText += ';border-color:var(--border);color:var(--text-secondary);background:var(--bg-elevated)';
    btn.textContent = 'Filtros';
  }
}

function srOpenFilterPanel() {
  document.getElementById('sr-filter-desde').value = srFilterDesde;
  document.getElementById('sr-filter-hasta').value = srFilterHasta;
  srBuildCatChips();
  srBuildOriginChips();
  document.getElementById('sr-filter-panel').style.display = 'block';
  document.getElementById('sr-main').style.display = 'none';
  document.getElementById('sr-confirm-bar').style.display = 'none';
}

function srCloseFilterPanel() {
  document.getElementById('sr-filter-panel').style.display = 'none';
  document.getElementById('sr-main').style.display = '';
  if (srSelectionMode) document.getElementById('sr-confirm-bar').style.display = '';
}

function srBuildCatChips() {
  const allCats   = [...new Set(efAllMovs().map(m => m.categoria || 'Por Clasificar'))].sort();
  const container = document.getElementById('sr-filter-cats');
  container.innerHTML = allCats.map(cat => {
    const color  = catColor(cat);
    const active = srFilterCats.has(cat);
    return `<button class="ef-cat-chip" data-cat="${cat}" style="
      display:flex;align-items:center;gap:5px;padding:6px 11px;border-radius:20px;cursor:pointer;font-size:11px;font-family:inherit;transition:all 0.12s;
      border:1.5px solid ${active ? color : 'var(--border)'};
      background:${active ? color + '22' : 'transparent'};
      color:${active ? color : 'var(--text-secondary)'};
      font-weight:${active ? '600' : '400'};">
      <div style="width:6px;height:6px;border-radius:50%;background:${active ? color : 'var(--text-secondary)'};flex-shrink:0;"></div>
      ${cat}
    </button>`;
  }).join('');
  container.querySelectorAll('.ef-cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.cat;
      srFilterCats.has(cat) ? srFilterCats.delete(cat) : srFilterCats.add(cat);
      srBuildCatChips(); srRender();
    });
  });
}

function srBuildOriginChips() {
  const ORIGINS = ['CC BCH', 'CC SAN', 'TC BCH', 'TC SAN', 'Efectivo'];
  const COLORS  = { 'CC BCH': 'var(--bch-color)', 'TC BCH': 'var(--bch-color)', 'CC SAN': 'var(--san-color)', 'TC SAN': 'var(--san-color)', 'Efectivo': '#888' };
  const container = document.getElementById('sr-filter-origins');
  container.innerHTML = ORIGINS.map(orig => {
    const color  = COLORS[orig] || '#888';
    const active = srFilterOrigins.has(orig);
    return `<button class="ef-origin-chip" data-origin="${orig}" style="
      display:flex;align-items:center;gap:5px;padding:6px 11px;border-radius:20px;cursor:pointer;font-size:11px;font-family:inherit;transition:all 0.12s;
      border:1.5px solid ${active ? color : 'var(--border)'};
      background:${active ? 'rgba(26,122,74,0.12)' : 'transparent'};
      color:${active ? color : 'var(--text-secondary)'};
      font-weight:${active ? '600' : '400'};">
      <div style="width:6px;height:6px;border-radius:50%;background:${active ? color : 'var(--text-secondary)'};flex-shrink:0;"></div>
      ${orig}
    </button>`;
  }).join('');
  container.querySelectorAll('.ef-origin-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const orig = chip.dataset.origin;
      srFilterOrigins.has(orig) ? srFilterOrigins.delete(orig) : srFilterOrigins.add(orig);
      srBuildOriginChips(); srRender();
    });
  });
}

// ── Listeners ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sr-close').addEventListener('click', srClose);
  document.getElementById('sr-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('sr-overlay')) srClose();
  });
  document.getElementById('sr-confirm-btn').addEventListener('click', srConfirm);

  document.getElementById('sr-search').addEventListener('input', e => {
    srQuery = e.target.value;
    document.getElementById('sr-search-clear').style.display = srQuery ? 'block' : 'none';
    srRender();
  });
  document.getElementById('sr-search-clear').addEventListener('click', () => {
    srQuery = '';
    document.getElementById('sr-search').value = '';
    document.getElementById('sr-search-clear').style.display = 'none';
    document.getElementById('sr-search').focus();
    srRender();
  });

  document.getElementById('sr-sort-toggle').addEventListener('click', () => {
    srSortMode = srSortMode === 'fecha' ? 'categoria' : 'fecha';
    document.getElementById('sr-sort-toggle').textContent = srSortMode === 'fecha' ? 'Fecha' : 'Categoría';
    srRender();
  });

  document.getElementById('sr-filter-btn').addEventListener('click', srOpenFilterPanel);
  document.getElementById('sr-filter-back').addEventListener('click', srCloseFilterPanel);

  document.getElementById('sr-filter-desde').addEventListener('change', e => { srFilterDesde = e.target.value; srRender(); });
  document.getElementById('sr-filter-hasta').addEventListener('change', e => { srFilterHasta = e.target.value; srRender(); });
  document.getElementById('sr-filter-clear-dates').addEventListener('click', () => {
    srFilterDesde = ''; srFilterHasta = '';
    document.getElementById('sr-filter-desde').value = '';
    document.getElementById('sr-filter-hasta').value = '';
    srRender();
  });
  document.getElementById('sr-filter-clear-cats').addEventListener('click', () => { srFilterCats = new Set(); srBuildCatChips(); srRender(); });
  document.getElementById('sr-filter-clear-origins').addEventListener('click', () => { srFilterOrigins = new Set(); srBuildOriginChips(); srRender(); });
  document.getElementById('sr-filter-clear-all').addEventListener('click', () => {
    srFilterDesde = ''; srFilterHasta = '';
    srFilterCats = new Set(); srFilterOrigins = new Set();
    document.getElementById('sr-filter-desde').value = '';
    document.getElementById('sr-filter-hasta').value = '';
    srBuildCatChips(); srBuildOriginChips(); srRender();
  });
});
