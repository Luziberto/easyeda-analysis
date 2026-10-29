# 11 — Protótipo (código original)

Local: `prototype/`. TypeScript (ES modules) + SVG; build com `tsc` → `dist/`. Licença MIT. Nenhum código, ícone ou símbolo do EasyEDA foi usado.

## Rodada MVP4 — simulação e 3D (fechamento)
- **Sim:** ngspice WASM (`.op`) + resumo transiente (spice-ts); painel **Sim**; import map para WASM no browser.
- **PCB 3D:** botão **3D**, rotação por arraste, zoom com roda no canvas WebGL.

## Rodada MVP3 — produto integrado (esquemático + PCB)
- Modo **Esquemático | PCB**; `project.pcb` no mesmo JSON.
- **Sync** esquemático → footprints + redes (`diffNetlist`).
- PCB: camadas top/bottom (visualização), trilhas, **vias**, **ratsnest**, **walkaround (L)**, **copper pour**, **DRC** (clearance pad/trilha/via, contorno, órfãos; marcadores vermelhos no canvas).
- Export **Gerber** (GTL/GBL/GKO/GTO + Excellon `.drl`), botão **Fab (5 ficheiros)**, pick&place; pads com rotação; ratsnest **MST** entre grupos desconectados; pour com **keepouts** visuais; walkaround evita trilhas/vias; import PCB inclui **contorno layer 10**.
- Visualização **WebGL2** (botão WebGL no modo PCB).
- Esquemático: **anotações**, campo **valor**, **símbolos custom** (painel Biblioteca), **PDF** (todas as folhas), **remover folha**, **BOM CSV**.

## Rodada MVP2 esquemático (v3)
- **Project v3:** multi-folha (`sheets`, `activeSheetId`), migração v1/v2 → v3; netlist de projeto (`buildProjectNetlist`) une redes pelo nome entre folhas.
- **UI:** abas de folha (`#sheetTabs`), **+ Folha**, renomear por duplo clique; barramento (**B**); inversor **U** na paleta.
- **ERC:** `src/core/erc.ts` + painel **Executar ERC** (erros/avisos em pt-BR).
- **Export:** KiCad `.net`, SPICE `.cir`, SVG (`export-svg.ts`); botões na barra.
- **Import EasyEDA:** docType **1** ou **5** — uma folha por `schematics[]`, sem offset artificial; primitiva **B** → `bus`.
- **Testes:** **99** unit (`erc.test.mjs`, `exports.test.mjs`, …) + **5** e2e Playwright.

## Rodada 10: TypeScript, espelhar, import multi-folha, Playwright e CI
- **TypeScript:** `src/**/*.ts` → `npm run build` (`tsc`) → `dist/`; a UI carrega `./dist/ui/app.js`.
- Tipos em `src/core/types.ts`; biblioteca `SYMBOLS` tipada como `Record<SymbolKind, SymbolDef>`.
- **`Commands.flipH`:** espelho horizontal (`mirror` no símbolo); atalho **X** e botão na barra.
- **Import EasyEDA:** docType **1** ou **5** (projeto multi-folha, folhas deslocadas a cada 500 un).
- **Playwright:** `npm run test:e2e` (4 cenários em `e2e/editor.spec.ts`).
- **CI:** `.github/workflows/ci.yml` — unit + e2e no Node 22.
- Testes unitários: **91** (flip, projeto docType 5).

## Executar
```bash
cd prototype
npm install
npm run build          # ou implícito em test/serve
npm test               # build + testes unitários Node
npm run test:e2e       # build + Playwright (8 cenários)
npm run test:all       # unit + e2e
npm run validate-gerber
npm run serve          # build + http://localhost:8080/
```

Escopo completo vs. paridade EasyEDA: [PROTOTYPE-SCOPE.md](PROTOTYPE-SCOPE.md).

### UI (rodadas 9–10)
- Layout tipo editor EDA: barra superior, abas de folha, paleta lateral, canvas, painel Inspector / Netlist / ERC / Atalhos.
- Seleção por caixa, inspector (`setRef` / `setNet`), autosave IndexedDB, import EasyEDA.
- Estilos em `src/ui/styles.css`.

## Funcionalidades
- Grid de 10 px com snap; zoom pela roda do mouse, ancorado no cursor; pan com botão do meio, direito ou Alt+arrastar.
- Inserção de resistor, capacitor, LED e GND, com referências automáticas R1, C1, D1…
- Seleção por clique (Shift adiciona à seleção); arrastar para mover, com prévia sem poluir o histórico.
- Girar (R) e excluir (Delete), removendo junto os fios ligados.
- Fio entre pinos: arrastar de um pino a outro.
- Desfazer e refazer (Ctrl+Z / Ctrl+Y e botões).
- Salvar e abrir JSON (`format: proto-eda-schematic`, `version: 1`), com validação de referências.
- A barra de status mostra a contagem de redes, vinda de uma netlist union-find.

## Estrutura
- `src/core/model.js`: documento, comandos, histórico, viewport, hit-test, serialização e netlist (puro, testado).
- `src/core/library.js`: símbolos desenhados para este projeto.
- `src/format/easyeda-std.js`: leitor e escritor do formato público EasyEDA Std.
- `src/ui/app.js`: interação SVG.
- `tests/core.test.mjs`: 13 testes do core.

## Limitações atuais (resumo)

Ver lista completa em [PROTOTYPE-SCOPE.md](PROTOTYPE-SCOPE.md). Em sintese: pino no meio de fio nao arrasta o fio; editor de biblioteca e apenas custom minimo; pour sem boolean Clipper2; sim `.tran` resumido (nao graficos AC).

## Historico (rodadas 7–8)
- Novos símbolos: GND, VCC, rótulo de rede (pede o nome) e porta. "Renomear rede" altera o nome do rótulo ou da porta selecionada.
- Fio (botão ou tecla W): cada clique adiciona um vértice com snap; duplo clique ou Enter termina; Esc cancela. Arrastar a partir de um pino também começa um fio, que pode terminar em qualquer ponto.
- Alt segura o meio passo (5). O pan passou para o botão do meio ou o direito.
- A tela mostra os pontos de junção, os nomes de rede e, na barra de status, o número de redes e de avisos. O botão "Netlist" mostra `{nets, warnings}`.
- Favicon embutido (`data:`), sem mais 404.
- Arquivos v1 são migrados ao abrir.
- Testes: `npm test` roda 75 testes, sendo 47 antigos e 28 novos em `tests/connectivity.test.mjs`.

## Rodada 8 (2026)
A lógica de interação saiu de `app.js` e foi para `src/ui/controller.js`, um módulo puro (sem DOM) testado em `tests/ui-controller.test.mjs`.
1. **Renomear rede:** funciona com rótulo, porta, GND ou VCC selecionado (`setNet`). Com um fio selecionado, cria um rótulo no 1º vértice, ou reaproveita o rótulo que já estiver no fio. Se nada adequado estiver selecionado, aparece uma mensagem no rodapé. Causa do bug: o clique no pino do rótulo iniciava um fio em vez de selecionar, e fios não eram selecionáveis.
2. **Duplo clique:** o controlador detecta o duplo clique sozinho (≤350 ms, mesmo ponto), porque o `render()` recria o SVG e o navegador perdia o `dblclick`. O fio termina sem vértice duplicado.
3. **Arrasto a partir de pino:** soltar o botão termina o fio no ponto solto, já com snap.
4. **Layout estável:** status e avisos ficam num rodapé de altura fixa (22 px), com reticências; a barra de ferramentas não quebra linha.
5. **Estado da ferramenta:** o botão "Fio" reflete o modo de verdade e se apaga após Enter, Esc ou duplo clique. Em modo idle, clicar num pino seleciona e arrastar a partir dele começa um fio. O modo clique a clique fica com W ou o botão.
6. **Segmentos ortogonais:** cotovelo automático, horizontal primeiro, também na pré-visualização. Pinos fora da grade (LED ±25) não geram mais diagonal.
7. **Avisos:** novo aviso `unconnected` para rótulo, porta ou power sem pino. Os avisos aparecem descritos (`describeWarning`) no rodapé e no painel Netlist.
- Testes: 86 de 86 (os 75 anteriores mais 11 novos). Smoke E2E via CDP (`tools/e2e-cdp.mjs`) aprovado: arrasto do LED gerou `75,100 40,100 40,150`, o duplo clique encerrou o fio, o botão se apagou, o canvas ficou fixo em top=70, e o aviso e o renomear funcionaram.

