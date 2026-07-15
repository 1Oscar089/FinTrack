// ============================================================
// FinTrack — Configuración
// ============================================================
// Para conectar tu Google Sheet (y que funcione en TODOS los dispositivos):
//   1. Abre tu Google Sheet (o crea uno nuevo).
//   2. Extensiones → Apps Script.
//   3. Pega el contenido de google-apps-script/Code.gs.
//   4. Despliega → "Nueva implementación" → tipo "App web".
//      - Ejecutar como: Tú
//      - Quién tiene acceso: Cualquiera
//   5. Copia la URL /exec y pégala abajo en APPS_SCRIPT_URL.
//
// IMPORTANTE: La URL debe ir aquí en config.js (NO solo en la app via ⚙️)
// para que funcione en cualquier dispositivo. Si la pones solo en la app,
// se guarda en localStorage de ese navegador y no se comparte.
//
// Si APPS_SCRIPT_URL queda vacío, la app usará almacenamiento local
// (localStorage) y solo funcionará en este dispositivo/navegador.

export const CONFIG = {
  // 👇 Pega aquí tu URL de despliegue de Apps Script (termina en /exec)
  // Ejemplo: 'https://script.google.com/macros/s/AKfycbx.../exec'
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwwVQu3Ye8Cjz96raql2sIdeEQYjFRJurc9ivkX9etWsOxjU8ZECVlJ3kVll4rGsfyCLQ/exec',

  // ID del sheet (solo referencia informativa)
  SHEET_ID: '',

  // Moneda base y secundaria
  BASE_CURRENCY: 'USD',
  ALT_CURRENCY: 'BTC',

  // Zona horaria del usuario (El Salvador por defecto)
  TIMEZONE: 'America/El_Salvador',

  // Días de gracia para considerar una tarjeta "vencida"
  CARD_GRACE_DAYS: 0,

  // Color por defecto para nuevas cuentas
  DEFAULT_ACCOUNT_COLOR: '#10b981',
};

// Tipos de cuenta disponibles
export const ACCOUNT_TYPES = {
  cash:    { label: 'Efectivo',         emoji: '💵', color: '#10b981', icon: 'wallet' },
  bank:    { label: 'Cuenta bancaria',  emoji: '🏦', color: '#0ea5e9', icon: 'landmark' },
  card:    { label: 'Tarjeta de crédito', emoji: '💳', color: '#8b5cf6', icon: 'credit-card' },
  wallet:  { label: 'Billetera digital', emoji: '📱', color: '#f59e0b', icon: 'smartphone' },
  savings: { label: 'Ahorros (no en balance)', emoji: '🐷', color: '#14b8a6', icon: 'savings' },
};

// Tipos de registro
export const RECORD_TYPES = {
  income:      { label: 'Ingreso',      icon: 'arrow-down-left', color: '#10b981', sign: 1 },
  expense:     { label: 'Egreso',       icon: 'arrow-up-right',  color: '#ef4444', sign: -1 },
  transfer:    { label: 'Transferencia',icon: 'arrow-left-right', color: '#06b6d4', sign: 0 },
};

// Tipos de deudas
export const DEBT_TYPES = {
  owe:      { label: 'Yo debo',     color: '#ef4444' },
  owed:     { label: 'Me deben',    color: '#10b981' },
};

// Frecuencias de pago programado
export const FREQUENCIES = {
  once:       { label: 'Una vez',       days: 0 },
  weekly:     { label: 'Semanal',       days: 7 },
  biweekly:   { label: 'Quincenal',     days: 15 },
  monthly:    { label: 'Mensual',       days: 30 },
  quarterly:  { label: 'Trimestral',    days: 90 },
  yearly:     { label: 'Anual',         days: 365 },
};

// Categorías por defecto
export const DEFAULT_CATEGORIES = [
  { id: 'cat-salary',  name: 'Salario',        type: 'income',  color: '#10b981', emoji: '💼' },
  { id: 'cat-freelance', name: 'Freelance',    type: 'income',  color: '#22c55e', emoji: '💻' },
  { id: 'cat-invest',  name: 'Inversiones',    type: 'income',  color: '#14b8a6', emoji: '📈' },
  { id: 'cat-food',    name: 'Comida',         type: 'expense', color: '#f59e0b', emoji: '🍔' },
  { id: 'cat-transport', name: 'Transporte',   type: 'expense', color: '#06b6d4', emoji: '🚗' },
  { id: 'cat-home',    name: 'Hogar',          type: 'expense', color: '#8b5cf6', emoji: '🏠' },
  { id: 'cat-services', name: 'Servicios',     type: 'expense', color: '#ec4899', emoji: '💡' },
  { id: 'cat-health',  name: 'Salud',          type: 'expense', color: '#ef4444', emoji: '⚕️' },
  { id: 'cat-fun',     name: 'Entretenimiento',type: 'expense', color: '#f97316', emoji: '🎮' },
  { id: 'cat-shopping', name: 'Compras',       type: 'expense', color: '#eab308', emoji: '🛍️' },
  { id: 'cat-edu',     name: 'Educación',      type: 'expense', color: '#3b82f6', emoji: '📚' },
  { id: 'cat-cardpay', name: 'Pago de tarjeta',type: 'expense', color: '#64748b', emoji: '💳' },
];

// Etiquetas por defecto
export const DEFAULT_TAGS = [
  { id: 'tag-ess', name: 'Esencial',    color: '#10b981' },
  { id: 'tag-rec', name: 'Recurrente',  color: '#06b6d4' },
  { id: 'tag-imp', name: 'Impulso',     color: '#f59e0b' },
  { id: 'tag-bus', name: 'Negocio',     color: '#8b5cf6' },
];

// Criptomonedas soportadas (para inversiones)
export const CRYPTOS = [
  { id: 'bitcoin',  symbol: 'BTC', name: 'Bitcoin',  color: '#f7931a' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#627eea' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB',   color: '#f3ba2f' },
  { id: 'solana',   symbol: 'SOL', name: 'Solana',   color: '#14f195' },
  { id: 'ripple',   symbol: 'XRP', name: 'XRP',      color: '#23292f' },
  { id: 'cardano',  symbol: 'ADA', name: 'Cardano',  color: '#0033ad' },
  { id: 'dogecoin', symbol: 'DOGE',name: 'Dogecoin', color: '#c2a633' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', color: '#e6007a' },
  { id: 'tron',     symbol: 'TRX', name: 'TRON',     color: '#ff060a' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', color: '#345d9d' },
];
