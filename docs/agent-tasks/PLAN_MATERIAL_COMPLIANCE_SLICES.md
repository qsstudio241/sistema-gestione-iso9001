# Piano slice — Material Compliance AI

> **Destinazione (ingest)**: da PDF reali (3.1, DDT scansionato, busta con più mill) si arriva a righe in Materiali con DDT / colata / norma compilati, **Valuta** che gira, HITL che decide. L’agente impara dalle correzioni con lo **stesso anello ADR-017** di qualifiche/WPQR. Nessun secondo motore OCR.  
> **Spec**: [`MODULO_MATERIAL_COMPLIANCE_AI.md`](../specs/MODULO_MATERIAL_COMPLIANCE_AI.md)  
> **ADR**: 020–024 · apprendimento ingest: [ADR-017](../adr/ADR-017-ingest-reference-network.md)  
> **Brief ingest attivo**: [`DEPUTYTASK_MC_INGEST.md`](DEPUTYTASK_MC_INGEST.md) — **MC-I3 CHIUSO** (PR [#488](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/488)). Prossima: **MC-I4**.  
> **Brief SAL**: [`DEPUTYTASK.md`](DEPUTYTASK.md) **CHIUSO** su S1a ([#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471)) — **non sovrascriverlo**  
> **Brief fondazione (MC-0)**: [`DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md`](DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md)  
> **Spec tecniche MC-0**: [`MATERIAL_COMPLIANCE_DATA_MODEL.md`](../specs/MATERIAL_COMPLIANCE_DATA_MODEL.md) · [`MATERIAL_COMPLIANCE_UI.md`](../specs/MATERIAL_COMPLIANCE_UI.md) · [`MATERIAL_COMPLIANCE_API.md`](../specs/MATERIAL_COMPLIANCE_API.md)  
> **Ponte 3834**: §11–13 del [PLAN_3834_SLICES.md](PLAN_3834_SLICES.md) — niente CRUD consumabili; **questa chat non apre ISO-4**  
> **Branch base**: `main`  
> **Migrazioni**: numerazione condivisa da `database/migrations/` — MC-1 = **149** (`149_material_certificates.sql` + `run-migration-149-vps.js`).

---

## Si può fare?

**Sì, a slice verticali.** Non in un unico commit.  
**HITL 16/08/2026 (committente):** i certificati sono di solito **scansioni**; l’agente deve estrarre i valori e imparare dalle correzioni. Il modello ingest qualifiche/WPQR (schema → revisione umana → commit → feedback) è **valido e da riusare**, non da rifare. OCR: riusare `ocrExtractor` / `documentTextExtractor` (SAL S1a lo sta collegando) — **non** un secondo motore.

**Fonti Markdown — dichiarare poi partire (HITL 16/08, seguito):** inventario in [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md). Prima di ogni slice MC-2/MC-3/ISO-3: 3 righe (coperte / mancanti / si parte su). Tubi: EN 10210-1 (hot) e EN 10219-1 (cold) presenti dal 17/08. Norme prodotto apporto oltre ISO 14341: tracciare; **non** si inventano soglie.

**Norme e campi da estrarre:** consegnate 16–17/08/2026 (EN 10204, EN 10168, ISO 10474, ISO 404, ISO 6929, facsimile MTC, EN 10025-2, EN 10210-1, EN 10219-1). Markdown in `docs/Normative/` NORMA_00020–00028 + KB `knowledge/material-compliance/`. Dizionario campi = EN 10168. Soglie lamiere/profili: [`EN-10025-2-acciai-strutturali.md`](../reference/EN-10025-2-acciai-strutturali.md). Hollow: [`EN-10210-1-sezioni-cave.md`](../reference/EN-10210-1-sezioni-cave.md) / [`EN-10219-1-sezioni-cave.md`](../reference/EN-10219-1-sezioni-cave.md) se citata la norma. Sintesi: [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md).

**Conformità = norma + documenti di origine esterna pertinenti (HITL 16/08, sì):** l’agente **non** valuta il 3.1 solo contro la norma materiale. Applica la gerarchia [ADR-021](../adr/ADR-021-material-requirements-hierarchy.md) in base all’**Ambito** (azienda) e, se c’è, a DDT/ordine/cliente/commessa. Un livello assente nello scope = `skip`, non un fail. I Markdown KB copriranno `standards/` **e** (quando il committente li consegna) `customers/` + `companies/<slug>/`. Il certificato è la **prova**; i requisiti stanno sempre in documenti esterni al certificato (norma, ordine, specifica cliente, criteri azienda).

Fondazione chiusa: **MC-0 → MC-1 → MC-2 → MC-3 → MC-4 → MC-5**.  
Resto ingest (questa mappa): **MC-I0 → MC-I1 → MC-B → MC-I2 → MC-I3 → MC-I4 → MC-7**.  
MC-6 (licenza dedicata) resta in mappa ma **non** è ingest. MC-B (OCR) **non** è più post-MVP: senza testo i DDT scansionati non si leggono — **dopo** MC-I0, e **dopo** SAL S1a se l’OCR manca ancora in `documentTextExtractor`. MC-7 è **obbligatoria** in mappa, **non** la prima slice.

### Decisione 18/08/2026 (prova PDF reali su ADA)

L’ingest certificati **non sta in una chat 3834** né in un unico deputy: PDF reali arrivano come busta+più mill, DDT scansionato, 3.1 filo, testo mill specchiato. Skill addestrata sul riuso ingest qualifiche/WPQR. **Non** un secondo motore OCR. **Non** fine-tuning.

Prova ADA (produzione, record **3–5**, azienda **179**): fatti già noti, non riscoprirli.

| Fatto | Esito |
|-------|--------|
| Upload | OK |
| Click riga → dettaglio | OK (router `/sal` prefisso `/saldatura` — [PR #461](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/461)) |
| Valuta su stato `extracted` | **409** — lock ottimista `updated_at` (confermato in codice 18/08: `EVALUABLE` include già `extracted`; il 409 non è il gate di stato) |
| 3.1 Tecnovespa | Estrai parziale — manca colata `12174/2026` |
| `Certificati_26DDT06266.pdf` | Busta + più mill, testo specchiato, JSON quasi vuoto |
| DDT `000775RE` | Scan senza text layer → `ocr_skipped` (`pdf_no_text_layer` mappato così) |
| Ruolo in UI | Upload forza sempre `materialRole: "base"` |
| Cardinalità | Un PDF può essere N certificati; DDT ≠ 3.1 |

Linea 3834 **non** continua l’ingest: ISO-4 (Word RDP) resta sull’altro PLAN. Ingest = questo PLAN + brief [`DEPUTYTASK_MC_INGEST.md`](DEPUTYTASK_MC_INGEST.md).

---

## Fuori scope (MVP ingest + MVP-A)

- ISO-4 / ponti 3834 / Welding Book CRUD consumabili
- SAL S1a (OCR nel suggeritore) — brief [`DEPUTYTASK.md`](DEPUTYTASK.md); l’ingest **riusa** l’estrattore, non lo duplica
- Secondo motore OCR, cloud OCR, fine-tuning, nuovo `lessons/` parallelo ad ADR-017
- Dashboard KPI / editor KB in UI
- PPAP, verniciatura, scorecard fornitore
- Nuova chiave licenza dedicata (MC-6: seam resta `saldatura` + `ai_import`)
- Registro PWHT / trattamenti come primo certificato (dopo 3.1 stabile)
- Overlay PO/cliente/azienda in `evaluate` (`scope: {}` oggi) — ADR-021, slice dopo ingest base
- Seed soglie apporto: Markdown ancora mancante → `skip`, non inventare numeri

---

## Non ancora specificato (nebbia in-scope)

- Come spezzare un PDF-busta in N righe: split pagine vs split per colata vs HITL «crea riga da questa pagina» — si decide in **MC-I4**, non prima
- Preprocessing testo specchiato (26DDT06266) vs basta OCR + prompt: dipende da MC-B / MC-I2
- Commit riga certificato nel Document Registry (era accorpato a MC-7): l’apprendimento è ADR-017; il registry è un ponte successivo
- S1a mergiata [#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471): `extractDocumentText` ha già l’OCR. MC-B riusa quello — non copiare `ocrExtractor` nel controller MC

---

## Decisioni già prese

- MC-0…MC-5 consegnate (spec, mig. **149**, KB, Rule Engine, API, UI). `compliant` solo HITL.
- Apprendimento continuo = **stesso anello** di WPQR/qualifiche: `recordFeedback` → `import_extraction_feedback` → few-shot in `extractStructuredByDocType` ([ADR-017](../adr/ADR-017-ingest-reference-network.md) livello C). Extract MC passa già `organizationId`. Manca il **produce** (PATCH/approve MC non chiama `recordFeedback`).
- OCR: riuso `documentTextExtractor` / `ocrExtractor` già in repo. `mapTextReason` oggi traduce `pdf_no_text_layer` → `ocr_skipped`.
- UI elenco: Base e apporto nella stessa griglia (`material_role`). Colonne DDT/colata/norma chiuse (HITL 16/08).
- Prova ADA 18/08: tabella sopra. Prima slice eseguibile confermata dal codice: **MC-I0** (Valuta 409).

## Griglia elenco (HITL 16/08 — committente, **confermata**)

**Sì**: una tab/pagina elenco (copia `QualificationsPage` + `SgqDataGrid`, non un look nuovo) con **riferimento al DDT** e anagrafica materiale. Un DDT può avere più righe/certificati. **Base e apporto nella stessa griglia** (`material_role`). Colonne sotto **chiuse** (16/08 + ruolo apporto 16/08).

### Colonne in griglia (MVP)

| Colonna | Perché |
|---------|--------|
| N. DDT | Ponte arrivo merce ↔ certificato (rintracciabilità §12/§17) |
| Data DDT | Ordine cronologico in accettazione |
| N. certificato | Identificativo del PDF (2.1–3.2) |
| Ruolo | Base (lamiera/profilo/tubo) o Apporto (filo/elettrodo/flusso) — ISO 3834 §11 e §12 |
| Materiale (designazione) | Anagrafica: S355J2 **oppure** `G 42 4 M21 3Si1` |
| Colata / lotto | Chiave rintracciabilità: colata in officina; lotto/batch sul consumabile |
| Forma | Piastra / tubo / profilo / lamiera **o** filo / elettrodo / flusso |
| Dimensioni | Spessore e/o Ø e/o lunghezza (una cella compatta) |
| Norma | EN 10025-2, ISO 14341, … |
| Fornitore / acciaieria | Chi ha emesso il certificato |
| Esito | In revisione / conforme / non conforme |

### Non in griglia (solo scheda dettaglio, al click)

Analisi chimica, prove meccaniche (ReH, Rm, A%, KV), CEV, trattamento termico, quantità/peso, PDF, note operatore. **Commessa** = ponte dopo (come NC↔commessa), non colonna obbligatoria del primo elenco.

MC-0/MC-1/MC-5 devono prevedere questi campi (DDT era assente dalla lista spec del 05/08).

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **MC-0** | Spec tecniche | DATA_MODEL / UI / API md | — | AFK (chiusa) |
| **MC-1** | Schema DB | mig. **149** | MC-0 | AFK (chiusa) |
| **MC-2** | KB seed + loader | `knowledge/material-compliance/**` | MC-0 + HITL norme | AFK (chiusa) |
| **MC-3** | Rule Engine | service puro + test L1 | MC-2 | AFK (chiusa) |
| **MC-4** | API | `materialCertificates.controller.js` | MC-1, MC-3 | AFK (chiusa) |
| **MC-5** | UI MVP | `MaterialCertificatesPage.jsx` | MC-4 | AFK (chiusa) |
| **MC-I0** | Valuta 409 (lock `updated_at`) | controller + test evaluate | MC-4/5 | AFK (chiusa, [#463](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/463)) |
| **MC-I1** | Ruolo Base/Apporto in upload | UI upload + default `base` hardcoded | MC-I0 | AFK (chiusa, [#473](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/473)) |
| **MC-B** | OCR scan (riuso estrattore, non un secondo motore) | `extractCertificate` + `mapTextReason`; **non** nuovo OCR | MC-I0, SAL **S1a** | AFK (chiusa, [#476](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/476)) |
| **MC-I2** | 3.1 singolo: colata / DDT / norma | schema `material_certificate` + mapping anagrafica | MC-I0 | AFK (chiusa, [#481](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/481)) |
| **MC-I3** | DDT ≠ 3.1 (classifica tipo) | extract + UI: DDT non è un mill | MC-I2, MC-B | AFK (chiusa, [#488](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/488)) |
| **MC-I4** | 1 PDF → N certificati (busta mill) | split/HITL; 26DDT06266 | MC-I2, MC-I3 | AFK (nebbia split: vedi sopra) |
| **MC-7** | Feedback ADR-017 (recordFeedback → few-shot) | PATCH/approve MC → `ingestFeedback.service` | MC-I2 (c’è qualcosa da correggere) | AFK |
| **MC-6** | Licenza + audit AI | seam + `logAiInteraction` | MC-4/5 | AFK — **non ingest** |

---

## MC-0 — Fondazione spec (solo doc)

### Scope

Creare (senza codice applicativo):

1. `docs/specs/MATERIAL_COMPLIANCE_DATA_MODEL.md` — tabelle, FK, indici, stati, mapping documenti  
2. `docs/specs/MATERIAL_COMPLIANCE_UI.md` — route, pagine, componenti riusati, menu MVP  
3. `docs/specs/MATERIAL_COMPLIANCE_API.md` — endpoint, payload, errori, gate licenza  

Aggiornare questa mappa se emergono vincoli nuovi.

### DoD

- [x] Tre file spec presenti, UTF-8, linkati dalla MODULO ([DATA_MODEL](../specs/MATERIAL_COMPLIANCE_DATA_MODEL.md), [UI](../specs/MATERIAL_COMPLIANCE_UI.md), [API](../specs/MATERIAL_COMPLIANCE_API.md))
- [x] Entità minime definite: certificato (con **n. DDT** + data DDT + **`material_role` base\|filler**), check_result, snapshot hash KB (JSON sulla riga, non terza tabella MVP)
- [x] Nessun hardcode cliente; path KB come ADR-023
- [x] OCR: in MVP (MC-B dopo extract), riuso estrattore esistente — non «fuori scope»

### Test L1

Encoding / link interni; nessun test app.

---

## MC-1 — Migration DB

### Scope

- SQL idempotente in `database/migrations/` (**149**)
- Script `backend/scripts/run-migration-149-vps.js` (prod; `SGQ_MIGRATION_TARGET=test` per DB test)
- Colonne: `organization_id`, `company_id` NOT NULL, stati ADR-024 (incluso `ocr_running` per MC-B), riferimenti file/job, JSON extract/result, hash KB, audit utente

### DoD

- [x] SQL + script VPS in repo (L1 statico)
- [x] Migration applicata su VPS TEST (idempotente) e PROD (16/08/2026)
- [x] Indici `(organization_id, company_id)`, stato, ruolo, DDT
- [x] Nessun `ON DELETE CASCADE` fragile: CASCADE solo `checks` → certificato; job/registry/commessa = `SET NULL`; `import_job_file_id` **senza FK** (SQL Server: due cascade path; Bugbot PR #450)

### Test L1

Script/migrazione idempotente; eventuale test service smoke.

---

## MC-2 — KB seed + loader

### Scope

- Seed `knowledge/material-compliance/dictionary/` + `standards/EN10204` + `standards/EN10025-2`
- Loader che restituisce snapshot + hash
- Opzionale: 1 customer + 1 `companies/<slug>` di pilota (contenuti reali da product owner)

### DoD

- [x] Dichiarazione fonti Markdown in PR/chat (coperte / mancanti / si parte su) — inventario sintesi
- [x] Seed solo da Markdown presente (EN 10025-2 lamiere/profili; EN 10210-1 hollow a caldo se citata; EN 10219-1 hollow a freddo se citata)
- [x] Loader testabile senza rete (`materialKbLoader.service.js`)
- [x] Hash stabile a parità di file (SHA-256); copia `backend/data/material-compliance/` allineata

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

- [x] Casi L1: conforme / non conforme / skip campo mancante
- [x] Più restrittivo vince (esempio ADR-021)

### Test L1

Jest backend su fixture JSON (`materialComplianceRuleEngine.service.test.js`). Persistenza `evaluate_result_json` / righe checks = **MC-4**.

---

## MC-4 — API

### Scope

- Lista / dettaglio / create-from-upload (o aggancio `import_jobs`)
- `POST .../extract` (riuso `importAiExtraction` + `aiProviderAdapter`)
- `POST .../evaluate` (Rule Engine)
- Scope company + `organization_id` da `req.user`
- Aggiornare `deploy-manifest.json` per nuovi file BE

### DoD

- [x] 401/403 corretti senza licenza / senza accesso azienda
- [x] Extract e evaluate tracciati
- [x] Nessun auto-passaggio a `compliant`

### Test L1

Test controller/service con mock DB (`materialCertificates.controller.test.js`). Persistenza `evaluate_result_json` / righe checks = questa slice.

---

## MC-5 — UI MVP

### Scope

- Route sotto sidebar Material Compliance
- Elenco + dettaglio a 3 pannelli (PDF / testo / esito)
- Azioni: correggi campo, ri-valuta, approva, respingi
- Riuso CSS/`AiDisclaimer`; desktop-first

### DoD

- [x] Build Vite OK
- [x] Gate `ModuleLocked` se capability OFF
- [x] Nessuna approvazione senza click esplicito

### Test L1

`NODE_ENV=test npm run test:run` mirato + `npm run build` in `app/`.

---

## MC-6 — Licenza, audit AI, chiusura MVP-A

**Non è ingest.** Non aprire da `DEPUTYTASK_MC_INGEST.md`.

### Scope

- Seam `MATERIAL_COMPLIANCE` in `moduleLicense.service.js`
- `logAiInteraction` su extract
- `AiDisclaimer` in UI
- Aggiornare MODULO tabella stati + riga roadmap/GUIDA

### DoD

- [ ] Capability OFF → API 403 + UI locked
- [ ] Doc allineata; PR mergiabile

---

## Track ingest (dopo MC-5)

### MC-I0 — Valuta 409 (hello world)

**Brief:** [`DEPUTYTASK_MC_INGEST.md`](DEPUTYTASK_MC_INGEST.md) — **CHIUSO**. Mergiata [#463](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/463). Deploy TEST+PROD. Smoke PROD azienda 179: id 4 `extracted` → `pending_review` 200.

Causa: `EVALUABLE` include `extracted`; il 409 era `AND updated_at = @updated_at` (`DATETIME2` vs Date JS). Fix: lock solo su `workflow_status` in transazione.

Prossima ingest dopo I1: **MC-B** (OCR scan; S1a già in `main`, PR [#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471)).

### MC-I1 — Ruolo Base / Apporto in upload

**CHIUSO** — brief [`DEPUTYTASK_MC_INGEST.md`](DEPUTYTASK_MC_INGEST.md). PR [#473](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/473). L1 5/5 + build.

Header: radiogroup Base/Apporto (default Base), distinto dai filtri KPI. Upload Apporto → `materialRole: "filler"`.

Prossima ingest: **MC-B** (OCR scan; S1a già in `main`, PR [#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471)).

### MC-B — OCR su scan (riuso, non un secondo motore)

**CHIUSO** — brief [`DEPUTYTASK_MC_INGEST.md`](DEPUTYTASK_MC_INGEST.md). PR [#476](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/476). L1 47/47.

OCR ok → `ocr_ok`. `ocr_unavailable` / `ocr_failed` non diventano `ocr_skipped`. Skipped = formato non PDF. Nessun secondo motore.

Prossima ingest: **MC-I2** (3.1 singolo: colata / DDT / norma).

### MC-I2 — 3.1 singolo: colata / DDT / norma

**CHIUSO** — brief [`DEPUTYTASK_MC_INGEST.md`](DEPUTYTASK_MC_INGEST.md). PR [#481](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/481). L1 34/34. Deploy TEST PID `993561`→`1019412`, PROD `1005497`→`1031291`. Smoke PROD id 6 → `heat_or_lot_no=12174/2026`.

Causa: `applyAnagraficaFromJson` leggeva solo `heat_or_lot_no`; l’AI spesso restituisce `heat_number` / `colata` / `B07`. `ddt_no` non andava in colonna; A07 non è un DDT.

Fix: `canonicalizeExtractedJson` + persist `ddt_no`/`ddt_date` in extract; fallback etichettato sul testo; prompt BE+FE. Un PDF → **una** riga. Niente split.

Prossima ingest: **MC-I3** (DDT ≠ 3.1).

### MC-I3 — DDT ≠ 3.1

Un DDT non è un certificato 3.1. Non estrarre colata/mill dal DDT come se fosse EN 10168.

**Chiusa 19/08/2026** — PR [#488](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/488). Filename `D.D.T.`/`bolla` → `document_kind=delivery_note` (vince sull’AI); `CERTIFICATO`/`3.1` nel nome resta mill. Sanitize campi mill a NULL + SQL `SET` (re-extract non lascia la colata sbagliata). Valuta 409 `NOT_A_CERTIFICATE`; pulsante Valuta visibile, `disabled` + title. Un PDF → una riga. Niente split.

Demoable: Estrai su `D.D.T._n._000775RE_…pdf` → n. DDT in colonna, JSON mill vuoto.

Prossima ingest: **MC-I4** (1 PDF → N mill).

### MC-I4 — 1 PDF → N certificati (busta)

`Certificati_26DDT06266.pdf`: busta + più mill, testo specchiato, JSON quasi vuoto. Nebbia: come spezzare (pagine / colate / HITL). Si decide **in questa slice**, non prima.

Demoable: un upload → N righe in Materiali (o HITL esplicito «crea riga»), ciascuna con colata propria.

### MC-7 — Apprendimento ADR-017 (obbligatoria, non prima)

Stesso anello di WPQR/qualifiche. **Niente** secondo store `lessons/`, niente fine-tuning.

```
HITL corregge (PATCH) o accetta
  → recordFeedback (ingestFeedback.service)
  → import_extraction_feedback
  → buildIngestLearningPromptSection
  → extractStructuredByDocType (già riceve organizationId)
```

Demoable: correggi colata sul 3.1 → secondo Estrai sullo stesso tipo/org usa il few-shot (campo corretto, non PII vietata da ADR-017 livello B).

Registry documenti: **nebbia** (ponte dopo).

---

## Checklist verifica (per il Lead / committente)

Usare dopo ogni PR di slice:

| Check | MC-0 | MC-1 | MC-2 | MC-3 | MC-4 | MC-5 | MC-I0 | MC-I1 |
|-------|------|------|------|------|------|------|-------|--------|
| Spec / ADR rispettati | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ |
| Multi-tenant / company scope | — | ☑ | — | — | ☑ | ☑ | ☑ | ☑ |
| AI ≠ approvazione | — | — | — | ☑ | ☑ | ☑ | ☑ | — |
| Test L1 / build | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ |
| Deploy manifest (se nuovi `.js` BE) | — | — | ☑ | ☑ | ☑ | — | — | — |
| Doc roadmap aggiornata | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ |
