#!/usr/bin/env node
/**
 * Espelho local da biblioteca EasyEDA (LCSC) em SQLite.
 * API: POST /api/components/search (wd obrigatório; paginação page + limit).
 * Detalhe: POST /api/components/searchByIdAndPre
 *
 * Cookie (opcional): EASYEDA_COOKIE ou ficheiro EASYEDA_COOKIE_FILE — nunca commitar.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dir = dirname(fileURLToPath(import.meta.url));
const VERSION = '6.5.61';
const SEARCH_URL = 'https://easyeda.com/api/components/search';
const FETCH_URL = 'https://easyeda.com/api/components/searchByIdAndPre';
const CATALOG_TREE_URL = 'https://easyeda.com/api/eda/catalog/tree';
const PRODUCT_SEARCH_URL = 'https://easyeda.com/api/eda/product/search';
const DEFAULT_DB = resolve(__dir, '../../data/easyeda-components.sqlite');
const PAGE_LIMIT = 100;

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function usage() {
  console.log(`Uso:
  node --experimental-sqlite ${__dir}/sync.mjs crawl [opções]
  node --experimental-sqlite ${__dir}/sync.mjs fetch [opções]
  node --experimental-sqlite ${__dir}/sync.mjs stats
  node --experimental-sqlite ${__dir}/sync.mjs catalog
  node --experimental-sqlite ${__dir}/sync.mjs classify [opções]
  node --experimental-sqlite ${__dir}/sync.mjs export-json [opções]

Export-json:
  --out PATH         JSON para o protótipo (default: prototype/lcsc-library.json)

Catalog:
  Importa árvore LCSC (GET /api/eda/catalog/tree) → tabela catalogs.

Classify:
  --limit N          Máximo de componentes nesta execução
  --delay MS         Pausa entre pedidos LCSC (default 400)
  --force            Reclassifica mesmo com catalog_id já definido
  Por lcsc_number: product/search → Category → match name_en na árvore.

Crawl:
  --db PATH          SQLite (default: data/easyeda-components.sqlite)
  --depth 1|2        Tokens de busca: 1=36 chars, 2=+bigramas (default 1)
  --wd TOKEN         Só um token (ignora --depth)
  --max-pages N      Limite por token (debug)
  --delay MS         Pausa entre pedidos (default 350)
  --include-star     Inclui wd=* (requer cookie; biblioteca user)

Fetch (dataStr completo):
  --batch N          Uuids por pedido searchByIdAndPre (default 15)
  --limit N          Máximo de componentes a buscar nesta execução
  --delay MS

Variáveis: EASYEDA_COOKIE ou EASYEDA_COOKIE_FILE`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1';
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

function loadCookie() {
  if (process.env.EASYEDA_COOKIE?.trim()) return process.env.EASYEDA_COOKIE.trim();
  const f = process.env.EASYEDA_COOKIE_FILE;
  if (f && existsSync(f)) return readFileSync(f, 'utf8').trim();
  return '';
}

function searchTokens(depth, singleWd) {
  if (singleWd) return [singleWd];
  const t = [...CHARS];
  if (String(depth) === '2') {
    for (const a of CHARS) for (const b of CHARS) t.push(a + b);
  }
  return t;
}

function openDb(path) {
  const db = new DatabaseSync(path);
  db.exec(readFileSync(resolve(__dir, 'schema.sql'), 'utf8'));
  migrateComponents(db);
  return db;
}

function migrateComponents(db) {
  const cols = new Set(db.prepare('PRAGMA table_info(components)').all().map((c) => c.name));
  const add = (sql) => {
    db.exec(sql);
  };
  if (!cols.has('lcsc_category')) add('ALTER TABLE components ADD COLUMN lcsc_category TEXT');
  if (!cols.has('catalog_id')) add('ALTER TABLE components ADD COLUMN catalog_id INTEGER');
  if (!cols.has('catalog_path')) add('ALTER TABLE components ADD COLUMN catalog_path TEXT');
  if (!cols.has('classified_at')) add('ALTER TABLE components ADD COLUMN classified_at INTEGER');
  if (!cols.has('classify_error')) add('ALTER TABLE components ADD COLUMN classify_error TEXT');
}

function getJsonHeaders(cookie) {
  const h = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: 'https://easyeda.com',
    Referer: 'https://easyeda.com/editor',
    'User-Agent': 'easyeda-analysis-lib-sync/1.0 (+research; respectful rate limit)',
  };
  if (cookie) h.Cookie = cookie;
  return h;
}

async function getJson(url, cookie) {
  const res = await fetch(url, { headers: getJsonHeaders(cookie) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Resposta não-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (json.success === false) {
    throw new Error(String(json.message ?? json.code ?? 'API error'));
  }
  return json;
}

function apiHeaders(cookie) {
  const h = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: 'https://easyeda.com',
    Referer: 'https://easyeda.com/editor',
    'User-Agent': 'easyeda-analysis-lib-sync/1.0 (+research; respectful rate limit)',
  };
  if (cookie) h.Cookie = cookie;
  return h;
}

async function postForm(url, body, cookie) {
  const res = await fetch(url, { method: 'POST', headers: apiHeaders(cookie), body });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Resposta não-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!json.success) {
    const msg = json.message ?? json.code ?? JSON.stringify(json);
    throw new Error(String(msg));
  }
  return json;
}

function upsertComponent(db, item, bucket, wd) {
  const head = item.dataStr?.head ?? null;
  const cpara = head?.c_para ?? {};
  const lcsc = item.lcsc && typeof item.lcsc === 'object' ? item.lcsc : null;
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(`
    INSERT INTO components (
      uuid, title, doc_type, type_code, lcsc_id, lcsc_number, package, prefix,
      source_bucket, search_wd, thumb, update_time, head_json, raw_search_json, discovered_at
    ) VALUES (
      @uuid, @title, @doc_type, @type_code, @lcsc_id, @lcsc_number, @package, @prefix,
      @bucket, @wd, @thumb, @update_time, @head_json, @raw, @now
    )
    ON CONFLICT(uuid) DO UPDATE SET
      title = excluded.title,
      lcsc_number = COALESCE(excluded.lcsc_number, components.lcsc_number),
      package = COALESCE(excluded.package, components.package),
      update_time = COALESCE(excluded.update_time, components.update_time),
      head_json = COALESCE(excluded.head_json, components.head_json),
      raw_search_json = excluded.raw_search_json
  `);
  stmt.run({
    uuid: item.uuid,
    title: item.title ?? '',
    doc_type: item.docType ?? null,
    type_code: item.type ?? null,
    lcsc_id: lcsc?.id != null ? String(lcsc.id) : null,
    lcsc_number: lcsc?.number ?? item.szlcsc ?? null,
    package: cpara.package ?? null,
    prefix: cpara.pre ?? null,
    bucket,
    wd,
    thumb: item.thumb ?? null,
    update_time: item.updateTime ?? null,
    head_json: head ? JSON.stringify(head) : null,
    raw: JSON.stringify(item),
    now,
  });
}

async function crawlSearch(db, opts) {
  const cookie = loadCookie();
  const delay = Number(opts.delay ?? 350);
  const maxPages = opts['max-pages'] ? Number(opts['max-pages']) : Infinity;
  let tokens = searchTokens(opts.depth ?? 1, opts.wd);
  if (opts['include-star'] === '1' || opts['include-star'] === 'true') {
    if (!cookie) console.warn('Aviso: wd=* sem cookie pode não listar a tua biblioteca.');
    tokens = ['*', ...tokens];
  }

  const insertStmt = db.prepare(`
    INSERT INTO crawl_progress (wd, facet_lcsc, pages_total, pages_done, rows_inserted, done, updated_at)
    VALUES (@wd, @facet, @total, @done, @rows, @finished, @ts)
    ON CONFLICT(wd) DO UPDATE SET
      facet_lcsc = excluded.facet_lcsc,
      pages_total = excluded.pages_total,
      pages_done = excluded.pages_done,
      rows_inserted = excluded.rows_inserted,
      done = excluded.done,
      updated_at = excluded.updated_at
  `);

  for (const wd of tokens) {
    const prog = db.prepare('SELECT done, pages_done FROM crawl_progress WHERE wd = ?').get(wd);
    if (prog?.done) {
      console.log(`[skip] wd=${JSON.stringify(wd)} já concluído`);
      continue;
    }

    let page = (prog?.pages_done ?? 0) + 1;
    let facetLcsc = 0;
    let pagesTotal = 0;
    let rowsThisWd = 0;

    for (;;) {
      if (page > maxPages) {
        console.log(`[wd=${JSON.stringify(wd)}] parado em --max-pages=${maxPages}`);
        break;
      }
      const body = new URLSearchParams({
        type: '3',
        returnListStyle: 'classifyarr',
        wd,
        version: VERSION,
        page: String(page),
        limit: String(PAGE_LIMIT),
      });
      body.append('doctype[]', '2');

      const json = await postForm(SEARCH_URL, body.toString(), cookie);
      const lists = json.result?.lists ?? {};
      facetLcsc = json.result?.facets?.lcsc ?? facetLcsc;
      if (page === 1 && facetLcsc) pagesTotal = Math.ceil(facetLcsc / PAGE_LIMIT);

      let pageRows = 0;
      for (const bucket of ['lcsc', 'easyeda', 'SMT', 'user', 'mine', 'following']) {
        const arr = lists[bucket];
        if (!Array.isArray(arr) || !arr.length) continue;
        for (const item of arr) {
          if (!item?.uuid) continue;
          upsertComponent(db, item, bucket, wd);
          pageRows++;
        }
      }

      rowsThisWd += pageRows;
      console.log(
        `[wd=${JSON.stringify(wd)}] page ${page}/${pagesTotal || '?'} +${pageRows} (facet lcsc≈${facetLcsc})`,
      );

      insertStmt.run({
        wd,
        facet: facetLcsc,
        total: pagesTotal,
        done: page,
        rows: rowsThisWd,
        finished: 0,
        ts: Math.floor(Date.now() / 1000),
      });

      if (pageRows === 0) break;
      page++;
      await new Promise((r) => setTimeout(r, delay));
    }

    insertStmt.run({
      wd,
      facet: facetLcsc,
      total: pagesTotal,
      done: page - 1,
      rows: rowsThisWd,
      finished: 1,
      ts: Math.floor(Date.now() / 1000),
    });
    db.prepare(`INSERT INTO sync_meta (key, value) VALUES ('last_crawl_wd', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(wd);
  }
}

async function fetchDetails(db, opts) {
  const cookie = loadCookie();
  const batchSize = Math.min(50, Math.max(1, Number(opts.batch ?? 15)));
  const limit = opts.limit ? Number(opts.limit) : Infinity;
  const delay = Number(opts.delay ?? 400);

  const pending = db.prepare(`
    SELECT uuid FROM components WHERE datastr_json IS NULL AND fetch_error IS NULL
    ORDER BY discovered_at LIMIT ?
  `);

  let fetched = 0;
  while (fetched < limit) {
    const rows = pending.all(Math.min(batchSize, limit - fetched));
    if (!rows.length) break;

    const body = new URLSearchParams({ version: VERSION });
    rows.forEach((r, i) => {
      body.append(`uuids[${i}][uuid]`, r.uuid);
      body.append(`uuids[${i}][bindPCBId]`, r.uuid);
      body.append(`uuids[${i}][datastrid]`, 'sync');
    });

    try {
      const json = await postForm(FETCH_URL, body.toString(), cookie);
      const byUuid = new Map((json.result ?? []).map((x) => [x.uuid, x]));
      const upd = db.prepare(`
        UPDATE components SET datastr_json = ?, fetched_at = ?, fetch_error = NULL WHERE uuid = ?
      `);
      const errUpd = db.prepare(`UPDATE components SET fetch_error = ?, fetched_at = ? WHERE uuid = ?`);
      const now = Math.floor(Date.now() / 1000);
      for (const { uuid } of rows) {
        const hit = byUuid.get(uuid);
        if (hit?.dataStr) {
          upd.run(JSON.stringify(hit.dataStr), now, uuid);
        } else {
          errUpd.run('missing in searchByIdAndPre', now, uuid);
        }
      }
      fetched += rows.length;
      console.log(`[fetch] ${fetched} uuids processados (lote ${rows.length})`);
    } catch (e) {
      console.error('[fetch] erro:', e.message);
      const errUpd = db.prepare(`UPDATE components SET fetch_error = ?, fetched_at = ? WHERE uuid = ?`);
      const now = Math.floor(Date.now() / 1000);
      for (const { uuid } of rows) errUpd.run(String(e.message).slice(0, 500), now, uuid);
      fetched += rows.length;
    }
    await new Promise((r) => setTimeout(r, delay));
  }
}

function flattenCatalogTree(nodes, parentPath = []) {
  const rows = [];
  for (const n of nodes ?? []) {
    const name = (n.catalogNameEn || n.catalogName || '').trim();
    if (!name || n.catalogId == null) continue;
    const pathParts = [...parentPath, name];
    const sons = n.sonList ?? [];
    rows.push({
      catalog_id: n.catalogId,
      parent_id: n.parentId ?? null,
      name_en: name,
      name_cn: n.catalogNameCn ?? null,
      path_en: pathParts.join(' > '),
      depth: pathParts.length,
      is_leaf: sons.length ? 0 : 1,
    });
    if (sons.length) rows.push(...flattenCatalogTree(sons, pathParts));
  }
  return rows;
}

async function importCatalog(db) {
  const url = `${CATALOG_TREE_URL}?version=${VERSION}`;
  const json = await getJson(url, loadCookie());
  const roots = json.result;
  if (!Array.isArray(roots)) throw new Error('catalog/tree: result inesperado');
  const rows = flattenCatalogTree(roots);
  const now = Math.floor(Date.now() / 1000);
  db.exec('DELETE FROM catalogs');
  const ins = db.prepare(`
    INSERT INTO catalogs (catalog_id, parent_id, name_en, name_cn, path_en, depth, is_leaf, imported_at)
    VALUES (@catalog_id, @parent_id, @name_en, @name_cn, @path_en, @depth, @is_leaf, @now)
  `);
  for (const r of rows) ins.run({ ...r, now });
  db.prepare(`INSERT INTO sync_meta (key, value) VALUES ('catalog_imported_at', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(now));
  db.prepare(`INSERT INTO sync_meta (key, value) VALUES ('catalog_node_count', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(rows.length));
  console.log(`[catalog] ${rows.length} nós importados (${rows.filter((r) => r.is_leaf).length} folhas)`);
}

function categoryFromProductSearch(json) {
  const list = json.result?.paramList;
  if (!Array.isArray(list)) return null;
  const hit = list.find((p) => p.parameterName === 'Category');
  const v = hit?.parameterValueList?.[0];
  return v ? String(v).trim() : null;
}

function resolveCatalogForCategory(db, categoryName) {
  const matches = db
    .prepare(
      `SELECT catalog_id, path_en, is_leaf FROM catalogs
       WHERE name_en = ? COLLATE NOCASE ORDER BY is_leaf DESC, depth DESC`,
    )
    .all(categoryName);
  if (matches.length === 1) {
    return { catalog_id: matches[0].catalog_id, catalog_path: matches[0].path_en };
  }
  if (matches.length > 1) {
    const leaves = matches.filter((m) => m.is_leaf);
    const pick = leaves.length === 1 ? leaves[0] : matches[0];
    return {
      catalog_id: pick.catalog_id,
      catalog_path: pick.path_en,
      classify_error: leaves.length === 1 ? null : `ambiguous_name:${categoryName}`,
    };
  }
  return { classify_error: `no_catalog_match:${categoryName}` };
}

async function classifyComponents(db, opts) {
  const delay = Number(opts.delay ?? 400);
  const limit = opts.limit ? Number(opts.limit) : Infinity;
  const force = opts.force === '1' || opts.force === 'true';
  const catalogCount = db.prepare('SELECT COUNT(*) AS n FROM catalogs').get().n;
  if (!catalogCount) {
    throw new Error('Tabela catalogs vazia — corre primeiro: sync.mjs catalog');
  }

  const where = force
    ? 'lcsc_number IS NOT NULL AND lcsc_number != \'\''
    : `lcsc_number IS NOT NULL AND lcsc_number != ''
       AND catalog_id IS NULL AND (classify_error IS NULL OR classify_error LIKE 'ambiguous_%')`;
  const pending = db.prepare(`
    SELECT uuid, lcsc_number FROM components WHERE ${where}
    ORDER BY classified_at IS NOT NULL, discovered_at LIMIT ?
  `);
  const upd = db.prepare(`
    UPDATE components SET
      lcsc_category = @lcsc_category,
      catalog_id = @catalog_id,
      catalog_path = @catalog_path,
      classified_at = @ts,
      classify_error = @classify_error
    WHERE uuid = @uuid
  `);

  let done = 0;
  while (done < limit) {
    const batch = pending.all(Math.min(50, limit - done));
    if (!batch.length) break;
    for (const { uuid, lcsc_number } of batch) {
      const ts = Math.floor(Date.now() / 1000);
      try {
        const q = new URL(PRODUCT_SEARCH_URL);
        q.searchParams.set('version', VERSION);
        q.searchParams.set('keyword', lcsc_number);
        q.searchParams.set('pageNum', '1');
        q.searchParams.set('pageSize', '1');
        const json = await getJson(q.toString(), loadCookie());
        const total = json.result?.total ?? 0;
        if (!total) {
          upd.run({
            uuid,
            lcsc_category: null,
            catalog_id: null,
            catalog_path: null,
            ts,
            classify_error: 'lcsc_not_found',
          });
          console.log(`[classify] ${lcsc_number} → lcsc_not_found`);
          done++;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        const category = categoryFromProductSearch(json);
        if (!category) {
          upd.run({
            uuid,
            lcsc_category: null,
            catalog_id: null,
            catalog_path: null,
            ts,
            classify_error: 'no_category_param',
          });
          console.log(`[classify] ${lcsc_number} → no_category_param`);
          done++;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        const resolved = resolveCatalogForCategory(db, category);
        upd.run({
          uuid,
          lcsc_category: category,
          catalog_id: resolved.catalog_id ?? null,
          catalog_path: resolved.catalog_path ?? null,
          ts,
          classify_error: resolved.classify_error ?? null,
        });
        const tag = resolved.catalog_path ?? resolved.classify_error ?? '?';
        console.log(`[classify] ${lcsc_number} → ${category} → ${tag}`);
      } catch (e) {
        upd.run({
          uuid,
          lcsc_category: null,
          catalog_id: null,
          catalog_path: null,
          ts,
          classify_error: String(e.message).slice(0, 500),
        });
        console.error(`[classify] ${lcsc_number} erro:`, e.message);
      }
      done++;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  console.log(`[classify] concluído: ${done} componentes`);
}

function buildNestedCatalogTree(rows) {
  const byId = new Map();
  for (const r of rows) {
    byId.set(r.catalog_id, {
      id: r.catalog_id,
      parentId: r.parent_id,
      name: r.name_en,
      path: r.path_en,
      leaf: !!r.is_leaf,
      children: [],
    });
  }
  const roots = [];
  for (const r of rows) {
    const node = byId.get(r.catalog_id);
    const parent = r.parent_id != null ? byId.get(r.parent_id) : null;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

function exportLibraryJson(db, opts) {
  const outPath = resolve(opts.out ?? resolve(__dir, '../../prototype/lcsc-library.json'));
  mkdirSync(dirname(outPath), { recursive: true });
  const catalogRows = db
    .prepare('SELECT catalog_id, parent_id, name_en, path_en, is_leaf FROM catalogs ORDER BY depth, name_en')
    .all();
  if (!catalogRows.length) {
    throw new Error('Sem catálogo — corre: sync.mjs catalog');
  }
  const components = db
    .prepare(`
      SELECT uuid, title, lcsc_number, package, catalog_id, catalog_path, lcsc_category, thumb
      FROM components
      ORDER BY COALESCE(catalog_path, ''), title
    `)
    .all();
  const payload = {
    meta: {
      exported_at: Math.floor(Date.now() / 1000),
      catalog_nodes: catalogRows.length,
      component_count: components.length,
      classified: components.filter((c) => c.catalog_id != null).length,
    },
    catalogTree: buildNestedCatalogTree(catalogRows),
    components: components.map((c) => ({
      uuid: c.uuid,
      title: c.title,
      lcsc: c.lcsc_number,
      package: c.package,
      catalogId: c.catalog_id,
      catalogPath: c.catalog_path,
      category: c.lcsc_category,
      thumb: c.thumb,
    })),
  };
  writeFileSync(outPath, JSON.stringify(payload));
  console.log(`[export-json] ${components.length} componentes → ${outPath}`);
}

function stats(db) {
  const total = db.prepare('SELECT COUNT(*) AS n FROM components').get().n;
  const withData = db.prepare('SELECT COUNT(*) AS n FROM components WHERE datastr_json IS NOT NULL').get().n;
  const tokensDone = db.prepare('SELECT COUNT(*) AS n FROM crawl_progress WHERE done = 1').get().n;
  const tokensAll = db.prepare('SELECT COUNT(*) AS n FROM crawl_progress').get().n;
  const catalogNodes = db.prepare('SELECT COUNT(*) AS n FROM catalogs').get().n;
  const classified = db.prepare('SELECT COUNT(*) AS n FROM components WHERE catalog_id IS NOT NULL').get().n;
  const withLcsc = db.prepare(`SELECT COUNT(*) AS n FROM components WHERE lcsc_number IS NOT NULL AND lcsc_number != ''`).get()
    .n;
  const classifyErrors = db
    .prepare(`SELECT classify_error, COUNT(*) AS n FROM components WHERE classify_error IS NOT NULL GROUP BY classify_error ORDER BY n DESC LIMIT 8`)
    .all();
  console.log(
    JSON.stringify(
      {
        total,
        with_full_datastr: withData,
        crawl_tokens_done: tokensDone,
        crawl_tokens_started: tokensAll,
        catalog_nodes: catalogNodes,
        with_lcsc_number: withLcsc,
        classified_with_catalog_id: classified,
        classify_errors_top: classifyErrors,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || cmd === 'help' || args.help) {
    usage();
    process.exit(cmd ? 0 : 1);
  }

  const dbPath = resolve(args.db ?? DEFAULT_DB);
  const db = openDb(dbPath);
  console.log('DB:', dbPath);

  if (cmd === 'crawl') await crawlSearch(db, args);
  else if (cmd === 'fetch') await fetchDetails(db, args);
  else if (cmd === 'catalog') await importCatalog(db);
  else if (cmd === 'classify') await classifyComponents(db, args);
  else if (cmd === 'export-json') exportLibraryJson(db, args);
  else if (cmd === 'stats') stats(db);
  else {
    usage();
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
