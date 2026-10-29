CREATE TABLE IF NOT EXISTS components (
  uuid TEXT PRIMARY KEY,
  title TEXT,
  doc_type INTEGER,
  type_code INTEGER,
  lcsc_id TEXT,
  lcsc_number TEXT,
  package TEXT,
  prefix TEXT,
  source_bucket TEXT NOT NULL DEFAULT 'lcsc',
  search_wd TEXT,
  thumb TEXT,
  update_time INTEGER,
  head_json TEXT,
  raw_search_json TEXT,
  discovered_at INTEGER NOT NULL,
  datastr_json TEXT,
  fetched_at INTEGER,
  fetch_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_components_unfetched ON components (fetched_at) WHERE datastr_json IS NULL;
CREATE INDEX IF NOT EXISTS idx_components_wd ON components (search_wd);

CREATE TABLE IF NOT EXISTS crawl_progress (
  wd TEXT PRIMARY KEY,
  facet_lcsc INTEGER,
  pages_total INTEGER,
  pages_done INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS catalogs (
  catalog_id INTEGER PRIMARY KEY,
  parent_id INTEGER,
  name_en TEXT NOT NULL,
  name_cn TEXT,
  path_en TEXT NOT NULL,
  depth INTEGER NOT NULL,
  is_leaf INTEGER NOT NULL DEFAULT 0,
  imported_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalogs_name_en ON catalogs (name_en);
CREATE INDEX IF NOT EXISTS idx_catalogs_path ON catalogs (path_en);
