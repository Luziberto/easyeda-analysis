# 03 — Mapa de módulos

## chameleonTool.min.js: caminhos de módulo preservados (CONFIRMADA, `evidence/chameleon-modules.txt`, 200 entradas)
| Grupo | Exemplos | Papel inferido |
|---|---|---|
| algorithm/geometry | Arc, Line, Polyline, Vector2, Triangle, ScanPolyline, PolygonIdentify | primitivas geométricas |
| algorithm/bbox, StaticRTree | BBox2, StaticRTree | índice espacial para hit-test e DRC |
| polybool, Sweep, Sweeper, Side* | polybool, Sweep, SideGroup | operações booleanas de polígonos (copper pour, união de máscaras) |
| math | Matrix3 | transformações 2D |
| base | BaseObj, BasePage, Color, Font, RuleManager, Stroke | modelo de objetos comum |
| chameleon/pcb, pcb/baseShapes | Pad, Track, Via… | modelo PCB |
| layer | LayerConfg, PcbLayer, LayerManager | pilha de camadas |
| eda | easyeda, easyedaPro | **adaptadores de formato Std ↔ Pro** |
| utils | EDIFParser, UnitConverter, StringKit, io/UTF16WriteBuffer | importação de netlist EDIF e conversão de unidades |
| packageGenerator/models (17) | modelos de encapsulamento | **assistente de footprint paramétrico** |
| tools, sch/page, page/FootprintPage | footprintWizardTool | páginas e ferramentas |

Inferência (INFERIDA): chameleonTool é o conversor de formato Std→Pro (comando `migrate_to_pro`) e também o gerador de footprints.

## main.min.js: subsistemas (CONFIRMADA por strings, sem nomes de módulo)
- Casca de projeto e abas (Yn.*), mapa de URLs da API (ver 04), despacho de comandos e atalhos, API de extensões (`easyeda.extension`).
- Gerador Gerber próprio ("Gerber Generator version 0.2", `%FSLAX`, `G04`), gerador de furação Excellon (`M48`, `METRIC,LZ`/`INCH,LZ`).
- Cliente do autorouter (WebSocket), cliente de simulação (HTTP), decodificação de documentos (`Ol.solver`).

## main.assets.min.js
Bibliotecas de terceiros (jQuery 1.8.2, EasyUI, JSZip 3.1.3, pako, opentype, indexeddbshim 2.2.1) e parte do motor de renderização (`getScreenCTM`, `createSVGPoint`).

## worker.main.min.js: tipos de mensagem (CONFIRMADA)
`copper`, `ratLineMgr.buildAllNet:result`, `RTreeMgr.result`, `testClearanceDone`, `decompress`, `exportThirdFile`, `blob`, `updateStatus`, `done`.

## Análise REA (CONFIRMADA, `evidence/rea-*.json`)
`analyze_javascript_application` sobre chameleonTool, worker e jsapi: 3 arquivos, 283.989 nós de AST, 110 módulos, 611 achados, 0 falhas de parse. A cobertura semântica foi parcial porque o teto de nós foi atingido.
