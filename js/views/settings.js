// Configurações: conta, instalação no celular, backup, registro de alterações, LGPD.

import { store } from '../store.js';
import { CONFIG } from '../config.js';
import { esc, icon, opts, toast, downloadBlob, todayStr, confirmDialog, field, openModal, formData, emptyState, $, $$ } from '../ui.js';
import { auditRow } from './leads.js';

const state = { who: '' };

export function render(el, { refresh }) {
  const admin = store.can('admin');
  const audit = store.all('audit_log').filter((a) => !state.who || a.user_id === state.who).slice(0, 150);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  el.innerHTML = `
    <header class="page-head"><div><h1>Configurações</h1><p class="muted">${esc(CONFIG.APP_NAME)} · versão ${esc(CONFIG.VERSION)}</p></div></header>
    ${store.demo ? `<section class="card notice">
      <h2 class="sec-title">Modo demonstração</h2>
      <p>Os dados ficam guardados só neste aparelho e neste navegador. Cada pessoa que abrir o link vê a sua própria cópia. Para a equipe partilhar os mesmos dados, ligue o Supabase (ver README do repositório).</p>
      <div class="row-btns"><button class="btn btn-ghost btn-sm" id="reset">Recomeçar com os dados iniciais</button></div>
    </section>` : ''}
    <div class="cols">
      <section class="card">
        <h2 class="sec-title">A minha conta</h2>
        <p><strong>${esc(store.user.name)}</strong><br><span class="muted">${esc(store.user.email || '')}</span></p>
        <div class="row-btns">${!store.demo ? '<button class="btn btn-ghost btn-sm" id="pw">Alterar senha</button>' : ''}
          <button class="btn btn-ghost btn-sm" id="logout">${icon('logout')}<span>Sair</span></button></div>
      </section>
      <section class="card">
        <h2 class="sec-title">Instalar no celular</h2>
        ${isIOS ? '<p>No Safari, toque em <b>Partilhar</b> e depois em <b>Adicionar à Tela de Início</b>. O CRM abre em tela cheia, com ícone próprio.</p>'
          : '<p><b>iPhone:</b> Safari → Partilhar → Adicionar à Tela de Início.<br><b>Android:</b> Chrome → menu ⋮ → Instalar app.<br><b>Computador:</b> ícone de instalar na barra de endereço do Chrome ou Edge.</p>'}
      </section>
      <section class="card">
        <h2 class="sec-title">Backup dos dados</h2>
        <p class="muted small">Baixa um arquivo com todos os registros (sem o conteúdo dos anexos). Guarde uma cópia por semana num lugar seguro.${!store.demo ? ' O plano gratuito do Supabase não guarda backups automáticos que se possam restaurar.' : ''}</p>
        <div class="row-btns">${store.can('export') ? `<button class="btn btn-ghost btn-sm" id="backup">${icon('download')}<span>Baixar backup (.json)</span></button>` : '<span class="muted">Sem permissão para exportar.</span>'}
          ${store.demo && admin ? `<label class="btn btn-ghost btn-sm file-btn">${icon('upload')}<span>Restaurar backup</span><input type="file" id="restore" accept="application/json,.json" hidden></label>` : ''}</div>
      </section>
      <section class="card">
        <h2 class="sec-title">Proteção de dados (LGPD)</h2>
        <ul class="bullets small">
          <li>Cada pessoa entra com login individual; o acesso segue a permissão de cada um.</li>
          <li>Todas as alterações ficam registradas com autor e data.</li>
          <li>Cada lead guarda a base legal para o tratamento dos dados.</li>
          <li>A pedido do titular, o administrador pode anonimizar os dados pessoais na ficha do lead.</li>
          <li>Recolha só o necessário para o atendimento comercial.</li>
        </ul>
      </section>
      ${!store.demo && admin && !store.all('leads').length ? `<section class="card">
        <h2 class="sec-title">Dados iniciais</h2>
        <p class="muted small">Importa os 6 leads de 19 Nov 2026, as tarefas, o histórico e o catálogo de serviços. Os responsáveis são ligados aos perfis pelo e-mail @femik.ca.</p>
        <button class="btn btn-primary btn-sm" id="seed">Importar dados iniciais</button>
      </section>` : ''}
    </div>
    <section class="card">
      <div class="card-head"><h2 class="sec-title">Registro de alterações</h2>
        <select id="who" aria-label="Pessoa">${opts(store.all('profiles').map((p) => ({ id: p.id, label: p.name })), state.who, { empty: 'Toda a equipe' })}</select></div>
      ${audit.length ? `<ul class="audit">${audit.map(auditRow).join('')}</ul>` : emptyState('Nenhuma alteração registrada.')}
    </section>`;

  $('#logout', el).addEventListener('click', async () => { await store.signOut(); location.hash = '#/'; location.reload(); });
  $('#who', el).addEventListener('change', (e) => { state.who = e.target.value; refresh(); });
  const bk = $('#backup', el);
  if (bk) bk.addEventListener('click', () => {
    downloadBlob(`crm-femik-backup-${todayStr()}.json`, JSON.stringify(store.exportJSON(), null, 1), 'application/json');
    toast('Backup gerado.');
  });
  const rs = $('#restore', el);
  if (rs) rs.addEventListener('change', async () => {
    const f = rs.files[0]; if (!f) return;
    if (!(await confirmDialog('Restaurar backup', 'Substituir todos os dados deste aparelho pelos do arquivo?', { label: 'Restaurar' }))) return;
    try { await store.importJSON(JSON.parse(await f.text())); toast('Backup restaurado.'); refresh(); } catch (err) { toast(err.message, 'err'); }
  });
  const reset = $('#reset', el);
  if (reset) reset.addEventListener('click', async () => {
    if (!(await confirmDialog('Recomeçar', 'Apagar tudo o que foi feito neste aparelho e voltar aos dados iniciais?', { label: 'Recomeçar' }))) return;
    store.resetDemo(); location.reload();
  });
  const seed = $('#seed', el);
  if (seed) seed.addEventListener('click', async () => {
    seed.disabled = true;
    try { await store.importSeedToSupabase(); toast('Dados iniciais importados.'); refresh(); } catch (err) { toast(err.message, 'err'); seed.disabled = false; }
  });
  const pw = $('#pw', el);
  if (pw) pw.addEventListener('click', () => openModal({
    title: 'Alterar senha',
    body: `${field('Nova senha *', '<input name="pw" type="password" minlength="8" required autocomplete="new-password">', { hint: 'Mínimo de 8 caracteres.' })}`,
    onSubmit: async (form) => {
      const d = formData(form);
      if (d.pw.length < 8) { toast('A senha precisa de pelo menos 8 caracteres.', 'err'); return false; }
      await store.adapter.updatePassword(d.pw); toast('Senha alterada.');
    },
  }));
}
