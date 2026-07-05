// ============================================================
// FinTrack — Estadísticas: Balance general
// ============================================================
import * as db from '../db.js';
import { ACCOUNT_TYPES } from '../config.js';
import { icon } from '../icons.js';
import { segmented } from '../ui.js';
import { chart, standardOpts, textColor, kpiHTML } from './stats_common.js';
import { fmtMoney, fmtPct, escapeHTML, countsInBalance, cardPeriodBalance } from '../utils.js';

export function renderStatsBalance(root) {
  let range = 6;
  root.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div id="rangeSeg"></div>
      <div class="text-xs text-dim">Balance general y patrimonio</div>
    </div>
    <div class="kpi-grid mb-4" id="kpis"></div>
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Balance acumulado</div><span class="text-xs text-dim">Patrimonio neto mensual</span></div>
        <div style="height:280px"><canvas id="balanceChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Activos vs pasivos</div><span class="text-xs text-dim">Distribución actual</span></div>
        <div style="height:280px"><canvas id="assetsLiabChart"></canvas></div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Detalle del patrimonio</div></div>
        <div id="patrimonyDetail"></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Ahorros apartados</div><span class="text-xs text-dim">No incluidos en balance</span></div>
        <div id="savingsDetail"></div>
      </div>
    </div>
  `;

  const seg = segmented([{value:3,label:'3M'},{value:6,label:'6M'},{value:12,label:'12M'}], range, v => { range = Number(v); redraw(); });
  root.querySelector('#rangeSeg').appendChild(seg);

  function redraw() {
    drawKpis();
    drawBalanceChart();
    drawAssetsLiab();
    drawDetails();
  }

  function drawKpis() {
    const accounts = db.getTable('accounts').filter(a => !a.archived);
    const balanceAccts = accounts.filter(countsInBalance);
    const liquidAssets = balanceAccts.filter(a => a.type !== 'card').reduce((s,a) => s + Number(a.balance||0), 0);
    const cards = accounts.filter(a => a.type === 'card');
    const cardDebt = cards.reduce((s,c) => s + cardPeriodBalance(c, db.getTable('records')).due, 0);
    const debts = db.getTable('debts').filter(d => !d.settled);
    const owe = debts.filter(d => d.type === 'owe').reduce((s,d) => s + Number(d.amount||0), 0);
    const owed = debts.filter(d => d.type === 'owed').reduce((s,d) => s + Number(d.amount||0), 0);
    const totalLiabilities = cardDebt + owe;
    const netWorth = liquidAssets - totalLiabilities + owed;
    const savings = accounts.filter(a => !countsInBalance(a)).reduce((s,a) => s + Number(a.balance||0), 0);

    root.querySelector('#kpis').innerHTML =
      kpiHTML('Activos líquidos', fmtMoney(liquidAssets), { icon:'wallet', cls:'amt-pos', iconColor:'#10b981' }) +
      kpiHTML('Pasivos totales', fmtMoney(totalLiabilities), { icon:'credit-card', cls:'amt-neg', iconColor:'#8b5cf6' }) +
      kpiHTML('Patrimonio neto', fmtMoney(netWorth), { icon:'trending-up', cls: netWorth>=0?'amt-pos':'amt-neg', iconColor:'#06b6d4' }) +
      kpiHTML('Por cobrar', fmtMoney(owed), { icon:'arrow-down-left', cls:'amt-pos', iconColor:'#14b8a6' }) +
      kpiHTML('Ahorros apartados', fmtMoney(savings), { icon:'savings', iconColor:'#f59e0b' });
  }

  function drawBalanceChart() {
    const records = db.getTable('records');
    // Generar meses
    const months = lastNMonthsArr(range);
    let acc = 0;
    const data = months.map(mo => {
      const inc = records.filter(r => r.type==='income' && r.date && r.date.slice(0,7)===mo.key).reduce((s,r)=>s+Number(r.amount||0),0);
      const exp = records.filter(r => r.type==='expense' && r.date && r.date.slice(0,7)===mo.key).reduce((s,r)=>s+Number(r.amount||0),0);
      acc += (inc - exp);
      return acc;
    });
    chart('balanceChart', {
      type: 'line',
      data: { labels: months.map(m=>m.label), datasets: [{
        label: 'Balance acumulado', data,
        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.15)',
        fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#10b981',
      }] },
      options: standardOpts(),
    });
  }

  function drawAssetsLiab() {
    const accounts = db.getTable('accounts').filter(a => !a.archived && countsInBalance(a));
    const liquid = accounts.filter(a => a.type !== 'card').reduce((s,a) => s + Number(a.balance||0), 0);
    const cards = accounts.filter(a => a.type === 'card');
    const cardDebt = cards.reduce((s,c) => s + cardPeriodBalance(c, db.getTable('records')).due, 0);
    const debts = db.getTable('debts').filter(d => !d.settled && d.type === 'owe').reduce((s,d) => s + Number(d.amount||0), 0);
    chart('assetsLiabChart', {
      type: 'doughnut',
      data: { labels: ['Activos líquidos', 'Deuda tarjetas', 'Deudas propias'], datasets: [{
        data: [liquid, cardDebt, debts],
        backgroundColor: ['#10b981', '#8b5cf6', '#ef4444'], borderWidth: 2, borderColor: 'transparent',
      }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position:'right', labels: { color: textColor(), font:{size:11}, boxWidth:12, padding:8 } }, tooltip: { callbacks: { label: c => `${c.label}: ${fmtMoney(c.parsed)}` } } },
      },
    });
  }

  function drawDetails() {
    const accounts = db.getTable('accounts').filter(a => !a.archived);
    const balanceAccts = accounts.filter(countsInBalance);
    const savingsAccts = accounts.filter(a => !countsInBalance(a));
    const cards = balanceAccts.filter(a => a.type === 'card');
    const debts = db.getTable('debts').filter(d => !d.settled);
    const owe = debts.filter(d => d.type === 'owe').reduce((s,d) => s + Number(d.amount||0), 0);
    const owed = debts.filter(d => d.type === 'owed').reduce((s,d) => s + Number(d.amount||0), 0);

    const liquid = balanceAccts.filter(a => a.type !== 'card').reduce((s,a) => s + Number(a.balance||0), 0);
    const cardDebt = cards.reduce((s,c) => s + cardPeriodBalance(c, db.getTable('records')).due, 0);

    const det = root.querySelector('#patrimonyDetail');
    det.innerHTML = `
      <div class="stat-row"><span class="stat-row-label">+ Efectivo y bancos</span><span class="stat-row-value amt-pos">${fmtMoney(liquid)}</span></div>
      <div class="stat-row"><span class="stat-row-label">+ Me deben</span><span class="stat-row-value amt-pos">${fmtMoney(owed)}</span></div>
      <div class="stat-row"><span class="stat-row-label">− Deuda en tarjetas</span><span class="stat-row-value amt-neg">${fmtMoney(cardDebt)}</span></div>
      <div class="stat-row"><span class="stat-row-label">− Deudas propias</span><span class="stat-row-value amt-neg">${fmtMoney(owe)}</span></div>
      <div class="divider"></div>
      <div class="stat-row"><span class="stat-row-label font-bold">Patrimonio neto</span><span class="stat-row-value font-bold ${liquid+owed-cardDebt-owe>=0?'amt-pos':'amt-neg'}">${fmtMoney(liquid+owed-cardDebt-owe)}</span></div>
    `;

    const sav = root.querySelector('#savingsDetail');
    if (savingsAccts.length === 0) {
      sav.innerHTML = `<div class="empty-state" style="padding:24px"><p class="text-sm text-muted">No tienes cuentas de ahorro apartadas.</p></div>`;
    } else {
      let html = '';
      for (const a of savingsAccts) {
        html += `<div class="stat-row"><span class="stat-row-label">${escapeHTML(a.emoji+' '+a.name)}</span><span class="stat-row-value">${fmtMoney(a.balance, a.currency)}</span></div>`;
      }
      html += `<div class="divider"></div><div class="stat-row"><span class="stat-row-label font-bold">Total ahorrado</span><span class="stat-row-value font-bold">${fmtMoney(savingsAccts.reduce((s,a)=>s+Number(a.balance||0),0))}</span></div>`;
      sav.innerHTML = html;
    }
  }
}

function lastNMonthsArr(n) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({
      y: d.getFullYear(),
      m: d.getMonth(),
      key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleDateString('es-SV', { month: 'short', year: '2-digit' }),
    });
  }
  return arr;
}
