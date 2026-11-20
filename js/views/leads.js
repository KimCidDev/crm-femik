// Leads e clientes: lista e ficha completa (resumo, histórico, tarefas,
// propostas, documentos, alterações).

import { store } from '../store.js';
import {
  STAGES, COUNTRIES, stageLabel, interactionLabel, proposalStatusLabel, projectStatusLabel, FILE_KINDS, fileKindLabel,
  TABLE_LABELS, FIELD_LABELS,
} from '../data.js';
import {
  esc, icon, opts, money, fmtDate, fmtDateTime, relDays, daysSince, todayStr, avatar, toast, confirmDialog,
  emptyState, waLink, onlyDigits, $, $$,
} from '../ui.js';
import { leadForm, interactionForm, taskForm, lostForm, contractForm, proposalTotalText } from '../forms.js';
import { taskItem, bindTaskList } from './tasks.js';
import { newProposal } from './proposals.js';

const filters = { q: '', stage: '', country: '', owner: '', status: '' };

export function stageChip(stage) { return `<span class="stage stage-${stage}">${esc(stageLabel(stage))}</span>`; }

// --- lista -----------------------------------------------------------------
export function renderList(el, { navigate, refresh }) {
  const today = todayStr();
  const q = filters.q.toLowerCase();
  const rows = store.all('leads').filter((l) =>
    (!q || [l.company, l.contact_name, l.email, l.city, l.segment].join(' ').toLowerCase().includes(q)) &&
    (!filters.stage || l.stage === filters.stage) && (!filters.country || l.country === filters.country) &&
    (!filters.owner || l.owner_id === filters.owner) && (!filters.status || l.status === filters.status))
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  el.innerHTML = `
    <header class="page-head">
      <div><h1>Leads e clientes</h1><p class="muted">${rows.length} de ${store.all('leads').length} cadastros</p></div>
      ${store.can('edit') ? `<button class="btn btn-primary" id="new-lead">${icon('plus')}<span>Novo lead</span></button>` : ''}
    </header>
    <div class="filters">
      <label class="search">${icon('search')}<input id="f-q" placeholder="Buscar nome, contato, cidade…" value="${esc(filters.q)}"></label>
      <select id="f-stage">${opts(STAGES, filters.stage, { empty: 'Todas as etapas' })}</select>
      <select id="f-country">${opts(COUNTRIES, filters.country, { empty: 'Todos os países' })}</select>
      <select id="f-owner">${opts(store.all('profiles').map((p) => ({ id: p.id, label: p.name })), filters.owner, { empty: 'Todos os responsáveis' })}</select>
      <select id="f-status">${opts([{ id: 'lead', label: 'Só leads' }, { id: 'cliente', label: 'Só clientes' }], filters.status, { empty: 'Leads e clientes' })}</select>
    </div>
    <div class="card table-card">
      ${rows.length ? `<table class="list">
        <thead><tr><th>Empresa</th><th>Etapa</th><th>País</th><th>Responsável</th><th>Último contato</th><th>Próxima ação</th><th class="num">Valor</th></tr></thead>
        <tbody>${rows.map((l) => {
          const late = l.next_action_date && l.next_action_date < today && !['ganho', 'perdido'].includes(l.stage);
          return `<tr data-id="${l.id}" tabindex="0">
            <td data-l="Empresa"><strong>${esc(l.company)}</strong>${l.status === 'cliente' ? ' <span class="chip chip-ok">Cliente</span>' : ''}<div class="muted small">${esc(l.contact_name || l.segment || '')}</div></td>
            <td data-l="Etapa">${stageChip(l.stage)}</td>
            <td data-l="País">${esc([l.city, l.country].filter(Boolean).join(', '))}</td>
            <td data-l="Responsável">${esc(store.profileName(l.owner_id))}</td>
            <td data-l="Último contato">${l.last_contact_at ? esc(relDays(l.last_contact_at)) : '<span class="muted">nunca</span>'}</td>
            <td data-l="Próxima ação" class="${late ? 'late-text' : ''}">${esc(l.next_action || '—')}${l.next_action_date ? `<div class="small">${fmtDate(l.next_action_date, false)}</div>` : ''}</td>
            <td data-l="Valor" class="num">${money(l.value_estimate, l.currency)}</td></tr>`;
        }).join('')}</tbody></table>` : emptyState('Nenhum lead encontrado com estes filtros.')}
    </div>`;

  const q$ = $('#f-q', el);
  q$.addEventListener('input', () => { filters.q = q$.value; const p = q$.selectionStart; refresh(); const n = $('#f-q', el); n.focus(); n.setSelectionRange(p, p); });
  for (const k of ['stage', 'country', 'owner', 'status']) $(`#f-${k}`, el).addEventListener('change', (e) => { filters[k] = e.target.value; refresh(); });
  $$('tbody tr', el).forEach((tr) => {
    tr.addEventListener('click', () => navigate(`#/lead/${tr.dataset.id}`));
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(`#/lead/${tr.dataset.id}`); });
  });
  const nl = $('#new-lead', el);
  if (nl) nl.addEventListener('click', () => leadForm(null, { onSaved: (l) => navigate(`#/lead/${l.id}`) }));
}

// --- ficha -----------------------------------------------------------------
const TABS = [
  ['resumo', 'Resumo'], ['historico', 'Histórico'], ['tarefas', 'Tarefas'], ['propostas', 'Propostas'],
  ['documentos', 'Documentos'], ['alteracoes', 'Alterações'],
];

export function renderDetail(el, { params, navigate, refresh }) {
  const lead = store.get('leads', params.id);
  if (!lead) { el.innerHTML = `<div class="card">${emptyState('Lead não encontrado.', '<a class="btn btn-ghost" href="#/leads">Voltar à lista</a>')}</div>`; return; }
  const tab = params.tab || 'resumo';
  const canEdit = store.can('edit');
  const counts = {
    historico: store.byLead('interactions', lead.id).length,
    tarefas: store.byLead('tasks', lead.id).filter((t) => !t.done).length,
    propostas: store.byLead('proposals', lead.id).length,
    documentos: store.byLead('files', lead.id).length,
  };
  const wa = lead.whatsapp || lead.phone;

  el.innerHTML = `
    <header class="detail-head">
      <a class="back" href="#/leads">${icon('back')}<span>Leads</span></a>
      <div class="detail-title">
        <h1>${esc(lead.company)}</h1>
        <div class="detail-sub">${stageChip(lead.stage)} ${lead.status === 'cliente' ? '<span class="chip chip-ok">Cliente ativo</span>' : ''}
          <span class="muted">${esc([lead.contact_name, lead.city, lead.country].filter(Boolean).join(' · '))}</span></div>
      </div>
      <div class="quick">
        ${wa ? `<a class="qbtn wa" href="${esc(waLink(wa, lead.contact_name ? `Olá ${lead.contact_name}, ` : 'Olá, '))}" target="_blank" rel="noopener">${icon('whatsapp')}<span>WhatsApp</span></a>` : ''}
        ${lead.phone ? `<a class="qbtn" href="tel:+${esc(onlyDigits(lead.phone))}">${icon('phone')}<span>Ligar</span></a>` : ''}
        ${lead.email ? `<a class="qbtn" href="mailto:${esc(lead.email)}">${icon('mail')}<span>E-mail</span></a>` : ''}
        ${canEdit ? `<button class="qbtn" id="log">${icon('history')}<span>Registrar</span></button>` : ''}
        ${store.can('task') ? `<button class="qbtn" id="meet">${icon('calendar')}<span>Reunião</span></button>` : ''}
      </div>
    </header>
    ${canEdit ? `<div class="stage-bar" role="group" aria-label="Etapa do funil">
      ${STAGES.map((s) => `<button class="${s.id === lead.stage ? 'on' : ''} sb-${s.id}" data-stage="${s.id}">${esc(s.label)}</button>`).join('')}
    </div>` : ''}
    <nav class="tabs" role="tablist">
      ${TABS.map(([id, label]) => `<a role="tab" href="#/lead/${lead.id}/${id}" class="${tab === id ? 'on' : ''}" aria-selected="${tab === id}">${label}${counts[id] ? ` <span class="count">${counts[id]}</span>` : ''}</a>`).join('')}
    </nav>
    <div id="tab-body"></div>`;

  const body = $('#tab-body', el);
  ({ resumo: tabResumo, historico: tabHistorico, tarefas: tabTarefas, propostas: tabPropostas, documentos: tabDocumentos, alteracoes: tabAlteracoes }[tab] || tabResumo)(body, lead, { navigate, refresh });

  const log = $('#log', el); if (log) log.addEventListener('click', () => interactionForm(lead.id, { onSaved: refresh }));
  const meet = $('#meet', el); if (meet) meet.addEventListener('click', () => taskForm(null, { leadId: lead.id, kind: 'reuniao', onSaved: refresh }));
  $$('.stage-bar button', el).forEach((b) => b.addEventListener('click', async () => {
    const s = b.dataset.stage;
    if (s === lead.stage) return;
    if (s === 'perdido') return lostForm(lead.id, { onSaved: refresh });
    if (s === 'ganho') return contractForm(lead.id, null, { fromWin: true, onSaved: refresh });
    try { await store.moveStage(lead.id, s); toast(`Etapa: ${stageLabel(s)}`); refresh(); } catch (err) { toast(err.message, 'err'); }
  }));
}

function info(label, value) { return `<div class="info"><dt>${esc(label)}</dt><dd>${value || '<span class="muted">—</span>'}</dd></div>`; }

function tabResumo(body, lead, { navigate, refresh }) {
  const contract = store.byLead('contracts', lead.id)[0];
  const since = daysSince(lead.last_contact_at);
  body.innerHTML = `
    <div class="cols">
      <section class="card">
        <div class="card-head"><h2 class="sec-title">Dados do cadastro</h2>
          ${store.can('edit') ? `<button class="btn btn-ghost btn-sm" id="edit">${icon('edit')}<span>Editar</span></button>` : ''}</div>
        <dl class="infos">
          ${info('Responsável na empresa', esc(lead.contact_name))}
          ${info('Telefone', lead.phone ? `<a href="tel:+${esc(onlyDigits(lead.phone))}">${esc(lead.phone)}</a>` : '')}
          ${info('WhatsApp', lead.whatsapp ? `<a href="${esc(waLink(lead.whatsapp))}" target="_blank" rel="noopener">${esc(lead.whatsapp)}</a>` : '')}
          ${info('E-mail', lead.email ? `<a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>` : '')}
          ${info('País e cidade', esc([lead.city, lead.country].filter(Boolean).join(', ')))}
          ${info('Segmento', esc(lead.segment))}
          ${info('Serviço de interesse', esc(lead.service_interest))}
          ${info('Origem do lead', esc(lead.source))}
          ${info('Responsável pelo atendimento', esc(store.profileName(lead.owner_id)))}
          ${info('Valor estimado', lead.value_estimate ? money(lead.value_estimate, lead.currency) : '')}
          ${info('Último contato', lead.last_contact_at ? `${fmtDate(lead.last_contact_at)} <span class="muted">(${esc(relDays(lead.last_contact_at))})</span>` : '')}
          ${info('Cadastrado em', fmtDate(lead.created_at))}
          ${lead.stage === 'perdido' ? info('Motivo da perda', esc(lead.lost_reason)) : ''}
          ${info('Base legal (LGPD)', lead.consent ? 'Registrada' : '<span class="late-text">Não registrada</span>')}
        </dl>
        ${lead.notes ? `<h3 class="sub-title">Anotações</h3><p class="notes">${esc(lead.notes)}</p>` : ''}
      </section>
      <div class="stack">
        <section class="card">
          <h2 class="sec-title">Próxima ação</h2>
          ${lead.next_action ? `<p class="next-big">${esc(lead.next_action)}</p><p class="muted">${lead.next_action_date ? `${fmtDate(lead.next_action_date)} · ${esc(relDays(lead.next_action_date))}` : 'Sem data'}</p>` : emptyState('Nenhuma próxima ação definida.')}
        </section>
        ${lead.status === 'cliente' || contract ? `<section class="card">
          <div class="card-head"><h2 class="sec-title">Contrato</h2>
            ${contract && store.can('project') ? `<button class="btn btn-ghost btn-sm" id="edit-contract">${icon('edit')}<span>Editar</span></button>` : ''}</div>
          ${contract ? `<dl class="infos one">
            ${info('Serviços contratados', esc(contract.services))}
            ${info('Valor', `${money(contract.value, contract.currency)}${contract.monthly_value ? ` + ${money(contract.monthly_value, contract.currency)}/mês` : ''}`)}
            ${info('Período', `${fmtDate(contract.start_date)} → ${contract.end_date ? fmtDate(contract.end_date) : 'sem término'}`)}
            ${info('Responsável pelo projeto', esc(store.profileName(contract.project_owner_id)))}
            ${info('Status do projeto', `<span class="chip">${esc(projectStatusLabel(contract.project_status))}</span>`)}
          </dl>` : `<p class="muted">Sem contrato registrado.</p>${store.can('edit') ? '<button class="btn btn-ghost btn-sm" id="add-contract">Registrar contrato</button>' : ''}`}
        </section>` : ''}
        ${store.can('admin') ? `<section class="card danger-zone">
          <h2 class="sec-title">Administração</h2>
          <p class="muted small">A anonimização apaga os dados pessoais (nome do contato, telefones, e-mail, anotações) e mantém só os números para os relatórios — use quando o titular pedir a exclusão (LGPD).</p>
          <div class="row-btns"><button class="btn btn-ghost btn-sm" id="anon">Anonimizar dados pessoais</button>
          <button class="btn btn-danger btn-sm" id="del">${icon('trash')}<span>Excluir lead</span></button></div>
        </section>` : ''}
      </div>
    </div>`;
  const ed = $('#edit', body); if (ed) ed.addEventListener('click', () => leadForm(lead, { onSaved: refresh }));
  const ec = $('#edit-contract', body); if (ec) ec.addEventListener('click', () => contractForm(lead.id, contract, { onSaved: refresh }));
  const ac = $('#add-contract', body); if (ac) ac.addEventListener('click', () => contractForm(lead.id, null, { onSaved: refresh }));
  const an = $('#anon', body);
  if (an) an.addEventListener('click', async () => {
    if (!(await confirmDialog('Anonimizar dados pessoais', `Apagar os dados pessoais de ${lead.company}? Esta ação não pode ser desfeita.`, { label: 'Anonimizar' }))) return;
    await store.update('leads', lead.id, { contact_name: '', phone: '', whatsapp: '', email: '', notes: '[dados pessoais removidos a pedido do titular]', consent: false });
    for (const i of store.byLead('interactions', lead.id)) await store.update('interactions', i.id, { summary: '[removido]' });
    toast('Dados pessoais anonimizados.'); refresh();
  });
  const del = $('#del', body);
  if (del) del.addEventListener('click', async () => {
    if (!(await confirmDialog('Excluir lead', `Excluir ${lead.company} com todo o histórico, tarefas, propostas e documentos?`, { label: 'Excluir definitivamente' }))) return;
    await store.remove('leads', lead.id); toast('Lead excluído.'); navigate('#/leads');
  });
}

function tabHistorico(body, lead, { refresh }) {
  const items = store.byLead('interactions', lead.id).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  body.innerHTML = `<section class="card">
    <div class="card-head"><h2 class="sec-title">Histórico de atendimento</h2>
      ${store.can('edit') ? `<button class="btn btn-primary btn-sm" id="add">${icon('plus')}<span>Registrar</span></button>` : ''}</div>
    ${items.length ? `<ol class="timeline">${items.map((i) => `<li class="tl tl-${i.type}">
      <div class="tl-dot"></div>
      <div class="tl-body"><div class="tl-head"><strong>${esc(interactionLabel(i.type))}</strong><span class="muted">${fmtDateTime(i.at)} · ${esc(store.profileName(i.user_id))}</span></div>
      <p>${esc(i.summary)}</p></div></li>`).join('')}</ol>` : emptyState('Nenhum atendimento registrado ainda.')}
  </section>`;
  const add = $('#add', body); if (add) add.addEventListener('click', () => interactionForm(lead.id, { onSaved: refresh }));
}

function tabTarefas(body, lead, { refresh }) {
  const tasks = store.byLead('tasks', lead.id).sort((a, b) => (a.done - b.done) || a.due_date.localeCompare(b.due_date));
  body.innerHTML = `<section class="card">
    <div class="card-head"><h2 class="sec-title">Tarefas e reuniões</h2>
      ${store.can('task') ? `<button class="btn btn-primary btn-sm" id="add">${icon('plus')}<span>Nova tarefa</span></button>` : ''}</div>
    ${tasks.length ? `<ul class="tasks" id="tl">${tasks.map((t) => taskItem(t, { showLead: false })).join('')}</ul>` : emptyState('Nenhuma tarefa para este cliente.')}
  </section>`;
  const add = $('#add', body); if (add) add.addEventListener('click', () => taskForm(null, { leadId: lead.id, onSaved: refresh }));
  const tl = $('#tl', body); if (tl) bindTaskList(tl, refresh);
}

function tabPropostas(body, lead, { navigate }) {
  const items = store.byLead('proposals', lead.id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  body.innerHTML = `<section class="card">
    <div class="card-head"><h2 class="sec-title">Propostas e negociações</h2>
      ${store.can('edit') ? `<button class="btn btn-primary btn-sm" id="add">${icon('plus')}<span>Nova proposta</span></button>` : ''}</div>
    ${items.length ? `<ul class="plist">${items.map((p) => `<li><a href="#/proposta/${p.id}">
      <div><strong>${esc(p.number)} · ${esc(p.title || 'Proposta')}</strong>
      <div class="muted small">${p.sent_at ? `Enviada ${fmtDate(p.sent_at)}` : 'Não enviada'}${p.valid_until ? ` · válida até ${fmtDate(p.valid_until)}` : ''}</div></div>
      <div class="pl-right"><span class="pstatus ps-${p.status}">${esc(proposalStatusLabel(p.status))}</span><strong>${esc(proposalTotalText(p))}</strong></div>
    </a></li>`).join('')}</ul>` : emptyState('Nenhuma proposta para este cliente.')}
  </section>`;
  const add = $('#add', body);
  if (add) add.addEventListener('click', async () => { const p = await newProposal(lead.id); navigate(`#/proposta/${p.id}`); });
}

function tabDocumentos(body, lead, { refresh }) {
  const files = store.byLead('files', lead.id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  body.innerHTML = `<section class="card">
    <div class="card-head"><h2 class="sec-title">Documentos e arquivos</h2></div>
    ${store.can('edit') ? `<form class="upload" id="up">
      <select name="kind" aria-label="Tipo">${opts(FILE_KINDS, 'contrato')}</select>
      <label class="btn btn-ghost btn-sm file-btn">${icon('upload')}<span>Escolher arquivo</span><input type="file" name="file" hidden></label>
      <span class="muted small" id="fname">PDF, imagens, documentos${store.demo ? ' · até 1,5 MB no modo demonstração' : ''}</span>
      <button class="btn btn-primary btn-sm" type="submit">Anexar</button>
    </form>` : ''}
    ${files.length ? `<ul class="files">${files.map((f) => `<li data-id="${f.id}">
      <span class="ficon">${icon('file')}</span>
      <div class="fmain"><strong>${esc(f.name)}</strong><div class="muted small">${esc(fileKindLabel(f.kind))} · ${kb(f.size || 0)} · ${fmtDate(f.created_at)} · ${esc(store.profileName(f.created_by))}</div></div>
      <button class="icon-btn" data-act="open" aria-label="Abrir">${icon('download')}</button>
      ${store.can('edit') ? `<button class="icon-btn" data-act="del" aria-label="Excluir">${icon('trash')}</button>` : ''}
    </li>`).join('')}</ul>` : emptyState('Nenhum documento anexado.')}
  </section>`;
  const up = $('#up', body);
  if (up) {
    up.file.addEventListener('change', () => { $('#fname', body).textContent = up.file.files[0]?.name || ''; });
    up.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = up.file.files[0];
      if (!file) { toast('Escolha um arquivo.', 'err'); return; }
      try { await store.uploadFile(file, lead.id, up.kind.value); toast('Documento anexado.'); refresh(); } catch (err) { toast(err.message, 'err'); }
    });
  }
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const f = store.get('files', b.closest('li').dataset.id);
    try {
      if (b.dataset.act === 'open') {
        const url = await store.fileUrl(f);
        const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.download = f.name;
        document.body.appendChild(a); a.click(); a.remove();
      } else if (await confirmDialog('Excluir documento', `Excluir ${f.name}?`, { label: 'Excluir' })) {
        await store.remove('files', f.id); toast('Documento excluído.'); refresh();
      }
    } catch (err) { toast(err.message, 'err'); }
  });
}

export function auditRow(a) {
  const who = store.profileName(a.user_id);
  const verb = a.action === 'insert' ? 'criou' : a.action === 'delete' ? 'excluiu' : 'alterou';
  const fields = (a.fields || []).filter((f) => !['updated_at', 'updated_by'].includes(f)).map((f) => FIELD_LABELS[f] || f);
  return `<li><span class="muted small">${fmtDateTime(a.at)}</span>
    <div><strong>${esc(who)}</strong> ${verb} ${esc((TABLE_LABELS[a.table_name] || a.table_name).toLowerCase())}
    ${a.record_label ? `<em>${esc(a.record_label)}</em>` : ''}${fields.length && a.action === 'update' ? ` <span class="muted">(${esc(fields.join(', '))})</span>` : ''}</div></li>`;
}

function tabAlteracoes(body, lead) {
  const ids = new Set([lead.id]);
  for (const t of ['interactions', 'tasks', 'proposals', 'contracts', 'files']) store.byLead(t, lead.id).forEach((r) => ids.add(r.id));
  const rows = store.all('audit_log').filter((a) => ids.has(a.record_id) || a.lead_id === lead.id).slice(0, 200);
  body.innerHTML = `<section class="card"><h2 class="sec-title">Registro de alterações</h2>
    <p class="muted small">Quem fez cada atualização neste cadastro.</p>
    ${rows.length ? `<ul class="audit">${rows.map(auditRow).join('')}</ul>` : emptyState('Nenhuma alteração registrada ainda.')}
  </section>`;
}
