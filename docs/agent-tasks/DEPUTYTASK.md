# DEPUTYTASK — LG-3: Coda superadmin gap piattaforma

**Stato:** CHIUSO — TEST OK  
**Aperto:** 31/08/2026  
**Chiuso:** 31/08/2026  
**Piano:** [`PLAN_LIBRERIA_GAP_SLICES.md`](PLAN_LIBRERIA_GAP_SLICES.md)  
**Rischio:** Medio — FE + BE additivo  
**Branch:** `cursor/lg3-superadmin-gap-queue-9166`  
**Esito:** TEST OK — BE Jest 6 · Vitest NormLibrary 11 · build OK

## Esito

- `GET /library/source-requests/platform-queue` (solo superadmin): gap `closure_path=platform` open/in_progress cross-tenant + nome studio
- `PATCH .../:id/acknowledge` (solo superadmin): open → in_progress (azione leggera; niente digitalizzazione)
- Sezione «Coda gap piattaforma» in Libreria (solo superadmin): griglia + «Apri in Libreria» (highlight) + «Segna in corso»
- Niente pdf-to-json / LG-5

## DoD

- [x] GET platform-queue
- [x] Acknowledge → in_progress
- [x] Sezione UI + link Libreria
- [x] Test L1 + build
- [x] PLAN LG-3 CHIUSO; brief CHIUSO

## Post-merge

- FE Netlify da `main`
- BE: `deploy-to-vps.sh` (controller/routes/service già in manifest)
- Prossima slice: **LG-4** chiusura via 1 (tenant)
