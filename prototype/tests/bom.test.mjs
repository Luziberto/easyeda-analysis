import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, Commands, History } from '../dist/core/model.js';
import { exportBom, exportBomCsv } from '../dist/format/export-bom.js';

test('BOM lista componentes por folha', () => {
  const doc = createDocument();
  const h = new History(doc);
  h.exec(Commands.addSymbol('resistor', 0, 0));
  h.exec(Commands.addSymbol('led', 100, 0));
  const rows = exportBom(doc);
  assert.equal(rows.length, 2);
  assert.ok(rows.some((r) => r.ref === 'R1'));
  assert.ok(exportBomCsv(doc).includes('"R1"'));
});
