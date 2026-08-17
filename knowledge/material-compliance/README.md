# Knowledge Base — Material Compliance

Path canonico [ADR-023](../../docs/adr/ADR-023-material-knowledge-base.md).

```text
knowledge/material-compliance/
├── standards/     # tipi documento e layout (EN 10204, EN 10168, …)
├── dictionary/    # chiavi canoniche + sinonimi
├── customers/     # (vuoto: in attesa specifiche cliente)
├── companies/     # (vuoto: in attesa criteri interni per slug)
└── lessons/       # post-MVP
```

Soglie di grado S235–S500 (EN 10025-2:2019): [`standards/en-10025-2.md`](standards/en-10025-2.md). Hollow a caldo (EN 10210-1:2006): [`standards/en-10210-1.md`](standards/en-10210-1.md) + estratto [`docs/reference/EN-10210-1-sezioni-cave.md`](../../docs/reference/EN-10210-1-sezioni-cave.md). Hollow a freddo (EN 10219-1:2006): [`standards/en-10219-1.md`](standards/en-10219-1.md) + estratto [`docs/reference/EN-10219-1-sezioni-cave.md`](../../docs/reference/EN-10219-1-sezioni-cave.md).

Copertura dichiarata: [`COVERAGE.md`](COVERAGE.md). Loader: `backend/src/services/materialKbLoader.service.js`.

Inventario presente/mancante (dichiarare all’avvio, poi partire): [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../../docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md). Tubi: EN 10210-1 (caldo) e EN 10219-1 (freddo) in Markdown; senza citazione della norma → skip. Certificati d’apporto: stesso dizionario (`material_role=filler`); soglie prodotto apporto assenti → skip.

Sintesi operativa: [`docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../../docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md).
