// ============================================================
// FinTrack — Estadísticas: Gastos
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { segmented } from '../ui.js';
import { chart, standardOpts, textColor, kpiHTML } from './stats_common.js';
import { fmtMoney, fmtPct, escapeHTML } from '../utils.js';

export function renderStatsExpenses(root) {
  let range = 6;
  root.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div id="rangeSeg"></div>
      <div class="text-xs text-dim">Análisis de gastos</div>
    </div>
    <div class="kpi-grid mb-4" id="kpis"></div>
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Gastos por categoría</div></div>
        <div style="height:280px"><canvas id="catChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Tendencia de gastos</div><span class="text-xs text-dim">Últimos ${range} meses</span></div>
        <div style="height:280px"><canvas id="trendChart"></canvas></div>
      </div>
    </div>
    <div class="card mb-4">
      <div class="card-header"><div class="card-title">Top categorías de gasto</div></div>
      <div id="topCats"></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Detalle por categoría</div></div>
      <div class="table-wrap" style="max-height:400px;overflow-y:auto">
        <table class="data">
          <thead><tr><th>Categoría</th><th class="text-right">Total</th><th class="text-right">% del gasto</th><th class="text-right">Registros</th></tr></thead>
          <tbody id="catTable"></tbody>
        </table>
      </div>
    </div>
  `;

  const seg = segmented([{value:3,label:'3M'},{value:6,label:'6M'},{value:12,label:'12M'}], range, v => { range = Number(v); redraw(); });
  root.querySelector('#rangeSeg').appendChild(seg);

  function redraw() {
    const months = lastNMonthsArr(range);
    const records = db.getTable('records').filter(r => r.type === 'expense' && r.date && r.date >= months[0].key + '-01');
    const cats = db.getTable('categories');
    const total = records.reduce((s,r) => s + Number(r.amount||0), 0);
    const count = records.length;
    const avg = total / range;

    root.querySelector('#kpis').innerHTML =
      kpiHTML('Gasto total', fmtMoney(total), { icon:'arrow-up-right', cls:'amt-neg', iconColor:'#ef4444' }) +
      kpiHTML('Promedio mensual', fmtMoney(avg), { icon:'bar-chart', iconColor:'#f59e0b' }) +
      kpiHTML('Registros', String(count), { icon:'receipt', iconColor:'#06b6d4' }) +
      kpiHTML('Categorías usadas', String(new Set(records.map(r=>r.categoryId)).size), { icon:'tag', iconColor:'#8b5cf6' });

    // Por categoría
    const byCat = {};
    for (const r of records) {
      const c = cats.find(x => x.id === r.categoryId);
      const name = c ? c.name : 'Sin categoría';
      if (!byCat[name]) byCat[name] = { total: 0, color: c?.color || '#10b981', count: 0, emoji: c?.emoji || '🏷️' };
      byCat[name].total += Number(r.amount||0);
      byCat[name].count++;
    }
    const sorted = Object.entries(byCat).sort((a,b) => b[1].total - a[1].total);

    chart('catChart', {
      type: 'doughnut',
      data: {
        labels: sorted.map(([n]) => n),
        datasets: [{ data: sorted.map(([,v]) => v.total), backgroundColor: sorted.map(([,v]) => v.color), borderWidth:2, borderColor:'transparent' }],
      },
      options: {
        responsive:true, maintainAspectRatio:false, cutout:'62%',
        plugins: { legend:{ position:'right', labels:{ color:textColor(), font:{size:11}, boxWidth:12, padding:8 } }, tooltip:{ callbacks:{ label: c => `${c.label}: ${fmtMoney(c.parsed)}` } } },
      },
    });

    // Tendencia
    const trendData = months.map(mo => records.filter(r => r.date.slice(0,7) === mo.key).reduce((s,r) => s + Number(r.amount||0), 0));
    chart('trendChart', {
      type: 'line',
      data: { labels: months.map(m=>m.label), datasets: [
        { label:'Gasto mensual', data:trendData, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,.15)', fill:true, tension:0.35, pointRadius:4, pointBackgroundColor:'#ef4444' },
      ] },
      options: standardOpts(),
    });

    // Top categorías (barras de progreso)
    const top = root.querySelector('#topCats');
    if (sorted.length === 0) {
      top.innerHTML = `<div class="empty-state" style="padding:24px"><p class="text-sm text-muted">Sin gastos en el periodo.</p></div>`;
    } else {
      const max = sorted[0][1].total;
      top.innerHTML = sorted.slice(0,6).map(([name, v]) => {
        const pct = total > 0 ? (v.total/total)*100 : 0;
        const width = (v.total/max)*100;
        return `
          <div style="margin-bottom:12px">
            <div class="flex justify-between text-sm mb-1">
              <span>${v.emoji} ${escapeHTML(name)}</span>
              <span class="font-mono font-bold">${fmtMoney(v.total)} · ${fmtPct(pct)}</span>
            </div>
            <div class="progress"><div class="progress-bar" style="width:${width}%;background:${v.color}"></div></div>
          </div>
        `;
      }).join('');
    }

    // Tabla detalle
    const tb = root.querySelector('#catTable');
    tb.innerHTML = sorted.map(([name, v]) => {
      const pct = total > 0 ? (v.total/total)*100 : 0;
      return `<tr><td>${v.emoji} ${escapeHTML(name)}</td><td class="num amt-neg">${fmtMoney(v.total)}</td><td class="num">${fmtPct(pct)}</td><td class="num">${v.count}</td></tr>`;
    }).join('') || `<tr><td colspan="4" class="text-center text-muted" style="padding:24px">Sin gastos</td></tr>`;
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
