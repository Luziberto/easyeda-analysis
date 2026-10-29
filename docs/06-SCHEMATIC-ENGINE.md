# 06 — Motor de esquemático

| Aspecto | Descoberta | Estado |
|---|---|---|
| Renderização | SVG DOM retido (`<svg id=viewRoot>`); cada primitiva vira um elemento SVG; o documento é decodificado para `svgStr` | CONFIRMADA |
| Coordenadas | pixels; transform/viewBox (26 refs a viewBox), `createSVGPoint`/`getScreenCTM` para conversão tela→mundo | CONFIRMADA (APIs) |
| Grid e snap | parâmetros no `canvas` (tamanho do grid, snap, Alt-snap) | CONFIRMADA (doc) |
| Ferramentas | fio, barramento, polilinha, polígono, retângulo, elipse, arco, Bézier, mão livre, texto, rótulo e flag de rede | CONFIRMADA (atalhos) |
| Símbolos | LIB com sub-shapes; pinos com flags elétricas (`electric`) e número SPICE | CONFIRMADA (doc) |
| Anotação | `annotate` | CONFIRMADA (cmd) |
| Multi-folha | projeto com várias folhas, `#sheet#` | CONFIRMADA |
| ERC | `check` (?) | DESCONHECIDA |
| Conversão para PCB | `convertToPCB` (Alt+P) e `importChanges` (Alt+I) | CONFIRMADA (cmd) |

Para o motor próprio: modelo de cena separado do SVG (ver 10), renderização SVG no MVP e Canvas/WebGL a partir do MVP3, para PCBs grandes.

## Atualização da rodada 3 (G1)
Veja **docs/12-STATIC-DEEP-DIVE.md**, seção G1: achados INFERIDOS (estáticos), com arquivo e offset.
