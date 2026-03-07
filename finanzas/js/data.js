// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  data.js — Variables globales, categorías, utilidades y datos derivados     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── Variables globales (asignadas en loadData) ────────────────────────────────
let MOVIMIENTOS   = [];
let CC_MOVIMIENTOS = [];
let DEUDAS = [];
let CUPOS  = {};
let CORTES_PERIODO = [];
let UC_CORTES = [];
let TC_NORM   = [];
let CC_NORM   = [];

// ── CATEGORÍAS (índice centralizado) ─────────────────────────────────────────
// tipo: 'egreso' | 'ingreso' | 'neutro'
const CATEGORIAS = [
  // ── Egresos ──────────────────────────────────────────────
  { id: 'comida-hormiga',        nombre: 'Comida Hormiga',         tipo: 'egreso',   color: '#c0392b' },
  { id: 'alimentacion-mensual',  nombre: 'Alimentación Mensual',   tipo: 'egreso',   color: '#e67e22' },
  { id: 'transporte',            nombre: 'Transporte',             tipo: 'egreso',   color: '#8e44ad' },
  { id: 'salud',                 nombre: 'Salud',                  tipo: 'egreso',   color: '#2980b9' },
  { id: 'servicios-cuentas',     nombre: 'Servicios y Cuentas',    tipo: 'egreso',   color: '#16a085' },
  { id: 'bienes',                nombre: 'Bienes',                 tipo: 'egreso',   color: '#1a52a0' },
  { id: 'entretencion',          nombre: 'Entretención',           tipo: 'egreso',   color: '#d35400' },
  { id: 'pareja',                nombre: 'Pareja',                 tipo: 'egreso',   color: '#e91e8c' },
  { id: 'cuidado-personal',      nombre: 'Cuidado Personal',       tipo: 'egreso',   color: '#7f8c8d' },
  { id: 'hogar',                 nombre: 'Hogar',                  tipo: 'egreso',   color: '#27ae60' },
  { id: 'deudas-comisiones',     nombre: 'Deudas y Comisiones',    tipo: 'egreso',   color: '#884ea0' },
  { id: 'pagos-tc',              nombre: 'Pagos TC',               tipo: 'neutro',   color: '#95a5a6' },
  { id: 'prestamos-personales',  nombre: 'Préstamos Personales',   tipo: 'neutro',   color: '#b7950b' },
  { id: 'pend-reembolso',        nombre: 'Pendiente de Reembolso', tipo: 'egreso',   color: '#b8660a' },
  // ── Ingresos ─────────────────────────────────────────────
  { id: 'sueldo',                nombre: 'Sueldo',                 tipo: 'ingreso',  color: '#1a7a4a' },
  { id: 'ingresos-extra',        nombre: 'Ingresos Extra',         tipo: 'ingreso',  color: '#148a5a' },
  { id: 'reembolso-recibido',    nombre: 'Reembolso Recibido',     tipo: 'ingreso',  color: '#1abc9c' },
  // ── Sin clasificar ───────────────────────────────────────
  { id: 'por-clasificar',        nombre: 'Por Clasificar',         tipo: 'egreso',   color: '#b0b0a5' },
];

// Build lookup maps
const CAT_BY_NOMBRE = {};
CATEGORIAS.forEach(c => { CAT_BY_NOMBRE[c.nombre] = c; });

function catColor(nombre) { return (CAT_BY_NOMBRE[nombre] || {}).color || '#b0b0a5'; }
function catTipo(nombre)  { return (CAT_BY_NOMBRE[nombre] || {}).tipo  || 'egreso'; }

// ── UTILS ─────────────────────────────────────────────────────────────────────
function fmtCLP(n) {
  return '$' + Math.abs(n).toLocaleString('es-CL');
}

function currentPeriod() {
  return UC_CORTES[UC_CORTES.length - 1].id;
}

function nextPeriod(p) {
  const y = parseInt(p.slice(0,4));
  const m = parseInt(p.slice(4,6));
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}${String(nm).padStart(2,'0')}`;
}

function periodLabel(p) {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const m = parseInt(p.slice(4,6)) - 1;
  const y = p.slice(2,4);
  return `${months[m]} ${y}`;
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function fechaToPeriodoUC(fechaStr) {
  if (!UC_CORTES.length) return '';
  for (const c of UC_CORTES) {
    if (fechaStr >= c.desde && fechaStr <= c.hasta) return c.id;
  }
  if (fechaStr < UC_CORTES[0].desde) return UC_CORTES[0].id;
  return UC_CORTES[UC_CORTES.length - 1].id;
}

function dateToPeriod(dateStr) {
  return fechaToPeriodoUC(dateStr);
}

// ── COMPUTE ───────────────────────────────────────────────────────────────────
// Construye rangos [desde, hasta] a partir de la tabla
function computeDerivedData() {
  UC_CORTES = CORTES_PERIODO.map((c, i) => ({
    id:    c.periodo,
    desde: c.fecha_corte,
    hasta: i < CORTES_PERIODO.length - 1
      ? offsetDate(CORTES_PERIODO[i + 1].fecha_corte, -1)
      : '9999-12-31',
  }));

  // Normalise TC: solo cuotas de 2026 (valor_cuota > 0), pagos negativos excluidos
  TC_NORM = (() => {
    return MOVIMIENTOS
      .filter(m => m.valor_cuota > 0 && m.periodo.startsWith('2026'))
      .map(m => ({
        id: m.id,
        nombre_descriptivo: m.nombre_descriptivo,
        descripcion: m.nombre_descriptivo,
        medio_pago: m.medio_pago,
        categoria: m.categoria,
        periodo: m.periodo,
        fecha: (() => {
          // Pago único: usar siempre la fecha real de transacción
          if (m.cuotas_totales === 1) return m.fecha_transaccion;
          // Cuota: si la fecha de compra cae en el período, usarla; si no, usar fecha de corte
          const corte = UC_CORTES.find(c => c.id === m.periodo);
          const esReal = corte &&
            m.fecha_transaccion >= corte.desde &&
            m.fecha_transaccion <= corte.hasta;
          return esReal ? m.fecha_transaccion : (corte ? corte.hasta : m.fecha_transaccion);
        })(),
        fecha_transaccion: m.fecha_transaccion,
        monto: m.valor_cuota,
        tipo: 'egreso',
        fuente: 'tc',
        cuota_actual: m.cuota_actual,
        cuotas_totales: m.cuotas_totales,
        nombre_original: m.nombre_original,
        pendiente_reembolso: m.pendiente_reembolso || false,
        reembolsado: m.reembolsado || false,
        monto_reembolso_esperado: m.monto_reembolso_esperado || null,
      }));
  })();

  CC_NORM = CC_MOVIMIENTOS.map(m => ({
    ...m,
    descripcion: m.nombre_descriptivo,
    monto: Math.abs(m.monto),
    tipo: m.tipo === 'abono' ? 'ingreso' : 'egreso',
    fuente: 'cc'
  }));
}

// ── EFECTIVO (localStorage — movimientos manuales) ────────────────────────────
const EF_KEY = 'finanzas_efectivo_v1';

function efLoad() {
  try { return JSON.parse(localStorage.getItem(EF_KEY) || '[]'); } catch(e) { return []; }
}
function efSave(movs) {
  try { localStorage.setItem(EF_KEY, JSON.stringify(movs)); } catch(e) {}
}

let EF_MOVS = efLoad();

// ── INDICADORES ECONÓMICOS ────────────────────────────────────────────────────
// Fallback: valores oficiales SII/SBIF al 27-02-2026
let INDICADORES = { uf: 39779.29, utm: 69611 };

async function fetchIndicadores() {
  try {
    const res = await fetch('https://mindicador.cl/api');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    INDICADORES.uf = data.uf.valor;
    INDICADORES.utm = data.utm.valor;
  } catch(e) {
    console.warn('Usando valores de fallback (27-02-2026):', INDICADORES);
  }
  renderDeudas();
}

function toCLP(valor, moneda) {
  if (moneda === 'CLP') return valor;
  if (moneda === 'UF' && INDICADORES.uf) return Math.round(valor * INDICADORES.uf);
  if (moneda === 'UTM' && INDICADORES.utm) return Math.round(valor * INDICADORES.utm);
  return null;
}

function fmtMoneda(valor, moneda) {
  if (moneda === 'CLP') return '$' + Math.round(valor).toLocaleString('es-CL');
  if (moneda === 'UF') return valor.toFixed(2) + ' UF';
  if (moneda === 'UTM') return valor.toFixed(2) + ' UTM';
  return valor;
}

function fmtFecha(dateStr) {
  const [y,m,d] = dateStr.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y.slice(2)}`;
}

// ── Movimientos consolidados ───────────────────────────────────────────────────
function efAllMovs() {
  // CC y TC usan el campo periodo del JSON directamente.
  // Solo EF (manual) recalcula desde fecha porque no tiene periodo propio.
  const cc = CC_NORM;
  const tc = TC_NORM;
  const ef = EF_MOVS.map(m => ({ ...m, fuente: 'ef', periodo: fechaToPeriodoUC(m.fecha) }));
  return [...cc, ...tc, ...ef].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

function efGetPeriods() {
  const periodoActivo = UC_CORTES[UC_CORTES.length - 1].id;
  const allPeriods = new Set(efAllMovs().map(m => m.periodo));

  // Límite superior: el máximo entre el activo y lo que haya en los datos
  const maxEnDatos = [...allPeriods].filter(p => p >= '202601').sort().pop() || periodoActivo;
  const maxPeriodo = maxEnDatos > periodoActivo ? maxEnDatos : periodoActivo;

  const existing = [...allPeriods]
    .filter(p => p >= '202601' && p <= maxPeriodo && p.startsWith('2026'))
    .sort();

  // Agregar 1 mes futuro más allá del máximo, solo si sigue en 2026
  const y  = parseInt(maxPeriodo.slice(0, 4));
  const mo = parseInt(maxPeriodo.slice(4, 6));
  if (y === 2026 && mo < 12) {
    const nextP = `2026${String(mo + 1).padStart(2, '0')}`;
    return [...existing, nextP];
  }

  return existing;
}

function efPeriodLabel(p, short = false) {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const year  = p.slice(0, 4);
  const month = parseInt(p.slice(4, 6)) - 1;
  return short ? months[month] : `${months[month]} ${year}`;
}

function efMovsForPeriod(periodo) {
  return efAllMovs().filter(m => m.periodo === periodo);
}

function efMovsForPeriodos(periodos) {
  // Set vacío = ninguno; Set con valores = filtrar por esos períodos
  if (!periodos || periodos.size === 0) return [];
  return efAllMovs().filter(m => periodos.has(m.periodo));
}

function efMovOrigen(m) {
  if (m.fuente === 'ef') return 'Efectivo';
  if (m.fuente === 'tc') {
    if ((m.medio_pago || '').includes('Chile')) return 'TC BCH';
    if ((m.medio_pago || '').includes('Santander')) return 'TC SAN';
    return 'TC';
  }
  if (m.fuente === 'cc') {
    if ((m.medio_pago || '').includes('Chile')) return 'CC BCH';
    if ((m.medio_pago || '').includes('Santander')) return 'CC SAN';
    return 'CC';
  }
  return 'Otro';
}
