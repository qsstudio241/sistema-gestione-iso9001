# Piano slice — Material Compliance AI

> **Obiettivo**: portare il modulo da fondazione documentale a MVP usabile (scansione/PDF → estrazione → Rule Engine → HITL), riusando ingest qualifiche/WPQR + OCR.  
> **Spec**: [`MODULO_MATERIAL_COMPLIANCE_AI.md`](../specs/MODULO_MATERIAL_COMPLIANCE_AI.md)  
> **ADR**: 020–024  
> **Brief fondazione (MC-0)**: [`DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md`](DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md)  
> **Ponte 3834**: §11–13 del [PLAN_3834_SLICES.md](PLAN_3834_SLICES.md) — niente CRUD consumabili nel modulo saldatura  
> **Branch base**: `main`  
> **Migrazioni**: numerazione condivisa da `database/migrations/` — oggi ultimo ≥138; MC-1 userà il **prossimo libero** al momento dell’implementazione (non riservare numeri in anticipo se altre PR avanzano).

---

## Si può fare?

**Sì, a slice verticali.** Non in un unico commit.  
**HITL 16/08/2026 (committente):** i certificati sono di solito **scansioni**; l’agente deve estrarre i valori e imparare dalle correzioni. Il modello ingest qualifiche/WPQR (schema → revisione umana → commit → feedback) è **valido e da riusare**, non da rifare. OCR: riusare `ocrExtractor` / `documentTextExtractor` (SAL S1a lo sta collegando) — **non** un secondo motore.

**Norme e campi da estrarre (HITL 16/08, chiusura):** il committente **fornirà in seguito** le normative. Da quelle si fanno i Markdown in `knowledge/material-compliance/standards/` (e il dizionario campi). **Non** inventare schema di estrazione né seed di norma prima di quei file. L’agente specializzato (MC-0 in poi sul contenuto tecnico) parte **dopo** la consegna delle norme, non ora. La griglia elenco (DDT + anagrafica) resta valida come UI; i campi di laboratorio (chimica, ReH, CEV, …) li fissa la norma consegnata.

Ordine consigliato: **MC-0 → MC-1 → MC-2 → MC-3 → MC-4 → MC-B → MC-5 → MC-6 → MC-7**.  
MC-B (OCR) **non** è più post-MVP: senza testo i certificati reali non si leggono.

### Fuori scope MVP-A

- Dashboard KPI / editor KB in UI
- PPAP, verniciatura, scorecard fornitore
- Nuova chiave licenza dedicata (solo seam → `saldatura` + `ai_import`)
- Registro PWHT / trattamenti come primo certificato (dopo 3.1 stabile)

## Griglia elenco (HITL 16/08 — committente, **confermata**)

**Sì**: una tab/pagina elenco (copia `QualificationsPage` + `SgqDataGrid`, non un look nuovo) con **riferimento al DDT** e anagrafica materiale. Un DDT può avere più righe/certificati. Colonne sotto **chiuse** (16/08, «Sembra OK»).

### Colonne in griglia (MVP)

| Colonna | Perché |
|---------|--------|
| N. DDT | Ponte arrivo merce ↔ certificato (rintracciabilità §12/§17) |
| Data DDT | Ordine cronologico in accettazione |
| N. certificato 3.1 | Identificativo del PDF |
| Materiale (designazione) | Anagrafica (es. S355J2, S235JR) |
| Colata | Chiave di rintracciabilità in officina |
| Forma | Piastra / tubo / profilo / lamiera |
| Dimensioni | Spessore e/o Ø e/o lunghezza (una cella compatta) |
| Norma | EN 10025-2, EN 10219, … |
| Fornitore / acciaieria | Chi ha emesso il 3.1 |
| Esito | In revisione / conforme / non conforme |

### Non in griglia (solo scheda dettaglio, al click)

Analisi chimica, prove meccaniche (ReH, Rm, A%, KV), CEV, trattamento termico, quantità/peso, PDF, note operatore. **Commessa** = ponte dopo (come NC↔commessa), non colonna obbligatoria del primo elenco.

MC-0/MC-1/MC-5 devono prevedere questi campi (DDT era assente dalla lista spec del 05/08).

---

## Mappa slice

| Slice | Tema | Perimetro | Dipende da |
|-------|------|-----------|------------|
| **MC-0** | Spec tecniche | DATA_MODEL / UI / API md | — |
| **MC-1** | Schema DB | `database/migrations/NNN_*.sql` + `run-migration-NNN-vps.js` | MC-0 |
| **MC-2** | KB seed + loader | `knowledge/material-compliance/**` da **norme consegnate dal committente** (PDF → MD, skill `pdf-to-json`) + loader | MC-0 + HITL norme |
| **MC-3** | Rule Engine | service puro + test L1 | MC-2 |
| **MC-4** | API | routes/controller/services; riuso extract | MC-1, MC-3 |
| **MC-5** | UI MVP | lista + dettaglio + azioni HITL | MC-4 |
| **MC-6** | Licenza + audit AI + disclaimer | seam + `logAiInteraction` + `AiDisclaimer` | MC-4/5 |
| **MC-B** | OCR su scan (riuso `documentTextExtractor` / `ocrExtractor`, non un secondo motore) | MC-4 |
| **MC-7** | Registry + lessons (stesso anello feedback di qualifiche/WPQR) | MC-5 |

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
- [ ] Entità minime definite: certificato (con **n. DDT** + data DDT), check_result, (opz.) requirement_snapshot
- [ ] Nessun hardcode cliente; path KB come ADR-023
- [ ] OCR: in MVP (MC-B dopo extract), riuso estrattore esistente — non «fuori scope»

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
