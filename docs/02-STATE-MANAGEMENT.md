# 02 — Gerência de estado

| Aspecto | Descoberta | Estado | Evidência |
|---|---|---|---|
| Isolamento por aba | Cada documento aberto roda num **iframe** próprio. A casca chama funções do editor via `fi(nome, args, frame)` (`Yn.getTabIFrame`, `getDocStatus`) | CONFIRMADA (código) | main.min.js @805018 |
| Estado de undo/redo | Cada aba reporta `canUndo`/`canRedo` à casca, que agrega os flags para os botões | CONFIRMADA | @805018 |
| Histórico para extensões | A API de extensões expõe `cacheHistory` / `flushHistory`, que agrupam mudanças num passo de undo | CONFIRMADA (nomes) / INFERIDA (semântica) | @1168774 |
| Modelo em memória | Ao abrir, `dataStr` passa por um "solver" que produz `{svgStr, jsonCache, cssStr}`. O documento é materializado como **SVG DOM + cache JSON** | CONFIRMADA (código) | @371124 |
| Clipboard entre abas | `window.globalEditorClipboard` | CONFIRMADA | @805018 |
| Persistência local | IndexedDB **`DBEasyEDA`** com os stores `autoSaveTable` (registros `{pid, fid, dataStr}`, índices `fid`, `pid` e `pid_fid`), `openedDocsTable`, `files` (chave `config-opened-projects`), `copperArea`, `fonts` e `scripts`; mais localStorage `easyeda.orgUuid` | **CONFIRMADA** (capturas do DevTools feitas pelo usuário) | screenshots anexados pelo usuário (não incluídos no pacote; não continham segredos visíveis no texto transcrito) |
| Fonte da verdade | O servidor guarda o **documento inteiro** a cada save: `POST /api/documents/{uuid}/update_canvas` (form em gzip), que devolve um **novo `datastrid`**. A criação usa `documents/create` e devolve `master`, que é o primeiro datastrid. `histories[]` do projeto lista as revisões | **CONFIRMADA (HAR)** | HAR [30] [42] [43] [59]; docs/04-DATA-CONTRACTS.md |
| Autosave | O rascunho local vai para `autoSaveTable` (chave `pid_fid`). O save no servidor no HAR foi **manual** (Ctrl+S, às 01:40:30 BRT): não houve nenhum `update_canvas` periódico em 15 min de sessão | CONFIRMADA (store) / INFERIDA (o autosave é só local) | IndexedDB + ausência no HAR |
| Concorrência | Antes de salvar, o cliente faz `GET …/datastrid?project_version=` e compara com a revisão local | CONFIRMADA (sequência) / INFERIDA (bloqueio em caso de conflito) | HAR [42]→[43] |
| Estrutura da pilha de undo | Snapshot ou comando? | DESCONHECIDA | precisa de um navegador |

Os identificadores de objeto são `gId` (por exemplo `gge123`). O flag `hasIdFlag` no head indica que os IDs foram persistidos. CONFIRMADA (doc).

## Atualização da rodada 3 (G2)
Veja **docs/12-STATIC-DEEP-DIVE.md**, seção G2: achados INFERIDOS (estáticos), com arquivo e offset.
