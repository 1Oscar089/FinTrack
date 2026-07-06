// ============================================================
// FinTrack — Helpers compartidos para gráficas de estadísticas
// ============================================================
import { fmtMoney } from '../utils.js';

const chartInstances = {};

export function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function textColor() {
  return isDark() ? '#9aa8a1' : '#5c6b64';
}

export function gridColor() {
  return isDark() ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
}

// Renderiza o reemplaza un chart en un canvas dado
export function chart(canvasId, config) {
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  chartInstances[canvasId] = new Chart(canvas, config);
  return chartInstances[canvasId];
}

export function standardOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: textColor(), font: { size: 11 }, boxWidth: 12 } },
      tooltip: { callbacks: { label: c => `${c.dataset.label || ''}: ${fmtMoney(c.parsed.y ?? c.parsed)}`.trim() } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor(), font: { size: 11 } } },
      y: { grid: { color: gridColor() }, ticks: { color: textColor(), font: { size: 11 }, callback: v => fmtMoney(v, undefined, { compact: true }) } },
    },
  };
}

// Genera serie mensual de los últimos N meses a partir de records filtrados
export function monthlySeries(records, months, type) {
  return months.map(mo => records
    .filter(r => r.type === type && r.date && r.date.slice(0,7) === `${mo.y}-${String(mo.m+1).padStart(2,'0')}`)
    .reduce((s,r) => s + Number(r.amount||0), 0));
}

// KPI card HTML
export function kpiHTML(label, value, opts = {}) {
  const { icon: iconName = '', cls = '', delta = '', deltaCls = '', iconColor = '' } = opts;
  const iconBg = iconColor ? `style="background:${iconColor}22;color:${iconColor}"` : '';
  return `
    <div class="kpi">
      <div class="kpi-label">${iconName ? `${iconSvg(iconName,16)} ` : ''}${label}</div>
      <div class="kpi-value ${cls}">${value}</div>
      ${delta ? `<div class="kpi-delta ${deltaCls}">${delta}</div>` : ''}
      ${iconName ? `<div class="kpi-icon" ${iconBg}>${iconSvg(iconName,16)}</div>` : ''}
    </div>
  `;
}

// Helper para importar icon en plantillas (importado dinámicamente en cada vista)
import { icon as iconSvg } from '../icons.js';
