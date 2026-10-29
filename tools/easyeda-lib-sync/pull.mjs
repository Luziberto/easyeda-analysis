#!/usr/bin/env node
/**
 * Orquestrador resumível do espelho LCSC — pensado para Cursor Cloud Agents.
 * Uma execução pode limitar tempo (--max-minutes); crawl/fetch retomam via SQLite.
 *
 * Uso:
 *   node --experimental-sqlite tools/easyeda-lib-sync/pull.mjs
 *   node --experimental-sqlite tools/easyeda-lib-sync/pull.mjs --max-minutes 180
 *
 * Env:
 *   LIB_SYNC_DELAY=400
 *   LIB_SYNC_FETCH_BATCH=15
 *   LIB_SYNC_FETCH_SLICE=800
 *   LIB_SYNC_CLASSIFY_SLICE=150
 *   LIB_SYNC_CLASSIFY_DELAY=600
 *   LIB_SYNC_SKIP_CLASSIFY=1   — só crawl + fetch + export
 *   EASYEDA_COOKIE / EASYEDA_COOKIE_FILE (opcional, secret no dashboard)
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const SYNC = resolve(__dir, 'sync.mjs');
const DEFAULT_DB = resolve(ROOT, 'data/easyeda-components.sqlite');
const LOG = resolve(ROOT, 'data/lib-sync-pull.log');
const STATUS = resolve(ROOT, 'data/lib-sync-status.json');
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      out[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1';
    } else out._.push(a);
  }
  return out;
}

function envNum(key, fallback) {
  const v = process.env[key];
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  appendFileSync(LOG, line);
}

function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  return new DatabaseSync(path);
}

function snapshot(db) {
  try {
    const total = db.prepare('SELECT COUNT(*) AS n FROM components').get().n;
    const withData = db.prepare('SELECT COUNT(*) AS n FROM components WHERE datastr_json IS NOT NULL').get().n;
    const tokensDone = db.prepare('SELECT COUNT(*) AS n FROM crawl_progress WHERE done = 1').get().n;
    const classified = db.prepare('SELECT COUNT(*) AS n FROM components WHERE catalog_id IS NOT NULL').get().n;
    const unfetched = db
      .prepare('SELECT COUNT(*) AS n FROM components WHERE datastr_json IS NULL AND fetch_error IS NULL')
      .get().n;
    return { total, withData, unfetched, tokensDone, tokensTarget: CHARS.length, classified };
  } catch {
    return { total: 0, withData: 0, unfetched: 0, tokensDone: 0, tokensTarget: CHARS.length, classified: 0 };
  }
}

function writeStatus(obj) {
  writeFileSync(STATUS, JSON.stringify({ updated_at: new Date().toISOString(), ...obj }, null, 2));
}

function runSync(cmd, args) {
  log(`→ sync.mjs ${cmd} ${args.join(' ')}`);
  const r = spawnSync(process.execPath, ['--experimental-sqlite', SYNC, cmd, ...args], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (r.stdout) appendFileSync(LOG, r.stdout);
  if (r.stderr) appendFileSync(LOG, r.stderr);
  if (r.status !== 0) {
    log(`✗ sync.mjs ${cmd} exit ${r.status}`);
    return false;
  }
  return true;
}

function timeUp(deadline) {
  return deadline > 0 && Date.now() >= deadline;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const maxMin = Number(args['max-minutes'] ?? 0);
  const deadline = maxMin > 0 ? Date.now() + maxMin * 60_000 : 0;
  const dbPath = resolve(args.db ?? DEFAULT_DB);
  const crawlDelay = String(envNum('LIB_SYNC_DELAY', 400));
  const fetchBatch = String(envNum('LIB_SYNC_FETCH_BATCH', 15));
  const fetchSlice = String(envNum('LIB_SYNC_FETCH_SLICE', 800));
  const classifySlice = String(envNum('LIB_SYNC_CLASSIFY_SLICE', 150));
  const classifyDelay = String(envNum('LIB_SYNC_CLASSIFY_DELAY', 600));
  const skipClassify = process.env.LIB_SYNC_SKIP_CLASSIFY === '1';

  mkdirSync(resolve(ROOT, 'data'), { recursive: true });
  log(`pull start db=${dbPath} max-minutes=${maxMin || '∞'} skip_classify=${skipClassify}`);

  if (!timeUp(deadline)) {
    log('phase: catalog');
    runSync('catalog', ['--db', dbPath]);
  }

  const db = openDb(dbPath);
  let snap = snapshot(db);
  writeStatus({ phase: 'after_catalog', ...snap });

  if (!timeUp(deadline)) {
    log('phase: crawl (tokens a-z0-9, retoma automática)');
    for (const wd of CHARS) {
      if (timeUp(deadline)) break;
      const prog = db.prepare('SELECT done FROM crawl_progress WHERE wd = ?').get(wd);
      if (prog?.done) continue;
      runSync('crawl', ['--db', dbPath, '--wd', wd, '--delay', crawlDelay]);
      snap = snapshot(db);
      writeStatus({ phase: 'crawl', last_wd: wd, ...snap });
    }
  }

  if (!timeUp(deadline)) {
    log('phase: fetch (lotes até esgotar tempo ou fila)');
    for (;;) {
      if (timeUp(deadline)) break;
      snap = snapshot(db);
      if (snap.unfetched === 0) {
        log('fetch: fila vazia');
        break;
      }
      if (!runSync('fetch', ['--db', dbPath, '--batch', fetchBatch, '--limit', fetchSlice, '--delay', crawlDelay])) {
        break;
      }
      snap = snapshot(db);
      writeStatus({ phase: 'fetch', ...snap });
      if (snap.unfetched === 0) break;
    }
  }

  if (!skipClassify && !timeUp(deadline)) {
    log('phase: classify (product/search — pode falhar com 403; retomável)');
    for (;;) {
      if (timeUp(deadline)) break;
      const pending = db
        .prepare(
          `SELECT COUNT(*) AS n FROM components WHERE lcsc_number IS NOT NULL AND lcsc_number != ''
           AND catalog_id IS NULL AND (classify_error IS NULL OR classify_error LIKE 'ambiguous_%')`,
        )
        .get().n;
      if (pending === 0) break;
      if (
        !runSync('classify', [
          '--db',
          dbPath,
          '--limit',
          classifySlice,
          '--delay',
          classifyDelay,
        ])
      ) {
        break;
      }
      snap = snapshot(db);
      writeStatus({ phase: 'classify', classify_pending: pending, ...snap });
    }
  }

  if (!timeUp(deadline)) {
    log('phase: export-json');
    runSync('export-json', ['--db', dbPath]);
  }

  snap = snapshot(db);
  runSync('stats', ['--db', dbPath]);
  const done =
    snap.tokensDone >= snap.tokensTarget && snap.unfetched === 0 && snap.withData === snap.total && snap.total > 0;
  writeStatus({ phase: done ? 'complete' : 'paused', ...snap, log: LOG, status_file: STATUS });
  log(
    done
      ? 'pull COMPLETE'
      : `pull paused (tokens ${snap.tokensDone}/${snap.tokensTarget}, components ${snap.total}, datastr ${snap.withData}, unfetched ${snap.unfetched})`,
  );
  process.exit(done ? 0 : 2);
}

main().catch((e) => {
  log(`fatal: ${e.message}`);
  process.exit(1);
});
