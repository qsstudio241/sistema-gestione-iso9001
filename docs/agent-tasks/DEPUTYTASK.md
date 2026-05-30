# DEPUTYTASK - Contesto AI multi-slice (L1-L4)

**Stato programma:** slice **2** e **3** chiuse (30/05/2026) — programma contesto AI **TEST OK**.
**Branch:** `main` (commit `ec62a54` slice 2 + PR #73 slice 1/3).

---

## Slice 2 - Propagazione audit (30/05/2026) — TEST OK

| # | Voce | Esito |
|---|------|-------|
| 1 | Helper `aiAssistantContext.js` (focus clausola, payload chat) | **OK** |
| 2 | Test Vitest `aiAssistantContext` (9 test) | **OK** |
| 3 | `enrichSystemPromptWithOrganization` su tutti gli endpoint AI | **OK** — `ai/chat`, `ai/suggest`, upload norme PDF |
| 4 | Propagazione audit → norma + clausola in chat e suggest | **OK** |
| 5 | Separatore UI al cambio audit + banner clausola attiva | **OK** |
| 6 | Test Jest backend `aiChat` + `aiAssist` | **OK** (9 test) |
| 7 | Commit + push `main` | **OK** — `ec62a54` |
| 8 | Deploy backend VPS + restart PID | **OK** — `331861` → `332487` |
| 9 | Smoke API | **OK** — health, PATCH rimozione nota smoke, `POST /ai/chat` con audit context, reindex |
| 10 | Netlify UI | **OK** — build automatica da `main` (~2 min) |

### Cosa vedono gli utenti

- **Assistente AI**: chip azienda/norma auto da audit aperto; separatore in chat al cambio audit; clausola attiva se compilano checklist.
- **Conclusioni audit / Riesame contratti**: suggest AI riceve `standardId` dall'audit corrente.
- **Impostazioni studio**: nota smoke rimossa da `ai_context_notes`.

### Residui

Nessuno bloccante. Copertura `standard_id` su chunk migliorata (inferenza documenti norma/qualifiche al reindex); entità senza norma (reclami, rischi) restano `NULL` per design.

---

## Slice 3 - Deploy produzione (30/05/2026) — TEST OK

| # | Voce | Esito |
|---|------|-------|
| 1 | Migrazione 066 VPS (`ai_context_notes`) | **OK** |
| 2 | Migrazione 067 VPS (`knowledge_chunks.standard_id`) | **OK** |
| 3 | Deploy backend VPS | **OK** |
| 4 | Restart `sgq-backend` | **OK** |
| 5 | Health + smoke slice 3 | **OK** |

---

*Aggiornato 30/05/2026 — slice 2 chiusa (propagazione audit + deploy VPS + smoke).*
