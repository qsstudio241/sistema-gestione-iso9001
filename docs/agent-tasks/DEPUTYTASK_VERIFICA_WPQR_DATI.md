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

Lo schema per archiviare i dati di prova di pag. 2 esiste ed è **applicabile e reversibile**: tabella figlia `wpqr_test_runs` (una riga per passata; per stud 1–2 righe) e le colonne di testata su `wpqr_records` del gruppo A e B del piano § 2.2. Nessuna logica applicativa: ingest, controller e FE sono WV-4/WV-6.

**Dati PROD (07/10/2026, piano § «Dati PROD»):** la migrazione 169 risulta applicata in PROD. Non esiste una tabella di tracciamento migrazioni: il `verify` si basa solo su colonne/oggetti. `wpqr_records` ha già `test_date`, `*_result` (`bend/tensile/impact/hardness/macro/ndt/…`) e `wps_id`: **non** vanno ricreate (nessuna modifica a colonne esistenti). `welding_procedures` è vuota. La tabella `wpqr_test_runs` e le colonne di testata sono nuove. PROD ha 13 WPQR: i conteggi attesi del `verify` sono quelli di schema (oggetti presenti), non di righe.

**Decisione D9 (chiave esplicita WPS↔WPQR) DECISA «sì» il 07/10/2026** (piano § 9): rientra in questo brief come **secondo file di migrazione separato** `<NNN+1>_wps_wpqr_links.sql` (+ `<NNN+1>_verify.sql`, `<NNN+1>_rollback.sql`), così il rollback è indipendente dai dati di prova e i file restano nel perimetro già del brief (`database/migrations/**`, `DATABASE.md`): nessun altro brief cambia lista file. Tabella `wps_wpqr_links` (`id`, `organization_id`, `wps_id`, `wpqr_id`, `role` nullable, `created_at`, `created_by` nullable); **unique `(wps_id, wpqr_id)`**; indice `(organization_id, wpqr_id)`; **FK in statement separati** verso `welding_procedures(id)` e `wpqr_records(id)`, **senza `ON DELETE CASCADE`**; idempotente, no-op se una delle due tabelle è assente (CI su DB vuoto). **Nessun backfill**: le WPS già generate/legacy e `wps_ref` (testo) restano senza link finché l'utente non conferma; `wpqr_records.wps_id` non si tocca. **Solo schema**: API/UI/salvataggio dei link non sono qui (WV-7 o slice dedicata dopo il merge).

**Numero di migrazione:** il piano **non lo riserva**. Dopo `git fetch origin main`, il deputy legge l'ultimo `NNN_*.sql` in `database/migrations/` (al momento del charting: **169**, quindi `NNN` = **170** per `wpqr_test_data` e `NNN+1` = **171** per `wps_wpqr_links`; `DATABASE.md` è stantio e dice 168/169) e dichiara **entrambi** i numeri nel body PR. Companion `NNN_verify.sql` e `NNN_rollback.sql` (policy ≥ 169).

## Gate norme (dichiarato)

Non codifica regole né soglie. Le colonne rispecchiano il **modulo** WPQR e gli elementi che §9 richiede.

- **Coperte:** ISO 15614-1 Annex B (`NORMA_00043`, pagg. 47–51 del Markdown), ISO 15614-2 Annex A (`NORMA_00031`), ISO 14555 Annex C (`NORMA_00033`), ISO 15609-1 §4.4.8–4.4.17 / §4.5.x (`NORMA_00014`).
- **Mancanti:** nessuna fonte necessaria per **creare colonne**. L'attribuzione «prova vs range qualificato» di preheat/interpass resta aperta (piano D4): **non** si aggiungono `preheat_temp_test`/`interpass_temp_test` in questa slice.
- **Si parte su:** schema del piano § 2.2; il deputy può **ridurre** (mai estendere) il gruppo B se lo dichiara nel body PR.

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| Passate (`wpqr_test_runs`) | Annex B pag. 2 / Annex A / Annex C; §9, §10.4 | `WpqrTestRunsEditor` (WV-6a) | `GET/PUT /welding/wpqr/:id/test-runs` (WV-4) |
| Testata gruppo A (`welding_position_test`, `diameter_test_mm`, `deposited_thickness_mm`, `filler_make`, `filler_size`, `backing_gas`, `heat_input_kind`, `heat_input_range_min/max`, `post_heating`, `pwht_details`, `pwps_ref`) | Annex B pag. 1–2; §8.3.2, §8.3.3, §8.4.2, §8.4.7, §8.4.10, §8.4.11, §8.5.6 | form WPQR (WV-6b) | `PUT /welding/wpqr/:id` (WV-4) |
| Testata gruppo B (`shielding_gas_flow`, `nozzle_diameter_mm`, `contact_tube_distance_mm`, `tungsten_electrode`, `other_test_info`) | 15609-1 §4.5.2–4.5.5 (via §9); Annex B «Other information\*» | collassato (WV-6b) | idem; ingest solo dopo il campione (D3) |

## Rielaborazioni (Registro)

**Esenzione dichiarata per questa slice:** solo schema, nessun codice. Le **voci Rielaborazioni** dei campi AI-estraibili (`wpqr_*`) e l'adapter per la tabella `wpqr_test_runs` nascono **in WV-4** (la slice che aggiunge lo schema AI), non qui. Il body PR lo ribadisce.

## File previsti

- *Nuovi* `database/migrations/<NNN>_wpqr_test_data.sql`, `<NNN>_verify.sql`, `<NNN>_rollback.sql`
- *Nuovi (D9)* `database/migrations/<NNN+1>_wps_wpqr_links.sql`, `<NNN+1>_verify.sql`, `<NNN+1>_rollback.sql`
- *Nuovi (runner VPS, **uno per migrazione**)* `backend/scripts/run-migration-<NNN>-vps.js` e `backend/scripts/run-migration-<NNN+1>-vps.js` (oggi `run-migration-170-vps.js` / `run-migration-171-vps.js`), modellati su `run-migration-158-vps.js` / `159` (hardening) e `169` (flusso verify) — dettaglio in § «Cosa fare» passo 6c
- *Nuovo (test L1 dei runner)* `backend/scripts/runMigration<NNN>_<NNN+1>.test.js` (stesso schema di `runMigrationHardening158159.test.js`: target obbligatorio, guard DB, `CHECK_ONLY` senza scritture, pool finto)
- *Modificato* `docs/reference/DATABASE.md` (righe «Ultimo `NNN`» / «Prossimo libero», tabelle `wpqr_test_runs` e `wps_wpqr_links`, colonne aggiunte a `wpqr_records`)
- Solo lettura/riuso: `backend/scripts/run-migration-158-vps.js`, `run-migration-159-vps.js`, `run-migration-169-vps.js`, `backend/scripts/runMigrationHardening158159.test.js`, `docs/how-to/database-migrations.md` (modello runner), `database/migrations/_TEMPLATE_additive.sql`, `_TEMPLATE_NNN_verify.sql`, `_TEMPLATE_NNN_rollback.sql`, `169_wpqr_drop_expiry_date.sql` (+ `169_verify.sql`, `169_rollback.sql`: schema «tabella assente → no-op»), `089_welding_procedures_full.sql`, `133_wpqr_coverage_fields.sql`, `159_wpqr_stud_fields.sql`

## Cosa NON toccare

Qualsiasi file `backend/src/**` (quindi **nessuna** modifica a `backend/scripts/deploy-manifest.json`: i runner sono in `backend/scripts/`, vengono copiati via SCP in `/tmp` sul VPS e **non** sono caricati dal backend né elencati nel manifest — verificato: `deploy-manifest.json` non contiene alcun `run-migration-*`, e la regola «aggiorna il manifest» di `sgq-operating-memory.mdc`/`sgq-sysadmin.mdc` vale solo per `.js` nuovi in `backend/src/`), `app/**`, i runner esistenti (`run-migration-1*-vps.js`) e i loro test, `reprocessableFields.js`, migrazioni esistenti (nessuna modifica a colonne già presenti: `preheat_temp`, `interpass_temp`, `current_type`, `metal_transfer`, `heat_input_note`, `*_result`, `thickness_*`, …), `database/migrations/ci/**`, `PLAN_*`, GUIDA, `PROJECT_ROADMAP.md`, `PROJECT_CONTEXT.md`.

## Cosa fare

1. `git fetch origin main`; leggere l'ultimo `NNN` e dichiararlo. Copiare i template additivi (≥ 169): intestazione `-- TYPE: additive`, `-- BACKFILL: none`, `-- VERIFY: <NNN>_verify.sql`, `-- ROLLBACK: <NNN>_rollback.sql`.
2. **Idempotente**: `COL_LENGTH`/`OBJECT_ID` prima di ogni `ALTER`/`CREATE`; se `dbo.wpqr_records` **non esiste** (CI su DB vuoto) → `PRINT` e no-op, come la 169.
3. `CREATE TABLE dbo.wpqr_test_runs` con le colonne del piano § 2.2 (tutte nullable tranne `id`, `organization_id`, `wpqr_id`, `created_at`); unità esplicite (`wire_feed_unit`, `travel_speed_unit`); indice `(organization_id, wpqr_id)`.
4. **FK `wpqr_id → wpqr_records(id)` in uno statement separato**, **senza** `ON DELETE CASCADE`.
5. `ALTER TABLE wpqr_records ADD …` per le colonne di testata (una per statement `IF COL_LENGTH … IS NULL`), tutte `NULL`, senza default che riscriva righe.
6. `<NNN>_verify.sql`: controlla presenza tabella, colonne, indice e FK; esito leggibile.
6b. D9: `<NNN+1>_wps_wpqr_links.sql` (`OBJECT_ID` prima di `CREATE`; no-op se `welding_procedures` o `wpqr_records` mancano; unique, indice, FK separate senza CASCADE) + `<NNN+1>_verify.sql` (tabella, colonne, unique, indice, FK) + `<NNN+1>_rollback.sql` (solo FK, indice, tabella creati).
6c. **Runner VPS (nuovi file, uno per migrazione)**: `run-migration-<NNN>-vps.js` e `run-migration-<NNN+1>-vps.js`. Ciascuno: `SGQ_MIGRATION_TARGET=test|prod` **obbligatoria** (nessun default, exit 1 se manca), guard DB-per-target, `CHECK_ONLY=1` = nessun DDL (elenca oggetti/colonne mancanti), `.env`/`.env.test` per target, esecuzione del `.sql` (split `GO` come in 169) e poi del proprio `<N>_verify.sql` con esito `PASS`/`FAIL`; header JSDoc con i comandi `scp -P 1122 …` + `ssh` come in 169. Export per il test L1. **Scrittura dei runner = lavoro del deputy WV-3; l'apply non lo è.**
7. `<NNN>_rollback.sql`: rimuove **solo** FK, indice, tabella e colonne create da questa migrazione, nell'ordine corretto; idempotente.
8. `DATABASE.md`: allineare «Ultimo `NNN`» (stantio: 168) e «Prossimo libero», documentare tabella e colonne.
9. **Non applicare in PROD né su TEST dal Cloud** (SQL Server non raggiungibile; applicazione via SCP + `run-migration-<N>-vps.js` = HITL: **sì esplicito del committente**, prima `SGQ_MIGRATION_TARGET=test CHECK_ONLY=1`, poi apply su TEST, mai PROD senza un secondo «sì» dedicato). Nessun runner viene eseguito dal deputy. Nel body PR: «cosa serve per applicarla» e conteggi attesi dal `verify`.

## Test L1

Comandi: CI «Apply da 169 su SQL Server vuoto» (job esistente: la migrazione deve essere **verde su DB vuoto**, no-op per tabella assente) · `node backend/scripts/check-utf8-encoding.js` · `node backend/scripts/check-harness-boot.js`.

- Lettura statica: nessun `DROP`/`ALTER COLUMN`/`UPDATE`/`DELETE` su oggetti preesistenti; nessun `ON DELETE CASCADE`; FK in statement separato.
- Se è disponibile uno script locale di verifica delle intestazioni migrazione (gate «intestazione + companion» di `DATABASE.md`), eseguirlo e allegare l'esito.

## DoD

- [ ] `<NNN>_wpqr_test_data.sql` additiva, idempotente, no-op su tabella assente; FK separata, nessun CASCADE
- [ ] Per **ciascuna** delle due migrazioni: `.sql` + `<N>_verify.sql` + `<N>_rollback.sql` + `backend/scripts/run-migration-<N>-vps.js` presenti e coerenti (4 file per migrazione; runner con target obbligatorio e `CHECK_ONLY`, come 158/159) e test L1 dei runner verde (`cd backend && npx jest scripts/runMigration<NNN>_<NNN+1>`); nessun runner eseguito
- [ ] `<NNN>_verify.sql` e `<NNN>_rollback.sql` presenti e coerenti; intestazione conforme (`-- TYPE/-- BACKFILL/-- VERIFY/-- ROLLBACK`)
- [ ] Nessuna colonna esistente alterata; nessun dato riscritto
- [ ] D9: `<NNN+1>_wps_wpqr_links.sql` additiva (unique `(wps_id, wpqr_id)`, `organization_id`, FK separate, no CASCADE) con verify/rollback propri; nessun backfill; nessun link creato sulle WPS legacy
- [ ] `DATABASE.md` allineato (ultimo `NNN`, tabella, colonne)
- [ ] CI migrazioni verde; `check-utf8-encoding.js` verde; **nessun file `backend/src`/`app` nel diff**; `deploy-manifest.json` **non** modificato (i runner non sono in `backend/src/`)
- [ ] Body PR: numeri dichiarati, cosa serve per applicare (comandi `scp` + `SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node /tmp/run-migration-<N>-vps.js`), esito atteso del verify; **migrazioni non applicate né su TEST né in PROD**
- [ ] Branch allineato a `origin/main` (`git fetch origin main && git merge origin/main`) **e** numeri NNN/NNN+1 ricontrollati (se un'altra PR ha preso 170 → rinumerare prima di push/PR); `bugbot run` **una sola volta** a slice chiusa

## HITL

**Applicazione in PROD/TEST delle migrazioni (esecuzione dei runner `run-migration-<N>-vps.js` via SCP + SSH): sì esplicito del committente** (mai autonoma, mai dal Cloud). Se serve toccare colonne esistenti → **stop**, handoff nel brief, livello Alto.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_WPQR_DATI.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto)_
