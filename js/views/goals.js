// ============================================================
// FinTrack — Vista Metas
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, textarea, colorPicker, emojiPicker, emptyState } from '../ui.js';
import { fmtMoney, fmtPct, fmtDate, relativeTime, uid, nowISO, todayISO, escapeHTML } from '../utils.js';

const EMOJIS = ['🎯','🛟','🏠','🚗','✈️','💍','🎓','💻','📱','🏖️','🎁','💎','🏆','📚','⌚','🎮'];
const COLORS = ['#10b981','#06b6d4','#8b5cf6','#ec4899','#f59e0b','#ef4444','#14b8a6','#f97316'];

export function renderGoals(root) {
  draw();

  function draw() {
    const goals = db.getTable('goals');
    const totalTarget = goals.reduce((s,g)=>s+Number(g.target||0),0);
    const totalCurrent = goals.reduce((s,g)=>s+Number(g.current||0),0);

    root.innerHTML = `
      <div class="kpi-grid mb-4">
        <div class="kpi"><div class="kpi-label">${icon('target',16)} Metas activas</div><div class="kpi-value">${goals.length}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('savings',16)} Ahorrado</div><div class="kpi-value amt-pos">${fmtMoney(totalCurrent)}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('flag',16)} Objetivo total</div><div class="kpi-value">${fmtMoney(totalTarget)}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('bar-chart',16)} Progreso global</div><div class="kpi-value">${fmtPct(totalTarget>0?totalCurrent/totalTarget*100:0)}</div></div>
      </div>
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-muted">Tus objetivos de ahorro.</p>
        <button class="btn btn-primary" id="newBtn">${icon('plus',16)} Nueva meta</button>
      </div>
      <div id="grid" class="grid grid-cols-3 gap-4"></div>
    `;
    root.querySelector('#newBtn').onclick = () => goalForm(null, draw);
    const grid = root.querySelector('#grid');
    if (goals.length === 0) {
      grid.appendChild(emptyState({ icon:'target', title:'Sin metas', message:'Define un objetivo de ahorro y haz seguimiento.', action: (()=>{const b=document.createElement('button');b.className='btn btn-primary';b.innerHTML=`${icon('plus',16)} Nueva meta`;b.onclick=()=>goalForm(null,draw);return b;})() }));
    } else {
      for (const g of goals) grid.appendChild(goalCard(g, draw));
    }
  }
}

function goalCard(g, onChange) {
  const pct = g.target > 0 ? Math.min(100, (g.current/g.target)*100) : 0;
  const done = g.current >= g.target;
  const remaining = Math.max(0, g.target - g.current);
  const overdue = g.deadline && g.deadline < todayISO() && !done;

  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="list-item-icon" style="background:${g.color}22;color:${g.color};font-size:22px;width:48px;height:48px">${g.emoji||'🎯'}</div>
      ${done?`<span class="badge badge-success">Completada</span>`:overdue?`<span class="badge badge-danger">Vencida</span>`:`<span class="badge badge-info">${fmtPct(pct)}</span>`}
    </div>
    <div class="font-bold text-lg mb-1">${escapeHTML(g.name)}</div>
    ${g.note?`<div class="text-xs text-dim mb-3">${escapeHTML(g.note)}</div>`:'<div class="mb-3"></div>'}
    <div class="flex justify-between text-sm mb-1">
      <span class="font-mono font-bold">${fmtMoney(g.current)}</span>
      <span class="text-muted">de ${fmtMoney(g.target)}</span>
    </div>
    <div class="progress mb-2"><div class="progress-bar ${done?'':pct>80?'warning':''}" style="width:${pct}%"></div></div>
    <div class="flex justify-between text-xs text-dim mb-3">
      <span>${done?'¡Meta alcanzada!':`Faltan ${fmtMoney(remaining)}`}</span>
      ${g.deadline?`<span>${relativeTime(g.deadline)}</span>`:''}
    </div>
    <div class="flex gap-2">
      <button class="btn btn-sm btn-primary flex-1 add-btn">${icon('plus',14)} Aportar</button>
      <button class="btn btn-sm edit-btn">${icon('edit',14)}</button>
    </div>
  `;
  div.querySelector('.add-btn').onclick = () => contribute(g, onChange);
  div.querySelector('.edit-btn').onclick = () => goalForm(g, onChange);
  return div;
}

function contribute(g, onChange) {
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  const amtInput = input({ type:'number', step:'0.01', min:'0.01', placeholder:'0.00' });
  body.appendChild(field({ label:`Aportación a "${g.name}"`, required:true, input: amtInput }));
  const acctSel = select(db.getTable('accounts').filter(a=>!a.archived).map(a=>({value:a.id,label:`${a.emoji} ${a.name}`})), '');
  body.appendChild(field({ label:'Restar de cuenta (opcional)', hint:'Crea un egreso registrado', input: acctSel }));
  const footer = document.createElement('div');
  footer.style.cssText='display:flex;justify-content:flex-end;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Aportar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    const amount = Number(amtInput.value);
    if (!amount || amount <= 0) { toast('Monto inválido', '', 'error'); return; }
    db.save('goals', { ...g, current: Number(g.current||0) + amount });
    if (acctSel.value) {
      const rec = { id: uid('rec'), type:'expense', amount, currency:'USD', date: todayISO(), accountId: acctSel.value, toAccountId:'', categoryId:'', tags:[], note:`Aporte a meta: ${g.name}`, linkedCardId:'', scheduledId:'', createdAt: nowISO() };
      db.save('records', rec);
      db.applyRecordToAccounts(rec);
    }
    m.close();
    toast('Aportación registrada', '', 'success');
    onChange();
  };
  footer.appendChild(cancel); footer.appendChild(save);
  const m = modal({ title:'Aportar a meta', size:'sm', body, footer });
}

export function goalForm(existing, onDone) {
  const g = existing || { id:'', name:'', target:'', current:0, currency:'USD', deadline:'', emoji:'🎯', color:'#10b981', note:'', createdAt:'' };
  const body = document.createElement('div');
  body.style.cssText='display:flex;flex-direction:column;gap:14px';
  const nameInput = input({ value:g.name, placeholder:'Ej: Fondo de emergencia' });
  body.appendChild(field({ label:'Nombre', required:true, input: nameInput }));
  const row = document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:14px';
  const targetInput = input({ type:'number', value:g.target, step:'0.01', min:'0' });
  const currentInput = input({ type:'number', value:g.current, step:'0.01', min:'0' });
  row.appendChild(field({ label:'Objetivo', required:true, input: targetInput }));
  row.appendChild(field({ label:'Ahorrado actual', input: currentInput }));
  body.appendChild(row);
  const deadlineInput = input({ type:'date', value:g.deadline });
  body.appendChild(field({ label:'Fecha límite (opcional)', input: deadlineInput }));
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
    del.onclick = async () => { const ok = await confirm({ title:'Eliminar', message:'¿Eliminar esta meta?', danger:true, confirmText:'Eliminar' }); if (ok) { db.remove('goals', existing.id); m.close(); toast('Eliminada','','success'); onDone?.(); } };
    footer.appendChild(del);
  }
  const right = document.createElement('div'); right.style.cssText='display:flex;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    if (!nameInput.value.trim()) { toast('Nombre requerido', '', 'error'); return; }
    const target = Number(targetInput.value);
    if (!target || target <= 0) { toast('Objetivo inválido', '', 'error'); return; }
    db.save('goals', { ...g, id: g.id||uid('goa'), name: nameInput.value.trim(), target, current: Number(currentInput.value)||0, deadline: deadlineInput.value, emoji: emojiPick.getValue(), color: colorPick.getValue(), note: noteInput.value, createdAt: g.createdAt||nowISO() });
    m.close();
    toast(existing?'Actualizada':'Meta creada', '', 'success');
    onDone?.();
  };
  right.appendChild(cancel); right.appendChild(save);
  footer.appendChild(right);
  const m = modal({ title: existing?'Editar meta':'Nueva meta', body, footer });
}
