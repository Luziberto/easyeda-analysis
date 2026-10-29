# 01 — Inventário de recursos

Os arquivos foram baixados só para análise e **não são redistribuídos**: ficaram em `/workspace/easyeda-raw/`, fora do zip. Os hashes estão em `evidence/hashes.txt`.

| Recurso | Bytes | SHA-256 (prefixo) | Papel |
|---|---|---|---|
| /editor (HTML) | 228.947 | — | casca da UI, diálogos, comandos `cmd=` |
| main.assets.min.js | 4.118.764 | 600812d7… | bibliotecas (jQuery, EasyUI, JSZip, pako, opentype, shim IDB) + parte do motor |
| main.min.js | 2.464.030 | d68413a4… | aplicação: projetos, documentos, rede, Gerber, atalhos, extensões, roteador |
| jsapi.min.js | 525.979 | 627a35ee… | API de extensão e utilitários gráficos (inclui WebGL) |
| chameleonTool.min.js | 327.047 | 648dae87… | conversor Std↔Pro, EDIF, geometria, gerador de pacotes, assistente de footprint |
| worker.main.min.js | 5.717 | b51c3d5b… | bootstrap do worker (`importScripts` + roteamento de mensagens) |
| main.min.css | 203.575 | dd09ab94… | estilos |

Recursos também referenciados, mas não baixados: `/extensions/systemScripts/1.js` e `2.js`, e o iframe do GTM.
Documentação oficial consultada: 6 páginas DocumentFormat, a "EasyEDA-Format-Standard" (2020.08.11) e a API List em https://docs.easyeda.com/en/.
