// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  cortes.js — Modal para editar CORTES_PERIODO                               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function cortesOpen() {
  cortesRenderList();
  document.getElementById('cortes-overlay').style.display = 'block';
  document.getElementById('main-nav').style.display = 'none';
}

function cortesClose() {
  document.getElementById('cortes-overlay').style.display = 'none';
  document.getElementById('main-nav').style.display = '';
}

function cortesRenderList() {
  const list = document.getElementById('cortes-list');
  const sorted = [...CORTES_PERIODO].sort((a, b) => a.periodo.localeCompare(b.periodo));
  list.innerHTML = sorted.map((c, i) => `
    <div class="cortes-row" data-idx="${i}">
      <input class="cortes-input" type="text" placeholder="Período (ej: 202604)" value="${c.periodo}" data-field="periodo">
      <input class="cortes-input" type="date" value="${c.fecha_corte}" data-field="fecha_corte">
      <button class="cortes-del-btn" onclick="cortesDeleteRow(${i})" title="Eliminar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');
  // Guardar referencia al orden actual
  list._sorted = sorted;
}

function cortesAddRow() {
  // Sugiere el mes siguiente al último existente
  const last = [...CORTES_PERIODO].sort((a, b) => a.periodo.localeCompare(b.periodo)).pop();
  let nextPeriodo = '';
  let nextFecha   = '';
  if (last) {
    const y  = parseInt(last.periodo.slice(0, 4));
    const mo = parseInt(last.periodo.slice(4, 6));
    const nextMo = mo === 12 ? 1 : mo + 1;
    const nextY  = mo === 12 ? y + 1 : y;
    nextPeriodo = `${nextY}${String(nextMo).padStart(2, '0')}`;
    // Misma fecha de corte, mes siguiente
    const d = new Date(last.fecha_corte + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    nextFecha = d.toISOString().split('T')[0];
  }
  CORTES_PERIODO.push({ periodo: nextPeriodo, fecha_corte: nextFecha });
  cortesRenderList();
  // Hacer scroll al final y enfocar el primer campo del nuevo row
  const list = document.getElementById('cortes-list');
  list.scrollIntoView({ block: 'end', behavior: 'smooth' });
}

function cortesDeleteRow(idx) {
  const list = document.getElementById('cortes-list');
  const sorted = list._sorted;
  if (!sorted) return;
  const toDelete = sorted[idx];
  const globalIdx = CORTES_PERIODO.findIndex(c => c.periodo === toDelete.periodo && c.fecha_corte === toDelete.fecha_corte);
  if (globalIdx >= 0) CORTES_PERIODO.splice(globalIdx, 1);
  cortesRenderList();
}

function cortesReadForm() {
  const list = document.getElementById('cortes-list');
  const sorted = list._sorted;
  if (!sorted) return;
  document.querySelectorAll('#cortes-list .cortes-row').forEach((row, i) => {
    const periodo    = row.querySelector('[data-field="periodo"]').value.trim();
    const fecha      = row.querySelector('[data-field="fecha_corte"]').value;
    const orig = sorted[i];
    const globalIdx  = CORTES_PERIODO.findIndex(c => c.periodo === orig.periodo && c.fecha_corte === orig.fecha_corte);
    if (globalIdx >= 0) {
      CORTES_PERIODO[globalIdx].periodo    = periodo;
      CORTES_PERIODO[globalIdx].fecha_corte = fecha;
    }
  });
}

async function cortesSubmit() {
  cortesReadForm();

  // Validar: todos deben tener período y fecha
  for (const c of CORTES_PERIODO) {
    if (!c.periodo || !c.fecha_corte) { showToast('⚠️ Completa todos los campos'); return; }
    if (!/^\d{6}$/.test(c.periodo))   { showToast(`⚠️ Período inválido: ${c.periodo} (debe ser YYYYMM)`); return; }
  }

  // Ordenar y guardar
  CORTES_PERIODO.sort((a, b) => a.periodo.localeCompare(b.periodo));
  await idbPut('config', 'CORTES_PERIODO', CORTES_PERIODO);

  // Recalcular y re-renderizar
  computeDerivedData();
  gfPeriodoIdx = null; // forzar re-inicialización en fijos
  if (document.querySelector('[data-view="efectivo"].active'))  efRender();
  if (document.querySelector('[data-view="resumen"].active'))   resRender();
  if (document.querySelector('[data-view="fijos"].active'))     renderGastosFijos();

  showToast('✓ Cortes guardados');
  cortesClose();
}

// ── Listeners ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cortes-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('cortes-overlay')) cortesClose();
  });
  document.getElementById('cortes-close').addEventListener('click', cortesClose);
  document.getElementById('cortes-submit').addEventListener('click', cortesSubmit);
});
