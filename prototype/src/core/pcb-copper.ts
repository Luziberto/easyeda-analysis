import type { PcbBoard, PcbFootprint, PcbPour } from './pcb-types.js';
import { FOOTPRINTS } from './pcb-library.js';

export type Box = { x: number; y: number; w: number; h: number };

function padWorld(fp: PcbFootprint, padNum: string) {
  const def = FOOTPRINTS[fp.kind];
  const p = def.pads.find((q) => q.num === padNum);
  if (!p) return null;
  const rad = (fp.rot * Math.PI) / 180;
  const lx = p.x * Math.cos(rad) - p.y * Math.sin(rad);
  const ly = p.x * Math.sin(rad) + p.y * Math.cos(rad);
  return { x: Math.round(fp.x + lx), y: Math.round(fp.y + ly), w: p.w, h: p.h };
}

function trackSegmentBox(p1: { x: number; y: number }, p2: { x: number; y: number }, width: number, margin: number): Box {
  const m = width / 2 + margin;
  return {
    x: Math.min(p1.x, p2.x) - m,
    y: Math.min(p1.y, p2.y) - m,
    w: Math.abs(p2.x - p1.x) + 2 * m,
    h: Math.abs(p2.y - p1.y) + 2 * m,
  };
}

/** Zonas a manter livres de pour (clearance em torno de cobre de outras redes). */
export function pourKeepoutBoxes(board: PcbBoard, pour: PcbPour): Box[] {
  const boxes: Box[] = [];
  const c = pour.clearance;

  for (const fp of board.footprints) {
    for (const p of FOOTPRINTS[fp.kind].pads) {
      const net = fp.padNets[p.num] ?? '';
      if (net === pour.net) continue;
      const w = padWorld(fp, p.num);
      if (!w) continue;
      boxes.push({ x: w.x - w.w / 2 - c, y: w.y - w.h / 2 - c, w: w.w + 2 * c, h: w.h + 2 * c });
    }
  }

  for (const t of board.tracks) {
    if (t.layer !== pour.layer) continue;
    if (t.net === pour.net) continue;
    for (let i = 1; i < t.points.length; i++) {
      boxes.push(trackSegmentBox(t.points[i - 1], t.points[i], t.width, c));
    }
  }

  for (const v of board.vias ?? []) {
    if (v.net === pour.net) continue;
    const r = v.diameter / 2 + c;
    boxes.push({ x: v.x - r, y: v.y - r, w: 2 * r, h: 2 * r });
  }
  return boxes;
}

export function pointInPolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
