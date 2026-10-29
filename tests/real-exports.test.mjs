import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseDocument, serializeDocument, parseShape, serializeShape, extractPcbNets, extractNets, parsePoints, units, svgNodeOf } from '../prototype/dist/format/easyeda-std.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const REAL = ['examples/real-pcb-export.json', 'examples/real-schematic-from-har.json', 'evidence/real-exports/pcb-created-from-har.datastr.json'];
const walk = (shapes, f) => shapes.forEach((s) => { f(s); if (s.children) walk(s.children, f); });

for (const f of REAL) {
  test(`real: round-trip exato do documento (${f})`, () => {
    const src = JSON.parse(rd(f));
    assert.equal(JSON.stringify(serializeDocument(parseDocument(src))), JSON.stringify(src));
  });
  test(`real: cada primitiva (inclusive filhos #@$) volta idêntica (${f})`, () => {
    const src = JSON.parse(rd(f)); const kind = src.head.docType === '1' ? 'sch' : 'pcb';
    for (const s of src.shape) assert.equal(serializeShape(parseShape(s, kind), kind), s);
  });
}

test('real: só Pimage permanece sem esquema (desconhecido, mas preservado)', () => {
  const unk = new Set();
  for (const f of REAL) walk(parseDocument(JSON.parse(rd(f))).shapes, (s) => s.unknown && unk.add(s.type));
  assert.deepEqual([...unk], ['Pimage']);
});

test('real: PAD com 19 campos nomeados conforme export v6.5.61', () => {
  const d = parseDocument(JSON.parse(rd('examples/real-pcb-export.json')));
  const pads = []; walk(d.shapes, (s) => s.type === 'PAD' && pads.push(s));
  assert.equal(pads.length, 4);
  const p = pads.find((x) => x.fields.net === 'R1_2');
  assert.equal(p.fields.shape, 'RECT'); assert.equal(p.fields.layerId, '1'); assert.equal(p.fields.number, '2');
  assert.equal(p.fields.plated, 'Y'); assert.equal(p.extra.length, 0);
});

test('real: conectividade PCB por net (TRACK/VIA/PAD)', () => {
  const nets = extractPcbNets(parseDocument(JSON.parse(rd('examples/real-pcb-export.json'))));
  assert.deepEqual(nets.map((n) => n.name), ['R1_1', 'R1_2', 'R2_1', 'R2_2']);
  assert.equal(nets.find((n) => n.name === 'R1_1').vias, 1);
  assert.equal(nets.find((n) => n.name === 'R2_1').tracks, 1);
});

test('real: ids gge do esquema e do PCB coincidem (vínculo sch↔pcb)', () => {
  const sch = parseDocument(JSON.parse(rd('examples/real-schematic-from-har.json')));
  const pcb = parseDocument(JSON.parse(rd('examples/real-pcb-export.json')));
  const ids = (d) => new Set(d.shapes.filter((s) => s.type === 'LIB').map((s) => s.fields.id));
  const a = ids(sch), b = ids(pcb);
  for (const id of b) assert.ok(a.has(id), id);
  const pins = extractNets(sch).flatMap((n) => n.pins.map((p) => p.split('.')[0]));
  for (const id of b) assert.ok(pins.includes(id));
});

test('real: furo de VIA (holeRadius 0.6102 un) = ferramenta Excellon T01C0.310 mm', () => {
  const d = parseDocument(JSON.parse(rd('examples/real-pcb-export.json')));
  const via = d.shapes.find((s) => s.type === 'VIA');
  const mm = units.toMm(2 * Number(via.fields.holeRadius));
  const drl = rd('evidence/real-exports/gerber/Drill_PTH_Through_Via.DRL');
  const tool = Number(/T01C([\d.]+)/.exec(drl)[1]);
  assert.ok(Math.abs(mm - tool) < 0.001, `${mm} vs ${tool}`);
});

test('real: contorno (TRACK layer 10) = 6,0 × 4,0 mm, igual ao get_price do HAR', () => {
  const d = parseDocument(JSON.parse(rd('examples/real-pcb-export.json')));
  const o = d.shapes.find((s) => s.type === 'TRACK' && s.fields.layerId === '10');
  const pts = parsePoints(o.fields.points); const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const w = units.toMm(Math.max(...xs) - Math.min(...xs)), h = units.toMm(Math.max(...ys) - Math.min(...ys));
  const har = JSON.parse(rd('evidence/session.sanitized.har'));
  const e = har.log.entries.find((x) => x.request.url.includes('/get_price'));
  const q = Object.fromEntries(e.request.queryString.map((x) => [x.name, Number(x.value)]));
  assert.ok(Math.abs(w - q.width) < 0.01 && Math.abs(h - q.length) < 0.01, `${w}x${h} vs ${q.width}x${q.length}`);
});

test('real: SVGNODE é JSON válido (contorno 3D)', () => {
  const d = parseDocument(JSON.parse(rd('examples/real-pcb-export.json')));
  const n = []; walk(d.shapes, (s) => s.type === 'SVGNODE' && n.push(svgNodeOf(s)));
  assert.ok(n.length >= 1); assert.equal(n[0].attrs.c_etype, 'outline3D');
});

test('real: Gerber RS-274X — cabeçalho, formato e unidade', () => {
  const g = rd('evidence/real-exports/gerber/Gerber_TopLayer.GTL');
  assert.match(g, /G04 Gerber Generator version 0\.2\*/);
  assert.match(g, /%FSLAX45Y45\*%/); assert.match(g, /%MOMM\*%/); assert.match(g, /M02\*\s*$/);
});

// Identificadores pessoais só como SHA-256 (nunca em claro no pacote). Cada token alfanumérico dos arquivos é hasheado e comparado.
const PII_SHA256 = new Set(['2d37e6c27597b1a21cba9121fe0c1a80e43bdc8627ba8e9e8d89cb8467391a54', '1694c7276e04d695cd7c3a58d5271d21119e1df8bc66da7cd7e1b5ec42214756', '770693b189a99443ad9b8838498c65c1a9bd362630a6d28032a62f6af7a5421e', '3247601febdc143ebc384f91286ad9c13292e88506552e2606fa9b175e3007c3']);
const SECRETS = [/eyJ[A-Za-z0-9_-]{10,}\./, /(easyeda_session|access_token|refresh_token|oshwhub_csrf|loginSession)=/, { test: (t) => (t.toLowerCase().match(/[a-z0-9]+/g) || []).some((w) => [w, ...Array.from({ length: Math.max(0, w.length - 8) }, (_, i) => w.slice(i, i + 9))].some((x) => PII_SHA256.has(createHash('sha256').update(x).digest('hex')))) }];
test('sanitização: evidence/ e examples/ sem uuid, username, tokens ou cookies', () => {
  const files = ['evidence/session.sanitized.har', ...readdirSync(new URL('../evidence/real-exports/', import.meta.url)).filter((f) => f.includes('.')).map((f) => `evidence/real-exports/${f}`),
    ...readdirSync(new URL('../evidence/real-exports/gerber/', import.meta.url)).map((f) => `evidence/real-exports/gerber/${f}`), ...REAL];
  for (const f of files) { const t = rd(f); SECRETS.forEach((re, i) => assert.ok(!re.test(t), `${f}: padrão sensível #${i}`)); }
  const har = JSON.parse(rd('evidence/session.sanitized.har'));
  for (const e of har.log.entries) for (const side of ['request', 'response']) {
    assert.equal(e[side].cookies.length, 0);
    for (const h of e[side].headers) assert.ok(!['cookie', 'set-cookie', 'authorization'].includes(h.name.toLowerCase()));
  }
});

test('real: resposta de GET /api/documents/{uuid} (docType 5, dataStr como OBJETO) faz round-trip', () => {
  const src = JSON.parse(rd('examples/real-open-document-response.json'));
  assert.equal(src.docType, 5); assert.equal(typeof src.schematics[0].dataStr, 'object');
  const m = parseDocument(src);
  assert.equal(m.schematics[0].doc.docType, 1);
  assert.equal(JSON.stringify(serializeDocument(m)), JSON.stringify(src));
});
