import type { Project } from '../core/types.js';
import { buildProjectNetlist } from '../core/project.js';
import { SYMBOLS } from '../core/library.js';

export interface BomRow {
  ref: string;
  kind: string;
  value: string;
  footprint: string;
  sheet: string;
}

/** BOM de componentes (exclui power/label/port). */
export function exportBom(project: Project): BomRow[] {
  const rows: BomRow[] = [];
  for (const sheet of project.sheets) {
    for (const s of sheet.symbols) {
      if (SYMBOLS[s.kind].role) continue;
      rows.push({
        ref: s.ref,
        kind: s.kind,
        value: s.kind === 'resistor' ? '1k' : s.kind === 'capacitor' ? '100nF' : s.kind === 'led' ? 'LED' : s.kind,
        footprint: s.kind === 'resistor' || s.kind === 'capacitor' ? '0603' : s.kind === 'led' ? '0805' : s.kind === 'inverter' ? 'SOIC-8' : '—',
        sheet: sheet.name,
      });
    }
  }
  rows.sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
  return rows;
}

export function exportBomCsv(project: Project): string {
  const rows = exportBom(project);
  const lines = ['Ref,Type,Value,Footprint,Sheet'];
  for (const r of rows) {
    lines.push([r.ref, r.kind, r.value, r.footprint, r.sheet].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n') + '\n';
}

export function exportBomJson(project: Project): string {
  const pn = buildProjectNetlist(project);
  return JSON.stringify({ components: exportBom(project), netCount: Object.keys(pn.nets).length }, null, 2);
}
