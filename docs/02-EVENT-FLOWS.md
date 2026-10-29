# 02 — Fluxos de eventos

Tudo aqui é INFERIDA: veio de código estático e não foi observado.

```mermaid
sequenceDiagram
  participant U as Usuário
  participant Shell as Casca (main.min.js)
  participant Tab as Iframe do documento
  participant W as Worker
  participant S as Servidor
  U->>Shell: atalho / menu (cmd=...)
  Shell->>Tab: fi(cmd, args, frame)
  Tab->>Tab: altera SVG DOM + jsonCache, empilha undo
  Tab-->>Shell: getDocStatus {canUndo, canRedo, ...}
  Tab->>W: postMessage (copper / ratLine / RTree / clearance)
  W-->>Tab: copper / ratLineMgr.buildAllNet:result / testClearanceDone
  U->>Shell: Ctrl+S
  Shell->>S: POST /api/documents/{uuid}/update (dataStr)
```
- Teclado: tabela única `[comando, escopo ALL|SCH|PCB, tecla, descrição]`, despachada pelo nome do comando. Encontrei 3 listeners `keydown` e 8 referências a `wheel`. CONFIRMADA (tabela) / INFERIDA (despacho).
- Comandos de UI: o atributo `cmd=` em itens de menu chama um despachante central. CONFIRMADA (264 comandos) / INFERIDA (mecanismo).
- Mensagens de `window` (postMessage) tratam `report`, `clone`, `_getLibUrl` e um fallback `e[a]()`. Esse fallback é uma superfície de integração entre janelas. CONFIRMADA (@~1131200).
