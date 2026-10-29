# 13: Cliente desktop fornecido pelo usuário (rodada 4)

**Achado principal: o pacote não é o EasyEDA Standard.** É o **EasyEDA Pro 3.2.209** para Linux x64, build 21/10/2026 (CONFIRMADA: `resources/app/package.json` → `productName: EasyEDA_Pro`, `version: 3.2.209.8a704eab`; `version.txt`).

O Pro é outro produto, com código diferente do Std web 6.5.61. Por isso, tudo abaixo descreve o **Pro**. Os achados só valem para o Std como **analogia**, rotulada INFERIDA, e isso vale também para G2 e G12. Os bundles Std `editorSCH`/`editorPCB` **não estão** no pacote.

Os arquivos brutos ficam fora do entregável, em `/workspace/easyeda-desktop/`. Nada foi executado e não houve contato com easyeda.com. A extração foi feita com `unzip`; strings, regex e sqlite3 foram lidos em modo somente leitura. Os offsets são posições de caractere no arquivo indicado.

## Inventário (CONFIRMADA)
| Item | Valor |
|---|---|
| Pacote | zip de 330.514.267 B, sha256 `660f84dc8e4cf5d1…`, 588 entradas, raiz `easyeda-pro/` |
| Electron / Chromium | **36.3.1 / 136.0.7103.113** (strings do binário `easyeda-pro`, sha256 `2272fce190ffbd71…`) |
| asar | não há `app.asar`; o app vem **descompactado** em `resources/app/` (`app.js` 2,6 MB, main process). Só existe o `default_app.asar` padrão do Electron |
| Módulos nativos | só `sqlite3` (`node_sqlite3.node`, napi-v3, linux-x64) |
| WASM | `PCBRouter-*.wasm` (560 KB) e `jrouter-*.wasm` (1,9 MB), que são autorouters; `occapi-*.wasm` (24,9 MB), provavelmente OpenCascade para STEP/3D |
| Banco local | `assets/db/easyeda-std.elib` (474 MB, SQLite 3). Tem 21.607 `components`, 16.840 `devices`, 647 `categories` e índices FTS próprios (`component_fts_inv_idx`, 1,7 M linhas; `device_fts_inv_idx`, 5,2 M). Também traz tabelas de projeto vazias (projects, documents, project_histories, branches, coppers…), ou seja, o mesmo schema do modo offline. `example-projects.zip` tem 5 `.eprj` |
| Módulos versionados | pro-ui 3.2.198, pro-sch 3.2.193, pro-pcb 3.2.195, pro-mgr 3.2.185, pro-panel 3.2.172, pro-api 0.3.59, smt-gl-engine 3.2.56, chameleon 3.2.66, jerboa 2.0.2, ocr-wizard 0.1.73. A lista de carga por tipo de janela está em `editor.ini` |
| Workers PCB | `drcWorker.js`, `ratlineworker.js`, `pcbRouterWorker.js`, `decodeWorker.js`, `pcb-comparison-worker.js`, `zipWorker.js`, `worker.js` |
| Workers SCH | `sch-auto-wiring-worker.js`, `worker.js` |
| Workers do gerenciador | `project-worker`, `snapshots-worker`, `cache-worker`, `lib-worker`, `ws-service` |
| Main process | intercepta `protocol.handle("http"/"https")` (app.js @2629794) e atende localmente as URLs `localhost`. IPC: client-setting, control, focusWindow, getWinId, openWindow, openWindowSelf. Usa `child_process` |
| Portas locais citadas (só clientes) | `localhost:17965` (simulação), `localhost:56889` (DFM), `ws://127.0.0.1:49620` (exemplo da API de extensões `sys_WebSocket`). **Não** aparece 3579 nem nenhum `listen(` no app.js |

## G2, undo (CONFIRMADA no Pro; para o Std, só INFERIDA por analogia)
- **SCH** (`pro-sch/…/sch.js`, sha `b88ad265…`): o histórico usa **padrão Command**, com `_undoCommands` e `_redoCommands`.
  - **`maxLength=50`** (@4176499). Ao gravar (`_record`, @4179250), faz push e `shift()` quando passa de 50, e zera o redo.
  - `undo(n)`/`redo(n)` (@4177015) movem comandos entre as pilhas.
  - Agrupamento via `batchSaveStack` + `_createGroupHistoryCommand`.
  - Os comandos são **diffs por modelo**: `getModelHistoryCommand`/`initOldData(old,new)` e `docManagerAttrCommand.update(key,new,old)` (@4181161), **não snapshots**.
  - O histórico fica preso à aba dona (`belongTabId`).
- **PCB** (`pcb.js`, sha `a84059…`): usa comandos compostos (`addCommand(dispatch…)` → `executeCommand`, @10206308).
  - Há gerenciadores de pilha locais por ferramenta (`undoCommand`/`redoCommand`, @5723144).
  - A edição de polígono usa **mementos (snapshots)** (`PolygonMemento`, @8401078).
  - O limite global do PCB não foi localizado (DESCONHECIDA).
- Projeto: `project-worker` mantém `historyIndex`, `rollbackHistoryIndex` e `historyNodeLimit`. São versões persistidas, separadas do undo de edição.

## G12, ratsnest (CONFIRMADA no Pro)
`ratlineworker.js` (sha `011f5a8e…`):
- `getRatlineData` (@3968046): decodifica as primitivas VIA, PAD, LINE, ARC, POLY, FILL, POURED e TEARDROP e agrupa em **clusters de cobre conectado**.
- `getMaters` (@2328501): faz a **triangulação de Delaunay** dos pontos de junção dos clusters e guarda, para cada par de clusters, a aresta mais curta.
- `generateRatline`: ordena por comprimento² e roda **Kruskal com union-find** até `clusters−1` arestas.
- Resultado: **MST euclidiana sobre Delaunay**, entre clusters, não entre pads. O rebuild roda num worker via RPC `rebuildRatlineInWorker` (@4052156).
- Para o Std, é coerente com `routedGroupMap` (docs/12), mas segue INFERIDA.

## G4, autorouter (CONFIRMADA no Pro)
- O autorouter é **local, em WASM**, sem WebSocket.
- `pcb.js` @10224587 `autoRouting()` → `createPangolinJson(...)`. Publica `pangolin/autoRouting_wasm` ou, com `routingEffectPriority===0`, `pangolin/autoRoutingJR`. O payload é `{json, options:{VISUAL_DEBUG_TYPE, ROUTING_OPT_PATH_ALGO, STAGE}}`, com STAGE padrão 1000.
- O worker devolve `pcb/routerProgress` (stage, progress), `pcb/routerResult` e `pcb/routerInterrupt`. Timeout da chamada via API: 900 s.
- Config padrão (@10222835): routingRange, routingCorner, isKeep, viaQuatity, routingNetPriority, layers [1,2,12], ignoreLayers, ignoreNets.
- Engines carregados em `pcbRouterWorker.js` @852300 (PCBRouter) e @899000 (jrouter).
- O protocolo WS do autorouter **do Std** continua DESCONHECIDO.

## G8, simulação (CONFIRMADA no Pro)
- Dois engines: **ngspice** e **SimulIDE** (atributos `ngspice-attribute-property`/`simulide-attribute-property`; `ngspiceWaveform`).
- **Nenhum binário ngspice no pacote.** A simulação é um **app externo**: `pro-ui/…/ui.js` @10972870 (`connectToSimulationEngine`) testa `GET http://localhost:17965/eda_simulation_server?type=test`. Se falhar, abre `lceda-sim://open` e repete com retries. HTTP "Forbidden" significa que já existe um engine aberto.
- Comandos de UI: `start_sim` e `pause_sim`.
- O formato das respostas (`data`) é DESCONHECIDO. O Std (servidor) não muda.

## Extra: DRC do Pro (CONFIRMADA)
`drcWorker.js` cobre: Clearance, Creepage, DifferentPair (Gap, Length, Width), NetLength(Tolerance), Blind, Radius, Track, Prohibit, Connect e Netlist. É uma cobertura bem maior que a do Std (docs/12).

## Hashes (prefixo sha256)
app.js 52f51ce43cfebc81 · pcbRouterWorker fe07c79296ea0d61 · drcWorker 906a6f70bef4194c · PCBRouter.wasm b012d67ae36605a3 · jrouter.wasm d80c2fc1905e0452 · ui.js 3515d4c299b353fa · easyeda-std.elib 7bd571b9536ffc54
