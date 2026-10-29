# 08 — Bibliotecas de componentes

- Biblioteca na nuvem com busca (`/api/components/search`), detalhe por LCSC ID (`/api/products/{lcscid}/components`), catálogo (`/api/eda/catalog/tree`), filtro paramétrico, preços LCSC, favoritos e contribuição da comunidade. CONFIRMADA (rotas).
- Símbolo e footprint vinculados (`puuid` no LIB; `packageDetail`; `checkPackagesAvaliable`). CONFIRMADA.
- Ferramentas: assistente de símbolo, assistente de footprint (packageGenerator), extração de pinos por OCR de datasheet, busca por similaridade de footprint (`fingerprint`). CONFIRMADA.
- Conteúdo da biblioteca (licença dos dados): DESCONHECIDA. **Não reutilizar.**

Proposta própria: biblioteca local em formato aberto. Possíveis fontes: KiCad libraries (CC-BY-SA 4.0 com exceção, verificar), símbolos criados do zero e o gerador paramétrico próprio de footprints IPC-7351 (baseado na norma, não em código de terceiros).
