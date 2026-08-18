# DEPUTYTASK — Rischi / Opportunità — ROO-17 (lista riesami ambito)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 17/08/2026 (dopo promote #436/#453)  
**Chiuso:** 17/08/2026  
**Slice:** ROO-17  
**Piano:** [PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md](PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md) §7  

## Slice unica: ROO-17

**Obiettivo**: interrogare tutti i riesami (`risk_reviews`) di **un’azienda** tra due date — input §9.3. La griglia Analisi resta lo stato corrente; lo storico di *una* riga resta nel form (ROO-16).

### Contesto (non riscrivere)

- ROO-16 FATTO: tabella `risk_reviews`, write su create/update significativo, `GET /risks/:id/reviews`, timeline nel form, lista senza chiusi di default.
- 151/152 già su TEST e PROD. Nessuna migrazione nuova se lo schema basta.
- Create/import richiedono `company_id` (Ambito). Stesso gate per l’interrogazione ambito.

### DoD

1. `GET /risks/reviews?company_id&from&to` registrato **prima** di `/risks/:id` (altrimenti `reviews` viene parsato come id).
2. `company_id` obbligatorio → 400 `COMPANY_REQUIRED`. `from`/`to` ISO `YYYY-MM-DD`; default UI: 1 gen → oggi; range invertito → 400.
3. Stesso RBAC della lista rischi (`organization_id` + `companyAccessSqlFilter`). Solo snapshot dell’azienda; `recorded_at` nel periodo, `ORDER BY recorded_at DESC`. Decorare score/livello come `decorateRiskRow`.
4. UI **nella tab Analisi**, non un quarto tab: toggle «Stato corrente» / «Riesami ambito». Date Da/A visibili in vista riesami. Click riga → form della valutazione **corrente** (`GET /risks/:id`), non editor dello snapshot.
5. Senza azienda in Ambito: toggle riesami disabilitato (stesso hint di Nuovo/Importa).
6. Test L1: controller (manca azienda, range, SQL company/date); Vitest: toggle + chiamata API con `company_id`/`from`/`to`.

### File previsti

- `backend/src/routes/risks.routes.js`
- `backend/src/controllers/risks.controller.js` + `risks.controller.test.js`
- `app/src/services/apiService.js`
- `app/src/pages/RisksPage.jsx` + CSS
- `app/src/utils/riskReviewsScopeParams.js` + test Vitest

### Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a)
- Detector FMEA (ROO-6b-F), ingest → review (ROO-18), agente AI §6.1 (ROO-19)
- Tab Obiettivi, cataloghi 4.1/4.2, produzione
- `149_material_certificates.sql`
- Quarto tab «Storico»

### Verifica TEST

- `deploy-to-vps-test.sh` (nessuna SQL nuova) — health 200, PID test cambiato, PROD invariato
- Smoke: senza `company_id` → 400 `COMPANY_REQUIRED`; range invertito → 400; `company_id=48` 2026 → **8** snapshot (righe smoke soft-deleted, visibili per §9.3)
