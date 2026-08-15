# DEPUTYTASK — Rischi / Opportunità / Obiettivi — ROO-5 (residuo + griglia M03)

**Stato:** CHIUSO  
**Priorità:** P1 — la riga M03 deve mostrare residuo e vivere in una matrice, non in card  
**Branch base:** `main`  
**Slice:** ROO-5 (+ griglia + nota efficacia; tab «Analisi»)  
**Creato da:** Lead 14/08/2026  
**Chiuso:** 14/08/2026 — `residual_*` + `effectiveness_note` + `SgqDataGrid`  
**Piano:** [PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md](PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md)  
**Spec:** [M03_ANALISI_RISCHI_OPPORTUNITA.md](../specs/M03_ANALISI_RISCHI_OPPORTUNITA.md)

> **Allineamento Git (autonomo)**: `git fetch origin main` e partire da `origin/main` aggiornato. **Non** chiedere al committente di farlo.

---

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` e brief Material Compliance.
- CHECK `probability`/`impact` (restano 1–3) e CHECK `treatment`. Scala 1–4 = ROO-13.
- Inline cell edit (v1 = click riga → form).
- `nc.controller.js` / schema `objectives` / FK cataloghi.
- Sync / ADR-008.
- `backend/database/migrations/` (cartella morta).

## Slice ROO-5 — consegnata

| Pezzo | Dove |
|-------|------|
| Migration 147 | `residual_probability`, `residual_impact` (TINYINT NULL, CHECK 1–3 OR NULL), `effectiveness_note` |
| API | create/update/list/getOne; `parseOptionalPgFactor`; `decorateRiskRow` → `residual_score` / `residual_score_level` |
| UI | `SgqDataGrid` ordine M03; form con P/G residui + aggiornamento; tab «Analisi» |
| Temp. | riusa `review_date` (niente `action_due_date`) |

### DoD

- [x] Migration idempotente 147; TEST VPS prima di prod.
- [x] Residuo opzionale: vuoto → null; G=4 → 400.
- [x] Griglia al posto delle card; click apre il form.
- [x] Test L1 Jest + Vitest + build.

## Prossima slice

**ROO-6** — ingest Excel (primo detector M03). Non parallelizzare su `RisksPage` / `risks.controller.js`.
