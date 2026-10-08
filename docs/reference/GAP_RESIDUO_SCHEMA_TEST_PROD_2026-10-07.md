# Gap residuo schema TEST ↔ PROD dopo i batch A+B1+B2+C (07/10/2026)

**Solo analisi in sola lettura** · TEST `2026-06-18_SGQ_ISO9001` vs PROD `SGQ_ISO9001` · rilevazione a fine giornata, dopo l'apply su TEST dei batch A, B1, B2, C ([piano](PIANO_ALLINEAMENTO_SCHEMA_TEST_2026-10-07.md)). Metodo: sole `SELECT` su `sys.*` (una connessione per DB, `DB_NAME()` verificato), nessun dato di business; credenziali dalla sezione `production`/`test` di `config/database.json` (le sole `DB_*` dei `.env` non autenticano). PROD invariato rispetto alla rilevazione precedente (1805 colonne, 220 righe FK, 97 CHECK). Nessun apply, nessuna migrazione, nessun restart (MainPID TEST/PROD invariati). **Nessun passo successivo è proposto in automatico**: ogni eventuale azione richiede decisione e sì esplicito del committente.

## 1. Numeri prima → dopo

| Oggetto | TEST→PROD prima | TEST→PROD dopo | Solo PROD prima → dopo | Solo TEST | Diverso prima → dopo |
|---|---|---|---|---|---|
| Tabelle | 116→127 | 124→127 | 11 → **3** | 0 | - |
| Colonne | 1615→1805 | 1781→1805 | 190 → **24** | 0 | 2 → **0** |
| Indici/PK/UNIQUE | 406→444 | 434→444 | 39 → **10** | 1 → **0** | 0 → 0 |
| FK | 201→218 | 217→218 | 17 → **1** | 0 | 1 → **0** |
| CHECK | 91→97 | 97→97 | 6 → **0** | 0 | 0 → 0 |
| Trigger/viste/SP/funzioni | uguali | uguali | 0 | 0 | 0 |

Nomi auto-generati di PK diversi (`PK__<tab>__…`): 14 → 19, ignorati (le tabelle create su TEST hanno hash diversi). Nessuna differenza di default, tipo, nullable, collation, `ON DELETE/UPDATE`, `is_not_trusted`.
Chiuso: 8 tabelle, 166 colonne, 29 indici, 16 FK, 6 CHECK; i due "diversi" (`non_conformities.audit_id` ora nullable, `norm_document_sources.norm_title` ora 500 caratteri), il residuo TEST `FK_non_conformities_audit` CASCADE e l'indice globale `UX_ndt_reports_number` (ora `UX_ndt_reports_org_number` come PROD, filtrato su `report_number IS NOT NULL`).

## 2. Gap residuo per gruppo

| Gruppo (migrazione) | Oggetti solo PROD | Uso in `origin/main` | Priorità |
|---|---|---|---|
| `management_reviews` (110-riesame, **nessun `.sql` nel repo**) | 4 colonne `NVARCHAR(MAX) NULL`: `input_context_changes`, `input_customer_satisfaction`, `input_process_performance`, `input_risk_effectiveness` | `managementReviews.controller`: `createReview` INSERT (righe 139-199) → `POST /management-reviews`; `updateReview` (campi dinamici, riga 235) → `PUT /management-reviews/:id`; `generateOutputs` SELECT esplicita (riga 942) → `POST /management-reviews/:id/generate-outputs` fallisce sempre | **ALTA** |
| `ai_assistant_usage`, `ai_assistant_notifications` (167, fuori perimetro) | 2 tabelle, 12 colonne, 2 PK, 3 indici, 1 UQ, 1 FK | `questionAssistant.controller`: INSERT/SELECT in `try/catch` (`logger.error`) → `POST /question-assistant` non fallisce, il log d'uso AI su TEST non si registra | MEDIA |
| `ingest_reference_patterns` (120, **mai inclusa nei batch**) | 1 tabella (8 colonne, PK, UQ, indice; 22 righe in PROD) | `ingestReferencePattern.service`: lettura con catch «Invalid object name» (ritorna `[]`), scrittura fire-and-forget → l'apprendimento pattern dell'ingest su TEST non è esercitato | MEDIA |
| `auditor_orgs` (144, **non nel piano**) | `UX_auditor_orgs_email` (UNIQUE filtrato `email IS NOT NULL`) | `POST /auditor-orgs` (`auditorOrg.controller`): su TEST due richieste concorrenti con stessa email creano studi duplicati; PROD le rifiuta | MEDIA |
| `attachments` (108, no-op per colonna già presente) | `IX_attachments_ndt_item` | vedi (a) | BASSA |

## 3. Punti specifici

- **(a) `IX_attachments_ndt_item`:** esiste su PROD (non unico, **filtrato** `ndt_report_item_id IS NOT NULL`, colonna `ndt_report_item_id`, NONCLUSTERED); assente su TEST (la colonna esiste in entrambi). Impatto: solo performance. Usano la colonna `attachment.controller` `listAttachments` (filtro `?ndt_report_item_id=`), `attachmentScope()` (LEFT JOIN su `ndt_report_items`) e l'upload allegato CND (`POST /attachments/upload`). Con 235 righe su TEST nessun effetto percepibile: BASSA.
- **(b) 4 colonne `input_*`:** assenti su TEST, presenti su PROD (`NVARCHAR(MAX) NULL`). Non esiste alcun `.sql` nel repo (script storico della "110 riesame" sovrascritto: commit `dd86fdee`, poi `18407371`). Uso e priorità: tabella §2, riga 1. `input_monitoring` (112) è presente su entrambi.
- **(c) 167:** su TEST le due tabelle non esistono. Su PROD esistono (0 righe): `ai_assistant_usage` senza alcuna FK; `ai_assistant_notifications` ha `FK_ai_assistant_notif_org` → `organizations(organization_id)` con `ON DELETE CASCADE`, trusted. `FK_ai_assistant_usage_org/_user` non esistono in nessuno dei due DB. Nessuna proposta.
- **(d) Tabelle PROD senza `CREATE TABLE` nel repo (19):** `attachments`, `audit_custom_checklist_responses_history`, `audit_history`, `audit_responses`, `audit_responses_backup_20260111`, `audit_responses_history`, `audits`, `audits_history`, `checklist_questions`, `checklist_sections`, `non_conformities`, `organizations`, `project_welders`, `projects`, `standards`, `studio_document_schemas`, `sync_metadata`, `sysdiagrams`, `users` (baseline non versionata). **Residui solo-TEST: nessuno** (0 tabelle, colonne, indici, FK, CHECK). Attesi dai runner ma assenti in entrambi i DB: `IX_norm_req_standard` (100), `IX_equipment_assets_calibration` (101/104).
- **(e) `not_trusted`:** identico in TEST e PROD. `CK_nc_source_category`, `CK_ris_status`, `CK_rish_status`, `CK_doc_registry_content_scope` e `FK_nc_management_review` sono `is_not_trusted = 1` (WITH NOCHECK) in entrambi; nessun vincolo disabilitato; tutte le altre FK/CHECK trusted.

## 4. Affidabilità di TEST come pre-release

Il gap ALTA rimasto è uno: riesame (`POST/PUT /management-reviews`, `generate-outputs`). Allegati, NC, Welding Book, profilo azienda, Rischi 4.1/4.2, SAL, qualifiche, NDT, progetti, checklist custom e ingest norme sono ora allineati a livello di schema. Restano due moduli MEDIA che degradano in silenzio (167, 120) e un vincolo di unicità (144) che su TEST non protegge dai duplicati.

## 5. Fuori perimetro

167 e PR #739; drift senza migrazione (4 `input_*`, 19 tabelle baseline, FK PROD di `ai_assistant_notifications`); versionamento dei `.sql` 112/113; hardening degli altri runner; tabella di tracking migrazioni; PROD. Artefatti di dettaglio (CSV, JSON di schema) non nel repo.
