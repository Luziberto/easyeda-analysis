#!/usr/bin/env node
/**
 * Valida exports Gerber/Excellon:
 * - Sempre: checks estruturais (sem gerbv).
 * - Com gerbv: export batch PNG (parse real).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPcbBoard, addTrack, addOutlinePour } from '../dist/core/pcb-model.js';
import { exportFabBundle } from '../dist/format/export-gerber.js';

function assertStructure(name, body) {
  if (name.endsWith('.drl')) {
    if (!body.startsWith('M48')) throw new Error(`${name}: Excellon inválido`);
    if (!body.includes('M30')) throw new Error(`${name}: falta M30`);
    return;
  }
  if (!body.includes('M02')) throw new Error(`${name}: falta M02`);
  if (name.endsWith('.gtl') || name.endsWith('.gbl')) {
    if (!body.includes('%FSLAX')) throw new Error(`${name}: falta formato %FSLAX`);
    if (!body.includes('%MOMM')) throw new Error(`${name}: falta %MOMM`);
  }
}

const board = createPcbBoard();
addTrack(board, [{ x: 10, y: 10 }, { x: 90, y: 10 }], 'NET1');
addOutlinePour(board, 'GND', 8, 'top');

const dir = mkdtempSync(join(tmpdir(), 'proto-eda-gerber-'));
const bundle = exportFabBundle(board);
for (const [name, body] of Object.entries(bundle)) {
  assertStructure(name, body);
  writeFileSync(join(dir, name), body);
}
console.log('Estrutura Gerber/Excellon: OK');

const gerbv = spawnSync('gerbv', ['--version'], { encoding: 'utf8' });
if (gerbv.error || gerbv.status !== 0) {
  if (process.env.GERBER_STRICT === '1') {
    console.error('GERBER_STRICT=1 mas gerbv não está instalado.');
    process.exit(1);
  }
  console.log('gerbv ausente — só validação estrutural.');
  process.exit(0);
}

const png = join(dir, 'top.png');
const batch = spawnSync('gerbv', ['-B', '-o', png, join(dir, 'top.gtl')], {
  encoding: 'utf8',
  env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
});
if (batch.status !== 0 || !existsSync(png)) {
  console.error('gerbv batch falhou:', batch.stderr || batch.stdout);
  process.exit(1);
}
try { unlinkSync(png); } catch { /* ignore */ }
console.log('gerbv parse/export batch: OK');
