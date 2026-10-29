// Conversão EasyEDA Std → Project v3 (docType 1 ou 5 multi-folha).
import { createProject } from '../core/model.js';
import type { Project, Sheet, SymbolKind, WireKind } from '../core/types.js';
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

function nextRef(sheet: Sheet, kind: SymbolKind): string {
  const prefix = SYMBOLS[kind].prefix;
  let n = 1;
  const used = new Set(sheet.symbols.map((s) => s.ref));
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

function importShapesInto(sheet: Sheet, shapes: unknown[], skip: string[]) {
  for (const sh of shapes as { type: string; fields?: Record<string, string>; children?: unknown[] }[]) {
    if (sh.type === 'LIB') {
      const kind = libKind(sh.fields?.attrs);
      if (!kind) { skip.push(`LIB ${sh.fields?.attrs ?? '?'}`); continue; }
      const x = Math.round(Number(sh.fields?.x));
      const y = Math.round(Number(sh.fields?.y));
      const rot = Number(sh.fields?.rotation) || 0;
      const ref = refFromLib(sh as { children?: { type: string; fields?: { text?: string } }[] }) || nextRef(sheet, kind);
      sheet.symbols.push({
        id: `s${sheet.nextId++}`, kind, x, y, rot: ((rot % 360) + 360) % 360, ref, mirror: false,
      });
    } else if (sh.type === 'W' || sh.type === 'B') {
      const kind: WireKind = sh.type === 'B' ? 'bus' : 'wire';
      const pts = parsePoints(sh.fields?.points ?? '').map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
      if (pts.length >= 2) sheet.wires.push({ id: `w${sheet.nextId++}`, points: pts, kind });
    } else if (sh.type === 'N') {
      const name = String(sh.fields?.name ?? '').trim() || 'NET';
      const x = Math.round(Number(sh.fields?.x));
      const y = Math.round(Number(sh.fields?.y));
      let kind: SymbolKind = 'netlabel';
      if (/^gnd$/i.test(name)) kind = 'ground';
      else if (/^vcc$|^vdd$|^\+3\.3v$|^\+5v$/i.test(name)) kind = 'vcc';
      sheet.symbols.push({
        id: `s${sheet.nextId++}`, kind, x, y, rot: 0,
        ref: kind === 'netlabel' ? nextRef(sheet, 'netlabel') : kind === 'ground' ? 'GND' : 'PWR',
        net: kind === 'ground' ? 'GND' : kind === 'vcc' ? 'VCC' : name,
        mirror: false,
      });
    }
  }
}

function addSheet(project: Project, name: string): Sheet {
  let n = 1;
  while (project.sheets.some((s) => s.id === `sh${n}`)) n++;
  const id = `sh${n}`;
  const sheet: Sheet = { id, name, nextId: 1, symbols: [], wires: [] };
  project.sheets.push(sheet);
  return sheet;
}

export interface ImportResult {
  doc: Project;
  skip: string[];
  sheets?: number;
}

/** @param input JSON EasyEDA — docType 1 (uma folha) ou 5 (várias folhas). */
export function importEasyedaSchematic(input: string | object): ImportResult {
  const raw = typeof input === 'string' ? JSON.parse(input) : input;
  const dt = docTypeOf(raw);
  const skip: string[] = [];

  if (dt === 1) {
    const parsed = typeof input === 'string' ? parseDocument(input) : parseDocument(raw);
    const project = createProject();
    const sheet = project.sheets[0];
    importShapesInto(sheet, parsed.shapes, skip);
    if (!sheet.symbols.length && !sheet.wires.length) throw new Error('Nenhum elemento reconhecido no esquemático.');
    return { doc: project, skip };
  }

  if (dt === 5) {
    const proj = typeof input === 'string' ? parseDocument(input) : parseDocument(raw);
    const schematics = proj.schematics ?? [];
    if (!schematics.length) throw new Error('Projeto EasyEDA sem folhas de esquemático.');
    const project = createProject();
    project.sheets = [];
    let i = 0;
    for (const sc of schematics) {
      const inner = sc.doc ?? sc;
      const title = (sc as { title?: string }).title || `Folha ${++i}`;
      const sheet = addSheet(project, title);
      if (inner?.shapes) importShapesInto(sheet, inner.shapes, skip);
    }
    project.activeSheetId = project.sheets[0].id;
    const total = project.sheets.reduce((n, s) => n + s.symbols.length + s.wires.length, 0);
    if (!total) throw new Error('Nenhum elemento reconhecido nas folhas.');
    return { doc: project, skip, sheets: project.sheets.length };
  }

  throw new Error('Importação suporta docType 1 (esquemático) ou 5 (projeto).');
}
