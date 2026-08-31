# DEPUTYTASK — LG-3: Coda superadmin gap piattaforma

**Stato:** APERTO  
**Aperto:** 31/08/2026  
**Piano:** [`PLAN_LIBRERIA_GAP_SLICES.md`](PLAN_LIBRERIA_GAP_SLICES.md)  
**Rischio:** Medio — FE + BE additivo (endpoint superadmin, niente schema breaking)  
**Branch:** `cursor/lg3-superadmin-gap-queue-9166`  
**Dipende da:** LG-1 (MERGED #610), LG-2 (MERGED #612)

## Obiettivo

Coda **sola lettura / azioni leggere** per superadmin: elenco gap `closure_path=platform` aperti (`open` / `in_progress`) cross-tenant; link a Libreria Gestione; **niente** pdf-to-json / digitalizzazione (LG-5).

## File previsti

- `backend/src/services/librarySourceRequest.service.js` (+ test)
- `backend/src/controllers/librarySourceRequest.controller.js`
- `backend/src/routes/librarySourceRequest.routes.js`
- `app/src/services/apiService.js`
- `app/src/pages/NormLibraryPage.jsx` (+ CSS minimo)
- `app/src/tests/normLibraryPage.test.jsx`
- `docs/agent-tasks/PLAN_LIBRERIA_GAP_SLICES.md` (stato LG-3)
- `docs/agent-tasks/DEPUTYTASK.md` (questo brief)

## Cosa NON toccare

- `aiChat.controller.js` / `parseSourceGaps.js` / migrazioni
- pdf-to-json / pipeline Cursor
- Chiusura «digitalizzata» (LG-5)
- Auth middleware / sync / JWT
- `DEPUTYTASK1.md`… altri slot

## DoD

- [ ] GET platform-queue (solo superadmin) + JOIN org name
- [ ] Azione leggera acknowledge → `in_progress` (solo superadmin)
- [ ] Sezione UI coda in Libreria (solo superadmin) + link highlight
- [ ] Test L1 + build
- [ ] PLAN LG-3 CHIUSO; brief CHIUSO
