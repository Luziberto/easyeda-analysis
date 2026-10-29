# 03 — Grafo funcional de chamadas

Os trechos abaixo são **curtos e sanitizados**, citados só como evidência; não são reutilizáveis como código. Offsets em bytes no arquivo indicado (build 6.5.61).

1. **Abertura de documento:** main.min.js @371124, INFERIDA a partir do código
   `…n=he.extractDocType(t.head),decompressObj=Ol.solver(t)…ur({docType:n,svgStr:…,jsonCache:…,cssStr:…})`
   Fluxo: `dataStr → extractDocType(head) → solver → {svgStr, jsonCache, cssStr} → montar SVG`.
2. **Ponte de extensões:** @1168774
   `cacheHistory:function(e){fi("cacheHistory",[],e?e.frame:void 0)}`
   A extensão chama a casca, e a casca chama `fi()` no iframe da aba.
3. **Estado das abas:** @805018. A casca percorre as abas abertas e chama `fi("getDocStatus",[],getTabIFrame(...))`.
4. **Autorouter:** @1131409
   `t="wss://router.easyeda.com:8443/router",n="ws://127.0.0.1:3579/router",a="http://127.0.0.1:3579/api/whois"`
   Há 3 modos (constantes 1/2/3) e uma sonda `whois` para detectar o roteador local.
5. **Gerber:** `iniGerberHeader` → `G04 … Gerber Generator version 0.2*`, `%FSLAX…`; `gerberAnnotate`. Excellon `M48`.
6. **WebGL (jsapi @413548):** classe com `frameBufferStack` e `getContext("webgl",{depth:!1,antialias:!1,stencil:!1,…})`.

```mermaid
graph LR
  UI[cmd= / atalho] --> D[Despachante]
  D -->|fi(frame)| T[Editor no iframe]
  T --> M[SVG DOM + jsonCache]
  T --> WK[Worker]
  T --> G[Gerador Gerber/Excellon]
  T --> R[Cliente Autorouter WS]
  T --> API["/api/documents/*"]
  EXT[Extensões] -->|easyeda.extension| D
```
