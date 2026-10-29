import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPcbBoard, addRouteTrack } from '../dist/core/pcb-model.js';
import { routeWalkaround } from '../dist/core/pcb-router.js';

test('walkaround contorna footprint no meio', () => {
  const b = createPcbBoard();
  b.footprints.push({
    id: 'fp1', ref: 'R1', kind: 'r0603', x: 50, y: 0, rot: 0, padNets: { 1: '', 2: '' },
  });
  const path = routeWalkaround({ x: 0, y: 0 }, { x: 100, y: 0 }, b);
  assert.ok(path.length >= 3);
  addRouteTrack(b, { x: 0, y: 0 }, { x: 100, y: 0 });
  assert.equal(b.tracks.length, 1);
});
