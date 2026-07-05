// ============================================================
// FinTrack — Vista Tarjetas de Regalo
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, textarea, colorPicker, emojiPicker, emptyState } from '../ui.js';
import { fmtMoney, fmtDate, relativeTime, uid, nowISO, escapeHTML } from '../utils.js';

const EMOJIS = ['🎁','☕','🛍️','🎮','📺','🎵','📱','📚','👗','🍔','✈️','💎'];
const COLORS = ['#f97316','#ec4899','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#14b8a6'];

export function renderGiftcards(root) {
  draw();

  function draw() {
    const cards = db.getTable('giftcards');
    const total = cards.reduce((s,g) => s + Number(g.balance||0), 0);

    root.innerHTML = `
      <div class="kpi-grid mb-4">
        <div class="kpi"><div class="kpi-label">${icon('gift',16)} Tarjetas</div><div class="kpi-value">${cards.length}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('wallet',16)} Saldo total</div><div class="kpi-value amt-pos">${fmtMoney(total)}</div></div>
      </div>
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-muted">Saldos y códigos de tarjetas de regalo.</p>
        <button class="btn btn-primary" id="newBtn">${icon('plus',16)} Nueva tarjeta</button>
      </div>
      <div id="grid" class="grid grid-cols-3 gap-4"></div>
    `;
    root.querySelector('#newBtn').onclick = () => gcForm(null, draw);
    const grid = root.querySelector('#grid');
    if (cards.length === 0) {
      grid.appendChild(emptyState({ icon:'gift', title:'Sin tarjetas', message:'Registra tarjetas de regalo y sus saldos.', action: (()=>{const b=document.createElement('button');b.className='btn btn-primary';b.innerHTML=`${icon('plus',16)} Nueva tarjeta`;b.onclick=()=>gcForm(null,draw);return b;})() }));
    } else {
      for (const g of cards) grid.appendChild(gcCard(g, draw));
    }
  }
}

function gcCard(g, onChange) {
  const div = document.createElement('div');
  div.className = 'card card-hover';
  div.style.cursor = 'pointer';
  const expired = g.expiry && new Date(g.expiry) < new Date();
  div.innerHTML = `
    <div class="card-visual" style="background:linear-gradient(135deg, ${g.color||'#f97316'}, ${g.color||'#f97316'}99 60%, #0a0f0d);margin:-18px -18px 14px;border-radius:16px 16px 0 0">
      <div class="flex justify-between items-start">
        <span style="font-size:22px">${g.emoji||'🎁'}</span>
        <span style="font-size:11px;opacity:.85;font-weight:700">${escapeHTML((g.brand||g.name||'').toUpperCase())}</span>
      </div>
      <div class="card-number font-mono" style="font-size:13px">${escapeHTML(g.code||'•••• ••••')}</div>
      <div class="card-meta">
        <div>
          <div style="opacity:.7;font-size:9px">SALDO</div>
          <div style="font-weight:700;font-size:16px">${fmtMoney(g.balance, g.currency)}</div>
        </div>
        ${g.expiry?`<div style="text-align:right"><div style="opacity:.7;font-size:9px">VENCE</div><div style="font-weight:600">${escapeHTML(g.expiry)}</div></div>`:''}
      </div>
    </div>
    <div class="flex items-center justify-between mb-3">
      <span class="font-semibold">${escapeHTML(g.name)}</span>
      ${expired?`<span class="badge badge-danger">Vencida</span>`:''}
    </div>
    ${g.note?`<div class="text-xs text-muted" style="line-height:1.5">${escapeHTML(g.note)}</div>`:''}
    <div class="flex gap-2 mt-3">
      <button class="btn btn-sm flex-1 use-btn">${icon('minus',14)} Usar</button>
      <button class="btn btn-sm edit-btn">${icon('edit',14)}</button>
    </div>
  `;
  div.querySelector('.use-btn').onclick = (e) => { e.stopPropagation(); spendGc(g, onChange); };
  div.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); gcForm(g, onChange); };
  return div;
}

function spendGc(g, onChange) {
  const body = document.createElement('div');
  body.style.cssText='display:flex;flex-direction:column;gap:14px';
  body.innerHTML = `<p class="text-sm text-muted">Saldo actual: <strong class="font-mono">${fmtMoney(g.balance, g.currency)}</strong></p>`;
  const amtInput = input({ type:'number', step:'0.01', min:'0.01', max:g.balance, placeholder:'0.00' });
  body.appendChild(field({ label:'Monto a descontar', required:true, input: amtInput }));
  const footer = document.createElement('div'); footer.style.cssText='display:flex;justify-content:flex-end;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Descontar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    const amount = Number(amtInput.value);
    if (!amount || amount <= 0) { toast('Monto inválido', '', 'error'); return; }
    if (amount > g.balance) { toast('Saldo insuficiente', '', 'error'); return; }
    db.save('giftcards', { ...g, balance: Number(g.balance) - amount });
    m.close();
    toast('Saldo actualizado', `Nuevo saldo: ${fmtMoney(g.balance-amount, g.currency)}`, 'success');
    onChange();
  };
  footer.appendChild(cancel); footer.appendChild(save);
  const m = modal({ title:`Usar ${g.name}`, size:'sm', body, footer });
}

export function gcForm(existing, onDone) {
  const g = existing || { id:'', name:'', brand:'', balance:'', currency:'USD', code:'', pin:'', expiry:'', emoji:'🎁', color:'#f97316', note:'', createdAt:'' };
  const body = document.createElement('div');
  body.style.cssText='display:flex;flex-direction:column;gap:14px';
  const nameInput = input({ value:g.name, placeholder:'Ej: Amazon $50' });
  body.appendChild(field({ label:'Nombre', required:true, input: nameInput }));
  const row = document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:14px';
  const brandInput = input({ value:g.brand, placeholder:'Marca' });
  const balInput = input({ type:'number', value:g.balance, step:'0.01', min:'0', placeholder:'0.00' });
  row.appendChild(field({ label:'Marca', input: brandInput }));
  row.appendChild(field({ label:'Saldo', required:true, input: balInput }));
  body.appendChild(row);
  const row2 = document.createElement('div'); row2.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:14px';
  const codeInput = input({ value:g.code, placeholder:'Código' });
  const pinInput = input({ value:g.pin, placeholder:'PIN' });
  row2.appendChild(field({ label:'Código', input: codeInput }));
  row2.appendChild(field({ label:'PIN', input: pinInput }));
  body.appendChild(row2);
  const expiryInput = input({ type:'date', value:g.expiry });
  body.appendChild(field({ label:'Vencimiento (opcional)', input: expiryInput }));
  const visRow = document.createElement('div'); visRow.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:14px';
  const emojiPick = emojiPicker(g.emoji, EMOJIS);
  const colorPick = colorPicker(g.color, COLORS);
  visRow.appendChild(field({ label:'Emoji', input: emojiPick }));
  visRow.appendChild(field({ label:'Color', input: colorPick }));
  body.appendChild(visRow);
  const noteInput = textarea(g.note, { placeholder:'Nota (opcional)' });
  body.appendChild(field({ label:'Nota', input: noteInput }));

  const footer = document.createElement('div'); footer.style.cssText='display:flex;justify-content:space-between;gap:10px';
  if (existing) {
    const del = document.createElement('button'); del.className='btn btn-danger'; del.innerHTML=`${icon('trash',14)} Eliminar`;
    del.onclick = async () => { const ok = await confirm({ title:'Eliminar', message:'¿Eliminar esta tarjeta?', danger:true, confirmText:'Eliminar' }); if (ok) { db.remove('giftcards', existing.id); m.close(); toast('Eliminada','','success'); onDone?.(); } };
    footer.appendChild(del);
  }
  const right = document.createElement('div'); right.style.cssText='display:flex;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    if (!nameInput.value.trim()) { toast('Nombre requerido', '', 'error'); return; }
    const balance = Number(balInput.value);
    if (isNaN(balance) || balance < 0) { toast('Saldo inválido', '', 'error'); return; }
    db.save('giftcards', { ...g, id: g.id||uid('gif'), name: nameInput.value.trim(), brand: brandInput.value, balance, code: codeInput.value, pin: pinInput.value, expiry: expiryInput.value, emoji: emojiPick.getValue(), color: colorPick.getValue(), note: noteInput.value, createdAt: g.createdAt||nowISO() });
    m.close();
    toast(existing?'Actualizada':'Tarjeta creada', '', 'success');
    onDone?.();
  };
  right.appendChild(cancel); right.appendChild(save);
  footer.appendChild(right);
  const m = modal({ title: existing?'Editar tarjeta':'Nueva tarjeta', body, footer });
}
