# DEPUTYTASK_VERIFICA_WPQR_DATI — WV-3: migrazioni additive per i dati di prova WPQR (`wpqr_test_runs` + colonne di testata) e per la chiave WPS↔WPQR (`wps_wpqr_links`) + verify/rollback + runner VPS + `DATABASE.md`

**Stato:** APERTO — lanciabile **solo dopo il merge su `origin/main`** della PR di charting (gate DEPUTYTASK: `git show origin/main:docs/agent-tasks/DEPUTYTASK_VERIFICA_WPQR_DATI.md` deve mostrare `APERTO`)  
**Aperto:** 07/10/2026  
**Piano:** [`PLAN_VERIFICA_WPQR_SLICES.md`](PLAN_VERIFICA_WPQR_SLICES.md) § 2.2 (schema proposto) · § 2.3 · § 6.3 WV-3  
**Dipende da:** nessuna (onda 1)  
**Rischio:** **Medio** — migrazione **additiva** (tabella nuova + colonne nullable), nessun dato esistente modificato, nessun codice applicativo. Diventa **Alto** (stop + conferma esplicita) se serve alterare/droppare colonne esistenti, cambiare tipi, o se il deputy intende **applicare la migrazione in PROD** (che resta sempre «sì esplicito»).  
**Stream:** `DEPUTYTASK_VERIFICA_WPQR_*.md` (non riusare per altri epic)  
**Branch suggerito:** `cursor/wv-3-dati-migrazione-<suffisso>`  
**Contesto consigliato:** default/basso

---

## Obiettivo (una slice = un risultato verificabile)

Lo schema per archiviare i dati di prova di pag. 2 esiste ed è **applicabile e reversibile**: tabella figlia `wpqr_test_runs` (una riga per passata; per stud 1–2 righe) e le colonne di testata su `wpqr_records` del gruppo A e B del piano § 2.2, **nella versione aggiornata dal campione di 10 certificati PROD del 07/10/2026** (piano, sezione «Evidenze dal campione»). Nessuna logica applicativa: ingest, controller e FE sono WV-4/WV-6.

**Dati PROD (07/10/2026, piano § «Dati PROD»):** la migrazione 169 risulta applicata in PROD. Non esiste una tabella di tracciamento migrazioni: il `verify` si basa solo su colonne/oggetti. `wpqr_records` ha già `test_date`, `*_result` (`bend/tensile/impact/hardness/macro/ndt/…`) e `wps_id`: **non** vanno ricreate (nessuna modifica a colonne esistenti). `welding_procedures` è vuota. La tabella `wpqr_test_runs` e le colonne di testata sono nuove. PROD ha 13 WPQR: i conteggi attesi del `verify` sono quelli di schema (oggetti presenti), non di righe.

**Decisione D9 (chiave esplicita WPS↔WPQR) DECISA «sì» il 07/10/2026, forma A decisa** (piano § 9): rientra in questo brief come **secondo file di migrazione separato** `<NNN+1>_wps_wpqr_links.sql` (+ `<NNN+1>_verify.sql`, `<NNN+1>_rollback.sql`), così il rollback è indipendente dai dati di prova e i file restano nel perimetro già del brief (`database/migrations/**`, `DATABASE.md`): nessun altro brief cambia lista file. Forma A = **tabella di legame `wps_wpqr_links`** (non una colonna), con questo schema:

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | `INT IDENTITY(1,1)` | PK |
| `organization_id` | `INT NOT NULL` | tenant |
| `wps_id` | `INT NOT NULL` | → `welding_procedures(id)` |
| `wpqr_id` | `INT NOT NULL` | → `wpqr_records(id)` |
| `role` | `NVARCHAR(20) NULL` | valori applicativi `primary` \| `supporting` (nessun CHECK di schema) |
| `created_at` | `DATETIME2 NOT NULL DEFAULT GETDATE()` | |
| `created_by` | `INT NULL` | |

Vincoli: **UNIQUE `(wps_id, wpqr_id)`**; indice `(organization_id, wpqr_id)`; **due FK in statement `ALTER TABLE … ADD CONSTRAINT` separati** (uno verso `welding_procedures(id)`, uno verso `wpqr_records(id)`), **senza `ON DELETE`** (né `CASCADE` né `SET NULL`); idempotente, no-op se una delle due tabelle è assente (CI su DB vuoto). Regole di dominio che la migrazione **non** può imporre e che quindi restano a carico dell'API (WV-4a) e del `verify`:

- **Coerenza `organization_id`**: `links.organization_id` deve coincidere con quello della WPS e della WPQR collegate. Lo impone l'API; `<NNN+1>_verify.sql` **conta** le righe incoerenti (join su `welding_procedures` e `wpqr_records`) e dà `FAIL` se > 0 (a tabella vuota: 0).
- **v1**: un salvataggio scrive **un solo link `primary`**; `supporting` è previsto dallo schema ma non è scritto dalla v1.
- **Nessun backfill**: le WPS già generate/legacy e `wps_ref` (testo) restano senza link finché l'utente non conferma; nessuna risoluzione automatica di `wps_ref`.
- **`wpqr_records.wps_id` resta invariato e vivo** (oggi `createWPQR` lo impone: `wps_id obbligatorio`, 400 se manca; `welding.controller.js` righe 513–514). **Lettori nuovi = unione** dei link e di `wps_id`; **le scritture nuove non toccano `wps_id`**.
- **Scrittura solo alla conferma umana della bozza** (`createWPS` dopo `POST /welding/wps/generate`), **in transazione** con l'inserimento della WPS. Nessun link nasce da ingest, rielaborazione o script.
- **Nessuna voce Rielaborazioni**: il legame non è un campo AI-estraibile (eccezione dichiarata dalla regola «Schema/ingest nuovo campo»).
- **Solo schema in questa slice**: service, API, regole di cancellazione e UI dei link **non** sono qui — vedi § «Regola di cancellazione (rischio)» e piano § 6.2 (WV-4a scrive/legge/cancella, WV-7 è il chiamante alla conferma).

**Numero di migrazione:** il piano **non lo riserva**. Dopo `git fetch origin main`, il deputy legge l'ultimo `NNN_*.sql` in `database/migrations/` e dichiara **entrambi** i numeri nel body PR. **Rinumerazione 08/10/2026:** i numeri **170 e 171 originari sono occupati** — su `origin/main` esistono `170_attachments_ndt_item_index.sql` (PR #750), `171_management_reviews_input_columns.sql` e `172_ai_assistant_tables_align_prod.sql` (PR #751); l'**ultimo numero reale è 172** (verificato con `ls database/migrations | sort | tail` e `git log origin/main --stat -- database/migrations`; al 08/10/2026 l'unica PR aperta è #747, solo documentazione). **Oggi `NNN` = 173 (`wpqr_test_data`) e `NNN+1` = 174 (`wps_wpqr_links`) — il deputy ricontrolla dopo `git fetch`** e, se `main` è avanzato, rinumera tutti i file e i riferimenti prima del push. `DATABASE.md` è stantio (righe 262–263: «Ultimo `NNN`» 168, «Prossimo libero» 169): lo aggiorna WV-3. Companion `NNN_verify.sql` e `NNN_rollback.sql` (policy ≥ 169).

## Gate norme (dichiarato)

Non codifica regole né soglie. Le colonne rispecchiano il **modulo** WPQR e gli elementi che §9 richiede.

- **Coperte:** ISO 15614-1 Annex B (`NORMA_00043`, pagg. 47–51 del Markdown), ISO 15614-2 Annex A (`NORMA_00031`), ISO 14555 Annex C (`NORMA_00033`), ISO 15609-1 §4.4.8–4.4.17 / §4.5.x (`NORMA_00014`).
- **Mancanti:** nessuna fonte necessaria per **creare colonne**. L'attribuzione «prova vs range qualificato» di preheat/interpass è **chiusa dal campione** (pag. 1 ha solo il range, il valore di prova è a pag. 2/3): **D4 = Sì**, quindi **si aggiungono** `preheat_temp_test` e `interpass_temp_test`. Le colonne senza riferimento in Annex B/15609-1 sono marcate «da campione, nessuna clausola»: sono dati archiviati, non alimentano regole normative.
- **Si parte su:** schema del piano § 2.2 (versione del campione); il deputy può **ridurre** (mai estendere) il gruppo B se lo dichiara nel body PR. **Non si aggiungono** `pwps_ref` (coperta da `wps_ref` e dal legame D9), rendimento %, lunghezze di cordone/elettrodo (sempre vuote nel campione).

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| Passate (`wpqr_test_runs`: `run_no`, `run_label` **testo**, `welding_process`, `filler_diameter_mm` numerico, `filler_designation`, `filler_make`, `current_a`, `voltage_v` **valori singoli**, `current_polarity` nullable, `wire_feed_speed`+`wire_feed_unit` **nullable**, `travel_speed`+`travel_speed_unit`, `heat_input_value`+`heat_input_unit`, `metal_transfer`, colonne stud, `remarks`, `source`) | Annex B pag. 2 / Annex A / Annex C; §9, §10.4; 15609-1 §4.4.8–4.4.9; §8.4.7 (apporto) | `WpqrTestRunsEditor` (WV-6a) | `GET/PUT /welding/wpqr/:id/test-runs` (WV-4) |
| Testata gruppo A (`welding_position_test`, `diameter_test_mm`, `deposited_thickness_mm`, `thickness_t2_test_mm`, `filler_make`, `filler_size`, `backing_gas`, `heat_input_kind`, `heat_input_range_min/max/unit/basis`, `post_heating`, `pwht_details`) | Annex B pag. 1–2; §8.3.2, §8.3.3, §8.4.2, §8.4.7, §8.4.10, §8.4.11, §8.5.6; `thickness_t2_test_mm`: da campione, nessuna clausola | form WPQR (WV-6b) | `PUT /welding/wpqr/:id` (WV-4) |
| Testata: tolleranza relativa dell'apporto (`heat_input_tol_minus_pct`, `heat_input_tol_plus_pct`, `heat_input_plus_unlimited`) e `range_standard_reference` | §8.4.7 (semantica del range); forma e norma di range **da campione, nessuna clausola** (7/10 relativo; 1/10 qualifica 15613 con range 15614-1) | form WPQR (WV-6b) | idem |
| Testata: valore di prova (`preheat_temp_test`, `interpass_temp_test`; D4 = Sì) | Annex B pag. 1–2; §8.4.8–8.4.9 | form WPQR (WV-6b) | idem |
| Testata gruppo B (`shielding_gas_flow_l_min_min/max`, `nozzle_diameter_mm`, `contact_tube_distance_mm_min/max`, `tungsten_electrode`, `torch_angle_deg`, `joint_preparation`, `cleaning_method`, `bead_technique`, `electrode_count`, `other_test_info`) | 15609-1 §4.5.2–4.5.5 (via §9) per gas, ugello, distanza, tungsteno; Annex B pag. 2 per preparazione/pulizia e «Other information\*»; angolo torcia, tecnica del cordone, numero elettrodi: **da campione, nessuna clausola** | collassato (WV-6b) | idem; ingest ammesso dal campione, con revisione umana (D3 aggiornata; `tungsten_electrode` senza ingest) |
| Legame `wps_wpqr_links` (`wps_id`, `wpqr_id`, `role`, `organization_id`, `created_by`) | **nessuna clausola**: relazione di dati tra due record dell'app (D9), non un requisito normativo; non alimenta regole | bozza WPS → conferma (WV-7) | scrittura e lettura in WV-4a (`createWPS` in transazione; lettori = unione link + `wps_id`) |

## Rielaborazioni (Registro)

**Esenzione dichiarata per questa slice:** solo schema, nessun codice. Le **voci Rielaborazioni** dei campi AI-estraibili (`wpqr_*`) e l'adapter per la tabella `wpqr_test_runs` nascono **in WV-4** (la slice che aggiunge lo schema AI), non qui. Il body PR lo ribadisce.

## File previsti

- *Nuovi* `database/migrations/<NNN>_wpqr_test_data.sql`, `<NNN>_verify.sql`, `<NNN>_rollback.sql`
- *Nuovi (D9)* `database/migrations/<NNN+1>_wps_wpqr_links.sql`, `<NNN+1>_verify.sql`, `<NNN+1>_rollback.sql`
- *Nuovi (runner VPS, **uno per migrazione**)* `backend/scripts/run-migration-<NNN>-vps.js` e `backend/scripts/run-migration-<NNN+1>-vps.js` (oggi `run-migration-173-vps.js` / `run-migration-174-vps.js` — il deputy ricontrolla dopo `git fetch`), modellati su `run-migration-158-vps.js` / `159` (hardening) e `169` (flusso verify) — dettaglio in § «Cosa fare» passo 6c
- *Nuovo (test L1 dei runner)* `backend/scripts/runMigration<NNN>_<NNN+1>.test.js` (stesso schema di `runMigrationHardening158159.test.js`: target obbligatorio, guard DB, `CHECK_ONLY` senza scritture, pool finto)
- *Modificato* `docs/reference/DATABASE.md` (righe «Ultimo `NNN`» / «Prossimo libero», tabelle `wpqr_test_runs` e `wps_wpqr_links`, colonne aggiunte a `wpqr_records`)
- Solo lettura/riuso: `backend/scripts/run-migration-158-vps.js`, `run-migration-159-vps.js`, `run-migration-169-vps.js`, `backend/scripts/runMigrationHardening158159.test.js`, `docs/how-to/database-migrations.md` (modello runner), `database/migrations/_TEMPLATE_additive.sql`, `_TEMPLATE_NNN_verify.sql`, `_TEMPLATE_NNN_rollback.sql`, `169_wpqr_drop_expiry_date.sql` (+ `169_verify.sql`, `169_rollback.sql`: schema «tabella assente → no-op»), `089_welding_procedures_full.sql`, `133_wpqr_coverage_fields.sql`, `159_wpqr_stud_fields.sql`

## Cosa NON toccare

Qualsiasi file `backend/src/**` (quindi **nessuna** modifica a `backend/scripts/deploy-manifest.json`: i runner sono in `backend/scripts/`, vengono copiati via SCP in `/tmp` sul VPS e **non** sono caricati dal backend né elencati nel manifest — verificato: `deploy-manifest.json` non contiene alcun `run-migration-*`, e la regola «aggiorna il manifest» di `sgq-operating-memory.mdc`/`sgq-sysadmin.mdc` vale solo per `.js` nuovi in `backend/src/`), `app/**`, i runner esistenti (`run-migration-1*-vps.js`) e i loro test, `reprocessableFields.js`, migrazioni esistenti (nessuna modifica a colonne già presenti: `preheat_temp`, `interpass_temp`, `current_type`, `metal_transfer`, `heat_input_note`, `*_result`, `thickness_*`, …), `database/migrations/ci/**`, `backend/scripts/run-migrations-test-only.js` e il suo test (l'allowlist non si estende: § «Requisiti dei runner»), `welding.controller.js` e `companyMaintenance.service.js` (regola di cancellazione: WV-4a), `PLAN_*`, GUIDA, `PROJECT_ROADMAP.md`, `PROJECT_CONTEXT.md`.

## Requisiti dei runner VPS (WV-3 li scrive, non li esegue)

Modello: `backend/scripts/run-migration-158-vps.js` / `159` (hardening, già coperti da `backend/scripts/runMigrationHardening158159.test.js`) per **struttura, target e guard**; `run-migration-169-vps.js` **solo** per il flusso «file `.sql` + split `GO` + `NNN_verify.sql`» (percorsi candidati `${BACKEND_ROOT}/database/migrations/…` oppure `/tmp/…`, `splitGoBatches`, confronto righe prima/dopo). Ciascun runner `run-migration-<N>-vps.js` (uno per `NNN` e uno per `NNN+1`) deve:

1. **Target obbligatorio** `SGQ_MIGRATION_TARGET=test|prod`, **nessun default**: valore assente o diverso da `test`/`prod` esatti → `exit 1` **prima** di `loadBackend` e di qualsiasi connessione (come `resolveTarget` di 158/159). Il default `prod` e la lettura case-insensitive di 169 (`String(… || 'prod').toLowerCase()`) **non si copiano**.
2. **Guard `SELECT DB_NAME()`** subito dopo la connessione e **prima** di ogni altra query: il nome deve combaciare con il DB del target — `SGQ_ISO9001` per `prod`, `2026-06-18_SGQ_ISO9001` per `test` (costante `DB_NAME_BY_TARGET` di `run-migration-158-vps.js`; stessa del runner solo-TEST). Mismatch → `exit 1`, nessun DDL, pool chiuso. **169 non ha questa guard e non si copia.**
3. **`CHECK_ONLY=1` / `CHECK_ONLY=true` / `SGQ_MIGRATION_CHECK_ONLY=1`** = **sole `SELECT`** (il test L1 di 158/159 asserisce che ogni query inizi con `SELECT`: niente `DECLARE`/`IF`/`EXEC`), exit 0, elenco di cosa **manca** (tabelle, colonne, indici, FK della migrazione) e delle **precondizioni**: PK reali di `welding_procedures` e `wpqr_records` (`sys.indexes`/`sys.index_columns` con `is_primary_key = 1` su `id`, tipo `INT`) e presenza di `organization_id`. Motivo: `089_welding_procedures_full.sql` crea `welding_procedures`/`wpqr_records` solo `IF OBJECT_ID(…) IS NULL` e per le tabelle già presenti si limita ad aggiungere colonne mancanti («gia presente - verifico colonne mancanti»): su un DB cresciuto prima di 089 la tabella può preesistere con **schema ridotto e senza PK**, e una FK verso una colonna senza PK/unique fallisce. Esito finale riga per riga («mancano N oggetti» / «nessun oggetto mancante») e `nessun DDL eseguito`.
4. **Apply** (senza `CHECK_ONLY`): se una precondizione del punto 3 non è soddisfatta → **rifiuto con `exit 1` prima del primo batch** (il no-op «tabella assente» del `.sql` serve alla CI su DB vuoto, **non** a TEST/PROD, dove una tabella assente significa ambiente disallineato). Poi: lettura del `.sql`, split su `GO`, esecuzione **in ordine, un batch alla volta**, **rifiuto (`exit 1`, nessun batch eseguito) se un batch contiene `USE`** (analisi su testo senza commenti: il guard `DB_NAME()` è l'unica scelta del DB). Conteggio righe di `wpqr_records` (e, per `NNN+1`, anche di `welding_procedures`) **prima e dopo**: se cambia → `exit 1`.
5. **Poi `<N>_verify.sql`** (stesso split `GO`, ultima riga di risultato) con **`esito = PASS`**; qualsiasi altro esito o riga assente → `exit 1`. I conteggi stampati sono quelli del `verify` (oggetti presenti, righe invariate, per `NNN+1` anche `org_incoerenti = 0`).
6. **Rollback = file separato `<N>_rollback.sql`, mai eseguito dal runner** (al massimo ne stampa il percorso nel messaggio finale). **Nessun `CASCADE`, nessun `DROP`, nessun `UPDATE`/`DELETE`** né nel `.sql` di apply né nel runner (il `DROP` vive solo nel rollback).
7. **Export** per il test: `module.exports = { run, resolveTarget, assertDbMatchesTarget, … }` (+ costanti utili al test, es. l'elenco oggetti attesi); `run({ env, loadBackend })` **ritorna** il codice (**0 = ok / `CHECK_ONLY`, 1 = errore**, mai `process.exit` dentro `run`); `if (require.main === module) run().then((code) => process.exit(code))`. Nessun `require` del backend né `run()` a livello di modulo (169 lo fa: non testabile, non si copia). Header JSDoc con i comandi `scp -P 1122 … /tmp/` + `ssh -p 1122 … SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node /tmp/run-migration-<N>-vps.js`.

**Test L1** `backend/scripts/runMigration<NNN>_<NNN+1>.test.js`, sul modello di `runMigrationHardening158159.test.js` (`describe.each` sui due runner, pool finto iniettato, nessuna connessione reale): target mancante/non ammesso (`''`, `staging`, `PROD`, `Test`, `' prod'`, `production`, `1`) → exit 1 senza `loadBackend`; `.env` e root distinti per target; guard DB (mismatch prod/test) → exit 1 senza DDL; `CHECK_ONLY` (`1`, `true`, `SGQ_MIGRATION_CHECK_ONLY=1`) → solo `SELECT` e elenco mancanti/precondizioni; precondizione PK assente → apply rifiutato prima di ogni batch; `USE` nel `.sql` → rifiuto; esito verify ≠ `PASS` → exit 1; nessun path PROD hardcoded fuori dalla costante. **Più analisi statica dei `.sql` reali** (file letti, non eseguiti, commenti mascherati): nessun `DROP`/`UPDATE`/`DELETE`/`ALTER COLUMN`/`ON DELETE`/`USE`; ogni FK in `ALTER TABLE … ADD CONSTRAINT` **separato** dal `CREATE TABLE`; `CREATE TABLE` e ogni `ALTER … ADD` protetti da `OBJECT_ID`/`COL_LENGTH`; `verify` = sole `SELECT` con colonna `esito`; `rollback` presente e **non** referenziato come file eseguito dal runner.

**`run-migrations-test-only.js` (allowlist, #751): serve estenderlo? No, non per WV-3.** Letto il file: l'allowlist `MIGRATIONS` è una mappa chiusa numero → `.sql` (oggi 27 voci, fino a `'172'`, batch `A, B1, B2, C, D`; un numero fuori mappa dà «fuori allowlist»), **applica solo il `.sql`** (un batch alla volta in transazione, poi controlla solo che gli oggetti attesi esistano) e **non esegue `NNN_verify.sql`**, non conta le righe e non fa le precondizioni PK. I runner dedicati `run-migration-<N>-vps.js` coprono già TEST **e** PROD con verify e conteggi: per WV-3 l'allowlist **non** va toccata (e `backend/scripts/runMigrationsTestOnly.test.js` fissa l'elenco esatto delle chiavi, quindi aggiungere voci richiederebbe di modificare anche quel test). Estenderlo (due righe in `MIGRATIONS` nel batch `D` + elenco in `planNumbers` del test + `docs/reference/PIANO_ALLINEAMENTO_SCHEMA_TEST_2026-10-07.md`) serve **solo** se il committente vuole applicare le due migrazioni su TEST con quel runner invece che con i nuovi: è una scelta **HITL** fuori da questo brief, non un prerequisito. Nota di compatibilità: i due `.sql` devono comunque passare il suo filtro statico (nessun `USE` verso altri DB, nessun `SET PARSEONLY/NOEXEC`, nessun nome a 3 parti verso `SGQ_ISO9001`, nessun `GO <n>`), così l'opzione resta aperta.

## Regola di cancellazione (rischio trovato: nessun CASCADE)

**Non è lavoro di WV-3** (nessun `backend/src/**`), ma il brief la dichiara perché la migrazione `NNN+1` la rende **necessaria**: le FK senza `ON DELETE` fanno fallire qualsiasi `DELETE` di una WPS o WPQR che abbia link. Verificato leggendo i file:

- `backend/src/controllers/welding.controller.js` — `deleteWPS` (righe ~356–383) oggi cancella **prima** le `wpqr_records` con `wps_id = @id` e **poi** la WPS; **non** conosce i link. `deleteWPQR` (righe ~711–735) cancella la sola riga di `wpqr_records` (e `getWPQR`/`listWPQR` leggono solo `wpqr_records.wps_id`).
- `backend/src/services/companyMaintenance.service.js` — `hardDeleteCompany` ha in `simpleDeletes` la voce `welding_procedures` (`DELETE … WHERE company_id = @company_id AND organization_id = @organization_id`) e **nessuna** per `wpqr_records`; ogni voce passa da `tryQuery`, che **ingoia gli errori** (`logger.warn … skip`): con link presenti la `DELETE` fallirebbe per FK **in silenzio** e la cancellazione azienda resterebbe a metà.
- Nessun altro `DELETE FROM wpqr_records|welding_procedures` in `backend/src` (grep).

Regola (da implementare in **WV-4a**, vedi piano § 6.2): (1) `deleteWPS` cancella **prima i link della WPS** (`wps_id = @id`) e i link delle WPQR che sta per cancellare per la regola `wps_id` esistente, **poi** le `wpqr_records` con `wps_id = @id` (comportamento invariato) e la WPS — **non** cancella le WPQR collegate **solo via link** (restano, con un'altra WPS); (2) `deleteWPQR` cancella prima le passate (`wpqr_test_runs`, già in 4a) e i link con `wpqr_id = @id`, poi la WPQR; (3) `hardDeleteCompany` cancella i link delle WPS dell'azienda (join su `welding_procedures.company_id`) **prima** della voce `welding_procedures`; (4) tutte nella **stessa transazione** (pattern già usato: `pool.transaction()` in `qualifications.controller.js`, `new sql.Transaction(pool)` in `contractReview.controller.js`) e con test che verificano **l'ordine** (link → WPQR/passate → WPS). **Rischio residuo da decidere nel brief WV-4:** una WPQR con `wps_id = X` e link anche verso la WPS Y viene comunque cancellata alla cancellazione di X (regola `wps_id` esistente) — il brief WV-4 la mantiene e la dichiara, oppure la cambia in «scollega e non cancellare» (scelta del committente, non di WV-3).

## Cosa fare

1. `git fetch origin main`; leggere l'ultimo `NNN` e dichiararlo. Copiare i template additivi (≥ 169): intestazione `-- TYPE: additive`, `-- BACKFILL: none`, `-- VERIFY: <NNN>_verify.sql`, `-- ROLLBACK: <NNN>_rollback.sql`.
2. **Idempotente**: `COL_LENGTH`/`OBJECT_ID` prima di ogni `ALTER`/`CREATE`; se `dbo.wpqr_records` **non esiste** (CI su DB vuoto) → `PRINT` e no-op, come la 169.
3. `CREATE TABLE dbo.wpqr_test_runs` con le colonne del piano § 2.2 **aggiornate dal campione** (tutte nullable tranne `id`, `organization_id`, `wpqr_id`, `created_at`): `run_label` NVARCHAR(20) come **testo** (7/18 etichette non intere) e `run_no` INT nullable; `filler_diameter_mm` DECIMAL(5,2) al posto di `filler_size`; `current_a` e `voltage_v` come **valore singolo** (nessun `_min`/`_max`); `heat_input_value` DECIMAL(10,3) + `heat_input_unit` NVARCHAR(10) al posto di `heat_input_kj_mm`; `travel_speed` + `travel_speed_unit` (l'obbligo dell'unità è applicativo, non vincolo di schema); `wire_feed_speed` + `wire_feed_unit` **nullable**, nessun default; unità esplicite; indice `(organization_id, wpqr_id)`. **Non** creare colonne per rendimento %, lunghezze di cordone/elettrodo.
4. **FK `wpqr_id → wpqr_records(id)` in uno statement separato**, **senza** `ON DELETE CASCADE`.
5. `ALTER TABLE wpqr_records ADD …` per le colonne di testata di § 2.2 aggiornato (una per statement `IF COL_LENGTH … IS NULL`), tutte `NULL`, senza default che riscriva righe: gruppo A (`welding_position_test`, `diameter_test_mm`, `deposited_thickness_mm`, `thickness_t2_test_mm`, `filler_make`, `filler_size`, `backing_gas`, `heat_input_kind`, `heat_input_range_min`/`_max`/`_unit`/`_basis`, `heat_input_tol_minus_pct`, `heat_input_tol_plus_pct`, `heat_input_plus_unlimited`, `preheat_temp_test`, `interpass_temp_test`, `post_heating`, `pwht_details`, `range_standard_reference`) e gruppo B (`shielding_gas_flow_l_min_min`/`_max`, `nozzle_diameter_mm`, `contact_tube_distance_mm_min`/`_max`, `tungsten_electrode`, `torch_angle_deg`, `joint_preparation`, `cleaning_method`, `bead_technique`, `electrode_count`, `other_test_info`). **Niente `pwps_ref`.** Tipi e lunghezze: piano § 2.2.
6. `<NNN>_verify.sql`: controlla presenza tabella, colonne, indice e FK; esito leggibile.
6b. D9 (forma A, schema nella § Obiettivo): `<NNN+1>_wps_wpqr_links.sql` (`OBJECT_ID` prima di `CREATE`; no-op se `welding_procedures` o `wpqr_records` mancano; PK `id`, `created_at` con default, UNIQUE `(wps_id, wpqr_id)`, indice `(organization_id, wpqr_id)`, **due FK in `ALTER TABLE … ADD CONSTRAINT` separati**, senza `ON DELETE`; nessun backfill) + `<NNN+1>_verify.sql` (tabella, colonne e tipi, unique, indice, due FK, **conteggio righe incoerenti per `organization_id` rispetto a WPS/WPQR = 0**, `welding_procedures`/`wpqr_records` invariate; `esito = PASS|FAIL`) + `<NNN+1>_rollback.sql` (solo FK, indice, unique e tabella creati, nell'ordine corretto, idempotente; l'intestazione avverte che elimina i link eventualmente scritti dopo l'apply: per questo il runner non lo esegue mai).
6c. **Runner VPS (nuovi file, uno per migrazione)**: `run-migration-<NNN>-vps.js` e `run-migration-<NNN+1>-vps.js`, **come da § «Requisiti dei runner VPS»** (target obbligatorio, guard `DB_NAME()`, `CHECK_ONLY` a sole `SELECT` con precondizioni PK, apply a batch `GO` senza `USE`, `verify` con `esito=PASS`, rollback non eseguito, export `run`/`resolveTarget`/`assertDbMatchesTarget`, exit 0/1) e relativo test L1. **Scrittura dei runner = lavoro del deputy WV-3; l'apply non lo è.**
7. `<NNN>_rollback.sql`: rimuove **solo** FK, indice, tabella e colonne create da questa migrazione, nell'ordine corretto; idempotente.
8. `DATABASE.md`: allineare «Ultimo `NNN`» (stantio: 168) e «Prossimo libero», documentare tabella e colonne.
9. **Non applicare in PROD né su TEST dal Cloud** (SQL Server non raggiungibile; applicazione via SCP + `run-migration-<N>-vps.js` = HITL: **sì esplicito del committente**, prima `SGQ_MIGRATION_TARGET=test CHECK_ONLY=1`, poi apply su TEST, mai PROD senza un secondo «sì» dedicato). Nessun runner viene eseguito dal deputy. Nel body PR: «cosa serve per applicarla» e conteggi attesi dal `verify`.

## Test L1

Comandi: CI «Apply da 169 su SQL Server vuoto» (job esistente: la migrazione deve essere **verde su DB vuoto**, no-op per tabella assente) · `node backend/scripts/check-utf8-encoding.js` · `node backend/scripts/check-harness-boot.js`.

- Lettura statica: nessun `DROP`/`ALTER COLUMN`/`UPDATE`/`DELETE` su oggetti preesistenti; nessun `ON DELETE CASCADE`; FK in statement separato; nessun `USE`.
- Test dei runner: `cd backend && npx jest scripts/runMigration<NNN>_<NNN+1>` (casi elencati in § «Requisiti dei runner VPS»); regressione sui runner esistenti: `npx jest scripts/runMigrationHardening158159` e `scripts/runMigrationsTestOnly` (devono restare verdi: nessun file esistente è modificato).
- Se è disponibile uno script locale di verifica delle intestazioni migrazione (gate «intestazione + companion» di `DATABASE.md`), eseguirlo e allegare l'esito.

## DoD

- [ ] `<NNN>_wpqr_test_data.sql` additiva, idempotente, no-op su tabella assente; FK separata, nessun CASCADE
- [ ] Schema = piano § 2.2 **aggiornato dal campione 07/10/2026**: passate con `run_label` testo, `filler_diameter_mm`, `current_a`/`voltage_v` singoli, `heat_input_value`+`heat_input_unit`, `travel_speed_unit`, `wire_feed_speed` nullable; testata con tolleranze relative, `preheat_temp_test`/`interpass_temp_test`, gas flow e distanza in `min`/`max`, `thickness_t2_test_mm`, `range_standard_reference` e le colonne di gruppo B; **nessuna** `pwps_ref`, rendimento o lunghezze (elencate in `<NNN>_verify.sql` e `<NNN>_rollback.sql`)
- [ ] Per **ciascuna** delle due migrazioni: `.sql` + `<N>_verify.sql` + `<N>_rollback.sql` + `backend/scripts/run-migration-<N>-vps.js` presenti e coerenti (4 file per migrazione; runner con target obbligatorio e `CHECK_ONLY`, come 158/159) e test L1 dei runner verde (`cd backend && npx jest scripts/runMigration<NNN>_<NNN+1>`); nessun runner eseguito
- [ ] `<NNN>_verify.sql` e `<NNN>_rollback.sql` presenti e coerenti; intestazione conforme (`-- TYPE/-- BACKFILL/-- VERIFY/-- ROLLBACK`)
- [ ] Nessuna colonna esistente alterata; nessun dato riscritto
- [ ] D9 forma A: `<NNN+1>_wps_wpqr_links.sql` additiva con **esattamente** le colonne della § Obiettivo (`id` IDENTITY PK, `organization_id` NOT NULL, `wps_id` NOT NULL, `wpqr_id` NOT NULL, `role` NVARCHAR(20) NULL, `created_at` DATETIME2 NOT NULL DEFAULT GETDATE(), `created_by` INT NULL), UNIQUE `(wps_id, wpqr_id)`, indice `(organization_id, wpqr_id)`, due FK in statement separati, nessun `ON DELETE`; `verify` che conta le righe con `organization_id` incoerente (atteso 0) e dà `PASS`; rollback proprio; nessun backfill; nessun link creato sulle WPS legacy; `wpqr_records.wps_id` non toccata
- [ ] Runner secondo § «Requisiti dei runner VPS»: nessun default `prod`, guard `DB_NAME()`, `CHECK_ONLY` a sole `SELECT` con elenco mancanti e precondizioni PK reali, rifiuto di `USE`, `verify` con `esito=PASS`, righe di `wpqr_records` invariate, rollback mai eseguito, export `run`/`resolveTarget`/`assertDbMatchesTarget`, exit 0/1; nessuna modifica a `run-migrations-test-only.js`
- [ ] Body PR: dichiarata la regola di cancellazione (§ «Regola di cancellazione») come prerequisito di WV-4a, e che **prima di WV-4a nessun codice scrive link**
- [ ] `DATABASE.md` allineato (ultimo `NNN`, tabella, colonne)
- [ ] CI migrazioni verde; `check-utf8-encoding.js` verde; **nessun file `backend/src`/`app` nel diff**; `deploy-manifest.json` **non** modificato (i runner non sono in `backend/src/`)
- [ ] Body PR: numeri dichiarati, cosa serve per applicare (comandi `scp` + `SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node /tmp/run-migration-<N>-vps.js`), esito atteso del verify; **migrazioni non applicate né su TEST né in PROD**
- [ ] Branch allineato a `origin/main` (`git fetch origin main && git merge origin/main`) **e** numeri NNN/NNN+1 ricontrollati (se un'altra PR ha preso 173 o 174, cioè `NNN`/`NNN+1` → rinumerare prima di push/PR); `bugbot run` **una sola volta** a slice chiusa

## HITL

**Applicazione in PROD/TEST delle migrazioni (esecuzione dei runner `run-migration-<N>-vps.js` via SCP + SSH): sì esplicito del committente** (mai autonoma, mai dal Cloud). Se serve toccare colonne esistenti → **stop**, handoff nel brief, livello Alto.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_WPQR_DATI.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto)_
