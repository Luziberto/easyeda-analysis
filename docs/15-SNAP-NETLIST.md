# 15: Snapping e netlist no Std 6.5.61 (rodada 6)

**Fonte:** os mesmos bundles semânticos (fora do pacote; hashes em docs/14). Não houve contato com easyeda.com.

**Nomes:** os identificadores curtos (`Gn`, `Or`, `mn`, `rr`, `A`, `sa`…) e os helpers como `getOrSetAttribute` são **renomeados pelo usuário**. As evidências se apoiam nos literais e nas propriedades, que não mudaram.

## (a) Snapping
| Item | SCH | PCB | Estado |
|---|---|---|---|
| Config padrão | `adsorbGrid:{gridSize:10, enabled:true, distanceX:10, distanceY:10, altSnapSize:5}` (L3436) | `distanceX/Y:0.5, altSnapSize:0.5` (L7193) | CONFIRMADA |
| Tamanho efetivo | `getSnapSize(axis)`: **Alt pressionado → `altSnapSize`**, senão `distance{X,Y}`; fallback 1 (L11023) | idem (L14327) | CONFIRMADA |
| Alt | `altKeyEnabled = e.altKey` em mousemove e drag (L12418, L17987, L18177) | idem | CONFIRMADA |
| Arredondamento | `getSnappedPoint`: `round((p - origin)/snap)*snap + origin`, depois `formatLengthSave` (L6219) | `rr` (L9388) | CONFIRMADA |
| Drag | delta encaixado relativo ao ponto inicial já encaixado; `unitSnap` → `Math.round` extra para fio e bus (L17987–17996, L18157) | idem | CONFIRMADA |
| Exceções | `alwaysNotSnap`: pontos de controle de arco e pie (`arc1`, `pie1` índices 2–3; `arc2` índice 2) não encaixam (L11002) | L14306 | CONFIRMADA |
| Lista de passos | `_PCBSnapStack [0.2, 0.25, 0.5, 1, 1.25, 2.5, 5, 10]`, convertida para a unidade do canvas (L11021) | L14325 | CONFIRMADA |
| Unidades | interno em **pixel = 10 mil** (convert "pixel"→unit); `attr-canvas-alt-snap-size` (L19341) | `formatLengthSave(… || 0.1)` (L27704) | CONFIRMADA (pixel = 10 mil, ver docs/04) |
| Snap a objetos | pinos: o SCH testa se os pontos de fio, bus e busentry coincidem com `pinDot` (L4764) | `getAdsorbPoint` usa `ie.ifFind(x,y,…)` (R-tree) para PAD, VIA, HOLE, trilha e MeasureLine; com o snap ligado, cola no ponto do objeto e mostra `showSnapPoint` (cross-red), senão usa a grade (L19420–19441, L31649, L35217) | CONFIRMADA |
| Magnético SCH | sem atração por raio no SCH; a conexão é por **igualdade exata de coordenadas** (`isPointEqual: e.x==t.x && e.y==t.y`, L11415). Fio e pino só se ligam porque ambos estão na grade | — | CONFIRMADA |
| Setas e Shift | movimento por teclado com ctrl/shift/alt (L12153–12183); Shift restringe a direção (L17783) | — | INFERIDA (detalhe da regra) |

## (b) Netlist e conectividade
1. **Caches de conectividade do SCH**, em `calAll` → `rebuildAllCache` (L23314–23410):
   - `dots[comp_pin] = pinDot`, só para pinos com `display=="show"`;
   - `busentry` contribui duas extremidades; `netflag` contribui um pino;
   - `junctions` e `wires` (`pointArr`).
2. **Tipos semânticos** pelo `c_partid` (L7034–7074):
   - `part_netLabel_text*` → netlabel;
   - `part_netLabel_*` → netflag (inclui GND, VCC e power, L14541);
   - `part_netLabel_netPort` → net port (tratado à parte, L9089);
   - `part_sheet`/`frame_sheet_*` → frame da folha;
   - também existem `bus`, `busentry` e `noconnectflag`.
3. **Grafo:** é geométrico, com nós = coordenadas exatas, e não um grafo explícito de fios. O SCH **não calcula o netlist final no cliente**: `convertToPCB` e `updatePCB` são delegados ao frame host com `rr("convertToPCB")` (L25499). A API REST tem `spiceNetlist` (L3596) e o enum `NETLIST:"9"` (tipo de documento).
   - Estado: o netlist é produzido no **host ou servidor** (INFERIDA). A prioridade de nomes entre netlabel, netflag e porta **não aparece nesses bundles** (DESCONHECIDA).
4. **Hierarquia:** só há folhas múltiplas (`sheet_` tabs, `sheetOrder` em `/api/projects/{uuid}/update_sort`). Não há símbolo de bloco hierárquico. A conexão entre folhas por netlabel ou netport é INFERIDA.
5. **Formato que o PCB recebe** (Import Changes, PCB L20355–20958):
   - `schNetlist = { netName: ["REF.pin", …] }`; o parse usa `/(.+)\.(.*)$/`;
   - é comparado com o PCB atual, gerado por `PCBNetlist()`/`sa()`: por footprint, `{package, uuid, name, netNode:{padNumber: net}, c_para}`.
   - O diff produz `waitReplace`/`replaceLater`/`updateCPara` e renomeia nets via `["attr", id, {net:old}, {net:new}]` (L20850).
   - Erro quando o número do pad não casa com o pino ("Found footprint's pad number doesn't match…").
   - Depois: `calAll`, `saveBatch` (um passo de undo), `buildAllNet` (ratsnest) e DRC.
   - Designators duplicados → `preRepeat`.
6. **Nomes `R1_1` (HAR):** não são gerados nestes bundles. Pelo formato, nets sem rótulo recebem `<REF>_<pin>` do pino de referência no host ou servidor (INFERIDA). Há um padrão próximo no gerador de ids (`prefix_`+n, PCB L9670), mas ele é de ids, não de nets.
7. **Pinos duplicados num símbolo:** o número do pino ganha um sufixo `_1`, `_2`… (SCH L17384).

## needJunction(o, a)
Esclarecido em `checkJunctionValid` (SCH L19213–19245), CONFIRMADA:
- `o` = número de **extremidades de fio** no ponto + **pinos** no ponto;
- `a` = número de fios que **passam pelo meio** do ponto.
- Precisa de junção se `o>=3` (três ou mais terminações) ou `o>=1 && a>=1` (T).
- **Cruzamento simples** (`a=2, o=0`) **não conecta**.
- A junção existente é removida se deixa de ser necessária.

## Comparação com o protótipo e melhorias (sem copiar código)
O protótipo faz `netlist()` com union-find sobre pinos `REF.pin` e fios pino-a-pino (model.js L115–122). Ele é correto para o modelo atual, mas limitado. Sugestões próprias:
1. Fios com **pontos livres e T** (nó = coordenada inteira na grade), com junções derivadas pela regra acima e cruzamento sem conexão.
2. Labels, flags de power e portas como **nós com nome**, unindo todos os de mesmo nome, também entre folhas. Prioridade explícita e documentada: power > porta > label > automático; conflito vira aviso de DRC.
3. Nome automático determinístico `<REF>_<pin>` do menor `REF.pin`, compatível com o HAR.
4. Saída `{net: [REF.pin]}`, igual ao formato de Import Changes, com diff incremental contra o PCB e erros de pad/pin.
5. Snap: `round((p-origin)/step)*step+origin` com Alt → passo alternativo; coordenadas inteiras em unidade interna, para evitar erro de ponto flutuante na igualdade.
6. Um índice espacial (hash de grade) para pinos e extremidades, em vez da varredura O(n) por ponto que o Std faz.

## Rodada 7: implementação no protótipo (29/10/2026)
Todo o código é original, escrito a partir das regras descritas acima; nada foi copiado dos bundles.
- `src/core/connectivity.js`: `snapPoint` (grade 10, meio passo com Alt, inteiros, sem -0), `SpatialHash`, `analyzePoints`, `needsJunction(o,a) = o>=3 || (o>=1 && a>=1)`, `junctions`, `buildNetlist`, `diffNetlist` e `applyNetlistDiff`.
- Fios como polilinha `{id, points}`. Pontos livres e T conectam; cruzamento simples ou dobra coincidente não conecta.
- Nós nomeados com prioridade power > porta > rótulo > automático. Nomes de mesma prioridade em conflito geram aviso. O nome automático é `REF_pin`, a partir do menor pino em ordem natural.
- `diffNetlist` compara com o netlist da PCB `{REF:{pads}}` e acusa os erros missing-footprint e pad-mismatch.
- Formato v2 com migração automática dos arquivos v1 (`from/to` → `points`). O campo `cur` não é mais salvo.
- Status: CONFIRMADA no protótipo (75/75 testes).

## Limitações conhecidas
- Mover um símbolo arrasta só as extremidades de fio presas aos seus pinos; um pino que caiu no meio de um fio não leva o fio junto.
- Não há barramentos, hierarquia de folhas nem portas entre folhas (a "porta" só dá nome a uma rede, dentro da mesma folha).
- O índice espacial teve só uma checagem simples de desempenho, sem benchmark formal.
- `addWire(pontos)` só arredonda para inteiros; quem faz o snap à grade é a UI.
- A UI foi testada por carga headless (o módulo inicializa sem erro), não por interação automatizada.
