// Parser/serializer ORIGINAL para o formato "EasyEDA Standard" (comprimido, separado por "~").
// Escrito do zero a partir da documentação pública (docs.easyeda.com/en/DocumentFormat/*).
// Nenhum código do EasyEDA foi copiado. Licença: MIT (código do projeto próprio).

export const SEP = { FIELD: '~', SUB: '#@$', SEG: '^^', SHEET: '#sheet#' };

// Esquemas de campos (ordem conforme documentação pública). Campos excedentes vão para `extra`.
export const SCH_SCHEMAS = {
  PL: ['points', 'strokeColor', 'strokeWidth', 'strokeStyle', 'fillColor', 'id', 'locked'],
  W: ['points', 'strokeColor', 'strokeWidth', 'strokeStyle', 'fillColor', 'id', 'locked'],
  B: ['points', 'strokeColor', 'strokeWidth', 'strokeStyle', 'fillColor', 'id', 'locked'],
  PG: ['points', 'strokeColor', 'strokeWidth', 'strokeStyle', 'fillColor', 'id', 'locked'],
  R: ['x', 'y', 'rx', 'ry', 'width', 'height', 'strokeColor', 'strokeWidth', 'strokeStyle', 'fillColor', 'id', 'locked'],
  E: ['cx', 'cy', 'rx', 'ry', 'strokeColor', 'strokeWidth', 'strokeStyle', 'fillColor', 'id', 'locked'],
  J: ['x', 'y', 'radius', 'fillColor', 'id', 'locked'],
  N: ['x', 'y', 'rotation', 'fillColor', 'name', 'id', 'anchor', 'px', 'py', 'fontFamily', 'fontSize', 'locked'],
  O: ['x', 'y', 'id', 'color', 'locked'],
  T: ['mark', 'x', 'y', 'rotation', 'fillColor', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'baseline', 'type', 'text', 'visible', 'anchor', 'id', 'locked'],
  LIB: ['x', 'y', 'attrs', 'rotation', 'importFlag', 'id', 'puuid', 'uuid', 'locked', 'bind', 'convertToPcb', 'addIntoBom'],
  // Validado com export real v6.5.61 (evidence/real-exports): moldura/caminho de símbolo.
  PT: ['path', 'strokeColor', 'strokeWidth', 'strokeStyle', 'fillColor', 'id', 'locked'],
};
export const PCB_SCHEMAS = {
  TRACK: ['strokeWidth', 'layerId', 'net', 'points', 'id', 'locked'],
  VIA: ['x', 'y', 'diameter', 'net', 'holeRadius', 'id', 'locked'],
  HOLE: ['x', 'y', 'diameter', 'id', 'locked'],
  // Export real v6.5.61: "CIRCLE~cx~cy~r~sw~layer~gge21~0~~" — `locked` segue `id` (como nas demais primitivas).
  CIRCLE: ['cx', 'cy', 'r', 'strokeWidth', 'layerId', 'id', 'locked', 'net'],
  RECT: ['x', 'y', 'width', 'height', 'layerId', 'id', 'locked'],
  PAD: ['shape', 'x', 'y', 'width', 'height', 'layerId', 'net', 'number', 'holeRadius', 'points', 'rotation', 'id', 'holeLength', 'slotPoints', 'plated', 'locked', 'pasteExpansion', 'solderExpansion', 'holeCenter'],
  FOOTPRINT: ['x', 'y', 'attrs', 'rotation', 'importFlag', 'id', 'locked'],
  // Campos abaixo derivados do export/HAR reais v6.5.61. Nomes marcados "?" no doc 05 são INFERIDOS.
  LIB: ['x', 'y', 'attrs', 'rotation', 'importFlag', 'id', 'layerSide', 'uuid', 'updateTime', 'locked'],
  TEXT: ['textType', 'x', 'y', 'strokeWidth', 'rotation', 'mirror', 'layerId', 'net', 'fontSize', 'text', 'path', 'display', 'id', 'fontFamily', 'locked'],
  SOLIDREGION: ['layerId', 'net', 'path', 'fillType', 'id'],
  SVGNODE: ['json'],
};
// Pin "P": 7 segmentos separados por ^^ (config, pinDot, path, name, num, dot, clock)
export const PIN_SEGMENTS = ['config', 'pinDot', 'path', 'name', 'num', 'dot', 'clock'];
export const PIN_CONFIG = ['display', 'electric', 'spicePin', 'x', 'y', 'rotation', 'id', 'locked'];

const NUMERIC = new Set(['x', 'y', 'rx', 'ry', 'cx', 'cy', 'r', 'width', 'height', 'strokeWidth', 'radius', 'diameter', 'holeRadius', 'rotation', 'holeLength', 'px', 'py']);

function zip(names, values) {
  const o = {};
  names.forEach((n, i) => { if (i < values.length) o[n] = values[i]; });
  return o;
}

/** Converte uma string de primitiva em objeto. Preserva a string original para round-trip exato. */
export function parseShape(str, kind = 'sch') {
  if (typeof str !== 'string') throw new TypeError('shape deve ser string');
  const subIdx = str.indexOf(SEP.SUB);
  if (subIdx >= 0) { // composto: LIB / FOOTPRINT
    const parts = str.split(SEP.SUB);
    const head = parseShape(parts[0], kind);
    return { ...head, children: parts.slice(1).map((p) => parseShape(p, kind)) };
  }
  const cmd = str.slice(0, str.indexOf(SEP.FIELD) < 0 ? str.length : str.indexOf(SEP.FIELD));
  if (cmd === 'P' && str.includes(SEP.SEG)) {
    const segs = str.split(SEP.SEG);
    const cfg = segs[0].split(SEP.FIELD).slice(1);
    return { type: 'P', fields: zip(PIN_CONFIG, cfg), extra: cfg.slice(PIN_CONFIG.length), segments: segs.slice(1), _n: cfg.length };
  }
  if (str.includes(SEP.SEG)) { // outras primitivas segmentadas (F netflag, etc.) — mantidas por segmento
    return { type: cmd, segments: str.split(SEP.SEG), raw: true };
  }
  const vals = str.split(SEP.FIELD).slice(1);
  const schema = (kind === 'pcb' ? PCB_SCHEMAS : SCH_SCHEMAS)[cmd];
  if (!schema) return { type: cmd, values: vals, unknown: true };
  return { type: cmd, fields: zip(schema, vals), extra: vals.slice(schema.length), _n: vals.length };
}

export function serializeShape(o, kind = 'sch') {
  if (o.children) {
    const { children, ...head } = o;
    return [serializeShape(head, kind), ...children.map((c) => serializeShape(c, kind))].join(SEP.SUB);
  }
  if (o.raw) return o.segments.join(SEP.SEG);
  if (o.unknown) return [o.type, ...o.values].join(SEP.FIELD);
  const schema = o.type === 'P' ? PIN_CONFIG : (kind === 'pcb' ? PCB_SCHEMAS : SCH_SCHEMAS)[o.type];
  const n = o._n ?? schema.length;
  const vals = schema.slice(0, Math.min(n, schema.length)).map((k) => o.fields[k] ?? '');
  const line = [o.type, ...vals, ...(o.extra || [])].join(SEP.FIELD);
  return o.type === 'P' ? [line, ...o.segments].join(SEP.SEG) : line;
}

/** Extrai docType tanto do head em objeto (2020+) quanto do head legado em string "1~1.7.5~...". */
export function docTypeOf(doc) {
  const h = doc.head;
  if (h && typeof h === 'object') return Number(h.docType);
  if (typeof h === 'string') return Number(h.split(SEP.FIELD)[0]);
  if (doc.docType !== undefined) return Number(doc.docType); // resposta de GET /api/documents/{uuid}
  return NaN;
}
export const DOC_TYPES = { 1: 'schematic', 3: 'pcb', 4: 'pcbFootprint', 5: 'project', 7: 'schematicLib' };

export function parseDocument(input) {
  const doc = typeof input === 'string' ? JSON.parse(input) : input;
  const docType = docTypeOf(doc);
  if (docType === 5 && Array.isArray(doc.schematics)) {
    return { docType, meta: omit(doc, ['schematics']), schematics: doc.schematics.map((s) => hide({ ...omit(s, ['dataStr']), dataStrIsString: typeof s.dataStr === 'string', doc: parseDocument(s.dataStr) }, Object.keys(s))) };
  }
  const kind = docType === 3 || docType === 4 ? 'pcb' : 'sch';
  return { docType, kind, meta: omit(doc, ['shape']), shapes: (doc.shape || []).map((s) => parseShape(s, kind)) };
}

export function serializeDocument(model) {
  if (model.docType === 5) {
    return reorderTop({ ...model.meta, schematics: model.schematics.map((sc) => { const { doc, dataStrIsString = true, ...rest } = sc; return reorder({ ...rest, dataStr: dataStrIsString ? JSON.stringify(serializeDocument(doc)) : serializeDocument(doc) }, sc.__keyOrder); }) }, model.meta.__keyOrder);
  }
  const out = { ...model.meta, shape: model.shapes.map((s) => serializeShape(s, model.kind)) };
  // preserva ordem original de chaves: shape volta para a posição relativa via reconstrução
  return reorder(out, model.meta.__keyOrder);
}

function hide(o, order) { Object.defineProperty(o, '__keyOrder', { value: order, enumerable: false }); return o; }
function reorderTop(o, order) { return reorder(o, order); }
function omit(o, keys) { const r = {}; for (const k of Object.keys(o)) if (!keys.includes(k)) r[k] = o[k]; Object.defineProperty(r, '__keyOrder', { value: Object.keys(o), enumerable: false }); return r; }
function reorder(o, order) { if (!order) return o; const r = {}; for (const k of order) if (k in o) r[k] = o[k]; for (const k of Object.keys(o)) if (!(k in r)) r[k] = o[k]; return r; }

/** Converte para valores numéricos (opcional, para uso de motores). */
export function num(o, key) { const v = o.fields?.[key]; return v === undefined || v === '' ? undefined : Number(v); }
export function parsePoints(s) { const a = String(s).trim().split(/[\s,]+/).filter(Boolean).map(Number); const pts = []; for (let i = 0; i + 1 < a.length; i += 2) pts.push({ x: a[i], y: a[i + 1] }); return pts; }
export { NUMERIC };

/** Unidades: PCB Standard usa 1 unidade = 10 mil. */
export const units = { toMil: (u) => u * 10, toMm: (u) => u * 0.254, fromMm: (mm) => mm / 0.254 };

/** Extração de conectividade de esquema (original): união de extremidades de fios, pinos e rótulos coincidentes. */
export function extractNets(model) {
  const parent = new Map();
  const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  const add = (k) => { if (!parent.has(k)) parent.set(k, k); return k; };
  const union = (a, b) => { const ra = find(add(a)), rb = find(add(b)); if (ra !== rb) parent.set(ra, rb); };
  const key = (p) => `${+p.x},${+p.y}`;
  const pins = []; const labels = [];
  const wirePts = [];
  const walk = (shapes, owner) => {
    for (const s of shapes) {
      if (s.children) walk(s.children, s);
      if (s.type === 'W') { const pts = parsePoints(s.fields.points); pts.forEach((p) => add(key(p))); for (let i = 1; i < pts.length; i++) union(key(pts[i - 1]), key(pts[i])); wirePts.push(...pts); }
      if (s.type === 'P') { const p = { x: s.fields.x, y: s.fields.y }; add(key(p)); pins.push({ owner: owner?.fields?.id, num: s.fields.spicePin, at: key(p) }); }
      if (s.type === 'N') { const p = { x: s.fields.x, y: s.fields.y }; add(key(p)); labels.push({ name: s.fields.name, at: key(p) }); }
    }
  };
  walk(model.shapes, null);
  // fios em T: ponto de um fio sobre segmento de outro
  const wires = model.shapes.filter((s) => s.type === 'W').map((s) => parsePoints(s.fields.points));
  for (const k of parent.keys()) {
    const [x, y] = k.split(',').map(Number);
    for (const w of wires) for (let i = 1; i < w.length; i++) if (onSeg({ x, y }, w[i - 1], w[i])) union(k, key(w[i]));
  }
  const byName = new Map();
  for (const l of labels) { if (byName.has(l.name)) union(byName.get(l.name), l.at); else byName.set(l.name, l.at); }
  const nets = new Map();
  for (const p of pins) { const r = find(p.at); if (!nets.has(r)) nets.set(r, { name: null, pins: [] }); nets.get(r).pins.push(`${p.owner}.${p.num}`); }
  for (const l of labels) { const r = find(l.at); if (nets.has(r)) nets.get(r).name = l.name; }
  return [...nets.values()].map((n, i) => ({ name: n.name || `N$${i + 1}`, pins: n.pins.sort() }));
}
function onSeg(p, a, b) {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(cross) > 1e-9) return false;
  return p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
}

/** Conectividade de PCB (original): agrupa TRACK/VIA/PAD pelo campo `net` (inclusive dentro de LIB). */
export function extractPcbNets(model) {
  const nets = new Map();
  const walk = (shapes, owner) => {
    for (const s of shapes) {
      if (s.children) walk(s.children, s);
      if (!['TRACK', 'VIA', 'PAD'].includes(s.type)) continue;
      const n = s.fields?.net; if (!n) continue;
      if (!nets.has(n)) nets.set(n, { name: n, tracks: 0, vias: 0, pads: [] });
      const e = nets.get(n);
      if (s.type === 'TRACK') e.tracks++; else if (s.type === 'VIA') e.vias++; else e.pads.push(`${owner?.fields?.id ?? '?'}.${s.fields.number}`);
    }
  };
  walk(model.shapes, null);
  return [...nets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Decodifica SVGNODE (JSON embutido; ex.: contorno 3D). */
export function svgNodeOf(shape) { return shape.type === 'SVGNODE' ? JSON.parse(shape.fields.json) : undefined; }
