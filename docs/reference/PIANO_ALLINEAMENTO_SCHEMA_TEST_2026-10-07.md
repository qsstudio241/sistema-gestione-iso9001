# Piano di allineamento schema TEST → PROD (solo priorità ALTA)

**Stato: Batch A + B1 + B2 + C APPLICATI su TEST 2026-10-07 (108 no-op); PROD / 167 fermi** · aggiornato 07/10/2026 · `.sql` 112 e 113 ora in `database/migrations/` (nessun apply in questa PR) · base: `origin/main`

> Il report di gap (`gap-summary.md`, `migration-map.md`, `gap-columns.csv`, `gap-objects.csv`) **non è presente** in questo ambiente. Piano ricostruito dal repo (`database/migrations/`, `backend/database/migrations/`, runner `run-migration-*` in `backend/scripts/`, `docs/how-to/database-migrations.md`, `docs/reference/RISCHIO_MIGRAZIONI_168_169_2026-10-06.md`) e dai fatti del gap (TEST 116 → PROD 127 tabelle; 190 colonne mancanti: 166 in tabelle assenti + 24 in 7 comuni). **Batch A, B1, B2 e C sono già stati applicati su TEST** (esiti sotto). STOP prima di PROD / 167.

## 0. Esito Batch A (TEST, 2026-10-07)

Applicato su DB `2026-06-18_SGQ_ISO9001`. **STOP dopo A** (storico di quella sessione): B1 e B2 sono poi stati applicati lo stesso giorno — vedi §0b. Questa sezione usa solo i fatti del report Lead e dei log di quella sessione.

### Backup pre-A (punto di ripristino **prima** di A)

| Voce | Valore verificato |
|---|---|
| Path | `/var/opt/mssql/data/TEST_pre_batchA_20261007.bak` |
| Dimensione | 973202944 byte |
| Opzioni | `COPY_ONLY` + `CHECKSUM` (registrato in msdb) |
| Verifica | `RESTORE VERIFYONLY WITH CHECKSUM` OK |
| SHA-256 file | `5faecc85542ed6071cff43d240a07be1e8b889b554538d5548d207bf000917ef` |

Backup pre-A. Dopo B1+B2 esistono altri due `.bak` (pre-B1, pre-B2) — §0b / §4. Questo file ripristina lo schema **prima** di A (annulla anche A+B).

### Apply

Nessuna migrazione del batch A era già presente (pre-check: 116 tabelle; oggetti A tutti assenti).

| Mig | Come applicata | Esito |
|---|---|---|
| 110, 124, 145, 117, 122, 136, 138, 128 | runner solo-TEST #742 su `main` (`check` poi `apply`); `DB_NAME()` = `2026-06-18_SGQ_ISO9001` | OK (`apply completato: 8 migrazioni`, EXIT=0, `2026-10-07T13:57:34Z`) |
| 117, 138 | `USE SGQ_ISO9001` **strippato dal runner** (non eseguito su TEST): 117 riga 7, 138 riga 10 | 1 `USE` rimosso per file |
| 112 | `.sql` in `database/migrations/112_management_reviews_input_monitoring.sql` (DDL dai runner 112-*; su TEST 07/10 era script temp). **Nessun apply in questa PR** | colonna presente, nullable |

SHA-256 dei `.sql` usati dal runner (log apply, interi):

| Mig | SHA-256 |
|---|---|
| 110 | `1f4caf73e225f237aca67060f079e7542f81084ce575f5726c69cdd7bc35fe34` |
| 124 | `cbd02fdbbe2f38306d6fa9dddaa0baa642348acd63a713090d3ad1cec7ae2651` |
| 145 | `926acd885f37d6c3db092d7569a606d4ff602e910e4d61dd27693f49bfea3b08` |
| 117 | `d249742ae02bbc32b502ff3dd24cdcc55d4cdf6d96181d34cf2b34fcfa9babcd` |
| 122 | `4b9ab657a7832a5d2d918dcc3b321ac42e566a29d9abe2c2c732cdf2099f19b6` |
| 136 | `f790412c4bd881340ad48ef7515fbf6332c6870758618238195c0c37127d1e2f` |
| 138 | `2ca5ee373b380c1627b94cdb7c758897abf9c75d27913d23cb2bcd27c9f00e7b` |
| 128 | `356ddedb6457d9c02b5691daa8196fc4e7477b0e0dcb3bbeb50994ad62d90800` |

### Schema e conteggi dopo A

| Metrica | Prima | Dopo |
|---|---|---|
| Tabelle | 116 | 124 (+8, tutte vuote) |
| FK nuove | 0 | 12, tutte `NO_ACTION` / `CASCADE` assente, `not_trusted=false` |
| `non_conformities` | 22 | 22 |
| `attachments` | 235 | 235 |
| `ndt_reports` | 1 | 1 |

Colonne aggiunte (tutte nullable): +4 su `qualifications` (`welding_type`, `single_multi_run`, `qualification_method`, `transfer_mode`); +2 su `custom_checklist_sections` (`reference_text`, `linked_legislation`); `projects.technical_review_checklist`; `management_reviews.input_monitoring`.

Le 8 tabelle nuove (0 righe): `welding_books`, `welding_book_equipment`, `welding_book_welds`, `context_factors`, `interested_parties`, `company_profile`, `requirement_implementation_status`, `requirement_implementation_history`.

### Smoke A e processi

HTTP 200: `/welding-books`, `/context-factors`, `/interested-parties`, profile, `gap-matrix` / `gap-statuses`, `/qualifications`, WPQR, `/projects`, `/management-reviews`.

HTTP 500 (atteso: manca B1/B2): `/attachments` e `/non-conformities` — `organization_id` / `company_id` ancora assenti su NC. **Dopo B1+B2 (stesso giorno): entrambi 200** — vedi §0b.

MainPID **invariati** (nessun restart): TEST `734071`, PROD `668652`.

## 0b. Esito Batch B1 + B2 (TEST, 2026-10-07)

Applicati su DB `2026-06-18_SGQ_ISO9001`. **STOP dopo B2**: C, PROD e 167 **non** eseguiti. Questa sezione usa solo i fatti del report Lead di quella sessione (nessun path/SHA inventato se assente dal report).

### Backup (tre file sul VPS; ciascuno `RESTORE VERIFYONLY` OK)

| Voce | Valore verificato |
|---|---|
| pre-A | `/var/opt/mssql/data/TEST_pre_batchA_20261007.bak` (già in §0) |
| pre-B1 | `.bak` sul VPS, schema post-A / pre-098 |
| pre-B2 | `.bak` sul VPS, schema post-B1 / pre-113…153 |
| Verifica | `RESTORE VERIFYONLY` OK su tutti e tre |

Senza i path esatti di pre-B1/pre-B2 nel report: i file **esistono** sul VPS e sono verificati. Rollback B1 = restore pre-B1 (098 non ha `*_rollback.sql`). Rollback B2 = restore pre-B2 oppure DROP additivi in ordine inverso.

### Apply

| Batch | Mig | Esito |
|---|---|---|
| B1 | 098 → 118 | applicate su TEST |
| B2 | 113, 121, 125, 134, 135, 153 | applicate su TEST |
| B2 | 113 | `.sql` in `database/migrations/113_nc_management_review_id.sql` (DDL dai runner 113-*; su TEST 07/10 era wrapper temp). **Nessun apply in questa PR** |

### Schema NC dopo B1+B2

| Voce | Stato verificato |
|---|---|
| `audit_id` | **nullable** (`is_nullable = 1`) |
| Colonne presenti | `organization_id`, `source_category`, `company_id`, `project_id`, `management_review_id`, `source_risk_id` |
| Colonne reali B2 | `corrective_action_needed`, `corrective_action_evaluation_notes`, `effectiveness_verification_notes` |
| **Non** presenti (non aspettarsele) | `correction_gate`, `effectiveness_verification` |

### FK e CHECK

| Voce | Stato verificato |
|---|---|
| CASCADE nuove | **nessuna** |
| CASCADE verso `audits` | **rimossa** (allineato a PROD) |
| `FK_nc_project` | `ON DELETE SET NULL` |
| `CK_nc_source_category` | include `sal_gap`; `not_trusted` (WITH NOCHECK come PROD / mig) |
| `FK_nc_management_review` | `not_trusted` (WITH NOCHECK come PROD / mig) |

### Dati invariati

| Metrica | Prima A | Dopo A | Dopo B1+B2 |
|---|---|---|---|
| `non_conformities` | 22 | 22 | 22 |
| `attachments` | 235 | 235 | 235 |
| `ndt_reports` | 1 | 1 | 1 |
| Dummy residui | — | — | **0** |

### Smoke B1+B2 e processi

HTTP 200 (prima 500): `/non-conformities`, `/attachments`.

NC **senza audit** (`audit_id` null): create / lette / cancellate OK.

Lista vuota per l'utente smoke = **filtro studio** (NC org 1001 su audit di un altro studio), **non** un problema di schema.

`POST /audits/:ref/push-to-nc-register`: **non** smoke reale in questa sessione (resta aperto).

MainPID **invariati** (nessun restart): TEST `734071`, PROD `668652`.

## 0c. Esito Batch C (TEST, 2026-10-07)

Applicato su DB `2026-06-18_SGQ_ISO9001`. **STOP dopo C**: PROD e 167 **non** toccati. Nomi colonne reali di B1/B2 già in §0b (`corrective_action_needed`, `corrective_action_evaluation_notes`, `effectiveness_verification_notes`; `correction_gate` / `effectiveness_verification` non esistono).

### Pre-check (solo SELECT) e backup pre-C

Pre-check coerente con §2: `notes`, `supplier_name` assenti; `UX_ndt_reports_number` presente, `UX_ndt_reports_org_number` assente; 0 duplicati `(organization_id, report_number)`; `norm_title` `NVARCHAR(200)` (max 183 caratteri in uso) senza indici, default, colonne calcolate, CHECK, FK, full-text, viste o trigger dipendenti; `attachments.ndt_report_item_id` presente. Unica osservazione: `IX_attachments_ndt_item` **assente** (vedi 108).

| Voce | Valore verificato |
|---|---|
| Path | `/var/opt/mssql/data/TEST_pre_batchC_20261007.bak` |
| Dimensione | 973202944 byte |
| Opzioni | `COPY_ONLY` + `CHECKSUM`; `is_damaged = 0` (msdb) |
| Verifica | `RESTORE VERIFYONLY WITH CHECKSUM` OK |
| SHA-256 file | `95896be3c0666fa120a91cac47a7a72137d99d4fe64be252186ed6e40b037af1` |

I quattro `.bak` (pre-A, pre-B1, pre-B2, pre-C) restano sul VPS.

### Apply (runner solo-TEST #742, `check` poi `apply`, `SGQ_MIGRATION_TARGET=test`)

Runner `backend/scripts/run-migrations-test-only.js` sha256 `5ae7a17344a0f66605756b9288f614ada273f5d391984487cf8169ddbaebc2f5`; `mergeDbEnv.js` `410da8f76e34109ac03601f68fc7b7cdc37ed6f1a5bc211df10525b4454fbe85`. `.sql` freschi da `origin/main` in una directory temporanea sul VPS (non le cartelle stale).

| Mig | check | apply | sha256 `.sql` |
|---|---|---|---|
| 107 | parse OK 1/1 | OK, 1/1 batch, 1/1 oggetti | `391e7bb19408156b8126311feb955abead458946315a4f43da65ca0724c99512` |
| 109 | parse OK 1/1 | OK, 1/1 batch, 1/1 oggetti | `b6171e214b23f07300ccbe05784359a7f052f068f7040c5231a9db4ffad69f59` |
| 126 | parse OK 1/1 | OK, 1/1 batch, 1/1 oggetti | `73883d3b70d343b2b5c5a7cb979332f81c6938437fb1256a93da0d3acd82f83e` |
| 119 | parse OK 1/1 | OK, 1/1 batch (nessun oggetto tracciato dal runner: `ALTER COLUMN`) | `82d9628666b58b0f8a252ece1b2d3570a775078757c0c0a41725caca06895fa1` |
| 108 | parse OK 1/1; **indice `IX_attachments_ndt_item` mancante** | **non applicata** (no-op) | `29c63f62842ab9f8319545464a4de4e8c2fbc2664f90e1ac15727e512e694a71` |

`apply` 107, 109, 126, 119: EXIT 0 (`apply completato: 4 migrazioni`). La 108 ha `IF NOT EXISTS` sulla colonna `ndt_report_item_id`, che esiste già: l'intero blocco, indice compreso, viene saltato, e il runner segnalerebbe comunque «mancante `IX_attachments_ndt_item`». Non è stata applicata e l'indice **non** è stato creato a mano: decisione aperta (§6).

### Schema dopo C

| Voce | Stato verificato |
|---|---|
| `UX_ndt_reports_number` (globale) | **assente** |
| `UX_ndt_reports_org_number` | presente, UNIQUE, colonne `(organization_id, report_number)`, filtro `report_number IS NOT NULL`, non disabilitato |
| `norm_document_sources.norm_title` | `NVARCHAR(500)` NULL (era 200) |
| `ndt_report_items.notes` | presente, `NVARCHAR(MAX)` NULL |
| `ndt_reports.supplier_name` | presente, `NVARCHAR(200)` NULL |
| `attachments.ndt_report_item_id` | presente (già); CHECK `CHK_attachments_parent` la include; `IX_attachments_ndt_item` **assente** |
| FK con CASCADE su tabelle NDT / norme | **0** (nessuna FK nuova) |

### Dati invariati

`non_conformities` 22, `attachments` 235, `ndt_reports` 1 (dopo A, B1+B2 e C); dummy residui **0**.

### Smoke C e processi

| Prova | Esito |
|---|---|
| `GET /ndt-reports` | 200 |
| `POST /ndt-reports` (dummy `ZZ_SMOKE_`, con `supplier_name` e nota sulla riga) | 201; `GET` restituisce `supplier_name` e nota; il numero è auto-assegnato per organizzazione |
| `DELETE /ndt-reports/:id` | 200 (soft delete); dummy poi rimosso via SQL con `DB_NAME()` verificato |
| Stesso numero su altra org / duplicato nella stessa org | l'API non accetta numeri liberi: provato via SQL **in transazione con ROLLBACK** (righe `ZZ_SMOKE_`): altra org ok; stessa org errore 2601 (atteso); nulla persistito |
| `norm_title` > 200 caratteri | `commitToRegistry` richiede un job di import e crea record reali: **non** eseguito. Provato via SQL in transazione con ROLLBACK: inserimento di 450 caratteri ok |
| Regressione | `/non-conformities`, `/attachments`, `/welding-books`, `/welding/wpqr`, `/qualifications/stats`: 200 |

Journal `sgq-backend-test` dal pre-check C: nessun «Invalid column/object name» né errori. MainPID **invariati** (nessun restart): TEST `734071`, PROD `668652`.

## 1. Obiettivo e perimetro

Portare lo schema TEST a quello che il codice di `origin/main` (già in esecuzione su TEST) si aspetta, **solo per le lacune ALTA**. Dopo A+B1+B2+C, `/welding-books`, `/attachments`, `/non-conformities` e `/ndt-reports` rispondono 200. Restano PROD e 167 (non toccati).

| Fuori perimetro | Perché |
|---|---|
| 167 (`ai_usage_log`/`ai_assistant_*`) e PR #739 (rev. 167) | PR in revisione, runner 167 con `sqlcmd -U sa` (disabilitato dal 03/10) e senza `-b`; non si tocca |
| `ai_assistant_*`, `ingest_reference_patterns` (120), indici perf | MEDIA/BASSA: nessun endpoint critico rotto |
| Drift senza migrazione (4 colonne `input_*` riesame, 19 tabelle PROD senza CREATE TABLE) | Non esiste uno script da applicare: serve decisione (§6). 112/113 `.sql` versionati. Restano 4 `input_*` su `management_reviews` |

**Batch A + B1 + B2 (07/10/2026): fatti.** Resta C (gated), ciascuno con sì esplicito e STOP. Non toccare PROD né 167.

## 2. Ordine sicuro delle migrazioni (grafo FK letto dai `.sql`)

Dipendenze padre già presenti su TEST (confermate nel pre-check A): `organizations`, `companies`, `users`, `audits`, `projects`, `management_reviews`, `norm_requirements`, `equipment_assets`, `qualifications`, `custom_checklist_sections`, `ndt_reports/items`. `.sql` = file in `database/migrations/` salvo nota (BDM = `backend/database/migrations/`). I runner `run-migration-<NNN>-vps.js` restano cablati su PROD tranne il 153 (`SGQ_MIGRATION_TARGET=test`). **Batch A è stato applicato** con il runner solo-TEST #742 (`backend/scripts/run-migrations-test-only.js` su `main`), non con i runner `*-vps.js`. **B1+B2 applicati su TEST 07/10/2026** (113 era wrapper temp; `.sql` ora in repo). Per C usare lo stesso runner solo-TEST (o equivalente) — mai i `*-vps.js` verso PROD.

| Batch | Mig | Oggetto | `.sql` | Runner | Distruttiva | Idemp. | Rischio |
|---|---|---|---|---|---|---|---|
| A fatto | 110 | `welding_books`, `_equipment`, `_welds` (FK solo tra loro + `equipment_assets` se esiste: se manca viene **saltata in silenzio**) | BDM | applicata via #742 (non 110-vps) | no | sì | basso |
| A fatto | 124 | `context_factors`, `interested_parties` (nessuna FK) | sì | applicata via #742 | no | sì | basso |
| A fatto | 145 | `company_profile` (FK `companies`, `organizations`, `users`) | sì | applicata via #742 | no | sì | basso |
| A fatto | 117 | `requirement_implementation_status/_history` (FK `organizations`, `companies`, `norm_requirements`, `users`) | sì (con `USE`; strippato dal runner #742) | applicata via #742 | no | sì | medio: `USE` |
| A fatto | 122, 136 | `qualifications` +4 colonne nullable | sì | applicata via #742 | no | sì | basso |
| A fatto | 138, 128 | `custom_checklist_sections` +2, `projects` +1 (nullable) | sì | 138: #742 (USE strippato); 128: #742 (non `-local`) | no | sì | basso |
| A fatto | 112 | `management_reviews.input_monitoring` | sì (`112_management_reviews_input_monitoring.sql`; DDL dai runner 112-*) | 112-vps/-local **non usato** su TEST | no | sì | basso |
| B1 fatto | 098 | `non_conformities` +`organization_id`, `source_category`, `source_origin_text`; UPDATE backfill; CHECK; **drop di ogni FK verso `audits`, `audit_id` → NULL, ri-aggiunta `FK_nc_audit_ref` senza CASCADE**; 2 indici | sì | applicata su TEST 07/10 | **sì (ALTER/DROP FK)** | sì | **alto** — fatto |
| B1 fatto | 118 | ricrea `CK_nc_source_category` con `sal_gap` (dopo 098: 098 crea il CHECK senza `sal_gap`) | sì (con `USE`) | applicata su TEST 07/10 | drop+add CHECK | sì | medio: `USE` — fatto |
| B2 fatto | 113 | `non_conformities.management_review_id` + FK (WITH NOCHECK) + indice filtrato (dopo `management_reviews`) | sì (`113_nc_management_review_id.sql`; DDL dai runner 113-*) | applicata su TEST 07/10; **versionata, nessun apply in questa PR** | no | sì | basso |
| B2 fatto | 121 | +`corrective_action_needed` (+CHECK), `corrective_action_evaluation_notes` | sì | applicata su TEST 07/10 | no | sì | basso |
| B2 fatto | 125, 134, 135 | +`source_risk_id`; +`company_id` (+FK `companies`, indice); +`effectiveness_verification_notes` | sì | applicate su TEST 07/10 | no | sì | basso |
| B2 fatto | 153 | +`project_id` + FK `projects` (SET NULL, no CASCADE) + indice | sì | applicata su TEST 07/10 | no | sì | basso |
| C | 107, 109 | `ndt_report_items.notes`, `ndt_reports.supplier_name` | BDM | sì | no | sì | basso |
| C | 126 | `DROP INDEX UX_ndt_reports_number` (globale) → `UX_ndt_reports_org_number` (org + numero, filtrato) | sì | sì | **sì (drop indice)** | sì | medio |
| C | 119 | `norm_document_sources.norm_title` NVARCHAR(200) → 500 | BDM | sì (legge `.sql` da `/var/www/sgq-backend/database/migrations/`, non da BDM: copiarlo lì) | ALTER COLUMN (allargamento) | sì | basso |
| C | 108 | `attachments.ndt_report_item_id` (solo verifica: attesa presente, dato che 156/165 poggiano su di essa) | BDM | sì | no | sì | basso |

**Motivazione ordine.** (1) A prima di B: tabelle/colonne nuove senza dipendenze reciproche, nessun ALTER su dati; 110 apre la strada a `/welding-books` e al JOIN allegati; **`/attachments*` e `/non-conformities` 200 dopo B1** (confermato 07/10). (2) B1 da solo: 098 → 118 è l'unico passo distruttivo su tabella centrale; 118 deve seguire 098. (3) B2: catena additiva su `non_conformities` (113 dopo `management_reviews`; 153 dopo `projects`); l'ordine interno è libero, si usa il numerico. (4) C per ultimo: swap indice e ALTER COLUMN, indipendenti dal resto. **C applicato su TEST (§0c).**

**`.sql` 112 e 113:** versionati in `database/migrations/` (DDL dai runner `run-migration-112-*` / `113-*`). Già applicati su TEST; questa PR non applica. 121 (`.sql` esisteva senza runner dedicato) è **già su TEST**. 19 tabelle PROD non hanno CREATE TABLE nel repo (non toccate qui).

## 3. Rischi

| # | Rischio | Mitigazione / decisione |
|---|---|---|
| 1 | **`audit_id` NOT NULL → NULL** (098): drop FK → ALTER → add FK. Se `ALTER COLUMN` fallisce a metà, restano NC senza FK verso `audits` | **B1 applicato 07/10:** `audit_id` nullable; 22 NC invariate. Rollback = restore pre-B1 (tornare a NOT NULL è impossibile se esistono NC con `audit_id` NULL) |
| 2 | **`FK_non_conformities_audit` CASCADE su TEST** (residuo baseline) | **Confermato dopo B1:** CASCADE verso `audits` **rimossa**; nessuna nuova CASCADE. `FK_nc_project` = `ON DELETE SET NULL`. Cancellare un audit con NC ora fallisce, come in PROD. |
| 3 | **`UX_ndt_reports_number`** globale → per org (126) | Nessun conflitto dati: il vincolo diventa più debole, quindi righe valide prima restano valide. Verificare solo l'esistenza di `UX_ndt_reports_org_number` e l'assenza dell'indice globale |
| 4 | **`norm_title` ALTER COLUMN** 200→500; **NOT NULL aggiunti** su tabelle con righe | Allargamento senza perdita; fallisce solo se esistono indici/vincoli sulla colonna (verificare). Colonne nuove su tabelle esistenti sono tutte **nullable** (098–153); i NOT NULL con DEFAULT sono solo in tabelle nuove (vuote) |
| 5 | **Runner non sicuri**: i `*-vps.js` restano cablati su PROD; `.sql` 117/118/134/135/138 contengono `USE SGQ_ISO9001`; `sqlcmd` senza `-b` stampa successo con errori; i runner 160–166 leggono `.sql` stale; runner 167 con `sa` | Per A: runner solo-TEST #742 (USE 117/138 strippato, `DB_NAME()` verificato). B1+B2 applicati su TEST (113 era wrapper temp; `.sql` ora in repo). Per C: stesso runner solo-TEST. Mai `*-vps.js` su TEST |
| 6 | **Dati TEST non ricostruibili** | **Tre `.bak` sul VPS** (pre-A, pre-B1, pre-B2), ciascuno `RESTORE VERIFYONLY` OK. 098 è distruttiva e **non ha** `098_rollback.sql`: rollback B1 = restore pre-B1. Restore del solo pre-A annulla anche A+B. Prima di C (126 drop indice): nuovo `COPY_ONLY` |
| 7 | Servizio TEST in uso durante l'apply (lock brevi su `non_conformities`, `attachments`; errori transitori per colonne mancanti fino al riavvio) | Finestra concordata; nessuna sessione utente; niente riavvio del backend se non richiesto dal batch |
| 8 | Email di prova | Già soppresse da #740 su TEST; riverificare prima degli smoke di scrittura |
| 9 | `/management-reviews` POST/PUT resta in errore dopo 112: mancano 4 colonne `input_*` senza migrazione (`input_context_changes`, `input_customer_satisfaction`, `input_process_performance`, `input_risk_effectiveness`) | Decisione aperta §6; GET dettaglio (`mr.*`) funziona |

## 4. Prerequisiti (sì esplicito per ogni batch; pre-A / pre-B1 / pre-B2 già ottenuti)

| Prerequisito | Dettaglio |
|---|---|
| Backup TEST **pre-A** | **Fatto 07/10/2026:** `/var/opt/mssql/data/TEST_pre_batchA_20261007.bak` (973202944 byte, `COPY_ONLY`+`CHECKSUM`, `RESTORE VERIFYONLY` OK). È lo schema **prima** di A. |
| Backup TEST **pre-B1** | **Fatto 07/10/2026:** `.bak` sul VPS, `RESTORE VERIFYONLY` OK. Schema post-A / pre-098. |
| Backup TEST **pre-B2** | **Fatto 07/10/2026:** `.bak` sul VPS, `RESTORE VERIFYONLY` OK. Schema post-B1 / pre-113…153. |
| Backup TEST **pre-C** (obbligatorio prima di C) | I tre file esistenti **non** bastano per 126 (drop indice). Nuovo `COPY_ONLY` + `RESTORE VERIFYONLY` **subito prima di C**, dopo sì esplicito. |
| Runner sicuro | Per A è stato usato il runner solo-TEST #742 su `main` (`backend/scripts/run-migrations-test-only.js`). B1+B2 applicati su TEST (113 era wrapper temp; `.sql` ora in repo). Stesso strumento (o equivalente) per C: `target=test`, abort se `DB_NAME()` ≠ `2026-06-18_SGQ_ISO9001`, nessun `USE` eseguito, split `GO`, errore SQL = stop, `check` prima di `apply`. Non usare i runner `*-vps.js` cablati su PROD. |
| `.sql` aggiornati | Copia dei file di `origin/main` (da `database/migrations/` **e** `backend/database/migrations/`), non la cartella stale del VPS; riportare sha256 nel log |
| Configurazione | Sezione `test` di `backend/config/database.json.example` (file reale gitignored) coerente con `.env.test` |
| Baseline | MainPID `sgq-backend-test` e `sgq-backend` prima/dopo; conteggi righe (`non_conformities`, `attachments`, `ndt_reports`) |
| Finestra e autorizzazione | Finestra concordata; **sì esplicito per ogni batch** (migrazioni = eccezione agli automerge/autonomia) |
| Pre-check | SELECT su `INFORMATION_SCHEMA`/`sys.*` per elenco oggetti mancanti del batch; se diverso dal §2, si ferma e si aggiorna il piano |

## 5. Verifica post-apply e smoke

**SELECT attese** (`INFORMATION_SCHEMA.COLUMNS`, `sys.foreign_keys`, `sys.indexes`, `sys.check_constraints`): oggetti presenti con tipo/nullable di PROD (confronto solo nomi e tipi, nessun dato); `DB_NAME()` corretto; `is_not_trusted = 0` sulle FK nuove (113 usa WITH NOCHECK: lasciare com'è come PROD); journal `sgq-backend-test` senza «invalid column/object name». Dati dummy con prefisso `ZZ_SMOKE_` e pulizia a fine smoke.

| Batch | Verifiche DB | Smoke (status atteso) | Stop / rollback |
|---|---|---|---|
| A **verificato 07/10** | 8 tabelle nuove (110: 3, 124: 2, 145: 1, 117: 2); +4 `qualifications`, +2 `custom_checklist_sections`, `projects.technical_review_checklist`, `management_reviews.input_monitoring` | **Eseguito (GET):** `/welding-books`, `/context-factors`, `/interested-parties`, profile, `gap-matrix`/`gap-statuses`, `/qualifications`, WPQR, `/projects`, `/management-reviews` → 200. `/attachments` e `/non-conformities` → 500 (B1/B2). POST/PUT qualifiche/commesse **non** nello smoke A | A chiuso. Rollback A: DROP tabelle nuove vuote / DROP COLUMN, o restore pre-A |
| B1 **verificato 07/10** | `audit_id` nullable; nessuna CASCADE nuova; CASCADE verso `audits` **rimossa**; `CK_nc_source_category` con `sal_gap` (`not_trusted`, WITH NOCHECK come PROD/mig) | **Eseguito:** `GET /non-conformities` 200; `GET /attachments` 200 (prima 500). NC **senza audit** create / lette / cancellate OK. Lista vuota utente smoke = filtro studio (NC org 1001 su audit altro studio), non schema. `push-to-nc-register` **non** smoke reale | B1 chiuso. Rollback B1 = restore pre-B1 (nessun `*_rollback.sql` per 098) |
| B2 **verificato 07/10** | colonne reali: `management_review_id`, `corrective_action_needed`, `corrective_action_evaluation_notes`, `source_risk_id`, `company_id`, `effectiveness_verification_notes`, `project_id`. **Non** `correction_gate` / `effectiveness_verification`. `FK_nc_project` SET NULL; `FK_nc_management_review` `not_trusted` (WITH NOCHECK) | Schema + smoke lista/CRUD NC senza audit coperti in §0b. PUT campi nuovi / NC da rischio e da riesame: non nel report di questa sessione | B2 chiuso. Rollback B2 = restore pre-B2 o DROP additivi in ordine inverso |
| C **verificato 07/10** | `UX_ndt_reports_number` assente, `UX_ndt_reports_org_number` presente; `norm_title` = 500; `ndt_report_items.notes`, `ndt_reports.supplier_name`; `IX_attachments_ndt_item` assente (108 no-op) | `GET/POST /ndt-reports` 200/201; altra org ok / stessa org errore provati via SQL con ROLLBACK; `commitToRegistry` non eseguito (norm_title 450 caratteri provato via SQL con ROLLBACK). Dettaglio in §0c | C chiuso. Rollback C = restore pre-C; `norm_title` non va ristretto (rischio troncamento) |

Fine di ogni batch: `journalctl` TEST senza errori di schema, MainPID invariato (nessun riavvio), pulizia dummy, report con conteggi prima/dopo.

## 6. Fuori perimetro e decisioni aperte

| Tema | Perché fuori | Decide |
|---|---|---|
| 167 e PR #739 | Revisione in corso, runner `sa`/senza `-b`. Nota: in PROD `ai_assistant_notifications` ha FK CASCADE verso `organizations(organization_id)`: da riconciliare lì | Committente, dopo la revisione |
| Versionare `.sql` per **112** e **113** | **Fatto:** `database/migrations/112_management_reviews_input_monitoring.sql` e `113_nc_management_review_id.sql` (DDL dai runner esistenti). Già su TEST; **nessun apply** in questa PR. Allowlist runner #742 aggiornata ai path. | — |
| `push-to-nc-register` non smoke reale | Dopo B1 il piano prevedeva `POST /audits/:ref/push-to-nc-register` 200. **Non eseguito** in sessione B1+B2 | Lead, smoke dedicato (non blocca C) |
| Drift senza migrazione (4 `input_*` su `management_reviews`; 19 tabelle senza CREATE TABLE) | Dopo 112 manca ancora: `input_context_changes`, `input_customer_satisfaction`, `input_process_performance`, `input_risk_effectiveness`. POST/PUT riesame resta incompleto (rischio 9). Nessuno script da applicare | Committente (migrazione nuova = livello Alto) |
| Numerazione dopo 169 e tabella di tracking migrazioni | Oggi nessun registro di cosa è applicato dove | Committente / lead |
| `IX_attachments_ndt_item` assente su TEST | La 108 salta il blocco (colonna già presente), quindi l'indice filtrato non viene creato. Verificare se PROD lo ha; se serve, migrazione additiva dedicata | Lead / committente |
| Hardening degli altri ~85 runner (target, CHECK_ONLY, guard, `-b`) | Fuori slice; l'hardening 158/159 (#738) è il modello | Lead |
| Nuovo smoke CI di schema TEST↔PROD | Evita il ripetersi del gap | Lead |

## 7. Stima rischio e sequenza raccomandata

Rischio complessivo **medio** (alto in B1, già chiuso). Quattro backup VERIFYONLY OK. Nessun apply automatico: ogni batch richiede sì esplicito e **STOP** dopo la verifica. **PROD e 167 non toccati.**

1. **Prerequisiti A** (backup pre-A, runner #742, `.sql`, finestra) → **fatto 07/10/2026**.
2. **Batch A** (110, 124, 145, 117, 122, 136, 138, 128, 112) → **APPLICATO su TEST 07/10/2026** · verifica + smoke OK · STOP.
3. **Batch B1** (098 → 118) → **APPLICATO su TEST 07/10/2026** · backup pre-B1 VERIFYONLY OK · `audit_id` nullable, CASCADE audits rimossa · smoke NC/allegati 200 · STOP.
4. **Batch B2** (113, 121, 125, 134, 135, 153) → **APPLICATO su TEST 07/10/2026** · backup pre-B2 VERIFYONLY OK · `.sql` 113 ora in repo · STOP.
5. **Batch C** (107, 109, 126, 119; 108 no-op) → **APPLICATO su TEST 07/10/2026** · backup pre-C VERIFYONLY OK · indice per org presente, `norm_title` 500 · smoke NDT 200/201 · STOP.
6. **Poi:** report finale di confronto TEST/PROD solo con sì esplicito. **Non** applicare PROD/167 senza sì.
