// ============================================================
// FinTrack — Estadísticas: Perspectiva
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { segmented } from '../ui.js';
import { chart, standardOpts, textColor, gridColor, kpiHTML } from './stats_common.js';
import { fmtMoney, fmtPct, escapeHTML, countsInBalance } from '../utils.js';

export function renderStatsPerspective(root) {
  let range = 12;
  root.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div id="rangeSeg"></div>
      <div class="text-xs text-dim">Proyecciones y tendencias</div>
    </div>
    <div class="kpi-grid mb-4" id="kpis"></div>
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Proyección 12 meses</div><span class="text-xs text-dim">Basada en promedio actual</span></div>
        <div style="height:280px"><canvas id="projectionChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Ingresos vs Egresos (mensual)</div></div>
        <div style="height:280px"><canvas id="cmpChart"></canvas></div>
      </div>
    </div>
    <div class="card mb-4">
      <div class="card-header"><div class="card-title">Tendencia de ahorro</div><span class="text-xs text-dim">Tasa de ahorro mensual</span></div>
      <div style="height:220px"><canvas id="savTrendChart"></canvas></div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Comparativo mensual</div></div>
        <div class="table-wrap" style="max-height:300px;overflow-y:auto">
          <table class="data">
            <thead><tr><th>Mes</th><th class="text-right">Ingresos</th><th class="text-right">Egresos</th><th class="text-right">Neto</th><th class="text-right">Ahorro %</th></tr></thead>
            <tbody id="cmpTable"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Pronóstico próximo mes</div></div>
        <div id="forecast"></div>
      </div>
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
    const avgInc = totalInc/range;
    const avgExp = totalExp/range;
    const avgNet = avgInc - avgExp;
    const savRate = avgInc > 0 ? (avgNet/avgInc)*100 : 0;
    // Proyección 12 meses
    const projLabels = [];
    const projData = [];
    let acc = 0;
    // Histórico acumulado
    for (let i = 0; i < range; i++) { acc += net[i]; projLabels.push(months[i].label); projData.push(acc); }
    // Proyección futura
    const now = new Date();
    for (let i = 1; i <= 12 - range; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      projLabels.push(d.toLocaleDateString('es-SV',{month:'short',year:'2-digit'}) + ' (proy.)');
      acc += avgNet;
      projData.push(acc);
    }

    root.querySelector('#kpis').innerHTML =
      kpiHTML('Promedio ingreso/mes', fmtMoney(avgInc), { icon:'trending-up', cls:'amt-pos', iconColor:'#10b981' }) +
      kpiHTML('Promedio egreso/mes', fmtMoney(avgExp), { icon:'trending-down', cls:'amt-neg', iconColor:'#ef4444' }) +
      kpiHTML('Promedio neto/mes', fmtMoney(avgNet, undefined, {sign:true}), { icon:'scale', cls: avgNet>=0?'amt-pos':'amt-neg' }) +
      kpiHTML('Tasa de ahorro', fmtPct(savRate), { icon:'savings', cls: savRate>=0?'amt-pos':'amt-neg', iconColor:'#14b8a6' }) +
      kpiHTML('Proyección 12m', fmtMoney(net.reduce((s,v)=>s+v,0) + avgNet*(12-range), undefined, {sign:true}), { icon:'target', iconColor:'#8b5cf6' });

    chart('projectionChart', {
      type: 'line',
      data: { labels: projLabels, datasets: [
        { label:'Patrimonio', data: projData.slice(0, range), borderColor:'#10b981', backgroundColor:'rgba(16,185,129,.15)', fill:true, tension:0.35, pointRadius:3 },
        { label:'Proyección', data: Array(range-1).fill(null).concat([projData[range-1]], projData.slice(range)), borderColor:'#8b5cf6', borderDash:[6,4], backgroundColor:'rgba(139,92,246,.1)', fill:true, tension:0.35, pointRadius:3 },
      ] },
      options: standardOpts(),
    });

    chart('cmpChart', {
      type: 'bar',
      data: { labels: months.map(m=>m.label), datasets: [
        { label:'Ingresos', data: inc, backgroundColor:'rgba(16,185,129,.7)', borderRadius:6, maxBarThickness:24 },
        { label:'Egresos', data: exp, backgroundColor:'rgba(239,68,68,.7)', borderRadius:6, maxBarThickness:24 },
      ] },
      options: standardOpts(),
    });

    const savRates = inc.map((v,i) => v > 0 ? ((inc[i]-exp[i])/v)*100 : 0);
    chart('savTrendChart', {
      type: 'line',
      data: { labels: months.map(m=>m.label), datasets: [
        { label:'Tasa de ahorro %', data: savRates, borderColor:'#14b8a6', backgroundColor:'rgba(20,184,166,.15)', fill:true, tension:0.35, pointRadius:4, pointBackgroundColor:'#14b8a6' },
      ] },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: { legend:{ labels:{color:textColor(), font:{size:11}} }, tooltip:{ callbacks:{ label: c => fmtPct(c.parsed.y) } } },
        scales: { x:{ grid:{display:false}, ticks:{color:textColor(), font:{size:11}} }, y:{ grid:{color:gridColor()}, ticks:{color:textColor(), font:{size:11}, callback:v=>fmtPct(v)} } },
      },
    });

    // Tabla comparativa
    root.querySelector('#cmpTable').innerHTML = months.map((mo,i) => {
      const r = inc[i] > 0 ? ((inc[i]-exp[i])/inc[i])*100 : 0;
      return `<tr>
        <td>${mo.label}</td>
        <td class="num amt-pos">${fmtMoney(inc[i])}</td>
        <td class="num amt-neg">${fmtMoney(exp[i])}</td>
        <td class="num ${net[i]>=0?'amt-pos':'amt-neg'}">${fmtMoney(net[i], undefined, {sign:true})}</td>
        <td class="num ${r>=0?'amt-pos':'amt-neg'}">${fmtPct(r)}</td>
      </tr>`;
    }).join('');

    // Pronóstico
    const fcst = root.querySelector('#forecast');
    const next = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const projInc = avgInc;
    const projExp = avgExp;
    const projNet = avgNet;
    const yearsToFI = avgNet > 0 ? (totalInc > 0 ? Math.log(25) / Math.log(1 + (avgNet/ (totalInc>0?avgInc:1))) : 0) : null;
    fcst.innerHTML = `
      <div class="stat-row"><span class="stat-row-label">Mes proyectado</span><span class="stat-row-value">${next.toLocaleDateString('es-SV',{month:'long',year:'numeric'})}</span></div>
      <div class="divider"></div>
      <div class="stat-row"><span class="stat-row-label">Ingreso esperado</span><span class="stat-row-value amt-pos">${fmtMoney(projInc)}</span></div>
      <div class="stat-row"><span class="stat-row-label">Egreso esperado</span><span class="stat-row-value amt-neg">${fmtMoney(projExp)}</span></div>
      <div class="stat-row"><span class="stat-row-label">Balance esperado</span><span class="stat-row-value ${projNet>=0?'amt-pos':'amt-neg'}">${fmtMoney(projNet, undefined, {sign:true})}</span></div>
      <div class="divider"></div>
      <div class="stat-row"><span class="stat-row-label">En 12 meses (proy.)</span><span class="stat-row-value">${fmtMoney(avgNet*12, undefined, {sign:true})}</span></div>
      <div class="stat-row"><span class="stat-row-label">En 5 años (proy.)</span><span class="stat-row-value">${fmtMoney(avgNet*60, undefined, {sign:true})}</span></div>
      ${avgNet > 0 ? `<div class="stat-row"><span class="stat-row-label">Patrimonio en 10 años</span><span class="stat-row-value amt-pos">${fmtMoney(avgNet*120)}</span></div>` : `<div class="stat-row"><span class="stat-row-label">Sin margen de ahorro</span><span class="stat-row-value text-dim">—</span></div>`}
    `;
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
