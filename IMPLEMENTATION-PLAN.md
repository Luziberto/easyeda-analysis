# Plano de implementação

1. **Semana 0–2 (MVP1):** migrar `prototype/src/core` para TypeScript; adicionar seleção por caixa, propriedades e fios com vértices; setup do Playwright no repositório do projeto (com aprovação); CI rodando `node --test`.
2. **Semana 3–8 (MVP2):** ~~rótulos e multi-folha~~ (feito v3); ~~ERC heurístico~~; editor de símbolos (pendente); ~~importação Std por folha~~; ~~netlist SPICE/KiCad~~; ~~exportação SVG~~ (PDF pendente); ~~autosave IndexedDB~~ (já existia).
3. **Semana 9–20 (MVP3):** ~~modelo PCB + sync + Gerber/PnP + walkaround + pour clearance + DRC + gerbv CI + WebGL2 + ratsnest MST + import outline + silk GTO~~ (protótipo); pendente: Clipper2 pour boolean completo, R-tree, worker ratsnest, autorouter, camadas máscara/paste.
4. **Semana 21+ (MVP4):** ~~Sim ngspice WASM (.op) + painel Sim; vista 3D PCB com rotação~~ (início); CRDT; plugins; autorouter externo; ngspice in-browser completo (.tran).

Regras permanentes: código 100% original; nenhum asset ou dado de biblioteca do EasyEDA; compatibilidade só pelo formato documentado publicamente; testes antes de declarar qualquer funcionalidade pronta.
Pendências que exigem aprovação do usuário: uma sessão de navegador com DevTools e conta de teste própria (lacunas G1–G10) e a instalação de Playwright e navegador.
