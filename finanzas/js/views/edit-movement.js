// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  edit-movement.js — Modal para editar movimientos existentes (EF/CC/TC)     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

let _emMovimiento = null;

function emOpen(m) {
  if (!m) return;
  _emMovimiento = m;
  emReset(m);
  document.getElementById('em-overlay').style.display = 'block';
  document.getElementById('main-nav').style.display = 'none';
  document.getElementById('fab-group').style.display = 'none';
  setTimeout(() => document.getElementById('em-nombre').focus(), 50);
}

function emClose() {
  document.getElementById('em-overlay').style.display = 'none';
  document.getElementById('main-nav').style.display = '';
  document.getElementById('fab-group').style.display = '';
  _emMovimiento = null;
}

function emReset(m) {
  const isTc = m.fuente === 'tc';

  // Destino — bloqueado, no cambiable
  document.getElementById('em-dest-cc').classList.toggle('active', !isTc);
  document.getElementById('em-dest-tc').classList.toggle('active', isTc);
  document.getElementById('em-fields-cc').style.display = isTc ? 'none' : '';
  document.getElementById('em-fields-tc').style.display = isTc ? '' : 'none';

  // ID
  document.getElementById('em-id-display').textContent = m.id || '';

  // Campos comunes
  document.getElementById('em-nombre-original').value = m.nombre_original || '';
  document.getElementById('em-nombre').value           = m.nombre_descriptivo || m.descripcion || '';
  document.getElementById('em-categoria').value        = m.categoria || '';

  if (isTc) {
    // TC — buscar en MOVIMIENTOS originales para tener valor_cuota real
    const orig = MOVIMIENTOS.find(x => x.id === m.id);
    document.getElementById('em-fecha-tc').value    = m.fecha_transaccion || m.fecha || '';
    document.getElementById('em-valor-cuota').value = orig ? orig.valor_cuota : m.monto || '';
    document.getElementById('em-cuota-actual').value  = m.cuota_actual  || '1';
    document.getElementById('em-cuotas-total').value  = m.cuotas_totales || '1';
    document.getElementById('em-medio-tc').value      = m.medio_pago || 'TC Banco de Chile';
    document.getElementById('em-periodo-tc').value    = m.periodo || (m.fecha_transaccion ? fechaToPeriodoUC(m.fecha_transaccion) : '');

    const pendiente = !!(m.pendiente_reembolso);
    document.getElementById('em-pendiente-reembolso').checked = pendiente;
    document.getElementById('em-reembolso-monto-row').style.display = pendiente ? '' : 'none';
    document.getElementById('em-monto-reembolso').value = m.monto_reembolso_esperado || '';
    document.getElementById('em-reembolsado').checked = !!(m.reembolsado);

  } else {
    document.getElementById('em-fecha-cc').value   = m.fecha || '';
    document.getElementById('em-monto').value      = m.monto ? Math.abs(m.monto) : '';
    document.getElementById('em-periodo-cc').value = m.periodo || (m.fecha ? fechaToPeriodoUC(m.fecha) : '');
    document.getElementById('em-medio-cc').value   = m.medio_pago || (m.fuente === 'ef' ? 'Efectivo' : 'Cuenta Corriente Banco de Chile');
    // Tipo: CC usa cargo/abono; EF almacena tipo egreso/ingreso
    const tipo = m.tipo === 'ingreso' || m.tipo === 'abono' ? 'abono' : 'cargo';
    document.getElementById('em-tipo-cargo').classList.toggle('active', tipo === 'cargo');
    document.getElementById('em-tipo-abono').classList.toggle('active', tipo === 'abono');
  }
}

async function emSubmit() {
  const m = _emMovimiento;
  if (!m) return;
  const fuente = m.fuente;

  const nombre         = document.getElementById('em-nombre').value.trim();
  const nombreOriginal = document.getElementById('em-nombre-original').value.trim();
  const categoria      = document.getElementById('em-categoria').value;

  if (!nombre)    { showToast('⚠️ Ingresa un nombre'); return; }
  if (!categoria) { showToast('⚠️ Elige una categoría'); return; }

  if (fuente === 'tc') {
    const fecha        = document.getElementById('em-fecha-tc').value;
    const valorCuota   = parseFloat(document.getElementById('em-valor-cuota').value);
    const cuotaActual  = parseInt(document.getElementById('em-cuota-actual').value) || 1;
    const cuotasTotal  = parseInt(document.getElementById('em-cuotas-total').value) || 1;
    const medio        = document.getElementById('em-medio-tc').value;
    const periodo      = document.getElementById('em-periodo-tc').value || (fecha ? fechaToPeriodoUC(fecha) : '');
    const pendiente    = document.getElementById('em-pendiente-reembolso').checked;
    const reembolsado  = document.getElementById('em-reembolsado').checked;
    const montoReemb   = pendiente ? (parseFloat(document.getElementById('em-monto-reembolso').value) || null) : null;

    if (!fecha)            { showToast('⚠️ Ingresa una fecha'); return; }
    if (isNaN(valorCuota)) { showToast('⚠️ Ingresa un valor de cuota válido'); return; }

    const orig = MOVIMIENTOS.find(x => x.id === m.id);
    if (orig) Object.assign(orig, {
      nombre_descriptivo:       nombre,
      nombre_original:          nombreOriginal || nombre,
      categoria,
      medio_pago:               medio,
      fecha_transaccion:        fecha,
      valor_cuota:              valorCuota,
      cuota_actual:             cuotaActual,
      cuotas_totales:           cuotasTotal,
      cuotas_pendientes:        cuotasTotal - cuotaActual,
      monto_compra_original:    valorCuota * cuotasTotal,
      periodo,
      pendiente_reembolso:      pendiente,
      reembolsado,
      monto_reembolso_esperado: montoReemb,
    });

  } else if (fuente === 'cc') {
    const fecha    = document.getElementById('em-fecha-cc').value;
    const monto    = parseFloat(document.getElementById('em-monto').value);
    const medio    = document.getElementById('em-medio-cc').value;
    const tipo     = document.getElementById('em-tipo-abono').classList.contains('active') ? 'abono' : 'cargo';
    const periodo  = document.getElementById('em-periodo-cc').value || (fecha ? fechaToPeriodoUC(fecha) : '');

    if (!fecha)       { showToast('⚠️ Ingresa una fecha'); return; }
    if (isNaN(monto)) { showToast('⚠️ Ingresa un monto válido'); return; }

    const orig = CC_MOVIMIENTOS.find(x => x.id === m.id);
    if (orig) Object.assign(orig, {
      nombre_descriptivo: nombre,
      nombre_original:    nombreOriginal || orig.nombre_original || nombre,
      categoria,
      medio_pago:         medio,
      fecha,
      periodo,
      tipo,
      monto: tipo === 'cargo' ? -Math.abs(monto) : Math.abs(monto),
    });

  } else if (fuente === 'ef') {
    const fecha    = document.getElementById('em-fecha-cc').value;
    const monto    = parseFloat(document.getElementById('em-monto').value);
    const medio    = document.getElementById('em-medio-cc').value;
    const tipo     = document.getElementById('em-tipo-abono').classList.contains('active') ? 'ingreso' : 'egreso';

    if (!fecha)       { showToast('⚠️ Ingresa una fecha'); return; }
    if (isNaN(monto)) { showToast('⚠️ Ingresa un monto válido'); return; }

    const idx = EF_MOVS.findIndex(x => x.id === m.id);
    if (idx >= 0) Object.assign(EF_MOVS[idx], {
      nombre_descriptivo: nombre,
      nombre_original:    nombreOriginal || nombre,
      categoria,
      medio_pago:         medio,
      fecha,
      monto,
      tipo,
    });
    efSave(EF_MOVS);
  }

  await syncMemoryToIDB();
  computeDerivedData();
  if (document.querySelector('[data-view="efectivo"].active')) efRender();
  if (document.querySelector('[data-view="resumen"].active'))  resRender();
  showToast('✓ Cambios guardados');
  emClose();
}

// ── Listeners ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('em-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('em-overlay')) emClose();
  });

  document.getElementById('em-close').addEventListener('click', emClose);

  document.getElementById('em-tipo-cargo').addEventListener('click', () => {
    document.getElementById('em-tipo-cargo').classList.add('active');
    document.getElementById('em-tipo-abono').classList.remove('active');
  });
  document.getElementById('em-tipo-abono').addEventListener('click', () => {
    document.getElementById('em-tipo-abono').classList.add('active');
    document.getElementById('em-tipo-cargo').classList.remove('active');
  });

  // Nombre original → rellena nombre descriptivo si está vacío
  document.getElementById('em-nombre-original').addEventListener('input', e => {
    const descEl = document.getElementById('em-nombre');
    if (!descEl.value) descEl.value = e.target.value;
  });

  // Período pendiente de reembolso — sync visibility
  document.getElementById('em-pendiente-reembolso').addEventListener('change', e => {
    document.getElementById('em-reembolso-monto-row').style.display = e.target.checked ? '' : 'none';
  });

  document.getElementById('em-submit').addEventListener('click', emSubmit);
});
