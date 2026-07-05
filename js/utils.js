// ============================================================
// FinTrack — Utilidades
// ============================================================
import { CONFIG } from './config.js';

// ---------- IDs ----------
export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ---------- Formato monetario ----------
export function fmtMoney(value, currency = CONFIG.BASE_CURRENCY, opts = {}) {
  const { sign = false, compact = false } = opts;
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  let str;
  if (compact && abs >= 1000) {
    str = new Intl.NumberFormat('es-SV', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(abs);
  } else {
    str = new Intl.NumberFormat('es-SV', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
  }
  const prefixSign = v < 0 ? '-' : (sign ? '+' : '');
  const cur = currency === 'USD' ? '$' : currency === 'BTC' ? '₿' : `${currency} `;
  return `${prefixSign}${cur}${str}`;
}

export function fmtNum(value, decimals = 2) {
  return new Intl.NumberFormat('es-SV', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value) || 0);
}

export function fmtPct(value, decimals = 1) {
  const v = Number(value) || 0;
  return `${v >= 0 ? '' : ''}${v.toFixed(decimals)}%`;
}

// ---------- Fechas ----------
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO() {
  return new Date().toISOString();
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtDate(iso, opts = {}) {
  if (!iso) return '—';
  const { pattern = 'medium' } = opts;
  const d = typeof iso === 'string' ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso) : iso;
  if (isNaN(d)) return '—';
  if (pattern === 'short') return d.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: '2-digit' });
  if (pattern === 'long') return d.toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('es-SV', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = d - new Date();
  const days = Math.round(diff / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days === -1) return 'Ayer';
  if (days > 0 && days <= 7) return `En ${days} días`;
  if (days < 0 && days >= -7) return `Hace ${-days} días`;
  return fmtDate(iso);
}

// Día del mes en zona de El Salvador
export function svNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: CONFIG.TIMEZONE }));
}

// ---------- Tarjetas de crédito ----------
// Calcula el periodo actual de corte de una tarjeta.
// cutDay: día de corte (1-31)
// Devuelve { start, end, nextCut, nextPay, daysUntilCut }
export function cardPeriod(cutDay, payDay) {
  const now = svNow();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  // Día de corte de este mes (ajustado si no existe el día, ej. 31 en feb)
  const cutThisMonth = clampDay(y, m, cutDay);

  // Si ya pasó el corte este mes, el periodo actual empieza el de este mes
  let startM, startY;
  if (d >= cutThisMonth) {
    startM = m; startY = y;
  } else {
    // periodo empezó el mes pasado
    startM = m - 1; startY = y;
    if (startM < 0) { startM = 11; startY--; }
  }
  const start = new Date(startY, startM, clampDay(startY, startM, cutDay));
  // Fin del periodo = día de corte del mes siguiente
  const endM = startM + 1, endY = startY;
  const endDate = new Date(endY, endM, clampDay(endY, endM, cutDay));

  // Próximo corte = endDate (si ya estamos en el periodo)
  const nextCut = endDate;

  // Fecha de pago: día payDay del mes siguiente al corte (estándar de tarjetas)
  let payMonth = endM + 1;
  let payYear = endY;
  if (payMonth > 11) { payMonth = 0; payYear = endY + 1; }
  const nextPay = new Date(payYear, payMonth, clampDay(payYear, payMonth, payDay));

  const daysUntilCut = Math.ceil((nextCut - now) / 86400000);
  const daysUntilPay = Math.ceil((nextPay - now) / 86400000);

  return { start, end: nextCut, nextCut, nextPay, daysUntilCut, daysUntilPay };
}

export function clampDay(y, m, day) {
  // Devuelve el día válido más cercano dentro del mes
  const lastDay = new Date(y, m + 1, 0).getDate();
  return Math.min(Math.max(1, day), lastDay);
}

// ¿La cuenta cuenta para el balance total/patrimonio?
// Las de tipo 'savings' (ahorros) están excluidas del balance general,
// pero siguen estando disponibles para transferencias.
export function countsInBalance(account) {
  return account && account.type !== 'savings';
}

// Estado de tarjeta: al dia | pagada | pendiente | vencida
export function cardStatus(card, records) {
  const period = cardPeriod(card.cutDay, card.payDay);
  const now = svNow();
  // Buscar si existe un pago de tarjeta en el periodo actual
  const paidThisPeriod = records.some(r =>
    r.type === 'expense' &&
    r.categoryId === 'cat-cardpay' &&
    r.linkedCardId === card.id &&
    new Date(r.date) >= period.start &&
    new Date(r.date) < period.end
  );
  // ¿Tiene gastos en el periodo actual?
  const hasSpending = records.some(r =>
    r.accountId === card.id &&
    new Date(r.date) >= period.start &&
    new Date(r.date) < period.end
  );

  if (paidThisPeriod) return { key: 'paid', label: 'Pagada', cls: 'badge-success' };
  if (now > period.nextPay) return { key: 'overdue', label: 'Vencida', cls: 'badge-danger' };
  if (daysUntilPay(period.nextPay) <= CONFIG.CARD_GRACE_DAYS && hasSpending) {
    return { key: 'pending', label: 'Pendiente', cls: 'badge-warning' };
  }
  return { key: 'uptodate', label: 'Al día', cls: 'badge-info' };
}

function daysUntilPay(date) {
  return Math.ceil((new Date(date) - svNow()) / 86400000);
}

// Calcula el saldo a pagar de una tarjeta en su periodo actual
export function cardPeriodBalance(card, records) {
  const period = cardPeriod(card.cutDay, card.payDay);
  // Gastos (egresos) en la tarjeta durante el periodo, menos pagos hechos a la tarjeta
  let spent = 0, paid = 0;
  for (const r of records) {
    const d = new Date(r.date);
    if (d < period.start || d >= period.end) continue;
    if (r.accountId === card.id && r.type === 'expense') spent += Number(r.amount) || 0;
    if (r.linkedCardId === card.id && r.categoryId === 'cat-cardpay' && r.type === 'expense') paid += Number(r.amount) || 0;
  }
  return { spent, paid, due: Math.max(0, spent - paid), period };
}

// ---------- Color helpers ----------
export function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(16,185,129,${alpha})`;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Genera gradiente para tarjetas visuales
export function cardGradient(color) {
  const c = color || '#8b5cf6';
  return `linear-gradient(135deg, ${hexToRgba(c, 0.95)}, ${hexToRgba(c, 0.55)} 60%, ${hexToRgba('#0a0f0d', 0.85)})`;
}

// ---------- Misc ----------
export function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function maskCardNumber(num) {
  if (!num) return '•••• •••• •••• ••••';
  const last4 = String(num).slice(-4).padStart(4, '•');
  return `•••• •••• •••• ${last4}`;
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Suma segura de cantidades
export function sum(arr, key) {
  return arr.reduce((acc, x) => acc + (Number(key ? x[key] : x) || 0), 0);
}

// Agrupa por clave
export function groupBy(arr, key) {
  return arr.reduce((acc, x) => {
    const k = typeof key === 'function' ? key(x) : x[key];
    (acc[k] = acc[k] || []).push(x);
    return acc;
  }, {});
}

// Últimos N meses
export function lastNMonths(n, ref = new Date()) {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    arr.push({ y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleDateString('es-SV', { month: 'short', year: '2-digit' }) });
  }
  return arr;
}

export function inMonth(iso, y, m) {
  const d = new Date(iso);
  return d.getFullYear() === y && d.getMonth() === m;
}

// Tipo de cambio: obtiene rate para una fecha
export function getRate(rates, from, to, dateISO) {
  if (from === to) return 1;
  const key = `${from}_${to}`;
  // Busca la tasa más reciente <= dateISO
  const matching = rates
    .filter(r => r.pair === key && r.date <= dateISO)
    .sort((a, b) => b.date.localeCompare(a.date));
  return matching[0] ? Number(matching[0].rate) : null;
}
