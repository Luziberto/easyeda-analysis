# Plano de implementação

**Estado do protótipo (`prototype/`): concluído** — ver [docs/PROTOTYPE-SCOPE.md](docs/PROTOTYPE-SCOPE.md).

1. **Semana 0–2 (MVP1):** ~~TypeScript, seleção, fios, Playwright, CI unit~~ ✓
2. **Semana 3–8 (MVP2):** ~~multi-folha, ERC, imports/exports, PDF impressão, símbolos custom mínimos~~ ✓
3. **Semana 9–20 (MVP3):** ~~PCB sync, Gerber/silk, DRC, ratsnest MST, walkaround, pour keepouts, gerbv CI, WebGL~~ ✓
4. **Semana 21+ (MVP4):** ~~Sim ngspice WASM (.op), resumo .tran, painel Sim, vista 3D + rotação~~ ✓ (escopo protótipo)

**Pós-protótipo (não planeado aqui):** pour Clipper2, autorouter, ngspice `.tran` só WASM, CRDT, plugins, paridade 264 comandos Std.

Regras permanentes: código 100% original; nenhum asset ou dado de biblioteca do EasyEDA; compatibilidade só pelo formato documentado publicamente; testes antes de declarar funcionalidade pronta.

Pendências que exigem aprovação do usuário: sessão DevTools + conta de teste (lacunas G1–G10) para fechar incógnitas do cliente EasyEDA real.
