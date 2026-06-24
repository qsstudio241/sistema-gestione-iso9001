# DEPUTYTASK — stato al 24/06/2026

## Sessione CHIUSA — Riesame di Direzione ISO 9001 §9.3 (TEST OK + RILASCIO PRODUZIONE)

Modulo Riesame di Direzione portato a piena conformità §9.3.2/§9.3.3. Tutto su `main` e deployato sul VPS.

### Gap risolti

| Gap | Contenuto | Commit / Migration |
|-----|-----------|--------------------|
| **G1** | Collegamento output §9.3.3 → Piano Azioni: colonna `non_conformities.management_review_id` + FK + indice; pulsante "Crea azioni dagli output" che apre `NcCreateModal` precompilato (categoria `management_review`) | Migration **113** (vps+local) `8d62ea3`; `nc.controller.js`, `ncCreateHelpers.js`, `NcCreateModal.jsx`, `ManagementReviewsPage.jsx` |
| **G2** | Export Word verbale §9.3 — già in PR **#156**; esteso col segnaposto `{input_monitoring}` | `wordExportReview.js`, template `.docx` |
| **G3** | Input §9.3.2 c.5 "Risultati di monitoraggio e misurazione" (`input_monitoring`); gli altri campi normativi (b, c.1, c.3, e) già presenti da migration **110** | Migration **112** (vps+local) `f7fbffe`; `managementReviews.controller.js`, `ManagementReviewsPage.jsx`, `wordExportReview.js`, `generateManagementReviewTemplate.js` |
| **G5** | Test L1: Vitest frontend + **test backend Jest `managementReviews.controller.test.js`** su `getInputSummary` (7 casi — aggregazione NC/obiettivi/audit/fornitori/reclami, filtro `company_id`, scope `organization_id`, errori per-blocco, guard RBAC) | `07dfa0a` (frontend) + test backend (questa chiusura) |
| **G6** | Fix filtro `company_id` mancante nelle query obiettivi di `generateDraft`/`generateOutputs` (ora allineate a `getInputSummary`) | `f7fbffe` |

### Stato produzione (24/06/2026)
- DB `SGQ_ISO9001`: migrazioni **110/112/113** applicate (campi normativi §9.3.2 + FK `management_review_id`)
- Tabella `management_reviews`: **30 colonne** (25 alla creazione migration 099 + 5 da 110/112) — verificato su `INFORMATION_SCHEMA.COLUMNS`
- Backend: `managementReviews.controller.js` + `nc.controller.js` deployati su VPS, restart con verifica PID, health 200
- Frontend: live su `main` (Netlify)
- Test: Vitest frontend verde + Jest backend `getInputSummary` **7/7 verde**

### Note di allineamento
- **PR #124 (selettore azienda)**: SUPERATA dal pattern "Ambito/company scope" già adottato nel modulo (filtro `company_id` opzionale in `getInputSummary`/`generateDraft`/`generateOutputs` + `companyAccess.service`). Non riaprire.
- Errore documentale "90 colonne" in `GUIDA_CONSOLIDATA.md` (sez. 18/06/2026) corretto → valore reale verificato.

---

## Backlog (prossime sessioni)
1. **Dismettere ambiente test isolato** `/var/www/sgq-backend-test` quando non più necessario
2. **Batch upload WPS** (nessun endpoint, bassa priorità)
3. **Hardening RBAC welding** (assertCompanyRead mancante, media priorità)
4. **MT/PT/UT**: sezioni parametri specifiche + template Word
5. **Foto offline**: upload asincrono per cantieri senza WiFi
