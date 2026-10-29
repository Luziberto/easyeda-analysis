# 04 — Arquitetura de rede

> **Rodada 2 (29/10/2026):** a análise agora usa um **HAR capturado pelo próprio usuário**, no navegador e na conta dele (Firefox, sessão das 01:35 às 01:50 BRT). Nenhuma requisição nova foi feita ao easyeda.com, porque o robots.txt proíbe agentes de IA. Antes de entrar no pacote, o HAR foi sanitizado em `evidence/session.sanitized.har`:
> - removidos os headers `Cookie`, `Set-Cookie`, `Authorization`, `j-trace-id`, `x-request-id` e `x-amz-cf-id`, e os arrays `cookies[]`;
> - redigidos valores de token, session, csrf e `keyId`;
> - redigidos o uuid e o username do usuário, nickname, first_name, `customer_code` e e-mail;
> - redigidas todas as query strings de domínios de terceiros (analytics).
>
> Os corpos gzip das requisições foram decodificados e redigidos.

## Visão geral (CONFIRMADA — HAR)
- São 73 entradas: 62 para easyeda.com (54 delas em `/api/*` ou `/isLogin`) e o restante de analytics de terceiros.
- **Não houve nenhum WebSocket** nem resposta 101. Todo o tráfego do editor é **XHR jQuery** (`X-Requested-With: XMLHttpRequest`, `Accept: application/json, text/javascript`), same-origin em `https://easyeda.com`, sobre HTTP/2, CloudFront (POP GIG51) → nginx.
- Toda chamada leva `version=6.5.61` (na query string em GET e no corpo em POST). GETs de polling também levam `_=<epoch ms>` como cache-buster.
- **Autenticação:** só por cookie de sessão. Não há header `Authorization` nem header de CSRF nas chamadas `/api`. Os nomes dos cookies foram vistos (`easyeda_session`, `access_token`, `refresh_token`, `loginSession`, `oshwhub_session`, `oshwhub_csrf`…); os valores **não foram registrados**. CONFIRMADA.
- **Envelope único de resposta:** `{"success": bool, "code": 0, "result": <payload>}`. CONFIRMADA (todas as 54 respostas).
- **Compressão do upload:** `POST /api/documents/create` e `/update_canvas` enviam `Content-Type: application/x-www-form-urlencoded` com **`Content-Encoding: gzip`**. O corpo inteiro do form vai em gzip (10,6 KB → 4,3 KB no esquema). CONFIRMADA.
- **Respostas:** `Cache-Control: no-cache, private`; `content-encoding: gzip`; CSP com `child-src 'self' blob: https://*.easyeda.com https://*.jlcpc…`; `X-Frame-Options: SAMEORIGIN`.
- **Polling:** `GET /api/notifications/unread-count` e `GET /isLogin` a cada **~120 s**. CONFIRMADA (timestamps 01:37:51, 01:39:52, 01:41:53…).

## Fluxos observados (sequência real, horários BRT)
| Fluxo | Sequência | Estado |
|---|---|---|
| Boot do editor (01:35:50) | `GET /api/user` → `/api/users/{id}/public_project` → `/api/page/editor-start-page-new?l=en` → `/api/page/system-update-notice` → `extensions/*/locale.txt` → `/api/teams` → `/api/projects?document=true` (+`type=star&archive=false`) → `/api/folder/getUserFolderAllData` → `/getTeamFolderAllData` → `/api/org/getOrganizations` | CONFIRMADA |
| Novo projeto (01:36:07) | `POST /api/projects/add` (form) → recarrega a árvore (`projects`, `folder/*`) | CONFIRMADA |
| Novo esquema (01:36:11) | carrega `htm/editorpage1.html` (iframe de esquema) → `GET /api/projects/{pid}` ×2 → **`POST /api/documents/create`** (gzip) → `GET /api/documents/{uuid}` (abrir) → `POST /api/projects/{pid}/update_sort` | CONFIRMADA |
| Inserir componente da biblioteca | `POST /api/components/searchByIdAndPre` com `uuids[0][uuid]`, `uuids[0][bindPCBId]`, `uuids[0][datastrid]`; a resposta traz o `dataStr` do footprint (docType 4) | CONFIRMADA |
| **Salvar** esquema (01:40:30) | `GET /api/documents/{uuid}/datastrid?project_version=…` (confere a revisão atual) → **`POST /api/documents/{uuid}/update_canvas`** (gzip) → a resposta traz um **novo `datastrid`** → `update_sort` → recarrega a árvore | CONFIRMADA |
| Converter para PCB (01:46:09) | carrega `htm/editorpage3.html` → `GET /api/projects/{pid}` ×3 → `POST /api/documents/create` com docType 3 (dataStr do PCB **gerado no cliente**) | CONFIRMADA |
| Exportar Gerber (01:47:11) | `GET /api/pcb_order/{docId}/get_price?layer=2&width=5.99996&length=4.00001&qty=5&thickness=1.6&color=Green&surface_finish=HASL(with lead)&copper_weight=1` (medidas em mm, calculadas no cliente) → `/api/page/editor-gerber-dialog-show` → `/api/getActivityInfo` → `POST /api/editor/log` (`type=3&keyId=<REDACTED>`) → `GET /api/documents/{docId}/download_gerber` → `{result:true}`. **O ZIP não vem do servidor:** nenhuma resposta traz binário ou zip, e os arquivos carregam o cabeçalho "Gerber Generator version 0.2" do gerador do cliente. | CONFIRMADA |
| BOM | `GET /api/page/editor-bom-dialog-show` (só um banner HTML); o BOM é calculado no cliente e enviado no campo `BOM` do save | CONFIRMADA |
| DRC | nenhuma chamada de rede (`DRCRULE.isRealtime:true`, roda no cliente/worker) | CONFIRMADA (ausência no HAR) + código |
| Simulação | **não exercitada nesta captura** | DESCONHECIDA |
| Autorouter (WebSocket) | **não exercitado**. As URLs continuam CONFIRMADAS só como strings estáticas | DESCONHECIDA (protocolo) |

## Rotas: o que mudou de estado
As rotas de projetos, documentos, `create`, `update_canvas`, `datastrid`, `update_sort`, `components/searchByIdAndPre`, `pcb_order/get_price`, `download_gerber`, `editor/log`, `user`, `folder/*`, `teams` e `org/getOrganizations` passaram de **"CONFIRMADA (string)"** para **CONFIRMADA (tráfego real, método e payload conhecidos)**. As rotas de simulação, `/analyzer`, `histories`, `/update`, `fork`, `share` e preços LCSC continuam só como string estática.

O mapa estático continua em `evidence/endpoint-map.txt`. A rota com o ID de usuário segue redigida.
