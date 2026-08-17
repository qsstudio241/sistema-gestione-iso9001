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

Soglie di grado S235–S500 (EN 10025-2:2019): [`standards/en-10025-2.md`](standards/en-10025-2.md) (tabelle seedabili) + estratto [`docs/reference/EN-10025-2-acciai-strutturali.md`](../../docs/reference/EN-10025-2-acciai-strutturali.md).

Copertura dichiarata: [`COVERAGE.md`](COVERAGE.md). Loader: `backend/src/services/materialKbLoader.service.js`.

Inventario presente/mancante (dichiarare all’avvio, poi partire): [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../../docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md). Tubi: EN 10210-1 / 10219-1 ancora senza Markdown. Certificati d’apporto: stesso dizionario (`material_role=filler`); soglie prodotto apporto assenti → skip.

Sintesi operativa: [`docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../../docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md).
