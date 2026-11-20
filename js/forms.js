// Formulários (modais) partilhados entre as telas.

import { store } from './store.js';
import {
  COUNTRIES, CURRENCIES, CURRENCY_BY_COUNTRY, SOURCES, SERVICE_CATEGORIES, STAGES, LOST_REASONS,
  INTERACTION_TYPES, TASK_KINDS, PROJECT_STATUS, UNITS,
} from './data.js';
import { esc, opts, field, openModal, formData, toast, todayStr, addDays, $, money } from './ui.js';

const activeProfiles = () => store.all('profiles').filter((p) => p.active !== false);
const profileOpts = (sel, empty) => opts(activeProfiles().map((p) => ({ id: p.id, label: p.name })), sel, empty !== undefined ? { empty } : {});
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')));

// --- lead -------------------------------------------------------------------
export function leadForm(lead = null, { onSaved, stage } = {}) {
  const l = lead || { country: 'Brasil', currency: 'BRL', stage: stage || 'novo', owner_id: store.user.id, source: 'Prospecção ativa', consent: true };
  const segments = [...new Set(store.all('leads').map((x) => x.segment).filter(Boolean))];
  openModal({
    title: lead ? 'Editar lead' : 'Novo lead',
    wide: true,
    submitLabel: lead ? 'Salvar alterações' : 'Cadastrar lead',
    body: `<div class="grid2">
      ${field('Empresa *', `<input name="company" required value="${esc(l.company)}" autocomplete="organization">`)}
      ${field('Responsável na empresa', `<input name="contact_name" value="${esc(l.contact_name)}" autocomplete="name">`)}
      ${field('Telefone', `<input name="phone" type="tel" value="${esc(l.phone)}" placeholder="+55 51 ...">`)}
      ${field('WhatsApp', `<input name="whatsapp" type="tel" value="${esc(l.whatsapp)}" placeholder="+1 403 ...">`, { hint: 'Com código do país. Gera o link wa.me.' })}
      ${field('E-mail', `<input name="email" type="email" value="${esc(l.email)}" autocomplete="email">`)}
      ${field('Segmento', `<input name="segment" list="dl-seg" value="${esc(l.segment)}"><datalist id="dl-seg">${segments.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>`)}
      ${field('País *', `<select name="country" required>${opts(COUNTRIES, l.country)}</select>`)}
      ${field('Cidade', `<input name="city" value="${esc(l.city)}">`)}
      ${field('Serviço de interesse', `<select name="service_interest">${opts(SERVICE_CATEGORIES, l.service_interest, { empty: '—' })}</select>`)}
      ${field('Origem do lead', `<select name="source">${opts(SOURCES, l.source)}</select>`)}
      ${field('Responsável pelo atendimento', `<select name="owner_id">${profileOpts(l.owner_id)}</select>`)}
      ${lead ? '' : field('Etapa do funil', `<select name="stage">${opts(STAGES.filter((s) => s.id !== 'ganho' && s.id !== 'perdido'), l.stage)}</select>`)}
      <div class="field"><span class="field-label">Valor estimado da oportunidade</span>
        <div class="row-input"><input name="value_estimate" inputmode="decimal" value="${esc(l.value_estimate ?? '')}" placeholder="0">
        <select name="currency" class="w-cur">${opts(CURRENCIES, l.currency)}</select></div></div>
      ${field('Próxima ação', `<input name="next_action" value="${esc(l.next_action)}" placeholder="Ex.: enviar proposta">`)}
      ${field('Data da próxima ação', `<input name="next_action_date" type="date" value="${esc(l.next_action_date)}">`)}
      ${field('Anotações', `<textarea name="notes" rows="3">${esc(l.notes)}</textarea>`, { full: true })}
      <label class="check full"><input type="checkbox" name="consent" ${l.consent ? 'checked' : ''}>
        <span>Contato com base legal para tratar os dados (LGPD): o lead forneceu os dados ou há interesse legítimo comercial.</span></label>
    </div>`,
    onOpen: (form) => {
      form.country.addEventListener('change', () => { form.currency.value = CURRENCY_BY_COUNTRY[form.country.value] || form.currency.value; });
    },
    onSubmit: async (form) => {
      const d = formData(form);
      const row = {
        company: d.company.trim(), contact_name: d.contact_name.trim(), phone: d.phone.trim(), whatsapp: d.whatsapp.trim(),
        email: d.email.trim(), segment: d.segment.trim(), country: d.country, city: d.city.trim(), service_interest: d.service_interest,
        source: d.source, owner_id: d.owner_id, value_estimate: num(d.value_estimate), currency: d.currency,
        next_action: d.next_action.trim(), next_action_date: d.next_action_date || null, notes: d.notes, consent: !!form.consent.checked,
      };
      let saved;
      if (lead) saved = await store.update('leads', lead.id, row);
      else saved = await store.insert('leads', { ...row, stage: d.stage || 'novo', status: 'lead', stage_changed_at: new Date().toISOString(), lost_reason: '', won_at: null, lost_at: null, last_contact_at: null });
      toast(lead ? 'Lead atualizado.' : 'Lead cadastrado.');
      onSaved && onSaved(saved);
    },
  });
}

// --- interação (histórico) --------------------------------------------------
export function interactionForm(leadId, { onSaved, type = 'whatsapp' } = {}) {
  const lead = store.get('leads', leadId);
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  openModal({
    title: `Registrar atendimento · ${lead.company}`,
    body: `<div class="grid2">
      ${field('Tipo', `<select name="type">${opts(INTERACTION_TYPES, type)}</select>`)}
      ${field('Quando', `<input name="at" type="datetime-local" value="${local}">`)}
      ${field('O que aconteceu *', `<textarea name="summary" rows="4" required placeholder="Resumo da conversa, combinados, objeções…"></textarea>`, { full: true })}
      ${field('Próxima ação (opcional)', `<input name="next_action" value="" placeholder="Ex.: ligar para confirmar">`)}
      ${field('Data da próxima ação', `<input name="next_date" type="date" value="${addDays(todayStr(), 3)}">`, { hint: 'Cria um follow-up na agenda.' })}
    </div>`,
    onSubmit: async (form) => {
      const d = formData(form);
      await store.logInteraction(leadId, d.type, d.summary.trim(), d.at ? new Date(d.at).toISOString() : null);
      if (d.next_action.trim()) {
        await store.update('leads', leadId, { next_action: d.next_action.trim(), next_action_date: d.next_date || null });
        await store.insert('tasks', {
          lead_id: leadId, title: d.next_action.trim(), kind: 'followup', due_date: d.next_date || todayStr(), due_time: '',
          owner_id: lead.owner_id || store.user.id, done: false, done_at: null, notes: '',
        });
      }
      toast('Atendimento registrado.');
      onSaved && onSaved();
    },
  });
}

// --- tarefa / reunião --------------------------------------------------------
export function taskForm(task = null, { leadId, kind, onSaved } = {}) {
  const t = task || { kind: kind || 'tarefa', due_date: todayStr(), owner_id: store.user.id, lead_id: leadId || '' };
  const leads = store.all('leads').slice().sort((a, b) => a.company.localeCompare(b.company));
  openModal({
    title: task ? 'Editar tarefa' : (t.kind === 'reuniao' ? 'Agendar reunião' : 'Nova tarefa'),
    body: `<div class="grid2">
      ${field('Título *', `<input name="title" required value="${esc(t.title)}">`, { full: true })}
      ${field('Tipo', `<select name="kind">${opts(TASK_KINDS, t.kind)}</select>`)}
      ${field('Cliente / lead', `<select name="lead_id">${opts(leads.map((l) => ({ id: l.id, label: l.company })), t.lead_id, { empty: '— sem cliente —' })}</select>`)}
      ${field('Data *', `<input name="due_date" type="date" required value="${esc(t.due_date)}">`)}
      ${field('Hora', `<input name="due_time" type="time" value="${esc(t.due_time)}">`, { hint: 'Opcional. Sem hora = dia inteiro.' })}
      ${field('Responsável', `<select name="owner_id">${profileOpts(t.owner_id)}</select>`)}
      ${field('Notas', `<textarea name="notes" rows="2">${esc(t.notes)}</textarea>`, { full: true })}
    </div>`,
    onSubmit: async (form) => {
      const d = formData(form);
      const row = { title: d.title.trim(), kind: d.kind, lead_id: d.lead_id || null, due_date: d.due_date, due_time: d.due_time || '', owner_id: d.owner_id, notes: d.notes };
      let saved;
      if (task) saved = await store.update('tasks', task.id, row);
      else saved = await store.insert('tasks', { ...row, done: false, done_at: null });
      if (!task && d.kind === 'reuniao' && d.lead_id) {
        const lead = store.get('leads', d.lead_id);
        if (lead && ['novo', 'contato'].includes(lead.stage)) await store.moveStage(lead.id, 'reuniao');
      }
      toast(task ? 'Tarefa atualizada.' : (d.kind === 'reuniao' ? 'Reunião agendada.' : 'Tarefa criada.'));
      onSaved && onSaved(saved);
    },
  });
}

// Link "Adicionar ao Google Agenda": abre o evento já preenchido na agenda
// Google da pessoa que toca no botão (cada um usa a própria agenda).
export function googleCalendarUrl(task) {
  const lead = task.lead_id ? store.get('leads', task.lead_id) : null;
  const d = task.due_date.replace(/-/g, '');
  let dates;
  if (task.due_time) {
    const [h, m] = task.due_time.split(':').map(Number);
    const end = new Date(2000, 0, 1, h + 1, m);
    const pad = (n) => String(n).padStart(2, '0');
    const endDay = h + 1 >= 24 ? addDaysCompact(task.due_date, 1) : d;
    dates = `${d}T${pad(h)}${pad(m)}00/${endDay}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  } else {
    dates = `${d}/${addDaysCompact(task.due_date, 1)}`;
  }
  const details = [lead ? `Cliente: ${lead.company}` : '', lead?.contact_name ? `Contato: ${lead.contact_name}` : '', lead?.whatsapp ? `WhatsApp: ${lead.whatsapp}` : '', task.notes || '', 'Criado pelo CRM Femik'].filter(Boolean).join('\n');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: task.title, dates, details });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
function addDaysCompact(dateStr, n) { return addDays(dateStr, n).replace(/-/g, ''); }

// --- perdido ----------------------------------------------------------------
export function lostForm(leadId, { onSaved, onCancel } = {}) {
  const lead = store.get('leads', leadId);
  let saved = false;
  openModal({
    title: `Marcar como perdido · ${lead.company}`,
    submitLabel: 'Marcar como perdido', danger: true,
    body: `<div class="grid2">
      ${field('Motivo da perda *', `<select name="reason" required>${opts(LOST_REASONS, '', { empty: 'Escolha o motivo' })}</select>`, { full: true })}
      ${field('Detalhes', `<textarea name="details" rows="3" placeholder="O que pesou na decisão?"></textarea>`, { full: true })}
    </div>`,
    onSubmit: async (form) => {
      const d = formData(form);
      await store.moveStage(leadId, 'perdido', { lost_reason: d.reason });
      await store.logInteraction(leadId, 'nota', `Negócio perdido — ${d.reason}${d.details.trim() ? ': ' + d.details.trim() : ''}`);
      saved = true;
      toast('Lead marcado como perdido.');
      onSaved && onSaved();
    },
  });
  // se fechar sem salvar, a tela volta ao estado anterior
  const root = $('#modal-root');
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { if (!saved) onCancel && onCancel(); }));
}

// --- ganho → cliente ativo (contrato) ---------------------------------------
export function contractForm(leadId, contract = null, { onSaved, onCancel, fromWin } = {}) {
  const lead = store.get('leads', leadId);
  const accepted = store.byLead('proposals', leadId).filter((p) => p.status === 'aceita').sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
  const c = contract || {
    services: accepted ? (accepted.items || []).map((i) => i.description).join(', ') : (lead.service_interest || ''),
    value: accepted ? proposalTotal(accepted) : lead.value_estimate,
    currency: accepted ? accepted.currency : lead.currency, monthly_value: accepted ? (proposalMonthly(accepted) || null) : null,
    start_date: todayStr(), end_date: '', project_owner_id: store.user.id, project_status: 'planejamento',
  };
  let saved = false;
  openModal({
    title: contract ? `Contrato · ${lead.company}` : `Converter em cliente · ${lead.company}`,
    wide: true,
    submitLabel: contract ? 'Salvar contrato' : 'Converter em cliente',
    body: `${fromWin ? '<p class="muted small">Negócio fechado. Registre os dados do contrato para o cliente entrar na gestão de clientes ativos.</p>' : ''}
    <div class="grid2">
      ${field('Serviços contratados *', `<input name="services" required value="${esc(c.services)}">`, { full: true })}
      <div class="field"><span class="field-label">Valor do projeto (pagamento único)</span>
        <div class="row-input"><input name="value" inputmode="decimal" value="${esc(c.value ?? '')}"><select name="currency" class="w-cur">${opts(CURRENCIES, c.currency)}</select></div></div>
      ${field('Valor mensal recorrente', `<input name="monthly_value" inputmode="decimal" value="${esc(c.monthly_value ?? '')}" placeholder="Ex.: manutenção, tráfego">`, { hint: 'Na mesma moeda. Deixe vazio se não houver.' })}
      ${field('Data de início', `<input name="start_date" type="date" value="${esc(c.start_date)}">`)}
      ${field('Data de término', `<input name="end_date" type="date" value="${esc(c.end_date)}">`)}
      ${field('Responsável pelo projeto', `<select name="project_owner_id">${profileOpts(c.project_owner_id)}</select>`)}
      ${field('Status do projeto', `<select name="project_status">${opts(PROJECT_STATUS, c.project_status)}</select>`)}
    </div>`,
    onSubmit: async (form) => {
      const d = formData(form);
      const row = {
        services: d.services.trim(), value: num(d.value), currency: d.currency, monthly_value: num(d.monthly_value),
        start_date: d.start_date || null, end_date: d.end_date || null, project_owner_id: d.project_owner_id, project_status: d.project_status,
      };
      if (contract) await store.update('contracts', contract.id, row);
      else {
        await store.insert('contracts', { ...row, lead_id: leadId });
        if (lead.stage !== 'ganho') await store.moveStage(leadId, 'ganho');
        await store.update('leads', leadId, { status: 'cliente' });
        await store.logInteraction(leadId, 'nota', `Negócio fechado: ${row.services} — ${money(row.value, row.currency)}${row.monthly_value ? ` + ${money(row.monthly_value, row.currency)}/mês` : ''}.`);
      }
      saved = true;
      toast(contract ? 'Contrato atualizado.' : 'Cliente ativo cadastrado.');
      onSaved && onSaved();
    },
  });
  const root = $('#modal-root');
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { if (!saved) onCancel && onCancel(); }));
}

// Total de pagamento único (itens "único" e "hora") e total mensal recorrente.
export function proposalTotal(p) {
  return (p.items || []).filter((i) => i.unit !== 'mensal').reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
}
export function proposalMonthly(p) {
  return (p.items || []).filter((i) => i.unit === 'mensal').reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
}
export function proposalTotalText(p) {
  const m = proposalMonthly(p);
  return money(proposalTotal(p), p.currency) + (m ? ` + ${money(m, p.currency)}/mês` : '');
}

// --- serviço do catálogo ------------------------------------------------------
export function serviceForm(svc = null, { onSaved } = {}) {
  const s = svc || { category: 'Websites', unit: 'unico', active: true };
  openModal({
    title: svc ? 'Editar serviço' : 'Novo serviço',
    body: `<div class="grid2">
      ${field('Nome *', `<input name="name" required value="${esc(s.name)}">`, { full: true })}
      ${field('Categoria', `<select name="category">${opts(SERVICE_CATEGORIES, s.category)}</select>`)}
      ${field('Cobrança', `<select name="unit">${opts(UNITS, s.unit)}</select>`)}
      ${field('Preço BRL', `<input name="price_brl" inputmode="decimal" value="${esc(s.price_brl ?? '')}">`)}
      ${field('Preço CAD', `<input name="price_cad" inputmode="decimal" value="${esc(s.price_cad ?? '')}">`)}
      ${field('Preço EUR', `<input name="price_eur" inputmode="decimal" value="${esc(s.price_eur ?? '')}">`)}
      <label class="check"><input type="checkbox" name="active" ${s.active !== false ? 'checked' : ''}><span>Ativo no catálogo</span></label>
    </div>`,
    onSubmit: async (form) => {
      const d = formData(form);
      const row = { name: d.name.trim(), category: d.category, unit: d.unit, price_brl: num(d.price_brl), price_cad: num(d.price_cad), price_eur: num(d.price_eur), active: !!form.active.checked };
      if (svc) await store.update('services', svc.id, row); else await store.insert('services', row);
      toast('Serviço salvo.');
      onSaved && onSaved();
    },
  });
}
