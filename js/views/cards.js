// ============================================================
// FinTrack — Vista Tarjetas
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, segmented, emptyState } from '../ui.js';
import { fmtMoney, fmtDate, relativeTime, uid, nowISO, escapeHTML, cardPeriod, cardPeriodBalance, cardStatus, svNow, cardGradient, maskCardNumber, lastNMonths, inMonth } from '../utils.js';
import { renderRecordForm } from './records.js';

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
      // redirigir a cuentas con tipo tarjeta preseleccionado — aquí abrimos el form directo
      import('./accounts.js').then(mod => mod.accountForm({ type:'card', id:'', name:'', emoji:'💳', color:'#8b5cf6', balance:0, currency:'USD', last4:'', cutDay:15, payDay:5, creditLimit:0, expiry:'', archived:false, createdAt:'' }, draw));
    };

    function renderGrid() {
      const grid = root.querySelector('#cardsGrid');
      grid.innerHTML = '';
      let list = accounts.slice();
      list.sort((a,b) => {
        if (sortBy === 'alpha') return a.name.localeCompare(b.name);
        if (sortBy === 'expiry') return (a.expiry||'').localeCompare(b.expiry||'');
        // payDate
        const pa = cardPeriod(a.cutDay, a.payDay).nextPay;
        const pb = cardPeriod(b.cutDay, b.payDay).nextPay;
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
  const period = cardPeriod(c.cutDay, c.payDay);
  const bal = cardPeriodBalance(c, records);
  const status = cardStatus(c, records);
  const usagePct = c.creditLimit > 0 ? Math.min(100, (bal.due / c.creditLimit) * 100) : 0;

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
      <span class="text-xs text-dim">Pago ${relativeTime(period.nextPay.toISOString())}</span>
    </div>
    <div class="flex justify-between text-xs text-muted mb-1">
      <span>Deuda del periodo</span>
      <span class="font-mono">${usagePct.toFixed(0)}%</span>
    </div>
    <div class="progress mb-3"><div class="progress-bar ${usagePct>80?'danger':usagePct>60?'warning':''}" style="width:${usagePct}%"></div></div>
    <div class="flex justify-between text-xs">
      <div><span class="text-dim">Corte</span><div class="font-semibold">${fmtDate(period.nextCut.toISOString(),{pattern:'short'})}</div></div>
      <div class="text-right"><span class="text-dim">Pago</span><div class="font-semibold">${fmtDate(period.nextPay.toISOString(),{pattern:'short'})}</div></div>
    </div>
    <div class="divider"></div>
    <div class="flex justify-between items-center mb-2">
      <span class="text-sm text-muted">A pagar</span>
      <span class="font-mono font-bold ${bal.due>0?'amt-neg':''} text-lg">${fmtMoney(bal.due)}</span>
    </div>
    <button class="btn btn-primary btn-block pay-btn" ${bal.due<=0?'disabled':''}>${icon('banknote',16)} Pagar tarjeta</button>
  `;
  div.onclick = (e) => {
    if (e.target.closest('.pay-btn')) return;
    openCardDetail(c, records, onChange);
  };
  div.querySelector('.pay-btn').onclick = (e) => {
    e.stopPropagation();
    payCard(c, bal, onChange);
  };
  return div;
}

function openCardDetail(c, records, onChange) {
  const period = cardPeriod(c.cutDay, c.payDay);
  const bal = cardPeriodBalance(c, records);
  const status = cardStatus(c, records);
  // Gastos por mes (últimos 6)
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
        <div class="text-xs text-muted">A pagar (periodo actual)</div>
        <div class="font-mono font-bold text-xl ${bal.due>0?'amt-neg':''}">${fmtMoney(bal.due)}</div>
      </div>
      <div class="card" style="padding:14px">
        <div class="text-xs text-muted">Próximo corte</div>
        <div class="font-semibold mt-1">${fmtDate(period.nextCut.toISOString())}</div>
        <div class="text-xs text-dim">${relativeTime(period.nextCut.toISOString())}</div>
      </div>
      <div class="card" style="padding:14px">
        <div class="text-xs text-muted">Fecha de pago</div>
        <div class="font-semibold mt-1">${fmtDate(period.nextPay.toISOString())}</div>
        <div class="text-xs text-dim">${relativeTime(period.nextPay.toISOString())}</div>
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

  // Movimientos del periodo
  const movs = records.filter(r => r.accountId === c.id && new Date(r.date) >= period.start && new Date(r.date) < period.end)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const movsEl = body.querySelector('#periodMovs');
  if (movs.length === 0) {
    movsEl.appendChild(emptyState({ icon:'receipt', title:'Sin movimientos', message:'No hay gastos en este periodo.' }));
  } else {
    for (const r of movs) {
      const cat = db.getTable('categories').find(x=>x.id===r.categoryId);
      movsEl.insertAdjacentHTML('beforeend', `
        <div class="list-item" style="padding:8px 10px">
          <div class="list-item-icon" style="background:var(--primary-soft);color:var(--primary);width:32px;height:32px">${icon('arrow-up-right',14)}</div>
          <div class="list-item-body">
            <div class="list-item-title" style="font-size:13px">${escapeHTML(r.note||cat?.name||'Gasto')}</div>
            <div class="list-item-sub">${fmtDate(r.date,{pattern:'short'})}</div>
          </div>
          <div class="font-mono font-bold amt-neg" style="font-size:13px">-${fmtMoney(r.amount)}</div>
        </div>
      `);
    }
  }

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:space-between;gap:10px';
  const editBtn = document.createElement('button');
  editBtn.className = 'btn'; editBtn.innerHTML = `${icon('edit',14)} Editar`;
  editBtn.onclick = () => { m.close(); import('./accounts.js').then(mod => mod.accountForm(c, onChange)); };
  const payBtn = document.createElement('button');
  payBtn.className = 'btn btn-primary'; payBtn.innerHTML = `${icon('banknote',16)} Pagar ${fmtMoney(bal.due)}`;
  payBtn.disabled = bal.due <= 0;
  payBtn.onclick = () => { m.close(); payCard(c, bal, onChange); };
  footer.appendChild(editBtn);
  footer.appendChild(payBtn);

  const m = modal({ title: c.name, size: 'lg', body, footer });

  // Chart
  setTimeout(() => {
    const canvas = body.querySelector('#cardLineChart');
    if (!canvas) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#9aa8a1' : '#5c6b64';
    const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: months.map(mo => mo.label),
        datasets: [{
          label: 'Gasto',
          data: spending,
          borderColor: c.color,
          backgroundColor: c.color + '22',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: c.color,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtMoney(c.parsed.y) } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font:{size:11} } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font:{size:11}, callback: v => fmtMoney(v, undefined, {compact:true}) } },
        },
      },
    });
  }, 50);
}

// ---------- Pagar tarjeta ----------
export function payCard(card, bal, onDone) {
  if (bal.due <= 0) { toast('Nada que pagar', 'La tarjeta no tiene deuda en este periodo.', 'info'); return; }
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
    [{value:'',label:'— Selecciona cuenta —'}, ...accounts.map(a=>({value:a.id,label:`${a.emoji} ${a.name} (${fmtMoney(a.balance,a.currency,{compact:true})})`}))],
    ''
  );
  body.appendChild(field({ label: 'Pagar desde', required: true, input: paySource }));
  const amtInput = input({ type:'number', value: bal.due, step:'0.01', min:'0.01' });
  body.appendChild(field({ label: 'Monto', input: amtInput }));
  const dateInput = input({ type:'date', value: new Date().toISOString().slice(0,10) });
  body.appendChild(field({ label: 'Fecha', input: dateInput }));

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
    const source = db.getTable('accounts').find(a => a.id === sourceId);
    if (source.balance < amount) {
      // advertir pero permitir
      toast('Saldo insuficiente', 'La cuenta no tiene saldo suficiente, pero se registrará igual.', 'warning');
    }
    // Crear registro de pago de tarjeta
    const rec = {
      id: uid('rec'),
      type: 'expense',
      amount,
      currency: 'USD',
      date: dateInput.value,
      accountId: sourceId,
      toAccountId: '',
      categoryId: 'cat-cardpay',
      tags: ['tag-rec'],
      note: `Pago ${card.name}`,
      linkedCardId: card.id,
      scheduledId: '',
      createdAt: nowISO(),
    };
    db.save('records', rec);
    db.applyRecordToAccounts(rec);
    m.close();
    toast('Pago registrado', `${fmtMoney(amount)} pagado a ${card.name}.`, 'success');
    onDone?.();
  };
  footer.appendChild(cancel);
  footer.appendChild(pay);

  const m = modal({ title: 'Pagar tarjeta', size: 'sm', body, footer });
}
