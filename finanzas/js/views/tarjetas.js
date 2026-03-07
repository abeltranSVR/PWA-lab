// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  tarjetas.js — View Tarjetas: renderBCH, renderSAN, computeCard            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── STATE ─────────────────────────────────────────────────────────────────────
const CARD_DATES = { 'TC Banco de Chile': { curr: null, next: null }, 'TC Santander': { curr: null, next: null } };
let tcPeriodoSeleccionado = null; // null = período activo (default)

function buildTcPeriodTabs() {
  const container = document.getElementById('tc-period-tabs');
  if (!container) return;
  const periods = efGetPeriods().filter(p => {
    // Solo períodos con datos TC
    return MOVIMIENTOS.some(m => m.periodo === p &&
      (m.medio_pago === 'TC Banco de Chile' || m.medio_pago === 'TC Santander'));
  });

  const activoPeriodo = UC_CORTES[UC_CORTES.length - 1].id;
  if (!tcPeriodoSeleccionado) tcPeriodoSeleccionado = activoPeriodo;

  const periodoHoy = typeof fechaToPeriodoUC === 'function'
    ? fechaToPeriodoUC(new Date().toISOString().split('T')[0]) : null;

  container.innerHTML = periods.map(p => {
    const isCurrent = p === periodoHoy;
    const isActive  = p === tcPeriodoSeleccionado;
    return `<button class="ef-period-tab ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}" data-tcperiod="${p}">
      <span class="tab-label">${efPeriodLabel(p, true)}</span>
      <span class="tab-dot"></span>
    </button>`;
  }).join('');

  container.querySelectorAll('[data-tcperiod]').forEach(btn => {
    btn.addEventListener('click', () => {
      tcPeriodoSeleccionado = btn.dataset.tcperiod;
      // Resetear fechas manuales para que se recalculen con el nuevo período
      CARD_DATES['TC Banco de Chile']._manual = false;
      CARD_DATES['TC Santander']._manual = false;
      buildTcPeriodTabs();
      renderBCH(); renderSAN();
    });
  });
}

function periodFromDate(dateStr) { return dateStr.slice(0,4) + dateStr.slice(5,7); }

function fmtDateLabel(dateStr) {
  if (!dateStr) return '—';
  const [y,m] = dateStr.split('-');
  const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  return `${months[parseInt(m)-1]} ${y.slice(2)}`;
}

// ── COMPUTE ───────────────────────────────────────────────────────────────────
function computeCard(banco) {
  const cupoTotal = CUPOS[banco];
  const todosMovs = MOVIMIENTOS.filter(r => r.medio_pago === banco);

  // Sin datos para este banco
  if (!todosMovs.length) return { cupoTotal, utilizado: 0, disponible: cupoTotal, currGasto: 0, currPagado: 0, nextPagado: 0, nextGasto: 0, curr: null, next: null };

  const periodos = [...new Set(todosMovs.map(r => r.periodo))].sort();

  // Usar período seleccionado en tabs (o el activo por defecto)
  if (!CARD_DATES[banco]._manual) {
    const currPeriodo = tcPeriodoSeleccionado || UC_CORTES[UC_CORTES.length - 1].id;
    CARD_DATES[banco].curr = `${currPeriodo.slice(0,4)}-${currPeriodo.slice(4,6)}-05`;
    const np = nextPeriod(currPeriodo);
    CARD_DATES[banco].next = `${np.slice(0,4)}-${np.slice(4,6)}-05`;
  }

  const curr = periodFromDate(CARD_DATES[banco].curr);
  const next = periodFromDate(CARD_DATES[banco].next);

  const currMovs = todosMovs.filter(r => r.periodo === curr);
  const nextMovs = todosMovs.filter(r => r.periodo === next);

  const gastosHastaCurr = todosMovs.filter(r => r.periodo <= curr && r.valor_cuota > 0).reduce((s,r) => s + r.valor_cuota, 0);
  const pagosHastaPrev  = todosMovs.filter(r => r.periodo <  curr && r.valor_cuota < 0).reduce((s,r) => s + r.valor_cuota, 0);
  const currPagado      = currMovs.filter(r => r.valor_cuota < 0).reduce((s,r) => s + r.valor_cuota, 0);
  const nextPagado      = nextMovs.filter(r => r.valor_cuota < 0).reduce((s,r) => s + r.valor_cuota, 0);

  // Saldo del período actual = gastos acumulados hasta curr − todos los pagos hasta curr inclusive
  const currGasto = gastosHastaCurr + pagosHastaPrev + currPagado;
  // Próxima facturación = suma de todos los movimientos hasta el período siguiente inclusive
  const nextGasto = todosMovs.filter(r => r.periodo <= next).reduce((s,r) => s + r.valor_cuota, 0);

  // Cupo utilizado: suma total de todos los movimientos
  const utilizado = todosMovs.reduce((s,r) => s + r.valor_cuota, 0);
  const disponible = cupoTotal - utilizado;

  return { cupoTotal, utilizado, disponible, currGasto, currPagado, nextPagado, nextGasto, curr, next };
}

// ── RENDER ────────────────────────────────────────────────────────────────────
const PENCIL = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

function renderBCH() {
  const banco = 'TC Banco de Chile';
  buildTcPeriodTabs();

  const data = computeCard(banco);
  const pct = Math.max(0, Math.round((data.utilizado / data.cupoTotal) * 100));

  document.getElementById('bch-total').textContent = fmtCLP(data.cupoTotal);
  document.getElementById('bch-disponible').textContent = fmtCLP(data.disponible);
  document.getElementById('bch-utilizado').textContent = fmtCLP(data.utilizado);
  document.getElementById('bch-pct').textContent = pct;

  setTimeout(() => {
    document.getElementById('bch-bar').style.width = pct + '%';
  }, 200);

  const sec = document.getElementById('bch-facturacion');
  sec.innerHTML = `
    <div class="facturacion-col">
      <span class="facturacion-name">Período actual</span>
      <div class="facturacion-date-wrap">
        <span class="date-label">${fmtDateLabel(CARD_DATES[banco].curr)}</span>
        <span class="date-edit-btn" id="bch-btn-curr">${PENCIL}</span>
        <input type="date" class="date-input" id="bch-date-curr" value="${CARD_DATES[banco].curr}">
      </div>
      <span class="facturacion-gross fmt-clp">${fmtCLP(data.currGasto)}</span>
      ${(data.currPagado + data.nextPagado) < 0 ? `<span class="facturacion-pagado">Pagado ${fmtCLP(data.currPagado + data.nextPagado)}</span>` : ''}
    </div>
    <div class="facturacion-col facturacion-next">
      <span class="facturacion-name">Próxima facturación</span>
      <div class="facturacion-date-wrap">
        <span class="date-label">${fmtDateLabel(CARD_DATES[banco].next)}</span>
        <span class="date-edit-btn" id="bch-btn-next">${PENCIL}</span>
        <input type="date" class="date-input" id="bch-date-next" value="${CARD_DATES[banco].next}">
      </div>
      <span class="facturacion-gross fmt-clp">${data.nextGasto > 0 ? fmtCLP(data.nextGasto) : '—'}</span>
      ${data.nextGasto > 0 ? '<span class="pending-tag">PROYECTADO</span>' : ''}
    </div>
  `;

  const inpCurr = document.getElementById('bch-date-curr');
  const inpNext = document.getElementById('bch-date-next');
  document.getElementById('bch-btn-curr').addEventListener('click', () => { try { inpCurr.showPicker(); } catch(e) { inpCurr.click(); } });
  document.getElementById('bch-btn-next').addEventListener('click', () => { try { inpNext.showPicker(); } catch(e) { inpNext.click(); } });
  inpCurr.addEventListener('change', e => { CARD_DATES[banco].curr = e.target.value; CARD_DATES[banco]._manual = true; renderBCH(); });
  inpNext.addEventListener('change', e => { CARD_DATES[banco].next = e.target.value; CARD_DATES[banco]._manual = true; renderBCH(); });
}

function renderSAN() {
  const banco = 'TC Santander';

  const data = computeCard(banco);
  const pct = Math.max(0, Math.round((data.utilizado / data.cupoTotal) * 100));
  const overLimit = data.disponible < 0;

  document.getElementById('san-total').textContent = fmtCLP(data.cupoTotal);
  document.getElementById('san-disponible').textContent = fmtCLP(data.disponible);
  document.getElementById('san-disponible').style.color = overLimit ? 'var(--danger)' : '';
  document.getElementById('san-utilizado').textContent = fmtCLP(data.utilizado);
  document.getElementById('san-pct').textContent = Math.min(pct, 100);

  setTimeout(() => {
    document.getElementById('san-bar').style.width = Math.min(pct, 100) + '%';
    if (overLimit) document.getElementById('san-bar').style.background = 'var(--danger)';
  }, 200);

  const sec = document.getElementById('san-facturacion');
  sec.innerHTML = `
    <div class="facturacion-col">
      <span class="facturacion-name">Período actual</span>
      <div class="facturacion-date-wrap">
        <span class="date-label">${fmtDateLabel(CARD_DATES[banco].curr)}</span>
        <span class="date-edit-btn" id="san-btn-curr">${PENCIL}</span>
        <input type="date" class="date-input" id="san-date-curr" value="${CARD_DATES[banco].curr}">
      </div>
      <span class="facturacion-gross fmt-clp">${fmtCLP(data.currGasto)}</span>
      ${(data.currPagado + data.nextPagado) < 0 ? `<span class="facturacion-pagado">Pagado ${fmtCLP(data.currPagado + data.nextPagado)}</span>` : ''}
    </div>
    <div class="facturacion-col facturacion-next">
      <span class="facturacion-name">Próxima facturación</span>
      <div class="facturacion-date-wrap">
        <span class="date-label">${fmtDateLabel(CARD_DATES[banco].next)}</span>
        <span class="date-edit-btn" id="san-btn-next">${PENCIL}</span>
        <input type="date" class="date-input" id="san-date-next" value="${CARD_DATES[banco].next}">
      </div>
      <span class="facturacion-gross fmt-clp">${data.nextGasto > 0 ? fmtCLP(data.nextGasto) : '—'}</span>
      ${data.nextGasto > 0 ? '<span class="pending-tag">PROYECTADO</span>' : ''}
    </div>
  `;

  const inpCurr = document.getElementById('san-date-curr');
  const inpNext = document.getElementById('san-date-next');
  document.getElementById('san-btn-curr').addEventListener('click', () => { try { inpCurr.showPicker(); } catch(e) { inpCurr.click(); } });
  document.getElementById('san-btn-next').addEventListener('click', () => { try { inpNext.showPicker(); } catch(e) { inpNext.click(); } });
  inpCurr.addEventListener('change', e => { CARD_DATES[banco].curr = e.target.value; CARD_DATES[banco]._manual = true; renderSAN(); });
  inpNext.addEventListener('change', e => { CARD_DATES[banco].next = e.target.value; CARD_DATES[banco]._manual = true; renderSAN(); });
}

function renderHeader() {
  const now = new Date();
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  document.getElementById('header-date').textContent = now.toLocaleDateString('es-CL', opts);
}
