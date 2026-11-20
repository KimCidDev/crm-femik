// Utilitários de interface: escape, formatação, ícones, modal, toast.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const moneyFmt = {};
export function money(value, currency = 'BRL', decimals = 0) {
  if (value === null || value === undefined || value === '' || isNaN(Number(value))) return '—';
  const key = currency + decimals;
  moneyFmt[key] = moneyFmt[key] || new Intl.NumberFormat('pt-BR', { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return moneyFmt[key].format(Number(value));
}
export function moneyTotals(rows, valueKey = 'value', currencyKey = 'currency') {
  const t = {};
  for (const r of rows) {
    const v = Number(r[valueKey]);
    if (!v) continue;
    t[r[currencyKey] || 'BRL'] = (t[r[currencyKey] || 'BRL'] || 0) + v;
  }
  return t;
}
export function totalsText(t) {
  const parts = ['BRL', 'CAD', 'EUR'].filter((c) => t[c]).map((c) => money(t[c], c));
  return parts.length ? parts.join(' · ') : '—';
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Data local (AAAA-MM-DD) de um timestamp ISO — evita erro de fuso horário.
export function localDate(v) {
  if (!v) return '';
  if (v.length === 10) return v;
  const d = new Date(v);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
export function fmtDate(v, withYear = true) {
  if (!v) return '—';
  const d = v.length === 10 ? new Date(v + 'T12:00:00') : new Date(v);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR', withYear ? { day: '2-digit', month: 'short', year: 'numeric' } : { day: '2-digit', month: 'short' }).replace(/\./g, '');
}
export function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\./g, '');
}
export function relDays(dateStr) {
  if (!dateStr) return '';
  const a = new Date(todayStr() + 'T12:00:00');
  const b = new Date(localDate(dateStr) + 'T12:00:00');
  const n = Math.round((b - a) / 86400000);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}
export function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
export const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
export const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
export const waLink = (num, text = '') => `https://wa.me/${onlyDigits(num)}${text ? '?text=' + encodeURIComponent(text) : ''}`;

export function opts(list, selected, { empty } = {}) {
  const items = list.map((o) => (typeof o === 'string' ? { id: o, label: o } : o));
  return (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') +
    items.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(selected ?? '') ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
}

// --- ícones (traço simples, 24x24) -----------------------------------------
const P = {
  painel: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  funil: 'M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z',
  leads: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9',
  tarefas: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  propostas: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  clientes: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18',
  relatorios: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  equipe: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a8 8 0 0 1 16 0v1',
  config: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  mais: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  whatsapp: 'M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5zM9 8.5c0 3 2.5 6.5 6.5 6.5l1-1.6-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2z',
  back: 'M15 18l-6-6 6-6',
  x: 'M18 6L6 18M6 6l12 12',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 21V9M7 14l5-5 5 5M5 3h14',
  check: 'M5 12l5 5L20 7',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  share: 'M12 3v12M8 7l4-4 4 4M6 10H5v11h14V10h-1',
  plussq: 'M4 4h16v16H4zM12 8v8M8 12h8',
  dots: 'M12 5h.01M12 12h.01M12 19h.01',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name] || ''}"/></svg>`;

// --- toast ------------------------------------------------------------------
export function toast(msg, kind = 'ok') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), kind === 'err' ? 5200 : 2600);
  setTimeout(() => el.remove(), kind === 'err' ? 5600 : 3000);
}

// --- modal ------------------------------------------------------------------
// openModal({ title, body, onSubmit(form) => true|false|Promise, submitLabel, danger })
export function openModal({ title, body, onSubmit, submitLabel = 'Salvar', danger = false, wide = false, onOpen }) {
  closeModal();
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <form class="modal-form" novalidate>
        <header class="modal-head">
          <h2 id="modal-title">${esc(title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button>
        </header>
        <div class="modal-body">${body}</div>
        ${onSubmit ? `<footer class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submitLabel)}</button>
        </footer>` : ''}
      </form>
    </div>`;
  root.classList.add('open');
  document.body.classList.add('modal-open');
  const form = $('form', root);
  $$('[data-close]', root).forEach((b) => b.addEventListener('click', closeModal));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    const firstInvalid = $$('[required]', form).find((el) => !String(el.value).trim());
    if (firstInvalid) { firstInvalid.focus(); firstInvalid.classList.add('invalid'); toast('Preencha os campos obrigatórios.', 'err'); return; }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      const ok = await onSubmit(form);
      if (ok !== false) closeModal();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Algo deu errado.', 'err');
    } finally { btn.disabled = false; }
  });
  if (onOpen) onOpen(form);
  const first = $('input:not([type=hidden]),select,textarea', form);
  if (first && window.matchMedia('(pointer:fine)').matches) first.focus();
  return form;
}
export function closeModal() {
  const root = $('#modal-root');
  if (!root) return;
  root.classList.remove('open');
  root.innerHTML = '';
  document.body.classList.remove('modal-open');
}
export function confirmDialog(title, text, { label = 'Confirmar', danger = true } = {}) {
  return new Promise((resolve) => {
    openModal({
      title, body: `<p class="muted">${esc(text)}</p>`, submitLabel: label, danger,
      onSubmit: () => { resolve(true); return true; },
    });
    $$('#modal-root [data-close]').forEach((b) => b.addEventListener('click', () => resolve(false)));
  });
}
export const formData = (form) => Object.fromEntries(new FormData(form).entries());

export function field(label, inner, { hint, full } = {}) {
  return `<label class="field ${full ? 'full' : ''}"><span class="field-label">${esc(label)}</span>${inner}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</label>`;
}

export function downloadBlob(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// CSV com separador ";" e BOM UTF-8 — abre direto no Excel em português.
export function toCSV(rows, columns) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => cell(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(';'));
  return '﻿' + [head, ...body].join('\r\n');
}

export function avatar(profile, size = '') {
  const name = profile ? profile.name : '?';
  return `<span class="avatar ${size}" title="${esc(name)}">${esc(initials(name))}</span>`;
}

export function emptyState(text, action = '') {
  return `<div class="empty">${esc(text)}${action ? `<div class="empty-action">${action}</div>` : ''}</div>`;
}

// --- tema claro / escuro ------------------------------------------------------
const THEME_KEY = 'femik-crm-theme';
export function currentTheme() { return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'; }
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f5fb' : '#07060f');
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* sem armazenamento */ }
  const b = document.querySelector('.theme-toggle');
  if (b) {
    const next = theme === 'light' ? 'escuro' : 'claro';
    b.innerHTML = icon(theme === 'light' ? 'moon' : 'sun');
    b.setAttribute('aria-label', `Mudar para o modo ${next}`);
    b.title = `Modo ${next}`;
  }
}
export function themeToggle() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'theme-toggle';
  b.addEventListener('click', () => applyTheme(currentTheme() === 'light' ? 'dark' : 'light'));
  document.body.appendChild(b);
  applyTheme(currentTheme());
}
