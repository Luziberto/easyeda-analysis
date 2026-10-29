# Exemplos sintéticos
Arquivos **criados do zero** (valores inventados) seguindo a estrutura documentada publicamente em
docs.easyeda.com/en/DocumentFormat/. Não são exportações reais do EasyEDA e não contêm dados de terceiros.
- synthetic-schematic.json — docType 1: R1 + LED D1, 3 fios, 2 rótulos (VCC/GND), junção, no-connect e uma primitiva desconhecida `ZZ` (teste de preservação).
- synthetic-pcb.json — docType 3: footprint com 2 PADs, trilha, via, furo, contorno de placa (camada 10).
- synthetic-project.json — docType 5: projeto com `schematics[].dataStr` (string JSON aninhada).
- synthetic-legacy-head.json — head legado em string `"1~1.7.5~..."`.
Status: a compatibilidade com arquivos reais é INFERIDA (não validada contra uma exportação real — ver KNOWLEDGE-GAPS).
