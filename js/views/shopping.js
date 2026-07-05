// ============================================================
// FinTrack — Vista Lista de Compras
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, segmented, emptyState } from '../ui.js';
import { fmtMoney, uid, nowISO, todayISO, escapeHTML } from '../utils.js';

export function renderShopping(root) {
  draw();

  function draw() {
    const items = db.getTable('shopping');
    const pending = items.filter(i => !i.purchased);
    const done = items.filter(i => i.purchased);
    const totalPending = pending.reduce((s,i) => s + Number(i.qty||1)*Number(i.price||0), 0);
    const totalDone = done.reduce((s,i) => s + Number(i.qty||1)*Number(i.price||0), 0);

    root.innerHTML = `
      <div class="kpi-grid mb-4">
        <div class="kpi"><div class="kpi-label">${icon('cart',16)} Pendientes</div><div class="kpi-value">${pending.length}</div><div class="kpi-delta">Estimado ${fmtMoney(totalPending)}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('check',16)} Comprados</div><div class="kpi-value">${done.length}</div><div class="kpi-delta">Gastado ${fmtMoney(totalDone)}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('bar-chart',16)} Total lista</div><div class="kpi-value">${fmtMoney(totalPending+totalDone)}</div></div>
      </div>
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div id="filter"></div>
        <div class="flex gap-2">
          ${done.length?`<button class="btn btn-sm" id="clearDone">${icon('trash',14)} Limpiar comprados</button>`:''}
          ${done.length?`<button class="btn btn-sm btn-primary" id="checkoutBtn">${icon('banknote',14)} Registrar compra</button>`:''}
          <button class="btn btn-primary" id="newBtn">${icon('plus',16)} Nuevo ítem</button>
        </div>
      </div>
      <div id="list" class="flex flex-col gap-2"></div>
    `;

    let filter = 'pending';
    const seg = segmented([{value:'pending',label:'Pendientes'},{value:'done',label:'Comprados'},{value:'all',label:'Todos'}], filter, v => { filter=v; renderList(); });
    root.querySelector('#filter').appendChild(seg);
    root.querySelector('#newBtn').onclick = () => itemForm(null, draw);
    root.querySelector('#clearDone')?.addEventListener('click', async () => {
      const ok = await confirm({ title:'Limpiar comprados', message:'¿Eliminar los ítems ya comprados?', confirmText:'Limpiar' });
      if (ok) { for (const i of done) db.remove('shopping', i.id); toast('Limpio', '', 'success'); draw(); }
    });
    root.querySelector('#checkoutBtn')?.addEventListener('click', () => checkout(done, draw));

    function renderList() {
      let list = filter==='pending' ? pending : filter==='done' ? done : items;
      list = list.slice().sort((a,b) => (a.purchased?1:0)-(b.purchased?1:0) || (a.priority||9)-(b.priority||9) || a.name.localeCompare(b.name));
      const el = root.querySelector('#list');
      el.innerHTML = '';
      if (list.length === 0) {
        el.appendChild(emptyState({ icon:'cart', title:'Lista vacía', message:'Agrega ítems a tu lista de compras.' }));
        return;
      }
      for (const i of list) el.appendChild(itemRow(i, draw));
    }
    renderList();
  }
}

function itemRow(i, onChange) {
  const cats = db.getTable('categories');
  const cat = cats.find(c => c.id === i.categoryId);
  const subtotal = Number(i.qty||1) * Number(i.price||0);
  const prioColors = { 1: '#ef4444', 2: '#f59e0b', 3: '#10b981' };
  const prioLabels = { 1: 'Alta', 2: 'Media', 3: 'Baja' };
  const div = document.createElement('div');
  div.className = 'list-item';
  div.style.opacity = i.purchased ? '0.6' : '1';
  div.innerHTML = `
    <input type="checkbox" class="check" ${i.purchased?'checked':''} style="width:20px;height:20px;accent-color:var(--primary);cursor:pointer;flex-shrink:0"/>
    <div class="list-item-icon" style="background:${prioColors[i.priority||3]}22;color:${prioColors[i.priority||3]}">${icon('package',16)}</div>
    <div class="list-item-body">
      <div class="list-item-title" style="${i.purchased?'text-decoration:line-through;opacity:.7':''}">${escapeHTML(i.name)} <span class="text-dim text-xs">· ${i.qty||1} ${escapeHTML(i.unit||'')}</span></div>
      <div class="list-item-sub">${cat?`${cat.emoji} ${escapeHTML(cat.name)}`:''} · Prioridad ${prioLabels[i.priority||3]}${i.note?` · ${escapeHTML(i.note)}`:''}</div>
    </div>
    <div class="font-mono font-bold" style="font-size:13px">${fmtMoney(subtotal)}</div>
    <button class="icon-btn edit-btn">${icon('edit',15)}</button>
  `;
  div.querySelector('.check').onchange = (e) => {
    db.save('shopping', { ...i, purchased: e.target.checked });
    onChange();
  };
  div.querySelector('.edit-btn').onclick = () => itemForm(i, onChange);
  return div;
}

export function itemForm(existing, onDone) {
  const accounts = db.getTable('accounts').filter(a => !a.archived);
  const cats = db.getTable('categories').filter(c => c.type === 'expense');
  const i = existing || { id:'', name:'', qty:1, unit:'unidad', price:0, accountId: accounts[0]?.id||'', categoryId: cats[0]?.id||'', purchased:false, priority:2, note:'', createdAt:'' };
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  const nameInput = input({ value:i.name, placeholder:'Ej: Café' });
  body.appendChild(field({ label:'Producto', required:true, input: nameInput }));
  const row = document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px';
  const qtyInput = input({ type:'number', value:i.qty, min:'0', step:'0.01' });
  const unitInput = input({ value:i.unit, placeholder:'unidad' });
  const priceInput = input({ type:'number', value:i.price, min:'0', step:'0.01' });
  row.appendChild(field({ label:'Cantidad', input: qtyInput }));
  row.appendChild(field({ label:'Unidad', input: unitInput }));
  row.appendChild(field({ label:'Precio unit.', input: priceInput }));
  body.appendChild(row);
  const acctSel = select(accounts.map(a=>({value:a.id,label:`${a.emoji} ${a.name}`})), i.accountId);
  body.appendChild(field({ label:'Cuenta', input: acctSel }));
  const catSel = select(cats.map(c=>({value:c.id,label:`${c.emoji} ${c.name}`})), i.categoryId);
  body.appendChild(field({ label:'Categoría', input: catSel }));
  const prioSel = select([{value:1,label:'Alta'},{value:2,label:'Media'},{value:3,label:'Baja'}], i.priority||2);
  body.appendChild(field({ label:'Prioridad', input: prioSel }));
  const noteInput = input({ value:i.note, placeholder:'Nota (opcional)' });
  body.appendChild(field({ label:'Nota', input: noteInput }));

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:space-between;gap:10px';
  if (existing) {
    const del = document.createElement('button'); del.className='btn btn-danger'; del.innerHTML=`${icon('trash',14)} Eliminar`;
    del.onclick = async () => { const ok = await confirm({ title:'Eliminar', message:'¿Eliminar este ítem?', danger:true, confirmText:'Eliminar' }); if (ok) { db.remove('shopping', existing.id); m.close(); toast('Eliminado','','success'); onDone?.(); } };
    footer.appendChild(del);
  }
  const right = document.createElement('div'); right.style.cssText='display:flex;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    if (!nameInput.value.trim()) { toast('Nombre requerido', '', 'error'); return; }
    db.save('shopping', { ...i, id: i.id||uid('sho'), name: nameInput.value.trim(), qty: Number(qtyInput.value)||1, unit: unitInput.value, price: Number(priceInput.value)||0, accountId: acctSel.value, categoryId: catSel.value, priority: Number(prioSel.value), note: noteInput.value, createdAt: i.createdAt||nowISO() });
    m.close();
    toast(existing?'Actualizado':'Ítem agregado', '', 'success');
    onDone?.();
  };
  right.appendChild(cancel); right.appendChild(save);
  footer.appendChild(right);
  const m = modal({ title: existing?'Editar ítem':'Nuevo ítem', body, footer });
}

// Registrar compra: crea un registro de egreso por cada ítem comprado
function checkout(items, onChange) {
  const valid = items.filter(i => Number(i.price) > 0);
  if (valid.length === 0) { toast('Sin ítems', 'No hay ítems con precio para registrar.', 'info'); return; }
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:10px';
  body.innerHTML = `<p class="text-sm text-muted">Se crearán ${valid.length} registro(s) de egreso con la fecha de hoy. Total: <strong>${fmtMoney(valid.reduce((s,i)=>s+Number(i.qty||1)*Number(i.price||0),0))}</strong></p>`;
  for (const i of valid) {
    body.insertAdjacentHTML('beforeend', `<div class="list-item"><div class="list-item-body"><div class="list-item-title">${escapeHTML(i.name)}</div><div class="list-item-sub">${i.qty} × ${fmtMoney(i.price)}</div></div><div class="font-mono font-bold">${fmtMoney(Number(i.qty||1)*Number(i.price||0))}</div></div>`);
  }
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const confirmBtn = document.createElement('button'); confirmBtn.className='btn btn-primary'; confirmBtn.innerHTML=`${icon('check',16)} Registrar`;
  cancel.onclick = () => m.close();
  confirmBtn.onclick = () => {
    for (const i of valid) {
      const rec = { id: uid('rec'), type:'expense', amount: Number(i.qty||1)*Number(i.price||0), currency:'USD', date: todayISO(), accountId: i.accountId, toAccountId:'', categoryId: i.categoryId, tags:['tag-ess'], note: `Compra: ${i.name}`, linkedCardId:'', scheduledId:'', createdAt: nowISO() };
      db.save('records', rec);
      db.applyRecordToAccounts(rec);
    }
    // Limpiar comprados
    for (const i of items) db.remove('shopping', i.id);
    m.close();
    toast('Compra registrada', `${valid.length} registro(s) creado(s).`, 'success');
    onChange();
  };
  footer.appendChild(cancel); footer.appendChild(confirmBtn);
  const m = modal({ title:'Registrar compra', size:'sm', body, footer });
}
