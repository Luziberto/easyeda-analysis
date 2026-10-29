# Relatório mestre — Análise técnica do EasyEDA Standard (v6.5.61)

**Escopo:** análise estática ética do editor público (https://easyeda.com/editor) e da documentação oficial, para especificar um editor EDA web próprio e original. Data: 29/10/2026.

## Principais descobertas confirmadas
1. A build 6.5.61 (27/10/2026) é um monolito de front-end: jQuery 1.8.2 + EasyUI e cerca de 7,4 MB de JS em 5 bundles, sem WASM, sourcemap ou service worker. (01-*)
2. Edição em **SVG DOM retido**. Cada documento roda num **iframe** por aba, controlado pela casca via `fi(cmd,args,frame)`. Abrir um documento passa por `dataStr → solver → {svgStr, jsonCache, cssStr}`. (02, 03)
3. Um **Web Worker** cuida de copper pour, ratsnest, R-tree, teste de clearance, descompressão e exportação. Os tipos de mensagem foram confirmados. (03, 07)
4. **Gerber RS-274X e Excellon são gerados no cliente** ("Gerber Generator version 0.2"). Agora CONFIRMADO pelo HAR: `download_gerber` só devolve `true`. O zip real (FSLAX45Y45, MOMM) bate com o modelo. (05, 07)
5. Simulação, conversão de Altium/Eagle/KiCad, biblioteca, preços e pedidos ficam no **servidor** (116 rotas internas observadas estaticamente e não chamadas). O autorouter é um serviço via **WebSocket**, na nuvem ou local (porta 3579). (04)
6. O formato Std está documentado publicamente: primitivas `CMD~campos`, sub-shapes `#@$`, segmentos `^^`, docTypes 1/3/4/5/7, e 1 unidade PCB = 10 mil. (05)
7. Há uma tabela de 105 atalhos e 264 comandos de UI, o que dá o escopo funcional do produto. (02)

8. **Rodada 2 (HAR e exports do usuário, sanitizados):**
   - O save e o open são XHR same-origin, autenticados **só por cookie** (sem Authorization).
   - O envelope é sempre `{success,code,result}`.
   - `documents/create` e `update_canvas` mandam um form-urlencoded **em gzip** com o `dataStr` **inteiro**, mais `BOM`, `libsCount` e `project_version`.
   - Cada save gera um **novo `datastrid`** (revisões imutáveis, `histories[]`).
   - O PCB é convertido **no cliente**.
   - O autosave é local, em IndexedDB `DBEasyEDA.autoSaveTable`.
   - Polling de `isLogin` e notificações a cada 120 s.
   - O uuid da conta é gravado no cabeçalho de todo Gerber. (02, 04, 05)
9. O parser próprio faz **round-trip exato com 4 arquivos reais 6.5.61**: ordem de CIRCLE corrigida; TEXT, SOLIDREGION, SVGNODE, PT e PCB-LIB adicionadas; `dataStr` como objeto na abertura. (05)

## Desconhecido
- DOM real (G1) e pilha de undo (G2).
- Protocolo WS do autorouter (G4) e simulação (G8): não exercitados na captura.
- WebGL (G7), cobertura de DRC (G10), versões de libs (G11) e algoritmos de ratsnest e pour (G12).
- Conflito de revisão (G13), códigos de erro (G14), `Pimage` (G15) e N, F e COPPERAREA reais.

Fechadas na rodada 2: G3, G5, G6 e G9 (parcial: falta o netlist). Detalhes em KNOWLEDGE-GAPS.md.

## Artefatos
- `docs/`: 01–11, 30 arquivos.
- `diagrams/`: 6 diagramas Mermaid.
- `examples/`: 4 JSON sintéticos e 3 fixtures reais sanitizadas (`real-*.json`).
- `tests/`: parser, round-trip e conectividade.
- `prototype/`: editor SVG e core testado.
- Arquivos raiz: `FEATURE-MATRIX`, `KNOWLEDGE-GAPS`, `IMPLEMENTATION-PLAN`, `RESEARCH-LOG`.
- `evidence/`: hashes, offsets, mapas de endpoints, atalhos e comandos, JSON do REA. Os bundles brutos foram excluídos.
- `evidence/session.sanitized.har` e `evidence/real-exports/`: HAR e exports do usuário, sem cookies, tokens nem PII.
- `reports/`: saídas de teste.

## Testes
47 testes, 47 aprovados, 0 falhas: 13 do core, 18 do formato e 16 com dados reais. A UI não foi testada em navegador.

## Arquitetura recomendada
Um core TypeScript puro com o modelo como fonte da verdade, comandos reversíveis e IDs estáveis. A renderização é derivada: SVG no MVP1–2 e WebGL2 no PCB. Motores pesados rodam em workers (DRC, pour, ratsnest, ngspice-wasm). O armazenamento é local-first em IndexedDB com formato JSON próprio versionado. Há importação do EasyEDA Std pelo formato público. O autorouter e a colaboração entram depois, como serviços e plugins desacoplados.

## Bloqueios e conformidade
- Na rodada 1 não havia navegador. Na rodada 2, a parte dinâmica usou **apenas capturas feitas pelo próprio usuário**, sem nenhum fetch ao easyeda.com.
- O site **não recusou** o acesso automatizado: todas as respostas foram HTTP 200, sem CAPTCHA.
- Porém o `robots.txt` tem `Disallow: /` para agentes de IA e `Disallow: /api/` para todos. A coleta foi mínima e foi encerrada; nenhuma rota `/api/` foi acessada.
- Nenhuma credencial coletada; o ID de usuário encontrado foi redigido.
- Nenhum código proprietário foi copiado para o protótipo.

## Rodada 3
Aprofundamento estático de G1, G2, G7, G10, G11 e G12: ver docs/12-STATIC-DEEP-DIVE.md e KNOWLEDGE-GAPS.md.

## Rodada 4
Cliente desktop = EasyEDA Pro 3.2.209: ver docs/13-DESKTOP-CLIENT.md.

## Rodada 5
Bundles do editor Std: ver docs/14-STD-EDITOR-BUNDLES.md.

## Rodada 6
Snapping e netlist: ver docs/15-SNAP-NETLIST.md.
