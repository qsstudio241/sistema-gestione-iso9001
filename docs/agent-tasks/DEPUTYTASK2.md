# DEPUTYTASK2 — Second Brain SB-1: snapshot fatti per Ambito (zero LLM)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 16/08/2026 (Lead wayfinder — Chart the map Second Brain)  
**Chiuso:** 16/08/2026 — SB-1 implementata (dopo deputy FIX NON APPLICABILI: brief non era su `main`)  
**Mergiata:** [PR #440](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/440) il 16/08/2026 (committente)  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md)  
**Spec / ADR:** [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) · `aiCompanyScope.service.js`  
**Rischio:** Medio — PR + gate Bugbot; **non** push su `main`; **non** toccare `DEPUTYTASK.md` (SAL S1a)

> **Allineamento Git (autonomo)**: `git fetch origin main` e partire da `origin/main` aggiornato. Non chiedere al committente.

---

## Slice unica di questa sessione: SB-1

**Obiettivo**: un GET che, dato l’Ambito azienda, restituisce tre conteggi **vivi dal DB** (non dal RAG). Una card in Assistente AI li mostra. **Nessuna chiamata LLM.**

Questo è il «hello world» del second brain: il sistema *mostra* i fatti dell’azienda, prima di *parlarne*.

### Contesto (non riscrivere)

- Chat già esiste: `POST /ai/chat`, pagina `AiAssistantPage.jsx`, licenza `ai_chat`
- Scope già esiste: `resolveAiCompanyScope` (cliente forzato sulla sua azienda; studio può passare `companyId`)
- Conteggio già esistono in moduli sparsi (`getNcStats`, `getQualificationStats`, `getDocumentStats`) — **non** fare N round-trip dal frontend; un service unico lato server
- Ambito UI: `CompanyScopeContext` / `resolveAppCompanyScope` — la card legge lo stesso Ambito dell’header

### DoD

1. Service puro `backend/src/services/ambitoFacts.service.js`:
   - input: `user` + `companyId` già risolto (o null)
   - se `companyId` assente → `{ ready: false, reason: 'seleziona_azienda', counts: null }` (niente query cross-cliente in SB-1)
   - se presente → `{ ready: true, companyId, companyName, counts: { ncOpen, qualsExpiring30, docsExpiring30 }, generatedAt }`
   - query scoped `organization_id` / `auditor_org_id` + `company_id`; riusare le **stesse regole di «aperta» / «in scadenza 30gg»** già usate dalle card Qualifiche / NC / Scadenze (non inventare un terzo semaforo)
2. `GET /ai/ambito-facts?companyId=` su `aiChat.routes.js`: `authenticate` + `requireLicensedModule('ai_chat')` + `resolveAiCompanyScope` (403 se studio fuori ambito). **Non** `logAiInteraction` (non è una chiamata AI)
3. Frontend: `apiService.getAmbitoFacts` + card in cima a `AiAssistantPage` (classi `.sq-stat` / pattern Qualifiche — **non** CSS nuovo, **non** pagina nuova). Se `ready: false` → testo «Seleziona un’azienda nell’Ambito» (azioni visibili, non smontate)
4. Test L1:
   - service: azienda A vs B (stesso org) → conteggi isolati; `companyId` null → `ready: false`
   - controller: 403 scope negato (stesso pattern di `aiChat.controller.test.js`)
   - UI: card mostra i tre numeri da mock API
5. `deploy-manifest.json` aggiornato se si aggiunge il `.js` service
6. Zero segreti; encoding UTF-8; accenti italiani corretti

### Cosa NON toccare

- `DEPUTYTASK.md`, `documentTextExtractor`, OCR, SAL
- `POST /ai/chat` / system prompt (è **SB-3**)
- Vista «Tutto lo studio» aggregata (è **SB-4**)
- JWT, sync, migrazioni SQL, nuove tabelle, nuova licenza
- Knowledge indexer / reindex
- Home page

### Come verificare

```bash
cd backend && node --test src/services/ambitoFacts.service.test.js src/controllers/aiChat.controller.test.js
cd app && NODE_ENV=test npm run test:run
cd app && npm run build
```

(Adatta i path d’ingresso test a come è lanciata la suite backend nel repo — non inventare un runner nuovo.)

### Esito

- Service `ambitoFacts.service.js` + GET `/ai/ambito-facts` (licenza `ai_chat`, no `logAiInteraction`)
- Card `AmbitoFactsBar` in `AiAssistantPage` (classi `.sq-stat`)
- Jest: ambitoFacts + getAmbitoFacts 15 verdi; Vitest AmbitoFactsBar 2 verdi
- Deputy precedente: **FIX NON APPLICABILI** (su `main` c’era ancora il brief licenze CHIUSO). Lezione: brief APERTO deve essere su `origin/main` prima di lanciare il deputy.

Prossima slice: **SB-2** (Ambito header = unico input). Non aperta in questo brief.
