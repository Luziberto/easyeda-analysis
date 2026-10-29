import type { Project } from '../core/types.js';
import { buildProjectNetlist } from '../core/project.js';

/** Netlist `.net` legado simplificado: uma linha por (ref, pino, rede). */
export function exportKicadNet(project: Project): string {
  const { nets } = buildProjectNetlist(project);
  const lines = ['* Proto EDA netlist', '* ref pin net'];
  for (const [net, pins] of Object.entries(nets).sort(([a], [b]) => a.localeCompare(b))) {
    for (const p of pins) {
      const [ref, pin] = p.split('.');
      lines.push(`${ref} ${pin} ${net}`);
    }
  }
  return lines.join('\n') + '\n';
}
