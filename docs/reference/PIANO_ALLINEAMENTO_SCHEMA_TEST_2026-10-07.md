# Piano di allineamento schema TEST → PROD (solo priorità ALTA)

**Stato: Batch A APPLICATO su TEST 2026-10-07; B1+ fermi** · aggiornato 07/10/2026 · questa PR resta solo documentale (nessun apply, nessuna modifica a `.sql`/runner/codice runtime) · base: `origin/main`

> Il report di gap (`gap-summary.md`, `migration-map.md`, `gap-columns.csv`, `gap-objects.csv`) **non è presente** in questo ambiente. Piano ricostruito dal repo (`database/migrations/`, `backend/database/migrations/`, runner `run-migration-*` in `backend/scripts/`, `docs/how-to/database-migrations.md`, `docs/reference/RISCHIO_MIGRAZIONI_168_169_2026-10-06.md`) e dai fatti del gap (TEST 116 → PROD 127 tabelle; 190 colonne mancanti: 166 in tabelle assenti + 24 in 7 comuni). **Batch A è già stato applicato su TEST** (esito sotto). Colonne e oggetti di B1+ vanno riverificati con una SELECT su TEST prima del prossimo batch.

## 0. Esito Batch A (TEST, 2026-10-07)

Applicato su DB `2026-06-18_SGQ_ISO9001`. **STOP dopo A**: B1, B2 e C **non** eseguiti. Questa sezione usa solo i fatti del report Lead e dei log di quella sessione.

### Backup pre-A (unico; non è un backup pre-B1)

| Voce | Valore verificato |
|---|---|
| Path | `/var/opt/mssql/data/TEST_pre_batchA_20261007.bak` |
| Dimensione | 973202944 byte |
| Opzioni | `COPY_ONLY` + `CHECKSUM` (registrato in msdb) |
| Verifica | `RESTORE VERIFYONLY WITH CHECKSUM` OK |
| SHA-256 file | `5faecc85542ed6071cff43d240a07be1e8b889b554538d5548d207bf000917ef` |

Un solo backup pre-A. Lo schema attuale TEST è **già post-A**: questo file **non** è un punto di ripristino pre-B1 (§4).

### Apply

Nessuna migrazione del batch A era già presente (pre-check: 116 tabelle; oggetti A tutti assenti).

| Mig | Come applicata | Esito |
|---|---|---|
| 110, 124, 145, 117, 122, 136, 138, 128 | runner solo-TEST #742 su `main` (`check` poi `apply`); `DB_NAME()` = `2026-06-18_SGQ_ISO9001` | OK (`apply completato: 8 migrazioni`, EXIT=0, `2026-10-07T13:57:34Z`) |
| 117, 138 | `USE SGQ_ISO9001` **strippato dal runner** (non eseguito su TEST): 117 riga 7, 138 riga 10 | 1 `USE` rimosso per file |
| 112 | **nessun `.sql` in repo**; DDL `ADD COLUMN input_monitoring NVARCHAR(MAX) NULL` con script temporaneo fuori repo + stessi guard del runner. **Non versionato** | colonna presente, nullable |

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

HTTP 500 (atteso: manca B1/B2): `/attachments` e `/non-conformities` — `organization_id` / `company_id` ancora assenti su NC.

MainPID **invariati** (nessun restart): TEST `734071`, PROD `668652`.

## 1. Obiettivo e perimetro

Portare lo schema TEST a quello che il codice di `origin/main` (già in esecuzione su TEST) si aspetta, **solo per le lacune ALTA**. Dopo A, `/welding-books` risponde 200; restano 500 `/attachments` e `/non-conformities` (`attachmentScope()` fa JOIN su `non_conformities.organization_id`, ancora assente — B1/B2).

| Fuori perimetro | Perché |
|---|---|
| 167 (`ai_usage_log`/`ai_assistant_*`) e PR #739 (rev. 167) | PR in revisione, runner 167 con `sqlcmd -U sa` (disabilitato dal 03/10) e senza `-b`; non si tocca |
| `ai_assistant_*`, `ingest_reference_patterns` (120), indici perf | MEDIA/BASSA: nessun endpoint critico rotto |
| Drift senza migrazione (4 colonne `input_*` riesame, 19 tabelle PROD senza CREATE TABLE) | Non esiste uno script da applicare: serve decisione (§6). Aperto dopo A: versionare `.sql` per 112 e 113; 121 senza runner |

**Batch A (07/10/2026): fatto.** Restano B1 → B2 → C, ciascuno con sì esplicito e STOP.

## 2. Ordine sicuro delle migrazioni (grafo FK letto dai `.sql`)

Dipendenze padre già presenti su TEST (confermate nel pre-check A): `organizations`, `companies`, `users`, `audits`, `projects`, `management_reviews`, `norm_requirements`, `equipment_assets`, `qualifications`, `custom_checklist_sections`, `ndt_reports/items`. `.sql` = file in `database/migrations/` salvo nota (BDM = `backend/database/migrations/`). I runner `run-migration-<NNN>-vps.js` restano cablati su PROD tranne il 153 (`SGQ_MIGRATION_TARGET=test`). **Batch A è stato applicato** con il runner solo-TEST #742 (`backend/scripts/run-migrations-test-only.js` su `main`), non con i runner `*-vps.js`. Per B1+ usare lo stesso runner solo-TEST (o equivalente) — mai i `*-vps.js` verso PROD.

| Batch | Mig | Oggetto | `.sql` | Runner | Distruttiva | Idemp. | Rischio |
|---|---|---|---|---|---|---|---|
| A fatto | 110 | `welding_books`, `_equipment`, `_welds` (FK solo tra loro + `equipment_assets` se esiste: se manca viene **saltata in silenzio**) | BDM | applicata via #742 (non 110-vps) | no | sì | basso |
| A fatto | 124 | `context_factors`, `interested_parties` (nessuna FK) | sì | applicata via #742 | no | sì | basso |
| A fatto | 145 | `company_profile` (FK `companies`, `organizations`, `users`) | sì | applicata via #742 | no | sì | basso |
| A fatto | 117 | `requirement_implementation_status/_history` (FK `organizations`, `companies`, `norm_requirements`, `users`) | sì (con `USE`; strippato dal runner #742) | applicata via #742 | no | sì | medio: `USE` |
| A fatto | 122, 136 | `qualifications` +4 colonne nullable | sì | applicata via #742 | no | sì | basso |
| A fatto | 138, 128 | `custom_checklist_sections` +2, `projects` +1 (nullable) | sì | 138: #742 (USE strippato); 128: #742 (non `-local`) | no | sì | basso |
| A fatto | 112 | `management_reviews.input_monitoring` | **no** (DDL solo nel runner 112; applicato 07/10 con script temp fuori repo) | 112-vps/-local **non usato** | no | sì | basso |
| B1 | 098 | `non_conformities` +`organization_id`, `source_category`, `source_origin_text`; UPDATE backfill; CHECK; **drop di ogni FK verso `audits`, `audit_id` → NULL, ri-aggiunta `FK_nc_audit_ref` senza CASCADE**; 2 indici | sì | sì (098-vps; 098 locale) | **sì (ALTER/DROP FK)** | sì | **alto** |
| B1 | 118 | ricrea `CK_nc_source_category` con `sal_gap` (dopo 098: 098 crea il CHECK senza `sal_gap`) | sì (con `USE`) | sì (118-vps) | drop+add CHECK | sì | medio: `USE` |
| B2 | 113 | `non_conformities.management_review_id` + FK (WITH NOCHECK) + indice filtrato (dopo `management_reviews`) | **no** (solo runner) | sì (113-vps/-local) | no | sì | basso |
| B2 | 121 | +`corrective_action_needed` (+CHECK), `corrective_action_evaluation_notes` | sì | **no** | no | sì | basso (serve runner) |
| B2 | 125, 134, 135 | +`source_risk_id`; +`company_id` (+FK `companies`, indice); +`effectiveness_verification_notes` | sì | sì | no | sì | basso |
| B2 | 153 | +`project_id` + FK `projects` (SET NULL, no CASCADE) + indice | sì | sì (con target test) | no | sì | basso |
| C | 107, 109 | `ndt_report_items.notes`, `ndt_reports.supplier_name` | BDM | sì | no | sì | basso |
| C | 126 | `DROP INDEX UX_ndt_reports_number` (globale) → `UX_ndt_reports_org_number` (org + numero, filtrato) | sì | sì | **sì (drop indice)** | sì | medio |
| C | 119 | `norm_document_sources.norm_title` NVARCHAR(200) → 500 | BDM | sì (legge `.sql` da `/var/www/sgq-backend/database/migrations/`, non da BDM: copiarlo lì) | ALTER COLUMN (allargamento) | sì | basso |
| C | 108 | `attachments.ndt_report_item_id` (solo verifica: attesa presente, dato che 156/165 poggiano su di essa) | BDM | sì | no | sì | basso |

**Motivazione ordine.** (1) A prima di B: tabelle/colonne nuove senza dipendenze reciproche, nessun ALTER su dati; 110 apre la strada a `/welding-books` e al JOIN allegati, ma **`/attachments*` torna sano solo dopo B1** (`nc.organization_id`). (2) B1 da solo: 098 → 118 è l'unico passo distruttivo su tabella centrale; 118 deve seguire 098. (3) B2: catena additiva su `non_conformities` (113 dopo `management_reviews`; 153 dopo `projects`); l'ordine interno è libero, si usa il numerico. (4) C per ultimo: swap indice e ALTER COLUMN, indipendenti dal resto.

**Senza `.sql`/runner utilizzabile (note aperte dopo A):** 121 (`.sql` esiste, **nessun runner**: serve il pattern split-`GO` di 098/118 o il runner solo-TEST); 128 (applicata via runner #742); **112 e 113 senza `.sql` in repo** — 112 è già su TEST via script temp non versionato; 113 è in B2. Slice futura: versionare i `.sql`. 19 tabelle PROD non hanno CREATE TABLE nel repo (non toccate qui).

## 3. Rischi

| # | Rischio | Mitigazione / decisione |
|---|---|---|
| 1 | **`audit_id` NOT NULL → NULL** (098): drop FK → ALTER → add FK. Se `ALTER COLUMN` fallisce a metà, restano NC senza FK verso `audits` | Eseguire B1 come un unico step con verifica; provare prima su un restore copy-only; i dati esistenti (NC tutte con audit) non violano il vincolo. Rollback = restore backup (tornare a NOT NULL è impossibile se esistono NC con `audit_id` NULL) |
| 2 | **`FK_non_conformities_audit` CASCADE su TEST** (residuo baseline) | Decisione: **allineare a PROD** (nessun CASCADE). 098 la rimuove (droppa ogni FK verso `audits`) e ri-aggiunge `FK_nc_audit_ref` senza CASCADE. Effetto: cancellare un audit con NC ora fallisce, come in PROD. Da confermare con SELECT che l'FK non-CASCADE sia davvero quella finale |
| 3 | **`UX_ndt_reports_number`** globale → per org (126) | Nessun conflitto dati: il vincolo diventa più debole, quindi righe valide prima restano valide. Verificare solo l'esistenza di `UX_ndt_reports_org_number` e l'assenza dell'indice globale |
| 4 | **`norm_title` ALTER COLUMN** 200→500; **NOT NULL aggiunti** su tabelle con righe | Allargamento senza perdita; fallisce solo se esistono indici/vincoli sulla colonna (verificare). Colonne nuove su tabelle esistenti sono tutte **nullable** (098–153); i NOT NULL con DEFAULT sono solo in tabelle nuove (vuote) |
| 5 | **Runner non sicuri**: i `*-vps.js` restano cablati su PROD; `.sql` 117/118/134/135/138 contengono `USE SGQ_ISO9001`; `sqlcmd` senza `-b` stampa successo con errori; i runner 160–166 leggono `.sql` stale; runner 167 con `sa` | Per A: runner solo-TEST #742 (USE 117/138 strippato, `DB_NAME()` verificato). Stesso runner per B1+. Mai `*-vps.js` su TEST |
| 6 | **Dati TEST non ricostruibili; backup pre-A ≠ pre-B1** | Backup pre-A esiste (`TEST_pre_batchA_20261007.bak`). Prima di B1 serve un **secondo** `COPY_ONLY` (schema già post-A). 098 è distruttiva e **non ha** `098_rollback.sql`: rollback B1 = restore. Restore del solo pre-A annulla anche A |
| 7 | Servizio TEST in uso durante l'apply (lock brevi su `non_conformities`, `attachments`; errori transitori per colonne mancanti fino al riavvio) | Finestra concordata; nessuna sessione utente; niente riavvio del backend se non richiesto dal batch |
| 8 | Email di prova | Già soppresse da #740 su TEST; riverificare prima degli smoke di scrittura |
| 9 | `/management-reviews` POST/PUT resta in errore dopo 112: mancano 4 colonne `input_*` senza migrazione (`input_context_changes`, `input_customer_satisfaction`, `input_process_performance`, `input_risk_effectiveness`) | Decisione aperta §6; GET dettaglio (`mr.*`) funziona |

## 4. Prerequisiti (sì esplicito per ogni batch; pre-A già ottenuto)

| Prerequisito | Dettaglio |
|---|---|
| Backup TEST **pre-A** | **Fatto 07/10/2026:** `/var/opt/mssql/data/TEST_pre_batchA_20261007.bak` (973202944 byte, `COPY_ONLY`+`CHECKSUM`, `RESTORE VERIFYONLY` OK). È lo schema **prima** di A. |
| Backup TEST **pre-B1** (obbligatorio) | Il file pre-A **non** basta: TEST è già post-A. **Secondo** `BACKUP DATABASE [2026-06-18_SGQ_ISO9001] TO DISK=… WITH COPY_ONLY, CHECKSUM` **subito prima di B1**, poi `RESTORE VERIFYONLY`. Motivo: 098 è distruttiva (ALTER/DROP FK su `non_conformities`) e **non esiste** `098_rollback.sql`. Senza secondo backup, un restore torna al pre-A e cancella anche A. |
| Runner sicuro | Per A è stato usato il runner solo-TEST #742 su `main` (`backend/scripts/run-migrations-test-only.js`). Stesso strumento (o equivalente) per B1+: `target=test`, abort se `DB_NAME()` ≠ `2026-06-18_SGQ_ISO9001`, nessun `USE` eseguito, split `GO`, errore SQL = stop, `check` prima di `apply`. Non usare i runner `*-vps.js` cablati su PROD. |
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
| B1 | `audit_id` `is_nullable = 1`; nessuna FK `audits` con `delete_referential_action` CASCADE; `FK_nc_audit_ref` NO ACTION; `CK_nc_source_category` con `sal_gap`; indici `IX_nc_*` | `GET /non-conformities` 200; NC **senza audit** (`audit_id` null) create e lette 200/201; `POST /audits/:ref/push-to-nc-register` 200; `/attachments*` 200 (JOIN NC/CND/RDP/Welding Book) | Stop se righe NC diminuiscono o il journal mostra errori; rollback = restore backup (nessun `*_rollback.sql` per 098) |
| B2 | colonne `management_review_id`, `corrective_action_*`, `source_risk_id`, `company_id`, `effectiveness_verification_notes`, `project_id` + FK/indici | `PUT /non-conformities/:id` con i nuovi campi 200; NC da rischio e da riesame 201 | Rollback: DROP FK/indice/colonna nell'ordine inverso (dati nuovi, nessuna perdita di dati preesistenti) |
| C | `UX_ndt_reports_number` assente, `UX_ndt_reports_org_number` presente; `norm_title` = 500; `ndt_report_items.notes`, `ndt_reports.supplier_name` | `GET/POST /ndt-reports` 200/201 (numero duplicato su altra org: ok); import norme `commitToRegistry` con titolo >200 caratteri 200 (prima: errore 8152) | Rollback: ricreare l'indice globale solo se nessun duplicato; `norm_title` non va ristretto (rischio troncamento) |

Fine di ogni batch: `journalctl` TEST senza errori di schema, MainPID invariato (nessun riavvio), pulizia dummy, report con conteggi prima/dopo.

## 6. Fuori perimetro e decisioni aperte

| Tema | Perché fuori | Decide |
|---|---|---|
| 167 e PR #739 | Revisione in corso, runner `sa`/senza `-b`. Nota: in PROD `ai_assistant_notifications` ha FK CASCADE verso `organizations(organization_id)`: da riconciliare lì | Committente, dopo la revisione |
| Versionare `.sql` per **112** e **113** | 112 applicato su TEST con script temp fuori repo (non in Git). 113 (B2) è ancora solo nel runner. Senza file in `database/migrations/` il prossimo apply non è riproducibile dal repo | Lead / slice futura (nessun apply in questa PR) |
| 121 senza runner | `.sql` esiste; nessun `run-migration-121-*`. Prima di B2: runner solo-TEST o pattern split-`GO` | Lead, prima del sì a B2 |
| Drift senza migrazione (4 `input_*` su `management_reviews`; 19 tabelle senza CREATE TABLE) | Dopo 112 manca ancora: `input_context_changes`, `input_customer_satisfaction`, `input_process_performance`, `input_risk_effectiveness`. POST/PUT riesame resta incompleto (rischio 9). Nessuno script da applicare | Committente (migrazione nuova = livello Alto) |
| Numerazione dopo 169 e tabella di tracking migrazioni | Oggi nessun registro di cosa è applicato dove | Committente / lead |
| Hardening degli altri ~85 runner (target, CHECK_ONLY, guard, `-b`) | Fuori slice; l'hardening 158/159 (#738) è il modello | Lead |
| Nuovo smoke CI di schema TEST↔PROD | Evita il ripetersi del gap | Lead |

## 7. Stima rischio e sequenza raccomandata

Rischio complessivo **medio** (alto solo in B1). Backup pre-A fatto; **manca il COPY_ONLY pre-B1**. Nessun apply automatico: ogni batch richiede sì esplicito e **STOP** dopo la verifica.

1. **Prerequisiti A** (backup pre-A, runner #742, `.sql`, finestra) → **fatto 07/10/2026**.
2. **Batch A** (110, 124, 145, 117, 122, 136, 138, 128, 112) → **APPLICATO su TEST 07/10/2026** · verifica + smoke OK · STOP.
3. **Prima di B1:** secondo `COPY_ONLY` (schema post-A) + sì esplicito. Poi **Batch B1** (098 → 118): `audit_id`/CASCADE, rischio alto, senza `rollback.sql` → verifica + smoke → STOP.
4. **Batch B2** (113, 121, 125, 134, 135, 153): additivo; 113 senza `.sql` versionato; 121 senza runner → verifica + smoke → STOP.
5. **Batch C** (107, 109, 126, 119, 108): NDT, indice unico, `norm_title` → verifica + smoke → report finale di confronto TEST/PROD.
