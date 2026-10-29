# 07 — Motor de PCB

| Aspecto | Descoberta | Estado |
|---|---|---|
| Renderização | SVG (mesma base do esquemático); Photo View para visualização realista; WebGL presente em jsapi | CONFIRMADA / INFERIDA (onde o WebGL é usado) |
| Camadas | IDs 1–12 + 21+ internas; LayerManager/PcbLayer | CONFIRMADA |
| Copper pour | COPPERAREA; cálculo no worker (`copper`) com booleanos polybool | CONFIRMADA (tipos/módulos) |
| Índice espacial | StaticRTree, `RTreeMgr.result` no worker | CONFIRMADA |
| Unidades | mil, mm, inch (`changeCanvasUnit` Q); 1 unidade interna = 10 mil | CONFIRMADA |
| Fontes de silk | opentype.js | CONFIRMADA |
| Fabricação | Gerber e Excellon no cliente; integração de pedido JLCPCB | CONFIRMADA |
| Footprint wizard | packageGenerator (17 modelos) | CONFIRMADA (módulos) |
| 3D | iframes `lib3d-view`/`for3dview`; `/api/3dmodel/` | CONFIRMADA (existência) / DESCONHECIDA (motor) |

## Atualização da rodada 3 (G1 e G7)
Veja **docs/12-STATIC-DEEP-DIVE.md**, seção G1 e G7: achados INFERIDOS (estáticos), com arquivo e offset.
