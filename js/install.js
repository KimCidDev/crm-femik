// Instalação do CRM como app: instruções que se adaptam ao aparelho e ao
// navegador onde o link foi aberto (inclusive o navegador interno do WhatsApp).

import { esc, icon, toast } from './ui.js';

const DISMISS_KEY = 'femik-crm-install-dismissed';
let deferredPrompt = null;
const listeners = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  listeners.forEach((fn) => fn());
});
window.addEventListener('appinstalled', () => { deferredPrompt = null; listeners.forEach((fn) => fn()); });
export function onInstallChange(fn) { listeners.add(fn); }

export function platform() {
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const inApp = /WhatsApp|FBAN|FBAV|Instagram|Line\/|LinkedInApp|; wv\)/i.test(ua);
  const iosOtherBrowser = ios && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return { ios, android, inApp, iosOtherBrowser, standalone, mobile: ios || android };
}

export function shouldOfferInstall() {
  const p = platform();
  return !p.standalone && (p.mobile || !!deferredPrompt);
}
export function isDismissed() { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } }
function dismiss() { try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* sem armazenamento */ } }

const appUrl = () => location.href.split('#')[0];

function steps(list) {
  return `<ol class="inst-steps">${list.map((s, i) => `<li><span class="inst-n">${i + 1}</span><span>${s}</span></li>`).join('')}</ol>`;
}
const key = (ic, label) => `<span class="inst-key">${icon(ic, ic === 'dots' ? 'ic-dots' : '')}${label ? `<b>${esc(label)}</b>` : ''}</span>`;

function body() {
  const p = platform();
  if (p.standalone) return '<p class="muted">O CRM já está instalado neste aparelho. 🎉</p>';

  if (deferredPrompt) {
    return `<p>Instale o CRM como app: abre em tela cheia, com ícone próprio, sem a barra do navegador.</p>
      <button type="button" class="btn btn-primary" data-inst="prompt">${icon('download')}<span>Instalar o app</span></button>`;
  }

  if (p.ios && (p.inApp || p.iosOtherBrowser)) {
    return `<p><b>Primeiro, abra este link no Safari.</b> Dentro do WhatsApp ou de outro navegador o iPhone não deixa instalar.</p>
      ${steps([
        `Toque em ${key('compass', 'Abrir no Safari')} (ícone da bússola, no canto da tela) — ou copie o link e cole no Safari.`,
        `No Safari, toque em ${key('share')} <b>Partilhar</b>, na barra de baixo.`,
        `Role a lista e toque em ${key('plussq', 'Adicionar à Tela de Início')}, depois em <b>Adicionar</b>.`,
      ])}
      <button type="button" class="btn btn-ghost btn-sm" data-inst="copy">${icon('file')}<span>Copiar o link</span></button>`;
  }
  if (p.ios) {
    return `<p>Coloque o CRM na tela inicial do iPhone para abrir como um app:</p>
      <p class="inst-tip">${icon('compass')}<span><b>Abriu pelo WhatsApp?</b> Toque primeiro na bússola ${key('compass', 'Abrir no Safari')}, no canto da tela. Dentro do WhatsApp a opção de instalar não aparece.</span></p>
      ${steps([
        `Toque em ${key('share')} <b>Partilhar</b>, na barra de baixo do Safari.`,
        `Role a lista e toque em ${key('plussq', 'Adicionar à Tela de Início')}.`,
        'Toque em <b>Adicionar</b>. O ícone da Femik aparece na tela inicial; abra o CRM sempre por ele.',
      ])}`;
  }
  if (p.android && p.inApp) {
    return `<p><b>Primeiro, abra este link no Chrome.</b> Dentro do WhatsApp não dá para instalar.</p>
      ${steps([
        `Toque em ${key('dots')} no canto superior direito e escolha <b>Abrir no Chrome</b> — ou copie o link e cole no Chrome.`,
        `No Chrome, toque em ${key('dots')} e depois em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).`,
      ])}
      <button type="button" class="btn btn-ghost btn-sm" data-inst="copy">${icon('file')}<span>Copiar o link</span></button>`;
  }
  if (p.android) {
    return `<p>Coloque o CRM na tela inicial para abrir como um app:</p>
      ${steps([
        `Toque em ${key('dots')} no canto superior direito do Chrome.`,
        'Toque em <b>Instalar app</b> (em alguns celulares: <b>Adicionar à tela inicial</b>).',
        'Confirme. O ícone da Femik aparece na tela inicial.',
      ])}`;
  }
  return `<p>No computador, use o ícone de instalar ${key('download')} na barra de endereço do Chrome ou do Edge. Também dá para usar normalmente pelo navegador.</p>`;
}

// Cartão de instalação. dismissible: mostra o "x" e respeita quem já fechou.
export function installCard({ dismissible = false, title = 'Instale o CRM no celular' } = {}) {
  if (dismissible && (isDismissed() || !shouldOfferInstall())) return '';
  return `<section class="card install-card" data-install>
    <div class="card-head"><h2 class="sec-title">${icon('download')}<span>${esc(title)}</span></h2>
      ${dismissible ? `<button type="button" class="icon-btn" data-inst="dismiss" aria-label="Fechar">${icon('x')}</button>` : ''}</div>
    <div class="inst-body">${body()}</div>
  </section>`;
}

export function bindInstall(root) {
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-inst]');
    if (!b) return;
    const act = b.dataset.inst;
    if (act === 'dismiss') { dismiss(); b.closest('[data-install]').remove(); return; }
    if (act === 'copy') {
      try { await navigator.clipboard.writeText(appUrl()); toast('Link copiado. Cole no Safari ou no Chrome.'); }
      catch { window.prompt('Copie o link:', appUrl()); }
      return;
    }
    if (act === 'prompt' && deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === 'accepted') toast('CRM instalado.');
      root.querySelectorAll('[data-install] .inst-body').forEach((el) => { el.innerHTML = body(); });
    }
  });
}
onInstallChange(() => document.querySelectorAll('[data-install] .inst-body').forEach((el) => { el.innerHTML = body(); }));
