# 14: Bundles do editor Std 6.5.61 (rodada 5)

**Fonte:** versões desminificadas de forma conservadora pelo usuário (`semantic-js-bundle.zip`). Os arquivos brutos ficam fora do pacote, em `/workspace/easyeda-raw/std-editors/`. O relatório do usuário garante literais, chaves e propriedades inalterados (`node --check` e fingerprint AST: PASS).

**Nomes:** identificadores como `md5Hash`, `querySelectorSafe` e `getOrSetAttribute` foram **renomeados pelo usuário**. As evidências abaixo se apoiam em **literais e propriedades originais** (`T.maxLength`, `"testClearance"`, `kruskalsMST`…), que não mudaram. As linhas se referem aos arquivos `.semantic.js`.

## Identificação (CONFIRMADA)
| Arquivo | sha256 (prefixo) | Linhas | Papel |
|---|---|---|---|
| editorSCH.semantic.js | 2575bc42072e7272 | 26.578 | editor de esquemático (cabeçalho `v6.5.61, build: 10/27/2026`) |
| editorPCB.semantic.js | 666cb21eac712e66 | 55.783 | editor de PCB |
| jsapi.semantic.js | b4d8ba3848516f72 | 30.243 | **API de extensões** (webpack, enums `LayerType`, `PadShape`…). **Não é um worker** |

Os workers rtree e drc não vieram como arquivo. O PCB os alimenta por `postMessage`, e o código do worker é injetado a partir de `#pcb.drcWorker.main`/`.dependence` (PCB L38315).

## G2, undo (FECHADO, CONFIRMADA)
- Há um objeto History único por editor, que é um iframe por documento/aba (o "por aba" é INFERIDA; ver abaixo). Está em SCH L22469–23060 e PCB L14850–15420, com código idêntico nos dois.
- **Limite de 120:** `T.maxLength = 120` (SCH L22472, PCB L14854). Em `save` (SCH L22514–22540), se `index >= maxLength-1`, faz `records.shift()` e corrige `savedIndex`. Um save novo trunca o redo (`records.length = index+1`).
- **Formato do registro:** comando tupla `[op, ids, a, b]`, com ops registradas por `defineUndoRedo` (SCH L22773–23040): `add`, `del`, `attr`, `attrpanel`, `node`, `text`, `move`, `rotate`, `copperArea` (no-op), `originXY`, `elePosition`. É um **híbrido**:
  - `attr` guarda o diff `{old}`/`{new}` (L22846);
  - `move` guarda o delta dx,dy, invertido no undo (L22993);
  - `del` e `add` **movem o próprio nó DOM** para um contêiner oculto e o devolvem depois (L22773);
  - `node` guarda **cópias clonadas do elemento** (`cloneNode`; mini-snapshot por elemento, L22932).
  - Não existem snapshots do documento inteiro.
- **Agrupamento:**
  - `startBatch`/`endBatch`/`saveBatch` acumulam em `_queueBatchRecords` e gravam um registro composto `[[…],[…]]` (L22607–22619). O undo de um composto roda em ordem reversa (`undoOne`, L22752).
  - `mergeSource`: saves consecutivos com a mesma origem e o mesmo `op` e `ids` são fundidos, mantendo o valor antigo original (L22524–22531).
- **Navegação:** `go(±n)`/`goTo(i)`. Erro durante undo chama `T.clear()` como proteção (L22646–22654).
- O **log de depuração** é separado, `logsMaxLength = 1000`.
- **Escopo:** a pilha é zerada ao carregar um documento (`T.clear`, SCH L11555). Isso, somado a um iframe por aba, indica **pilha por aba/documento** (INFERIDA).
- **No PCB**, depois de undo/redo: rebuild de ratline por rede (`ratLineMgr.buildGroupNets`) e de plane zones (L22722–22745).
- **Comparação com o Pro:** o Pro usa limite de 50, diff por atributo e `belongTabId`. O Std usa 120, tuplas híbridas e nós DOM. Mesma ideia de comandos; o Std não usa snapshots globais.

## G12, ratsnest (FECHADO, CONFIRMADA)
`ratLineMgr` (PCB L37136–37690):
1. `_createGraph` (L37234) monta um **grafo completo** O(n²) entre os pontos da rede (pads, vias e extremidades de trilha de `SIGNALS[net]`).
2. O peso vem de `getWeight` (L37255): **distância euclidiana ao quadrado**.
3. `kruskalsMST` (L37287), com union-find `Cs`:
   - une primeiro os pares já conectados por cobre (mesma trilha ou mesmo grupo de `transferConnectedNet`) e os marca `bTracked:true`;
   - ordena as demais arestas por peso e as adiciona até `count()==1`.
4. Há um `_doPrim` alternativo (L37338) que não é chamado pelo `buildOneNet`.
5. `buildGroupNets` (L37382) processa **lotes de 100 redes**, opcionalmente via `requestAnimationFrame`.

**Comparação com o Pro:** o Pro faz Delaunay + Kruskal entre clusters (O(n log n)). O Std faz Kruskal em grafo completo (O(n² log n)), com o mesmo resultado (MST euclidiana).

**Copper pour:** ClipperLib embutido (PCB L3140; união e offset L5996–6120). `copperAreaMgr.rebuildPlane` roda local. O G12 "pour" de docs/12 continua coerente (CONFIRMADA: Clipper presente).

## G4, autorouter (PARCIAL, CONFIRMADA no editor)
- Os bundles **não contêm WebSocket**: zero ocorrências de `WebSocket` e `ws://` nos 3 arquivos. O transporte fica no frame pai, que não foi enviado: segue DESCONHECIDO.
- O editor expõe ao pai, pela API (PCB L46540, L46793):
  - `exportDSN(config)` (L43726) gera **Specctra DSN** em texto, com as seções `(PCB '' (resolution mil N) (structure…) (placement…) (library…) (network…) (wiring…))`. Antes valida que os pads estão dentro do contorno (L44071).
  - `importSession(data, phase, config, unrouted, timeoutFlag, silent)` (L44080–44245) é um **protocolo incremental**:
    - `phase=="start"` abre um batch de histórico e remove as ratlines; um segundo "start" com sessão ativa dá erro "Cannot start again…";
    - cada chamada traz um JSON `{<k>:{net, wires:{…{layerid, points[]}}, vias:{…{x,y}}}}` e insere polylines (`c_etype:"wire"`) e vias;
    - `phase=="end"` recalcula, mostra `showAutoRouteResultDlg` (pinos, roteados %, vias) ou "Router is time out.", e chama `saveBatch` (todo o roteamento vira **um** passo de undo).
- **Sequência inferida:** o pai chama `exportDSN` → envia ao servidor (WS) → repassa as mensagens parciais a `importSession(…,"start")`, depois mensagens intermediárias, depois `"end"`.
- **Comparação com o Pro:** o Pro roteia localmente em WASM a partir do JSON "pangolin". O Std usa DSN para um servidor remoto.

## G1, DOM do editor (FECHADO, CONFIRMADA)
Cada editor é um SVG com grupos de id fixo (contagens de `getElementById` nos dois bundles):
- **Comuns:** `g1` (camadas), `gCurParts` (raiz dos objetos), `selectionBox`, `gMarkError`, a grade (`grid1`, `gridPattern`/`gridPattern2`, `gridCell`/`gridCell2`, `gridBg`, `gridOH`/`gridOV`), `pdot0` e `shadow-*`.
- **Só no SCH:** `gMessageBar`, `part_arrowhead`, `cross-x-big`/`cross-y-big`.
- **Só no PCB:** `pcblayerStyle`/`pcbNetStyle` (CSS por camada e por rede); `topSilkLayer`/`bottomSilkLayer`, `topSignalReal`/`bottomSignalReal` e `masker-topLayer`/`masker-bottomLayer` (camadas); `gDrcDots`, `gIntelligentRulerPosition`, `part_diff` e `libMasker`.
- As primitivas são elementos SVG com atributos `c_etype`, `c_shapetype`, `layerid` e `net`. As polylines de cada camada ficam sob `.shapeBox` (PCB L44195).

## G10, DRC (FECHADO, CONFIRMADA)
- O módulo `ge` fica em PCB L38139–39750.
- **DRC completo** (`doDRC`, L38145), executado em sequência: `_testTrackSize` (trackWidth, trackLength por regra de rede), `_testHole` (holeSize, holeOuterSize), `_testBoardOutline` (obj2Boardoutline), `_testClearance` e `_errorTree`.
- **Com callback**, a clearance roda num **Web Worker**: `postMessage({type:"testClearance", data:{trees, nodeIndex, bboxCache, gJsonCache, LAYERTYPE, …}, dependence:[…]})`, com respostas `progress`/`testClearanceDone` (L38271–38318).
- **DRC em tempo real** (`doRealtimeDRC`, L38159): ativo se `DRCRULE.isRealtime`; testa só o objeto editado contra a R-tree (`_testOneNode`).
- **Geometria:** `_isSegmentToSegmentNearerThan`, `_isCircleToPolygonNearerThan`, `_isPolygonToPolygonOverlap`, `_checkClearanceBetweenArcAnd{Point,Line,Arc}` e pad oval decomposto em formas base (L39295–39330).
- **R-tree:** biblioteca `rbush` (L2713). Um worker reconstrói as árvores (`RTreeMgr.rebuild` → `RTreeMgr.result`, com `trees[...].fromJSON`, L23105–23125).
- **Comparação com o Pro:** a clearance do Std cobre apenas track, hole, outline e clearance. O Pro acrescenta creepage, par diferencial, net length, blind e outros.

## Outros
- **Junção no SCH** (`addJunction`/`removeJunction`/`solveJunction`/`checkJunctionValid`, L18922–19246): a regra é `needJunction(a,b) = a>=3 || (a>=1 && b>=1)`. A leitura provável é "3 ou mais extremidades, ou extremidade sobre o meio de um fio" (semântica dos argumentos INFERIDA).
- **API REST do editor** (PCB L6946+): `/api/projects/...` e `simulation: "/api/documents/{uuid}/simulate"`. Isso confirma que a **simulação do Std é feita no servidor via REST** (G8), diferente do app externo do Pro.
- O histórico emite `triggerEvent("history_change", len, index, unsaved, waiting)` para a UI pai.
