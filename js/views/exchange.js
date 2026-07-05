// ============================================================
// FinTrack — Vista Tasa de Cambio
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, emptyState } from '../ui.js';
import { fmtMoney, fmtNum, fmtDate, uid, nowISO, todayISO, escapeHTML } from '../utils.js';

const CURRENCIES = ['USD','EUR','SVC','BTC','ETH','MXN','GTQ','HNL','NIO','CRC'];

export function renderExchange(root) {
  draw();

  function draw() {
    const rates = db.getTable('rates').sort((a,b) => (b.date||'').localeCompare(a.date||''));
    root.innerHTML = `
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="card">
          <div class="card-header"><div class="card-title">Conversor</div></div>
          <div id="converter"></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Tasas guardadas</div><button class="btn btn-sm btn-primary" id="newBtn">${icon('plus',14)} Nueva</button></div>
          <div id="ratesList" class="flex flex-col gap-2 scroll-list"></div>
        </div>
      </div>
    `;
    root.querySelector('#newBtn').onclick = () => rateForm(null, draw);
    renderConverter(root.querySelector('#converter'));
    renderList(rates, root.querySelector('#ratesList'), draw);
  }
}

function renderConverter(host) {
  const rates = db.getTable('rates');
  host.innerHTML = `
    <div class="flex flex-col gap-3">
      <div class="flex gap-2">
        <input class="input" id="convAmt" type="number" value="1" step="0.01" min="0" style="flex:1"/>
        <select class="select" id="convFrom" style="width:100px">${CURRENCIES.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
      </div>
      <div class="flex items-center justify-center gap-2">
        <button class="icon-btn" id="swapBtn" style="background:var(--surface-2)">${icon('arrow-down',16)}</button>
      </div>
      <div class="flex gap-2">
        <input class="input" id="convTo" type="text" readonly style="flex:1;font-weight:600"/>
        <select class="select" id="convTarget" style="width:100px">${CURRENCIES.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
      </div>
      <div class="text-xs text-dim text-center" id="convInfo"></div>
    </div>
  `;
  const amt = host.querySelector('#convAmt');
  const from = host.querySelector('#convFrom');
  const to = host.querySelector('#convTarget');
  const out = host.querySelector('#convTo');
  const info = host.querySelector('#convInfo');
  from.value = 'USD'; to.value = 'BTC';

  function calc() {
    const f = from.value, t = to.value;
    const a = Number(amt.value) || 0;
    if (f === t) { out.value = fmtNum(a, 8); info.textContent = '1 = 1'; return; }
    // Buscar tasa directa
    const pair = `${f}_${t}`;
    const today = todayISO();
    let rate = null, rateDate = '';
    const matches = rates.filter(r => r.pair === pair && r.date <= today).sort((a,b)=>b.date.localeCompare(a.date));
    if (matches[0]) { rate = Number(matches[0].rate); rateDate = matches[0].date; }
    // Buscar inversa
    if (rate === null) {
      const inv = `${t}_${f}`;
      const invMatches = rates.filter(r => r.pair === inv && r.date <= today).sort((a,b)=>b.date.localeCompare(a.date));
      if (invMatches[0]) { rate = 1/Number(invMatches[0].rate); rateDate = invMatches[0].date; }
    }
    if (rate === null) {
      // fallback hardcoded para USD/BTC
      if (f==='USD'&&t==='BTC') { rate = 0.0000149; rateDate='(estimado)'; }
      else if (f==='BTC'&&t==='USD') { rate = 67000; rateDate='(estimado)'; }
      else if (f==='USD'&&t==='SVC') { rate=8.75; rateDate='(oficial)'; }
      else if (f==='SVC'&&t==='USD') { rate=1/8.75; rateDate='(oficial)'; }
      else { out.value = '—'; info.textContent = `Sin tasa ${f}→${t}. Agrégala en "Nueva".`; return; }
    }
    out.value = fmtNum(a*rate, 8);
    info.textContent = `1 ${f} = ${fmtNum(rate, 8)} ${t} ${rateDate?`· ${rateDate}`:''}`;
  }
  amt.oninput = calc; from.onchange = calc; to.onchange = calc;
  host.querySelector('#swapBtn').onclick = () => { const tmp = from.value; from.value = to.value; to.value = tmp; calc(); };
  calc();
}

function renderList(rates, host, onChange) {
  host.innerHTML = '';
  if (rates.length === 0) {
    host.appendChild(emptyState({ icon:'exchange', title:'Sin tasas', message:'Agrega tasas de cambio.' }));
    return;
  }
  for (const r of rates) {
    const [from, to] = r.pair.split('_');
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div class="list-item-icon" style="background:var(--primary-soft);color:var(--primary)">${icon('exchange',16)}</div>
      <div class="list-item-body">
        <div class="list-item-title">${escapeHTML(from)} → ${escapeHTML(to)}</div>
        <div class="list-item-sub">${fmtDate(r.date,{pattern:'short'})}${r.note?` · ${escapeHTML(r.note)}`:''}</div>
      </div>
      <div class="font-mono font-bold">${fmtNum(r.rate, 8)}</div>
      <button class="icon-btn edit-btn">${icon('edit',15)}</button>
    `;
    div.querySelector('.edit-btn').onclick = () => rateForm(r, onChange);
    host.appendChild(div);
  }
}

export function rateForm(existing, onDone) {
  const r = existing || { id:'', pair:'USD_BTC', rate:'', date: todayISO(), note:'', createdAt:'' };
  const body = document.createElement('div');
  body.style.cssText='display:flex;flex-direction:column;gap:14px';
  const row = document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:end';
  const fromSel = select(CURRENCIES.map(c=>({value:c,label:c})), r.pair.split('_')[0]);
  const toSel = select(CURRENCIES.map(c=>({value:c,label:c})), r.pair.split('_')[1]);
  const arrow = document.createElement('div'); arrow.style.cssText='padding-bottom:10px;color:var(--text-dim)'; arrow.textContent='→';
  row.appendChild(field({ label:'De', input: fromSel }));
  row.appendChild(arrow);
  row.appendChild(field({ label:'A', input: toSel }));
  body.appendChild(row);
  const rateInput = input({ type:'number', value:r.rate, step:'0.00000001', min:'0', placeholder:'0.00' });
  body.appendChild(field({ label:'Tasa', required:true, hint:'1 unidad "De" = X unidades "A"', input: rateInput }));
  const dateInput = input({ type:'date', value:r.date });
  body.appendChild(field({ label:'Fecha', input: dateInput }));
  const noteInput = input({ value:r.note, placeholder:'Nota (opcional)' });
  body.appendChild(field({ label:'Nota', input: noteInput }));

  const footer = document.createElement('div'); footer.style.cssText='display:flex;justify-content:space-between;gap:10px';
  if (existing) {
    const del = document.createElement('button'); del.className='btn btn-danger'; del.innerHTML=`${icon('trash',14)} Eliminar`;
    del.onclick = async () => { const ok = await confirm({ title:'Eliminar', message:'¿Eliminar esta tasa?', danger:true, confirmText:'Eliminar' }); if (ok) { db.remove('rates', existing.id); m.close(); toast('Eliminada','','success'); onDone?.(); } };
    footer.appendChild(del);
  }
  const right = document.createElement('div'); right.style.cssText='display:flex;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    const rate = Number(rateInput.value);
    if (!rate || rate <= 0) { toast('Tasa inválida', '', 'error'); return; }
    db.save('rates', { ...r, id: r.id||uid('rate'), pair: `${fromSel.value}_${toSel.value}`, rate, date: dateInput.value, note: noteInput.value, createdAt: r.createdAt||nowISO() });
    m.close();
    toast(existing?'Actualizada':'Tasa creada', '', 'success');
    onDone?.();
  };
  right.appendChild(cancel); right.appendChild(save);
  footer.appendChild(right);
  const m = modal({ title: existing?'Editar tasa':'Nueva tasa', body, footer });
}
