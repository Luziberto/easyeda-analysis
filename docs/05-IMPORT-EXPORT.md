# 05 — Importação e exportação

| Formato | Direção | Onde | Estado |
|---|---|---|---|
| EasyEDA Std JSON | in/out | cliente | CONFIRMADA. O export real faz round-trip no parser próprio |
| Esquema → PCB | conversão | **cliente** (o PCB é criado com `documents/create` docType 3) | CONFIRMADA (HAR) |
| Altium, Eagle, KiCad | in | servidor `/analyzer/api/convert/from/{from}/to/{to}` | CONFIRMADA (cmd + rota) / INFERIDA (que é server-side) |
| DXF | in/out | cliente? | CONFIRMADA (cmd) / DESCONHECIDA (local) |
| EDIF | in | cliente (EDIFParser em chameleonTool) | CONFIRMADA (módulo) |
| Gerber + Excellon (zip via JSZip) | out | cliente | **CONFIRMADA (HAR: nenhum arquivo vem do servidor; `download_gerber` só devolve `true`)** |
| BOM / CSV / pick&place / netlist | out | cliente | CONFIRMADA (cmd) |
| SPICE netlist | out | servidor `/spiceNetlist` | CONFIRMADA (rota) |
| EasyEDA Pro | out (migração) | chameleonTool | INFERIDA |
| Imagem (PNG/SVG) | out | cliente | CONFIRMADA (APIs) |

No projeto próprio, a recomendação é implementar no cliente: o próprio JSON, a importação Std (parser já feito), SVG e Gerber X2 e Excellon (MVP3), e netlist SPICE e KiCad (MVP2).


Validação com dados reais: veja 05-FILE-FORMATS § "Validação com arquivos reais" e `tests/real-exports.test.mjs`. O netlist e o pick&place não foram exportados pelo usuário e continuam sem validação.
