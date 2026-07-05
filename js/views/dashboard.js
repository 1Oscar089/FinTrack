// ============================================================
// FinTrack — Vista Inicio (Dashboard)
// ============================================================
import * as db from '../db.js';
import { RECORD_TYPES, ACCOUNT_TYPES } from '../config.js';
import { icon } from '../icons.js';
import { toast, emptyState } from '../ui.js';
import { fmtMoney, fmtDate, fmtNum, relativeTime, todayISO, lastNMonths, inMonth, svNow, sum, cardPeriodBalance, escapeHTML, countsInBalance } from '../utils.js';

export function renderDashboard(root) {
  const data = db.getAll();
  const accounts = data.accounts.filter(a => !a.archived);
  const balanceAccounts = accounts.filter(countsInBalance); // excluye savings
  const savingsAccounts = accounts.filter(a => !countsInBalance(a));
  const records = data.records;
  const cards = accounts.filter(a => a.type === 'card');
  const scheduled = data.scheduled.filter(s => s.active);

  const now = svNow();
  const y = now.getFullYear(), m = now.getMonth();
  const monthLabel = now.toLocaleDateString('es-SV', { month: 'long', year: 'numeric' });

  // KPIs — el balance total excluye tarjetas (deuda) y savings (ahorros no disponibles)
  const totalBalance = balanceAccounts.reduce((s,a) => s + (a.type === 'card' ? 0 : Number(a.balance||0)), 0);
  const totalSavings = savingsAccounts.reduce((s,a) => s + Number(a.balance||0), 0);
  const monthInc = records.filter(r => r.type === 'income' && inMonth(r.date, y, m)).reduce((s,r) => s+Number(r.amount||0), 0);
  const monthExp = records.filter(r => r.type === 'expense' && inMonth(r.date, y, m)).reduce((s,r) => s+Number(r.amount||0), 0);
  const monthNet = monthInc - monthExp;
  const cardDebt = cards.reduce((s,c) => s + cardPeriodBalance(c, records).due, 0);

  // Upcoming payments (próximos 7 días)
  const upcoming = scheduled
    .map(s => ({ ...s, _days: Math.ceil((new Date(s.nextDate) - now) / 86400000) }))
    .filter(s => s._days >= -1 && s._days <= 14)
    .sort((a,b) => a._days - b._days)
    .slice(0, 6);

  root.innerHTML = `
    <div class="mb-4">
      <h2 style="font-size:14px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">${monthLabel}</h2>
    </div>

    <div class="kpi-grid mb-6">
      <div class="kpi">
        <div class="kpi-label">${icon('wallet',16)} Balance total</div>
        <div class="kpi-value">${fmtMoney(totalBalance)}</div>
        <div class="kpi-delta up">${icon('trending-up',12)} Patrimonio líquido</div>
        <div class="kpi-icon">${icon('wallet',16)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${icon('arrow-down-left',16)} Ingresos del mes</div>
        <div class="kpi-value amt-pos">${fmtMoney(monthInc)}</div>
        <div class="kpi-delta up">Este mes</div>
        <div class="kpi-icon" style="background:rgba(16,185,129,.15);color:var(--success)">${icon('arrow-down-left',16)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${icon('arrow-up-right',16)} Egresos del mes</div>
        <div class="kpi-value amt-neg">${fmtMoney(monthExp)}</div>
        <div class="kpi-delta down">Este mes</div>
        <div class="kpi-icon" style="background:rgba(239,68,68,.15);color:var(--danger)">${icon('arrow-up-right',16)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${icon('scale',16)} Balance neto</div>
        <div class="kpi-value ${monthNet>=0?'amt-pos':'amt-neg'}">${fmtMoney(monthNet, undefined, {sign:true})}</div>
        <div class="kpi-delta ${monthNet>=0?'up':'down'}">${monthNet>=0?'Superávit':'Déficit'}</div>
        <div class="kpi-icon">${icon('scale',16)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${icon('credit-card',16)} Deuda en tarjetas</div>
        <div class="kpi-value ${cardDebt>0?'amt-neg':''}">${fmtMoney(cardDebt)}</div>
        <div class="kpi-delta">A pagar en periodo</div>
        <div class="kpi-icon" style="background:rgba(139,92,246,.15);color:#8b5cf6">${icon('credit-card',16)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${icon('savings',16)} Ahorros apartados</div>
        <div class="kpi-value">${fmtMoney(totalSavings)}</div>
        <div class="kpi-delta">No incluidos en el balance</div>
        <div class="kpi-icon" style="background:rgba(20,184,166,.15);color:#14b8a6">${icon('savings',16)}</div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4 mb-4">
      <div class="card" style="grid-column:span 2">
        <div class="card-header">
          <div>
            <div class="card-title">Flujo de los últimos 6 meses</div>
            <div class="card-sub">Ingresos vs egresos</div>
          </div>
        </div>
        <div style="height:240px"><canvas id="flowChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Cuentas</div>
          <span class="badge badge-neutral">${accounts.length}</span>
        </div>
        <div class="flex flex-col gap-2 scroll-list" id="acctMiniList"></div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="card" style="grid-column:span 2">
        <div class="card-header">
          <div class="card-title">Registros recientes</div>
        </div>
        <div class="flex flex-col gap-2" id="recentList"></div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Próximos pagos</div>
          <span class="badge badge-info">${upcoming.length}</span>
        </div>
        <div class="flex flex-col gap-2" id="upcomingList"></div>
      </div>
    </div>
  `;

  // Render cuentas mini (incluye savings pero marcadas)
  const acctList = root.querySelector('#acctMiniList');
  if (accounts.length === 0) {
    acctList.appendChild(emptyState({ icon: 'wallet', title: 'Sin cuentas', message: 'Crea una cuenta para empezar.' }));
  } else {
    for (const a of accounts.slice(0, 5)) {
      const t = ACCOUNT_TYPES[a.type] || ACCOUNT_TYPES.cash;
      const isSavings = !countsInBalance(a);
      acctList.insertAdjacentHTML('beforeend', `
        <div class="list-item" style="padding:8px 10px">
          <div class="list-item-icon" style="background:${a.color}22;color:${a.color};width:32px;height:32px;font-size:16px">${a.emoji||t.emoji}</div>
          <div class="list-item-body">
            <div class="list-item-title" style="font-size:13px">${escapeHTML(a.name)} ${isSavings?'<span class="badge badge-neutral" style="font-size:9px">aparte</span>':''}</div>
            <div class="list-item-sub">${t.label}</div>
          </div>
          <div class="font-mono font-bold ${Number(a.balance)<0?'amt-neg':''}" style="font-size:13px">${fmtMoney(a.balance, a.currency)}</div>
        </div>
      `);
    }
  }

  // Registros recientes
  const recent = records.slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,6);
  const recentList = root.querySelector('#recentList');
  if (recent.length === 0) {
    recentList.appendChild(emptyState({ icon: 'receipt', title: 'Sin registros', message: 'Crea tu primer registro.' }));
  } else {
    for (const r of recent) {
      const acc = accounts.find(a => a.id === r.accountId);
      const t = RECORD_TYPES[r.type] || RECORD_TYPES.expense;
      const sign = r.type === 'income' ? '+' : r.type === 'expense' ? '-' : '';
      recentList.insertAdjacentHTML('beforeend', `
        <div class="list-item" style="padding:8px 10px">
          <div class="list-item-icon" style="background:${t.color}22;color:${t.color};width:32px;height:32px">${icon(t.icon,16)}</div>
          <div class="list-item-body">
            <div class="list-item-title" style="font-size:13px">${escapeHTML(r.note || 'Registro')}</div>
            <div class="list-item-sub">${escapeHTML(acc?acc.emoji+' '+acc.name:'—')} · ${fmtDate(r.date,{pattern:'short'})}</div>
          </div>
          <div class="font-mono font-bold ${r.type==='income'?'amt-pos':r.type==='expense'?'amt-neg':''}" style="font-size:13px">${sign}${fmtMoney(r.amount)}</div>
        </div>
      `);
    }
  }

  // Próximos pagos
  const upList = root.querySelector('#upcomingList');
  if (upcoming.length === 0) {
    upList.appendChild(emptyState({ icon: 'repeat', title: 'Sin pagos próximos', message: 'Programa pagos recurrentes.' }));
  } else {
    for (const s of upcoming) {
      const cls = s._days < 0 ? 'badge-danger' : s._days <= 3 ? 'badge-warning' : 'badge-neutral';
      upList.insertAdjacentHTML('beforeend', `
        <div class="list-item" style="padding:8px 10px">
          <div class="list-item-icon" style="background:var(--primary-soft);color:var(--primary);width:32px;height:32px">${icon('repeat',14)}</div>
          <div class="list-item-body">
            <div class="list-item-title" style="font-size:13px">${escapeHTML(s.name)}</div>
            <div class="list-item-sub">${relativeTime(s.nextDate)}</div>
          </div>
          <span class="badge ${cls}">${s._days<0?'Vencido':s._days===0?'Hoy':`${s._days}d`}</span>
          <div class="font-mono font-bold" style="font-size:13px">${fmtMoney(s.amount)}</div>
        </div>
      `);
    }
  }

  // Chart flujo
  drawFlowChart(root.querySelector('#flowChart'), records);
}

function drawFlowChart(canvas, records) {
  const months = lastNMonths(6);
  const inc = months.map(mo => records.filter(r => r.type==='income' && inMonth(r.date, mo.y, mo.m)).reduce((s,r)=>s+Number(r.amount||0),0));
  const exp = months.map(mo => records.filter(r => r.type==='expense' && inMonth(r.date, mo.y, mo.m)).reduce((s,r)=>s+Number(r.amount||0),0));
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#9aa8a1' : '#5c6b64';

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Ingresos', data: inc, backgroundColor: 'rgba(16,185,129,.7)', borderRadius: 6, maxBarThickness: 28 },
        { label: 'Egresos', data: exp, backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 6, maxBarThickness: 28 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: textColor, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtMoney(c.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, callback: v => fmtMoney(v, undefined, {compact:true}) } },
      },
    },
  });
}

function escape(s){return escapeHTML(s);}
