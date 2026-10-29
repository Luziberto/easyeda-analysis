import type { Project } from './types.js';
import { buildProjectNetlist } from './project.js';
import { buildNetlist, describeWarning } from './connectivity.js';
import { SYMBOLS, defFor } from './library.js';

export type ErcItem =
  | { code: 'floating-pin'; ref: string; pin: string; sheet?: string }
  | { code: 'input-no-drive'; net: string; ref: string; pin: string; sheet?: string }
  | { code: 'output-conflict'; net: string; refs: string[]; sheet?: string }
  | { code: 'power-short'; net: string; powers: string[]; sheet?: string }
  | { code: 'netlist'; warning: ReturnType<typeof buildNetlist>['warnings'][0] };

function pinElectric(refPin: string, sheet: import('./types.js').Sheet): string {
  const [ref, pinNum] = refPin.split('.');
  const sym = sheet.symbols.find((s) => s.ref === ref);
  if (!sym) return 'unspecified';
  const p = defFor(sym).pins.find((p) => p.num === pinNum);
  return p?.electric ?? 'unspecified';
}

function analyzeSheet(_project: Project, sheet: import('./types.js').Sheet) {
  const nl = buildNetlist(sheet);
  const pinToNet = new Map<string, string>();
  for (const [name, pins] of Object.entries(nl.nets)) {
    for (const p of pins as string[]) pinToNet.set(p, name);
  }

  const errors: ErcItem[] = [];
  const warnings: ErcItem[] = [];

  for (const s of sheet.symbols) {
    if (SYMBOLS[s.kind].role) continue;
    for (const p of SYMBOLS[s.kind].pins) {
      const key = `${s.ref}.${p.num}`;
      const net = pinToNet.get(key);
      if (!net) {
        errors.push({ code: 'floating-pin', ref: s.ref, pin: p.num, sheet: sheet.name });
        continue;
      }
      const pins = nl.nets[net] ?? [];
      const compPins = pins.filter((x) => {
        const ref = x.split('.')[0];
        const sym = sheet.symbols.find((t) => t.ref === ref);
        return sym && !SYMBOLS[sym.kind].role;
      });
      const hasPower = pins.some((x) => pinElectric(x, sheet) === 'power');
      if (compPins.length < 2 && !hasPower) {
        errors.push({ code: 'floating-pin', ref: s.ref, pin: p.num, sheet: sheet.name });
      }
    }
  }

  for (const [net, pins] of Object.entries(nl.nets)) {
    const pinList = pins as string[];
    const outputs = pinList.filter((p) => pinElectric(p, sheet) === 'output');
    if (outputs.length >= 2) {
      errors.push({ code: 'output-conflict', net, refs: outputs.map((p) => p.split('.')[0]), sheet: sheet.name });
    }
    const hasDrive = pinList.some((p) => {
      const e = pinElectric(p, sheet);
      return e === 'output' || e === 'power';
    });
    for (const p of pinList) {
      if (pinElectric(p, sheet) === 'input' && !hasDrive) {
        warnings.push({ code: 'input-no-drive', net, ref: p.split('.')[0], pin: p.split('.')[1], sheet: sheet.name });
      }
    }
    const powers = new Set<string>();
    for (const s of sheet.symbols) {
      if (SYMBOLS[s.kind].role !== 'power') continue;
      const pn = String(s.net ?? SYMBOLS[s.kind].defaultNet ?? '').trim().toUpperCase();
      if (pinList.some((x) => x.startsWith(s.ref + '.'))) powers.add(pn);
    }
    if (powers.has('GND') && (powers.has('VCC') || powers.has('VDD') || [...powers].some((x) => x.startsWith('+')))) {
      errors.push({ code: 'power-short', net, powers: [...powers], sheet: sheet.name });
    }
  }

  return { errors, warnings, nl };
}

export function runErc(project: Project) {
  const errors: ErcItem[] = [];
  const warnings: ErcItem[] = [];

  for (const sheet of project.sheets) {
    const r = analyzeSheet(project, sheet);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    for (const w of r.nl.warnings) warnings.push({ code: 'netlist', warning: w });
  }

  const pn = buildProjectNetlist(project);
  for (const w of pn.warnings) warnings.push({ code: 'netlist', warning: w });

  return { errors, warnings };
}

export function describeErc(item: ErcItem): string {
  switch (item.code) {
    case 'floating-pin':
      return `[ERRO] Pino flutuante ${item.ref}.${item.pin}${item.sheet ? ` (${item.sheet})` : ''}`;
    case 'input-no-drive':
      return `[AVISO] Entrada sem drive: ${item.ref}.${item.pin} na rede ${item.net}${item.sheet ? ` (${item.sheet})` : ''}`;
    case 'output-conflict':
      return `[ERRO] Conflito de saídas na rede ${item.net}: ${item.refs.join(', ')}${item.sheet ? ` (${item.sheet})` : ''}`;
    case 'power-short':
      return `[ERRO] Curto entre alimentações ${item.powers.join(' vs ')} na rede ${item.net}${item.sheet ? ` (${item.sheet})` : ''}`;
    case 'netlist':
      return `[AVISO] ${describeWarning(item.warning)}`;
    default:
      return JSON.stringify(item);
  }
}
