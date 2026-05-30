# DEPUTYTASK — Contesto AI multi-slice (L1–L4)

**Stato programma:** slice **0** verificata — 30/05/2026  
**Orchestratore:** piano 0–4; worker esegue una slice per sessione.

---

## Piano multi-slice

| Slice | Obiettivo | Perimetro | DoD |
|-------|-----------|-----------|-----|
| **0** | Fondazione verificata | L1 studio (`ai_context_notes`, mig. 066) + L2 azienda (`loadCompanyProfile`, chip chat) | Test L1 backend OK, build Vite OK, edge case documentati, mig. 066 eseguita o blocker tracciato |
| **1** | Livello 3 — norma/standard | `loadStandardProfile`, `standardId` in `/ai/chat`, filtro `searchKnowledge` per `standardCodes` | Test backend chat + smoke manuale selettore norma in `AiAssistantPage` |
| **2** | Propagazione contesto | `enrichSystemPromptWithOrganization` su tutti gli endpoint AI (`aiAssist`, contract review, ecc.) | Test mirati + UI settings allineata |
| **3** | Deploy produzione | Mig. 066 su VPS (pattern SCP + `node /tmp/run-migration-066.js`), deploy controller backend, restart + PID | Health API OK, `GET /organizations/me` restituisce `ai_context_notes`, smoke chat con note studio |
| **4** | Documentazione e chiusura | `GUIDA_CONSOLIDATA.md` sezione contesto AI, roadmap AI-CTX-L1, PR merge | Guida aggiornata, slice programma chiuso |

---

## Slice 0 — Esito (30/05/2026)

### Checklist

| # | Voce | Esito |
|---|------|-------|
| 1 | Test `aiOrganizationContext.service.test.js` (7 → **13** test, edge case DB/colonna) | ✅ OK |
| 2 | Test `aiAssist.test.js` (mock enrich org context) | ✅ OK |
| 3 | Test `aiChat` dedicato | ⏭️ Non presente nel repo |
| 4 | Build Vite `app/` | ✅ OK (~26s) |
| 5 | Migrazione 066 locale | ❌ **BLOCKER** — `Login failed for user 'pascarella'` (`backend/config/database.json`) |
| 6 | Edge case org senza note | ✅ `buildOrganizationContextBlock` omette sezione note |
| 7 | Edge case `companyId` invalido/altra org | ✅ `loadCompanyProfile` filtra `auditor_org_id`; chat prosegue senza blocco azienda |
| 8 | Degradazione colonna `ai_context_notes` assente | ✅ AI: `loadOrganizationProfile` catch → prompt base; ⚠️ `GET/PATCH /organizations/me` restituisce 500 finché mig. 066 non applicata |

### Fix applicati (slice 0)

- Test difensivi aggiunti in `aiOrganizationContext.service.test.js`: orgId falsy, errore DB/colonna mancante, profilo assente, note whitespace-only.

### Blocker aperti

1. **Migrazione 066** — eseguire con credenziali DB valide:
   ```powershell
   cd backend; node scripts/run-migration-066.js
   ```
   Alternativa cloud agent: SCP script su VPS + `node /tmp/run-migration-066.js` (vedi `GUIDA_CONSOLIDATA` pattern migrazioni VPS).

2. **`database.json` locale** — utente `pascarella` rifiutato; aggiornare password o usare deploy VPS slice 3.

### File chiave slice 0

| File | Ruolo |
|------|--------|
| `backend/database/migrations/066_organization_ai_context_notes.sql` | Colonna `organizations.ai_context_notes` |
| `backend/src/services/aiOrganizationContext.service.js` | L1 — arricchimento system prompt studio |
| `backend/src/controllers/aiChat.controller.js` | L2 — `loadCompanyProfile` + knowledge filter |
| `backend/src/controllers/aiAssist.controller.js` | L1 via `enrichSystemPromptWithOrganization` |
| `backend/src/controllers/organization.controller.js` | CRUD note studio (admin) |
| `app/src/pages/StudioSettingsPage.jsx` | UI note contesto studio |
| `app/src/pages/AiAssistantPage.jsx` | Chip contesto azienda (+ norma slice 1) |

---

## Comando deputy — slice 1

```
Leggi docs/agent-tasks/DEPUTYTASK.md (sezione slice 1) e docs/GUIDA_CONSOLIDATA.md.
Implementa/verifica Livello 3 norma in /ai/chat e AiAssistantPage.
Chiudi con TEST OK o FIX NON APPLICABILI.
```

*Aggiornato 30/05/2026 — worker slice 0 contesto AI*
