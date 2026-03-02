// ===== DB =====
const DB='finanzas_db',DBV=2;let db=null;
const S={tx:'transactions',inc:'incomes',goals:'goals',cfg:'config',lbl:'labels',fe:'fixedExpenses',debts:'debts',stmts:'statements'};
function oDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,DBV);r.onerror=()=>rej(r.error);r.onsuccess=()=>{db=r.result;res(db)};r.onupgradeneeded=e=>{const d=e.target.result;Object.values(S).forEach(n=>{if(!d.objectStoreNames.contains(n)){const s=d.createObjectStore(n,{keyPath:'id'});if(n==='transactions'||n==='incomes')s.createIndex('month','month',{unique:false})}})}})}
function P(s,d){return new Promise((r,j)=>{const t=db.transaction(s,'readwrite');t.objectStore(s).put(d);t.oncomplete=()=>r();t.onerror=()=>j(t.error)})}
function G(s,id){return new Promise((r,j)=>{const t=db.transaction(s,'readonly');const q=t.objectStore(s).get(id);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})}
function GA(s){return new Promise((r,j)=>{const t=db.transaction(s,'readonly');const q=t.objectStore(s).getAll();q.onsuccess=()=>r(q.result||[]);q.onerror=()=>j(q.error)})}
function DD(s,id){return new Promise((r,j)=>{const t=db.transaction(s,'readwrite');t.objectStore(s).delete(id);t.oncomplete=()=>r();t.onerror=()=>j(t.error)})}
function CL(s){return new Promise((r,j)=>{const t=db.transaction(s,'readwrite');t.objectStore(s).clear();t.oncomplete=()=>r();t.onerror=()=>j(t.error)})}

// ===== CONSTANTS =====
const CATS=[
{id:'alimentacion',n:'Alimentación',i:'🛒',c:'#34d399'},
{id:'hormiga',n:'Hormiga',i:'🐜',c:'#fb923c'},
{id:'ocio',n:'Ocio',i:'🎮',c:'#a78bfa'},
{id:'salud',n:'Salud',i:'💊',c:'#f472b6'},
{id:'deudas',n:'Deudas',i:'🏦',c:'#f87171'},
{id:'servicios',n:'Servicios y Transporte',i:'📱',c:'#818cf8'},
{id:'bienes',n:'Bienes personales',i:'🛍️',c:'#e879f9'},
{id:'hogar',n:'Hogar',i:'🏠',c:'#fbbf24'},
{id:'educacion',n:'Educación',i:'📚',c:'#2dd4bf'},
{id:'ahorro',n:'Ahorro',i:'💰',c:'#34d399'},
{id:'obsequios',n:'Obsequios',i:'🎁',c:'#fb7185'},
{id:'transferencia',n:'Transferencia interna',i:'🔄',c:'#94a3b8'},
{id:'comisiones',n:'Comisiones',i:'📄',c:'#64748b'},
{id:'otros',n:'Otros',i:'📦',c:'#9ca3af'}
];
const MN=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function catById(id){return CATS.find(c=>c.id===id)||CATS[CATS.length-1]}
function catOpts(sel){return CATS.map(c=>`<option value="${c.id}"${c.id===sel?' selected':''}>${c.i} ${c.n}</option>`).join('')}

const DEF_FE=[
{id:'fe_1',name:'Arriendo',category:'hogar',type:'obligatorio',amount:300000},
{id:'fe_2',name:'Deuda BCH',category:'deudas',type:'obligatorio',amount:298793},
{id:'fe_3',name:'Supermercado',category:'alimentacion',type:'obligatorio',amount:200000},
{id:'fe_4',name:'Ahorro Bancoestado',category:'ahorro',type:'opcional',amount:50000},
{id:'fe_5',name:'Psicóloga',category:'salud',type:'obligatorio',amount:80000},
{id:'fe_6',name:'Team running UC',category:'salud',type:'obligatorio',amount:15000},
{id:'fe_7',name:'YouTube Premium',category:'servicios',type:'obligatorio',amount:0},
{id:'fe_8',name:'Gastos comunes',category:'hogar',type:'obligatorio',amount:120000},
{id:'fe_9',name:'Plan celular',category:'servicios',type:'obligatorio',amount:5000},
{id:'fe_10',name:'Transporte BIP',category:'servicios',type:'obligatorio',amount:40000},
{id:'fe_11',name:'Lavandería',category:'hogar',type:'opcional',amount:10000},
{id:'fe_12',name:'Deuda UCH',category:'deudas',type:'obligatorio',amount:100000},
{id:'fe_13',name:'Deuda CAE',category:'deudas',type:'obligatorio',amount:26000},
{id:'fe_14',name:'Deuda FSCU',category:'deudas',type:'obligatorio',amount:163126},
{id:'fe_15',name:'Claude AI',category:'servicios',type:'obligatorio',amount:12}
];

// CAMBIO 6e: noMax y totalPaid en DEF_DEBTS
const DEF_DEBTS=[
{id:'debt_bch',name:'Crédito Consumo BChile',balance:16134860,mp:298793,ci:7,ti:60,noMax:false,totalPaid:0},
{id:'debt_uch',name:'Decreto 8565 UCH',balance:8367574,mp:100000,ci:1,ti:25,noMax:false,totalPaid:0},
{id:'debt_cae',name:'CAE (Scotiabank)',balance:0,mp:26000,ci:0,ti:0,noMax:true,totalPaid:0},
{id:'debt_fscu',name:'FSCU U. de Chile',balance:10593402,mp:163126,ci:4,ti:5,noMax:false,totalPaid:0}
];

const DEF_ACCTS={
  tcS:{name:'TC Santander',tc:1000000,used:0,pend:0},
  tcB:{name:'TC BChile',tc:1228568,used:0,pend:0},
  cl:{status:'libre',pend:0},
  avail:{bal:0}
};

// ===== STATE =====
let pg='resumen',yr=2026,expandedMonth=null;
let st={accts:{...DEF_ACCTS},lastBk:null};

// CAMBIO 6b: estado del accordion
let accOpen={disponible:true,tcs:false,deudas:false,metas:false};

// ===== UTILS =====
function uid(){return Date.now().toString(36)+Math.random().toString(36).substr(2,5)}
function fmt(n){if(n==null)return'$0';const a=Math.abs(Math.round(n));return(n<0?'-':'')+'$'+a.toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
function pct(n){return Math.round(n)+'%'}

// CAMBIO 1: fmtInput, numVal, setAmt corregidos
function fmtInput(el){
  const raw=el.value.replace(/\./g,'').replace(/\D/g,'');
  el.dataset.v=raw;
  if(raw)el.value=raw.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  else el.value='';
}
function numVal(id){
  const el=$(id);if(!el)return 0;
  const v=el.dataset.v!==undefined&&el.dataset.v!==''
    ?el.dataset.v
    :el.value.replace(/\./g,'').replace(/\D/g,'');
  return parseInt(v)||0;
}
function setAmt(id,n){
  const el=$(id);if(!el)return;
  const val=Math.round(n||0);
  el.dataset.v=String(val);
  el.value=val>0?String(val).replace(/\B(?=(\d{3})+(?!\d))/g,'.'):'';
}

function mk(){const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')}
function mnm(k){const[y,m]=k.split('-');return MN[+m-1]+' '+y}
function smn(k){return MN[+k.split('-')[1]-1].substring(0,3)}
function td(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function toast(m){const e=$('toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)}
function $(id){return document.getElementById(id)}
function avMon(){const n=new Date(),ms=[];for(let m=0;m<=n.getMonth();m++)ms.push(n.getFullYear()+'-'+String(m+1).padStart(2,'0'));return ms}
function isCur(k){return k===mk()}

// CAMBIO 2: billingPeriod y periodOpts
function billingPeriod(dateStr){
  if(!dateStr)return mk();
  const d=new Date(dateStr+'T12:00:00');
  const day=d.getDate();
  if(day>25){
    const next=new Date(d.getFullYear(),d.getMonth()+1,1);
    return next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0');
  }
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function periodOpts(defaultPeriod){
  const opts=[];const now=new Date();
  for(let offset=-1;offset<=2;offset++){
    const d=new Date(now.getFullYear(),now.getMonth()+offset,1);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const label=mnm(key)+(key===mk()?' (actual)':'');
    opts.push(`<option value="${key}"${key===defaultPeriod?' selected':''}>${label}</option>`);
  }
  return opts.join('');
}

// ===== NAV =====
// CAMBIO 8: router sin metas como destino directo
function nav(p){pg=p;window._allTxMonth=null;document.querySelectorAll('.ni').forEach(e=>e.classList.toggle('a',e.dataset.p===p));rp()}
function rp(){const c=$('pc');c.scrollTop=0;({resumen:rRes,agregar:rAdd,cuentas:rAcc,ajustes:rSet})[pg](c)}

// ===== MODAL =====
function oMdl(fn){const o=$('mo'),c=$('mdlc');fn(c);requestAnimationFrame(()=>o.classList.add('act'))}
function cMdl(){$('mo').classList.remove('act')}
function mh(t){return`<div class="mh"><h2>${t}</h2><button class="mc" onclick="cMdl()">✕</button></div>`}

// ===== SCORE =====
async function calcScore(mk2){
  const txs=await GA(S.tx),incs=await GA(S.inc);
  const mt=txs.filter(t=>t.month===mk2&&!t.projected),mi=incs.filter(i=>i.month===mk2&&!i.projected);
  const ti=mi.reduce((s,i)=>s+i.amount,0);
  const te=mt.filter(t=>t.category!=='transferencia').reduce((s,t)=>s+t.amount,0);
  const de=mt.filter(t=>t.category==='deudas').reduce((s,t)=>s+t.amount,0);
  const se=mt.filter(t=>t.category==='ahorro').reduce((s,t)=>s+t.amount,0);
  const bal=ti-te,sr=ti>0?(se/ti)*100:0,dr=ti>0?(de/ti)*100:0;
  const[y,m]=mk2.split('-').map(Number);
  const pk=y+'-'+String(m===1?12:m-1).padStart(2,'0');
  const pv=txs.filter(t=>t.month===pk&&!t.projected&&!['deudas','ahorro','transferencia'].includes(t.category)).reduce((s,t)=>s+t.amount,0);
  const cv=mt.filter(t=>!['deudas','ahorro','transferencia'].includes(t.category)).reduce((s,t)=>s+t.amount,0);
  const goals=await GA(S.goals);
  const hgc=goals.some(g=>(g.contribs||[]).some(c=>c.month===mk2));
  let s1=sr>=20?100:sr<5?0:((sr-5)/15)*100;
  let s2=dr<=30?100:dr>=60?0:((60-dr)/30)*100;
  let s3=pv>0?(cv<=pv?100:Math.max(0,100-((cv-pv)/pv)*100)):50;
  let s4=hgc?100:0,s5=bal>=0?100:0;
  const sc=Math.round(s1*.3+s2*.25+s3*.2+s4*.15+s5*.1);
  let lb,cl;
  if(sc>=80){lb='Saludable';cl='sh'}else if(sc>=60){lb='Estable';cl='ss'}else if(sc>=40){lb='En riesgo';cl='sr'}else{lb='Crítico';cl='sc'}
  return{sc,lb,cl,comp:{s1,s2,s3,s4,s5},stats:{ti,te,bal,sr,dr}}
}

// ===== TX HTML =====
function txH(t,actions=''){const c=catById(t.category);const cuotaTag=t.cuota?`<span style="font-size:10px;color:var(--text-m)">(${t.cuota})</span>`:'';const proyTag=t.projected?'<span class="bdg by" style="font-size:9px;padding:1px 4px">proy.</span>':'';return`<div class="txi${t.projected?' projected':''}"><div class="txic" style="background:${c.c}15">${c.i}</div><div class="txin"><div class="txd">${t.description} ${cuotaTag}${proyTag}</div><div class="txm">${t.date||''} · ${c.n}${t.account?' · '+t.account:''}</div></div><div class="txa" style="color:${t.category==='transferencia'?'var(--text-m)':'var(--red)'}">${fmt(-t.amount)}</div>${actions}</div>`}

// ===== PAGE: RESUMEN =====
async function rRes(c){
  const ms=avMon().reverse();
  const allTx=await GA(S.tx),allInc=await GA(S.inc),stmts=await GA(S.stmts);
  const a=st.accts;
  const curMk=mk();
  const curTxR=allTx.filter(t=>t.month===curMk&&!t.projected&&t.category!=='transferencia');
  const curIncR=allInc.filter(i=>i.month===curMk&&!i.projected);
  const curBal=curIncR.reduce((s,i)=>s+i.amount,0)-curTxR.reduce((s,t)=>s+t.amount,0);
  const allMonths=avMon();

  // CAMBIO 4c: ingresos y egresos del año
  let yearBal=0,yearIncome=0,yearExpenses=0;
  for(const m of allMonths){
    const mTx=allTx.filter(t=>t.month===m&&!t.projected&&t.category!=='transferencia');
    const mInc=allInc.filter(i=>i.month===m&&!i.projected);
    const mI=mInc.reduce((s,i)=>s+i.amount,0);
    const mE=mTx.reduce((s,t)=>s+t.amount,0);
    yearBal+=mI-mE;yearIncome+=mI;yearExpenses+=mE;
  }

  // CAMBIO 4b: deuda total largo plazo
  const debts=await GA(S.debts);
  const totalLTDebt=debts.reduce((s,d)=>s+(d.balance||0),0);

  const bkd=st.lastBk?Math.floor((Date.now()-new Date(st.lastBk).getTime())/86400000):999;
  const tcSAvail=a.tcS.tc-a.tcS.used;
  const tcBAvail=a.tcB.tc-a.tcB.used;

  const hasData=allTx.length>0||allInc.length>0;
  const welcomeDismissed=await G(S.cfg,'welcomeDismissed');
  const showWelcome=!hasData&&!welcomeDismissed;
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.navigator.standalone;
  const iosShown=localStorage.getItem('ios_hint_shown');

  // Build month cards
  let monthCards='';
  for(const m of ms){
    const sd=await calcScore(m);
    const cur=isCur(m);
    const exp=expandedMonth===m;
    const mTxAll=allTx.filter(t=>t.month===m);
    const mTxReal=mTxAll.filter(t=>!t.projected&&t.category!=='transferencia');
    const mIncAll=allInc.filter(t=>t.month===m);
    const mIncReal=mIncAll.filter(t=>!t.projected);
    const mTxProj=mTxAll.filter(t=>t.projected);
    const mIncProj=mIncAll.filter(t=>t.projected);
    const mStmts=stmts.filter(s=>s.month===m);
    const byC={};mTxReal.forEach(t=>{byC[t.category]=(byC[t.category]||0)+t.amount});

    monthCards+=`<div class="card${cur?' current-month':''} month-card" onclick="toggleMonth('${m}',event)">
      <div class="fx fb fac">
        <div class="fx fac g8"><h3>${mnm(m)}</h3>${cur?'<span class="bdg by" style="font-size:10px">En curso</span>':''}</div>
        <div class="fx fac g8"><span class="${sd.cl}" style="font-family:var(--mono);font-weight:700;font-size:16px">${sd.sc}</span><span style="font-size:14px">${exp?'▲':'▼'}</span></div>
      </div>
      <div class="fx g16 mt8" style="font-size:12px">
        <div><span style="color:var(--text-m)">Ing.</span> <span class="amts" style="color:var(--green)">${fmt(sd.stats.ti)}</span></div>
        <div><span style="color:var(--text-m)">Gas.</span> <span class="amts" style="color:var(--red)">${fmt(sd.stats.te)}</span></div>
        <div><span style="color:var(--text-m)">Bal.</span> <span class="amts" style="color:${sd.stats.bal>=0?'var(--green)':'var(--red)'}">${fmt(sd.stats.bal)}</span></div>
      </div>
      ${exp?`<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)" onclick="event.stopPropagation()">
        <div class="mb8"><span style="font-size:12px;color:var(--text-d);font-weight:600">INGRESOS</span></div>
        ${mIncReal.map(i=>`<div class="fx fb" style="font-size:12px;padding:3px 0"><span>${i.description}</span><span class="amts" style="color:var(--green)">${fmt(i.amount)}</span></div>`).join('')||'<div style="font-size:12px;color:var(--text-m)">—</div>'}
        <div class="mt12 mb8"><span style="font-size:12px;color:var(--text-d);font-weight:600">GASTOS POR CATEGORÍA</span></div>
        ${Object.entries(byC).sort((a,b)=>b[1]-a[1]).map(([cid,amt])=>{const ct=catById(cid);return`<div class="fx fb fac" style="font-size:12px;padding:3px 0"><div class="fx fac g4"><span>${ct.i}</span><span>${ct.n}</span></div><span class="amts">${fmt(amt)}</span></div>`}).join('')||'<div style="font-size:12px;color:var(--text-m)">—</div>'}
        <div class="mt12 mb8"><span style="font-size:12px;color:var(--text-d);font-weight:600">SCORE: <span class="${sd.cl}">${sd.sc}/100 — ${sd.lb}</span></span></div>
        <div style="font-size:11px;color:var(--text-m)">Ahorro: ${pct(sd.stats.sr)} · Deudas/Ingreso: ${pct(sd.stats.dr)}</div>
        ${(()=>{const cuotasM=mTxReal.filter(t=>t.cuota);const cuotaTotal=cuotasM.reduce((s,t)=>s+t.amount,0);return cuotasM.length?`<div class="mt8 mb4"><span style="font-size:11px;color:var(--yellow);font-weight:600">↩ CUOTAS (se repiten prox. período): ${fmt(cuotaTotal)}</span></div>`:''})()}
        ${mStmts.length?`<div class="mt12 mb4"><span style="font-size:12px;color:var(--text-d);font-weight:600">ESTADOS CARGADOS</span></div>${mStmts.map(s=>`<div style="font-size:11px;padding:4px 0;color:var(--text-d)">📄 ${s.bank} — ${s.date} · ${s.count} tx</div>`).join('')}`:''}
        ${(mTxProj.length||mIncProj.length)?`
        <div class="mt12">
          <button class="btn bo2 bs" style="width:100%;text-align:left;display:flex;justify-content:space-between;align-items:center" onclick="togglePendientes('${m}',event)">
            <span>📋 Pendientes (${mTxProj.length+mIncProj.length})</span>
            <span id="pendArrow_${m}">▼</span>
          </button>
          <div id="pendSection_${m}" style="display:none;margin-top:8px">
            ${mIncProj.map(i=>`<div class="fx fb fac" style="font-size:12px;padding:6px 0;border-bottom:1px solid rgba(42,46,61,.3)"><div class="fx fac g4" style="flex:1"><span>💵</span><span>${i.description}</span></div><span class="amts" style="color:var(--green)">${fmt(i.amount)}</span><button class="confirm-btn" style="margin-left:8px" onclick="confirmInc('${i.id}')">✓</button></div>`).join('')}
            ${mTxProj.map(t=>{const ct=catById(t.category);return`<div class="fx fb fac" style="font-size:12px;padding:6px 0;border-bottom:1px solid rgba(42,46,61,.3)"><div class="fx fac g4" style="flex:1"><span>${ct.i}</span><span>${t.description}</span></div><span class="amts" style="color:var(--red)">${fmt(-t.amount)}</span><button class="confirm-btn" style="margin-left:8px" onclick="confirmTx('${t.id}')">✓</button></div>`}).join('')}
          </div>
        </div>`:''}
        <div class="mt12 mb4 fx fb fac"><span style="font-size:12px;color:var(--text-d);font-weight:600">TRANSACCIONES (${mTxAll.length})</span><button class="btn bs bo2" onclick="showAllTxs('${m}')">Ver todas →</button></div>
        ${mTxAll.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(t=>txH(t)).join('')}
      </div>`:''}
    </div>`;
  }

  c.innerHTML=`
    ${showWelcome?`<div class="card" id="welcomeCard" style="background:linear-gradient(135deg,rgba(74,124,255,.1),rgba(74,124,255,.03));border-color:rgba(74,124,255,.3)">
      <h3>👋 Bienvenido a Finanzas</h3>
      <div style="font-size:13px;color:var(--text-d);margin-top:8px;line-height:1.5">
        Para empezar:<br>
        1. Configura tu <b>disponible</b> en la pestaña Cuentas<br>
        2. Genera un <b>archivo JSON</b> con Claude desde tu estado de cuenta y cárgalo en Agregar → 📋<br>
        3. O registra un gasto manual con el botón +
      </div>
      <button class="btn bs bo2 mt8" onclick="dismissWelcome()">Entendido</button>
    </div>`:''}
    ${isIOS&&!iosShown?`<div class="card" style="background:var(--accent-d);border-color:rgba(74,124,255,.3)">
      <div style="font-size:13px"><b>📲 Instalar en iPhone/iPad:</b> Safari → Compartir (↑) → "Agregar a pantalla de inicio"</div>
      <button class="btn bs bo2 mt8" onclick="localStorage.setItem('ios_hint_shown','1');this.closest('.card').remove()">OK</button>
    </div>`:''}
    ${bkd>=14?`<div class="bbanner"><span>⚠️</span><div class="f1"><div style="font-size:13px;font-weight:500">${bkd} días sin backup</div></div><button class="btn bs bo2" onclick="expBk()">Exportar</button><button style="background:none;border:none;color:var(--text-m);cursor:pointer;font-size:16px" onclick="this.closest('.bbanner').remove()">✕</button></div>`:''}
    <div class="top-banner">
      <div class="fx fb fac g8 mb8">
        <div><div style="font-size:10px;color:var(--text-m);text-transform:uppercase">Balance mes</div><div class="amts" style="font-size:16px;color:${curBal>=0?'var(--green)':'var(--red)'}"><b>${fmt(curBal)}</b></div></div>
        <div class="tr"><div style="font-size:10px;color:var(--text-m);text-transform:uppercase">Balance año</div><div class="amts" style="font-size:16px;color:${yearBal>=0?'var(--green)':'var(--red)'}"><b>${fmt(yearBal)}</b></div></div>
      </div>
      <div class="fx fb g4" style="padding:6px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:8px">
        <div class="stat"><div class="stat-label" style="color:var(--green)">Ingresos año</div><div class="stat-val" style="color:var(--green);font-size:11px">${fmt(yearIncome)}</div></div>
        <div class="stat"><div class="stat-label" style="color:var(--red)">Egresos año</div><div class="stat-val" style="color:var(--red);font-size:11px">${fmt(yearExpenses)}</div></div>
      </div>
      <div class="fx fb g4">
        <div class="stat"><div class="stat-label">TC Sant.</div><div class="stat-val" style="color:${tcSAvail>=0?'var(--green)':'var(--red)'};font-size:11px">${fmt(tcSAvail)}</div></div>
        <div class="stat"><div class="stat-label">TC BCh.</div><div class="stat-val" style="color:${tcBAvail>=0?'var(--green)':'var(--red)'};font-size:11px">${fmt(tcBAvail)}</div></div>
        ${a.cl.status==='ocupada'?'<div class="stat"><div class="stat-label" style="color:var(--red)">⚠ L.Créd.</div><div class="stat-val" style="color:var(--red);font-size:11px">Ocupada</div></div>':''}
        <div class="stat"><div class="stat-label">Disponible</div><div class="stat-val" style="font-size:11px;cursor:pointer;text-decoration:underline dotted" onclick="eAvail()">${fmt(a.avail.bal)}</div></div>
        <div class="stat"><div class="stat-label" style="color:var(--red)">Deuda total</div><div class="stat-val" style="color:var(--red);font-size:11px">${fmt(totalLTDebt)}</div></div>
      </div>
    </div>
    ${monthCards}
    <div class="fx g8 mt8"><button class="btn bo2 bs f1" onclick="expAI()">📤 Exportar IA</button></div>
  `;
}

async function dismissWelcome(){await P(S.cfg,{id:'welcomeDismissed',data:true});$('welcomeCard')?.remove()}
function toggleMonth(m,e){if(e.target.closest('button,.confirm-btn'))return;expandedMonth=expandedMonth===m?null:m;rp()}
async function confirmTx(id){const t=await G(S.tx,id);t.projected=false;await P(S.tx,t);toast('Gasto confirmado');rp()}
async function confirmInc(id){const i=await G(S.inc,id);i.projected=false;await P(S.inc,i);toast('Ingreso confirmado');rp()}

// CAMBIO 5: toggle pendientes colapsables
function togglePendientes(m,e){
  e.stopPropagation();
  const sec=$('pendSection_'+m);const arrow=$('pendArrow_'+m);
  if(!sec)return;
  const open=sec.style.display==='block';
  sec.style.display=open?'none':'block';
  if(arrow)arrow.textContent=open?'▼':'▲';
}

async function showAllTxs(mk2){
  window._allTxMonth=mk2;
  oMdl(async el=>{
    const txs=(await GA(S.tx)).filter(t=>t.month===mk2).sort((a,b)=>b.date.localeCompare(a.date));
    const incs=(await GA(S.inc)).filter(i=>i.month===mk2);
    let fc=null;
    function ren(){
      const f=fc?txs.filter(t=>t.category===fc):txs;
      el.innerHTML=`${mh(mnm(mk2))}
        <div class="pill-g mb12"><button class="pill${!fc?' a':''}" onclick="window._fc=null;window._ren()">Todos</button>${CATS.map(c=>`<button class="pill${fc===c.id?' a':''}" onclick="window._fc='${c.id}';window._ren()">${c.i}</button>`).join('')}</div>
        ${incs.length?`<div class="mb8" style="font-size:12px;color:var(--text-d);font-weight:600">INGRESOS</div>`+incs.map(i=>`<div class="txi${i.projected?' projected':''}"><div class="txic" style="background:var(--green-d)">💵</div><div class="txin"><div class="txd">${i.description}</div><div class="txm">${i.date} · ${i.source}${i.projected?' · proyectado':''}</div></div><div class="txa" style="color:var(--green)">+${fmt(i.amount)}</div>
        <div class="fx fc g4" style="flex-shrink:0">${i.projected?`<button class="confirm-btn" onclick="confirmInc('${i.id}');cMdl()">✓</button>`:''}
        <button class="bi" style="width:28px;height:28px;font-size:11px" title="Repetir hoy" onclick="dupInc('${i.id}')">＋</button>
        <button class="bi" style="width:28px;height:28px;font-size:11px" onclick="delInc('${i.id}')">🗑</button></div></div>`).join('')+'<div style="height:12px"></div>':''}
        <div class="mb8" style="font-size:12px;color:var(--text-d);font-weight:600">GASTOS (${f.length})</div>
        ${f.map(t=>`<div class="fx fac g4" style="border-bottom:1px solid rgba(42,46,61,.3);padding:4px 0">
          ${txH(t)}
          <div class="fx fc g4" style="flex-shrink:0">
            <button class="bi" style="width:28px;height:28px;font-size:11px" title="Repetir hoy" onclick="dupTx('${t.id}')">＋</button>
            <button class="bi" style="width:28px;height:28px;font-size:11px" onclick="editTx('${t.id}')">✏️</button>
            <button class="bi" style="width:28px;height:28px;font-size:11px" onclick="delTx('${t.id}')">🗑</button>
            ${t.projected?`<button class="confirm-btn" onclick="confirmTx('${t.id}');cMdl()">✓</button>`:''}
          </div>
        </div>`).join('')||'<div style="text-align:center;color:var(--text-m);padding:20px;font-size:13px">Sin transacciones</div>'}`;
    }
    window._fc=null;window._ren=()=>{fc=window._fc;ren()};ren();
  });
}
async function delTx(id){if(!confirm('¿Eliminar?'))return;await DD(S.tx,id);toast('Eliminada');if(window._allTxMonth){showAllTxs(window._allTxMonth)}else{cMdl();rp()}}
async function dupTx(id){const t=await G(S.tx,id);oAddExp({amount:t.amount,description:t.description,category:t.category,account:t.account,date:td()});}
async function dupInc(id){const i=await G(S.inc,id);oAddExp({_inc:true,amount:i.amount,description:i.description,date:td()});}
async function delInc(id){if(!confirm('¿Eliminar?'))return;await DD(S.inc,id);toast('Eliminado');if(window._allTxMonth){showAllTxs(window._allTxMonth)}else{cMdl();rp()}}

async function editTx(id){
  const t=await G(S.tx,id);
  oMdl(el=>{el.innerHTML=`${mh('Editar transacción')}
    <div class="ig"><label>Monto</label><input type="text" id="etA" inputmode="numeric" oninput="fmtInput(this)"></div>
    <div class="ig"><label>Descripción</label><input type="text" id="etD" value="${t.description}"></div>
    <div class="ig"><label>Categoría</label><select id="etC">${catOpts(t.category)}</select></div>
    <div class="ig"><label>Fecha</label><input type="date" id="etDt" value="${t.date}"></div>
    <div class="ig"><label>Período</label><select id="etPer">${periodOpts(t.month)}</select></div>
    <div class="ig"><label>Cuenta</label><select id="etAc"><option value="TC Santander"${t.account==='TC Santander'?' selected':''}>TC Santander</option><option value="TC BChile"${t.account==='TC BChile'?' selected':''}>TC BChile</option><option value="Disponible"${t.account==='Disponible'?' selected':''}>Disponible</option></select></div>
    <button class="btn bp bf" onclick="saveTxEdit('${id}')">Guardar</button>`;
    setAmt('etA',t.amount);
  });
}
async function saveTxEdit(id){
  const t=await G(S.tx,id);
  t.amount=numVal('etA')||t.amount;t.description=$('etD').value||t.description;t.category=$('etC').value;t.date=$('etDt').value;t.month=$('etPer').value;t.account=$('etAc').value;
  await P(S.tx,t);toast('Actualizada');if(window._allTxMonth){showAllTxs(window._allTxMonth)}else{cMdl();rp()};
}

// ===== PAGE: AGREGAR =====
function rAdd(c){
  const items=[
    ['💸','Gasto / Ingreso real','Registra un movimiento confirmado','oAddExp()','var(--red-d)'],
    ['📋','Pagar gasto fijo','De tu lista de referencia','oPayFE()','var(--yellow-d)'],
    ['💳','Pagar TC','Transferencia interna','oPayTC()','var(--accent-d)'],
    ['🔮','Proyectado','Gasto o ingreso futuro estimado','oAddProj()','var(--orange-d)'],
    ['📋','Importar estado de cuenta','Archivo JSON ec_BANCO_MES','oUpPDF()','rgba(56,189,248,.12)']
  ];
  c.innerHTML=`<div class="ph"><h1>Agregar</h1><div class="sub">Registra movimientos</div></div>
  ${items.map(([ic,t,d,fn,bg])=>`<div class="card ck" onclick="${fn}"><div class="fx fac g12"><div style="width:40px;height:40px;border-radius:10px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:18px">${ic}</div><div><div style="font-weight:600;font-size:14px">${t}</div><div style="font-size:12px;color:var(--text-d)">${d}</div></div><span class="mla" style="color:var(--text-d)">→</span></div></div>`).join('')}`;
}

// CAMBIO 2: formularios con selector de período
function oAddExp(def={}){
  const isInc=def._inc||false;
  const defDate=def.date||td();
  const defPer=billingPeriod(defDate);
  oMdl(el=>{
    el.innerHTML=`${mh('Registrar movimiento')}
    <div class="ig">
      <label>Tipo</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button id="btnGasto" class="btn ${!isInc?'bp':'bo2'}" onclick="oAddExp({_inc:false,amount:numVal('eA'),description:$('eD')?.value,date:$('eDt')?.value,category:$('eC')?.value})">💸 Gasto</button>
        <button id="btnIngreso" class="btn ${isInc?'bp bgn':'bo2'}" onclick="oAddExp({_inc:true,amount:numVal('eA'),description:$('eD')?.value,date:$('eDt')?.value})">💵 Ingreso</button>
      </div>
    </div>
    <div class="ig"><label>Monto</label><input type="text" id="eA" placeholder="15.000" inputmode="numeric" oninput="fmtInput(this)"></div>
    <div class="ig"><label>Descripción</label><input type="text" id="eD" placeholder="${isInc?'Sueldo UC enero':'Supermercado'}" value="${def.description||''}"></div>
    ${isInc?`
    <div class="ig"><label>Fuente</label><select id="iS"><option value="Sueldo UC">Sueldo UC</option><option value="Honorarios SAPHIR">Honorarios SAPHIR</option><option value="Otro">Otro</option></select></div>
    `:`
    <div class="ig"><label>Categoría</label><select id="eC">${catOpts(def.category||'')}</select></div>
    <div class="ig"><label>Cuenta</label><select id="eAc"><option value="TC Santander">TC Santander</option><option value="TC BChile">TC BChile</option><option value="Disponible">Disponible</option></select></div>
    `}
    <div class="ig"><label>Fecha</label><input type="date" id="eDt" value="${defDate}" oninput="const p=billingPeriod(this.value);const sel=$('ePer');if(sel)sel.value=p;"></div>
    <div class="ig"><label>Período de facturación</label><select id="ePer">${periodOpts(defPer)}</select></div>
    <button class="btn bp bf mt8" onclick="${isInc?'sSaveInc()':'sSaveExp()'}">Guardar</button>`;
    setAmt('eA',def.amount||0);
    setTimeout(()=>$('eA').focus(),200);
  });
}
function oAddInc(){oAddExp({_inc:true})}

// CAMBIO 7: sSaveExp sin opción Efectivo; usa período seleccionado
async function sSaveExp(){
  const a=numVal('eA'),d=$('eD').value.trim(),cat=$('eC').value,dt=$('eDt').value,ac=$('eAc').value;
  const per=$('ePer')?$('ePer').value:dt.substring(0,7);
  if(!a||a<=0){toast('Monto inválido');return}
  if(!d){toast('Falta descripción');return}
  await P(S.tx,{id:uid(),amount:a,description:d,category:cat,date:dt,month:per,account:ac,projected:false,source:'manual'});
  if(ac==='Disponible'){st.accts.avail.bal-=a;await sAccts()}
  cMdl();toast('Gasto registrado');rp();
}
async function sSaveInc(){
  const a=numVal('eA'),d=$('eD').value.trim(),s=$('iS')?.value||'Otro',dt=$('eDt').value;
  const per=$('ePer')?$('ePer').value:dt.substring(0,7);
  if(!a||a<=0){toast('Monto inválido');return}
  await P(S.inc,{id:uid(),amount:a,description:d||s,source:s,date:dt,month:per,projected:false});
  cMdl();toast('Ingreso registrado');rp();
}
async function sExp(){await sSaveExp();}
async function sInc(){await sSaveInc();}

async function oPayFE(){
  const fes=await GA(S.fe);
  oMdl(el=>{el.innerHTML=`${mh('Pagar gasto fijo')}
  ${fes.map(fe=>{const c=catById(fe.category);return`<div class="card ck" onclick="cPayFE('${fe.id}')" style="padding:12px"><div class="fx fb fac"><div class="fx fac g8"><span>${c.i}</span><div><div style="font-size:13px;font-weight:500">${fe.name}</div><div style="font-size:11px;color:var(--text-m)">${c.n}</div></div></div><div class="amts">${fe.amount?fmt(fe.amount):'Variable'}</div></div></div>`}).join('')}`;});
}
async function cPayFE(id){const fe=await G(S.fe,id);cMdl();oAddExp({amount:fe.amount||'',description:fe.name,category:fe.category,date:td()})}

function oPayTC(){
  oMdl(el=>{el.innerHTML=`${mh('Pagar TC')}
    <div style="font-size:12px;color:var(--text-d);margin-bottom:12px;padding:8px;background:var(--accent-d);border-radius:var(--rs)">⚠️ Descuenta del disponible y reduce saldo TC. <b>No</b> se contabiliza como gasto.</div>
    <div class="ig"><label>Tarjeta</label><select id="ptS"><option value="tcS">TC Santander (pend: ${fmt(st.accts.tcS.pend)})</option><option value="tcB">TC BChile (pend: ${fmt(st.accts.tcB.pend)})</option></select></div>
    <div class="ig"><label>Monto</label><input type="text" id="ptA" inputmode="numeric" oninput="fmtInput(this)"></div>
    <button class="btn bp bf" onclick="sPayTC()">Pagar</button>`;});
}
async function sPayTC(){
  const tc=$('ptS').value,a=numVal('ptA');if(!a||a<=0){toast('Monto');return}
  const nm=tc==='tcS'?'TC Santander':'TC BChile';
  await P(S.tx,{id:uid(),amount:a,description:`Pago ${nm}`,category:'transferencia',date:td(),month:mk(),account:'Disponible',projected:false,source:'payTC'});
  st.accts.avail.bal-=a;st.accts[tc].used-=a;st.accts[tc].pend=Math.max(0,st.accts[tc].pend-a);
  await sAccts();cMdl();toast(`Pago ${fmt(a)} a ${nm}`);rp();
}

// CAMBIO 2: oAddProj con selector de período
function oAddProj(isInc=false){
  const defDate=td();const defPer=billingPeriod(defDate);
  oMdl(el=>{
    el.innerHTML=`${mh('Registrar proyectado')}
    <div style="font-size:12px;color:var(--text-d);margin-bottom:12px;padding:8px;background:var(--orange-d);border-radius:var(--rs)">No afecta el balance hasta que lo confirmes.</div>
    <div class="ig">
      <label>Tipo</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button class="btn ${!isInc?'bp':'bo2'}" onclick="oAddProj(false)">🔮 Gasto</button>
        <button class="btn ${isInc?'bp bgn':'bo2'}" onclick="oAddProj(true)">🤝 Ingreso</button>
      </div>
    </div>
    <div class="ig"><label>Monto</label><input type="text" id="pA" placeholder="15.000" inputmode="numeric" oninput="fmtInput(this)"></div>
    <div class="ig"><label>Descripción</label><input type="text" id="pD" placeholder="${isInc?'Bono esperado':'Gasto estimado'}"></div>
    ${!isInc?`<div class="ig"><label>Categoría</label><select id="pC">${catOpts('')}</select></div>`:''}
    <div class="ig"><label>Fecha estimada</label><input type="date" id="pDt" value="${defDate}" oninput="const p=billingPeriod(this.value);const sel=$('pPer');if(sel)sel.value=p;"></div>
    <div class="ig"><label>Período de facturación</label><select id="pPer">${periodOpts(defPer)}</select></div>
    <button class="btn bp bf mt8" onclick="sSaveProj(${isInc})">Guardar</button>`;
    setTimeout(()=>$('pA').focus(),200);
  });
}
function oAddOwed(){oAddProj(true)}
async function sSaveProj(isInc){
  const a=numVal('pA'),d=$('pD').value.trim(),cat=$('pC')?.value||'otros',dt=$('pDt').value;
  const per=$('pPer')?$('pPer').value:dt.substring(0,7);
  if(!a||!d){toast('Completa los campos');return}
  if(isInc){
    await P(S.inc,{id:uid(),amount:a,description:d,source:'Ingreso proyectado',date:dt,month:per,projected:true});
  }else{
    await P(S.tx,{id:uid(),amount:a,description:d,category:cat,date:dt,month:per,account:'',projected:true,source:'projected'});
  }
  cMdl();toast('Proyectado registrado');rp();
}
async function sProj(){await sSaveProj(false);}
async function sOwed(){await sSaveProj(true);}

// ===== PAGE: CUENTAS (accordion unificado con Metas) =====
// ===== REGLAS DE CUENTAS =====
// DISPONIBLE: se modifica con (a) registros que usan cuenta "Disponible", (b) edición manual, (c) pagos de TCs, (d) pagos de deudas, (e) aportes a metas. TODOS son permanentes.
// TCs (tcS, tcB): el campo `used` se recalcula dinámicamente desde transacciones reales del mes.
// DEUDAS: siempre se pagan desde disponible. El pago genera una tx permanente + actualiza la deuda.
// METAS: los aportes descuentan del disponible y son permanentes.

// CAMBIO 6b: accordion
function accSection(key,title,icon,content){
  const open=accOpen[key];
  if(key==='disponible'){
    return`<div class="card" style="margin-bottom:12px"><h3 style="margin:0 0 12px">${icon} ${title}</h3>${content}</div>`;
  }
  return`<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">
    <button class="btn" style="width:100%;background:none;border:none;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleAcc('${key}')">
      <h3 style="margin:0">${icon} ${title}</h3>
      <span style="color:var(--text-d)">${open?'▲':'▼'}</span>
    </button>
    ${open?`<div style="padding:0 16px 16px">${content}</div>`:''}
  </div>`;
}
function toggleAcc(key){accOpen[key]=!accOpen[key];const c=$('pc');rAcc(c)}

async function rAcc(c){
  const a=st.accts,debts=await GA(S.debts),goals=await GA(S.goals);
  // used y pend se actualizan al importar el EC (sBatch). Solo leemos st.accts.

  // Calcular cuotas pendientes por TC
  // Para cada compra en cuotas, tomamos la última aparición (mes más reciente)
  // y calculamos cuántas cuotas quedan × monto mensual
  const allTxAcc=await GA(S.tx);
  function calcCuotasPend(cuenta){
    // Agrupar por descripción normalizada para identificar cada compra
    const compras={};
    allTxAcc.filter(t=>t.account===cuenta&&t.cuota).forEach(t=>{
      const key=t.description.toLowerCase().replace(/\s+/g,'_').substring(0,30);
      // Parsear "07/12" → actual=7, total=12
      const m=String(t.cuota).match(/(\d+)\s*[\/]\s*(\d+)/);
      if(!m)return;
      const actual=parseInt(m[1]),total=parseInt(m[2]);
      if(total<=0)return;
      // Guardar la aparición más reciente
      if(!compras[key]||t.month>compras[key].month){
        compras[key]={desc:t.description,amount:t.amount,actual,total,month:t.month};
      }
    });
    // Sumar cuotas restantes (total - actual) × monto
    let totalPend=0;
    const detalle=[];
    Object.values(compras).forEach(c=>{
      const restantes=Math.max(0,c.total-c.actual);
      if(restantes>0){
        const subtotal=restantes*c.amount;
        totalPend+=subtotal;
        detalle.push({desc:c.desc,amount:c.amount,actual:c.actual,total:c.total,restantes,subtotal});
      }
    });
    return{total:totalPend,detalle};
  }
  const cuotasSant=calcCuotasPend('TC Santander');
  const cuotasBCh=calcCuotasPend('TC BChile');

  // Sección disponible
  const secDisponible=`
    <div class="fx fb fac mb8">
      <div class="amtl">${fmt(a.avail.bal)}</div>
      <div class="fx g8">
        <button class="btn bs bo2" onclick="eAvail()">Editar</button>
        <button class="btn bs bgn" onclick="addMoney()">+ Dinero</button>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text-m)">Todos los movimientos con disponible son permanentes</div>`;

  // Sección TCs + líneas de crédito
  function tcBlock(key,nm,badge,col,cuotas){const t=a[key];const av=t.tc-t.used;
    const cuotasHtml=cuotas.detalle.length?`
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        <div class="fx fb fac mb6">
          <span style="font-size:11px;color:var(--text-m);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Cuotas pendientes</span>
          <span style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--yellow)">${fmt(cuotas.total)}</span>
        </div>
        ${cuotas.detalle.map(c=>`<div class="fx fb fac" style="font-size:11px;padding:3px 0">
          <span style="color:var(--text-d);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.desc}</span>
          <span style="color:var(--text-m);margin:0 8px;flex-shrink:0">${c.actual}/${c.total}</span>
          <span style="font-family:var(--mono);color:var(--text);flex-shrink:0">${fmt(c.subtotal)}</span>
        </div>`).join('')}
      </div>`:'';
    return`<div style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div class="fx fb fac"><h3 style="font-size:14px">💳 ${nm}</h3><span class="bdg bb">${badge}</span></div>
      <div class="fx g16 mt8">
        <div><div style="font-size:11px;color:var(--text-m)">Utilizado</div><div class="amts">${fmt(t.used)}</div></div>
        <div><div style="font-size:11px;color:var(--text-m)">Cupo</div><div class="amts">${fmt(t.tc)}</div></div>
        <div><div style="font-size:11px;color:var(--text-m)">Disponible</div><div class="amts" style="color:${av>=0?'var(--green)':'var(--red)'}">${fmt(av)}</div></div>
      </div>
      <div class="prog mt8"><div class="progf" style="width:${Math.min(100,Math.max(0,t.used/t.tc*100))}%;background:${col}"></div></div>
      <div class="fx fb fac mt8">
        <div><span style="font-size:11px;color:var(--text-m)">Próximo pago:</span> <span class="amts">${fmt(t.pend)}</span></div>
        <button class="btn bs bp" onclick="oPayTC()">Pagar</button>
      </div>
      ${cuotasHtml}
    </div>`}
  const secTCs=`
    ${tcBlock('tcS','TC Santander','Mastercard Gold','var(--accent)',cuotasSant)}
    ${tcBlock('tcB','TC BChile','Visa','var(--purple)',cuotasBCh)}
    <div style="padding:10px 0;margin-top:4px">
      <div class="fx fb fac">
        <span style="font-size:13px;font-weight:500">🏦 Líneas de crédito</span>
        ${a.cl.status==='libre'?'<span class="bdg bg">Libre</span>':'<span class="bdg br">⚠️ Ocupada</span>'}
      </div>
      ${a.cl.status==='ocupada'?`<div class="mt4"><span style="font-size:11px;color:var(--text-m)">Pendiente:</span> <span class="amts">${fmt(a.cl.pend)}</span></div>`:''}
      <button class="btn bs bo2 mt8" onclick="eCL()">Editar</button>
    </div>`;

  // Sección deudas
  const secDeudas=debts.length
    ?debts.map(d=>debtCard(d)).join('')+'<button class="btn bo2 bf mt12" onclick="oAddDebt()">+ Nueva deuda</button>'
    :'<div style="font-size:13px;color:var(--text-m);padding:12px 0">Sin deudas registradas</div><button class="btn bo2 bf mt8" onclick="oAddDebt()">+ Nueva deuda</button>';

  // Sección metas integrada
  const secMetas=goals.length?goals.map(g=>{
    const pr=g.target>0?(g.bal/g.target*100):0;
    const db=g.hide?'***':fmt(g.bal);
    return`<div style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div class="fx fb fac">
        <h3 style="font-size:14px">${g.name}</h3>
        <div class="fx g4">
          <button class="bi" onclick="togG('${g.id}')" style="font-size:12px">${g.hide?'👁':'👁‍🗨'}</button>
          <button class="bi" onclick="eGoal('${g.id}')" style="font-size:12px">✏️</button>
        </div>
      </div>
      <div class="amtl mt8" style="font-size:22px">${db}</div>
      ${g.target>0?`<div class="fx fb mt8" style="font-size:11px;color:var(--text-m)"><span>Meta: ${fmt(g.target)}</span><span>${pct(Math.min(100,pr))}</span></div><div class="prog mt4"><div class="progf" style="width:${Math.min(100,pr)}%;background:var(--green)"></div></div>`:''}
      ${g.targetDate?`<div style="font-size:11px;color:var(--text-m);margin-top:6px">📅 ${g.targetDate}</div>`:''}
      <div class="fx g8 mt12" style="padding-top:8px;border-top:1px solid var(--border)">
        <button class="btn bs bgn f1" onclick="oContrib('${g.id}')">+ Aportar</button>
        <button class="btn bs bo2 f1" onclick="eGBal('${g.id}')">Ajustar saldo</button>
      </div>
      ${(g.contribs||[]).length?`<div style="margin-top:8px;font-size:11px;color:var(--text-m)">Último: ${fmt(g.contribs[g.contribs.length-1].amount)} — ${g.contribs[g.contribs.length-1].date}</div>`:''}</div>`;
  }).join('')+`<button class="btn bo2 bf mt12" onclick="oAddGoal()">+ Nueva meta</button>`
  :'<div style="text-align:center;padding:16px 0"><div style="font-size:32px;margin-bottom:8px">🎯</div><div style="font-size:13px;color:var(--text-d)">Sin metas aún</div><button class="btn bp bs mt8" onclick="oAddGoal()">+ Nueva meta</button></div>';

  c.innerHTML=`<div class="ph"><h1>Cuentas</h1></div>
    ${accSection('disponible','Disponible','💰',secDisponible)}
    ${accSection('tcs','Tarjetas de crédito','💳',secTCs)}
    ${accSection('deudas','Deudas activas','🏦',secDeudas)}
    ${accSection('metas','Metas de ahorro','🎯',secMetas)}`;
}

// CAMBIO 6e: debtCard con soporte noMax
function debtCard(d){
  const isNoMax=d.noMax||d.ti===0;
  const pr=!isNoMax&&d.ti>0?(d.ci/d.ti*100):0;
  return`<div style="padding:12px 0;border-bottom:1px solid var(--border)">
    <div class="fx fb fac">
      <div>
        <div style="font-size:14px;font-weight:600">${d.name}</div>
        <div style="font-size:11px;color:var(--text-m)">${!isNoMax&&d.ti>0?`Cuota ${d.ci}/${d.ti}`:'Sin tope definido'}</div>
      </div>
      <button class="bi" onclick="eDebt('${d.id}')" style="font-size:12px">✏️</button>
    </div>
    <div class="fx g16 mt8">
      ${!isNoMax?`<div><div style="font-size:11px;color:var(--text-m)">Saldo</div><div class="amts">${d.balance>0?fmt(d.balance):'—'}</div></div>`
      :`<div><div style="font-size:11px;color:var(--text-m)">Total pagado</div><div class="amts" style="color:var(--green)">${fmt(d.totalPaid||0)}</div></div>`}
      <div><div style="font-size:11px;color:var(--text-m)">Cuota est.</div><div class="amts">${fmt(d.mp)}</div></div>
    </div>
    ${!isNoMax&&d.ti>0?`<div class="dbar mt8"><div class="dbarf" style="width:${pr}%"></div></div><div style="font-size:10px;color:var(--text-m);text-align:right;margin-top:4px">${pct(pr)}</div>`:''}
    <button class="btn bs bp mt8" onclick="payDebt('${d.id}')">Pagar cuota</button>
  </div>`;
}

// CAMBIO 6e: payDebt y confirmPayDebt
async function payDebt(id){
  const d=await G(S.debts,id);if(!d)return;
  oMdl(el=>{
    el.innerHTML=`${mh('Pagar cuota: '+d.name)}
      <div style="font-size:12px;color:var(--text-d);margin-bottom:12px;padding:8px;background:var(--accent-d);border-radius:var(--rs)">
        Se descontará del <b>disponible</b> y se registrará como gasto en categoría Deudas.
      </div>
      <div class="ig"><label>Monto (cuota estimada: ${fmt(d.mp)})</label>
        <input type="text" id="pdA" inputmode="numeric" oninput="fmtInput(this)" placeholder="${d.mp}">
      </div>
      <div class="ig"><label>Fecha</label>
        <input type="date" id="pdDt" value="${td()}" oninput="const p=billingPeriod(this.value);const sel=$('pdPer');if(sel)sel.value=p;">
      </div>
      <div class="ig"><label>Período</label>
        <select id="pdPer">${periodOpts(billingPeriod(td()))}</select>
      </div>
      <button class="btn bp bf mt8" onclick="confirmPayDebt('${id}')">✓ Confirmar pago</button>`;
  });
}
async function confirmPayDebt(id){
  const d=await G(S.debts,id);
  const amount=numVal('pdA')||d.mp;
  const dt=$('pdDt').value;
  const period=$('pdPer').value;
  if(!amount||amount<=0){toast('Monto inválido');return}
  await P(S.tx,{id:uid(),amount,description:`Pago ${d.name}`,category:'deudas',date:dt,month:period,account:'Disponible',projected:false,source:'debtPayment'});
  st.accts.avail.bal-=amount;
  await sAccts();
  d.totalPaid=(d.totalPaid||0)+amount;
  if(d.balance>0)d.balance=Math.max(0,d.balance-amount);
  if(!d.noMax&&d.ti>0)d.ci=Math.min(d.ti,d.ci+1);
  await P(S.debts,d);
  cMdl();toast(`Pago de ${fmt(amount)} registrado`);rp();
}

// eDebt mejorado con noMax y totalPaid
async function eDebt(id){
  const d=await G(S.debts,id);if(!d)return;
  oMdl(el=>{
    el.innerHTML=`${mh('Editar deuda')}
      <div class="ig"><label>Nombre</label><input type="text" id="dN" value="${d.name}"></div>
      <div class="ig">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="dNoMax" ${d.noMax?'checked':''}
            onchange="$('dBalWrap').style.display=this.checked?'none':'block';$('dTiWrap').style.display=this.checked?'none':'block'">
          Sin tope máximo (deuda en UF o variable)
        </label>
      </div>
      <div id="dBalWrap" ${d.noMax?'style="display:none"':''}>
        <div class="ig"><label>Saldo actual <span style="font-size:10px;color:var(--text-m)">(actualizar si cambia por UF)</span></label>
          <input type="text" id="dB" inputmode="numeric" oninput="fmtInput(this)">
        </div>
      </div>
      <div class="ig"><label>Cuota estimada mensual</label><input type="text" id="dP" inputmode="numeric" oninput="fmtInput(this)"></div>
      <div id="dTiWrap" ${d.noMax?'style="display:none"':''}>
        <div class="ig"><label>Cuota actual</label><input type="text" id="dC" value="${d.ci}" inputmode="numeric"></div>
        <div class="ig"><label>Total cuotas</label><input type="text" id="dT" value="${d.ti}" inputmode="numeric"></div>
      </div>
      <div class="fx g8 mt8">
        <button class="btn bp f1" onclick="sDebt('${id}')">Guardar</button>
        <button class="btn bd f1" onclick="dDebt('${id}')">Eliminar</button>
      </div>`;
    setAmt('dB',d.balance);setAmt('dP',d.mp);
  });
}
async function sDebt(id){
  const d=await G(S.debts,id);
  d.name=$('dN').value;
  d.noMax=$('dNoMax').checked;
  d.balance=numVal('dB');
  d.mp=numVal('dP');
  d.ci=parseInt($('dC')?.value)||d.ci;
  d.ti=parseInt($('dT')?.value)||d.ti;
  await P(S.debts,d);cMdl();toast('Deuda actualizada');rp();
}
async function dDebt(id){if(!confirm('¿Eliminar deuda?'))return;await DD(S.debts,id);cMdl();toast('OK');rp()}
function oAddDebt(){
  oMdl(el=>{el.innerHTML=`${mh('Nueva deuda')}
    <div class="ig"><label>Nombre</label><input type="text" id="dN"></div>
    <div class="ig"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="dNoMax" onchange="$('dBalWrap').style.display=this.checked?'none':'block';$('dTiWrap').style.display=this.checked?'none':'block'"> Sin tope máximo</label></div>
    <div id="dBalWrap"><div class="ig"><label>Saldo actual</label><input type="text" id="dB" inputmode="numeric" oninput="fmtInput(this)"></div></div>
    <div class="ig"><label>Cuota estimada mensual</label><input type="text" id="dP" inputmode="numeric" oninput="fmtInput(this)"></div>
    <div id="dTiWrap">
      <div class="ig"><label>Cuota actual (N°)</label><input type="text" id="dC" value="1" inputmode="numeric"></div>
      <div class="ig"><label>Total cuotas</label><input type="text" id="dT" value="12" inputmode="numeric"></div>
    </div>
    <button class="btn bp bf" onclick="sNewDebt()">Crear</button>`});
}
async function sNewDebt(){
  const name=$('dN').value.trim();if(!name){toast('Nombre requerido');return}
  await P(S.debts,{id:'debt_'+uid(),name,balance:numVal('dB'),mp:numVal('dP'),ci:parseInt($('dC')?.value)||1,ti:parseInt($('dT')?.value)||12,noMax:$('dNoMax').checked,totalPaid:0});
  cMdl();toast('Deuda creada');rp();
}

function eAvail(){oMdl(el=>{el.innerHTML=`${mh('Disponible')}<div class="ig"><label>Saldo</label><input type="text" id="avA" inputmode="numeric" oninput="fmtInput(this)"></div><button class="btn bp bf" onclick="sAvail()">Guardar</button>`;setAmt('avA',st.accts.avail.bal)})}
async function sAvail(){const v=numVal('avA');st.accts.avail.bal=v;await sAccts();cMdl();toast('OK');rp()}
function addMoney(){oMdl(el=>{el.innerHTML=`${mh('Agregar dinero')}<div class="ig"><label>Monto</label><input type="text" id="amA" inputmode="numeric" oninput="fmtInput(this)"></div><div class="ig"><label>Descripción</label><input type="text" id="amD"></div><button class="btn bp bf" onclick="sAddM()">Agregar</button>`})}
async function sAddM(){const a=numVal('amA');if(!a){toast('Monto');return}st.accts.avail.bal+=a;await sAccts();cMdl();toast(`+${fmt(a)}`);rp()}
function eCL(){oMdl(el=>{el.innerHTML=`${mh('Líneas de crédito')}<div class="ig"><label>Estado</label><select id="clS"><option value="libre"${st.accts.cl.status==='libre'?' selected':''}>Libre</option><option value="ocupada"${st.accts.cl.status==='ocupada'?' selected':''}>Ocupada</option></select></div><div class="ig"><label>Pendiente</label><input type="text" id="clA" inputmode="numeric" oninput="fmtInput(this)"></div><button class="btn bp bf" onclick="sCL()">Guardar</button>`;setAmt('clA',st.accts.cl.pend)})}
async function sCL(){st.accts.cl.status=$('clS').value;st.accts.cl.pend=numVal('clA');await sAccts();cMdl();toast('OK');rp()}
async function sAccts(){await P(S.cfg,{id:'accounts',data:st.accts})}

// ===== METAS (funciones internas, llamadas desde rAcc) =====
async function rMet(c){rAcc(c)}

function oAddGoal(){oMdl(el=>{el.innerHTML=`${mh('Nueva meta')}<div class="ig"><label>Nombre</label><input type="text" id="gN"></div><div class="ig"><label>Monto objetivo</label><input type="text" id="gT" inputmode="numeric" oninput="fmtInput(this)"></div><div class="ig"><label>Saldo inicial</label><input type="text" id="gI" value="0" inputmode="numeric" oninput="fmtInput(this)"></div><div class="ig"><label>Fecha objetivo</label><input type="date" id="gD"></div><button class="btn bp bf" onclick="sNG()">Crear</button>`})}
async function sNG(){const n=$('gN').value.trim();if(!n){toast('Nombre');return}await P(S.goals,{id:uid(),name:n,target:numVal('gT'),bal:numVal('gI'),targetDate:$('gD').value||null,hide:false,contribs:[]});cMdl();toast('Creada');rp()}
function oContrib(gid){oMdl(el=>{el.innerHTML=`${mh('Aportar')}<div class="ig"><label>Monto</label><input type="text" id="cA" inputmode="numeric" oninput="fmtInput(this)"></div><div style="font-size:11px;color:var(--text-d);margin-bottom:12px">Se descuenta del disponible</div><button class="btn bp bf" onclick="sC('${gid}')">Aportar</button>`})}
async function sC(gid){const a=numVal('cA');if(!a||a<=0)return;const g=await G(S.goals,gid);g.bal+=a;g.contribs=g.contribs||[];g.contribs.push({amount:a,date:td(),month:mk()});await P(S.goals,g);st.accts.avail.bal-=a;await sAccts();cMdl();toast(`+${fmt(a)}`);rp()}
async function eGBal(gid){const g=await G(S.goals,gid);oMdl(el=>{el.innerHTML=`${mh('Ajustar saldo')}<div style="font-size:12px;color:var(--text-d);margin-bottom:8px">No afecta disponible</div><div class="ig"><label>Saldo</label><input type="text" id="gB" inputmode="numeric" oninput="fmtInput(this)"></div><button class="btn bp bf" onclick="sGB('${gid}')">Guardar</button>`;setAmt('gB',g.bal)})}
async function sGB(gid){const g=await G(S.goals,gid);g.bal=numVal('gB');await P(S.goals,g);cMdl();toast('OK');rp()}
async function togG(gid){const g=await G(S.goals,gid);g.hide=!g.hide;await P(S.goals,g);rp()}
async function eGoal(gid){const g=await G(S.goals,gid);oMdl(el=>{el.innerHTML=`${mh('Editar meta')}<div class="ig"><label>Nombre</label><input type="text" id="egN" value="${g.name}"></div><div class="ig"><label>Objetivo</label><input type="text" id="egT" inputmode="numeric" oninput="fmtInput(this)"></div><div class="ig"><label>Fecha</label><input type="date" id="egD" value="${g.targetDate||''}"></div><div class="fx g8"><button class="btn bp f1" onclick="sEG('${gid}')">Guardar</button><button class="btn bd f1" onclick="dG('${gid}')">Eliminar</button></div>`;setAmt('egT',g.target)})}
async function sEG(gid){const g=await G(S.goals,gid);g.name=$('egN').value;g.target=numVal('egT');g.targetDate=$('egD').value||null;await P(S.goals,g);cMdl();toast('OK');rp()}
async function dG(gid){if(!confirm('¿Eliminar?'))return;await DD(S.goals,gid);cMdl();toast('OK');rp()}

// ===== PAGE: AJUSTES =====
async function rSet(c){
  const fes=await GA(S.fe);
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  c.innerHTML=`<div class="ph"><h1>Ajustes</h1></div>
  ${isIOS?'<div class="card" style="background:var(--accent-d);border-color:rgba(74,124,255,.3)"><div style="font-size:13px"><b>📲 Instalar en iOS:</b> Safari → Compartir (↑) → "Agregar a pantalla de inicio"</div></div>':''}
  <h2 class="mb8">Gastos fijos</h2>
  ${fes.map(fe=>{const ct=catById(fe.category);return`<div class="card" style="padding:10px 14px"><div class="fx fb fac"><div class="fx fac g8"><span>${ct.i}</span><div><div style="font-size:13px;font-weight:500">${fe.name}</div><div style="font-size:10px;color:var(--text-m)">${ct.n} · ${fe.type}</div></div></div><div class="fx fac g8"><span class="amts">${fe.amount?fmt(fe.amount):'—'}</span><button class="bi" onclick="eFE('${fe.id}')" style="width:28px;height:28px;font-size:11px">✏️</button><button class="bi" onclick="dFE('${fe.id}')" style="width:28px;height:28px;font-size:11px">🗑</button></div></div></div>`}).join('')}
  <button class="btn bo2 bf mb16" onclick="aFE()">+ Agregar gasto fijo</button>
  <h2 class="mb8">Backup</h2>
  <div class="card"><div class="fx g8"><button class="btn bp f1" onclick="expBk()">📤 Exportar</button><button class="btn bo2 f1" onclick="$('impF').click()">📥 Importar</button><input type="file" id="impF" accept=".json" class="hidden" onchange="impBk(event)"></div>${st.lastBk?`<div style="font-size:11px;color:var(--text-m);margin-top:8px">Último: ${new Date(st.lastBk).toLocaleDateString('es-CL')}</div>`:''}</div>
  <h2 class="mb8">Exportar</h2><div class="card"><button class="btn bo2 bf" onclick="expAI()">📊 Exportar .md para Claude</button></div>
  <h2 class="mb8">Datos</h2><div class="card"><button class="btn bd bf" onclick="resetAll()">⚠️ Borrar todo</button></div>
  <div style="text-align:center;padding:24px;font-size:11px;color:var(--text-m)">Finanzas v4.0</div>`;
}
async function eFE(id){const fe=await G(S.fe,id);oMdl(el=>{el.innerHTML=`${mh('Editar')}<div class="ig"><label>Nombre</label><input type="text" id="fN" value="${fe.name}"></div><div class="ig"><label>Monto</label><input type="text" id="fA" inputmode="numeric" oninput="fmtInput(this)"></div><div class="ig"><label>Categoría</label><select id="fC">${catOpts(fe.category)}</select></div><div class="ig"><label>Tipo</label><select id="fT"><option value="obligatorio"${fe.type==='obligatorio'?' selected':''}>Obligatorio</option><option value="opcional"${fe.type==='opcional'?' selected':''}>Opcional</option></select></div><button class="btn bp bf" onclick="sFE('${id}')">Guardar</button>`;setAmt('fA',fe.amount)})}
async function sFE(id){await P(S.fe,{id,name:$('fN').value,amount:numVal('fA'),category:$('fC').value,type:$('fT').value});cMdl();toast('OK');rp()}
async function dFE(id){if(!confirm('¿Eliminar?'))return;await DD(S.fe,id);toast('OK');rp()}
function aFE(){oMdl(el=>{el.innerHTML=`${mh('Nuevo gasto fijo')}<div class="ig"><label>Nombre</label><input type="text" id="fN"></div><div class="ig"><label>Monto</label><input type="text" id="fA" inputmode="numeric" oninput="fmtInput(this)"></div><div class="ig"><label>Categoría</label><select id="fC">${catOpts('')}</select></div><div class="ig"><label>Tipo</label><select id="fT"><option value="obligatorio">Obligatorio</option><option value="opcional">Opcional</option></select></div><button class="btn bp bf" onclick="sNFE()">Crear</button>`})}
async function sNFE(){await P(S.fe,{id:'fe_'+uid(),name:$('fN').value,amount:numVal('fA'),category:$('fC').value,type:$('fT').value});cMdl();toast('OK');rp()}

// ===== IMPORTAR ESTADO DE CUENTA (formato JSON) =====
function oUpPDF(){
  oMdl(el=>{el.innerHTML=`${mh('Importar estado de cuenta')}
    <div style="font-size:12px;color:var(--text-d);margin-bottom:12px;line-height:1.5">
      Sube el archivo <code style="background:var(--bg-input);padding:2px 6px;border-radius:4px;font-size:11px">ec_BANCO_MES_YYYY.json</code> generado con Claude.<br>
      <span style="color:var(--accent)">¿No tienes el JSON?</span> Usa Claude con el PDF y el prompt de extracción.
    </div>
    <div class="uz" id="ecDrop" onclick="$('ecI').click()">
      <div style="font-size:40px;margin-bottom:8px">📋</div>
      <div style="font-size:14px;font-weight:500">Toca para subir archivo JSON</div>
      <div style="font-size:12px;color:var(--text-d);margin-top:4px">ec_santander_*.json · ec_bchile_*.json</div>
    </div>
    <input type="file" id="ecI" accept=".json,application/json" class="hidden" onchange="hEC(event)">
    <div id="ecSt" class="mt12"></div>`;
    const dz=document.getElementById('ecDrop');
    if(dz){dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dov')});dz.addEventListener('dragleave',()=>dz.classList.remove('dov'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dov');const f=e.dataTransfer.files[0];if(f)procEC(f)})}
  });
}

function hEC(e){const f=e.target.files[0];if(f)procEC(f)}

async function procEC(file){
  const st2=$('ecSt');
  function dbg(msg,col='var(--text-d)'){st2.innerHTML+=`<div style="font-size:11px;color:${col};margin-top:4px;font-family:monospace">${msg}</div>`}
  st2.innerHTML='<div style="font-size:12px;color:var(--text-d)">⏳ Validando…</div>';
  try{
    const text=await file.text();
    let ec;
    try{ec=JSON.parse(text);}
    catch(pe){dbg('❌ JSON inválido: '+pe.message,'var(--red)');return;}
    if(!ec.meta||!ec.transacciones){dbg('❌ Estructura incorrecta: falta "meta" o "transacciones"','var(--red)');return;}
    if(!ec.meta.banco||!ec.meta.periodo){dbg('❌ Meta incompleta: falta banco o periodo','var(--red)');return;}
    const banco=ec.meta.banco==='santander'?'TC Santander':'TC BChile';
    const periodo=ec.meta.periodo;
    const txs=ec.transacciones;
    dbg('📋 '+file.name);dbg('🏦 '+banco+' · '+mnm(periodo));dbg('📊 '+txs.length+' transacciones');
    const errs=[];
    txs.forEach((t,i)=>{
      if(!t.fecha)errs.push('['+i+'] sin fecha');
      if(!t.descripcion)errs.push('['+i+'] sin descripcion');
      if(t.monto==null||isNaN(t.monto))errs.push('['+i+'] monto inválido');
      if(!['gasto','cuota','pago','comision'].includes(t.tipo))errs.push('['+i+'] tipo inválido: '+t.tipo);
    });
    if(errs.length){dbg('⚠️ Advertencias:','var(--yellow)');errs.slice(0,5).forEach(e=>dbg('  '+e,'var(--yellow)'));}
    const cargos=txs.filter(t=>t.tipo!=='pago').reduce((s,t)=>s+t.monto,0);
    const pagos=txs.filter(t=>t.tipo==='pago').reduce((s,t)=>s+t.monto,0);
    const ecCargos=ec.meta.total_cargos||0;
    const match=ecCargos>0&&Math.abs(cargos-ecCargos)<100;
    dbg('💰 Cargos: '+fmt(cargos)+(ecCargos>0?(match?' ✓ cuadra':' ⚠ EC dice '+fmt(ecCargos)):''),(match||!ecCargos)?'var(--green)':'var(--yellow)');
    dbg('💳 Pagos: '+fmt(pagos));
    if(errs.length>5)dbg('...y '+(errs.length-5)+' advertencias más','var(--yellow)');
    const internalTxs=txs.map(t=>({
      date:t.fecha,description:t.descripcion,amount:Math.abs(t.monto),
      category:t.tipo==='pago'?'transferencia':(t.tipo==='comision'?'comisiones':(t.categoria||'otros')),
      account:banco,month:periodo,cuota:t.notas||null,_tipo:t.tipo
    }));
    cMdl();
    oMdl(el=>{
      const cargosGasto=txs.filter(t=>['gasto','cuota'].includes(t.tipo)).reduce((s,t)=>s+t.monto,0);
      const cargosComision=txs.filter(t=>t.tipo==='comision').reduce((s,t)=>s+t.monto,0);
      el.innerHTML=`${mh('Confirmar importación')}
        <div style="background:var(--bg-input);border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px">${banco} · ${mnm(periodo)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
            <div style="color:var(--text-d)">Transacciones</div><div style="font-weight:600">${txs.length}</div>
            <div style="color:var(--text-d)">Gastos + cuotas</div><div style="font-weight:600;color:var(--red)">${fmt(cargosGasto)}</div>
            <div style="color:var(--text-d)">Comisiones</div><div style="font-weight:600;color:var(--orange)">${fmt(cargosComision)}</div>
            <div style="color:var(--text-d)">Pagos recibidos</div><div style="font-weight:600;color:var(--green)">${fmt(pagos)}</div>
          </div>
        </div>
        <div class="ig"><label>¿Cambiar mes?</label><select id="ecMon">${avMon().reverse().map(m=>'<option value="'+m+'"'+(m===periodo?' selected':'')+'>'+mnm(m)+'</option>').join('')}</select></div>
        <button class="btn bp bf mt8" onclick="confirmEC()">✓ Importar y etiquetar</button>`;
      window._ecTxs=internalTxs;window._ecBank=banco;
  window._ecMeta={banco,total_cargos:ec.meta?.total_cargos||0,total_pagos:ec.meta?.total_pagos||0};
    });
  }catch(e){console.error(e);st2.innerHTML=`<div style="color:var(--red)">Error: ${e.message}</div>`}
}

async function confirmEC(){
  const month=$('ecMon').value;
  const txs=window._ecTxs,bank=window._ecBank;
  await P(S.stmts,{id:uid(),bank,date:td(),month,count:txs.length});
  txs.forEach(tx=>tx.month=month);
  if(window._ecMeta)window._ecMeta.banco=bank;
  cMdl();showBatch(txs,bank);
}

// ===== PARSERS (PDF legacy — mantenidos) =====
function pDate(s){const p=s.split('/');const y=p[2].length===2?'20'+p[2]:p[2];return y+'-'+p[1]+'-'+p[0];}

function parseSant(text){
  const txs=[];const pages=text.split('\x0c');const p1=pages[0]||'';
  const cuotaBlocks=[...p1.matchAll(/(\d{2}\/\d{2}\/\d{2})\n\n([^\n]+)\n\n(?:CUOTA COMERCIO|CUOTA FIJA)/g)];
  const cuotaAmts=[...p1.matchAll(/\$(\d[\d.]+)\n/g)].map(m=>parseInt(m[1].replace(/\./g,'')));
  cuotaBlocks.forEach((m,i)=>{txs.push({date:pDate(m[1]),description:m[2].trim(),amount:cuotaAmts[i]||0,category:null,account:'TC Santander'})});
  for(const pg of pages.slice(1)){
    if(!pg.includes('PERÍODO ACTUAL'))continue;
    for(const m of pg.matchAll(/(\d{2}\/\d{2}\/\d{2})\n\nMONTO CANCELADO\n\n\$ (-[\d.]+)/g))
      txs.push({date:pDate(m[1]),description:'PAGO TC',amount:parseInt(m[2].replace(/\./g,'')),category:'pago',account:'TC Santander'});
    const chunks=pg.split(/\n\n(\d{2}\/\d{2}\/\d{2})\n\n/);const pairs=[];
    for(let i=1;i<chunks.length-1;i+=2){const desc=chunks[i+1].split('\n')[0].trim();if(desc&&!desc.includes('LUGAR DE')&&!desc.includes('PERÍODO')&&desc!=='MONTO CANCELADO')pairs.push([chunks[i],desc])}
    const amts=[...pg.matchAll(/^\$[\d.]+$/mg)].map(m=>parseInt(m[0].replace(/[$.]/g,'')));
    pairs.forEach(([dt,desc],i)=>{if(i<amts.length)txs.push({date:pDate(dt),description:desc,amount:amts[i],category:null,account:'TC Santander'})});
  }
  return txs;
}

function parseBCh(text){
  const txs=[];const pages=text.split('\x0c');
  for(const pg of pages){
    for(const m of pg.matchAll(/(\d{2}\/\d{2}\/\d{2})\n(\d{12})\s+Pago Pesos TEF/g))
      txs.push({date:pDate(m[1]),description:'PAGO TC',amount:0,category:'pago',account:'TC BChile'});
    const allDates=(pg.match(/^\d{2}\/\d{2}\/\d{2}$/mg)||[]);
    const codeDescs=[...pg.matchAll(/^(\d{12})\s+([\w*\s\/]+?)\s{2,}[A-Z\s]+$/mg)];
    const amtsD=[...pg.matchAll(/^\s+([\d.]+)\s+\$$/mg)].map(m=>parseInt(m[1].replace(/\./g,'')));
    const pagoCs=new Set([...pg.matchAll(/(\d{2}\/\d{2}\/\d{2})\n(\d{12})\s+Pago Pesos TEF/g)].map(m=>m[2]));
    const pagoDs=new Set([...pg.matchAll(/(\d{2}\/\d{2}\/\d{2})\n(\d{12})\s+Pago Pesos TEF/g)].map(m=>m[1]));
    codeDescs.filter(m=>!pagoCs.has(m[1])).forEach((m,i)=>{
      const dt=allDates.filter(d=>!pagoDs.has(d))[i]||'01/01/26';
      txs.push({date:pDate(dt),description:m[2].trim(),amount:amtsD[i]||0,category:null,account:'TC BChile'});
    });
    const ci=pg.indexOf('TOTAL TRANSACCIONES EN UNA CUOTA'),ce=pg.indexOf('TOTAL TRANSACCIONES EN CUOTAS');
    if(ci>=0&&ce>ci){const cs=pg.slice(ci,ce);const cDates=(cs.match(/^\d{2}\/\d{2}\/\d{2}$/mg)||[]);const cDescs=[...cs.matchAll(/^(\d{12})\s+([\w*\s\/]+?)\s+TASA INT\./mg)];const cAmts=[...cs.matchAll(/^\s+([\d.]+)\s+\$$/mg)].map(m=>parseInt(m[1].replace(/\./g,'')));cDescs.forEach((m,i)=>txs.push({date:pDate(cDates[i]||'01/01/26'),description:m[2].trim(),amount:cAmts[i]||0,category:null,account:'TC BChile'}))}
    const ri=pg.indexOf('3.CARGOS,');
    if(ri>=0){const cs=pg.slice(ri);const cDates=(cs.match(/^\d{2}\/\d{2}\/\d{2}$/mg)||[]);const cDescs=[...cs.matchAll(/^(\d{12})\s+([\w\s.,%]+?)$/mg)];const cAmts=[...cs.matchAll(/^\s+([\d.]+)\s+\$$/mg)].map(m=>parseInt(m[1].replace(/\./g,'')));cDescs.forEach((m,i)=>txs.push({date:pDate(cDates[i]||'01/01/26'),description:m[2].trim(),amount:cAmts[i]||0,category:'cargo',account:'TC BChile'}))}
  }
  return txs;
}

async function showBatch(txs,tcN){
  const saved=await GA(S.lbl);const lm={};saved.forEach(l=>{lm[l.merchant.toLowerCase()]=l.category});
  txs.forEach(tx=>{
    if(tx.category)return;
    const k=tx.description.toLowerCase();
    for(const[m,cat] of Object.entries(lm)){if(k.includes(m)){tx.category=cat;break}}
    if(!tx.category){const d=tx.description.toUpperCase();
      if(d.match(/JUMBO|UNIMARC|LIDER|SANTA ISABEL|TOSTADURIA|MAXIK|SUPERMERCADO/))tx.category='alimentacion';
      else if(d.match(/RESTAURANT|PIATTO|RAPPI|ZOLIAKIE|FUDO|CHUNG|KAFFEE|KOMODIN|MALDITOARRO|MELIMAS|EL TALLER|SB 755/))tx.category='alimentacion';
      else if(d.match(/UBER|BIP|BIPQR|TRANSPORTE|METRO/))tx.category='servicios';
      else if(d.match(/FARMACIA|CLINICA|BUPA|BRONCOPULMO|INDISA|MEDICO|SALUD|RAPASPA/))tx.category='salud';
      else if(d.match(/YOUTUBE|GOOGLE|SPOTIFY|NETFLIX|CLARO|ENTEL|TELEFONICA|DLOCAL|FILADD|MAGICSUR|ECOMMERCE/))tx.category='servicios';
      else if(d.match(/SCOTIABANK CAE|DECRETO|FSCU/))tx.category='deudas';
      else if(d.match(/DECATHLON|RUNNING|FORTUNA/))tx.category='salud';
      else if(d.match(/ENTRE JUEGOS|CINEMA|CINE|PLAYSTATION|STEAM/))tx.category='ocio';
      else if(d.match(/COMISION|IMPUESTO/))tx.category='comisiones';
      else if(d.match(/SAMSUNG|IPHONE|APPLE|FLOW \*SAMSUNG/))tx.category='bienes';
      else if(d.match(/ZAPATILLA|ROPA|VESTUARIO|FALABELLA|RIPLEY|PARIS|ZARA/))tx.category='bienes';
      else if(d.match(/PRONTOMATIC|PRONTO CIUC|PAYSCAN|SERVICIOS Y COMERCIAL|MARKETING MACHINE/))tx.category='hormiga';
    }
  });
  oMdl(el=>{
    window._btx=txs;
    function ren2(){
      const ul=txs.filter(t=>!t.category).length;
      el.innerHTML=`${mh('Etiquetar ('+tcN+')')}
        <div class="mb8" style="font-size:12px;color:var(--text-d)">${txs.length} tx · ${ul>0?`<span style="color:var(--orange)">${ul} sin categoría</span>`:'<span style="color:var(--green)">✓ Listas</span>'}</div>
        <div style="max-height:60vh;overflow-y:auto">
        ${txs.map((tx,i)=>`<div class="fx fac g4" style="padding:6px 0;border-bottom:1px solid rgba(42,46,61,.3)${!tx.category?';background:var(--orange-d);margin:0 -16px;padding:6px 16px':''}">
          <div class="f1" style="min-width:0"><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tx.description}${tx.cuota?' <span style="font-size:10px;color:var(--text-m)">('+tx.cuota+')</span>':''}</div><div style="font-size:10px;color:var(--text-m)">${tx.date} · ${fmt(tx.amount)}</div></div>
          <select style="width:100px;font-size:11px;padding:4px" onchange="window._btx[${i}].category=this.value"><option value="">—</option>${catOpts(tx.category||'')}</select>
        </div>`).join('')}
        </div>
        <button class="btn bp bf mt16" onclick="sBatch()">✓ Importar ${txs.length}</button>`;
    }
    ren2();
  });
}

async function sBatch(){
  const txs=window._btx;let n=0;
  for(const tx of txs){
    await P(S.tx,{id:uid(),amount:tx.amount,description:tx.description,category:tx.category||'otros',date:tx.date,month:tx.month||tx.date.substring(0,7),account:tx.account,projected:false,source:'pdf',cuota:tx.cuota||null});
    if(tx.category&&!['transferencia','comisiones'].includes(tx.category)){
      const mk2=tx.description.toLowerCase().split(' ').slice(0,2).join(' ').replace(/[^a-z0-9 ]/g,'').trim();
      if(mk2.length>2)await P(S.lbl,{id:'l_'+mk2.replace(/\s/g,'_'),merchant:mk2,category:tx.category});
    }
    n++;
  }
  // Actualizar pend de la TC con el total facturado del estado de cuenta
  if(window._ecMeta){
    const {banco,total_cargos,total_pagos}=window._ecMeta;
    const netoPend=Math.max(0,(total_cargos||0)-(total_pagos||0));
    if(['TC Santander','Santander','santander'].includes(banco)){st.accts.tcS.pend=netoPend;st.accts.tcS.used=total_cargos||0;}
    if(['TC BChile','BancoChile','Banco de Chile','bchile'].includes(banco)){st.accts.tcB.pend=netoPend;st.accts.tcB.used=total_cargos||0;}
    await sAccts();
  }
  cMdl();toast(`${n} tx importadas`);rp();
}

// ===== BACKUP & EXPORT =====
async function expBk(){
  const data={v:4,date:new Date().toISOString(),tx:await GA(S.tx),inc:await GA(S.inc),goals:await GA(S.goals),fe:await GA(S.fe),debts:await GA(S.debts),lbl:await GA(S.lbl),stmts:await GA(S.stmts),accts:st.accts};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const fn=`finanzas_backup_${td()}.json`;
  if(navigator.share&&navigator.canShare){
    try{const f=new File([blob],fn,{type:'application/json'});if(navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Backup Finanzas'});st.lastBk=new Date().toISOString();await P(S.cfg,{id:'lastBk',data:st.lastBk});toast('Exportado');return}}
    catch(e){}
  }
  const a2=document.createElement('a');a2.href=URL.createObjectURL(blob);a2.download=fn;a2.click();
  st.lastBk=new Date().toISOString();await P(S.cfg,{id:'lastBk',data:st.lastBk});toast('Exportado');
}

async function impBk(e){
  const f=e.target.files[0];if(!f)return;
  if(!confirm('¿Importar? Reemplaza todos los datos actuales.'))return;
  try{
    const d=JSON.parse(await f.text());
    if(!d.tx&&!d.inc){toast('Archivo inválido');return}
    await CL(S.tx);await CL(S.inc);await CL(S.goals);await CL(S.fe);await CL(S.debts);await CL(S.lbl);await CL(S.stmts);
    for(const t of d.tx||[])await P(S.tx,t);
    for(const i of d.inc||[])await P(S.inc,i);
    for(const g of d.goals||[])await P(S.goals,g);
    for(const fe of d.fe||[])await P(S.fe,fe);
    for(const db of d.debts||[])await P(S.debts,db);
    for(const l of d.lbl||[])await P(S.lbl,l);
    for(const s of d.stmts||[])await P(S.stmts,s);
    if(d.accts)st.accts={...DEF_ACCTS,...d.accts};
    // Recalcular used/pend desde las transacciones del último EC de cada TC
    // Agrupa cargos por cuenta y toma los del período más reciente
    const allImported=d.tx||[];
    for(const [key,nombre] of [['tcS','TC Santander'],['tcB','TC BChile']]){
      const txTC=allImported.filter(t=>t.account===nombre&&t.category!=='transferencia');
      if(txTC.length===0)continue;
      // Período más reciente con transacciones
      const latestMonth=txTC.reduce((mx,t)=>t.month>mx?t.month:mx,'');
      const pagosEC=allImported.filter(t=>t.account===nombre&&t.category==='transferencia'&&t.month===latestMonth);
      const cargos=txTC.filter(t=>t.month===latestMonth).reduce((s,t)=>s+t.amount,0);
      const pagos=pagosEC.reduce((s,t)=>s+t.amount,0);
      st.accts[key].used=cargos;
      st.accts[key].pend=Math.max(0,cargos-pagos);
    }
    await sAccts();
    toast('Importado OK');rp();
  }catch(err){toast('Error: '+err.message)}
}

async function expAI(){
  const txs=await GA(S.tx),incs=await GA(S.inc),goals=await GA(S.goals),debts=await GA(S.debts);
  const ms=avMon();
  let md=`# Estado Financiero — ${new Date().toLocaleDateString('es-CL')}\n\n`;
  md+=`## Resumen Cuentas\n- Disponible: ${fmt(st.accts.avail.bal)}\n- TC Santander utilizado: ${fmt(st.accts.tcS.used)} / ${fmt(st.accts.tcS.tc)}\n- TC BChile utilizado: ${fmt(st.accts.tcB.used)} / ${fmt(st.accts.tcB.tc)}\n\n`;
  md+=`## Deudas\n`;
  debts.forEach(d=>{md+=`- **${d.name}**: Saldo ${fmt(d.balance)}, cuota ${fmt(d.mp)}`+(d.ti>0?` (${d.ci}/${d.ti})`:'')+(d.noMax?' [sin tope]':'')+'\n'});
  md+='\n## Metas\n';
  goals.forEach(g=>{md+=`- **${g.name}**: ${fmt(g.bal)}`+(g.target?` / ${fmt(g.target)}`:'')+(g.targetDate?' — '+g.targetDate:'')+'\n'});
  md+='\n## Movimientos por mes\n';
  for(const m of ms.reverse()){
    const mTx=txs.filter(t=>t.month===m&&!t.projected);
    const mInc=incs.filter(i=>i.month===m&&!i.projected);
    if(!mTx.length&&!mInc.length)continue;
    const ti=mInc.reduce((s,i)=>s+i.amount,0);
    const te=mTx.filter(t=>t.category!=='transferencia').reduce((s,t)=>s+t.amount,0);
    md+=`\n### ${mnm(m)}\nIngresos: ${fmt(ti)} | Gastos: ${fmt(te)} | Balance: ${fmt(ti-te)}\n`;
    const byC={};mTx.filter(t=>t.category!=='transferencia').forEach(t=>{byC[t.category]=(byC[t.category]||0)+t.amount});
    Object.entries(byC).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt])=>{const ct=catById(cat);md+=`- ${ct.i} ${ct.n}: ${fmt(amt)}\n`});
  }
  const blob=new Blob([md],{type:'text/markdown'});
  const fn=`finanzas_ia_${td()}.md`;
  if(navigator.share&&navigator.canShare){try{const f=new File([blob],fn,{type:'text/markdown'});if(navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Finanzas IA'});toast('Exportado');return}}catch(e){}}
  const a2=document.createElement('a');a2.href=URL.createObjectURL(blob);a2.download=fn;a2.click();toast('Exportado');
}

async function resetAll(){
  if(!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.'))return;
  if(!confirm('¿Estás seguro? Se perderán todos tus datos.'))return;
  await CL(S.tx);await CL(S.inc);await CL(S.goals);await CL(S.fe);await CL(S.debts);await CL(S.lbl);await CL(S.stmts);await CL(S.cfg);
  st={accts:{...DEF_ACCTS},lastBk:null};
  toast('Datos eliminados');rp();
}

// ===== INIT DATA (migración y datos por defecto) =====
async function initData(){
  // Gastos fijos
  const fes=await GA(S.fe);
  if(!fes.length){for(const fe of DEF_FE)await P(S.fe,fe)}

  // Deudas — migrar noMax y totalPaid si faltan
  const debts=await GA(S.debts);
  if(!debts.length){
    for(const d of DEF_DEBTS)await P(S.debts,d);
  }else{
    for(const d of debts){
      let changed=false;
      if(d.noMax===undefined){d.noMax=false;changed=true}
      if(d.totalPaid===undefined){d.totalPaid=0;changed=true}
      if(changed)await P(S.debts,d);
    }
  }

  // Cuentas
  const acctsCfg=await G(S.cfg,'accounts');
  if(acctsCfg?.data){
    st.accts={...DEF_ACCTS,...acctsCfg.data};
    if(!st.accts.avail)st.accts.avail={bal:0};
  }
  // Recalcular used/pend desde transacciones (período más reciente de cada TC)
  const allTxInit=await GA(S.tx);
  for(const [key,nombre] of [['tcS','TC Santander'],['tcB','TC BChile']]){
    const txTC=allTxInit.filter(t=>t.account===nombre&&t.category!=='transferencia');
    if(!txTC.length)continue;
    const latestMonth=txTC.reduce((mx,t)=>t.month>mx?t.month:mx,'');
    const cargos=txTC.filter(t=>t.month===latestMonth).reduce((s,t)=>s+t.amount,0);
    const pagosEC=allTxInit.filter(t=>t.account===nombre&&t.category==='transferencia'&&t.month===latestMonth).reduce((s,t)=>s+t.amount,0);
    st.accts[key].used=cargos;
    st.accts[key].pend=Math.max(0,cargos-pagosEC);
  }
  await sAccts();

  // Último backup
  const lbk=await G(S.cfg,'lastBk');
  if(lbk?.data)st.lastBk=lbk.data;
}

// ===== BOOT =====
async function init(){
  try{
    await oDB();
    await initData();
    document.querySelectorAll('.ni').forEach(el=>{
      el.addEventListener('click',()=>nav(el.dataset.p));
    });
    $('mo').addEventListener('click',e=>{if(e.target===$('mo'))cMdl()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')cMdl()});
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }
    nav('resumen');
  }catch(err){
    console.error('Init error:',err);
    document.body.innerHTML=`<div style="padding:32px;text-align:center;color:#f87171"><h2>Error al iniciar</h2><p>${err.message}</p><button onclick="location.reload()" style="margin-top:16px;padding:12px 24px;background:#4a7cff;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Reintentar</button></div>`;
  }
}

// ===== PWA INSTALL =====
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredPrompt=e;
  const banner=document.getElementById('installBanner');
  const btn=document.getElementById('installBtn');
  if(banner)banner.classList.remove('hidden');
  if(btn)btn.onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();const r=await deferredPrompt.userChoice;if(r.outcome==='accepted')banner.classList.add('hidden');deferredPrompt=null}};
});
window.addEventListener('appinstalled',()=>{document.getElementById('installBanner')?.classList.add('hidden');deferredPrompt=null});

document.addEventListener('DOMContentLoaded',init);
