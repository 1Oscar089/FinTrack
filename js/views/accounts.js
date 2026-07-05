// ============================================================
// FinTrack — Vista Cuentas
// ============================================================
import * as db from '../db.js';
import { ACCOUNT_TYPES } from '../config.js';
import { icon } from '../icons.js';
import { toast, modal, confirm, field, input, select, colorPicker, emojiPicker, segmented, emptyState } from '../ui.js';
import { fmtMoney, fmtDate, uid, nowISO, escapeHTML, cardPeriod, cardPeriodBalance, cardStatus } from '../utils.js';

const EMOJI_OPTS = ['💵','🏦','💳','📱','🏠','🚗','✈️','🎓','💼','💎','📊','🎯','🛒','🎁','📈','💰','🏢','🍪','☕','🎮'];
const COLOR_OPTS = ['#10b981','#0ea5e9','#8b5cf6','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#eab308'];

export function renderAccounts(root) {
  draw();

  function draw() {
    const accounts = db.getTable('accounts');
    const active = accounts.filter(a => !a.archived);
    const archived = accounts.filter(a => a.archived);

    root.innerHTML = `
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div class="flex gap-2 flex-wrap" id="typeFilter"></div>
        <button class="btn btn-primary" id="newBtn">${icon('plus',16)} Nueva cuenta</button>
      </div>
      <div class="grid grid-auto gap-3" id="grid"></div>
      ${archived.length ? `
        <div class="mt-6">
          <h3 class="text-sm text-muted font-semibold mb-3">Archivadas (${archived.length})</h3>
          <div class="grid grid-auto gap-3" id="archGrid"></div>
        </div>
      ` : ''}
    `;

    let filter = 'all';
    const seg = segmented(
      [{value:'all',label:'Todas'},...Object.entries(ACCOUNT_TYPES).map(([k,v])=>({value:k,label:v.label}))],
      filter, v => { filter = v; renderGrid(); }
    );
    root.querySelector('#typeFilter').appendChild(seg);
    root.querySelector('#newBtn').onclick = () => accountForm(null, draw);

    function renderGrid() {
      const list = active.filter(a => filter==='all' || a.type===filter);
      const grid = root.querySelector('#grid');
      grid.innerHTML = '';
      if (list.length === 0) {
        grid.appendChild(emptyState({
          icon:'wallet', title:'Sin cuentas', message:'Crea tu primera cuenta para empezar a registrar movimientos.',
          action: (()=>{const b=document.createElement('button');b.className='btn btn-primary';b.innerHTML=`${icon('plus',16)} Nueva cuenta`;b.onclick=()=>accountForm(null,draw);return b;})(),
        }));
      } else {
        for (const a of list) grid.appendChild(accountTile(a, draw));
      }
      const archGrid = root.querySelector('#archGrid');
      if (archGrid) {
        archGrid.innerHTML = '';
        for (const a of archived) archGrid.appendChild(accountTile(a, draw));
      }
    }
    renderGrid();
  }
}

function accountTile(a, onChange) {
  const t = ACCOUNT_TYPES[a.type] || ACCOUNT_TYPES.cash;
  const isCard = a.type === 'card';
  const isSavings = a.type === 'savings';
  const records = db.getTable('records');
  let extra = '';
  if (isCard) {
    const period = cardPeriod(a.cutDay, a.payDay);
    const bal = cardPeriodBalance(a, records);
    const status = cardStatus(a, records);
    const usagePct = a.creditLimit > 0 ? Math.min(100, (bal.due / a.creditLimit) * 100) : 0;
    extra = `
      <div class="flex items-center gap-2 mt-2">
        <span class="badge ${status.cls} badge-dot">${status.label}</span>
        ${a.last4?`<span class="text-xs text-dim font-mono">••${a.last4}</span>`:''}
      </div>
      <div class="mt-2">
        <div class="flex justify-between text-xs text-muted mb-1">
          <span>Uso del periodo</span>
          <span class="font-mono">${fmtMoney(bal.due)} / ${fmtMoney(a.creditLimit)}</span>
        </div>
        <div class="progress"><div class="progress-bar ${usagePct>80?'danger':usagePct>60?'warning':''}" style="width:${usagePct}%"></div></div>
      </div>
      <div class="flex justify-between text-xs text-dim mt-2">
        <span>Corte: ${fmtDate(period.nextCut.toISOString(),{pattern:'short'})}</span>
        <span>Pago: ${fmtDate(period.nextPay.toISOString(),{pattern:'short'})}</span>
      </div>
    `;
  } else if (isSavings) {
    extra = `
      <div class="mt-2">
        <span class="badge badge-info badge-dot">No cuenta en el balance</span>
      </div>
      <div class="text-xs text-dim mt-2">Usa esta cuenta para transferencias de ahorro que no quieres ver en tu balance general.</div>
    `;
  }
  const div = document.createElement('div');
  div.className = 'acct-tile';
  div.innerHTML = `
    <div class="acct-tile-head">
      <div class="acct-emoji" style="background:${a.color}22">${a.emoji||t.emoji}</div>
      <div style="flex:1;min-width:0">
        <div class="acct-name truncate">${escapeHTML(a.name)}</div>
        <div class="acct-type">${t.label}${a.archived?' · Archivada':''}</div>
      </div>
      <button class="icon-btn menu-btn">${icon('more',16)}</button>
    </div>
    <div>
      <div class="text-xs text-muted">${isCard?'Deuda del periodo':'Saldo'}</div>
      <div class="acct-balance ${!isCard && Number(a.balance)<0?'neg':''}">${fmtMoney(isCard? (cardPeriodBalance(a,records).due) : a.balance, a.currency)}</div>
    </div>
    ${extra}
    <div class="flex gap-2 mt-2">
      <button class="btn btn-sm flex-1 edit-btn">${icon('edit',14)} Editar</button>
      <button class="btn btn-sm archive-btn">${a.archived?icon('refresh',14):icon('eye-off',14)} ${a.archived?'Restaurar':'Archivar'}</button>
    </div>
  `;
  div.querySelector('.edit-btn').onclick = () => accountForm(a, onChange);
  div.querySelector('.archive-btn').onclick = async () => {
    db.save('accounts', { ...a, archived: !a.archived });
    toast(a.archived ? 'Restaurada' : 'Archivada', '', 'success');
    onChange();
  };
  div.querySelector('.menu-btn').onclick = async () => {
    const ok = await confirm({ title: 'Eliminar cuenta', message: '¿Eliminar definitivamente esta cuenta? Los registros asociados se conservarán.', danger: true, confirmText: 'Eliminar' });
    if (ok) { db.remove('accounts', a.id); toast('Eliminada', '', 'success'); onChange(); }
  };
  return div;
}

// ---------- Formulario de cuenta ----------
export function accountForm(existing, onDone) {
  const accounts = db.getTable('accounts');
  const a = existing || {
    id: '', name: '', type: 'cash', emoji: '💵', color: '#10b981',
    balance: 0, currency: 'USD', last4: '', cutDay: 1, payDay: 1,
    creditLimit: 0, expiry: '', archived: false, createdAt: '',
  };

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';

  // Tipo
  const typeSeg = segmented(
    Object.entries(ACCOUNT_TYPES).map(([k,v])=>({value:k,label:`${v.emoji} ${v.label}`})),
    a.type, v => { a.type = v; updateCardFields(); }
  );
  body.appendChild(field({ label: 'Tipo de cuenta', input: typeSeg }));

  // Nombre
  const nameInput = input({ value: a.name, placeholder: 'Ej: Cuenta de ahorros' });
  body.appendChild(field({ label: 'Nombre', required: true, input: nameInput }));

  // Emoji + color
  const emojiPick = emojiPicker(a.emoji, EMOJI_OPTS);
  const colorPick = colorPicker(a.color, COLOR_OPTS);
  const visual = document.createElement('div');
  visual.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px';
  visual.appendChild(field({ label: 'Emoji', input: emojiPick }));
  visual.appendChild(field({ label: 'Color', input: colorPick }));
  body.appendChild(visual);

  // Saldo inicial (no aplica igual a tarjetas)
  const balanceInput = input({ type:'number', value: a.balance, step:'0.01', placeholder:'0.00' });
  body.appendChild(field({ label: a.type==='card' ? 'Saldo inicial (deuda actual)' : 'Saldo inicial', hint: a.type==='card'?'Para tarjetas, ingresa el monto que debes actualmente.':'', input: balanceInput }));

  // last4
  const last4Input = input({ value: a.last4, placeholder: 'Últimos 4 dígitos', maxLength: 4 });
  body.appendChild(field({ label: 'Últimos 4 dígitos', hint: 'Para tarjetas y cuentas bancarias', input: last4Input }));

  // Campos dinámicos para tarjeta
  const cardFields = document.createElement('div');
  cardFields.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  body.appendChild(cardFields);

  function updateCardFields() {
    cardFields.innerHTML = '';
    last4Input.closest('.field').style.display = (a.type==='card'||a.type==='bank') ? '' : 'none';
    if (a.type === 'card') {
      const cutInput = input({ type:'number', value: a.cutDay||1, min:1, max:31 });
      const payInput = input({ type:'number', value: a.payDay||1, min:1, max:31 });
      const limitInput = input({ type:'number', value: a.creditLimit||0, min:0, step:'0.01' });
      const expiryInput = input({ type:'month', value: a.expiry||'' });
      cutInput.oninput = () => a.cutDay = clampDay(Number(cutInput.value)||1);
      payInput.oninput = () => a.payDay = clampDay(Number(payInput.value)||1);
      limitInput.oninput = () => a.creditLimit = Number(limitInput.value)||0;
      expiryInput.oninput = () => a.expiry = expiryInput.value;
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px';
      row.appendChild(field({ label: 'Día de corte', hint:'Día del mes (1-31)', input: cutInput }));
      row.appendChild(field({ label: 'Día de pago', hint:'Día del mes (1-31)', input: payInput }));
      cardFields.appendChild(row);
      cardFields.appendChild(field({ label: 'Límite de crédito', input: limitInput }));
      cardFields.appendChild(field({ label: 'Vencimiento de la tarjeta', input: expiryInput }));

      // Preview de tarjeta visual
      const preview = document.createElement('div');
      preview.style.cssText = 'margin-top:4px';
      const updatePreview = () => {
        preview.innerHTML = `
          <div class="card-visual" style="background:linear-gradient(135deg, ${colorPick.getValue()}, ${colorPick.getValue()}88 60%, #0a0f0d)">
            <div class="flex justify-between items-start">
              <div class="card-chip"></div>
              <span style="font-size:11px;opacity:.8;font-weight:700">${escapeHTML(ACCOUNT_TYPES.card.label.toUpperCase())}</span>
            </div>
            <div class="card-number">${'•••• •••• •••• ' + (last4Input.value||'••••').padStart(4,'•')}</div>
            <div class="card-meta">
              <div>
                <div style="opacity:.7;font-size:9px">TITULAR</div>
                <div style="font-weight:600">${escapeHTML(nameInput.value||'Nombre')}</div>
              </div>
              <div style="text-align:right">
                <div style="opacity:.7;font-size:9px">VENCE</div>
                <div style="font-weight:600">${escapeHTML(expiryInput.value||'MM/AA')}</div>
              </div>
            </div>
          </div>
        `;
      };
      nameInput.oninput = updatePreview;
      last4Input.oninput = updatePreview;
      expiryInput.oninput = updatePreview;
      // observer simple: actualiza la vista previa cuando cambian color/emoji
      const obs = new MutationObserver(updatePreview);
      obs.observe(colorPick, { attributes:true, attributeFilter:['data-value'] });
      const obs2 = new MutationObserver(updatePreview);
      obs2.observe(emojiPick, { attributes:true, attributeFilter:['data-value'] });
      updatePreview();
      cardFields.appendChild(field({ label: 'Vista previa', input: preview }));
    }
  }
  updateCardFields();

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:space-between;gap:10px';
  if (existing) {
    const del = document.createElement('button');
    del.className = 'btn btn-danger';
    del.innerHTML = `${icon('trash',14)} Eliminar`;
    del.onclick = async () => {
      const ok = await confirm({ title:'Eliminar cuenta', message:'¿Eliminar esta cuenta permanentemente?', danger:true, confirmText:'Eliminar' });
      if (ok) { db.remove('accounts', existing.id); m.close(); toast('Eliminada','','success'); onDone?.(); }
    };
    footer.appendChild(del);
  }
  const right = document.createElement('div');
  right.style.cssText = 'display:flex;gap:10px';
  const cancel = document.createElement('button');
  cancel.className = 'btn'; cancel.textContent = 'Cancelar';
  const save = document.createElement('button');
  save.className = 'btn btn-primary'; save.innerHTML = `${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    if (!nameInput.value.trim()) { toast('Nombre requerido', '', 'error'); return; }
    const rec = {
      ...a,
      id: a.id || uid('acc'),
      name: nameInput.value.trim(),
      emoji: emojiPick.getValue() || ACCOUNT_TYPES[a.type].emoji,
      color: colorPick.getValue(),
      balance: Number(balanceInput.value) || 0,
      last4: last4Input.value,
      createdAt: a.createdAt || nowISO(),
    };
    db.save('accounts', rec);
    m.close();
    toast(existing ? 'Cuenta actualizada' : 'Cuenta creada', '', 'success');
    onDone?.();
  };
  right.appendChild(cancel);
  right.appendChild(save);
  footer.appendChild(right);

  const m = modal({ title: existing ? 'Editar cuenta' : 'Nueva cuenta', size: 'lg', body, footer });
}

function clampDay(d) { return Math.min(31, Math.max(1, d)); }
