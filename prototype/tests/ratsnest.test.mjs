import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectedPadGroups } from '../dist/core/pcb-connectivity.js';
import { createPcbBoard, addTrack } from '../dist/core/pcb-model.js';

test('connectedPadGroups une pads via trilha', () => {
  const board = createPcbBoard();
  board.footprints.push({
    id: 'fp1', ref: 'R1', kind: 'r0603', x: 50, y: 50, rot: 0,
    padNets: { 1: 'N1', 2: 'N1' },
  });
  let groups = connectedPadGroups(board, 'N1');
  assert.equal(groups.length, 2);
  addTrack(board, [{ x: 42, y: 50 }, { x: 58, y: 50 }], 'N1', 'top', 2);
  groups = connectedPadGroups(board, 'N1');
  assert.equal(groups.length, 1);
});
