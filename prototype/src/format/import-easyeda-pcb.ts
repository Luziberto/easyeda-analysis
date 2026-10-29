import { parseDocument, parsePoints } from './easyeda-std.js';
import type { Project } from '../core/types.js';
import { ensurePcb } from '../core/pcb-model.js';
import type { FootprintKind, PcbFootprint } from '../core/pcb-types.js';

function mapPackage(attrs: string): FootprintKind | null {
  const a = String(attrs ?? '').toLowerCase();
  if (/r0603|r0805/.test(a)) return 'r0603';
  if (/c0603|c0805/.test(a)) return 'c0603';
  if (/led/.test(a)) return 'led0805';
  return 'r0603';
}

/** Import parcial EasyEDA docType 3 → project.pcb (tracks, vias, footprints LIB). */
export function importEasyedaPcb(input: string | object, project: Project): { skipped: string[] } {
  const parsed = typeof input === 'string' ? parseDocument(input) : parseDocument(input);
  const board = ensurePcb(project);
  board.footprints = [];
  board.tracks = [];
  board.vias = [];
  board.pours = [];
  const skipped: string[] = [];

  for (const sh of parsed.shapes as { type: string; fields?: Record<string, string>; children?: unknown[] }[]) {
    if (sh.type === 'FOOTPRINT' || (sh.type === 'LIB' && sh.children)) {
      const children = sh.children ?? [];
      const ref = sh.fields?.attrs?.match(/`([^`]+)`/)?.[1] ?? sh.fields?.id ?? 'FP';
      const kind = mapPackage(sh.fields?.attrs ?? '');
      const x = Math.round(Number(sh.fields?.x) / 10) || 0;
      const y = Math.round(Number(sh.fields?.y) / 10) || 0;
      const fp: PcbFootprint = {
        id: `fp${board.nextId++}`,
        ref: String(ref).slice(0, 20),
        kind,
        x,
        y,
        rot: Number(sh.fields?.rotation) || 0,
        padNets: {},
      };
      for (const c of children as { type: string; fields?: Record<string, string> }[]) {
        if (c.type === 'PAD') {
          const num = c.fields?.number ?? '?';
          fp.padNets[num] = c.fields?.net ?? '';
        }
      }
      board.footprints.push(fp);
    } else if (sh.type === 'TRACK') {
      const pts = parsePoints(sh.fields?.points ?? '').map((p) => ({ x: Math.round(p.x / 10), y: Math.round(p.y / 10) }));
      if (pts.length < 2) continue;
      const layerId = sh.fields?.layerId ?? '1';
      if (layerId === '10') {
        board.outline = pts;
        continue;
      }
      board.tracks.push({
        id: `t${board.nextId++}`,
        layer: layerId === '2' ? 'bottom' : 'top',
        width: Math.max(1, Math.round(Number(sh.fields?.strokeWidth) || 1)),
        net: sh.fields?.net ?? '',
        points: pts,
      });
    } else if (sh.type === 'VIA') {
      board.vias!.push({
        id: `v${board.nextId++}`,
        x: Math.round(Number(sh.fields?.x) / 10),
        y: Math.round(Number(sh.fields?.y) / 10),
        net: sh.fields?.net ?? '',
        diameter: Math.max(2, Math.round(Number(sh.fields?.diameter) || 2)),
      });
    } else if (!['HOLE', 'CIRCLE', 'RECT'].includes(sh.type)) {
      skipped.push(sh.type);
    }
  }
  return { skipped };
}
