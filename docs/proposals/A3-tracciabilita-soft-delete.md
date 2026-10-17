# A3 — Tracciabilità delle modifiche e niente cancellazioni definitive

Proposta. Nessun controller è stato modificato in questa PR. I file `database/migrations/175_*` e `176_*` sono additivi e **non sono stati applicati** su TEST né su PROD.

## Approvazione 17/10/2026

Il committente ha approvato le tre raccomandazioni, con questa formulazione:

1. nessuna purge automatica;
2. cestino, storico e ripristino solo per admin e superadmin della stessa organizzazione;
3. Elimina = soft delete; revocata e chiusa restano stati di business, distinti dal cestino.

Nessuna purge entra nel codice. Gli SQL 175 e 176 restano quelli già in questa bozza e restano non applicati: servono alla PR di codice, che è separata.

Base di lettura: `origin/main` `c799174518084c488a4b87096200badde25dc031`. Ultima migrazione su quel commit: `174`. Numeri usati qui: **175** e **176** (liberi; nessuna PR aperta li occupa).

## Fonte normativa già nel repo

Testo presente, letto e non parafrasato come se fosse un obbligo in più:

- `docs/Normative/UNI EN ISO 9001_2015 Rev. 0.md:901-919` — §7.5.3. Le informazioni documentate vanno tenute sotto controllo (disponibilità, protezione). Il controllo, per quanto applicabile, comprende distribuzione e accesso, archiviazione e preservazione, **tenuta sotto controllo delle modifiche (per esempio controllo delle versioni)**, **conservazione ed eliminazione**. Le informazioni conservate come evidenza di conformità vanno protette da alterazioni involontarie. La nota sull'accesso distingue chi può solo vedere da chi può vedere e modificare.
- Stesso file, `1531-1535` (appendice A.6). Il termine «registrazioni» della ISO 9001:2008 è oggi «conservare informazioni documentate». **La durata e il mezzo li determina l'organizzazione.** Nel testo non c'è un numero di anni.

`docs/adr/ADR-008-event-sourcing-sync.md:42` riassume il §7.5.3 come «chi ha modificato cosa e quando». È una lettura di progetto, non una frase della norma. L'ADR-003 cita una retention di 10 anni in chiave GDPR: non è nel testo della norma presente nel repo e **non** è un vincolo di questa proposta.

Coperte: §7.5.3 e A.6 nel Markdown già in `docs/Normative/`. Mancanti: nessun periodo di conservazione ufficiale. Si parte sul testo presente: log di modifica, soft delete, eliminazione fisica solo come atto controllato futuro, senza inventare una scadenza.

## 1. Log e versioni già esistenti

| Oggetto | Dove nasce | Cosa registra | Chi lo scrive oggi |
|---|---|---|---|
| `audit_events` | `database/migrations/046_audit_events_T2.sql:9-38` | tipo evento, `field_path`, `old_value`, `new_value`, `user_id`, `client_ts`, `server_ts` | `POST /api/v1/audits/:uuid/events` — `backend/src/routes/auditEvents.routes.js:7`, insert in `backend/src/controllers/auditEvents.controller.js:54-67`. Tipi chiusi dal CHECK (solo dominio audit). |
| Temporal `audits` / `audit_responses` | `database/migrations/045_temporal_tables_T1.sql:1-29` | riga precedente con `ValidFrom`/`ValidTo` (colonne nascoste) | SQL Server a ogni UPDATE/DELETE. Su TEST e PROD `temporal_type = 2` per le due tabelle correnti e `1` per `audits_history` / `audit_responses_history`. Non c'è una colonna «attore» dedicata. |
| `audit_history` | descritta in `docs/reference/DATABASE.md:213-224` (`changed_by`, `field_changed`, `old_value`, `new_value`) | schema previsto per il §7.5.3 | Nel repo **non** c'è un `INSERT INTO audit_history`. L'hard delete la svuota: `backend/src/services/auditMaintenance.service.js:80-81`. Su entrambi i DB la FK verso `audits` è `ON DELETE CASCADE` (`FK_audit_history_audit`). |
| `document_history` | `database/migrations/058_document_history.sql:21-34` | `changed_by`, tipo, campo, prima/dopo | `backend/src/services/documentHistoryTracker.service.js:13-16`. Chiamate reali: creazione (`backend/src/controllers/document.controller.js:576`) e spostamento (`backend/src/controllers/documentTree.controller.js:218`). `trackUpdate`, `trackStatusChange`, `trackTagChange`, `trackRelationChange` sono definite (`documentHistoryTracker.service.js:36-58`) e non hanno chiamanti. |
| `user_audit_log` | `database/migrations/130_user_audit_log.sql:13-35` | attore, azione, campo, prima/dopo, `created_at` UTC | `backend/src/services/userAudit.service.js:53-58`. Solo eventi utente (ruolo, disattivazione, inviti, reset). |
| `ai_interactions` | `backend/database/migrations/053_ai_interactions.sql:3-16` | provider, modello, token, costo, `context_summary` NVARCHAR(500) | `backend/src/middleware/aiAuditTrail.middleware.js:21-36`. Non il prompt. |
| `ai_usage_log` | `backend/database/migrations/064_ai_usage_log.sql:8-22` | `message` fino a 2000 caratteri, `reply_preview` fino a 500 | chat assistente, `backend/src/controllers/aiChat.controller.js:273-284`. È la domanda in chat, non il prompt di ingest del PDF. |
| `ai_assistant_usage` | `database/migrations/167_ai_usage_log.sql:10-18` | feature, norma, flag `has_source`, utente, data | question assistant. Nessun testo di prompt. |
| `ingest_staging` | `database/migrations/114_ingest_staging.sql:6-27` | campi estratti in `staged_fields_json`, path del file | il testo integrale del PDF non è una colonna. Per le norme la chiave `_extracted_text` può finire dentro il JSON: `backend/src/controllers/normUpload.controller.js:145` e lettura in `backend/src/services/ingestStaging.service.js:221`. |
| `import_job_files.extracted_text` | colonna NVARCHAR(MAX), presente su TEST e PROD | testo estratto dal PDF/OCR | `backend/src/controllers/importJobs.controller.js:358`. |
| `commercial_case_drawing_extractions.raw_response` | NVARCHAR, presente su entrambi i DB | risposta AI, tagliata a 1_000_000 caratteri | `backend/src/controllers/contractReview.controller.js:1596-1608`. È l'output, non il prompt inviato. |

`deleted_at` esiste solo su `audits` e `audits_history` (DATETIME2 nullable). `deleted_by` non esiste su nessuna tabella. `is_deleted` (BIT NOT NULL) è su `audits`, `audits_history`, `equipment_assets`, `management_reviews`, `ndt_reports`, `objectives`, `rdp_reports`, `risks`, `welding_books`, `sync_metadata`. Stesso elenco su TEST e PROD.

## 2. Endpoint DELETE

Prefisso reale: `API_BASE` in `backend/src/server.js:276-336` (`/api/v1` nell'example di ambiente). «Evento» qui significa una riga in `audit_events`, `document_history` o `user_audit_log`. Il `logger.info` di Winston registra l'azione (e a volte l'id utente), non i valori prima/dopo: il formato in `backend/src/utils/logger.js:10-16` stampa solo messaggio e stack.

### Evidenze chieste in modo esplicito

| Path | SQL | Evento strutturato |
|---|---|---|
| `DELETE /api/v1/qualifications/:id` | `UPDATE qualifications SET status='revocata'` — `qualifications.controller.js:1022-1023`. È uno **stato di business**, e la route dice che in UI non è più esposto (`qualifications.routes.js:96-100`, header `qualifications.controller.js:25-26`). | no |
| `DELETE /api/v1/qualifications/:id/permanent` | `DELETE FROM qualification_confirmations`, `qual_notification_log`, `qualifications` — `qualifications.controller.js:1118-1124`. Poi `unlink` del file certificato — `1126-1133`. Log testuale con id utente — `1139`. | no |
| `DELETE /api/v1/welding/wps/:id/welders/:welderId` | `DELETE FROM wps_welders` — `welding.controller.js:1049-1052` | no (solo `logger.info` a `1054`) |
| `DELETE /api/v1/projects/:id/welders/:qualificationId` | `DELETE FROM project_welders` — `projects.controller.js:641-644` | no |
| `DELETE /api/v1/welding/wps/:id` | prima le dipendenze, poi `DELETE FROM wpqr_records` e `welding_procedures` — `welding.controller.js:459-478`. Le dipendenze sono `DELETE FROM wpqr_test_runs` e `wps_wpqr_links` — `wpqrTestRuns.service.js:462-473` e `477-485`. | no |
| `DELETE /api/v1/welding/wpqr/:id` | stesse dipendenze, poi `DELETE FROM wpqr_records` — `welding.controller.js:867-872` | no |
| `PUT /api/v1/welding/wpqr/:id/test-runs` | non è un DELETE HTTP: `replaceTestRuns` sostituisce il set di passate (il test in `welding.controller.wpqrTestRuns.test.js:201` si aspetta un `DELETE FROM wpqr_test_runs`) | no |
| `DELETE /api/v1/projects/:id` | se `status = 'offerta'`: `DELETE FROM project_welders` e `projects` (`projects.controller.js:497-506`). Altrimenti `UPDATE status = 'chiusa'` (`509-512`). `chiusa` è uno stato di commessa, contato nelle card (`214-220`). | no |
| `DELETE /api/v1/attachments/:id` | `DELETE FROM attachments` e unlink del file — `attachment.controller.js:711-718` | no |
| `DELETE /api/v1/documents/:id` | `UPDATE document_registry SET status = 'obsoleto'` — `document.controller.js:800-804`. La lista senza filtro status nasconde gli obsoleti (`128-130`). | no: il soft delete non chiama `trackStatusChange` |
| `DELETE /api/v1/contract-reviews/:id/documents/:linkId` | `DELETE FROM commercial_case_documents` — `contractReview.controller.js:1014-1016` | no |
| `DELETE /api/v1/contract-reviews/:id/checklist/:itemId/attachments/:attachmentId` | `DELETE` da `commercial_case_checklist_attachments` — `commercialChecklistAttachment.service.js:172-184` | no |

### Già soft, con un buco sull'hard delete

| Path | Comportamento | Evento |
|---|---|---|
| `DELETE /api/v1/audits/:id` | bozza o ruolo admin: hard delete (`audit.controller.js:714-723`) che cancella allegati, risposte, NC, standard, `audit_history` e l'audit (`auditMaintenance.service.js:58-88`). Gli altri casi: `is_deleted = 1`, `deleted_at = GETDATE()` (`732-736`). | no riga di log applicativa. Le temporal tables tengono la riga precedente finché il DELETE non è fisico. `audit_events` non è nel CASCADE: `companyMaintenance.service.js:86-88` lo svuota prima, quando si cancella l'azienda. |
| `DELETE /api/v1/ndt-reports/:id` | testata `is_deleted = 1` (`ndtReports.controller.js:594`); le righe figlie `ndt_report_items` / `ndt_report_instruments` sono DELETE fisico in altri punti del controller (`513`, `541`) | no |
| `DELETE /api/v1/rdp-reports/:id` | testata `is_deleted = 1` (`rdp.controller.js:564`); `rdp_tests` / `rdp_sections` hanno DELETE fisico (`153`, `168`) | no |
| `DELETE /api/v1/welding-books/:id` | `is_deleted = 1` (`weldingBooks.controller.js:500`). I cordoni/attrezzature hanno DELETE fisico (`217`, `302`) | no |
| `DELETE /api/v1/equipment/:id` | `is_deleted = 1` (`equipment.controller.js:342`) | no |
| `DELETE /api/v1/risks/:id`, `DELETE /api/v1/objectives/:id` | `is_deleted = 1` (`risks.controller.js:712`, `866`) | no |
| `DELETE /api/v1/management-reviews/:id` | `is_deleted = 1` (`managementReviews.controller.js:278`) | no |
| `DELETE /api/v1/admin/users/:id` | `is_active = 0` (`admin.controller.js:625`) e riga `user_audit_log` (`629`) | sì, prima/dopo sull'evento utente |
| `DELETE /api/v1/companies/:companyId/personnel/:id` | `active = 0` (`companyPersonnel.controller.js:414-430`) | no |

### Altri DELETE fisici nei controller

| Path o chiamata | SQL | Evento |
|---|---|---|
| `DELETE /api/v1/non-conformities/:id` | `DELETE FROM non_conformities` (`nc.controller.js:1227-1245`). FK `FK_nc_actions_nc` è CASCADE: spariscono anche le azioni. | no |
| `DELETE /api/v1/non-conformities/:id/actions/:actionId` | `DELETE FROM nc_actions` (`nc.controller.js:1616`) | no |
| `DELETE /api/v1/audits/:auditRef/push-to-nc-register` | `DELETE FROM non_conformities` sulle NC aperte appena spinte (`nc.controller.js:1954`) | no |
| `DELETE /api/v1/audits/:auditId/responses/:questionId` | `DELETE FROM audit_responses` (`response.controller.js:611-614`). La temporal table conserva la riga precedente. | no evento `audit_events` in questo metodo (solo `logger.info` a `619`) |
| `DELETE /api/v1/companies/:id` | `hardDeleteCompany` (`company.controller.js:480`), che passa dagli audit e quindi da `audit_events` + hard delete (`companyMaintenance.service.js:78-90`) e dal registro documenti (`72-75`) | no |
| `DELETE /api/v1/import-jobs/:id` | unlink dei file non referenziati e `DELETE FROM import_jobs` (`importJobs.controller.js:255-260`). FK `FK_ijf_job` è **CASCADE**: la riga `import_job_files` (testo estratto compreso) se ne va con il job. | no |
| `POST .../documents/:docId/extract` | non è un DELETE di route: prima di reinserire cancella estrazione e requisiti precedenti (`drawingExtraction.controller.js:134-148`), quindi anche `raw_response` | no |
| `DELETE /api/v1/complaints/:id` | `DELETE FROM complaints` (`complaints.controller.js:250`) | no |
| `DELETE /api/v1/suppliers/:id` e `.../evaluations/:evalId` | `DELETE FROM supplier_evaluations` poi `suppliers` (`suppliers.controller.js:201-202`, `293`) | no |
| `DELETE /api/v1/departments/:id` | `DELETE FROM departments` (`departments.controller.js:162`) | no |
| `DELETE /api/v1/deadline-items/:itemId` | `DELETE FROM deadline_items` (`deadlines.controller.js:608`); anche in cascata dal documento (`309`) | no |
| `DELETE /api/v1/context-factors/:id`, `interested-parties/:id` | DELETE fisico (`contextFactors.controller.js:160`, `interestedParties.controller.js:150`) | no |
| `DELETE /api/v1/custom-checklists/:id` (e section/item) | `DELETE FROM custom_checklists` (`customChecklist.service.js:147`) | no |
| `DELETE /api/v1/report-templates/:id` | DELETE assegnazioni e template (`reportTemplate.controller.js:508-516`) | no |
| `DELETE /api/v1/commercial-checklist-templates/:id` | delete del template nel service omonimo | no |
| `DELETE /api/v1/document-tags/:id`, `.../tags/:tagId`, `document-relations/:id` | DELETE fisico (`documentTags.controller.js:188-189`, `323`; `documentRelations.controller.js:147`). Non passano da `document_history`. | no |
| `DELETE /api/v1/notification-contacts/:id` | `DELETE FROM notification_contacts` (`notificationContacts.controller.js:145`) | no |
| `DELETE /api/v1/companies/:companyId/certification-findings/:findingId` | `DELETE FROM certification_findings` (`certificationFindings.controller.js:157`) | no |
| `DELETE /api/v1/admin/users/:id/company-access/:companyId` | `DELETE FROM user_company_access` (`admin.controller.js:1049`) con `user_audit_log` (`1055`) | sì |
| Logo azienda / organizzazione | cancellazione del file, non di un'evidenza di conformità | no |
| Rivalutazione certificato materiale | `DELETE FROM material_certificate_checks` prima del reinserimento (`materialCertificates.controller.js:570-573`). Non è l'endpoint di cancellazione del certificato. | no |
| `sync.controller.js:330` e `audit.controller.js:647` / `1090` | `DELETE FROM audit_standards` nel replace dell'elenco norme dell'audit | no |

## 3. Cosa è già tracciato

- **Chi, quando, campo, prima e dopo:** `audit_events` (solo checklist/audit, e solo se il client invia l'evento) e `user_audit_log` (solo account).
- **Quando e riga precedente, senza attore:** temporal tables su `audits` e `audit_responses`.
- **Chi e quando sull'azione, senza i valori:** la maggior parte dei `logger.info` (WPS eliminata, commessa eliminata, allegato eliminato, qualifica eliminata in modo definitivo con id utente).
- **Previsto e non alimentato:** `audit_history`; le funzioni di `document_history` diverse da creazione e spostamento; il passaggio a `obsoleto`.
- **Stato di business scambiato per cancellazione:** `qualifications.status = 'revocata'` e `projects.status = 'chiusa'`. Restano stati. Il soft delete di A3 è un'altra colonna.

## 4. Residuo A2 — dove finisce il testo del PDF

A2 (`docs/GUIDA_CONSOLIDATA.md`, lezione del 14/10/2026, e il commento in `backend/src/utils/aiPromptPrivacy.js:7-10`) redige il **contorno** del prompt. Il testo del documento resta nel messaggio inviato al provider. Qui solo il percorso e il tipo di dato, senza testi di prompt né dati personali.

| Dove | Tipo di dato | Percorso |
|---|---|---|
| Memoria del processo, poi HTTPS verso il provider AI | prompt di sistema (istruzioni + schema) e messaggio utente con il testo del documento, troncato a `MAX_INPUT_CHARS` (default 20_000) | `backend/src/services/importAiExtraction.service.js:184-192` e `281-296`; invio in `aiProviderAdapter.js:74-93` → `geminiAdapter.js:112-116` (body JSON, nessun `logger` nel adapter) |
| Retry JSON | di nuovo il testo, primi 3_000 caratteri, nel messaggio utente verso `chat()` | `documentIngestPipeline.service.js:195-207` |
| Journal e file di log | oggi **non** il prompt. Il fallimento del retry scrive lunghezze e messaggio di errore redatto (`documentIngestPipeline.service.js:217-228`). Winston non serializza l'oggetto passato come secondo argomento (`logger.js:13-15`). | Sul VPS, conteggio della stringa di codice «Testo documento» in journal (`sgq-backend` e `sgq-backend-test` dal 2026-09-01) e nei `combined`/`error`/`app.log`: **0**. I file di log esistono (`/var/www/sgq-backend/logs/`, `/var/www/sgq-backend-test/logs/`). |
| Tabella `import_job_files.extracted_text` | testo estratto (lo stesso che entra nel prompt), NVARCHAR(MAX) | scrittura `importJobs.controller.js:358`. Cancellare il job lo porta via per CASCADE (`FK_ijf_job`, visto su entrambi i DB). |
| `import_job_files.ai_extraction_json` | JSON dei campi restituiti dall'AI, non il prompt | colonna della migrazione `039` |
| `ingest_staging.staged_fields_json` | campi estratti; per le norme può contenere la chiave `_extracted_text` | `normUpload.controller.js:145`, `ingestStaging.service.js:221` |
| `norm_document_sources.extracted_text` | testo della norma digitalizzata | colonna presente su entrambi i DB |
| `commercial_case_drawing_extractions.raw_response` | risposta AI del riesame, fino a 1e6 caratteri | `contractReview.controller.js:1598-1608` |
| `ai_usage_log.message` | domanda della chat (max 2000), non l'ingest | `aiChat.controller.js:283` |
| `ai_interactions.context_summary` | riassunto corto (max 500 nello schema) | `aiAuditTrail.middleware.js:35` |
| Disco | byte del PDF | codice: `UPLOAD_DIR` oppure `uploads/` sotto il backend; URL ammessi `/uploads/qualifications/` e `/uploads/imports/<org>/<job>/` (`certificateFileUrl`). Sul VPS, senza elencare nomi file: `/var/www/sgq-backend/uploads/qualifications` (216 file), `uploads/wpqr` (27), `uploads/imports` (4 sottocartelle). La directory configurata in `UPLOAD_DIR` del `.env` di produzione è vuota: i file trovati sono nell'albero `uploads` del deploy. Anche `/var/www/sgq-backend-test/uploads` e `uploads-test` hanno file. |

Non esiste una tabella «prompt». Il residuo DPA è: il testo esce verso il provider, resta in `extracted_text` (e a volte nel JSON di staging delle norme) e il PDF resta su disco. Questa proposta non cambia quel flusso: è una fase successiva (sezione 8).

## 5. Schema TEST e PROD (solo metadati)

Lettura del 16/10/2026, `SELECT` su `sys.tables` / `sys.columns` / `sys.foreign_keys`. Database: PROD `SGQ_ISO9001` (processo `sgq-backend`, `NODE_ENV=production`), TEST `2026-06-18_SGQ_ISO9001` (processo `sgq-backend-test`, environ `DB_DATABASE` confermato, `NODE_ENV=test`). Nessuna riga di business letta. Nessun `INSERT`/`UPDATE`/`DELETE`/`ALTER`. MainPID invariati prima e dopo: **sgq-backend 992684**, **sgq-backend-test 991647** (entrambi `active`, `NRestarts=0`).

Sulle tabelle della sezione 1 e della sezione 2 (audit, documenti, qualifiche, WPS/WPQR, passate, link, commesse, allegati, NC, riesame, import, staging, tabelle AI, NDT/RDP/libri/attrezzature/rischi): **stessi nomi di tabella, stesse colonne, stessi tipi, stessa nullabilità**. `temporal_type` identico. Le FK con azione diversa da `NO_ACTION` elencate in sezione 2 sono le stesse 20 sui due database.

Differenza solo di **ordine fisico** (`column_id`), nomi e tipi uguali, su cinque tabelle: `attachments`, `management_reviews`, `ndt_reports`, `qualifications`, `risks`. Non cambia il significato delle colonne. Le `ALTER` di 176 sono le stesse sui due ambienti.

## 6. Raccomandazione: un solo log generico

Una tabella `dbo.entity_change_log` (migrazione 175), sul modello di `user_audit_log`: organizzazione, nome tabella, id (stringa, così vale per `INT` e UUID), azione, campo, valore prima, valore dopo, attore, istante UTC.

Perché una sola, e non una tabella per entità: i log già buoni sono legati a un dominio (`audit_events` ha la FK su `audits` e un CHECK di tipi chiuso; `user_audit_log` è solo account; `document_history` non è alimentato sulle modifiche). Una tabella per qualifiche, una per WPS, una per NC replicherebbe lo stesso shape e tre lettori diversi. Il log generico si legge con `entity_table` + `entity_id`. Le temporal tables restano dov'è (audit): estendere `SYSTEM_VERSIONING` a tutte le tabelle non è un'aggiunta di colonna nullable e non registra l'attore.

Azioni ammesse dal CHECK: `created`, `updated`, `soft_deleted`, `restored`. Nessuna FK e nessun `ON DELETE CASCADE`: la riga di log non deve sparire insieme al record, e la tabella deve poter nascere anche sul database vuoto della CI (niente baseline sotto la 169).

Cosa si scrive, a partire dalle PR applicative (non in questa):

- update: una riga per campo cambiato, prima e dopo;
- soft delete e ripristino: una riga con l'azione, `field_name` nullo;
- il log è append-only. Nessun endpoint lo aggiorna o lo cancella.

## 7. Soft delete

Colonne, migrazione 176, nullable, senza default e senza FK: `deleted_at DATETIME2(7)`, `deleted_by INT`.

Tabelle di questa migrazione (oggi DELETE fisico di un'evidenza o di un legame): `qualifications`, `welding_procedures`, `wpqr_records`, `wpqr_test_runs`, `wps_wpqr_links`, `wps_welders`, `projects`, `project_welders`, `non_conformities`, `attachments`, `nc_actions`, `commercial_case_documents`, `commercial_case_checklist_attachments`.

Indice filtrato `(organization_id) WHERE deleted_at IS NULL` solo dove `organization_id` c'è già (`attachments`, `nc_actions` e i due legami del riesame non lo hanno: solo le colonne).

Regole per le PR applicative:

- Le liste, le card, i badge, la copertura (`isQualificationOperationallyActive` in `weldingCoordinatorAuth.service.js:157-159` oggi esclude solo `revocata`/`sospesa`) e i contatori aggiungono `deleted_at IS NULL`. Una riga con `deleted_at` valorizzato non entra nel totale operativo.
- `status = 'revocata'` sulla qualifica e `status = 'chiusa'` sulla commessa restano stati. L'Elimina in UI, oggi il permanent (`qualifications.controller.js:1032-1043`), diventa il soft delete.
- Il ripristino azzera `deleted_at` e `deleted_by` e scrive `restored`. Lo fa admin o superadmin della stessa `organization_id`. Gli altri ruoli non ricevono le righe cancellate, né in lista né in un cestino.
- Lo storico del log (prima/dopo) lo legge lo stesso perimetro: admin e superadmin del tenant. Non è una pagina per il cliente dell'azienda auditata.
- Fuori da 176, di proposito: `audits` ha già `is_deleted` + `deleted_at` (manca `deleted_by`, e l'hard delete admin/bozza resta il buco); `document_registry` usa `obsoleto`, che è il ciclo di vita del documento e va loggato come cambio stato, non raddoppiato con un secondo flag; NDT, RDP, welding book, attrezzature, rischi, obiettivi, riesame direzione hanno già `is_deleted` e vanno allineati in una PR successiva (`deleted_by` accanto, senza togliere il flag). SQL di quell'allineamento non è in questa PR.
- `DELETE /api/v1/companies/:id` e la cancellazione dei job di import restano fuori: sono pulizie di perimetro (azienda intera, bozza di import), non il soft delete di una evidenza. Il CASCADE sul testo estratto va trattato con la fase DPA.

Finché 176 non è applicata **e** il codice non filtra, le colonne NULL non cambiano liste e conteggi. Applicare il SQL senza la PR applicativa è innocuo e anche inutile.

## 8. Conservazione

Si tiene:

- il record soft-deleted (certificato, WPS, WPQR, passata, commessa, allegato, NC, legame);
- il file su disco finché il record esiste (l'unlink di `hardDeleteQualification` e di `deleteAttachment` non scatta più sul soft delete);
- ogni riga di `entity_change_log`;
- per gli audit non in hard delete, le temporal tables già presenti.

Non è una cancellazione definitiva: `obsoleto`, `revocata`, `chiusa`, `is_deleted = 1`, `is_active = 0`, `active = 0`. Sono stati o flag. Vanno distinti dal soft delete nuovo, e nessuno di questi è un purge.

È una cancellazione definitiva, oggi, tutto il resto della sezione 2 (DELETE fisico, CASCADE su storia audit, azioni NC, file di import). L'eliminazione controllata prevista dal §7.5.3.2 d) e la durata prevista da A.6 **non** si implementano in questa epic: nessun job che fa `DELETE` dopo N anni. Quando l'organizzazione fisserà una durata, sarà una migrazione a parte, con sì esplicito, backup e verify sui conteggi.

Il prompt assemblato non va persistito (oggi non lo è). Il testo in `extracted_text` e il PDF su disco sono copie del documento: la fase DPA decide per quanto restano dopo il commit, senza citare qui un numero di giorni.

## 9. Contatori, badge, liste

Devono usare lo stesso predicato della lista. Oggi non c'è `deleted_at` su queste query, quindi la PR applicativa lo aggiunge nello stesso punto in cui si calcola il numero della card:

- qualifiche: lista e `COUNT(*)` `qualifications.controller.js:303-343`; card `getStats` `405-414` (il totale oggi include anche le `revocata`);
- commesse: `getProjectStats` `projects.controller.js:214-222` (oggi `chiusa` è una card, e va bene che resti una card di stato; le righe con `deleted_at` escono da tutte le card, compresa `chiusa`);
- documenti: gli `obsoleto` sono già fuori dalla lista default (`document.controller.js:128-130`) e hanno una loro somma (`317`). Si lascia così;
- copertura saldatori: oltre a `revocata`/`sospesa`, escludere `deleted_at`;
- badge e alert che contano qualifiche, NC, WPS, allegati: stesso filtro, nella stessa funzione che colora la riga.

Una card «cestino» è solo per admin/superadmin e non ruba il conteggio alle card operative.

## 10. Migrazioni (non applicate)

| File | Cosa fa | Rollback |
|---|---|---|
| `database/migrations/175_entity_change_log.sql` | crea `entity_change_log`, due CHECK, due indici. Nessuna FK. | `175_rollback.sql` (drop manuale della tabella) |
| `database/migrations/176_soft_delete_columns.sql` | `deleted_at` / `deleted_by` nullable e indici filtrati dove c'è `organization_id` | `176_rollback.sql` (drop indici, poi colonne) |
| `175_verify.sql`, `176_verify.sql` | solo `SELECT` sui metadati, colonna `esito` PASS/FAIL | — |

In testa a 175 e 176: «NON APPLICARE senza sì». Non lanciare `run-migration-*` su TEST o PROD. Il runner della CI (`backend/scripts/apply-migrations-ci.js`) applica i file `>= 169` su un SQL **vuoto** di GitHub Actions: è il gate del repo, non un deploy. I file sono idempotenti; se la tabella di business non esiste (gap pre-169) la 176 fa skip. La 175 crea comunque il log, perché non dipende da quelle tabelle.

Nessun `ON DELETE CASCADE`. Statement separati (`GO` fra un `ALTER` e il successivo). Nessun backfill.

Non ho scritto SQL per: durata di retention, `deleted_by` sulle tabelle che hanno già `is_deleted`, documenti, audit, aziende, job di import. Dal 17/10/2026 le tre decisioni della sezione 12 sono approvate: nessuna purge, cestino solo admin/superadmin della stessa organizzazione, Elimina = soft delete con `revocata` e `chiusa` che restano stati. La forma di 175/176 copre quelle decisioni e non si cambia. Le colonne sulle altre tabelle restano all'allineamento applicativo successivo.

## 11. PR a fasi

Nessuna di queste PR va mergiata da questo agente. Questa bozza resta bozza.

1. **Questa PR (solo doc + SQL).** Nessun controller. Decisioni approvate il 17/10/2026 (sezione 12).
2. **Apply**, solo dopo un sì separato: 175 poi 176, prima TEST poi PROD, con i runner già nel repo, verify dei companion, backup prima del PROD. Rollback = i file `*_rollback.sql`, non un `DROP` inventato al momento. Un deploy del codice prima di quel sì rompe i DELETE, perché gli endpoint usano `deleted_at` e `deleted_by`.
3. **Prima PR di codice** (dopo l'approvazione): qualifiche, WPS/WPQR, passate e link, commesse, allegati, NC. L'Elimina scrive `deleted_at`/`deleted_by` e una riga in `entity_change_log`; liste, stats, badge, export e copertura filtrano `deleted_at IS NULL`; `revocata` e `chiusa` restano stati. Cestino e ripristino solo per admin e superadmin della stessa organizzazione. Nessuna purge. Il PDF dell'allegato resta su disco. La NC non si appoggia al CASCADE sulle azioni: soft delete della famiglia.
4. **Allineamento** di chi ha già `is_deleted` o `obsoleto`, unlink del riesame commerciale, hard delete degli audit (bozza/admin) e cancellazione azienda: sì separato, perché oggi è distruttivo.
5. **DPA / residuo A2:** non introdurre una tabella prompt; dopo il commit, politica sul testo in `extracted_text` e sui byte in `uploads/`. Il PDF collegato al record soft-deleted resta.

## 12. Decisioni approvate il 17/10/2026

1. **Durata di conservazione — approvata: nessuna purge automatica.** La norma, in A.6, lascia la durata all'organizzazione e non scrive un numero di anni. Record soft-deleted e `entity_change_log` restano finché non c'è una policy scritta. Il «10 anni» dell'ADR-003 non si adotta. Nessun job cancella le righe dopo N anni.
2. **Chi vede il cestino, lo storico prima/dopo e può ripristinare — approvata: solo admin e superadmin della stessa organizzazione.** Gli altri ruoli non vedono le righe con `deleted_at` valorizzato e non leggono il log. Fuori organizzazione la risposta è 404, come nel resto dello scope azienda.
3. **Elimina — approvata: Elimina = soft delete; revocata e chiusa restano stati di business, distinti dal cestino.** L'Elimina in UI non è più il DELETE fisico. `revocata` sulla qualifica e `chiusa` sulla commessa restano stati editabili.
