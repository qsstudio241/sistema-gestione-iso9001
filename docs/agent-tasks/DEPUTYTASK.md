# DEPUTYTASK — Hardening harness doppio (HK-1 … HK-10)

> **Creato**: 29/06/2026  
> **Piano dettagliato**: [`PLAN_HARNESS_HARDENING_SLICES.md`](PLAN_HARNESS_HARDENING_SLICES.md)  
> **Branch**: `cursor/harness-hardening-hk-6b60`  
> **Base**: `main`

---

## Obiettivo

Chiudere i gap strutturali su **entrambi gli harness**:

1. **Sviluppo (Cursor)** — governance, memoria operativa, igiene repo  
2. **Prodotto (AI runtime)** — percorso riesame unico, audit trail, licenze, NormBroker v1, gap analysis MVP, disclaimer UI

---

## Si può fare tutto in un colpo?

**No in un solo commit**, **sì in una sequenza guidata**: 10 slice verticali con DoD ciascuna. Esegui **HK-1 → HK-10** in ordine (salvo parallelismo indicato nel piano). Una PR per slice è preferibile; PR cumulativa accettabile solo se diff reviewabile e CI verde.

---

## Stato slice (aggiornare il deputy durante il lavoro)

| Slice | Descrizione | Stato |
|-------|-------------|-------|
| HK-1 | Governance dev (ADR-015, legacy Copilot, encoding rules) | ✅ |
| HK-2 | GUIDA alleggerita + link roadmap | ✅ |
| HK-3 | `.gitignore` + archive stub + catalogo smoke | ✅ |
| HK-4 | Percorso canonico AI riesame | ✅ |
| HK-5 | Audit trail import + riesame + feedback | ✅ |
| HK-6 | Licenze AI (routes + admin UI) | ✅ |
| HK-7 | NormBroker v1 cascata + norm_access_log | ✅ |
| HK-8 | Gap analysis MVP (API + pagina) | ✅ |
| HK-9 | Disclaimer AI + AiSuggestionInline | ✅ |
| HK-10 | Doc finale + test L1 + chiusura | ✅ |

Legenda: ⬜ da fare · 🔄 in corso · ✅ fatto · ⏭️ FIX NON APPLICABILI (motivare)

---

## Vincoli (obbligatori)

- **UTF-8 senza BOM**; accenti italiani corretti; verificare con `node backend/scripts/check-utf8-encoding.js` sui file toccati.
- **Non** creare `SESSION_NOTES_*`; aggiornare solo `GUIDA_CONSOLIDATA.md` + roadmap se serve.
- **Non** introdurre segreti in repo/chat.
- **Fix minimo**: niente refactor fuori scope slice.
- **Deploy produzione VPS**: non richiesto; se serve smoke backend usare **TEST** (`test-api`) come da GUIDA.
- Riuso UI: pattern Ambito azienda, `LicensedRoute`, componenti esistenti.
- Al termine: compilare [`MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md`](MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md).

---

## Istruzioni operative per slice (riassunto)

Leggi il piano completo per file path e DoD. Qui solo l’ordine:

1. **HK-1** — ADR-015, superare ADR-001, deprecare `.github/agents` in indice, riparare `sgq-encoding-quality.mdc`, dedupe `sgq-operating-memory.mdc`.
2. **HK-2** — Sposta diario GUIDA in archive; correggi roadmap; paragrafo harness in `PROJECT_CONTEXT.md`.
3. **HK-3** — `.gitignore` artefatti `.cursor/_*`; archivia stub `TASK_AI_*`; tabella smoke in GUIDA.
4. **HK-4** — `ContractReviewPage` → `/contract-reviews/:id/ai/analyze-requirements`; unifica logica backend.
5. **HK-5** — `logAiInteraction` su import AI, analyzeRequirements, feedback.
6. **HK-6** — `ai_norms` su NormBroker; `ai_chat` su chat; tutte le chiavi in `UsersAdminPage`.
7. **HK-7** — Cascata NormBroker + persistenza + `norm_access_log`.
8. **HK-8** — `gapAnalysis.service.js` + API + `GapAnalysisPage.jsx` MVP.
9. **HK-9** — `AiDisclaimer.jsx` sui flussi AI principali.
10. **HK-10** — Lezione in GUIDA, nota stato in ADR-010, test L1, aggiorna tabella sopra.

---

## Test minimi attesi

| Livello | Quando |
|---------|--------|
| L1 backend | HK-4, HK-5, HK-7, HK-8 — test mirati Jest |
| L1 frontend | HK-4, HK-8, HK-9 — build Vite o Vitest mirato |
| L1 CI | PR → `ci-app-pr.yml` verde |
| L3 umano | Opzionale: smoke ingest se toccato import; gap page su Deploy Preview |

---

## Output finale (obbligatorio)

Chiudere con **una sola** di queste forme:

- **`TEST OK`** — tutte le slice ✅ o rischi residui documentati in GUIDA  
- **`FIX NON APPLICABILI: …`** — elenco puntuale slice saltate + motivazione + prossimo passo

Aggiornare questa tabella stato e aprire/aggiornare PR verso `main`.

---

## Prompt per lanciare il deputy

Copia in Cursor Agents:

```
Leggi docs/agent-tasks/DEPUTYTASK.md e docs/agent-tasks/PLAN_HARNESS_HARDENING_SLICES.md ed eseguili.
Branch: cursor/harness-hardening-hk-6b60 da main.
Esegui le slice HK-1 … HK-10 in ordine; commit per slice; aggiorna la tabella stato in DEPUTYTASK.md.
Chiudi con TEST OK o FIX NON APPLICABILI.
```
