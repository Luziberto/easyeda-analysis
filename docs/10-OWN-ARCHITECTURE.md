# 10 — Arquitetura própria proposta

Princípio: **o modelo é a fonte da verdade; a renderização é derivada.** É o oposto do EasyEDA, onde o SVG DOM é o modelo.

```mermaid
graph TB
  UI[UI shell: TS + framework leve] --> Cmd[Command bus + History]
  Cmd --> Model[Document model<br/>imutável/estruturado, IDs estáveis]
  Model --> Idx[Índices: R-tree, conectividade]
  Model --> Ren[Renderer<br/>SVG MVP1-2 → WebGL2/Canvas MVP3+]
  Model --> IO[IO: formato próprio JSON, import Std, export SVG/Gerber/Excellon/BOM/SPICE]
  Model --> Wk[Workers: DRC, pour, ratsnest, simulação ngspice-wasm]
  Model --> Store[(IndexedDB local-first + autosave)]
  Store -.-> Sync[Sync opcional: servidor CRDT/OT, MVP4]
  Plg[Plugins sandboxed] --> Cmd
```
Camadas:
1. `core` (puro TS, sem DOM, 100% testável). Contém documento, comandos reversíveis, histórico, geometria e conectividade. O protótipo já implementa isso em `prototype/src/core`.
2. `format`: parser e serializador, versionados e com migrações. Já existe o leitor e escritor Std em `prototype/src/format`.
3. `render`: o renderizador lê o modelo e o viewport, e é trocável.
4. `engines` em workers, comunicando por mensagens tipadas.
5. `app`: ferramentas como máquinas de estado (idle, desenhando fio, arrastando).
6. `plugins`: API pública estável que chama comandos, não o DOM.
