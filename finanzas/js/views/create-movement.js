// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  create-movement.js — Modal genérico para crear movimientos TC / CC        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

let _cmDefaults = {};
let _cmOnAfterCreate = null;

// Tipos de ingreso según CATEGORIAS (para auto-seleccionar cargo/abono)
const CM_CAT_INGRESO = new Set(['Sueldo', 'Ingresos Extra', 'Reembolso Recibido']);

function cmGetPool() {
  const dest = cmGetDestino();
  return dest === 'tc' ? (MOVIMIENTOS || []) : (CC_MOVIMIENTOS || []);
}

function cmGetNombresUnicos() {
  return [...new Map(
    cmGetPool().filter(m => m.nombre_descriptivo)
      .map(m => [m.nombre_descriptivo, m])
  ).values()];
}

function cmShowSuggestions(q) {
  const box = document.getElementById('cm-nombre-suggestions');
  if (!box) return;
  if (!q) { box.style.display = 'none'; return; }

  const ql = normalizeQ(q);
  const matches = cmGetNombresUnicos()
    .filter(m => normalizeQ(m.nombre_descriptivo).includes(ql))
    .slice(0, 8);

  if (!matches.length) { box.style.display = 'none'; return; }

  box.innerHTML = matches.map(m =>
    `<div class="cm-suggestion-item" data-nombre="${m.nombre_descriptivo.replace(/"/g, '&quot;')}">${m.nombre_descriptivo}</div>`
  ).join('');
  box.style.display = 'block';
}

function cmHideSuggestions() {
  const box = document.getElementById('cm-nombre-suggestions');
  if (box) box.style.display = 'none';
}

// Mantener cmPopulateDatalist como no-op para compatibilidad con llamadas existentes
function cmPopulateDatalist() {}

function cmAutocompletarNombre(nombre) {
  if (!nombre) return;
  const dest = cmGetDestino();
  const pool = dest === 'tc'
    ? (MOVIMIENTOS || [])
    : (CC_MOVIMIENTOS || []);

  const match = pool.find(m => m.nombre_descriptivo === nombre);
  if (!match) return;

  // Rellenar categoría
  const catEl = document.getElementById('cm-categoria');
  if (match.categoria) catEl.value = match.categoria;

  // Rellenar medio de pago
  if (dest === 'cc') {
    if (match.medio_pago) document.getElementById('cm-medio-cc').value = match.medio_pago;
    // Auto tipo cargo/abono
    if (match.tipo) {
      document.getElementById('cm-tipo-cargo').classList.toggle('active', match.tipo === 'cargo');
      document.getElementById('cm-tipo-abono').classList.toggle('active', match.tipo === 'abono');
    }
  } else {
    if (match.medio_pago) document.getElementById('cm-medio-tc').value = match.medio_pago;
  }
}

function cmOnCategoriaChange(cat) {
  if (!cat) return;
  const esIngreso = CM_CAT_INGRESO.has(cat);
  document.getElementById('cm-tipo-cargo').classList.toggle('active', !esIngreso);
  document.getElementById('cm-tipo-abono').classList.toggle('active', esIngreso);
}

function cmOpen(defaults, onAfterCreate) {
  if (!UC_CORTES.length) { showToast('⚠️ Sin datos cargados — importa el archivo primero'); return; }
  _cmDefaults = defaults || {};
  _cmOnAfterCreate = onAfterCreate || null;
  cmReset(_cmDefaults);
  cmPopulateDatalist();
  document.getElementById('cm-overlay').style.display = 'block';
  document.getElementById('main-nav').style.display = 'none';
}

function cmClose() {
  document.getElementById('cm-overlay').style.display = 'none';
  document.getElementById('main-nav').style.display = '';
  _cmOnAfterCreate = null;
}

function cmReset(defaults) {
  defaults = defaults || {};
  const today = new Date().toISOString().split('T')[0];
  const periodoActual = typeof fechaToPeriodoUC === 'function' ? fechaToPeriodoUC(today) : '';

  // Destino
  const destino = defaults.destino || 'cc';
  document.getElementById('cm-dest-cc').classList.toggle('active', destino === 'cc');
  document.getElementById('cm-dest-tc').classList.toggle('active', destino === 'tc');
  cmSwitchDestino(destino);

  // ID (oculto, solo informativo en crear)
  document.getElementById('cm-id-row').style.display = 'none';

  // Campos comunes
  document.getElementById('cm-nombre-original').value = defaults.nombre_original || '';
  document.getElementById('cm-nombre').value           = defaults.nombre_descriptivo || '';
  document.getElementById('cm-categoria').value        = defaults.categoria || '';

  // CC
  document.getElementById('cm-fecha-cc').value    = defaults.fecha || today;
  document.getElementById('cm-monto').value        = defaults.monto || '';
  document.getElementById('cm-periodo-cc').value   = defaults.periodo || periodoActual;
  document.getElementById('cm-medio-cc').value     = defaults.medio_pago || 'Cuenta Corriente Banco de Chile';
  const tipo = defaults.tipo || 'cargo';
  document.getElementById('cm-tipo-cargo').classList.toggle('active', tipo === 'cargo');
  document.getElementById('cm-tipo-abono').classList.toggle('active', tipo === 'abono');

  // TC
  document.getElementById('cm-fecha-tc').value           = defaults.fecha_transaccion || today;
  document.getElementById('cm-valor-cuota').value         = defaults.valor_cuota || '';
  document.getElementById('cm-cuota-actual').value        = defaults.cuota_actual || '1';
  document.getElementById('cm-cuotas-total').value        = defaults.cuotas_totales || '1';
  document.getElementById('cm-medio-tc').value            = defaults.medio_pago || 'TC Banco de Chile';
  const pendiente = !!(defaults.pendiente_reembolso);
  document.getElementById('cm-pendiente-reembolso').checked = pendiente;
  document.getElementById('cm-reembolso-monto-row').style.display = pendiente ? '' : 'none';
  document.getElementById('cm-monto-reembolso').value = defaults.monto_reembolso_esperado || '';
  cmUpdatePeriodoTC();
}

function cmSwitchDestino(dest) {
  document.getElementById('cm-dest-cc').classList.toggle('active', dest === 'cc');
  document.getElementById('cm-dest-tc').classList.toggle('active', dest === 'tc');
  document.getElementById('cm-fields-cc').style.display = dest === 'cc' ? '' : 'none';
  document.getElementById('cm-fields-tc').style.display = dest === 'tc' ? '' : 'none';
  cmPopulateDatalist();
}

function cmGetDestino() {
  return document.getElementById('cm-dest-tc').classList.contains('active') ? 'tc' : 'cc';
}

function cmGetTipo() {
  return document.getElementById('cm-tipo-abono').classList.contains('active') ? 'abono' : 'cargo';
}

function cmUpdatePeriodoTC() {
  const fecha = document.getElementById('cm-fecha-tc').value;
  if (fecha && typeof fechaToPeriodoUC === 'function') {
    document.getElementById('cm-periodo-tc').value = fechaToPeriodoUC(fecha);
  }
}

function cmUpdatePeriodoCC() {
  const fecha = document.getElementById('cm-fecha-cc').value;
  if (fecha && typeof fechaToPeriodoUC === 'function') {
    document.getElementById('cm-periodo-cc').value = fechaToPeriodoUC(fecha);
  }
}

async function cmSubmit() {
  const dest           = cmGetDestino();
  const nombre         = document.getElementById('cm-nombre').value.trim();
  const nombreOriginal = document.getElementById('cm-nombre-original').value.trim();
  const categoria      = document.getElementById('cm-categoria').value;

  if (!nombre)    { showToast('⚠️ Ingresa un nombre'); return; }
  if (!categoria) { showToast('⚠️ Elige una categoría'); return; }

  const ts = Date.now();

  if (dest === 'cc') {
    const fecha   = document.getElementById('cm-fecha-cc').value;
    const monto   = parseFloat(document.getElementById('cm-monto').value);
    const medio   = document.getElementById('cm-medio-cc').value;
    const tipo    = cmGetTipo();
    const periodo = document.getElementById('cm-periodo-cc').value || fechaToPeriodoUC(fecha);

    if (!fecha)       { showToast('⚠️ Ingresa una fecha'); return; }
    if (isNaN(monto)) { showToast('⚠️ Ingresa un monto válido'); return; }

    const mov = {
      id:                 `cc-manual-${ts}`,
      nombre_descriptivo: nombre,
      nombre_original:    nombreOriginal || nombre,
      medio_pago:         medio,
      categoria:          categoria,
      periodo:            periodo,
      fecha:              fecha,
      monto:              tipo === 'cargo' ? -Math.abs(monto) : Math.abs(monto),
      tipo:               tipo,
    };

    CC_MOVIMIENTOS.push(mov);

  } else {
    const fecha        = document.getElementById('cm-fecha-tc').value;
    const valorCuota   = parseFloat(document.getElementById('cm-valor-cuota').value);
    const cuotaActual  = parseInt(document.getElementById('cm-cuota-actual').value)  || 1;
    const cuotasTotal  = parseInt(document.getElementById('cm-cuotas-total').value)  || 1;
    const medio        = document.getElementById('cm-medio-tc').value;
    const periodo      = document.getElementById('cm-periodo-tc').value || fechaToPeriodoUC(fecha);
    const pendiente    = document.getElementById('cm-pendiente-reembolso').checked;
    const montoReemb   = pendiente ? (parseFloat(document.getElementById('cm-monto-reembolso').value) || null) : null;

    if (!fecha)            { showToast('⚠️ Ingresa una fecha'); return; }
    if (isNaN(valorCuota)) { showToast('⚠️ Ingresa un valor de cuota válido'); return; }

    const mov = {
      id:                       `tc-manual-${ts}`,
      id_compra:                `tc-manual-cmp-${ts}`,
      nombre_descriptivo:       nombre,
      nombre_original:          nombreOriginal || nombre,
      medio_pago:               medio,
      categoria:                categoria,
      periodo:                  periodo,
      fecha_transaccion:        fecha,
      cuota_actual:             cuotaActual,
      cuotas_totales:           cuotasTotal,
      cuotas_pendientes:        cuotasTotal - cuotaActual,
      valor_cuota:              valorCuota,
      monto_compra_original:    valorCuota * cuotasTotal,
      pendiente_reembolso:      pendiente,
      reembolsado:              false,
      monto_reembolso_esperado: montoReemb,
    };

    MOVIMIENTOS.push(mov);
  }

  await syncMemoryToIDB();
  computeDerivedData();
  if (document.querySelector('[data-view="efectivo"].active')) efRender();
  if (document.querySelector('[data-view="resumen"].active'))  resRender();
  showToast('✓ Movimiento creado');
  const cb = _cmOnAfterCreate;
  cmClose();
  if (cb) cb();
}

// ── Listeners ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cm-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('cm-overlay')) cmClose();
  });

  document.getElementById('cm-close').addEventListener('click', cmClose);

  document.getElementById('cm-dest-cc').addEventListener('click', () => cmSwitchDestino('cc'));
  document.getElementById('cm-dest-tc').addEventListener('click', () => cmSwitchDestino('tc'));

  document.getElementById('cm-tipo-cargo').addEventListener('click', () => {
    document.getElementById('cm-tipo-cargo').classList.add('active');
    document.getElementById('cm-tipo-abono').classList.remove('active');
  });
  document.getElementById('cm-tipo-abono').addEventListener('click', () => {
    document.getElementById('cm-tipo-abono').classList.add('active');
    document.getElementById('cm-tipo-cargo').classList.remove('active');
  });

  document.getElementById('cm-fecha-tc').addEventListener('input', cmUpdatePeriodoTC);
  document.getElementById('cm-fecha-cc').addEventListener('input', cmUpdatePeriodoCC);

  // Nombre original → rellena nombre descriptivo si está vacío
  document.getElementById('cm-nombre-original').addEventListener('input', e => {
    const descEl = document.getElementById('cm-nombre');
    if (!descEl.value) descEl.value = e.target.value;
  });

  // Suggestions dropdown
  const nombreInput = document.getElementById('cm-nombre');
  nombreInput.addEventListener('input', e => cmShowSuggestions(e.target.value));
  nombreInput.addEventListener('blur', () => setTimeout(cmHideSuggestions, 150));

  document.getElementById('cm-nombre-suggestions').addEventListener('click', e => {
    const item = e.target.closest('.cm-suggestion-item');
    if (!item) return;
    const nombre = item.dataset.nombre;
    nombreInput.value = nombre;
    cmHideSuggestions();
    cmAutocompletarNombre(nombre);
  });

  // Categoría → auto tipo cargo/abono (solo aplica a CC)
  document.getElementById('cm-categoria').addEventListener('change', e => {
    if (cmGetDestino() === 'cc') cmOnCategoriaChange(e.target.value);
  });

  document.getElementById('cm-submit').addEventListener('click', cmSubmit);
});
