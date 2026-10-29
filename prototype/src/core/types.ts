export type SymbolKind =
  | 'resistor'
  | 'capacitor'
  | 'led'
  | 'ground'
  | 'vcc'
  | 'netlabel'
  | 'port';

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
  mirror?: boolean;
}

export interface Wire {
  id: string;
  points: Point[];
}

export interface Document {
  format: string;
  version: number;
  nextId: number;
  symbols: SchematicSymbol[];
  wires: Wire[];
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface Command {
  name: string;
  apply(doc: Document): unknown;
  revert(doc: Document): void;
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
}
