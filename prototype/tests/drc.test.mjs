import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPcbBoard, addTrack } from '../dist/core/pcb-model.js';
import { runPcbDrc } from '../dist/core/pcb-drc.js';

test('DRC clearance trilha ↔ trilha (redes diferentes)', () => {
  const board = createPcbBoard();
  addTrack(board, [{ x: 50, y: 50 }, { x: 100, y: 50 }], 'NET_A', 'top', 2);
  addTrack(board, [{ x: 50, y: 52 }, { x: 100, y: 52 }], 'NET_B', 'top', 2);
  const issues = runPcbDrc(board, { minClearance: 2 });
  assert.ok(issues.some((i) => i.code === 'clearance' && i.message.includes('Trilhas')));
});

test('DRC ignora trilhas da mesma rede', () => {
  const board = createPcbBoard();
  addTrack(board, [{ x: 50, y: 50 }, { x: 100, y: 50 }], 'NET_A', 'top', 2);
  addTrack(board, [{ x: 50, y: 51 }, { x: 100, y: 51 }], 'NET_A', 'top', 2);
  const clearance = runPcbDrc(board, { minClearance: 2 }).filter((i) => i.code === 'clearance' && i.message.includes('Trilhas'));
  assert.equal(clearance.length, 0);
});

test('DRC trilha fora do contorno com margem', () => {
  const board = createPcbBoard();
  addTrack(board, [{ x: 0, y: 0 }, { x: 30, y: 0 }], 'X', 'top', 2);
  assert.ok(runPcbDrc(board).some((i) => i.code === 'outside-outline'));
});

test('DRC trilha ↔ pad (redes diferentes)', () => {
  const board = createPcbBoard();
  board.footprints.push({
    id: 'fp1',
    ref: 'R1',
    kind: 'r0603',
    x: 60,
    y: 50,
    rot: 0,
    padNets: { 1: 'A', 2: 'B' },
  });
  addTrack(board, [{ x: 54, y: 50 }, { x: 58, y: 50 }], 'GND', 'top', 2);
  const issues = runPcbDrc(board, { minClearance: 2 });
  assert.ok(issues.some((i) => i.code === 'clearance' && i.message.includes('Trilha')));
});
