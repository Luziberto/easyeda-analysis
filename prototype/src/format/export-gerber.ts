import type { PcbBoard } from '../core/pcb-types.js';
import { FOOTPRINTS } from '../core/pcb-library.js';
import { padWorld } from '../core/pcb-model.js';

const U = 0.1;

function fmt(n: number) {
  const s = (n * U).toFixed(4).replace('.', '');
  return s.replace(/^0+/, '') || '0';
}

function xy(x: number, y: number) {
  return `X${fmt(x)}Y${fmt(y)}`;
}

function header(fileName: string) {
  return [
    `G04 ${fileName} — Proto EDA*`,
    '%FSLAX44Y44*%',
    '%MOMM*%',
    '%LPD*%',
    'G01*',
    '%ADD10C,0.1500*%',
    '%ADD11C,0.6000*%',
    '%ADD12C,0.8000*%',
    'D10*',
  ];
}

function drawTrack(lines: string[], points: { x: number; y: number }[], width: number) {
  const d = width >= 4 ? 'D11*' : 'D10*';
  lines.push(d);
  for (let i = 0; i < points.length; i++) {
    lines.push(`${i === 0 ? 'D02' : 'D01'}*${xy(points[i].x, points[i].y)}*`);
  }
}

function flashPads(lines: string[], board: PcbBoard) {
  lines.push('D12*');
  for (const fp of board.footprints) {
    for (const p of FOOTPRINTS[fp.kind].pads) {
      const w = padWorld(fp, p.num);
      if (w) lines.push(`D03*${xy(w.x, w.y)}*`);
    }
  }
}

function flashVias(lines: string[], board: PcbBoard) {
  for (const v of board.vias ?? []) lines.push(`D03*${xy(v.x, v.y)}*`);
}

function copperLayer(board: PcbBoard, layer: 'top' | 'bottom', label: string) {
  const lines = header(label);
  for (const pour of board.pours ?? []) {
    if (pour.layer !== layer) continue;
    lines.push('G36*');
    pour.points.forEach((p, i) => lines.push(`${i === 0 ? 'D02' : 'D01'}*${xy(p.x, p.y)}*`));
    lines.push('G37*');
  }
  for (const t of board.tracks) {
    if (t.layer !== layer) continue;
    drawTrack(lines, t.points, t.width);
  }
  flashPads(lines, board);
  flashVias(lines, board);
  lines.push('M02*');
  return lines.join('\n') + '\n';
}

export function exportGerberTop(board: PcbBoard) {
  return copperLayer(board, 'top', 'GTL Top Copper');
}

export function exportGerberBottom(board: PcbBoard) {
  return copperLayer(board, 'bottom', 'GBL Bottom Copper');
}

export function exportGerberOutline(board: PcbBoard) {
  const lines = header('GKO Board Outline');
  drawTrack(lines, board.outline, 2);
  if (board.outline.length) lines.push(`D01*${xy(board.outline[0].x, board.outline[0].y)}*`);
  lines.push('M02*');
  return lines.join('\n') + '\n';
}

/** Silkscreen simplificado: contorno do corpo de cada footprint. */
export function exportGerberSilk(board: PcbBoard) {
  const lines = header('GTO Top Silk');
  lines.push('D10*');
  for (const fp of board.footprints) {
    const d = FOOTPRINTS[fp.kind];
    const sw = fp.rot % 180 === 0;
    const w = sw ? d.w : d.h;
    const h = sw ? d.h : d.w;
    const x0 = fp.x - w / 2;
    const y0 = fp.y - h / 2;
    const rect = [
      { x: x0, y: y0 },
      { x: x0 + w, y: y0 },
      { x: x0 + w, y: y0 + h },
      { x: x0, y: y0 + h },
      { x: x0, y: y0 },
    ];
    drawTrack(lines, rect, 1);
    lines.push(`G04 Ref ${fp.ref}*`);
  }
  lines.push('M02*');
  return lines.join('\n') + '\n';
}

/** Excellon em mm (M71), furos de vias. */
export function exportExcellonDrill(board: PcbBoard) {
  const lines = [
    'M48',
    'METRIC,TZ',
    'T1C0.30',
    '%',
    'T1',
    'M71',
  ];
  for (const v of board.vias ?? []) {
    lines.push(`X${(v.x * U).toFixed(3)}Y${(v.y * U).toFixed(3)}`);
  }
  lines.push('M30');
  return lines.join('\n') + '\n';
}

export function exportFabBundle(board: PcbBoard): Record<string, string> {
  return {
    'top.gtl': exportGerberTop(board),
    'bottom.gbl': exportGerberBottom(board),
    'outline.gko': exportGerberOutline(board),
    'drill.drl': exportExcellonDrill(board),
    'silk.gto': exportGerberSilk(board),
  };
}

export function exportPickPlace(board: PcbBoard): string {
  const lines = ['RefDes,Val,Package,PosX(mm),PosY(mm),Rot,Side'];
  for (const fp of board.footprints) {
    lines.push([
      fp.ref,
      fp.schKind ?? fp.kind,
      fp.kind,
      (fp.x * U).toFixed(3),
      (fp.y * U).toFixed(3),
      String(fp.rot),
      'top',
    ].join(','));
  }
  return lines.join('\n') + '\n';
}
