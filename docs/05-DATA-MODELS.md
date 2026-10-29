# 05 — Modelos de dados

Fontes: https://docs.easyeda.com/en/DocumentFormat/ (Common Information, Schematic File Format, PCB File Format, File Object) e EasyEDA-Format-Standard (2020.08.11). Tudo aqui é CONFIRMADA (doc), salvo marcação em contrário.

## Documento
| Campo | Descrição |
|---|---|
| `head` | Desde 2020 é um objeto JSON: `docType`, `editorVersion`, `c_para` (atributos), `x`, `y` (origem), `hasIdFlag`, `newgId`, `importFlag`, `transformList`. No formato legado é uma string `"1~1.7.5~…"` |
| `canvas` | `"CA~…"`: tamanho, cor de fundo, grid (visível, cor, tamanho), unidade, snap, origem. 15 campos no SCH, 20 no PCB |
| `shape[]` | primitivas como strings `CMD~campo~campo…` |
| `BBox` | `{x,y,width,height}` |
| PCB: `layers[]` | `"id~nome~cor~visível~ativa~config~transparência~tipo"` |
| PCB: `objects`, `preference`, `DRCRULE`, `routerRule`, `netColors` | configurações |
| SCH sim: `waveForm` | configuração de formas de onda |

## docType
1 esquema · 3 PCB · 4 footprint · 5 projeto (`schematics[]`) · 7 símbolo (schlib). **1, 3, 4 e 5 CONFIRMADOS no tráfego real**: `documents/create` com docType 1 e 3; footprint docType "4" em `searchByIdAndPre`; abertura devolve docType 5 com `dataStr` como objeto. Outros valores: DESCONHECIDA.

Identidade e versão (CONFIRMADA, HAR): o documento tem `uuid` estável e revisões `datastrid` (`master` = primeira; `histories[]`). O projeto tem `uuid`, `path` (`<user>/<slug>`), `origin:"std"` e `project_version`. O vínculo sch↔pcb é feito pelo mesmo `gId` do LIB e pelo `bindPCBId`.

## Unidades
PCB: 1 unidade = 10 mil = 0,254 mm. SCH: pixels (grid típico de 5 ou 10). Layer IDs: 1 Top, 2 Bottom, 3/4 Silk T/B, 5/6 Paste, 7/8 Máscara, 9 Ratlines, 10 Board Outline, 11 Multi-Layer, 12 Document, 21+ camadas internas.

## Primitivas do esquema
| Cmd | Campos |
|---|---|
| W / PL / B / PG | points~strokeColor~strokeWidth~strokeStyle(0 sólido, 1 tracejado, 2 pontilhado)~fill~gId~locked |
| R | x~y~rx~ry~w~h~stroke~sw~ss~fill~gId~locked |
| E / A / PT / I / C / L | elipse, arco (pathString~helperDots…), path, imagem, círculo, linha |
| T | mark (L/N/P/PK…)~x~y~rot~cor~fonte…~texto~visível~âncora~gId |
| P (pino) | 7 segmentos `^^`: config(show~elétrico~spicePin~x~y~rot~gId~locked) / pinDot / path / name / num / dot / clock |
| J | junção x~y~r~fill~gId~locked |
| N / F | rótulo de rede / flag de rede (F usa segmentos `^^`) |
| O | no-connect |
| BE, AR | entrada de barramento, seta |
| LIB | x~y~c_para(`` ` ``-separado)~rot~importFlag~gId~puuid~uuid~locked~bind~convert_to_pcb~add_into_bom, seguido de sub-shapes `#@$` |

## Primitivas de PCB
TRACK (sw~layer~net~points~gId~locked) · PAD (20 campos: shape ELLIPSE/RECT/OVAL/POLYGON~x~y~w~h~layer~net~number~holeR~points~rot~gId~holeLength~slotPoints~plated~locked~pasteexp~solderexp~holeCenter) · VIA (x~y~diameter~net~holeR~gId~locked) · HOLE · CIRCLE · RECT · ARC · TEXT · COPPERAREA (19 campos) · SOLIDREGION · DIMENSION · PROTRACTOR · SVGNODE (JSON) · PLANEZONE · FOOTPRINT (cabeçalho + `#@$`) · SHEET.

## File Object (API JSON)
`{head, canvas, WIRE:{gge1:{…}}, PIN:{…}, …, itemOrder:[…]}`, indexado por tipo e gId.
