import type { PcbBoard, PcbFootprint } from './pcb-types.js';
import { FOOTPRINTS } from './pcb-library.js';

function footprintBBox(fp: PcbFootprint) {
  const d = FOOTPRINTS[fp.kind];
  const sw = fp.rot % 180 === 0;
  const w = sw ? d.w : d.h;
  const h = sw ? d.h : d.w;
  return { x: fp.x - w / 2, y: fp.y - h / 2, w, h };
}

const U = 0.1; // unidade interna → mm

/** Formato 4.4 sem zeros à esquerda (mm). */
function fmt(n: number) {
  const v = n * U;
  const s = v.toFixed(4).replace('.', '');
  return s.replace(/^0+/, '') || '0';
}

function xy(x: number, y: number) {
  return `X${fmt(x)}Y${fmt(y)}`;
}

type BBox = { x: number; y: number; w: number; h: number };

function expandBox(b: BBox, m: number): BBox {
  return { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m };
}

function segIntersectsRect(a: { x: number; y: number }, b: { x: number; y: number }, r: BBox): boolean {
  if (a.x === b.x && a.y === b.y) return a.x >= r.x && a.x <= r.x + r.w && a.y >= r.y && a.y <= r.y + r.h;
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = a.x + t * (b.x - a.x);
    const py = a.y + t * (b.y - a.y);
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return true;
  }
  return false;
}

function pathHitsObstacles(points: { x: number; y: number }[], obs: BBox[]): boolean {
  for (let i = 1; i < points.length; i++) {
    for (const r of obs) if (segIntersectsRect(points[i - 1], points[i], r)) return true;
  }
  return false;
}

function ortho(a: { x: number; y: number }, b: { x: number; y: number }) {
  if (a.x === b.x || a.y === b.y) return [a, b];
  return [a, { x: b.x, y: a.y }, b];
}

function trackSegmentBox(p1: { x: number; y: number }, p2: { x: number; y: number }, hw: number): BBox {
  return {
    x: Math.min(p1.x, p2.x) - hw,
    y: Math.min(p1.y, p2.y) - hw,
    w: Math.abs(p2.x - p1.x) + 2 * hw,
    h: Math.abs(p2.y - p1.y) + 2 * hw,
  };
}

function collectObstacles(board: PcbBoard, clearance: number, skipNet = ''): BBox[] {
  const obs = board.footprints.map((fp) => expandBox(footprintBBox(fp), clearance));
  for (const t of board.tracks) {
    if (t.net && t.net === skipNet) continue;
    for (let i = 1; i < t.points.length; i++) {
      obs.push(trackSegmentBox(t.points[i - 1], t.points[i], t.width / 2 + clearance));
    }
  }
  for (const v of board.vias ?? []) {
    if (v.net && v.net === skipNet) continue;
    const r = v.diameter / 2 + clearance;
    obs.push({ x: v.x - r, y: v.y - r, w: 2 * r, h: 2 * r });
  }
  return obs;
}

/** Rota ortogonal evitando footprints, trilhas e vias (walkaround). */
export function routeWalkaround(
  from: { x: number; y: number },
  to: { x: number; y: number },
  board: PcbBoard,
  clearance = 4,
  net = '',
): { x: number; y: number }[] {
  const obs = collectObstacles(board, clearance, net);
  const candidates: { x: number; y: number }[][] = [
    ortho(from, to),
    [from, { x: from.x, y: to.y }, to],
    [from, { x: to.x, y: from.y }, to],
  ];
  for (const r of obs) {
    candidates.push([from, { x: r.x - clearance, y: from.y }, { x: r.x - clearance, y: to.y }, to]);
    candidates.push([from, { x: r.x + r.w + clearance, y: from.y }, { x: r.x + r.w + clearance, y: to.y }, to]);
    candidates.push([from, { x: from.x, y: r.y - clearance }, { x: to.x, y: r.y - clearance }, to]);
    candidates.push([from, { x: from.x, y: r.y + r.h + clearance }, { x: to.x, y: r.y + r.h + clearance }, to]);
  }
  for (const path of candidates) {
    const norm: { x: number; y: number }[] = [];
    for (const p of path) {
      const q = { x: Math.round(p.x), y: Math.round(p.y) };
      const l = norm[norm.length - 1];
      if (!l || l.x !== q.x || l.y !== q.y) norm.push(q);
    }
    if (norm.length >= 2 && !pathHitsObstacles(norm, obs)) return norm;
  }
  return ortho(from, to);
}
