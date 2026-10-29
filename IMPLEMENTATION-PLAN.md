# Plano de implementação

1. **Semana 0–2 (MVP1):** migrar `prototype/src/core` para TypeScript; adicionar seleção por caixa, propriedades e fios com vértices; setup do Playwright no repositório do projeto (com aprovação); CI rodando `node --test`.
2. **Semana 3–8 (MVP2):** rótulos e multi-folha; ERC; editor de símbolos; importação Std usando `src/format/easyeda-std.js` e um corpus de testes próprio (lacuna G5); netlist SPICE/KiCad; exportação SVG/PDF; autosave em IndexedDB.
3. **Semana 9–20 (MVP3):** modelo PCB (camadas, footprints, pads, trilhas, vias); R-tree; ratsnest em worker; roteamento walkaround; copper pour com Clipper2; DRC; Gerber X2 e Excellon validados com gerbv; renderizador WebGL2.
4. **Semana 21+ (MVP4):** ngspice-wasm; 3D; CRDT; plugins; autorouter externo.

Regras permanentes: código 100% original; nenhum asset ou dado de biblioteca do EasyEDA; compatibilidade só pelo formato documentado publicamente; testes antes de declarar qualquer funcionalidade pronta.
Pendências que exigem aprovação do usuário: uma sessão de navegador com DevTools e conta de teste própria (lacunas G1–G10) e a instalação de Playwright e navegador.
