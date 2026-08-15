# DEPUTYTASK — Rischi / Opportunità / Obiettivi — ROO-13 (scala P/G per azienda)

**Stato:** CHIUSO  
**Priorità:** P1 — i file cliente usano 1–4 / 1–5  
**Branch base:** `cursor/rischi-opportunita-obiettivi-c6d2`  
**Slice:** ROO-13  
**Chiuso:** 15/08/2026 — `companies.risk_pg_max` prima dell'ingest o del primo rischio  
**Piano:** [PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md](PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md)

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md`
- Metodo SWOT con segno persistito (ROO-6b / ROO-15)
- Upsert ingest
- Selettore azienda in pagina (resta `useCompanyScope`)

## Decisione

La scala P/G è del **metodo dell'azienda**, non del prodotto. Default **1–3**. Si imposta **1–4** (M03) o **1–5** prima dell'ingest o del primo rischio. Non si può scendere sotto il massimo già usato sulle righe.

CHECK DB allargato a 1–5; l'API applica `risk_pg_max`. Livelli = terzi di R max (su 1–3 restano 1-3/4-6/7-9).

## Consegnato

| Pezzo | Dove |
|-------|------|
| Migrazione | `148_companies_risk_pg_max.sql` |
| API | `PUT /risks/pg-scale`; create/update/import/detect usano la scala azienda |
| UI | toolbar Analisi: Scala P/G; dialog ingest: «Imposta scala 1–N e ricalcola» |

## Prossima slice

**ROO-6b** — metodo SWOT/FMEA nativo (segno, rilevabilità).
