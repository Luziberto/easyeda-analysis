# 10 — Roadmap de desenvolvimento

## MVP1 — Editor de esquemático básico (base: protótipo atual)
- **Requisitos:** grid e viewport (zoom e pan); inserir, selecionar, mover, girar e excluir símbolos; fios entre pinos; undo/redo; salvar e abrir JSON; biblioteca local com cerca de 20 símbolos; seleção por caixa; propriedades (ref e valor).
- **Riscos:** desempenho do SVG; UX de fios (roteamento ortogonal).
- **Testes:** unidade do core (já há 13); e2e de interação (Playwright, a adicionar).
- **Aceite:** desenhar um circuito de LED, salvar, reabrir e obter um documento idêntico; desfazer tudo leva ao documento vazio.

## MVP2 — Esquemático completo
- **Requisitos:** fios com vértices livres e junções automáticas; rótulos e portas globais; multi-folha; anotação; ERC; editor de símbolos; netlist (SPICE e KiCad); importar EasyEDA Std (parser já feito) e exportar SVG/PDF.
- **Riscos:** fidelidade da importação Std com arquivos reais (lacuna G5); semântica de conectividade.
- **Testes:** corpus de arquivos Std **criados pelo usuário**, com round-trip e comparação de netlist; propriedades da conectividade (fuzz).
- **Aceite:** 95% dos documentos do corpus importam sem perda de primitivas; a netlist bate com a referência.

## MVP3 — PCB
- **Requisitos:** camadas; footprints e editor; ratsnest; trilhas e vias; roteamento interativo walkaround; copper pour (worker); DRC; Gerber X2 e Excellon; BOM e pick&place; sincronização SCH↔PCB.
- **Riscos:** robustez geométrica; desempenho (WebGL); validade do Gerber.
- **Testes:** Gerbers validados com visualizadores independentes (gerbv); DRC com casos dourados; benchmark com 5k objetos a 60 fps.
- **Aceite:** placa de 2 camadas fabricável (Gerber aceito por um fabricante); DRC sem falsos negativos nos casos dourados.

## MVP4 — Plataforma
- **Requisitos:** simulação ngspice-wasm; visualizador 3D (STEP/WRL → glTF); colaboração (CRDT, ex.: Yjs); plugins sandboxed; autorouter externo (DSN/SES).
- **Riscos:** licenças (ngspice, OCCT); conflitos de merge.
- **Testes:** circuitos SPICE de referência (RC, amplificador); testes de convergência do CRDT.
- **Aceite:** resultado transiente de um RC dentro de 1% do analítico; dois clientes editando sem divergência.
