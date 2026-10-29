# 12 — Aprofundamento estático (rodada 3): G1, G2, G7, G10, G11, G12

**Método.** Só arquivos já baixados em rodadas anteriores (`easyeda-raw/assets`, fora do pacote) e o HAR sanitizado do usuário. **Nenhum contato com easyeda.com nesta rodada.** Os offsets são posições de caractere (decodificado em UTF-8) no arquivo indicado. Os trechos citados são só identificadores ou strings curtas; nenhum código proprietário foi copiado.

| Arquivo | sha256 (prefixo) |
|---|---|
| main.min.js | d68413a4a5ce8d11 |
| main.assets.min.js | 600812d7ae166c89 |
| jsapi.min.js | 627a35eeaeb76af7 |
| chameleonTool.min.js | 648dae87a2cc7cad |
| worker.main.min.js | b51c3d5b8ca42000 (banner v6.5.61, build 10/27/2026) |

**Limite estrutural.** Os motores das abas e os workers dedicados **não foram baixados** e não podem ser, sem novo fetch: `editorSCH.min.js`, `editorPCB.min.js`, `pcb.rtreeMgrWorker.*`, `pcb.ratLineMgrWorker.main`, `pcb.drcWorker.*`, `editor*.css`. Os nomes saem do HTML de `editorpage1/3` (HAR [27] e [49]). Tudo o que vive só nesses bundles continua DESCONHECIDO.

## G1 — DOM do editor (INFERIDA, estática; HTML do HAR + main.min.js)
- Cada documento abre num iframe; a URL é montada em main.min.js @916924 (`/htm/editorpage{N}.html`, variante `htm_cn`).
- **Esquema (editorpage1):** um `svg#root` com viewBox ajustado por script inline. Esse script guarda os descritores `__INNERHTML_DESCRIPTOR` e `__TEXTCONTENT_DESCRIPTOR`, possivelmente para interceptar innerHTML.
  - `defs#patterns`: gridPattern/gridPattern2, markers arrowOnStart/End, `#icon-lock`; filtros feColorMatrixRed, feColorInvert, feGaussianBlur.
  - Camadas `g`: `g1` (conteúdo), gControlDots/Lines/Locks/Rects (alças de edição), gCurParts (peça em colocação), gCursors, gMarkError, gPinDots, grid1/gridBg/gridOH/gridOV, selectBox1, cross-x-big/cross-y-big.
  - Estilos inline: thinLineStyle, px1Style, selectStyle (`.selected`/`.highlight`).
  - Inputs ocultos `worker_main` e `staticPathInfo`.
- **PCB (editorpage3):** tudo o que o esquema tem, mais:
  - grupos gCopperAreaOutlineCushions, gDrcDots, gMark, gNets, gNetsTextRuler, gPanelizedOutlines, gRotateHelper, layer_other, libMasker, masker-top/bottomLayer, fake-content, pcb;
  - cor por camada via CSS `[layerid='N']` (0–24, 99–101) em pcblayerStyle;
  - ratlines em `#layer_9 line[c_shapetype=line]` com `vector-effect:non-scaling-stroke`;
  - atributos `c_partid` (part_pad, part_via, part_hole…), `c_etype` (pad_hole/pad_outer), `c_shape`, `c_para`;
  - inputs ocultos com a URL de cada worker (rtree, ratLine, drc).
- Conclusão: o modelo é **SVG retido**, com uma camada por `g` e metadados em atributos `c_*`. Não é canvas.

## G2 — Undo/redo (INFERIDA, estática; parcial)
- Atalhos Ctrl+Z e Ctrl+Y, mais `undoDraw` com Backspace (main.min @349911).
- **Uma pilha por aba/iframe.** O evento `history_change` (main.min @922297) traz (comprimento, índice, dirty…). A casca calcula `undo = len>0 && idx>-1` e `redo = idx < len-1`, ou seja, **array linear + cursor**. O mesmo evento marca a aba como não salva.
- `getHistory` → `{records[], index}`, exibido no diálogo "Historical Records..." (`#dlgHistoryLog`, @755697/@1099505), com o item atual destacado. Cada registro é um **rótulo textual por operação**: a granularidade é a operação do usuário, não o evento de mouse.
- **Undo de projeto** (`project_undo/redo`, @880691): consulta `getHistoryTimestamp` em todas as abas do projeto, escolhe a de timestamp mais recente (ou mais antigo, no redo) e dispara `sheet_undo` nela. É uma linha do tempo global feita **por merge de timestamps**, sem pilha global.
- Agrupamento: a API de extensões expõe `cacheHistory`/`flushHistory` (@1168207), o que sugere transação (agrupar N mudanças num registro).
- Invalidação: `clearHistory` após reatribuir IDs (@262200), e um aviso "this operation will clear Undo histories" (@669990).
- Erro genérico: "unpredictable error in the undo/redo process" (main.assets @58447).
- **DESCONHECIDOS:** se o registro guarda snapshot ou diff/comando, e o limite de tamanho. Os dois vivem em editorSCH/editorPCB, que não foram baixados.

## G7 — WebGL (INFERIDA, estática)
- **Único uso de WebGL: jsapi.min.js.**
  - @413547: `getContext("webgl",{depth:false,antialias:false,stencil:false,alpha:false,…})` com frameBufferStack.
  - @416325: extensão ANGLE_instanced_arrays.
  - Shaders na faixa ~405–430k com iluminação Phong: u_MVPmatrix, u_ambientLight, u_directLight, u_specularColor, u_shininess, u_eyePosition.
  - Métodos renderAnd2/4/renderSub/resetStencilBuffer (@424547, @425812): **booleanos de máscara via stencil**.
  - readPixels, toBlob, lookAt, setFov.
- Uso provável: o **3D View** (comando "3DView" → `data3D` → aba `new_3dview`, main.min @703122) e a rasterização ou export de imagem.
- **Photo View não usa WebGL:** `convertToPhotoView` → `toSVG` → `importPhotoview` (main.min @664834/@665098).
- No main e no worker só aparece canvas 2D (por exemplo, a imagem do PDF em @938003).

## G10 — DRC/ERC (INFERIDA, estática)
- **Modelo de regras** (main.min @2330217, padrão de um PCB novo):
  - `DRCRULE: {Default:{trackWidth:.6, clearance:.6, viaHoleDiameter:2.4, viaHoleD:1.2}, isRealtime:true, checkObjectToCopperarea:true, showDRCRangeLine:true}`. Unidade: 10 mil.
  - Regras nomeadas recebem nets através de `netRuleMap` → `DRCRULE[rule].nets[]` (@1370513).
- **Checks executados** pelo worker (worker.main @1998, `testClearance`), nesta ordem: `_testTrackSize` → `_testHole` → `_testBoardOutline` → `_testClearance`. A consulta é feita na R-tree e o resultado volta como `testClearanceDone` com `_errorTree()`.
- O relatório da casca acrescenta erros `ratLine` para nets não roteadas (main.min @488098–488545).
- Textos i18n (main.assets, bloco de chaves EN) confirmam a cobertura:
  - largura de trilha mínima, diâmetro de via e de furo, clearance entre nets diferentes, comprimento de trilha;
  - objeto até board outline e outline não fechado; objeto até copper area;
  - conflito de copper areas com nets diferentes; copper area com auto-interseção;
  - expansão de máscara < 0,08 mm; DRC em tempo real.
- Ausências: não aparecem regras de annular ring, silk-to-pad, diff-pair, impedância ou back-drill. Seria um "simple DRC", como diz o próprio texto: "This is a simple Design Rule Checking (DRC)."
- **ERC:** não existe ERC formal. A busca por `\bERC\b` e "Electrical Rule" não retorna nada. As checagens elétricas de esquema encontradas são:
  - prefixos duplicados ("Duplicate Component Prefix");
  - no-connect só em pino ou fio ligado a um pino;
  - validação de nets na conversão para PCB.
- DESCONHECIDOS: os algoritmos exatos de clearance, arco-arco e polígono, que ficam em `pcb.drcWorker`, não baixado.

## G11 — Versões de bibliotecas (INFERIDA/CONFIRMADA por banner)
| Biblioteca | Versão | Evidência | Estado |
|---|---|---|---|
| jQuery | 1.8.2 | main.assets @2451048 `jquery:"1.8.2"` | CONFIRMADA |
| JSZip | 3.1.3 | banner @2898894; `.version` @2910034 | CONFIRMADA |
| pako | embutido no JSZip 3.1.3 (pako ~1.0.x) | licença @2899183 | INFERIDA |
| intro.js | 0.5.0 | @2897369 | CONFIRMADA |
| d3 | 5.9.2 | @3454535 | CONFIRMADA |
| jQuery EasyUI | subconjunto customizado, ≤1.3.x | 21 plugins; sem textbox, filebox, switchbutton, tagbox | INFERIDA |
| opentype.js | ≥1.3.4 (mensagem de WOFF2 que cita a issue #183, comentário de 2022) | main.assets @2823803 | INFERIDA |
| "polybool" | **não é a lib npm**: é uma lib TS interna (`./src/algorithm/polybool/{Sweeper,BooleanSweepEvent,FillRule,Zoom,Simplify,EDASweepDebugger}.ts`) | chameleonTool @41480 | INFERIDA |
| md5, crypt, charenc, is-buffer | banners `/*!` | chameleonTool | CONFIRMADA (uso) |
| Ausentes | Clipper, rbush, paper.js, html2canvas, jsPDF, socket.io, Mousetrap | grep sem ocorrências | INFERIDA |

## G12 — Ratsnest e copper pour (INFERIDA, estática; ratsnest parcial)
- **Pour** (worker.main @714 `copper` → `JSAPI.easyeda2pour`). O pipeline em jsapi tem 5 passos registrados em log (`pp %s step 1..5`, @446722–448354):
  1. coleta os polígonos da mesma camada com clearance base, mais thermalWidth;
  2. `combindOutlines`: contrai o outline em −largura/2, busca os obstáculos na bbox via índice espacial e faz stroke de cada primitiva em 2×clearance (ROUND);
  3. `mergeSameNet`: une os objetos da mesma net;
  4. boolean merge de pourClearance, conectores e clearance térmicos;
  5. aplica o método. **Sólido**: `zoom` (erode/dilate) por `neckThickness` remove pescoços finos. **Grade**: `gnrGrids` com gridWidth + gridClearance. Depois `buildConnection` e **descarta ilhas sem conexão**, a menos que `keepIsland` esteja ativo.
- Parâmetros (@50376/@51077, serialização @207485): method (solid ou grid, com ângulo 90 por padrão), outlineClearance, clearance, thermal (`spoke` ou `direct`), keepIsland, pourIndex (prioridade).
- **Booleanos:** sweep-line própria (Sweeper, BooleanSweepEvent, FillRule) e offset via `Zoom`. Não usa Clipper.
- União entre áreas: `JSAPI.unionCopperAreaPolygons` (@525041).
- Em jsapi também aparecem triangulação com R-tree (@507975) e **decimação de malha por contração de arestas com PriorityQueue de custo** (@511142, @516889), muito provavelmente usadas no export 3D/STEP (`easyeda2step`). Não fazem parte do pour.
- **Ratsnest:**
  - worker.main @818 `ratLineMgr.buildAllNet` recebe gJsonCache, allNetNames, routedGroupMap e realRatLineArr, e devolve `domChanges`. O worker calcula e a casca aplica um diff no DOM (layer 9).
  - `routedGroupMap` sugere que pads já ligados por cobre formam um grupo, e as ratlines conectam os **grupos**, não os pads.
  - O algoritmo (MST, vizinho mais próximo…) vive em `pcb.ratLineMgrWorker.main`, não baixado. Não há MST, Kruskal nem Delaunay nos bundles disponíveis. **DESCONHECIDO.**
- R-tree: `RTreeMgr.rebuild` (worker @1310) reconstrói as árvores de copperArea e DRC, serializadas em toJSON. Há `StaticRTree.ts` em chameleonTool.

## Implicações para o projeto próprio
- Undo: array + cursor por documento, com transações (equivalente a `cacheHistory`/`flushHistory`) e timeline de projeto por timestamps. O protótipo já usa snapshots; o limite de tamanho é decisão nossa.
- DRC mínimo viável: os 4 checks acima, mais ratLine não roteada.
- Pour: pipeline de 5 passos sobre uma lib de booleanos aberta (por exemplo Clipper2, que é BSL), sem copiar código.
