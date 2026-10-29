# 01 — Reconhecimento

Escopo: EasyEDA Standard em https://easyeda.com/editor. Coleta feita em 29/10/2026 (horário de Fortaleza, UTC-3) com `curl`, sem login, a partir do box de análise.
Legenda: **CONFIRMADA** = observada diretamente, com evidência. **INFERIDA** = dedução plausível a partir de evidência indireta. **DESCONHECIDA** = não verificável sem navegador ou sessão.

| # | Descoberta | Estado | Evidência |
|---|---|---|---|
| R1 | `/editor` responde HTTP 200 sem exigir autenticação; servido por CloudFront + nginx | CONFIRMADA | `evidence/headers.sanitized.txt` |
| R2 | Build atual: banner `/* v6.5.61, build: 10/27/2026 */`; assets versionados em `/editor/6.5.61/js/` | CONFIRMADA | cabeçalho de `main.min.js`; `last-modified: Tue, 27 Oct 2026 09:06:14 GMT` |
| R3 | O HTML tem 228.947 bytes e embute toda a casca da UI (menus, diálogos e 264 atributos `cmd=` distintos) | CONFIRMADA | `evidence/editor-commands.txt` |
| R4 | A CSP libera `*.easyeda.com` e `*.jlcpcb.com`; `x-frame-options: SAMEORIGIN`; `cache-control: no-cache` no HTML | CONFIRMADA | headers |
| R5 | Google Tag Manager (GTM-W532SD9) é carregado | CONFIRMADA | `editor.html` (iframe ns.html) |
| R6 | Sem WASM, sem sourcemaps e sem service worker | CONFIRMADA (busca estática) | grep `.wasm`, `sourceMappingURL`, `serviceWorker` deu 0 ocorrências relevantes |
| R7 | Há um Web Worker em `/editor/6.5.61/js/worker.main.min.js` | CONFIRMADA | `<input id=worker_main value=...>` @15317 em main.min.js |
| R8 | O `robots.txt` de easyeda.com tem `Disallow: /` para agentes de IA (ClaudeBot, GPTBot, CCBot etc.) e `Disallow: /api/` para todos | CONFIRMADA | `evidence/robots.txt` |
| R9 | Nenhum bloqueio, CAPTCHA ou WAF contra o acesso automatizado; todas as respostas foram 200 | CONFIRMADA | log em RESEARCH-LOG.md |

**Nota ética (R8):** a coleta se limitou a uma análise pontual pedida pelo usuário: 1 HTML, 6 assets referenciados diretamente, as páginas de documentação oficial e o robots.txt. Nada sob `/api/` foi acessado e não houve crawling. Por causa da política do robots.txt, a coleta em easyeda.com foi **encerrada** assim que essa política foi identificada. Os bundles brutos ficam fora do pacote entregue; ficam só os hashes, os offsets e trechos curtos.

## Limite metodológico
Não havia navegador disponível, e a regra do trabalho proíbe instalar um. Por isso as fases 2 (comportamento em tempo de execução) e 4 (rede ao vivo) foram reconstruídas por análise estática e pela documentação. Todas as afirmações de runtime estão marcadas como INFERIDA. O que precisa ser verificado está em KNOWLEDGE-GAPS.md.
