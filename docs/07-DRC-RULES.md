# 07 — Regras de DRC

- `DRCRULE` no documento PCB (CONFIRMADA, doc): conjuntos nomeados (ex.: `Default`) com `trackWidth`, `clearance`, `viaHoleDiameter`, `viaHoleD`. Os nomes exatos variam conforme a versão (ver exemplo sintético).
- Execução no cliente, com teste de clearance no worker (`testClearanceDone`). CONFIRMADA.
- Navegação de erros: `anchorToDrc`, `anchorToNet`, `anchorToComponet`. CONFIRMADA (cmd).
- `RuleManager` em chameleonTool/base. CONFIRMADA.
- Cobertura de regras (furo–furo, borda, silk–pad, máscara): DESCONHECIDA.

Proposta própria (MVP3): regras por classe de rede; verificações de clearance cobre-cobre via R-tree + distância entre segmentos e arcos, largura mínima, anel anular, furo mínimo, distância à borda, pads sem rede; relatório com âncoras clicáveis.

## Atualização da rodada 3 (G10)
Veja **docs/12-STATIC-DEEP-DIVE.md**, seção G10: achados INFERIDOS (estáticos), com arquivo e offset.
