# DEPUTYTASK — LG-4: Chiusura via 1 (tenant)

**Stato:** APERTO  
**Aperto:** 31/08/2026  
**Piano:** [`PLAN_LIBRERIA_GAP_SLICES.md`](PLAN_LIBRERIA_GAP_SLICES.md)  
**Rischio:** Medio — BE additivo (hook ingest → stato richiesta); FE minimo (refresh + label)  
**Branch:** `cursor/lg4-tenant-gap-close-9166`  
**Parallelo:** nessuna PR aperta; slot precedente LG-3 CHIUSO su `main`

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Obiettivo

Quando l’ingest tenant (norma in Libreria/Registro) **copre** il `source_code` di una richiesta gap con `closure_path=tenant` (stato `open`/`in_progress`) → aggiornare lo stato a **`closed`**.  
Niente tocco know-how piattaforma (`docs/Normative/`, seed RAG, richieste `closure_path=platform`).

## File previsti

- `backend/src/services/librarySourceRequest.service.js` (+ test)
- `backend/src/services/normIngest.service.js` (hook post-commit / apply)
- `backend/src/services/normCodesImport.service.js` (hook post-create)
- `app/src/pages/NormLibraryPage.jsx` (refresh richieste dopo upload; label chiusa)
- `app/src/tests/normLibraryPage.test.jsx` (se serve)
- `docs/agent-tasks/DEPUTYTASK.md`, spunta LG-4 su PLAN

## Cosa NON toccare

- `aiChat.controller.js` / parseSourceGaps (LG-1)
- Coda superadmin / acknowledge (LG-3) — niente chiusura platform
- LG-5 digitalizzazione piattaforma
- Migrazioni (status `closed` già in CK mig. 160)
- Auth/JWT/sync, GUIDA/roadmap hub (traccia nel brief; sync hub dopo merge se parallelo)

## DoD

- [ ] `closeTenantRequestsCoveredByCode(orgId, code)` — solo `closure_path=tenant`, match codice case-insensitive/prefisso
- [ ] Chiamata non bloccante da commitNorm / applyNorm / importNormCodes
- [ ] UI: dopo NormUpload in Libreria ricarica richieste; stato `closed` leggibile
- [ ] Test BE + Vitest mirato + build
- [ ] PLAN LG-4 CHIUSO; brief CHIUSO

## Post-merge

- BE: `deploy-to-vps.sh` (service già in manifest)
- Prossima slice: **LG-5**
