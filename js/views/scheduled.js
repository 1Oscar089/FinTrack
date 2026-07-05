// ============================================================
// FinTrack — Vista Pagos Programados
// ============================================================
import * as db from '../db.js';
import { RECORD_TYPES, FREQUENCIES } from '../config.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, textarea, segmented, emptyState } from '../ui.js';
import { fmtMoney, fmtDate, relativeTime, todayISO, uid, nowISO, escapeHTML } from '../utils.js';

export function renderScheduled(root) {
  draw();

  function draw() {
    const items = db.getTable('scheduled').sort((a,b) => (a.nextDate||'').localeCompare(b.nextDate||''));
    const active = items.filter(s => s.active);
    const inactive = items.filter(s => !s.active);

    root.innerHTML = `
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div class="segmented" id="filter"></div>
        <button class="btn btn-primary" id="newBtn">${icon('plus',16)} Nuevo pago programado</button>
      </div>
      <div id="list" class="flex flex-col gap-2"></div>
      ${inactive.length ? `<div class="mt-6"><h3 class="text-sm text-muted font-semibold mb-3">Inactivos (${inactive.length})</h3><div id="inactList" class="flex flex-col gap-2"></div></div>` : ''}
    `;

    let filter = 'all';
    const seg = segmented(
      [{value:'all',label:'Todos'},{value:'active',label:'Activos'},{value:'inactive',label:'Inactivos'}],
      filter, v => { filter = v; renderList(); }
    );
    root.querySelector('#filter').appendChild(seg);
    root.querySelector('#newBtn').onclick = () => scheduledForm(null, draw);

    function renderList() {
      let list = filter==='active' ? active : filter==='inactive' ? inactive : items;
      const el = root.querySelector('#list');
      el.innerHTML = '';
      if (list.length === 0) {
        el.appendChild(emptyState({
          icon:'repeat', title:'Sin pagos programados', message:'Crea pagos recurrentes como renta, salario, suscripciones, etc.',
          action: (()=>{const b=document.createElement('button');b.className='btn btn-primary';b.innerHTML=`${icon('plus',16)} Nuevo pago`;b.onclick=()=>scheduledForm(null,draw);return b;})(),
        }));
      } else {
        for (const s of list) el.appendChild(row(s, draw));
      }
      const inactEl = root.querySelector('#inactList');
      if (inactEl) {
        inactEl.innerHTML = '';
        for (const s of inactive) inactEl.appendChild(row(s, draw));
      }
    }
    renderList();
  }
}

function row(s, onChange) {
  const t = RECORD_TYPES[s.type] || RECORD_TYPES.expense;
  const freq = FREQUENCIES[s.frequency] || FREQUENCIES.once;
  const sign = s.type === 'income' ? '+' : s.type === 'expense' ? '-' : '';
  const overdue = s.nextDate && s.nextDate < todayISO();
  const div = document.createElement('div');
  div.className = 'list-item';
  div.innerHTML = `
    <div class="list-item-icon" style="background:${t.color}22;color:${t.color}">${icon(s.auto?'play':'clock',18)}</div>
    <div class="list-item-body">
      <div class="list-item-title">${escapeHTML(s.name)} ${s.auto?`<span class="badge badge-info ml-1">Auto</span>`:''} ${!s.active?`<span class="badge badge-neutral">Inactivo</span>`:''}</div>
      <div class="list-item-sub">${freq.label} · ${s.nextDate?`Próx: ${fmtDate(s.nextDate,{pattern:'short'})} (${relativeTime(s.nextDate)})`:'Sin próx. fecha'}${overdue&&s.active?` · <span style="color:var(--danger)">Vencido</span>`:''}</div>
    </div>
    <div class="flex items-center gap-2">
      <div class="font-mono font-bold ${s.type==='income'?'amt-pos':s.type==='expense'?'amt-neg':''}">${sign}${fmtMoney(s.amount)}</div>
      <button class="icon-btn run-btn" title="Ejecutar ahora">${icon('play',15)}</button>
      <button class="icon-btn hist-btn" title="Historial">${icon('history',15)}</button>
      <button class="icon-btn edit-btn" title="Editar">${icon('edit',15)}</button>
    </div>
  `;
  div.querySelector('.run-btn').onclick = () => executeNow(s, onChange);
  div.querySelector('.hist-btn').onclick = () => showHistory(s);
  div.querySelector('.edit-btn').onclick = () => scheduledForm(s, onChange);
  return div;
}

// ---------- Ejecutar manualmente ----------
function executeNow(s, onChange) {
  const rec = {
    id: uid('rec'),
    type: s.type,
    amount: Number(s.amount) || 0,
    currency: s.currency || 'USD',
    date: todayISO(),
    accountId: s.accountId || '',
    toAccountId: s.toAccountId || '',
    categoryId: s.categoryId || '',
    tags: s.tags || [],
    note: `${s.name} (manual)`,
    linkedCardId: s.linkedCardId || '',
    scheduledId: s.id,
    createdAt: nowISO(),
  };
  db.save('records', rec);
  db.applyRecordToAccounts(rec);
  db.save('scheduledHistory', { id: uid('hist'), scheduledId: s.id, recordId: rec.id, date: todayISO(), amount: rec.amount, status: 'manual' });
  // Avanzar fecha
  if (s.frequency !== 'once') {
    s.nextDate = advanceDate(s.nextDate, s.frequency);
    if (s.endDate && s.nextDate > s.endDate) s.active = false;
  } else {
    s.active = false;
  }
  db.save('scheduled', s);
  toast('Ejecutado', `${s.name} registrado.`, 'success');
  onChange();
}

function advanceDate(dateISO, freq) {
  if (!dateISO) return todayISO();
  const d = new Date(dateISO + 'T00:00:00');
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'biweekly') d.setDate(d.getDate() + 15);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------- Historial ----------
function showHistory(s) {
  const hist = db.getTable('scheduledHistory').filter(h => h.scheduledId === s.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:8px';
  if (hist.length === 0) {
    body.appendChild(emptyState({ icon:'history', title:'Sin historial', message:'Aún no se ha ejecutado este pago.' }));
  } else {
    for (const h of hist) {
      body.insertAdjacentHTML('beforeend', `
        <div class="list-item">
          <div class="list-item-icon" style="background:var(--primary-soft);color:var(--primary)">${icon('check',16)}</div>
          <div class="list-item-body">
            <div class="list-item-title">${fmtMoney(h.amount)}</div>
            <div class="list-item-sub">${fmtDate(h.date,{pattern:'long'})} · ${h.status==='auto'?'Automático':'Manual'}</div>
          </div>
        </div>
      `);
    }
  }
  modal({ title: `Historial · ${s.name}`, size: 'sm', body });
}

// ---------- Formulario ----------
export function scheduledForm(existing, onDone) {
  const accounts = db.getTable('accounts').filter(a => !a.archived);
  const categories = db.getTable('categories');
  const tags = db.getTable('tags');

  const s = existing || {
    id: '', name: '', type: 'expense', amount: '', currency: 'USD',
    frequency: 'monthly', nextDate: todayISO(), endDate: '',
    accountId: accounts[0]?.id || '', toAccountId: '', categoryId: '',
    tags: [], note: '', auto: false, active: true, createdAt: '',
  };

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';

  const nameInput = input({ value: s.name, placeholder: 'Ej: Renta mensual' });
  body.appendChild(field({ label: 'Nombre', required: true, input: nameInput }));

  const typeSeg = segmented(
    Object.entries(RECORD_TYPES).map(([k,v])=>({value:k,label:v.label})),
    s.type, v => { s.type = v; updateFields(); }
  );
  body.appendChild(field({ label: 'Tipo', input: typeSeg }));

  const amountInput = input({ type:'number', value: s.amount, step:'0.01', min:'0', placeholder:'0.00' });
  body.appendChild(field({ label: 'Monto', required: true, input: amountInput }));

  const freqSel = select(Object.entries(FREQUENCIES).map(([k,v])=>({value:k,label:v.label})), s.frequency);
  body.appendChild(field({ label: 'Frecuencia', input: freqSel }));

  const nextInput = input({ type:'date', value: s.nextDate });
  body.appendChild(field({ label: 'Próxima fecha', input: nextInput }));

  const endInput = input({ type:'date', value: s.endDate });
  body.appendChild(field({ label: 'Fecha fin (opcional)', hint: 'Se desactiva al llegar a esta fecha', input: endInput }));

  const dyn = document.createElement('div');
  dyn.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  body.appendChild(dyn);

  const noteInput = textarea(s.note, { placeholder:'Nota (opcional)' });
  body.appendChild(field({ label: 'Nota', input: noteInput }));

  // Auto
  const autoWrap = document.createElement('div');
  autoWrap.className = 'flex items-center gap-3';
  autoWrap.innerHTML = `
    <label class="flex items-center gap-2" style="cursor:pointer">
      <input type="checkbox" id="autoChk" ${s.auto?'checked':''} style="width:18px;height:18px;accent-color:var(--primary)"/>
      <span class="text-sm">Ejecución automática</span>
    </label>
  `;
  body.appendChild(autoWrap);
  body.appendChild(field({ label:'Estado', input: (()=>{ const act = document.createElement('label'); act.className='flex items-center gap-2'; act.style.cursor='pointer'; act.innerHTML=`<input type="checkbox" id="activeChk" ${s.active?'checked':''} style="width:18px;height:18px;accent-color:var(--primary)"/><span class="text-sm">Activo</span>`; return act; })() }));

  function updateFields() {
    dyn.innerHTML = '';
    const accountOpts = [{value:'',label:'— Selecciona —'}, ...accounts.map(a=>({value:a.id,label:`${a.emoji} ${a.name}`}))];
    if (s.type === 'transfer') {
      const from = select(accountOpts, s.accountId);
      const toOpts = [{value:'',label:'— Fuera del tracker —'}, ...accounts.map(a=>({value:a.id,label:`${a.emoji} ${a.name}`}))];
      const to = select(toOpts, s.toAccountId);
      from.onchange = () => s.accountId = from.value;
      to.onchange = () => s.toAccountId = to.value;
      dyn.appendChild(field({ label:'Cuenta origen', required:true, input: from }));
      dyn.appendChild(field({ label:'Cuenta destino', input: to }));
    } else {
      const acc = select(accountOpts, s.accountId);
      const catOpts = [{value:'',label:'— Sin categoría —'}, ...categories.filter(c=>c.type===s.type).map(c=>({value:c.id,label:`${c.emoji} ${c.name}`}))];
      const cat = select(catOpts, s.categoryId);
      acc.onchange = () => s.accountId = acc.value;
      cat.onchange = () => s.categoryId = cat.value;
      dyn.appendChild(field({ label:'Cuenta', required:true, input: acc }));
      dyn.appendChild(field({ label:'Categoría', input: cat }));
    }
  }
  updateFields();

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:space-between;gap:10px';
  if (existing) {
    const del = document.createElement('button');
    del.className = 'btn btn-danger'; del.innerHTML = `${icon('trash',14)} Eliminar`;
    del.onclick = async () => {
      const ok = await confirm({ title:'Eliminar', message:'¿Eliminar este pago programado?', danger:true, confirmText:'Eliminar' });
      if (ok) { db.remove('scheduled', existing.id); m.close(); toast('Eliminado','','success'); onDone?.(); }
    };
    footer.appendChild(del);
  }
  const right = document.createElement('div');
  right.style.cssText = 'display:flex;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    if (!nameInput.value.trim()) { toast('Nombre requerido', '', 'error'); return; }
    const amount = Number(amountInput.value);
    if (!amount || amount <= 0) { toast('Monto inválido', '', 'error'); return; }
    if (!nextInput.value) { toast('Fecha requerida', '', 'error'); return; }
    const rec = {
      ...s,
      id: s.id || uid('sch'),
      name: nameInput.value.trim(),
      amount,
      frequency: freqSel.value,
      nextDate: nextInput.value,
      endDate: endInput.value,
      note: noteInput.value,
      auto: body.querySelector('#autoChk').checked,
      active: body.querySelector('#activeChk').checked,
      createdAt: s.createdAt || nowISO(),
    };
    db.save('scheduled', rec);
    m.close();
    toast(existing?'Actualizado':'Pago programado creado', '', 'success');
    onDone?.();
  };
  right.appendChild(cancel);
  right.appendChild(save);
  footer.appendChild(right);

  const m = modal({ title: existing?'Editar pago programado':'Nuevo pago programado', size:'lg', body, footer });
}
