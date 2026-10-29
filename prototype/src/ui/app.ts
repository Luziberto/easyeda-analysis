// UI SVG do protótipo — importa o núcleo compilado em dist/ via mesma árvore após build.
// @ts-nocheck — DOM e eventos; o núcleo tipado cobre a lógica crítica.
import {
  createDocument, Commands, History, createViewport, toWorld, zoomAt, pan,
  hitPin, pinWorld, serialize, deserialize, GRID, snapPoint, getActiveSheet, buildProjectNetlist,
} from '../core/model.js';
import { buildNetlist, junctions, describeWarning } from '../core/connectivity.js';
import { runErc, describeErc } from '../core/erc.js';
import { importEasyedaSchematic } from '../format/import-easyeda-sch.js';
import { exportKicadNet } from '../format/export-kicad.js';
import { exportSpice, validateSpiceDeck } from '../format/export-spice.js';
import { runSpiceSimulationReport } from '../sim/spice-runner.js';
import { exportSheetSvg } from '../format/export-svg.js';
import { exportBomCsv } from '../format/export-bom.js';
import { createPcbView } from './pcb-view.js';
import { SYMBOLS, defFor } from '../core/library.js';
import { openPrintPreview } from '../format/export-print.js';
import { importEasyedaPcb } from '../format/import-easyeda-pcb.js';
import { exportGerberTop, exportExcellonDrill, exportPickPlace, exportFabBundle } from '../format/export-gerber.js';
import * as T from './controller.js';
import { showPrompt, showConfirm } from './dialog.js';
import { saveAutosave, loadAutosave, clearAutosave } from './storage.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('canvas');
const marqueeEl = document.getElementById('marquee');

let doc = createDocument();
const sh = () => getActiveSheet(doc);
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
let lastErc = null;
let autosaveTimer = null;
let appMode = 'sch';

const say = (m) => { message = m; render(); };
const el = (n, a = {}, p) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, a[k]);
  if (p) p.appendChild(e);
  return e;
};
const pts = (P) => P.map((p) => `${p.x},${p.y}`).join(' ');

function downloadText(filename, mime, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  a.click();
}

function renderSheetTabs() {
  const host = document.getElementById('sheetTabs');
  if (!host) return;
  host.replaceChildren();
  for (const s of doc.sheets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sheet-tab' + (s.id === doc.activeSheetId ? ' active' : '');
    btn.textContent = s.name;
    btn.title = 'Clique para ativar; duplo clique para renomear';
    btn.onclick = () => {
      if (s.id === doc.activeSheetId) return;
      T.cancel(tool);
      selection.clear();
      hist.exec(Commands.setActiveSheet(s.id));
      say(`Folha: ${s.name}`);
    };
    btn.ondblclick = async (ev) => {
      ev.preventDefault();
      const n = await showPrompt('Nome da folha:', s.name);
      if (n === null) return;
      try {
        hist.exec(Commands.renameSheet(s.id, n));
        say(`Folha renomeada para ${n.trim()}.`);
      } catch (err) { say(err.message); }
    };
    host.appendChild(btn);
    if (doc.sheets.length > 1 && s.id === doc.activeSheetId) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'sheet-rm';
      rm.textContent = '×';
      rm.title = 'Remover folha';
      rm.onclick = async (ev) => {
        ev.stopPropagation();
        if (!await showConfirm(`Remover folha "${s.name}"?`)) return;
        try {
          T.cancel(tool);
          selection.clear();
          hist.exec(Commands.removeSheet(s.id));
          say('Folha removida.');
        } catch (err) { say(err.message); }
      };
      host.appendChild(rm);
    }
  }
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'sheet-tab add';
  add.textContent = '+ Folha';
  add.onclick = () => {
    T.cancel(tool);
    selection.clear();
    const id = hist.exec(Commands.addSheet());
    const sheet = doc.sheets.find((x) => x.id === id);
    say(sheet ? `Nova folha: ${sheet.name}` : 'Folha adicionada.');
  };
  host.appendChild(add);
}

function runErcPanel() {
  lastErc = runErc(doc);
  const out = document.getElementById('ercOut');
  if (out) {
    const lines = [...lastErc.errors.map(describeErc), ...lastErc.warnings.map(describeErc)];
    out.textContent = lines.length ? lines.join('\n') : 'Nenhum problema encontrado pelo ERC.';
  }
  render();
}

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
      input.value = sh().symbols.find((s) => s.id === symId).ref;
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

function bindInspectorValue(symId) {
  const input = document.getElementById('inspValue');
  input?.addEventListener('change', () => {
    try {
      hist.exec(Commands.setValue(symId, input.value));
      say('Valor atualizado.');
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
  const s = sh().symbols.find((x) => x.id === id);
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
    if (s.kind === 'annotate') {
      host.innerHTML = `<div class="field"><label>Texto</label><input id="inspValue" value="${escapeAttr(s.value ?? '')}"></div>`;
      bindInspectorValue(s.id);
      return;
    }
    host.innerHTML = `
      <div class="field"><label>Referência</label><input id="inspRef" value="${escapeAttr(s.ref)}"></div>
      <div class="field"><label>Tipo</label><input readonly value="${s.kind}"></div>
      <div class="field-row">
        <div class="field"><label>X</label><input readonly value="${s.x}"></div>
        <div class="field"><label>Y</label><input readonly value="${s.y}"></div>
      </div>
      <div class="field"><label>Rotação</label><input readonly value="${s.rot}°"></div>
      <div class="field"><label>Valor</label><input id="inspValue" value="${escapeAttr(s.value ?? '')}"></div>`;
    bindInspectorRef(s.id);
    bindInspectorValue(s.id);
    return;
  }
  const w = sh().wires.find((x) => x.id === id);
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
  for (const w of sh().wires) {
    const cls = 'wire' + (w.kind === 'bus' ? ' bus' : '') + (selection.has(w.id) ? ' sel' : '');
    el('polyline', { class: cls, points: pts(w.points) }, g);
  }
  for (const j of junctions(sh())) el('circle', { class: 'junction', cx: j.x, cy: j.y, r: 3 }, g);
  for (const s of sh().symbols) {
    if (s.kind === 'annotate') {
      el('text', {
        class: 'annotate' + (selection.has(s.id) ? ' sel' : ''),
        x: s.x, y: s.y, 'font-size': '11', fill: '#1e293b',
      }, g).textContent = s.value || s.ref;
      continue;
    }
    const def = defFor(s);
    const mx = s.mirror ? -1 : 1;
    const sg = el('g', { class: 'sym' + (selection.has(s.id) ? ' sel' : ''), transform: `translate(${s.x} ${s.y}) rotate(${s.rot}) scale(${mx} 1)` }, g);
    for (const d of def.paths) el('path', { d }, sg);
    for (const p of def.pins) el('circle', { class: 'pin', cx: p.x, cy: p.y, r: 2 }, sg);
    const refLabel = def.role ? s.net : s.ref;
    el('text', { class: def.role ? 'netname' : 'ref', x: s.x + (def.role === 'label' ? 2 : -10), y: s.y - (def.role === 'label' ? 3 : 14) }, g).textContent = refLabel;
    if (s.value && !def.role) el('text', { class: 'value', x: s.x, y: s.y + 18 }, g).textContent = s.value;
  }
  if (tool.wire) {
    const prevCls = T.isBusMode(tool) ? 'wire bus preview' : 'wire preview';
    el('polyline', { class: prevCls, points: pts(T.previewPoints(tool)), 'stroke-dasharray': '4 3' }, g);
  }

  const sheet = sh();
  const nl = buildNetlist(sheet);
  const pn = buildProjectNetlist(doc);
  document.getElementById('status').textContent =
    `${doc.sheets.length} folha(s) · ${sheet.name} · ${sheet.symbols.length} símbolos · ${sheet.wires.length} fios · ${Object.keys(pn.nets).length} redes (projeto)` +
    (nl.warnings.length ? ` · ⚠ ${nl.warnings.length}` : '') +
    (lastErc?.errors?.length ? ` · ERC ${lastErc.errors.length} erro(s)` : '') +
    ` · ${alt ? 'passo 5 px' : `grade ${GRID} px`}` +
    (T.isWireActive(tool) ? (T.isBusMode(tool) ? ' · barramento ativo' : ' · fio ativo') : '') +
    ` · zoom ${vp.scale.toFixed(2)}`;
  const wl = document.getElementById('warnings');
  const ercLine = lastErc?.errors?.length ? lastErc.errors.map(describeErc).join(' | ') : '';
  wl.textContent = message || ercLine || (nl.warnings.length ? '⚠ ' + nl.warnings.map(describeWarning).join(' | ') : '');
  wl.title = [ercLine, ...nl.warnings.map(describeWarning)].filter(Boolean).join('\n');
  document.getElementById('undo').disabled = !hist.canUndo;
  document.getElementById('redo').disabled = !hist.canRedo;
  document.getElementById('wireBtn').classList.toggle('on', tool.mode === 'wire' || (tool.wire && tool.wireKind === 'wire'));
  document.getElementById('busBtn')?.classList.toggle('on', T.isBusMode(tool));
  renderMarquee();
  renderInspector();
  renderSheetTabs();
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
  const pin = hitPin(sh(), raw);
  return pin ? pinWorld(sh(), pin.sym, pin.pin) : snapPoint(raw, { alt: e.altKey });
};
const commit = (r) => {
  if (r && r.type === 'commit') {
    try { hist.exec(Commands.addWire(r.points, undefined, { kind: r.kind ?? 'wire' })); } catch (err) { say('Fio inválido: ' + err.message); }
  } else if (r && r.points) {
    try { hist.exec(Commands.addWire(r.points, undefined, { kind: r.kind ?? 'wire' })); } catch (err) { say('Fio inválido: ' + err.message); }
  }
};

function finishWire() { commit(T.dblclick(tool)); render(); }

function applySelection(ids, add) {
  if (!ids.length) { if (!add) selection.clear(); return; }
  if (add) ids.forEach((id) => selection.add(id));
  else selection = new Set(ids);
}

function selectAt(p, add) {
  const id = T.pick(sh(), p);
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
  const onPin = !!hitPin(sh(), raw);
  if (!T.isWireActive(tool) && !onPin && !T.pick(sh(), raw)) {
    const sp = screenPt(e);
    marquee = { sx: sp.sx, sy: sp.sy, cx: sp.sx, cy: sp.sy, add: e.shiftKey };
    return;
  }
  const act = T.down(tool, snapped(e), { raw, onPin, t: e.timeStamp });
  if (act.type === 'commit') commit(act);
  else if (act.type === 'select') {
    const id = selectAt(raw, e.shiftKey);
    if (id && sh().symbols.some((s) => s.id === id)) drag = { start: raw, last: raw };
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
    const ids = T.selectInRect(sh(), a, b);
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
  let value;
  if (SYMBOLS[kind].role === 'label' || SYMBOLS[kind].role === 'port') {
    net = await showPrompt('Nome da rede:', SYMBOLS[kind].defaultNet);
    if (!net) return;
  }
  if (kind === 'annotate') {
    value = await showPrompt('Texto da anotação:', 'Nota');
    if (value === null) return;
  }
  const id = hist.exec(Commands.addSymbol(kind, placeAt.x, placeAt.y, net ? { net, value } : value !== undefined ? { value } : {}));
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
  const tg = T.renameTarget(sh(), selection);
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
document.getElementById('busBtn')?.addEventListener('click', () => { commit(T.toggleBusMode(tool)); render(); });

document.getElementById('netlistBtn').onclick = () => {
  document.querySelector('#tabs [data-tab="netlist"]').click();
  const pn = buildProjectNetlist(doc);
  document.getElementById('out').textContent =
    (pn.warnings.length ? 'AVISOS:\n' + pn.warnings.map((w) => '⚠ ' + describeWarning(w)).join('\n') + '\n\n' : 'Sem avisos.\n\n') +
    JSON.stringify(pn, null, 2);
};

document.getElementById('ercRun')?.addEventListener('click', () => runErcPanel());
document.getElementById('exportKicad')?.addEventListener('click', () => downloadText('esquematico.net', 'text/plain', exportKicadNet(doc)));
document.getElementById('exportSpice')?.addEventListener('click', () => downloadText('esquematico.cir', 'text/plain', exportSpice(doc)));
document.getElementById('validateSpice')?.addEventListener('click', async () => {
  const simOut = document.getElementById('simOut');
  const r = validateSpiceDeck(doc);
  if (!r.ok) {
    if (simOut) simOut.textContent = r.errors.join('\n');
    say(`SPICE: ${r.errors.join('; ')}`);
    document.querySelector('#tabs button[data-tab="sim"]')?.click();
    return;
  }
  say('Simulando (.op ngspice + transiente)…');
  if (simOut) simOut.textContent = 'A carregar motor WASM…';
  document.querySelector('#tabs button[data-tab="sim"]')?.click();
  try {
    const deck = exportSpice(doc);
    const text = await runSpiceSimulationReport(deck);
    if (simOut) simOut.textContent = text;
    say('Simulação SPICE concluída.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (simOut) simOut.textContent = msg;
    say(`Simulação falhou: ${msg}`);
  }
});
document.getElementById('exportSvg')?.addEventListener('click', () => {
  const name = `${sh().name.replace(/\s+/g, '_')}.svg`;
  downloadText(name, 'image/svg+xml', exportSheetSvg(sh()));
});
document.getElementById('exportBom')?.addEventListener('click', () => downloadText('bom.csv', 'text/csv', exportBomCsv(doc)));
document.getElementById('printSch')?.addEventListener('click', () => {
  if (!openPrintPreview(doc)) say('Permita pop-ups para imprimir / PDF.');
});

function setAppMode(mode) {
  appMode = mode;
  document.body.classList.toggle('pcb-mode', mode === 'pcb');
  document.getElementById('modeSch')?.classList.toggle('on', mode === 'sch');
  document.getElementById('modePcb')?.classList.toggle('on', mode === 'pcb');
  if (mode === 'pcb') pcbView.render();
  else render();
}
document.getElementById('modeSch')?.addEventListener('click', () => setAppMode('sch'));
document.getElementById('modePcb')?.addEventListener('click', () => setAppMode('pcb'));

const pcbView = createPcbView(document.getElementById('pcbCanvas'), {
  getProject: () => doc,
  onChange: () => scheduleAutosave(),
  onMessage: (m) => say(m),
  webglCanvas: document.getElementById('pcbGl'),
});
document.getElementById('pcbSync')?.addEventListener('click', () => pcbView.syncFromSch());
document.getElementById('pcbTrack')?.addEventListener('click', () => pcbView.startTrack());
document.getElementById('pcbFit')?.addEventListener('click', () => pcbView.fit());
document.getElementById('pcbVia')?.addEventListener('click', () => pcbView.startVia());
document.getElementById('pcbRats')?.addEventListener('click', () => pcbView.toggleRats());
document.getElementById('pcbLayerTop')?.addEventListener('click', () => {
  pcbView.setLayer('top');
  document.getElementById('pcbLayerTop')?.classList.add('on');
  document.getElementById('pcbLayerBot')?.classList.remove('on');
});
document.getElementById('pcbLayerBot')?.addEventListener('click', () => {
  pcbView.setLayer('bottom');
  document.getElementById('pcbLayerBot')?.classList.add('on');
  document.getElementById('pcbLayerTop')?.classList.remove('on');
});
document.getElementById('pcbGerber')?.addEventListener('click', () => {
  if (!doc.pcb) { say('Gere a PCB primeiro (Sync).'); return; }
  downloadText('top.gtl', 'text/plain', exportGerberTop(doc.pcb));
});
document.getElementById('pcbFab')?.addEventListener('click', () => {
  if (!doc.pcb) { say('Gere a PCB primeiro (Sync).'); return; }
  const bundle = exportFabBundle(doc.pcb);
  for (const [name, body] of Object.entries(bundle)) downloadText(name, 'text/plain', body);
  say('Pacote fab: top.gtl, bottom.gbl, outline.gko, drill.drl, silk.gto.');
});
document.getElementById('pcbRoute')?.addEventListener('click', () => pcbView.startRoute());
document.getElementById('pcbPour')?.addEventListener('click', () => pcbView.startPour());
document.getElementById('pcbPourGnd')?.addEventListener('click', () => pcbView.pourOutline('GND'));
document.getElementById('pcbWebGl')?.addEventListener('click', () => pcbView.toggleWebGl());
document.getElementById('pcb3d')?.addEventListener('click', () => pcbView.toggleView3d());
document.getElementById('pcbPnP')?.addEventListener('click', () => {
  if (!doc.pcb) { say('Gere a PCB primeiro (Sync).'); return; }
  downloadText('pickplace.csv', 'text/csv', exportPickPlace(doc.pcb));
});
document.getElementById('pcbImportBtn')?.addEventListener('click', () => document.getElementById('pcbImport')?.click());
document.getElementById('pcbImport')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const text = await f.text();
    const { skipped } = importEasyedaPcb(text, doc);
    scheduleAutosave();
    pcbView.render();
    say(skipped.length ? `PCB importada; tipos ignorados: ${skipped.slice(0, 4).join(', ')}` : `PCB importada: ${f.name}`);
  } catch (err) { say(String(err.message)); }
  e.target.value = '';
});

document.getElementById('symPlaceCustom')?.addEventListener('click', () => {
  const name = document.getElementById('symName')?.value?.trim() || 'Bloco';
  const prefix = document.getElementById('symPrefix')?.value?.trim() || 'IC';
  const def = {
    name,
    prefix,
    w: 50,
    h: 40,
    pins: [
      { num: '1', x: -25, y: -10, electric: 'passive' },
      { num: '2', x: -25, y: 10, electric: 'passive' },
    ],
    paths: ['M -25 -20 H 25 V 20 H -25 Z'],
  };
  try {
    const id = hist.exec(Commands.addCustomSymbol(def, placeAt.x, placeAt.y));
    selection = new Set([id]);
    say(`Símbolo "${name}" colocado.`);
    render();
  } catch (err) { say(err.message); }
});

document.getElementById('pcbDrc')?.addEventListener('click', () => {
  const issues = pcbView.runDrc();
  const out = document.getElementById('pcbDrcOut');
  if (out) out.textContent = issues.length ? issues.map((i) => i.message).join('\n') : 'DRC: nenhum problema.';
  say(issues.length ? `DRC: ${issues.length} aviso(s).` : 'DRC OK.');
});

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
  if (doc.sheets.some((s) => s.symbols.length || s.wires.length)) {
    const ok = await showConfirm('Descartar o esquemático atual e criar um documento vazio?');
    if (!ok) return;
  }
  doc = createDocument();
  delete doc.pcb;
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
  if (appMode === 'pcb') {
    if (e.key === 't' || e.key === 'T') { pcbView.startTrack(); return; }
    if (e.key === 'v' || e.key === 'V') { pcbView.startVia(); return; }
    if (e.key === 'l' || e.key === 'L') { pcbView.startRoute(); return; }
    if (e.key === 'p' || e.key === 'P') { pcbView.startPour(); return; }
    if (e.key === 'Enter') { pcbView.finishTrack(); return; }
    if (e.key === 'Escape') { pcbView.cancelTrack(); return; }
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); hist.undo(); }
  else if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); hist.redo(); }
  else if (e.key === 'r' || e.key === 'R') rotate();
  else if (e.key === 'x' || e.key === 'X') flip();
  else if (e.key === 'Delete') del();
  else if (e.key === 'w' || e.key === 'W') { commit(T.toggleWireMode(tool)); render(); }
  else if (e.key === 'b' || e.key === 'B') { commit(T.toggleBusMode(tool)); render(); }
  else if (e.key === 'Enter') { const r = T.finish(tool); if (r) commit({ type: 'commit', ...r }); render(); }
  else if (e.key === 'Escape') { T.cancel(tool); selection.clear(); render(); }
});

window.addEventListener('keyup', (e) => { if (e.key === 'Alt') { alt = false; render(); } });
window.addEventListener('resize', () => { render(); if (appMode === 'pcb') pcbView.render(); });

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
