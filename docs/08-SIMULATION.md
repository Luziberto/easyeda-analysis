# 08 — Simulação

| Aspecto | Descoberta | Estado |
|---|---|---|
| Motor | no servidor: `/api/documents/{uuid}/simulate`, `/api/v2/documents/simulate`, `/spiceNetlist`, `/simulatedSpice`, `/api/getSubcktModel` | CONFIRMADA (rotas) / INFERIDA (que é server-side, provavelmente um derivado do ngspice; o motor é DESCONHECIDA) |
| Componentes de simulação | VCVS, VCCS, PULSE, PWL, SFFM e instrumentos virtuais OSCILLOSCOPE, MULTIMETER, LOGICANALYZER | CONFIRMADA (strings) |
| UI | modo simulação, diálogo SPICE (Ctrl+J), relatório (Ctrl+L), `configWaveForm`, `waveForm` no doc | CONFIRMADA |
| Modelos | símbolos `spice`, subcircuitos (`editSubckt`, `getSubckt`) | CONFIRMADA |

Proposta própria: ngspice compilado para WASM rodando num worker, local e offline. Cuidado com a licença: ngspice é BSD-3, mas alguns componentes têm licenças próprias, então verificar. Fluxo: netlist SPICE gerada pelo modelo, depois `.tran`/`.ac`/`.dc`/`.op`, depois o visualizador de formas de onda.
