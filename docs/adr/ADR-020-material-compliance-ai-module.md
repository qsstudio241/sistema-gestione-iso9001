# ADR-020 — Material Compliance AI (modulo certificati materia prima)

> **Stato**: Proposto — fondazione documentale 05/08/2026  
> **Autori**: Lead architect (AI), Product owner  
> **Spec prodotto / roadmap**: [MODULO_MATERIAL_COMPLIANCE_AI.md](../specs/MODULO_MATERIAL_COMPLIANCE_AI.md)  
> **Piano slice**: [PLAN_MATERIAL_COMPLIANCE_SLICES.md](../agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md)  
> **Brief fondazione**: [DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md](../agent-tasks/DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md)  
> **Correlati**: ADR-010 (AI agentica), ADR-021 (gerarchia requisiti), ADR-022 (AI ≠ Rule Engine), ADR-023 (KB), ADR-024 (workflow), ADR-017 (ingest/learning)

---

## Contesto e problema

Le aziende metalmeccaniche (es. forniture EN 1090 / ISO 3834) ricevono molti **certificati EN 10204 3.1** e li verificano a mano contro norma materiale, ordine, requisiti cliente e criteri interni. Oggi la piattaforma SGQ ha ingest PDF, registro documenti e AI adapter, ma **non** un flusso dedicato a:

1. estrarre campi tecnici dal certificato;
2. confrontarli in modo **deterministico** con requisiti multi-livello;
3. far approvare l’esito a un operatore qualità con audit trail completo.

Serve un **modulo integrato**, non un’app separata.

---

## Decisione

### 1. Modulo nella piattaforma esistente

Nome prodotto: **Material Compliance AI**.  
Implementazione: route/UI/API/DB **dentro** `sistema-gestione-iso9001`, multi-tenant (`organization_id` + company scope).

### 2. Riuso obbligatorio (nessuna architettura parallela)

| Capacità | Dove già esiste (riuso) |
|----------|-------------------------|
| Ingest PDF / job | `documentIngestPipeline.service.js`, `import_jobs` / Sprint 9–10 |
| Estrazione testo PDF | `documentTextExtractor.service.js` + `importPdfText` (**senza OCR** oggi) |
| Estrazione AI strutturata | `importAiExtraction.service.js` + `aiProviderAdapter` |
| Audit trail AI | `logAiInteraction` / `ai_interactions` (ADR-010) |
| Registro documenti | Document Registry + commit umano da staging |
| RBAC / Ambito | `companyAccess.service.js`, pattern scheda azienda |
| Licenze | `moduleLicense.service.js` |

### 3. Gate licenza (MVP)

**Seam** `MATERIAL_COMPLIANCE` in `moduleLicense.service.js`, oggi mappato su **`saldatura` + `ai_import`** (stesso pattern di `SAL_LEGAL_CONFORMITY` → `ai_norms`).

- Capability OFF → UI nascosta / API 403; dati già salvati restano in DB.
- Scorporo futuro: chiave dedicata in `KNOWN_MODULE_KEYS` in 1–2 mosse, senza riscrivere il modulo.

### 4. OCR

MVP **A**: solo PDF con strato testo (pipeline attuale).  
MVP **B** (slice successiva): adapter OCR **configurabile** (env), dietro interfaccia unica — non hardcoded a un vendor nel codice di business.

### 5. Cosa produce il modulo

Flusso: PDF → testo/Markdown → JSON estratto (AI) → **Rule Engine** → stato workflow → revisione umana → archivio (link a Document Registry).

---

## Cosa NON fare

- Nuova app / nuovo DB / nuovo stack frontend.
- Far approvare la conformità dall’AI (vincolo ADR-022).
- Hardcodare clienti (`if (cliente === 'FASSI')`) — requisiti in KB (ADR-023).
- Bypassare `organization_id` / company scope.
- Introdurre OCR obbligatorio nel primo deploy se i PDF di prova hanno già testo.

---

## Conseguenze

| + | − |
|---|---|
| Riuso ingest/AI/RBAC già collaudati | Dipendenza da stabilizzazione Sprint 9–10 |
| Auditabilità ISO allineata ad ADR-010 | Rule Engine e KB da costruire ex novo |
| Gate licenza senza nuova chiave subito | OCR scansioni = slice dedicata |

---

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Over-scope UI (7 voci menu) | MVP: elenco + dettaglio + approvazione (vedi spec) |
| Allucinazione campi AI | Rule Engine + HITL obbligatorio; AI solo propone |
| Duplicazione con ingest generico | Stesso job/pipeline; tipo documento dedicato `material_certificate_3_1` |
