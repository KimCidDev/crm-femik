// Gestão de propostas: lista, editor e geração de PDF (impressão do navegador).

import { store } from '../store.js';
import { PROPOSAL_STATUS, CURRENCIES, proposalStatusLabel, unitLabel } from '../data.js';
import { esc, icon, opts, money, fmtDate, todayStr, addDays, daysSince, toast, confirmDialog, emptyState, field, $, $$ } from '../ui.js';
import { proposalTotal, proposalMonthly, proposalTotalText, contractForm } from '../forms.js';

const LANGS = [{ id: 'pt', label: 'Português' }, { id: 'en', label: 'English' }, { id: 'es', label: 'Español' }];
const LANG_BY_COUNTRY = { 'Brasil': 'pt', 'Canadá': 'en', 'Espanha': 'es' };
const DEFAULT_TERMS = {
  pt: '50% na aprovação da proposta e 50% na entrega. Prazo estimado a combinar após o briefing. Inclui até 2 rodadas de ajustes. Valores sem impostos.',
  en: '50% upon approval and 50% upon delivery. Timeline to be agreed after the briefing. Includes up to 2 rounds of revisions. Prices exclude taxes.',
  es: '50% a la aprobación y 50% a la entrega. Plazo a definir tras el briefing. Incluye hasta 2 rondas de ajustes. Precios sin impuestos.',
};
const L = {
  pt: { title: 'Proposta comercial', for: 'Para', date: 'Data', valid: 'Válida até', item: 'Serviço', qty: 'Qtd.', price: 'Valor unit.', sub: 'Subtotal', total: 'Total', terms: 'Condições', contact: 'Contato', monthly: '/mês', hour: '/hora' },
  en: { title: 'Business proposal', for: 'Prepared for', date: 'Date', valid: 'Valid until', item: 'Service', qty: 'Qty', price: 'Unit price', sub: 'Subtotal', total: 'Total', terms: 'Terms', contact: 'Contact', monthly: '/month', hour: '/hour' },
  es: { title: 'Propuesta comercial', for: 'Para', date: 'Fecha', valid: 'Válida hasta', item: 'Servicio', qty: 'Cant.', price: 'Precio unit.', sub: 'Subtotal', total: 'Total', terms: 'Condiciones', contact: 'Contacto', monthly: '/mes', hour: '/hora' },
};

export async function newProposal(leadId) {
  const lead = store.get('leads', leadId);
  const year = new Date().getFullYear();
  const n = store.all('proposals').filter((p) => (p.number || '').startsWith(`FMK-${year}-`)).length + 1;
  const lang = LANG_BY_COUNTRY[lead.country] || 'pt';
  return store.insert('proposals', {
    lead_id: leadId, number: `FMK-${year}-${String(n).padStart(3, '0')}`, title: lead.service_interest ? `${lead.service_interest} — ${lead.company}` : `Proposta — ${lead.company}`,
    status: 'rascunho', currency: lead.currency || 'BRL', language: lang, items: [], sent_at: null, valid_until: addDays(todayStr(), 15),
    notes: DEFAULT_TERMS[lang],
  });
}

// --- lista -----------------------------------------------------------------
const filters = { status: '' };
export function renderList(el, { navigate, refresh }) {
  const rows = store.all('proposals').filter((p) => !filters.status || p.status === filters.status)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  el.innerHTML = `
    <header class="page-head"><div><h1>Propostas</h1><p class="muted">Crie a proposta a partir da ficha do cliente (aba Propostas).</p></div></header>
    <div class="filters"><select id="f-status">${opts(PROPOSAL_STATUS, filters.status, { empty: 'Todos os status' })}</select></div>
    <div class="card table-card">${rows.length ? `<table class="list">
      <thead><tr><th>Proposta</th><th>Cliente</th><th>Status</th><th>Envio</th><th>Validade</th><th class="num">Total</th></tr></thead>
      <tbody>${rows.map((p) => {
        const lead = store.get('leads', p.lead_id);
        const waiting = p.status === 'enviada' && p.sent_at && daysSince(p.sent_at) >= 7;
        const expired = ['enviada', 'negociacao'].includes(p.status) && p.valid_until && p.valid_until < todayStr();
        return `<tr data-id="${p.id}" tabindex="0">
          <td data-l="Proposta"><strong>${esc(p.number)}</strong><div class="muted small">${esc(p.title)}</div></td>
          <td data-l="Cliente">${esc(lead ? lead.company : '—')}</td>
          <td data-l="Status"><span class="pstatus ps-${p.status}">${esc(proposalStatusLabel(p.status))}</span>
            ${waiting ? `<div class="late-text small">sem retorno há ${daysSince(p.sent_at)} dias</div>` : ''}${expired ? '<div class="late-text small">validade vencida</div>' : ''}</td>
          <td data-l="Envio">${fmtDate(p.sent_at)}</td><td data-l="Validade">${fmtDate(p.valid_until)}</td>
          <td data-l="Total" class="num">${esc(proposalTotalText(p))}</td></tr>`;
      }).join('')}</tbody></table>` : emptyState('Nenhuma proposta ainda.')}</div>`;
  $('#f-status', el).addEventListener('change', (e) => { filters.status = e.target.value; refresh(); });
  $$('tbody tr', el).forEach((tr) => tr.addEventListener('click', () => navigate(`#/proposta/${tr.dataset.id}`)));
}

// --- editor ----------------------------------------------------------------
export function renderEditor(el, { params, navigate, refresh }) {
  const p = store.get('proposals', params.id);
  if (!p) { el.innerHTML = `<div class="card">${emptyState('Proposta não encontrada.')}</div>`; return; }
  const lead = store.get('leads', p.lead_id);
  const canEdit = store.can('edit');
  const services = store.all('services').filter((s) => s.active !== false);
  let items = (p.items || []).map((i) => ({ ...i }));
  const ro = canEdit ? '' : 'disabled';

  el.innerHTML = `
    <header class="detail-head">
      <a class="back" href="#/lead/${lead.id}/propostas">${icon('back')}<span>${esc(lead.company)}</span></a>
      <div class="detail-title"><h1>${esc(p.number)}</h1>
        <div class="detail-sub"><span class="pstatus ps-${p.status}">${esc(proposalStatusLabel(p.status))}</span>
        <span class="muted">Atualizada ${fmtDate(p.updated_at)} por ${esc(store.profileName(p.updated_by))}</span></div></div>
      <div class="quick">
        <button class="qbtn" id="pdf">${icon('download')}<span>Gerar PDF</span></button>
        ${canEdit && p.status === 'rascunho' ? `<button class="qbtn" id="send">${icon('mail')}<span>Marcar enviada</span></button>` : ''}
        ${canEdit && ['enviada', 'negociacao'].includes(p.status) ? `<button class="qbtn ok" id="accept">${icon('check')}<span>Aceita</span></button><button class="qbtn" id="refuse">${icon('x')}<span>Recusada</span></button>` : ''}
      </div>
    </header>
    <form id="pf" class="stack">
      <section class="card"><div class="grid3">
        ${field('Título', `<input name="title" value="${esc(p.title)}" ${ro}>`, { full: true })}
        ${field('Status', `<select name="status" ${ro}>${opts(PROPOSAL_STATUS, p.status)}</select>`)}
        ${field('Moeda', `<select name="currency" ${ro}>${opts(CURRENCIES, p.currency)}</select>`)}
        ${field('Idioma do PDF', `<select name="language" ${ro}>${opts(LANGS, p.language || 'pt')}</select>`)}
        ${field('Data de envio', `<input type="date" name="sent_at" value="${esc(p.sent_at || '')}" ${ro}>`)}
        ${field('Validade', `<input type="date" name="valid_until" value="${esc(p.valid_until || '')}" ${ro}>`)}
      </div></section>
      <section class="card">
        <div class="card-head"><h2 class="sec-title">Serviços</h2>
          ${canEdit ? `<div class="row-input"><select id="svc-pick">${opts(services.map((s) => ({ id: s.id, label: `${s.category} · ${s.name}` })), '', { empty: 'Adicionar do catálogo…' })}</select>
          <button type="button" class="btn btn-ghost btn-sm" id="add-free">${icon('plus')}<span>Item livre</span></button></div>` : ''}</div>
        <div id="items"></div>
        <div class="ptotal">Total <strong id="total"></strong></div>
      </section>
      <section class="card">${field('Condições / observações (aparecem no PDF)', `<textarea name="notes" rows="4" ${ro}>${esc(p.notes)}</textarea>`, { full: true })}</section>
      ${canEdit ? `<div class="row-btns end">
        ${store.can('delete') ? `<button type="button" class="btn btn-danger" id="del">${icon('trash')}<span>Excluir</span></button>` : ''}
        <button type="submit" class="btn btn-primary">Salvar proposta</button></div>` : ''}
    </form>`;

  const form = $('#pf', el);
  const cur = () => form.currency.value;
  const drawItems = () => {
    $('#items', el).innerHTML = items.length ? `<table class="items">
      <thead><tr><th>Descrição</th><th>Cobrança</th><th class="num">Qtd.</th><th class="num">Valor unit.</th><th class="num">Subtotal</th><th></th></tr></thead>
      <tbody>${items.map((i, ix) => `<tr data-ix="${ix}">
        <td data-l="Descrição"><input data-k="description" value="${esc(i.description)}" ${ro}></td>
        <td data-l="Cobrança"><select data-k="unit" ${ro}>${opts([{ id: 'unico', label: 'Único' }, { id: 'mensal', label: 'Mensal' }, { id: 'hora', label: 'Hora' }], i.unit || 'unico')}</select></td>
        <td data-l="Qtd." class="num"><input data-k="qty" inputmode="decimal" value="${esc(i.qty)}" class="w-num" ${ro}></td>
        <td data-l="Valor unit." class="num"><input data-k="price" inputmode="decimal" value="${esc(i.price)}" class="w-num" ${ro}></td>
        <td data-l="Subtotal" class="num">${money((Number(i.qty) || 0) * (Number(i.price) || 0), cur())}</td>
        <td>${canEdit ? `<button type="button" class="icon-btn" data-rm="${ix}" aria-label="Remover">${icon('x')}</button>` : ''}</td></tr>`).join('')}</tbody></table>`
      : emptyState('Adicione serviços do catálogo ou um item livre.');
    const tmp = { items, currency: cur() };
    const m = proposalMonthly(tmp);
    $('#total', el).textContent = money(proposalTotal(tmp), cur(), 2) + (m ? ` + ${money(m, cur(), 2)}/mês` : '');
  };
  drawItems();

  $('#items', el).addEventListener('change', (e) => {
    const tr = e.target.closest('tr[data-ix]'); if (!tr) return;
    const k = e.target.dataset.k; if (!k) return;
    const v = e.target.value;
    items[tr.dataset.ix][k] = (k === 'qty' || k === 'price') ? Number(String(v).replace(',', '.')) || 0 : v;
    drawItems();
  });
  $('#items', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    items.splice(Number(b.dataset.rm), 1); drawItems();
  });
  form.currency.addEventListener('change', () => {
    items = items.map((i) => {
      const s = i.service_id && store.get('services', i.service_id);
      return s ? { ...i, price: s[`price_${cur().toLowerCase()}`] ?? i.price } : i;
    });
    drawItems();
  });
  form.language.addEventListener('change', () => {
    const old = Object.values(DEFAULT_TERMS).includes(form.notes.value);
    if (old || !form.notes.value.trim()) form.notes.value = DEFAULT_TERMS[form.language.value];
  });
  const pick = $('#svc-pick', el);
  if (pick) pick.addEventListener('change', () => {
    const s = store.get('services', pick.value); if (!s) return;
    items.push({ service_id: s.id, description: s.name, unit: s.unit, qty: 1, price: s[`price_${cur().toLowerCase()}`] ?? 0 });
    pick.value = ''; drawItems();
  });
  const af = $('#add-free', el);
  if (af) af.addEventListener('click', () => { items.push({ service_id: null, description: '', unit: 'unico', qty: 1, price: 0 }); drawItems(); });

  const collect = () => ({
    title: form.title.value.trim(), status: form.status.value, currency: form.currency.value, language: form.language.value,
    sent_at: form.sent_at.value || null, valid_until: form.valid_until.value || null, notes: form.notes.value,
    items: items.map((i) => ({ ...i, qty: Number(i.qty) || 0, price: Number(i.price) || 0 })),
  });
  const save = async (extra = {}) => {
    const row = { ...collect(), ...extra };
    await store.update('proposals', p.id, row);
    return row;
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await save(); toast('Proposta salva.'); refresh(); } catch (err) { toast(err.message, 'err'); }
  });

  $('#pdf', el).addEventListener('click', async () => {
    try { if (canEdit) await save(); } catch (err) { toast(err.message, 'err'); return; }
    printProposal(store.get('proposals', p.id));
  });
  const send = $('#send', el);
  if (send) send.addEventListener('click', async () => {
    if (!items.length) { toast('Adicione pelo menos um serviço antes de enviar.', 'err'); return; }
    try {
      await save({ status: 'enviada', sent_at: form.sent_at.value || todayStr() });
      if (['novo', 'contato', 'reuniao', 'diagnostico'].includes(lead.stage)) await store.moveStage(lead.id, 'proposta');
      await store.logInteraction(lead.id, 'email', `Proposta ${p.number} enviada — ${proposalTotalText(store.get('proposals', p.id))}.`);
      await store.insert('tasks', { lead_id: lead.id, title: `Follow-up da proposta ${p.number}`, kind: 'followup', due_date: addDays(todayStr(), 5), due_time: '', owner_id: lead.owner_id || store.user.id, done: false, done_at: null, notes: '' });
      toast('Proposta marcada como enviada. Follow-up criado para daqui a 5 dias.'); refresh();
    } catch (err) { toast(err.message, 'err'); }
  });
  const acc = $('#accept', el);
  if (acc) acc.addEventListener('click', async () => {
    try {
      await save({ status: 'aceita' });
      await store.logInteraction(lead.id, 'nota', `Proposta ${p.number} aceita.`);
      if (lead.status !== 'cliente') contractForm(lead.id, null, { fromWin: true, onSaved: () => navigate(`#/lead/${lead.id}`), onCancel: refresh });
      else refresh();
    } catch (err) { toast(err.message, 'err'); }
  });
  const ref = $('#refuse', el);
  if (ref) ref.addEventListener('click', async () => {
    try { await save({ status: 'recusada' }); await store.logInteraction(lead.id, 'nota', `Proposta ${p.number} recusada.`); toast('Proposta marcada como recusada.'); refresh(); } catch (err) { toast(err.message, 'err'); }
  });
  const del = $('#del', el);
  if (del) del.addEventListener('click', async () => {
    if (!(await confirmDialog('Excluir proposta', `Excluir a proposta ${p.number}?`, { label: 'Excluir' }))) return;
    await store.remove('proposals', p.id); toast('Proposta excluída.'); navigate(`#/lead/${lead.id}/propostas`);
  });
}

// --- PDF ---------------------------------------------------------------------
// Monta a proposta com a identidade Femik e abre a impressão do navegador.
// No iPhone: Partilhar → "Salvar em Arquivos" gera o PDF.
export function printProposal(p) {
  const lead = store.get('leads', p.lead_id);
  const t = L[p.language || 'pt'];
  const locale = { pt: 'pt-BR', en: 'en-CA', es: 'es-ES' }[p.language || 'pt'];
  const fmtM = (v) => new Intl.NumberFormat(locale, { style: 'currency', currency: p.currency, minimumFractionDigits: 2 }).format(v || 0);
  const fmtD = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
  const owner = store.profile(lead.owner_id) || store.user;
  const unitSuffix = (u) => (u === 'mensal' ? t.monthly : u === 'hora' ? t.hour : '');
  const total = proposalTotal(p);
  const monthly = proposalMonthly(p);
  const root = $('#print-root');
  root.innerHTML = `<div class="sheet">
    <header class="pr-head"><img src="icons/logo-escuro.svg" alt="Femik" class="pr-logo">
      <div class="pr-meta"><div class="pr-kicker">${esc(t.title)}</div><div class="pr-num">${esc(p.number)}</div></div></header>
    <div class="pr-band"></div>
    <section class="pr-parties">
      <div><div class="pr-label">${esc(t.for)}</div><div class="pr-client">${esc(lead.company)}</div>
        <div>${esc([lead.contact_name, [lead.city, lead.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '))}</div></div>
      <div class="pr-dates"><div><span class="pr-label">${esc(t.date)}</span> ${esc(fmtD(p.sent_at || todayStr()))}</div>
        <div><span class="pr-label">${esc(t.valid)}</span> ${esc(fmtD(p.valid_until))}</div></div>
    </section>
    <h1 class="pr-title">${esc(p.title)}</h1>
    <table class="pr-items"><thead><tr><th>${esc(t.item)}</th><th class="num">${esc(t.qty)}</th><th class="num">${esc(t.price)}</th><th class="num">${esc(t.sub)}</th></tr></thead>
      <tbody>${(p.items || []).map((i) => `<tr><td>${esc(i.description)}</td><td class="num">${esc(i.qty)}</td>
        <td class="num">${fmtM(i.price)}${esc(unitSuffix(i.unit))}</td><td class="num">${fmtM((Number(i.qty) || 0) * (Number(i.price) || 0))}${esc(unitSuffix(i.unit))}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">${esc(t.total)}</td><td class="num">${fmtM(total)}${monthly ? `<div class="pr-monthly">+ ${fmtM(monthly)}${esc(t.monthly)}</div>` : ''}</td></tr></tfoot></table>
    ${p.notes ? `<section class="pr-terms"><div class="pr-label">${esc(t.terms)}</div><p>${esc(p.notes)}</p></section>` : ''}
    <footer class="pr-foot"><div><strong>Femik</strong> · femik.ca</div>
      <div>${esc(t.contact)}: ${esc(owner.name)}${owner.email ? ` · ${esc(owner.email)}` : ''}</div></footer>
  </div>`;
  document.title = `${p.number} - ${lead.company}`;
  const img = $('.pr-logo', root);
  const go = () => { window.print(); setTimeout(() => { document.title = 'CRM Femik'; }, 1000); };
  if (img.complete) go(); else { img.onload = go; img.onerror = go; }
}
