# Piano slice — Material Compliance AI

> **Obiettivo**: portare il modulo da fondazione documentale a MVP usabile (PDF testo → estrazione → Rule Engine → HITL), riusando ingest/AI/RBAC esistenti.  
> **Spec**: [`MODULO_MATERIAL_COMPLIANCE_AI.md`](../specs/MODULO_MATERIAL_COMPLIANCE_AI.md)  
> **ADR**: 020–024  
> **Brief fondazione (MC-0)**: [`DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md`](DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md)  
> **Branch base**: `main`  
> **Migrazioni**: numerazione condivisa da `database/migrations/` — oggi ultimo ≥138; MC-1 userà il **prossimo libero** al momento dell’implementazione (non riservare numeri in anticipo se altre PR avanzano).

---

## Si può fare?

**Sì, a slice verticali.** Non in un unico commit.  
Ordine consigliato: **MC-0 → MC-1 → MC-2 → MC-3 → MC-4 → MC-5 → MC-6**.  
MC-B e MC-7 dopo feedback sul MVP-A.

### Fuori scope MVP-A

- OCR scansioni (MC-B)
- Dashboard KPI / editor KB in UI
- PPAP, verniciatura, scorecard fornitore
- Nuova chiave licenza dedicata (solo seam → `saldatura` + `ai_import`)

---

## Mappa slice

| Slice | Tema | Perimetro | Dipende da |
|-------|------|-----------|------------|
| **MC-0** | Spec tecniche | DATA_MODEL / UI / API md | — |
| **MC-1** | Schema DB | `database/migrations/NNN_*.sql` + `run-migration-NNN-vps.js` | MC-0 |
| **MC-2** | KB seed + loader | `knowledge/material-compliance/**` + service load | MC-0 |
| **MC-3** | Rule Engine | service puro + test L1 | MC-2 |
| **MC-4** | API | routes/controller/services; riuso extract | MC-1, MC-3 |
| **MC-5** | UI MVP | lista + dettaglio + azioni HITL | MC-4 |
| **MC-6** | Licenza + audit AI + disclaimer | seam + `logAiInteraction` + `AiDisclaimer` | MC-4/5 |
| **MC-B** | OCR adapter | provider configurabile | MC-4 |
| **MC-7** | Registry + lessons | commit documento + feedback | MC-5 |

---

## MC-0 — Fondazione spec (solo doc)

### Scope

Creare (senza codice applicativo):

1. `docs/specs/MATERIAL_COMPLIANCE_DATA_MODEL.md` — tabelle, FK, indici, stati, mapping documenti  
2. `docs/specs/MATERIAL_COMPLIANCE_UI.md` — route, pagine, componenti riusati, menu MVP  
3. `docs/specs/MATERIAL_COMPLIANCE_API.md` — endpoint, payload, errori, gate licenza  

Aggiornare questa mappa se emergono vincoli nuovi.

### DoD

- [ ] Tre file spec presenti, UTF-8, linkati dalla MODULO
- [ ] Entità minime definite: certificato, check_result, (opz.) requirement_snapshot
- [ ] Nessun hardcode cliente; path KB come ADR-023
- [ ] OCR esplicitamente **fuori** MVP-A

### Test L1

Encoding / link interni; nessun test app.

---

## MC-1 — Migration DB

### Scope

- SQL idempotente in `database/migrations/` (prossimo NNN libero)
- Script `backend/scripts/run-migration-NNN-vps.js` (pattern cloud VPS)
- Colonne: `organization_id`, `company_id`, stati ADR-024, riferimenti file/job, JSON extract/result, hash KB, audit utente

### DoD

- [ ] Migration applicata su VPS (o dry-run verificato)
- [ ] Indici `(organization_id, company_id)`, stato
- [ ] Nessun `ON DELETE CASCADE` fragile senza verifica SQL Server

### Test L1

Script/migrazione idempotente; eventuale test service smoke.

---

## MC-2 — KB seed + loader

### Scope

- Seed `knowledge/material-compliance/dictionary/` + `standards/EN10204` + `standards/EN10025-2`
- Loader che restituisce snapshot + hash
- Opzionale: 1 customer + 1 `companies/<slug>` di pilota (contenuti reali da product owner)

### DoD

- [ ] Loader testabile senza rete
- [ ] Hash stabile a parità di file

### Test L1

Unit test loader + parse limiti.

---

## MC-3 — Rule Engine

### Scope

- `materialComplianceRuleEngine.service.js` (nome indicativo)
- Input: JSON estratto + snapshot requisiti
- Output: `status` + `checks[]` (ADR-021)
- **Zero** chiamate LLM

### DoD

- [ ] Casi L1: conforme / non conforme / skip campo mancante
- [ ] Più restrittivo vince (esempio ADR-021)

### Test L1

Jest/Vitest backend su fixture JSON.

---

## MC-4 — API

### Scope

- Lista / dettaglio / create-from-upload (o aggancio `import_jobs`)
- `POST .../extract` (riuso `importAiExtraction` + `aiProviderAdapter`)
- `POST .../evaluate` (Rule Engine)
- Scope company + `organization_id` da `req.user`
- Aggiornare `deploy-manifest.json` per nuovi file BE

### DoD

- [ ] 401/403 corretti senza licenza / senza accesso azienda
- [ ] Extract e evaluate tracciati
- [ ] Nessun auto-passaggio a `compliant`

### Test L1

Test controller/service con mock DB se pattern esistente.

---

## MC-5 — UI MVP

### Scope

- Route sotto sidebar Material Compliance
- Elenco + dettaglio a 3 pannelli (PDF / testo / esito)
- Azioni: correggi campo, ri-valuta, approva, respingi
- Riuso CSS/`AiDisclaimer`; desktop-first

### DoD

- [ ] Build Vite OK
- [ ] Gate `ModuleLocked` se capability OFF
- [ ] Nessuna approvazione senza click esplicito

### Test L1

`NODE_ENV=test npm run test:run` mirato + `npm run build` in `app/`.

---

## MC-6 — Licenza, audit AI, chiusura MVP-A

### Scope

- Seam `MATERIAL_COMPLIANCE` in `moduleLicense.service.js`
- `logAiInteraction` su extract
- `AiDisclaimer` in UI
- Aggiornare MODULO tabella stati + riga roadmap/GUIDA

### DoD

- [ ] Capability OFF → API 403 + UI locked
- [ ] Doc allineata; PR mergiabile

---

## MC-B — OCR (post MVP-A)

Adapter dietro interfaccia unica; env per provider; fallback se testo già sufficiente.  
Non bloccare MC-1…6.

---

## MC-7 — Registry + lessons (post MVP-A)

Commit umano verso Document Registry; feedback correzioni → `lessons/` o pattern ADR-017.

---

## Checklist verifica (per il Lead / committente)

Usare dopo ogni PR di slice:

| Check | MC-0 | MC-1 | MC-2 | MC-3 | MC-4 | MC-5 | MC-6 |
|-------|------|------|------|------|------|------|------|
| Spec / ADR rispettati | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Multi-tenant / company scope | — | ☐ | — | — | ☐ | ☐ | ☐ |
| AI ≠ approvazione | — | — | — | ☐ | ☐ | ☐ | ☐ |
| Test L1 / build | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Deploy manifest (se nuovi `.js` BE) | — | — | ☐ | ☐ | ☐ | — | ☐ |
| Doc roadmap aggiornata | ☐ | — | — | — | — | — | ☐ |
