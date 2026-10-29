import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, Commands, History } from '../dist/core/model.js';
import { syncPcbFromSchematic, runPcbDrc, addTrack, createPcbBoard } from '../dist/core/pcb-model.js';
import { pcbNetModel } from '../dist/core/pcb-library.js';

test('sync PCB cria footprints e aplica redes', () => {
  const doc = createDocument();
  const h = new History(doc);
  const r = h.exec(Commands.addSymbol('resistor', 50, 50));
  const g = h.exec(Commands.addSymbol('ground', 120, 50));
  h.exec(Commands.addWire({ sym: r, pin: '2' }, { sym: g, pin: '1' }));
  const { added } = syncPcbFromSchematic(doc);
  assert.ok(added >= 1);
  assert.ok(doc.pcb?.footprints.some((f) => f.ref === 'R1'));
  const model = pcbNetModel(doc.pcb);
  assert.equal(model.R1.pads['2'], 'GND');
});

test('DRC detecta pads sem rede', () => {
  const board = createPcbBoard();
  board.footprints.push({
    id: 'fp1', ref: 'R1', kind: 'r0603', x: 0, y: 0, rot: 0,
    padNets: { 1: '', 2: '' },
  });
  const issues = runPcbDrc(board);
  assert.ok(issues.some((i) => i.code === 'orphan-pad'));
});

test('addTrack adiciona trilha', () => {
  const board = createPcbBoard();
  addTrack(board, [{ x: 0, y: 0 }, { x: 40, y: 0 }], 'NET1');
  assert.equal(board.tracks.length, 1);
  assert.equal(board.tracks[0].net, 'NET1');
});
