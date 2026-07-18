> **Nota sessione 18/07/2026 — Ingestione LEGISLAZIONE da Normattiva (Lead, autonoma):** ingestione testo verbatim di 30 articoli pertinenti a SGSL/SGA (D.Lgs. 81/2008 → ISO 45001: 19 art.; D.Lgs. 152/2006 → ISO 14001: 11 art.) in `norm_requirements` (source='normattiva' + permalink), matrice `linked_legislation` (26 clausole ISO, nessuna migrazione: colonna già esistente), connettore `normativaConnector.getClauseText` implementato (riattiva step publicLaw del broker già presente su main). Seed `backend/data/legislation_seed.json`, script idempotente `backend/scripts/ingest-legislation-normattiva-vps.js`. L1 backend 29/29 su VPS. Branch `feat/legislation-ingest-normattiva` (PR). **Limite noto**: Normattiva serve il testo via JS (no scraping statico) → harvest one-time con headless browser; live `getClauseText` degrada a null senza inventare. I brief sotto restano **aperti e invariati**.
>
> **Nota sessione 18/07/2026 — SAL Fase 5-A CHIUSA (Lead, autonoma):** suggeritore stato AI per clausola SAL dalle evidenze collegate (human-in-the-loop). Backend `salAiSuggest.service.js` + `POST /companies/:id/gap-ai-suggest` (gate `ai_norms`+`sal`), FE pulsante «Suggerisci stato (AI)» riga+bulk + `SalAiSuggestDialog`. L1: backend 14/14, Vitest 10/10, build Vite OK, encoding OK. Branch `feat/sal-ai-suggest-fase5a` (PR). Il brief PR2 qui sotto resta **aperto e invariato**.

---

# DEPUTYTASK — PR2 Controparti nel Riesame Requisiti (§8.2)

> **Creato**: 07/07/2026  
> **Stato**: APERTO — pronto per deputy  
> **Nota**: Sessione 08/07/2026 — hotfix companies (PR #237 mergiata): delete FK + lista limit. Questo task rimane aperto per deputy.  
> **Priorità**: P1 (dopo chiusura ingest norme #223–#224)  
> **Contesto**: revisione stato moduli Riesame + SAL — vedi sintesi Lead in chat 07/07/2026

---

## Obiettivo

Sostituire i campi testo libero **Committente** / **Rif. committente** in `ContractReviewPage` con un **select controparti** collegato ad `company_counterparties` (ruolo `customer`), usando la FK `commercial_cases.commercial_customer_id` già presente in DB e API.

**Perché ora:** PR1 controparti ✅ (mig. 096–097, tab in scheda azienda, sync backend). L'UI riesame usa ancora solo `commercial_customer_name` / `commercial_customer_ref` testuali → rischio disallineamento e doppia digitazione (es. pilota LM&CO / PT.MAIDO).

---

## Riferimenti obbligatori (leggere prima)

1. `docs/specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md`
2. `docs/GUIDA_CONSOLIDATA.md` — lezione «Controparti azienda ↔ riesame commerciale»
3. `backend/src/services/commercialCustomerCounterparty.service.js`
4. `app/src/components/CompanyCounterpartiesPanel.jsx` (pattern UI esistente)
5. `docs/PROJECT_ROADMAP.md` — riga «Controparti azienda (PR1 ✅)»

---

## Scope (cosa fare)

| # | Task | Dettaglio |
|---|------|-----------|
| 1 | API lista controparti per azienda caso | Riusare `GET /companies/:id/counterparties?role=customer` (o endpoint nested esistente). Verificare filtro `role=customer`. |
| 2 | Form creazione caso | Select «Committente» popolato dalle controparti dell'azienda SGQ (`company_id` del caso). Opzione «Altro (testo libero)» solo se nessuna controparte o override esplicito. |
| 3 | Form modifica caso | Stesso select; pre-selezionare da `commercial_customer_id` se valorizzato, altrimenti match per nome su snapshot legacy. |
| 4 | Payload API | Inviare `commercial_customer_id` su create/update; il backend sincronizza già snapshot name/ref via `commercialCustomerCounterparty.service`. |
| 5 | Visualizzazione lista/dettaglio | Mostrare nome controparte da FK; badge se solo snapshot legacy (senza FK). |
| 6 | Test L1 | Vitest mirato su form create/edit + payload; Jest su `updateCase` con `commercial_customer_id` (estendere test esistenti in `contractReview.controller.test.js`). |
| 7 | Build | `npm run build` in `app/` |

**Fuori scope:** PT.MAIDO multi-livello (cliente del cliente), RAG capitolato, nuove migrazioni DB (schema già pronto).

---

## File probabili

- `app/src/pages/ContractReviewPage.jsx`
- `app/src/services/apiService.js` (se manca helper controparti lato FE)
- `backend/src/controllers/contractReview.controller.js` (solo se gap su create)
- `app/src/tests/contractReview*.test.jsx` (nuovo o esteso)

---

## Checkpoint

### Agente (obbligatori prima di PR)

- [ ] Test L1 verdi (Vitest + Jest mirati)
- [ ] Build Vite OK
- [ ] Nessun `console.log` di debug
- [ ] PR draft su branch `cursor/riesame-pr2-counterparty-select-5580`

### Committente (smoke L3 — 5 min)

- [ ] Aprire caso riesame esistente LM&CO: committente selezionabile da elenco controparti
- [ ] Creare nuovo caso: scegliere controparte → salva → nome/ref coerenti in dettaglio
- [ ] Hard refresh: `commercial_customer_id` persistito
- [ ] Analisi AI capitolato: nessun errore console (contesto committente invariato)

---

## Deploy

- **Frontend:** merge su `main` → Netlify automatico
- **Backend:** solo se tocchi controller — `deploy-controllers-to-vps.ps1` + verifica PID
- **DB:** nessuna migrazione prevista

---

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

## Note parallele (non in questo task)

| Voce | Stato | Azione suggerita |
|------|--------|------------------|
| SAL Fasi 0–4 | ✅ in `main` | Smoke L3: seed matrice → cambio stato → widget Riesame §9.3 con `norm_coverage_source=sal` |
| Mig. 117–118 VPS | Da verificare | Se `/sal` o NC `sal_gap` falliscono: `run-migration-117-vps.js` + `118-vps.js` |
| Riesame Direzione Slice 4 (KPI §9.1) | ⏸️ parcheggiata | Richiede modulo §9.1 strutturato — backlog roadmap |
| SAL Fase 5 (AI suggerimenti stato) | Opzionale | Dopo smoke Fase 4 stabile |
| Ingest commesse slice 4 (batch in caso) | ⏳ backlog | Task separato post-PR2 |
