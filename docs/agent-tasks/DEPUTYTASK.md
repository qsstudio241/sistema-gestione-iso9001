# DEPUTYTASK — VC-1: Report gap capacità v0 (output studio)

**Stato:** APERTO  
**Aperto:** 01/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § VC-1  
**Rischio:** Medio — BE additivo (snapshot report) + FE pannello minimo; migrazione **nullable/additiva** se serve; niente auth/JWT/sync  
**Branch consigliato (deputy):** `cursor/vc1-capability-gap-report-<suffix>`  
**Parallelo:** nessun altro `DEPUTYTASK*` APERTO su `origin/main` al charting (01/09). GUIDA/roadmap aggiornabili in PR docs della mappa (unica chat).

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Perché (prodotto)

Lo studio riceve documenti cliente, li collega al caso con **azienda appaltatrice** (capacità), ma oggi la copertura è solo **vista live** (CoveragePanel / advisory). Manca un **artefatto report persistito** riusabile come output della gap analysis. VC-1 è l’hello world end-to-end più piccolo: aggregare ciò che già esiste e salvarlo sul caso.

## Obiettivo

Su un `commercial_case` con `company_id` (azienda SGQ capacità) e, se presenti, requisiti estratti / copertura calcolabile:

1. Generare uno **snapshot report gap capacità** (JSON strutturato) riusando i servizi già in repo.
2. **Persistere** lo snapshot sul caso (colonna JSON nullable **oppure** tabella sottile dedicata — Gate Ponytail: preferire estensione minima; dichiarare N migrazione **prima** di creare il file in `database/migrations/`).
3. Esporre **GET** (leggi ultimo snapshot) + **POST** (ricalcola e salva) sotto le route `contract-reviews` esistenti (stesso guard/RBAC/org scope).
4. UI minima in `ContractReviewPage`: pannello «Report studio» con esito sintetico (ok / gap / need_input) e data generazione — DNA esistente (`.cr-panel`), niente look nuovo.
5. Test L1 BE (e Vitest FE se tocchi logica UI non banale) + `npm run build` in `app/`.

## DoD

- [ ] Service aggregatore (nome libero, es. `caseCapabilityGapReport.service.js`) chiama in lettura i mattoni esistenti (`caseExtractedCoverage` e/o `caseCoverageAdvisory` / profilo requisiti) — **non** duplicare algoritmi di match
- [ ] Persistenza multi-tenant (`organization_id` / scope via caso); senza `company_id` → 400 chiaro (allineato al messaggio UI già presente)
- [ ] Endpoint GET + POST documentati nel test; response stabile per lo studio (summary + lista gap)
- [ ] Pannello UI visibile sul dettaglio caso; non rompe CoveragePanel esistente
- [ ] Se nuovo `.js` in `backend/src/`: aggiornare `backend/scripts/deploy-manifest.json`
- [ ] Test L1 verdi; PLAN: spunta VC-1 CHIUSO solo a fine deputy
- [ ] Nessuna modifica a auth/sync; nessuna riscrittura ingest/SAL

## File previsti

- `backend/src/services/caseCapabilityGapReport.service.js` (+ `.test.js`) — o nome equivalente se esiste già un pezzo riusabile al 90%
- `backend/src/controllers/contractReview.controller.js` (+ test controller mirato)
- `backend/src/routes/contractReview.routes.js`
- eventuale `database/migrations/NNN_*.sql` + `run-migration-NNN-vps.js` (N libero al momento del deputy)
- `app/src/pages/ContractReviewPage.jsx` (+ CSS esistente se serve)
- `app/src/services/apiService.js` (metodi API)
- `backend/scripts/deploy-manifest.json` se nuovi path BE
- `docs/agent-tasks/PLAN_VALUTAZIONE_COMMESSE_SLICES.md` (checkbox VC-1)
- questo brief → CHIUSO a fine slice

## Cosa NON toccare

- `gapAnalysis.service.js` / `SALModule.jsx` (SAL ≠ questo report)
- `documentIngestPipeline` / pipeline Material Compliance / WPQR ingest
- `auth.middleware.js`, `syncService.js`, JWT
- Offerta, chiarimenti automatici, PPAP, ordini fornitori (VC-5+)
- `ProjectsPage` / CRUD commesse 3834 salvo link read-only già usato da coverage
- Altri `DEPUTYTASK*` / PLAN di altri epic
- GUIDA intera (lezione breve solo a slice chiusa se unica chat)

## Criteri

| Esito | Quando |
|-------|--------|
| **TEST OK** | DoD soddisfatto; L1 verdi; snapshot ricalcolabile e riletto dopo refresh |
| **FIX NON APPLICABILI** | Su `main` esiste già report persistito equivalente end-to-end (documentare path + PR); oppure manca prerequisito prodotto bloccante non aggirabile (es. assenza totale tabelle caso — improbabile) |

## Note per il deputy

- Charting Lead **non** ha implementato codice applicativo: solo PLAN + questo brief.
- Preferire tante slice sottili: **non** aggiungere export Word/PDF in VC-1 (è VC-4).
- Se CoveragePanel già mostra tutto ma senza persistenza, VC-1 resta **applicabile** (la persistenza è il DoD).
