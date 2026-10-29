import type { Project } from '../core/types.js';
import { getActiveSheet } from '../core/project.js';
import { buildNetlist } from '../core/connectivity.js';
import { SYMBOLS } from '../core/library.js';

function spiceName(ref: string) {
  return ref.replace(/[^A-Za-z0-9_]/g, '_');
}

/** SPICE mínimo: R, C, D (LED), fontes V para GND/VCC ligados. */
export function exportSpice(project: Project): string {
  const lines = ['* Proto EDA export', '.title schematic'];
  let vsrc = 0;

  for (const sheet of project.sheets) {
    const nl = buildNetlist(sheet);
    const pinNet = new Map<string, string>();
    for (const [name, pins] of Object.entries(nl.nets)) {
      for (const p of pins as string[]) pinNet.set(p, name);
    }

    for (const s of sheet.symbols) {
      const def = SYMBOLS[s.kind];
      if (def.role === 'power') continue;
      if (s.kind === 'resistor' && def.pins.length >= 2) {
        const n1 = pinNet.get(`${s.ref}.${def.pins[0].num}`) ?? 'NC';
        const n2 = pinNet.get(`${s.ref}.${def.pins[1].num}`) ?? 'NC';
        lines.push(`R${spiceName(s.ref)} ${spiceName(n1)} ${spiceName(n2)} 1k`);
      } else if (s.kind === 'capacitor' && def.pins.length >= 2) {
        const n1 = pinNet.get(`${s.ref}.${def.pins[0].num}`) ?? 'NC';
        const n2 = pinNet.get(`${s.ref}.${def.pins[1].num}`) ?? 'NC';
        lines.push(`C${spiceName(s.ref)} ${spiceName(n1)} ${spiceName(n2)} 1u`);
      } else if (s.kind === 'led' && def.pins.length >= 2) {
        const n1 = pinNet.get(`${s.ref}.${def.pins[0].num}`) ?? 'NC';
        const n2 = pinNet.get(`${s.ref}.${def.pins[1].num}`) ?? 'NC';
        lines.push(`D${spiceName(s.ref)} ${spiceName(n1)} ${spiceName(n2)} DLED`);
      }
    }

    for (const s of sheet.symbols) {
      if (SYMBOLS[s.kind].role !== 'power') continue;
      const netName = String(s.net ?? SYMBOLS[s.kind].defaultNet ?? '').trim();
      const pin = `${s.ref}.${SYMBOLS[s.kind].pins[0].num}`;
      const net = pinNet.get(pin) ?? netName;
      if (/^gnd$/i.test(netName)) lines.push(`V${++vsrc} ${spiceName(net)} 0 0`);
      else lines.push(`V${++vsrc} ${spiceName(net)} 0 5`);
    }
  }

  lines.push('DLED D');
  lines.push('.end');
  return lines.join('\n');
}

export function exportSpiceActiveSheet(project: Project): string {
  const sub: Project = { ...project, sheets: [getActiveSheet(project)], activeSheetId: project.activeSheetId };
  return exportSpice(sub);
}
