# 11 — Resultados de testes (saída real)

Executado em 29/10/2026 às 01:55 (horário de Fortaleza, UTC-3), com Node v24. **47 testes, 47 aprovados, 0 falhas**: 13 core, 18 formato (sintético) e 16 com dados reais do usuário (`tests/real-exports.test.mjs`).

```
$ cd prototype && npm test

> proto-eda-schematic@0.1.0 test
> node --test tests/*.test.mjs ../tests/*.test.mjs

✔ round-trip byte-a-byte (JSON normalizado): synthetic-schematic.json (1.607247ms)
✔ round-trip duplo é idempotente: synthetic-schematic.json (0.98168ms)
✔ round-trip byte-a-byte (JSON normalizado): synthetic-pcb.json (0.292583ms)
✔ round-trip duplo é idempotente: synthetic-pcb.json (3.650502ms)
✔ round-trip byte-a-byte (JSON normalizado): synthetic-project.json (1.530148ms)
✔ round-trip duplo é idempotente: synthetic-project.json (0.513221ms)
✔ round-trip byte-a-byte (JSON normalizado): synthetic-legacy-head.json (0.213161ms)
✔ round-trip duplo é idempotente: synthetic-legacy-head.json (0.174732ms)
✔ docType: head objeto e head legado em string (0.276955ms)
✔ wire W: campos nomeados (0.450173ms)
✔ PAD PCB: 19 campos após o comando (0.292701ms)
✔ LIB composto com sub-shapes #@$ e pino ^^ (0.231041ms)
✔ primitiva desconhecida é preservada (0.119441ms)
✔ campos extras além do esquema são preservados (0.112959ms)
✔ edição de campo reflete na serialização (0.257962ms)
✔ conectividade: 3 redes no esquema sintético (1.041411ms)
✔ unidades: 1 unidade = 10 mil = 0,254 mm (0.20442ms)
✔ projeto docType 5: dataStr aninhado é analisado (0.268264ms)
✔ real: round-trip exato do documento (examples/real-pcb-export.json) (2.798229ms)
✔ real: cada primitiva (inclusive filhos #@$) volta idêntica (examples/real-pcb-export.json) (0.530807ms)
✔ real: round-trip exato do documento (examples/real-schematic-from-har.json) (0.909306ms)
✔ real: cada primitiva (inclusive filhos #@$) volta idêntica (examples/real-schematic-from-har.json) (0.725357ms)
✔ real: round-trip exato do documento (evidence/real-exports/pcb-created-from-har.datastr.json) (0.820722ms)
✔ real: cada primitiva (inclusive filhos #@$) volta idêntica (evidence/real-exports/pcb-created-from-har.datastr.json) (0.816667ms)
✔ real: só Pimage permanece sem esquema (desconhecido, mas preservado) (1.253044ms)
✔ real: PAD com 19 campos nomeados conforme export v6.5.61 (0.349048ms)
✔ real: conectividade PCB por net (TRACK/VIA/PAD) (6.332889ms)
✔ real: ids gge do esquema e do PCB coincidem (vínculo sch↔pcb) (1.118337ms)
✔ real: furo de VIA (holeRadius 0.6102 un) = ferramenta Excellon T01C0.310 mm (0.524524ms)
✔ real: contorno (TRACK layer 10) = 6,0 × 4,0 mm, igual ao get_price do HAR (4.140823ms)
✔ real: SVGNODE é JSON válido (contorno 3D) (0.472921ms)
✔ real: Gerber RS-274X — cabeçalho, formato e unidade (0.264818ms)
✔ sanitização: evidence/ e examples/ sem uuid, username, tokens ou cookies (146.375396ms)
✔ real: resposta de GET /api/documents/{uuid} (docType 5, dataStr como OBJETO) faz round-trip (0.727937ms)
✔ snap ao grid de 10 (1.676233ms)
✔ inserir símbolo: id, referência e snap (0.329611ms)
✔ símbolo desconhecido é rejeitado (0.206424ms)
✔ mover + desfazer + refazer (0.766124ms)
✔ rotação muda posição mundial dos pinos (0.333598ms)
✔ fio entre pinos e netlist (0.430218ms)
✔ excluir símbolo remove fios ligados; undo restaura ordem (0.390173ms)
✔ histórico: novo comando limpa redo; undo vazio retorna false (0.222764ms)
✔ desfazer tudo volta ao documento vazio e refazer tudo reconstrói (0.77032ms)
✔ hit-test de símbolo e pino (0.372143ms)
✔ viewport: zoom ancorado preserva o ponto sob o cursor; pan (0.245685ms)
✔ salvar/abrir JSON: round-trip e validação (0.372632ms)
✔ listeners do histórico são notificados (0.161454ms)
ℹ tests 47
ℹ suites 0
ℹ pass 47
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 248.033003
```


## Smoke da UI (sem navegador)
```
app.js sintaxe OK
index.html 200 text/html
src/ui/app.js 200 text/javascript
src/core/model.js 200 text/javascript
src/core/library.js 200 text/javascript
```

Resumo: **47 testes, 47 aprovados, 0 falhas**. São 13 do core do protótipo, 18 do parser/serializador com exemplos sintéticos e 16 com dados reais do usuário (round-trip de 4 arquivos, campos de PAD, nets, vínculo sch↔pcb, furo e outline × Gerber/get_price, varredura de sanitização). Os testes de interação no navegador não foram executados.

## Rodada 7: saída real de `npm test` (29/10/2026)
Resultado: 75 testes, 75 passando, 0 falhas.

Nos testes antigos mudou uma única linha: o caso de `deserialize` inválido agora usa `wires[0].points = [{x:1.5,y:0}]`, porque a estrutura do fio mudou. O caso v1 equivalente passou a ser coberto pelo teste de migração.

```

> proto-eda-schematic@0.1.0 test
> node --test tests/*.test.mjs ../tests/*.test.mjs

✔ round-trip byte-a-byte (JSON normalizado): synthetic-schematic.json (2.876114ms)
✔ round-trip duplo é idempotente: synthetic-schematic.json (1.924002ms)
✔ round-trip byte-a-byte (JSON normalizado): synthetic-pcb.json (1.018731ms)
✔ round-trip duplo é idempotente: synthetic-pcb.json (0.430392ms)
✔ round-trip byte-a-byte (JSON normalizado): synthetic-project.json (1.282343ms)
✔ round-trip duplo é idempotente: synthetic-project.json (0.327633ms)
✔ round-trip byte-a-byte (JSON normalizado): synthetic-legacy-head.json (0.163746ms)
✔ round-trip duplo é idempotente: synthetic-legacy-head.json (0.121359ms)
✔ docType: head objeto e head legado em string (0.201481ms)
✔ wire W: campos nomeados (0.325851ms)
✔ PAD PCB: 19 campos após o comando (0.200982ms)
✔ LIB composto com sub-shapes #@$ e pino ^^ (0.194689ms)
✔ primitiva desconhecida é preservada (0.068871ms)
✔ campos extras além do esquema são preservados (0.095673ms)
✔ edição de campo reflete na serialização (0.156499ms)
✔ conectividade: 3 redes no esquema sintético (0.962077ms)
✔ unidades: 1 unidade = 10 mil = 0,254 mm (0.137797ms)
✔ projeto docType 5: dataStr aninhado é analisado (0.221076ms)
✔ real: round-trip exato do documento (examples/real-pcb-export.json) (3.506956ms)
✔ real: cada primitiva (inclusive filhos #@$) volta idêntica (examples/real-pcb-export.json) (0.531145ms)
✔ real: round-trip exato do documento (examples/real-schematic-from-har.json) (0.918332ms)
✔ real: cada primitiva (inclusive filhos #@$) volta idêntica (examples/real-schematic-from-har.json) (0.661179ms)
✔ real: round-trip exato do documento (evidence/real-exports/pcb-created-from-har.datastr.json) (1.554422ms)
✔ real: cada primitiva (inclusive filhos #@$) volta idêntica (evidence/real-exports/pcb-created-from-har.datastr.json) (1.007538ms)
✔ real: só Pimage permanece sem esquema (desconhecido, mas preservado) (1.401336ms)
✔ real: PAD com 19 campos nomeados conforme export v6.5.61 (0.487928ms)
✔ real: conectividade PCB por net (TRACK/VIA/PAD) (7.661847ms)
✔ real: ids gge do esquema e do PCB coincidem (vínculo sch↔pcb) (1.452655ms)
✔ real: furo de VIA (holeRadius 0.6102 un) = ferramenta Excellon T01C0.310 mm (0.660714ms)
✔ real: contorno (TRACK layer 10) = 6,0 × 4,0 mm, igual ao get_price do HAR (5.468653ms)
✔ real: SVGNODE é JSON válido (contorno 3D) (0.450805ms)
✔ real: Gerber RS-274X — cabeçalho, formato e unidade (0.291354ms)
✔ sanitização: evidence/ e examples/ sem uuid, username, tokens ou cookies (167.882962ms)
✔ real: resposta de GET /api/documents/{uuid} (docType 5, dataStr como OBJETO) faz round-trip (0.860526ms)
✔ snap: inteiros, passo da grade e meio passo com Alt, origem (3.463826ms)
✔ addSymbol com Alt aceita meio passo; move com Alt (0.594061ms)
✔ SpatialHash: at, inRect, nearest, células negativas (0.38827ms)
✔ SpatialHash vs força bruta (aleatório) (7.091138ms)
✔ onSegmentInterior exato (0.189171ms)
✔ regra de junção (0.122862ms)
✔ T conecta e gera junção; cruzamento simples não conecta (1.5378ms)
✔ três extremidades no mesmo ponto: conecta com junção; duas: conecta sem junção (0.536422ms)
✔ pino no meio de um fio conecta (T com pino) (0.405234ms)
✔ dobra de polilinha sobre outro fio sem extremidade não conecta (0.505827ms)
✔ fio de pontos livres pino→ponto→pino; normalização remove colineares e duplicados (0.658701ms)
✔ rótulos de rede unem grupos distantes com o mesmo nome (0.402193ms)
✔ power GND/VCC: nomes fixos e une todos; símbolos de power não entram como REF.pino (0.21783ms)
✔ prioridade power > porta > rótulo > automático, com avisos (0.322754ms)
✔ conflito no mesmo nível: aviso e escolha determinística (0.229424ms)
✔ dois power diferentes ligados por fio: conflito GND vs VCC (0.20357ms)
✔ nome automático = menor REF.pino em ordem natural (R2 < R10) (0.35455ms)
✔ pino isolado não gera rede; nomes colidentes recebem sufixo com aviso (0.276426ms)
✔ setNet renomeia rótulo; desfazer restaura (0.452034ms)
✔ mover/girar símbolo arrasta extremidades ligadas; undo exato (0.798162ms)
✔ mover um fio selecionado move todos os pontos (0.17173ms)
✔ sem campo cur nas extremidades salvas (correção) (0.179389ms)
✔ migração v1 → v2: fios por pino viram polilinhas; cur descartado; rede preservada (0.846463ms)
✔ v2 rejeita coordenadas não inteiras e versões inválidas (0.196574ms)
✔ diff com PCB: mudanças, renomeação, erros pad/pino, extras, aplicar (0.664539ms)
✔ diff: pad inexistente no footprint e pad sobrando no PCB (0.141426ms)
✔ ponta a ponta: esquemático → netlist → diff contra PCB vazio (0.188024ms)
✔ desempenho: 2000 fios em grade com índice espacial (22.111157ms)
✔ snap ao grid de 10 (0.836012ms)
✔ inserir símbolo: id, referência e snap (0.429842ms)
✔ símbolo desconhecido é rejeitado (0.273331ms)
✔ mover + desfazer + refazer (1.020417ms)
✔ rotação muda posição mundial dos pinos (0.478477ms)
✔ fio entre pinos e netlist (1.281227ms)
✔ excluir símbolo remove fios ligados; undo restaura ordem (0.614166ms)
✔ histórico: novo comando limpa redo; undo vazio retorna false (0.30517ms)
✔ desfazer tudo volta ao documento vazio e refazer tudo reconstrói (2.128953ms)
✔ hit-test de símbolo e pino (0.364874ms)
✔ viewport: zoom ancorado preserva o ponto sob o cursor; pan (0.235917ms)
✔ salvar/abrir JSON: round-trip e validação (0.419315ms)
✔ listeners do histórico são notificados (0.176218ms)
ℹ tests 75
ℹ suites 0
ℹ pass 75
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 267.01107
```

## Rodada 8: correções de UI após o teste no navegador (29/10/2026)
A lógica de interação saiu de `app.js` e foi para `src/ui/controller.js`, um módulo puro (sem DOM) testado em `tests/ui-controller.test.mjs`.
1. **Renomear rede:** funciona com rótulo, porta, GND ou VCC selecionado (`setNet`). Com um fio selecionado, cria um rótulo no 1º vértice, ou reaproveita o rótulo que já estiver no fio. Se nada adequado estiver selecionado, aparece uma mensagem no rodapé. Causa do bug: o clique no pino do rótulo iniciava um fio em vez de selecionar, e fios não eram selecionáveis.
2. **Duplo clique:** o controlador detecta o duplo clique sozinho (≤350 ms, mesmo ponto), porque o `render()` recria o SVG e o navegador perdia o `dblclick`. O fio termina sem vértice duplicado.
3. **Arrasto a partir de pino:** soltar o botão termina o fio no ponto solto, já com snap.
4. **Layout estável:** status e avisos ficam num rodapé de altura fixa (22 px), com reticências; a barra de ferramentas não quebra linha.
5. **Estado da ferramenta:** o botão "Fio" reflete o modo de verdade e se apaga após Enter, Esc ou duplo clique. Em modo idle, clicar num pino seleciona e arrastar a partir dele começa um fio. O modo clique a clique fica com W ou o botão.
6. **Segmentos ortogonais:** cotovelo automático, horizontal primeiro, também na pré-visualização. Pinos fora da grade (LED ±25) não geram mais diagonal.
7. **Avisos:** novo aviso `unconnected` para rótulo, porta ou power sem pino. Os avisos aparecem descritos (`describeWarning`) no rodapé e no painel Netlist.
- Testes: 86 de 86 (os 75 anteriores mais 11 novos). Smoke E2E via CDP (`tools/e2e-cdp.mjs`) aprovado: arrasto do LED gerou `75,100 40,100 40,150`, o duplo clique encerrou o fio, o botão se apagou, o canvas ficou fixo em top=70, e o aviso e o renomear funcionaram.

### Saída real de `npm test` (rodada 8)
```

> proto-eda-schematic@0.1.0 test
> node --test tests/*.test.mjs ../tests/*.test.mjs

✔ round-trip byte-a-byte (JSON normalizado): synthetic-schematic.json (1.778567ms)
✔ round-trip duplo é idempotente: synthetic-schematic.json (0.933315ms)
✔ round-trip byte-a-byte (JSON normalizado): synthetic-pcb.json (0.375156ms)
✔ round-trip duplo é idempotente: synthetic-pcb.json (0.34634ms)
✔ round-trip byte-a-byte (JSON normalizado): synthetic-project.json (1.262165ms)
✔ round-trip duplo é idempotente: synthetic-project.json (0.377132ms)
✔ round-trip byte-a-byte (JSON normalizado): synthetic-legacy-head.json (0.175787ms)
✔ round-trip duplo é idempotente: synthetic-legacy-head.json (0.129194ms)
✔ docType: head objeto e head legado em string (0.231261ms)
✔ wire W: campos nomeados (0.357257ms)
✔ PAD PCB: 19 campos após o comando (0.189551ms)
✔ LIB composto com sub-shapes #@$ e pino ^^ (0.167892ms)
✔ primitiva desconhecida é preservada (0.082281ms)
✔ campos extras além do esquema são preservados (0.084081ms)
✔ edição de campo reflete na serialização (0.08626ms)
✔ conectividade: 3 redes no esquema sintético (0.766946ms)
✔ unidades: 1 unidade = 10 mil = 0,254 mm (0.141182ms)
✔ projeto docType 5: dataStr aninhado é analisado (0.17895ms)
✔ real: round-trip exato do documento (examples/real-pcb-export.json) (3.291535ms)
✔ real: cada primitiva (inclusive filhos #@$) volta idêntica (examples/real-pcb-export.json) (0.688273ms)
✔ real: round-trip exato do documento (examples/real-schematic-from-har.json) (0.744843ms)
✔ real: cada primitiva (inclusive filhos #@$) volta idêntica (examples/real-schematic-from-har.json) (0.636177ms)
✔ real: round-trip exato do documento (evidence/real-exports/pcb-created-from-har.datastr.json) (0.77353ms)
✔ real: cada primitiva (inclusive filhos #@$) volta idêntica (evidence/real-exports/pcb-created-from-har.datastr.json) (0.857078ms)
✔ real: só Pimage permanece sem esquema (desconhecido, mas preservado) (1.267668ms)
✔ real: PAD com 19 campos nomeados conforme export v6.5.61 (0.607606ms)
✔ real: conectividade PCB por net (TRACK/VIA/PAD) (6.375601ms)
✔ real: ids gge do esquema e do PCB coincidem (vínculo sch↔pcb) (1.451642ms)
✔ real: furo de VIA (holeRadius 0.6102 un) = ferramenta Excellon T01C0.310 mm (0.668014ms)
✔ real: contorno (TRACK layer 10) = 6,0 × 4,0 mm, igual ao get_price do HAR (4.52886ms)
✔ real: SVGNODE é JSON válido (contorno 3D) (0.506557ms)
✔ real: Gerber RS-274X — cabeçalho, formato e unidade (0.286744ms)
✔ sanitização: evidence/ e examples/ sem uuid, username, tokens ou cookies (164.953896ms)
✔ real: resposta de GET /api/documents/{uuid} (docType 5, dataStr como OBJETO) faz round-trip (0.818066ms)
✔ snap: inteiros, passo da grade e meio passo com Alt, origem (2.049769ms)
✔ addSymbol com Alt aceita meio passo; move com Alt (1.622183ms)
✔ SpatialHash: at, inRect, nearest, células negativas (0.514806ms)
✔ SpatialHash vs força bruta (aleatório) (4.138475ms)
✔ onSegmentInterior exato (0.207122ms)
✔ regra de junção (0.100539ms)
✔ T conecta e gera junção; cruzamento simples não conecta (1.648447ms)
✔ três extremidades no mesmo ponto: conecta com junção; duas: conecta sem junção (0.470673ms)
✔ pino no meio de um fio conecta (T com pino) (0.273963ms)
✔ dobra de polilinha sobre outro fio sem extremidade não conecta (0.285466ms)
✔ fio de pontos livres pino→ponto→pino; normalização remove colineares e duplicados (0.42293ms)
✔ rótulos de rede unem grupos distantes com o mesmo nome (0.272377ms)
✔ power GND/VCC: nomes fixos e une todos; símbolos de power não entram como REF.pino (0.187674ms)
✔ prioridade power > porta > rótulo > automático, com avisos (0.362796ms)
✔ conflito no mesmo nível: aviso e escolha determinística (0.241342ms)
✔ dois power diferentes ligados por fio: conflito GND vs VCC (0.137148ms)
✔ nome automático = menor REF.pino em ordem natural (R2 < R10) (1.320028ms)
✔ pino isolado não gera rede; nomes colidentes recebem sufixo com aviso (0.240861ms)
✔ setNet renomeia rótulo; desfazer restaura (0.324773ms)
✔ mover/girar símbolo arrasta extremidades ligadas; undo exato (0.520734ms)
✔ mover um fio selecionado move todos os pontos (0.1273ms)
✔ sem campo cur nas extremidades salvas (correção) (0.147377ms)
✔ migração v1 → v2: fios por pino viram polilinhas; cur descartado; rede preservada (0.75914ms)
✔ v2 rejeita coordenadas não inteiras e versões inválidas (0.212642ms)
✔ diff com PCB: mudanças, renomeação, erros pad/pino, extras, aplicar (0.533897ms)
✔ diff: pad inexistente no footprint e pad sobrando no PCB (0.123171ms)
✔ ponta a ponta: esquemático → netlist → diff contra PCB vazio (0.188193ms)
✔ desempenho: 2000 fios em grade com índice espacial (15.720057ms)
✔ snap ao grid de 10 (0.906229ms)
✔ inserir símbolo: id, referência e snap (0.557642ms)
✔ símbolo desconhecido é rejeitado (0.328043ms)
✔ mover + desfazer + refazer (1.07128ms)
✔ rotação muda posição mundial dos pinos (0.365112ms)
✔ fio entre pinos e netlist (1.202974ms)
✔ excluir símbolo remove fios ligados; undo restaura ordem (0.42459ms)
✔ histórico: novo comando limpa redo; undo vazio retorna false (0.740333ms)
✔ desfazer tudo volta ao documento vazio e refazer tudo reconstrói (2.914176ms)
✔ hit-test de símbolo e pino (1.110337ms)
✔ viewport: zoom ancorado preserva o ponto sob o cursor; pan (0.410096ms)
✔ salvar/abrir JSON: round-trip e validação (1.038281ms)
✔ listeners do histórico são notificados (0.163291ms)
✔ W: duplo clique encerra sem vértice duplicado (1.619212ms)
✔ W: dblclick nativo também encerra; cliques lentos no mesmo ponto não duplicam (0.168944ms)
✔ Enter (finish) e Esc (cancel) desligam o modo; botão reflete o estado (0.261686ms)
✔ arrasto a partir de pino termina no ponto solto (0.211942ms)
✔ clique simples em pino (idle) seleciona, não começa fio (0.132052ms)
✔ clique fora de pino em idle pede seleção (0.107851ms)
✔ segmentos sempre ortogonais, inclusive saindo de pino fora da grade (LED) (0.75907ms)
✔ pick: pino > símbolo > fio; rótulo é selecionável pelo pino (0.415088ms)
✔ renomear: rótulo/GND/porta → setNet; fio → novo rótulo; componente/nada → mensagem (1.655111ms)
✔ aviso unconnected para rótulo/porta solto e texto dos avisos (0.558237ms)
✔ conflito de nomes gera aviso descrito (1.707837ms)
ℹ tests 86
ℹ suites 0
ℹ pass 86
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 256.934424
```
