// ============================================================
// FinTrack — Capa de datos
// Soporta Google Sheets (vía Apps Script) con fallback a localStorage.
// ============================================================
import { CONFIG, DEFAULT_CATEGORIES, DEFAULT_TAGS } from './config.js';
import { uid, nowISO } from './utils.js';

// Tablas del sistema
export const TABLES = [
  'accounts', 'records', 'scheduled', 'scheduledHistory',
  'categories', 'tags', 'budgets', 'debts', 'shopping',
  'goals', 'investments', 'warranties', 'giftcards', 'rates', 'settings',
];

const LS_KEY = 'fintrack:data:v1';
const LS_META = 'fintrack:meta:v1';

let cache = null;          // datos en memoria { table: [records] }
let online = false;        // ¿conectado a Apps Script?
let syncing = false;
let pendingSync = false;
const listeners = new Set();

// ---------- Persistencia local ----------
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveLocal(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
  localStorage.setItem(LS_META, JSON.stringify({ lastSaved: nowISO() }));
}

// ---------- Datos semilla ----------
function seed() {
  return {
    accounts: [
      { id: 'acc-cash', name: 'Efectivo', type: 'cash', emoji: '💵', color: '#10b981', balance: 250, currency: 'USD', last4: '', cutDay: 0, payDay: 0, creditLimit: 0, expiry: '', archived: false, createdAt: nowISO() },
      { id: 'acc-bank', name: 'Banco Agrícola', type: 'bank', emoji: '🏦', color: '#0ea5e9', balance: 3200, currency: 'USD', last4: '4521', cutDay: 0, payDay: 0, creditLimit: 0, expiry: '', archived: false, createdAt: nowISO() },
      { id: 'acc-card1', name: 'Visa Gold', type: 'card', emoji: '💳', color: '#8b5cf6', balance: 0, currency: 'USD', last4: '8842', cutDay: 15, payDay: 5, creditLimit: 2500, expiry: '2028-06', archived: false, createdAt: nowISO() },
      { id: 'acc-wallet', name: 'Yappy', type: 'wallet', emoji: '📱', color: '#f59e0b', balance: 180, currency: 'USD', last4: '', cutDay: 0, payDay: 0, creditLimit: 0, expiry: '', archived: false, createdAt: nowISO() },
      { id: 'acc-savings', name: 'Fondo de ahorro', type: 'savings', emoji: '🐷', color: '#14b8a6', balance: 5000, currency: 'USD', last4: '', cutDay: 0, payDay: 0, creditLimit: 0, expiry: '', archived: false, createdAt: nowISO() },
    ],
    records: [
      { id: uid('rec'), type: 'income', amount: 1500, currency: 'USD', date: nowISO().slice(0,10), accountId: 'acc-bank', toAccountId: '', categoryId: 'cat-salary', tags: ['tag-rec'], note: 'Salario quincenal', linkedCardId: '', scheduledId: '', createdAt: nowISO() },
      { id: uid('rec'), type: 'expense', amount: 35.5, currency: 'USD', date: nowISO().slice(0,10), accountId: 'acc-cash', toAccountId: '', categoryId: 'cat-food', tags: ['tag-ess'], note: 'Almuerzo', linkedCardId: '', scheduledId: '', createdAt: nowISO() },
      { id: uid('rec'), type: 'expense', amount: 120, currency: 'USD', date: nowISO().slice(0,10), accountId: 'acc-card1', toAccountId: '', categoryId: 'cart-shopping', tags: ['tag-imp'], note: 'Ropa', linkedCardId: '', scheduledId: '', createdAt: nowISO() },
      { id: uid('rec'), type: 'expense', amount: 60, currency: 'USD', date: nowISO().slice(0,10), accountId: 'acc-card1', toAccountId: '', categoryId: 'cat-food', tags: ['tag-ess'], note: 'Súper', linkedCardId: '', scheduledId: '', createdAt: nowISO() },
    ],
    scheduled: [
      { id: uid('sch'), name: 'Renta', type: 'expense', amount: 450, currency: 'USD', frequency: 'monthly', nextDate: nextMonthFirst(), endDate: '', accountId: 'acc-bank', toAccountId: '', categoryId: 'cat-home', tags: ['tag-ess','tag-rec'], note: 'Renta mensual', auto: false, active: true, createdAt: nowISO() },
    ],
    scheduledHistory: [],
    categories: [...DEFAULT_CATEGORIES],
    tags: [...DEFAULT_TAGS],
    budgets: [
      { id: uid('bud'), categoryId: 'cat-food', amount: 400, period: 'monthly', month: currentMonth(), createdAt: nowISO() },
      { id: uid('bud'), categoryId: 'cart-shopping', amount: 200, period: 'monthly', month: currentMonth(), createdAt: nowISO() },
    ],
    debts: [
      { id: uid('deb'), type: 'owe', person: 'María', amount: 100, currency: 'USD', date: nowISO().slice(0,10), dueDate: '', description: 'Préstamo cena', settled: false, settledDate: '', createdAt: nowISO() },
    ],
    shopping: [
      { id: uid('sho'), name: 'Café', qty: 2, unit: 'kg', price: 8.5, accountId: 'acc-cash', categoryId: 'cat-food', purchased: false, priority: 2, note: '', createdAt: nowISO() },
      { id: uid('sho'), name: 'Papel higiénico', qty: 12, unit: 'unidad', price: 0.75, accountId: 'acc-cash', categoryId: 'cat-home', purchased: false, priority: 1, note: '', createdAt: nowISO() },
    ],
    goals: [
      { id: uid('goa'), name: 'Fondo de emergencia', target: 5000, current: 1200, currency: 'USD', deadline: '2025-12-31', emoji: '🛟', color: '#10b981', note: '6 meses de gastos', createdAt: nowISO() },
    ],
    investments: [
      { id: uid('inv'), type: 'crypto', symbol: 'BTC', name: 'Bitcoin', qty: 0.05, buyPrice: 42000, currentPrice: 67000, currency: 'USD', date: '2024-01-15', note: 'Long term', createdAt: nowISO() },
    ],
    warranties: [
      { id: uid('war'), product: 'Laptop Lenovo', brand: 'Lenovo', serial: 'LN-2024-8821', purchaseDate: '2024-03-10', expiryDate: '2026-03-10', store: 'Amazon', note: 'Garantía extendida 2 años', fileUrl: '', createdAt: nowISO() },
    ],
    giftcards: [
      { id: uid('gif'), name: 'Amazon $50', brand: 'Amazon', balance: 50, currency: 'USD', code: 'AMZ-XXXX-2024', pin: '', expiry: '', emoji: '🎁', color: '#f97316', note: '', createdAt: nowISO() },
    ],
    rates: [
      { id: uid('rate'), pair: 'USD_BTC', rate: 0.0000149, date: nowISO().slice(0,10), note: 'Tasa referencial', createdAt: nowISO() },
      { id: uid('rate'), pair: 'USD_SVC', rate: 8.75, date: nowISO().slice(0,10), note: '', createdAt: nowISO() },
    ],
    settings: [
      { id: 'set-theme', key: 'theme', value: 'dark' },
      { id: 'set-fx', key: 'fxDisplay', value: 'BTC' },
    ],
  };
}

function nextMonthFirst() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString().slice(0, 10);
}
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ---------- Carga inicial ----------
export async function load() {
  // Si hay URL de Apps Script, intentar cargar en línea
  if (CONFIG.APPS_SCRIPT_URL) {
    try {
      const data = await fetchRemote('list');
      if (data && data.ok) {
        cache = normalize(data.data);
        online = true;
        // respaldar local
        saveLocal(cache);
        notify();
        return cache;
      }
    } catch (e) {
      console.warn('No se pudo conectar a Google Sheets, usando almacenamiento local.', e);
    }
  }
  // Fallback local
  online = false;
  cache = loadLocal() || seed();
  // garantizar todas las tablas
  cache = normalize(cache);
  saveLocal(cache);
  notify();
  return cache;
}

function normalize(data) {
  const out = {};
  for (const t of TABLES) out[t] = Array.isArray(data[t]) ? data[t] : [];
  // Si no hay categorías/tags, sembrar
  if (out.categories.length === 0) out.categories = [...DEFAULT_CATEGORIES];
  if (out.tags.length === 0) out.tags = [...DEFAULT_TAGS];
  return out;
}

// ---------- Remote (Apps Script) ----------
async function fetchRemote(action, payload = {}) {
  const url = CONFIG.APPS_SCRIPT_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
    });
    return await res.json();
  } catch (e) {
    console.error('fetchRemote error', e);
    return null;
  }
}

async function syncRemote() {
  if (!CONFIG.APPS_SCRIPT_URL) return;
  if (syncing) { pendingSync = true; return; }
  syncing = true;
  try {
    const res = await fetchRemote('sync', { data: cache });
    if (res && res.ok) online = true;
    else online = false;
  } catch {
    online = false;
  } finally {
    syncing = false;
    if (pendingSync) { pendingSync = false; syncRemote(); }
    notify();
  }
}

// ---------- API pública ----------
export function getAll() { return cache; }
export function getTable(table) { return (cache && cache[table]) || []; }

export function save(table, record) {
  if (!cache[table]) cache[table] = [];
  const idx = cache[table].findIndex(r => r.id === record.id);
  if (idx >= 0) cache[table][idx] = { ...cache[table][idx], ...record };
  else cache[table].push({ ...record, id: record.id || uid(table.slice(0,3)), createdAt: record.createdAt || nowISO() });
  saveLocal(cache);
  scheduleSync();
  notify();
  return cache[table].find(r => r.id === record.id);
}

export function bulkSave(table, records) {
  cache[table] = records;
  saveLocal(cache);
  scheduleSync();
  notify();
}

export function remove(table, id) {
  cache[table] = cache[table].filter(r => r.id !== id);
  saveLocal(cache);
  scheduleSync();
  notify();
}

export function clearAll() {
  cache = seed();
  saveLocal(cache);
  scheduleSync();
  notify();
}

export function exportData() {
  return JSON.parse(JSON.stringify(cache));
}

export function importData(data) {
  cache = normalize(data);
  saveLocal(cache);
  scheduleSync();
  notify();
}

export function isOnline() { return online; }
export function hasRemote() { return !!CONFIG.APPS_SCRIPT_URL; }

// ---------- Suscripción (reactividad) ----------
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() { listeners.forEach(fn => fn(cache)); }

// ---------- Settings helpers ----------
export function getSetting(key, def = null) {
  const s = getTable('settings').find(x => x.key === key);
  return s ? s.value : def;
}
export function setSetting(key, value) {
  const existing = getTable('settings').find(x => x.key === key);
  if (existing) save('settings', { ...existing, value });
  else save('settings', { id: `set-${key}`, key, value });
}

// ---------- Sincronización debounced ----------
let syncTimer = null;
function scheduleSync() {
  if (!CONFIG.APPS_SCRIPT_URL) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncRemote(), 1200);
}

// ---------- Procesador de pagos programados vencidos ----------
// Ejecuta los pagos automáticos cuya nextDate <= hoy.
export function processScheduled() {
  const today = nowISO().slice(0, 10);
  const scheduled = getTable('scheduled');
  const history = getTable('scheduledHistory');
  let created = 0;
  for (const s of scheduled) {
    if (!s.active) continue;
    while (s.nextDate && s.nextDate <= today) {
      // Crear registro
      const rec = {
        id: uid('rec'),
        type: s.type,
        amount: Number(s.amount) || 0,
        currency: s.currency || 'USD',
        date: s.nextDate,
        accountId: s.accountId || '',
        toAccountId: s.toAccountId || '',
        categoryId: s.categoryId || '',
        tags: s.tags || [],
        note: `${s.name} (automático)`,
        linkedCardId: s.linkedCardId || '',
        scheduledId: s.id,
        createdAt: nowISO(),
      };
      save('records', rec);
      // Actualizar saldo de cuentas
      applyRecordToAccounts(rec);
      // Historial
      save('scheduledHistory', {
        id: uid('hist'),
        scheduledId: s.id,
        recordId: rec.id,
        date: s.nextDate,
        amount: rec.amount,
        status: 'auto',
      });
      created++;
      // Avanzar frecuencia
      if (s.frequency === 'once') {
        s.active = false;
        s.nextDate = '';
        break;
      }
      s.nextDate = advanceDate(s.nextDate, s.frequency);
      if (s.endDate && s.nextDate > s.endDate) { s.active = false; break; }
    }
  }
  // Guardar scheduled actualizado
  bulkSave('scheduled', scheduled);
  return created;
}

function advanceDate(dateISO, freq) {
  const d = new Date(dateISO + 'T00:00:00');
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'biweekly') d.setDate(d.getDate() + 15);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// Aplica un registro a los saldos de las cuentas involucradas
export function applyRecordToAccounts(rec) {
  const accounts = getTable('accounts');
  const sign = rec.type === 'income' ? 1 : rec.type === 'expense' ? -1 : 0;
  if (rec.type === 'transfer') {
    // Transferencia: resta de origen, suma a destino
    if (rec.accountId) {
      const a = accounts.find(x => x.id === rec.accountId);
      if (a) { a.balance = Number(a.balance) - Number(rec.amount); save('accounts', a); }
    }
    if (rec.toAccountId) {
      const b = accounts.find(x => x.id === rec.toAccountId);
      if (b) { b.balance = Number(b.balance) + Number(rec.amount); save('accounts', b); }
    }
    // Si toAccountId vacío = "fuera del tracker", solo resta del origen (ya hecho)
  } else if (rec.accountId && sign !== 0) {
    const a = accounts.find(x => x.id === rec.accountId);
    if (a) {
      a.balance = Number(a.balance) + sign * Number(rec.amount);
      save('accounts', a);
    }
  }
}

// Recalcula saldos de cuentas desde cero a partir de los registros
export function recomputeBalances() {
  const accounts = getTable('accounts');
  const records = getTable('records');
  // Tomar balance inicial declarado (snapshot en createdAt) — para simplificar,
  // reiniciamos al balance actual menos ajuste... Pero como los balances ya se
  // actualizan al crear registros, esto es solo para reconciliar.
  // Implementación: mantener balance actual (declarado) y no recalcular.
  // (El usuario edita el balance manualmente en "Cuentas".)
  return accounts;
}
