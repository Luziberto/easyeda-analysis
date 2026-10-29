# 01 — Stack tecnológica

| Camada | Tecnologia | Estado | Evidência |
|---|---|---|---|
| Empacotamento | Bundler de módulos com 200 caminhos de módulo preservados em chameleonTool; a string `webpack` aparece 1× em main.assets. Que seja Webpack (e a versão) é só inferência: não há `webpackJsonp` nem `__webpack_require__` legíveis | CONFIRMADA (bundling) / INFERIDA (ferramenta) | `evidence/chameleon-modules.txt` |
| DOM/UI | jQuery 1.8.2 + jQuery EasyUI (diálogos, menus, árvores, abas) | CONFIRMADA | banner "jQuery v1.8.2" em main.assets.min.js; muitas ocorrências de `easyui` no HTML/CSS |
| Renderização do canvas de edição | **SVG** (`<svg id=viewRoot>` e `createElementNS` de svg) | CONFIRMADA | editor.html; offset @275758 em main.min.js; a doc oficial diz "EasyEDA uses SVG" |
| Renderização auxiliar | Canvas 2D (miniaturas e prévias 300×300) | CONFIRMADA | `getContext("2d"` @532645 |
| WebGL | Só uma classe de contexto WebGL em jsapi.min.js @413548 (com framebuffer stack); o uso exato é desconhecido (provavelmente visualização 3D ou foto-view) | CONFIRMADA (existência) / INFERIDA (uso) | trecho em 03-FUNCTIONAL-CALL-GRAPH |
| Compressão e arquivos | JSZip 3.1.3, pako (deflate) | CONFIRMADA | banners/strings |
| Fontes | opentype.js (texto vetorial para PCB/Gerber) | CONFIRMADA | strings da biblioteca |
| Persistência local | IndexedDB + indexeddbshim 2.2.1 (fallback para WebSQL via `openDatabase`), localStorage (`easyeda.orgUuid`), sessionStorage | CONFIRMADA | offsets @286291 / @104467; grep localStorage |
| Geometria | Engine booleano de polígonos (polybool/sweep), StaticRTree, Matrix3 e Vector2 em chameleonTool | CONFIRMADA | lista de módulos |
| Trabalho pesado | Web Worker (copper pour, ratsnest, R-Tree, DRC de clearance, descompressão, export) | CONFIRMADA (tipos de mensagem) | `worker.main.min.js` |
| Autorouter | WebSocket para roteador local `ws://127.0.0.1:3579/router` ou de nuvem `wss://router.easyeda.com:8443/router` | CONFIRMADA (strings) | @1131409/@1131450 |
| Simulação | Lado do servidor (`/api/documents/{uuid}/simulate`, `/api/v2/documents/simulate`, netlist SPICE) | CONFIRMADA (strings) / INFERIDA (que o motor roda no servidor) | `evidence/endpoint-map.txt` |
| Extensões | API `easyeda.extension` (47 refs) e `api('getSource'…)` documentada | CONFIRMADA | docs API + @671664 |
| Hash | md5 | CONFIRMADA | strings |
| Ausentes | Three.js, Clipper, React/Vue, WASM | CONFIRMADA (busca negativa) | grep sem ocorrências |

## Atualização da rodada 3 (G7 e G11)
Veja **docs/12-STATIC-DEEP-DIVE.md**, seção G7 e G11: achados INFERIDOS (estáticos), com arquivo e offset.
