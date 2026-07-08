// ============================================================
// FinTrack — Estadísticas: Créditos y deudas
// ============================================================
import * as db from '../db.js';
import { icon } from '../icons.js';
import { kpiHTML } from './stats_common.js';
import { fmtMoney, fmtPct, fmtDate, escapeHTML, cardPeriod, cardPeriodBalance, cardTotalDebt, cardStatus, relativeTime } from '../utils.js';

export function renderStatsCredits(root) {
  const accounts = db.getTable('accounts').filter(a => !a.archived);
  const cards = accounts.filter(a => a.type === 'card');
  const records = db.getTable('records');
  const debts = db.getTable('debts').filter(d => !d.settled);
  const owe = debts.filter(d => d.type === 'owe');
  const owed = debts.filter(d => d.type === 'owed');
  const totalCardDebt = cards.reduce((s,c) => s + cardTotalDebt(c, records), 0);
  const totalOwe = owe.reduce((s,d) => s + Number(d.amount||0), 0);
  const totalOwed = owed.reduce((s,d) => s + Number(d.amount||0), 0);
  const totalLiabilities = totalCardDebt + totalOwe;
  const net = totalOwed - totalLiabilities;

  root.innerHTML = `
    <div class="text-xs text-dim mb-4">Créditos, tarjetas y deudas</div>
    <div class="kpi-grid mb-4">
      ${kpiHTML('Deuda en tarjetas', fmtMoney(totalCardDebt), { icon:'credit-card', cls:'amt-neg', iconColor:'#8b5cf6' })}
      ${kpiHTML('Deudas propias', fmtMoney(totalOwe), { icon:'arrow-up-right', cls:'amt-neg', iconColor:'#ef4444' })}
      ${kpiHTML('Por cobrar', fmtMoney(totalOwed), { icon:'arrow-down-left', cls:'amt-pos', iconColor:'#10b981' })}
      ${kpiHTML('Pasivo total', fmtMoney(totalLiabilities), { icon:'scale', cls:'amt-neg', iconColor:'#ec4899' })}
      ${kpiHTML('Balance deudas', fmtMoney(net, undefined, {sign:true}), { icon:'trending-up', cls: net>=0?'amt-pos':'amt-neg', iconColor:'#06b6d4' })}
    </div>

    <div class="card mb-4">
      <div class="card-header"><div class="card-title">Estado de tarjetas</div><span class="badge">${cards.length}</span></div>
      <div id="cardsList" class="flex flex-col gap-3"></div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Deudas propias</div><span class="badge badge-danger">${owe.length}</span></div>
        <div id="oweList" class="flex flex-col gap-2 scroll-list" style="max-height:400px"></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Me deben</div><span class="badge badge-success">${owed.length}</span></div>
        <div id="owedList" class="flex flex-col gap-2 scroll-list" style="max-height:400px"></div>
      </div>
    </div>
  `;

  // Cards detail
  const cardsList = root.querySelector('#cardsList');
  if (cards.length === 0) {
    cardsList.innerHTML = `<div class="empty-state" style="padding:24px"><p class="text-sm text-muted">No tienes tarjetas de crédito.</p></div>`;
  } else {
    cardsList.innerHTML = cards.map(c => {
      const totalDebt = cardTotalDebt(c, records);
      const status = cardStatus(c, records);
      const period = cardPeriod(c.cutDay, c.payDay);
      const usagePct = c.creditLimit > 0 ? Math.min(100, (totalDebt/c.creditLimit)*100) : 0;
      return `
        <div class="list-item" style="flex-direction:column;align-items:stretch;gap:10px">
          <div class="flex items-center gap-3" style="width:100%">
            <div class="list-item-icon" style="background:${c.color}22;color:${c.color};font-size:16px;width:40px;height:40px">${c.emoji}</div>
            <div class="flex-1">
              <div class="list-item-title">${escapeHTML(c.name)} ${c.last4?`<span class="text-dim text-xs font-mono">••${c.last4}</span>`:''}</div>
              <div class="list-item-sub">Límite ${fmtMoney(c.creditLimit)} · Vence ${escapeHTML(c.expiry||'—')}</div>
            </div>
            <span class="badge ${status.cls} badge-dot">${status.label}</span>
          </div>
          <div>
            <div class="flex justify-between text-xs text-muted mb-1">
              <span>Deuda total / Límite</span>
              <span class="font-mono">${fmtMoney(totalDebt)} / ${fmtMoney(c.creditLimit)} (${fmtPct(usagePct)})</span>
            </div>
            <div class="progress"><div class="progress-bar ${usagePct>80?'danger':usagePct>60?'warning':''}" style="width:${usagePct}%"></div></div>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-dim">Próx. corte: <strong>${fmtDate(period.nextCut.toISOString(),{pattern:'short'})}</strong></span>
            <span class="text-dim">Próx. pago: <strong>${fmtDate(period.nextPay.toISOString(),{pattern:'short'})}</strong> (${relativeTime(period.nextPay.toISOString())})</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Deudas
  function debtList(host, items, type) {
    if (items.length === 0) {
      host.innerHTML = `<div class="empty-state" style="padding:24px"><p class="text-sm text-muted">Sin deudas.</p></div>`;
      return;
    }
    host.innerHTML = items.map(d => {
      const overdue = d.dueDate && d.dueDate < new Date().toISOString().slice(0,10);
      return `
        <div class="list-item" style="padding:10px">
          <div class="list-item-icon" style="background:${type==='owe'?'rgba(239,68,68,.15)':'rgba(16,185,129,.15)'};color:${type==='owe'?'var(--danger)':'var(--success)'}">${icon(type==='owe'?'arrow-up-right':'arrow-down-left',16)}</div>
          <div class="list-item-body">
            <div class="list-item-title">${escapeHTML(d.person)} ${overdue?`<span class="badge badge-danger">Vencida</span>`:''}</div>
            <div class="list-item-sub">${escapeHTML(d.description||'')}${d.dueDate?` · Vence ${fmtDate(d.dueDate,{pattern:'short'})}`:''}</div>
          </div>
          <div class="font-mono font-bold ${type==='owe'?'amt-neg':'amt-pos'}">${fmtMoney(d.amount, d.currency)}</div>
        </div>
      `;
    }).join('');
  }
  debtList(root.querySelector('#oweList'), owe, 'owe');
  debtList(root.querySelector('#owedList'), owed, 'owed');
}
