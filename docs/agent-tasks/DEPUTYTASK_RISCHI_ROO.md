# DEPUTYTASK — Rischi / Opportunità — ROO-16 (storico riga)

**Stato:** CHIUSO  
**Chiuso:** 15/08/2026  
**Slice:** ROO-16  
**Piano:** [PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md](PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md) §7  

## Slice unica: ROO-16

**Obiettivo**: ogni create e ogni update *significativo* di una riga di analisi lascia uno snapshot interrogabile; nel form si vede la cronologia. `risks` resta lo stato corrente.

### Contesto gap (non riscrivere)

- Oggi `PUT /risks/:id` sovrascrive. Residuo e `effectiveness_note` sono un solo valore: il ciclo di riesame perde P/G precedenti.
- Non è un tab nuovo. Non è `document_history` (grain campo). Non è una seconda riga `risks`.
- Decisioni: PLAN §7.

### DoD

1. Migration in `database/migrations/` (prossimo libero, oggi **152**; ex 150 — 149 preso da MC-1): tabella `risk_reviews` append-only, colonne snapshot interrogabili (P, G, segno, metodo, quadrante, residuo, nota, azioni, nature, title, evaluated_element, recorded_at, recorded_by, organization_id, company_id, risk_id). Idempotente. Solo TEST.
2. `createRisk` / `updateRisk`: se il salvataggio è significativo (PLAN §7), INSERT snapshot dello stato **nuovo**. Titolo/testi 4.1–4.2 da soli → no snapshot in update.
3. `GET /risks/:id/reviews` — stesso RBAC della riga; lista `recorded_at` DESC; decora score/livello come `decorateRiskRow`.
4. `RiskForm`: cronologia in sola lettura **dentro il form** (data, chi, P/G/R, residuo, nota). Click riga = form, non expand in griglia, non seconda finestra. Nessun quarto tab.
5. Lista Analisi: di default **esclude** `status=closed`. Checkbox toolbar «Mostra rischi chiusi».
6. Test L1: write su create + update significativo; update solo titolo non scrive; GET lista. Vitest: timeline se ci sono review; chiusi nascosti se il flag è off.

### File previsti

- `database/migrations/152_risk_reviews.sql` (ex 150; 149 ufficiale = MC-1)
- `backend/src/controllers/risks.controller.js` + test
- `backend/src/routes/risks.routes.js`
- `app/src/pages/RisksPage.jsx` (`RiskForm`)
- `app/src/services/apiService.js` (GET reviews)
- test Vitest accanto a `riskFormCatalogPicker.test.jsx`

### Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a)
- Detector FMEA (ROO-6b-F), ingest → review (ROO-18), lista ambito (ROO-17), agente AI §6.1 (ROO-19)
- Rollback/ripristino snapshot
- Produzione (DB + BE)
- Cataloghi 4.1/4.2, tab Obiettivi, scala P/G

### Prossima (non in questa sessione)

ROO-17 — interrogazione per azienda/periodo (input §9.3).
