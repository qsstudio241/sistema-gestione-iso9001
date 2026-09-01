# DEPUTYTASK — VC-2: Catalogazione docs cliente sul caso (ruoli + lista)

**Stato:** APERTO  
**Aperto:** 01/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § VC-2  
**Rischio:** Medio — BE additivo (PATCH ruolo allegato) + FE catalogo; niente migrazione; niente auth/sync breaking  
**Branch:** `cursor/vc2-case-doc-catalog-1c5d`  
**Dipende da:** VC-1 (mergiata #619; mig. 161 applicata su VPS)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Perché (prodotto)

Lo studio carica / importa documenti cliente sul caso, ma l’elenco allegati è piatto e non guida la **catalogazione per ruolo**. Senza ruolo chiaro, «Analizza documenti» salta file o parte su materiale non catalogato. VC-2 rafforza il **catalogo** (lista per ruolo + assegnazione ruolo) e **gating** dell’analisi sui soli allegati catalogati. Riuso upload multi e Import→caso; nessun nuovo storage.

## Obiettivo

Su un caso con allegati (upload multi o da `import-from-job`):

1. Elenco **catalogo** raggruppato per `commercial_doc_role` (incluso gruppo «Da catalogare» se ruolo assente).
2. Possibilità di **assegnare/correggere** il ruolo su un allegato esistente (PATCH).
3. Pulsante **Analizza documenti** abilitato solo se esiste almeno un allegato **catalogato e analizzabile** (ruolo drawing / capitolato|order+PDF); altrimenti `disabled` + `title` esplicativo. L’analisi processa solo i catalogati.

## DoD

- [ ] `PATCH /contract-reviews/:id/attachments/:attachmentId` aggiorna `commercial_doc_role` (scope org/caso)
- [ ] UI catalogo in slide Documenti (`ContractReviewPage`) — DNA `.cr-*`, niente look nuovo
- [ ] Gate Analizza: solo catalogati analizzabili; upload multi + Import→caso intatti
- [ ] Test L1 BE (controller/service) + `npm run build` FE
- [ ] `deploy-manifest.json` aggiornato se nuovo `.js` in `backend/src/`
- [ ] Nessuna migrazione; VC-3+ non toccati

## File previsti

| Layer | Path |
|-------|------|
| BE | `backend/src/controllers/contractReview.controller.js` (+ test) |
| BE | `backend/src/routes/contractReview.routes.js` |
| BE | eventuale helper riuso in `caseDocumentAnalysis.service.js` (ruoli catalogati / analizzabili) |
| FE | `app/src/pages/ContractReviewPage.jsx` (+ CSS minimo se serve) |
| FE | `app/src/services/apiService.js` |
| Doc | questo brief; spunta VC-2 su `PLAN_VALUTAZIONE_COMMESSE_SLICES.md` a chiusura |

## Cosa NON toccare

- VC-3+ (orchestrazione analyze→report, export Word, chiarimenti, offerta, PPAP)
- Auth/JWT, `syncService`, breaking schema / migrazioni
- `caseCapabilityGapReport.service.js` (VC-1 chiuso) salvo lettura catalogo già presente
- SAL / `gapAnalysis.service.js`, nuovo storage file, seconda pipeline OCR
- Altri `DEPUTYTASK*` / moduli non in tabella

## Gate parallelo

Nessun altro `DEPUTYTASK*` APERTO su `origin/main`. Nessuna PR aperta in conflitto su questi file al momento dell’apertura.
