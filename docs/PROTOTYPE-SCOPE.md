# Escopo do protótipo Proto EDA

Estado: **fechado** para o plano MVP1–MVP4 acordado neste repositório (outubro 2026).  
Código em `prototype/`, licença MIT, **sem** assets ou binários do EasyEDA.

## Entregue

| Área | Capacidades |
|------|-------------|
| **Esquemático** | Multi-folha v3, fio/barramento, undo/redo, ERC heurístico, import EasyEDA Std (docType 1/5), exports KiCad/SPICE/SVG/BOM/PDF, símbolos custom mínimos, autosave |
| **PCB** | Sync + netlist diff, trilhas/vias/pour, walkaround, ratsnest MST, DRC, import PCB + contorno, Fab Gerber (5 ficheiros), pick&place, WebGL 2D/3D com rotação |
| **Simulação** | Botão **Sim**: `.op` ngspice WASM + resumo `.tran` (spice-ts); painel Sim |
| **Qualidade** | 119+ testes unitários, 8 e2e Playwright, CI (unit + e2e + gerbv) |

## Comandos

```bash
cd prototype
npm install
npm test              # unit + build
npm run test:e2e      # Playwright
npm run validate-gerber
npm run serve         # http://localhost:8080/
npm run test:all      # unit + e2e
```

## Fora de escopo (paridade EasyEDA Pro / nuvem)

- Clipper2 pour boolean completo, máscara/paste Gerber, R-tree, ratsnest worker, autorouter WASM
- Editor SCHLib/FOOTPRINT wizard completo, biblioteca nuvem, preços, OCR datasheet
- CRDT, colaboração, plugins, 3D STEP/photo realista, simulação AC/noise completa na UI
- Investigação DevTools G1–G10 (requer sessão manual aprovada)

Melhorias futuras devem abrir **novo milestone**; este protótipo está **utilizável** como editor integrado esquemático + PCB + fab + sim básica.
