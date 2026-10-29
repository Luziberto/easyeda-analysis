// UI SVG do protótipo — importa o núcleo compilado em dist/ via mesma árvore após build.
// @ts-nocheck — DOM e eventos; o núcleo tipado cobre a lógica crítica.
import {
  createDocument, Commands, History, createViewport, toWorld, zoomAt, pan,
  hitPin, pinWorld, serialize, deserialize, GRID, snapPoint,
} from '../core/model.js';
import { buildNetlist, junctions, describeWarning } from '../core/connectivity.js';
import { importEasyedaSchematic } from '../format/import-easyeda-sch.js';
import { SYMBOLS } from '../core/library.js';
import * as T from './controller.js';
import { showPrompt, showConfirm } from './dialog.js';
import { saveAutosave, loadAutosave, clearAutosave } from './storage.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('canvas');
const marqueeEl = document.getElementById('marquee');

let doc = createDocument();
const hist = new History(doc);
let vp = createViewport();
let selection = new Set();
let drag = null;
let panning = null;
let marquee = null;
let placeAt = { x: 100, y: 100 };
const tool = T.createTool();
let message = '';
let alt = false;
let autosaveTimer = null;

const say = (m) => { message = m; render(); };
const el = (n, a = {}, p) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, a[k]);
  if (p) p.appendChild(e);
  return e;
};
const pts = (P) => P.map((p) => `${p.x},${p.y}`).join(' ');

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveAutosave(serialize(doc)).catch(() => {});
  }, 800);
}

function renderMarquee() {
  if (!marquee) { marqueeEl.style.display = 'none'; return; }
  const a = toWorld(vp, marquee.sx, marquee.sy);
  const b = toWorld(vp, marquee.cx, marquee.cy);
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const tl = { x: (x0 - vp.x) * vp.scale, y: (y0 - vp.y) * vp.scale };
  const w = (x1 - x0) * vp.scale, h = (y1 - y0) * vp.scale;
  marqueeEl.style.display = 'block';
  marqueeEl.style.left = `${tl.x}px`;
  marqueeEl.style.top = `${tl.y}px`;
  marqueeEl.style.width = `${Math.max(0, w)}px`;
  marqueeEl.style.height = `${Math.max(0, h)}px`;
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function bindInspectorRef(symId) {
  const input = document.getElementById('inspRef');
  input?.addEventListener('change', () => {
    try {
      hist.exec(Commands.setRef(symId, input.value));
      say(`Referência atualizada para ${input.value.trim()}.`);
    } catch (err) {
      say(err.message);
      input.value = doc.symbols.find((s) => s.id === symId).ref;
    }
  });
}

function bindInspectorNet(symId) {
  const input = document.getElementById('inspNet');
  input?.addEventListener('change', () => {
    try {
      hist.exec(Commands.setNet(symId, input.value));
      say(`Rede atualizada para ${input.value.trim()}.`);
    } catch (err) { say(err.message); }
  });
}

function renderInspector() {
  const host = document.getElementById('inspectorBody');
  const ids = [...selection];
  if (!ids.length) {
    host.innerHTML = '<p class="muted">Nenhum item selecionado. Clique ou arraste uma caixa de seleção.</p>';
    return;
  }
  if (ids.length > 1) {
    host.innerHTML = `<p><strong>${ids.length} itens</strong> selecionados. Use Girar ou Excluir em lote.</p>`;
    return;
  }
  const id = ids[0];
  const s = doc.symbols.find((x) => x.id === id);
  if (s) {
    const def = SYMBOLS[s.kind];
    if (def.role) {
      host.innerHTML = `
        <div class="field"><label>Tipo</label><input readonly value="${s.kind} (${def.role})"></div>
        <div class="field"><label>Nome da rede</label><input id="inspNet" value="${escapeAttr(s.net)}"></div>
        <div class="field-row">
          <div class="field"><label>X</label><input readonly value="${s.x}"></div>
          <div class="field"><label>Y</label><input readonly value="${s.y}"></div>
        </div>`;
      bindInspectorNet(s.id);
      return;
    }
    host.innerHTML = `
      <div class="field"><label>Referência</label><input id="inspRef" value="${escapeAttr(s.ref)}"></div>
      <div class="field"><label>Tipo</label><input readonly value="${s.kind}"></div>
      <div class="field-row">
        <div class="field"><label>X</label><input readonly value="${s.x}"></div>
        <div class="field"><label>Y</label><input readonly value="${s.y}"></div>
      </div>
      <div class="field"><label>Rotação</label><input readonly value="${s.rot}°"></div>`;
    bindInspectorRef(s.id);
    return;
  }
  const w = doc.wires.find((x) => x.id === id);
  if (w) {
    host.innerHTML = `
      <div class="field"><label>Fio</label><input readonly value="${w.id}"></div>
      <div class="field"><label>Vértices</label><input readonly value="${w.points.length}"></div>
      <p class="muted">Use "Renomear rede" para criar um rótulo no primeiro vértice.</p>`;
    return;
  }
  host.textContent = 'Item não encontrado.';
}

function render() {
  svg.textContent = '';
  const r = svg.getBoundingClientRect();
  const g = el('g', { transform: `scale(${vp.scale}) translate(${-vp.x} ${-vp.y})` }, svg);
  const pat = el('pattern', { id: 'grid', width: GRID, height: GRID, patternUnits: 'userSpaceOnUse' }, el('defs', {}, svg));
  el('circle', { cx: 0, cy: 0, r: 0.8, fill: '#94a3b8' }, pat);
  el('rect', { x: vp.x, y: vp.y, width: r.width / vp.scale, height: r.height / vp.scale, fill: 'url(#grid)' }, g);
  for (const w of doc.wires) el('polyline', { class: 'wire' + (selection.has(w.id) ? ' sel' : ''), points: pts(w.points) }, g);
  for (const j of junctions(doc)) el('circle', { class: 'junction', cx: j.x, cy: j.y, r: 3 }, g);
  for (const s of doc.symbols) {
    const def = SYMBOLS[s.kind];
    const mx = s.mirror ? -1 : 1;
    const sg = el('g', { class: 'sym' + (selection.has(s.id) ? ' sel' : ''), transform: `translate(${s.x} ${s.y}) rotate(${s.rot}) scale(${mx} 1)` }, g);
    for (const d of def.paths) el('path', { d }, sg);
    for (const p of def.pins) el('circle', { class: 'pin', cx: p.x, cy: p.y, r: 2 }, sg);
    el('text', { class: def.role ? 'netname' : 'ref', x: s.x + (def.role === 'label' ? 2 : -10), y: s.y - (def.role === 'label' ? 3 : 14) }, g).textContent = def.role ? s.net : s.ref;
  }
  if (tool.wire) el('polyline', { class: 'wire', points: pts(T.previewPoints(tool)), 'stroke-dasharray': '4 3' }, g);

  const nl = buildNetlist(doc);
  document.getElementById('status').textContent =
    `${doc.symbols.length} símbolos · ${doc.wires.length} fios · ${Object.keys(nl.nets).length} redes` +
    (nl.warnings.length ? ` · ⚠ ${nl.warnings.length}` : '') +
    ` · ${alt ? 'passo 5 px' : `grade ${GRID} px`}` +
    (T.isWireActive(tool) ? ' · fio ativo' : '') +
    ` · zoom ${vp.scale.toFixed(2)}`;
  const wl = document.getElementById('warnings');
  wl.textContent = message || (nl.warnings.length ? '⚠ ' + nl.warnings.map(describeWarning).join(' | ') : '');
  wl.title = nl.warnings.map(describeWarning).join('\n');
  document.getElementById('undo').disabled = !hist.canUndo;
  document.getElementById('redo').disabled = !hist.canRedo;
  document.getElementById('wireBtn').classList.toggle('on', T.isWireActive(tool));
  renderMarquee();
  renderInspector();
}

hist.on(() => { render(); scheduleAutosave(); });

const ptr = (e) => {
  const rect = svg.getBoundingClientRect();
  return toWorld(vp, e.clientX - rect.left, e.clientY - rect.top);
};
const screenPt = (e) => {
  const rect = svg.getBoundingClientRect();
  return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
};
const snapped = (e) => {
  const raw = ptr(e);
  const pin = hitPin(doc, raw);
  return pin ? pinWorld(doc, pin.sym, pin.pin) : snapPoint(raw, { alt: e.altKey });
};
const commit = (r) => {
  if (r && r.type === 'commit') {
    try { hist.exec(Commands.addWire(r.points)); } catch (err) { say('Fio inválido: ' + err.message); }
  }
};

function finishWire() { commit(T.dblclick(tool)); render(); }

function applySelection(ids, add) {
  if (!ids.length) { if (!add) selection.clear(); return; }
  if (add) ids.forEach((id) => selection.add(id));
  else selection = new Set(ids);
}

function selectAt(p, add) {
  const id = T.pick(doc, p);
  if (!id) {
    if (!add) selection.clear();
    placeAt = p;
    return null;
  }
  if (add) selection.add(id);
  else if (!selection.has(id)) selection = new Set([id]);
  return id;
}

svg.addEventListener('mousedown', (e) => {
  alt = e.altKey;
  message = '';
  if (e.button === 1 || e.button === 2) {
    panning = { x: e.clientX, y: e.clientY };
    return;
  }
  const raw = ptr(e);
  const onPin = !!hitPin(doc, raw);
  if (!T.isWireActive(tool) && !onPin && !T.pick(doc, raw)) {
    const sp = screenPt(e);
    marquee = { sx: sp.sx, sy: sp.sy, cx: sp.sx, cy: sp.sy, add: e.shiftKey };
    return;
  }
  const act = T.down(tool, snapped(e), { raw, onPin, t: e.timeStamp });
  if (act.type === 'commit') commit(act);
  else if (act.type === 'select') {
    const id = selectAt(raw, e.shiftKey);
    if (id && doc.symbols.some((s) => s.id === id)) drag = { start: raw, last: raw };
  }
  render();
});

svg.addEventListener('dblclick', () => { if (tool.wire) finishWire(); });

svg.addEventListener('mousemove', (e) => {
  alt = e.altKey;
  if (panning) {
    vp = pan(vp, e.clientX - panning.x, e.clientY - panning.y);
    panning = { x: e.clientX, y: e.clientY };
    render();
    return;
  }
  if (marquee) {
    const sp = screenPt(e);
    marquee.cx = sp.sx;
    marquee.cy = sp.sy;
    render();
    return;
  }
  const p = ptr(e);
  if (tool.wire || tool.press) {
    T.move(tool, snapped(e), { raw: p });
    render();
    return;
  }
  if (drag) {
    drag.last = p;
    const c = Commands.move([...selection], p.x - drag.start.x, p.y - drag.start.y, { alt: e.altKey });
    c.apply(doc);
    render();
    c.revert(doc);
  }
});

window.addEventListener('mouseup', (e) => {
  if (panning) { panning = null; return; }
  if (marquee) {
    const a = toWorld(vp, marquee.sx, marquee.sy);
    const b = toWorld(vp, marquee.cx, marquee.cy);
    const ids = T.selectInRect(doc, a, b);
    applySelection(ids, marquee.add);
    marquee = null;
    render();
    return;
  }
  if (tool.press) {
    const act = T.up(tool, snapped(e));
    if (act.type === 'commit') commit(act);
    else if (act.type === 'select') selectAt(act.at, e.shiftKey);
    render();
    return;
  }
  if (drag) {
    const dx = drag.last.x - drag.start.x, dy = drag.last.y - drag.start.y;
    const step = e.altKey ? GRID / 4 : GRID / 2;
    if (Math.abs(dx) >= step || Math.abs(dy) >= step) hist.exec(Commands.move([...selection], dx, dy, { alt: e.altKey }));
    drag = null;
    render();
  }
});

svg.addEventListener('contextmenu', (e) => e.preventDefault());
svg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = svg.getBoundingClientRect();
  vp = zoomAt(vp, e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  render();
}, { passive: false });

async function addSymbol(kind) {
  let net;
  if (SYMBOLS[kind].role === 'label' || SYMBOLS[kind].role === 'port') {
    net = await showPrompt('Nome da rede:', SYMBOLS[kind].defaultNet);
    if (!net) return;
  }
  const id = hist.exec(Commands.addSymbol(kind, placeAt.x, placeAt.y, net ? { net } : {}));
  selection = new Set([id]);
  placeAt = { x: placeAt.x + 80, y: placeAt.y };
  render();
}

document.querySelectorAll('[data-add]').forEach((b) => { b.onclick = () => addSymbol(b.dataset.add); });

const rotate = () => selection.size && hist.exec(Commands.rotate([...selection]));
const flip = () => selection.size && hist.exec(Commands.flipH([...selection]));
const del = () => {
  if (selection.size) {
    hist.exec(Commands.remove([...selection]));
    selection.clear();
    render();
  }
};

const rename = async () => {
  const tg = T.renameTarget(doc, selection);
  if (tg.kind === 'error') { say(tg.message); return; }
  const n = await showPrompt(
    tg.kind === 'wire' ? 'Nome da rede do fio (cria um rótulo):' : 'Nome da rede:',
    tg.current || '',
  );
  if (n === null) return;
  const cmd = T.renameCommand(tg, n);
  if (!cmd) { say('Nome vazio: nada alterado.'); return; }
  const id = hist.exec(cmd);
  if (tg.kind === 'wire') selection = new Set([id]);
  say(`Rede renomeada para ${n.trim()}.`);
};

document.getElementById('rot').onclick = rotate;
document.getElementById('flip').onclick = flip;
document.getElementById('del').onclick = del;
document.getElementById('rename').onclick = () => { rename(); };
document.getElementById('wireBtn').onclick = () => { commit(T.toggleWireMode(tool)); render(); };

document.getElementById('netlistBtn').onclick = () => {
  document.querySelector('#tabs [data-tab="netlist"]').click();
  const nl = buildNetlist(doc);
  document.getElementById('out').textContent =
    (nl.warnings.length ? 'AVISOS:\n' + nl.warnings.map((w) => '⚠ ' + describeWarning(w)).join('\n') + '\n\n' : 'Sem avisos.\n\n') +
    JSON.stringify(nl, null, 2);
};

document.getElementById('undo').onclick = () => hist.undo();
document.getElementById('redo').onclick = () => hist.redo();
document.getElementById('fit').onclick = () => { vp = createViewport(); render(); };

document.getElementById('save').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([serialize(doc)], { type: 'application/json' }));
  a.download = 'esquematico.json';
  a.click();
};

document.getElementById('newDoc').onclick = async () => {
  if (doc.symbols.length || doc.wires.length) {
    const ok = await showConfirm('Descartar o esquemático atual e criar um documento vazio?');
    if (!ok) return;
  }
  doc = createDocument();
  hist.reset(doc);
  selection.clear();
  vp = createViewport();
  await clearAutosave();
  say('Novo documento.');
  render();
};

document.getElementById('openBtn').onclick = () => document.getElementById('open').click();
document.getElementById('open').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    doc = deserialize(await f.text());
    hist.reset(doc);
    selection.clear();
    say(`Aberto: ${f.name}`);
  } catch (err) {
    say('');
    await showPrompt('Erro ao abrir (formato proto): ' + err.message, '');
  }
  e.target.value = '';
};

document.getElementById('importStdBtn').onclick = () => document.getElementById('importStd').click();
document.getElementById('importStd').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const { doc: imported, skip } = importEasyedaSchematic(await f.text());
    doc = imported;
    hist.reset(doc);
    selection.clear();
    say(skip.length ? `Importado; ignorados: ${skip.slice(0, 3).join(', ')}${skip.length > 3 ? '…' : ''}` : 'Importado do EasyEDA Std.');
  } catch (err) {
    say('');
    await showPrompt('Erro na importação EasyEDA: ' + err.message, '');
  }
  e.target.value = '';
};

document.querySelectorAll('#tabs button').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${btn.dataset.tab}`));
  };
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') { alt = true; e.preventDefault(); render(); return; }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); hist.undo(); }
  else if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); hist.redo(); }
  else if (e.key === 'r' || e.key === 'R') rotate();
  else if (e.key === 'x' || e.key === 'X') flip();
  else if (e.key === 'Delete') del();
  else if (e.key === 'w' || e.key === 'W') { commit(T.toggleWireMode(tool)); render(); }
  else if (e.key === 'Enter') { const r = T.finish(tool); if (r) commit({ type: 'commit', ...r }); render(); }
  else if (e.key === 'Escape') { T.cancel(tool); selection.clear(); render(); }
});

window.addEventListener('keyup', (e) => { if (e.key === 'Alt') { alt = false; render(); } });
window.addEventListener('resize', render);

(async () => {
  const saved = await loadAutosave().catch(() => null);
  if (saved) {
    try {
      doc = deserialize(saved);
      hist.reset(doc);
      say('Rascunho restaurado do navegador.');
    } catch { /* ignore corrupt autosave */ }
  }
  render();
})();
