// ============================================================
// FinTrack — Vista Garantías
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, textarea, emptyState } from '../ui.js';
import { fmtDate, relativeTime, uid, nowISO, todayISO, escapeHTML } from '../utils.js';

export function renderWarranties(root) {
  draw();

  function draw() {
    const items = db.getTable('warranties').sort((a,b) => (a.expiryDate||'').localeCompare(b.expiryDate||''));
    const now = new Date();
    const active = items.filter(w => !w.expiryDate || new Date(w.expiryDate) >= now);
    const expired = items.filter(w => w.expiryDate && new Date(w.expiryDate) < now);
    const expiringSoon = active.filter(w => {
      if (!w.expiryDate) return false;
      const days = Math.ceil((new Date(w.expiryDate) - now) / 86400000);
      return days <= 30;
    });

    root.innerHTML = `
      <div class="kpi-grid mb-4">
        <div class="kpi"><div class="kpi-label">${icon('shield',16)} Vigentes</div><div class="kpi-value amt-pos">${active.length}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('alert',16)} Por vencer (30d)</div><div class="kpi-value" style="color:var(--warning)">${expiringSoon.length}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('x',16)} Vencidas</div><div class="kpi-value amt-neg">${expired.length}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('package',16)} Total</div><div class="kpi-value">${items.length}</div></div>
      </div>
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-muted">Garantías de productos y servicios.</p>
        <button class="btn btn-primary" id="newBtn">${icon('plus',16)} Nueva garantía</button>
      </div>
      <div id="grid" class="grid grid-cols-3 gap-4"></div>
    `;
    root.querySelector('#newBtn').onclick = () => warrForm(null, draw);
    const grid = root.querySelector('#grid');
    if (items.length === 0) {
      grid.appendChild(emptyState({ icon:'shield', title:'Sin garantías', message:'Registra garantías de tus productos.', action: (()=>{const b=document.createElement('button');b.className='btn btn-primary';b.innerHTML=`${icon('plus',16)} Nueva garantía`;b.onclick=()=>warrForm(null,draw);return b;})() }));
    } else {
      for (const w of items) grid.appendChild(card(w, draw));
    }
  }
}

function card(w, onChange) {
  const now = new Date();
  const expired = w.expiryDate && new Date(w.expiryDate) < now;
  const days = w.expiryDate ? Math.ceil((new Date(w.expiryDate) - now) / 86400000) : null;
  const expiring = days !== null && days >= 0 && days <= 30;
  const cls = expired ? 'badge-danger' : expiring ? 'badge-warning' : 'badge-success';
  const label = expired ? 'Vencida' : days===null ? 'Sin vencimiento' : days===0 ? 'Vence hoy' : `Vence en ${days}d`;

  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <div class="list-item-icon" style="background:var(--primary-soft);color:var(--primary);width:40px;height:40px">${icon('package',18)}</div>
      <span class="badge ${cls} badge-dot">${label}</span>
    </div>
    <div class="font-bold text-lg mb-1">${escapeHTML(w.product)}</div>
    <div class="text-xs text-dim mb-3">${escapeHTML(w.brand||'')} ${w.serial?`· S/N ${escapeHTML(w.serial)}`:''}</div>
    <div class="stat-row"><span class="stat-row-label">Comprado</span><span class="stat-row-value">${fmtDate(w.purchaseDate,{pattern:'short'})}</span></div>
    <div class="stat-row"><span class="stat-row-label">Vence</span><span class="stat-row-value">${w.expiryDate?fmtDate(w.expiryDate,{pattern:'short'}):'—'}</span></div>
    ${w.store?`<div class="stat-row"><span class="stat-row-label">Tienda</span><span class="stat-row-value">${escapeHTML(w.store)}</span></div>`:''}
    ${w.note?`<div class="text-xs text-muted mt-2" style="line-height:1.5">${escapeHTML(w.note)}</div>`:''}
    ${w.fileUrl?`<a href="${escapeHTML(w.fileUrl)}" target="_blank" rel="noopener" class="btn btn-sm mt-3" style="width:100%">${icon('external',14)} Ver factura/doc</a>`:''}
    <div class="flex gap-2 mt-3">
      <button class="btn btn-sm flex-1 edit-btn">${icon('edit',14)} Editar</button>
    </div>
  `;
  div.querySelector('.edit-btn').onclick = () => warrForm(w, onChange);
  return div;
}

export function warrForm(existing, onDone) {
  const w = existing || { id:'', product:'', brand:'', serial:'', purchaseDate: todayISO(), expiryDate:'', store:'', note:'', fileUrl:'', createdAt:'' };
  const body = document.createElement('div');
  body.style.cssText='display:flex;flex-direction:column;gap:14px';
  const productInput = input({ value:w.product, placeholder:'Ej: Laptop Lenovo' });
  body.appendChild(field({ label:'Producto', required:true, input: productInput }));
  const row = document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:14px';
  const brandInput = input({ value:w.brand, placeholder:'Marca' });
  const serialInput = input({ value:w.serial, placeholder:'Número de serie' });
  row.appendChild(field({ label:'Marca', input: brandInput }));
  row.appendChild(field({ label:'Número de serie', input: serialInput }));
  body.appendChild(row);
  const row2 = document.createElement('div'); row2.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:14px';
  const purchaseInput = input({ type:'date', value:w.purchaseDate });
  const expiryInput = input({ type:'date', value:w.expiryDate });
  row2.appendChild(field({ label:'Fecha de compra', required:true, input: purchaseInput }));
  row2.appendChild(field({ label:'Fecha de vencimiento', input: expiryInput }));
  body.appendChild(row2);
  const storeInput = input({ value:w.store, placeholder:'Tienda o proveedor' });
  body.appendChild(field({ label:'Tienda', input: storeInput }));
  const urlInput = input({ value:w.fileUrl, placeholder:'https://... (factura, contrato)' });
  body.appendChild(field({ label:'URL de factura/doc', hint:'Enlace al comprobante', input: urlInput }));
  const noteInput = textarea(w.note, { placeholder:'Notas, condiciones, etc.' });
  body.appendChild(field({ label:'Nota', input: noteInput }));

  const footer = document.createElement('div'); footer.style.cssText='display:flex;justify-content:space-between;gap:10px';
  if (existing) {
    const del = document.createElement('button'); del.className='btn btn-danger'; del.innerHTML=`${icon('trash',14)} Eliminar`;
    del.onclick = async () => { const ok = await confirm({ title:'Eliminar', message:'¿Eliminar esta garantía?', danger:true, confirmText:'Eliminar' }); if (ok) { db.remove('warranties', existing.id); m.close(); toast('Eliminada','','success'); onDone?.(); } };
    footer.appendChild(del);
  }
  const right = document.createElement('div'); right.style.cssText='display:flex;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    if (!productInput.value.trim()) { toast('Producto requerido', '', 'error'); return; }
    db.save('warranties', { ...w, id: w.id||uid('war'), product: productInput.value.trim(), brand: brandInput.value, serial: serialInput.value, purchaseDate: purchaseInput.value, expiryDate: expiryInput.value, store: storeInput.value, fileUrl: urlInput.value, note: noteInput.value, createdAt: w.createdAt||nowISO() });
    m.close();
    toast(existing?'Actualizada':'Garantía creada', '', 'success');
    onDone?.();
  };
  right.appendChild(cancel); right.appendChild(save);
  footer.appendChild(right);
  const m = modal({ title: existing?'Editar garantía':'Nueva garantía', body, footer });
}
