import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, getActiveSheet, Commands, History } from '../dist/core/model.js';
import { exportKicadNet } from '../dist/format/export-kicad.js';
import { exportSpice, validateSpiceDeck } from '../dist/format/export-spice.js';
import { exportSheetSvg } from '../dist/format/export-svg.js';

test('export KiCad .net contém ref pin net', () => {
  const doc = createDocument();
  const h = new History(doc);
  const r = h.exec(Commands.addSymbol('resistor', 0, 0));
  const g = h.exec(Commands.addSymbol('ground', 60, 0));
  h.exec(Commands.addWire({ sym: r, pin: '2' }, { sym: g, pin: '1' }));
  const out = exportKicadNet(doc);
  assert.match(out, /^R1 2 /m);
  assert.match(out, /GND/);
});

test('export SPICE inclui R e .end', () => {
  const doc = createDocument();
  const h = new History(doc);
  h.exec(Commands.addSymbol('resistor', 0, 0));
  const out = exportSpice(doc);
  assert.match(out, /^RR1 /m);
  assert.match(out, /\.op/);
  assert.match(out, /\.end$/m);
});

test('export SPICE usa value do símbolo', () => {
  const doc = createDocument();
  const h = new History(doc);
  const id = h.exec(Commands.addSymbol('resistor', 0, 0));
  h.exec(Commands.setValue(id, '4.7k'));
  assert.match(exportSpice(doc), /RR1 .* 4\.7k/);
});

test('validateSpiceDeck detecta NC', () => {
  const doc = createDocument();
  const h = new History(doc);
  h.exec(Commands.addSymbol('resistor', 0, 0));
  const r = validateSpiceDeck(doc);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /NC/i.test(e)));
});

test('export SVG folha ativa', () => {
  const doc = createDocument();
  const h = new History(doc);
  h.exec(Commands.addSymbol('led', 10, 10));
  const svg = exportSheetSvg(getActiveSheet(doc));
  assert.match(svg, /^<svg xmlns=/);
  assert.match(svg, /polyline|path/);
});
