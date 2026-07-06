// ============================================================
// FinTrack — Estadísticas: Activos
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { chart, textColor, kpiHTML } from './stats_common.js';
import { fmtMoney, fmtPct, fmtNum, escapeHTML, countsInBalance, cardPeriodBalance, cardStatus } from '../utils.js';

export function renderStatsAssets(root) {
  const accounts = db.getTable('accounts').filter(a => !a.archived);
  const balanceAccts = accounts.filter(countsInBalance);
  const savingsAccts = accounts.filter(a => !countsInBalance(a));
  const investments = db.getTable('investments');
  const goals = db.getTable('goals');
  const giftcards = db.getTable('giftcards');
  const records = db.getTable('records');

  const liquid = balanceAccts.filter(a => a.type !== 'card').reduce((s,a) => s + Number(a.balance||0), 0);
  const cardDebt = balanceAccts.filter(a => a.type === 'card').reduce((s,c) => s + cardPeriodBalance(c, records).due, 0);
  const savings = savingsAccts.reduce((s,a) => s + Number(a.balance||0), 0);
  const giftTotal = giftcards.reduce((s,g) => s + Number(g.balance||0), 0);
  let invValue = 0, invCost = 0;
  for (const inv of investments) {
    const cur = Number(inv.currentPrice) || Number(inv.buyPrice) || 0;
    invValue += Number(inv.qty||0) * cur;
    invCost += Number(inv.qty||0) * Number(inv.buyPrice||0);
  }
  const goalsCurrent = goals.reduce((s,g) => s + Number(g.current||0), 0);
  const goalsTarget = goals.reduce((s,g) => s + Number(g.target||0), 0);
  const totalAssets = liquid + savings + invValue + giftTotal + goalsCurrent;

  root.innerHTML = `
    <div class="text-xs text-dim mb-4">Distribución de activos</div>
    <div class="kpi-grid mb-4">
      ${kpiHTML('Activos totales', fmtMoney(totalAssets), { icon:'coins', iconColor:'#10b981' })}
      ${kpiHTML('Líquidos', fmtMoney(liquid), { icon:'wallet', cls:'amt-pos', iconColor:'#06b6d4' })}
      ${kpiHTML('Ahorros apartados', fmtMoney(savings), { icon:'savings', iconColor:'#14b8a6' })}
      ${kpiHTML('Inversiones', fmtMoney(invValue), { icon:'trending-up', cls: invValue-invCost>=0?'amt-pos':'amt-neg', iconColor:'#8b5cf6' })}
      ${kpiHTML('Tarjetas regalo', fmtMoney(giftTotal), { icon:'gift', iconColor:'#f97316' })}
      ${kpiHTML('Metas (ahorrado)', fmtMoney(goalsCurrent), { icon:'target', iconColor:'#ec4899' })}
    </div>

    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Distribución de activos</div></div>
        <div style="height:280px"><canvas id="assetsChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Resumen por tipo</div></div>
        <div id="byType"></div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-header"><div class="card-title">Cuentas</div></div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Cuenta</th><th>Tipo</th><th class="text-right">Saldo</th><th>Estado</th></tr></thead>
          <tbody id="acctsTable"></tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Inversiones</div><span class="badge">${investments.length}</span></div>
        <div id="invList" class="flex flex-col gap-2 scroll-list" style="max-height:300px"></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Metas</div><span class="badge">${goals.length}</span></div>
        <div id="goalsList" class="flex flex-col gap-3 scroll-list" style="max-height:300px"></div>
      </div>
    </div>
  `;

  // Chart distribución
  const chartData = [
    { label: 'Líquidos', value: liquid, color: '#06b6d4' },
    { label: 'Ahorros apartados', value: savings, color: '#14b8a6' },
    { label: 'Inversiones', value: invValue, color: '#8b5cf6' },
    { label: 'Tarjetas regalo', value: giftTotal, color: '#f97316' },
    { label: 'Metas', value: goalsCurrent, color: '#ec4899' },
  ].filter(x => x.value > 0);

  chart('assetsChart', {
    type: 'doughnut',
    data: { labels: chartData.map(x=>x.label), datasets: [{ data: chartData.map(x=>x.value), backgroundColor: chartData.map(x=>x.color), borderWidth:2, borderColor:'transparent' }] },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins: { legend:{ position:'right', labels:{ color:textColor(), font:{size:11}, boxWidth:12, padding:8 } }, tooltip:{ callbacks:{ label: c => `${c.label}: ${fmtMoney(c.parsed)}` } } },
    },
  });

  // Resumen por tipo
  const byType = root.querySelector('#byType');
  byType.innerHTML = chartData.map(x => {
    const pct = totalAssets > 0 ? (x.value/totalAssets)*100 : 0;
    return `
      <div class="stat-row">
        <span class="stat-row-label"><span class="tag-dot" style="background:${x.color}"></span> ${escapeHTML(x.label)}</span>
        <span class="stat-row-value">${fmtMoney(x.value)} <span class="text-dim text-xs">(${fmtPct(pct)})</span></span>
      </div>
    `;
  }).join('') || `<div class="text-sm text-muted text-center" style="padding:24px">Sin activos.</div>`;

  // Tabla cuentas
  const cats = db.getTable('categories');
  root.querySelector('#acctsTable').innerHTML = accounts.map(a => {
    const isSavings = !countsInBalance(a);
    const isCard = a.type === 'card';
    const bal = isCard ? cardPeriodBalance(a, records).due : Number(a.balance||0);
    const status = isCard ? cardStatus(a, records).label : (isSavings ? 'Apartada' : 'Activa');
    const cls = isCard ? 'badge-warning' : isSavings ? 'badge-info' : Number(a.balance)>=0 ? 'badge-success' : 'badge-danger';
    return `<tr>
      <td>${a.emoji} ${escapeHTML(a.name)}</td>
      <td class="text-muted">${a.type}</td>
      <td class="num ${isCard||bal<0?'amt-neg':''}">${fmtMoney(bal, a.currency)}</td>
      <td><span class="badge ${cls}">${status}</span></td>
    </tr>`;
  }).join('') || `<tr><td colspan="4" class="text-center text-muted" style="padding:24px">Sin cuentas</td></tr>`;

  // Inversiones
  const invList = root.querySelector('#invList');
  if (investments.length === 0) {
    invList.innerHTML = `<div class="empty-state" style="padding:20px"><p class="text-sm text-muted">Sin inversiones.</p></div>`;
  } else {
    invList.innerHTML = investments.map(inv => {
      const cur = Number(inv.currentPrice) || Number(inv.buyPrice) || 0;
      const value = Number(inv.qty||0) * cur;
      const cost = Number(inv.qty||0) * Number(inv.buyPrice||0);
      const ret = value - cost;
      const retPct = cost > 0 ? (ret/cost)*100 : 0;
      return `<div class="list-item" style="padding:8px 10px">
        <div class="list-item-icon" style="background:var(--primary-soft);color:var(--primary);width:32px;height:32px;font-size:11px;font-weight:800">${escapeHTML(inv.symbol?.slice(0,3)||'INV')}</div>
        <div class="list-item-body">
          <div class="list-item-title" style="font-size:13px">${escapeHTML(inv.name)}</div>
          <div class="list-item-sub">${fmtNum(inv.qty,6)} × ${fmtMoney(cur)}</div>
        </div>
        <div class="text-right">
          <div class="font-mono font-bold" style="font-size:13px">${fmtMoney(value)}</div>
          <div class="text-xs ${ret>=0?'amt-pos':'amt-neg'}">${fmtPct(retPct)}</div>
        </div>
      </div>`;
    }).join('');
  }

  // Metas
  const goalsList = root.querySelector('#goalsList');
  if (goals.length === 0) {
    goalsList.innerHTML = `<div class="empty-state" style="padding:20px"><p class="text-sm text-muted">Sin metas.</p></div>`;
  } else {
    goalsList.innerHTML = goals.map(g => {
      const pct = g.target > 0 ? Math.min(100, (g.current/g.target)*100) : 0;
      const done = g.current >= g.target;
      return `<div>
        <div class="flex justify-between text-xs mb-1">
          <span>${g.emoji||'🎯'} ${escapeHTML(g.name)}</span>
          <span class="font-mono">${fmtMoney(g.current)} / ${fmtMoney(g.target)}</span>
        </div>
        <div class="progress"><div class="progress-bar ${done?'':pct>80?'warning':''}" style="width:${pct}%;background:${g.color||'#10b981'}"></div></div>
        <div class="text-xs text-dim mt-1">${fmtPct(pct)}${done?' · Completada':''}</div>
      </div>`;
    }).join('');
  }
}
