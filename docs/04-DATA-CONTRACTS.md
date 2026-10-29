# 04 — Contratos de dados

Fontes: `evidence/session.sanitized.har` (HAR do usuário, sanitizado) e os exports reais em `evidence/real-exports/`. Os nomes de campo vêm literalmente do tráfego. Todos os valores pessoais estão redigidos.

## Envelope
`{ "success": true, "code": 0, "result": … }`. CONFIRMADA. Nenhum erro foi capturado, então os códigos ≠ 0 seguem DESCONHECIDOS.

## Requisições (CONFIRMADAS)
| Endpoint | Método / codificação | Campos |
|---|---|---|
| `/api/projects/add` | POST form | `name`, `content`, `public` (`false`), `user_uuid`, `path` (`<user>/new-project`), `description`, `version` |
| `/api/documents/create` | POST form + **gzip** | `title` (`Sheet_1` / `PCB_New Project`), `description`, `docType` (`1`/`3`), `pid` (uuid do projeto), `BOM` (JSON string: `[["Value","Quantity","Package","Components","CustomPara"],["1k",2,"R0603","R1,R2",{…}]]`), **`dataStr`** (JSON string do documento completo), `libsCount` (`{"<lib uuid>": n}`), `version` |
| `/api/documents/{uuid}/update_canvas` | POST form + **gzip** | `uuid`, `docType`, **`project_version`**, `inherit` (vazio), `pid`, `BOM`, `title`, `libsCount`, **`dataStr`**, `version` |
| `/api/documents/{uuid}/datastrid` | GET | `uuid`, `project_version` |
| `/api/projects/{pid}/update_sort` | POST form | `sort[]=<doc uuid>…` |
| `/api/components/searchByIdAndPre` | POST form | `uuids[i][uuid]`, `uuids[i][bindPCBId]`, `uuids[i][datastrid]` |
| `/api/pcb_order/{docId}/get_price` | GET | `layer`, `width`, `length` (mm), `qty`, `thickness`, `color`, `surface_finish`, `copper_weight`, `isEasyedaDesign` |
| `/api/editor/log` | POST form | `type` (`3` no export Gerber), `keyId` (redigido) |

**Salvar = enviar o documento inteiro.** O `dataStr` é o JSON completo (`head`, `canvas`, `shape[]`, `BBox`, `colors` | `layers`, `objects`, `preference`, `DRCRULE`, `netColors`), sem diff nem patch. CONFIRMADA: o save capturado leva 11.458 B de dataStr (form de 12,8 KB → 4,9 KB em gzip); o PCB, 27 KB → 6,3 KB.

## Respostas (CONFIRMADAS)
| Endpoint | `result` |
|---|---|
| `documents/create` | `{uuid, master}`. `master` é o primeiro `datastrid` |
| `update_canvas` | `{uuid, datastrid}`, com **novo** datastrid a cada save (revisão imutável) |
| `datastrid` | `{uuid, datastrid}` |
| `GET /api/documents/{uuid}` (abrir) | o **projeto inteiro como docType 5**: metadados + `schematics[]` = `{uuid, title, docType, master, datastrid, writable, dataStr}`. Aqui o **`dataStr` é um OBJETO JSON**, enquanto no upload é string. Fixture: `examples/real-open-document-response.json` |
| `GET /api/projects/{pid}` | metadados + `documents[] = {uuid, title, docType, master, thumb, components, updateTime, createTime, histories:[datastrid…]}`, `permissions`, `folder`, `origin:"std"` |
| `components/searchByIdAndPre` | `[{uuid, bindPCBId, datastrid, dataStr:{head:{docType:"4", uuid, utime, uuid_3d, transformList, …}, canvas, shape, layers, objects, BBox, netColors}, updateTime, title:"R0603"}]` |
| `get_price` | `{paicl_money: 3.77}` |
| `download_gerber` | `true` (só contabiliza; não há arquivo) |
| `api/user` | perfil (redigido); o e-mail já chega mascarado pelo servidor (visto na inspeção bruta; redigido no pacote) |

## Versionamento (CONFIRMADA)
- **Projeto:** `project_version` (32 hex), mandado no save e nas listagens.
- **Documento:** `uuid` fixo, mais uma cadeia de **`datastrid`** (um por save). `histories[]` lista essas revisões.
- A sequência `datastrid` → `update_canvas` permite ao servidor detectar escrita concorrente. Que o servidor **rejeite** um conflito é INFERIDA: nenhum conflito foi capturado.

## Vínculo esquema ↔ PCB (CONFIRMADA)
Os `gId` dos LIB do esquema (por exemplo `ggeddb6d14187439784`) são **os mesmos** dos footprints LIB no PCB e do `bindPCBId` enviado ao servidor. A net de pad no PCB é nomeada como `<prefixo>_<pino>` (`R1_1`, `R2_1`). Teste: `tests/real-exports.test.mjs`.

## Ainda desconhecido
O esquema das mensagens worker ↔ editor, o protocolo WS do autorouter e o contrato da simulação.
