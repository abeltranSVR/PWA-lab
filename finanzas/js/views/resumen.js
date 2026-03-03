// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  resumen.js — View Resumen: resRender, breakdown, comparativo, pendientes  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

let resFiltros = new Set();
let resShowAllCats = false;

function resBuildTabs() {
  const periods = efGetPeriods();
  const allMovPeriods = new Set(efAllMovs().map(m => m.periodo));

  // Selección inicial: período más reciente con datos
  if (resFiltros.size === 0) {
    const reciente = periods.find(p => allMovPeriods.has(p));
    if (reciente) resFiltros.add(reciente);
  }

  const container = document.getElementById('res-period-tabs');
  container.innerHTML = periods.map(p => {
    const hasDatos = allMovPeriods.has(p);
    const isActive = resFiltros.has(p);
    return `<button class="ef-period-tab ${isActive ? 'active' : ''} ${!hasDatos ? 'future' : ''}" data-period="${p}">
      <span class="tab-label">${efPeriodLabel(p, true)}</span>
      <span class="tab-dot"></span>
    </button>`;
  }).join('');

  container.querySelectorAll('.ef-period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.period;
      if (resFiltros.has(p)) {
        if (resFiltros.size > 1) resFiltros.delete(p);
      } else {
        resFiltros.add(p);
      }
      resRender();
    });
  });
}

function resRender() {
  resBuildTabs();

  const all = efAllMovs();
  const neutros = new Set(['Pagos TC', 'Préstamos Personales']);
  const movs = resFiltros.size > 0
    ? all.filter(m => resFiltros.has(m.periodo) && !neutros.has(m.categoria))
    : all.filter(m => !neutros.has(m.categoria));

  const ingresos = movs.filter(m => m.tipo === 'ingreso');
  const egresos  = movs.filter(m => m.tipo === 'egreso');
  const totalIng = ingresos.reduce((s,m) => s + m.monto, 0);
  const totalEgr = egresos.reduce((s,m) => s + m.monto, 0);
  const neto = totalIng - totalEgr;

  // Hero
  const heroLabel = resFiltros.size === 1
    ? efPeriodLabel([...resFiltros][0])
    : resFiltros.size > 1
      ? [...resFiltros].sort().map(p => efPeriodLabel(p, true)).join(' · ')
      : 'Todo el año';

  document.getElementById('res-hero-periodo').textContent = heroLabel;

  const netoEl = document.getElementById('res-hero-neto');
  netoEl.textContent = (neto >= 0 ? '+' : '-') + fmtCLP(Math.abs(neto));
  netoEl.className = 'res-hero-neto' + (neto < 0 ? ' negativo' : '');

  document.getElementById('res-kpi-tx-egr').textContent = `${egresos.length} egreso${egresos.length !== 1 ? 's' : ''}`;
  document.getElementById('res-kpi-tx-ing').textContent = `${ingresos.length} ingreso${ingresos.length !== 1 ? 's' : ''}`;
  document.getElementById('res-hero-ing').textContent = '+' + fmtCLP(totalIng);
  document.getElementById('res-hero-egr').textContent = '-' + fmtCLP(totalEgr);

  // Breakdown por categoría
  const bycat = {};
  egresos.forEach(m => {
    const cat = m.categoria || 'Por Clasificar';
    bycat[cat] = (bycat[cat] || 0) + m.monto;
  });
  const cats = Object.keys(bycat).sort((a,b) => bycat[b] - bycat[a]);

  document.getElementById('res-cat-total').textContent = fmtCLP(totalEgr) + ' total';
  resRenderBreakdown(bycat, cats, totalEgr);
  resRenderComparativo(all);
  resRenderPendientes(movs);

  const el = document.getElementById('header-date-resumen');
  if (el) el.textContent = new Date().toLocaleDateString('es-CL', { day:'numeric', month:'long', year:'numeric' }).toUpperCase();
}

function resRenderBreakdown(bycat, cats, totalEgr) {
  const container = document.getElementById('res-breakdown-container');
  const toggleBtn = document.getElementById('res-toggle-all');

  if (cats.length === 0) {
    container.innerHTML = '<div class="ef-empty-state">Sin egresos para este período</div>';
    if (toggleBtn) toggleBtn.style.display = 'none';
    return;
  }

  const visible = resShowAllCats ? cats : cats.slice(0, 7);
  const hidden = cats.length > 7;
  if (toggleBtn) {
    toggleBtn.textContent = resShowAllCats ? 'Ver menos' : 'Ver todo';
    toggleBtn.style.display = hidden ? '' : 'none';
    toggleBtn.onclick = () => { resShowAllCats = !resShowAllCats; resRender(); };
  }

  container.innerHTML = visible.map(cat => {
    const val = bycat[cat];
    const pctTotal = totalEgr > 0 ? Math.round((val / totalEgr) * 100) : 0;
    const color = catColor(cat);
    return `<div class="res-breakdown-row">
      <div class="res-breakdown-row-top">
        <div class="res-breakdown-cat">
          <div class="res-breakdown-dot" style="background:${color}"></div>
          <span class="res-breakdown-name">${cat}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="res-breakdown-pct">${pctTotal > 0 ? pctTotal + '%' : ''}</span>
          <span class="res-breakdown-val" style="color:${color}">${fmtCLP(val)}</span>
        </div>
      </div>
      <div class="res-breakdown-bar-track">
        <div class="res-breakdown-bar-fill" style="width:0%;background:${color}" data-w="${pctTotal}"></div>
      </div>
    </div>`;
  }).join('');

  setTimeout(() => {
    container.querySelectorAll('.res-breakdown-bar-fill').forEach((el, i) => {
      el.style.transition = `width 0.7s cubic-bezier(0.4,0,0.2,1) ${i * 0.04}s`;
      el.style.width = el.dataset.w + '%';
    });
  }, 50);
}

function resRenderComparativo(all) {
  const section = document.getElementById('res-compare-section');
  const neutros = new Set(['Pagos TC', 'Préstamos Personales']);

  // Todos los períodos UC reales, en orden descendente (más reciente primero)
  const periods = UC_CORTES.map(c => c.id).reverse();

  if (periods.length < 2) { section.style.display = 'none'; return; }
  section.style.display = '';

  const totals = periods.map(p => {
    const movs = all.filter(m => m.periodo === p && m.tipo === 'egreso' && !neutros.has(m.categoria));
    return { p, total: movs.reduce((s,m) => s + m.monto, 0) };
  });

  const maxTotal = Math.max(...totals.map(t => t.total));
  const container = document.getElementById('res-compare-bars');

  // totals[0] = más reciente, totals[1] = anterior, totals[2] = más antiguo
  // Delta: cada período vs el siguiente (más antiguo). El último no tiene delta.
  container.innerHTML = totals.map((t, i) => {
    const pct = maxTotal > 0 ? (t.total / maxTotal) * 100 : 0;
    const barColor = 'var(--text-secondary)';
    const prev = totals[i + 1]; // período anterior cronológico
    let delta = '';
    if (prev && prev.total > 0) {
      const d = Math.round(((t.total - prev.total) / prev.total) * 100);
      delta = `<span class="res-compare-delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}%</span>`;
    } else {
      delta = `<span class="res-compare-delta"></span>`;
    }
    return `<div class="res-compare-row">
      <span class="res-compare-label">${efPeriodLabel(t.p, true)}</span>
      <div class="res-compare-bar-wrap">
        <div class="res-compare-bar" style="width:0%;background:${barColor}" data-w="${pct}"></div>
      </div>
      <span class="res-compare-amount">${fmtCLP(t.total)}</span>
      ${delta}
    </div>`;
  }).join('');

  setTimeout(() => {
    container.querySelectorAll('.res-compare-bar').forEach((el, i) => {
      el.style.transition = `width 0.7s cubic-bezier(0.4,0,0.2,1) ${i * 0.07}s`;
      el.style.width = el.dataset.w + '%';
    });
  }, 50);
}

function resRenderPendientes(movs) {
  const pend = movs.filter(m => m.pendiente_reembolso && !m.reembolsado);
  const label = document.getElementById('res-pending-label');
  const card  = document.getElementById('res-pending-card');

  if (pend.length === 0) {
    label.style.display = 'none';
    card.style.display = 'none';
    return;
  }
  label.style.display = '';
  card.style.display = '';

  const total = pend.reduce((s,m) => s + m.monto, 0);
  document.getElementById('res-pending-badge').textContent =
    `${pend.length} item${pend.length > 1 ? 's' : ''} · ${fmtCLP(total)}`;

  document.getElementById('res-pending-container').innerHTML = pend.map(m => `
    <div class="res-pending-row">
      <div>
        <div class="res-pending-name">${m.nombre_descriptivo || m.categoria}</div>
        <div class="res-pending-sub">${efPeriodLabel(m.periodo)}</div>
      </div>
      <div class="res-pending-amount">${fmtCLP(m.monto)}</div>
    </div>
  `).join('');
}
