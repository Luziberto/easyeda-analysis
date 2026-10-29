import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument, serializeDocument, parseShape, serializeShape, docTypeOf, extractNets, parsePoints, units } from '../prototype/dist/format/easyeda-std.js';

const ex = (f) => readFileSync(new URL(`../examples/${f}`, import.meta.url), 'utf8');
const files = ['synthetic-schematic.json', 'synthetic-pcb.json', 'synthetic-project.json', 'synthetic-legacy-head.json'];

for (const f of files) {
  test(`round-trip byte-a-byte (JSON normalizado): ${f}`, () => {
    const src = JSON.parse(ex(f));
    const out = serializeDocument(parseDocument(src));
    assert.equal(JSON.stringify(out), JSON.stringify(src));
  });
  test(`round-trip duplo é idempotente: ${f}`, () => {
    const once = serializeDocument(parseDocument(ex(f)));
    const twice = serializeDocument(parseDocument(JSON.parse(JSON.stringify(once))));
    assert.deepEqual(twice, once);
  });
}

test('docType: head objeto e head legado em string', () => {
  assert.equal(docTypeOf(JSON.parse(ex('synthetic-schematic.json'))), 1);
  assert.equal(docTypeOf(JSON.parse(ex('synthetic-pcb.json'))), 3);
  assert.equal(docTypeOf(JSON.parse(ex('synthetic-legacy-head.json'))), 1);
});

test('wire W: campos nomeados', () => {
  const w = parseShape('W~420 300 460 300~#008800~1~0~none~gge_w1~0');
  assert.equal(w.type, 'W'); assert.equal(w.fields.id, 'gge_w1');
  assert.deepEqual(parsePoints(w.fields.points), [{ x: 420, y: 300 }, { x: 460, y: 300 }]);
});

test('PAD PCB: 19 campos após o comando', () => {
  const m = parseDocument(ex('synthetic-pcb.json'));
  const pad = m.shapes[0].children[0];
  assert.equal(pad.type, 'PAD'); assert.equal(pad.fields.shape, 'RECT'); assert.equal(pad.fields.net, 'VCC'); assert.equal(pad.fields.number, '1');
  assert.equal(pad.extra.length, 0);
});

test('LIB composto com sub-shapes #@$ e pino ^^', () => {
  const m = parseDocument(ex('synthetic-schematic.json'));
  const lib = m.shapes[0];
  assert.equal(lib.type, 'LIB'); assert.equal(lib.children.length, 4);
  const p = lib.children[1];
  assert.equal(p.type, 'P'); assert.equal(p.fields.spicePin, '1'); assert.equal(p.segments.length, 6);
});

test('primitiva desconhecida é preservada', () => {
  const s = 'ZZ~campo~desconhecido~preservado';
  const o = parseShape(s); assert.equal(o.unknown, true); assert.equal(serializeShape(o), s);
});

test('campos extras além do esquema são preservados', () => {
  const s = 'J~1~2~3~#fff~gid~0~novo1~novo2';
  const o = parseShape(s); assert.deepEqual(o.extra, ['novo1', 'novo2']); assert.equal(serializeShape(o), s);
});

test('edição de campo reflete na serialização', () => {
  const o = parseShape('VIA~4010~3010~2.4~N1~0.6~gge_v1~0', 'pcb');
  o.fields.net = 'GND';
  assert.equal(serializeShape(o, 'pcb'), 'VIA~4010~3010~2.4~GND~0.6~gge_v1~0');
});

test('conectividade: 3 redes no esquema sintético', () => {
  const nets = extractNets(parseDocument(ex('synthetic-schematic.json')));
  const byName = Object.fromEntries(nets.map((n) => [n.name, n.pins]));
  assert.deepEqual(byName.VCC, ['gge_r1.1']);
  assert.deepEqual(byName.GND, ['gge_d1.2']);
  const mid = nets.find((n) => n.pins.includes('gge_r1.2'));
  assert.deepEqual(mid.pins, ['gge_d1.1', 'gge_r1.2']);
  assert.equal(nets.length, 3);
});

test('unidades: 1 unidade = 10 mil = 0,254 mm', () => {
  assert.equal(units.toMil(1), 10); assert.ok(Math.abs(units.toMm(10) - 2.54) < 1e-12); assert.ok(Math.abs(units.fromMm(0.254) - 1) < 1e-12);
});

test('projeto docType 5: dataStr aninhado é analisado', () => {
  const m = parseDocument(ex('synthetic-project.json'));
  assert.equal(m.schematics[0].doc.docType, 1);
  assert.equal(m.schematics[0].doc.shapes.length, 10);
});
