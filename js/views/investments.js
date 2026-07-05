// ============================================================
// FinTrack — Vista Inversiones (con criptos en vivo)
// ============================================================
import * as db from '../db.js';
import { CRYPTOS } from '../config.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, textarea, segmented, emptyState } from '../ui.js';
import { fmtMoney, fmtNum, fmtPct, fmtDate, uid, nowISO, escapeHTML } from '../utils.js';

let priceCache = { data: null, ts: 0 };

async function fetchPrices() {
  const now = Date.now();
  if (priceCache.data && now - priceCache.ts < 60000) return priceCache.data;
  try {
    const ids = CRYPTOS.map(c => c.id).join(',');
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
    const data = await res.json();
    priceCache = { data, ts: now };
    return data;
  } catch (e) {
    console.warn('No se pudieron obtener precios de criptos', e);
    return null;
  }
}

export function renderInvestments(root) {
  draw();

  async function draw() {
    const invs = db.getTable('investments');
    root.innerHTML = `
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div id="status"></div>
        <div class="flex gap-2">
          <button class="btn" id="refreshBtn">${icon('refresh',14)} Actualizar precios</button>
          <button class="btn btn-primary" id="newBtn">${icon('plus',16)} Nueva inversión</button>
        </div>
      </div>
      <div class="kpi-grid mb-4" id="kpis"></div>
      <div id="list" class="flex flex-col gap-3"></div>
    `;
    root.querySelector('#newBtn').onclick = () => invForm(null, draw);
    root.querySelector('#refreshBtn').onclick = () => { priceCache = { data:null, ts:0 }; draw(); };

    // Skeleton
    root.querySelector('#kpis').innerHTML = `<div class="kpi"><div class="skeleton" style="height:40px;width:60%"></div></div>`.repeat(4);
    root.querySelector('#list').innerHTML = `<div class="card"><div class="skeleton" style="height:60px;margin-bottom:8px"></div></div>`.repeat(3);

    const prices = await fetchPrices();
    renderKpis(invs, prices);
    renderList(invs, prices, draw);
    const status = root.querySelector('#status');
    if (prices) {
      status.innerHTML = `<span class="badge badge-success badge-dot">Precios en vivo</span><span class="text-xs text-dim ml-2">CoinGecko · actualizado ${new Date(priceCache.ts).toLocaleTimeString('es-SV')}</span>`;
    } else {
      status.innerHTML = `<span class="badge badge-warning badge-dot">Precios manuales</span><span class="text-xs text-dim ml-2">Sin conexión a CoinGecko</span>`;
    }
  }
}

function getPrice(symbol, prices) {
  if (!prices) return null;
  const crypto = CRYPTOS.find(c => c.symbol === symbol);
  if (!crypto) return null;
  const p = prices[crypto.id];
  return p ? { price: p.usd, change: p.usd_24h_change } : null;
}

function renderKpis(invs, prices) {
  let totalValue = 0, totalCost = 0;
  for (const inv of invs) {
    const qty = Number(inv.qty)||0;
    const cost = qty * (Number(inv.buyPrice)||0);
    let curPrice = Number(inv.currentPrice)||0;
    if (inv.type === 'crypto' && prices) {
      const p = getPrice(inv.symbol, prices);
      if (p) curPrice = p.price;
    }
    totalValue += qty * curPrice;
    totalCost += cost;
  }
  const ret = totalValue - totalCost;
  const retPct = totalCost > 0 ? (ret/totalCost)*100 : 0;
  const el = document.getElementById('kpis') || document.querySelector('#kpis');
  el.innerHTML = `
    <div class="kpi"><div class="kpi-label">${icon('coins',16)} Valor actual</div><div class="kpi-value">${fmtMoney(totalValue)}</div></div>
    <div class="kpi"><div class="kpi-label">${icon('banknote',16)} Costo total</div><div class="kpi-value">${fmtMoney(totalCost)}</div></div>
    <div class="kpi"><div class="kpi-label">${icon('trending-up',16)} Ganancia/Pérdida</div><div class="kpi-value ${ret>=0?'amt-pos':'amt-neg'}">${fmtMoney(ret, undefined, {sign:true})}</div></div>
    <div class="kpi"><div class="kpi-label">${icon('bar-chart',16)} Retorno</div><div class="kpi-value ${retPct>=0?'amt-pos':'amt-neg'}">${fmtPct(retPct)}</div></div>
  `;
}

function renderList(invs, prices, onChange) {
  const list = document.querySelector('#list');
  list.innerHTML = '';
  if (invs.length === 0) {
    list.appendChild(emptyState({ icon:'trending-up', title:'Sin inversiones', message:'Registra tus inversiones en criptos u otros activos.', action: (()=>{const b=document.createElement('button');b.className='btn btn-primary';b.innerHTML=`${icon('plus',16)} Nueva inversión`;b.onclick=()=>invForm(null,onChange);return b;})() }));
    return;
  }
  for (const inv of invs) list.appendChild(invRow(inv, prices, onChange));
}

function invRow(inv, prices, onChange) {
  const qty = Number(inv.qty)||0;
  const cost = qty * (Number(inv.buyPrice)||0);
  let curPrice = Number(inv.currentPrice)||0;
  let change24 = null;
  if (inv.type === 'crypto' && prices) {
    const p = getPrice(inv.symbol, prices);
    if (p) { curPrice = p.price; change24 = p.change; }
  }
  const value = qty * curPrice;
  const ret = value - cost;
  const retPct = cost > 0 ? (ret/cost)*100 : 0;
  const crypto = CRYPTOS.find(c => c.symbol === inv.symbol);

  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <div class="list-item-icon" style="background:${crypto?.color||'#10b981'}22;color:${crypto?.color||'#10b981'};font-size:16px;font-weight:800;width:44px;height:44px">${escapeHTML(inv.symbol?.slice(0,3)||'INV')}</div>
      <div class="flex-1">
        <div class="font-bold">${escapeHTML(inv.name)} <span class="text-dim text-xs font-mono">${escapeHTML(inv.symbol)}</span></div>
        <div class="text-xs text-dim">${inv.type==='crypto'?'Criptomoneda':'Activo'} · ${fmtDate(inv.date,{pattern:'short'})}</div>
      </div>
      ${change24!=null?`<span class="badge ${change24>=0?'badge-success':'badge-danger'}">${change24>=0?'▲':'▼'} ${fmtPct(Math.abs(change24))} 24h</span>`:''}
      <button class="icon-btn edit-btn">${icon('edit',15)}</button>
    </div>
    <div class="grid grid-cols-4 gap-3 text-sm">
      <div><div class="text-xs text-dim">Cantidad</div><div class="font-mono font-semibold">${fmtNum(qty, inv.type==='crypto'?6:2)}</div></div>
      <div><div class="text-xs text-dim">Precio compra</div><div class="font-mono">${fmtMoney(inv.buyPrice)}</div></div>
      <div><div class="text-xs text-dim">Precio actual</div><div class="font-mono font-semibold">${fmtMoney(curPrice)}</div></div>
      <div><div class="text-xs text-dim">Valor</div><div class="font-mono font-bold">${fmtMoney(value)}</div></div>
    </div>
    <div class="flex justify-between items-center mt-3 pt-3" style="border-top:1px solid var(--border)">
      <span class="text-sm text-muted">Retorno total</span>
      <span class="font-mono font-bold ${ret>=0?'amt-pos':'amt-neg'}">${fmtMoney(ret, undefined, {sign:true})} (${fmtPct(retPct)})</span>
    </div>
  `;
  div.querySelector('.edit-btn').onclick = () => invForm(inv, onChange);
  return div;
}

export function invForm(existing, onDone) {
  const inv = existing || { id:'', type:'crypto', symbol:'BTC', name:'Bitcoin', qty:'', buyPrice:'', currentPrice:'', currency:'USD', date: new Date().toISOString().slice(0,10), note:'', createdAt:'' };
  const body = document.createElement('div');
  body.style.cssText='display:flex;flex-direction:column;gap:14px';
  const typeSeg = segmented([{value:'crypto',label:'Criptomoneda'},{value:'stock',label:'Acción'},{value:'other',label:'Otro'}], inv.type, v => { inv.type = v; updateFields(); });
  body.appendChild(field({ label:'Tipo', input: typeSeg }));
  const dyn = document.createElement('div'); dyn.style.cssText='display:flex;flex-direction:column;gap:14px';
  body.appendChild(dyn);
  const qtyInput = input({ type:'number', value:inv.qty, step:'0.000001', min:'0', placeholder:'0.00' });
  body.appendChild(field({ label:'Cantidad', required:true, input: qtyInput }));
  const row = document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:14px';
  const buyInput = input({ type:'number', value:inv.buyPrice, step:'0.01', min:'0', placeholder:'0.00' });
  const curInput = input({ type:'number', value:inv.currentPrice, step:'0.01', min:'0', placeholder:'0.00 (auto)' });
  row.appendChild(field({ label:'Precio de compra', required:true, input: buyInput }));
  row.appendChild(field({ label:'Precio actual', hint:'Vacío para cripto = precio en vivo', input: curInput }));
  body.appendChild(row);
  const dateInput = input({ type:'date', value:inv.date });
  body.appendChild(field({ label:'Fecha de compra', input: dateInput }));
  const noteInput = textarea(inv.note, { placeholder:'Nota (opcional)' });
  body.appendChild(field({ label:'Nota', input: noteInput }));

  function updateFields() {
    dyn.innerHTML = '';
    if (inv.type === 'crypto') {
      const symSel = select(CRYPTOS.map(c=>({value:c.symbol,label:`${c.symbol} — ${c.name}`})), inv.symbol);
      symSel.onchange = () => { inv.symbol = symSel.value; const c = CRYPTOS.find(x=>x.symbol===symSel.value); if (c) inv.name = c.name; };
      dyn.appendChild(field({ label:'Criptomoneda', required:true, input: symSel }));
    } else {
      const symInput = input({ value:inv.symbol, placeholder:'Símbolo (ej: AAPL)' });
      symInput.oninput = () => inv.symbol = symInput.value;
      const nameInput = input({ value:inv.name, placeholder:'Nombre' });
      nameInput.oninput = () => inv.name = nameInput.value;
      dyn.appendChild(field({ label:'Símbolo', required:true, input: symInput }));
      dyn.appendChild(field({ label:'Nombre', required:true, input: nameInput }));
    }
  }
  updateFields();

  const footer = document.createElement('div'); footer.style.cssText='display:flex;justify-content:space-between;gap:10px';
  if (existing) {
    const del = document.createElement('button'); del.className='btn btn-danger'; del.innerHTML=`${icon('trash',14)} Eliminar`;
    del.onclick = async () => { const ok = await confirm({ title:'Eliminar', message:'¿Eliminar esta inversión?', danger:true, confirmText:'Eliminar' }); if (ok) { db.remove('investments', existing.id); m.close(); toast('Eliminada','','success'); onDone?.(); } };
    footer.appendChild(del);
  }
  const right = document.createElement('div'); right.style.cssText='display:flex;gap:10px';
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancelar';
  const save = document.createElement('button'); save.className='btn btn-primary'; save.innerHTML=`${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    const qty = Number(qtyInput.value);
    const buyPrice = Number(buyInput.value);
    if (!qty || qty <= 0) { toast('Cantidad inválida', '', 'error'); return; }
    if (!buyPrice || buyPrice <= 0) { toast('Precio de compra inválido', '', 'error'); return; }
    db.save('investments', { ...inv, id: inv.id||uid('inv'), qty, buyPrice, currentPrice: Number(curInput.value)||0, date: dateInput.value, note: noteInput.value, createdAt: inv.createdAt||nowISO() });
    m.close();
    toast(existing?'Actualizada':'Inversión agregada', '', 'success');
    onDone?.();
  };
  right.appendChild(cancel); right.appendChild(save);
  footer.appendChild(right);
  const m = modal({ title: existing?'Editar inversión':'Nueva inversión', body, footer });
}
