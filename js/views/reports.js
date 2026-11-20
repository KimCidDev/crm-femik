// Relatórios e exportação (CSV com ";" que abre direto no Excel).

import { store } from '../store.js';
import { COUNTRIES, SERVICE_CATEGORIES, LOST_REASONS, stageLabel, interactionLabel, proposalStatusLabel, projectStatusLabel, taskKindLabel } from '../data.js';
import { localDate, esc, icon, opts, money, moneyTotals, totalsText, toCSV, downloadBlob, todayStr, toast, $, $$ } from '../ui.js';
import { proposalTotal, proposalMonthly } from '../forms.js';
import { PERIODS, periodRange, inRange } from './dashboard.js';

const state = { period: 'year', country: '' };

export function render(el, { refresh }) {
  const range = periodRange(state.period);
  const leads = store.all('leads').filter((l) => !state.country || l.country === state.country);
  const won = leads.filter((l) => l.stage === 'ganho' && inRange(l.won_at, range));
  const lost = leads.filter((l) => l.stage === 'perdido' && inRange(l.lost_at, range));

  // vendas por mês
  const months = {};
  for (const l of won) {
    const k = localDate(l.won_at).slice(0, 7);
    const c = store.byLead('contracts', l.id)[0];
    months[k] = months[k] || { n: 0, rows: [] };
    months[k].n += 1;
    if (c) months[k].rows.push(c);
  }
  const monthKeys = Object.keys(months).sort();
  const byCountry = COUNTRIES.map((c) => {
    const ls = leads.filter((l) => l.country === c);
    return { c, leads: ls.length, clients: ls.filter((l) => l.status === 'cliente').length, open: totalsText(moneyTotals(ls.filter((l) => !['ganho', 'perdido'].includes(l.stage)), 'value_estimate')) };
  });
  const byService = SERVICE_CATEGORIES.map((s) => {
    const ls = leads.filter((l) => l.service_interest === s && !['ganho', 'perdido'].includes(l.stage));
    return { s, n: ls.length, v: totalsText(moneyTotals(ls, 'value_estimate')) };
  });
  const byOwner = store.all('profiles').map((p) => {
    const ls = leads.filter((l) => l.owner_id === p.id);
    const w = ls.filter((l) => l.stage === 'ganho' && inRange(l.won_at, range)).length;
    const lo = ls.filter((l) => l.stage === 'perdido' && inRange(l.lost_at, range)).length;
    const acts = store.all('interactions').filter((i) => i.user_id === p.id && inRange(i.at, range)).length;
    return { p, total: ls.length, open: ls.filter((l) => !['ganho', 'perdido'].includes(l.stage)).length, w, lo, conv: w + lo ? Math.round((w / (w + lo)) * 100) + '%' : '—', acts };
  }).filter((r) => r.total || r.acts);
  const reasons = LOST_REASONS.map((r) => ({ r, n: lost.filter((l) => l.lost_reason === r).length })).filter((x) => x.n);
  const maxR = Math.max(1, ...reasons.map((x) => x.n));
  const canExport = store.can('export');

  el.innerHTML = `
    <header class="page-head"><div><h1>Relatórios</h1><p class="muted">Vendas, clientes e desempenho comercial.</p></div></header>
    <div class="filters">
      <select id="r-period">${opts(PERIODS, state.period)}</select>
      <select id="r-country">${opts(COUNTRIES, state.country, { empty: 'Todos os países' })}</select>
    </div>
    <div class="cols">
      <section class="card"><h2 class="sec-title">Vendas por período</h2>
        ${monthKeys.length ? `<table class="list compact"><thead><tr><th>Mês</th><th class="num">Vendas</th><th class="num">Valor fechado</th></tr></thead><tbody>
          ${monthKeys.map((k) => `<tr><td>${esc(new Date(k + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</td><td class="num">${months[k].n}</td><td class="num">${esc(totalsText(moneyTotals(months[k].rows, 'value')))}</td></tr>`).join('')}
        </tbody></table>` : '<p class="muted">Nenhuma venda fechada no período.</p>'}
      </section>
      <section class="card"><h2 class="sec-title">Motivos de perda</h2>
        ${reasons.length ? `<ul class="hbars">${reasons.map((x) => `<li title="${esc(x.r)}: ${x.n}"><span class="hb-label">${esc(x.r)}</span><span class="hb-track"><span class="hb-bar" style="width:${(x.n / maxR) * 100}%"></span></span><b>${x.n}</b></li>`).join('')}</ul>` : '<p class="muted">Nenhum negócio perdido no período.</p>'}
      </section>
      <section class="card"><h2 class="sec-title">Clientes por país</h2>
        <table class="list compact"><thead><tr><th>País</th><th class="num">Leads</th><th class="num">Clientes</th><th class="num">Em aberto</th></tr></thead><tbody>
        ${byCountry.map((r) => `<tr><td>${esc(r.c)}</td><td class="num">${r.leads}</td><td class="num">${r.clients}</td><td class="num">${esc(r.open)}</td></tr>`).join('')}</tbody></table>
      </section>
      <section class="card"><h2 class="sec-title">Oportunidades por serviço</h2>
        <table class="list compact"><thead><tr><th>Serviço</th><th class="num">Em aberto</th><th class="num">Valor estimado</th></tr></thead><tbody>
        ${byService.map((r) => `<tr><td>${esc(r.s)}</td><td class="num">${r.n}</td><td class="num">${esc(r.v)}</td></tr>`).join('')}</tbody></table>
      </section>
      <section class="card wide"><h2 class="sec-title">Desempenho comercial</h2>
        <table class="list compact"><thead><tr><th>Responsável</th><th class="num">Carteira</th><th class="num">Em aberto</th><th class="num">Ganhos</th><th class="num">Perdidos</th><th class="num">Conversão</th><th class="num">Atendimentos</th></tr></thead><tbody>
        ${byOwner.map((r) => `<tr><td>${esc(r.p.name)}</td><td class="num">${r.total}</td><td class="num">${r.open}</td><td class="num">${r.w}</td><td class="num">${r.lo}</td><td class="num">${r.conv}</td><td class="num">${r.acts}</td></tr>`).join('')}</tbody></table>
        <p class="muted small">Ganhos, perdidos, conversão e atendimentos contam só o período escolhido.</p>
      </section>
    </div>
    <section class="card">
      <h2 class="sec-title">Exportar dados</h2>
      ${canExport ? `<p class="muted small">Arquivos CSV separados por ponto e vírgula, prontos para abrir no Excel ou no Google Sheets. Exportam tudo, sem os filtros acima.</p>
      <div class="row-btns wrap">${[['leads', 'Leads e clientes'], ['interactions', 'Histórico de atendimento'], ['tasks', 'Tarefas'], ['proposals', 'Propostas'], ['contracts', 'Contratos'], ['services', 'Serviços']]
        .map(([k, l]) => `<button class="btn btn-ghost btn-sm" data-exp="${k}">${icon('download')}<span>${l}</span></button>`).join('')}</div>`
      : '<p class="muted">O seu perfil não tem permissão para exportar dados.</p>'}
    </section>`;

  $('#r-period', el).addEventListener('change', (e) => { state.period = e.target.value; refresh(); });
  $('#r-country', el).addEventListener('change', (e) => { state.country = e.target.value; refresh(); });
  $$('[data-exp]', el).forEach((b) => b.addEventListener('click', () => { exportCSV(b.dataset.exp); toast('Arquivo gerado.'); }));
}

const company = (id) => store.get('leads', id)?.company || '';
const name = (id) => store.profileName(id);
const COLS = {
  leads: [
    ['Empresa', 'company'], ['Responsável na empresa', 'contact_name'], ['Telefone', 'phone'], ['WhatsApp', 'whatsapp'], ['E-mail', 'email'],
    ['País', 'country'], ['Cidade', 'city'], ['Segmento', 'segment'], ['Serviço de interesse', 'service_interest'], ['Origem', 'source'],
    ['Responsável', (r) => name(r.owner_id)], ['Etapa', (r) => stageLabel(r.stage)], ['Status', 'status'], ['Valor estimado', 'value_estimate'], ['Moeda', 'currency'],
    ['Último contato', (r) => (r.last_contact_at || '').slice(0, 10)], ['Próxima ação', 'next_action'], ['Data próxima ação', 'next_action_date'],
    ['Motivo da perda', 'lost_reason'], ['Cadastrado em', (r) => (r.created_at || '').slice(0, 10)], ['Anotações', 'notes'],
  ],
  interactions: [['Data', (r) => (r.at || '').slice(0, 16).replace('T', ' ')], ['Cliente', (r) => company(r.lead_id)], ['Tipo', (r) => interactionLabel(r.type)], ['Resumo', 'summary'], ['Registrado por', (r) => name(r.user_id)]],
  tasks: [['Título', 'title'], ['Tipo', (r) => taskKindLabel(r.kind)], ['Cliente', (r) => company(r.lead_id)], ['Data', 'due_date'], ['Hora', 'due_time'], ['Responsável', (r) => name(r.owner_id)], ['Concluída', (r) => (r.done ? 'sim' : 'não')]],
  proposals: [['Número', 'number'], ['Cliente', (r) => company(r.lead_id)], ['Título', 'title'], ['Status', (r) => proposalStatusLabel(r.status)], ['Moeda', 'currency'], ['Total único', (r) => proposalTotal(r)], ['Total mensal', (r) => proposalMonthly(r)], ['Envio', 'sent_at'], ['Validade', 'valid_until']],
  contracts: [['Cliente', (r) => company(r.lead_id)], ['Serviços', 'services'], ['Valor', 'value'], ['Mensal', 'monthly_value'], ['Moeda', 'currency'], ['Início', 'start_date'], ['Término', 'end_date'], ['Responsável pelo projeto', (r) => name(r.project_owner_id)], ['Status do projeto', (r) => projectStatusLabel(r.project_status)]],
  services: [['Serviço', 'name'], ['Categoria', 'category'], ['Cobrança', 'unit'], ['BRL', 'price_brl'], ['CAD', 'price_cad'], ['EUR', 'price_eur'], ['Ativo', (r) => (r.active !== false ? 'sim' : 'não')]],
};
export function exportCSV(table) {
  const cols = COLS[table].map(([label, value]) => ({ label, value }));
  downloadBlob(`crm-femik-${table}-${todayStr()}.csv`, toCSV(store.all(table), cols), 'text/csv;charset=utf-8');
}
