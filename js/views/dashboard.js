// Painel comercial: indicadores, funil, alertas e próximas tarefas.

import { store } from '../store.js';
import { STAGES, OPEN_STAGES, COUNTRIES } from '../data.js';
import { localDate, esc, icon, opts, money, moneyTotals, totalsText, todayStr, addDays, daysSince, fmtDate, relDays, emptyState, $ } from '../ui.js';
import { proposalTotalText } from '../forms.js';
import { taskItem, bindTaskList } from './tasks.js';

export const PERIODS = [
  { id: 'month', label: 'Este mês' }, { id: '30', label: 'Últimos 30 dias' }, { id: 'quarter', label: 'Este trimestre' },
  { id: 'year', label: 'Este ano' }, { id: 'all', label: 'Todo o período' },
];
export function periodRange(id) {
  const t = todayStr();
  const [y, m] = t.split('-').map(Number);
  switch (id) {
    case 'month': return [`${y}-${String(m).padStart(2, '0')}-01`, t];
    case '30': return [addDays(t, -29), t];
    case 'quarter': { const q = Math.floor((m - 1) / 3) * 3 + 1; return [`${y}-${String(q).padStart(2, '0')}-01`, t]; }
    case 'year': return [`${y}-01-01`, t];
    default: return ['0000-01-01', '9999-12-31'];
  }
}
export const inRange = (v, [a, b]) => { const d = localDate(v); return !!d && d >= a && d <= b; };

const state = { period: 'month', country: '', owner: '' };

export function render(el, { refresh }) {
  const range = periodRange(state.period);
  const leads = store.all('leads').filter((l) => (!state.country || l.country === state.country) && (!state.owner || l.owner_id === state.owner));
  const ids = new Set(leads.map((l) => l.id));
  const proposals = store.all('proposals').filter((p) => ids.has(p.lead_id));
  const contracts = store.all('contracts').filter((c) => ids.has(c.lead_id));

  const created = leads.filter((l) => inRange(l.created_at, range));
  const negotiating = leads.filter((l) => OPEN_STAGES.includes(l.stage) && l.stage !== 'novo');
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));
  const sent = proposals.filter((p) => inRange(p.sent_at, range));
  const won = leads.filter((l) => l.stage === 'ganho' && inRange(l.won_at, range));
  const lost = leads.filter((l) => l.stage === 'perdido' && inRange(l.lost_at, range));
  const conv = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null;
  const periodContracts = contracts.filter((c) => inRange(c.created_at, range));
  const revenue = totalsText(moneyTotals(periodContracts, 'value'));
  const monthly = totalsText(moneyTotals(periodContracts, 'monthly_value'));
  const pipelineValue = totalsText(moneyTotals(open, 'value_estimate'));

  // alertas
  const today = todayStr();
  const lateTasks = store.all('tasks').filter((t) => !t.done && t.due_date < today && (!state.owner || t.owner_id === state.owner));
  const noReply = proposals.filter((p) => p.status === 'enviada' && p.sent_at && daysSince(p.sent_at) >= 7);
  const cold = open.filter((l) => { const d = daysSince(l.last_contact_at); return d === null ? daysSince(l.created_at) >= 3 : d >= 14; });
  const mine = store.all('tasks').filter((t) => !t.done && t.owner_id === store.user.id && t.due_date <= addDays(today, 7))
    .sort((a, b) => (a.due_date + (a.due_time || '99')).localeCompare(b.due_date + (b.due_time || '99'))).slice(0, 6);

  const funnel = STAGES.filter((s) => s.id !== 'perdido').map((s) => ({ ...s, n: leads.filter((l) => l.stage === s.id).length }));
  const maxN = Math.max(1, ...funnel.map((f) => f.n));
  const byCountry = COUNTRIES.map((c) => ({ c, n: leads.filter((l) => l.country === c && l.stage !== 'perdido').length }));
  const maxC = Math.max(1, ...byCountry.map((x) => x.n));
  const first = store.user.name.split(' ')[0];

  el.innerHTML = `
    <header class="page-head">
      <div><h1>Olá, ${esc(first)}</h1><p class="muted">Painel comercial da Femik</p></div>
    </header>
    <div class="filters">
      <select id="d-period" aria-label="Período">${opts(PERIODS, state.period)}</select>
      <select id="d-country" aria-label="País">${opts(COUNTRIES, state.country, { empty: 'Todos os países' })}</select>
      <select id="d-owner" aria-label="Responsável">${opts(store.all('profiles').map((p) => ({ id: p.id, label: p.name })), state.owner, { empty: 'Todos os responsáveis' })}</select>
    </div>
    <section class="kpis">
      ${kpi('Leads cadastrados', created.length, 'no período')}
      ${kpi('Negociações em andamento', negotiating.length, 'agora')}
      ${kpi('Propostas enviadas', sent.length, 'no período')}
      ${kpi('Vendas fechadas', won.length, 'no período', 'ok')}
      ${kpi('Perdidas', lost.length, 'no período')}
      ${kpi('Taxa de conversão', conv === null ? '—' : conv + '%', 'ganhas ÷ (ganhas + perdidas)')}
      ${kpi('Valor das oportunidades', pipelineValue, 'leads em aberto, por moeda', '', true)}
      ${kpi('Faturamento de contratos', revenue, monthly !== '—' ? `+ ${monthly} por mês` : 'contratos fechados no período', '', true)}
    </section>
    <div class="cols">
      <section class="card">
        <h2 class="sec-title">Funil agora</h2>
        <ul class="hbars">${funnel.map((f) => `<li title="${esc(f.label)}: ${f.n}"><span class="hb-label">${esc(f.label)}</span>
          <span class="hb-track"><span class="hb-bar ${f.id === 'ganho' ? 'hb-ok' : ''}" style="width:${f.n ? Math.max(4, (f.n / maxN) * 100) : 0}%"></span></span><b>${f.n}</b></li>`).join('')}</ul>
        <h2 class="sec-title mt">Leads ativos por país</h2>
        <ul class="hbars">${byCountry.map((x) => `<li title="${esc(x.c)}: ${x.n}"><span class="hb-label">${esc(x.c)}</span>
          <span class="hb-track"><span class="hb-bar" style="width:${x.n ? Math.max(4, (x.n / maxC) * 100) : 0}%"></span></span><b>${x.n}</b></li>`).join('')}</ul>
      </section>
      <div class="stack">
        <section class="card">
          <h2 class="sec-title">Precisa de atenção</h2>
          ${lateTasks.length + noReply.length + cold.length ? `<ul class="alerts">
            ${lateTasks.map((t) => { const l = store.get('leads', t.lead_id); return `<li class="al-late">${icon('alert')}<a href="${l ? `#/lead/${l.id}/tarefas` : '#/tarefas'}"><strong>Tarefa atrasada:</strong> ${esc(t.title)} <span class="muted">(${esc(relDays(t.due_date))})</span></a></li>`; }).join('')}
            ${noReply.map((p) => { const l = store.get('leads', p.lead_id); return `<li class="al-warn">${icon('mail')}<a href="#/proposta/${p.id}"><strong>Proposta sem retorno:</strong> ${esc(p.number)} · ${esc(l?.company || '')} <span class="muted">(enviada há ${daysSince(p.sent_at)} dias · ${esc(proposalTotalText(p))})</span></a></li>`; }).join('')}
            ${cold.map((l) => `<li class="al-info">${icon('history')}<a href="#/lead/${l.id}"><strong>${l.last_contact_at ? 'Sem contato' : 'Nunca contatado'}:</strong> ${esc(l.company)} <span class="muted">${l.last_contact_at ? `(último contato há ${daysSince(l.last_contact_at)} dias)` : `(cadastrado ${fmtDate(l.created_at)})`}</span></a></li>`).join('')}
          </ul>` : emptyState('Tudo em dia.')}
        </section>
        <section class="card">
          <div class="card-head"><h2 class="sec-title">As minhas próximas tarefas</h2><a class="link" href="#/tarefas">Ver agenda</a></div>
          ${mine.length ? `<ul class="tasks" id="mine">${mine.map((t) => taskItem(t)).join('')}</ul>` : emptyState('Nada para os próximos 7 dias.')}
        </section>
      </div>
    </div>`;

  for (const [id, k] of [['d-period', 'period'], ['d-country', 'country'], ['d-owner', 'owner']]) {
    $('#' + id, el).addEventListener('change', (e) => { state[k] = e.target.value; refresh(); });
  }
  const mineEl = $('#mine', el);
  if (mineEl) bindTaskList(mineEl, refresh);
}

function kpi(label, value, hint, cls = '', small = false) {
  return `<div class="kpi ${cls}"><div class="kpi-label">${esc(label)}</div><div class="kpi-value ${small ? 'kpi-money' : ''}">${esc(String(value))}</div><div class="kpi-hint">${esc(hint)}</div></div>`;
}
