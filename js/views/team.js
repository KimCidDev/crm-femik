// Equipe (usuários, permissões, distribuição de carteira) e catálogo de serviços.

import { store } from '../store.js';
import { ROLES, roleLabel, unitLabel, SERVICE_CATEGORIES } from '../data.js';
import { esc, icon, opts, money, avatar, toast, field, openModal, formData, confirmDialog, emptyState, $, $$ } from '../ui.js';
import { serviceForm } from '../forms.js';

export function render(el, { refresh }) {
  const admin = store.can('admin');
  const people = store.all('profiles').slice().sort((a, b) => a.name.localeCompare(b.name));
  const services = store.all('services').slice().sort((a, b) => SERVICE_CATEGORIES.indexOf(a.category) - SERVICE_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name));

  el.innerHTML = `
    <header class="page-head"><div><h1>Equipe e serviços</h1><p class="muted">Membros, permissões, distribuição de clientes e catálogo de serviços.</p></div>
      ${admin ? `<div class="head-actions"><button class="btn btn-ghost" id="transfer">Transferir carteira</button>
      <button class="btn btn-primary" id="add">${icon('plus')}<span>Novo membro</span></button></div>` : ''}</header>
    <section class="card">
      <h2 class="sec-title">Membros da equipe</h2>
      <ul class="people">${people.map((p) => {
        const leads = store.all('leads').filter((l) => l.owner_id === p.id && !['ganho', 'perdido'].includes(l.stage)).length;
        const tasks = store.all('tasks').filter((t) => t.owner_id === p.id && !t.done).length;
        return `<li data-id="${p.id}" class="${p.active === false ? 'inactive' : ''}">
          ${avatar(p, 'lg')}
          <div class="pmain"><strong>${esc(p.name)}</strong>${p.id === store.user.id ? ' <span class="chip">você</span>' : ''}${p.active === false ? ' <span class="chip">desativado</span>' : ''}
            <div class="muted small">${esc([p.email, p.location].filter(Boolean).join(' · '))}</div>
            <div class="small">${leads} lead${leads === 1 ? '' : 's'} em aberto · ${tasks} tarefa${tasks === 1 ? '' : 's'} pendente${tasks === 1 ? '' : 's'}</div></div>
          <div class="pside">${admin ? `<select data-role aria-label="Permissão" ${p.id === store.user.id ? 'disabled title="Você não pode mudar a sua própria permissão"' : ''}>${opts(ROLES, p.role)}</select>
            <button class="icon-btn" data-edit aria-label="Editar">${icon('edit')}</button>` : `<span class="chip">${esc(roleLabel(p.role))}</span>`}</div>
        </li>`;
      }).join('')}</ul>
      <details class="roles"><summary>O que cada permissão pode fazer</summary>
        <dl>${ROLES.map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.desc)}</dd>`).join('')}</dl></details>
    </section>
    <section class="card">
      <div class="card-head"><h2 class="sec-title">Catálogo de serviços</h2>
        ${admin ? `<button class="btn btn-ghost btn-sm" id="add-svc">${icon('plus')}<span>Serviço</span></button>` : ''}</div>
      <p class="muted small">Preços-base sugeridos a partir da pesquisa de mercado (19 Nov 2026), sem impostos. Usados ao montar propostas.</p>
      ${services.length ? `<table class="list compact"><thead><tr><th>Serviço</th><th>Cobrança</th><th class="num">BRL</th><th class="num">CAD</th><th class="num">EUR</th>${admin ? '<th></th>' : ''}</tr></thead>
        <tbody>${services.map((s) => `<tr class="${s.active === false ? 'inactive' : ''}">
          <td data-l="Serviço"><strong>${esc(s.name)}</strong><div class="muted small">${esc(s.category)}</div></td>
          <td data-l="Cobrança">${esc(unitLabel(s.unit))}</td>
          <td data-l="BRL" class="num">${money(s.price_brl, 'BRL')}</td><td data-l="CAD" class="num">${money(s.price_cad, 'CAD')}</td><td data-l="EUR" class="num">${money(s.price_eur, 'EUR')}</td>
          ${admin ? `<td><button class="icon-btn" data-svc="${s.id}" aria-label="Editar serviço">${icon('edit')}</button></td>` : ''}</tr>`).join('')}</tbody></table>` : emptyState('Nenhum serviço cadastrado.')}
    </section>`;

  if (!admin) return;
  $$('[data-role]', el).forEach((s) => s.addEventListener('change', async () => {
    const id = s.closest('li').dataset.id;
    try { await store.update('profiles', id, { role: s.value }); toast('Permissão atualizada.'); } catch (err) { toast(err.message, 'err'); refresh(); }
  }));
  $$('[data-edit]', el).forEach((b) => b.addEventListener('click', () => memberForm(store.get('profiles', b.closest('li').dataset.id), refresh)));
  $$('[data-svc]', el).forEach((b) => b.addEventListener('click', () => serviceForm(store.get('services', b.dataset.svc), { onSaved: refresh })));
  $('#add-svc', el).addEventListener('click', () => serviceForm(null, { onSaved: refresh }));
  $('#add', el).addEventListener('click', () => {
    if (!store.demo) {
      openModal({
        title: 'Novo membro',
        body: `<ol class="steps-list">
          <li>No painel do Supabase, abra <b>Authentication → Users → Invite user</b> e convide o e-mail da pessoa (de preferência @femik.ca).</li>
          <li>A pessoa recebe o convite, define a senha e entra no CRM.</li>
          <li>O perfil aparece aqui automaticamente com a permissão <b>Técnico</b>. Ajuste a permissão nesta tela.</li></ol>`,
      });
      return;
    }
    memberForm(null, refresh);
  });
  $('#transfer', el).addEventListener('click', () => transferForm(refresh));
}

function memberForm(p, refresh) {
  const m = p || { role: 'comercial', active: true };
  openModal({
    title: p ? 'Editar membro' : 'Novo membro',
    body: `<div class="grid2">
      ${field('Nome *', `<input name="name" required value="${esc(m.name)}">`)}
      ${field('E-mail', `<input name="email" type="email" value="${esc(m.email)}" ${p && !store.demo ? 'disabled' : ''}>`)}
      ${field('Local', `<input name="location" value="${esc(m.location)}" placeholder="Cidade, país">`)}
      ${field('Permissão', `<select name="role" ${p && p.id === store.user.id ? 'disabled' : ''}>${opts(ROLES, m.role)}</select>`)}
      ${p && p.id !== store.user.id ? `<label class="check full"><input type="checkbox" name="active" ${m.active !== false ? 'checked' : ''}><span>Acesso ativo (desmarque para bloquear a entrada no CRM)</span></label>` : ''}
    </div>`,
    onSubmit: async (form) => {
      const d = formData(form);
      const row = { name: d.name.trim(), location: d.location.trim() };
      if (!(p && p.id === store.user.id)) row.role = d.role;
      if (store.demo || !p) row.email = (d.email || '').trim();
      if (p && p.id !== store.user.id) row.active = !!form.active.checked;
      if (p) await store.update('profiles', p.id, row); else await store.insert('profiles', { ...row, active: true });
      toast('Membro salvo.'); refresh();
    },
  });
}

function transferForm(refresh) {
  const people = store.all('profiles').map((p) => ({ id: p.id, label: p.name }));
  openModal({
    title: 'Transferir carteira',
    body: `<p class="muted small">Passa os leads em aberto e as tarefas pendentes de uma pessoa para outra (por exemplo, férias ou saída da equipe).</p>
    <div class="grid2">
      ${field('De', `<select name="from" required>${opts(people, '', { empty: 'Escolha' })}</select>`)}
      ${field('Para', `<select name="to" required>${opts(people, '', { empty: 'Escolha' })}</select>`)}
      <label class="check full"><input type="checkbox" name="tasks" checked><span>Incluir as tarefas pendentes</span></label>
    </div>`,
    submitLabel: 'Transferir',
    onSubmit: async (form) => {
      const d = formData(form);
      if (d.from === d.to) { toast('Escolha duas pessoas diferentes.', 'err'); return false; }
      const leads = store.all('leads').filter((l) => l.owner_id === d.from && !['ganho', 'perdido'].includes(l.stage));
      const tasks = form.tasks.checked ? store.all('tasks').filter((t) => t.owner_id === d.from && !t.done) : [];
      for (const l of leads) await store.update('leads', l.id, { owner_id: d.to });
      for (const t of tasks) await store.update('tasks', t.id, { owner_id: d.to });
      toast(`${leads.length} lead(s) e ${tasks.length} tarefa(s) transferidos.`); refresh();
    },
  });
}
