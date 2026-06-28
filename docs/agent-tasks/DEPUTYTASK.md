# DEPUTYTASK — Piano ingest + learning (28/06/2026)

## Chiuso — piano IG completo + smoke TEST

| Slice | Stato |
|---|---|
| IG-1 | ✅ #181 |
| IG-2 | ✅ #182 |
| IG-3 | ✅ #184 |
| IG-4 | ✅ #186 — feedback DB mig. 115 |
| IG-5 | ✅ #186 — few-shot |
| IG-6 | ✅ #186 — WPS batch |

Piano: [`PLAN_INGEST_LEARNING_SLICES.md`](PLAN_INGEST_LEARNING_SLICES.md)

## Smoke TEST (28/06/2026)

| Verifica | Esito |
|---|---|
| API E2E `smoke-ingest-e2e-test.js` su test-api | ✅ login, upload WPQR → staging → confirm → feedback → reject |
| Health test-api | ✅ |
| UI Playwright Deploy Preview #186 | ✅ `/saldatura/procedure` — Carica WPS/WPQR (batch); `/qualifiche` — Carica patentini (batch); WPQR smoke visibili in tabella |
| Migrazioni TEST 114+115 | ✅ |
| Backend sgq-backend-test | ✅ |

**Ambiente**: solo TEST (`/test-api`, DB `2026-06-18_SGQ_ISO9001`). Produzione non toccata.
