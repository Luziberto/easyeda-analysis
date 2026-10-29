/** Tooltip flutuante (evita corte por overflow do header/rail). */
let tipEl: HTMLDivElement | null = null;
let anchorEl: HTMLElement | null = null;

const SELECTOR =
  '#header .btn-icon, #header .mode, #palette button, .pcb-toolbar .btn-icon, ' +
  '.export-menu summary.export-trigger, .export-menu-panel button';

function positionTip(anchor: HTMLElement) {
  if (!tipEl) return;
  const r = anchor.getBoundingClientRect();
  tipEl.hidden = false;
  const tr = tipEl.getBoundingClientRect();
  const inPalette = !!anchor.closest('#palette');
  let x = inPalette
    ? r.right + 8
    : r.left + (r.width - tr.width) / 2;
  let y = inPalette
    ? r.top + (r.height - tr.height) / 2
    : r.bottom + 6;
  x = Math.max(8, Math.min(x, window.innerWidth - tr.width - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - tr.height - 8));
  tipEl.style.left = `${Math.round(x)}px`;
  tipEl.style.top = `${Math.round(y)}px`;
}

function hideTip() {
  if (tipEl) tipEl.hidden = true;
  anchorEl = null;
}

function showTip(el: HTMLElement) {
  if (!tipEl) return;
  if (el instanceof HTMLButtonElement && el.disabled) return;
  const text = el.dataset.tip || el.getAttribute('aria-label') || '';
  if (!text) return;
  anchorEl = el;
  tipEl.textContent = text;
  positionTip(el);
}

function bind(el: HTMLElement) {
  const text = el.dataset.tip || el.getAttribute('title') || el.getAttribute('aria-label');
  if (!text) return;
  el.dataset.tip = text;
  el.removeAttribute('title');
  el.addEventListener('mouseenter', () => showTip(el));
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('focus', () => showTip(el));
  el.addEventListener('blur', hideTip);
}

export function initTooltips(root: ParentNode = document) {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'ui-tooltip';
    tipEl.hidden = true;
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
    window.addEventListener(
      'scroll',
      () => { if (anchorEl && tipEl && !tipEl.hidden) positionTip(anchorEl); },
      true,
    );
    window.addEventListener('resize', hideTip);
  }
  root.querySelectorAll(SELECTOR).forEach((n) => bind(n as HTMLElement));
}
