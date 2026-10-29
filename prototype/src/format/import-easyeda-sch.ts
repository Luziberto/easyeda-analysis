// Conversão EasyEDA Std → documento do protótipo (docType 1 ou 5 multi-folha).
import { createDocument } from '../core/model.js';
import type { Document, SymbolKind } from '../core/types.js';
import { SYMBOLS } from '../core/library.js';
import { parseDocument, parsePoints, docTypeOf } from './easyeda-std.js';

function libKind(attrs: unknown): SymbolKind | null {
  const a = String(attrs ?? '').toLowerCase();
  if (a.includes('led')) return 'led';
  if (/cap|0603c|0805c/.test(a)) return 'capacitor';
  if (/r0603|r0805|res|0603r/.test(a)) return 'resistor';
  return null;
}

function refFromLib(shape: { children?: { type: string; fields?: { text?: string } }[] }) {
  const t = shape.children?.find((s) => s.type === 'T');
  return t?.fields?.text?.trim() || null;
}

function nextRef(doc: Document, kind: SymbolKind): string {
  const prefix = SYMBOLS[kind].prefix;
  let n = 1;
  const used = new Set(doc.symbols.map((s) => s.ref));
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

function importShapesInto(doc: Document, shapes: unknown[], offsetX: number, skip: string[]) {
  for (const sh of shapes as { type: string; fields?: Record<string, string>; children?: unknown[] }[]) {
    if (sh.type === 'LIB') {
      const kind = libKind(sh.fields?.attrs);
      if (!kind) { skip.push(`LIB ${sh.fields?.attrs ?? '?'}`); continue; }
      const x = Math.round(Number(sh.fields?.x)) + offsetX;
      const y = Math.round(Number(sh.fields?.y));
      const rot = Number(sh.fields?.rotation) || 0;
      const ref = refFromLib(sh as { children?: { type: string; fields?: { text?: string } }[] }) || nextRef(doc, kind);
      doc.symbols.push({
        id: `s${doc.nextId++}`, kind, x, y, rot: ((rot % 360) + 360) % 360, ref, mirror: false,
      });
    } else if (sh.type === 'W' || sh.type === 'B') {
      const pts = parsePoints(sh.fields?.points ?? '').map((p) => ({ x: Math.round(p.x) + offsetX, y: Math.round(p.y) }));
      if (pts.length >= 2) doc.wires.push({ id: `w${doc.nextId++}`, points: pts });
    } else if (sh.type === 'N') {
      const name = String(sh.fields?.name ?? '').trim() || 'NET';
      const x = Math.round(Number(sh.fields?.x)) + offsetX;
      const y = Math.round(Number(sh.fields?.y));
      let kind: SymbolKind = 'netlabel';
      if (/^gnd$/i.test(name)) kind = 'ground';
      else if (/^vcc$|^vdd$|^\+3\.3v$|^\+5v$/i.test(name)) kind = 'vcc';
      doc.symbols.push({
        id: `s${doc.nextId++}`, kind, x, y, rot: 0,
        ref: kind === 'netlabel' ? nextRef(doc, 'netlabel') : kind === 'ground' ? 'GND' : 'PWR',
        net: kind === 'ground' ? 'GND' : kind === 'vcc' ? 'VCC' : name,
        mirror: false,
      });
    }
  }
}

export interface ImportResult {
  doc: Document;
  skip: string[];
  sheets?: number;
}

/** @param input JSON EasyEDA (objeto ou string) — esquemático (1) ou projeto multi-folha (5). */
export function importEasyedaSchematic(input: string | object): ImportResult {
  const raw = typeof input === 'string' ? JSON.parse(input) : input;
  const dt = docTypeOf(raw);
  const doc = createDocument();
  const skip: string[] = [];

  if (dt === 1) {
    const parsed = typeof input === 'string' ? parseDocument(input) : parseDocument(raw);
    importShapesInto(doc, parsed.shapes, 0, skip);
  } else if (dt === 5) {
    const proj = typeof input === 'string' ? parseDocument(input) : parseDocument(raw);
    const sheets = proj.schematics ?? [];
    let offset = 0;
    const step = 500;
    for (const sc of sheets) {
      const inner = sc.doc ?? sc;
      if (inner?.shapes) importShapesInto(doc, inner.shapes, offset, skip);
      offset += step;
    }
    if (!sheets.length) throw new Error('Projeto EasyEDA sem folhas de esquemático.');
    if (!doc.symbols.length && !doc.wires.length) throw new Error('Nenhum elemento reconhecido nas folhas.');
    return { doc, skip, sheets: sheets.length };
  } else {
    throw new Error('Importação suporta docType 1 (esquemático) ou 5 (projeto).');
  }

  if (!doc.symbols.length && !doc.wires.length) throw new Error('Nenhum elemento reconhecido no esquemático.');
  return { doc, skip };
}
