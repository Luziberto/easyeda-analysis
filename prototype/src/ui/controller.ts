// Máquina de estados da ferramenta de fio + seleção/renomear. Pura (sem DOM), testada em Node.
// Modos: 'idle' (seleção) e 'wire' (ferramenta W ativa). O botão "Fio" reflete exatamente tool.mode === 'wire' || tool.wire.
import { SYMBOLS } from '../core/library.js';
import { Commands, hitPin, hitSymbol, hitWire, symbolBBox } from '../core/model.js';

export const DBL_MS = 350;      // janela de duplo clique detectada pelo próprio controlador
export const DRAG_MIN = 4;      // deslocamento mínimo (unid. de mundo) para virar arrasto

export function createTool() { return { mode: 'idle', wire: null, wireKind: 'wire', press: null, lastDown: null }; }
const same = (a, b) => a && b && a.x === b.x && a.y === b.y;

/** Acrescenta p mantendo segmentos ortogonais (cotovelo horizontal-primeiro). */
export function orthoAppend(points, p) {
  const out = points.slice(); const l = out[out.length - 1];
  if (!l) return [{ ...p }];
  if (same(l, p)) return out;
  if (l.x !== p.x && l.y !== p.y) out.push({ x: p.x, y: l.y });
  out.push({ x: p.x, y: p.y }); return out;
}
export function previewPoints(tool) { return tool.wire ? orthoAppend(tool.wire.points, tool.wire.cur) : []; }
export function isWireActive(tool) { return tool.mode === 'wire' || tool.mode === 'bus' || !!tool.wire; }
export function isBusMode(tool) { return tool.mode === 'bus' || (!!tool.wire && tool.wireKind === 'bus'); }

/** Encerra o fio atual. Retorna { points, kind } se houver ≥2 pontos distintos, senão null. Volta ao modo idle. */
export function finish(tool) {
  const w = tool.wire; const kind = tool.wireKind || 'wire';
  tool.wire = null; tool.press = null; tool.mode = 'idle'; tool.lastDown = null; tool.wireKind = 'wire';
  if (!w || w.points.length < 2) return null;
  return { points: w.points, kind };
}
export function cancel(tool) { tool.wire = null; tool.press = null; tool.mode = 'idle'; tool.lastDown = null; tool.wireKind = 'wire'; }
export function toggleWireMode(tool) {
  if (tool.mode === 'wire' || (tool.wire && tool.wireKind === 'wire')) {
    const r = finish(tool); return r;
  }
  cancel(tool); tool.mode = 'wire'; tool.wireKind = 'wire'; return null;
}
export function toggleBusMode(tool) {
  if (tool.mode === 'bus' || (tool.wire && tool.wireKind === 'bus')) {
    const r = finish(tool); return r;
  }
  cancel(tool); tool.mode = 'bus'; tool.wireKind = 'bus'; return null;
}

/**
 * Botão pressionado. p = ponto já com snap (ou pino exato); raw = ponto bruto; onPin = havia pino sob o cursor.
 * Retorna uma ação: {type:'none'|'select'|'commit', ...}.
 */
export function down(tool, p, { raw = p, onPin = false, t = 0 } = {}) {
  const dbl = tool.lastDown && t - tool.lastDown.t <= DBL_MS && same(tool.lastDown.p, p);
  tool.lastDown = { t, p };
  if (tool.mode === 'wire' || tool.mode === 'bus' || tool.wire) {
    if (dbl && tool.wire) { const r = finish(tool); return r ? { type: 'commit', ...r } : { type: 'none' }; }
    if (!tool.wire) tool.wire = { points: [{ ...p }], cur: { ...p }, fromDrag: false };
    else tool.wire.points = orthoAppend(tool.wire.points, p);
    tool.mode = 'wire'; return { type: 'none' };
  }
  if (onPin) { tool.press = { start: { ...p }, raw: { ...raw }, dragging: false }; return { type: 'none' }; }
  return { type: 'select', at: raw };
}
export function move(tool, p, { raw = p } = {}) {
  if (tool.press && !tool.press.dragging && Math.hypot(raw.x - tool.press.raw.x, raw.y - tool.press.raw.y) >= DRAG_MIN) {
    tool.press.dragging = true; tool.wire = { points: [tool.press.start], cur: { ...p }, fromDrag: true };
  }
  if (tool.wire) tool.wire.cur = { ...p };
}
/** Botão solto. Arrasto a partir de pino → fio termina no ponto solto; clique simples em pino → seleciona. */
export function up(tool, p) {
  const pr = tool.press; tool.press = null;
  if (!pr) return { type: 'none' };
  if (!pr.dragging) return { type: 'select', at: pr.raw };
  tool.wire.points = orthoAppend(tool.wire.points, p);
  const r = finish(tool); return r ? { type: 'commit', ...r } : { type: 'none' };
}
export function dblclick(tool) { if (!tool.wire) return { type: 'none' }; const r = finish(tool); return r ? { type: 'commit', ...r } : { type: 'none' }; }

/** Item sob o ponto, na ordem pino(símbolo) > símbolo > fio. */
export function pick(doc, pt) {
  const pin = hitPin(doc, pt); if (pin) return pin.sym;
  return hitSymbol(doc, pt) || hitWire(doc, pt) || null;
}

/**
 * O que "Renomear rede" deve fazer para a seleção.
 * {kind:'symbol', id, current} → setNet; {kind:'wire', id, at, current} → novo rótulo no 1º vértice; {kind:'error', message}.
 */
export function renameTarget(doc, selection) {
  const ids = [...selection];
  if (ids.length !== 1) return { kind: 'error', message: ids.length ? 'Selecione só um item para renomear a rede.' : 'Selecione um fio, rótulo, porta, GND ou VCC para renomear a rede.' };
  const s = doc.symbols.find((x) => x.id === ids[0]);
  if (s) return SYMBOLS[s.kind].role ? { kind: 'symbol', id: s.id, current: s.net } : { kind: 'error', message: `${s.ref} é um componente; selecione um fio ou símbolo de rede.` };
  const w = doc.wires.find((x) => x.id === ids[0]);
  if (w) { const label = doc.symbols.find((x) => SYMBOLS[x.kind].role === 'label' && w.points.some((p) => p.x === x.x && p.y === x.y)); return label ? { kind: 'symbol', id: label.id, current: label.net } : { kind: 'wire', id: w.id, at: { ...w.points[0] }, current: '' }; }
  return { kind: 'error', message: 'Item selecionado não encontrado.' };
}
export function renameCommand(target, name) {
  const n = String(name ?? '').trim(); if (!n) return null;
  if (target.kind === 'symbol') return Commands.setNet(target.id, n);
  if (target.kind === 'wire') return Commands.addSymbol('netlabel', target.at.x, target.at.y, { net: n, alt: true, exact: true });
  return null;
}

export const MARQUEE_MIN = 4;

function normRect(a, b) {
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function rectsOverlap(a, b) {
  return a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0 && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function segHitsRect(a, b, r) {
  if (rectsOverlap({ x: a.x, y: a.y, w: 0, h: 0 }, r) || rectsOverlap({ x: b.x, y: b.y, w: 0, h: 0 }, r)) return true;
  const edges = [[r.x, r.y, r.x + r.w, r.y], [r.x + r.w, r.y, r.x + r.w, r.y + r.h], [r.x, r.y + r.h, r.x + r.w, r.y + r.h], [r.x, r.y, r.x, r.y + r.h]];
  for (const [x1, y1, x2, y2] of edges) {
    const L = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = L ? Math.max(0, Math.min(1, ((x1 - a.x) * (b.x - a.x) + (y1 - a.y) * (b.y - a.y)) / L)) : 0;
    const px = a.x + t * (b.x - a.x), py = a.y + t * (b.y - a.y);
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return true;
  }
  return false;
}

/** IDs de símbolos e fios que intersectam o retângulo de seleção (coordenadas de mundo). */
export function selectInRect(doc, a, b) {
  const r = normRect(a, b);
  if (r.w < MARQUEE_MIN && r.h < MARQUEE_MIN) return [];
  const ids = [];
  for (const s of doc.symbols) if (rectsOverlap(symbolBBox(s), r)) ids.push(s.id);
  for (const w of doc.wires) {
    const P = w.points;
    let hit = false;
    for (let k = 1; k < P.length && !hit; k++) hit = segHitsRect(P[k - 1], P[k], r);
    if (hit) ids.push(w.id);
  }
  return ids;
}
