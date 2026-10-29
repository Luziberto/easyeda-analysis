# 07 — Arquitetura de roteamento

- **Roteamento manual** (CONFIRMADA, atalhos): trilha W, largura +/−, largura favorita Shift+W, ângulo L, modo de conflito Shift+R (empurrar/contornar/ignorar: INFERIDA), par diferencial, remover rotas (`pcb_unroute_all`).
- **Autorouter** (CONFIRMADA, strings): é externo ao editor. Usa WebSocket para `wss://router.easyeda.com:8443/router` (nuvem) ou para um executável local `ws://127.0.0.1:3579/router`, detectado via `http://127.0.0.1:3579/api/whois`. Tem `routerRule` no documento. Protocolo: DESCONHECIDA.
- **Ratsnest**: calculada no worker (`ratLineMgr.buildAllNet`). Algoritmo (MST?): INFERIDA.

Proposta própria: o roteamento interativo fica no cliente (walkaround primeiro, push-and-shove depois). O autorouter entra como um plugin externo, por exemplo exportando DSN/SES para o FreeRouting, que é open source (GPL; usar como processo separado, nunca linkado).

## Atualização da rodada 3 (G12)
Veja **docs/12-STATIC-DEEP-DIVE.md**, seção G12: achados INFERIDOS (estáticos), com arquivo e offset.
