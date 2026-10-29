# 09 — Arquitetura do EasyEDA Standard (reconstruída)

Legenda dos diagramas: linhas sólidas são CONFIRMADA (código/string/doc) e linhas tracejadas são INFERIDA.

```mermaid
graph TB
  subgraph Browser
    Shell[Casca: jQuery + EasyUI<br/>projetos, abas, menus cmd=]
    subgraph Aba[iframe por documento]
      Ed[Editor SCH/PCB<br/>SVG DOM + jsonCache]
      Gb[Gerador Gerber/Excellon]
    end
    WK[Web Worker<br/>copper, ratsnest, R-tree, clearance]
    IDB[(IndexedDB/WebSQL shim<br/>localStorage)]
    Ext[Extensões easyeda.extension]
    Cham[chameleonTool<br/>Std→Pro, EDIF, footprint wizard]
  end
  API[("easyeda.com /api/*")]
  Sim[[Simulação servidor]]
  Conv[["/analyzer conversão"]]
  Rt[[Autorouter WS nuvem/local]]
  JLC[[JLCPCB/LCSC: login, preços, pedidos]]
  Shell -->|fi frame| Ed
  Ext --> Shell
  Ed --> WK
  Ed --> Gb
  Shell --> API
  Ed -.-> IDB
  Ed --> Rt
  Shell --> Sim
  Shell --> Conv
  Shell --> JLC
  Shell -.-> Cham
```
Características principais:
- monolito de front-end, com o DOM SVG como modelo de cena;
- isolamento por iframe;
- cálculos pesados no worker;
- serviços especializados no servidor (simulação, conversão, roteamento, catálogo).
