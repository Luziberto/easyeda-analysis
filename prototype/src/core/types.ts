export type SymbolKind =
  | 'resistor'
  | 'capacitor'
  | 'led'
  | 'ground'
  | 'vcc'
  | 'netlabel'
  | 'port'
  | 'inverter'
  | 'annotate'
  | 'generic';

export type PinElectric = 'input' | 'output' | 'passive' | 'power' | 'unspecified';

export type WireKind = 'wire' | 'bus';

export interface Point {
  x: number;
  y: number;
}

export interface SchematicSymbol {
  id: string;
  kind: SymbolKind;
  x: number;
  y: number;
  rot: number;
  ref: string;
  net?: string;
  /** Valor/nota (ex.: 10k, texto de anotação). */
  value?: string;
  mirror?: boolean;
  /** Definição gráfica inline (símbolo customizado colocado). */
  inlineDef?: { w: number; h: number; pins: { num: string; x: number; y: number; electric?: PinElectric }[]; paths: string[] };
}

export interface Wire {
  id: string;
  points: Point[];
  kind?: WireKind;
}

/** Uma folha de esquemático (conteúdo editável). */
export interface Sheet {
  id: string;
  name: string;
  nextId: number;
  symbols: SchematicSymbol[];
  wires: Wire[];
}

import type { PcbBoard } from './pcb-types.js';

/** Projeto v3: multi-folha; opcionalmente PCB integrado (MVP3). */
export interface Project {
  format: string;
  version: number;
  activeSheetId: string;
  sheets: Sheet[];
  pcb?: PcbBoard;
  /** Símbolos customizados do projeto (editor mínimo). */
  customSymbols?: Record<string, CustomSymbolDef>;
}

export interface CustomSymbolDef {
  name: string;
  prefix: string;
  w: number;
  h: number;
  pins: { num: string; x: number; y: number; electric?: PinElectric }[];
  paths: string[];
}

/** @deprecated alias — folha única equivalente a Project v2 */
export type Document = Sheet;

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface Command {
  name: string;
  apply(project: Project): unknown;
  revert(project: Project): void;
}

export interface PinHit {
  sym: string;
  pin: string;
}

export interface AddSymbolOpts {
  net?: string;
  alt?: boolean;
  exact?: boolean;
  ref?: string;
  rot?: number;
  value?: string;
}

export interface AddWireOpts {
  kind?: WireKind;
}
