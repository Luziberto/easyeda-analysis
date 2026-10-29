// Núcleo: Project v3 multi-folha; comandos na folha ativa.
import { SYMBOLS, defFor } from './library.js';
import { GRID, snapPoint, rotatePoint, symbolPins, buildNetlist, pkey } from './connectivity.js';
import { getActiveSheet } from './project.js';
import type { Project, Sheet, Point, Viewport, Command, AddSymbolOpts, AddWireOpts, WireKind } from './types.js';
export type { Project, Sheet, Point, Viewport, Command, SchematicSymbol, Wire, SymbolKind } from './types.js';
export { GRID, rotatePoint, snapPoint };
export { getActiveSheet, getSheet, buildProjectNetlist } from './project.js';

export const FORMAT = 'proto-eda-schematic';
export const FORMAT_VERSION = 3;

export const snap = (v: number, g = GRID) => Math.round(v / g) * g;

export function createProject(): Project {
  const id = 'sh1';
  return { format: FORMAT, version: FORMAT_VERSION, activeSheetId: id, sheets: [{ id, name: 'Folha 1', nextId: 1, symbols: [], wires: [] }] };
}
export function createDocument(): Project { return createProject(); }

function sheetOf(project: Project): Sheet { return getActiveSheet(project); }
const clone = (o) => JSON.parse(JSON.stringify(o));

export function pinWorld(doc: Sheet, symId: string, pinNum: string) {
  const s = doc.symbols.find((x) => x.id === symId); if (!s) return null;
  const p = symbolPins(s).find((q) => q.pin === pinNum); return p ? { x: p.x, y: p.y } : null;
}
export function symbolBBox(s) {
  const d = defFor(s); const sw = s.rot % 180 === 0;
  const w = sw ? d.w : d.h, h = sw ? d.h : d.w; return { x: s.x - w / 2, y: s.y - h / 2, w, h };
}
export function hitSymbol(doc, pt) {
  for (let i = doc.symbols.length - 1; i >= 0; i--) { const b = symbolBBox(doc.symbols[i]); if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return doc.symbols[i].id; }
  return null;
}
export function hitPin(doc, pt, tol = 6) {
  for (const s of doc.symbols) for (const p of symbolPins(s)) if (Math.hypot(p.x - pt.x, p.y - pt.y) <= tol) return { sym: s.id, pin: p.pin };
  return null;
}
/** Fio sob o ponto (distância ao segmento ≤ tol). */
export function hitWire(doc, pt, tol = 4) {
  for (let i = doc.wires.length - 1; i >= 0; i--) {
    const P = doc.wires[i].points;
    for (let k = 1; k < P.length; k++) {
      const a = P[k - 1], b = P[k], L = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t = L ? Math.max(0, Math.min(1, ((pt.x - a.x) * (b.x - a.x) + (pt.y - a.y) * (b.y - a.y)) / L)) : 0;
      if (Math.hypot(a.x + t * (b.x - a.x) - pt.x, a.y + t * (b.y - a.y) - pt.y) <= tol) return doc.wires[i].id;
    }
  }
  return null;
}
function nextRef(doc, kind) {
  const prefix = SYMBOLS[kind].prefix; let n = 1;
  const used = new Set(doc.symbols.map((s) => s.ref)); while (used.has(`${prefix}${n}`)) n++; return `${prefix}${n}`;
}
const validPoint = (p) => p && Number.isInteger(p.x) && Number.isInteger(p.y);
function normalizePoints(points) {
  const out = [];
  for (const p of points) { const q = { x: p.x, y: p.y }; const l = out[out.length - 1]; if (!l || l.x !== q.x || l.y !== q.y) out.push(q); }
  // remove vértices colineares do meio
  for (let i = out.length - 2; i >= 1; i--) { const a = out[i - 1], b = out[i], c = out[i + 1]; if ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) === 0 && (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) > 0) out.splice(i, 1); }
  return out;
}
/** Caminho ortogonal H-depois-V entre dois pontos (usado na migração v1 e em fios pino→pino). */
const orthoPath = (a, b) => normalizePoints([a, { x: b.x, y: a.y }, b]);

/** Registra quais extremidades de fio estão em pinos dos símbolos `ids`, para arrastá-las junto. */
function attachedEnds(doc, ids) {
  const at = new Map(); for (const s of doc.symbols) if (ids.includes(s.id)) for (const p of symbolPins(s)) at.set(pkey(p), `${s.id}|${p.pin}`);
  const out = [];
  doc.wires.forEach((w) => { if (ids.includes(w.id)) return; const n = w.points.length; [0, n - 1].forEach((i) => { const k = at.get(pkey(w.points[i])); if (k) out.push({ wire: w.id, i, key: k }); }); });
  return out;
}
function followEnds(doc, ends) {
  for (const e of ends) { const [sym, pin] = e.key.split('|'); const p = pinWorld(doc, sym, pin); const w = doc.wires.find((x) => x.id === e.wire); if (w && p) w.points[e.i] = p; }
}

function registerCustom(project: Project, def: import('./types.js').CustomSymbolDef): string {
  if (!project.customSymbols) project.customSymbols = {};
  let id = def.name.replace(/\W+/g, '_').toLowerCase() || 'sym';
  let n = 1;
  const base = id;
  while (project.customSymbols[id]) id = `${base}_${n++}`;
  project.customSymbols[id] = def;
  return id;
}

// ---- Comandos: apply/revert no Project; edição na folha ativa.
export const Commands = {
  addSymbol(kind, x, y, opts: AddSymbolOpts = {}) {
    if (!SYMBOLS[kind]) throw new Error(`símbolo desconhecido: ${kind}`);
    let created;
    return { name: 'addSymbol',
      apply(project) {
        const doc = sheetOf(project);
        if (!created) {
          const p = opts.exact ? { x: Math.round(x) + 0, y: Math.round(y) + 0 } : snapPoint({ x, y }, opts);
          const ref = opts.ref ? String(opts.ref).trim() : nextRef(doc, kind);
          if (doc.symbols.some((s) => s.ref === ref)) throw new Error(`referência duplicada: ${ref}`);
          created = { id: `s${doc.nextId++}`, kind, x: p.x, y: p.y, rot: (opts.rot ?? 0) % 360, ref, mirror: false };
          if (SYMBOLS[kind].role) created.net = opts.net ?? SYMBOLS[kind].defaultNet;
          if (opts.value !== undefined) created.value = String(opts.value);
          if (kind === 'annotate' && !created.value) created.value = 'Anotação';
        }
        doc.symbols.push(clone(created)); return created.id; },
      revert(project) { sheetOf(project).symbols = sheetOf(project).symbols.filter((s) => s.id !== created.id); } };
  },
  setNet(id, name) {
    let old;
    return { name: 'setNet',
      apply(project) { const doc = sheetOf(project); const s = doc.symbols.find((x) => x.id === id); if (!s || !SYMBOLS[s.kind].role) throw new Error('não é um símbolo de rede'); old = s.net; s.net = String(name).trim(); },
      revert(project) { sheetOf(project).symbols.find((x) => x.id === id).net = old; } };
  },
  setRef(id, ref) {
    let old;
    const r = String(ref ?? '').trim();
    return { name: 'setRef',
      apply(project) {
        const doc = sheetOf(project);
        const s = doc.symbols.find((x) => x.id === id);
        if (!s || SYMBOLS[s.kind].role) throw new Error('referência só em componentes');
        if (!r) throw new Error('referência vazia');
        if (doc.symbols.some((x) => x.id !== id && x.ref === r)) throw new Error(`referência duplicada: ${r}`);
        old = s.ref; s.ref = r;
      },
      revert(project) { sheetOf(project).symbols.find((x) => x.id === id).ref = old; } };
  },
  setValue(id, value) {
    let old;
    return { name: 'setValue',
      apply(project) {
        const doc = sheetOf(project);
        const s = doc.symbols.find((x) => x.id === id);
        if (!s || (SYMBOLS[s.kind].role && s.kind !== 'annotate')) throw new Error('valor só em componentes ou anotações');
        old = s.value;
        s.value = String(value ?? '').trim();
      },
      revert(project) { sheetOf(project).symbols.find((x) => x.id === id).value = old; } };
  },
  addCustomSymbol(def: import('./types.js').CustomSymbolDef, x: number, y: number) {
    let created;
    return { name: 'addCustomSymbol',
      apply(project) {
        registerCustom(project, def);
        const doc = sheetOf(project);
        if (!created) {
          const p = snapPoint({ x, y }, {});
          created = {
            id: `s${doc.nextId++}`, kind: 'generic' as const, x: p.x, y: p.y, rot: 0,
            ref: nextRef(doc, 'generic'), value: def.name, mirror: false,
            inlineDef: { w: def.w, h: def.h, pins: def.pins, paths: def.paths },
          };
        }
        doc.symbols.push(clone(created));
        return created.id;
      },
      revert(project) { sheetOf(project).symbols = sheetOf(project).symbols.filter((s) => s.id !== created.id); } };
  },
  move(ids, dx, dy, opts = {}) {
    ({ x: dx, y: dy } = snapPoint({ x: dx, y: dy }, opts));
    let before;
    return { name: 'move',
      apply(project) {
        const doc = sheetOf(project);
        if (!before) before = clone(doc.wires.filter((w) => !ids.includes(w.id)));
        const ends = attachedEnds(doc, ids);
        for (const s of doc.symbols) if (ids.includes(s.id)) { s.x += dx; s.y += dy; }
        for (const w of doc.wires) if (ids.includes(w.id)) w.points.forEach((p) => { p.x += dx; p.y += dy; });
        followEnds(doc, ends);
      },
      revert(project) {
        const doc = sheetOf(project);
        for (const s of doc.symbols) if (ids.includes(s.id)) { s.x -= dx; s.y -= dy; }
        for (const w of doc.wires) if (ids.includes(w.id)) w.points.forEach((p) => { p.x -= dx; p.y -= dy; });
        const map = new Map(before.map((w) => [w.id, w])); doc.wires.forEach((w, i) => { if (map.has(w.id)) doc.wires[i] = clone(map.get(w.id)); });
      } };
  },
  rotate(ids, deg = 90) {
    let before;
    return { name: 'rotate',
      apply(project) { const doc = sheetOf(project); before = clone(doc.wires); const ends = attachedEnds(doc, ids); for (const s of doc.symbols) if (ids.includes(s.id)) s.rot = (s.rot + deg + 360) % 360; followEnds(doc, ends); },
      revert(project) { const doc = sheetOf(project); for (const s of doc.symbols) if (ids.includes(s.id)) s.rot = (s.rot - deg + 360) % 360; doc.wires = clone(before); } };
  },
  flipH(ids) {
    let before;
    return { name: 'flipH',
      apply(project) {
        const doc = sheetOf(project);
        before = clone(doc.wires);
        const ends = attachedEnds(doc, ids);
        for (const s of doc.symbols) if (ids.includes(s.id)) s.mirror = !s.mirror;
        followEnds(doc, ends);
      },
      revert(project) {
        const doc = sheetOf(project);
        for (const s of doc.symbols) if (ids.includes(s.id)) s.mirror = !s.mirror;
        doc.wires = clone(before);
      } };
  },
  addWire(a, b?, opts: AddWireOpts = {}) {
    let w;
    const kind: WireKind = opts.kind ?? 'wire';
    return { name: kind === 'bus' ? 'addBus' : 'addWire',
      apply(project) {
        const doc = sheetOf(project);
        if (!w) {
          let points;
          if (Array.isArray(a)) points = a.map((p) => ({ x: Math.round(p.x) + 0, y: Math.round(p.y) + 0 }));
          else {
            if (!b) throw new Error('pino-a-pino precisa de destino');
            if (a.sym === b.sym && a.pin === b.pin) throw new Error('fio entre o mesmo pino');
            const pa = pinWorld(doc, a.sym, a.pin), pb = pinWorld(doc, b.sym, b.pin);
            if (!pa || !pb) throw new Error('pino inexistente'); points = orthoPath(pa, pb);
          }
          points = normalizePoints(points);
          if (points.length < 2) throw new Error('fio precisa de dois pontos distintos');
          w = { id: `w${doc.nextId++}`, points, kind };
        }
        doc.wires.push(clone(w)); return w.id; },
      revert(project) { sheetOf(project).wires = sheetOf(project).wires.filter((x) => x.id !== w.id); } };
  },
  remove(ids) {
    let snapshot;
    return { name: 'remove',
      apply(project) {
        const doc = sheetOf(project);
        snapshot = clone({ symbols: doc.symbols, wires: doc.wires });
        const pins = new Set(doc.symbols.filter((s) => ids.includes(s.id)).flatMap((s) => symbolPins(s).map(pkey)));
        const touches = (w) => pins.has(pkey(w.points[0])) || pins.has(pkey(w.points[w.points.length - 1]));
        doc.symbols = doc.symbols.filter((s) => !ids.includes(s.id));
        doc.wires = doc.wires.filter((w) => !(ids.includes(w.id) || touches(w)));
      },
      revert(project) { const doc = sheetOf(project); doc.symbols = clone(snapshot.symbols); doc.wires = clone(snapshot.wires); } };
  },
  addSheet(name?: string) {
    let id; let prevActive;
    return { name: 'addSheet',
      apply(project) {
        prevActive = project.activeSheetId;
        let n = 1; while (project.sheets.some((s) => s.id === `sh${n}`)) n++;
        id = `sh${n}`;
        project.sheets.push({ id, name: name?.trim() || `Folha ${project.sheets.length + 1}`, nextId: 1, symbols: [], wires: [] });
        project.activeSheetId = id; return id;
      },
      revert(project) { project.sheets = project.sheets.filter((s) => s.id !== id); project.activeSheetId = prevActive; } };
  },
  removeSheet(sheetId: string) {
    let removed; let prevActive;
    return { name: 'removeSheet',
      apply(project) {
        if (project.sheets.length <= 1) throw new Error('não é possível remover a única folha');
        prevActive = project.activeSheetId;
        const i = project.sheets.findIndex((s) => s.id === sheetId);
        if (i < 0) throw new Error('folha não encontrada');
        removed = clone(project.sheets[i]);
        project.sheets.splice(i, 1);
        if (project.activeSheetId === sheetId) project.activeSheetId = project.sheets[0].id;
      },
      revert(project) { project.sheets.push(removed); project.activeSheetId = prevActive; } };
  },
  renameSheet(sheetId: string, newName: string) {
    let old;
    return { name: 'renameSheet',
      apply(project) {
        const s = project.sheets.find((x) => x.id === sheetId);
        if (!s) throw new Error('folha não encontrada');
        old = s.name; s.name = String(newName).trim() || old;
      },
      revert(project) { project.sheets.find((x) => x.id === sheetId).name = old; } };
  },
  setActiveSheet(sheetId: string) {
    let prev;
    return { name: 'setActiveSheet',
      apply(project) {
        if (!project.sheets.some((s) => s.id === sheetId)) throw new Error('folha não encontrada');
        prev = project.activeSheetId; project.activeSheetId = sheetId;
      },
      revert(project) { project.activeSheetId = prev; } };
  },
};

export class History {
  doc: Project;
  undoStack: Command[];
  redoStack: Command[];
  limit: number;
  listeners: Set<(h: History) => void>;
  constructor(doc: Project, limit = 200) { this.doc = doc; this.undoStack = []; this.redoStack = []; this.limit = limit; this.listeners = new Set(); }
  exec(cmd: Command) { const r = cmd.apply(this.doc); this.undoStack.push(cmd); if (this.undoStack.length > this.limit) this.undoStack.shift(); this.redoStack = []; this.emit(); return r; }
  undo() { const c = this.undoStack.pop(); if (!c) return false; c.revert(this.doc); this.redoStack.push(c); this.emit(); return true; }
  redo() { const c = this.redoStack.pop(); if (!c) return false; c.apply(this.doc); this.undoStack.push(c); this.emit(); return true; }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  reset(doc: Project) { this.doc = doc; this.undoStack = []; this.redoStack = []; this.emit(); }
  on(fn: (h: History) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const f of this.listeners) f(this); }
}

// ---- Viewport: tela = (mundo - origem) * escala
export function createViewport() { return { x: 0, y: 0, scale: 1 }; }
export const toWorld = (vp, sx, sy) => ({ x: sx / vp.scale + vp.x, y: sy / vp.scale + vp.y });
export const toScreen = (vp, wx, wy) => ({ x: (wx - vp.x) * vp.scale, y: (wy - vp.y) * vp.scale });
export function zoomAt(vp, sx, sy, factor, min = 0.1, max = 20) {
  const before = toWorld(vp, sx, sy); const scale = Math.min(max, Math.max(min, vp.scale * factor));
  return { scale, x: before.x - sx / scale, y: before.y - sy / scale };
}
export const pan = (vp, dsx, dsy) => ({ ...vp, x: vp.x - dsx / vp.scale, y: vp.y - dsy / vp.scale });

// ---- Persistência v1/v2 → v3
export function serialize(project: Project) { return JSON.stringify(project, null, 2); }

function migrateSheetV1(sheet: Sheet & { version?: number; wires: unknown[] }) {
  if (sheet.version !== 1) return;
  const ids = new Set(sheet.symbols.map((s) => s.id));
  for (const s of sheet.symbols) {
    s.x = Math.round(s.x); s.y = Math.round(s.y);
    if (SYMBOLS[s.kind]?.role && s.net === undefined) s.net = SYMBOLS[s.kind].defaultNet;
  }
  sheet.wires = (sheet.wires as { id: string; from: { sym: string; pin: string }; to: { sym: string; pin: string } }[]).map((w) => {
    if (!w.from || !w.to || !ids.has(w.from.sym) || !ids.has(w.to.sym)) throw new Error(`fio ${w.id} referencia símbolo inexistente`);
    const pa = pinWorld(sheet, w.from.sym, w.from.pin), pb = pinWorld(sheet, w.to.sym, w.to.pin);
    if (!pa || !pb) throw new Error(`fio ${w.id} referencia pino inexistente`);
    return { id: w.id, points: orthoPath(pa, pb), kind: 'wire' as const };
  });
}

export function migrate(raw: Record<string, unknown>): Project {
  if (raw.format !== FORMAT) throw new Error('formato inválido');
  if (raw.version === 3 && Array.isArray(raw.sheets)) return raw as unknown as Project;
  if ((raw.version === 1 || raw.version === 2) && Array.isArray(raw.symbols)) {
    const sheet: Sheet = {
      id: 'sh1', name: 'Folha 1', nextId: (raw.nextId as number) ?? 1,
      symbols: raw.symbols as Sheet['symbols'], wires: raw.wires as Sheet['wires'],
    };
    if (raw.version === 1) migrateSheetV1(Object.assign(sheet, { version: 1 }));
    for (const s of sheet.symbols) if (s.mirror === undefined) s.mirror = false;
    for (const w of sheet.wires) if (!w.kind) w.kind = 'wire';
    return { format: FORMAT, version: 3, activeSheetId: 'sh1', sheets: [sheet] };
  }
  throw new Error('estrutura inválida');
}

export function deserialize(text: string): Project {
  const parsed = JSON.parse(text);
  if (parsed.format !== FORMAT) throw new Error('formato inválido');
  if (!Number.isInteger(parsed.version) || parsed.version < 1) throw new Error('versão inválida');
  if (parsed.version > FORMAT_VERSION) throw new Error('versão mais nova que o suportado');
  const project = migrate(parsed);
  for (const sheet of project.sheets) {
    for (const s of sheet.symbols) {
      if (!SYMBOLS[s.kind]) throw new Error(`símbolo desconhecido: ${s.kind}`);
      if (!Number.isInteger(s.x) || !Number.isInteger(s.y)) throw new Error(`coordenada não inteira em ${s.id}`);
    }
    for (const w of sheet.wires) {
      if (!Array.isArray(w.points) || w.points.length < 2 || !w.points.every(validPoint)) throw new Error(`fio ${w.id} com pontos inválidos`);
      w.points = w.points.map(({ x, y }) => ({ x, y }));
      if (!w.kind) w.kind = 'wire';
    }
  }
  if (!project.sheets.some((s) => s.id === project.activeSheetId)) project.activeSheetId = project.sheets[0].id;
  if (project.pcb && project.pcb.format !== 'proto-eda-pcb') throw new Error('pcb inválida');
  if (project.pcb && !project.pcb.vias) project.pcb.vias = [];
  if (project.pcb && !project.pcb.pours) project.pcb.pours = [];
  return project;
}

export function netlist(project: Project): string[][] {
  const nets = buildNetlist(getActiveSheet(project)).nets as Record<string, string[]>;
  return Object.values(nets).filter((g) => g.length > 1).map((g) => [...g].sort()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
