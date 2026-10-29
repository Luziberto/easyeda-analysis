# Log de pesquisa

Horários em America/Fortaleza (UTC-3). Data: 29/10/2026. O cabeçalho `date` do HTTP registrou 04:08:12 GMT (01:08 em Fortaleza) na primeira coleta.

1. `curl -sSI` e `curl -sS https://easyeda.com/editor` → HTTP 200, 228.947 B, CloudFront/nginx. Os headers foram salvos e depois sanitizados (removidos `set-cookie` e IDs de trace).
2. Os assets referenciados no HTML foram identificados e baixados (6 arquivos, HTTP 200). Foram gerados os SHA-256.
3. O path do worker foi encontrado em `<input id=worker_main>`. Não há WASM, sourcemaps nem service worker (grep negativo).
4. Docs oficiais: as URLs adivinhadas deram 404 e foram descartadas. As 6 páginas DocumentFormat corretas foram encontradas pelos links da página PCB, mais a Format-Standard e a API List.
5. REA MCP: `analyze_web_bundle` e `observe_web_session` exigem navegador CDP e estão indisponíveis. Usados `open_binary`, `inspect_artifact` e `analyze_javascript_application`: 3 arquivos, 283.989 nós, 110 módulos, 611 achados, 0 falhas de parse.
6. Greps de strings e offsets: endpoints (116 rotas → `evidence/endpoint-map.txt`, ID de usuário redigido), atalhos (105 → `hotkeys.txt`), comandos (264 → `editor-commands.txt`), tipos de mensagem do worker, fingerprints de bibliotecas, gerador Gerber/Excellon, autorouter WS, WebGL em jsapi @413548.
7. `robots.txt`: `Disallow: /` para agentes de IA e `Disallow: /api/` para todos. **Coleta em easyeda.com encerrada.** Os bundles brutos foram movidos para fora do pacote (`/workspace/easyeda-raw/`, não entregue).
8. Escrita do parser e serializador original e dos exemplos sintéticos. A primeira execução falhou por uma contagem errada esperada no teste (8 → 10); corrigido, 18/18.
9. Protótipo e core: 13 testes. `node --test` com diretório não funciona no Node 24; foram usados globs. Total 31/31.
10. Smoke da UI: `node --check` e servidor estático com 200 nos 4 arquivos. Não houve navegador.
11. Nenhuma tentativa de contornar autenticação, nenhuma chamada a `/api/` e nenhuma credencial coletada. Não houve bloqueio por WAF nem CAPTCHA.

## Rodada 2: material do usuário (29/10/2026, 01:50–02:10 BRT)
12. Recebidos do usuário: um HAR (73 entradas, Firefox, sessão das 01:35 às 01:50 BRT), o Gerber zip, o JSON e o SVG do PCB e 5 screenshots do DevTools. **Nenhum fetch ao easyeda.com.**
13. Sanitização (`sanitize.py`, fora do pacote):
    - removidos os headers Cookie, Set-Cookie, Authorization, csrf e trace-id, e os arrays `cookies[]`;
    - redigidos chaves e valores token/session/csrf, `keyId`, JWT e e-mail;
    - redigidos o uuid e o username do usuário, nickname, first_name e customer_code;
    - redigidas as query strings de terceiros; corpos binários trocados por placeholder.

    Os corpos gzip (guardados pelo HAR como latin-1) foram decodificados com `gzip.decompress(t.encode('latin-1'))` e redigidos. O uuid também estava nos cabeçalhos dos Gerber e foi redigido. A varredura por grep do uuid, do username, de cookies e de JWT voltou **0 ocorrências** (agora automatizada num teste).
14. Análise do HAR → docs 02 e 04 reescritos (fluxos boot, criar, salvar, converter para PCB, Gerber).
15. Validação do parser com 4 arquivos reais. Falhas iniciais: a ordem de CIRCLE estava errada e TEXT, SOLIDREGION, SVGNODE, PT e PCB-LIB não existiam. Corrigido com código original, junto com `extractPcbNets` e `svgNodeOf`.
16. A resposta de abertura traz `dataStr` como **objeto**, o que quebrava o round-trip do docType 5 e a detecção do docType sem head. Corrigido (`dataStrIsString`, `docType` no topo) e coberto por teste.
17. `npm test`: 47/47 (13 core + 18 formato + 16 reais). Smoke da UI: `node --check` OK e 5 arquivos com HTTP 200.

## Rodada 3: aprofundamento estático (29/10/2026, BRT)
18. Servidor estático do protótipo em segundo plano: `python3 -m http.server 8765` em prototype/ → http://localhost:8765/index.html (HTTP 200).
19. **Nenhum contato com easyeda.com.** Fontes: os 5 bundles já baixados (sha256 em docs/12) e o HTML de editorpage1/3 dentro do HAR sanitizado.
20. G1: ids, grupos e estilos do HTML das páginas de editor. G7: grep por getContext, webgl e shaders. G11: banners e `.version`, lista de plugins EasyUI, caminhos `./src/algorithm/*.ts`.
21. G10: `DRCRULE` padrão (@2330217), ordem dos checks no worker e chaves i18n EN; ERC ausente.
22. G2: `history_change`, `getHistory`, `getHistoryTimestamp`, `project_undo` e `cacheHistory`/`flushHistory` em main.min.
23. G12: o log `pp %s step 1..5` em jsapi revela o pipeline de pour; o ratsnest fica no worker dedicado, não disponível.
24. Limite registrado: editorSCH/editorPCB e os workers rtree, ratLine e drc não estão no material local.

## Rodada 4: cliente desktop (29/10/2026, ~10:30 BRT)
25. 4 partes (78,8 MB) concatenadas na ordem 0–3 → `client.bin` (zip, sha256 660f84dc…). A primeira tentativa, de 2 partes, falhou: os anexos não eram visíveis no box e CopyToBox tem limite de 100 MiB.
26. Extraído com `unzip` em `/workspace/easyeda-desktop/x/` (fora do pacote), sem execução. Identificado como **EasyEDA Pro 3.2.209** (package.json e version.txt).
27. Inventário: Electron/Chromium a partir das strings do binário; app sem asar; sqlite3 nativo; 3 WASM; schema do `.elib` via sqlite3 em modo somente leitura.
28. G2, G12, G4 e G8 investigados com regex e contexto nos bundles do Pro (offsets em docs/13). As ferramentas REA não foram necessárias: o JS vem sem empacotamento asar e é legível.
29. Sem contato com easyeda.com; nada instalado.

## Rodada 5: bundles Std (29/10/2026, ~11:10 BRT)
30. Anexos .js e .zip invisíveis ao Shell; Read não lê zip. O usuário copiou o zip do seu computador para `/workspace/easyeda-raw/std-editors/` (fora do pacote).
31. Extraídos editorSCH, editorPCB e jsapi (desminificação semântica do usuário; nomes renomeados, literais intactos).
32. G2, G12, G4, G1 e G10 investigados com grep e sed por literais (`maxLength`, `defineUndoRedo`, `kruskalsMST`, `exportDSN`, `importSession`, `testClearance`, `RTreeMgr`); resultados em docs/14.
33. Sem contato com easyeda.com; nada executado.

## Rodada 6: snap e netlist (29/10/2026, ~11:20 BRT)
34. Grep por `adsorbGrid`, `getSnapSize`, `altKey`, `ifFind`, `needJunction`, `schNetlist`, `netNode`, `convertToPCB`; leitura das linhas citadas em docs/15.
35. Comparado com model.js `netlist()`; melhorias escritas sem copiar código.

## Rodada 7: implementação (29/10/2026, BRT)
36. Criados `connectivity.js` e o novo `model.js` (v2), além da biblioteca com GND/VCC/rótulo/porta. Código original.
37. Na primeira execução, 70/75 testes passaram. As 5 falhas: -0 no snap; snap indevido em `addWire(pontos)`; três testes com geometria errada. Tudo corrigido; 75/75.
38. UI reescrita (fio por pontos, Alt meio passo, rótulos, junções, netlist) e favicon adicionado. Carga headless sem erros; o servidor em :8765 serve a nova build.
39. Rodada 8: 7 bugs de UI corrigidos. Interação extraída para `controller.js`, com 11 testes novos (86/86) e smoke E2E via CDP aprovado.
