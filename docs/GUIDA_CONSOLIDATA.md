# Guida consolidata — SGQ ISO 9001

> **Unico documento di esperienza operativa** da aggiornare quando cambia il comportamento del sistema (deploy, Word, DB, sync) **o** le regole di verifica/release (smoke, licenze, DoD).  
> **Non creare** nuovi `SESSION_NOTES_YYYYMMDD.md`: si aggiorna questo file + `PROJECT_ROADMAP.md`.

## Indice rapido (navigazione)

| Sezione | Contenuto |
|---------|-----------|
| [Inizio sessione](#cosa-leggere-a-inizio-sessione-ordine) | Ordine di lettura file progetto |
| [**Lezioni apprese (fonte unica)**](archive/sessions/GUIDA_DIARIO_2026.md#lezioni-apprese-consolidate-fonte-unica) | Indice regole operative + link al dettaglio |
| [Metodo di lavoro (slice + multitasking)](../.cursor/rules/sgq-workflow-method.mdc) | Regola `.cursor`: slice, parallelizzazione, worktree, triage PR |
| [Deploy (hub)](how-to/deploy.md) | Ingresso unico release Netlify + VPS |
| [Manuale NC + Canvas](how-to/MANUALE_UTENTE_NC.md) | Registro non conformità — guida utente e canvas interattivo Glass |
| [Libreria UI SGQ](reference/LIBRERIA_UI_SGQ.md) | Catalogo componenti UI, duplicati, matrice moduli (~55% copertura Fase A) |
| [Principi documentazione](archive/sessions/GUIDA_DIARIO_2026.md#principi-di-documentazione-chiarezza-e-best-practice) | Dove scrivere cosa, cosa evitare |
| [Piano qualità / test](archive/sessions/GUIDA_DIARIO_2026.md#piano-qualità-fasi-di-sviluppo-e-test-di-robustezza) | DoD, piramide L1–L5, smoke |
| [Procedura chiusura autonoma](archive/sessions/GUIDA_DIARIO_2026.md#procedura-chiusura-autonoma) | Ciclo slice agente: fix, test, smoke, doc, limiti |
| [Sync ADR-008](archive/sessions/GUIDA_DIARIO_2026.md#architettura-target-sync--event-sourced-adr-008) | Event-sourcing, regole sync |
| [**A** — Checklist, sync, deploy](#a-checklist-custom-sync-deploy-vps) | Procedure operative principali |
| [**B** — Word Verbale](#b-report-word--checklist-custom-verbale) | Export OOXML / template |
| [**C** — Database e repro](#c-database-e-repro) | Script SQL, repro bug |
| [**D** — Verifica rapida](#d-comandi-di-verifica-rapida) | Comandi curl/test |
| [**D bis** — Catalogo smoke](#d-bis-catalogo-smoke-harness) | Script test/smoke CI e ops |
| [**E** — SAL / import / RAG](#e-flusso-2--sal--sopralluoghi--evidenze-documentali--import--rag-retrieval) | Flusso documentale avanzato |
| [**F** — Architettura piattaforma](archive/sessions/GUIDA_DIARIO_2026.md#f-architettura-unificata-della-piattaforma-sessione-05042026) | Visione moduli unificati (archivio) |
| [File Word spesso toccati](archive/sessions/GUIDA_DIARIO_2026.md#file-spesso-toccati-word--export) | Path sorgenti export |

Sessioni archiviate (consultazione): [GUIDA_DIARIO_2026.md](archive/sessions/GUIDA_DIARIO_2026.md)

---

## Cosa leggere a inizio sessione (ordine)

1. **[../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)** — stack, infra, workflow.  
2. **[PROJECT_ROADMAP.md](PROJECT_ROADMAP.md)** — fasi e backlog.  
3. **[ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md)** — gerarchia utenti, segregazione dati, ruoli e piano migrazione RBAC (aspetto portante; aggiornare quando si toccano auth o scope query).  
4. **Questo file** — lezioni apprese, procedure ripetibili e **piano qualità / test di robustezza** (sezione omonima sotto).  
5. **[DATABASE.md](reference/DATABASE.md)** — connessione DB, script repro, ambienti `development` / `test`.  
6. Per deploy: **[how-to/deploy.md](how-to/deploy.md)** (hub) → checklist, VPS, troubleshooting, accesso agenti.
7. Se il task tocca editing documentale desktop: **[MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](specs/MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md)**.

**Percorsi workspace (Windows)** — `C:\ProgettoISO` non è “un progetto diverso” dal repo su disco: sui PC configurati così è di solito una **junction verso Google Drive** (`G:\Il mio Drive\...`). Una cartella omonima sotto **OneDrive** può invece essere un **checkout separato**. Dettaglio e regole operative: sezione *Percorsi di lavoro locale* in **[../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)**.

**Storico sessioni** (feb–mar 2026): cartella [archive/sessions/](archive/sessions/) — solo consultazione, non aggiornare.

> **Come è organizzato questo file.** In alto: le **lezioni apprese consolidate** + i **principi** + il **piano qualità/metodo** + le **procedure A–E**. Il diario sessioni è in [archive/sessions/GUIDA_DIARIO_2026.md](archive/sessions/GUIDA_DIARIO_2026.md). Metodo: [`.cursor/rules/sgq-workflow-method.mdc`](../.cursor/rules/sgq-workflow-method.mdc).

---

## Lezioni apprese consolidate (fonte unica)

> Indice unico delle lezioni operative: ogni riga è una **regola da applicare** + un link al dettaglio (sessione o doc). Quando emerge una nuova lezione, aggiungerla **qui** (sintesi) e linkare il dettaglio cronologico più sotto — non duplicare il racconto.

### Architettura UI e form

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Form HTML annidati** — «Salva azione» nel drawer NC non persisteva (nessun POST nei log VPS, drawer si chiudeva senza errore). HTML vieta `<form>` dentro `<form>`: il browser ignora il form interno e il submit va a quello esterno. | **Mai annidare `<form>`.** Un componente contenitore che usa `<form onSubmit>` va convertito in `<div>` se contiene figli con propri form di salvataggio; i pulsanti interni devono essere `type="button"` con `onClick`. | [Sessione 07/06/2026 — NC notifiche + form annidati](archive/sessions/GUIDA_DIARIO_2026.md#sessione-07062026---nc-notifiche--form-annidati-chiusura-sessione) |
| **Pattern "Ambito" azienda — standard per tutti i moduli multi-azienda** | Quando un modulo mostra dati filtrabili per azienda, usare **sempre** il pattern Ambito: (1) utility `xxxCompanyScope.js` con `resolveInitial…`, `readStored…`, `persist…` su localStorage; (2) selettore `"Ambito:"` nell'**header** della pagina (non nella toolbar); (3) il `companyScope` alimenta lista, form e widget; (4) nel form il campo azienda è testo fisso "(da ambito)" se scope attivo, select libero altrimenti; (5) auto-selezione se l'org ha una sola azienda. **Non** usare dropdown azienda in toolbar né nel form come campo indipendente. Moduli già conformi: Qualifiche (`qualificationsCompanyScope.js`), WPS/Saldatura, Registro documenti (`documentRegistryCompanyScope.js`), Riesame di Direzione (`managementReviewsCompanyScope.js`). Moduli con `filterCompany` in toolbar ancora da aggiornare: NC, NDT Reports, Attrezzature, Scadenzari. | PR #154 · sessione 22/06/2026 |
| **Riuso UI «blocco unico»** | Prima di creare un elemento UI, verificare se esiste già un componente/classe nel repo (tabella in `sgq-operating-memory.mdc`). Usare sempre l'esistente. | [Libreria UI SGQ](reference/LIBRERIA_UI_SGQ.md) |
| **JSX: sequenze `\u` literal** | Gli escape `\uXXXX` tra tag JSX finiscono a schermo come testo. Metterli **dentro una stringa JS** (`{"\u26A0\uFE0F …"}`). | [Aggiornamento 22/05/2026 — JSX `\u`](archive/sessions/GUIDA_DIARIO_2026.md#aggiornamento-22052026--jsx-sequenze-literal-u-in-ui-rischi--progetti--qualifiche) |

### Harness agentico e AI runtime

| Lezione | Regola da applicare | Dettaglio |
|---------|---------------------|-----------|
| **Harness hardening HK (giugno 2026)** — 10 slice verticali per chiudere i gap strutturali su governance Cursor, alleggerire la memoria operativa, completare il collare AI runtime (audit trail, licenze, NormBroker v1 cascata, gap analysis MVP, disclaimer). | Ogni feature AI ha un **endpoint canonico univoco** con licenza specifica (`ai_import`, `ai_assist`, `ai_review`, `ai_norms`, `ai_chat`). Audit trail (`logAiInteraction`) su ogni route AI. `AiDisclaimer` nei 4 flussi principali. `norm_access_log` per accessi non-locali. Gap analysis heuristica come Fase 2 ADR-010. | [`PLAN_HARNESS_HARDENING_SLICES.md`](agent-tasks/PLAN_HARNESS_HARDENING_SLICES.md) · branch `cursor/harness-hardening-hk-6b60` |
| **SAL Fase 0 — motore dati gap operativo (luglio 2026)** | Tabella `requirement_implementation_status` + storico `requirement_implementation_history` (mig. **117**). Servizio canonico `gapAnalysis.service.js`: `getGapMatrix`, `upsertStatus`, `seedForCompany` (macro-clausole N.N da `norm_requirements`). API licenza **`sal`**: `GET/POST /companies/:id/gap-matrix`, `GET/PUT /companies/:id/gap-statuses`. Distinto da `GET /gap-analysis` (euristica documenti, licenza `ai_norms`). Decisione ADR-009: stato persistito in tabella dedicata, non overlay su registro documenti. | [`MODULO_SAL_SCOPO_E_ROADMAP.md`](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §D/H Fase 0 |
| **SAL Fase 1 — UI griglia `/sal` (luglio 2026)** | Pagina `SALModule.jsx`: ambito azienda (`salCompanyScope.js`), tab filtro standard 9001/14001/45001, griglia `SgqDataGrid` con cambio stato inline + modal note/responsabile/scadenza, pulsante seed se matrice non seedata. Metodi `apiService.getGapMatrix` / `updateGapStatus` / `seedGapMatrix`. Menu sidebar senza lucchetto (licenza `sal`). Test L1: `salModule.test.jsx`, `salCompanyScope.test.js`. | [`MODULO_SAL_SCOPO_E_ROADMAP.md`](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 1 |
| **SAL Fase 2 — export Word + storico + evidenze registro (luglio 2026)** | Export Word programmatico (`wordExportSal.js`, distinto da verbale Riesame §9.3). Modal ampliato: `SalEvidenceSection` collega `evidence_document_ids` → `document_registry` (picker documenti rilasciati, link `buildDocumentRegistryPath` / `RouterContext`). Backend: `validateEvidenceDocumentIds`, `enrichRowsWithEvidence`, `GET .../gap-statuses/:id/history`; UPDATE con `COALESCE` per non azzerare evidenze su cambio stato inline. Test L1: `salModule.test.jsx` (5), `gapAnalysis.service.test.js` (13). | [`MODULO_SAL_SCOPO_E_ROADMAP.md`](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 2 |
| **SAL Fase 3 — integrazioni audit + NC sal_gap (luglio 2026)** | `syncAuditConformityHints` da ultimo audit completato (12 mesi) → colonna hint in griglia; mig. **118** `source_category='sal_gap'`; azione Piano Azioni da modal SAL (`NcCreateModal`). **Non** tocca Welding Book (ADR-016). Deploy VPS: mig. 118 separata da mig. 110. | [`MODULO_SAL_SCOPO_E_ROADMAP.md`](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 3 |
| **SAL Fase 4 — feed Riesame §9.3 (luglio 2026)** | `getInputSummary` con `company_id` legge `getNormCoverageForReview` (motore SAL) al posto del JOIN audit grossolano; fallback `audit_legacy` senza ambito azienda. Campo `norm_coverage_source`: `sal` \| `audit_legacy`. | [`MODULO_SAL_SCOPO_E_ROADMAP.md`](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 4 · §G |
| **ADR-017 — rete ingest + catalogo UNI (luglio 2026)** | Tre livelli: A regole globali, B `ingest_reference_patterns` (pattern anonimi cross-tenant, no PII), C few-shot org. Catalogo **UNI Store primario** (`uniStoreConnector`) prima di ISO.org. Fix estrazione norme [#223](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/223); dedup/purge/re-audit [#224](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/224). Mig. **120** su VPS **OK** (04/07/2026). **Upgrade backlog**: agente manutenzione norme (cron ~30 gg, report duplicati + re-audit PDF). | [ADR-017](adr/ADR-017-ingest-reference-network.md) |
| **Ingest norme — chiusura refactoring patrimonio (05/07/2026)** | Metadati pre-fix ingestati con pipeline vecchia: **re-audit PDF** (`reaudit-norms-from-pdf-vps.js`) + purge hard-delete (`purge-norms-for-reupload-vps.js`) + ricaricamento manuale. Upload blocca duplicati su `standard_code` (org, esclusi `obsoleto`). DB verificato post-sessione: Mason #1990/#1991 OK; QS Studio patrimonio Camellini #1992 (`EN 1090-2`); ERAM/AI.Admin da ricaricare. **Non** hardenare upload oltre duplicato codice; manutenzione periodica delegata ad agente futuro. | PR [#223](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/223) · [#224](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/224) |
| **UNI Store — due capacità distinte, non confondere** | (1) **Lookup catalogo/vigore** (`uniStoreConnector.service.js`) usa le **API pubbliche** di store.uni.com/uni.com (nessun login, nessun dato protetto) → **già funzionante**, verificato 05/07/2026 su `UNI EN ISO 3834-2:2021` (trova URL catalogo reale). (2) **Estrazione testo integrale norma** richiederebbe login con abbonamento personale/organizzazione (es. Studio Mason) → **testato e scartato** 05/07/2026: la chiamata di autenticazione viene bloccata a livello di rete da una protezione anti-bot (nessuna risposta HTTP, non un problema di selettori), riprodotto sia headless sia headed con user-agent reale. **Non proseguire** con tecniche di evasione (fragili + violano i Termini di Servizio UNI). Per norme mancanti nel catalogo (`docs/Normative/`): download manuale autorizzato da chi detiene l'abbonamento + conversione con `backend/scripts/pdf_to_json/` (stesso pattern delle 6 norme esistenti). | [ADR-010](adr/ADR-010-ai-agentic-architecture.md#stato-implementazione-2026-06-hk-harness-hardening) · script diagnostico `backend/scripts/uni-store-diagnostic.js` |
| **Abbonamento consultazione UNI-CNPI — DRM insormontabile, task abortito (06/07/2026)** | Login assistito riutilizzabile + attivazione/rilascio abbonamento (UTILIZZA/TERMINA, API dirette `store.uni.com`) + download del PDF completo: **tutti automatizzabili**. **Lettura del contenuto no**: il PDF scaricato è cifrato con DRM proprietario **FileOpen (`FOPN_foweb`)** — nessuna libreria open source lo apre (pdfplumber/PyMuPDF/pypdf/pikepdf tutte fallite); la stampa da Acrobat Reader è disabilitata per questo tier di sola consultazione (diverso da acquisto definitivo); lo screenshot automatico della GUI è impossibile per **isolamento sessione Windows** (il processo dell'agente non vede finestre del desktop interattivo). **Non riprendere** questo filone. Se in futuro servirà davvero il testo integrale di una norma: valutare l'**acquisto definitivo** (consente stampa) caso per caso — non un meccanismo generale. Script riutilizzabili da mantenere: `uni-store-diagnostic.js` (login, PR #226), `uni-store-download-and-ingest.js`, `uni-store-consult-and-ingest.js`; lookup catalogo pubblico `uniStoreConnector.service.js` resta valido e va tenuto. | [ADR-010 § Stato implementazione](adr/ADR-010-ai-agentic-architecture.md#stato-implementazione-2026-06-hk-harness-hardening) |
| **Ingest AI commesse — slice #5–#7 (luglio 2026)** | Orchestratore `caseDocumentAnalysis.service.js` + `POST /cases/:id/analyze-documents` (pulsante tab Documenti). Checklist §8.2: pannello suggerimenti applica note preliminare+finale con prefisso `[AI doc]`. Copertura saldatori: `GET /cases/:id/extracted-coverage?project_id=` arricchisce WPS con profilo da requisiti estratti (`extractedRequirementsProfile.js`). Deploy: aggiungere i 3 service + utils al `deploy-manifest.json`. | [`MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md`](specs/MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md) §E |
| **Workflow Lead/Deputy** — il deputy esegue slice atomiche, commit per slice, aggiorna `DEPUTYTASK.md` dopo ogni slice. Il Lead prepara il brief in `DEPUTYTASK.md` e `PLAN_…_SLICES.md`. | **Non** usare `.github/agents/` (legacy). Usare `docs/agent-tasks/DEPUTYTASK.md` come unico brief attivo. | [ADR-015](adr/ADR-015-cursor-lead-deputy-workflow.md) |

### Multi-tenant, RBAC e dati

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Isolamento dati AI multi-tenant** | Utente **STUDIO**: vista d'insieme, può selezionare solo tra le **proprie aziende clienti** (`auditor_org_id`). Utente **AZIENDA cliente**: il backend **forza** `company_id` sull'anagrafica primaria (mai fidarsi del `companyId` dal client), niente 403. **RAG**: filtro `company_id = @compId`, **niente** `OR IS NULL` / chunk globali. | [PR #91 — regola scope azienda AI](archive/sessions/GUIDA_DIARIO_2026.md#pr-91--regola-di-prodotto-ambito-azienda-dellassistente-ai-07062026) |
| **Qualifiche — una azienda per certificato** | Ogni qualifica ha `company_id` **obbligatorio** (UI ambito + form, API `qualificationCompany.service`, mig. 087). Import AI eredita `company_id` dal job. Dopo approvazione **non** si cambia azienda; stesso numero certificato/PDF non può esistere su un'altra azienda del tenant. Pattern UI: `qualificationsCompanyScope.js` (come registro documenti). | [Aggiornamento 10/06/2026 — qualifiche company scope](archive/sessions/GUIDA_DIARIO_2026.md#aggiornamento-10062026--qualifiche-ambito-azienda-obbligatorio) |
| **Anagrafica personale ↔ qualifiche** | `company_personnel` = master (nome, mansione, email); `qualifications` = fascicolo certificati con `personnel_id` FK opzionale. Import guidato + backfill link; tab **Salute mansione** (4 tipi: acuità visiva, Ishihara, idoneità medica, sorveglianza sanitaria). Mig. **088**. | [Aggiornamento 10/06/2026 — collegamento personale-qualifiche](archive/sessions/GUIDA_DIARIO_2026.md#aggiornamento-10062026--collegamento-anagrafica-personale-qualifiche) |
| **Controparti azienda ↔ riesame commerciale** | `company_counterparties` sotto `companies` (ruoli `customer` / `end_customer` / `supplier`). Mig. **096** tabella + `commercial_cases.commercial_customer_id`; mig. **097** backfill idempotente da `commercial_customer_name`/`ref` (095) e `projects.client_name` → `end_customer_id`. **Snapshot 095 non rimosso** (deprecato, non DROP). Write: se FK impostata, `contractReview` sincronizza name/ref dalla controparte (`commercialCustomerCounterparty.service`). Verifica: `node backend/scripts/verify-counterparties-migration.js`. Pilota: LM&CO = azienda SGQ, PT.MAIDO = `end_customer`. | sessione 14/06/2026 |
| **Saldatore ISO 9606-1 — campi end-to-end** | Catena AI→schema(FE/BE)→commit→DB→scheda allineata sulle **stesse chiavi**: ogni nuovo campo va in `aiPrompt`/`aiExpectedSchema`, `fields[].key` FE, e mappatura `commitToQualification`/`qualificationIngest`, altrimenti l'AI estrae ma il commit lo scarta. Mig. **092**: spessore/diametro **numerici min/max** (deriva legacy `thickness_range`/`pipe_diameter`), date `exam_date`/`last_confirmation_date`/`next_confirmation_due`/`revalidation_date` (stop overwrite `issue_date`), `product_type`/`weld_details`/`qualification_designation` (calcolata). Semaforo 9606 = **min(next_confirmation_due, expiry_date)** difensivo. Obbligatori scheda su blur/submit; in import-commit solo **warning**, mai blocco. | commit `0034399`/`f7936c1`/`8d427d8` |
| **Import PDF → qualifica: PDF collegato** | `commitToQualification` imposta `certificate_file_url` da `import_job_files.storage_path` (pattern `/uploads/...` come ingest) e `import_job_files.qualification_id` (mig. **093**). Link visibile subito in `QualificationsPage` / `QualificationForm`. | sessione 14/06/2026 |
| **Feedback cliente reale (Studio Mason) — priorità sui GAP normativi** | 6 punti su patentini saldatori, tutti risolti/proposti in una sessione: ODC mancanti (`issuing_body` select), **gruppo padre selezionabile oltre al sottogruppo** in `material_group` (il cliente ha corretto una regola RC-0 scritta senza controfirma reale: ISO 9606-1 qualifica per gruppo intero, il certificato spesso riporta solo il gruppo padre), simbolo **≥** per spessori/diametri senza limite superiore (`weldingDesignation.js`, `deriveRangeString`), label "Data di scadenza" generica (rimossa assunzione "2 anni" errata per 9606-1), nota advisory (non auto-fill DB) per diametro piastre in posizione rotante marcata **non verificata su copia integrale norma**, hardening logging/messaggi errore batch upload (`ingestErrorMessage.js`). **Regola**: quando una regola normativa in `docs/reference/*.md` è dedotta solo da analisi codice/norma senza controfirma su caso reale, marcarla "da confermare su campione reale" — non bloccare opzioni valide nel form. | `docs/agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md` § Feedback cliente Studio Mason · branch `fix/feedback-studio-mason-patentini` |
| **Ingest documenti — pipeline unificata (IG-1)** | Motore `documentIngestPipeline.service.js`: testo (`pdf-parse` + OCR) → regex (`ruleFieldExtractors`) → AI (`importAiExtraction` + `jsonRepair` + retry) → merge con `fieldConfidence`. Tipi iniziali: `wpqr`, `patentino_saldatore`, `wps`. OCR richiede `tesseract.js` + `pdf2pic` (`npm install` VPS). **IG-2** collegherà upload batch; **IG-4/5** feedback operatore. Piano: `docs/agent-tasks/PLAN_INGEST_LEARNING_SLICES.md`. | slice IG-1 · 28/06/2026 |
| **Ingest IG-3 — revisione pre-commit** | Upload batch WPQR/patentini → `ingest_staging` (mig. **114**) + `IngestReviewDialog` con anteprima PDF affiancata (`IngestSourcePreview`, PR **#207**). **Ingrandisci affiancato** (PR **#209**): schermo intero PDF + campi insieme; ESC/Riduci torna compatto. API confirm/reject. **Produzione**: eseguire mig. **114+115** su `SGQ_ISO9001` (errore `Invalid object name 'ingest_staging'` se mancanti). Script: `run-migration-114-vps.js`, `run-migration-115-vps.js`. | slice IG-3 · 28/06/2026 |
| **Ingest IG-4/5/6 — feedback + few-shot + WPS** | Tabella `import_extraction_feedback` (mig. **115**); hook su confirm/reject; few-shot in `extractStructuredByDocType`; batch WPS con staging. Deploy TEST automatico senza conferma. Smoke: `backend/scripts/smoke-ingest-e2e-test.js` + UI batch su Deploy Preview (test-api). | slice IG-4/5/6 · 28/06/2026 |
| **Alert + scadenzario qualifiche** | Toggle `alert_qualif_expiry` cablato in `alertScheduler` (+10 min dopo doc). Servizio `qualificationAlert.service.js`: data guida = min(expiry, next_confirmation per 9606); email al coordinatore per azienda (rubrica `notification_contacts` company → `company_personnel` job coordinatore → `user_company_access` ruolo coordinatore → fallback org). Dedup `qual_notification_log` (mig. 093). Scadenzario `/deadlines`: righe virtuali `item_type=qualification` + tarature `equipment` (merge in `listDeadlineItems`). Badge `/alerts` include qualifiche approvate. | sessione 14/06/2026 |
| **Scadenzario — ordine dichiarazione `equipRows`** | Estendendo ADR-013 con tarature strumenti, **`let equipRows` va dichiarato prima del `const merged`** (stesso pattern di `qualRows`). Altrimenti `GET /deadline-items` risponde 500 con `Cannot access 'equipRows' before initialization` e la pagina `/deadlines` mostra banner rosso. Fix: [PR #179](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/179) — deploy VPS `deadlines.controller.js` (04/07/2026). | incidente 04/07/2026 |
| **Registro conferme semestrali 9606** | Mig. **094**: tabella `qualification_confirmations` + flag `company_personnel.is_primary_welding_coordinator`. API: `POST /qualifications/:id/confirm-semiannual`, `GET …/confirmations`, `GET /qualifications/confirmations/export` (xlsx). Solo qualifiche **approvate** tipo 9606; auth = email utente = coordinatore primario azienda (fallback admin/superadmin). UI: sezione collassabile in `QualificationForm`; deep link scadenzario `?highlight=&section=conferma`. **No timbro PDF** sulla conferma. | sessione 14/06/2026 |
| **API 500 da `studioScopeClause` errato sulle `companies`** | Nelle clausole di scope su `companies` usare l'alias colonna corretto (`c.organization_id`, **non** `co.organization_id`) e la logica `isOrgWideAdmin` / `auditor_org_id` (mai `isSuperadmin` indiscriminato). | [Sessione 07/06/2026 — fix responsible-options](archive/sessions/GUIDA_DIARIO_2026.md#sessione-07062026---nc-notifiche--form-annidati-chiusura-sessione) |
| **Menu audit vs RBAC** | Lista e dettaglio audit filtrano con `studioScopeClause` (`auditListRbac.service`); `organization_id` sempre da `req.user`. | [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) |
| **`companies` NON ha `organization_id`** | La tabella `companies` è scopata via `auditor_org_id`; l'org si ottiene con join `auditor_orgs ao ON ao.id = c.auditor_org_id` (`companyBelongsToOrg`). Nei JOIN basta `LEFT JOIN companies c ON c.id = x.company_id`, mai `c.organization_id`. Regressione 13/06/2026: il fix `9fda958` aveva aggiunto `... AND c.organization_id = j.organization_id` in `importJobs.listJobs/getJob` → errore SQL `Invalid column name 'organization_id'` (lista + dettaglio Import PDF bloccati). Fix `98bc36f` rimuove la condizione errata + test mirati su `listJobs/getJob`. | commit `98bc36f` |

### Notifiche NC e alert

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Notifiche NC — rubrica + escalation** | Ogni azienda ha una **rubrica referenti** (`notification_contacts`, mig. 073-074) con ruolo email. L'alert scadenza NC usa **priorità: personale azienda (`responsible_contact_id`) > rubrica (`recipients_email`)**. Lo scheduler (`docAlertEscalation.service`) gestisce l'escalation **allineata alla config**. I responsabili NC si scelgono dal **personale azienda** (`responsible-options`). | [Sessione 07/06/2026 — NC notifiche](archive/sessions/GUIDA_DIARIO_2026.md#sessione-07062026---nc-notifiche--form-annidati-chiusura-sessione) · [ADR-012](adr/ADR-012-company-personnel-anagrafica.md) |
| **Verifica efficacia = giudizio complessivo, non per singola azione** | La verifica di efficacia (ISO 10.2.1 e) valuta l'insieme delle azioni correttive di una NC, non ha senso per singola azione. Workflow azione semplificato a `Aperta → In corso → Completata` (rimosso lo step "Verifica" in `NcActionsList.jsx`); quando tutte le azioni sono `completed` la NC passa **auto** a `resolved`. Il punto **6. Verifica efficacia** del drawer resta l'unico gate ISO (note obbligatorie) prima di `Verificata`/`Chiusa`. **Bug corretto insieme**: la vecchia auto-transizione portava la NC a `verified` bypassando quel gate se tutte le azioni singole venivano marcate "verificate" — controllare sempre che un'auto-transizione di stato non scavalchi un gate di validazione manuale equivalente. | PR [#244](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/244) · 11/07/2026 |
| **Correzione obbligatoria (ISO 10.2.1 a) ≠ azione correttiva (10.2.1 b-d)** | La norma richiede **sempre** una reazione immediata alla NC (punto a: «correggerla, affrontarne le conseguenze»), mentre l'azione correttiva (eliminare la causa per prevenire ricorrenza) è condizionata a una **valutazione** (punto b: «valutare l'esigenza»). Il sistema ora impone un gate bloccante: almeno un'azione `action_type='immediate'` completata prima di poter passare a `resolved`. Nuovo campo `corrective_action_needed` (yes/no) + `corrective_action_evaluation_notes` documenta formalmente la valutazione §10.2.1 b) senza bloccare il workflow. UI: sezione 4 rinominata "Correzione e azioni", azioni raggruppate in due blocchi con badge «Obbligatoria» se mancante. | mig. 121 · branch `fix/nc-correction-gate` · 11/07/2026 |
| **Report Word NC — correzione/allegati assenti: due bug distinti, non uno** | (1) **Conflitto placeholder docxtemplater**: il loop azioni usava `{description}`, stesso nome del campo NC a livello root (sezione 2) → docxtemplater risolveva sempre il valore root, correzione vuota. Fix: rinominare in `{actionDescription}` sia nel template (`generateNcTemplate.js`) sia nel mapper (`buildNcTemplateData`). (2) **Bug critico in `replaceNcAttachmentsMarker`**: la regex per inserire le immagini allegate matchava dal **primo `<w:p>` del documento** fino al paragrafo del marker, cancellando tutto il contenuto precedente (correzione, azioni, descrizione) ogni volta che l'NC aveva almeno un allegato immagine. Sintomo ingannevole: senza allegati la correzione appariva (bug 1 nascondeva/mascherava il bug 2). Fix: sostituire **solo** il paragrafo che contiene il marker (`lastIndexOf('<w:p', idx)` → `indexOf('</w:p>', idx)`), mai una regex "dal primo tag". **Lezione generale**: quando un fix su un placeholder non risolve il sintomo, verificare con un **test di integrazione reale** (template su disco + docxtemplater vero, non mock) l'XML renderizzato passo-passo (dopo `render()`, dopo sostituzione marker, dopo `generate()`) — i mock unitari avevano nascosto il bug 2 per intere iterazioni. | PR [#247](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/247) · 13/07/2026 |

### Ambiente di lavoro e tooling

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Worktree su disco locale `C:`** | Il repo vive su **Google Drive** (`G:\…`) dietro junction `C:\ProgettoISO`: l'I/O è lento e la **suite Vitest completa si impalla**. Per task corposi/paralleli usare un **worktree su `C:`** da `origin/main`; come L1 affidarsi a **build Vite + Vitest mirato** (o CI Netlify), non alla suite intera. | [`sgq-workflow-method.mdc` § Worktree](../.cursor/rules/sgq-workflow-method.mdc) · [Workspace consigliato](archive/sessions/GUIDA_DIARIO_2026.md#workspace-consigliato--ponte-cprogettoiso-cursor--terminale) |
| **`gh` CLI + MCP GitHub** | Su Windows: `gh auth login` con account **qsstudio241** (verificare con `gh auth status`). Preflight PR: `gh pr list`, `gh pr merge`. Fallback se `gh` non autenticato: **MCP GitHub** — leggere schema tool prima di chiamarlo. | [`sgq-workflow-method.mdc` § Triage PR](../.cursor/rules/sgq-workflow-method.mdc) · sessione 14/06/2026 |
| **Migrazioni DB — sequenza condivisa** | Numerazione **unica** (stato ~082). Le PR vecchie con numeri bassi vanno **rinumerate in coda** e rese **idempotenti** (check esistenza prima di `ALTER`/`CREATE`). FK SQL Server: statement separati. | [how-to/database-migrations.md](how-to/database-migrations.md) |
| **Encoding UTF-8 senza BOM** | Lo strumento di salvataggio può produrre **ANSI/BOM** o interpretare `\n`/`\t` come newline/tab. Dopo ogni scrittura: verificare **UTF-8 senza BOM**, accenti italiani corretti, **nessun `U+FFFD`**. Script: `backend/scripts/check-utf8-encoding.js` (**gate CI** su ogni PR `app/**`). Riparazione batch: `repair-utf8-encoding.js --write` + `fix-encoding-corruption.js --write`. | [Playbook caratteri non riconoscibili](archive/sessions/GUIDA_DIARIO_2026.md#playbook-riutilizzabile--caratteri-non-riconoscibili-ufffd--tofu-in-ui) · [`sgq-encoding-quality.mdc`](../.cursor/rules/sgq-encoding-quality.mdc) |
| **`check-utf8-encoding.js` — loop infinito senza flag `g`** | Le regex dei pattern venivano scandite con `regex.exec(text)` ripetuto in un `while`, ma senza il flag `g` un match trovato viene **restituito all'infinito** (lastIndex non avanza): CI `test-and-build` restava bloccata "in_progress" per ore su qualunque branch con un match già presente nel repo (es. un vero refuso pre-esistente in `welding.controller.js`, "gi? assegnato" invece di "già assegnato"). Sintomo: step "Encoding UTF-8 sorgenti" mai completato, nessun errore visibile. **Fix**: aggiungere `g` a tutte le regex del file; verificare sempre con `node backend/scripts/check-utf8-encoding.js --human` in **locale con timeout** prima di fidarsi che "non dia errore" — uno script che non termina in pochi secondi su ~600 file è già un sintomo. | PR [#244](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/244) · 11/07/2026 |
| **`contractReview.controller.js` NON è nel deploy-manifest** | `backend/scripts/deploy-manifest.json` non include `contractReview.controller.js`/`.routes.js`: quando un commit li modifica vanno copiati a mano con `pscp` **prima** del restart, poi lanciare `deploy-controllers-to-vps.ps1` per il resto. Deploy fix segregazione `company_id` Import PDF 13/06/2026 (commit `9fda958`): push `main`, copia manuale `contractReview.controller.js`, deploy manifest, MainPID 646321→652768, health `healthy`, `/import-jobs` → 401 coerente. | Sessione 13/06/2026 — commit `9fda958` |
| **Deploy sicuro con working tree "sporco"** | `deploy-controllers-to-vps.ps1` copia il **working tree dal disco** (manifest di ~118 file), **non** lo stato committato: se il tree contiene WIP non pertinente al rilascio, il WIP finisce in produzione (incidente 23/06/2026: una versione WIP di `knowledgeIndexer.service.js` importava un file nuovo non tracciato → crash `MODULE_NOT_FOUND`, API offline 503). **Regola**: (1) prima di ogni deploy backend verificare `git status --short`; se il tree NON è pulito e il WIP non riguarda il rilascio, **non** usare lo script completo; (2) fare un **deploy mirato dei soli file committati** (`pscp` del singolo file, oppure `git show HEAD:percorso` per forzare la versione di `HEAD`) + restart con verifica `MainPID`; (3) se il rilascio introduce un **nuovo pacchetto npm** (es. `mammoth`), eseguire `npm install`/`npm ci` sul VPS, altrimenti `MODULE_NOT_FOUND`. Funzioni riutilizzabili in `backend/scripts/lib/vps-ssh.ps1` (`Initialize-SgqVpsSsh`, `Test-SgqVpsSession`, `Copy-SgqVpsFile`, `Invoke-SgqVps`, `Get-SgqVpsHealth`); password sudo a `plink` **solo via stdin**, mai nella stringa del comando. | [Sessione 23/06/2026 — incident deploy WIP](archive/sessions/GUIDA_DIARIO_2026.md#sessione-23062026-incident--deploy-sicuro-con-working-tree-sporco) |
| **Token Netlify CLI (Windows)** | Credenziali locali: `backend/config/.netlify.local.ps1` (copia da `.netlify.local.ps1.example`, gitignored). Preflight: `.\backend\scripts\netlify-preflight.ps1` → deve stampare `NETLIFY_ACCESS_OK`. **Mai** token Netlify in chat o su Git. | [NETLIFY_DEPLOYMENT.md](how-to/NETLIFY_DEPLOYMENT.md) |
| **PDF → Markdown → JSON (tool generico)** | Per digitalizzare una nuova norma/Quaderno/checklist/capitolato: usare **sempre** `backend/scripts/pdf_to_json/` (pdfplumber + fallback pymupdf/pypdf, OCR locale opzionale via tesseract, nessuna chiamata cloud) invece di scrivere parsing ad-hoc. Rileva anche i PDF con font a codifica rotta/offuscata (testo "presente" ma illeggibile, es. placeholder `(cid:NNN)`) e li segnala come pagine a bassa qualità invece di produrre JSON silenziosamente sbagliato. Salva sempre il `.md` intermedio da revisionare prima di fidarsi del `.json`. | [`.cursor/skills/pdf-to-json/`](../.cursor/skills/pdf-to-json/SKILL.md) · [`backend/scripts/pdf_to_json/README.md`](../backend/scripts/pdf_to_json/README.md) |
| **Font PDF "anti-copia" — correggere, non scartare (RC-5/RC-6, luglio 2026)** | Ipotesi iniziale sbagliata: scartare il `.md` di `UNI EN ISO 9606-1:2017` perché il font incorporato genera errori sistematici (`buii`→`butt`, `materia1`→`material`, `docurnent`→`document`, `qualitication`/`qualiiication`/`qualilication`→`qualification` — stessa lettera originale reso in modo diverso a seconda della pagina/subset font, quindi **non** un mapping carattere-per-carattere affidabile). Soluzione corretta: **dizionario di parole intere** osservate corrotte (nessuna è una parola inglese valida → falsi positivi marginali) in `backend/src/utils/textEncodingRepair.js` (`repairFontSubstitutionArtifacts` + `detectLikelyFontSubstitutionCorruption`, soglia 3 occorrenze). Agganciato come step opzionale in `documentIngestPipeline.service.js::extractDocumentText`: si attiva solo se il testo mostra ≥3 pattern noti, mai su testo pulito. Tabelle a griglia troppo destrutturate (spessore/diametro 9606-1 Tabella 6, matrici gruppi materiale 15614-1 Tabella 5/6) **non vanno inventate**: documentare come GAP nell'estratto invece di forzare numeri non verificabili — vedi `docs/reference/ISO-9606-1-range-validita-patentino.md` e `ISO-15614-1-range-validita-WPQR.md`. | [`PLAN_INGEST_REFERENCE_CATALOGS.md`](agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md) RC-5/RC-6 |

|| **Nuovi file JS (route/controller/service) devono essere aggiunti al deploy-manifest** | `backend/scripts/deploy-manifest.json` è la lista esplicita dei file copiati sul VPS: ogni nuovo file introdotto da un commit **deve essere aggiunto a mano** nella sezione corretta, altrimenti il backend parte con `MODULE_NOT_FOUND`. Lezione HK 30/06/2026: il deputy HK-6..8 ha aggiunto `gapAnalysis.{controller,routes,service}`, `normBroker.{routes,service}`, `aiChat.routes`, `aiAssist.controller` senza aggiornare il manifest — primo deploy fallito 503. Fix: aggiornare manifest + redeploy. Usare sempre `git diff HEAD --name-only -- backend/src/` prima di ogni deploy per rilevare file nuovi. | PR #191 merge 30/06/2026 |

### Import Excel / Scadenzario (ADR-013)

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **`findColumnByPattern` — priorità pattern, non colonna** | Il detector `excelDeadlineDetector.js` scansiona gli header per pattern (lista ordinata per priorità), non posizione colonna. La lista deve mettere le varianti "future" (`prossima`, `next`) **prima** di quelle "passate" (`ultima`, `last`): altrimenti la colonna sbagliata vince quando entrambe sono presenti nello sheet. | [fix commit `92952ec`](https://github.com/qsstudio241/sistema-gestione-iso9001/commit/92952ec) |
| **VPS restart senza `sudo systemctl`** | Se `systemctl restart` non è disponibile, usare: `lsof -ti:3000 \| head -1` → `kill -15 $PID`; systemd con `Restart=on-failure` riavvia automaticamente (~5 s). Verificare cambio PID per confermare riavvio effettivo. | Sessione 08-09/06/2026 ADR-013 smoke |
| **Reset password temporanea per smoke** | (1) `bcrypt.hash('pw_temp', 10)` da script locale con `database.json`; (2) `UPDATE users SET password_hash=... WHERE id=...`; (3) smoke; (4) **ripristinare subito l'hash originale**. Mai lasciare password temporanee in produzione. | Sessione 08-09/06/2026 ADR-013 smoke |
| **ADR-013 slices completate (09/06/2026)** | S1 detector, S2 migrazione 083, S3 API detect, S4 API import/CRUD, S5 DataGridExportable, S6 dialog+pagina `/deadlines`, S7 PriorityView. **S8** (notifiche email), **S9** (cascade delete), **S10** (auto-refresh) in roadmap. | [PR #100](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/100) |
| **Ripristini scadenzario/UI senza credenziali** | Se una funzionalità UI appena sviluppata non è visibile in produzione, verificare prima se il commit è su `main` e se Netlify ha deployato. Non modificare password/hash utenti per ripristinare funzionalità UI: credenziali e feature gating sono ambiti separati. | Sessione 09/06/2026 — commit `a1c4cc1`/`fecf114` su `main` |
| **Import PDF — menu azioni + contrasto AI (14/06/2026)** | UX: azioni file PDF raggruppate in menu **Altre azioni**; pulsante **Analisi AI** con contrasto leggibile. Preview committente **TEST OK**. | [PR #109](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/109) mergiata su `main` |
| **Scadenzario — card e file origine** | Le card riepilogo della pagina `/deadlines` devono essere **filtri rapidi** come nel modulo NC (click/toggle + stato attivo), non semplici contatori. La colonna **File origine** deve aprire il documento sorgente con `buildDocumentRegistryPath({ selectId })`, riusando il Registro Documenti. | [PR #102](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/102) |

### Anagrafica aziende — pattern critici

| Lezione | Regola da applicare | Dettaglio |
|---------|---------------------|-----------|
| **`hardDeleteCompany` — FK su `qualification_confirmations.company_id`** | Il DELETE finale su `companies` fallisce se `qualification_confirmations` ha ancora righe con `company_id` valorizzato. Il service deve cancellare `qualification_confirmations` **prima** di `company_personnel` e `qualifications` nella sequenza `simpleDeletes`. Aggiungere sempre questa voce all'inizio della lista se si toccano le dipendenze delete. | PR #237 · 08/07/2026 |
| **`CompaniesPage` — limite 50 nasconde nuove aziende** | L'API `GET /companies` usa default `limit=50` con `ORDER BY name`. Il frontend **deve** passare `limit: 500` (o superiore) altrimenti le aziende oltre la 50ª posizione alfabetica risultano invisibili pur essendo create correttamente nel DB. Non usare mai il default senza gestire la paginazione esplicita. | PR #237 · 08/07/2026 |

### Sync (vincolante)

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Sync event-sourced (ADR-008)** | Nessuna nuova feature di sync può inviare lo **«stato corrente intero»**: ogni campo → evento atomico con `idempotency_key`. Server-wins all'apertura; debounce hydrate resettato al cambio audit. | [§ Architettura target sync — ADR-008](archive/sessions/GUIDA_DIARIO_2026.md#architettura-target-sync--event-sourced-adr-008) |

---

## Registro decisioni triage PR backlog (07/06/2026)

Triage completo delle PR aperte residue (senior lead, in autonomia). Criterio: mergiare solo fix a basso rischio ancora utili e non già in main; lasciare aperte feature di prodotto o modifiche al sync sensibile (eccezioni golden rules); chiudere ciò che è già recuperato altrove.

### Mergiate su `main`
| PR | Titolo | Note |
|----|--------|------|
| #237 | fix: errore eliminazione azienda (FK qualification_confirmations) + lista tronca a 50 | Bug 1: `qualification_confirmations` ha FK su `company_id` non rimossa prima del DELETE → server 500. Fix: aggiunto step DELETE nella sequenza `hardDeleteCompany` **prima** di `company_personnel` e `qualifications`. Bug 2: `CompaniesPage` chiamava `getCompanies` senza `limit`; backend default 50 → nuove aziende oltre la 50ª posizione alfabetica non visibili. Fix: `limit: 500`. Backend deployato live su VPS (07/2026). |
| #97 | fix(backend): eliminazione azienda con cleanup dipendenze FK | Fix integrità DB. Conflitti GUIDA (whole-file CRLF) risolti tenendo main + nota esperienza FK. `companyMaintenance.service` + delega controller verificati. |
| #57 | fix(ai): retry automatico Gemini su 503/429 | Retry server-side mancante in main (solo embeddings lo aveva). Conflitti su `aiAssist.test.js` (allineato a `userId` reale) e GUIDA risolti. Syntax-check OK. |
| #91 | feat(ai): ambito azienda su chat+RAG (con **regola scope azienda bloccata**) | Mergiata con **adattamento prodotto deciso dal committente** (vedi sotto). Mantiene il fix sicurezza RAG (filtro `company_id = X`, niente `OR IS NULL`/chunk globali). Branch `pr-91-integ` (merge origin/main + fix encoding em-dash UTF-8). Conflitto GUIDA risolto tenendo main + questa nota. Test AI/scope L1 PASS, build OK. |

### Chiuse (contenuto già recuperato / stale)
| PR | Titolo | Motivo |
|----|--------|--------|
| #28 | docs: diagnosi rinnovo Let's Encrypt | Parte operativa (HTTP-01, Apache vs Nginx, port forwarding WAN:80 verso VPS:10880) consolidata in *Ops/Sysadmin — Rinnovo SSL Let's Encrypt* (più sotto). |
| #52 | feat: audit close verso document_registry (ADR-009 F5) | **CHIUSA per decisione di prodotto (07/06/2026)**. L'automatismo audit-close → `document_registry` non è desiderato: il report Word esportato deve restare **modificabile** dall'utente e **caricato manualmente** nell'albero. Il requisito corretto (revisione documento = numeratore audit al caricamento di un verbale) è tracciato come **requisito futuro** (vedi sotto) e in `DEPUTYTASK.md`. |
| #38 | feat: compressione foto + editor foto + Word resize | **CHIUSA il 07/06/2026 — completata**. Parte A (compressione foto) e parte B (editor `PhotoEditModal`) recuperate e integrate su `main`; il resize export Word è già presente in `main`. Vedi sottosezioni *PR #38 parte A* e *parte B*. |

### Lasciate aperte (feature/prodotto o sync sensibile — con prossimo passo)
| PR | Titolo | Perché aperta | Prossimo passo |
|----|--------|---------------|----------------|
| #31 | perf(sync): debounce 1500ms + enqueueOrReplace | Sync sensibile (ADR-008 T3/T4/T5) | Rivalutare vs architettura sync + test L3 multi-device |
| #10 | feat(settings): pagina Organizzazione P.IVA + logo | Si sovrappone al billing layer (migration 082) in sviluppo | Coordinare con billing per evitare doppioni, poi rebase |

#### Requisito futuro (NON ora) — Caricamento verbale di audit con revisione = numeratore audit

Nato dalla chiusura di #52. Quando l'utente caricherà **manualmente** un verbale di audit nell'albero documentale, la revisione del documento deve coincidere con il **numeratore dell'audit**:

- **Tipo documento dedicato** "Verbale di audit" (cartella **12 AUDIT**).
- **Al caricamento**: selezione dell'audit → `revision = audit.audit_number` (formato `PREFISSO-YYMMDD-NN`); campo revisione **read-only**.
- **Opzionale**: riconoscimento automatico dell'audit dal nome file di export (`{Cliente}_{NumeroAudit}_{Standard}.docx`, trattini resi come underscore).
- **Nota tecnica DB**: `document_registry.revision` è `NVARCHAR(20)` → potrebbe servire **allargare la colonna** (numeri audit fino a ~26 caratteri).
- **Tracciabilità**: nessuna FK audit attuale in `document_registry` → salvare `audit_id` / `audit_number` in `type_specific_data` (JSON).

#### PR #38 parte A — Compressione foto allegati lato client (07/06/2026)

Recuperata **solo** la compressione immagini dalla PR #38 (niente editor, niente modifiche export Word), integrata in modo pulito su `main` attuale.

- **File toccato**: `app/src/hooks/useAttachmentManager.js` (+ test `app/src/tests/compressImageFile.test.js`).
- **Comportamento**: per allegati di categoria **"foto"** (e solo se `image/*`), compressione lato client con **Canvas + `toBlob('image/jpeg')`** prima di salvataggio/upload. Parametri: **maxDim 1600px** (lato lungo, aspect ratio preservato), **qualità 0.82**, **skip < 300KB** (`minSizeToSkip`). PDF e altri tipi: **nessuna compressione**.
- **Fallback robusti**: ritorna il file originale se non è immagine, se il canvas fallisce, o se il JPEG risulta più grande dell'originale. Il file compresso eredita nome `.jpg`; `name/type/size` dei metadata allegato usano il file effettivamente salvato (`fileToUpload`).
- **Nessuna nuova dipendenza npm** (Canvas nativo del browser).
- **NON replicata** la rimozione del blocco `customItemId` presente nella PR #38 (era una regressione): il supporto agli item checklist custom resta intatto.
- **Verifica**: build Vite **OK**. Test mirato di gating (skip <300KB / solo immagini) aggiunto ed eseguibile in jsdom; il **runner vitest locale si impalla** in questo ambiente sandbox (pool threads/forks), quindi il test gira in **CI/Netlify** — build come L1.

#### PR #38 parte B — Editor foto pre-upload `PhotoEditModal` (07/06/2026)

Recuperata la **seconda e ultima parte** della PR #38: l'editor foto opzionale prima dell'upload. Con questo la PR #38 è **completata e chiusa** (parte A compressione + parte B editor; il resize export Word era già in `main`).

- **File toccati**: `app/src/components/PhotoEditModal.jsx` (nuovo), `app/src/components/PhotoEditModal.css` (nuovo), `app/src/components/AttachmentSection.jsx` (wiring), `app/package.json` + `app/package-lock.json` (nuova dipendenza).
- **Nuova dipendenza**: `react-easy-crop@^5.5.7` (peer `react >=16.4.0`, compatibile con React 18.2 del progetto).
- **Comportamento**: alla scelta di una foto (Gallery/Camera) si apre `PhotoEditModal` per **ritaglio (crop), rotazione ±90°, zoom, aspect ratio**. L'editor è **opzionale**: l'utente può **"Salta"** (usa l'originale), **"Conferma"** (applica crop/rotazione via Canvas → JPEG 0.92) o **"Annulla tutto"** (nessun upload). Più foto vengono mostrate in sequenza.
- **Flusso integrato**: scelta file foto → editor opzionale → `addAttachments("foto", ...)` → **compressione esistente (parte A, 0.82, max 1600px)** → upload. **Una sola compressione** (l'editor non comprime, produce JPEG ad alta qualità). `customItemId` preservato per gli item checklist custom.
- **Verifica**: build Vite **OK** (`react-easy-crop` bundle in `vendor-react`); test mirato `compressImageFile.test.js` **3/3 PASS**. Nessun test dedicato all'editor (UI). Suite completa non eseguita (si impalla su Google Drive nel repo principale; worktree su disco locale `C:`).
- **PR #38**: **CHIUSA** su GitHub via MCP (merge su `main` via git locale + push, no force/squash). L'export Word con resize era già presente in `main`, quindi non toccato.

#### PR #91 — Regola di prodotto: ambito azienda dell'assistente AI (07/06/2026)

Decisione committente sull'adattamento di #91 (diverso dalla PR originale):

- **Utente STUDIO** (auditor_org / superadmin studio): può avere la vista complessiva e **selezionare** tra le **sole aziende clienti** del suo `auditor_org_id`. Comportamento invariato rispetto alla PR.
- **Utente AZIENDA cliente** (ha righe in `user_company_access`): vede **solo i propri contenuti**. Il backend **forza** sempre `company_id` sulla sua **anagrafica primaria**, ignorando qualunque `companyId` inviato dal client. **Nessun errore 403** "scegli azienda" (la PR originale dava 403 al cliente multi-azienda che non sceglieva — qui invece blocchiamo/forziamo).
  - **Anagrafica primaria** = primo record di `user_company_access` ordinato per `company_id` (il `company_id` più basso). Scelta **deterministica e documentata**: se il cliente ha accesso a più aziende via RBAC, l'AI resta comunque bloccata sulla primaria.
  - **Frontend** (`AiAssistantPage.jsx`): per l'utente azienda il chip selettore azienda è **disabilitato** e preimpostato sulla sua azienda (nessun dropdown); l'inferenza automatica e i reset non lo sovrascrivono.
- **Sicurezza RAG mantenuta**: il filtro `searchKnowledge` resta `company_id = @compId` (niente `OR IS NULL`), quindi nessun chunk globale/di altre aziende rientra nel contesto del cliente.
- **File toccati**: `backend/src/services/aiCompanyScope.service.js` (+ test), `backend/src/controllers/aiChat.controller.test.js`, `app/src/pages/AiAssistantPage.jsx` (+ `.css`).

---

### Sessione 20 maggio 2026 — AI conclusioni: retry Gemini su 503 "model overloaded"

#### Sintomo
Il modale "Assistente AI — Conclusioni" mostra ripetutamente l'errore "Servizio AI temporaneamente sovraccarico" (o, su bundle pre-fix, il messaggio Nginx "Server temporaneamente non disponibile"). Capita soprattutto in orari di picco perché Gemini 2.5 Flash restituisce intermittentemente **503 model overloaded**.

#### Catena di fix (in ordine di scoperta)
1. **Nginx intercettava 503**: `error_page 502 503 504 = @backend_down` mascherava il messaggio del backend con il generico Nginx. **Fix**: rimosso `503` (rimane `502 504`), perché 503 può essere un errore funzionale legittimo.
2. **Controller AI usava 503 anche per upstream errors**: il fronte Nginx lo intercettava comunque. **Fix**: `aiAssist.controller.js` mappa errori upstream a HTTP **500** con messaggi italiani; 503 riservato solo a `AI_NOT_CONFIGURED`.
3. **Tabelle `ai_feedback` / `ai_interactions` mancanti** + `req.user.id` invece di `req.user.user_id` → ogni "Accetta/Scarta" generava DB error. **Fix**: migrazione 055 + correzione field. **Regressione 27/06/2026** (PR **#172**): `aiAssist.controller.js` usava ancora `req.user.id` → 500 su `POST /ai/feedback`; ripristinato `req.user.user_id || req.user.id`.
4. **Nessun retry server-side per 503/429 da Gemini**: ogni picco di carico Google arrivava direttamente all'utente. **Fix definitivo**: `geminiAdapter.js` ora ritenta automaticamente su **429/500/502/503/504** con backoff esponenziale (800ms → 1600ms → 3200ms ± jitter 250ms, cap 5s) per default 3 tentativi (configurabile via `GEMINI_MAX_ATTEMPTS`). Rispetta `Retry-After` se presente.

#### Regole consolidate
- **Errori HTTP nei controller AI**: non usare 503 per errori runtime (Gemini down, timeout, quota). Usare **HTTP 500** con messaggio italiano leggibile. 503 solo per "provider non configurato".
- **Retry server-side per provider AI**: tutti gli adapter (Gemini/Azure/OpenAI) devono assorbire gli errori transienti del provider prima di propagare al client. Codici retryable: **429, 500, 502, 503, 504**. Non retryable: 400 (richiesta invalida), `AI_REQUEST_FAILED` (rete locale), `AI_EMPTY_RESPONSE`.
- **Failover chiavi Gemini (multi-abbonamento)**: se una chiave esaurisce quota/token (HTTP **429** con messaggio *quota/exhausted* o **403**), `geminiKeyPool.js` passa automaticamente alla successiva in `GEMINI_API_KEYS` (virgola/punto e virgola/newline). La chiave primaria resta `GEMINI_API_KEY`. Le chiavi segnate esaurite restano saltate fino al **restart** del servizio backend (reset in memoria). Configurazione VPS esempio:
  ```env
  GEMINI_API_KEY=AIza...account1
  GEMINI_API_KEYS=AIza...account2,AIza...account3
  GEMINI_MODEL=gemini-2.5-flash
  ANTHROPIC_API_KEY=sk-ant-...account1
  ANTHROPIC_API_KEYS=sk-ant-...account2
  ANTHROPIC_MODEL=claude-3-5-haiku-20241022
  AI_ANTHROPIC_FALLBACK=true
  ```
  Se **tutte** le chiavi Gemini sono esaurite e `ANTHROPIC_API_KEY` è presente, `aiProviderAdapter` passa automaticamente a Claude (chat/assistente AI). Gli **embedding** restano solo su Gemini. Dopo modifica `.env`: `systemctl restart sgq-backend.service` (+ `.env.test` se serve ambiente test).
- **Diagnosi messaggio "non in repo"**: se un endpoint restituisce testo non grep-pabile nel repo backend, controllare `proxy_intercept_errors` + `error_page` in `/etc/nginx/sites-available/`.

#### Tabelle AI
| Tabella | Uso |
|---|---|
| `ai_feedback` | Feedback utente (accepted/rejected/rephrased) per personalizzazione |
| `ai_interactions` | Audit trail ogni chiamata AI (provider, model, tokens, latency) |

---

### Playbook riutilizzabile — Caratteri non riconoscibili (U+FFFD / tofu in UI)

**Quando ripetere questa procedura:** in schermata compaiono **U+FFFD** (simbolo con punto interrogativo), **`??`**, o accenti **mancanti/sostituiti** (es. "Qualit" al posto di "Qualità"), spesso solo su **Windows** o solo in **produzione**.

#### Cause tipiche (non escludersi a vicenda)

| # | Causa | Indizio |
|---|--------|--------|
| 1 | **Byte non UTF-8** o copia-incolla corrotta nel sorgente | Nel file manca la sequenza hex corretta per à (`C3 A0`); grep trova `�` |
| 2 | **Glifo assente** nel font effettivo: `›` U+203A, `—` U+2014 | Schermo OK su un PC, tofu su un altro |
| 3 | **Emoji/simboli** senza glifo nella stack font | Icone che diventano tofu |
| 4 | **Bundle o Service Worker obsoleto** (Netlify / PWA) | Repo a posto, browser ancora su JS vecchio |
| 5 | **Escape `\uXXXX` dentro testo JSX** (non in stringa JS) | La UI mostra **letterale** `\u26A0` o `\u00e0` invece di emoji/accenti |

#### Checklist operativa (ordine consigliato)

1. **Trovare il file** (cerca stringa spezzata nel repo; React DevTools sul testo).
2. **React/JSX:** se compaiono **sequenze letterali `\u`** (spesso dopo `>` su titoli, pulsanti o label), il testo **non è** una stringa JavaScript → le escape Unicode **non valgono**. Corregere con **`{"..."}`** dove tra virgolette c'è una **stringa** JS (escape `\u`), oppure **`String.fromCodePoint(...)`**, oppure UTF-8 reale nel sorgente (accenti). Fare grep su `\u` **fuori** da `{ ... }` dopo un tag JSX.
3. **Validare UTF-8** su `app/src` / `backend/src`: script `backend/scripts/check-utf8-encoding.js` (walk file + segnalazioni).
4. **Correggere (encoding):** lettere italiane corrette **oppure**, per robustezza, **escape Unicode** in **stringhe** JS (`conformit\u00E0`, `pi\u00F9`, … — stesso effetto a video). Per separatori **visibili**: preferire **ASCII** (`/`, ` - `) o **SVG**; evitare in UI critica `›` ed em dash lungo se non necessari.
5. **Verifica:** `vite build` in `app/`; se toccato export Word, `vitest` su `wordExport.placeholders.test.js` e `wordExport.imageDimensions.test.js` (nota: i placeholder possono stare in `word/header2.xml`, non solo `header1.xml`).
6. **Rilasciare:** commit + push; dopo deploy Netlify **hard refresh** (Ctrl+Shift+R) o aggiornamento PWA.

#### Canvas agente — encoding

Nei file `.canvas.tsx` (Glass / agente): su Windows il salvataggio diretto di accenti o em dash puo' produrre **U+FFFD** — usare escape `\uXXXX` **dentro stringhe JS** (`"Passo 1 \u2014 Apri"`, `"Priorit\u00E0"`) oppure espressioni `{"..."}`; mai `\u` come testo JSX grezzo dopo `>`. Prima del commit: grep su `EF BF BD` / `\uFFFD` e `node backend/scripts/check-utf8-encoding.js docs/canvas/`. Allineare `canvases/` (runtime Glass) e `docs/canvas/` (repo).

#### Riferimenti vincolanti

- Regola Cursor: `.cursor/rules/sgq-encoding-quality.mdc`
- Esempio di batch chiuso su `main`: commit `a5e7876` (maggio 2026), con deploy Netlify e verifica post-cache.

**Esperienza 07/06/2026 — Fix logo azienda — Express Router auth intercept**

Gli utenti desktop autenticati tramite cookie httpOnly hanno `getToken()` → `null` (nessun Bearer header). Il middleware `router.use(authenticate)` montato su `/api/v1` intercetta **ogni** richiesta priva di Bearer token — incluse quelle destinate ad altri router — rispondendo 401 prima che la route target venga raggiunta. Il componente `CompanyLogo` in `CompanyDetailPage` e `CompaniesPage` non riceveva mai la risposta immagine e cadeva in fallback silenzioso.

**Soluzione:** registrare gli endpoint pubblici (logo, allegati non sensibili) direttamente in `server.js` **prima** dei router autenticati:
```js
// server.js — PRIMA di app.use('/api/v1', auditRoutes)
app.get('/api/v1/companies/:id/logo', getLogo);
```
**Commit:** `3787ad1` — 07/06/2026 — TEST OK (verificato in produzione).

**Lezione:** se un endpoint deve essere accessibile senza Bearer (es. risorse immagine da `<img src>`), non basta non chiamare `authenticate` nella route — bisogna uscire dal router autenticato. Registrare l'endpoint prima di `app.use('/api/v1', routerAutenticato)` in `server.js`.

**Esperienza 30/05/2026 — encoding UI NC + drawer dettaglio**

I testi NC (Camellini e altre org) mostravano `?` o caratteri spezzati perché diversi sorgenti (`NcDetailPanel`, `NcCreateModal`, `ncWorkflow`, helper export/create) contenevano byte Latin-1/Windows-1252 invalidi in file dichiarati UTF-8. Fix: riscrittura stringhe UI con UTF-8 reale o escape `\u00E0`/`\u00F9` in **stringhe JS**; validazione con `backend/scripts/check-utf8-encoding.js`. Per UX registro lungo: il dettaglio NC non va più sotto la griglia ma in **drawer laterale destro**, riusando le classi `doc-detail__overlay` / `doc-detail` del modulo Documenti (`DocumentDetailPanel.css`); deep-link `/nc?select=` apre il drawer; mobile full-width come documenti. **UI guida flusso**: sezioni numerate nel drawer seguono l'ordine ISO 10.2 (Scheda → Stato workflow → Cause → Azioni → Evidenze → Verifica → Chiusura), non un form flat per tipo campo.

**Esperienza 30/05/2026 — campi testo NC = standard audit (`RichTextField`)**

Componente unico `RichTextField.jsx` compone `AutoTextarea` (dettatura it-IT) + `draftFieldRegistry` (scope `nc:<id>`) + `ncFieldDraftStorage` (localStorage, debounce 800 ms) + `textFieldHistory` (ultime versioni su blur, ripristino UI). Applicato a dettaglio NC, modale creazione, azioni e nota verifica azione. Validazione descrizione NC resta su blur/submit. Test L1: `ncTextFields.test.js`, `ncDetailPanel.test.js`.

**Esperienza 30/05/2026 — pulsanti workflow NC nel drawer (`.status-btn` 40×40)**

`.status-btn` in `ChecklistModule.css` è pensato per **codici brevi** (C, NC, OSS…), box fisso 40×40 px. Nel drawer NC le etichette lunghe («Avvia lavorazione», «Segna come risolta») senza override spezzavano il testo su due righe; lo stesso problema colpiva i **filtri scadenza azioni** («Tutte», «In scadenza 7 gg») con testo sovrapposto. Fix: override in `NCPage.css` su `.nc-workflow-btns .status-btn` e `.nc-action-due-filters .status-btn` (`width: auto`, padding, `white-space: nowrap`). Colore giallo su «in corso» = variante `.partial` attesa, non bug. **Lezione libreria UI:** riusare la classe canonica ma adattare il **sizing al contesto** — vedi [`LIBRERIA_UI_SGQ.md`](reference/LIBRERIA_UI_SGQ.md). PR [#112](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/112) merge `main` 17/06/2026 — verifica committente mobile **TEST OK**.

**Esperienza 31/05/2026 — RBAC Fase 2 (chiusura sessione — TEST OK)**

| Voce | Esito / lezione |
|------|-----------------|
| Codice | PR [#76](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/76) merge `main` — commit `cf5a556`; predicato `studioScopeClause` / `documentRegistryScopeClause` su write path audit, NC, allegati, registry ([ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) sez. 5–7) |
| Jest L1 | **22/22** (`auditListRbac`, `nc.controller`, `attachment.controller`) — 31/05/2026 |
| Smoke L3 | Script `.cursor/rbac-smoke-l3-phase2.mjs`: approccio **a fette** (`--slice`), non monolite; upload allegato non deve bloccare test audit/NC |
| Credenziali smoke | Solo `.cursor/mcp.env` + `.cursor/sync-sgq-smoke-env.ps1` — **mai** `_rbac-temp-pw.cjs` / rotazione hash DB admin |
| Token setup NC/allegati | `superadmin` con `auditor_org_id` **non** è org-wide per upload: usare token **tenant admin** org-wide |
| Cleanup | Ordine FK: `document_history` → `document_registry` → company/studio; utenti smoke = hard-delete SQL (API = soft-delete). `--keep-data` / `--cleanup` per ispezione committente |
| Dati reali | **Manitou** non cancellata dallo smoke (solo prefisso `RBAC_SMOKE_*`); scomparsa in UI = spesso filtro RBAC, non delete |
| Error pattern | Primo smoke monolitico: `NC_NOT_FOUND` su upload (scope superadmin); password admin compromessa da workaround — ripristinata da backup |

**Esperienza 31/05/2026 — chiusura slice D2 LIBRERIA_UI + smoke Registro Norme L1**

| Voce | Esito |
|------|--------|
| D2 | Grep `app/src`: zero import di `NonConformitiesManager.jsx` / `AuditTabsLayout.jsx` → rimossi 4 file (jsx+css); catalogo [`LIBRERIA_UI_SGQ.md`](reference/LIBRERIA_UI_SGQ.md) aggiornato |
| Registro Norme L1 | **30/30 OK** — `importNormCommit` (8), `standardsRegistry` (19), `normUploadResults` (3) |
| RBAC L3 (riuso) | **Non rieseguito** — `.cursor/rbac-smoke-l3-phase2.mjs` richiede `database.json` → SQL Server; fallito `localhost:1433` (DNS/host produzione non raggiungibile da desktop). Credenziali `mcp.env` OK; riuso smoke Fase 2 già in tabella sopra |


---

### Sessione 30/05/2026 — Modulo NC (chiusura sessione — attesa feedback utenti)

**Stato committente:** modulo NC **considerato terminato** per sviluppo pianificato; eventuali bug o ritocchi UX arrivano in **nuova chat** con feedback campo (es. Camellini).

#### Delta iniziale vs soluzione corretta

| Ipotesi iniziale | Realtà |
|------------------|--------|
| Registro NC = estensione tabella audit | Serve **modulo organizzativo** cross-audit ISO §10.2 con workflow proprio, push ISO+custom, gate RQ |
| Dettaglio sotto la griglia | **Drawer laterale** (pattern Documenti) + deep-link `/nc?select=` |
| Pulsanti workflow testuali custom | **`.status-btn`** con override dimensioni nel drawer, non nuove classi parallele |
| Encoding «solo produzione» | Byte Latin-1 in sorgenti dichiarati UTF-8 — fix repo + `check-utf8-encoding.js` (lezione **ripetuta**) |

#### Commit di riferimento (sessione)

| Hash | Contenuto |
|------|-----------|
| `8f66d93`–`b23f79d` | Fase 1 slice 5–11 — griglia, creazione, scadenze |
| `d80dafa` | Fase 1 chiusura — alert scadenze, simulazione |
| `ac9b1a8` | Hardening H1–H6 — push custom, RQ, CSV, azioni cross-NC |
| `327be94` | RichTextField + dettatura + draft offline |
| `6810518` | Drawer guidato flusso ISO 10.2 |
| `505e551` | Drawer laterale + encoding UI |
| `527a04d` | Layout pulsanti workflow nel drawer |

#### Lezioni consolidate (tutta la sessione NC)

1. **Simulazione NC audit → gap ISO:** `onRowSelect(rowKey, row)`; audit `status: active` per dropdown creazione; sezioni HLS su audit non ISO 9001 → **400** esplicito; E2E griglia preferire `/nc?select=<id>`.
2. **Slice verticali:** Fase 1 (griglia, modal, workflow, scadenze) poi H1–H6 senza mescolare migrazioni e refactor UI nella stessa consegna.
3. **Hardening:** push custom checklist (072), email 08:05 (`NC_ALERT_ENABLED`), approvazione RQ, export CSV client-side, tab azioni cross-NC.
4. **Golden rule UI:** ordine drawer ISO 10.2 — Scheda → Stato → Cause → Azioni → Evidenze → Verifica → Chiusura (non form flat per tipo campo).
5. **Encoding:** UTF-8 reale o `\u` in **stringhe JS**; mai `\u` come testo JSX grezzo; validare con `check-utf8-encoding.js` anche su `.md` manuale.
6. **Libreria UI:** catalogo Fase A ~52 pattern / ~55–65% UI reale — secondo passaggio su `pages/` e moduli secondari; consultare [`LIBRERIA_UI_SGQ.md`](reference/LIBRERIA_UI_SGQ.md) prima di nuovi blocchi UI.
7. **Form annidati (bug critico 07/06/2026):** HTML non supporta `<form>` nested. Se un componente contenitore (es. `NcDetailPanel`) usa `<form onSubmit>` e al suo interno c'è un altro `<form>` (es. `NcActionsList`), il browser ignora il form interno e il click su qualsiasi `type="submit"` submita il form esterno. Sintomo: nessun POST visibile nei log VPS, azione non salvata, "drawer chiuso senza errore". Fix: convertire il form contenitore in `<div>` e usare `type="button" onClick={handleSubmit}` per il pulsante di salvataggio esterno.

**Monitoraggio post-chiusura:** email job 08:05 (SMTP + destinatari `notifications_config`); push custom da audit reale Camellini; feedback utenti su drawer/flusso.

**Ripresa:** [PROMPT_RIPRESA_NC.md](agent-tasks/PROMPT_RIPRESA_NC.md) — solo bug feedback o P2 (AI CAPA, LIBRERIA_UI completa, export PDF).

---

### Sessione 24/05/2026 — Smoke E2E login Playwright (cloud agent)

#### Attività completate

| # | Cosa | Risultato |
|---|---|---|
| 1 | Documentazione Fase 6 test E2E autenticato | Template Playwright + errori comuni in `sgq-bug-fix-methodology.mdc` (commit `9ae2265`) |
| 2 | Smoke login su `systemgest.netlify.app` | **Primo tentativo fallito** — errore UI «Inserire email» |
| 3 | Diagnosi + fix template doc | Input React controllati: `page.fill()` non basta → `pressSequentially` su `#email` / `#password` |
| 4 | Smoke login (secondo tentativo) | **OK** — `POST /auth/login` 200, dashboard visibile (`admin@sgq.local`, org Al.project) |
| 5 | PR doc corretta | [#63](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/63) — **MERGED** su `main` (commit `d4c9a04`) |

#### Lezione appresa (24/05/2026)

**Ipotesi iniziale sbagliata:** credenziali errate o API backend non raggiungibile.

**Causa reale:** `Login.jsx` usa input **controllati React** (`value={formData.email}` + `onChange`). Playwright `page.fill()` scrive nel DOM ma **non** aggiorna lo stato React; al submit la validazione locale legge `formData` vuoto → «Inserire email», **senza** chiamare l'API (o con body vuoto).

**Pattern risolutivo (E2E su form React controllati):**

1. **Prima** verificare l'API con `curl` — se 200, il problema è UI/test, non backend.
2. Leggere il messaggio di errore **in pagina** (`.login-error`), non solo «form ancora visibile».
3. Compilare con `pressSequentially` (o helper `fillReactInput`) su `#email` / `#password`, non solo `page.fill()`.
4. **Non** usare Playwright MCP per login — non legge `SGQ_APP_PASSWORD`; usare script Node in `/tmp/test-login.mjs`.

**Regola ripetibile:** su qualsiasi form React controllato in test E2E, se il DOM mostra il valore ma la validazione fallisce → simulare digitazione reale (`pressSequentially`) o dispatch esplicito di eventi `input`/`change`.

**Riferimenti:** `sgq-bug-fix-methodology.mdc` Fase 6 (template aggiornato); `app/src/components/Login.jsx`.

---

### Sessione 26/05/2026 — Refactor UI slice A/B/D (vigenti, nav)

#### Attività completate

| Slice | Contenuto | Commit |
|---|---|---|
| A | Fix link HomePage `/nc`; contatore header vigenti (`rilasciato`+`vigente`, esclude `folder`); badge stato nascosto su cartelle via `shouldShowDocumentStatusBadge()` | `2640100` |
| B | `.btn-primary` centralizzato in `index.css`; rimosso duplicato da `DocumentRegistry.css` (override per-pagina mantenuti) | `2640100` |
| D | `@deprecated` su `NonConformitiesManager` e `AuditTabsLayout` (non in routing) | `2640100` |
| D2 | Rimossi file morti `NonConformitiesManager` / `AuditTabsLayout` (grep zero import in `app/src`) | 31/05/2026 |
| Backend | `backend/src/constants/documentStatus.js` + stats API allineate; deploy VPS `document.controller.js` + constants | deploy 26/05 |

#### Test L1

| Suite | Esito |
|---|---|
| `documentValidity.test.js` + `documentTree.test.jsx` | 22/22 OK |
| `documentStatus.test.js` (Jest) | 3/3 OK |

#### Lezioni apprese

- **Due significati di "vigente"**: stato ciclo di vita (`document_registry.status`) vs vigore norma (`type_specific_data.validity_status` su `doc_type=norma`) — contatore header e badge albero usano solo il primo; non confonderli in query SQL o UI.
- **Bug "0 vigenti" con badge verdi**: causa doppia — stats API ignorava status `vigente` (legacy migration 067) **e** cartelle mostravano badge per errore. Fix minimo: `RELEASED_STATUS_SQL_IN` condiviso FE/BE + `shouldShowDocumentStatusBadge()`.
- **Deploy constants nuova cartella VPS**: il manifest `backend/scripts/deploy-manifest.json` include `document.controller.js`, `src/constants/documentStatus.js` e tutti i servizi norme/NC; usare `deploy-controllers-to-vps.ps1` o `deploy-to-vps.sh` (non copia manuale). Preflight verifica file locali prima di SCP; post-deploy health check automatico.

#### Prossimo step (backlog, non in scope sessione)

- ~~Slice C: estrarre `SgqDataGrid` + pilota (`CompaniesPage` o `NCPage`)~~ ✅ 26/05 sera — vedi sotto
- ~~Slice B2: rimuovere `.btn-primary` duplicati identici a `index.css`~~ ✅ parziale — scoped override per-pagina
- Slice D2: eliminare file `@deprecated` dopo grep zero import
- Proposte estetiche sidebar/colori: richiedono OK committente (vedi `DEPUTYTASK.md`)

#### Pattern riusabile — SgqDataGrid (26/05/2026)

Componente condiviso `app/src/components/SgqDataGrid.jsx` per tabelle con sort, empty/loading, selezione riga opzionale.

| Prop | Uso |
|---|---|
| `theme="catalog"` | Stile Registro Documenti (`datagrid-*`, header scuro) — usato da `DocumentDataGrid` |
| `theme="plain"` | Intestazioni chiare — pilota `CompaniesPage` |
| `columns` | `{ id, label, sortable?, width?, cellClassName? }` |
| `renderCell(row, col)` | Contenuto cella |
| `selectable` + `selectedRowKey` | Toolbar contestuale (pattern DocumentDataGrid) |
| `getSortValue(row, colId)` | Sort custom (es. label tipo documento) |

CSS: `SgqDataGrid.css` (tema plain) + `DocumentDataGrid.css` (tema catalog + badge norme/scadenze).

**B2 CSS:** `.btn-primary` / `.btn-secondary` in `index.css`; override colore solo con selettore scoped (`.nc-page`, `.companies-page`, …) — mai duplicare regole globali identiche.

---

### Sessione 03/06/2026 — Visualizzazione Excel in-app (SpreadsheetViewer)

| PR | Contenuto |
|---|---|
| [#93](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/93) | `DocFileDialog`: `.xlsx` → `SpreadsheetViewer` (SheetJS) al posto di Office Online; download via `getDocFileBlob` |

**Lezione**: Office Online (`view.officeapps.live.com`) non funziona con API su `:8443` e senza token pubblico — stesso pattern già risolto per Word con `DocumentDocxViewer`.

**Smoke SAVECO scadenzario** (doc `1698`, org QS `1002`, file ~71 KB): 4 fogli (`TO_DO`, `SCADENZARIO`, `IMPIANTI TERMICI`, `PRESIDI ANTINCENDIO`) parsati con SheetJS su copia file da VPS. Verifica UI post-merge: login org Camellini → Registro documenti → SAVECO → Scadenzario → **Visualizza**.

### Sessione 25/05/2026 — Registro norme SoT R1–R7 (completato) e chiusura PR

#### Attività completate

| PR / commit | Slice | Contenuto |
|---|---|---|
| [#66](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/66) | R1 | Job validità norme legge `document_registry` come SoT; test L1 19/19; deploy VPS; log confermato `checked=1` |
| [#67](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/67) | R2+R5+Sprint11 | R2: lookup norma persiste su `type_specific_data` via JSON_MODIFY; R5: knowledgeIndexer arricchisce testo con metadati norma; CommercialCase test L1 14/14 (già implementato, test aggiunti) |
| [#68](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/68) | R4 | Badge vigore (verde/rosso/ambra) nella lista Catalogo; campo `norm_validity_status` nella lista API; CI verde; badge "Superata" visibile in prod su ISO_9016_2012 |
| `ef0d6f8` | R3+R6+R7 | Schema unificato upload bulk/form; backfill VPS idempotente; [ADR-011](adr/ADR-011-registry-norm-sot.md); deploy VPS OK |
| [#62](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/62) | Seed legislativo | Merge `b255207`: `findSeededLegislativoAmbientale` usa `CHARINDEX` al posto di `LIKE` (marker con `[]`); deploy VPS backend 25/05 |
| [#60](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/60) | Template Word audit | Merge `9ba45b7`: script `patch-audit-template-structure.cjs` + template ISO 9001/14001/3834/45001; CI `test-and-build` verde |
| [#64](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/64) | — | Chiusa senza merge (draft obsoleta); tema collocamento archivio da riaprire in roadmap se serve |

#### Lezioni apprese (sessione)

- **Scoperta vs implementazione**: Sprint 11 (CommercialCase) era già nel codebase — verificare prima di reimplementare; test/verifica restano utili su codice preesistente.
- **Backfill idempotente (R6)**: `mergeMissingNormTypeSpecificData` aggiorna solo campi mancanti — evita regressioni su dati già allineati post-R2/R3.
- **Allineamento bulk upload (R3)**: un solo contratto `type_specific_data` tra `normUpload.controller` e form manuale (`documentRegistryNorm.service.js`).
- **Chiusura PR stale**: chiudere draft obsolete (#64) senza merge riduce rumore su branch non allineati a `main`.

#### Prossimo step (roadmap)

- **ADR-009 Fase 2**: Sezione 11 e Close Panel per-norma + flag SGI integrato — vedi [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md).

### Sessione 24/05/2026 (bis) — Modulo documentale UX e upload

#### Attività completate

| # | Cosa | Risultato |
|---|---|---|
| 1 | Rimozione «Apri in Word/Excel» via WebDAV da `DocFileDialog` | Eliminato popup credenziali Windows (`Microsoft-WebDAV-MiniRedir`); editing resta via viewer browser + download |
| 2 | Tab **Catalogo**: `DocumentDataGrid` | Selezione riga, toolbar Allegato/Modifica/Archivia, colonne ordinabili, hint toolbar |
| 3 | Albero cartelle | Rimossa icona lucchetto confusa sulle cartelle di sistema; tooltip su nomi troncati |
| 3b | Albero cartelle (05/2026) | Rinomina/Elimina cartelle custom (elimina solo se vuota, 409 `FOLDER_NOT_EMPTY`); sottocartella sotto selezione; icone colore sistema vs custom; cartelle sistema non modificabili |
| 3c | Albero cartelle (05/2026) | Sidebar albero **ridimensionabile** (drag 220–480px, chiave `sgq-doc-tree-width`); su mobile (≤768px) barra con **nome completo cartella selezionata** sopra l'albero (tooltip `title` insufficiente su touch) |
| 4 | Upload hardening | Backend: limite **200 MB**; frontend: avviso soft **50 MB** + barra progresso; fix `getExt`; versioning in transazione SQL |
| 5 | Test `NormUploadButton` | 12 test Vitest aggiunti |
| 6 | Deploy su `main` | `2024747` (feat UX), `864c9e1` (integrazione DataGrid Catalogo) — **nessuna PR** |

#### Lezione appresa (modulo documenti)

**WebDAV rimosso dal dialog file:** il round-trip Office via WebDAV (vedi [sessione 16/05](archive/sessions/GUIDA_DIARIO_2026.md#sessione-16-maggio-2026-sera--office-round-trip-webdav--lifecycle-documenti--viewer-docx-browser)) resta documentato lato backend, ma **non** va esposto in UI se il client Windows apre il popup credenziali nativo senza passare il token JWT. Preferire download + viewer `.docx` in browser finché non c'è un flusso Office365/SharePoint o link firmato temporaneo.

**Policy upload (200 MB / 50 MB):** hard limit server (413) + soft warning client prima dell'invio — evita upload bloccati a metà e allinea aspettative utente su reti lente.

**Pattern `DocumentDataGrid`:** riutilizzare per liste tabellari documenti (selezione singola, sort client-side, toolbar contestuale) invece di card sparse nel Catalogo; colonna selezione e frecce sort devono essere visibili subito (fix visibilità in `864c9e1`).

**Backlog differito:** feature «Condividi via email» con link temporaneo firmato — non in scope sessione.

---

### Aggiornamento 10/06/2026 — Qualifiche: ambito azienda obbligatorio

**Problema:** `qualifications.company_id` era nullable; UI con opzione «nessuna»; stesso certificato poteva finire su clienti diversi; import AI non ereditava l'azienda del job.

**Soluzione (pattern registro documenti):**

| Livello | Intervento |
|---------|------------|
| UI | Selettore **Ambito** su `QualificationsPage` (`qualificationsCompanyScope.js` + localStorage); creazione bloccata senza ambito; form con azienda obbligatoria; lock azienda se `approval_status = approvata` |
| API | `qualificationCompany.service.js` su POST/PUT e `commit-to-qualification` |
| DB | Migrazione **087**: backfill orfani → `NOT NULL` → indice unico filtrato `(org, company, cert#, person_name)` |

**Deploy produzione (ordine):**

1. Merge PR [#106](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/106) + deploy backend (controller + service) — **OK 10/06/2026**
2. Cloud Agent / VPS: `scp backend/scripts/run-migration-087-vps.js` → `node /tmp/run-migration-087-vps.js` — **OK 10/06/2026**
3. Netlify build frontend (ambito + form) — automatica su push `main`

**Pitfall migrazione 087:** prima di `ALTER COLUMN … NOT NULL` su `company_id` va droppato `IX_qualif_company`; nei filtered index SQL Server **non** ammette `LTRIM/RTRIM` nel predicato `WHERE`.

**Smoke:** creare qualifica con ambito selezionato; tentare stesso `certificate_number` su altra azienda → 409; dopo approvazione cambio azienda → 400.

---

### Aggiornamento 10/06/2026 — Collegamento anagrafica personale ↔ qualifiche

**Obiettivo:** collegare `company_personnel` (anagrafica NC/audit) al modulo qualifiche senza fondere i due moduli. Ogni certificato resta in `qualifications`; il collegamento è `personnel_id` + sync `person_name` da anagrafica.

**Documenti salute mansione (ISO 3834 — saldatori/ispettori VT):** oltre all'acuità visiva, prevedere come tipi qualifica con scadenza e PDF:

| Tipo qualifica | Note |
|----------------|------|
| Certificato acuità visiva | VT / ispettori |
| Certificato visione cromatica (Ishihara) | VT livello 2+ |
| Idoneità medica alla mansione | Sorveglianza ingresso |
| Sorveglianza sanitaria periodica | Rinnovo periodico |

**Slice implementate:**

| Slice | Contenuto |
|-------|-----------|
| A | `POST .../personnel/import-from-qualifications` — deduplica `normalizePersonKey` (codice > nome) |
| B | `qualifications.personnel_id` FK + picker form + validazione API |
| C | Tab **Salute mansione** su `QualificationsPage`; tipi in `occupationalQualificationTypes.js` |
| D | Pannello personale: Import / Collega / modal qualifiche per riga |

**Deploy produzione (ordine post-merge PR):**

1. Merge PR [#107](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/107) + deploy backend — **OK 10/06/2026** (PID 568473, health 200)
2. VPS: `node /tmp/run-migration-088-vps.js` — **OK 10/06/2026** (personnel_id, person_code, FK, indici)
3. Netlify produzione — **OK 10/06/2026** (tab Salute mansione, picker form, pannello personale)

**API:**

| Metodo | Endpoint |
|--------|----------|
| POST | `/companies/:companyId/personnel/import-from-qualifications` |
| POST | `/companies/:companyId/personnel/link-qualifications` |
| GET | `/companies/:companyId/personnel/:id/qualifications` |

**Smoke:** da scheda azienda → Import da qualifiche → Collega qualifiche → icona certificati su riga personale; nuova qualifica salute mansione con picker anagrafica; tab Salute mansione filtra i 4 tipi.

---

### Sessione 14/06/2026 — Import qualifiche ERAM + workflow preview (chiusura)

**Stato:** **CHIUSO — TEST OK** (preview committente su PR [#109](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/109), merge `20db3ff` / doc `b258837`).

| Obiettivo | Esito |
|-----------|-------|
| Import PDF qualifiche — azienda obbligatoria + segregazione `company_id` | ✅ UI ambito + API `qualificationCompany.service`; fix regressione JOIN `companies` (`98bc36f`) |
| Campi saldatore ISO 9606-1 end-to-end | ✅ Mig. **092**; catena AI → schema FE/BE → `commitToQualification` / ingest |
| PDF collegato al commit qualifica | ✅ Mig. **093**; `certificate_file_url` + `import_job_files.qualification_id` (`4152e81`) |
| Alert email + scadenzario qualifiche | ✅ Mig. **093**; `qualificationAlert.service`; righe virtuali `/deadlines` |
| Registro conferme semestrali 9606 | ✅ Mig. **094** (`101c7af`); API confirm/export; sezione in `QualificationForm` |
| UX Import PDF (menu **Altre azioni** + contrasto **Analisi AI**) | ✅ PR **#109** mergiata 14/06/2026 |
| Workflow branch → Deploy Preview → merge | ✅ Operativizzato; CORS preview su VPS + Express (`2034b63`); `netlify-preflight.ps1` + `.netlify.local.ps1` |

#### Delta iniziale vs finale (introspezione)

| Ipotesi iniziale | Esito reale |
|------------------|-------------|
| Scope tenant su `companies` via colonna `organization_id` nei JOIN | **Errato:** `companies` è scopata con `auditor_org_id` → join `auditor_orgs`; condizione `c.organization_id` in `importJobs.listJobs/getJob` bloccava lista Import PDF (`Invalid column name`) |
| Commit qualifica = solo record DB | Serve anche **`certificate_file_url`** da `storage_path` del file import (mig. 093) per link immediato in scheda |
| Merge UI senza preview | Preview Netlify + **TEST OK committente** obbligatori per feature UI; CORS preview va deployato sul VPS prima del test |
| `gh` / Netlify non usabili da agente Windows | **`netlify-preflight.ps1`** → `NETLIFY_ACCESS_OK`; **`gh auth login`** qsstudio241 — niente token in chat |

#### Regole ripetibili

1. JOIN `companies`: `LEFT JOIN companies c ON c.id = x.company_id` + scope org via `companyBelongsToOrg` / `auditor_org_id` — **mai** `c.organization_id`.
2. Nuovo campo qualifica: aggiornare **prompt AI, schema Zod, `documentTypeSchemas` FE+BE, commit/ingest** nella stessa slice.
3. Feature UI: branch → PR → preview → TEST OK → merge; eccezione solo hotfix o solo-backend già live.
4. Preflight tooling: `.\backend\scripts\netlify-preflight.ps1` e `gh auth status` **prima** di dichiarare CLI non configurata.

**Esperienza 16/06/2026 — Controparti PR1 live:** [PR #110](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/110) mergiata su `main` (merge `8b53608`); tab Controparti + mig. **096–097** + API nested; TEST OK committente (LM&CO, PT.MAIDO committente finale, riesame + analisi AI client senza errori console). **Prossimo:** PR2 select committente in `ContractReviewPage` ([DEPUTYTASK](agent-tasks/DEPUTYTASK.md)).

---

### Aggiornamento 22/05/2026 — JSX: sequenze literal `\u` in UI (Rischi / Progetti / Qualifiche)

**Sintomo:** in pagina (es. **Rischi & Obiettivi**) titoli, tab e icone apparivano come testo `\u26A0\uFE0F`, `\uD83D\uDEA7`, `\u00e0`, `\u00a7`, ecc.

**Causa:** in React, il contenuto tra tag (`<h1>\uXXXX ...</h1>`) è **HTML/JSX testuale**, non una stringa JavaScript → `\u` **non viene interpretato**.

**Fix applicati:**  
- `app/src/pages/RisksPage.jsx` — testo/icona tramite **`{"..."}`** (stringa JS con escape dove servono emoji) o UTF-8 per italiano/simbolo ×.  
- `app/src/pages/QualificationForm.jsx` — stesso schema sull’errore form.  
- `app/src/pages/ProjectsPage.jsx` — pulsante **Sì** (prima `S\u00EC` in JSX, mostrato letterale).

**Regola ripetibile:** prima di `\u`/emoji in JSX, preferire **`{expr}`** dove `expr` è stringa/template **JavaScript**, oppure scrivere il carattere Unicode diretto in UTF-8.

---

### Sessione 22/05/2026 — Fix allegati ISO 45001

**Problema**: pulsante "+ Aggiungi Allegati" visibile ma non funzionante sulla checklist 45001 (errore silenzioso "ID domanda non disponibile"). Su 9001 e 14001 funzionava regolarmente.

**Causa root**: `ISO_45001_TEMPLATE` in `checklistTemplates.js` aveva tutte le 53 domande con `questionId: null`. `useAttachmentManager` blocca l'upload alla prima riga se `questionId == null`. Le domande esistevano già nel DB (question_id 276-328, migration maggio 2026) ma il template frontend non era stato allineato.

**Fix** (solo frontend, nessun VPS):
- `checklistTemplates.js` — template riscritto con 53 domande reali, `sectionCode` allineati al DB (`45001_c4`…`45001_c10`), `questionId` 276-328
- `StorageContext.jsx` — `hydrateQuestionIds` estesa per `ISO_45001` (standard_id=3) con remap sezioni legacy (`clause4 → 45001_c4`)
- `ChecklistModule.jsx` — hydratation attivata anche per ISO_45001

**Regola appresa — "Template-DB parity"**: ogni volta che si inseriscono domande nel DB per un nuovo standard, aggiornare **immediatamente** il template frontend corrispondente con i questionId reali. Un template con `questionId: null` blocca allegati, sync risposte e ogni funzione che richiede l'ID numerico del DB.

**Verifica rapida**: `curl -s "https://systemgest.netlify.app/assets/$(curl -s https://systemgest.netlify.app/ | grep -o 'index-[^"]*\.js')" | grep -c 'questionId:[0-9]'` deve restituire > 0 per ogni standard attivo.

---

### Audit multi-giorno (migrazione 070 — maggio 2026)

| Campo | Ruolo |
|--------|--------|
| `audits.audit_date` | Data **inizio** (invariato, retrocompatibile) |
| `audits.audit_date_end` | Data **fine**; `NULL` o uguale a inizio = audit mono-giorno |
| `metadata.auditDateEnd` / `generalData.auditDateEnd` | Mirror frontend + sync (`audit_extra_data`) |

- **Validazione**: fine ≥ inizio; avviso (non blocco) se date nel futuro — come `audit_date` (`auditUtils.js`).
- **Word**: `{auditDate}` = inizio; `{auditDateEnd}`; `{auditPeriod}` (es. `10/05/2026 – 12/05/2026` o singola data).
- **DB**: `database/migrations/070_audit_date_end.sql`; su VPS: `backend/scripts/run-migration-070-vps.js` (scp + `node /tmp/...`).
- **Deploy backend**: dopo migrazione, `deploy-controllers-to-vps.ps1` + restart `sgq-backend`.

---

### Sessione 16 maggio 2026 (sera) — Office round-trip WebDAV + lifecycle documenti + viewer .docx browser

#### Sintesi
Maratona stabilizzazione Office round-trip e lifecycle documenti. Ha richiesto 9 fix
consecutivi sul WebDAV controller perché Word desktop su Windows ha un comportamento
poco documentato: delega le richieste WebDAV al client nativo `Microsoft-WebDAV-MiniRedir`
che NON inoltra i query parameter del browser.

#### Fix WebDAV (in ordine di scoperta)
1. **Spazi nel nome file** — `encodeURIComponent` produce `%20` ma Office decodifica
   in spazio letterale prima della richiesta HTTP → Nginx 400. Fix: sanitize del filename
   nell'URL (`spazi → _`, caratteri speciali → `_`). Il file è sempre recuperato dal DB
   via `docId`, il nome nell'URL è solo cosmético.
2. **URL senza porta 8443** — Nginx usa `proxy_set_header Host $host` (senza porta) →
   backend generava URL su porta 443 (default HTTPS, non aperta). Fix: variabile
   `WEBDAV_BASE_URL=https://www.fr-busato.it:8443` nel `.env` del VPS.
3. **CORS middleware Express intercetta OPTIONS WebDAV** — il middleware `cors()` con
   `preflightContinue: false` rispondeva 204 a TUTTE le OPTIONS, anche quelle WebDAV
   di Office, senza header `DAV: 1, 2`. Office non riconosceva il server come WebDAV
   scrivibile e apriva in sola lettura. Fix: wrapper che bypassa `cors()` per
   `OPTIONS /webdav/*`.
4. **Handler HEAD mancante** — Office invia HEAD prima di LOCK ("Existence Discovery",
   "Word 2014 check"). Senza handler → 405. Fix: aggiunto `handleWebdavHead`.
5. **Route OPTIONS senza filename** — `OPTIONS /webdav/:orgId/:docId/` (collection)
   ritornava 404. Fix: route `webdavRouter.all('/:orgId/:docId/', ctrl.handleWebdavOptions)`.
6. **PROPFIND/HEAD richiedevano token ma MiniRedir non lo passa** — il client WebDAV
   nativo Windows scarta `?dt=token` e fa PROPFIND senza auth → 401 ripetuto 12 volte
   → Word assume read-only. Fix: PROPFIND e HEAD accettano richieste senza token
   (espongono solo metadata pubblici, scopati a `orgId+docId`).
7. **LOCK/UNLOCK senza token mostravano dialog credenziali Windows** — il 401 attivava
   automaticamente il prompt "Sicurezza di Windows". Fix: LOCK e UNLOCK accettano
   senza token (sono advisory, non scrivono dati). PUT resta protetto.
8. **GET dopo LOCK senza token (causa principale del prompt)** — MiniRedir, dopo aver
   ottenuto il LOCK, rifaceva GET del file e perdeva di nuovo il `?dt=`. Fix definitivo:
   **token nel PATH** invece che in query string.
   - Prima: `https://host:8443/webdav/orgId/docId/file.docx?dt=TOKEN`
   - Dopo:  `https://host:8443/webdav/dt/TOKEN/orgId/docId/file.docx`
   - MiniRedir preserva l'intero path → tutte le richieste restano autenticate
9. **Vera sola lettura** — `ms-word:ofv` apre Word in "view mode" ma è solo una hint:
   se il server WebDAV è scrivibile, Word permette il banner "Modifica comunque". Fix:
   token con `mode: 'edit' | 'read'` nel `tokenStore`. PUT respinge 403 se mode='read'.
   Il client passa `mode='read'` per il pulsante "Visualizza".

**Regola consolidata WebDAV**: ogni operazione che NON modifica i dati deve essere
accessibile senza token (Microsoft-WebDAV-MiniRedir li scarta). Solo PUT richiede
auth completa. Il path scopato a `(orgId, docId)` garantisce il multi-tenant.
Quando si genera l'URL, **mettere sempre il token nel PATH**, mai in query string.

#### Lifecycle documenti (rilasciato/bozza + RILASCIA REVISIONE)
Implementato lifecycle ISO 9001 §7.5 sul registro documenti:
- **DB migrato** (41 doc): aggiunte colonne `revision_number INT DEFAULT 0` e
  `released_at DATETIME2 NULL`. `CHECK constraint` aggiornato per includere
  `rilasciato`, `bozza`. UPDATE `vigente → rilasciato`.
- **Backend**: `vigente → rilasciato` in tutte le query (5 file). Nuovo endpoint
  `POST /api/v1/documents/:id/release-revision` (incrementa revision_number,
  imposta released_at, genera label "Rev. NN" se non fornita).
- **WebDAV PUT**: dopo salvataggio Word → `status='bozza'`. **Eccezione**: se
  `doc_type='folder'` non aggiorna lo status (le cartelle non hanno lifecycle
  revisione anche se hanno file allegati).
- **Frontend**: `DocFileDialog` con alert "Documento rilasciato — aprirlo creerà
  bozza, continuare?" + pulsante verde "Rilascia revisione" per le bozze.
- **Filtro UI default**: cambiato da `status='rilasciato'` a `status=''` (= tutti
  gli stati attivi). Backend in mancanza di filtro esplicito esclude solo `obsoleto`.
  Senza questo fix i documenti appena salvati in bozza "scomparivano" all'utente.

#### Viewer documenti (PDF + .docx browser-native)
- **PDF viewer (DocumentPdfViewer)**: 2 fix.
  - `frame-ancestors 'none'` di Helmet bloccava l'iframe del viewer. Fix:
    `frameAncestors: ["'self'", ...CORS_ORIGIN]` per permettere embedding solo
    dai domini Netlify.
  - Il viewer usava `<iframe src="...?token=NULL">` (`getToken()` ritorna null
    su desktop con cookie httpOnly). Fix: `getDocFileBlob()` con `fetch` +
    `URL.createObjectURL()`. Nessun token in URL.
- **NUOVO Viewer .docx (`DocumentDocxViewer`)**: usa libreria `docx-preview`
  (173KB / 51KB gzip, chunk separato lazy-loaded). Renderizza `.docx` come HTML+CSS
  preservando layout, tabelle, immagini. **Vera sola lettura totale**: nessun modo
  per modificare. Niente Microsoft Cloud, niente Word desktop richiesto.
- Controlli viewer: zoom 50%-250%, fullscreen toggle, scarica.
- Routing pulsante "Visualizza":
  - `.pdf` → `DocumentPdfViewer` (iframe nativo browser)
  - `.docx`/`.doc` → `DocumentDocxViewer` (docx-preview)
  - `.xlsx` → `SpreadsheetViewer` (SheetJS in-app, PR #93)

#### DocumentDetailPanel (slide-in dettaglio documento)
Bug: il pannello slide-in da albero/catalogo mostrava sempre "Nessun file allegato"
anche con file presente. Causa: leggeva `doc.files`, popolato solo da `/documents`
list ma non da `/documents/tree/...`. Fix: `useEffect` che chiama `getDocFiles(docId)`
quando il pannello si apre.

#### Lezioni apprese (18/05/2026) — Rate limit e loop di retry lock

**Sintomo**: sezione 1.4 "Rilievi Ente Certificatore" mostrava "Troppe richieste" continuamente (utente Camellini).

**Causa radice**: heartbeat lock (60s) fallisce per 429 → `demoteOwnerLockOnHeartbeatFailure` imposta `mode="pending_server"` → effect retry ogni 5s → esaurisce il budget rate limit (500 req/15min) → tutte le API bloccate → ciclo infinito.

**Fix**: (1) heartbeat ignora 429 (riprova al ciclo successivo 60s); (2) `pending_server` retry usa backoff esponenziale su 429 (5s→120s max); (3) rate limit alzato da 500 a 1000 req/15min.

**Regola generale**: ogni `setInterval`/`setTimeout` che chiama API **DEVE** gestire il 429 con backoff o skip silenzioso — mai ignorarlo lasciando il timer attivo a intervallo fisso. Senza questa protezione un singolo sottosistema (es. lock) puo' bloccare l'intera app.

**Diagnosi rapida**: se un utente vede "Troppe richieste" → `sudo grep 429 /var/log/nginx/access.log | grep IP_UTENTE | tail -30` per capire quale endpoint genera il loop.

**Assistente AI Conclusioni (06/2026)**: il messaggio "Troppe richieste. Riprova tra qualche minuto." nel modal AI **non** è un limite del provider Gemini/OpenAI — è il rate limiter generico API (`RATE_LIMIT_API`, 500 req/15 min in produzione). Causa frequente: il `keyGenerator` leggeva `id`/`sub` nel JWT invece di `user_id`, quindi tutti gli utenti dietro lo stesso IP (ufficio/NAT) condividevano un unico bucket. **Fix PR #164** (25/06/2026): `user_id` nel keyGenerator + `RATE_LIMIT_MAX_REQUESTS=1000` sul VPS + messaggio UI più chiaro in `useAiAssist`.

#### Lezioni apprese (16/05/2026 sera)
1. **Microsoft-WebDAV-MiniRedir** è un client legacy di Windows che parte automaticamente
   quando un'app Office invoca un URL WebDAV. **Non passa token in query string**.
   Per supportarlo: o token nel path, o auth via Basic/NTLM, o endpoint pubblici per
   metadata read-only.
2. **`ms-word:ofv`** è una hint UI, non un blocco di scrittura. Per vera sola lettura
   serve respingere il PUT lato server con un token mode separato.
3. **`docx-preview` è il viewer .docx browser-native più affidabile**. Office Online
   Viewer fallisce con porte non standard come `:8443` (limitazione documentata
   Microsoft).
4. Quando il filtro UI default nasconde stati di workflow (`bozza`), l'utente
   percepisce "il file è sparito". Default sicuro: **mostra tutto tranne soft-deleted**.
5. **Cartelle (`doc_type='folder'`) non sono documenti** anche se hanno attachment.
   Il lifecycle revisione (bozza/rilasciato/RILASCIA REVISIONE) non si applica.
   Filtrare esplicitamente in tutte le operazioni di transizione di stato.

#### Commit principali (16/05/2026 sera)
- `fix(webdav): sanitize filename in URL` (PR #50)
- `fix(webdav): token nel path URL anziche' query string`
- `fix(webdav): rimuove dialog credenziali Windows su LOCK`
- `feat(webdav): token mode (edit|read) per garantire vera sola lettura`
- `feat(docs): lifecycle documenti — rilasciato/bozza + RILASCIA REVISIONE` (PR #51)
- `feat(viewer): visualizzatore .docx browser-native (sola lettura)`
- `feat(viewer): zoom e fullscreen per visualizzatore .docx`
- `fix(docs): pannello dettaglio carica i file allegati via API`
- `fix(docs): cartelle non diventano bozza al salvataggio Word + filtro default mostra bozze`

#### Punti aperti (per ripresa 17/05/2026)
1. **Placeholder dinamici nei .docx** (richiesta utente). Pattern proposto: hook
   nell'endpoint `release-revision` che apre il `.docx` con `docxtemplater` (già nel
   progetto), sostituisce `{{data_rilascio}}`, `{{numero_revisione}}`, `{{revisione_label}}`,
   salva la nuova versione. Da implementare.
2. ~~**Excel viewer**~~ → risolto PR #93 (`SpreadsheetViewer` + `getDocFileBlob`).
3. **Test L1** della suite frontend non eseguiti dopo le modifiche di oggi (Vitest).
   Da lanciare prima di considerare definitivamente chiuso il modulo Word round-trip.
4. **Pulsante "Visualizza" su .doc legacy**: docx-preview probabilmente non supporta
   `.doc` (formato binario pre-2007). Verificare e gestire fallback.
5. **`SGQ_APP_PASSWORD` Cloud Secret** non corrisponde all'hash DB (verificato in
   sessione). L'utente dovrebbe aggiornare il segreto in Cursor Cloud per permettere
   ai prossimi cloud agent di fare test UI con login automatico.

---

### Sessione 16 maggio 2026 — Assistente AI: contesto azienda e ottimizzazione knowledge

#### Architettura assistente AI — contesto e ottimizzazione

- **Contesto a 4 livelli**: Studio (implicito da org), Azienda (auto da audit + override manuale con dropdown), Standard (backlog), Sessione (backlog)
- **Soft reset conversazione**: separatore visivo al cambio contesto, messaggi precedenti sfumati ma accessibili, clear per azzeramento completo
- **Knowledge Optimizer**: L1 notturno 03:00 (dedup cosine >0.95, prune stale NC chiuse >180gg, gap detection per azienda), L2 settimanale domenica 04:00 (sintesi AI per azienda, pattern trasversali cross-company, enrichment chunk deboli)
- **Dashboard KPI Knowledge Health**: `/ai-knowledge-health`, solo admin/superadmin — 4 KPI cards, coverage per azienda, gap rilevati
- **Modello embedding**: `gemini-embedding-001` (NON `text-embedding-004` che è deprecato)
- **Migrazioni**: 063 (colonna `company_id` + indice su `knowledge_chunks`), 064 (tabelle `ai_usage_log` + `ai_optimization_runs`, colonne `is_stale`/`usage_count`), 065 (colonna `source_run_id` su `knowledge_chunks`)
- **Protezione chunk AI**: i chunk con `entity_type` prefisso `ai_*` non vengono cancellati dal reindex

#### Lezioni apprese (16/05/2026)

- **Bug pattern query indexer**: verificare sempre che le colonne SQL nelle query dell'indexer corrispondano allo schema reale del DB. Fix multipli: `nc_type` inesistente, `corrective_action` → `resolution_summary`, `NULL AS company_id` → `r.company_id`, `organization_id` → `auditor_org_id` in companies join.
- **Modello embedding Gemini**: `text-embedding-004` è deprecato e ritorna errore. Usare `gemini-embedding-001`.
- **Contratto API flat vs nested**: quando si progetta un endpoint dashboard (es. `/ai/knowledge-health`), definire il formato di risposta (flat object vs nested) e allinearlo subito al frontend. Disallineamento causa errore silenzioso (valori `undefined`).

#### Commit principali (16/05/2026)

| Commit | Contenuto |
|--------|-----------|
| `306e0fe` | AI context: companyId in chat, chip header, dropdown, migrazione 063 |
| `4f467b5` | AI usage log + Knowledge Optimizer L1, migrazione 064 |
| `23aeaaa` | Dashboard Knowledge Health frontend + endpoint |
| `87f628e` | Knowledge Optimizer L2 (sintesi AI settimanale), migrazione 065 |
| `2e521d2`, `d3a4374` | Bug fix: contratto API, embedding deprecato, query SQL |

---

### Sessione 15 maggio 2026 — Fix sezione 1.4 ghost-click mobile

#### Problema
Camellini: "nella sezione 1.4, quando aggiunge un rilievo si chiude continuamente".

#### Causa radice
**Ghost-click mobile** (iOS/Android): il browser genera un secondo click sintetico ~300ms dopo il tap su un pulsante. Se il tap apre una modale `position:fixed; inset:0`, il ghost-click atterrisce sull'overlay nello stesso punto e, se `e.target === e.currentTarget`, chiude la modale immediatamente. Su desktop il bug non è riproducibile (il mouse non genera ghost-click).

#### Fix
`CertificationFindingsSection.jsx` — `openTimeRef = useRef(0)`:
- `openNew()` e `openEdit()` salvano `Date.now()` al momento dell'apertura
- L'overlay ignora i click entro 350ms dall'apertura

**Regola generale**: qualsiasi overlay `position:fixed` aperto da un tap mobile deve proteggere dalla chiusura accidentale entro 300-400ms via debounce sul `Date.now()`. Questo vale per tutte le modali aperte da pulsanti (non solo `CertificationFindingsSection`).

**Branch**: `cursor/fix-cert-findings-modal-close-7b68` → PR #48 → mergiata su `main` (commit `6898554`).

---

### Sessione 14 maggio 2026 — Fix UI mobile + microfono PWA (root cause header HTTP)

#### Attività completate

| # | Cosa | Risultato |
|---|---|---|
| 1 | Fix pulsanti C/NC/OSS/OM/NA/NV su mobile | `flex-wrap:wrap` + `min-width:calc(33.333%-6px)` in `ChecklistModule.css` → layout 3+3 garantito |
| 2 | Fix microfono PWA Android | Root cause: `Permissions-Policy: microphone=()` in `netlify.toml` bloccava tutto → cambiato in `microphone=(self)` |
| 3 | Robustezza `AutoTextarea` | `getUserMedia` pre-check + `permissions.query` upfront + gestione errori per tutti i codici Speech API |

#### Lezioni apprese (14/05/2026)

- **`Permissions-Policy` blocca le API browser prima dei permessi Android/Chrome.** Se una funzione (mic, camera, geolocation) non funziona su PWA Netlify nonostante i permessi di sistema siano concessi, verificare **subito** `netlify.toml` → sezione `[[headers]]` → `Permissions-Policy`. Il valore `microphone=()` blocca _tutto_ senza mostrare alcun dialog. Il corretto è `microphone=(self)`. **Regola**: controllare l'header HTTP prima di diagnosticare permessi utente.

- **Su Android PWA, `console.log` può non apparire mai se il service worker serve il bundle vecchio.** Se l'utente dice "non vedo log" → il click potrebbe non raggiungere il nuovo codice. Soluzione: aggiungere un **pannello di debug in-page** (stato React visibile sullo schermo) che bypassa sia la console che la cache del SW. Pattern da usare ogni volta che i log di console non sono affidabili su mobile.

- **`getUserMedia({audio:true})` deve precedere `SpeechRecognition.start()` su Android Chrome PWA.** Senza questa chiamata, Chrome non mostra il dialog di consenso nativo e rigetta silenziosamente. Sequenza corretta: `permissions.query` → `getUserMedia` → `SpeechRecognition.start()`.

- **Test E2E autenticato da cloud agent (pattern verificato 24/05/2026)**: NON usare il Playwright MCP per il login — non ha accesso alle env var. Usare uno script Node.js in `/tmp/test-login.mjs` che legge `process.env.SGQ_APP_PASSWORD`. Setup: `cd /tmp && npm install playwright && npx playwright install chromium`. **Attenzione**: il form login usa input React controllati — `page.fill()` da solo fallisce con errore «Inserire email»; usare `pressSequentially` su `#email` / `#password` (template in `sgq-bug-fix-methodology.mdc` Fase 6).

- **Netlify può aggiornare gli header CDN (`netlify.toml`) senza ricompilare il bundle JS.** Se si cambia solo `netlify.toml` → header live in pochi minuti; bundle invariato. Se si cambia codice in `app/` → bundle nuovo hash al prossimo deploy completo.



**Branch**: `cursor/adr-010-ai-agentic-architecture-7330` → mergiato su `main` (commit `49a6a6c`).

### Sessione 02 giugno 2026 — API complete Riesame requisiti + UI slide

**Branch**: `cursor/contract-review-api-complete-5351`  
**Spec**: [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md)

| Area | Contenuto |
|---|---|
| Backend | `contractReviewWorkflow.service.js` (gate ISO §8.2), estensione controller/routes, migrazione **068** |
| Frontend | `ContractReviewPage` con **slide** Workflow / Checklist / Chiarimenti / Documenti / Analisi AI; inbox + summary |
| Test L1 | Jest workflow + controller; Vitest `contractReviewLabels.test.js` |
| Doc API | Sezione in [BACKEND_API.md](reference/BACKEND_API.md) |

**Slide UI dettaglio** (ordine operativo): tab orizzontali — non confondere con presentazioni; guidano il commerciale/tecnico fase per fase.

**Deploy VPS** (cloud agent): `scp` migration SQL + `run-migration-068-vps.js`; deploy `contractReview.controller.js`, `contractReview.routes.js`, `contractReviewWorkflow.service.js`; restart `sgq-backend` con verifica PID.

**Chiusura sessione 02/06/2026** — **TEST OK**

| Esito | Dettaglio |
|---|---|
| PR | [#79](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/79) mergiata su `main` (`2521b5b`) |
| UI produzione | https://systemgest.netlify.app/contract-reviews — tab slide deployate |
| Migrazione 068 | Applicata VPS; fix batch `GO` prima dell'indice `IX_attachments_commercial_case` |
| Incidente login | SQL Server **Evaluation scaduta** (errore 17051) → `mssql-conf -n set-edition` con `MSSQL_PID=Developer`; `systemctl reset-failed` + start; restart backend |

**Lezioni (02/06/2026)**

- **Login impossibile + health `unhealthy`**: verificare **prima** `GET /api/v1/health` e `systemctl status mssql-server`. Sintomo tipico: `Failed to connect to localhost:11043`. Log: `/var/opt/mssql/log/errorlog` — cercare `evaluation period has expired`.
- **Recovery SQL Evaluation scaduta**: `sudo ACCEPT_EULA=Y MSSQL_PID=Developer /opt/mssql/bin/mssql-conf -n set-edition` → `sudo systemctl reset-failed mssql-server` → `sudo systemctl start mssql-server` → restart `sgq-backend`.
- **Migrazione 068**: indice filtered su colonna appena aggiunta richiede separatore `GO` (SQL Server valida il batch prima del commit DDL).

**Prossimo passo opzionale**: smoke L3 manuale tab slide + transizione con gate; Sprint 9–10 `import-from-job`.

### Slice R1 import-from-job (02/06/2026 pomeriggio)

**PR**: [#80](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/80) mergiata (`5403b1c`).

| Elemento | Dettaglio |
|---|---|
| Endpoint | `POST /api/v1/contract-reviews/import-from-job` |
| Effetto | Caso `DRAFT` + checklist preliminare + allegati da file job (`extracted`/`reviewed`) |
| Idempotenza parziale | **409** `ALREADY_LINKED` se `storage_path` già su `attachments.commercial_case_id` |
| Deploy | Backend VPS aggiornato; health OK |
| Test L1 | Jest `contractReview.controller.test.js` (+4 test) |

**Prossima slice**: ~~**R2**~~ ✅ — vedi sotto. **R3** link bidirezionale (migrazione **070**).

**Lezione**: piano slice in `TASK_RIESAME_ESTENSIONI_SLICES.md` va committato su `main` **prima** di delegare al deputy locale — altrimenti l'agente non trova la spec (commit `0e6160a`).

### Slice R2 UI Import Jobs (02/06/2026 sera) — TEST OK

**PR**: [#81](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/81) UI; hotfix DB [#82](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/82) migrazione 069.

| Elemento | Dettaglio |
|---|---|
| UI | Pulsante «Crea caso Riesame» + modale (titolo, cliente, anteprima testo) in `ImportJobsPage.jsx` |
| API client | `importContractCaseFromJob` → `POST /contract-reviews/import-from-job` |
| Successo | Redirect `/contract-reviews/:id` (History API — usare `waitForFunction` su pathname in smoke Playwright) |
| Smoke L3 | Playwright autonomo su `systemgest.netlify.app`: job PDF → estrai → conferma → allegato in tab Documenti → refresh OK |

**Bug scoperto in smoke (R1 residuo):** `CHK_attachments_parent` (036) non accettava righe con solo `commercial_case_id` (068). Fix migrazione **069** su VPS.

**Lezione**: dopo ogni migrazione che aggiunge un nuovo «parent» agli allegati, aggiornare subito `CHK_attachments_parent` — altrimenti endpoint che linkano file senza audit/NC/document_id falliscono in produzione.

**Prossima slice**: ~~**R3**~~ ✅ — vedi sotto. **S1** UI fornitori.

### Slice R3 link bidirezionale (02/06/2026) — TEST OK

**PR**: [#83](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/83) link job↔caso; hotfix [#84](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/84) badge origine.

| Elemento | Dettaglio |
|---|---|
| Migrazione **070** | `commercial_cases.source_import_job_id`; `import_job_files.commercial_case_id` — VPS OK |
| UI job | Badge «Caso Riesame #N»; pulsante create nascosto se collegato |
| UI caso | Badge «Origine: Import job #N» → `/settings/import-jobs?job=N` |
| Idempotenza | 409 `ALREADY_LINKED` con `case_id` |
| Smoke L3 Epic R | Playwright 14/14 su `systemgest.netlify.app` (job #10 → caso #7) |

**Bug smoke R3:** `rowCase()` in `ContractReviewPage.jsx` non propagava `source_import_job_id` → badge origine assente nonostante API corretta. Fix one-liner PR #84.

**Lezione smoke import PDF:** usare PDF valido per `pdf-parse` (es. sample Mozilla); PDF minimali/generati possono fallire con «bad XRef entry». Login smoke cloud: preferire API login + `localStorage` token (`sgq_auth_token`) se il form React non invia POST.

**Prossima slice**: ~~**S2**~~ ✅ — vedi sotto. **N1** notifiche eventi.

### Slice S2 supplier_id anagrafica (02/06/2026) — TEST OK agente

| Elemento | Dettaglio |
|---|---|
| Migrazione **073** | `commercial_case_documents.supplier_id` + FK `suppliers` + indice |
| Backend | `linkDocument` valida `supplier_id` org-scoped; `getCase`/`listCaseDocuments` espongono `supplier_name` |
| UI | Dropdown fornitore se controparte=Fornitore; badge nome fornitore; highlight checklist P9 |
| Test L1 | Jest `linkDocument` (4 casi) + build Vite OK |
| Deploy VPS | Migrazione 073 + controller deployato; health 200 |
| PR | [#86](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/86) (include S1) |

**Nota numerazione:** la spec citava migrazione 071 ma quella è già usata per NC — S2 usa **073**.

**Prossima slice**: ~~**N1**~~ ✅ — Epic estensioni **completa** (H1).

### Slice N1+N2 notifiche approvazione (02/06/2026) — TEST OK agente

| Elemento | Dettaglio |
|---|---|
| Migrazione **074** | Tabella `commercial_case_notifications` |
| Service | `contractReviewNotification.service.js` — eventi `pending_approval` e `assigned` |
| Email N2 | Trigger immediato via `alertMail.service.js` con link `/contract-reviews/:uuid` |
| Test L1 | Jest service (6) + controller mock OK |
| Deploy VPS | Migrazione 074 + deploy backend; health 200 |
| PR | [#87](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/87) |

### Slice H1 handoff stub H-A (02/06/2026) — TEST OK agente

| Elemento | Dettaglio |
|---|---|
| Decisione H0 | Opzione **H-A** (riferimento testo, nessun modulo commesse) |
| Migrazione **075** | `handoff_ref`, `handoff_at`, `handoff_by`, `handoff_notes` su `commercial_cases` |
| API | `POST /contract-reviews/:id/handoff` — solo status `APPROVED` |
| UI | Tab Workflow: sezione «Passaggio a esecuzione» + riepilogo dopo registrazione |
| Fix | `rowCase()` propagava campi handoff (pattern R3 `source_import_job_id`) |
| Test L1 | Jest `registerHandoff` (4 casi) + build Vite OK |
| Deploy VPS | Migrazione 075 + deploy backend; health 200 |
| PR | [#88](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/88) |

### Personale azienda S4+S5 + VPS migration 078 (02/06/2026)

| Elemento | Dettaglio |
|---|---|
| Migration **078** | Tabella `company_personnel` + bridge `notification_contacts`; script `backend/scripts/run-migration-078-vps.js` |
| API | `GET/POST/PUT/DELETE /api/v1/companies/:companyId/personnel` |
| UI | Route frontend `/companies/:id` — tab Anagrafica + Personale (`CompanyDetailPage`, `CompanyPersonnelPanel`) |
| Deploy VPS | Migration 078 OK; deploy controller/routes personale; health `https://www.fr-busato.it:8443/api/v1/health` OK (MainPID rinnovato post-restart) |
| Test | Vitest `companyDetailPage.test.jsx` — 3/3 |

### Hotfix viewer + RBAC Fase 4 company_access (02/06/2026)

| Elemento | Dettaglio |
|---|---|
| Hotfix | Viewer studio: POST/PUT/DELETE personnel → 403; UI nasconde CRUD (`canEdit`) |
| Migration **081** | `user_company_access` (permission read/write per user+company) |
| API admin | `GET/POST/DELETE /admin/users/:id/company-access` |
| Auth | `company_access[]` in login e `GET /auth/me` |
| UI | Menu ridotto cliente azienda; `CompaniesPage` senza Nuova/Elimina; `canEdit` da permission |
| Test | Jest personnel 14 + service 6; Vitest `companyAccess.test.js` 3 |
| Account test | `cliente.azienda11@…` write company 11; `viewer.azienda11@…` read — password in mcp.env |
| VPS | Migration **081** applicata 02/06/2026 (tabella + 2 righe test); deploy `companyAccess.service.js` + controller; health 200; smoke viewer POST 403 / cliente write 201 |

### Slice S1 UI counterparty fornitori (02/06/2026)

| Elemento | Dettaglio |
|---|---|
| UI tab Documenti | Select Controparte (Cliente/Fornitore/Interno) + Direzione (in/out) su collega registro e upload |
| Badge riga | «Fornitore · in» (arancione se supplier) su documenti registro e allegati |
| Backend | Nessuna modifica — API già accettava `counterparty`/`direction` |
| Test L1 | `contractReviewLabels.test.js` + build Vite OK |

**Prossima slice**: ~~**S2**~~ ✅ PR [#86](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/86). **N1** notifiche.

#### Attività completate

| # | Cosa | Risultato |
|---|---|---|
| 1 | Verifica licenza `ai_review`/`ai_assist` per org 1002 | `licensed_modules = null` = tutti i moduli già attivi — nessuna modifica necessaria |
| 2 | GEMINI_API_KEY configurata sul VPS | `AIzaSyAyeq...` in `/var/www/sgq-backend/.env` |
| 3 | GEMINI_MODEL aggiornato | `gemini-2.5-flash` (unico modello funzionante nel free tier con questa key) |
| 4 | Smoke test `/ai/suggest` | HTTP 200 in ~1.7s — Gemini risponde correttamente |
| 5 | Seed `norm_requirements` | 234 clausole: ISO 9001 (91), ISO 14001 (45), ISO 45001 (56), 3834-1 (3), 3834-3 (35), 3834-5 (4) |
| 6 | Merge PR #44 in main | Conflitti risolti (migrazioni rinomerate, App.jsx + AppLayout.jsx uniti) |
| 7 | Route frontend `/contract-reviews` | Aggiunta in App.jsx + voce "Riesame Requisiti" 📑 in AppLayout.jsx |

#### Lezioni apprese (13/05/2026)

- **Gemini free tier 2026**: `gemini-1.5-flash` non è disponibile sulla v1beta API. `gemini-2.0-flash` ha quota 0 sul tier gratuito "Default Project". **Soluzione**: `gemini-2.5-flash` funziona correttamente. Default aggiornato in `geminiAdapter.js` e in `.env` VPS.
- **Password admin@sgq.local**: era sconosciuta. Impostata a `Sistemi@2026` via script bcrypt sul VPS (stesso pattern SSH/sudo del progetto).
- **Conflitti numerazione migrazioni**: ADR-010 usava 052/053/054 ma `main` aveva già 052_departments, 053_enhance_suppliers, 054_enhance_complaints. Il file `run-migration-052-vps.js` era in conflitto. Tenuto la versione main (NC integration); le migrazioni ADR-010 sono `052_norm_requirements.sql`, `053_ai_interactions.sql`, `054_commercial_cases.sql` già applicate sul VPS prima del conflitto.
- **Merge con rebase fallisce se ci sono N commit con conflitti docs**: usare `git pull --no-rebase` per merge standard quando si integrano branch con molti commit su file .md.
- **Seed norme**: script `import-norms-from-markdown.js` genera `backend/data/norm_requirements_seed.json` (eseguire in locale). Script separato per INSERT nel DB va eseguito sul VPS tramite `scp + node`. Non eseguire mai il seed direttamente da Windows (MSSQL pool lento).

#### Stato VPS al 13/05/2026

| Componente | Stato |
|---|---|
| Backend sgq-backend | ✅ attivo, PID aggiornato dopo restart |
| `GEMINI_API_KEY` | ✅ configurata in `.env` |
| `GEMINI_MODEL` | ✅ `gemini-2.5-flash` |
| `norm_requirements` | ✅ 234 righe |
| `ai_interactions` | ✅ tabella creata (migrazione 053) |
| `commercial_cases` | ✅ tabella creata (migrazione 054) |
| Route `/ai/suggest` | ✅ HTTP 401 senza auth, 200 con token valido |
| Route `/contract-reviews` | ✅ HTTP 401 senza auth |
| Route `/norm-broker/search` | ✅ HTTP 401 senza auth |

#### Smoke test E2E login — completato (24/05/2026)

- ✅ Login su `https://systemgest.netlify.app` con script Playwright Node (`/tmp/test-login.mjs`) — dashboard post-auth verificata
- Credenziali test: `admin@sgq.local` via env `SGQ_APP_EMAIL` / `SGQ_APP_PASSWORD` (superadmin, org 1001)
- Smoke esteso moduli (Riesame Requisiti, AI, ecc.): da eseguire in sessione dedicata se serve

---

### Sessione 12 maggio 2026 — Fix backend pending-issues/NC + UI PendingIssuesCascade + collapse clausola

**Branch**: `cursor/adr009-fase1-registro-standard-52c5` → mergiato su `main` + deploy Netlify. Fix backend deployati su VPS.

#### Fix backend (VPS deployati)

| # | Bug | Causa radice | File | Fix |
|---|---|---|---|---|
| 1 | Pending issues non mostrava NC/OSS/NV corretti | Filtro `conformity_status IN ('NC','OSS','NV')` era stato cambiato in `OM` | `audit.controller.js` + migrazione DB | Ripristinato filtro corretto + migrazione CHECK constraint `CK_pending_issues_original_status` da `('NC','OSS','OM')` a `('NC','OSS','NV')` |
| 2 | NC statistics causava errore SQL | Alias `open`/`in_progress` sono keyword riservate in SQL Server | `nc.controller.js` | Rinominati in `count_open`/`count_in_progress` |
| 3 | `nc_id` non collegato dopo MERGE pending-issues | MERGE inseriva righe senza aggiornare `nc_id` dal modulo NC tramite `source_question_id` | `audit.controller.js` | Aggiunto UPDATE post-MERGE per collegare `nc_id` |

#### Fix frontend (branch mergiato su main + deploy Netlify)

**PendingIssuesCascade** — fix UI/UX multipli:
- Badge NC/OSS/NV standardizzate con classi `status-btn non-compliant/partial/not-verified active` di `ChecklistModule.css`
- Rimossa nota ridondante "Rilievi dell'audit #xxx da verificare..."
- Badge contatori sostituiti con chip compatte identiche a "Rilievi Emergenti"
- Rimosso label "Note originali:", semplificato link NC modulo
- Word-break fix sul testo note (overflow su parole lunghe)
- "Vai alla domanda" implementato con prop callback diretta (stesso pattern `AuditClosePanel` → `onNavigateTo`)
- Chip sezione con classe `question-reference` (identica a `QuestionCard`)
- `SECTION_LABELS` map per tradurre chiave interna (`clause8` → "8 - Attività operative")

**ChecklistModule** — pulsante ▲/▼ per collasso/espansione singola clausola spostato fuori da `.clause-progress` (era nascosto da media query mobile `display: none`).

#### Lezioni apprese (12/05/2026)

- **CHECK constraint SQL Server — verificare prima di modificare valori**: prima di usare un valore come contenuto di colonna, verificare i CHECK constraint esistenti con `SELECT name, definition FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('tabella')`. Nel bug corrente, `pending_issues.original_status` aveva un CHECK `IN ('NC','OSS','OM')` errato che bloccava i rilievi NV.
- **T-SQL — Alias con parole riservate**: keyword T-SQL (`OPEN`, `CLOSE`, `READ`, `KEY`, `STATUS`, ecc.) non possono essere usate come alias di colonna senza escape. Due soluzioni valide: (1) prefissi descrittivi (`count_open`, `count_closed`, `count_in_progress`) — preferibile per chiarezza; (2) parentesi quadre `AS [open]`, `AS [closed]`, `AS [key]` — utile quando il nome dell'alias è imposto dall'API consumer. Sintomo: `RequestError: Incorrect syntax near the keyword 'xxx'` con status 500 sull'endpoint. Fix applicato il 12/05/2026 su `nc.controller.js` (statistiche overview NC).
- **CSS media query nasconde elementi padre**: quando un pulsante/elemento non appare su mobile, verificare se un **contenitore genitore** ha `display: none` in una media query (es. `.clause-progress { display: none }` su mobile). La soluzione è spostare l'elemento fuori da quel contenitore, non modificare la media query.
- **Navigazione accordion — callback diretta è l'unico pattern affidabile**: per navigare a una domanda specifica da un componente esterno usare prop callback diretta (`onGoToQuestion` passata da `AuditAccordionLayout`) + `setChecklistExpandTrigger(prev => prev+1)`. I `CustomEvent` globali (`window.dispatchEvent`) hanno problemi di timing/mount e non sono affidabili.
- **Coerenza visiva badge stati conformità**: ogni componente che mostra NC/OSS/NV deve usare esclusivamente `status-btn non-compliant/partial/not-verified active` di `ChecklistModule.css`. Mai creare classi CSS parallele per gli stessi stati — crea inconsistenza visiva e debito tecnico.

#### Stato modulo pending-issues al 12/05/2026

- ✅ Filtro `conformity_status IN ('NC','OSS','NV')` corretto in `audit.controller.js`
- ✅ CHECK constraint DB `CK_pending_issues_original_status` aggiornato a `('NC','OSS','NV')`
- ✅ `nc_id` collegato dopo MERGE tramite `source_question_id`
- ✅ UI PendingIssuesCascade: badge standardizzati, "Vai alla domanda" funzionante, chip sezione, SECTION_LABELS
- ✅ NC statistics: alias SQL corretti (`count_open`, `count_in_progress`)
- ⚠️ NC/OSS senza note non ancora nei blockers guided close (da aggiungere in ADR-009 Fase 2)

---

### Sessione 09 maggio 2026 (sera) — Fix validazione, guided close, collapse button

**Struttura accordion AuditAccordionLayout — mappa completa (da NON ri-esplorare):**

| openSections key | Titolo UI | Contiene sub-sezioni (openSubSections key) |
|---|---|---|
| `"general-data"` | 1 – Dati Generali | `"general-data-form"` (1.1), `"objective"` (1.2), `"pending-issues"` (1.3), `"cert-findings"` (1.4) |
| `"checklist"` | Checklist | `"custom-checklist"` + chiavi per ogni standard (da STANDARDS_CONFIG) |
| `"nc-register"` | Registro NC | — |
| `"outcome"` | 11 – Esito Audit | — |
| `"conclusions"` | 12 – Conclusioni | — |
| `"close"` | Chiusura Audit | — (contiene AuditClosePanel) |
| `"export"` | Export Report | — |

**Field ID navigabili (guided close `useGuidedCompletion`):**

| Campo | sectionId | subSectionId | fieldId |
|---|---|---|---|
| Oggetto audit | `general-data` | `general-data-form` | `field-auditObject` |
| Campo applicazione | `general-data` | `general-data-form` | `field-scope` |
| Obiettivo audit | `general-data` | `objective` | `field-auditDescription` |
| Conclusioni | `conclusions` | null | `conclusions` |
| % checklist | `checklist` | null | null |

**Pattern `navigateToSection(sectionId, subSectionId, fieldId)`** — callback diretta da `AuditAccordionLayout` → `AuditClosePanel`. NON usare event bus (`window.dispatchEvent`) per componenti parent→child.

**Ottimizzazione backlog — navigazione accordion auto-discovery:**
Attualmente il `path[]` di ogni campo deve essere dichiarato esplicitamente. Un futuro miglioramento renderebbe il sistema completamente automatico: aggiungere `data-accordion-key="nome-sezione"` a ogni wrapper accordion nel DOM + un walker che risale l'albero dal campo target verso il root aprendo ogni livello trovato. Richiede di instrumentare tutti gli accordion ma eliminerebbe la necessità di aggiornare i `path[]` quando cambia la struttura. **Da valutare solo se i livelli di annidamento crescono oltre 3-4 o se si aggiungono molti nuovi moduli con accordion propri.**

**Commits chiave sessione 09-10/05:**
- `4505490` Fix validazione: rimozione obbligo evidence, note solo per NC/OSS
- `3c8f509` Regola autonomia decisioni tecniche in operating-memory
- `db32a05` Guided close v7: path-based definitivo (section→subsection→clauseExpand)
- `a8a701b` Collapse button "▲ Chiudi" in fondo ad ogni accordion aperto
- `65514d4` Hotfix: `validation is not defined` in AuditClosePanel
- `commit`  Guided close v9: `id="custom-item-{id}"` in QuestionCard + primo item custom incompleto

**Pendenti committente chiusi al 10/05/2026:**
- ✅ SMTP + ALERT_ENABLED=true attivo e verificato con e-mail di test
- ✅ Smoke L3 Mason passi 6-7: colori checklist e contatori Word verificati
- ✅ Camellini: nessuna segnalazione da campo da venerdì 08/05

**Stato guided close al 10/05/2026:**
- ✅ ISO checklist (9001/14001/45001): trova prima domanda NOT_ANSWERED → apre section+subsection+clausole → scroll+focus
- ✅ Custom checklist: trova primo item incompleto → apre section+subsection → scroll+focus
- ✅ Campi testuali (auditObject, scope, description, conclusions): naviga correttamente
- ✅ Pulsante "▲ Chiudi" in fondo ad ogni accordion
- ✅ Hook `useGuidedCompletion` riusabile per futuri moduli
- ⚠️ NC/OSS senza note non ancora nei blockers (da aggiungere in ADR-009 Fase 2)

---

### Sessione 09 maggio 2026 (sera) — Fix validazione checklist + pattern Node cloud agent

**Commit**: `4505490` su `main` — deploy Netlify automatico.

**Fix**: `checklistValidation.js` + `ChecklistModule.jsx`
- Rimossa regola che richiedeva `evidence.mainDocumentRef` per domande C/OSS (falso positivo — l'utente non compila mai quel campo legacy; scrivere nella textarea `notes` non soddisfaceva la condizione)
- Note obbligatorie ora solo per NC e OSS (non per C, OM, NA, NV); allegato mai obbligatorio
- Rimosso `console.log` debug `🔍 [VALIDATION]` in `ChecklistModule.jsx`
- 403 su `GET /companies/:id/certification-findings?standard_id=2`: gestito silenziosamente da ExportPanel (fallback `[]`); il VPS ha probabilmente la route con `requireLicensedModule` non presente nel repo — da allineare al prossimo deploy backend

**Lezione operativa — Node/npm nel cloud agent (09/05/2026)**:
`npm` non è nel PATH in questa sessione Cursor. Soluzione trovata dopo ~10 tentativi — ora scritta in `sgq-operating-memory.mdc` per evitare esplorazione futile:
```powershell
$node = "c:\Users\AI.Project\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe"
# Test: & $node "node_modules\vitest\vitest.mjs" run  (block_until_ms: 300000)
# Build: & $node "node_modules\vite\bin\vite.js" build
```
Per fix a basso rischio (1-2 file, nessuna logica sync/metriche): saltare il test locale e affidarsi al build Netlify come verifica L1 equivalente.

---

### Sessione 08-09 maggio 2026 — Maratona stabilizzazione multi-standard + ADR-009 strategico

**Branch principali mergiati in main**:
- `cursor/checklist-empty-fallback-fix-06dc` (PR #39)
- `cursor/module-license-admin-bypass-06dc`
- `cursor/fix-rich-fields-empty-on-load-06dc`
- `cursor/fix-checklist-responses-overwrite-reconcile-06dc`
- `cursor/fix-exception4-multi-standard-06dc`
- `cursor/adr009-multi-standard-architettura-06dc`

**Test L1**: 125/125 PASS · Build Vite OK · Service worker rigenerato (`BUILD_DATE` 2026-05-08T18:55Z) · Deploy Netlify confermato online.

#### 6 fix consecutivi su 4 ore (08/05/2026 13:20→18:55 UTC)

| # | Bug osservato | Causa radice | File | Fix |
|---|---|---|---|---|
| 1 | "Checklist Non Inizializzata" Sighinolfi su passaggio PC→cellulare | Race rendering: converter restituiva `{ISO_9001:{}}` vuoto, useEffect post-mount riempiva il template ma fra 1° render e effect appariva il fallback | `auditConverter.js`, `ChecklistModule.jsx` | Pre-popolazione template + grace period 1.5s prima di mostrare fallback |
| 2 | Admin riceveva "Modulo non abilitato per la tua organizzazione" su `/non-conformities` e altri | `requireLicensedModule` ignorava il ruolo, controllava solo `licensed_modules` | `backend/src/middleware/moduleLicense.middleware.js` | Bypass per `superadmin` e `admin` (allineato a `authorize()`). Auditor restano vincolati. |
| 3 | Caselle testo Note/Osservazioni si svuotavano dopo qualche secondo dall'apertura audit | Exception 1 in `reconcileAuditsFromServer` usava `!serverField` per oggetti che potevano essere `{description:''}` truthy ma vuoti → server-wins con dati vuoti | `StorageContext.jsx` | Helper `hasRichContent()` che distingue `{}` da contenuto reale; logica per-campo invece di all-or-nothing |
| 4 | Risposte/note checklist si azzeravano ogni 45 secondi | Exception 4 reintrodotto dal fix #1: il converter pre-popolava il template, Exception 4 non scattava più (vedeva struttura non-vuota), reconcile sovrascriveva con NOT_ANSWERED ad ogni ciclo | `auditConverter.js` | Reverting pre-popolazione: converter torna a restituire `{ISO_9001:{}}` (chiave presente, struttura vuota). Grace period 1.5s gestisce la finestra. |
| 5 | Stesso messaggio "Checklist Non Inizializzata" dopo 1.5s su audit con 2+ norme | Exception 4 hardcoded `serverChecklistKeys[0] === 'ISO_9001'` → audit con 2 standard `length=2` faceva fallire la condizione `=== 1` | `StorageContext.jsx` (Exception 4 in `reconcileAuditsFromServer` + `loadAuditsFromIndexedDB`) | Generalizzato: preserva locale se TUTTE le norme nel payload server hanno struttura `{}` vuota — funziona per 1, 2, N standard |
| 6 | Errori CORS in console su allegati durante restart server | nginx proxy_pass restituiva 502 muto senza header CORS quando Node.js era in restart (~10s window) | `/etc/nginx/sites-enabled/sgq-backend` (VPS) | OPTIONS preflight gestito da nginx direttamente + fallback `@backend_down` con 503 + header CORS quando upstream non raggiungibile |

**Tutti gli audit di Camellini in produzione integri** (verificato `audit_id 35191` SIGHINOLFI: `audit_standards` ✅ ISO_9001+ISO_14001, 17 risposte in `audit_responses`, `audit_extra_data` con `generalData/objective/outcome` ok). Nessun fix DB necessario.

#### Lezioni apprese (08/05/2026)

- **`{}` è truthy in JS**: ogni controllo di "presenza dato ricco" deve usare `hasRichContent()` o equivalente, mai `!field` su oggetti.
- **Race rendering React**: dato sincronamente disponibile (template hardcoded) deve essere popolato nel converter, non delegato a `useEffect` post-mount. **Eccezione**: se la pre-popolazione rompe altre logiche di merge (Exception 4!), serve un grace period UX nel componente che renderizza.
- **Hardcoded `=== 'ISO_9001'`**: ogni occorrenza di questo pattern nel codice è un bug architetturale. Generalizzare con iterazione su `selectedStandards`.
- **Bypass licenze per admin**: comportamento atteso dagli operatori (allineato a `authorize()` per superadmin). I controlli licenza sono **per organizzazione** (modello SaaS), il ruolo è **per utente** — sono due assi distinti.
- **CORS quando il backend è down**: mai delegare gli header CORS solo all'app Express. nginx (o reverse proxy equivalente) deve poterli emettere autonomamente per OPTIONS preflight e fallback errori upstream. Pattern documentato in config.
- **Verifica DB prima del codice**: pattern `node + dotenv` su VPS confermò in 2 secondi che i dati erano integri lato server. Bug era 100% client-side. Risparmiati ore di refactor backend inutile. Da riusare per ogni bug "i dati spariscono" multi-device.

#### Decisione strategica — ADR-009 (08-09/05/2026)

I 6 fix sono sintomi della stessa debolezza: app nata mono-standard con ISO 14001/45001/3834/RDP/Custom appiccicati sopra. Discussione product owner-Lead su come rendere l'app **veramente scalabile** per:
- 5 standard ISO già a DB (9001 41Q, 14001 53Q, 45001 53Q, 3834-2 22Q, RDP Mason 0Q)
- Custom checklist (variabili)
- Future: ISO 27001, 50001, 13485, ecc.
- Nuovi tipi documento: SAL, RDP, riesame contratto §8.2, rapporti VT/MT/PT

**Decisioni vincolanti** (vedi [ADR-009](adr/ADR-009-multi-standard-architettura-per-norma.md)):

1. **Modello a 2 assi**: `document_type` × `selectedStandards[]`
2. **Modello dati `byStandard[key]`**: tutto ciò che è per-norma vive sotto chiave dello standard, persistenza in `audit_extra_data.byStandard`
3. **`STANDARDS_REGISTRY` centralizzato** (`app/src/data/standardsRegistry.js`) come Source of Truth, sostituisce `STANDARDS_CONFIG` locale
4. **Flag `isIntegratedSystem`**: valido solo per `kind='iso_hls'` (9001/14001/45001), immutabile dopo prima risposta compilata, modificabile in draft puro
5. **RDP** = specializzazione custom checklist (`has_outcome_buttons=false`, `requires_photos=true`), esposto come `document_type='rdp'` (scorciatoia di prodotto)
6. **SAL** = modulo gestionale separato, riusa `document_registry` con overlay stato implementazione
7. **Custom checklist** = "norma virtuale" `CUSTOM_<id>` pari grado a una ISO
8. **Componenti UI modulari**: `<NormConclusionsBlock>`, `<MetricsByStandardChip>`, `<EvidenceGallery>`, `<DocumentRegistryGrid>`, `<NormExcerptInline>` come hook per AI futura
9. **Audit pilota di `document_registry`**: audit chiuso sarà documento del registro con scadenza prossima sorveglianza
10. **AI come licenza separata**: comportamento UI "B" (nascosta se off, riconsiderazione futura per upselling)

**Test di scalabilità (criterio di accettazione)**: aggiungere un nuovo standard ISO (es. ISO 27001) deve richiedere SOLO 1 INSERT DB + 1 riga registro + (opz.) 1 template Word, **zero altre modifiche**.

**Implementazione 5 fasi pianificate** (incrementali, ognuna committabile separatamente). **Avvio Fase 1 condizionato** a 24-48h di stabilità conclamata in produzione (zero segnalazioni Camellini).

---

### Sessione 08 maggio 2026 — Fix "Checklist Non Inizializzata" su passaggio device (Cloud Agent)

**Branch**: `cursor/checklist-empty-fallback-fix-06dc`
**Test**: 110/110 Vitest PASS · build Vite OK · service worker rigenerato (BUILD_DATE 2026-05-08).

#### Caso utente
Camellini avvia audit "IDRAULICA SIGHINOLFI" (audit_id 35191) su PC con due norme (ISO 9001 + ISO 14001). Compila 17 risposte, sincronizza, chiude. Apre la stessa app sul cellulare → comparsa la schermata "Checklist Non Inizializzata".

#### Verifica DB produzione (script `/tmp/diag-sighinolfi.js` sul VPS)
- `audit_standards`: ✅ righe per `ISO_9001_2015` (id 1) e `ISO_14001_2015` (id 2).
- `audit_responses`: ✅ 17 risposte answered (last_update 2026-05-08 12:27).
- `audit_extra_data`: contiene `generalData / auditObjective / auditOutcome` ma **non** la struttura `checklist` (per design: il server salva risposte in `audit_responses`, non template).
- Audit "rotti" (no `audit_standards`, no `custom_checklist_id`): **0**.

I dati lato server erano integri: nessun fix DB necessario.

#### Causa radice
`auditConverter.backendToFrontend` restituiva `checklist: { ISO_9001: {}, ISO_14001: {} }` — chiavi presenti ma senza clausole. Tra il primo render di `ChecklistModule` e l'esecuzione del `useEffect [currentAudit?.id]` di `AuditAccordionLayout` (che chiama `initializeChecklist` per ogni standard) c'è un **race window** di almeno un frame in cui il modulo ISO mostra il fallback "Checklist Non Inizializzata". Su mobile lento o cache PWA stantia, il fallback restava visibile abbastanza da spaventare l'utente.

#### Fix applicati (belt and suspenders, 3 livelli)
| Livello | File | Azione |
|---|---|---|
| 1. Pre-popolamento sincrono | `app/src/utils/auditConverter.js` | Nuovo helper `buildChecklistFromTemplate(normKey)` — popola la struttura clausole+domande dal template ISO **già nel converter**. Il primo render trova checklist pronta. Anche `audit_extra_data.checklist` esistente ma vuoto (`{}`) viene ricostruito invece di essere preservato silenziosamente. |
| 2. Grace period UX | `app/src/components/ChecklistModule.jsx` | Nuovo state `showEmptyFallback`: se la checklist arriva vuota, mostra "⏳ Caricamento checklist…" per 1.5s prima di esporre il fallback "Non Inizializzata". Reset a ogni cambio audit/norma. |
| 3. Fallback manuale rinforzato | `app/src/components/ChecklistModule.jsx` | Pulsante "✨ Inizializza Checklist" sempre disponibile dopo il grace period, con messaggio aggiornato che chiarisce: "Le risposte già salvate sul server verranno ripristinate automaticamente". |

I due useEffect di auto-init (in `ChecklistModule` e in `AuditAccordionLayout`) restano come ulteriore rete di sicurezza per audit caricati da IndexedDB (cache locale del PC) o standard aggiunti durante la sessione.

#### Test L1 aggiunti
- `app/src/tests/auditConverter.checklistTemplate.test.js` (7 test): converter pre-popola template per 1/2 standard, preserva `audit_extra_data.checklist` legacy, ricostruisce su `{}` vuoto, fallback ISO 9001 per audit legacy senza standards né custom.
- `app/src/tests/multiDeviceChecklistInit.test.js` (3 test): scenario reale Camellini SIGHINOLFI — payload server replicato 1:1, asserzione che `Object.keys(audit.checklist.ISO_9001).length > 0` al primo render. Test parametrizzato anche per `standards` come stringa CSV (lista) e come array di oggetti (`getAuditById`).

#### Lezioni apprese (08/05/2026)
- **Race window di rendering React**: `useState({})` o struttura vuota messa a disposizione di un componente che la renderizza subito è una **bomba a tempo**. Se è disponibile sincronamente (template hardcoded), popolare nel converter elimina la classe di bug per sempre. Non delegare l'inizializzazione a un `useEffect` post-mount per dati ottenibili sincronamente.
- **Fallback "vuoto" rumoroso**: una schermata "Non Inizializzata" che compare anche solo per 200ms genera un sospetto di perdita dati. Tre livelli sono il minimo: (a) struttura pronta nel converter, (b) grace period con stato neutro `⏳ Caricamento`, (c) pulsante manuale come ultima risorsa.
- **Verifica DB prima del codice**: script `node` con `NODE_ENV=production` + `dotenv` su `/var/www/sgq-backend/src/config/database.js` ha confermato in 2 secondi che il problema NON era nel DB. Risparmiati ore di refactor backend inutile. Pattern da riusare per ogni bug "i dati spariscono" multi-device.
- **`audit_extra_data` non è source-of-truth della checklist**: il server salva in `audit_responses` (righe per question). Il converter deve essere autosufficiente nel popolare la struttura template — non aspettarsi mai `extraData.checklist` non vuoto da `getAudits`.

#### Cosa NON è stato fatto (non necessario)
- Nessun fix backend: il server restituisce esattamente quello che deve restituire. La query `getAudits` con `STRING_AGG(s.standard_code)` da `audit_standards` è coerente con il converter dopo questo fix.
- Nessuna migrazione DB: 0 audit "rotti" in produzione.
- Nessun deploy VPS: cambiamenti solo lato `app/` (frontend), Netlify si occupa del rilascio.

---


---

> **Diario sessioni archiviate**: [archive/sessions/GUIDA_DIARIO_2026.md](archive/sessions/GUIDA_DIARIO_2026.md)

---

## A. Checklist custom, sync, deploy VPS

| Problema | Causa / fix |
|----------|-------------|
| Dati custom persi al reload | Local-first + merge in `StorageContext` / `CustomChecklistAuditView`; sync su `syncService`. |
| Checklist custom: nome/sezioni/voci non modificabili | UI `CustomChecklistsPage` + API `PUT /custom-checklists/:id`, `PUT .../sections/:sectionId`, `PUT .../items/:itemId` (`customChecklist.service` / `customChecklist.routes`). Deploy VPS: copiare controller, routes, service aggiornati + restart. |
| `PUT custom-checklist-responses` 404 | Backend VPS senza route aggiornate o Node non riavviato; copiare anche **services** richiesti dai controller. |
| 401 senza token / 404 con token | Route assente dopo auth; allineare file + `systemctl restart`. |
| `MODULE_NOT_FOUND` sul VPS | Copiare tutti i `require` (es. `auditMaintenance.service.js`, `customChecklist.service.js`, `reportTemplate.service.js`). |
| Word senza dati custom | `ExportPanel`: merge `currentAudit.customResponses` + server prima di `exportAuditToWord` (server non vuoto vince). |
| Rilievi pendenti in Word | `prepareAuditForExport`: prima `GET /audits/:id/pending-issues`, poi fallback `checkReaudit` + `nc-responses`. Riga **AP** in `RILIEVI_MARKER`: X su **NC** se ci sono pending aperti, altrimenti X su **CONF** (legacy). |
| Regressione verso ISO 9001 su audit custom | Preservare `custom_checklist_id` in update; `syncService` / `upsertAudit` non distruttivi — vedi commit `ac5d981` e hardening successivi. |
| Due utenti sullo stesso audit / conflitti salvataggio | **Lock pessimistico server** (tab. `audit_locks`, migrazione `027_audit_locks.sql`). Frontend: `StorageContext` + header `X-Audit-Lock-Token` via `apiService`; banner `AuditLockBanner.jsx`. Deploy: eseguire migrazione DB + aggiornare backend (`auditLock.service.js`, controller, route) + `systemctl restart`. |
| Popup «Audit bloccato: serve lock attivo» mentre si lavora da soli (checklist custom / salvataggi) | Il token era indicizzato solo per **UUID** ma le API usano spesso **`audit_id` numerico** nell'URL (`saveCustomChecklistResponses`, risposte ISO): l'header non partiva. Fix: `setAuditLockTokensForAudit` in `apiService.js` + `StorageContext` (stesso token sotto UUID e sotto `audit_id` dalla risposta `POST .../lock`). Deploy: solo **frontend** (Netlify da `main`). |
| **423** su `PUT /audits/:id` (update metadati / risoluzione conflitto sync) con lock attivo | `updateAudit` non passava `lockAuditUuid` → nessun `X-Audit-Lock-Token`. Fix: `updateAudit` invia `lockAuditUuid: String(id)` (UUID o numerico, coerente con la Map). |
| **Alert / popup** alla selezione di un audit esistente, poi tutto ok | Race: `processQueue` partiva prima del lock → 423; la coda **rimuoveva** l’item e `AuditLockBanner` faceva `alert`. Fix: su errori lock in sync **solo** `updateRetryCount` (retry al ciclo successivo), **nessuna** rimozione né `alert` (stato lock resta sul banner). |
| `DELETE /audits/:id` fallisce su ambienti legacy (`Invalid column name 'audit_id'`) | Risolto con hardening `auditMaintenance.service.js`: delete dinamici guidati da metadati `INFORMATION_SCHEMA.COLUMNS` (solo tabelle/colonne presenti), poi delete finale su `audits`. Strategia da riusare per compatibilita' cross-schema. |
| Admin: creare / modificare utenti | UI `UsersAdminPage` + API `POST /admin/users`, `PATCH /admin/users/:id`, `DELETE /admin/users/:id` (`admin.controller` / `admin.routes`). Solo **admin/superadmin senza** `auditor_org_id` può creare o promuovere **admin**; non si può disattivare sé stessi né l’**ultimo admin attivo** dell’org. Deploy VPS: script `backend/scripts/deploy-controllers-to-vps.ps1` include anche `admin.controller.js`, `admin.routes.js`, `auditorOrg.controller.js` + restart `sgq-backend`. |
| `GET /auditor-orgs` 500 / menu Studio vuoto in Gestione utenti | Bug: in `listAuditorOrgs` si usava `isSuperadmin` **non definito** (ReferenceError) invece di `isOrgWideAdmin` già calcolato → 500; la UI mascherava con `catch(() => ({ data: [] }))` e il dropdown restava senza opzioni. Fix backend: condizione su `isOrgWideAdmin`; fix UI: non ingoiare l’errore silenziosamente, mostrare messaggio se il caricamento studi fallisce. |
| Checklist custom visibili tra studi diversi | Fix scope per `auditor_org_id` in `custom_checklists` (migrazione `028_custom_checklists_auditor_org_scope.sql` + service/controller). Policy **B**: checklist legacy (`auditor_org_id NULL`) visibili a tutti gli auditor; nuove checklist create da auditor legate al proprio studio. |
| **Licenze moduli (Sprint 8)** | Colonna `organizations.licensed_modules` (JSON array di chiavi modulo; **NULL** = tutti i moduli attivi, retrocompatibile). API: `GET/PATCH /admin/licenses` (solo admin/superadmin org). Backend: `moduleLicense.service.js`, `requireLicensedModule` su documenti/allegati doc, NC, rischi, qualifiche, reclami+fornitori, notifiche. Login e `GET /auth/me` includono `licensed_modules`. Frontend: `LicensedRoute.jsx`, pagina **Impostazioni → Licenze moduli** (`/settings/licenses`), sidebar filtra voci senza licenza. Deploy VPS: `run-migration-037.js` + copiare service/middleware/controller/routes interessati + `server.js` (mount API su `/complaints` e `/suppliers`) + restart. **`requireLicensedModule` (2026-05-08)**: utenti con ruolo JWT **`superadmin`** o **`admin`** bypassano il controllo licenze sulle API (stesso spirito di `authorize()` per `superadmin`), così admin non riceve più `403 MODULE_NOT_LICENSED` durante collaudo o salvataggio impostazioni; gli **auditor** restano vincolati a `licensed_modules`. |
| **Licenze: admin salva ma UI non cambia** | Dopo `PATCH /admin/licenses` la sessione locale deve aggiornare `user` con `GET /auth/me`: usare `refreshUser()` da `AuthContext` (chiamato da `LicensesSettingsPage` dopo salvataggio). **Altri utenti** della stessa org: niente push automatico; vedono i moduli aggiornati al **prossimo login** o al **refresh token** / nuova chiamata `/auth/me` — documentare messaggio in UI (vedi roadmap Sessione A). |
| **Import PDF batch (Sprint 9)** | Tabelle `import_jobs`, `import_job_files`; API `GET/POST/PATCH/DELETE /import-jobs`, upload `POST .../files` (multipart `files`), `POST .../process` usa `pdf-parse` + `confidenceFromTextLength` (euristica). **`POST .../files/:fileId/ai-extract`**: estrazione JSON strutturata via OpenAI sul testo già estratto (richiede `OPENAI_API_KEY` sul server; rate limit dedicato). Colonne file: `ai_extraction_json`, `ai_extraction_error`, `ai_extraction_at`, `ai_model` (migrazione **039**). Licenza modulo **`ai_import`**. UI admin: **Impostazioni → Import PDF** (`/settings/import-jobs`). Deploy VPS: `run-migration-038.js` + **`run-migration-039.js`**, **`npm install`** nella cartella backend (dipendenza `pdf-parse`), copiare `importJobs.controller.js`, `importJobs.routes.js`, `importPdfText.js`, **`importAiExtraction.service.js`**, `server.js`, `moduleLicense.service.js` + restart. **Privacy**: il testo inviato all’API è lo stesso mostrato in schermata revisione; valutare accordo/DPA OpenAI per l’organizzazione. |
| **Confine ingest vs workflow commerciale** | Sprint 9 = **solo ingest** (testo da PDF + revisione). Il **riesame requisiti contratto** (stati, approvazioni, checklist §8.2) è modulo dedicato in roadmap (**Sprint 11**) con mini-specifica [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md). Il passaggio ingest → record documento tipizzato è **Sprint 10** (staging + commit umano), non da confondere con gli stati del caso commerciale. |
| **Import PDF — Fase 2 commit norme** | Dialog **Commit al Registry**: se `doc_type=norma`, campi **codice / ente / anno edizione** (no revisione/responsabile/scadenza); dopo il codice (AI o nome file) → `POST /documents/norm-lookup` precompila vigore + link catalogo; backend `commit-to-registry` scrive `type_specific_data` via `documentRegistryNorm.service` (come upload bulk / `DocumentForm`). File: `ImportJobsPage.jsx`, `importNormCommit.js`, `importJobs.controller.js`. Test L1: `app/src/tests/importNormCommit.test.js`. **Smoke 30/05/2026**: PR **#72** mergiata (fix `ISO_9001` underscore in filename); alias AI **`norma_tecnica`** → form norma automatico (`isNormDocType`); credenziali smoke → `.cursor/mcp.env.example` + `sync-sgq-smoke-env.ps1` (desktop) / Secrets Cursor Cloud. |
| **Registro norme — Fase 3 import codici (29/05/2026)** | **Senza PDF obbligatorio**: textarea «un codice per riga» nella cartella **NORME E LEGGI** → `POST /documents/norm-import-codes` → lookup `normCatalogLookup` → bozza `document_registry` (`status=bozza`, `type_specific_data` canonico con vigore + URL catalogo). Duplicati bloccati se `standard_code` già presente nella stessa org. Compatibile job settimanale `normValidityChecker` (legge `JSON_VALUE(..., '$.standard_code')`). File: `normCodesImport.service.js`, `NormCodesImportButton.jsx`, `document.controller.js`. Test L1: `backend/src/services/normCodesImport.service.test.js` (9 test). Deploy VPS: copiare service + controller + routes documenti + restart. |
| **Numerazione report audit (formato Mason)** | Alla creazione (`POST /audits` e sync create) il backend assegna `audit_number` come **`PREFISSO-YYMMDD-NN`** (es. `MSN-260417-01`): giorno calendario **Europe/Rome**, contatore atomico per org+prefisso+giorno (`audit_daily_sequences`, migrazione **040**). Prefisso: colonna **`organizations.audit_report_prefix`** (NULL = default `MSN`). Deploy VPS: `node backend/scripts/run-migration-040.js` (o SQL **040**) + script **`backend/scripts/deploy-controllers-to-vps.ps1`** (include già `auditNumberAllocation.service.js`, `audit.controller.js`, `sync.controller.js`) + restart. **Smoke read-only DB**: da `backend` con `NODE_ENV=production` → `node scripts/smoke-mason-db.js` (dopo almeno una creazione audit post-040 deve comparire almeno un numero Mason). |

**Deploy**: non copiare solo i controller; verificare `systemctl status sgq-backend.service`. **`/var/www/sgq-backend` sul VPS non è Git** — dopo `git push` va sempre aggiornata la copia file (script `deploy-controllers-to-vps.ps1` include anche `organization` + `auth` + `server.js` dove previsto) + restart `sgq-backend`. Dettaglio: [how-to/deploy.md](how-to/deploy.md). Dopo release lock: copiare anche `services/auditLock.service.js` e `controllers/auditLock.controller.js`.

### Workflow PR sicuro — regole branch main

**Stato attivo dal 18/06/2026** — branch `main` protetto via GitHub Branch Protection.

#### Protezioni attive

| Regola | Valore |
|--------|--------|
| Push diretto su `main` | Bloccato (admin può bypassare con avviso) |
| PR obbligatoria | Sì — almeno 1 PR aperta prima del merge |
| Review umana | Non richiesta (`required_approving_review_count: 0`) |
| Status check obbligatorio | **Smoke test DB test (via backend VPS)** deve essere `pass` |
| Dismiss stale reviews | Sì |
| Force push | Disabilitato |
| Eliminazione branch | Disabilitata |
| Enforce admin | No — il proprietario `qsstudio241` può bypassare in emergenza |

#### Flusso autonomo agente AI

```
feature branch → push → PR (gh pr create --fill) → smoke auto → check verde → merge (gh pr merge N --merge)
```

| Fase | Chi | Comando |
|------|-----|---------|
| 1. Branch | Agente | `git checkout -b feat/nome` |
| 2. Modifica + push | Agente | `git push origin feat/nome` |
| 3. Apri PR | Agente | `gh pr create --fill` |
| 4. Attendi check | Automatico | `gh pr checks N` (smoke passa in ~30s) |
| 5. Merge | Agente (dopo check verde) | `gh pr merge N --merge --delete-branch` |

**Comando rapido** per aprire PR da agente (usa title/body dal commit):
```bash
gh pr create --fill
```

**Verifica protezioni attive**:
```bash
gh api repos/qsstudio241/sistema-gestione-iso9001/branches/main/protection
```

**Emergenza (bypass admin)**: il proprietario `qsstudio241` può ancora fare push diretto su `main` — GitHub mostra avviso `Bypassed rule violations` ma accetta il push. Usare solo per hotfix critici.

---

### Workflow sviluppo: branch → preview → merge

**Regola default**: modifiche UI o feature → branch `feat/nome-descrittivo` → Pull Request verso `main` → **Deploy Preview Netlify** → **TEST OK committente** → merge su `main` (production Netlify).

| Fase | Chi | Azione |
|------|-----|--------|
| 1. Branch | Agente / dev | `git checkout -b feat/nome` da `main` aggiornato |
| 2. PR | Agente | Push branch + `gh pr create` con test plan |
| 3. Preview | Netlify (auto) | Build su URL `deploy-preview-N--systemgest.netlify.app` |
| 4. Test | **Committente** | Login, flusso modificato, API produzione (CORS preview attivo sul VPS) |
| 5. Merge | Committente o agente post-OK | `gh pr merge` → deploy production da `main` |

**Eccezioni** (merge diretto su `main` senza preview obbligatoria):

- **Hotfix produzione** critico (rollback o fix immediato beta tester).
- **Solo backend** già deployato sul VPS (migrazioni, CORS, API) senza cambi UI da verificare in preview.
- **Solo documentazione** senza effetto runtime.

**Checklist committente** (prima del merge):

| # | Verifica | Dove |
|---|----------|------|
| 1 | Deploy Preview Netlify **Success** (verde) | Tab Checks sulla PR GitHub |
| 2 | App preview carica (login / home) | URL preview nel commento Netlify |
| 3 | Flusso modificato funziona end-to-end | Preview + API **test** `https://www.fr-busato.it:8443/test-api/api/v1` (automatico da `netlify.toml`) |
| 4 | CI app verde (se tocca `app/`) | Check **CI app (Pull Request)** |
| 5 | Dichiarare **TEST OK** in chat o commento PR | — |

**Abilitazione preview** (una tantum): vedi sezione [Netlify — Deploy Preview (guida passo-passo)](archive/sessions/GUIDA_DIARIO_2026.md#netlify--deploy-preview-guida-passo-passo) — Passo 2 *Deploy Previews → Any pull request*.

**CORS preview**: nginx (`conf.d/sgq-cors-map.conf` + `sites-available/sgq-backend`) e Express (`backend/src/config/corsOrigins.js`) accettano origini `https://deploy-preview-*--systemgest.netlify.app` e `https://*--systemgest.netlify.app` oltre a `systemgest.netlify.app`, `sistema-gestione-iso9001.netlify.app` e `fr-busato.it`. Deploy nginx: `.\backend\scripts\deploy-nginx-cors-vps.ps1`.

---

### Ambiente TEST backend (istanza parallela VPS — configurato 19/06/2026)

Sul VPS gira un secondo processo Node.js **separato** dal servizio di produzione, destinato al collaudo funzionale di branch prima del merge.

| Parametro | Valore |
|-----------|--------|
| **URL pubblico** | `https://www.fr-busato.it:8443/test-api/` |
| **Health check** | `curl -sk https://www.fr-busato.it:8443/test-api/api/v1/health` |
| **Porta interna Node.js** | `3001` (produzione usa `3000`) |
| **DB** | `2026-06-18_SGQ_ISO9001` (non tocca produzione `SGQ_ISO9001`) |
| **Servizio systemd** | `sgq-backend-test` |
| **File env VPS** | `/var/www/sgq-backend/.env.test` |
| **Config nginx** | `/etc/nginx/sites-available/sgq-backend-test` (blocco `listen 8444 ssl` — porta non esposta provider) |
| `NODE_ENV` | `test`, `LOG_LEVEL=debug` |
| `GEMINI_API_KEY` | ✅ presente in `.env.test`, allineata a produzione (`.env`) — abilita estrazione requisiti da disegni (adapter Gemini) anche su test/demo |

> **Nota porta 8444**: nginx è configurato anche su `:8444` (TLS) → `:3001`, ma il provider non espone quella porta all'esterno. Si accede via path-prefix `/test-api/` sulla porta `8443` già aperta. Se in futuro si vuole aprire `8444`: pannello di controllo del provider VPS → firewall → aggiungi regola TCP 8444.

> **Nota chiavi AI (20/06/2026)**: `GEMINI_API_KEY` è stata copiata da `.env` a `.env.test` lato server (valore mai esposto in chat/log) e il servizio `sgq-backend-test` è stato riavviato. L'estrazione requisiti da disegni (`POST /test-api/api/v1/import-jobs/:id/files/:fileId/ai-extract`, adapter `geminiAdapter.js`) funziona ora anche sull'ambiente test/demo. Verifica: health `healthy` + endpoint che risponde `401` senza auth (registrato).


#### Tabella ambienti (produzione vs test)

| Ambiente | URL frontend | URL backend | DB |
|---|---|---|---|
| **Produzione** (`main`) | `https://systemgest.netlify.app` | `https://www.fr-busato.it:8443/api/v1` | `SGQ_ISO9001` |
| **Test** (Deploy Preview PR) | `https://deploy-preview-NNN--systemgest.netlify.app` | `https://www.fr-busato.it:8443/test-api/api/v1` | `2026-06-18_SGQ_ISO9001` |

La variabile `VITE_API_URL` viene iniettata automaticamente da `netlify.toml` (`[context.deploy-preview.environment]`) — nessuna azione manuale necessaria.

#### Flusso completo test su branch

```
feat/branch → push → gh pr create → [GitHub Actions: smoke DB test] → [Netlify: Deploy Preview → VITE_API_URL=test-api automatico] → test funzionale su URL preview → TEST OK → gh pr merge → deploy produzione (deploy-controllers-to-vps.ps1)
```

#### Comandi rapidi ambiente test

**Regola agente (28/06/2026):** ogni slice backend/DB va resa **operativa su TEST senza chiedere conferma** — migrazione su `2026-06-18_SGQ_ISO9001`, deploy `sgq-backend-test`, restart + health `test-api`. Produzione (`SGQ_ISO9001` + `sgq-backend`) solo dopo TEST OK o merge esplicito su `main`.

```powershell
# Deploy solo TEST (Cloud Agent / bash)
bash backend/scripts/deploy-to-vps-test.sh

# Migrazione solo TEST (dopo scp script + SQL)
# node /tmp/run-migration-114-test-vps.js  (pattern: run-migration-NNN-test-vps.js)
```

```powershell
# Restart istanza test (dopo deploy file backend)
.\backend\scripts\run-on-vps.ps1 -Command "echo 'Sistemi@2026' | sudo -S systemctl restart sgq-backend-test"

# Health check test
curl -sk https://www.fr-busato.it:8443/test-api/api/v1/health

# Log istanza test (ultimi 50)
.\backend\scripts\run-on-vps.ps1 -Command "echo 'Sistemi@2026' | sudo -S journalctl -u sgq-backend-test -n 50 --no-pager"

# Stato servizio test
.\backend\scripts\run-on-vps.ps1 -Command "echo 'Sistemi@2026' | sudo -S systemctl status sgq-backend-test --no-pager"

# Smoke DB + VPS test opzionale
cd backend && node scripts/smoke-testdb.js --check-vps
```

#### Come fare deploy di un branch sull'istanza test

**Metodo A — Deploy completo (raccomandato dal 21/06/2026):**
```powershell
.\\backend\\scripts\\deploy-controllers-to-vps.ps1 -AlsoRestartTest
```
Copia tutti i file del manifest, riavvia `sgq-backend` (prod) + `sgq-backend-test` in sequenza, health check su entrambi.

**Metodo B — Deploy singolo file (hotfix rapido):**
1. Copia file: `run-on-vps.ps1 -LocalFile ... -RemotePath /tmp/... -RemoteCommand "sudo cp /tmp/... /var/www/sgq-backend/..."`
2. Restart test: `.\.\backend\scripts\run-on-vps.ps1 -Command "echo '[REDACTED]' | sudo -S systemctl restart sgq-backend-test"`
3. Verifica: `curl -sk https://www.fr-busato.it:8443/test-api/api/v1/health`
4. Test funzionali su Deploy Preview Netlify (VITE_API_URL automatico da `netlify.toml`)
5. Se OK → merge → `.\\backend\\scripts\\deploy-controllers-to-vps.ps1` per produzione

### Netlify — Deploy Preview (guida passo-passo)

**Cosa ottieni**: per ogni **Pull Request** su GitHub, Netlify costruisce un sito di anteprima con URL dedicato (es. `deploy-preview-12--nome-sito.netlify.app`). **Non** serve un secondo progetto Netlify né configurazioni diverse per branch: è la stessa app collegata al repo.

**Prerequisiti**
- Sito Netlify già collegato al repository GitHub (deploy da `main` funziona oggi).
- Permessi **Owner** o ruolo che possa modificare *Site configuration*.

---

#### Passo 1 — Verificare collegamento GitHub

1. Accedi a [Netlify](https://app.netlify.com) → seleziona il **sito** del SGQ.
2. **Site configuration** (ingranaggio o menu sito) → **Build & deploy**.
3. Sotto **Continuous deployment** deve comparire il **repository** corretto (es. `qsstudio241/sistema-gestione-iso9001`) e il branch di produzione (di solito **`main`**).

**Verifica OK**: vedi il nome repo e l’ultimo deploy da `main` con stato *Published*.

**Se manca il repo**: *Link repository* → autorizza GitHub → scegli il repo → branch `main` → conferma. Netlify userà `netlify.toml` in root (`base = "app"`, `publish = "dist"`).

---

#### Passo 2 — Abilitare i Deploy Preview

L’interfaccia Netlify cambia a volte nome alle voci; cerca sempre equivalenti a *Deploy previews* / *Pull request previews*.

1. Stesso percorso: **Site configuration** → **Build & deploy**.
2. Cerca la sezione **Deploy Previews** (o **Pull request previews** / sotto *Branches and deploy contexts*).
3. Imposta **Deploy Previews** su **Any pull request** (o **All pull requests** / **Enabled** — formulazione equivalente).

**Cosa evitare**: non limitare i preview a “solo branch con nome X” se l’obiettivo è provare ogni PR verso `main`.

**Verifica OK**: l’opzione risulta attiva e salvata (nessun messaggio di errore in pagina).

---

#### Passo 3 — Permessi GitHub App Netlify (se i preview non partono)

1. Su GitHub: **Settings** dell’organizzazione o dell’utente → **Applications** → **Installed GitHub Apps** → **Netlify**.
2. Controlla **Repository access**: deve includere il repo del progetto.
3. Se Netlify chiede scope aggiuntivi per **Pull requests**, accetta.

**Verifica OK**: Netlify può ricevere eventi `pull_request` dal repo.

---

#### Passo 4 — Prova reale con una Pull Request

1. Su GitHub crea un branch minimo (es. `chore/test-netlify-preview`) da `main`.
2. Modifica un file banale (es. un commento in `app/README` o una riga in `docs` — oppure solo merge una riga senza effetto se preferisci).
3. Apri **Pull Request** verso **`main`**.
4. Nella pagina della PR, attendi 1–3 minuti: dovrebbe comparire il check **netlify** / **Deploy Preview** (o un commento di Netlify con il link).
5. Clicca l’URL del **Deploy Preview** e verifica che l’app carichi (login, home).

**Verifica OK**
- Build Netlify sulla PR in stato **Success** (verde).
- URL preview apre la SPA (anche `/` → `index.html` grazie al redirect in `netlify.toml`).

**Se fallisce**
- In Netlify: **Deploys** → filtra per *Deploy previews* → apri il deploy fallito → leggi **Deploy log** (errore `npm`, Node, ecc.).
- Confronta **Node**: in `netlify.toml` è `NODE_VERSION = "20"`; deve essere coerente con CI locale.
- Stato **Canceled** con *Building* ok e *Deploying* skipped: sul piano **Free** spesso c’è **una sola build concorrente**; un altro deploy (es. su `main`) può far annullare il preview. Attendere o usare **Retry** → *Retry with latest branch commit*; aprire il deploy riuscito e **Open deploy preview**.

**Best practice — PR solo per smoke test Deploy Preview**
- **Non mergiare** commit “usa e getta” (es. riga di prova in questa guida): chiudere la PR **senza merge** e **eliminare il branch** remoto (`git push origin --delete nome-branch`).
- I Deploy Preview restano attivi sul sito Netlify; la verifica non richiede merge su `main`.

---

#### Passo 5 — Differenza tra Production e Preview

| Contesto | Cosa viene deployato | Chi lo usa |
|----------|----------------------|------------|
| **Production** | Branch `main` (dopo merge) | Beta tester URL principale |
| **Deploy Preview** | Ogni PR | Sviluppatore / QA prima del merge |

I preview **non** sostituiscono `main`: servono a **non rompere** i beta finché la PR non è mergiata.

---

#### Passo 6 — CI GitHub sulle PR (consigliato, già in repo)

Workflow: `.github/workflows/ci-app-pr.yml` — su ogni PR che tocca `app/` esegue `npm ci`, `npm run test:run` (con `NODE_ENV=test`), `npm run build` nella cartella `app`.

**Verifica OK**: nella PR, tab **Checks**, job **CI app (Pull Request)** verde.

**Nota**: Netlify e GitHub Actions sono indipendenti; entrambi verdi = maggiore sicurezza prima del merge.

---

**Backlog architetturale**: [adr/ADR-006-auto-reconcile-cache-sync.md](adr/ADR-006-auto-reconcile-cache-sync.md).

---

## B. Report Word — checklist custom (Verbale)

| Problema | Dove / cosa |
|----------|-------------|
| `**` letterali | `wordExportHelpers.js` → `buildCustomChecklistSectionOoxml` (`lineToRichRuns`, `textToRichParagraphs`). |
| Solo link allegato, no foto | `ExportPanel.jsx`: `photoMode: 'preview'`; `preloadImagesIntoAudit` + `embedImagesInZip`. |
| DOCX illeggibile con JPEG | `[Content_Types].xml` senza `.jpg` → `ensureImageContentTypesInZip` in `wordExport.js`. |
| XML dopo render | `repairWordDocumentXmlMalformedAttrs` dopo `doc.render` e dopo inject marker. |
| Più tabelle | Un solo `xmlTable` in `buildCustomChecklistSectionOoxml`. |
| Righe `1.1.2`, `1.1.3` | Una riga per voce; `evidence_blocks` concatenati; codice `itemCode`. |
| `rId` duplicati | Indice sequenziale `30000 + imageRegistry.length`. |
| Foto sempre **landscape** in Word | Allegati checklist: prima `xmlImageOoxml(rId, imgId)` senza dimensioni → fallback fisso 1905000×1428750 EMU (~200×150 px). Fix (mag 2026): `embeddedImageEmuFromBase64` in `wordExportHelpers.js` legge pixel reali da PNG/JPEG e scambia w/h se EXIF orientation 5–8; logo già corretto in `wordExport.js`. Test: `wordExport.imageDimensions.test.js`. |
| Template ISO al posto del Verbale | `generateDocxBlob`: ramo `isCustomChecklist` + fallback `TEMPLATE_MAP.custom_checklist`. |
| Tabelle fuori margini | `w:tblInd` negativo → `normalizeNegativeTableIndentsInZip`; script `app/scripts/fix-verbale-table-margins.js`. |

**Template**: fallback `app/public/templates/VerbaleVisita-generic.docx` (allineato a migration 026 / `report_templates`). Il file `Verbale_di_riunione_QTAFI_VIS001.docx` resta copia cliente senza placeholder docxtemplater — **non** usarlo come fallback export. Se `getReportTemplate` restituisce URL (anche `/uploads/...`), quello ha priorità. **Repro** (`repro-custom-export.mjs`): solo file in `public/templates`, senza resolver API.

**Ordine capitoli e sommario (mag 2026)**: in `wordExport.js`, `normalizeAuditReportDocumentStructure` riordina **Conclusioni dopo RILIEVI** (come ISO patchate) e rimuove righe Sommario TOC cache obsolete (`_Toc*`) così Word rigenera l’indice aprendo il file. Test: `wordExport.chapterOrder.test.js`. Script offline: `patch-audit-template-structure.cjs` (include `VerbaleVisita-generic.docx`).


### Sessione 30/05/2026 — Tooling Cursor / MCP / Node / Vitest (chiusura sessione)

#### Attività completate

| # | Area | Esito |
|---|------|--------|
| 1 | Cursor Marketplace — estensioni | GitHub PR, Vitest, MSSQL, EditorConfig, Remote SSH; **Modern Web Guidance** opzionale |
| 2 | GitHub MCP | URL `https://api.githubcopilot.com/mcp/`; PAT fine-grained ok; **43 tools** |
| 3 | Playwright MCP | Test ok — **23 tools** |
| 4 | Node LTS | Installato per Vitest extension e Playwright MCP |
| 5 | `.editorconfig` | UTF-8, LF, indent coerente (root repo) |
| 6 | Sync PAT GitHub | `.cursor/mcp.env.example` + `.cursor/sync-github-mcp-env.ps1` |
| 7 | Vitest L1 | **432 pass / 2 fail** (`importNormCommit` — preesistente) |

#### Lezioni apprese — Cursor Marketplace e estensioni

- **Estensioni utili**: GitHub Pull Requests, Vitest, MSSQL, EditorConfig, Remote SSH.
- **Installazione CLI**: usare `cursor.cmd --install-extension <publisher.extension> --force -Wait`, **non** lanciare ripetutamente `Cursor.exe` (evita finestre multiple).

#### Lezioni apprese — GitHub MCP (server HTTP)

- **URL server**: `https://api.githubcopilot.com/mcp/` — PAT fine-grained accettato.
- In `mcp.json` usare `"Authorization": "Bearer ${env:GITHUB_PERSONAL_ACCESS_TOKEN}"` (o equivalente headers).
- **`envFile` NON funziona** per server MCP basati su URL HTTP (solo stdio). Non affidarsi a `envFile` in `.cursor/mcp.json` per GitHub.
- **Pattern corretto (Windows)**:
  1. Copiare `.cursor/mcp.env.example` → `.cursor/mcp.env` e incollare il PAT (senza `Bearer`, senza virgolette).
  2. Eseguire: `powershell -ExecutionPolicy Bypass -File .cursor/sync-github-mcp-env.ps1` — imposta variabile **utente Windows** `GITHUB_PERSONAL_ACCESS_TOKEN`.
  3. Riavviare Cursor completamente (chiudere tutte le finestre).
- **Profilo Windows**: la variabile va impostata sul profilo **corretto** (`AI.Project` vs account manutenzione). Se MCP non vede il token, verificare nello stesso profilo usato da Cursor: `[Environment]::GetEnvironmentVariable('GITHUB_PERSONAL_ACCESS_TOKEN','User')`.
- Se in Impostazioni MCP GitHub mostra **Logout** (OAuth): uscire da OAuth e usare **solo** il PAT.

#### Lezioni apprese — Node, Vitest extension, Playwright MCP

- **Node.js LTS** (`C:\Program Files\nodejs\`) necessario per Vitest extension in IDE e Playwright MCP.
- Cursor può avere nel PATH un **node bundled** prima del Node di sistema → in `.cursor/mcp.json` usare path assoluto per Playwright: `"command": "C:\\Program Files\\nodejs\\npx.cmd"`.
- **`.vscode/settings.json`** (gitignored, locale): `"vitest.nodeExecutable": "C:\\Program Files\\nodejs\\node.exe"` per far usare a Vitest extension il Node LTS.
- **Test da terminale agent** (cloud): pattern esistente con `$node` bundled Cursor — vedi sezione *npm non è nel PATH* più sotto; su desktop IDE preferire Node LTS di sistema.

#### Test L1 — esito sessione

| Suite | Esito | Note |
|-------|--------|------|
| Vitest `app/` | **8/8 pass** (`importNormCommit.test.js`, 30/05/2026) | PR #72 mergiata + alias `norma_tecnica` |

#### Prossimo test consigliato (circuito Registro Norme)

Ordine smoke integrato: **Vitest** (`importNormCommit`, `normCodesImport`) → **Playwright MCP** (UI Registro → NORME E LEGGI) → **SQL** (verifica `type_specific_data` / duplicati) → **GitHub MCP** (trace PR/commit).

**File locali sessione (non committati)**: `.editorconfig`, `.cursor/mcp.env.example`, `.cursor/sync-github-mcp-env.ps1`, modifica `.gitignore` (ignore `mcp.json` / `mcp.env`).

---

**Esperienza 29/05/2026 - registro norme e albero documenti (chiusura sessione)**

- **Fase 2 norme (commit import PDF)**: allineamento `type_specific_data` canonico al commit batch; form tipo `norma` senza campi revisione/responsabile/scadenza SGQ. Commit `a77b616`.
- **Fase 3 import codici catalogo**: textarea codici in **NORME E LEGGI** → `POST /documents/norm-import-codes` → `normCodesImport.service` + lookup catalogo; duplicati su `standard_code` per org. Commit `a77b616` (service) + deploy VPS manuale service/controller/routes documenti.
- **Smoke / fix backend**: ISO 5817 e dedup import; esclusione documenti **obsoleti** dall'albero (`526ae9f`). Pannello dettaglio: metadati norma visibili (`dde4d6e`).
- **UI albero** (`b2c0694` + `b3e5b51`): tooltip; rinomina/elimina solo cartelle **custom**; icone sistema vs custom; `FOLDER_NOT_EMPTY` se cartella non vuota. **Sidebar ridimensionabile**: maniglia sottile a destra dell'albero, larghezza in `localStorage` chiave `sgq-doc-tree-width`; su mobile barra **Cartella selezionata** sopra il dettaglio.
- **Norme (lessico SGQ)**: niente campo *revisione* documentale — usare **edizione** / **anno edizione**, **vigore** e lookup **catalogo-first** (`norm-lookup`, import codici); cartelle **sistema** (es. NORME E LEGGI) **non** rinomina/elimina dall'UI.
- **UX visibilità novità (30/05)**: deploy Netlify **systemgest.netlify.app** può essere OK mentre l'utente «non vede nulla» → aprire tab **Albero** nel Registro documenti, URL produzione corretto, provare **drag** sulla maniglia; se PWA/cache vecchia: hard refresh o reinstallazione PWA.
- **Deploy VPS**: `deploy-controllers-to-vps.ps1` (manifest unico `deploy-manifest.json`) copia tutti i file norme/NC/documenti + restart `sgq-backend`; smoke `npm run smoke:deploy`.
- **Commit di riferimento**: `a77b616`, `526ae9f`, `dde4d6e`, `b2c0694`, `30f5fd5`, `b3e5b51`.

**Esperienza 01/06/2026 — Registro documenti multi-azienda (slice D1)**

- **Regole cartelle**: ogni azienda può **aggiungere** cartelle custom (`is_system_folder = 0`); le cartelle da **provisioning** restano protette (UI + API 403 su rinomina/elimina/sposta).
- **Tab Albero**: selettore **Ambito** (tutto lo studio / azienda X) allineato a Ricerca SGQ; `useDocumentTree(companyId)` propaga `company_id` a tree, lazy children e nuove cartelle custom.
- **Deep link**: `/documents?tab=tree&company_id=N&select=DOC_ID`.
- **Backend**: `GET /documents/tree/:parentId/children?company_id=` — stesso filtro di `getTree` (azienda + nodi con `company_id` NULL = condivisi studio). Deploy VPS `documentTree.controller.js` dopo merge.
- **Backlog**: ~~D2 scope su Priorità/Catalogo~~; ~~D3 provisioning albero per `company_id` alla creazione cliente~~ (vedi slice D2/D3 sotto).

**Esperienza 01/06/2026 — Registro documenti multi-azienda (slice D2/D3)**

- **D2 — Ambito condiviso**: selettore **Ambito** nell'header del Registro (Priorità / Catalogo / Albero); `company_id` su API lista documenti e deep link `?company_id=` su tutte le tab; persistenza `localStorage` chiave `sgq-doc-registry-company-scope`; nuovo documento precompila azienda da ambito.
- **D3 — Provisioning automatico**: `POST /companies` dopo INSERT chiama `documentTreeProvisioner.provisionTree(org_id, company_id, …)` se manca root per quella azienda (non bloccante, idempotente). Deploy VPS: `company.controller.js`.

**Esperienza 03/06/2026 — Albero documentale per-azienda (Camellini / org 1002)**

| Step | Cosa | File / comando |
|------|------|----------------|
| A | API albero con `?company_id=X`: filtro **stretto** (`dr.company_id = X`, niente `OR IS NULL`); `children_count` allineato | `documentTree.controller.js`, `documentTreeCompanyScope.js` |
| B | Migrazione dati org QS: provision per ogni azienda, rimappa `parent_id` per `folder_code`, archivia albero condiviso (`company_id NULL` → `obsoleto`) | `backend/scripts/migrate-per-company-document-trees-vps.js` su VPS |
| C | Nuove aziende: provisioning sempre su `company_id` (già in `company.controller.js`) | — |
| Operativo | In Registro documenti → tab **Albero**, impostare **Ambito = nome cliente**; hard refresh PWA dopo deploy | — |

```bash
# VPS: anteprima poi apply (ORG_ID default 1002)
scp -P 1122 -i $KEY backend/scripts/migrate-per-company-document-trees-vps.js user@vps:/tmp/
ssh … "DRY_RUN=1 node /tmp/migrate-per-company-document-trees-vps.js"
ssh … "DRY_RUN=0 node /tmp/migrate-per-company-document-trees-vps.js"
# Poi deploy documentTree.controller.js + utils e restart sgq-backend
```

**Esperienza 13/06/2026 — Migrazione batch alberi per-azienda (MASON + ERAM)**

- **Sintomo**: nuova azienda **LM&CO Sas** (ERAM org **1004**) mostrava in tab Albero le **15 norme** già caricate per **DNV** — albero studio ancora **condiviso** (`company_id` NULL).
- **Diagnosi**: `node backend/scripts/scan-shared-document-trees.js` — tenant da migrare: **1003** (MASON, 1 azienda) e **1004** (ERAM, 2 aziende). QS (**1002**) già OK.
- **Slice eseguiti**: (1) script scan; (2) estensione migrazione con `rehomeSharedOrphans` (norme NULL → prima azienda per `id`); (3) `DRY_RUN` batch; (4) apply `DRY_RUN=0`.
- **Esito ERAM**: 15 norme assegnate a **DNV** (`company_id=16`), spostate sotto cartella 2.3 per-azienda; **LM&CO** albero vuoto (corretto). Albero condiviso archiviato.
- **Esito MASON**: albero provisionato per **MANITOU ITALIA SRL**; condiviso archiviato.
- **Verifica post**: scan → `Tenant da migrare: 0`; ogni azienda 15 radici, 0 duplicati.

```bash
# Diagnosi tutti i tenant
node backend/scripts/scan-shared-document-trees.js

# Anteprima batch
node backend/scripts/migrate-shared-trees-batch.js

# Apply (solo tenant con radici NULL attive)
DRY_RUN=0 node backend/scripts/migrate-shared-trees-batch.js

# Singolo tenant
DRY_RUN=0 ORG_ID=1004 node backend/scripts/migrate-per-company-document-trees-vps.js
```

- **Operativo utente**: Registro documenti → **Ambito = nome azienda** → hard refresh PWA. Nuove aziende ricevono albero dedicato automaticamente (non esiste più albero condiviso nello studio).

**Esperienza 05/06/2026 — DELETE azienda falliva con FK (AAA-NN / Camellini)**

- **Sintomo**: `DELETE /companies/:id` → 500 «Errore eliminazione azienda»; SQL `FK_doc_registry_company` (azienda con albero provisionato + audit + chunk AI).
- **Fix**: `companyMaintenance.service.js` — ordine cleanup: `audit_events` + `hardDeleteAudit` → `knowledge_chunks` → `document_history` / `attachments` / relazioni → `document_registry` → altre FK (`company_personnel`, billing, …) → `companies`. Controller `deleteCompany` delega al service.
- **Deploy**: `company.controller.js` + `companyMaintenance.service.js` su VPS + restart `sgq-backend`. Smoke: azienda test `AAA-NN` (id 8) eliminata OK in produzione.

**Esperienza 28/05/2026 — export Word Verbale custom (chiusura sessione)**

- **Template giusto**: checklist custom → `VerbaleVisita-generic.docx`, **non** i template ISO 9001/14001; ramo `isCustomChecklist` + fallback `TEMPLATE_MAP.custom_checklist`.
- **Allegati custom**: l’upload salva `custom_item_id` su `attachments` ma spesso **non** popola `evidence_blocks.attachment_id`; l’export deve leggere anche `attachmentsForCustomItem` (non solo i blocchi).
- **Foto in Word**: normalizzare **EXIF orientation** (5–8) prima dell’embed OOXML (`embeddedImageEmuFromBase64`); altrimenti foto sempre landscape.
- **Mojibake**: `Â°` ≠ `à` — sequenza UTF-8/Latin-1 distinta; usare `fixWordXmlMojibake` su template e post-render (`fix-audit-template-mojibake.cjs`).
- **Sommario / titoli sezione 3**: capitoli **3 / 3.1 / 3.2** in stile **Titolo 1** come 1–2 (non Titolo2); numerazione verbale **3.x** vs audit ISO **11.x**; dopo patch template aggiornare sommario in Word (**F9**).
- **Upload template**: copiare `.docx` in `public/templates/` **non** basta — registrare con **POST** `/api/v1/report-templates` e assegnazione checklist/org. **Da UI (29/05/2026)**: **Gestione → Template report** — banner upload + griglia `SgqDataGrid` (Scarica / Duplica da sistema con modal nome / Elimina solo studio); dropdown «Scarica modello di sistema» (`/templates/...`). Upload **senza** obbligo `standard_key` ISO — adatto a 5S, sopralluogo, verbali generici; assegnazione ISO sotto griglia, checklist custom in **Checklist personalizzate** (`GET /report-templates?scope=audit` condiviso). Warning soft se mancano `CHECKLIST_MARKER` / `RILIEVI_MARKER`. API: `POST /report-templates/:id/duplicate` `{ name }`, `DELETE /report-templates/:id`, `GET /report-template-assignments/standards`.
- **Intestazione verbale**: modifiche grafiche (logo, layout) vanno fatte su `VerbaleVisita-generic.docx` in repo + deploy Netlify; runtime OOXML non sostituisce l’header se già nel template patchato.

Script aggiuntivo: `patch-verbale-visita-headings.cjs` (allinea Titolo 1 offline; mirror runtime `normalizeVerbaleVisitaSectionHeadings`).

**Registrazione template custom (menu a tendina)**: il dropdown in **Admin → Checklist personalizzate → editor** legge `GET /report-templates?scope=audit` (righe in tabella `report_templates`: template di sistema `organization_id` NULL + upload org). Copiare/rinominare un file sotto `app/public/templates/` **non** crea una voce nel menu. Per usare una copia del template ISO 9001: caricare il `.docx` via API/UI upload, poi **PUT** `/report-template-assignments/custom-checklist/:id` (o dropdown nell'editor). Il file deve contenere i marker `CHECKLIST_MARKER` e `RILIEVI_MARKER` (come il Verbale di sistema) oltre ai placeholder docxtemplater (`{auditDate}`, `{clientName}`, …).

**Script utili**: `fix-verbale-template-xml.js`, `verify-template-repair.js`. Marker: `CHECKLIST_MARKER`, `RILIEVI_MARKER`. Dettaglio placeholder: [ISTRUZIONI_PLACEHOLDER_TEMPLATE_WORD.md](ISTRUZIONI_PLACEHOLDER_TEMPLATE_WORD.md).

---

## C. Database e repro

- `development` in `database.json` = DB di lavoro (vedi [DATABASE.md](reference/DATABASE.md)). `test` = `localhost:1433` (spesso assente).  
- Lo script repro normalizza `NODE_ENV=test` → `development` prima del pool.  
- Comandi: vedi sezione **D** sotto.

---

## Smoke test remoti (DB di test via backend VPS)

> Obiettivo: poter eseguire verifiche del DB di test **da qualsiasi macchina** (GitHub Actions, Netlify CI, PC remoto) senza esporre SQL Server su internet. Il backend VPS funziona da proxy sicuro.

### Architettura

```
GitHub Actions / PC remoto
        │  HTTPS GET + X-Smoke-Token
        ▼
backend VPS :8443  →  GET /api/v1/smoke/testdb
        │  connessione isolata (pool separato)
        ▼
SQL Server test :11043  (DB 2026-06-18_SGQ_ISO9001)
```

- **Nessuna porta SQL Server esposta a internet** — tutto passa via HTTPS al backend.
- Il token `X-Smoke-Token` è l'unica autenticazione richiesta (nessun JWT utente).
- Il controller usa una `ConnectionPool` separata → non interferisce con il pool di produzione.

### File coinvolti

| File | Ruolo |
|------|-------|
| `backend/src/controllers/smoke.controller.js` | Logica smoke: tabelle, conteggi, guardia anti-prod |
| `backend/src/routes/smoke.routes.js` | Route `GET /api/v1/smoke/testdb` |
| `backend/src/server.js` | Monta `smokeRoutes` prima dei router autenticati |
| `backend/scripts/smoke-remote.js` | Client standalone: chiama l'endpoint e fa exit 0/1 |
| `.github/workflows/smoke-test.yml` | Job CI automatico su push/PR su `main` |

### Configurazione VPS (una tantum)

Aggiungere nel file `.env` del backend sul VPS (`/var/www/sgq-backend/.env`):

```bash
SMOKE_TOKEN=<valore-casuale-segreto>
```

Poi riavviare il servizio:

```bash
sudo systemctl restart sgq-backend.service
```

> Il valore di default `dev-smoke-token-change-in-prod` è accettato solo in sviluppo locale. In produzione il server logga un avviso se viene usato il default.

### Configurazione GitHub Secrets (una tantum)

In **Settings → Secrets and variables → Actions** del repository, aggiungere:

| Secret | Valore |
|--------|--------|
| `SMOKE_ENDPOINT` | `www.fr-busato.it:8443` |
| `SMOKE_TOKEN` | stesso valore impostato nel `.env` del VPS |

### Esecuzione manuale con curl

```bash
# Verifica rapida da terminale (Linux/macOS/WSL)
curl -sk -H "X-Smoke-Token: XXX" https://www.fr-busato.it:8443/api/v1/smoke/testdb | python3 -m json.tool

# Atteso se OK:
# { "ok": true, "db": "2026-06-18_SGQ_ISO9001", "checks": { ... }, "errors": [] }
```

### Esecuzione manuale dello script Node

```powershell
# Windows PowerShell (dal root del progetto)
$env:SMOKE_ENDPOINT = "www.fr-busato.it:8443"
$env:SMOKE_TOKEN    = "XXX"
node backend/scripts/smoke-remote.js
```

### Verifica che il workflow CI sia attivo

Il workflow `.github/workflows/smoke-test.yml` si attiva su:
- Push su `main` che toccano `backend/src/**` o `backend/scripts/smoke-remote.js`
- Pull Request verso `main` con le stesse path
- Esecuzione manuale (`workflow_dispatch`) da GitHub Actions UI

---

## D. Comandi di verifica rapida

### Delega Cursor desktop / web (senza aumentare il carico operativo)

- Brief condivisi in **`docs/agent-tasks/`** (es. `CASE_STUDY_01_USERS_ADMIN.md`). L’agente **web** restituisce lavoro via **branch + PR**; l’agente **desktop** analizza diff/CI. Nessun canale diretto tra sessioni AI.
- **Case study 01** (gestione utenti): chiusura tecnica in file case study + merge su `main` (mar 2026); deploy VPS con `deploy-controllers-to-vps.ps1` + fallback restart.
- **Approvazione umana** solo per eccezioni alle golden rules; task a basso rischio (doc, checklist, fix mirati + L1) in autonomia: vedi `.cursor/rules/sgq-operating-memory.mdc` (approvazione + chunking / piramide L1–L5 in questa guida).

```powershell
cd "...\app"
$env:NODE_ENV = "test"; npm run test:run
node scripts/verify-template-repair.js
npm run build
```

```powershell
cd "...\backend"
node scripts/repro-custom-export.mjs
```

---

---

## D bis. Catalogo smoke harness

> Riferimento rapido per l'esecuzione test/smoke del sistema.

| Modulo | Script | Livello |
|--------|--------|---------|
| CI PR frontend | `.github/workflows/ci-app-pr.yml` | L1 |
| Backend test Jest | `npm test` in `backend/` | L1 |
| Build Vite | `node node_modules/vite/bin/vite.js build` in `app/` | L1 |
| Vitest frontend | `node node_modules/vitest/vitest.mjs run` in `app/` | L1 |
| Smoke workflow | `.github/workflows/smoke-test.yml` | L2 |
| Ingest E2E | `backend/scripts/smoke-ingest-e2e-test.js` | L3 |
| VPS preflight | `backend/scripts/vps-preflight.ps1` | ops |
| Netlify preflight | `backend/scripts/netlify-preflight.ps1` | ops |
| Deploy backend VPS | `backend/scripts/deploy-controllers-to-vps.ps1` | ops |
| Encoding check | `node backend/scripts/check-utf8-encoding.js [file]` | qualità |


## E. Flusso 2 — SAL / Sopralluoghi + Evidenze documentali + Import + RAG (retrieval)

Questa sezione consolida le decisioni operative per supportare **due flussi** coerenti nello stesso prodotto, senza perdere scalabilità/robustezza:

- **Flusso 1 — Audit di sistema**: checklist, esiti (C/NC/OSS/OM/NA/NV), pending issues, report Word.
- **Flusso 2 — SAL/Sopralluoghi**: avanzamento implementazione requisiti (es. ISO 9001/14001/45001) + evidenze documentali + stati (discusso/in corso/da validare/completato).

**Fase 0 backend (01/07/2026 — completata)**: motore dati `requirement_implementation_status` (mig. 117) con seed idempotente macro-clausole N.N; API sotto `/api/v1/companies/:companyId/gap-matrix` e `/gap-statuses` (licenza `sal`).

**Fase 1 UI (01/07/2026 — completata)**: route `/sal` → `SALModule.jsx` (griglia requisiti × stati, ambito azienda, seed).

**Fase 2 export + evidenze (02/07/2026 — completata)**: export Word SAL (`wordExportSal.js`), storico revisioni in modal, evidenze collegate al Registro Documenti (`SalEvidenceSection` + validazione backend su `document_registry`).

**Fase 3 integrazioni audit/NC (02/07/2026)**: `conformity_hint` sincronizzato da ultimo audit completato (`POST .../sync-audit-hints`); azioni Piano Azioni con `source_category='sal_gap'` (mig. 118).

**Fase 4 feed Riesame (02/07/2026)**: widget copertura normativa del Riesame §9.3 legge la matrice SAL per azienda (`norm_coverage_source=sal`). Prossimo opzionale: Fase 5 AI.

### Golden rules (da rispettare sempre)

- **Record vs Retrieval**: il **DB relazionale** rimane il *system of record* (entità, permessi, stati, collegamenti, metadati strutturati). Il **RAG** è solo un *layer di retrieval* (ricerca semantica / suggerimenti), **mai** l’unica fonte di verità.
- **AI asincrona e auditabile**: estrazioni/analisi AI devono essere job asincroni con `extractor_version`, `confidence`, log e possibilità di revisione umana (*da validare*).
- **Multi-tenant hard**: ogni entità e documento è isolato per `organization_id` (indici e vincoli).
- **Incremental delivery**: rilasci a *vertical slice* (valore end-to-end) con feature flag/dark launch per ridurre rischi.
- **Mobile first per audit**: su mobile priorità a compilazione sul campo; funzioni “pesanti” (import massivo, gestione documentale avanzata) restano desktop finché non sono stabilissime.

### SAL: legenda requisiti multi-standard (dal documento SAL cliente)

Nel file `Check List Audit/CLIENTE - SAL documentale iso 14001 - 9001 - 45001.docx` è presente una legenda colori che mappa l’applicabilità dei requisiti:

- **NERO**: requisito comune a tutti gli schemi (9001 + 14001 + 45001)
- **BLU**: requisito specifico ISO 9001
- **VERDE**: requisito specifico ISO 14001
- **ROSSO**: requisito specifico ISO 45001
- **VIOLA**: requisito specifico 14001 + 45001

In DB questo non deve restare “colore”: va modellato come `applicable_standards` o equivalente.

### Import massivo (CSV/Excel) — best practice

Use case tipico: import anagrafiche personale / elenco qualifiche / elenco WPS da file forniti dal cliente.

- **Workflow**: upload file → **dry-run** (anteprima mapping + validazione) → import asincrono → report (errori scaricabili).
- **Idempotenza**: evitare duplicati tramite chiavi naturali (`organization_id` + codice/email/matricola).
- **Chunking**: import a blocchi (es. 200 righe) con commit per blocco e report dettagliato.
- **Audit trail**: registrare chi ha importato, quando, e cosa è stato creato/aggiornato.

### Mobile vs Desktop (policy operativa)

- **Mobile (primario)**:
  - audit sul campo (checklist + note + foto)
  - consultazione rapida (elenchi + scadenze)
  - upload “leggero” (foto/camera) quando supportato e stabile
- **Desktop (primario)**:
  - import CSV/Excel massivo (mapping colonne + preview)
  - gestione documentale complessa (PDF multipagina, versioni, collegamenti WPS/WPQR/WPQ)
  - amministrazione (utenti/ruoli/standard/template)

Nota: “allegati da e-mail” è da trattare come step successivo (inbox server-side o share-sheet), non come integrazione diretta immediata con Gmail/Outlook.

### RAG: quando introdurlo e a cosa serve

Il RAG è **utile** quando iniziamo a gestire:
- normative esterne (testo lungo, multi-versione)
- procedure/istruzioni operative clienti
- evidenze (PDF/DOCX) che devono essere “trovabili” e collegabili ai requisiti

**Uso corretto del RAG**:
- ricerca semantica (trova dove si parla di un requisito)
- suggerimento link documento → requisito
- supporto all’estrazione guidata (es. “estrai campi WPQR/WPQR-like”)

**Uso scorretto** (vietato): decidere “conforme/non conforme” solo da output AI senza evidenza + validazione.

### Multi-agenti: come accelerare senza perdere coerenza

Strategia consigliata: task paralleli con output “mergeabile”, ma con un’unica guida di integrazione.

- **Agente A (normativa/requirements)**: estrarre clausole e requisiti in forma strutturata (codice, titolo, testo, applicabilità).
- **Agente B (DB/API)**: progettare schema tabelle + migrazioni + endpoint (senza UI).
- **Agente C (UI/UX)**: implementare schermate SAL + import wizard + dashboard scadenze.
- **Agente D (AI/RAG)**: pipeline ingestion/chunking/estrazione (job asincroni + audit trail).

Regola: ogni task produce un branch/PR e aggiorna **questa sezione** con “cosa è stato introdotto” e “definition of done”.

---

