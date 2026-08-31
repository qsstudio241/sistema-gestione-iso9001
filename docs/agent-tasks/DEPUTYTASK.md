# DEPUTYTASK — LG-4: Chiusura via 1 (tenant)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 31/08/2026  
**Chiuso:** 31/08/2026  
**Piano:** [`PLAN_LIBRERIA_GAP_SLICES.md`](PLAN_LIBRERIA_GAP_SLICES.md)  
**Rischio:** Medio — BE additivo (hook ingest → stato richiesta); FE minimo  
**Branch:** `cursor/lg4-tenant-gap-close-9166`  
**Esito:** TEST OK — BE Jest 42 · Vitest NormLibrary 12 · build OK

## Esito

- `closeTenantRequestsCoveredByCode` / `tryCloseTenantRequestsAfterIngest`: solo `closure_path=tenant`, open/in_progress → `closed`; match codice case-insensitive/prefisso
- Hook non bloccante post-commit in `commitNormFromFields`, `applyNormToExistingDocument`, `importNormCodes`
- FE: refresh richieste dopo NormUpload; label «Chiusa (ingest tenant)»
- Niente tocco know-how piattaforma / LG-5

## DoD

- [x] closeTenantRequestsCoveredByCode
- [x] Hook ingest (commit / apply / import codici)
- [x] UI refresh + label
- [x] Test L1 + build
- [x] PLAN LG-4 CHIUSO; brief CHIUSO

## Post-merge

- BE: `deploy-to-vps.sh` (service già in manifest)
- Prossima slice: **LG-5**
