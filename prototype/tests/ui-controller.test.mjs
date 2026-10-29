import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, Commands, History, pinWorld } from '../dist/core/model.js';
import { buildNetlist, describeWarning } from '../dist/core/connectivity.js';
import * as T from '../dist/ui/controller.js';

const P = (x, y) => ({ x, y });
const ortho = (pts) => pts.every((p, i) => i === 0 || p.x === pts[i - 1].x || p.y === pts[i - 1].y);

test('W: duplo clique encerra sem vértice duplicado', () => {
  const t = T.createTool(); T.toggleWireMode(t);
  T.down(t, P(0, 0), { t: 0 }); T.down(t, P(50, 0), { t: 1000 });
  const r = T.down(t, P(50, 0), { t: 1200 });
  assert.equal(r.type, 'commit'); assert.deepEqual(r.points, [P(0, 0), P(50, 0)]);
  assert.equal(T.isWireActive(t), false);
});
test('W: dblclick nativo também encerra; cliques lentos no mesmo ponto não duplicam', () => {
  const t = T.createTool(); T.toggleWireMode(t);
  T.down(t, P(0, 0), { t: 0 }); T.down(t, P(0, 0), { t: 5000 }); T.down(t, P(0, 30), { t: 9000 });
  const r = T.dblclick(t); assert.deepEqual(r.points, [P(0, 0), P(0, 30)]);
});
test('Enter (finish) e Esc (cancel) desligam o modo; botão reflete o estado', () => {
  const t = T.createTool(); T.toggleWireMode(t); assert.equal(T.isWireActive(t), true);
  T.down(t, P(0, 0)); T.down(t, P(10, 0), { t: 999 }); assert.ok(T.finish(t)); assert.equal(T.isWireActive(t), false);
  T.toggleWireMode(t); T.down(t, P(0, 0)); T.cancel(t); assert.equal(T.isWireActive(t), false); assert.equal(t.wire, null);
  T.toggleWireMode(t); assert.equal(T.toggleWireMode(t), null); assert.equal(T.isWireActive(t), false);
});
test('arrasto a partir de pino termina no ponto solto', () => {
  const t = T.createTool(); T.down(t, P(30, 0), { onPin: true });
  T.move(t, P(60, 0)); T.move(t, P(90, 40));
  const r = T.up(t, P(90, 40)); assert.equal(r.type, 'commit');
  assert.deepEqual(r.points, [P(30, 0), P(90, 0), P(90, 40)]); assert.equal(T.isWireActive(t), false);
});
test('clique simples em pino (idle) seleciona, não começa fio', () => {
  const t = T.createTool(); T.down(t, P(30, 0), { onPin: true }); T.move(t, P(31, 1));
  const r = T.up(t, P(30, 0)); assert.equal(r.type, 'select'); assert.equal(T.isWireActive(t), false);
});
test('clique fora de pino em idle pede seleção', () => { assert.equal(T.down(T.createTool(), P(5, 5)).type, 'select'); });
test('segmentos sempre ortogonais, inclusive saindo de pino fora da grade (LED)', () => {
  const t = T.createTool(); T.toggleWireMode(t);
  T.down(t, P(175, 0)); T.move(t, P(120, 40)); assert.ok(ortho(T.previewPoints(t)));
  T.down(t, P(120, 40), { t: 1000 }); T.down(t, P(60, 90), { t: 2000 });
  const r = T.finish(t); assert.ok(ortho(r.points)); assert.deepEqual(r.points[1], P(120, 0));
  const doc = createDocument(); const h = new History(doc);
  const d = h.exec(Commands.addSymbol('led', 200, 0)); const a = pinWorld(doc, d, 'A');
  const t2 = T.createTool(); T.down(t2, a, { onPin: true }); T.move(t2, P(150, 50)); const r2 = T.up(t2, P(150, 50));
  h.exec(Commands.addWire(r2.points)); assert.ok(ortho(doc.wires[0].points));
});
test('pick: pino > símbolo > fio; rótulo é selecionável pelo pino', () => {
  const doc = createDocument(); const h = new History(doc);
  const nl = h.exec(Commands.addSymbol('netlabel', 100, 100)); h.exec(Commands.addWire([P(0, 50), P(80, 50)]));
  assert.equal(T.pick(doc, P(100, 100)), nl); assert.equal(T.pick(doc, P(40, 51)), doc.wires[0].id); assert.equal(T.pick(doc, P(500, 500)), null);
});
test('renomear: rótulo/GND/porta → setNet; fio → novo rótulo; componente/nada → mensagem', () => {
  const doc = createDocument(); const h = new History(doc);
  const r1 = h.exec(Commands.addSymbol('resistor', 0, 0)); const g = h.exec(Commands.addSymbol('ground', 100, 0));
  const p = h.exec(Commands.addSymbol('port', 200, 0, { net: 'A' }));
  for (const id of [g, p]) { const tg = T.renameTarget(doc, new Set([id])); assert.equal(tg.kind, 'symbol'); h.exec(T.renameCommand(tg, 'X' + id)); assert.equal(doc.symbols.find((s) => s.id === id).net, 'X' + id); }
  assert.match(T.renameTarget(doc, new Set()).message, /Selecione/);
  assert.match(T.renameTarget(doc, new Set([r1])).message, /componente/);
  assert.equal(T.renameCommand({ kind: 'symbol', id: g }, '  '), null);
  const a = pinWorld(doc, r1, '2'); h.exec(Commands.addWire([a, P(a.x + 30, a.y), P(a.x + 30, a.y + 40)]));
  const w = doc.wires[0].id; const tw = T.renameTarget(doc, new Set([w])); assert.equal(tw.kind, 'wire');
  h.exec(T.renameCommand(tw, 'SIG'));
  // fio sem outro pino: o rótulo fica ligado só a R1.2 → rede SIG com um pino
  assert.deepEqual(buildNetlist(doc).nets.SIG, ['R1.2']);
  const again = T.renameTarget(doc, new Set([w])); assert.equal(again.kind, 'symbol'); assert.equal(again.current, 'SIG');
});
test('aviso unconnected para rótulo/porta solto e texto dos avisos', () => {
  const doc = createDocument(); const h = new History(doc);
  h.exec(Commands.addSymbol('netlabel', 300, 300, { net: 'SOLTO' })); h.exec(Commands.addSymbol('port', 500, 500, { net: 'IN' }));
  const ws = buildNetlist(doc).warnings.filter((w) => w.type === 'unconnected');
  assert.equal(ws.length, 2); assert.match(describeWarning(ws[0]), /sem conexão/);
});
test('conflito de nomes gera aviso descrito', () => {
  const doc = createDocument(); const h = new History(doc);
  const r = h.exec(Commands.addSymbol('resistor', 0, 0)); const a = pinWorld(doc, r, '2');
  h.exec(Commands.addWire([a, P(a.x + 40, a.y)]));
  h.exec(Commands.addSymbol('netlabel', a.x + 20, a.y, { net: 'A', exact: true })); h.exec(Commands.addSymbol('netlabel', a.x + 40, a.y, { net: 'B', exact: true }));
  const nl = buildNetlist(doc); const c = nl.warnings.find((w) => w.type === 'name-conflict');
  assert.ok(c); assert.match(describeWarning(c), /conflito/); assert.deepEqual(nl.nets.A, ['R1.2']);
});
test('selectInRect seleciona símbolos e fios dentro da caixa', () => {
  const doc = createDocument(); const h = new History(doc);
  const r = h.exec(Commands.addSymbol('resistor', 0, 0));
  const d = h.exec(Commands.addSymbol('led', 100, 0));
  h.exec(Commands.addWire({ sym: r, pin: '2' }, { sym: d, pin: 'A' }));
  const ids = T.selectInRect(doc, P(-40, -20), P(50, 20));
  assert.ok(ids.includes(r));
  assert.ok(!ids.includes(d));
  const wireIds = T.selectInRect(doc, P(25, -5), P(75, 5));
  assert.ok(wireIds.some((id) => doc.wires.some((w) => w.id === id)));
  assert.ok(!wireIds.includes(d));
  assert.equal(T.selectInRect(doc, P(0, 0), P(2, 2)).length, 0);
});
