// ============================================================
// FinTrack — App principal (router, navegación, shell)
// ============================================================
import * as db from './db.js';
import { CONFIG } from './config.js';
import { icon } from './icons.js';
import { toast, modal, confirm, input, select, field } from './ui.js';
import { fmtMoney, fmtNum, svNow } from './utils.js';

import { renderDashboard } from './views/dashboard.js';
import { renderAccounts, accountForm } from './views/accounts.js';
import { renderRecords, renderRecordForm } from './views/records.js';
import { renderCards } from './views/cards.js';
import { renderScheduled, scheduledForm } from './views/scheduled.js';
import { renderCategories, catForm, tagForm } from './views/categories.js';
import { renderBudgets, budgetForm } from './views/budgets.js';
import { renderDebts, debtForm } from './views/debts.js';
import { renderShopping, itemForm } from './views/shopping.js';
import { renderGoals, goalForm } from './views/goals.js';
import { renderInvestments, invForm } from './views/investments.js';
import { renderWarranties, warrForm } from './views/warranties.js';
import { renderGiftcards, gcForm } from './views/giftcards.js';
import { renderExchange, rateForm } from './views/exchange.js';
import { renderStatsBalance } from './views/stats_balance.js';
import { renderStatsCashflow } from './views/stats_cashflow.js';
import { renderStatsExpenses } from './views/stats_expenses.js';
import { renderStatsCredits } from './views/stats_credits.js';
import { renderStatsAssets } from './views/stats_assets.js';
import { renderStatsPerspective } from './views/stats_perspective.js';

// ---------- Navegación ----------
const NAV = [
  { group: 'General', items: [
    { id: 'dashboard',   label: 'Inicio',             icon: 'home',         sub: 'Resumen global de tus finanzas' },
  ]},
  { group: 'Movimientos', items: [
    { id: 'records',     label: 'Registros',          icon: 'list',         sub: 'Ingresos, egresos y transferencias' },
    { id: 'cards',       label: 'Tarjetas',           icon: 'credit-card',  sub: 'Tus tarjetas de crédito' },
    { id: 'scheduled',   label: 'Pagos programados',  icon: 'repeat',       sub: 'Pagos manuales y automáticos' },
  ]},
  { group: 'Gestión', items: [
    { id: 'accounts',    label: 'Cuentas',            icon: 'wallet',       sub: 'Cuentas, tarjetas y billeteras' },
    { id: 'categories',  label: 'Categorías y etiquetas', icon: 'tag',      sub: 'Organiza tus registros' },
    { id: 'budgets',     label: 'Presupuestos',       icon: 'pie-chart',    sub: 'Límites por categoría' },
    { id: 'debts',       label: 'Deudas',             icon: 'scale',        sub: 'Lo que debes y te deben' },
  ]},
  { group: 'Más', items: [
    { id: 'shopping',    label: 'Lista de compras',   icon: 'cart',         sub: 'Planifica tus compras' },
    { id: 'goals',       label: 'Metas',              icon: 'target',       sub: 'Tus objetivos de ahorro' },
    { id: 'investments', label: 'Inversiones',        icon: 'trending-up',  sub: 'Criptos y activos' },
    { id: 'warranties',  label: 'Garantías',          icon: 'shield',       sub: 'Garantías de productos' },
    { id: 'giftcards',   label: 'Tarjetas de regalo', icon: 'gift',         sub: 'Saldos y códigos' },
    { id: 'exchange',    label: 'Tasa de cambio',     icon: 'exchange',     sub: 'Conversiones de moneda' },
  ]},
  { group: 'Estadísticas', items: [
    { id: 'stats_balance',     label: 'Balance',       icon: 'scale',        sub: 'Patrimonio y activos vs pasivos' },
    { id: 'stats_cashflow',    label: 'Flujo de caja', icon: 'arrow-left-right', sub: 'Ingresos vs egresos mensuales' },
    { id: 'stats_expenses',    label: 'Gastos',        icon: 'arrow-up-right', sub: 'Análisis de gastos por categoría' },
    { id: 'stats_credits',     label: 'Créditos',      icon: 'credit-card',  sub: 'Tarjetas y deudas detalladas' },
    { id: 'stats_assets',      label: 'Activos',       icon: 'coins',        sub: 'Distribución de activos' },
    { id: 'stats_perspective', label: 'Perspectiva',   icon: 'trending-up',  sub: 'Proyecciones y tendencias' },
  ]},
];

const VIEWS = {
  dashboard: renderDashboard,
  records: renderRecords,
  cards: renderCards,
  scheduled: renderScheduled,
  accounts: renderAccounts,
  categories: renderCategories,
  budgets: renderBudgets,
  debts: renderDebts,
  shopping: renderShopping,
  goals: renderGoals,
  investments: renderInvestments,
  warranties: renderWarranties,
  giftcards: renderGiftcards,
  exchange: renderExchange,
  stats_balance: renderStatsBalance,
  stats_cashflow: renderStatsCashflow,
  stats_expenses: renderStatsExpenses,
  stats_credits: renderStatsCredits,
  stats_assets: renderStatsAssets,
  stats_perspective: renderStatsPerspective,
};

// Acción del FAB contextual según la vista actual.
// Cada entrada es una función que abre el formulario correspondiente.
// Si una vista no está aquí, el FAB se oculta.
const FAB_ACTIONS = {
  dashboard:     () => renderRecordForm(null, () => route()),
  records:       () => renderRecordForm(null, () => route()),
  accounts:      () => accountForm(null, () => route()),
  cards:         () => accountForm({ id:'', type:'card', name:'', emoji:'💳', color:'#8b5cf6', balance:0, currency:'USD', last4:'', cutDay:15, payDay:5, creditLimit:0, expiry:'', startingDebt:0, archived:false, createdAt:'' }, () => route()),
  scheduled:     () => scheduledForm(null, () => route()),
  categories:    () => catForm(null, () => route()),
  budgets:       () => budgetForm(null, () => route()),
  debts:         () => debtForm(null, () => route()),
  shopping:      () => itemForm(null, () => route()),
  goals:         () => goalForm(null, () => route()),
  investments:   () => invForm(null, () => route()),
  warranties:    () => warrForm(null, () => route()),
  giftcards:     () => gcForm(null, () => route()),
  exchange:      () => rateForm(null, () => route()),
};

let currentView = 'dashboard';

// ---------- Init ----------
async function init() {
  try {
    // Theme
    const savedTheme = localStorage.getItem('fintrack:theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Cargar DB
    await db.load();
    // Procesar pagos programados vencidos
    const created = db.processScheduled();
    if (created > 0) toast('Pagos automáticos', `${created} pago(s) ejecutado(s) automáticamente.`, 'success');

    // Sidebar nav
    renderSidebar();

    // Listeners
    bindShell();

    // Routing
    window.addEventListener('hashchange', route);
    route();

    // FX pill
    updateFxPill();
    db.subscribe(updateFxPill);
  } catch (e) {
    console.error('[FinTrack] init error', e);
    document.getElementById('viewRoot').innerHTML = `<div class="empty-state"><h3>Error al iniciar</h3><pre style="text-align:left;font-size:11px;white-space:pre-wrap">${String(e && e.stack || e).replace(/</g,'&lt;')}</pre></div>`;
  }
}

function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';
  for (const group of NAV) {
    const g = document.createElement('div');
    g.className = 'nav-group';
    g.textContent = group.group;
    nav.appendChild(g);
    for (const item of group.items) {
      const btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.dataset.view = item.id;
      btn.innerHTML = `${icon(item.icon, 18)} <span>${item.label}</span>`;
      btn.onclick = () => navigate(item.id);
      nav.appendChild(btn);
    }
  }
  updateActiveNav();
}

function updateActiveNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === currentView);
  });
}

function navigate(viewId) {
  if (location.hash !== `#/${viewId}`) {
    location.hash = `#/${viewId}`;
  } else {
    route();
  }
  // cerrar sidebar móvil
  document.getElementById('sidebar').classList.remove('open');
}

function route() {
  const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const view = VIEWS[hash] ? hash : 'dashboard';
  currentView = view;
  // Título
  const meta = NAV.flatMap(g => g.items).find(i => i.id === view);
  document.getElementById('viewTitle').textContent = meta?.label || 'Inicio';
  document.getElementById('viewSubtitle').textContent = meta?.sub || '';
  updateActiveNav();
  // FAB contextual: visible solo si hay acción definida para la vista
  updateFab();
  // Render
  const root = document.getElementById('viewRoot');
  root.innerHTML = '';
  root.scrollTop = 0;
  try {
    VIEWS[view](root);
  } catch (e) {
    console.error('Error renderizando vista', view, e);
    root.innerHTML = `<div class="empty-state"><h3>Error al cargar la vista</h3><p>${e.message}</p></div>`;
  }
}

// Actualiza visibilidad y acción del FAB según la vista actual
function updateFab() {
  const fab = document.getElementById('fabAdd');
  if (!fab) return;
  const action = FAB_ACTIONS[currentView];
  if (action) {
    fab.style.display = '';
    fab.onclick = action;
    // Tooltip contextual
    const labels = {
      dashboard: 'Nuevo registro', records: 'Nuevo registro',
      accounts: 'Nueva cuenta', cards: 'Nueva tarjeta',
      scheduled: 'Nuevo pago programado', categories: 'Nueva categoría',
      budgets: 'Nuevo presupuesto', debts: 'Nueva deuda',
      shopping: 'Nuevo ítem', goals: 'Nueva meta',
      investments: 'Nueva inversión', warranties: 'Nueva garantía',
      giftcards: 'Nueva tarjeta de regalo', exchange: 'Nueva tasa',
    };
    fab.title = labels[currentView] || 'Agregar';
    fab.setAttribute('aria-label', fab.title);
  } else {
    // Vistas sin acción (ej. estadísticas) ocultan el FAB
    fab.style.display = 'none';
  }
}

// ---------- Shell bindings ----------
function bindShell() {
  // Sidebar toggle móvil
  document.getElementById('menuOpen').onclick = () => document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarToggle').onclick = () => document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').onclick = () => document.getElementById('sidebar').classList.remove('open');

  // Theme toggle
  document.getElementById('themeToggle').onclick = toggleTheme;

  // Settings
  document.getElementById('settingsBtn').onclick = openSettings;

  // FAB — la acción se asigna contextualmente en route() / updateFab()
  document.getElementById('fabAdd').onclick = () => renderRecordForm(null, () => route());

  // Sync status update
  db.subscribe(updateSyncStatus);
  updateSyncStatus();
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('fintrack:theme', next);
  db.setSetting('theme', next);
}

function updateSyncStatus() {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (db.hasRemote()) {
    el.classList.remove('offline');
    el.classList.toggle('online', db.isOnline());
    el.querySelector('.sync-text').textContent = db.isOnline() ? 'Sincronizado' : 'Sincronizando…';
  } else {
    el.classList.remove('online');
    el.classList.add('offline');
    el.querySelector('.sync-text').textContent = 'Modo local';
  }
}

function updateFxPill() {
  const el = document.getElementById('fxPillValue');
  if (!el) return;
  const rates = db.getTable('rates');
  const usdBtc = rates.find(r => r.pair === 'USD_BTC');
  if (usdBtc) {
    const btc = 1 / Number(usdBtc.rate);
    el.textContent = `₿${fmtNum(btc, 8)}`;
  } else {
    el.textContent = '—';
  }
}

// ---------- Settings modal ----------
function openSettings() {
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:16px';

  const urlInput = input({ value: CONFIG.APPS_SCRIPT_URL, placeholder: 'https://script.google.com/macros/s/.../exec' });
  const sheetInput = input({ value: CONFIG.SHEET_ID, placeholder: 'ID del Google Sheet (opcional)' });
  const baseCur = select(
    [{value:'USD',label:'USD — Dólar'},{value:'EUR',label:'EUR — Euro'},{value:'SVC',label:'SVC — Colón'}],
    CONFIG.BASE_CURRENCY
  );

  // Aviso si la URL está en config.js (no se puede cambiar desde aquí)
  const urlInConfig = CONFIG.APPS_SCRIPT_URL !== '';
  if (urlInConfig) {
    const notice = document.createElement('div');
    notice.style.cssText = 'background:var(--primary-soft);border:1px solid var(--primary);border-radius:8px;padding:12px;font-size:12px;color:var(--text-muted)';
    notice.innerHTML = `<strong style="color:var(--primary)">✓ Conectado a Google Sheets</strong><br/>La URL está configurada en <code style="background:var(--surface-2);padding:2px 6px;border-radius:4px">config.js</code> y funciona en todos los dispositivos. Para cambiarla, edita ese archivo.`;
    body.appendChild(notice);
  }

  body.appendChild(field({
    label: 'URL de Apps Script',
    hint: urlInConfig
      ? 'Ya configurada en config.js. Para multi-dispositivo, mantén la URL en config.js (no aquí).'
      : 'Pega la URL /exec. Para multi-dispositivo, ponla en config.js. Vacío = modo local (solo este navegador).',
    input: urlInput,
  }));
  body.appendChild(field({
    label: 'ID del Google Sheet',
    hint: 'Opcional, solo referencia.',
    input: sheetInput,
  }));
  body.appendChild(field({
    label: 'Moneda base',
    input: baseCur,
  }));

  // Export/import
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
  const exp = document.createElement('button');
  exp.className = 'btn btn-sm';
  exp.innerHTML = `${icon('download',14)} Exportar JSON`;
  exp.onclick = () => {
    const data = db.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fintrack-backup-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast('Exportado', 'Respaldo descargado.', 'success');
  };
  const imp = document.createElement('button');
  imp.className = 'btn btn-sm';
  imp.innerHTML = `${icon('upload',14)} Importar JSON`;
  imp.onclick = () => {
    const f = document.createElement('input');
    f.type = 'file'; f.accept = '.json';
    f.onchange = async () => {
      const file = f.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        db.importData(data);
        toast('Importado', 'Datos restaurados.', 'success');
        route();
      } catch (e) { toast('Error', 'Archivo inválido.', 'error'); }
    };
    f.click();
  };
  const clr = document.createElement('button');
  clr.className = 'btn btn-sm btn-danger';
  clr.innerHTML = `${icon('trash',14)} Restablecer datos`;
  clr.onclick = async () => {
    const ok = await confirm({ title: 'Restablecer', message: 'Se borrarán todos tus datos y se cargarán los de ejemplo. ¿Continuar?', danger: true, confirmText: 'Sí, restablecer' });
    if (ok) { db.clearAll(); toast('Restablecido', 'Datos de ejemplo cargados.', 'success'); route(); }
  };
  actions.appendChild(exp);
  actions.appendChild(imp);
  actions.appendChild(clr);
  body.appendChild(actions);

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';
  const cancel = document.createElement('button');
  cancel.className = 'btn'; cancel.textContent = 'Cancelar';
  const save = document.createElement('button');
  save.className = 'btn btn-primary'; save.innerHTML = `${icon('check',16)} Guardar`;
  cancel.onclick = () => m.close();
  save.onclick = () => {
    const newUrl = urlInput.value.trim();
    // Si la URL ya estaba en config.js, no la sobrescribimos en localStorage
    // (config.js tiene prioridad para multi-dispositivo)
    if (!urlInConfig) {
      CONFIG.APPS_SCRIPT_URL = newUrl;
    }
    CONFIG.SHEET_ID = sheetInput.value.trim();
    CONFIG.BASE_CURRENCY = baseCur.value;
    // persistir en settings (solo si no está hardcoded en config.js)
    if (!urlInConfig) {
      db.setSetting('appsScriptUrl', CONFIG.APPS_SCRIPT_URL);
    }
    db.setSetting('sheetId', CONFIG.SHEET_ID);
    db.setSetting('baseCurrency', CONFIG.BASE_CURRENCY);
    localStorage.setItem('fintrack:cfg', JSON.stringify({ APPS_SCRIPT_URL: CONFIG.APPS_SCRIPT_URL, SHEET_ID: CONFIG.SHEET_ID, BASE_CURRENCY: CONFIG.BASE_CURRENCY }));
    m.close();
    toast('Configuración guardada', db.hasRemote() ? 'Recarga la página para sincronizar con Google Sheets.' : 'Usando modo local.', 'success');
    updateSyncStatus();
  };
  footer.appendChild(cancel);
  footer.appendChild(save);

  const m = modal({
    title: 'Configuración',
    size: 'lg',
    body,
    footer,
  });
}

// Cargar config persistida al arrancar.
// Prioridad: config.js (hardcoded) > localStorage (override temporal).
// Si la URL ya está en config.js, se usa esa (funciona en todos los dispositivos).
// Si no está en config.js pero sí en localStorage, se usa la de localStorage.
function loadPersistedConfig() {
  try {
    const raw = localStorage.getItem('fintrack:cfg');
    if (raw) {
      const c = JSON.parse(raw);
      // Solo usar localStorage si config.js NO tiene la URL hardcoded
      if (!CONFIG.APPS_SCRIPT_URL && c.APPS_SCRIPT_URL) CONFIG.APPS_SCRIPT_URL = c.APPS_SCRIPT_URL;
      if (!CONFIG.SHEET_ID && c.SHEET_ID) CONFIG.SHEET_ID = c.SHEET_ID;
      if (c.BASE_CURRENCY) CONFIG.BASE_CURRENCY = c.BASE_CURRENCY;
    }
  } catch {}
}
loadPersistedConfig();

// ---------- Bootstrap ----------
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
