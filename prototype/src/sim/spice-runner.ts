/** Simulação SPICE no browser: .op (ngspice WASM) + resumo .tran (spice-ts). */

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
  const lines = [`Backend OP: ${res.backend}`];
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

/** OP ngspice + min/max transientes (spice-ts) quando possível. */
export async function runSpiceSimulationReport(deck: string): Promise<string> {
  const op = await runSpiceOperatingPoint(deck);
  const lines = [formatSpiceOpSummary(op)];
  const tranDeck = deck
    .replace(/^\* ngspice:.*\n/m, '')
    .replace(/\.op\s*\n/i, '.tran 0 1m 10u\n');
  if (tranDeck === deck) {
    lines.push('', '(Sem .op no deck — transiente ignorado.)');
    return lines.join('\n');
  }
  try {
    const { simulate } = await import('@spice-ts/core');
    const tr = await simulate(tranDeck, { simulator: 'spice-ts' });
    if (tr.transient) {
      lines.push('', 'Transiente (spice-ts, 0–1 ms):');
      const names = [...tr.transient.voltages.keys()].sort().slice(0, 8);
      for (const n of names) {
        const arr = [...tr.transient.voltage(n)];
        if (!arr.length) continue;
        lines.push(`  ${n}: min ${Math.min(...arr).toFixed(4)} V, max ${Math.max(...arr).toFixed(4)} V`);
      }
    }
  } catch {
    lines.push('', '(Transiente não convergiu para este circuito.)');
  }
  return lines.join('\n');
}
