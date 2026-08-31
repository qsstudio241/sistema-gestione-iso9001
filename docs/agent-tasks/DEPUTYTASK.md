# DEPUTYTASK — LG-5: Chiusura via 2 (superadmin post-Cursor)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 31/08/2026  
**Chiuso:** 31/08/2026  
**Piano:** [`PLAN_LIBRERIA_GAP_SLICES.md`](PLAN_LIBRERIA_GAP_SLICES.md)  
**Rischio:** Medio — BE additivo (mark digitized + email opz.); FE coda superadmin  
**Branch:** `cursor/lg5-platform-gap-close-9166`  
**Esito:** TEST OK — BE Jest 13 · Vitest NormLibrary 13 · build OK

## Esito

- `markPlatformDigitized`: solo `closure_path=platform`, open/in_progress → `digitized`; append note «Chiusura piattaforma»; opz. ack email al richiedente (user o admin org)
- `PATCH /library/source-requests/:id/mark-digitized` (superadmin)
- FE coda: «Segna digitalizzata» + form note qualità + checkbox ack tenant
- **Niente** avvio pdf-to-json automatico
- PLAN epic COMPLETATO (LG-1…LG-5; LG-6 nebbia)

## DoD

- [x] markPlatformDigitized + notify tenant opz.
- [x] Endpoint + UI coda
- [x] Test L1 + build
- [x] PLAN LG-5 CHIUSO; stato piano COMPLETATO; brief CHIUSO
