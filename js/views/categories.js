// ============================================================
// FinTrack — Vista Categorías y Etiquetas
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, segmented, colorPicker, emojiPicker, emptyState } from '../ui.js';
import { uid, nowISO, escapeHTML } from '../utils.js';

const CAT_EMOJIS = ['💼','💻','📈','🍔','🚗','🏠','💡','⚕️','🎮','🛍️','📚','💳','🎁','✈️','🎬','☕','🏋️','🐾','🔧','📱','👔','💧','🚌','🎬'];
const TAG_EMOJIS = ['⭐','🔥','📌','🎯','⚡','🌱','💎','🚀','🔒','📊','🎪','🎨'];
const COLORS = ['#10b981','#22c55e','#14b8a6','#06b6d4','#0ea5e9','#8b5cf6','#a855f7','#ec4899','#f43f5e','#ef4444','#f97316','#f59e0b','#eab308','#84cc16'];

export function renderCategories(root) {
  let tab = 'cat';
  root.innerHTML = `
    <div class="tabs" id="tabs">
      <button class="tab active" data-tab="cat">Categorías</button>
      <button class="tab" data-tab="tag">Etiquetas</button>
    </div>
    <div id="content"></div>
  `;
  root.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      root.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      tab = t.dataset.tab;
      renderContent();
    };
  });
  renderContent();

  function renderContent() {
    const el = root.querySelector('#content');
    el.innerHTML = '';
    if (tab === 'cat') renderCats(el);
    else renderTags(el);
  }
}

function renderCats(root) {
  const cats = db.getTable('categories');
  const income = cats.filter(c => c.type === 'income');
  const expense = cats.filter(c => c.type === 'expense');

  root.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-muted">Organiza tus ingresos y egresos por categoría.</p>
      <button class="btn btn-primary" id="newCat">${icon('plus',16)} Nueva categoría</button>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div class="card">
        <div class="card-header"><div class="card-title">${icon('arrow-down-left',16)} Ingresos</div><span class="badge badge-success">${income.length}</span></div>
        <div class="flex flex-col gap-2" id="incomeList"></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">${icon('arrow-up-right',16)} Egresos</div><span class="badge badge-danger">${expense.length}</span></div>
        <div class="flex flex-col gap-2" id="expList"></div>
      </div>
    </div>
  `;
  root.querySelector('#newCat').onclick = () => catForm(null, () => renderCats(root));
  const incList = root.querySelector('#incomeList');
  const expList = root.querySelector('#expList');
  if (income.length === 0) incList.appendChild(emptyState({ icon:'tag', title:'Sin categorías', message:'Crea una categoría de ingreso.' }));
  if (expense.length === 0) expList.appendChild(emptyState({ icon:'tag', title:'Sin categorías', message:'Crea una categoría de egreso.' }));
  for (const c of income) incList.appendChild(catRow(c, () => renderCats(root)));
  for (const c of expense) expList.appendChild(catRow(c, () => renderCats(root)));
}

function catRow(c, onChange) {
  const usage = db.getTable('records').filter(r => r.categoryId === c.id).length;
  const div = document.createElement('div');
  div.className = 'list-item';
  div.innerHTML = `
    <div class="list-item-icon" style="background:${c.color}22;color:${c.color}">${c.emoji||'🏷️'}</div>
    <div class="list-item-body">
      <div class="list-item-title">${escapeHTML(c.name)}</div>
      <div class="list-item-sub">${usage} registro(s)</div>
    </div>
    <button class="icon-btn edit-btn">${icon('edit',15)}</button>
    <button class="icon-btn del-btn">${icon('trash',15)}</button>
  `;
  div.querySelector('.edit-btn').onclick = () => catForm(c, onChange);
  div.querySelector('.del-btn').onclick = async () => {
    if (usage > 0) {
      const ok = await confirm({ title:'Categoría en uso', message:`${usage} registro(s) usan esta categoría. Si la eliminas, quedarán sin categoría. ¿Continuar?`, danger:true, confirmText:'Eliminar' });
      if (!ok) return;
    }
    db.remove('categories', c.id);
    toast('Eliminada', '', 'success');
    onChange();
  };
  return div;
}

export function catForm(existing, onDone) {
  const c = existing || { id:'', name:'', type:'expense', color:'#10b981', emoji:'🏷️' };
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  const nameInput = input({ value:c.name, placeholder:'Nombre' });
  body.appendChild(field({ label:'Nombre', required:true, input: nameInput }));
  const typeSeg = segmented([{value:'income',label:'Ingreso'},{value:'expense',label:'Egreso'}], c.type, v => c.type = v);
  body.appendChild(field({ label:'Tipo', input: typeSeg }));
  const emojiPick = emojiPicker(c.emoji, CAT_EMOJIS);
  body.appendChild(field({ label:'Emoji', input: emojiPick }));
  const colorPick = colorPicker(c.color, COLORS);
  body.appendChild(field({ label:'Color', input: colorPick }));

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    if (!nameInput.value.trim()) { toast('Nombre requerido', '', 'error'); return; }
    db.save('categories', { ...c, id: c.id||uid('cat'), name: nameInput.value.trim(), emoji: emojiPick.getValue(), color: colorPick.getValue() });
    m.close();
    toast(existing?'Actualizada':'Categoría creada', '', 'success');
    onDone?.();
  };
  footer.appendChild(cancel); footer.appendChild(save);
  const m = modal({ title: existing?'Editar categoría':'Nueva categoría', body, footer });
}

// ---------- Tags ----------
function renderTags(root) {
  const tags = db.getTable('tags');
  root.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-muted">Las etiquetas ayudan a marcar registros (esencial, recurrente, impulso…).</p>
      <button class="btn btn-primary" id="newTag">${icon('plus',16)} Nueva etiqueta</button>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Etiquetas</div><span class="badge">${tags.length}</span></div>
      <div class="flex flex-wrap gap-2" id="tagCloud"></div>
    </div>
    <div class="card mt-4">
      <div class="card-header"><div class="card-title">Detalle</div></div>
      <div class="flex flex-col gap-2" id="tagList"></div>
    </div>
  `;
  root.querySelector('#newTag').onclick = () => tagForm(null, () => renderTags(root));
  const cloud = root.querySelector('#tagCloud');
  const list = root.querySelector('#tagList');
  if (tags.length === 0) {
    list.appendChild(emptyState({ icon:'tag', title:'Sin etiquetas', message:'Crea etiquetas para organizar tus registros.' }));
    return;
  }
  for (const t of tags) {
    cloud.insertAdjacentHTML('beforeend', `<span class="chip" style="background:${t.color}22;border-color:${t.color}"><span class="tag-dot" style="background:${t.color}"></span>${escapeHTML(t.name)}</span>`);
    list.appendChild(tagRow(t, () => renderTags(root)));
  }
}

function tagRow(t, onChange) {
  const usage = db.getTable('records').filter(r => (r.tags||[]).includes(t.id)).length;
  const div = document.createElement('div');
  div.className = 'list-item';
  div.innerHTML = `
    <div class="list-item-icon" style="background:${t.color}22"><span class="tag-dot" style="background:${t.color};width:16px;height:16px"></span></div>
    <div class="list-item-body">
      <div class="list-item-title">${escapeHTML(t.name)}</div>
      <div class="list-item-sub">${usage} registro(s)</div>
    </div>
    <button class="icon-btn edit-btn">${icon('edit',15)}</button>
    <button class="icon-btn del-btn">${icon('trash',15)}</button>
  `;
  div.querySelector('.edit-btn').onclick = () => tagForm(t, onChange);
  div.querySelector('.del-btn').onclick = async () => {
    if (usage > 0) {
      const ok = await confirm({ title:'Etiqueta en uso', message:`${usage} registro(s) usan esta etiqueta. ¿Eliminar de todos modos?`, danger:true, confirmText:'Eliminar' });
      if (!ok) return;
      // remover de registros
      const recs = db.getTable('records');
      for (const r of recs) if ((r.tags||[]).includes(t.id)) { r.tags = r.tags.filter(x => x !== t.id); db.save('records', r); }
    }
    db.remove('tags', t.id);
    toast('Eliminada', '', 'success');
    onChange();
  };
  return div;
}

export function tagForm(existing, onDone) {
  const t = existing || { id:'', name:'', color:'#06b6d4' };
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  const nameInput = input({ value:t.name, placeholder:'Nombre' });
  body.appendChild(field({ label:'Nombre', required:true, input: nameInput }));
  const colorPick = colorPicker(t.color, COLORS);
  body.appendChild(field({ label:'Color', input: colorPick }));

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    if (!nameInput.value.trim()) { toast('Nombre requerido', '', 'error'); return; }
    db.save('tags', { ...t, id: t.id||uid('tag'), name: nameInput.value.trim(), color: colorPick.getValue() });
    m.close();
    toast(existing?'Actualizada':'Etiqueta creada', '', 'success');
    onDone?.();
  };
  footer.appendChild(cancel); footer.appendChild(save);
  const m = modal({ title: existing?'Editar etiqueta':'Nueva etiqueta', body, footer });
}
