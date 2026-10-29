import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, Commands, History, deserialize, serialize, migrate, pinWorld, hitWire, netlist, FORMAT_VERSION } from '../dist/core/model.js';
import { SpatialHash, snapPoint, buildNetlist, diffNetlist, applyNetlistDiff, junctions, needsJunction, analyzePoints, naturalCompare, onSegmentInterior } from '../dist/core/connectivity.js';

const setup = () => { const doc = createDocument(); return { doc, h: new History(doc) }; };
const W = (h, ...pts) => h.exec(Commands.addWire(pts.map(([x, y]) => ({ x, y }))));
const S = (h, kind, x, y, opts) => h.exec(Commands.addSymbol(kind, x, y, opts));

test('snap: inteiros, passo da grade e meio passo com Alt, origem', () => {
  assert.deepEqual(snapPoint({ x: 14.9, y: -6 }), { x: 10, y: -10 });
  assert.deepEqual(snapPoint({ x: 14.9, y: 7.4 }, { alt: true }), { x: 15, y: 5 });
  assert.deepEqual(snapPoint({ x: 3, y: 3 }, { origin: { x: 2, y: 2 } }), { x: 2, y: 2 });
  for (let i = 0; i < 200; i++) { const p = snapPoint({ x: Math.random() * 1e4 - 5e3, y: Math.random() * 1e4 - 5e3 }, { alt: i % 2 === 0 }); assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y)); assert.equal(Math.abs(p.x % 5), 0); }
});
test('addSymbol com Alt aceita meio passo; move com Alt', () => {
  const { doc, h } = setup(); const id = S(h, 'resistor', 104, 96, { alt: true }); assert.deepEqual([doc.symbols[0].x, doc.symbols[0].y], [105, 95]);
  h.exec(Commands.move([id], 6, 0, { alt: true })); assert.equal(doc.symbols[0].x, 110);
});
test('SpatialHash: at, inRect, nearest, células negativas', () => {
  const ix = new SpatialHash(10); ix.insert(0, 0, 'a'); ix.insert(-15, 25, 'b'); ix.insert(100, 100, 'c'); ix.insert(0, 0, 'd');
  assert.deepEqual(ix.at(0, 0).map((e) => e.item).sort(), ['a', 'd']); assert.equal(ix.at(1, 0).length, 0);
  assert.deepEqual(ix.inRect(-20, 0, 5, 30).map((e) => e.item).sort(), ['a', 'b', 'd']);
  assert.equal(ix.nearest(-13, 22, 5).item, 'b'); assert.equal(ix.nearest(50, 50, 5), null); assert.equal(ix.size, 4);
});
test('SpatialHash vs força bruta (aleatório)', () => {
  const ix = new SpatialHash(17); const pts = [];
  for (let i = 0; i < 500; i++) { const p = { x: Math.floor(Math.random() * 400 - 200), y: Math.floor(Math.random() * 400 - 200) }; pts.push(p); ix.insert(p.x, p.y, i); }
  for (let k = 0; k < 50; k++) { const x0 = Math.floor(Math.random() * 400 - 200), y0 = Math.floor(Math.random() * 400 - 200), x1 = x0 + 60, y1 = y0 + 40;
    const brute = pts.map((p, i) => [p, i]).filter(([p]) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1).map(([, i]) => i).sort((a, b) => a - b);
    assert.deepEqual(ix.inRect(x0, y0, x1, y1).map((e) => e.item).sort((a, b) => a - b), brute); }
});
test('onSegmentInterior exato', () => {
  assert.ok(onSegmentInterior({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }));
  assert.ok(!onSegmentInterior({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }));
  assert.ok(onSegmentInterior({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 10 }));
  assert.ok(!onSegmentInterior({ x: 5, y: 6 }, { x: 0, y: 0 }, { x: 10, y: 10 }));
});
test('regra de junção', () => {
  assert.equal(needsJunction(3, 0), true); assert.equal(needsJunction(1, 1), true); assert.equal(needsJunction(2, 0), false);
  assert.equal(needsJunction(0, 2), false); assert.equal(needsJunction(2, 1), true); assert.equal(needsJunction(1, 0), false);
});
test('T conecta e gera junção; cruzamento simples não conecta', () => {
  const { doc, h } = setup();
  const r1 = S(h, 'resistor', 0, 0), r2 = S(h, 'resistor', 200, 0), r3 = S(h, 'resistor', 100, 100);
  W(h, [30, 0], [170, 0]);           // R1.2 — R2.1
  W(h, [100, 0], [100, 70]);         // T no meio do fio até R3.1? R3 pino1 em (70,100); usamos dobra
  W(h, [100, 70], [70, 70], [70, 100]);
  assert.deepEqual(junctions(doc), [{ x: 100, y: 0 }]);
  const n = buildNetlist(doc).nets; assert.deepEqual(n.R1_2, ['R1.2', 'R2.1', 'R3.1']);
  // cruzamento: fio vertical atravessa o horizontal sem terminar nele
  const c1 = S(h, 'resistor', 300, -100); void c1; void r1; void r2; void r3;
  W(h, [50, -40], [50, 40]);
  const n2 = buildNetlist(doc).nets; assert.deepEqual(n2.R1_2, ['R1.2', 'R2.1', 'R3.1']);
  assert.ok(!junctions(doc).some((j) => j.x === 50 && j.y === 0));
});
test('três extremidades no mesmo ponto: conecta com junção; duas: conecta sem junção', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); S(h, 'resistor', 100, 0); S(h, 'resistor', 50, 100);
  W(h, [30, 0], [50, 0]); W(h, [50, 0], [70, 0]);
  assert.deepEqual(junctions(doc), []); assert.deepEqual(buildNetlist(doc).nets.R1_2, ['R1.2', 'R2.1']);
  W(h, [50, 0], [50, 50], [20, 50], [20, 100]);
  assert.deepEqual(junctions(doc), [{ x: 50, y: 0 }]); assert.deepEqual(buildNetlist(doc).nets.R1_2, ['R1.2', 'R2.1', 'R3.1']);
});
test('pino no meio de um fio conecta (T com pino)', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); W(h, [30, -50], [30, 50]); S(h, 'resistor', 100, 50); W(h, [30, 50], [70, 50]);
  const a = analyzePoints(doc).pts.get('30,0'); assert.equal(a.o, 1); assert.equal(a.a, 1);
  assert.deepEqual(buildNetlist(doc).nets.R1_2, ['R1.2', 'R2.1']);
});
test('dobra de polilinha sobre outro fio sem extremidade não conecta', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); S(h, 'resistor', 0, 100);
  W(h, [30, 0], [60, 0], [60, -30]); W(h, [100, 0], [60, 0], [30, 100]);
  // (60,0) é dobra dos dois fios (o=0, a=2): não conecta
  assert.equal(netlist(doc).length, 0);
});
test('fio de pontos livres pino→ponto→pino; normalização remove colineares e duplicados', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); S(h, 'led', 200, 0);
  const id = W(h, [30, 0], [80, 0], [80, 0], [120, 0], [175, 0]);
  assert.deepEqual(doc.wires.find((w) => w.id === id).points, [{ x: 30, y: 0 }, { x: 175, y: 0 }]);
  assert.deepEqual(buildNetlist(doc).nets, { D1_A: ['D1.A', 'R1.2'] });
  assert.throws(() => W(h, [10, 10], [10, 10]));
  assert.equal(hitWire(doc, { x: 100, y: 2 }), id); assert.equal(hitWire(doc, { x: 100, y: 30 }), null);
});
test('rótulos de rede unem grupos distantes com o mesmo nome', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); S(h, 'resistor', 300, 300);
  S(h, 'netlabel', 30, 0, { net: 'SDA' }); S(h, 'netlabel', 270, 300, { net: 'SDA' });
  assert.deepEqual(buildNetlist(doc).nets, { SDA: ['R1.2', 'R2.1'] });
});
test('power GND/VCC: nomes fixos e une todos; símbolos de power não entram como REF.pino', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); S(h, 'capacitor', 200, 0);
  S(h, 'ground', 30, 10); S(h, 'ground', 220, 10); S(h, 'vcc', -30, -10);
  const { nets } = buildNetlist(doc);
  assert.deepEqual(nets, { GND: ['C1.2', 'R1.2'], VCC: ['R1.1'] });
});
test('prioridade power > porta > rótulo > automático, com avisos', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); S(h, 'resistor', 100, 0); W(h, [30, 0], [70, 0]);
  assert.deepEqual(Object.keys(buildNetlist(doc).nets), ['R1_2']);
  S(h, 'netlabel', 50, 0, { net: 'LBL' }); assert.deepEqual(Object.keys(buildNetlist(doc).nets), ['LBL']);
  S(h, 'port', 60, 0, { net: 'PRT' }); let r = buildNetlist(doc); assert.deepEqual(Object.keys(r.nets), ['PRT']);
  assert.deepEqual(r.warnings, [{ type: 'name-overridden', names: ['LBL'], chosen: 'PRT' }]);
  S(h, 'ground', 40, 10); r = buildNetlist(doc); assert.deepEqual(Object.keys(r.nets), ['GND']);
  assert.deepEqual(r.warnings[0].names, ['LBL', 'PRT']);
});
test('conflito no mesmo nível: aviso e escolha determinística', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); S(h, 'resistor', 100, 0); W(h, [30, 0], [70, 0]);
  S(h, 'netlabel', 40, 0, { net: 'B' }); S(h, 'netlabel', 60, 0, { net: 'A' });
  const r = buildNetlist(doc); assert.deepEqual(Object.keys(r.nets), ['A']);
  assert.deepEqual(r.warnings, [{ type: 'name-conflict', role: 'label', names: ['A', 'B'], chosen: 'A' }]);
});
test('dois power diferentes ligados por fio: conflito GND vs VCC', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); S(h, 'ground', 30, 10); S(h, 'vcc', 30, -10);
  const r = buildNetlist(doc); assert.equal(r.warnings[0].type, 'name-conflict'); assert.deepEqual(r.warnings[0].names, ['GND', 'VCC']);
});
test('nome automático = menor REF.pino em ordem natural (R2 < R10)', () => {
  const { doc, h } = setup(); for (let i = 0; i < 10; i++) S(h, 'resistor', i * 100, 0);
  assert.equal(doc.symbols[9].ref, 'R10');
  W(h, [930, 0], [970, 0]); // R10.1 — R10? não: R10 está em 900 → pino 2 = 930; R... pino de 1000 inexistente
  S(h, 'resistor', 1000, 0); // R11 pino1 = 970
  W(h, [130, 0], [130, 50], [930, 50], [930, 0]); // R2.2 entra
  assert.deepEqual(buildNetlist(doc).nets, { R2_2: ['R2.2', 'R10.2', 'R11.1'] });
  assert.ok(naturalCompare('R2', 'R10') < 0); assert.ok(naturalCompare('R10', 'R2') > 0); assert.equal(naturalCompare('A1', 'A1'), 0);
});
test('pino isolado não gera rede; nomes colidentes recebem sufixo com aviso', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); assert.deepEqual(buildNetlist(doc).nets, {});
  S(h, 'resistor', 100, 0); W(h, [30, 0], [70, 0]); // auto R1_2
  S(h, 'resistor', 0, 200); S(h, 'netlabel', 30, 200, { net: 'R1_2' });
  const r = buildNetlist(doc); assert.deepEqual(Object.keys(r.nets).sort(), ['R1_2', 'R1_2_2']); assert.equal(r.warnings[0].type, 'name-collision');
});
test('setNet renomeia rótulo; desfazer restaura', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); const l = S(h, 'netlabel', 30, 0, { net: 'X' });
  h.exec(Commands.setNet(l, 'Y')); assert.deepEqual(buildNetlist(doc).nets, { Y: ['R1.2'] }); h.undo(); assert.deepEqual(buildNetlist(doc).nets, { X: ['R1.2'] });
  assert.throws(() => h.exec(Commands.setNet(doc.symbols[0].id, 'Z')));
});
test('mover/girar símbolo arrasta extremidades ligadas; undo exato', () => {
  const { doc, h } = setup(); const a = S(h, 'resistor', 0, 0); S(h, 'resistor', 200, 0); W(h, [30, 0], [170, 0]);
  const before = JSON.stringify(doc);
  h.exec(Commands.move([a], 0, 50)); assert.deepEqual(doc.wires[0].points[0], pinWorld(doc, a, '2')); assert.equal(netlist(doc).length, 1);
  h.exec(Commands.rotate([a])); assert.deepEqual(doc.wires[0].points[0], pinWorld(doc, a, '2'));
  h.undo(); h.undo(); assert.equal(JSON.stringify(doc), before); h.redo(); h.redo(); h.undo(); h.undo(); assert.equal(JSON.stringify(doc), before);
});
test('mover um fio selecionado move todos os pontos', () => {
  const { doc, h } = setup(); const w = W(h, [0, 0], [50, 0]); h.exec(Commands.move([w], 10, 10)); assert.deepEqual(doc.wires[0].points, [{ x: 10, y: 10 }, { x: 60, y: 10 }]); h.undo(); assert.deepEqual(doc.wires[0].points[0], { x: 0, y: 0 });
});
test('sem campo cur nas extremidades salvas (correção)', () => {
  const { doc, h } = setup(); const r = S(h, 'resistor', 0, 0), d = S(h, 'led', 100, 0);
  h.exec(Commands.addWire({ sym: r, pin: '2', cur: { x: 1, y: 2 } }, { sym: d, pin: 'A' }));
  assert.ok(!serialize(doc).includes('cur')); assert.deepEqual(Object.keys(doc.wires[0]).sort(), ['id', 'points']);
});
test('migração v1 → v2: fios por pino viram polilinhas; cur descartado; rede preservada', () => {
  const v1 = { format: 'proto-eda-schematic', version: 1, nextId: 5, symbols: [
    { id: 's1', kind: 'resistor', x: 0, y: 0, rot: 0, ref: 'R1' }, { id: 's2', kind: 'led', x: 100, y: 40, rot: 0, ref: 'D1' }, { id: 's3', kind: 'ground', x: -30, y: 50, rot: 0, ref: 'GND1' }],
    wires: [{ id: 'w3', from: { sym: 's1', pin: '2', cur: { x: 9, y: 9 } }, to: { sym: 's2', pin: 'A' } }, { id: 'w4', from: { sym: 's1', pin: '1' }, to: { sym: 's3', pin: '1' } }] };
  const d = deserialize(JSON.stringify(v1));
  assert.equal(d.version, FORMAT_VERSION); assert.equal(FORMAT_VERSION, 2);
  assert.deepEqual(d.wires[0].points, [{ x: 30, y: 0 }, { x: 75, y: 0 }, { x: 75, y: 40 }]);
  assert.ok(!JSON.stringify(d).includes('cur')); assert.equal(d.symbols[2].net, 'GND');
  assert.deepEqual(buildNetlist(d).nets, { D1_A: ['D1.A', 'R1.2'], GND: ['R1.1'] });
  const bad = JSON.parse(JSON.stringify(v1)); bad.wires[0].to.sym = 'nao-existe'; assert.throws(() => deserialize(JSON.stringify(bad)), /inexistente/);
  const badPin = JSON.parse(JSON.stringify(v1)); badPin.wires[0].to.pin = 'Z'; assert.throws(() => deserialize(JSON.stringify(badPin)), /pino/);
  assert.equal(migrate({ version: 2, symbols: [], wires: [] }).version, 2);
  // round-trip v2
  assert.deepEqual(deserialize(serialize(d)), d);
});
test('v2 rejeita coordenadas não inteiras e versões inválidas', () => {
  const base = { format: 'proto-eda-schematic', version: 2, nextId: 1, symbols: [{ id: 's1', kind: 'resistor', x: 0.5, y: 0, rot: 0, ref: 'R1' }], wires: [] };
  assert.throws(() => deserialize(JSON.stringify(base)), /inteira/);
  assert.throws(() => deserialize(JSON.stringify({ ...base, version: 0 })));
  assert.throws(() => deserialize(JSON.stringify({ ...base, symbols: [], wires: [{ id: 'w', points: [{ x: 0, y: 0 }] }] })));
});
test('diff com PCB: mudanças, renomeação, erros pad/pino, extras, aplicar', () => {
  const sch = { GND: ['C1.2', 'R1.2'], VCC: ['R1.1'], SIG: ['C1.1', 'U1.3'] };
  const pcb = { R1: { pads: { 1: 'VCC', 2: 'N1' } }, C1: { pads: { 1: '', 2: 'N1' } }, J9: { pads: { 1: 'X' } } };
  const d = diffNetlist(sch, pcb);
  assert.deepEqual(d.errors, [{ type: 'missing-footprint', ref: 'U1' }]); assert.equal(d.ok, false);
  assert.deepEqual(d.renames, [{ from: 'N1', to: 'GND' }]);
  assert.deepEqual(d.warnings, [{ type: 'extra-footprint', ref: 'J9' }]);
  assert.deepEqual(d.changes.sort((a, b) => (a.ref + a.pad < b.ref + b.pad ? -1 : 1)), [
    { ref: 'C1', pad: '1', from: '', to: 'SIG' }, { ref: 'C1', pad: '2', from: 'N1', to: 'GND' }, { ref: 'R1', pad: '2', from: 'N1', to: 'GND' }]);
  assert.throws(() => applyNetlistDiff(pcb, d));
  const sch2 = { GND: ['C1.2', 'R1.2'], VCC: ['R1.1'], SIG: ['C1.1'] };
  const d2 = diffNetlist(sch2, pcb); assert.equal(d2.ok, true);
  const out = applyNetlistDiff(pcb, d2); assert.equal(out.C1.pads[1], 'SIG'); assert.equal(pcb.C1.pads[1], ''); // não muta
  assert.deepEqual(diffNetlist(sch2, out).changes, []); // idempotente
});
test('diff: pad inexistente no footprint e pad sobrando no PCB', () => {
  const d = diffNetlist({ A: ['D1.A', 'R1.2'] }, { D1: { pads: { 1: 'A', 2: '' } }, R1: { pads: { 1: 'OLD', 2: 'A' } } });
  assert.deepEqual(d.errors, [{ type: 'pad-mismatch', ref: 'D1', pin: 'A', pads: ['1', '2'] }]);
  assert.deepEqual(d.changes, [{ ref: 'D1', pad: '1', from: 'A', to: '' }, { ref: 'R1', pad: '1', from: 'OLD', to: '' }]);
});
test('ponta a ponta: esquemático → netlist → diff contra PCB vazio', () => {
  const { doc, h } = setup(); S(h, 'resistor', 0, 0); S(h, 'led', 100, 0); S(h, 'ground', 125, 10, { alt: true }); W(h, [30, 0], [75, 0]);
  const { nets } = buildNetlist(doc); assert.deepEqual(nets, { D1_A: ['D1.A', 'R1.2'], GND: ['D1.K'] });
  const pcb = { R1: { pads: { 1: '', 2: '' } }, D1: { pads: { A: '', K: '' } } };
  const d = diffNetlist(nets, pcb); assert.ok(d.ok); assert.equal(d.changes.length, 3);
  assert.deepEqual(applyNetlistDiff(pcb, d), { R1: { pads: { 1: '', 2: 'D1_A' } }, D1: { pads: { A: 'D1_A', K: 'GND' } } });
});
test('desempenho: 2000 fios em grade com índice espacial', () => {
  const { doc, h } = setup(); const t0 = Date.now();
  for (let i = 0; i < 1000; i++) { W(h, [i * 20, 0], [i * 20 + 10, 0]); W(h, [i * 20 + 10, 0], [i * 20 + 20, 0]); }
  const n = analyzePoints(doc).pts.size; assert.ok(n > 1000); buildNetlist(doc); assert.ok(Date.now() - t0 < 4000);
});
