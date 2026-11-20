// Funil de vendas (Kanban) com arrastar e soltar — rato e toque (iPhone).

import { store } from '../store.js';
import { STAGES, COUNTRIES, stageLabel } from '../data.js';
import { esc, icon, opts, money, totalsText, moneyTotals, relDays, todayStr, avatar, toast, $, $$ } from '../ui.js';
import { leadForm, lostForm, contractForm } from '../forms.js';

const filters = { owner: '', country: '', q: '' };

export function render(el, { navigate, refresh }) {
  const canEdit = store.can('edit');
  const leads = store.all('leads').filter((l) =>
    (!filters.owner || l.owner_id === filters.owner) &&
    (!filters.country || l.country === filters.country) &&
    (!filters.q || (l.company + ' ' + (l.contact_name || '')).toLowerCase().includes(filters.q.toLowerCase())));
  const today = todayStr();

  const card = (l) => {
    const overdue = l.next_action_date && l.next_action_date < today && !['ganho', 'perdido'].includes(l.stage);
    return `<article class="kcard" data-id="${l.id}" tabindex="0" aria-label="${esc(l.company)}">
      <div class="kcard-top"><strong>${esc(l.company)}</strong>${avatar(store.profile(l.owner_id), 'sm')}</div>
      <div class="kcard-meta">${esc([l.city, l.country].filter(Boolean).join(', '))}</div>
      ${l.value_estimate ? `<div class="kcard-value">${money(l.value_estimate, l.currency)}</div>` : ''}
      ${l.stage === 'perdido' && l.lost_reason ? `<div class="kcard-next">Motivo: ${esc(l.lost_reason)}</div>` : ''}
      ${l.next_action && !['ganho', 'perdido'].includes(l.stage) ? `<div class="kcard-next ${overdue ? 'late' : ''}">${overdue ? icon('alert') : icon('calendar')}<span>${esc(l.next_action)}${l.next_action_date ? ` · ${esc(relDays(l.next_action_date))}` : ''}</span></div>` : ''}
    </article>`;
  };

  el.innerHTML = `
    <header class="page-head">
      <div><h1>Funil de vendas</h1><p class="muted">${canEdit ? 'Arraste os cards entre as etapas. No celular, toque e segure o card para arrastar.' : 'Visualização do funil.'}</p></div>
      ${canEdit ? `<button class="btn btn-primary" id="new-lead">${icon('plus')}<span>Novo lead</span></button>` : ''}
    </header>
    <div class="filters">
      <label class="search">${icon('search')}<input id="f-q" placeholder="Buscar empresa" value="${esc(filters.q)}"></label>
      <select id="f-owner" aria-label="Responsável">${opts(store.all('profiles').map((p) => ({ id: p.id, label: p.name })), filters.owner, { empty: 'Todos os responsáveis' })}</select>
      <select id="f-country" aria-label="País">${opts(COUNTRIES, filters.country, { empty: 'Todos os países' })}</select>
    </div>
    <div class="board" id="board">
      ${STAGES.map((s) => {
        const items = leads.filter((l) => l.stage === s.id).sort((a, b) => (a.next_action_date || '9').localeCompare(b.next_action_date || '9'));
        return `<section class="kcol kcol-${s.id}" data-stage="${s.id}">
          <header class="kcol-head"><span>${esc(s.label)}</span><b>${items.length}</b></header>
          <div class="kcol-sum">${totalsText(moneyTotals(items, 'value_estimate'))}</div>
          <div class="kcol-body">${items.map(card).join('') || '<div class="kcol-empty">—</div>'}</div>
        </section>`;
      }).join('')}
    </div>`;

  $('#f-q', el).addEventListener('input', (e) => { filters.q = e.target.value; refreshKeepFocus(); });
  $('#f-owner', el).addEventListener('change', (e) => { filters.owner = e.target.value; refresh(); });
  $('#f-country', el).addEventListener('change', (e) => { filters.country = e.target.value; refresh(); });
  function refreshKeepFocus() {
    const pos = $('#f-q', el).selectionStart;
    refresh();
    const inp = $('#f-q', el); inp.focus(); inp.setSelectionRange(pos, pos);
  }
  const nl = $('#new-lead', el);
  if (nl) nl.addEventListener('click', () => leadForm(null, { onSaved: (l) => navigate(`#/lead/${l.id}`) }));

  const board = $('#board', el);
  let suppressClick = false;
  board.addEventListener('click', (e) => {
    const c = e.target.closest('.kcard');
    if (!c) return;
    if (suppressClick) { suppressClick = false; return; }
    navigate(`#/lead/${c.dataset.id}`);
  });
  board.addEventListener('keydown', (e) => {
    const c = e.target.closest('.kcard');
    if (c && e.key === 'Enter') navigate(`#/lead/${c.dataset.id}`);
  });

  if (canEdit) enableDrag(board, async (id, stage) => {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 400);
    const lead = store.get('leads', id);
    if (!lead || lead.stage === stage) return;
    if (stage === 'perdido') return lostForm(id, { onSaved: refresh, onCancel: refresh });
    if (stage === 'ganho') return contractForm(id, null, { fromWin: true, onSaved: refresh, onCancel: refresh });
    try {
      await store.moveStage(id, stage);
      toast(`${lead.company} → ${stageLabel(stage)}`);
    } catch (err) { toast(err.message, 'err'); }
    refresh();
  });
}

let dragCtrl = null;
function enableDrag(board, onDrop) {
  if (dragCtrl) dragCtrl.abort();
  dragCtrl = new AbortController();
  const signal = dragCtrl.signal;
  let st = null;
  let raf = 0;

  const cleanup = () => {
    if (st) {
      clearTimeout(st.timer);
      if (st.ghost) st.ghost.remove();
      if (st.card) st.card.classList.remove('dragging');
    }
    $$('.kcol.drop', board).forEach((c) => c.classList.remove('drop'));
    document.body.classList.remove('is-dragging');
    cancelAnimationFrame(raf);
    st = null;
  };

  const activate = () => {
    if (!st) return;
    st.active = true;
    const r = st.card.getBoundingClientRect();
    const g = st.card.cloneNode(true);
    g.classList.add('ghost');
    g.style.width = r.width + 'px';
    st.offX = st.x - r.left; st.offY = st.y - r.top;
    document.body.appendChild(g);
    st.ghost = g;
    st.card.classList.add('dragging');
    document.body.classList.add('is-dragging');
    if (navigator.vibrate) navigator.vibrate(12);
    position();
    loop();
  };
  const position = () => {
    if (!st || !st.ghost) return;
    st.ghost.style.transform = `translate(${st.x - st.offX}px, ${st.y - st.offY}px) rotate(2deg)`;
    const under = document.elementFromPoint(st.x, st.y);
    const col = under && under.closest('.kcol');
    $$('.kcol.drop', board).forEach((c) => c !== col && c.classList.remove('drop'));
    if (col) col.classList.add('drop');
    st.col = col;
  };
  const loop = () => {
    if (!st || !st.active) return;
    const br = board.getBoundingClientRect();
    const edge = 56;
    if (st.x < br.left + edge) board.scrollLeft -= 12;
    else if (st.x > br.right - edge) board.scrollLeft += 12;
    if (st.col) {
      const body = $('.kcol-body', st.col);
      const cr = body.getBoundingClientRect();
      if (st.y < cr.top + 40) body.scrollTop -= 8; else if (st.y > cr.bottom - 40) body.scrollTop += 8;
    }
    position();
    raf = requestAnimationFrame(loop);
  };

  board.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.kcard');
    if (!card || (e.pointerType === 'mouse' && e.button !== 0)) return;
    cleanup();
    st = { card, id: card.dataset.id, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', active: false };
    if (st.touch) st.timer = setTimeout(activate, 280);
  });
  window.addEventListener('pointermove', (e) => {
    if (!st) return;
    st.x = e.clientX; st.y = e.clientY;
    if (!st.active) {
      const moved = Math.hypot(st.x - st.x0, st.y - st.y0);
      if (st.touch && moved > 10) cleanup();        // o dedo está a rolar a tela
      else if (!st.touch && moved > 6) activate();
      return;
    }
    position();
  }, { signal });
  const finish = () => {
    if (!st) return;
    const { active, col, id } = st;
    cleanup();
    if (active && col) onDrop(id, col.dataset.stage);
  };
  window.addEventListener('pointerup', finish, { signal });
  window.addEventListener('pointercancel', () => { if (st && !st.active) cleanup(); }, { signal });
  // No iOS, depois de ativar o arraste é preciso travar a rolagem da página.
  board.addEventListener('touchmove', (e) => { if (st && st.active) e.preventDefault(); }, { passive: false });
  board.addEventListener('contextmenu', (e) => { if (e.target.closest('.kcard')) e.preventDefault(); });
}
