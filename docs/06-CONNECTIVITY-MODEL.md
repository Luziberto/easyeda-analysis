# 06 — Modelo de conectividade

- Conectividade **geométrica** (CONFIRMADA, doc + formato): fios W não referenciam pinos; a ligação acontece por coincidência de coordenadas de extremidade, pino ou junção (J). Rótulos N e flags F com o mesmo nome unem redes. INFERIDA: isso vale entre folhas no caso de flags globais.
- No PCB: `net` é um campo textual em TRACK, PAD, VIA e COPPERAREA. A ratsnest é calculada no worker (`ratLineMgr.buildAllNet`). CONFIRMADA.
- Algoritmo do EasyEDA: DESCONHECIDA. Implementação própria (`extractNets` no parser): union-find sobre pontos; fios em T por teste ponto-sobre-segmento; união por nome de rótulo. Testada com 3 redes no exemplo sintético.
- Recomendação: no editor próprio, guardar **referências explícitas pino↔fio**. Hoje o protótipo usa `from:{sym,pin}`/`to:{sym,pin}`. A conectividade geométrica fica para a importação de arquivos Std.

## Atualização da rodada 3 (G12)
Veja **docs/12-STATIC-DEEP-DIVE.md**, seção G12: achados INFERIDOS (estáticos), com arquivo e offset.


## Rodada 6: evidências do Std (docs/15)
- A conexão no SCH usa coordenadas exatas (`isPointEqual`).
- Junção: `needJunction(o,a) = o>=3 || (o>=1 && a>=1)`, com o = extremidades + pinos e a = fios passando pelo meio; o cruzamento simples não conecta.
- O netlist é produzido no host ou servidor (INFERIDA). O PCB recebe `{net:["REF.pin"]}` e faz o diff com `netNode` por footprint.
- Nets sem nome viram `REF_pin` (INFERIDA).
