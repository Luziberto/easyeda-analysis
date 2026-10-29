# 03 — Dependências

| Biblioteca | Versão | Licença pública | Estado | Uso |
|---|---|---|---|---|
| jQuery | 1.8.2 | MIT | CONFIRMADA (banner) | DOM e eventos. Versão de 2012, sem patches de XSS posteriores (observação de segurança, não testada) |
| jQuery EasyUI | customizado ≤1.3.x (INFERIDA) | GPL/comercial | CONFIRMADA (uso) / DESCONHECIDA (versão) | widgets |
| JSZip | 3.1.3 | MIT/GPLv3 | CONFIRMADA | zip para Gerber e exportações |
| pako | via JSZip 3.1.3 (INFERIDA) | MIT | CONFIRMADA | deflate/inflate |
| opentype.js | ≥1.3.4 (INFERIDA) | MIT | CONFIRMADA | contornos de fonte |
| indexeddbshim | 2.2.1 | MIT | CONFIRMADA | IndexedDB sobre WebSQL |
| polybool | lib TS interna, não é a npm | proprietária | INFERIDA | booleanos |
| md5 | ? | — | CONFIRMADA | hashes |
| GTM | GTM-W532SD9 | — | CONFIRMADA | analytics |

Dependências de serviço: easyeda.com (API), router.easyeda.com (autorouter), jlcpcb.com (passport/login, IM e pedidos), lcsc (preços e componentes via `/api/getPrices` e `/api/eda/product/*`).

## Atualização da rodada 3 (G11)
Veja **docs/12-STATIC-DEEP-DIVE.md**, seção G11: achados INFERIDOS (estáticos), com arquivo e offset.
