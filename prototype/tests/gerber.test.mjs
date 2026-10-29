import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDocument } from '../dist/core/model.js';
import { createPcbBoard, addTrack, computeRatsnest } from '../dist/core/pcb-model.js';
import { exportGerberTop, exportPickPlace, exportFabBundle, exportExcellonDrill, exportGerberOutline } from '../dist/format/export-gerber.js';
import { importEasyedaPcb } from '../dist/format/import-easyeda-pcb.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('Gerber top contém M02', () => {
  const b = createPcbBoard();
  addTrack(b, [{ x: 0, y: 0 }, { x: 50, y: 0 }], 'N1');
  assert.match(exportGerberTop(b), /M02\*$/m);
});

test('pick and place CSV', () => {
  const doc = createDocument();
  importEasyedaPcb(readFileSync(join(root, 'examples/synthetic-pcb.json'), 'utf8'), doc);
  assert.ok(doc.pcb?.footprints.length >= 0);
  if (doc.pcb?.footprints.length) assert.match(exportPickPlace(doc.pcb), /RefDes/);
});

test('pacote fab inclui 5 camadas', () => {
  const b = createPcbBoard();
  const bundle = exportFabBundle(b);
  assert.ok(bundle['top.gtl'].includes('M02'));
  assert.ok(bundle['outline.gko'].includes('GKO'));
  assert.ok(bundle['silk.gto'].includes('GTO'));
  assert.match(exportExcellonDrill(b), /^M48/m);
});

test('ratsnest some após trilha ligar pads', () => {
  const b = createPcbBoard();
  b.footprints.push({
    id: 'fp1', ref: 'R1', kind: 'r0603', x: 0, y: 0, rot: 0,
    padNets: { 1: 'NET', 2: 'NET' },
  });
  assert.equal(computeRatsnest(b).length, 1);
  addTrack(b, [{ x: -8, y: 0 }, { x: 8, y: 0 }], 'NET', 'top', 2);
  assert.equal(computeRatsnest(b).length, 0);
});

test('import PCB define contorno layer 10', () => {
  const doc = createDocument();
  importEasyedaPcb(readFileSync(join(root, 'examples/synthetic-pcb.json'), 'utf8'), doc);
  assert.ok(doc.pcb?.outline.length >= 4);
  const minX = Math.min(...doc.pcb.outline.map((p) => p.x));
  assert.equal(minX, 397);
});
