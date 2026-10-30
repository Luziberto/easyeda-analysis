# AGENTS.md — easyeda-analysis

Repositório de pesquisa + protótipo EDA (`prototype/`) e ferramentas de espelho da biblioteca LCSC/EasyEDA (`tools/easyeda-lib-sync/`).

## Cursor Cloud — pull da biblioteca LCSC

Objetivo: popular `data/easyeda-components.sqlite` (gitignored) e opcionalmente `prototype/lcsc-library.json` para o painel **Biblioteca LCSC** no protótipo.

### Comando principal (retomável)

```bash
node --experimental-sqlite tools/easyeda-lib-sync/pull.mjs --max-minutes 240
```

Cloud Agent / cron (loop até completo):

```bash
bash tools/easyeda-lib-sync/pull-slice.sh 240
```

- **Exit 0** — crawl completo (36 tokens), fetch esgotado, export feito.
- **Exit 2** — tempo esgotado ou fila a meio; **reexecutar o mesmo comando** na mesma máquina/volume para retomar (`crawl_progress` + SQLite).
- Logs: `data/lib-sync-pull.log` · estado: `data/lib-sync-status.json`

### Variáveis (secrets no dashboard Cloud Agents)

| Variável | Uso |
|----------|-----|
| `EASYEDA_COOKIE` ou `EASYEDA_COOKIE_FILE` | Opcional; biblioteca user / `wd=*`. **Nunca commitar.** |
| `LIB_SYNC_DELAY` | Pausa search/fetch (default `400`) |
| `LIB_SYNC_FETCH_SLICE` | Uuids por fatia de fetch (default `800`) |
| `LIB_SYNC_CLASSIFY_SLICE` | Peças por fatia classify (default `150`) |
| `LIB_SYNC_CLASSIFY_DELAY` | Pausa product/search (default `600`) |
| `LIB_SYNC_SKIP_CLASSIFY=1` | Ignorar classify se `product/search` der 403 |

### Rate limit (confirmado localmente)

- **Um** pedido de cada vez; delay **≥ 400 ms** em `components/search` e `searchByIdAndPre`.
- Não usar paralelismo agressivo (50+ concurrent → HTTP 429).
- `tools/easyeda-lib-sync/probe-rate-limit.mjs` — sonda rápida se a API mudar.

### Fases manuais (debug)

```bash
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs catalog
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs crawl --depth 1 --delay 400
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs fetch --batch 15 --delay 400
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs classify --delay 600
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs export-json
node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs stats
```

Documentação: `tools/easyeda-lib-sync/README.md`

### O que **não** commitar

- `data/*.sqlite`, `data/lib-sync-pull.log`, cookies, `.env`
- `prototype/lcsc-library.json` (gerado; grande em pulls completos)

### Protótipo (validação UI)

```bash
cd prototype && npm ci && npm run build && python3 -m http.server 8080
```

Abrir o protótipo e usar o ícone **Biblioteca LCSC** no header (requer `lcsc-library.json` exportado).

### CI local (código, não pull)

```bash
cd prototype && npm test
```
