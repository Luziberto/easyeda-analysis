import type { Project } from './types.js';
import type { PcbBoard, PcbFootprint, PcbTrack } from './pcb-types.js';
import { buildProjectNetlist } from './project.js';
import { SYMBOLS } from './library.js';
import { diffNetlist, applyNetlistDiff } from './connectivity.js';
import { footprintForSymbol, padNumbers, pcbNetModel, FOOTPRINTS } from './pcb-library.js';
import { routeWalkaround } from './pcb-router.js';
import { computeRatsnestLines } from './pcb-connectivity.js';

export const PCB_FORMAT = 'proto-eda-pcb';

export function createPcbBoard(): PcbBoard {
  return {
    format: PCB_FORMAT,
    version: 1,
    nextId: 1,
    footprints: [],
    tracks: [],
    vias: [],
    pours: [],
    outline: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }],
  };
}

export function ensurePcb(project: Project): PcbBoard {
  if (!project.pcb) project.pcb = createPcbBoard();
  return project.pcb;
}

/** Gera/atualiza footprints a partir de todos os símbolos de componente do esquemático. */
export function syncPcbFromSchematic(project: Project): { added: number; updated: number; skipped: string[] } {
  const board = ensurePcb(project);
  const skipped: string[] = [];
  let added = 0;
  let updated = 0;
  const byRef = new Map(board.footprints.map((f) => [f.ref, f]));

  for (const sheet of project.sheets) {
    for (const s of sheet.symbols) {
      if (SYMBOLS[s.kind].role) continue;
      const fk = footprintForSymbol(s.kind);
      if (!fk) { skipped.push(`${s.ref} (${s.kind})`); continue; }
      let fp = byRef.get(s.ref);
      if (!fp) {
        fp = {
          id: `fp${board.nextId++}`,
          ref: s.ref,
          kind: fk,
          schKind: s.kind,
          x: s.x,
          y: s.y,
          rot: s.rot,
          padNets: Object.fromEntries(padNumbers(fk).map((n) => [n, ''])),
        };
        board.footprints.push(fp);
        byRef.set(s.ref, fp);
        added++;
      } else {
        fp.x = s.x;
        fp.y = s.y;
        fp.rot = s.rot;
        fp.kind = fk;
        updated++;
      }
    }
  }

  const schNets = buildProjectNetlist(project).nets;
  const pcbModel = pcbNetModel(board);
  const diff = diffNetlist(schNets, pcbModel);
  if (diff.ok) {
    const applied = applyNetlistDiff(pcbModel, diff);
    for (const fp of board.footprints) {
      const pads = applied[fp.ref]?.pads;
      if (pads) fp.padNets = { ...pads };
    }
  }

  return { added, updated, skipped };
}

export function moveFootprint(board: PcbBoard, id: string, dx: number, dy: number) {
  const fp = board.footprints.find((f) => f.id === id);
  if (!fp) throw new Error('footprint não encontrado');
  fp.x += dx;
  fp.y += dy;
}

export function addRouteTrack(board: PcbBoard, from: { x: number; y: number }, to: { x: number; y: number }, net = '', layer: 'top' | 'bottom' = 'top', width = 2) {
  const points = routeWalkaround(from, to, board, 4, net);
  return addTrack(board, points, net, layer, width);
}

export function addPour(board: PcbBoard, points: { x: number; y: number }[], net: string, layer: 'top' | 'bottom' = 'top', clearance = 2) {
  if (points.length < 3) throw new Error('pour precisa de polígono fechado');
  if (!board.pours) board.pours = [];
  const pour = { id: `p${board.nextId++}`, layer, net, points: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })), clearance };
  board.pours.push(pour);
  return pour.id;
}

/** Pour retangular inset do contorno (ex.: GND). */
export function addOutlinePour(board: PcbBoard, net: string, inset = 8, layer: 'top' | 'bottom' = 'top') {
  const o = board.outline;
  if (o.length < 4) throw new Error('contorno inválido');
  const xs = o.map((p) => p.x);
  const ys = o.map((p) => p.y);
  const x0 = Math.min(...xs) + inset;
  const y0 = Math.min(...ys) + inset;
  const x1 = Math.max(...xs) - inset;
  const y1 = Math.max(...ys) - inset;
  return addPour(board, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], net, layer);
}

export function addTrack(board: PcbBoard, points: { x: number; y: number }[], net = '', layer: 'top' | 'bottom' = 'top', width = 2) {
  if (points.length < 2) throw new Error('trilha precisa de 2 pontos');
  const t: PcbTrack = { id: `t${board.nextId++}`, layer, width, net, points: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) };
  board.tracks.push(t);
  return t.id;
}

export function footprintBBox(fp: PcbFootprint) {
  const d = FOOTPRINTS[fp.kind];
  const sw = fp.rot % 180 === 0;
  const w = sw ? d.w : d.h;
  const h = sw ? d.h : d.w;
  return { x: fp.x - w / 2, y: fp.y - h / 2, w, h };
}

export function addVia(board: PcbBoard, x: number, y: number, net = '', diameter = 4) {
  const v = { id: `v${board.nextId++}`, x: Math.round(x), y: Math.round(y), net, diameter };
  if (!board.vias) board.vias = [];
  board.vias.push(v);
  return v.id;
}

export function padWorld(fp: PcbFootprint, padNum: string) {
  const def = FOOTPRINTS[fp.kind];
  const p = def.pads.find((q) => q.num === padNum);
  if (!p) return null;
  const r = rotatePad(p.x, p.y, fp.rot);
  return { x: fp.x + r.x, y: fp.y + r.y, net: fp.padNets[padNum] ?? '' };
}

function rotatePad(x: number, y: number, rot: number) {
  const rad = (rot * Math.PI) / 180;
  return { x: Math.round(x * Math.cos(rad) - y * Math.sin(rad)), y: Math.round(x * Math.sin(rad) + y * Math.cos(rad)) };
}

/** Linhas ratsnest entre grupos de pads da mesma rede ainda não ligados por trilhas/vias. */
export function computeRatsnest(board: PcbBoard): { x1: number; y1: number; x2: number; y2: number; net: string }[] {
  return computeRatsnestLines(board);
}

export type { DrcIssue } from './pcb-drc.js';
export { runPcbDrc } from './pcb-drc.js';
