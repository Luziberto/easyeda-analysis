import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDocument, Commands, History } from '../dist/core/model.js';
import { exportPrintHtml } from '../dist/format/export-print.js';

test('PDF/HTML inclui todas as folhas', () => {
  const doc = createDocument();
  const h = new History(doc);
  h.exec(Commands.addSheet('Folha 2'));
  const html = exportPrintHtml(doc);
  assert.match(html, /Folha 1/);
  assert.match(html, /Folha 2/);
});

test('addCustomSymbol registra biblioteca', () => {
  const doc = createDocument();
  const h = new History(doc);
  h.exec(Commands.addCustomSymbol({
    name: 'ADC', prefix: 'U', w: 40, h: 30,
    pins: [{ num: '1', x: -20, y: 0, electric: 'passive' }],
    paths: ['M -20 -15 H 20 V 15 H -20 Z'],
  }, 0, 0));
  assert.ok(doc.customSymbols && Object.keys(doc.customSymbols).length >= 1);
});
