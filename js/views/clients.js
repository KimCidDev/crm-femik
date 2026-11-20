// Gestão de clientes ativos: contratos, serviços, valores e status do projeto.

import { store } from '../store.js';
import { PROJECT_STATUS, projectStatusLabel } from '../data.js';
import { esc, opts, money, fmtDate, moneyTotals, totalsText, toast, emptyState, $, $$ } from '../ui.js';

const filters = { status: '' };

export function render(el, { navigate, refresh }) {
  const clients = store.all('leads').filter((l) => l.status === 'cliente');
  const rows = clients.map((l) => ({ lead: l, c: store.byLead('contracts', l.id)[0] || null }))
    .filter((r) => !filters.status || (r.c && r.c.project_status === filters.status))
    .sort((a, b) => (b.c?.start_date || '').localeCompare(a.c?.start_date || ''));
  const contracts = rows.map((r) => r.c).filter(Boolean);
  const canProject = store.can('project');

  el.innerHTML = `
    <header class="page-head"><div><h1>Clientes ativos</h1>
      <p class="muted">${clients.length} cliente${clients.length === 1 ? '' : 's'} · contratos: ${esc(totalsText(moneyTotals(contracts, 'value')))}${contracts.some((c) => c.monthly_value) ? ` · recorrente: ${esc(totalsText(moneyTotals(contracts, 'monthly_value')))}/mês` : ''}</p></div></header>
    <div class="filters"><select id="f-ps">${opts(PROJECT_STATUS, filters.status, { empty: 'Todos os status de projeto' })}</select></div>
    <div class="card table-card">${rows.length ? `<table class="list">
      <thead><tr><th>Cliente</th><th>Serviços contratados</th><th class="num">Valor</th><th>Período</th><th>Responsável pelo projeto</th><th>Status do projeto</th></tr></thead>
      <tbody>${rows.map(({ lead, c }) => `<tr data-id="${lead.id}">
        <td data-l="Cliente"><strong>${esc(lead.company)}</strong><div class="muted small">${esc([lead.city, lead.country].filter(Boolean).join(', '))}</div></td>
        <td data-l="Serviços">${esc(c?.services || '—')}</td>
        <td data-l="Valor" class="num">${c ? money(c.value, c.currency) : '—'}${c?.monthly_value ? `<div class="small muted">+ ${money(c.monthly_value, c.currency)}/mês</div>` : ''}</td>
        <td data-l="Período">${c ? `${fmtDate(c.start_date)} → ${c.end_date ? fmtDate(c.end_date) : '…'}` : '—'}</td>
        <td data-l="Responsável">${esc(c ? store.profileName(c.project_owner_id) : '—')}</td>
        <td data-l="Status" class="stop">${c ? (canProject ? `<select data-c="${c.id}" aria-label="Status do projeto">${opts(PROJECT_STATUS, c.project_status)}</select>` : esc(projectStatusLabel(c.project_status))) : '—'}</td>
      </tr>`).join('')}</tbody></table>` : emptyState('Ainda não há clientes ativos. Quando um lead chega a "Fechado (ganho)", ele vira cliente aqui.')}</div>`;

  $('#f-ps', el).addEventListener('change', (e) => { filters.status = e.target.value; refresh(); });
  $$('tbody tr', el).forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('.stop')) navigate(`#/lead/${tr.dataset.id}`); }));
  $$('select[data-c]', el).forEach((s) => s.addEventListener('change', async () => {
    try { await store.update('contracts', s.dataset.c, { project_status: s.value }); toast('Status do projeto atualizado.'); } catch (err) { toast(err.message, 'err'); refresh(); }
  }));
}
