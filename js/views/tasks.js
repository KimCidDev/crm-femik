// Agenda e tarefas: atrasadas, hoje, próximas, concluídas.

import { store } from '../store.js';
import { taskKindLabel } from '../data.js';
import { esc, icon, opts, fmtDate, relDays, todayStr, addDays, avatar, toast, confirmDialog, emptyState, $, $$ } from '../ui.js';
import { taskForm, googleCalendarUrl } from '../forms.js';

const state = { scope: 'mine', owner: '' };

export function taskItem(t, { showLead = true } = {}) {
  const lead = t.lead_id ? store.get('leads', t.lead_id) : null;
  const today = todayStr();
  const late = !t.done && t.due_date < today;
  const canEdit = store.can('task', t);
  return `<li class="task ${t.done ? 'done' : ''} ${late ? 'late' : ''}" data-id="${t.id}">
    <button class="tcheck" data-act="toggle" aria-label="${t.done ? 'Reabrir' : 'Concluir'}" ${canEdit ? '' : 'disabled'}>${t.done ? icon('check') : ''}</button>
    <div class="task-main">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">
        <span class="chip chip-${t.kind}">${esc(taskKindLabel(t.kind))}</span>
        <span class="${late ? 'late-text' : ''}">${fmtDate(t.due_date, false)}${t.due_time ? ' · ' + esc(t.due_time) : ''} <span class="muted">(${esc(relDays(t.due_date))})</span></span>
        ${showLead && lead ? `<a href="#/lead/${lead.id}">${esc(lead.company)}</a>` : ''}
      </div>
    </div>
    <div class="task-side">
      ${avatar(store.profile(t.owner_id), 'sm')}
      ${!t.done ? `<a class="icon-btn" href="${esc(googleCalendarUrl(t))}" target="_blank" rel="noopener" title="Adicionar ao Google Agenda" aria-label="Adicionar ao Google Agenda">${icon('calendar')}</a>` : ''}
      ${canEdit ? `<button class="icon-btn" data-act="edit" aria-label="Editar">${icon('edit')}</button>` : ''}
      ${store.can('delete') || t.created_by === store.user.id ? `<button class="icon-btn" data-act="del" aria-label="Excluir">${icon('trash')}</button>` : ''}
    </div>
  </li>`;
}

export function bindTaskList(root, refresh) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const li = btn.closest('.task');
    const t = store.get('tasks', li.dataset.id);
    if (!t) return;
    try {
      if (btn.dataset.act === 'toggle') {
        await store.update('tasks', t.id, { done: !t.done, done_at: t.done ? null : new Date().toISOString() });
        toast(t.done ? 'Tarefa concluída.' : 'Tarefa reaberta.');
        refresh();
      } else if (btn.dataset.act === 'edit') {
        taskForm(t, { onSaved: refresh });
      } else if (btn.dataset.act === 'del') {
        if (await confirmDialog('Excluir tarefa', `Excluir "${t.title}"?`, { label: 'Excluir' })) {
          await store.remove('tasks', t.id); toast('Tarefa excluída.'); refresh();
        }
      }
    } catch (err) { toast(err.message, 'err'); }
  });
}

export function render(el, { refresh }) {
  const today = todayStr();
  const week = addDays(today, 7);
  let tasks = store.all('tasks');
  if (state.scope === 'mine') tasks = tasks.filter((t) => t.owner_id === store.user.id);
  else if (state.owner) tasks = tasks.filter((t) => t.owner_id === state.owner);
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.due_date + (a.due_time || '99')).localeCompare(b.due_date + (b.due_time || '99')));
  const groups = [
    { title: 'Atrasadas', items: open.filter((t) => t.due_date < today), cls: 'late' },
    { title: 'Hoje', items: open.filter((t) => t.due_date === today) },
    { title: 'Próximos 7 dias', items: open.filter((t) => t.due_date > today && t.due_date <= week) },
    { title: 'Mais tarde', items: open.filter((t) => t.due_date > week) },
  ];
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')).slice(0, 30);

  el.innerHTML = `
    <header class="page-head">
      <div><h1>Agenda e tarefas</h1><p class="muted">Reuniões, follow-ups e próximas ações de cada cliente.</p></div>
      <div class="head-actions">
        <button class="btn btn-ghost" id="new-meet">${icon('calendar')}<span>Agendar reunião</span></button>
        <button class="btn btn-primary" id="new-task">${icon('plus')}<span>Nova tarefa</span></button>
      </div>
    </header>
    <div class="filters">
      <div class="seg" role="tablist">
        <button class="${state.scope === 'mine' ? 'on' : ''}" data-scope="mine">Minhas</button>
        <button class="${state.scope === 'all' ? 'on' : ''}" data-scope="all">Toda a equipe</button>
      </div>
      ${state.scope === 'all' ? `<select id="t-owner">${opts(store.all('profiles').map((p) => ({ id: p.id, label: p.name })), state.owner, { empty: 'Todos os responsáveis' })}</select>` : ''}
    </div>
    <div id="task-groups">
      ${groups.map((g) => g.items.length ? `<section class="card"><h2 class="sec-title ${g.cls || ''}">${g.title} <span class="count">${g.items.length}</span></h2><ul class="tasks">${g.items.map((t) => taskItem(t)).join('')}</ul></section>` : '').join('') ||
        `<section class="card">${emptyState('Nenhuma tarefa pendente.')}</section>`}
      ${done.length ? `<details class="card"><summary class="sec-title">Concluídas <span class="count">${done.length}</span></summary><ul class="tasks">${done.map((t) => taskItem(t)).join('')}</ul></details>` : ''}
    </div>`;

  $$('[data-scope]', el).forEach((b) => b.addEventListener('click', () => { state.scope = b.dataset.scope; refresh(); }));
  const so = $('#t-owner', el);
  if (so) so.addEventListener('change', () => { state.owner = so.value; refresh(); });
  $('#new-task', el).addEventListener('click', () => taskForm(null, { onSaved: refresh }));
  $('#new-meet', el).addEventListener('click', () => taskForm(null, { kind: 'reuniao', onSaved: refresh }));
  bindTaskList($('#task-groups', el), refresh);
}
