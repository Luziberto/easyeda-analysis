import type { Project, Sheet } from './types.js';
import { buildNetlist, naturalCompare } from './connectivity.js';
import { SYMBOLS } from './library.js';

export function getActiveSheet(project: Project): Sheet {
  const s = project.sheets.find((x) => x.id === project.activeSheetId);
  if (!s) throw new Error('folha ativa inválida');
  return s;
}

export function getSheet(project: Project, sheetId: string): Sheet {
  const s = project.sheets.find((x) => x.id === sheetId);
  if (!s) throw new Error(`folha ${sheetId} não encontrada`);
  return s;
}

/** Netlist do projeto: une redes com o mesmo nome entre folhas. */
export function buildProjectNetlist(project: Project) {
  const merged: Record<string, string[]> = {};
  const warnings: ReturnType<typeof buildNetlist>['warnings'] = [];
  const portNamesBySheet = new Map<string, Set<string>>();

  for (const sheet of project.sheets) {
    const nl = buildNetlist(sheet);
    for (const w of nl.warnings) warnings.push({ ...w, sheet: sheet.name } as typeof w & { sheet?: string });
    for (const [name, pins] of Object.entries(nl.nets)) {
      if (!merged[name]) merged[name] = [];
      for (const p of pins as string[]) if (!merged[name].includes(p)) merged[name].push(p);
    }
    const ports = new Set(
      sheet.symbols.filter((s) => SYMBOLS[s.kind].role === 'port').map((s) => String(s.net ?? '').trim()).filter(Boolean),
    );
    portNamesBySheet.set(sheet.id, ports);
  }

  for (const pins of Object.values(merged)) pins.sort((a, b) => naturalCompare(a.split('.')[0], b.split('.')[0]) || naturalCompare(a, b));

  const allPortNames = new Set<string>();
  for (const set of portNamesBySheet.values()) for (const n of set) allPortNames.add(n);
  for (const name of allPortNames) {
    const sheetsWith = project.sheets.filter((sh) => portNamesBySheet.get(sh.id)?.has(name));
    if (sheetsWith.length === 1 && project.sheets.length > 1) {
      warnings.push({
        type: 'orphan-port',
        name,
        sheet: sheetsWith[0].name,
      } as never);
    }
  }

  return { nets: merged, warnings };
}
