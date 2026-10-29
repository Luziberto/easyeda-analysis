# Espelho SQLite — biblioteca EasyEDA (LCSC)

Ferramenta de **pesquisa/replicação local** para o repositório `easyeda-analysis`. Não substitui a API oficial.

## Limitações da API (confirmadas)

| Regra | Detalhe |
|--------|---------|
| `wd` vazio | Erro `searchKeyword can't empty` |
| Paginação | Use **`page`** + **`limit=100`** (`pageNum`/`pageSize` **não** avançam páginas) |
| “Base inteira” | Não existe dump sem filtro; cobertura = união de muitas keywords (`a`–`z`, `0`–`9`, bigramas opcionais) |
| Licença | Dados oficiais LCSC/EasyEDA têm restrições — ver resposta `license` em `dataStr.head`. Uso por tua conta. |

## Setup

```bash
# Cookie (opcional, para wd=* / biblioteca user) — NUNCA commitar
export EASYEDA_COOKIE='easyeda_session=...; loginSession=...'
# ou
export EASYEDA_COOKIE_FILE=$HOME/.config/easyeda/cookie.txt

mkdir -p data
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs crawl --depth 1 --delay 400
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs fetch --batch 15 --limit 5000
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs stats
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs catalog
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs classify --limit 500 --delay 400
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs export-json
cd prototype && npm run build && python3 -m http.server 8081
```

### Classificação (árvore LCSC)

1. **`catalog`** — importa `GET /api/eda/catalog/tree` (~1798 nós, caminho `path_en` tipo `Switches > Toggle Switches`).
2. **`classify`** — para cada `lcsc_number`, `GET /api/eda/product/search?keyword=C…` lê `paramList` → **Category** e associa ao nó por `name_en` (10 nomes duplicados na árvore → `classify_error=ambiguous_name:…`).

Colunas em **`components`**: `lcsc_category`, `catalog_id`, `catalog_path`, `classified_at`, `classify_error`.

3. **`export-json`** — gera `prototype/lcsc-library.json` para o painel **Biblioteca LCSC** no protótipo (ícone `library_books` no header).

## SQLite

Ficheiro default: `data/easyeda-components.sqlite`

- **`components`**: metadados da busca + `head_json`; após `fetch`, `datastr_json` completo (docType 2); após `classify`, `catalog_path` / `lcsc_category`.
- **`catalogs`**: árvore LCSC importada por `catalog`.
- **`crawl_progress`**: retoma por token `wd`.

## Teste curto

```bash
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs crawl --wd a --max-pages 2
```

## Cloud Agents (pull completo)

```bash
node --experimental-sqlite tools/easyeda-lib-sync/pull.mjs --max-minutes 240
```

Repetir até exit `0`. Ver `AGENTS.md` e `data/lib-sync-status.json`. Classify opcional: `LIB_SYNC_SKIP_CLASSIFY=1` se `product/search` retornar 403.

## Detalhe completo

`POST /api/components/searchByIdAndPre` com `uuids[i][uuid]`, `uuids[i][bindPCBId]` (= uuid), `uuids[i][datastrid]` (placeholder aceite).
