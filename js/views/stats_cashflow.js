// ============================================================
// FinTrack — Estadísticas: Flujo de caja
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { segmented } from '../ui.js';
import { chart, standardOpts, textColor, gridColor, kpiHTML } from './stats_common.js';
import { fmtMoney, fmtPct, escapeHTML, countsInBalance } from '../utils.js';

export function renderStatsCashflow(root) {
  let range = 6;
  root.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div id="rangeSeg"></div>
      <div class="text-xs text-dim">Ingresos vs egresos mensuales</div>
    </div>
    <div class="kpi-grid mb-4" id="kpis"></div>
    <div class="card mb-4">
      <div class="card-header"><div class="card-title">Flujo de caja mensual</div><span class="text-xs text-dim">Ingresos vs egresos</span></div>
      <div style="height:320px"><canvas id="flowChart"></canvas></div>
    </div>
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Balance neto por mes</div></div>
        <div style="height:240px"><canvas id="netChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Detalle por mes</div></div>
        <div class="table-wrap" style="max-height:280px;overflow-y:auto">
          <table class="data">
            <thead><tr><th>Mes</th><th class="text-right">Ingresos</th><th class="text-right">Egresos</th><th class="text-right">Neto</th></tr></thead>
            <tbody id="monthTable"></tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Tasa de ahorro por mes</div><span class="text-xs text-dim">% del ingreso que quedó como saldo</span></div>
      <div style="height:240px"><canvas id="savingsRateChart"></canvas></div>
    </div>
  `;

  const seg = segmented([{value:3,label:'3M'},{value:6,label:'6M'},{value:12,label:'12M'}], range, v => { range = Number(v); redraw(); });
  root.querySelector('#rangeSeg').appendChild(seg);

  function redraw() {
    const months = lastNMonthsArr(range);
    const records = db.getTable('records');
    const inc = months.map(mo => records.filter(r => r.type==='income' && r.date && r.date.slice(0,7)===mo.key).reduce((s,r)=>s+Number(r.amount||0),0));
    const exp = months.map(mo => records.filter(r => r.type==='expense' && r.date && r.date.slice(0,7)===mo.key).reduce((s,r)=>s+Number(r.amount||0),0));
    const net = inc.map((v,i) => v - exp[i]);
    const totalInc = inc.reduce((s,v)=>s+v,0);
    const totalExp = exp.reduce((s,v)=>s+v,0);
    const totalNet = totalInc - totalExp;
    const savingsRate = totalInc > 0 ? (totalNet/totalInc)*100 : 0;
    const avgInc = totalInc / range;
    const avgExp = totalExp / range;

    // KPIs
    root.querySelector('#kpis').innerHTML =
      kpiHTML('Ingresos totales', fmtMoney(totalInc), { icon:'arrow-down-left', cls:'amt-pos', iconColor:'#10b981' }) +
      kpiHTML('Egresos totales', fmtMoney(totalExp), { icon:'arrow-up-right', cls:'amt-neg', iconColor:'#ef4444' }) +
      kpiHTML('Balance neto', fmtMoney(totalNet, undefined, {sign:true}), { icon:'scale', cls: totalNet>=0?'amt-pos':'amt-neg' }) +
      kpiHTML('Tasa de ahorro', fmtPct(savingsRate), { icon:'savings', cls: savingsRate>=0?'amt-pos':'amt-neg', iconColor:'#14b8a6' }) +
      kpiHTML('Ingreso promedio/mes', fmtMoney(avgInc), { icon:'trending-up', iconColor:'#06b6d4' }) +
      kpiHTML('Egreso promedio/mes', fmtMoney(avgExp), { icon:'trending-down', iconColor:'#f59e0b' });

    // Flow chart
    chart('flowChart', {
      type: 'bar',
      data: { labels: months.map(m=>m.label), datasets: [
        { label:'Ingresos', data:inc, backgroundColor:'rgba(16,185,129,.7)', borderRadius:6, maxBarThickness:32 },
        { label:'Egresos', data:exp, backgroundColor:'rgba(239,68,68,.7)', borderRadius:6, maxBarThickness:32 },
      ] },
      options: standardOpts(),
    });

    // Net chart
    chart('netChart', {
      type: 'bar',
      data: { labels: months.map(m=>m.label), datasets: [
        { label:'Balance neto', data:net, backgroundColor: net.map(v => v>=0 ? 'rgba(16,185,129,.7)' : 'rgba(239,68,68,.7)'), borderRadius:6, maxBarThickness:32 },
      ] },
      options: standardOpts(),
    });

    // Savings rate chart
    const rates = inc.map((v,i) => v>0 ? ((inc[i]-exp[i])/v)*100 : 0);
    chart('savingsRateChart', {
      type: 'line',
      data: { labels: months.map(m=>m.label), datasets: [
        { label:'Tasa de ahorro (%)', data:rates, borderColor:'#14b8a6', backgroundColor:'rgba(20,184,166,.15)', fill:true, tension:0.35, pointRadius:4, pointBackgroundColor:'#14b8a6' },
      ] },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: { legend: { labels: { color: textColor(), font:{size:11} } }, tooltip: { callbacks: { label: c => `${fmtPct(c.parsed.y)}` } } },
        scales: {
          x: { grid:{display:false}, ticks:{color:textColor(), font:{size:11}} },
          y: { grid:{color:gridColor()}, ticks:{color:textColor(), font:{size:11}, callback: v => fmtPct(v)} },
        },
      },
    });

    // Tabla
    const tb = root.querySelector('#monthTable');
    tb.innerHTML = months.map((mo,i) => `
      <tr>
        <td>${mo.label}</td>
        <td class="num amt-pos">${fmtMoney(inc[i])}</td>
        <td class="num amt-neg">${fmtMoney(exp[i])}</td>
        <td class="num ${net[i]>=0?'amt-pos':'amt-neg'}">${fmtMoney(net[i], undefined, {sign:true})}</td>
      </tr>
    `).join('');
  }
  redraw();
}

function lastNMonthsArr(n) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ y:d.getFullYear(), m:d.getMonth(), key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label:d.toLocaleDateString('es-SV',{month:'short',year:'2-digit'}) });
  }
  return arr;
}
