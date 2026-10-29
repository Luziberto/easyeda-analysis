import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, Commands, History } from '../dist/core/model.js';
import { exportSpice } from '../dist/format/export-spice.js';
import { runSpiceOperatingPoint, formatSpiceOpSummary } from '../dist/sim/spice-runner.js';

test('ngspice-wasm .op divisor resistivo', async () => {
  const doc = createDocument();
  const h = new History(doc);
  const r = h.exec(Commands.addSymbol('resistor', 0, 0));
  const g = h.exec(Commands.addSymbol('ground', 80, 0));
  const v = h.exec(Commands.addSymbol('vcc', 0, 40));
  h.exec(Commands.addWire({ sym: v, pin: '1' }, { sym: r, pin: '1' }));
  h.exec(Commands.addWire({ sym: r, pin: '2' }, { sym: g, pin: '1' }));
  const deck = exportSpice(doc);
  const res = await runSpiceOperatingPoint(deck);
  assert.equal(res.backend, 'ngspice-wasm');
  assert.ok(Object.keys(res.voltages).length >= 1);
  assert.match(formatSpiceOpSummary(res), /ngspice-wasm/);
});
