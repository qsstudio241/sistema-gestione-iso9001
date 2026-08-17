---
kb: material-compliance
kind: coverage
updated: 2026-08-17
---

# Copertura fonti Markdown (MC-2)

Dichiarare, poi partire. Vietato inventare soglie.

```yaml
covered:
  - EN 10204
  - EN 10168
  - ISO 10474
  - ISO 404
  - ISO 6929
  - EN 10025-2
  - EN 10210-1
  - EN 10219-1
  - ISO/TR 15608
  - ISO 14341
missing:
  - ISO 2560
  - ISO 17632
  - ISO 14174
start_on: certificati base Sxxx lamiere/profili (10025-2) e hollow se citata EN 10210-1 (caldo) o EN 10219-1 (freddo); chimica/ReH apporto = skip
```

ISO 14341: **classificazione** della designazione filo, non tabelle chimica 3A/3B (GAP estrazione).  
ISO 10474 / 404 / 6929: inventario in `docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md` — niente soglie numeriche da seedare.
