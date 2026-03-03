// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  efectivo.js — View Movimientos: render, filtros, búsqueda, period tabs    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── Period tabs (shared builder) ──────────────────────────────────────────────
function buildPeriodTabs(containerId, activeRef, onSelect) {
  const periods = efGetPeriods();
  if (!activeRef.value || !periods.includes(activeRef.value)) {
    activeRef.value = periods[0];
  }
  const container = document.getElementById(containerId);
  container.innerHTML = periods.map(p => `
    <button class="ef-period-tab ${p === activeRef.value ? 'active' : ''}" data-period="${p}">
      ${efPeriodLabel(p)}
    </button>
  `).join('');
  container.querySelectorAll('.ef-period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeRef.value = btn.dataset.period;
      onSelect(activeRef.value);
    });
  });
}

// ── Multi-select period tabs for Efectivo ─────────────────────────────────────
let efPeriodosSeleccionados = new Set(); // vacío = todos

function buildEfPeriodTabs() {
  const periods = efGetPeriods();
  const lastPeriod = periods[periods.length - 1]; // el período futuro es el último
  // Si no hay selección, seleccionar solo los períodos con corte UC (períodos "reales")
  if (efPeriodosSeleccionados.size === 0) {
    const ucPeriods = new Set(UC_CORTES.map(c => c.id));
    periods.forEach(p => { if (ucPeriods.has(p)) efPeriodosSeleccionados.add(p); });
  }
  const container = document.getElementById('ef-period-tabs');
  const allMovPeriods = new Set(efAllMovs().map(m => m.periodo));
  container.innerHTML = periods.map(p => {
    const hasDatos = allMovPeriods.has(p);
    const isFuture = !hasDatos;
    const isActive = efPeriodosSeleccionados.has(p);
    return `<button class="ef-period-tab ${isActive ? 'active' : ''} ${isFuture ? 'future' : ''}" data-period="${p}">
      <span class="tab-label">${efPeriodLabel(p, true)}</span>
      <span class="tab-dot"></span>
    </button>`;
  }).join('');

  container.querySelectorAll('.ef-period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.period;
      if (efPeriodosSeleccionados.has(p)) {
        if (efPeriodosSeleccionados.size > 1) efPeriodosSeleccionados.delete(p);
      } else {
        efPeriodosSeleccionados.add(p);
      }
      buildEfPeriodTabs();
      efRenderMovimientos(efMovsForPeriodos(efPeriodosSeleccionados));
    });
  });
}

// ── State ─────────────────────────────────────────────────────────────────────
const efPeriodoRef = { value: null }; // kept for Resumen compatibility
let efSortMode = 'categoria';
let efSearchQuery = '';
let efFilterDesde = '';
let efFilterHasta = '';
let efFilterCats = new Set(); // vacío = todas
let efFilterOrigins = new Set(); // vacío = todos

function fmtDateShort(dateStr, periodo) {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const [, mo, d] = dateStr.split('-');
  // Si la fecha es la fecha de corte del período, mostrar solo el mes (es referencial)
  const corte = periodo ? UC_CORTES.find(c => c.id === periodo) : null;
  const esFechaCorte = corte && dateStr === corte.hasta;
  return esFechaCorte
    ? months[parseInt(mo) - 1]
    : `${parseInt(d)} ${months[parseInt(mo) - 1]}`;
}

// ── Render movimientos ────────────────────────────────────────────────────────
function efRenderMovimientos(movs) {
  const container = document.getElementById('ef-movimientos-container');

  // Apply search filter
  const query = efSearchQuery.trim().toLowerCase();
  if (query) {
    movs = movs.filter(m =>
      (m.descripcion || m.nombre_descriptivo || '').toLowerCase().includes(query) ||
      (m.categoria || '').toLowerCase().includes(query) ||
      (m.medio_pago || '').toLowerCase().includes(query) ||
      (m.nota || '').toLowerCase().includes(query)
    );
  }

  // Apply date range filter
  if (efFilterDesde && efFilterHasta) {
    movs = movs.filter(m => m.fecha >= efFilterDesde && m.fecha <= efFilterHasta);
  } else if (efFilterDesde) {
    movs = movs.filter(m => m.fecha === efFilterDesde);
  } else if (efFilterHasta) {
    movs = movs.filter(m => m.fecha <= efFilterHasta);
  }

  // Apply category filter
  if (efFilterCats.size > 0) movs = movs.filter(m => efFilterCats.has(m.categoria || 'Por Clasificar'));

  // Apply origin filter
  if (efFilterOrigins.size > 0) movs = movs.filter(m => efFilterOrigins.has(efMovOrigen(m)));

  if (movs.length === 0) {
    container.innerHTML = `<div class="ef-empty-state">${query ? 'Sin resultados para "' + query + '"' : 'Sin movimientos registrados<br>para este período'}</div>`;
    return;
  }

  let html = '<div class="ef-movimientos-list">';

  if (efSortMode === 'fecha') {
    // ── Por fecha: una sola lista ordenada desc ──────────────────────────────
    html += movs.map(m => efMovRow(m)).join('');
  } else {
    // ── Por categoría: agrupado ──────────────────────────────────────────────
    const bycat = {};
    movs.forEach(m => {
      const cat = m.categoria || 'Por Clasificar';
      if (!bycat[cat]) bycat[cat] = [];
      bycat[cat].push(m);
    });

    const cats = Object.keys(bycat).sort((a,b) => {
      const tipoA = catTipo(a), tipoB = catTipo(b);
      if (tipoA !== tipoB) {
        if (tipoA === 'ingreso') return 1;
        if (tipoB === 'ingreso') return -1;
      }
      const ta = bycat[a].filter(m => m.tipo === 'egreso').reduce((s,m) => s + m.monto, 0);
      const tb = bycat[b].filter(m => m.tipo === 'egreso').reduce((s,m) => s + m.monto, 0);
      return tb - ta;
    });

    cats.forEach(cat => {
      const items = bycat[cat];
      const egr = items.filter(m => m.tipo === 'egreso').reduce((s,m) => s + m.monto, 0);
      const ing = items.filter(m => m.tipo === 'ingreso').reduce((s,m) => s + m.monto, 0);
      const net = ing - egr;
      const color = catColor(cat);

      html += `
        <div class="ef-section-header">
          <div style="display:flex;align-items:center;gap:7px;">
            <div style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;"></div>
            <span class="ef-section-cat">${cat}</span>
          </div>
          <span class="ef-section-total" style="color:${net >= 0 ? 'var(--accent)' : 'var(--text-secondary)'}">
            ${net >= 0 ? '+' : ''}$${Math.abs(net).toLocaleString('es-CL')}
          </span>
        </div>`;
      items.forEach(m => { html += efMovRow(m); });
    });
  }

  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      EF_MOVS = EF_MOVS.filter(m => m.id !== btn.dataset.delete);
      efSave(EF_MOVS);
      efRender();
    });
  });

  // Expand/collapse on row click
  let expandedId = null;
  container.querySelectorAll('.ef-mov-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('[data-delete]')) return;
      const id = row.dataset.id;
      if (expandedId && expandedId !== id) {
        const prev = container.querySelector(`.ef-mov-row[data-id="${expandedId}"]`);
        if (prev) prev.classList.remove('expanded');
      }
      row.classList.toggle('expanded');
      expandedId = row.classList.contains('expanded') ? id : null;
    });
  });
}

function efMovRow(m) {
  const isEf = m.fuente === 'ef';
  const isTc = m.fuente === 'tc';
  const desc = m.descripcion || m.nombre_descriptivo || '';
  const medioLabel = m.medio_pago
    ? m.medio_pago.replace('Cuenta Corriente ', 'CC ').replace('Tarjeta de Crédito ', 'TC ').trim()
    : '';
  const medio = medioLabel ? `<span class="ef-cat-pill">${medioLabel}</span>` : '';
  const cuotaPill = isTc && m.cuotas_totales > 1
    ? `<span class="ef-cat-pill">${m.cuota_actual}/${m.cuotas_totales}</span>` : '';
  const nota = m.nota ? `<span class="ef-cat-pill">${m.nota}</span>` : '';

  // Detail panel rows
  const detailRows = [];
  if (m.categoria) detailRows.push(['Categoría', m.categoria]);
  if (m.medio_pago) detailRows.push(['Origen', m.medio_pago]);
  if (m.nombre_original) detailRows.push(['Original', m.nombre_original]);
  if (isTc && m.cuotas_totales > 1) detailRows.push(['Cuota', `${m.cuota_actual} de ${m.cuotas_totales}`]);

  const detailHTML = detailRows.map(([label, value]) => `
    <span class="ef-mov-detail-label">${label}</span>
    <span class="ef-mov-detail-value">${value}</span>
  `).join('');

  return `
    <div class="ef-mov-row" data-id="${m.id}">
      <div class="ef-mov-main">
        <div class="ef-mov-info">
          <div class="ef-mov-desc">${desc}</div>
          <div class="ef-mov-meta">
            <span class="ef-mov-date">${fmtDateShort(m.fecha, m.periodo)}</span>
            ${medio}${cuotaPill}${nota}
          </div>
        </div>
        <span class="ef-mov-amount ${m.tipo}">${m.tipo === 'egreso' ? '-' : '+'}$${m.monto.toLocaleString('es-CL')}</span>
        ${isEf ? `<button class="ef-mov-delete" data-delete="${m.id}" title="Eliminar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>` : `<div style="width:21px;"></div>`}
      </div>
      ${detailRows.length ? `<div class="ef-mov-detail"><div class="ef-mov-detail-grid">${detailHTML}</div></div>` : ''}
    </div>`;
}

function efRender() {
  buildEfPeriodTabs();
  efRenderMovimientos(efMovsForPeriodos(efPeriodosSeleccionados));
  const el = document.getElementById('header-date-efectivo');
  if (el) el.textContent = new Date().toLocaleDateString('es-CL', { day:'numeric', month:'long', year:'numeric' });
  const lbl = document.getElementById('ef-sort-label');
  const ico = document.getElementById('ef-sort-icon');
  if (lbl) lbl.textContent = efSortMode === 'categoria' ? 'Categoría' : 'Fecha';
  if (ico) {
    ico.innerHTML = efSortMode === 'categoria'
      ? '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'  // tag
      : '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'; // calendar
  }
}

// ── Filter modal ──────────────────────────────────────────────────────────────
function efApplyFilters() {
  efUpdateFilterBadge();
  efRenderMovimientos(efMovsForPeriodos(efPeriodosSeleccionados));
}

function efUpdateFilterBadge() {
  const badge  = document.getElementById('ef-filter-badge');
  const btn    = document.getElementById('ef-filter-btn');
  const icon   = document.getElementById('ef-filter-icon');
  const label  = document.getElementById('ef-filter-label');
  let count = 0;
  if (efFilterDesde || efFilterHasta) count++;
  if (efFilterCats.size > 0) count++;
  if (efFilterOrigins.size > 0) count++;
  badge.textContent = count;
  badge.style.display = 'none'; // badge no necesario — el botón ya cambia
  if (count > 0) {
    btn.style.borderColor = 'var(--danger)';
    btn.style.color = 'var(--danger)';
    btn.style.background = 'rgba(192,57,43,0.06)';
    icon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
    label.textContent = 'Limpiar';
    btn.dataset.hasFilters = '1';
  } else {
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--text-secondary)';
    btn.style.background = 'var(--bg-elevated)';
    icon.innerHTML = '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>';
    label.textContent = 'Filtrar';
    btn.dataset.hasFilters = '0';
  }
}

function efBuildCategoryChips() {
  const allCats = [...new Set(efAllMovs().map(m => m.categoria || 'Por Clasificar'))].sort();
  const container = document.getElementById('ef-filter-cats');
  container.innerHTML = allCats.map(cat => {
    const color = catColor(cat);
    const isGray = color === '#888888' || color === 'var(--text-secondary)';
    const active = efFilterCats.size === 0 || efFilterCats.has(cat);
    const activeBg = isGray ? 'rgba(255,255,255,0.15)' : color + '33';
    const activeBorder = isGray ? 'rgba(255,255,255,0.5)' : color;
    const activeColor = isGray ? 'var(--text-primary)' : color;
    return `<button class="ef-cat-chip" data-cat="${cat}" style="
      display:flex;align-items:center;gap:5px;padding:6px 11px;border-radius:20px;cursor:pointer;font-size:11px;font-family:inherit;transition:all 0.12s;
      border: 1.5px solid ${active ? activeBorder : 'var(--border)'};
      background: ${active ? activeBg : 'transparent'};
      color: ${active ? activeColor : 'var(--text-secondary)'};
      font-weight: ${active ? '600' : '400'};
    ">
      <div style="width:6px;height:6px;border-radius:50%;background:${active ? color : 'var(--text-secondary)'};flex-shrink:0;"></div>
      ${cat}
    </button>`;
  }).join('');

  container.querySelectorAll('.ef-cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.cat;
      const allCatsList = [...new Set(efAllMovs().map(m => m.categoria || 'Por Clasificar'))];
      if (efFilterCats.size === 0) {
        // Todas activas → dejar solo esta
        efFilterCats = new Set(allCatsList.filter(c => c !== cat));
      } else if (efFilterCats.has(cat)) {
        efFilterCats.delete(cat);
        if (efFilterCats.size === 0) efFilterCats = new Set(); // todas
      } else {
        efFilterCats.add(cat);
        if (efFilterCats.size === allCatsList.length) efFilterCats = new Set(); // todas = sin filtro
      }
      efBuildCategoryChips();
      efApplyFilters();
    });
  });
}

function efBuildOriginChips() {
  const ORIGINS = ['CC BCH', 'CC SAN', 'TC BCH', 'TC SAN', 'Efectivo'];
  const container = document.getElementById('ef-filter-origins');
  const ORIGIN_COLORS = {
    'CC BCH': 'var(--bch-color)', 'TC BCH': 'var(--bch-color)',
    'CC SAN': 'var(--san-color)', 'TC SAN': 'var(--san-color)',
    'Efectivo': '#888'
  };
  container.innerHTML = ORIGINS.map(orig => {
    const color = ORIGIN_COLORS[orig] || '#888';
    const active = efFilterOrigins.size === 0 || efFilterOrigins.has(orig);
    const isGray = color === '#888';
    const activeBg = isGray ? 'rgba(255,255,255,0.15)' : color.startsWith('var') ? 'rgba(26,122,74,0.15)' : color + '33';
    const activeBorder = isGray ? 'rgba(150,150,150,0.6)' : color;
    const activeColor = isGray ? 'var(--text-primary)' : color;
    return `<button class="ef-origin-chip" data-origin="${orig}" style="
      display:flex;align-items:center;gap:5px;padding:6px 11px;border-radius:20px;cursor:pointer;font-size:11px;font-family:inherit;transition:all 0.12s;
      border: 1.5px solid ${active ? activeBorder : 'var(--border)'};
      background: ${active ? activeBg : 'transparent'};
      color: ${active ? activeColor : 'var(--text-secondary)'};
      font-weight: ${active ? '600' : '400'};
    ">
      <div style="width:6px;height:6px;border-radius:50%;background:${active ? color : 'var(--text-secondary)'};flex-shrink:0;"></div>
      ${orig}
    </button>`;
  }).join('');

  container.querySelectorAll('.ef-origin-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const orig = chip.dataset.origin;
      if (efFilterOrigins.size === 0) {
        efFilterOrigins = new Set(ORIGINS.filter(o => o !== orig));
      } else if (efFilterOrigins.has(orig)) {
        efFilterOrigins.delete(orig);
        if (efFilterOrigins.size === 0) efFilterOrigins = new Set();
      } else {
        efFilterOrigins.add(orig);
        if (efFilterOrigins.size === ORIGINS.length) efFilterOrigins = new Set();
      }
      efBuildOriginChips();
      efApplyFilters();
    });
  });
}

function efOpenFilterModal() {
  document.getElementById('ef-filter-desde').value = efFilterDesde;
  document.getElementById('ef-filter-hasta').value = efFilterHasta;
  efBuildCategoryChips();
  efBuildOriginChips();
  document.getElementById('main-nav').style.display = 'none';
  document.getElementById('ef-filter-overlay').style.display = 'block';
}

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('ef-sort-toggle').addEventListener('click', () => {
  efSortMode = efSortMode === 'categoria' ? 'fecha' : 'categoria';
  efRender();
});

document.getElementById('ef-search').addEventListener('input', e => {
  efSearchQuery = e.target.value;
  document.getElementById('ef-search-clear').style.display = efSearchQuery ? 'block' : 'none';
  efRenderMovimientos(efMovsForPeriodos(efPeriodosSeleccionados));
});

document.getElementById('ef-search-clear').addEventListener('click', () => {
  efSearchQuery = '';
  document.getElementById('ef-search').value = '';
  document.getElementById('ef-search-clear').style.display = 'none';
  document.getElementById('ef-search').focus();
  efRenderMovimientos(efMovsForPeriodos(efPeriodosSeleccionados));
});

document.getElementById('ef-filter-btn').addEventListener('click', () => {
  if (document.getElementById('ef-filter-btn').dataset.hasFilters === '1') {
    efFilterDesde = '';
    efFilterHasta = '';
    efFilterCats = new Set();
    efFilterOrigins = new Set();
    efApplyFilters();
  } else {
    efOpenFilterModal();
  }
});

document.getElementById('ef-filter-close').addEventListener('click', () => {
  document.getElementById('ef-filter-overlay').style.display = 'none';
  document.getElementById('main-nav').style.display = '';
});
document.getElementById('ef-filter-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('ef-filter-overlay')) {
    document.getElementById('ef-filter-overlay').style.display = 'none';
    document.getElementById('main-nav').style.display = '';
  }
});

// Fechas — aplicar en tiempo real
document.getElementById('ef-filter-desde').addEventListener('change', e => {
  efFilterDesde = e.target.value;
  efApplyFilters();
});
document.getElementById('ef-filter-hasta').addEventListener('change', e => {
  efFilterHasta = e.target.value;
  efApplyFilters();
});

// Limpiar fechas
document.getElementById('ef-filter-clear-dates').addEventListener('click', () => {
  efFilterDesde = '';
  efFilterHasta = '';
  document.getElementById('ef-filter-desde').value = '';
  document.getElementById('ef-filter-hasta').value = '';
  efApplyFilters();
});

// Limpiar categorías
document.getElementById('ef-filter-cats-toggle').addEventListener('click', () => {
  efFilterCats = new Set();
  efBuildCategoryChips();
  efApplyFilters();
});

// Limpiar orígenes
document.getElementById('ef-filter-origins-toggle').addEventListener('click', () => {
  efFilterOrigins = new Set();
  efBuildOriginChips();
  efApplyFilters();
});

// Limpiar todo
document.getElementById('ef-filter-clear').addEventListener('click', () => {
  efFilterDesde = '';
  efFilterHasta = '';
  efFilterCats = new Set();
  efFilterOrigins = new Set();
  document.getElementById('ef-filter-desde').value = '';
  document.getElementById('ef-filter-hasta').value = '';
  efBuildCategoryChips();
  efBuildOriginChips();
  efApplyFilters();
});
