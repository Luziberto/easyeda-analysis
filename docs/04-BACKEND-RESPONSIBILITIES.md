# 04 — Responsabilidades do backend

Estados atualizados com o HAR real do usuário (rodada 2).

| Responsabilidade | Onde | Estado / evidência |
|---|---|---|
| Persistência de projetos e documentos (documento inteiro por save, revisões `datastrid`) | servidor | **CONFIRMADA (HAR)**: `create`, `update_canvas`, `datastrid` |
| Árvore de projetos, pastas, times e organizações | servidor | **CONFIRMADA (HAR)** |
| Ordem das abas e documentos | servidor (`update_sort`) | **CONFIRMADA (HAR)** |
| Entrega de símbolos e footprints da biblioteca | servidor (`components/searchByIdAndPre` devolve o `dataStr` docType 4) | **CONFIRMADA (HAR)** |
| Conversão esquema → PCB | **cliente**: o PCB chega ao servidor já pronto em `documents/create` docType 3 | **CONFIRMADA (HAR)** (antes não estava mapeada) |
| Geração de Gerber/Excellon | **cliente**; o servidor só recebe `editor/log` + `download_gerber` (contador) | **CONFIRMADA (HAR + export)**. Antes: INFERIDA |
| Cálculo de BOM | **cliente**; vai no campo `BOM` do save | **CONFIRMADA (HAR)** |
| Orçamento de PCB | servidor (`get_price`, com dimensões calculadas no cliente) | **CONFIRMADA (HAR)** |
| DRC, copper pour, ratsnest | cliente (worker); nenhuma chamada de rede | **CONFIRMADA** (código + ausência no HAR) |
| Sessão e autenticação | cookies de sessão em easyeda.com; `isLogin` em polling de 120 s; login em passport.jlcpcb.com | **CONFIRMADA (HAR)** para cookie e polling |
| Telemetria | `editor/log`, mais analytics de terceiros (Google, Facebook, Baidu) | **CONFIRMADA (HAR)** |
| Simulação SPICE | servidor (rotas estáticas) | INFERIDA (não capturada) |
| Conversão Altium/Eagle/KiCad | servidor `/analyzer` | INFERIDA |
| Autorouting | serviço WS ou local (porta 3579) | CONFIRMADA (URLs) / DESCONHECIDA (protocolo) |
| OCR de datasheet, pedidos | servidor | CONFIRMADA (strings) |
