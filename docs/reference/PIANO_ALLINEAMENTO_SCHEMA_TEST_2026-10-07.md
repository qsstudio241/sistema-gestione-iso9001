# Piano di allineamento schema TEST → PROD (solo priorità ALTA)

**Stato: DRAFT** · 07/10/2026 · slice solo documentale (nessun accesso a VPS/DB, nessun apply, nessun codice) · base: `origin/main`

> Il report di gap (`gap-summary.md`, `migration-map.md`, `gap-columns.csv`, `gap-objects.csv`) **non è presente** in questo ambiente. Piano ricostruito dal repo (`database/migrations/`, `backend/database/migrations/`, runner `run-migration-*` in `backend/scripts/`, `docs/how-to/database-migrations.md`, `docs/reference/RISCHIO_MIGRAZIONI_168_169_2026-10-06.md`) e dai fatti del gap (TEST 116 → PROD 127 tabelle; 190 colonne mancanti: 166 in tabelle assenti + 24 in 7 comuni). **Colonne e oggetti esatti vanno riverificati con una SELECT su TEST prima di ogni batch.**

## 1. Obiettivo e perimetro

Portare lo schema TEST a quello che il codice di `origin/main` (già in esecuzione su TEST) si aspetta, **solo per le lacune ALTA**: oggi su TEST le query falliscono con «invalid column/object name» (es. tutti gli `/attachments*`: `attachmentScope()` fa JOIN su `non_conformities.organization_id`, `welding_book_welds`, `welding_books`).

| Fuori perimetro | Perché |
|---|---|
| 167 (`ai_usage_log`/`ai_assistant_*`) e PR #739 (rev. 167) | PR in revisione, runner 167 con `sqlcmd -U sa` (disabilitato dal 03/10) e senza `-b`; non si tocca |
| `ai_assistant_*`, `ingest_reference_patterns` (120), indici perf | MEDIA/BASSA: nessun endpoint critico rotto |
| Drift senza migrazione (4 colonne `input_*` riesame, 19 tabelle PROD senza CREATE TABLE) | Non esiste uno script da applicare: serve decisione (§6) |

## 2. Ordine sicuro delle migrazioni (grafo FK letto dai `.sql`)

Dipendenze padre già presenti su TEST (da confermare con SELECT): `organizations`, `companies`, `users`, `audits`, `projects`, `management_reviews`, `norm_requirements`, `equipment_assets`, `qualifications`, `custom_checklist_sections`, `ndt_reports/items`. `.sql` = file in `database/migrations/` salvo nota (BDM = `backend/database/migrations/`). **Tutti i runner `run-migration-<NNN>-vps.js` elencati sotto sono cablati su PROD** (`/var/www/sgq-backend`, `.env`) tranne il 153 (`SGQ_MIGRATION_TARGET=test`): **non eseguibili così su TEST** (§4).

| Batch | Mig | Oggetto | `.sql` | Runner | Distruttiva | Idemp. | Rischio |
|---|---|---|---|---|---|---|---|
| A | 110 | `welding_books`, `_equipment`, `_welds` (FK solo tra loro + `equipment_assets` se esiste: se manca viene **saltata in silenzio**) | BDM | sì (110-vps) | no | sì | basso |
| A | 124 | `context_factors`, `interested_parties` (nessuna FK) | sì | sì | no | sì | basso |
| A | 145 | `company_profile` (FK `companies`, `organizations`, `users`) | sì | sì | no | sì | basso |
| A | 117 | `requirement_implementation_status/_history` (FK `organizations`, `companies`, `norm_requirements`, `users`) | sì (con `USE SGQ_ISO9001`) | sì (117-vps) | no | sì | medio: `USE` |
| A | 122, 136 | `qualifications` +4 colonne nullable | sì | 122: sì; 136: sì | no | sì | basso |
| A | 138, 128 | `custom_checklist_sections` +2, `projects` +1 (nullable) | sì | 138: sì; **128: solo `-local`** | no | sì | basso |
| A | 112 | `management_reviews.input_monitoring` | **no** (DDL solo nel runner) | sì (112-vps/-local) | no | sì | basso |
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

**Senza `.sql`/runner utilizzabile:** 121 (`.sql` esiste, nessun runner: serve il pattern split-`GO` di 098/118); 128 (`.sql` esiste, runner solo `-local`: da usare con il runner temporaneo); 112 e 113 (**nessun `.sql` in repo**: DDL solo nel runner; si usa lo stesso DDL estratto dal runner, rivisto, oppure si crea un `.sql` in una slice futura approvata). 19 tabelle PROD non hanno CREATE TABLE nel repo (non toccate qui).

## 3. Rischi

| # | Rischio | Mitigazione / decisione |
|---|---|---|
| 1 | **`audit_id` NOT NULL → NULL** (098): drop FK → ALTER → add FK. Se `ALTER COLUMN` fallisce a metà, restano NC senza FK verso `audits` | Eseguire B1 come un unico step con verifica; provare prima su un restore copy-only; i dati esistenti (NC tutte con audit) non violano il vincolo. Rollback = restore backup (tornare a NOT NULL è impossibile se esistono NC con `audit_id` NULL) |
| 2 | **`FK_non_conformities_audit` CASCADE su TEST** (residuo baseline) | Decisione: **allineare a PROD** (nessun CASCADE). 098 la rimuove (droppa ogni FK verso `audits`) e ri-aggiunge `FK_nc_audit_ref` senza CASCADE. Effetto: cancellare un audit con NC ora fallisce, come in PROD. Da confermare con SELECT che l'FK non-CASCADE sia davvero quella finale |
| 3 | **`UX_ndt_reports_number`** globale → per org (126) | Nessun conflitto dati: il vincolo diventa più debole, quindi righe valide prima restano valide. Verificare solo l'esistenza di `UX_ndt_reports_org_number` e l'assenza dell'indice globale |
| 4 | **`norm_title` ALTER COLUMN** 200→500; **NOT NULL aggiunti** su tabelle con righe | Allargamento senza perdita; fallisce solo se esistono indici/vincoli sulla colonna (verificare). Colonne nuove su tabelle esistenti sono tutte **nullable** (098–153); i NOT NULL con DEFAULT sono solo in tabelle nuove (vuote) |
| 5 | **Runner non sicuri**: cablati su PROD (path e `.env`); `.sql` 117/118/134/135/138 contengono `USE SGQ_ISO9001` (su una connessione TEST cambierebbe DB verso PROD); `sqlcmd` senza `-b` stampa successo con errori; i runner 160–166 leggono `.sql` da `/var/www/sgq-backend-test/database/migrations` **stale**; runner 167 con `sa` | Solo runner temporaneo TEST (§4); rimuovere/rifiutare `USE`; guard `DB_NAME()`; errore bloccante; SELECT di verifica dopo ogni step |
| 6 | **Dati TEST non ricostruibili, nessun backup** | Backup copy-only obbligatorio prima di B1 (e consigliato prima di A) |
| 7 | Servizio TEST in uso durante l'apply (lock brevi su `non_conformities`, `attachments`; errori transitori per colonne mancanti fino al riavvio) | Finestra concordata; nessuna sessione utente; niente riavvio del backend se non richiesto dal batch |
| 8 | Email di prova | Già soppresse da #740 su TEST; riverificare prima degli smoke di scrittura |
| 9 | `/management-reviews` POST/PUT resta in errore dopo 112: mancano 4 colonne `input_*` senza migrazione (`input_context_changes`, `input_customer_satisfaction`, `input_process_performance`, `input_risk_effectiveness`) | Decisione aperta §6; GET dettaglio (`mr.*`) funziona |

## 4. Prerequisiti (tutti da ottenere con sì esplicito)

| Prerequisito | Dettaglio |
|---|---|
| Backup TEST | `BACKUP DATABASE [2026-06-18_SGQ_ISO9001] TO DISK=… WITH COPY_ONLY, CHECKSUM` (o export), richiesto al committente; restore di prova su DB di appoggio |
| Runner sicuro | Runner temporaneo **solo-TEST fuori dal repo** (già usato per 160–166) o pattern #738 di `backend/scripts/run-migration-158-vps.js`/`-159-`: `SGQ_MIGRATION_TARGET=test` obbligatorio, `.env.test`, abort se `DB_NAME()` ≠ `2026-06-18_SGQ_ISO9001`, nessun `USE`, split `GO`, errore SQL = stop (con `sqlcmd` solo con `-b`), `CHECK_ONLY` = parse-only |
| `.sql` aggiornati | Copia dei file di `origin/main` (da `database/migrations/` **e** `backend/database/migrations/`), non la cartella stale del VPS; riportare sha256 nel log |
| Configurazione | Sezione `test` di `backend/config/database.json.example` (file reale gitignored) coerente con `.env.test` |
| Baseline | MainPID `sgq-backend-test` e `sgq-backend` prima/dopo; conteggi righe (`non_conformities`, `attachments`, `ndt_reports`) |
| Finestra e autorizzazione | Finestra concordata; **sì esplicito per ogni batch** (migrazioni = eccezione agli automerge/autonomia) |
| Pre-check | SELECT su `INFORMATION_SCHEMA`/`sys.*` per elenco oggetti mancanti del batch; se diverso dal §2, si ferma e si aggiorna il piano |

## 5. Verifica post-apply e smoke

**SELECT attese** (`INFORMATION_SCHEMA.COLUMNS`, `sys.foreign_keys`, `sys.indexes`, `sys.check_constraints`): oggetti presenti con tipo/nullable di PROD (confronto solo nomi e tipi, nessun dato); `DB_NAME()` corretto; `is_not_trusted = 0` sulle FK nuove (113 usa WITH NOCHECK: lasciare com'è come PROD); journal `sgq-backend-test` senza «invalid column/object name». Dati dummy con prefisso `ZZ_SMOKE_` e pulizia a fine smoke.

| Batch | Verifiche DB | Smoke (status atteso) | Stop / rollback |
|---|---|---|---|
| A | 8 tabelle nuove (110: 3, 124: 2, 145: 1, 117: 2); +4 `qualifications`, +2 `custom_checklist_sections`, `projects.technical_review_checklist`, `management_reviews.input_monitoring` | `GET /welding-books` 200; `/context-factors`, `/interested-parties` 200; `/companies/:id/profile` 200; `/companies/:id/gap-matrix` e `/gap-statuses` 200; `POST/PUT /qualifications` 201/200; `POST /projects` 201; sezioni checklist custom 200 | Errore in un step o `DB_NAME()` errato → stop. Rollback: DROP delle sole tabelle nuove vuote / DROP COLUMN; altrimenti restore |
| B1 | `audit_id` `is_nullable = 1`; nessuna FK `audits` con `delete_referential_action` CASCADE; `FK_nc_audit_ref` NO ACTION; `CK_nc_source_category` con `sal_gap`; indici `IX_nc_*` | `GET /non-conformities` 200; NC **senza audit** (`audit_id` null) create e lette 200/201; `POST /audits/:ref/push-to-nc-register` 200; `/attachments*` 200 (JOIN NC/CND/RDP/Welding Book) | Stop se righe NC diminuiscono o il journal mostra errori; rollback = restore backup (nessun `*_rollback.sql` per 098) |
| B2 | colonne `management_review_id`, `corrective_action_*`, `source_risk_id`, `company_id`, `effectiveness_verification_notes`, `project_id` + FK/indici | `PUT /non-conformities/:id` con i nuovi campi 200; NC da rischio e da riesame 201 | Rollback: DROP FK/indice/colonna nell'ordine inverso (dati nuovi, nessuna perdita di dati preesistenti) |
| C | `UX_ndt_reports_number` assente, `UX_ndt_reports_org_number` presente; `norm_title` = 500; `ndt_report_items.notes`, `ndt_reports.supplier_name` | `GET/POST /ndt-reports` 200/201 (numero duplicato su altra org: ok); import norme `commitToRegistry` con titolo >200 caratteri 200 (prima: errore 8152) | Rollback: ricreare l'indice globale solo se nessun duplicato; `norm_title` non va ristretto (rischio troncamento) |

Fine di ogni batch: `journalctl` TEST senza errori di schema, MainPID invariato (nessun riavvio), pulizia dummy, report con conteggi prima/dopo.

## 6. Fuori perimetro e decisioni aperte

| Tema | Perché fuori | Decide |
|---|---|---|
| 167 e PR #739 | Revisione in corso, runner `sa`/senza `-b`. Nota: in PROD `ai_assistant_notifications` ha FK CASCADE verso `organizations(organization_id)`: da riconciliare lì | Committente, dopo la revisione |
| Drift senza migrazione (4 `input_*` riesame; 19 tabelle senza CREATE TABLE) | Nessuno script da applicare. Proposta (non eseguita): baseline schema da `sys.*` di PROD + migrazione additiva `input_*` nullable | Committente (migrazione nuova = livello Alto) |
| Numerazione dopo 169 e tabella di tracking migrazioni | Oggi nessun registro di cosa è applicato dove | Committente / lead |
| Hardening degli altri ~85 runner (target, CHECK_ONLY, guard, `-b`) | Fuori slice; l'hardening 158/159 (#738) è il modello | Lead |
| Nuovo smoke CI di schema TEST↔PROD | Evita il ripetersi del gap | Lead |

## 7. Stima rischio e sequenza raccomandata

Rischio complessivo **medio** (alto solo in B1, su un ambiente di test senza backup). Nessun apply automatico: ogni batch richiede sì esplicito e **STOP** dopo la verifica.

1. **Prerequisiti** (backup, runner, `.sql`, finestra) → STOP, sì esplicito.
2. **Batch A** (110, 124, 145, 117, 122, 136, 138, 128, 112): additivo, rischio basso → verifica + smoke → STOP.
3. **Batch B1** (098 → 118): `audit_id`/CASCADE, rischio alto → verifica + smoke → STOP.
4. **Batch B2** (113, 121, 125, 134, 135, 153): additivo → verifica + smoke → STOP.
5. **Batch C** (107, 109, 126, 119, 108): NDT, indice unico, `norm_title` → verifica + smoke → report finale di confronto TEST/PROD.
