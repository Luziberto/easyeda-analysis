import type { PcbBoard, PcbFootprint } from './pcb-types.js';
import { FOOTPRINTS } from './pcb-library.js';

type Pt = { x: number; y: number };

function padWorld(fp: PcbFootprint, padNum: string): Pt | null {
  const def = FOOTPRINTS[fp.kind];
  const p = def.pads.find((q) => q.num === padNum);
  if (!p) return null;
  const rad = (fp.rot * Math.PI) / 180;
  const lx = p.x * Math.cos(rad) - p.y * Math.sin(rad);
  const ly = p.x * Math.sin(rad) + p.y * Math.cos(rad);
  return { x: Math.round(fp.x + lx), y: Math.round(fp.y + ly) };
}

function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

class Dsu {
  parent = new Map<string, string>();
  find(k: string): string {
    let p = this.parent.get(k) ?? k;
    if (p !== k) {
      p = this.find(p);
      this.parent.set(k, p);
    } else this.parent.set(k, k);
    return p;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

/** Agrupa pads da mesma rede ligados por trilhas/vias (heurística por proximidade). */
export function connectedPadGroups(board: PcbBoard, net: string): { key: string; x: number; y: number }[][] {
  const pads: { key: string; x: number; y: number }[] = [];
  for (const fp of board.footprints) {
    for (const p of FOOTPRINTS[fp.kind].pads) {
      const n = fp.padNets[p.num] ?? '';
      if (n !== net) continue;
      const w = padWorld(fp, p.num);
      if (w) pads.push({ key: `${fp.ref}.${p.num}`, x: w.x, y: w.y });
    }
  }
  if (pads.length < 2) return pads.length ? [pads] : [];

  const dsu = new Dsu();
  for (const p of pads) dsu.find(p.key);

  const linkThreshold = (tWidth: number) => Math.max(4, tWidth / 2 + 3);

  for (const t of board.tracks) {
    if (t.net !== net) continue;
    const near = new Set<string>();
    for (const pt of t.points) {
      for (const p of pads) {
        if (dist(pt, p) <= linkThreshold(t.width)) near.add(p.key);
      }
    }
    const list = [...near];
    for (let i = 1; i < list.length; i++) dsu.union(list[0], list[i]);
  }

  for (const v of board.vias ?? []) {
    if (v.net !== net) continue;
    const r = v.diameter / 2 + 2;
    const near = pads.filter((p) => dist(p, v) <= r).map((p) => p.key);
    for (let i = 1; i < near.length; i++) dsu.union(near[0], near[i]);
    for (const t of board.tracks) {
      if (t.net !== net) continue;
      const onVia = t.points.some((pt) => dist(pt, v) <= r);
      if (!onVia) continue;
      const trackPads = new Set<string>();
      for (const pt of t.points) {
        for (const p of pads) {
          if (dist(pt, p) <= linkThreshold(t.width)) trackPads.add(p.key);
        }
      }
      const tp = [...trackPads];
      for (const k of near) for (const tpk of tp) dsu.union(k, tpk);
    }
  }

  const groups = new Map<string, typeof pads>();
  for (const p of pads) {
    const r = dsu.find(p.key);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(p);
  }
  return [...groups.values()];
}

/** Linhas ratsnest: MST entre grupos desconectados da mesma rede. */
export function computeRatsnestLines(board: PcbBoard): { x1: number; y1: number; x2: number; y2: number; net: string }[] {
  const nets = new Set<string>();
  for (const fp of board.footprints) {
    for (const n of Object.values(fp.padNets)) if (n) nets.add(n);
  }
  for (const t of board.tracks) if (t.net) nets.add(t.net);

  const lines: { x1: number; y1: number; x2: number; y2: number; net: string }[] = [];

  for (const net of nets) {
    let groups = connectedPadGroups(board, net);
    while (groups.length > 1) {
      let best = Infinity;
      let ga = 0;
      let gb = 1;
      let pa = groups[0][0];
      let pb = groups[1][0];
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          for (const a of groups[i]) {
            for (const b of groups[j]) {
              const d = dist(a, b);
              if (d < best) {
                best = d;
                ga = i;
                gb = j;
                pa = a;
                pb = b;
              }
            }
          }
        }
      }
      lines.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, net });
      groups = groups.map((g, idx) => (idx === ga ? [...g, ...groups[gb]] : idx === gb ? [] : g)).filter((g) => g.length > 0);
    }
  }
  return lines;
}
