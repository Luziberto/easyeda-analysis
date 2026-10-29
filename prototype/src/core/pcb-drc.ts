import type { PcbBoard, PcbFootprint, PcbTrack } from './pcb-types.js';
import { FOOTPRINTS } from './pcb-library.js';
import { pourKeepoutBoxes, pointInPolygon } from './pcb-copper.js';

export interface DrcIssue {
  code: 'clearance' | 'orphan-pad' | 'track-width' | 'outside-outline';
  message: string;
  ref?: string;
  x?: number;
  y?: number;
}

export interface DrcOptions {
  minClearance?: number;
  minTrackWidth?: number;
}

type Pt = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

function distPointSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const q = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(p.x - q.x, p.y - q.y);
}

function distSegSeg(a1: Pt, a2: Pt, b1: Pt, b2: Pt): number {
  const d1 = distPointSeg(a1, b1, b2);
  const d2 = distPointSeg(a2, b1, b2);
  const d3 = distPointSeg(b1, a1, a2);
  const d4 = distPointSeg(b2, a1, a2);
  return Math.min(d1, d2, d3, d4);
}

function rotateLocal(x: number, y: number, rot: number): Pt {
  const rad = (rot * Math.PI) / 180;
  return {
    x: x * Math.cos(rad) - y * Math.sin(rad),
    y: x * Math.sin(rad) + y * Math.cos(rad),
  };
}

function padWorldBox(fp: PcbFootprint, pad: { x: number; y: number; w: number; h: number }): Box {
  const corners = [
    { x: pad.x - pad.w / 2, y: pad.y - pad.h / 2 },
    { x: pad.x + pad.w / 2, y: pad.y - pad.h / 2 },
    { x: pad.x + pad.w / 2, y: pad.y + pad.h / 2 },
    { x: pad.x - pad.w / 2, y: pad.y + pad.h / 2 },
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    const w = rotateLocal(c.x, c.y, fp.rot);
    const wx = fp.x + w.x;
    const wy = fp.y + w.y;
    minX = Math.min(minX, wx);
    minY = Math.min(minY, wy);
    maxX = Math.max(maxX, wx);
    maxY = Math.max(maxY, wy);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function boxGap(a: Box, b: Box): number {
  const gx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const gy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  if (gx === 0 && gy === 0) return 0;
  if (gx === 0) return gy;
  if (gy === 0) return gx;
  return Math.hypot(gx, gy);
}

function footprintBBox(fp: PcbFootprint): Box {
  const d = FOOTPRINTS[fp.kind];
  const sw = fp.rot % 180 === 0;
  const w = sw ? d.w : d.h;
  const h = sw ? d.h : d.w;
  return { x: fp.x - w / 2, y: fp.y - h / 2, w, h };
}

function segIntersectsBox(a: Pt, b: Pt, box: Box): boolean {
  const inBox = (p: Pt) =>
    p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
  if (inBox(a) || inBox(b)) return true;
  const edges: [Pt, Pt][] = [
    [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }],
    [{ x: box.x + box.w, y: box.y }, { x: box.x + box.w, y: box.y + box.h }],
    [{ x: box.x + box.w, y: box.y + box.h }, { x: box.x, y: box.y + box.h }],
    [{ x: box.x, y: box.y + box.h }, { x: box.x, y: box.y }],
  ];
  for (const [e1, e2] of edges) {
    if (segmentsCross(a, b, e1, e2)) return true;
  }
  return false;
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const cross = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const o1 = cross(a, b, c);
  const o2 = cross(a, b, d);
  const o3 = cross(c, d, a);
  const o4 = cross(c, d, b);
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) return false;
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function distSegBox(a: Pt, b: Pt, box: Box): number {
  if (segIntersectsBox(a, b, box)) return 0;
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
  let best = Infinity;
  for (const c of corners) best = Math.min(best, distPointSeg(c, a, b));
  const edges: [Pt, Pt][] = [
    [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }],
    [{ x: box.x + box.w, y: box.y }, { x: box.x + box.w, y: box.y + box.h }],
    [{ x: box.x + box.w, y: box.y + box.h }, { x: box.x, y: box.y + box.h }],
    [{ x: box.x, y: box.y + box.h }, { x: box.x, y: box.y }],
  ];
  for (const [e1, e2] of edges) best = Math.min(best, distSegSeg(a, b, e1, e2));
  return best;
}

function outlineBounds(board: PcbBoard): Box {
  const xs = board.outline.map((p) => p.x);
  const ys = board.outline.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function trackSegments(t: PcbTrack): [Pt, Pt][] {
  const segs: [Pt, Pt][] = [];
  for (let i = 1; i < t.points.length; i++) segs.push([t.points[i - 1], t.points[i]]);
  return segs;
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

interface PadRef {
  fp: PcbFootprint;
  num: string;
  net: string;
  box: Box;
}

function collectPads(board: PcbBoard): PadRef[] {
  const out: PadRef[] = [];
  for (const fp of board.footprints) {
    const def = FOOTPRINTS[fp.kind];
    for (const p of def.pads) {
      const net = fp.padNets[p.num] ?? '';
      out.push({ fp, num: p.num, net, box: padWorldBox(fp, p) });
    }
  }
  return out;
}

/** DRC: pads órfãos, clearance pad/trilha/via, largura mínima, contorno. */
export function runPcbDrc(board: PcbBoard, opts: DrcOptions = {}): DrcIssue[] {
  const minClearance = opts.minClearance ?? 2;
  const minTrackWidth = opts.minTrackWidth ?? 1;
  const issues: DrcIssue[] = [];
  const pads = collectPads(board);
  const outline = outlineBounds(board);
  const margin = minClearance;

  for (const fp of board.footprints) {
    const def = FOOTPRINTS[fp.kind];
    for (const p of def.pads) {
      const net = fp.padNets[p.num] ?? '';
      if (!net) issues.push({ code: 'orphan-pad', ref: fp.ref, message: `${fp.ref}.${p.num} sem rede atribuída` });
    }
  }

  for (let i = 0; i < pads.length; i++) {
    for (let j = i + 1; j < pads.length; j++) {
      const a = pads[i];
      const b = pads[j];
      if (a.fp.id === b.fp.id) continue;
      if (a.net && a.net === b.net) continue;
      const gap = boxGap(a.box, b.box);
      if (gap < minClearance) {
        const cx = (a.box.x + a.box.w / 2 + b.box.x + b.box.w / 2) / 2;
        const cy = (a.box.y + a.box.h / 2 + b.box.y + b.box.h / 2) / 2;
        issues.push({
          code: 'clearance',
          message: `Clearance ${gap.toFixed(1)} < ${minClearance} entre ${a.fp.ref}.${a.num} e ${b.fp.ref}.${b.num}`,
          x: cx,
          y: cy,
        });
      }
    }
  }

  for (let i = 0; i < board.footprints.length; i++) {
    for (let j = i + 1; j < board.footprints.length; j++) {
      const a = footprintBBox(board.footprints[i]);
      const b = footprintBBox(board.footprints[j]);
      const gap = boxGap(a, b);
      if (gap < minClearance) {
        issues.push({
          code: 'clearance',
          message: `Corpo ${board.footprints[i].ref} ↔ ${board.footprints[j].ref}: gap ${gap.toFixed(0)} < ${minClearance}`,
        });
      }
    }
  }

  for (const t of board.tracks) {
    if (t.width < minTrackWidth) {
      issues.push({ code: 'track-width', message: `Trilha ${t.id} largura ${t.width} < ${minTrackWidth}` });
    }
    const hw = t.width / 2;
    for (const [p1, p2] of trackSegments(t)) {
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      if (
        cx < outline.x + margin + hw ||
        cy < outline.y + margin + hw ||
        cx > outline.x + outline.w - margin - hw ||
        cy > outline.y + outline.h - margin - hw
      ) {
        issues.push({
          code: 'outside-outline',
          message: `Trilha ${t.id} (${t.net || '?'}) viola margem do contorno`,
          x: cx,
          y: cy,
        });
      }

      for (const pad of pads) {
        if (t.net && pad.net && t.net === pad.net) continue;
        const d = distSegBox(p1, p2, pad.box);
        const copper = d - hw;
        if (copper < minClearance) {
          issues.push({
            code: 'clearance',
            message: `Trilha ${t.id} ↔ ${pad.fp.ref}.${pad.num}: ${copper.toFixed(1)} < ${minClearance}`,
            x: mid(p1, p2).x,
            y: mid(p1, p2).y,
          });
        }
      }
    }
  }

  for (let i = 0; i < board.tracks.length; i++) {
    for (let j = i + 1; j < board.tracks.length; j++) {
      const ta = board.tracks[i];
      const tb = board.tracks[j];
      if (ta.layer !== tb.layer) continue;
      if (ta.net && tb.net && ta.net === tb.net) continue;
      const ha = ta.width / 2;
      const hb = tb.width / 2;
      for (const [a1, a2] of trackSegments(ta)) {
        for (const [b1, b2] of trackSegments(tb)) {
          const d = distSegSeg(a1, a2, b1, b2) - ha - hb;
          if (d < minClearance) {
            issues.push({
              code: 'clearance',
              message: `Trilhas ${ta.id} ↔ ${tb.id}: ${d.toFixed(1)} < ${minClearance}`,
              x: mid(a1, a2).x,
              y: mid(a1, a2).y,
            });
          }
        }
      }
    }
  }

  for (const v of board.vias ?? []) {
    const r = v.diameter / 2;
    for (const t of board.tracks) {
      if (v.net && t.net && v.net === t.net) continue;
      for (const [p1, p2] of trackSegments(t)) {
        const d = distPointSeg({ x: v.x, y: v.y }, p1, p2) - r - t.width / 2;
        if (d < minClearance) {
          issues.push({
            code: 'clearance',
            message: `Via ${v.id} ↔ trilha ${t.id}: ${d.toFixed(1)} < ${minClearance}`,
            x: v.x,
            y: v.y,
          });
        }
      }
    }
    for (const pad of pads) {
      if (v.net && pad.net && v.net === pad.net) continue;
      const cx = pad.box.x + pad.box.w / 2;
      const cy = pad.box.y + pad.box.h / 2;
      const d = Math.hypot(v.x - cx, v.y - cy) - r - Math.max(pad.box.w, pad.box.h) / 2;
      if (d < minClearance) {
        issues.push({
          code: 'clearance',
          message: `Via ${v.id} ↔ ${pad.fp.ref}.${pad.num}: ${d.toFixed(1)} < ${minClearance}`,
          x: v.x,
          y: v.y,
        });
      }
    }
  }

  for (const pour of board.pours ?? []) {
    for (const t of board.tracks) {
      if (t.layer !== pour.layer) continue;
      if (t.net === pour.net) continue;
      for (const [p1, p2] of trackSegments(t)) {
        const m = mid(p1, p2);
        if (pointInPolygon(m, pour.points)) {
          issues.push({
            code: 'clearance',
            message: `Pour ${pour.net}: trilha ${t.id} (${t.net || '?'}) dentro da área`,
            x: m.x,
            y: m.y,
          });
        }
      }
    }
    for (const box of pourKeepoutBoxes(board, pour)) {
      for (const pt of pour.points) {
        if (pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h) {
          issues.push({
            code: 'clearance',
            message: `Pour ${pour.net}: polígono invade keepout (clearance ${pour.clearance})`,
            x: pt.x,
            y: pt.y,
          });
          break;
        }
      }
    }
  }

  return issues;
}
