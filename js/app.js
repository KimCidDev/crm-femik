// Arranque, login, navegação e roteamento do CRM FEMIK.

import { store } from './store.js';
import { CONFIG } from './config.js';
import { roleLabel } from './data.js';
import { esc, icon, avatar, toast, closeModal, openModal, field, formData, todayStr, $, $$ } from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as pipeline from './views/pipeline.js';
import * as leads from './views/leads.js';
import * as tasks from './views/tasks.js';
import * as proposals from './views/proposals.js';
import * as clients from './views/clients.js';
import * as reports from './views/reports.js';
import * as team from './views/team.js';
import * as settings from './views/settings.js';

const NAV = [
  { id: 'painel', label: 'Painel', icon: 'painel', href: '#/', main: true },
  { id: 'funil', label: 'Funil', icon: 'funil', href: '#/funil', main: true },
  { id: 'leads', label: 'Leads', icon: 'leads', href: '#/leads', main: true },
  { id: 'tarefas', label: 'Agenda', icon: 'tarefas', href: '#/tarefas', main: true },
  { id: 'propostas', label: 'Propostas', icon: 'propostas', href: '#/propostas' },
  { id: 'clientes', label: 'Clientes ativos', icon: 'clientes', href: '#/clientes' },
  { id: 'relatorios', label: 'Relatórios', icon: 'relatorios', href: '#/relatorios' },
  { id: 'equipe', label: 'Equipe e serviços', icon: 'equipe', href: '#/equipe' },
  { id: 'config', label: 'Configurações', icon: 'config', href: '#/config' },
];

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b, c] = h.split('/');
  switch (a) {
    case '': case undefined: return { nav: 'painel', view: dashboard.render };
    case 'funil': return { nav: 'funil', view: pipeline.render };
    case 'leads': return { nav: 'leads', view: leads.renderList };
    case 'lead': return { nav: 'leads', view: leads.renderDetail, params: { id: b, tab: c } };
    case 'tarefas': return { nav: 'tarefas', view: tasks.render };
    case 'propostas': return { nav: 'propostas', view: proposals.renderList };
    case 'proposta': return { nav: 'propostas', view: proposals.renderEditor, params: { id: b } };
    case 'clientes': return { nav: 'clientes', view: clients.render };
    case 'relatorios': return { nav: 'relatorios', view: reports.render };
    case 'equipe': return { nav: 'equipe', view: team.render };
    case 'config': return { nav: 'config', view: settings.render };
    default: return { nav: 'painel', view: dashboard.render };
  }
}

const navigate = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

function render({ keepScroll = false } = {}) {
  const main = $('#main');
  if (!main || !store.user) return;
  const route = parseRoute();
  const board = $('#board', main);
  const boardLeft = board ? board.scrollLeft : 0;
  const y = window.scrollY;
  try {
    route.view(main, { params: route.params || {}, navigate, refresh: () => render({ keepScroll: true }) });
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="card"><p>Erro ao abrir esta tela: ${esc(err.message)}</p></div>`;
  }
  if (keepScroll) {
    const nb = $('#board', main); if (nb) nb.scrollLeft = boardLeft;
    window.scrollTo(0, y);
  } else window.scrollTo(0, 0);
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === route.nav));
  const moreOn = !NAV.find((n) => n.id === route.nav)?.main;
  const mb = $('#more-btn'); if (mb) mb.classList.toggle('on', moreOn);
  updateBadge();
}

function updateBadge() {
  const n = store.all('tasks').filter((t) => !t.done && t.owner_id === store.user.id && t.due_date <= todayStr()).length;
  $$('.nav-badge').forEach((b) => { b.textContent = n; b.hidden = !n; });
}

function shell() {
  const u = store.user;
  document.body.innerHTML = `
    <a class="skip" href="#main">Ir para o conteúdo</a>
    <div class="app">
      <aside class="side">
        <div class="brand"><img src="icons/logo.svg" alt="Femik" height="28"><span>CRM</span></div>
        <nav class="side-nav">${NAV.map((n) => `<a href="${n.href}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span>${n.id === 'tarefas' ? '<b class="nav-badge" hidden></b>' : ''}</a>`).join('')}</nav>
        <div class="side-user">${avatar(u)}<div><strong>${esc(u.name)}</strong><div class="muted small">${esc(roleLabel(u.role))}</div></div></div>
      </aside>
      <div class="content">
        <header class="topbar">
          <img src="icons/simbolo.svg" alt="" width="28" height="28"><strong>CRM Femik</strong>
          ${store.demo ? '<span class="demo-pill">demo</span>' : ''}
          <a href="#/config" class="top-user" aria-label="Configurações">${avatar(u, 'sm')}</a>
        </header>
        ${store.demo ? '<div class="demo-bar">Modo demonstração · os dados ficam só neste aparelho</div>' : ''}
        <main id="main" tabindex="-1"></main>
      </div>
      <nav class="bottom-nav">
        ${NAV.filter((n) => n.main).map((n) => `<a href="${n.href}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span>${n.id === 'tarefas' ? '<b class="nav-badge" hidden></b>' : ''}</a>`).join('')}
        <button id="more-btn" type="button">${icon('mais')}<span>Mais</span></button>
      </nav>
    </div>
    <div id="modal-root"></div><div id="toasts" aria-live="polite"></div><div id="print-root"></div>`;
  $('#more-btn').addEventListener('click', () => {
    openModal({
      title: 'Mais',
      body: `<nav class="more-nav">${NAV.filter((n) => !n.main).map((n) => `<a href="${n.href}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}</nav>`,
    });
    $$('.more-nav a').forEach((a) => a.addEventListener('click', () => closeModal()));
  });
}

// --- login -----------------------------------------------------------------
function loginScreen(error = '') {
  const people = store.all('profiles');
  document.body.innerHTML = `
    <main class="login">
      <div class="login-card">
        <img src="icons/logo.svg" alt="Femik" class="login-logo">
        <h1>CRM</h1>
        ${error ? `<p class="login-err" role="alert">${esc(error)}</p>` : ''}
        ${store.demo ? `
          <p class="muted">Modo demonstração: escolha quem vai usar. Os dados ficam guardados só neste aparelho.</p>
          <div class="login-people">${people.map((p) => `<button class="login-person" data-id="${p.id}">${avatar(p)}<span><strong>${esc(p.name)}</strong><small>${esc(roleLabel(p.role))}</small></span></button>`).join('')}</div>`
        : `
          <form id="login-form" class="login-form">
            ${field('E-mail', '<input name="email" type="email" required autocomplete="username">')}
            ${field('Senha', '<input name="password" type="password" required autocomplete="current-password">')}
            <button class="btn btn-primary btn-block" type="submit">Entrar</button>
            <button class="link" type="button" id="forgot">Esqueci a senha</button>
          </form>`}
      </div>
      <p class="login-foot muted small">${esc(CONFIG.APP_NAME)} · v${esc(CONFIG.VERSION)}</p>
    </main>
    <div id="modal-root"></div><div id="toasts" aria-live="polite"></div>`;
  if (store.demo) {
    $$('.login-person').forEach((b) => b.addEventListener('click', async () => {
      await store.signInDemo(b.dataset.id);
      boot();
    }));
  } else {
    const form = $('#login-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(form);
      const btn = $('button[type=submit]', form); btn.disabled = true;
      try { await store.signInPassword(d.email.trim(), d.password); boot(); } catch (err) { loginScreen(err.message); }
    });
    $('#forgot').addEventListener('click', async () => {
      const email = form.email.value.trim();
      if (!email) { toast('Escreva o seu e-mail primeiro.', 'err'); form.email.focus(); return; }
      try { await store.adapter.resetPassword(email); toast('Enviamos um link para redefinir a senha.'); } catch (err) { toast(err.message, 'err'); }
    });
  }
}

// --- arranque --------------------------------------------------------------
let started = false;
async function boot() {
  if (!store.user) { loginScreen(); return; }
  shell();
  render();
  if (started) return;
  started = true;
  window.addEventListener('hashchange', () => { closeModal(); render(); });
  store.on((info) => {
    updateBadge();
    if (!info.remote) return;
    // alterações feitas por outra pessoa: atualiza a tela se ninguém estiver a escrever
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!document.body.classList.contains('modal-open') && !typing && !document.body.classList.contains('is-dragging')) render({ keepScroll: true });
  });
}

async function start() {
  try {
    const ok = await store.start();
    if (!store.demo) {
      store.adapter.sb.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          openModal({
            title: 'Definir nova senha',
            body: field('Nova senha *', '<input name="pw" type="password" minlength="8" required autocomplete="new-password">'),
            onSubmit: async (form) => { await store.adapter.updatePassword(formData(form).pw); toast('Senha definida.'); },
          });
        }
      });
    }
    if (ok) boot(); else loginScreen();
  } catch (err) {
    console.error(err);
    store.user = null;
    loginScreen(err.message || 'Não foi possível iniciar o CRM.');
  }
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
start();
