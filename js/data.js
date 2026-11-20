// Constantes do domínio e dados iniciais (seed) do CRM FEMIK.

export const STAGES = [
  { id: 'novo',        label: 'Novo lead' },
  { id: 'contato',     label: 'Contato iniciado' },
  { id: 'reuniao',     label: 'Reunião agendada' },
  { id: 'diagnostico', label: 'Diagnóstico realizado' },
  { id: 'proposta',    label: 'Proposta enviada' },
  { id: 'negociacao',  label: 'Em negociação' },
  { id: 'ganho',       label: 'Fechado (ganho)' },
  { id: 'perdido',     label: 'Perdido' },
];
export const OPEN_STAGES = ['novo', 'contato', 'reuniao', 'diagnostico', 'proposta', 'negociacao'];
export const stageLabel = (id) => (STAGES.find((s) => s.id === id) || {}).label || id;

export const ROLES = [
  { id: 'admin',     label: 'Administrador', desc: 'Acesso total, gere a equipe, os serviços e pode excluir registros.' },
  { id: 'comercial', label: 'Comercial',     desc: 'Cria e edita leads, histórico, tarefas, propostas, contratos e documentos.' },
  { id: 'analista',  label: 'Dados e análise', desc: 'Vê tudo, relatórios e exportações; edita só as próprias tarefas.' },
  { id: 'tecnico',   label: 'Técnico',       desc: 'Vê tudo; atualiza o status dos projetos e as próprias tarefas.' },
];
export const roleLabel = (id) => (ROLES.find((r) => r.id === id) || {}).label || id;

export const COUNTRIES = ['Brasil', 'Canadá', 'Espanha'];
export const CURRENCIES = ['BRL', 'CAD', 'EUR'];
export const CURRENCY_BY_COUNTRY = { 'Brasil': 'BRL', 'Canadá': 'CAD', 'Espanha': 'EUR' };

export const SOURCES = ['Prospecção ativa', 'Indicação', 'Site Femik', 'Instagram', 'WhatsApp', 'Evento / presencial', 'LinkedIn', 'Outro'];
export const SERVICE_CATEGORIES = ['Websites', 'Tráfego', 'Automação', 'Análise de Dados'];
export const LOST_REASONS = ['Preço', 'Sem orçamento agora', 'Escolheu concorrente', 'Sem resposta', 'Adiou / timing', 'Fora do perfil', 'Outro'];

export const INTERACTION_TYPES = [
  { id: 'ligacao',  label: 'Ligação' },
  { id: 'reuniao',  label: 'Reunião' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email',    label: 'E-mail' },
  { id: 'mensagem', label: 'Outra mensagem' },
  { id: 'nota',     label: 'Anotação' },
];
export const interactionLabel = (id) => (INTERACTION_TYPES.find((t) => t.id === id) || {}).label || id;

export const TASK_KINDS = [
  { id: 'tarefa',   label: 'Tarefa' },
  { id: 'reuniao',  label: 'Reunião' },
  { id: 'followup', label: 'Follow-up' },
];
export const taskKindLabel = (id) => (TASK_KINDS.find((t) => t.id === id) || {}).label || id;

export const PROPOSAL_STATUS = [
  { id: 'rascunho',   label: 'Rascunho' },
  { id: 'enviada',    label: 'Enviada' },
  { id: 'negociacao', label: 'Em negociação' },
  { id: 'aceita',     label: 'Aceita' },
  { id: 'recusada',   label: 'Recusada' },
  { id: 'expirada',   label: 'Expirada' },
];
export const proposalStatusLabel = (id) => (PROPOSAL_STATUS.find((s) => s.id === id) || {}).label || id;

export const PROJECT_STATUS = [
  { id: 'planejamento', label: 'Planejamento' },
  { id: 'andamento',    label: 'Em andamento' },
  { id: 'pausado',      label: 'Pausado' },
  { id: 'concluido',    label: 'Concluído' },
];
export const projectStatusLabel = (id) => (PROJECT_STATUS.find((s) => s.id === id) || {}).label || id;

export const FILE_KINDS = [
  { id: 'contrato', label: 'Contrato' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'outro',    label: 'Outro documento' },
];
export const fileKindLabel = (id) => (FILE_KINDS.find((s) => s.id === id) || {}).label || id;

export const UNITS = [
  { id: 'unico',  label: 'Pagamento único' },
  { id: 'mensal', label: 'Mensal' },
  { id: 'hora',   label: 'Por hora' },
];
export const unitLabel = (id) => (UNITS.find((u) => u.id === id) || {}).label || id;

export const TABLES = ['profiles', 'leads', 'interactions', 'tasks', 'services', 'proposals', 'contracts', 'files', 'audit_log'];

// ---------------------------------------------------------------------------
// Dados iniciais — situação do comercial em 19 Nov 2026.
// Os valores estimados das oportunidades saem da tabela de preços proposta.
// ---------------------------------------------------------------------------
const T0 = '2026-11-19T12:00:00.000Z';

export function seedData() {
  const p = {
    kim:    { id: 'u-kim',    name: 'Kim Cid',           email: 'kim@femik.ca',    role: 'admin',     location: 'Calgary, Canadá', active: true },
    isabel: { id: 'u-isabel', name: 'Isabel De Miranda', email: 'isabel@femik.ca', role: 'comercial', location: 'Vitória da Conquista, Brasil', active: true },
    felipe: { id: 'u-felipe', name: 'Felipe Vidal',      email: 'felipe@femik.ca', role: 'analista',  location: 'Caudete, Espanha', active: true },
  };
  const profiles = Object.values(p).map((x) => ({ ...x, created_at: T0 }));

  const svc = (id, name, category, unit, brl, cad, eur) => ({ id, name, category, unit, price_brl: brl, price_cad: cad, price_eur: eur, active: true, created_at: T0 });
  const services = [
    svc('s-landing', 'Landing page / one-page', 'Websites', 'unico', 1800, 1200, 700),
    svc('s-site', 'Site institucional (5–8 páginas)', 'Websites', 'unico', 4500, 3500, 1900),
    svc('s-loja', 'Loja online', 'Websites', 'unico', 8000, 6500, 3200),
    svc('s-manut', 'Manutenção de site', 'Websites', 'mensal', 300, 150, 80),
    svc('s-traf-setup', 'Tráfego — configuração inicial', 'Tráfego', 'unico', 800, 500, 300),
    svc('s-traf-1', 'Tráfego — 1 plataforma (sem verba)', 'Tráfego', 'mensal', 1200, 750, 450),
    svc('s-traf-2', 'Tráfego — Google + Meta (sem verba)', 'Tráfego', 'mensal', 2200, 1300, 800),
    svc('s-auto-1', 'Automação simples (1 fluxo)', 'Automação', 'unico', 1200, 600, 400),
    svc('s-auto-pack', 'Pacote de automação (3–5 fluxos / bot WhatsApp)', 'Automação', 'unico', 3500, 2000, 1300),
    svc('s-auto-sup', 'Suporte de automação', 'Automação', 'mensal', 300, 150, 90),
    svc('s-dash-1', 'Dashboard simples (1 fonte)', 'Análise de Dados', 'unico', 1800, 1200, 700),
    svc('s-dash-full', 'Dashboard completo (várias fontes)', 'Análise de Dados', 'unico', 4500, 3000, 1700),
    svc('s-dados-mes', 'Relatório / manutenção de dados', 'Análise de Dados', 'mensal', 600, 350, 220),
    svc('s-hora', 'Hora avulsa', 'Websites', 'hora', 120, 75, 45),
  ];

  const lead = (o) => ({
    contact_name: '', phone: '', whatsapp: '', email: '', city: '', segment: '', source: 'Prospecção ativa',
    owner_id: p.isabel.id, status: 'lead', lost_reason: '', notes: '', consent: true,
    created_at: T0, updated_at: T0, created_by: p.kim.id, updated_by: p.kim.id,
    stage_changed_at: T0, won_at: null, lost_at: null, last_contact_at: null,
    ...o,
  });
  const leads = [
    lead({ id: 'l-banana', company: 'Banana Verde', country: 'Brasil', city: 'Porto Alegre', segment: 'Loja de produtos ecológicos',
      service_interest: 'Websites', stage: 'contato', value_estimate: 8000, currency: 'BRL', last_contact_at: T0,
      next_action: 'Aguardar resposta ao email; só depois enviar o vídeo da prévia', next_action_date: '2026-11-24',
      notes: 'Loja na Av. José Bonifácio, 593. Prévia da loja online publicada no GitHub Pages (repo banana-verde-loja). Checkout e meio de pagamento a decidir com o dono. Segundo encontro: link da prévia para ele interagir.' }),
    lead({ id: 'l-diz', company: 'Diz Assessoria Imobiliária', contact_name: 'Cinara', country: 'Brasil', city: 'Porto Alegre', segment: 'Imobiliária',
      service_interest: 'Websites', stage: 'contato', value_estimate: 4500, currency: 'BRL', last_contact_at: T0,
      next_action: 'Aguardar resposta da Cinara; depois enviar o vídeo da prévia', next_action_date: '2026-11-24',
      notes: 'Prévia (homepage + página de imóvel) publicada no GitHub Pages (repo diz-ai-assessoria). Vídeo curto da prévia só depois da resposta ao primeiro email.' }),
    lead({ id: 'l-smandych', company: 'Team Smandych Muay Thai & Kickboxing', country: 'Canadá', city: 'Calgary', segment: 'Academia de artes marciais',
      service_interest: 'Websites', stage: 'reuniao', value_estimate: 3500, currency: 'CAD', last_contact_at: T0,
      next_action: 'Conversa presencial (Kim)', next_action_date: '2026-11-21',
      notes: 'Contato inicial formalizado por email. Site mobile-first focado em marcar aula experimental grátis. Inclui kit de marca (logo em alta resolução, SVG e PNG).' }),
    lead({ id: 'l-stonewall', company: 'Stonewall Pub', country: 'Canadá', city: 'Calgary', segment: 'Bar e restaurante',
      service_interest: 'Websites', stage: 'reuniao', value_estimate: 3500, currency: 'CAD', last_contact_at: T0,
      next_action: 'Reunião; depois enviar proposta formal da Femik', next_action_date: '2026-11-21',
      notes: 'Ranchlands, NW Calgary. O dono já viu e gostou dos materiais (vídeo da prévia da homepage). Oferta extra: sessão de fotos dos pratos do menu.' }),
    lead({ id: 'l-everclean', company: 'Ever Clean Services', country: 'Canadá', city: 'Calgary', segment: 'Serviços de limpeza',
      service_interest: 'Websites', stage: 'negociacao', value_estimate: 3500, currency: 'CAD', last_contact_at: T0,
      next_action: 'Retomar o contato', next_action_date: '2026-12-01',
      notes: 'Mockup apresentado e aprovado, mas o cliente ainda não vai fechar o serviço. Referência visual: site Di Miranda.' }),
    lead({ id: 'l-royal', company: 'Royal LePage', country: 'Canadá', city: '', segment: 'Imobiliária',
      service_interest: 'Websites', stage: 'novo', value_estimate: null, currency: 'CAD',
      next_action: 'Primeiro contato', next_action_date: '2026-11-26', notes: 'Ainda não contatado.' }),
  ];

  const task = (o) => ({ kind: 'tarefa', due_time: '', done: false, done_at: null, owner_id: p.isabel.id, created_by: p.kim.id, created_at: T0, updated_at: T0, notes: '', ...o });
  const tasks = [
    task({ id: 't-1', lead_id: 'l-smandych', title: 'Conversa presencial com a Team Smandych', kind: 'reuniao', due_date: '2026-11-21', owner_id: p.kim.id }),
    task({ id: 't-2', lead_id: 'l-stonewall', title: 'Reunião com o Stonewall Pub', kind: 'reuniao', due_date: '2026-11-21', owner_id: p.kim.id }),
    task({ id: 't-3', lead_id: 'l-stonewall', title: 'Enviar proposta formal ao Stonewall Pub', kind: 'followup', due_date: '2026-11-23' }),
    task({ id: 't-4', lead_id: 'l-banana', title: 'Follow-up do primeiro email (Banana Verde)', kind: 'followup', due_date: '2026-11-24' }),
    task({ id: 't-5', lead_id: 'l-diz', title: 'Follow-up do primeiro email para a Cinara', kind: 'followup', due_date: '2026-11-24' }),
    task({ id: 't-6', lead_id: 'l-royal', title: 'Primeiro contato com a Royal LePage', kind: 'tarefa', due_date: '2026-11-26' }),
    task({ id: 't-7', lead_id: 'l-everclean', title: 'Retomar contato com a Ever Clean', kind: 'followup', due_date: '2026-12-01' }),
  ];

  const it = (id, lead_id, type, summary) => ({ id, lead_id, type, summary, at: T0, user_id: p.kim.id, created_at: T0 });
  const interactions = [
    it('i-1', 'l-banana', 'email', 'Primeiro contato por email com a análise e a prévia da loja online. (Registrado na importação.)'),
    it('i-2', 'l-diz', 'email', 'Primeiro contato por email com a Cinara sobre o novo site. (Registrado na importação.)'),
    it('i-3', 'l-smandych', 'email', 'Contato inicial formalizado por email; conversa presencial marcada para sábado, 21 Nov. (Registrado na importação.)'),
    it('i-4', 'l-stonewall', 'mensagem', 'O dono viu e gostou dos materiais; reunião marcada para sábado, 21 Nov. (Registrado na importação.)'),
    it('i-5', 'l-everclean', 'reuniao', 'Mockup apresentado e aprovado; o cliente ainda não vai fechar o serviço. (Registrado na importação.)'),
  ];

  return { profiles, leads, interactions, tasks, services, proposals: [], contracts: [], files: [], audit_log: [] };
}

export const TABLE_LABELS = {
  leads: 'Lead', interactions: 'Atendimento', tasks: 'Tarefa', services: 'Serviço', proposals: 'Proposta',
  contracts: 'Contrato', files: 'Documento', profiles: 'Usuário', audit_log: 'Registro',
};
export const FIELD_LABELS = {
  company: 'empresa', contact_name: 'responsável na empresa', phone: 'telefone', whatsapp: 'WhatsApp', email: 'e-mail',
  country: 'país', city: 'cidade', segment: 'segmento', service_interest: 'serviço de interesse', source: 'origem',
  owner_id: 'responsável', stage: 'etapa', status: 'status', lost_reason: 'motivo da perda', value_estimate: 'valor',
  currency: 'moeda', next_action: 'próxima ação', next_action_date: 'data da próxima ação', notes: 'anotações',
  consent: 'base legal LGPD', last_contact_at: 'último contato', won_at: 'data do ganho', lost_at: 'data da perda',
  stage_changed_at: 'mudança de etapa', title: 'título', kind: 'tipo', due_date: 'data', due_time: 'hora', done: 'concluída',
  done_at: 'conclusão', items: 'itens', sent_at: 'data de envio', valid_until: 'validade', services: 'serviços',
  value: 'valor', monthly_value: 'valor mensal', start_date: 'início', end_date: 'término', project_owner_id: 'responsável pelo projeto',
  project_status: 'status do projeto', role: 'permissão', active: 'ativo', name: 'nome', price_brl: 'preço BRL',
  price_cad: 'preço CAD', price_eur: 'preço EUR', unit: 'cobrança', category: 'categoria', summary: 'resumo', type: 'tipo',
  location: 'local', number: 'número',
};
