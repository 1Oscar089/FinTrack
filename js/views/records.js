// ============================================================
// FinTrack — Vista Registros
// ============================================================
import * as db from '../db.js';
import { RECORD_TYPES, ACCOUNT_TYPES } from '../config.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, textarea, segmented, emptyState } from '../ui.js';
import { fmtMoney, fmtDate, todayISO, nowISO, uid, escapeHTML } from '../utils.js';

export function renderRecords(root) {
  root.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div class="flex gap-2 flex-wrap" id="typeFilter"></div>
      <div class="flex gap-2 flex-wrap">
        <input class="input" id="searchInput" placeholder="Buscar…" style="width:200px"/>
        <select class="select" id="acctFilter" style="width:180px"></select>
        <select class="select" id="tagFilter" style="width:160px"></select>
        <input class="input" id="monthFilter" type="month" style="width:150px"/>
      </div>
    </div>
    <div class="grid gap-4 mb-4" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))" id="quickStats"></div>
    <div id="recordsList" class="flex flex-col gap-2"></div>
  `;

  // Filtros
  const types = [
    { value: 'all', label: 'Todos' },
    { value: 'income', label: 'Ingresos' },
    { value: 'expense', label: 'Egresos' },
    { value: 'transfer', label: 'Transferencias' },
  ];
  let filterType = 'all';
  let search = '';
  let acctFilter = 'all';
  let tagFilter = 'all';
  let monthFilter = '';

  const typeSeg = segmented(types, filterType, v => { filterType = v; draw(); });
  root.querySelector('#typeFilter').appendChild(typeSeg);

  const acctSel = root.querySelector('#acctFilter');
  acctSel.innerHTML = `<option value="all">Todas las cuentas</option>` +
    db.getTable('accounts').filter(a => !a.archived).map(a => `<option value="${a.id}">${escapeHTML(a.emoji+' '+a.name)}</option>`).join('');

  // Filtro por etiqueta (con color visible)
  const tagSel = root.querySelector('#tagFilter');
  const tags = db.getTable('tags');
  tagSel.innerHTML = `<option value="all">Todas las etiquetas</option>` +
    tags.map(tg => `<option value="${tg.id}">${escapeHTML(tg.name)}</option>`).join('');

  root.querySelector('#searchInput').oninput = (e) => { search = e.target.value.toLowerCase(); draw(); };
  acctSel.onchange = (e) => { acctFilter = e.target.value; draw(); };
  tagSel.onchange = (e) => { tagFilter = e.target.value; draw(); };
  root.querySelector('#monthFilter').onchange = (e) => { monthFilter = e.target.value; draw(); };

  function draw() {
    drawStats();
    drawList();
  }

  function getFiltered() {
    let recs = db.getTable('records').slice().sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.createdAt||'').localeCompare(a.createdAt||''));
    if (filterType !== 'all') recs = recs.filter(r => r.type === filterType);
    if (acctFilter !== 'all') recs = recs.filter(r => r.accountId === acctFilter || r.toAccountId === acctFilter);
    if (tagFilter !== 'all') recs = recs.filter(r => (r.tags || []).includes(tagFilter));
    if (monthFilter) recs = recs.filter(r => (r.date||'').startsWith(monthFilter));
    if (search) recs = recs.filter(r => (r.note||'').toLowerCase().includes(search) || (getCatName(r.categoryId)||'').toLowerCase().includes(search));
    return recs;
  }

  function drawStats() {
    const recs = getFiltered();
    const inc = recs.filter(r => r.type === 'income').reduce((s,r) => s + Number(r.amount||0), 0);
    const exp = recs.filter(r => r.type === 'expense').reduce((s,r) => s + Number(r.amount||0), 0);
    const tr = recs.filter(r => r.type === 'transfer').reduce((s,r) => s + Number(r.amount||0), 0);
    const el = root.querySelector('#quickStats');
    el.innerHTML = `
      <div class="kpi"><div class="kpi-label">${icon('arrow-down-left',16)} Ingresos</div><div class="kpi-value amt-pos">${fmtMoney(inc)}</div></div>
      <div class="kpi"><div class="kpi-label">${icon('arrow-up-right',16)} Egresos</div><div class="kpi-value amt-neg">${fmtMoney(exp)}</div></div>
      <div class="kpi"><div class="kpi-label">${icon('arrow-left-right',16)} Transferencias</div><div class="kpi-value">${fmtMoney(tr)}</div></div>
      <div class="kpi"><div class="kpi-label">${icon('scale',16)} Balance neto</div><div class="kpi-value ${inc-exp>=0?'amt-pos':'amt-neg'}">${fmtMoney(inc-exp, undefined, {sign:true})}</div></div>
    `;
  }

  function drawList() {
    const recs = getFiltered();
    const wrap = root.querySelector('#recordsList');
    if (recs.length === 0) {
      wrap.innerHTML = '';
      wrap.appendChild(emptyState({
        icon: 'receipt', title: 'Sin registros', message: 'Crea tu primer registro con el botón + abajo a la derecha.',
        action: (() => { const b = document.createElement('button'); b.className='btn btn-primary'; b.innerHTML=`${icon('plus',16)} Nuevo registro`; b.onclick=()=>renderRecordForm(null, draw); return b; })(),
      }));
      return;
    }
    wrap.innerHTML = '';
    // Agrupar por fecha
    const groups = {};
    for (const r of recs) {
      const k = r.date || 'Sin fecha';
      (groups[k] = groups[k] || []).push(r);
    }
    const sortedDates = Object.keys(groups).sort((a,b) => b.localeCompare(a));
    for (const date of sortedDates) {
      const h = document.createElement('div');
      h.className = 'text-sm text-muted font-semibold mt-4 mb-2';
      h.textContent = fmtDate(date, { pattern: 'long' });
      wrap.appendChild(h);
      for (const r of groups[date]) {
        wrap.appendChild(recordRow(r, draw));
      }
    }
  }

  draw();
}

function recordRow(r, onChange) {
  const accounts = db.getTable('accounts');
  const cats = db.getTable('categories');
  const tags = db.getTable('tags');
  const acc = accounts.find(a => a.id === r.accountId);
  const toAcc = accounts.find(a => a.id === r.toAccountId);
  const cat = cats.find(c => c.id === r.categoryId);
  const t = RECORD_TYPES[r.type] || RECORD_TYPES.expense;
  const amountClass = r.type === 'income' ? 'amt-pos' : r.type === 'expense' ? 'amt-neg' : 'amt-neutral';
  const sign = r.type === 'income' ? '+' : r.type === 'expense' ? '-' : '';
  // Chips de etiquetas con color real de cada etiqueta (fondo translúcido + borde + texto)
  const tagChips = (r.tags||[])
    .map(id => tags.find(x => x.id === id))
    .filter(Boolean)
    .map(tg => `<span class="chip" style="background:${tg.color}22;border-color:${tg.color}55;color:${tg.color}"><span class="tag-dot" style="background:${tg.color}"></span>${escapeHTML(tg.name)}</span>`)
    .join('');

  const div = document.createElement('div');
  div.className = 'list-item';
  div.innerHTML = `
    <div class="list-item-icon" style="background:${t.color}22;color:${t.color}">${icon(t.icon,18)}</div>
    <div class="list-item-body">
      <div class="list-item-title">${escapeHTML(r.note || cat?.name || t.label)} ${cat?`<span class="text-dim text-xs">· ${escapeHTML(cat.emoji+' '+cat.name)}</span>`:''}</div>
      <div class="list-item-sub">${escapeHTML(acc ? acc.emoji+' '+acc.name : '—')}${r.type==='transfer'&&toAcc?` → ${escapeHTML(toAcc.emoji+' '+toAcc.name)}`:''} · ${fmtDate(r.date,{pattern:'short'})}</div>
      ${tagChips?`<div class="flex gap-1 mt-2 flex-wrap">${tagChips}</div>`:''}
    </div>
    <div class="flex items-center gap-3">
      <div class="font-mono font-bold ${amountClass}">${sign}${fmtMoney(r.amount)}</div>
      <div class="list-item-actions">
        <button class="icon-btn edit-btn" title="Editar">${icon('edit',15)}</button>
        <button class="icon-btn del-btn" title="Eliminar">${icon('trash',15)}</button>
      </div>
    </div>
  `;
  div.querySelector('.edit-btn').onclick = () => renderRecordForm(r, onChange);
  div.querySelector('.del-btn').onclick = async () => {
    const ok = await confirm({ title: 'Eliminar registro', message: '¿Eliminar este registro? Los saldos de las cuentas se ajustarán.', danger: true, confirmText: 'Eliminar' });
    if (!ok) return;
    // Revertir efecto en cuentas
    revertRecord(r);
    db.remove('records', r.id);
    toast('Eliminado', 'Registro eliminado.', 'success');
    onChange();
  };
  return div;
}

// Revierte el efecto de un registro en los saldos
function revertRecord(r) {
  const accounts = db.getTable('accounts');
  const sign = r.type === 'income' ? -1 : r.type === 'expense' ? 1 : 0;
  if (r.type === 'transfer') {
    // No modificar tarjetas (su deuda se calcula con cardTotalDebt)
    if (r.accountId) { const a = accounts.find(x=>x.id===r.accountId); if (a && a.type !== 'card') { a.balance = Number(a.balance) + Number(r.amount); db.save('accounts', a); } }
    if (r.toAccountId) { const b = accounts.find(x=>x.id===r.toAccountId); if (b && b.type !== 'card') { b.balance = Number(b.balance) - Number(r.amount); db.save('accounts', b); } }
  } else if (r.accountId && sign !== 0) {
    const a = accounts.find(x=>x.id===r.accountId);
    if (a && a.type !== 'card') { a.balance = Number(a.balance) + sign * Number(r.amount); db.save('accounts', a); }
  }
}

function getCatName(id) {
  const c = db.getTable('categories').find(x => x.id === id);
  return c ? c.name : '';
}

// ---------- Formulario de registro (reutilizable) ----------
export function renderRecordForm(existing, onDone) {
  const accounts = db.getTable('accounts').filter(a => !a.archived);
  const categories = db.getTable('categories');
  const tags = db.getTable('tags');

  // Snapshot del registro original para revertir correctamente al editar
  const original = existing ? JSON.parse(JSON.stringify(existing)) : null;

  const r = existing || {
    id: '', type: 'expense', amount: '', currency: 'USD', date: todayISO(),
    accountId: accounts[0]?.id || '', toAccountId: '', categoryId: '',
    tags: [], note: '', linkedCardId: '', scheduledId: '', createdAt: '',
  };

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';

  // Tipo
  const typeSeg = segmented(
    Object.entries(RECORD_TYPES).map(([k,v]) => ({ value: k, label: v.label })),
    r.type,
    (v) => { r.type = v; updateFields(); }
  );
  body.appendChild(field({ label: 'Tipo de registro', input: typeSeg }));

  // Monto
  const amountInput = input({ type: 'number', value: r.amount, placeholder: '0.00', step: '0.01', min: '0' });
  body.appendChild(field({ label: 'Monto', required: true, input: amountInput }));

  // Fecha
  const dateInput = input({ type: 'date', value: r.date });
  body.appendChild(field({ label: 'Fecha', input: dateInput }));

  // Campos dinámicos (cuenta, cuenta destino, categoría)
  const dyn = document.createElement('div');
  dyn.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  body.appendChild(dyn);

  // Nota
  const noteInput = textarea(r.note, { placeholder: 'Nota (opcional)' });
  body.appendChild(field({ label: 'Nota', input: noteInput }));

  // Etiquetas (opcionales, con colores)
  const tagsWrap = document.createElement('div');
  tagsWrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center';
  if (tags.length === 0) {
    tagsWrap.innerHTML = `<span class="text-sm text-dim">No hay etiquetas. Créalas en Categorías y etiquetas.</span>`;
  }
  for (const tg of tags) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    const active = (r.tags || []).includes(tg.id);
    if (active) {
      chip.style.background = tg.color + '22';
      chip.style.borderColor = tg.color;
      chip.style.color = tg.color;
    }
    chip.innerHTML = `<span class="tag-dot" style="background:${tg.color}"></span>${escapeHTML(tg.name)}`;
    chip.onclick = () => {
      r.tags = r.tags || [];
      const i = r.tags.indexOf(tg.id);
      if (i >= 0) r.tags.splice(i, 1);
      else r.tags.push(tg.id);
      const on = r.tags.includes(tg.id);
      chip.style.background = on ? tg.color + '22' : '';
      chip.style.borderColor = on ? tg.color : '';
      chip.style.color = on ? tg.color : '';
      chip.style.transform = on ? 'scale(1.04)' : 'scale(1)';
    };
    tagsWrap.appendChild(chip);
  }
  body.appendChild(field({ label: 'Etiquetas', hint: 'Opcional · toca para asignar/quitar', input: tagsWrap }));

  function updateFields() {
    dyn.innerHTML = '';
    const accountOpts = [{ value: '', label: '— Selecciona —' }, ...accounts.map(a => ({ value: a.id, label: `${a.emoji} ${a.name}` }))];
    if (r.type === 'transfer') {
      const fromSel = select(accountOpts, r.accountId);
      const toOpts = [{ value: '', label: '— Fuera del tracker —' }, ...accounts.map(a => ({ value: a.id, label: `${a.emoji} ${a.name}` }))];
      const toSel = select(toOpts, r.toAccountId);
      fromSel.onchange = () => r.accountId = fromSel.value;
      toSel.onchange = () => r.toAccountId = toSel.value;
      dyn.appendChild(field({ label: 'Cuenta origen', required: true, input: fromSel }));
      dyn.appendChild(field({ label: 'Cuenta destino', hint: 'Vacío = fuera del tracker', input: toSel }));
    } else {
      const accSel = select(accountOpts, r.accountId);
      accSel.onchange = () => r.accountId = accSel.value;
      const catOpts = [{ value: '', label: '— Sin categoría —' }, ...categories.filter(c => c.type === r.type).map(c => ({ value: c.id, label: `${c.emoji} ${c.name}` }))];
      const catSel = select(catOpts, r.categoryId);
      catSel.onchange = () => r.categoryId = catSel.value;
      dyn.appendChild(field({ label: 'Cuenta', required: true, input: accSel }));
      dyn.appendChild(field({ label: 'Categoría', input: catSel }));
      // Si la cuenta es tarjeta y es egreso, marcar linkedCardId
      const acc = accounts.find(a => a.id === r.accountId);
      if (acc && acc.type === 'card' && r.type === 'expense') {
        r.linkedCardId = acc.id;
      } else {
        r.linkedCardId = '';
      }
    }
  }
  updateFields();

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:space-between;gap:10px';
  const leftBtns = document.createElement('div');
  if (existing) {
    const del = document.createElement('button');
    del.className = 'btn btn-danger';
    del.innerHTML = `${icon('trash',14)} Eliminar`;
    del.onclick = async () => {
      const ok = await confirm({ title: 'Eliminar', message: '¿Eliminar este registro?', danger: true, confirmText: 'Eliminar' });
      if (ok) { revertRecord(existing); db.remove('records', existing.id); m.close(); toast('Eliminado','','success'); onDone?.(); }
    };
    leftBtns.appendChild(del);
  }
  const rightBtns = document.createElement('div');
  rightBtns.style.cssText = 'display:flex;gap:10px';
  const cancel = document.createElement('button');
  cancel.className = 'btn'; cancel.textContent = 'Cancelar';
  const save = document.createElement('button');
  save.className = 'btn btn-primary'; save.innerHTML = `${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    const amount = Number(amountInput.value);
    if (!amount || amount <= 0) { toast('Monto inválido', 'Ingresa un monto mayor a 0.', 'error'); return; }
    if (!r.accountId) { toast('Cuenta requerida', 'Selecciona una cuenta.', 'error'); return; }
    const rec = {
      ...r,
      id: r.id || uid('rec'),
      amount,
      date: dateInput.value,
      note: noteInput.value,
      createdAt: r.createdAt || nowISO(),
    };
    if (original) {
      // Revertir el efecto del registro ORIGINAL (no del mutado) antes de aplicar el nuevo
      revertRecord(original);
    }
    db.save('records', rec);
    db.applyRecordToAccounts(rec);
    m.close();
    toast(existing ? 'Actualizado' : 'Registro creado', '', 'success');
    onDone?.();
  };
  rightBtns.appendChild(cancel);
  rightBtns.appendChild(save);
  footer.appendChild(leftBtns);
  footer.appendChild(rightBtns);

  const m = modal({
    title: existing ? 'Editar registro' : 'Nuevo registro',
    body,
    footer,
  });
  return m;
}