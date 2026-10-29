import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, getActiveSheet, Commands, History, pinWorld, snap, hitSymbol, hitPin, createViewport, toWorld, toScreen, zoomAt, pan, serialize, deserialize, netlist, rotatePoint, migrate, FORMAT_VERSION } from '../dist/core/model.js';

const setup = () => { const doc = createDocument(); return { doc, h: new History(doc) }; };
const $ = (doc) => getActiveSheet(doc);

test('snap ao grid de 10', () => { assert.equal(snap(14), 10); assert.equal(snap(15), 20); assert.equal(snap(-14), -10); });
test('inserir símbolo: id, referência e snap', () => {
  const { doc, h } = setup(); const id = h.exec(Commands.addSymbol('resistor', 103, 97));
  assert.equal($(doc).symbols[0].id, id); assert.equal($(doc).symbols[0].x, 100); assert.equal($(doc).symbols[0].ref, 'R1');
  h.exec(Commands.addSymbol('resistor', 0, 0)); assert.equal($(doc).symbols[1].ref, 'R2');
});
test('símbolo desconhecido é rejeitado', () => assert.throws(() => Commands.addSymbol('xyz', 0, 0)));
test('mover + desfazer + refazer', () => {
  const { doc, h } = setup(); const id = h.exec(Commands.addSymbol('led', 0, 0));
  h.exec(Commands.move([id], 33, -21)); assert.deepEqual([$(doc).symbols[0].x, $(doc).symbols[0].y], [30, -20]);
  h.undo(); assert.deepEqual([$(doc).symbols[0].x, $(doc).symbols[0].y], [0, 0]);
  h.redo(); assert.deepEqual([$(doc).symbols[0].x, $(doc).symbols[0].y], [30, -20]);
});
test('rotação muda posição mundial dos pinos', () => {
  const { doc, h } = setup(); const id = h.exec(Commands.addSymbol('resistor', 100, 100));
  assert.deepEqual(pinWorld($(doc), id, '2'), { x: 130, y: 100 });
  h.exec(Commands.rotate([id])); assert.deepEqual(pinWorld($(doc), id, '2'), { x: 100, y: 130 });
  h.exec(Commands.rotate([id])); h.exec(Commands.rotate([id])); h.exec(Commands.rotate([id])); assert.equal($(doc).symbols[0].rot, 0);
  assert.deepEqual(rotatePoint({ x: 1, y: 2 }, 270), { x: 2, y: -1 });
});
test('fio entre pinos e netlist', () => {
  const { doc, h } = setup(); const r = h.exec(Commands.addSymbol('resistor', 0, 0)); const d = h.exec(Commands.addSymbol('led', 100, 0));
  h.exec(Commands.addWire({ sym: r, pin: '2' }, { sym: d, pin: 'A' }));
  assert.deepEqual(netlist(doc), [['D1.A', 'R1.2']]);
  assert.throws(() => h.exec(Commands.addWire({ sym: r, pin: '2' }, { sym: r, pin: '2' })));
  assert.throws(() => h.exec(Commands.addWire({ sym: r, pin: '9' }, { sym: d, pin: 'A' })));
});
test('excluir símbolo remove fios ligados; undo restaura ordem', () => {
  const { doc, h } = setup(); const a = h.exec(Commands.addSymbol('resistor', 0, 0)); const b = h.exec(Commands.addSymbol('capacitor', 100, 0)); const c = h.exec(Commands.addSymbol('ground', 200, 0));
  h.exec(Commands.addWire({ sym: a, pin: '2' }, { sym: b, pin: '1' })); h.exec(Commands.addWire({ sym: b, pin: '2' }, { sym: c, pin: '1' }));
  const before = JSON.stringify(doc);
  h.exec(Commands.remove([b])); assert.equal($(doc).symbols.length, 2); assert.equal($(doc).wires.length, 0);
  h.undo(); assert.equal(JSON.stringify(doc), before);
  h.redo(); assert.equal($(doc).wires.length, 0);
});
test('histórico: novo comando limpa redo; undo vazio retorna false', () => {
  const { h } = setup(); assert.equal(h.undo(), false);
  const id = h.exec(Commands.addSymbol('resistor', 0, 0)); h.exec(Commands.move([id], 10, 0)); h.undo(); assert.ok(h.canRedo);
  h.exec(Commands.rotate([id])); assert.equal(h.canRedo, false);
});
test('desfazer tudo volta ao documento vazio e refazer tudo reconstrói', () => {
  const { doc, h } = setup(); const ids = [];
  for (let i = 0; i < 20; i++) ids.push(h.exec(Commands.addSymbol(i % 2 ? 'led' : 'resistor', i * 70, 0)));
  for (let i = 1; i < 20; i++) h.exec(Commands.addWire({ sym: ids[i - 1], pin: i % 2 ? '2' : 'K' }, { sym: ids[i], pin: i % 2 ? 'A' : '1' }));
  const full = JSON.stringify(doc); while (h.undo()); assert.equal($(doc).symbols.length + $(doc).wires.length, 0);
  while (h.redo()); assert.equal(JSON.stringify(doc), full);
});
test('hit-test de símbolo e pino', () => {
  const { doc, h } = setup(); const id = h.exec(Commands.addSymbol('resistor', 100, 100));
  assert.equal(hitSymbol($(doc), { x: 105, y: 102 }), id); assert.equal(hitSymbol($(doc), { x: 300, y: 300 }), null);
  assert.deepEqual(hitPin($(doc), { x: 72, y: 101 }), { sym: id, pin: '1' });
});
test('viewport: zoom ancorado preserva o ponto sob o cursor; pan', () => {
  let vp = createViewport(); const w0 = toWorld(vp, 200, 150);
  vp = zoomAt(vp, 200, 150, 2.5); const w1 = toWorld(vp, 200, 150);
  assert.ok(Math.abs(w0.x - w1.x) < 1e-9 && Math.abs(w0.y - w1.y) < 1e-9);
  const s = toScreen(vp, w1.x, w1.y); assert.ok(Math.abs(s.x - 200) < 1e-9);
  vp = pan(vp, 50, 0); assert.ok(Math.abs(toWorld(vp, 250, 150).x - w1.x) < 1e-9);
  assert.equal(zoomAt(createViewport(), 0, 0, 1000).scale, 20);
});
test('flipH inverte mirror e mantém pinos alinhados', () => {
  const { doc, h } = setup();
  const id = h.exec(Commands.addSymbol('led', 0, 0));
  const before = pinWorld($(doc), id, 'A');
  h.exec(Commands.flipH([id]));
  assert.equal($(doc).symbols[0].mirror, true);
  const after = pinWorld($(doc), id, 'A');
  assert.equal(after.x, -before.x);
  h.undo();
  assert.equal($(doc).symbols[0].mirror, false);
});
test('setRef rejeita duplicata e símbolos de rede', () => {
  const { doc, h } = setup();
  const id = h.exec(Commands.addSymbol('resistor', 0, 0));
  h.exec(Commands.setRef(id, 'R99'));
  assert.equal($(doc).symbols[0].ref, 'R99');
  const id2 = h.exec(Commands.addSymbol('resistor', 50, 0));
  h.exec(Commands.setRef(id2, 'R2'));
  assert.throws(() => h.exec(Commands.setRef(id, 'R2')));
  const g = h.exec(Commands.addSymbol('ground', 80, 0));
  assert.throws(() => h.exec(Commands.setRef(g, 'X')));
});
test('salvar/abrir JSON: round-trip e validação', () => {
  const { doc, h } = setup(); const r = h.exec(Commands.addSymbol('resistor', 0, 0)); const g = h.exec(Commands.addSymbol('ground', 50, 50));
  h.exec(Commands.addWire({ sym: r, pin: '1' }, { sym: g, pin: '1' }));
  const back = deserialize(serialize(doc)); assert.deepEqual(back, doc);
  assert.throws(() => deserialize('{"format":"outro"}'));
  const bad = JSON.parse(serialize(doc));
  $(bad).wires[0].points = [{ x: 1.5, y: 0 }];
  assert.throws(() => deserialize(JSON.stringify(bad)));
  const fut = JSON.parse(serialize(doc)); fut.version = 99; assert.throws(() => deserialize(JSON.stringify(fut)));
});
test('listeners do histórico são notificados', () => {
  const { h } = setup(); let n = 0; h.on(() => n++); h.exec(Commands.addSymbol('led', 0, 0)); h.undo(); h.redo(); assert.equal(n, 3);
});
