import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { importEasyedaSchematic } from '../dist/format/import-easyeda-sch.js';
import { buildNetlist } from '../dist/core/connectivity.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('importEasyedaSchematic: projeto docType 5', () => {
  const json = readFileSync(join(root, 'examples/synthetic-project.json'), 'utf8');
  const { doc, sheets } = importEasyedaSchematic(json);
  assert.ok(sheets >= 1);
  assert.ok(doc.symbols.length + doc.wires.length > 0);
});

test('importEasyedaSchematic: exemplo sintético', () => {
  const json = readFileSync(join(root, 'examples/synthetic-schematic.json'), 'utf8');
  const { doc, skip } = importEasyedaSchematic(json);
  assert.equal(skip.length, 0);
  assert.ok(doc.symbols.length >= 2);
  assert.ok(doc.wires.length >= 2);
  const refs = doc.symbols.filter((s) => s.kind === 'resistor' || s.kind === 'led').map((s) => s.ref);
  assert.ok(refs.includes('R1'));
  assert.ok(refs.some((r) => r.startsWith('D')));
  assert.ok(Object.keys(buildNetlist(doc).nets).length >= 1);
});
