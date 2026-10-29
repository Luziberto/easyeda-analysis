# Matriz de recursos

Complexidade: B = baixa, M = média, A = alta, MA = muito alta. Prioridade: MVP1 a MVP4.

| Recurso | Evidência | Estado | Complexidade | Prioridade |
|---|---|---|---|---|
| Canvas SVG com grid, zoom e pan | `<svg id=viewRoot>`, atalhos A/Z/K, canvas `CA~` | CONFIRMADA | B | MVP1 |
| Inserir, mover, girar e espelhar símbolos | atalhos X/Y, `api rotate/fliph` | CONFIRMADA | B | MVP1 |
| Fio, barramento e junção | atalhos W/B, primitivas W/B/J | CONFIRMADA | M | MVP1 |
| Undo/redo | Ctrl+Z/Y, `canUndo`; pilha por aba array+cursor, undo de projeto por timestamp (docs/12) | CONFIRMADA | M | MVP1 |
| Salvar/abrir | `file_save`; HAR: `POST documents/create`, `update_canvas` (gzip, dataStr inteiro, revisões `datastrid`) | **CONFIRMADA (HAR)** | B | MVP1 |
| Rótulo e flag de rede | N, F | CONFIRMADA | M | MVP2 |
| Multi-folha | `#sheet#`, docType 5 | CONFIRMADA | M | MVP2 |
| Anotação | `cmd=annotate` | CONFIRMADA | B | MVP2 |
| ERC | — | DESCONHECIDA | M | MVP2 |
| Editor e assistente de símbolo | `new_schematicLib`, `SCHLibWizard` | CONFIRMADA | M | MVP2 |
| Netlist / BOM | `export_netList`, `export_bom` | CONFIRMADA | B | MVP2 |
| Import Altium/Eagle/KiCad | `/analyzer/api/convert` | CONFIRMADA (rota) | A | MVP4 |
| Import EasyEDA Std | doc pública + parser próprio | CONFIRMADA | M | MVP2 |
| Camadas PCB | `layers[]`, IDs | CONFIRMADA | M | MVP3 |
| Footprints e assistente | FOOTPRINT, packageGenerator | CONFIRMADA | A | MVP3 |
| Ratsnest | worker `ratLineMgr` (grupos roteados; algoritmo DESCONHECIDO) | CONFIRMADA | M | MVP3 |
| Roteamento interativo | atalhos W/L/Shift+R | CONFIRMADA | A | MVP3 |
| Par diferencial | `pcb_differential_route` | CONFIRMADA | A | MVP4 |
| Copper pour | COPPERAREA, worker `copper`; pipeline em 5 passos, solid/grid, spoke/direct, keepIsland (docs/12) | CONFIRMADA | A | MVP3 |
| DRC | `pcb_DRC`, `testClearanceDone`; 4 checks + ratLine; sem ERC formal (docs/12) | CONFIRMADA | A | MVP3 |
| Gerber/Excellon | gerador no cliente (HAR: o servidor só registra `download_gerber`; zip real validado) | **CONFIRMADA (HAR + export)** | A | MVP3 |
| Pick&place | `pcb_export_coordinate_file` | CONFIRMADA | B | MVP3 |
| Autorouter | WS router | CONFIRMADA (URL) / protocolo DESCONHECIDO | MA | MVP4 |
| Photo view / 3D | `photoView_*` (SVG), `lib3d-view` (WebGL em jsapi) | CONFIRMADA | A | MVP4 |
| Simulação SPICE | `/simulate`, VCVS, PULSE… | CONFIRMADA (rota) / contrato DESCONHECIDO | MA | MVP4 |
| Extensões/API | `easyeda.extension`, docs API | CONFIRMADA | M | MVP4 |
| Colaboração e versões | `/projects/*/version`, membros | CONFIRMADA (rotas) | MA | MVP4 |
| Recuperação de crash | `crashRecovery_*`, IndexedDB `DBEasyEDA.autoSaveTable` | **CONFIRMADA (DevTools)** | M | MVP2 |
| Biblioteca de nuvem e preços | `/api/components`, `/api/getPrices` | CONFIRMADA | A | fora de escopo (dados de terceiros) |
| OCR de datasheet | `OcrWizard`, `/api/ocr` | CONFIRMADA | A | fora de escopo |

| Conversão esquema→PCB | no cliente; `documents/create` docType 3 | **CONFIRMADA (HAR)** | A | MVP3 |
| Orçamento de PCB | `pcb_order/{id}/get_price` (dimensões em mm do cliente) | **CONFIRMADA (HAR)** | B | fora do escopo |
| Biblioteca (footprint por id) | `components/searchByIdAndPre` → dataStr docType 4 | **CONFIRMADA (HAR)** | M | MVP2 |


## Pro 3.2.209 (cliente desktop, docs/13)
| Recurso | Pro | Estado |
|---|---|---|
| Undo | Command + diff, limite 50 (SCH) | CONFIRMADA |
| Ratsnest | Delaunay + Kruskal | CONFIRMADA |
| Autorouter | WASM local (2 engines) | CONFIRMADA |
| Simulação | ngspice/SimulIDE externo, :17965 | CONFIRMADA |
| DRC | creepage, diff-pair, net length, blind… | CONFIRMADA |
| Biblioteca offline | SQLite 474 MB, FTS próprio | CONFIRMADA |


## Std 6.5.61 vs Pro 3.2.209 (docs/14)
| Recurso | Std | Pro |
|---|---|---|
| Undo | 120 passos, tuplas híbridas | 50 passos, diffs |
| Ratsnest | Kruskal em grafo completo | Delaunay + Kruskal |
| Autorouter | DSN → servidor (WS no pai) | WASM local |
| DRC | track/hole/outline/clearance (worker) | + creepage, diff-pair, length… |
| Simulação | REST no servidor | app externo |
| Snap | grade + Alt→altSnapSize; snap a PAD/VIA no PCB | — |
| Junção SCH | regra o>=3 ou T; cruzamento não conecta | — |
| Netlist | host/servidor; `{net:[REF.pin]}` → Import Changes | — |

## Protótipo após a rodada 7
| Recurso | Protótipo |
|---|---|
| Snap | grade 10, Alt = 5, coordenadas inteiras |
| Fios | polilinha, pontos livres, T; junção derivada pela regra |
| Nós nomeados | GND/VCC > porta > rótulo > automático `REF_pin`; conflitos como aviso |
| Netlist | `{net:[REF.pin]}` + diff e aplicação contra a PCB |
| Índice espacial | hash uniforme |
| Formato | v2 com migração do v1 |

## Protótipo após MVP2 esquemático (v3)
| Recurso | Protótipo |
|---|---|
| Multi-folha | `Project` v3, abas, add/rename/remove/setActive |
| Barramento | primitiva `Wire.kind === 'bus'`, tecla **B** |
| ERC | heurísticas std-like (`runErc`), painel ERC |
| Export | KiCad `.net`, SPICE `.cir`, SVG, **BOM CSV**, impressão |
| Import Std | docType 5 → uma folha por schematic; **B** → bus |
| **PCB (MVP3)** | Walkaround (+ obstáculos), pour + keepouts, vias, ratsnest MST, Gerber fab (5 ficheiros) + gerbv CI, DRC, WebGL, import PCB + contorno |
| Testes | 119 unit + 8 e2e |
