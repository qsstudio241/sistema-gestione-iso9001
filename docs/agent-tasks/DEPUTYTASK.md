# DEPUTYTASK — LG-5: Chiusura via 2 (superadmin post-Cursor)

**Stato:** APERTO  
**Aperto:** 31/08/2026  
**Piano:** [`PLAN_LIBRERIA_GAP_SLICES.md`](PLAN_LIBRERIA_GAP_SLICES.md)  
**Rischio:** Medio — BE additivo (mark digitized + email opz.); FE coda superadmin  
**Branch:** `cursor/lg5-platform-gap-close-9166`  
**Parallelo:** nessuno (tutti gli slot CHIUSI su `origin/main`)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Contesto

PR **#614** (LG-4) mergiata. Epic gap Libreria: LG-1…LG-4 CHIUSI. Ultima slice eseguibile: **LG-5** (LG-6 push mobile resta nebbia/fuori).

Via 2: dopo digitalizzazione in Cursor (PDF→MD/JSON **manuale**, niente automatismo), il superadmin marca la richiesta come digitalizzata piattaforma + note qualità; opz. ack email al tenant richiedente.

## Obiettivo

1. BE: `markPlatformDigitized(id, { qualityNotes, notifyTenant })` — solo `closure_path=platform`, status `open|in_progress` → `digitized`; aggiorna note qualità; opz. email al richiedente (user o admin org).
2. Endpoint `PATCH /library/source-requests/:id/mark-digitized` (solo superadmin).
3. FE coda superadmin: azione «Segna digitalizzata» + form note qualità + checkbox ack tenant. **Niente** avvio pdf-to-json.
4. Test L1 BE + Vitest NormLibrary + build. PLAN → epic **COMPLETATO** (LG-1…LG-5; LG-6 fuori).

## File previsti

- `backend/src/services/librarySourceRequest.service.js` (+ test)
- `backend/src/controllers/librarySourceRequest.controller.js`
- `backend/src/routes/librarySourceRequest.routes.js`
- `app/src/services/apiService.js`
- `app/src/pages/NormLibraryPage.jsx` (+ CSS minimo se serve)
- `app/src/tests/normLibraryPage.test.jsx`
- `docs/agent-tasks/PLAN_LIBRERIA_GAP_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK.md`
- `docs/PROJECT_ROADMAP.md` § Stato attuale (chat sola)

## Cosa NON toccare

- `pdf_to_json` / pipeline automatica Cursor
- LG-6 push mobile
- Auth JWT / sync / migrazioni distruttive
- Know-how `docs/Normative/` (digitalizzazione resta HITL Cursor, fuori da questa slice)
- Altri moduli (NC, SAL, WPQR, CND)

## DoD

- [ ] markPlatformDigitized + notify tenant opz.
- [ ] Endpoint + UI coda
- [ ] Test L1 + build
- [ ] PLAN LG-5 CHIUSO; stato piano COMPLETATO; brief CHIUSO
