# 05 — Formatos de arquivo

## Separadores (CONFIRMADA, doc)
| Separador | Uso |
|---|---|
| `~` | campos de uma primitiva |
| `` ` `` | pares chave`valor dentro de `c_para` |
| `^^` | segmentos (pinos, netflags) |
| `#@$` | sub-shapes de LIB/FOOTPRINT |
| `#sheet#` | separação de folhas (2 ocorrências no código) |

## Implementação própria e validação
O parser em `prototype/src/format/easyeda-std.js` foi escrito do zero:
- preserva campos desconhecidos (`extra`) e primitivas desconhecidas (`unknown`);
- preserva a ordem das chaves do documento;
- faz round-trip exato da string;
- trata o head em objeto e o head legado em string;
- trata projetos docType 5 com `dataStr` aninhado.

Testes: `tests/format.test.mjs` (18) e **`tests/real-exports.test.mjs` (16, com dados reais)**. Total: 47/47 (ver 11-TEST-RESULTS).

## Validação com arquivos reais (rodada 2: CONFIRMADA)
Fontes: o export JSON do PCB feito pelo usuário, o `dataStr` do esquema salvo e o do PCB criado (os dois extraídos do HAR e redigidos), e a resposta de abertura (docType 5). Fixtures: `examples/real-*.json`.

Round-trip byte a byte nos 4 arquivos. Ordem real dos campos na versão 6.5.61:
| Primitiva | Campos (ordem) | Estado |
|---|---|---|
| TRACK (PCB) | strokeWidth, layerId, net, points, id, locked | CONFIRMADA |
| VIA | x, y, diameter, net, holeRadius, id, locked | CONFIRMADA |
| PAD | 19 campos (shape, x, y, width, height, layerId, net, number, holeRadius, points, rotation, id, holeLength, slotPoints, plated, locked, pasteExpansion, solderExpansion, holeCenter) | CONFIRMADA |
| CIRCLE (PCB) | cx, cy, r, strokeWidth, layerId, id, locked, net | **corrigida** (antes seguia a doc de 2020) |
| TEXT (PCB) | textType, x, y, strokeWidth, rotation, mirror, layerId, net, fontSize, text, path, display, id, fontFamily, locked | CONFIRMADA (nova) |
| SOLIDREGION | layerId, net, path, fillType, id | CONFIRMADA (nova) |
| SVGNODE | json (com `attrs`, por exemplo o `outline3D` do modelo 3D) | CONFIRMADA (nova) |
| LIB (PCB) | x, y, attrs(c_para), rotation, importFlag, id, layerSide*, uuid, updateTime* | CONFIRMADA (posições); *nomes INFERIDOS |
| PT (sch) | path, strokeColor, strokeWidth, strokeStyle, fillColor, id, locked | CONFIRMADA (nova) |
| LIB, T, P, R, PL (sch) | conforme o parser existente | CONFIRMADA |
| `Pimage` | desconhecida, preservada em `unknown` | DESCONHECIDA |
| N, F, COPPERAREA, HOLE, ARC | não estavam presentes nos arquivos reais | INFERIDA (doc 2020) |

Outras confirmações:
- O `canvas` do PCB está em **mm** (`CA~1000~1000~#000000~yes~#FFFFFF~10~…~mm~…`); o do esquema, em **pixel**.
- A unidade interna do PCB é 10 mil. Prova: holeRadius 0,6102 un. → furo de 0,310 mm no Excellon (`T01C0.310`); o outline de 6,0 × 4,0 mm bate com `get_price` (width 5.99996, length 4.00001) e com o GKO.
- Chaves do documento PCB: `head, canvas, shape, layers, objects, BBox, preference, DRCRULE, netColors`. Chaves do esquema: `head, canvas, shape, BBox, colors`.

## Gerber/Excellon reais (CONFIRMADA, export do usuário)
- 7 camadas Gerber (GTL, GBL, GTO, GTS, GBS, GTP, GKO), 2 Excellon (PTH e Via) e `How-to-order-PCB.txt`.
- Cabeçalho: `G04 EasyEDA v6.5.61, <data>`, **`G04 <uuid do usuário>,10*`** (dado pessoal: o uuid da conta vai em todo Gerber; está redigido no pacote), `Gerber Generator version 0.2`, `%FSLAX45Y45*%`, `%MOMM*%`, macros `%AMMACRO1…`.
- A data no cabeçalho é a **hora em que o editor foi carregado** (01:35:50 BRT), não a do export (01:47). CONFIRMADA (comparação com o HAR).
- Excellon: `M48`, `METRIC,LZ,000.000`, `;FILE_FORMAT=3:3`, `;TYPE=PLATED`.

## Formatos de saída do EasyEDA (CONFIRMADA por código ou comandos)
- Gerber RS-274X: gerado no cliente ("Gerber Generator version 0.2"; `%FSLAX`; comentários `G04`).
- Excellon (`M48`, `METRIC,LZ`/`INCH,LZ`); PTH e NPTH separados.
- SVG: o export real do usuário foi validado (`evidence/real-exports/pcb-export.svg`). PNG e PDF: INFERIDA.
- BOM CSV, pick&place (`pcb_export_coordinate_file`), netlist (`export_netList`), DXF (`exportDxf`), EasyEDA JSON (`export_easyEDA`).
