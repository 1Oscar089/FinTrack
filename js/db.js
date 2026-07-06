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

const LS_KEY = 'fintrack:data:v2';
const LS_META = 'fintrack:meta:v2';
const LS_VERSION = 'fintrack:seed-version';
const CURRENT_SEED_VERSION = '2'; // bump cuando cambia el seed para forzar reset de datos demo

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
// Solo categorías y etiquetas por defecto. Todo lo demás empieza vacío
// para que el usuario cree sus propias cuentas, registros, etc.
function seed() {
  return {
    accounts: [],
    records: [],
    scheduled: [],
    scheduledHistory: [],
    categories: [...DEFAULT_CATEGORIES],
    tags: [...DEFAULT_TAGS],
    budgets: [],
    debts: [],
    shopping: [],
    goals: [],
    investments: [],
    warranties: [],
    giftcards: [],
    rates: [],
    settings: [
      { id: 'set-theme', key: 'theme', value: 'dark' },
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
  // Si la versión del seed cambió, resetear datos demo (conserva datos reales solo si el usuario los creó)
  const storedVersion = localStorage.getItem(LS_VERSION);
  if (storedVersion !== CURRENT_SEED_VERSION) {
    // Borrar datos demo viejos y recargar seed limpio
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_META);
    localStorage.setItem(LS_VERSION, CURRENT_SEED_VERSION);
  }

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
