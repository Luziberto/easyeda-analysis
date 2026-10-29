// Conectividade ORIGINAL do protótipo: índice espacial, snap, junções, netlist com nós nomeados e diff contra PCB.
import { SYMBOLS, ROLE_PRIORITY, defFor } from './library.js';

export const GRID = 10;
/** Snap a inteiros: passo GRID, ou GRID/2 com Alt. Resultado sempre inteiro. */
export function snapPoint(p, { alt = false, grid = GRID, origin = { x: 0, y: 0 } } = {}) {
  const step = alt ? Math.max(1, Math.round(grid / 2)) : grid;
  const f = (v, o) => Math.round((v - o) / step) * step + o;
  return { x: Math.round(f(p.x, origin.x)) + 0, y: Math.round(f(p.y, origin.y)) + 0 };
}
export const pkey = (p) => `${p.x},${p.y}`;

/** Hash espacial uniforme para pontos (pinos e extremidades). */
export class SpatialHash {
  cell: number;
  map: Map<string, { x: number; y: number; item: number }[]>;
  size: number;
  constructor(cell = 40) { this.cell = cell; this.map = new Map(); this.size = 0; }
  _c(v) { return Math.floor(v / this.cell); }
  insert(x, y, item) { const k = `${this._c(x)}:${this._c(y)}`; if (!this.map.has(k)) this.map.set(k, []); this.map.get(k).push({ x, y, item }); this.size++; }
  /** pontos exatamente em (x,y) */
  at(x, y) { return (this.map.get(`${this._c(x)}:${this._c(y)}`) || []).filter((e) => e.x === x && e.y === y); }
  /** pontos dentro do retângulo [x0,x1]×[y0,y1] */
  inRect(x0, y0, x1, y1) {
    const out = [];
    for (let cx = this._c(Math.min(x0, x1)); cx <= this._c(Math.max(x0, x1)); cx++)
      for (let cy = this._c(Math.min(y0, y1)); cy <= this._c(Math.max(y0, y1)); cy++)
        for (const e of this.map.get(`${cx}:${cy}`) || []) if (e.x >= Math.min(x0, x1) && e.x <= Math.max(x0, x1) && e.y >= Math.min(y0, y1) && e.y <= Math.max(y0, y1)) out.push(e);
    return out;
  }
  nearest(x, y, tol) { let best = null, bd = Infinity; for (const e of this.inRect(x - tol, y - tol, x + tol, y + tol)) { const d = Math.hypot(e.x - x, e.y - y); if (d <= tol && d < bd) { bd = d; best = e; } } return best; }
}

export function rotatePoint(p, rot) {
  const r = ((rot % 360) + 360) % 360;
  switch (r) { case 90: return { x: -p.y, y: p.x }; case 180: return { x: -p.x, y: -p.y }; case 270: return { x: p.y, y: -p.x }; default: return { x: p.x, y: p.y }; }
}
export function symbolPins(s) {
  const mir = s.mirror ? -1 : 1;
  return defFor(s).pins.map((p) => {
    const r = rotatePoint({ x: p.x * mir, y: p.y }, s.rot);
    return { sym: s.id, pin: p.num, x: s.x + r.x, y: s.y + r.y };
  });
}
/** p estritamente no interior do segmento a-b (inteiros: teste exato). */
export function onSegmentInterior(p, a, b) {
  if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) !== 0) return false;
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y), len = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot > 0 && dot < len;
}

/** Analisa os pontos de contato. o = extremidades de fio + pinos; a = fios passando por dentro (sem terminar). */
export function analyzePoints(doc) {
  const idx = new SpatialHash();
  const pts = new Map(); const get = (x, y) => { const k = `${x},${y}`; if (!pts.has(k)) pts.set(k, { x, y, ends: [], pins: [], through: new Set() }); return pts.get(k); };
  for (const s of doc.symbols) for (const p of symbolPins(s)) { get(p.x, p.y).pins.push(p); idx.insert(p.x, p.y, 1); }
  for (const w of doc.wires) { const n = w.points.length; for (const e of [w.points[0], w.points[n - 1]]) { get(e.x, e.y).ends.push(w.id); idx.insert(e.x, e.y, 1); } }
  for (const w of doc.wires) {
    const P = w.points;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      for (const c of idx.inRect(a.x, a.y, b.x, b.y)) {
        const atVertex = (c.x === a.x && c.y === a.y) || (c.x === b.x && c.y === b.y);
        const isOwnEnd = (c.x === P[0].x && c.y === P[0].y) || (c.x === P[P.length - 1].x && c.y === P[P.length - 1].y);
        if (isOwnEnd) continue;
        if (onSegmentInterior(c, a, b) || (atVertex && !isOwnEnd)) pts.get(`${c.x},${c.y}`).through.add(w.id);
      }
    }
  }
  for (const v of pts.values()) { v.o = v.ends.length + v.pins.length; v.a = v.through.size; }
  return { pts, index: idx };
}
/** Regra de junção derivada (implementação própria): ≥3 terminações, ou terminação sobre o meio de um fio. */
export const needsJunction = (o, a) => o >= 3 || (o >= 1 && a >= 1);
export function junctions(doc) { return [...analyzePoints(doc).pts.values()].filter((v) => needsJunction(v.o, v.a)).map(({ x, y }) => ({ x, y })); }

// ordenação natural (R2 < R10)
const tok = (s) => String(s).match(/\d+|\D+/g) || [];
export function naturalCompare(a, b) {
  const A = tok(a), B = tok(b);
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    const x = A[i], y = B[i]; if (x === y) continue;
    const nx = /^\d/.test(x), ny = /^\d/.test(y);
    if (nx && ny) return Number(x) - Number(y) || x.length - y.length;
    return x < y ? -1 : 1;
  }
  return A.length - B.length;
}
const cmpRefPin = (a, b) => { const [ra, pa] = a.split('.'), [rb, pb] = b.split('.'); return naturalCompare(ra, rb) || naturalCompare(pa, pb); };

/** Netlist: { nets: {nome: [REF.pino]}, warnings: [], groups } */
export function buildNetlist(doc) {
  const parent = new Map();
  const find = (k) => { if (!parent.has(k)) parent.set(k, k); let r = k; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(k) !== r) { const n = parent.get(k); parent.set(k, r); k = n; } return r; };
  const union = (a, b) => { const x = find(a), y = find(b); if (x !== y) parent.set(x, y); };
  const pinNode = (sym, pin) => `p:${sym}:${pin}`;
  for (const s of doc.symbols) for (const p of SYMBOLS[s.kind].pins) find(pinNode(s.id, p.num));
  for (const w of doc.wires) find(`w:${w.id}`);
  const { pts } = analyzePoints(doc);
  for (const v of pts.values()) {
    if (v.o < 1) continue; // só cruzamentos/dobras: não conecta
    const nodes = [...v.ends.map((id) => `w:${id}`), ...[...v.through].map((id) => `w:${id}`), ...v.pins.map((p) => pinNode(p.sym, p.pin))];
    for (let i = 1; i < nodes.length; i++) union(nodes[0], nodes[i]);
  }
  const named = []; const firstByName = new Map();
  for (const s of doc.symbols) {
    const def = SYMBOLS[s.kind]; if (!def.role) continue;
    const name = String(s.net ?? def.defaultNet).trim(); if (!name) continue;
    const node = pinNode(s.id, def.pins[0].num); named.push({ node, name, role: def.role, ref: s.ref });
    if (firstByName.has(name)) union(firstByName.get(name), node); else firstByName.set(name, node);
  }
  const groups = new Map(); const G = (r) => { if (!groups.has(r)) groups.set(r, { pins: [], names: [] }); return groups.get(r); };
  for (const s of doc.symbols) if (!SYMBOLS[s.kind].role) for (const p of SYMBOLS[s.kind].pins) G(find(pinNode(s.id, p.num))).pins.push(`${s.ref}.${p.num}`);
  for (const n of named) G(find(n.node)).names.push(n);
  const warnings = []; const nets = {}; const used = new Set(); const out = [];
  for (const g of groups.values()) {
    g.pins.sort(cmpRefPin);
    let name = null;
    if (g.names.length) {
      const best = Math.max(...g.names.map((n) => ROLE_PRIORITY[n.role]));
      const top = [...new Set(g.names.filter((n) => ROLE_PRIORITY[n.role] === best).map((n) => n.name))].sort(naturalCompare);
      name = top[0];
      if (top.length > 1) warnings.push({ type: 'name-conflict', role: g.names.find((n) => ROLE_PRIORITY[n.role] === best).role, names: top, chosen: name });
      const lower = [...new Set(g.names.filter((n) => n.name !== name).map((n) => n.name))].filter((x) => !top.includes(x)).sort(naturalCompare);
      if (lower.length) warnings.push({ type: 'name-overridden', names: lower, chosen: name });
    } else if (g.pins.length >= 2) name = g.pins[0].replace('.', '_');
    if (g.names.length && !g.pins.length) warnings.push({ type: 'unconnected', names: [...new Set(g.names.map((n) => n.name))].sort(naturalCompare), refs: g.names.map((n) => n.ref).sort(naturalCompare) });
    if (!name || !g.pins.length) continue;
    if (used.has(name)) { let i = 2; while (used.has(`${name}_${i}`)) i++; warnings.push({ type: 'name-collision', name, renamed: `${name}_${i}` }); name = `${name}_${i}`; }
    used.add(name); out.push([name, g.pins]);
  }
  out.sort((a, b) => naturalCompare(a[0], b[0])); for (const [n, p] of out) nets[n] = p;
  return { nets, warnings };
}

/**
 * Diff incremental contra um netlist de PCB: pcb = { REF: { pads: { numero: rede } } }.
 * Retorna mudanças por pad, renomeações de rede inteira e erros pad/pino.
 */
export function diffNetlist(schNets: Record<string, string[]>, pcb: Record<string, { pads: Record<string, string> }>) {
  const want = new Map<string, string>(); // REF.pin -> net
  for (const [net, pins] of Object.entries(schNets)) for (const rp of pins) want.set(rp, net);
  const errors = [], warnings = [], changes = [];
  const schRefs = new Set([...want.keys()].map((k) => k.split('.')[0]));
  for (const [rp, net] of want) {
    const [ref, pin] = rp.split('.');
    if (!pcb[ref]) { errors.push({ type: 'missing-footprint', ref }); continue; }
    if (!(pin in pcb[ref].pads)) { errors.push({ type: 'pad-mismatch', ref, pin, pads: Object.keys(pcb[ref].pads).sort(naturalCompare) }); continue; }
    const cur = pcb[ref].pads[pin] || '';
    if (cur !== net) changes.push({ ref, pad: pin, from: cur, to: net });
  }
  for (const ref of Object.keys(pcb)) {
    if (!schRefs.has(ref)) { warnings.push({ type: 'extra-footprint', ref }); continue; }
    for (const [pad, net] of Object.entries(pcb[ref].pads)) if (!want.has(`${ref}.${pad}`) && net) changes.push({ ref, pad, from: net, to: '' });
  }
  // renomeação: todos os pads de uma rede do PCB vão para uma única rede do SCH com o mesmo conjunto
  const pcbNets = new Map();
  for (const [ref, fp] of Object.entries(pcb)) for (const [pad, net] of Object.entries(fp.pads)) if (net) { if (!pcbNets.has(net)) pcbNets.set(net, []); pcbNets.get(net).push(`${ref}.${pad}`); }
  const renames = [];
  for (const [net, members] of pcbNets) {
    const targets = new Set(members.map((m) => want.get(m)));
    if (targets.size !== 1) continue; const to = [...targets][0] as string;
    if (!to || to === net) continue;
    const sch = schNets[to]; if (sch.length === members.length && sch.every((m) => members.includes(m))) renames.push({ from: net, to });
  }
  const dedupErr = [...new Map(errors.map((e) => [JSON.stringify(e), e])).values()];
  return { changes, renames, errors: dedupErr, warnings, ok: dedupErr.length === 0 };
}
/** Aplica o diff (sem mutar a entrada). Recusa se houver erros. */
export function applyNetlistDiff(pcb, diff) {
  if (!diff.ok) throw new Error('diff com erros pad/pino: corrija antes de aplicar');
  const out = JSON.parse(JSON.stringify(pcb));
  for (const c of diff.changes) out[c.ref].pads[c.pad] = c.to;
  return out;
}

/** Texto curto, em pt-BR, para um aviso de buildNetlist. */
export function describeWarning(w) {
  switch (w.type) {
    case 'name-conflict': return `conflito de nomes (${w.role}): ${w.names.join(', ')} → usado ${w.chosen}`;
    case 'name-overridden': return `nome(s) ${w.names.join(', ')} sobrescrito(s) por ${w.chosen}`;
    case 'name-collision': return `nome ${w.name} repetido em redes distintas → ${w.renamed}`;
    case 'unconnected': return `${w.refs.join(', ')} (${w.names.join(', ')}) sem conexão a nenhum pino`;
    case 'orphan-port': return `porta ${w.name} só na folha ${w.sheet ?? '?'}`;
    default: return JSON.stringify(w);
  }
}
