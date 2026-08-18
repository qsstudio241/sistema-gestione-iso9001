# DEPUTYTASK — Material Compliance ingest (MC-I0)

**Stato:** APERTO  
**Aperto:** 18/08/2026 (Lead wayfinder — Chart the map, track ingest)  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-I0  
**Spec:** [`MATERIAL_COMPLIANCE_API.md`](../specs/MATERIAL_COMPLIANCE_API.md) · ADR-024 stati  
**Rischio:** Medio — backend additivo sul lock evaluate, nessuna migrazione; PR + gate Bugbot; Cloud **non** mergia  
**Ambiente:** TEST (deploy controller dopo merge). Record ADA produzione 3–5 / azienda 179 = prova già fatta, non riscoprire.  
**Non toccare:** [`DEPUTYTASK.md`](DEPUTYTASK.md) (SAL S1a resta APERTO)

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: EN 10204 (tipo documento), dizionario MC, EN 10025-2
- Si parte su: fix evaluate 409; skip OCR, skip split PDF, skip few-shot
```

## Slice unica di questa sessione: MC-I0 — Valuta 409

**Obiettivo**: il pulsante **Valuta** su un certificato in stato `extracted` (JSON già presente) completa e persiste i checks in `pending_review`. Niente 409 da lock `updated_at`.

### Causa già letta dal codice (non riscoprire lo stato)

- `EVALUABLE` include già `extracted` — il 409 **non** è `ILLEGAL_TRANSITION` di workflow.
- `persistEvaluateResult` aggiorna con `AND updated_at = @updated_at` su `DATETIME2` (`SYSUTCDATETIME()`).
- `evaluateCertificate` passa `row.updated_at` del SELECT iniziale (Date JS `node-mssql`) — il FE **non** invia il lock (`evaluateMaterialCertificate(id)` body vuoto).
- I test mockano l’uguaglianza; in produzione il confronto Date vs `datetime2` fallisce anche se nessuno ha toccato la riga.
- Il 409 su `compliant` / stato non valutabile **deve restare**.

### DoD

1. `POST /material-certificates/:id/evaluate` con riga `extracted` + JSON → 200, `workflow_status: pending_review`, checks persistiti; **mai** `compliant` da evaluate
2. Stesso percorso se `updated_at` dal driver è un `Date` JS (caso reale ADA) — **non** 409 spurio
3. Evaluate da `compliant` resta 409; rollback se INSERT checks fallisce resta 500
4. Test L1 in `materialCertificates.controller.test.js` (happy path extracted + Date mismatch; 409 legale invariato)
5. Nessun commit di segreti; Bugbot prima di dichiarare la PR pronta

### File previsti

- `backend/src/controllers/materialCertificates.controller.js` (`persistEvaluateResult` / `evaluateCertificate`)
- `backend/src/controllers/materialCertificates.controller.test.js`

### Cosa NON toccare

- [`DEPUTYTASK.md`](DEPUTYTASK.md) (SAL S1a) e `documentTextExtractor.service.js` / `ocrExtractor.js`
- PLAN 3834 / ISO-4 / Welding Book
- Slice successive di questo PLAN: MC-I1 (ruolo), MC-B (OCR), MC-I2…I4, MC-7 (`recordFeedback`), MC-6
- UI (`MaterialCertificatesPage.jsx`) salvo se un messaggio 409 fuorviante va solo riformulato — preferire zero
- Migrazioni SQL, Rule Engine, schema `material_certificate`, ingest qualifiche/WPQR

### Test

```bash
cd backend && npx jest src/controllers/materialCertificates.controller.test.js --forceExit
```

Dopo merge + deploy TEST: Valuta su un record ADA `extracted` (azienda 179) → `pending_review`. Non è DoD di questa PR se il merge non è ancora in TEST.

### Comando per il deputy

`Leggi docs/agent-tasks/DEPUTYTASK_MC_INGEST.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`
