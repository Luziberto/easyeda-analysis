import type { Project } from '../core/types.js';
import { buildProjectNetlist, getActiveSheet } from '../core/project.js';
import { buildNetlist } from '../core/connectivity.js';
import { SYMBOLS } from '../core/library.js';

function spiceName(ref: string) {
  return ref.replace(/[^A-Za-z0-9_]/g, '_');
}

function spiceNet(name: string) {
  const n = name.trim();
  if (!n || n === 'NC') return 'NC';
  if (/^gnd$/i.test(n)) return '0';
  return spiceName(n);
}

function parseValue(kind: 'resistor' | 'capacitor', raw: string | undefined, fallback: string): string {
  const v = raw?.trim();
  if (!v) return fallback;
  if (kind === 'resistor') {
    if (/^\d+(\.\d+)?(k|K|m|M|G|g)?$/.test(v) || /^\d+(\.\d+)?$/.test(v)) return v.replace(/k/i, 'k').replace(/m/i, 'Meg');
    return fallback;
  }
  if (/^\d+(\.\d+)?(u|n|p|m|U|N|P|M|F|f)?$/.test(v)) return v;
  return fallback;
}

function pinNetMap(sheet: import('../core/types.js').Sheet) {
  const nl = buildNetlist(sheet);
  const pinNet = new Map<string, string>();
  for (const [name, pins] of Object.entries(nl.nets)) {
    for (const p of pins as string[]) pinNet.set(p, name);
  }
  return pinNet;
}

/** SPICE: R, C, D, fontes; valores do campo `value`; bloco `.op` para ngspice externo. */
export function exportSpice(project: Project, opts: { includeOp?: boolean } = {}): string {
  const lines = ['* Proto EDA export', '.title schematic'];
  let vsrc = 0;
  const seenPower = new Set<string>();

  for (const sheet of project.sheets) {
    const pinNet = pinNetMap(sheet);
    for (const s of sheet.symbols) {
      const def = SYMBOLS[s.kind];
      if (def.role === 'power') continue;
      if (s.kind === 'resistor' && def.pins.length >= 2) {
        const n1 = spiceNet(pinNet.get(`${s.ref}.${def.pins[0].num}`) ?? 'NC');
        const n2 = spiceNet(pinNet.get(`${s.ref}.${def.pins[1].num}`) ?? 'NC');
        const val = parseValue('resistor', s.value, '1k');
        lines.push(`R${spiceName(s.ref)} ${n1} ${n2} ${val}`);
      } else if (s.kind === 'capacitor' && def.pins.length >= 2) {
        const n1 = spiceNet(pinNet.get(`${s.ref}.${def.pins[0].num}`) ?? 'NC');
        const n2 = spiceNet(pinNet.get(`${s.ref}.${def.pins[1].num}`) ?? 'NC');
        const val = parseValue('capacitor', s.value, '1u');
        lines.push(`C${spiceName(s.ref)} ${n1} ${n2} ${val}`);
      } else if (s.kind === 'led' && def.pins.length >= 2) {
        const n1 = spiceNet(pinNet.get(`${s.ref}.${def.pins[0].num}`) ?? 'NC');
        const n2 = spiceNet(pinNet.get(`${s.ref}.${def.pins[1].num}`) ?? 'NC');
        lines.push(`D${spiceName(s.ref)} ${n1} ${n2} DLED`);
      }
    }

    for (const s of sheet.symbols) {
      if (SYMBOLS[s.kind].role !== 'power') continue;
      const netName = String(s.net ?? SYMBOLS[s.kind].defaultNet ?? '').trim();
      const pin = `${s.ref}.${SYMBOLS[s.kind].pins[0].num}`;
      const net = spiceNet(pinNet.get(pin) ?? netName);
      if (net === 'NC') continue;
      const key = `${net}:${/^gnd$/i.test(netName) ? 'gnd' : 'v'}`;
      if (seenPower.has(key)) continue;
      seenPower.add(key);
      if (/^gnd$/i.test(netName) || net === '0') continue;
      lines.push(`V${++vsrc} ${net} 0 5`);
    }
  }

  lines.push('.model DLED D(Is=1e-14 N=1)');
  if (opts.includeOp !== false) {
    lines.push('* ngspice: ngspice deck.cir');
    lines.push('.op');
  }
  lines.push('.end');
  return lines.join('\n');
}

export function validateSpiceDeck(project: Project): { ok: boolean; errors: string[]; warnings: string[] } {
  const deck = exportSpice(project);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!/\n\.end\s*$/m.test(deck) && !deck.trim().endsWith('.end')) errors.push('Deck sem terminador .end');
  if (/\sNC\s/.test(deck)) errors.push('Existem ligações a nó NC');
  const nl = buildProjectNetlist(project);
  if (Object.keys(nl.nets).length === 0) warnings.push('Nenhuma rede no projeto');
  if (!/^R|^C|^D|^V/m.test(deck.split('\n').slice(2).join('\n'))) warnings.push('Deck sem componentes passivos detectados');
  return { ok: errors.length === 0, errors, warnings };
}

export function exportSpiceActiveSheet(project: Project): string {
  const sub: Project = { ...project, sheets: [getActiveSheet(project)], activeSheetId: project.activeSheetId };
  return exportSpice(sub);
}
