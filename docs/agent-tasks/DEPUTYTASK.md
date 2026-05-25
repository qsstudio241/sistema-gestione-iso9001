# DEPUTYTASK — Chiusura refactor Registro norma SoT (R1–R7)

**Stato:** **TEST OK — sessione chiusa** (25/05/2026)

## Programma completato

| Slice | Esito |
|-------|--------|
| R1 Job validità su registro | **OK** (PR #66) |
| R2 Persistenza lookup form | **OK** |
| R3 Upload bulk schema unificato | **OK** |
| R4 Badge vigore UI | **OK** (PR #68) |
| R5 Knowledge index ancorato | **OK** |
| R6 Backfill dati legacy VPS | **OK** |
| R7 ADR-011 documentazione | **OK** |

**VPS npm (25/05 12:03):** `npm install` in `/var/www/sgq-backend` — log: `[AlertScheduler] Scheduler avviato` (alert 08:00, norme lun 03:00). Email settimanale norme superate abilitata se `ALERT_ENABLED=true`.

## Riferimenti

- Piano: [PLAN_REGISTRY_NORM_SOT_SLICES.md](./PLAN_REGISTRY_NORM_SOT_SLICES.md)
- ADR: [ADR-011-registry-norm-sot.md](../adr/ADR-011-registry-norm-sot.md)
- Script backfill: `backend/scripts/backfill-norm-type-specific-data-vps.js`

## Lezione appresa

- **SoT unico**: `document_registry.type_specific_data` per metadati norma; `norm_document_sources` solo testo/chunk AI + mirror transitorio.
- **Backfill idempotente**: merge solo campi mancanti via `mergeMissingNormTypeSpecificData` — evita regressioni su dati già allineati post-R3.

---

*Nessun task deputy attivo. Prossimo lavoro: backlog Sprint 11 / gap analysis (fuori da questo refactor).*
