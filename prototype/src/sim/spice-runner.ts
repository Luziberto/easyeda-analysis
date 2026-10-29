/** Executa .op via ngspice (WASM) através do backend spice-ts + eecircuit-engine. */

export type SpiceOpResult = {
  backend: 'ngspice-wasm';
  voltages: Record<string, number>;
  currents: Record<string, number>;
  warnings: string[];
};

export async function runSpiceOperatingPoint(deck: string): Promise<SpiceOpResult> {
  const { simulate } = await import('@spice-ts/core');
  const result = await simulate(deck, { simulator: 'ngspice-wasm' });
  const voltages: Record<string, number> = {};
  const currents: Record<string, number> = {};
  if (result.dc) {
    for (const [node, v] of result.dc.voltages.entries()) voltages[node] = v;
    for (const [name, i] of result.dc.currents.entries()) currents[name] = i;
  }
  return {
    backend: 'ngspice-wasm',
    voltages,
    currents,
    warnings: (result.warnings ?? []).map(String),
  };
}

export function formatSpiceOpSummary(res: SpiceOpResult): string {
  const lines = [`Backend: ${res.backend}`];
  const nodes = Object.keys(res.voltages).sort();
  if (nodes.length) {
    lines.push('Tensões (V):');
    for (const n of nodes) lines.push(`  ${n}: ${res.voltages[n].toPrecision(4)}`);
  }
  const cur = Object.keys(res.currents).sort();
  if (cur.length) {
    lines.push('Correntes (A):');
    for (const c of cur) lines.push(`  ${c}: ${res.currents[c].toExponential(3)}`);
  }
  if (res.warnings.length) lines.push('Avisos: ' + res.warnings.join('; '));
  return lines.join('\n');
}
