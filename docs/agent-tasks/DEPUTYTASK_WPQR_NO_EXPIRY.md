# DEPUTYTASK_WPQR_NO_EXPIRY — togliere scadenza calendario da WPQR

**Stato:** APERTO  
**Aperto:** 06/10/2026  
**Piano:** decisione prodotto (bot ProgettoISO / voice) — ISO 15614/15613/14555 non prevedono scadenza tipo patentino  
**Rischio:** **Alto** — migrazione `destructive` su `wpqr_records`. Merge solo con **OK esplicito del committente**. Cloud Agent non mergia, non undraft, non `bugbot run`.  
**Branch:** `cursor/wpqr-drop-expiry-date-d8ba`

---

## Obiettivo

Rimuovere `expiry_date` da `wpqr_records` (WPQR). Il patentino ISO 9606 e gli altri doc type con scadenza legittima restano intatti.

## File previsti

- `database/migrations/169_wpqr_drop_expiry_date.sql` + `169_verify.sql` + `169_rollback.sql`
- `backend/src/services/wpqrIngest.service.js` + test
- `backend/src/controllers/welding.controller.js` + test stats/campi
- `app/src/pages/WeldingProceduresPage.jsx` + test card
- `app/src/pages/WeldingDashboardPage.jsx` (alert WPQR su expiry)

## Cosa NON toccare

- `qualifications.expiry_date`, schema `patentino_saldatore`, `qualificationAlert`, migrazioni 9606
- `documentTypeSchemas` NDT/9712, tarature, training
- `welding_procedures.expiry_date` (WPS) — **tenuta**: usata in copertura commessa (`welding.controller.js` ~1253) e semaforo WPS. UI form WPS non la edita, ma l'API/stats sì.
- `ImportJobsPage.jsx` (PR #711 / ingest FE)

## Conteggio PROD (06/10/2026, sola lettura)

Query su `SGQ_ISO9001` via VPS (nessun DROP applicato):

```sql
SELECT COUNT(*) AS wpqr_totali,
       SUM(CASE WHEN expiry_date IS NOT NULL THEN 1 ELSE 0 END) AS wpqr_con_expiry
FROM wpqr_records;
```

Esito: **13** WPQR totali, **2** con `expiry_date IS NOT NULL`. Quei 2 valori andranno persi al DROP (decisione prodotto).

## Decisione WPS

Non droppare `welding_procedures.expiry_date` in questa slice.

## Gate merge

Migrazione DB → conferma committente. PR **draft**. Nessun apply VPS da questa chat.
