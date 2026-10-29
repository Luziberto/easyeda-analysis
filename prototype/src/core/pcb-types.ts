export type FootprintKind = 'r0603' | 'c0603' | 'led0805' | 'soic8';

export interface PcbPadDef {
  num: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PcbFootprintDef {
  kind: FootprintKind;
  w: number;
  h: number;
  pads: PcbPadDef[];
}

export interface PcbFootprint {
  id: string;
  ref: string;
  kind: FootprintKind;
  schKind?: string;
  x: number;
  y: number;
  rot: number;
  padNets: Record<string, string>;
}

export interface PcbTrack {
  id: string;
  layer: 'top' | 'bottom';
  width: number;
  net: string;
  points: { x: number; y: number }[];
}

export interface PcbVia {
  id: string;
  x: number;
  y: number;
  net: string;
  diameter: number;
}

export interface PcbPour {
  id: string;
  layer: 'top' | 'bottom';
  net: string;
  points: { x: number; y: number }[];
  clearance: number;
}

export interface PcbBoard {
  format: 'proto-eda-pcb';
  version: 1;
  nextId: number;
  footprints: PcbFootprint[];
  tracks: PcbTrack[];
  vias: PcbVia[];
  pours: PcbPour[];
  outline: { x: number; y: number }[];
}
