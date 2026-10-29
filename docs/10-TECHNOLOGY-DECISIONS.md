# 10 — Decisões tecnológicas

| Decisão | Escolha | Motivo | Alternativa |
|---|---|---|---|
| Linguagem | TypeScript | tipagem do modelo e dos contratos | JS (o protótipo usa JS+ESM para rodar sem build) |
| Renderização | SVG no MVP1–2; WebGL2 (ou Canvas2D com tiles) no PCB do MVP3 | SVG é simples e permite hit-test nativo, mas degrada com dezenas de milhares de objetos | PixiJS |
| Estado | comandos reversíveis + modelo normalizado | undo granular e colaboração futura | snapshots imutáveis (Immer) |
| Geometria | lib própria + Clipper2 (BSL-1.0) para booleanos | robustez em copper pour | polybool (MIT) |
| Índice espacial | R-tree (rbush, MIT) | hit-test e DRC | quadtree |
| Persistência | IndexedDB local-first, arquivo `.json` próprio versionado | offline | OPFS |
| Simulação | ngspice → WASM em worker | local e sem servidor | servidor |
| Autorouter | plugin externo via Specctra DSN/SES | separação de licença | — |
| Testes | node:test no core; Playwright para e2e (fora do escopo atual, não instalado) | — | Vitest |
| Formato de troca | import EasyEDA Std; export Gerber X2, Excellon, IPC-D-356, KiCad | interoperabilidade | — |
