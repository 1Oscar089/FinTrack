// ============================================================
// FinTrack — Vista Deudas
// ============================================================
import * as db from '../db.js';
import { DEBT_TYPES } from '../config.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, textarea, segmented, emptyState } from '../ui.js';
import { fmtMoney, fmtDate, relativeTime, todayISO, uid, nowISO, escapeHTML, svNow } from '../utils.js';

export function renderDebts(root) {
  draw();

  function draw() {
    const debts = db.getTable('debts');
    const owe = debts.filter(d => d.type === 'owe' && !d.settled);
    const owed = debts.filter(d => d.type === 'owed' && !d.settled);
    const settled = debts.filter(d => d.settled);

    const totalOwe = owe.reduce((s,d) => s+Number(d.amount||0), 0);
    const totalOwed = owed.reduce((s,d) => s+Number(d.amount||0), 0);
    const net = totalOwed - totalOwe;

    root.innerHTML = `
      <div class="kpi-grid mb-4">
        <div class="kpi"><div class="kpi-label">${icon('arrow-up-right',16)} Yo debo</div><div class="kpi-value amt-neg">${fmtMoney(totalOwe)}</div><div class="kpi-delta down">${owe.length} deuda(s)</div></div>
        <div class="kpi"><div class="kpi-label">${icon('arrow-down-left',16)} Me deben</div><div class="kpi-value amt-pos">${fmtMoney(totalOwed)}</div><div class="kpi-delta up">${owed.length} deuda(s)</div></div>
        <div class="kpi"><div class="kpi-label">${icon('scale',16)} Balance neto</div><div class="kpi-value ${net>=0?'amt-pos':'amt-neg'}">${fmtMoney(net, undefined, {sign:true})}</div><div class="kpi-delta ${net>=0?'up':'down'}">${net>=0?'A favor':'En contra'}</div></div>
      </div>
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div id="filter"></div>
        <button class="btn btn-primary" id="newBtn">${icon('plus',16)} Nueva deuda</button>
      </div>
      <div id="list" class="flex flex-col gap-2"></div>
      ${settled.length ? `<div class="mt-6"><h3 class="text-sm text-muted font-semibold mb-3">Liquidadas (${settled.length})</h3><div id="settledList" class="flex flex-col gap-2"></div></div>` : ''}
    `;

    let filter = 'all';
    const seg = segmented([{value:'all',label:'Todas'},{value:'owe',label:'Yo debo'},{value:'owed',label:'Me deben'}], filter, v => { filter = v; renderList(); });
    root.querySelector('#filter').appendChild(seg);
    root.querySelector('#newBtn').onclick = () => debtForm(null, draw);

    function renderList() {
      let list = filter==='all' ? [...owe, ...owed] : (filter==='owe' ? owe : owed);
      const el = root.querySelector('#list');
      el.innerHTML = '';
      if (list.length === 0) {
        el.appendChild(emptyState({ icon:'scale', title:'Sin deudas', message:'Registra lo que debes o te deben.' }));
      } else {
        for (const d of list) el.appendChild(debtRow(d, draw));
      }
      const sEl = root.querySelector('#settledList');
      if (sEl) { sEl.innerHTML=''; for (const d of settled) sEl.appendChild(debtRow(d, draw)); }
    }
    renderList();
  }
}

function debtRow(d, onChange) {
  const t = DEBT_TYPES[d.type] || DEBT_TYPES.owe;
  const overdue = d.dueDate && d.dueDate < todayISO() && !d.settled;
  const div = document.createElement('div');
  div.className = 'list-item';
  div.innerHTML = `
    <div class="list-item-icon" style="background:${t.color}22;color:${t.color}">${icon(d.type==='owe'?'arrow-up-right':'arrow-down-left',18)}</div>
    <div class="list-item-body">
      <div class="list-item-title">${escapeHTML(d.person||'—')} ${overdue?`<span class="badge badge-danger">Vencida</span>`:''} ${d.settled?`<span class="badge badge-success">Liquidada</span>`:''}</div>
      <div class="list-item-sub">${escapeHTML(d.description||'')}${d.dueDate?` · Vence ${fmtDate(d.dueDate,{pattern:'short'})} (${relativeTime(d.dueDate)})`:''}</div>
    </div>
    <div class="flex items-center gap-2">
      <div class="font-mono font-bold ${d.type==='owe'?'amt-neg':'amt-pos'}">${fmtMoney(d.amount, d.currency)}</div>
      ${!d.settled?`<button class="icon-btn settle-btn" title="Marcar liquidada">${icon('check',15)}</button>`:''}
      <button class="icon-btn edit-btn">${icon('edit',15)}</button>
    </div>
  `;
  div.querySelector('.settle-btn')?.addEventListener('click', () => {
    db.save('debts', { ...d, settled: true, settledDate: todayISO() });
    toast('Liquidada', '', 'success');
    onChange();
  });
  div.querySelector('.edit-btn').onclick = () => debtForm(d, onChange);
  return div;
}

export function debtForm(existing, onDone) {
  const d = existing || { id:'', type:'owe', person:'', amount:'', currency:'USD', date: todayISO(), dueDate:'', description:'', settled:false, settledDate:'', createdAt:'' };
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  const typeSeg = segmented([{value:'owe',label:'Yo debo'},{value:'owed',label:'Me deben'}], d.type, v => d.type = v);
  body.appendChild(field({ label:'Tipo', input: typeSeg }));
  const personInput = input({ value:d.person, placeholder:'Nombre de la persona' });
  body.appendChild(field({ label: d.type==='owe'?'A quién debo':'Quién me debe', required:true, input: personInput }));
  const amtInput = input({ type:'number', value:d.amount, step:'0.01', min:'0', placeholder:'0.00' });
  body.appendChild(field({ label:'Monto', required:true, input: amtInput }));
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px';
  const dateInput = input({ type:'date', value:d.date });
  const dueInput = input({ type:'date', value:d.dueDate });
  row.appendChild(field({ label:'Fecha', input: dateInput }));
  row.appendChild(field({ label:'Vence (opcional)', input: dueInput }));
  body.appendChild(row);
  const descInput = textarea(d.description, { placeholder:'Concepto / nota' });
  body.appendChild(field({ label:'Descripción', input: descInput }));

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:space-between;gap:10px';
  if (existing) {
    const del = document.createElement('button'); del.className='btn btn-danger'; del.innerHTML=`${icon('trash',14)} Eliminar`;
    del.onclick = async () => { const ok = await confirm({ title:'Eliminar', message:'¿Eliminar esta deuda?', danger:true, confirmText:'Eliminar' }); if (ok) { db.remove('debts', existing.id); m.close(); toast('Eliminada','','success'); onDone?.(); } };
    footer.appendChild(del);
  }
  const right = document.createElement('div'); right.style.cssText='display:flex;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    if (!personInput.value.trim()) { toast('Nombre requerido', '', 'error'); return; }
    const amount = Number(amtInput.value);
    if (!amount || amount <= 0) { toast('Monto inválido', '', 'error'); return; }
    db.save('debts', { ...d, id: d.id||uid('deb'), person: personInput.value.trim(), amount, date: dateInput.value, dueDate: dueInput.value, description: descInput.value, createdAt: d.createdAt||nowISO() });
    m.close();
    toast(existing?'Actualizada':'Deuda creada', '', 'success');
    onDone?.();
  };
  right.appendChild(cancel); right.appendChild(save);
  footer.appendChild(right);
  const m = modal({ title: existing?'Editar deuda':'Nueva deuda', body, footer });
}
