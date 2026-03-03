// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  deudas.js — View Deudas: renderDeudas                                     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function renderDeudas() {
  const container = document.getElementById('deudas-container');
  container.innerHTML = DEUDAS.map((d, i) => {
    const frecuencia = d.frecuencia === 'anual' ? 'anual' : 'mensual';
    const delay = i * 0.08;
    const ocultarContador = d.id === 'UCH-FSCU-001';

    // ── Cuotas con monto definido
    const cuotasConMonto = d.cuotas.filter(c => c.monto !== null);

    // ── Próxima cuota a pagar: primera donde abono < monto o sin abono
    const proxima = d.cuotas.find(c => c.monto !== null && (c.abono === null || c.abono < c.monto));

    // ── Saldo pendiente: cuotas no saldadas
    const saldoNativo = cuotasConMonto.reduce((s, c) => {
      const pagado = c.abono || 0;
      return s + Math.max(0, c.monto - pagado);
    }, 0);
    const saldoCLP = toCLP(saldoNativo, d.moneda);
    const cargando = saldoCLP === null;

    // ── Progreso: cuotas completamente pagadas / total con monto
    const pagadas = cuotasConMonto.filter(c => c.abono !== null && c.abono >= c.monto).length;
    const total = cuotasConMonto.length;
    const pct = total > 0 ? Math.round((pagadas / total) * 100) : 0;
    // Para FSCU: % basado en monto pagado vs total suscrito (cuotas con monto definido)
    const totalSuscritoMonto = d.cuotas.reduce((s, c) => s + (c.monto || 0), 0);
    const montoPagado = d.cuotas.reduce((s, c) => s + (c.abono && c.monto && c.abono >= c.monto ? c.monto : (c.abono || 0)), 0);
    const pctMonto = totalSuscritoMonto > 0 ? Math.round((montoPagado / totalSuscritoMonto) * 100) : pct;
    const pctMostrar = d.id === 'UCH-FSCU-001' ? pctMonto : pct;

    // ── Info de próxima cuota
    let cuotaLabel = '—';
    let cuotaSubLabel = '';
    let vencLabel = '—';
    let contadorLabel = '';

    if (proxima) {
      const tieneAbono = proxima.abono !== null && proxima.abono > 0;

      if (d.moneda === 'CLP') {
        cuotaLabel = cargando ? '…' : '$' + (proxima.monto - (proxima.abono || 0)).toLocaleString('es-CL');
        if (tieneAbono) cuotaSubLabel = `${proxima.abono.toLocaleString('es-CL')} / ${proxima.monto.toLocaleString('es-CL')} CLP`;
      } else {
        const pendiente = +(proxima.monto - (proxima.abono || 0)).toFixed(4);
        cuotaLabel = cargando ? '…' : ('$' + toCLP(pendiente, d.moneda).toLocaleString('es-CL'));
        if (tieneAbono) {
          cuotaSubLabel = `${proxima.abono.toFixed(2)} / ${proxima.monto.toFixed(2)} ${d.moneda}`;
        } else {
          cuotaSubLabel = `${proxima.monto.toFixed(2)} ${d.moneda}`;
        }
      }

      vencLabel = fmtFecha(proxima.vencimiento);

      if (!ocultarContador) {
        const restantes = cuotasConMonto.filter(c => c.abono === null || c.abono < c.monto).length;
        contadorLabel = `${restantes} cuota${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''}`;
      }
    }

    return `
    <div class="deuda-card" style="animation-delay:${delay}s">
      <div class="card-glow"></div>
      <div class="card-header">
        <div class="card-cupos">
          <div class="cupo-item cupo-total">
            <span class="cupo-label">Saldo</span>
            <span class="cupo-value">
              ${cargando ? '<span style="font-size:13px;opacity:0.4">cargando…</span>' : '$' + saldoCLP.toLocaleString('es-CL')}
            </span>
            ${!cargando && d.moneda !== 'CLP' ? `<span class="cupo-label" style="margin-top:2px">${saldoNativo.toFixed(d.moneda === 'CLP' ? 0 : 2)} ${d.moneda}</span>` : ''}
          </div>
        </div>
        <div class="card-right">
          <span class="card-bank-label">${d.institucion}</span>
          <span class="card-product" style="font-size:13px">${d.nombre}</span>
          <span class="card-badge">${d.moneda}</span>
        </div>
      </div>

      <div class="cupo-section">
        <div class="progress-wrap">
          <div class="progress-meta">
            <span class="cupo-label">Pagado</span>
            <span class="progress-pct">${pctMostrar}%${!ocultarContador ? ` · Pagada ${pagadas} de ${total}` : ` · ${pagadas} pagada${pagadas !== 1 ? 's' : ''}`}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pctMostrar}%;background:var(--accent);transition:width 0.8s ease 0.3s"></div>
          </div>
        </div>
      </div>

      <div class="card-divider"></div>

      <div class="facturacion-section">
        <div class="facturacion-col">
          <span class="facturacion-name">${
            d.id === 'UCH-D8565-001' && proxima && proxima.numero === 25
              ? 'Saldo final'
              : d.id === 'UCH-D8565-001'
                ? ('Cuota mensual' + (proxima && proxima.abono ? ' · pendiente' : ''))
                : ('Cuota ' + frecuencia + (proxima && proxima.abono ? ' · pendiente' : ''))
          }</span>
          <span class="facturacion-gross">${cuotaLabel}</span>
          ${cuotaSubLabel ? `<span class="facturacion-pagado">${cuotaSubLabel}</span>` : ''}
        </div>
        <div class="facturacion-col facturacion-next">
          <span class="facturacion-name">Próximo pago</span>
          <span class="facturacion-gross" style="font-size:16px">${vencLabel}</span>
          ${contadorLabel ? `<span class="facturacion-pagado">${contadorLabel}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}
