# 02 — Comportamento funcional

> Não houve sessão de navegador, então o comportamento em runtime **não foi observado**. O conteúdo abaixo vem da UI declarada no HTML, da tabela de atalhos embutida no bundle e da documentação.

## Modos e documentos (CONFIRMADA: strings e comandos)
- Tipos de documento: esquema (`sch`), biblioteca de símbolo (`schlib`), PCB (`pcb`), biblioteca de footprint (`pcblib`), símbolo SPICE (`spice`), subpart, e projeto com várias folhas. Comandos `new_schematic`, `new_schematicLib`, `new_PCB`, `new_PCBLib`, `new_SCHModule`, `new_PCBModule`, `new_spiceSymbol`.
- Modo simulação (`changeModeToSim`, `openSpiceDlg` Ctrl+J, `openDlgSimResult` Ctrl+L, `configWaveForm`).
- Visualização "Photo View" do PCB, com cores de máscara e silk e lado de cima/baixo (`photoView_changeColor_*`, `photoView_changeSide_*`).

## Ferramentas de desenho (CONFIRMADA: tabela de atalhos, `evidence/hotkeys.txt`, 105 entradas)
| Doc | Ação | Atalho |
|---|---|---|
| SCH | Fio / Barramento / Polilinha / Polígono / Retângulo / Elipse / Arco / Bézier / Mão livre | W / B / L / O / S / E / C / Q / F |
| PCB | Trilha / Conexão / Círculo / Arco / Dimensão / Medição | W / O / C / U / N / M |
| PCB | Alternar largura de trilha, ângulo de roteamento, conflito de roteamento, unidade | Shift+W / L / Shift+R / Q |
| ALL | Desfazer / Refazer / Salvar / Recortar / Copiar / Colar | Ctrl+Z / Ctrl+Y / Ctrl+S / Ctrl+X / Ctrl+C / Ctrl+V |
| ALL | Zoom + / − / Ajustar | A / Z / K |
| ALL | Espelhar H / V; destacar rede; arrastar | X / Y / H / D |
| ALL | Cancelar desenho / desfazer último ponto | Esc / Backspace |
| SCH | Converter para PCB; cross-probe; assistente de símbolo; extração de datasheet (OCR) | Alt+P / Shift+X / Shift+T / Alt+T |
| PCB | Importar mudanças; gerenciador de camadas; assistente de footprint | Alt+I / Ctrl+L / Shift+T |

Os atalhos são reconfiguráveis (`hotkeySetting`).

## Fluxos de produto (CONFIRMADA: comandos no HTML)
- Projeto: novo, abrir, clonar, versionar, arquivar, backup, mover para pasta, recuperação de crash (`crashRecovery_recovery`, `crashRecovery_delete`).
- Bibliotecas: buscar, posicionar, favoritar, editar, clonar, reportar erro, ver datasheet (`lib_*`).
- Importação de Altium, Eagle, KiCad, DXF e EasyEDA (`importAltium`, `importEagle`, `importKicad`, `importDxf`, `importEasyeda`).
- Exportação de BOM, netlist, CSV, DXF, EasyEDA JSON, arquivo de coordenadas (pick&place) e fabricação (Gerber); pedido na JLCPCB (`pcb_fabrication`, `bom_order`).
- Alinhamento e distribuição (10 comandos `align_*`), clonagem em matriz (`array_clone`), anotação (`annotate`), DRC (`checkDRC`/`pcb_DRC`), autorouter (`pcb_auto_router`), par diferencial (`pcb_differential_route`).
- Migração para o EasyEDA Pro (`migrate_to_pro`).

## Não observado (DESCONHECIDA)
Feedback visual, snapping real, comportamento de seleção por caixa, mensagens de erro e latências.
