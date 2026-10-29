import type { FootprintKind, PcbFootprintDef } from './pcb-types.js';
import type { SymbolKind } from './types.js';

export const FOOTPRINTS: Record<FootprintKind, PcbFootprintDef> = {
  r0603: {
    kind: 'r0603', w: 16, h: 8,
    pads: [{ num: '1', x: -8, y: 0, w: 6, h: 6 }, { num: '2', x: 8, y: 0, w: 6, h: 6 }],
  },
  c0603: {
    kind: 'c0603', w: 16, h: 8,
    pads: [{ num: '1', x: -8, y: 0, w: 6, h: 6 }, { num: '2', x: 8, y: 0, w: 6, h: 6 }],
  },
  led0805: {
    kind: 'led0805', w: 20, h: 10,
    pads: [{ num: 'A', x: -10, y: 0, w: 6, h: 6 }, { num: 'K', x: 10, y: 0, w: 6, h: 6 }],
  },
  soic8: {
    kind: 'soic8', w: 40, h: 30,
    pads: [
      { num: '1', x: -15, y: -10, w: 6, h: 4 },
      { num: '2', x: -15, y: 0, w: 6, h: 4 },
      { num: '3', x: -15, y: 10, w: 6, h: 4 },
      { num: '4', x: 0, y: 15, w: 4, h: 6 },
      { num: '5', x: 15, y: 10, w: 6, h: 4 },
      { num: '6', x: 15, y: 0, w: 6, h: 4 },
      { num: '7', x: 15, y: -10, w: 6, h: 4 },
      { num: '8', x: 0, y: -15, w: 4, h: 6 },
    ],
  },
};

const SCH_TO_FP: Partial<Record<SymbolKind, FootprintKind>> = {
  resistor: 'r0603',
  capacitor: 'c0603',
  led: 'led0805',
  inverter: 'soic8',
};

export function footprintForSymbol(kind: SymbolKind): FootprintKind | null {
  return SCH_TO_FP[kind] ?? null;
}

export function padNumbers(kind: FootprintKind): string[] {
  return FOOTPRINTS[kind].pads.map((p) => p.num);
}

/** Modelo simplificado para diffNetlist: REF → pads → net */
export function pcbNetModel(board: import('./pcb-types.js').PcbBoard): Record<string, { pads: Record<string, string> }> {
  const out: Record<string, { pads: Record<string, string> }> = {};
  for (const fp of board.footprints) {
    const def = FOOTPRINTS[fp.kind];
    const pads: Record<string, string> = {};
    for (const p of def.pads) pads[p.num] = fp.padNets[p.num] ?? '';
    out[fp.ref] = { pads };
  }
  return out;
}
