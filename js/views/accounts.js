// ============================================================
// FinTrack — Vista Tarjetas (Estado y Pagos Corregidos)
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, segmented, emptyState } from '../ui.js';
import { fmtMoney, fmtDate, relativeTime, uid, nowISO, escapeHTML, svNow, cardGradient, maskCardNumber, lastNMonths, inMonth } from '../utils.js';

export function renderCards(root) {
  draw();

  function draw() {
    const accounts = db.getTable('accounts').filter(a => a.type === 'card' && !a.archived);
    const records = db.getTable('records');

    root.innerHTML = `
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">Ordenar por:</span>
          <div id="sorter"></div>
        </div>
        <button class="btn btn-primary" id="newBtn">${icon('plus',16)} Nueva tarjeta</button>
      </div>
      <div id="cardsGrid" class="grid grid-cols-3 gap-4"></div>
    `;

    let sortBy = 'payDate';
    const sortOpts = [
      { value: 'payDate', label: 'Fecha de pago' },
      { value: 'expiry', label: 'Vencimiento' },
      { value: 'alpha', label: 'Alfabético' },
    ];
    const seg = segmented(sortOpts, sortBy, v => { sortBy = v; renderGrid(); });
    root.querySelector('#sorter').appendChild(seg);
    root.querySelector('#newBtn').onclick = () => {
      import('./accounts.js').then(mod => mod.accountForm({ type:'card', id:'', name:'', emoji:'💳', color:'#8b5cf6', balance:0, currency:'USD', last4:'', cutDay:15, payDay:5, creditLimit:0, expiry:'', archived:false, createdAt:'' }, draw));
    };

    function renderGrid() {
      const grid = root.querySelector('#cardsGrid');
      grid.innerHTML = '';
      let list = accounts.slice();
      list.sort((a,b) => {
        if (sortBy === 'alpha') return a.name.localeCompare(b.name);
        if (sortBy === 'expiry') return (a.expiry||'').localeCompare(b.expiry||'');
        const pa = getCardMetrics(a, records).period.nextPay;
        const pb = getCardMetrics(b, records).period.nextPay;
        return pa - pb;
      });
      if (list.length === 0) {
        grid.appendChild(emptyState({
          icon:'credit-card', title:'Sin tarjetas', message:'Crea una cuenta de tipo tarjeta de crédito.',
          action: (()=>{const b=document.createElement('button');b.className='btn btn-primary';b.innerHTML=`${icon('plus',16)} Nueva tarjeta`;b.onclick=()=>import('./accounts.js').then(m=>m.accountForm({type:'card',id:'',name:'',emoji:'💳',color:'#8b5cf6',balance:0,currency:'USD',last4:'',cutDay:15,payDay:5,creditLimit:0,expiry:'',archived:false,createdAt:''}, draw));return b;})(),
        }));
        return;
      }
      for (const c of list) grid.appendChild(cardMini(c, records, draw));
    }
    renderGrid();
  }
}

function cardMini(c, records, onChange) {
  const metrics = getCardMetrics(c, records);
  const { period, totalDebt, status, due } = metrics;
  const usagePct = c.creditLimit > 0 ? Math.min(100, (totalDebt / c.creditLimit) * 100) : 0;

  const div = document.createElement('div');
  div.className = 'card card-hover';
  div.style.cursor = 'pointer';
  div.innerHTML = `
    <div class="card-visual" style="background:${cardGradient(c.color)};margin:-18px -18px 14px;border-radius:16px 16px 0 0">
      <div class="flex justify-between items-start">
        <div class="card-chip"></div>
        <span style="font-size:10px;opacity:.85;font-weight:800;letter-spacing:.1em">${escapeHTML((c.name||'').toUpperCase())}</span>
      </div>
      <div class="card-number">${maskCardNumber(c.last4)}</div>
      <div class="card-meta">
        <div>
          <div style="opacity:.7;font-size:9px">LÍMITE</div>
          <div style="font-weight:600">${fmtMoney(c.creditLimit, undefined, {compact:true})}</div>
        </div>
        <div style="text-align:right">
          <div style="opacity:.7;font-size:9px">VENCE</div>
          <div style="font-weight:600">${escapeHTML(c.expiry||'—')}</div>
        </div>
      </div>
    </div>
    <div class="flex items-center justify-between mb-2">
      <span class="badge ${status.cls} badge-dot">${status.label}</span>
      <span class="text-xs text-dim">Próx. corte ${relativeTime(period.nextCut.toISOString())} · Pago ${relativeTime(period.nextPay.toISOString())}</span>
    </div>
    <div class="flex justify-between text-xs text-muted mb-1">
      <span>Deuda total / Límite</span>
      <span class="font-mono">${usagePct.toFixed(0)}%</span>
    </div>
    <div class="progress mb-3"><div class="progress-bar ${usagePct>80?'danger':usagePct>60?'warning':''}" style="width:${usagePct}%"></div></div>
    <div class="flex justify-between text-xs mb-2">
      <div><span class="text-dim">Deuda total</span><div class="font-semibold font-mono amt-neg">${fmtMoney(totalDebt)}</div></div>
      <div class="text-right"><span class="text-dim">Disponible</span><div class="font-semibold font-mono">${fmtMoney(Math.max(0, c.creditLimit - totalDebt))}</div></div>
    </div>
    <div class="flex justify-between text-xs">
      <div><span class="text-dim">Corte (inicio)</span><div class="font-semibold">${fmtDate(period.start.toISOString(),{pattern:'short'})}</div></div>
      <div class="text-right"><span class="text-dim">Pago (fin)</span><div class="font-semibold">${fmtDate(period.nextPay.toISOString(),{pattern:'short'})}</div></div>
    </div>
    <div class="divider"></div>
    <div class="flex justify-between items-center mb-2">
      <span class="text-sm text-muted">A pagar (periodo)</span>
      <span class="font-mono font-bold ${due>0?'amt-neg':''} text-lg">${fmtMoney(due)}</span>
    </div>
    <button class="btn btn-primary btn-block pay-btn" ${due<=0?'disabled':''}>
      ${icon(due<=0?'check':'banknote',16)} ${due<=0?'Al día':'Pagar tarjeta'}
    </button>
  `;
  div.onclick = (e) => {
    if (e.target.closest('.pay-btn')) return;
    openCardDetail(c, records, onChange);
  };
  div.querySelector('.pay-btn').onclick = (e) => {
    e.stopPropagation();
    payCard(c, { due, totalDebt }, onChange);
  };
  return div;
}

function openCardDetail(c, records, onChange) {
  const metrics = getCardMetrics(c, records);
  const { period, totalDebt, status, due } = metrics;
  const usagePct = c.creditLimit > 0 ? Math.min(100, (totalDebt / c.creditLimit) * 100) : 0;
  
  const months = lastNMonths(6);
  const spending = months.map(mo => records.filter(r => r.accountId===c.id && r.type==='expense' && inMonth(r.date, mo.y, mo.m)).reduce((s,r)=>s+Number(r.amount||0),0));

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  body.innerHTML = `
    <div class="card-visual" style="background:${cardGradient(c.color)};margin:0">
      <div class="flex justify-between items-start">
        <div class="card-chip"></div>
        <span style="font-size:10px;opacity:.85;font-weight:800;letter-spacing:.1em">${escapeHTML((c.name||'').toUpperCase())}</span>
      </div>
      <div class="card-number">${maskCardNumber(c.last4)}</div>
      <div class="card-meta">
        <div><div style="opacity:.7;font-size:9px">LÍMITE</div><div style="font-weight:600">${fmtMoney(c.creditLimit)}</div></div>
        <div style="text-align:right"><div style="opacity:.7;font-size:9px">VENCE</div><div style="font-weight:600">${escapeHTML(c.expiry||'—')}</div></div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="card" style="padding:14px">
        <div class="text-xs text-muted">Estado</div>
        <div class="mt-2"><span class="badge ${status.cls} badge-dot">${status.label}</span></div>
      </div>
      <div class="card" style="padding:14px">
        <div class="text-xs text-muted">Deuda total</div>
        <div class="font-mono font-bold text-xl ${totalDebt>0?'amt-neg':''}">${fmtMoney(totalDebt)}</div>
      </div>
      <div class="card" style="padding:14px">
        <div class="text-xs text-muted">Corte (inicio periodo)</div>
        <div class="font-semibold mt-1">${fmtDate(period.start.toISOString())}</div>
        <div class="text-xs text-dim">${relativeTime(period.start.toISOString())}</div>
      </div>
      <div class="card" style="padding:14px">
        <div class="text-xs text-muted">Pago (fin periodo)</div>
        <div class="font-semibold mt-1">${fmtDate(period.nextPay.toISOString())}</div>
        <div class="text-xs text-dim">${relativeTime(period.nextPay.toISOString())}</div>
      </div>
    </div>

    <div class="card">
      <div class="flex justify-between text-sm mb-2">
        <span class="text-muted">Deuda total / Límite de crédito</span>
        <span class="font-mono font-bold">${usagePct.toFixed(0)}%</span>
      </div>
      <div class="progress"><div class="progress-bar ${usagePct>80?'danger':usagePct>60?'warning':''}" style="width:${usagePct}%"></div></div>
      <div class="flex justify-between text-xs text-dim mt-2">
        <span>Deuda: ${fmtMoney(totalDebt)}</span>
        <span>Disponible: ${fmtMoney(Math.max(0, c.creditLimit - totalDebt))}</span>
      </div>
    </div>

    <div class="card">
      <div class="flex justify-between items-center">
        <div>
          <div class="text-xs text-muted">A pagar (deuda del periodo)</div>
          <div class="text-xs text-dim">Deuda al corte menos abonos</div>
        </div>
        <div class="font-mono font-bold text-lg ${due>0?'amt-neg':'text-success'}">${fmtMoney(due)}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Gasto mensual (6 meses)</div></div>
      <div style="height:200px"><canvas id="cardLineChart"></canvas></div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Movimientos del periodo</div></div>
      <div class="flex flex-col gap-2 scroll-list" id="periodMovs"></div>
    </div>
  `;

  const movs = records.filter(r => (r.accountId === c.id || r.toAccountId === c.id) && new Date(r.date) >= period.start && new Date(r.date) < period.nextCut)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const movsEl = body.querySelector('#periodMovs');
  
  if (movs.length === 0) {
    movsEl.appendChild(emptyState({ icon:'receipt', title:'Sin movimientos', message:'No hay registros en este periodo.' }));
  } else {
    for (const r of movs) {
      const isPayment = r.type === 'transfer' && r.toAccountId === c.id;
      const cat = db.getTable('categories').find(x=>x.id===r.categoryId);
      movsEl.insertAdjacentHTML('beforeend', `
        <div class="list-item" style="padding:8px 10px">
          <div class="list-item-icon" style="background:var(--${isPayment?'success':'primary'}-soft);color:var(--${isPayment?'success':'primary'});width:32px;height:32px">${icon(isPayment?'arrow-down-left':'arrow-up-right',14)}</div>
          <div class="list-item-body">
            <div class="list-item-title" style="font-size:13px">${escapeHTML(r.note||cat?.name||(isPayment?'Abono':'Gasto'))}</div>
            <div class="list-item-sub">${fmtDate(r.date,{pattern:'short'})}</div>
          </div>
          <div class="font-mono font-bold ${isPayment?'text-success':'amt-neg'}" style="font-size:13px">${isPayment?'+':'-'}${fmtMoney(r.amount)}</div>
        </div>
      `);
    }
  }

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:space-between;gap:10px';
  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-danger'; delBtn.innerHTML = `${icon('trash',14)} Eliminar`;
  delBtn.onclick = async () => {
    const recCount = db.getTable('records').filter(r => r.accountId === c.id || r.toAccountId === c.id || r.linkedCardId === c.id).length;
    const msg = recCount > 0
      ? `Esta tarjeta tiene ${recCount} registro(s). Al eliminarla pierden su referencia. ¿Eliminar de todos modos?`
      : '¿Eliminar definitivamente esta tarjeta?';
    const ok = await confirm({ title: 'Eliminar tarjeta', message: msg, danger: true, confirmText: 'Eliminar' });
    if (ok) {
      db.remove('accounts', c.id);
      m.close();
      toast('Tarjeta eliminada', '', 'success');
      onChange();
    }
  };
  const editBtn = document.createElement('button');
  editBtn.className = 'btn'; editBtn.innerHTML = `${icon('edit',14)} Editar`;
  editBtn.onclick = () => { m.close(); import('./accounts.js').then(mod => mod.accountForm(c, onChange)); };
  
  const payBtn = document.createElement('button');
  payBtn.className = 'btn btn-primary'; payBtn.innerHTML = `${icon('banknote',16)} Pagar tarjeta`;
  payBtn.disabled = due <= 0;
  payBtn.onclick = () => { m.close(); payCard(c, { due, totalDebt }, onChange); };
  
  footer.appendChild(delBtn);
  footer.appendChild(editBtn);
  footer.appendChild(payBtn);

  const m = modal({ title: c.name, size: 'lg', body, footer });

  setTimeout(() => {
    const canvas = body.querySelector('#cardLineChart');
    if (!canvas) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: months.map(mo => mo.label),
        datasets: [{ label: 'Gasto', data: spending, borderColor: c.color, backgroundColor: c.color + '22', fill: true, tension: 0.35, pointRadius: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: isDark ? '#9aa8a1' : '#5c6b64' } },
          y: { grid: { color: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' }, ticks: { color: isDark ? '#9aa8a1' : '#5c6b64' } },
        },
      },
    });
  }, 50);
}

// ---------- Pagar tarjeta (Corregido a tipo 'transfer') ----------
export function payCard(card, bal, onDone) {
  if (bal.due <= 0) { toast('Nada que pagar', 'La tarjeta no tiene deuda pendiente.', 'info'); return; }
  const accounts = db.getTable('accounts').filter(a => !a.archived && a.id !== card.id && a.type !== 'card');
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  body.innerHTML = `
    <div class="card" style="padding:14px;background:var(--primary-soft);border-color:transparent">
      <div class="text-xs text-muted">Pago a ${escapeHTML(card.name)}</div>
      <div class="font-mono font-bold text-2xl">${fmtMoney(bal.due)}</div>
    </div>
  `;
  const paySource = select(
    [{value:'',label:'— Selecciona cuenta de origen —'}, ...accounts.map(a=>({value:a.id,label:`${a.emoji} ${a.name} (${fmtMoney(a.balance,a.currency,{compact:true})})`}))], ''
  );
  body.appendChild(field({ label: 'Pagar desde', required: true, input: paySource }));
  
  // Utilizando constructor local para evitar desfases de Timezone (UTC) en los inputs:
  const t = new Date();
  const todayLocalStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  
  const amtInput = input({ type:'number', value: bal.due, step:'0.01', min:'0.01' });
  body.appendChild(field({ label: 'Monto a pagar', input: amtInput }));
  const dateInput = input({ type:'date', value: todayLocalStr });
  body.appendChild(field({ label: 'Fecha de pago', input: dateInput }));

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const pay = document.createElement('button'); pay.className='btn btn-primary'; pay.innerHTML=`${icon('banknote',16)} Confirmar pago`;
  cancel.onclick = () => m.close();
  pay.onclick = () => {
    const sourceId = paySource.value;
    const amount = Number(amtInput.value);
    if (!sourceId) { toast('Selecciona cuenta', 'Elige desde dónde pagar.', 'error'); return; }
    if (!amount || amount <= 0) { toast('Monto inválido', '', 'error'); return; }
    
    const rec = {
      id: uid('rec'),
      type: 'transfer', // AHORA ES TRANSFERENCIA DIRECTA A LA TARJETA
      amount,
      currency: 'USD',
      date: dateInput.value,
      accountId: sourceId,
      toAccountId: card.id, // VINCULACIÓN CORRECTA DE INGRESO
      categoryId: 'cat-cardpay',
      tags: ['tag-rec'],
      note: `Abono a ${card.name}`,
      linkedCardId: card.id, // Mantenido por retrocompatibilidad visual
      scheduledId: '',
      createdAt: nowISO(),
    };
    db.save('records', rec);
    db.applyRecordToAccounts(rec);
    db.persistNow();
    m.close();
    toast('Pago registrado', `Se abonó ${fmtMoney(amount)} a ${card.name}.`, 'success');
    onDone?.();
  };
  footer.appendChild(cancel);
  footer.appendChild(pay);

  const m = modal({ title: 'Pagar tarjeta', size: 'sm', body, footer });
}

// ---------- Motor Interno y Robusto de Métricas de Tarjetas ----------
function getCardMetrics(c, records) {
  const today = new Date();
  const cutDay = Number(c.cutDay) || 1;
  const payDay = Number(c.payDay) || 1;

  // Helper para resolver fechas problemáticas (ej. prevenir que 31 de Febrero salte al 3 de Marzo)
  const getSafeDate = (y, m, d) => {
    let dt = new Date(y, m, d);
    if (dt.getDate() !== d) dt = new Date(y, m + 1, 0); // Fija al último día del mes
    return dt;
  };

  const toLocalStr = (d) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  let lastCut = getSafeDate(today.getFullYear(), today.getMonth(), cutDay);
  if (today.getDate() < cutDay) {
    lastCut = getSafeDate(today.getFullYear(), today.getMonth() - 1, cutDay);
  }

  let nextPay = getSafeDate(lastCut.getFullYear(), lastCut.getMonth(), payDay);
  if (payDay <= cutDay) {
    nextPay = getSafeDate(lastCut.getFullYear(), lastCut.getMonth() + 1, payDay);
  }
  let nextCut = getSafeDate(lastCut.getFullYear(), lastCut.getMonth() + 1, cutDay);

  const lastCutStr = toLocalStr(lastCut);
  const nextPayStr = toLocalStr(nextPay);
  const todayStr = toLocalStr(today);

  // La deuda total siempre es el saldo actual de la cuenta (en valor absoluto)
  let totalDebt = Math.abs(Number(c.balance) || 0);

  // Retrospectiva: Descubrir cuánto se debía exactamente el día del corte
  let balanceAtCut = totalDebt;
  let paymentsSinceCut = 0;

  const recent = records.filter(r => 
    (r.accountId === c.id || r.toAccountId === c.id || r.linkedCardId === c.id) &&
    r.date > lastCutStr && r.date <= todayStr
  );

  // Ahora rastreamos gastos, reembolsos, y salidas de capital (cash advance)
  for (const r of recent) {
    const amt = Number(r.amount) || 0;
    
    if (r.type === 'expense' && r.accountId === c.id) {
      balanceAtCut -= amt; // Consumo nuevo (reducimos para volver en el tiempo)
    } else if (r.type === 'income' && r.accountId === c.id) {
      balanceAtCut += amt; // Reembolsos/Cashback (sumamos porque habían reducido la deuda)
    } else if (r.type === 'transfer' && r.toAccountId === c.id) {
      balanceAtCut += amt; // Sumar de vuelta los abonos realizados
      paymentsSinceCut += amt;
    } else if (r.type === 'transfer' && r.accountId === c.id) {
      balanceAtCut -= amt; // Transferencia saliente / Avance de efectivo
    } else if (r.type === 'expense' && r.linkedCardId === c.id) {
      balanceAtCut += amt; // Soporte para registros viejos
      paymentsSinceCut += amt;
    }
  }

  let due = Math.max(0, balanceAtCut - paymentsSinceCut);

  // Resolución definitiva de Etiquetas
  let status;
  if (totalDebt <= 0 || due <= 0.01) {
    status = { label: 'Pagada', cls: 'badge-success' };
    due = 0;
  } else if (todayStr > nextPayStr) {
    status = { label: 'Vencida', cls: 'badge-danger' };
  } else {
    status = { label: 'Pendiente', cls: 'badge-warning' };
  }

  return { totalDebt, due, status, period: { start: lastCut, nextPay, nextCut } };
}