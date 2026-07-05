// ============================================================
// FinTrack — Vista Presupuestos
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, emptyState } from '../ui.js';
import { fmtMoney, fmtPct, uid, nowISO, escapeHTML, currentMonth, inMonth, svNow } from '../utils.js';

export function renderBudgets(root) {
  draw();

  function draw() {
    const budgets = db.getTable('budgets');
    const now = svNow();
    let monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const monthInput = input({ type:'month', value: monthStr });

    root.innerHTML = `
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">Mes:</span>
          <div id="monthWrap"></div>
        </div>
        <button class="btn btn-primary" id="newBtn">${icon('plus',16)} Nuevo presupuesto</button>
      </div>
      <div class="kpi-grid mb-4" id="kpis"></div>
      <div id="list" class="flex flex-col gap-3"></div>
    `;
    root.querySelector('#monthWrap').appendChild(monthInput);
    monthInput.oninput = () => { monthStr = monthInput.value || currentMonth(); renderList(); renderKpis(); };
    root.querySelector('#newBtn').onclick = () => budgetForm(null, draw, monthStr);

    function renderKpis() {
      const monthBudgets = budgets.filter(b => b.month === monthStr);
      const totalLimit = monthBudgets.reduce((s,b) => s+Number(b.amount||0), 0);
      const records = db.getTable('records').filter(r => r.type==='expense' && inMonth(r.date, Number(monthStr.slice(0,4)), Number(monthStr.slice(5,7))-1));
      const totalSpent = records.reduce((s,r) => s+Number(r.amount||0), 0);
      const remaining = totalLimit - totalSpent;
      const pct = totalLimit > 0 ? (totalSpent/totalLimit)*100 : 0;
      const el = root.querySelector('#kpis');
      el.innerHTML = `
        <div class="kpi"><div class="kpi-label">${icon('pie-chart',16)} Presupuestado</div><div class="kpi-value">${fmtMoney(totalLimit)}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('arrow-up-right',16)} Gastado</div><div class="kpi-value amt-neg">${fmtMoney(totalSpent)}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('scale',16)} Restante</div><div class="kpi-value ${remaining>=0?'amt-pos':'amt-neg'}">${fmtMoney(remaining, undefined, {sign:true})}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('bar-chart',16)} Uso</div><div class="kpi-value">${fmtPct(pct)}</div></div>
      `;
    }

    function renderList() {
      const monthBudgets = budgets.filter(b => b.month === monthStr);
      const el = root.querySelector('#list');
      el.innerHTML = '';
      if (monthBudgets.length === 0) {
        el.appendChild(emptyState({
          icon:'pie-chart', title:'Sin presupuestos', message:'Define límites de gasto por categoría para este mes.',
          action: (()=>{const b=document.createElement('button');b.className='btn btn-primary';b.innerHTML=`${icon('plus',16)} Nuevo presupuesto`;b.onclick=()=>budgetForm(null,draw,monthStr);return b;})(),
        }));
        return;
      }
      for (const b of monthBudgets) el.appendChild(budgetRow(b, monthStr, draw));
    }
    renderKpis();
    renderList();
  }
}

function budgetRow(b, monthStr, onChange) {
  const cats = db.getTable('categories');
  const cat = cats.find(c => c.id === b.categoryId);
  const [y, m] = monthStr.split('-').map(Number);
  const records = db.getTable('records').filter(r => r.type==='expense' && r.categoryId === b.categoryId && inMonth(r.date, y, m-1));
  const spent = records.reduce((s,r) => s+Number(r.amount||0), 0);
  const pct = b.amount > 0 ? Math.min(100, (spent/b.amount)*100) : 0;
  const over = spent > b.amount;
  const color = cat?.color || '#10b981';

  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="list-item-icon" style="background:${color}22;color:${color}">${cat?.emoji||'📊'}</div>
        <div>
          <div class="font-semibold">${escapeHTML(cat?.name||'Sin categoría')}</div>
          <div class="text-xs text-dim">${records.length} registro(s)</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="badge ${over?'badge-danger':pct>80?'badge-warning':'badge-success'}">${over?'Excedido':pct>80?'Cerca del límite':'En ritmo'}</span>
        <button class="icon-btn edit-btn">${icon('edit',15)}</button>
        <button class="icon-btn del-btn">${icon('trash',15)}</button>
      </div>
    </div>
    <div class="flex justify-between text-sm mb-1">
      <span class="text-muted">Gastado ${fmtMoney(spent)} de ${fmtMoney(b.amount)}</span>
      <span class="font-mono font-bold ${over?'amt-neg':''}">${fmtPct(pct)}</span>
    </div>
    <div class="progress"><div class="progress-bar ${over?'danger':pct>80?'warning':''}" style="width:${pct}%"></div></div>
    <div class="flex justify-between text-xs text-dim mt-2">
      <span>${over?`Excedido por ${fmtMoney(spent-b.amount)}`:`Disponible ${fmtMoney(b.amount-spent)}`}</span>
    </div>
  `;
  div.querySelector('.edit-btn').onclick = () => budgetForm(b, onChange, b.month);
  div.querySelector('.del-btn').onclick = async () => {
    const ok = await confirm({ title:'Eliminar presupuesto', message:'¿Eliminar este presupuesto?', danger:true, confirmText:'Eliminar' });
    if (ok) { db.remove('budgets', b.id); toast('Eliminado','','success'); onChange(); }
  };
  return div;
}

export function budgetForm(existing, onDone, monthStr) {
  const cats = db.getTable('categories').filter(c => c.type === 'expense');
  const b = existing || { id:'', categoryId:'', amount:'', period:'monthly', month: monthStr, createdAt:'' };
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  const catSel = select(cats.map(c=>({value:c.id,label:`${c.emoji} ${c.name}`})), b.categoryId);
  body.appendChild(field({ label:'Categoría', required:true, input: catSel }));
  const amtInput = input({ type:'number', value:b.amount, step:'0.01', min:'0', placeholder:'0.00' });
  body.appendChild(field({ label:'Monto límite', required:true, input: amtInput }));
  const monthInput = input({ type:'month', value: b.month || monthStr });
  body.appendChild(field({ label:'Mes', input: monthInput }));

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    if (!catSel.value) { toast('Categoría requerida', '', 'error'); return; }
    const amount = Number(amtInput.value);
    if (!amount || amount <= 0) { toast('Monto inválido', '', 'error'); return; }
    db.save('budgets', { ...b, id: b.id||uid('bud'), categoryId: catSel.value, amount, period:'monthly', month: monthInput.value, createdAt: b.createdAt||nowISO() });
    m.close();
    toast(existing?'Actualizado':'Presupuesto creado', '', 'success');
    onDone?.();
  };
  footer.appendChild(cancel); footer.appendChild(save);
  const m = modal({ title: existing?'Editar presupuesto':'Nuevo presupuesto', body, footer });
}
