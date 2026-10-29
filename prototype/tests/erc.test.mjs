import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, getActiveSheet, Commands, History } from '../dist/core/model.js';
import { runErc, describeErc } from '../dist/core/erc.js';

const setup = () => { const doc = createDocument(); return { doc, h: new History(doc) }; };

test('ERC: pino flutuante em resistor solto', () => {
  const { doc, h } = setup();
  h.exec(Commands.addSymbol('resistor', 0, 0));
  const r = runErc(doc);
  assert.ok(r.errors.some((e) => e.code === 'floating-pin'));
  assert.match(describeErc(r.errors[0]), /flutuante/);
});

test('ERC: conflito de duas saídas na mesma rede', () => {
  const { doc, h } = setup();
  const a = h.exec(Commands.addSymbol('led', -50, 0));
  const b = h.exec(Commands.addSymbol('led', 50, 0));
  h.exec(Commands.addWire({ sym: a, pin: 'K' }, { sym: b, pin: 'K' }));
  const r = runErc(doc);
  assert.ok(r.errors.some((e) => e.code === 'output-conflict'));
});

test('ERC: resistor parcialmente ligado ao GND reporta pino flutuante', () => {
  const { doc, h } = setup();
  const r = h.exec(Commands.addSymbol('resistor', 0, 0));
  const g = h.exec(Commands.addSymbol('ground', 80, 0));
  h.exec(Commands.addWire({ sym: r, pin: '2' }, { sym: g, pin: '1' }));
  const erc = runErc(doc);
  assert.ok(erc.errors.some((e) => e.code === 'floating-pin' && e.ref === 'R1' && e.pin === '1'));
});

test('addSheet e setActiveSheet', () => {
  const { doc, h } = setup();
  const id = h.exec(Commands.addSheet('Folha 2'));
  assert.equal(doc.sheets.length, 2);
  assert.equal(doc.activeSheetId, id);
  assert.equal(getActiveSheet(doc).name, 'Folha 2');
  h.exec(Commands.setActiveSheet(doc.sheets[0].id));
  assert.equal(getActiveSheet(doc).name, 'Folha 1');
});

test('addWire com kind bus', () => {
  const { doc, h } = setup();
  h.exec(Commands.addWire([{ x: 0, y: 0 }, { x: 40, y: 0 }], undefined, { kind: 'bus' }));
  assert.equal(getActiveSheet(doc).wires[0].kind, 'bus');
});
