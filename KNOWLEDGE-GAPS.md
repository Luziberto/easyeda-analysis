# Lacunas de conhecimento

**Rodada 6 (29/10/2026):** snapping (SCH e PCB) e netlist analisados em docs/15. Snap CONFIRMADO. needJunction esclarecido. Formato `schNetlist` de Import Changes CONFIRMADO. Cálculo do netlist e prioridade de nomes ficam no host ou servidor (DESCONHECIDO no cliente).

**Rodada 5 (29/10/2026):** bundles Std 6.5.61 (editorSCH, editorPCB, jsapi) analisados em docs/14: G1, G2, G10 e G12 FECHADOS (CONFIRMADA); G4 PARCIAL (lado editor: DSN + importSession; transporte WS no frame pai, não enviado); G8: Std simula via REST `/api/documents/{uuid}/simulate`.

**Rodada 4 (29/10/2026):** o usuário enviou um cliente desktop, que é o **EasyEDA Pro 3.2.209**, não o Std (docs/13). Os achados abaixo valem para o Pro (CONFIRMADA) e só por analogia para o Std (INFERIDA).

**Rodada 3 (29/10/2026):** aprofundamento só estático sobre arquivos já baixados, sem contato com easyeda.com (docs/12). Limite: editorSCH/editorPCB e os workers dedicados não foram baixados.

Rodada 1: as fases dinâmicas não foram executadas (sem navegador, robots.txt). **Rodada 2 (29/10/2026):** o usuário capturou no navegador e na conta dele um HAR, exports (Gerber zip, JSON e SVG do PCB) e screenshots do DevTools. Nada foi buscado do easyeda.com pelo agente. Material sanitizado em `evidence/`.

| ID | Lacuna | Estado | Como verificar (sessão de navegador com DevTools, conta de teste própria) |
|---|---|---|---|
| G1 | Estrutura real do DOM renderizado (grupos, ids e classes de cada primitiva) | **PARCIAL, INFERIDA (estática)** | SVG retido: `svg#root`, camadas `g` (g1, gNets, gDrcDots, masker-*…), metadados `c_partid`/`c_etype`, cor por camada via `[layerid=N]`. Ver docs/12 §G1. Falta o DOM vivo, com primitivas reais **R5: FECHADO**, ids do SVG (docs/14). |
| G2 | Pilha de undo: snapshot ou comando, limite, agrupamento | **PARCIAL, INFERIDA** | Pilha por aba (array + cursor via `history_change`), registros rotulados por operação (`getHistory`), undo de projeto por merge de `getHistoryTimestamp`, transações `cacheHistory`/`flushHistory`. **Snapshot vs diff e o limite ficam DESCONHECIDOS:** estão em editorSCH/PCB, não baixados. docs/12 §G2 **Pro (docs/13):** Command pattern, diffs old/new, `maxLength=50` (sch.js @4176499); PCB: comandos compostos e mementos de polígono. **R5 Std: FECHADO**, maxLength=120, tuplas híbridas, batch/merge (docs/14). |
| G3 | Chamadas de rede ao salvar e abrir | **FECHADA, CONFIRMADA** | HAR [30] `documents/create`, [31] `GET documents/{uuid}`, [42] `datastrid`, [43] `update_canvas`, [44] `update_sort`, [59] create do PCB. Form-urlencoded **com gzip**, `dataStr` completo, auth por cookie e sem header Authorization, envelope `{success,code,result}`, revisões `datastrid`. Ver docs/04-* |
| G4 | Protocolo do autorouter via WebSocket | DESCONHECIDA | O HAR não tem WS nem resposta 101; o autorouter não foi executado. Próximo passo: capturar um HAR rodando o autorouter (Firefox salva os frames WS) **Pro (docs/13):** autorouter local em WASM (PCBRouter/jrouter) via worker bus `pangolin/autoRouting_wasm`, sem WS. Std segue DESCONHECIDO. **R5 Std:** DSN Specctra + importSession incremental start/…/end; WS fora dos bundles. |
| G5 | Fidelidade do parser com exportações reais 6.5.61 | **FECHADA para TRACK, VIA, PAD, CIRCLE, TEXT, SOLIDREGION, SVGNODE e LIB (PCB) e LIB, T, P, R, PL e PT (sch)**. N, F e COPPERAREA não estavam presentes (INFERIDA). `Pimage` é DESCONHECIDA, mas é preservada | 4 arquivos reais com round-trip exato; CIRCLE corrigida; 6 primitivas novas; `tests/real-exports.test.mjs` |
| G6 | Chaves de IndexedDB e localStorage | **FECHADA (estrutura), CONFIRMADA** | IndexedDB `DBEasyEDA`: `autoSaveTable {pid,fid,dataStr}` (índices fid, pid, pid_fid), `openedDocsTable`, `files` (`config-opened-projects`), `copperArea`, `fonts`, `scripts` (screenshots do usuário). O conteúdo de `copperArea` e `scripts` é INFERIDO |
| G7 | Uso exato do WebGL (Photo View? 3D?) | **FECHADA, INFERIDA (estática)** | WebGL só em jsapi (@413547): Phong + booleanos via stencil, ou seja, 3D View e rasterização. Photo View é SVG (`toSVG`→`importPhotoview`). docs/12 §G7 |
| G8 | Motor de simulação no servidor e formato da resposta | DESCONHECIDA | Não exercitada no HAR; precisa de nova captura simulando um RC **Pro (docs/13):** app externo ngspice/SimulIDE em `localhost:17965`, aberto por `lceda-sim://`; nada embutido. **R5 Std:** endpoint REST `/api/documents/{uuid}/simulate`. |
| G9 | Saída de Gerber, SVG e netlist | **FECHADA para Gerber, Excellon, SVG e JSON**; netlist e pick&place ABERTOS | Zip real: FSLAX45Y45/MOMM, Excellon METRIC,LZ 3:3, furo 0,310 mm = holeRadius do VIA, outline 6×4 mm = `get_price`. Geração no cliente CONFIRMADA pelo HAR (`download_gerber`→`true`). O uuid do usuário vai no cabeçalho G04 (redigido) |
| G10 | Cobertura de regras de DRC e ERC | **FECHADA (cobertura), INFERIDA** | DRCRULE {trackWidth, clearance, viaHoleDiameter, viaHoleD, nets} + isRealtime/checkObjectToCopperarea; checks TrackSize→Hole→BoardOutline→Clearance + ratLine. **Não há ERC formal** (só prefixos duplicados e no-connect). Os algoritmos internos ficam em drcWorker, DESCONHECIDOS. docs/12 §G10 **R5: FECHADO**, ge.doDRC + worker testClearance + rbush (docs/14). |
| G11 | Versões de EasyUI, pako, opentype e polybool | **FECHADA, INFERIDA** | EasyUI customizado ≤1.3.x; pako via JSZip 3.1.3; opentype ≥1.3.4; "polybool" é uma lib TS interna; d3 5.9.2; intro.js 0.5.0. docs/12 §G11 |
| G12 | Algoritmos de ratsnest e copper pour | **Pour FECHADO, INFERIDA; ratsnest PARCIAL** | Pour em 5 passos (clearance→outline→mergeSameNet→thermal→solid/grid + remoção de ilhas) sobre sweep-line própria. O ratsnest liga grupos roteados (`routedGroupMap`); o algoritmo está em ratLineMgrWorker, não baixado, e segue DESCONHECIDO. docs/12 §G12 **Pro (docs/13): ratsnest = MST de Kruskal sobre Delaunay entre clusters de cobre** (ratlineworker.js @2328501). Para o Std, analogia INFERIDA. **R5 Std: FECHADO**, Kruskal em grafo completo (dist²), lotes de 100 redes (docs/14). |
### Novas lacunas (rodada 2)
| ID | Lacuna | Estado |
|---|---|---|
| G13 | Comportamento do servidor quando o `datastrid` do save está desatualizado (conflito) | INFERIDA (rejeição) |
| G14 | Códigos de erro do envelope (`code` ≠ 0) | DESCONHECIDA (só sucessos capturados) |
| G15 | Primitiva `Pimage` (campos) | DESCONHECIDA |
| G16 | Autosave remoto: existe, ou só o IndexedDB? | INFERIDA (só local: 15 min sem `update_canvas` automático) |
