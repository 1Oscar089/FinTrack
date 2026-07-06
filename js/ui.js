// ============================================================
// FinTrack — Componentes UI (modal, toast, confirm, form helpers)
// ============================================================
import { icon } from './icons.js';

// ---------- Toast ----------
export function toast(title, msg = '', type = 'info', duration = 3200) {
  const root = document.getElementById('toastRoot');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: 'check-circle', error: 'alert', warning: 'alert', info: 'info' };
  el.innerHTML = `
    <span class="toast-icon" style="color:var(--${type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'info'})">
      ${icon(icons[type] || 'info', 18)}
    </span>
    <div style="flex:1;min-width:0">
      <div class="toast-title">${escape(title)}</div>
      ${msg ? `<div class="toast-msg">${escape(msg)}</div>` : ''}
    </div>
    <button class="toast-close icon-btn" style="width:24px;height:24px">${icon('x', 14)}</button>
  `;
  root.appendChild(el);
  const close = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('.toast-close').onclick = close;
  if (duration > 0) setTimeout(close, duration);
  return { close };
}

// ---------- Modal ----------
let modalStack = [];

export function modal({ title, body, footer, size = '', onClose, closable = true }) {
  const root = document.getElementById('modalRoot');
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const box = document.createElement('div');
  box.className = `modal ${size ? 'modal-' + size : ''}`;
  box.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${escape(title)}</h3>
      ${closable ? `<button class="icon-btn modal-close">${icon('x', 18)}</button>` : ''}
    </div>
    <div class="modal-body"></div>
    ${footer ? `<div class="modal-footer"></div>` : ''}
  `;
  const bodyEl = box.querySelector('.modal-body');
  const footerEl = box.querySelector('.modal-footer');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);
  if (footer) {
    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else if (footer instanceof Node) footerEl.appendChild(footer);
  }
  const wrap = document.createElement('div');
  wrap.appendChild(back);
  wrap.appendChild(box);
  root.appendChild(wrap);
  modalStack.push(wrap);

  const close = () => {
    wrap.style.opacity = '0';
    setTimeout(() => { wrap.remove(); modalStack = modalStack.filter(x => x !== wrap); }, 160);
    if (onClose) onClose();
  };
  box.querySelector('.modal-close')?.addEventListener('click', close);
  back.addEventListener('click', () => { if (closable) close(); });
  // ESC para cerrar el último modal
  const onKey = (e) => { if (e.key === 'Escape' && closable && modalStack[modalStack.length-1] === wrap) { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  return { el: box, close, body: bodyEl, footer: footerEl };
}

// ---------- Confirm ----------
export function confirm({ title = 'Confirmar', message = '¿Estás seguro?', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
  return new Promise(resolve => {
    let resolved = false;
    const m = modal({
      title,
      size: 'sm',
      body: `<p style="margin:0;color:var(--text-muted);font-size:13.5px;line-height:1.6">${escape(message)}</p>`,
      footer: `
        <button class="btn cancel-btn">${escape(cancelText)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} confirm-btn">${escape(confirmText)}</button>
      `,
      onClose: () => { if (!resolved) { resolved = true; resolve(false); } },
    });
    m.el.querySelector('.cancel-btn').onclick = () => { if (!resolved) { resolved = true; resolve(false); } m.close(); };
    m.el.querySelector('.confirm-btn').onclick = () => { if (!resolved) { resolved = true; resolve(true); } m.close(); };
  });
}

// ---------- Form helpers ----------
export function field({ label, hint, input, required }) {
  const div = document.createElement('div');
  div.className = 'field';
  div.innerHTML = `
    ${label ? `<label class="field-label">${escape(label)}${required ? ' <span style="color:var(--danger)">*</span>' : ''}</label>` : ''}
    <div class="field-input"></div>
    ${hint ? `<span class="field-hint">${escape(hint)}</span>` : ''}
  `;
  const slot = div.querySelector('.field-input');
  if (typeof input === 'string') slot.innerHTML = input;
  else if (input instanceof Node) slot.appendChild(input);
  return div;
}

export function input(props = {}) {
  const i = document.createElement('input');
  i.className = 'input';
  i.type = props.type || 'text';
  if (props.value != null) i.value = props.value;
  if (props.placeholder) i.placeholder = props.placeholder;
  if (props.step) i.step = props.step;
  if (props.min != null) i.min = props.min;
  if (props.max != null) i.max = props.max;
  if (props.id) i.id = props.id;
  if (props.name) i.name = props.name;
  if (props.required) i.required = true;
  return i;
}

export function select(options = [], value = '', props = {}) {
  const s = document.createElement('select');
  s.className = 'select';
  if (props.id) s.id = props.id;
  if (props.required) s.required = true;
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === value) o.selected = true;
    s.appendChild(o);
  }
  return s;
}

export function textarea(value = '', props = {}) {
  const t = document.createElement('textarea');
  t.className = 'textarea';
  t.value = value;
  if (props.placeholder) t.placeholder = props.placeholder;
  if (props.id) t.id = props.id;
  return t;
}

// ---------- Empty state ----------
export function emptyState({ icon: iconName = 'inbox', title, message, action }) {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    ${icon(iconName, 40)}
    <h3>${escape(title)}</h3>
    ${message ? `<p>${escape(message)}</p>` : ''}
  `;
  if (action) {
    const btnWrap = document.createElement('div');
    btnWrap.style.marginTop = '8px';
    btnWrap.appendChild(action);
    div.appendChild(btnWrap);
  }
  return div;
}

// ---------- Skeleton ----------
export function skeletonCard() {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <div class="skeleton" style="height:14px;width:40%;margin-bottom:12px"></div>
    <div class="skeleton" style="height:24px;width:60%;margin-bottom:18px"></div>
    <div class="skeleton" style="height:10px;width:100%;margin-bottom:8px"></div>
    <div class="skeleton" style="height:10px;width:80%"></div>
  `;
  return div;
}

// ---------- Segmented control ----------
export function segmented(options, value, onChange) {
  const seg = document.createElement('div');
  seg.className = 'segmented';
  for (const opt of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = opt.label;
    if (opt.value === value) b.classList.add('active');
    b.onclick = () => {
      seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      onChange(opt.value);
    };
    seg.appendChild(b);
  }
  return seg;
}

// ---------- Color picker simple ----------
export function colorPicker(value, colors) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  const custom = document.createElement('input');
  custom.type = 'color';
  custom.value = value || '#10b981';
  custom.style.cssText = 'width:38px;height:38px;border:1px solid var(--border);border-radius:8px;background:transparent;cursor:pointer;padding:2px';
  const swatches = document.createElement('div');
  swatches.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
  for (const c of colors) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.style.cssText = `width:28px;height:28px;border-radius:50%;border:2px solid ${c === value ? 'var(--text)' : 'transparent'};background:${c};cursor:pointer;transition:all 160ms`;
    sw.onclick = () => {
      custom.value = c;
      swatches.querySelectorAll('button').forEach(x => x.style.borderColor = 'transparent');
      sw.style.borderColor = 'var(--text)';
      wrap.dataset.value = c;
    };
    swatches.appendChild(sw);
  }
  custom.oninput = () => {
    wrap.dataset.value = custom.value;
    swatches.querySelectorAll('button').forEach(x => x.style.borderColor = 'transparent');
  };
  wrap.dataset.value = value || '#10b981';
  wrap.appendChild(custom);
  wrap.appendChild(swatches);
  wrap.getValue = () => wrap.dataset.value;
  return wrap;
}

// ---------- Emoji picker simple ----------
export function emojiPicker(value, emojis) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;max-width:100%';
  const custom = document.createElement('input');
  custom.className = 'input';
  custom.value = value || '';
  custom.placeholder = 'Emoji';
  custom.style.cssText = 'max-width:80px;text-align:center;font-size:18px';
  for (const e of emojis) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e;
    b.style.cssText = `width:36px;height:36px;border-radius:8px;border:2px solid ${e === value ? 'var(--primary)' : 'var(--border)'};background:var(--surface-2);cursor:pointer;font-size:18px`;
    b.onclick = () => {
      custom.value = e;
      wrap.dataset.value = e;
      wrap.querySelectorAll('button').forEach(x => x.style.borderColor = 'var(--border)');
      b.style.borderColor = 'var(--primary)';
    };
    wrap.appendChild(b);
  }
  custom.oninput = () => { wrap.dataset.value = custom.value; };
  wrap.dataset.value = value || '';
  wrap.appendChild(custom);
  wrap.getValue = () => wrap.dataset.value;
  return wrap;
}

// ---------- Helpers ----------
function escape(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
