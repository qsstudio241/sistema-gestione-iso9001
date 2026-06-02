# DEPUTYTASK — Estensioni Riesame Requisiti

**Stato:** R1 completata — slice **R2** pronta  
**Baseline `main`:** commit `5403b1c` (merge PR [#80](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/80))  
**Piano completo:** [TASK_RIESAME_ESTENSIONI_SLICES.md](TASK_RIESAME_ESTENSIONI_SLICES.md)

## Prima di iniziare (locale)

```bash
git pull origin main
```

Verifica: `docs/agent-tasks/TASK_RIESAME_ESTENSIONI_SLICES.md` presente; backend contiene `importFromJob` in `contractReview.controller.js`.

## Comando nuova chat (incolla in Agents)

```
Leggi docs/agent-tasks/DEPUTYTASK.md e docs/agent-tasks/TASK_RIESAME_ESTENSIONI_SLICES.md (slice R2).
Esegui la slice R2 (UI Import Jobs).
Chiudi con TEST OK o FIX NON APPLICABILI.
```

## Slice corrente: R2 — UI Import Jobs

| Task | File |
|------|------|
| Pulsante «Crea caso Riesame» | `app/src/pages/ImportJobsPage.jsx` |
| Metodo API | `app/src/services/apiService.js` → `importContractCaseFromJob` |
| Modale conferma | stesso page (titolo, cliente, anteprima testo) |
| Redirect successo | `/contract-reviews/:id` |
| Test L1 | Vitest mirato se esiste pattern; almeno `npm run build` in `app/` |

**API già in produzione (VPS):** `POST /api/v1/contract-reviews/import-from-job`  
Body: `{ job_id, file_ids?, title?, company_id?, external_ref?, notes? }`

**Branch consigliato:** `cursor/riesame-r2-import-ui-5351`

## Completato — R1 TEST OK

- Endpoint import-from-job + checklist preliminare + allegati
- Jest 4 test; deploy VPS backend
- PR #80 mergiata su `main`

## Epic successive (ordine)

1. ~~R1 API import~~ ✅  
2. **R2** UI Import Jobs ← **adesso**  
3. R3 link bidirezionale (migrazione 069)  
4. S1–S2 fornitori  
5. N1–N2 notifiche  
6. H0 → H1 handoff commessa
