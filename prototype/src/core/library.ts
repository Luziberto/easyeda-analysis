// Biblioteca de símbolos ORIGINAL do protótipo (geometria desenhada para este projeto).
// role: undefined = componente (entra no netlist como REF.pino); 'power' | 'port' | 'label' = nó com nome.
import type { SymbolKind } from './types.js';

export type SymbolRole = 'power' | 'port' | 'label';

export interface SymbolDef {
  prefix: string;
  w: number;
  h: number;
  pins: { num: string; x: number; y: number }[];
  paths: string[];
  role?: SymbolRole;
  defaultNet?: string;
}

export const SYMBOLS: Record<SymbolKind, SymbolDef> = {
  resistor: { prefix: 'R', w: 60, h: 20, pins: [{ num: '1', x: -30, y: 0 }, { num: '2', x: 30, y: 0 }],
    paths: ['M -30 0 H -20', 'M 20 0 H 30', 'M -20 -6 H 20 V 6 H -20 Z'] },
  capacitor: { prefix: 'C', w: 40, h: 30, pins: [{ num: '1', x: -20, y: 0 }, { num: '2', x: 20, y: 0 }],
    paths: ['M -20 0 H -4', 'M 4 0 H 20', 'M -4 -10 V 10', 'M 4 -10 V 10'] },
  led: { prefix: 'D', w: 50, h: 24, pins: [{ num: 'A', x: -25, y: 0 }, { num: 'K', x: 25, y: 0 }],
    paths: ['M -25 0 H -8', 'M 8 0 H 25', 'M -8 -8 L 8 0 L -8 8 Z', 'M 8 -8 V 8', 'M 2 -10 l 6 -6', 'M 6 -8 l 6 -6'] },
  ground: { prefix: 'GND', role: 'power', defaultNet: 'GND', w: 20, h: 20, pins: [{ num: '1', x: 0, y: -10 }], paths: ['M 0 -10 V 0', 'M -10 0 H 10', 'M -6 4 H 6', 'M -2 8 H 2'] },
  vcc: { prefix: 'PWR', role: 'power', defaultNet: 'VCC', w: 20, h: 20, pins: [{ num: '1', x: 0, y: 10 }], paths: ['M 0 10 V 0', 'M -8 0 H 8'] },
  netlabel: { prefix: 'NL', role: 'label', defaultNet: 'NET', w: 30, h: 12, pins: [{ num: '1', x: 0, y: 0 }], paths: ['M 0 0 H 4', 'M 0 0 v -2'] },
  port: { prefix: 'P', role: 'port', defaultNet: 'PORT', w: 30, h: 14, pins: [{ num: '1', x: -10, y: 0 }], paths: ['M -10 0 L -4 -6 H 14 V 6 H -4 Z'] },
};
export const ROLE_PRIORITY = { power: 3, port: 2, label: 1 };
