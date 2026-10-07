# DEPUTYTASK_VERIFICA_WPQR_DATI — WV-3: migrazione additiva per i dati di prova WPQR (`wpqr_test_runs` + colonne di testata) + verify/rollback + `DATABASE.md`

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

**Decisione D9 (chiave esplicita WPS→WPQR) aperta:** questo brief **non** include alcuna tabella di legame né colonna WPS↔WPQR finché il committente non risolve D9 (piano § 9). Se D9 viene approvata prima del lancio, il Lead aggiorna questo brief (file previsti e DoD) su `origin/main`; il deputy **non** la anticipa.

**Numero di migrazione:** il piano **non lo riserva**. Dopo `git fetch origin main`, il deputy legge l'ultimo `NNN_*.sql` in `database/migrations/` (al momento del charting: **169**, quindi prossimo **170**; `DATABASE.md` è stantio e dice 168/169) e dichiara `NNN` nel body PR. Companion `NNN_verify.sql` e `NNN_rollback.sql` (policy ≥ 169).

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
- *Modificato* `docs/reference/DATABASE.md` (righe «Ultimo `NNN`» / «Prossimo libero», tabella `wpqr_test_runs`, colonne aggiunte a `wpqr_records`)
- Solo lettura/riuso: `database/migrations/_TEMPLATE_additive.sql`, `_TEMPLATE_NNN_verify.sql`, `_TEMPLATE_NNN_rollback.sql`, `169_wpqr_drop_expiry_date.sql` (+ `169_verify.sql`, `169_rollback.sql`: schema «tabella assente → no-op»), `089_welding_procedures_full.sql`, `133_wpqr_coverage_fields.sql`, `159_wpqr_stud_fields.sql`

## Cosa NON toccare

Qualsiasi file `backend/src/**`, `app/**`, `reprocessableFields.js`, migrazioni esistenti (nessuna modifica a colonne già presenti: `preheat_temp`, `interpass_temp`, `current_type`, `metal_transfer`, `heat_input_note`, `*_result`, `thickness_*`, …), `database/migrations/ci/**`, `PLAN_*`, GUIDA, `PROJECT_ROADMAP.md`, `PROJECT_CONTEXT.md`.

## Cosa fare

1. `git fetch origin main`; leggere l'ultimo `NNN` e dichiararlo. Copiare i template additivi (≥ 169): intestazione `-- TYPE: additive`, `-- BACKFILL: none`, `-- VERIFY: <NNN>_verify.sql`, `-- ROLLBACK: <NNN>_rollback.sql`.
2. **Idempotente**: `COL_LENGTH`/`OBJECT_ID` prima di ogni `ALTER`/`CREATE`; se `dbo.wpqr_records` **non esiste** (CI su DB vuoto) → `PRINT` e no-op, come la 169.
3. `CREATE TABLE dbo.wpqr_test_runs` con le colonne del piano § 2.2 (tutte nullable tranne `id`, `organization_id`, `wpqr_id`, `created_at`); unità esplicite (`wire_feed_unit`, `travel_speed_unit`); indice `(organization_id, wpqr_id)`.
4. **FK `wpqr_id → wpqr_records(id)` in uno statement separato**, **senza** `ON DELETE CASCADE`.
5. `ALTER TABLE wpqr_records ADD …` per le colonne di testata (una per statement `IF COL_LENGTH … IS NULL`), tutte `NULL`, senza default che riscriva righe.
6. `<NNN>_verify.sql`: controlla presenza tabella, colonne, indice e FK; esito leggibile.
7. `<NNN>_rollback.sql`: rimuove **solo** FK, indice, tabella e colonne create da questa migrazione, nell'ordine corretto; idempotente.
8. `DATABASE.md`: allineare «Ultimo `NNN`» (stantio: 168) e «Prossimo libero», documentare tabella e colonne.
9. **Non applicare in PROD né su TEST dal Cloud** (SQL Server non raggiungibile; applicazione via SCP + `run-migration-*-vps.js` = HITL). Nel body PR: «cosa serve per applicarla» e conteggi attesi dal `verify`.

## Test L1

Comandi: CI «Apply da 169 su SQL Server vuoto» (job esistente: la migrazione deve essere **verde su DB vuoto**, no-op per tabella assente) · `node backend/scripts/check-utf8-encoding.js` · `node backend/scripts/check-harness-boot.js`.

- Lettura statica: nessun `DROP`/`ALTER COLUMN`/`UPDATE`/`DELETE` su oggetti preesistenti; nessun `ON DELETE CASCADE`; FK in statement separato.
- Se è disponibile uno script locale di verifica delle intestazioni migrazione (gate «intestazione + companion» di `DATABASE.md`), eseguirlo e allegare l'esito.

## DoD

- [ ] `<NNN>_wpqr_test_data.sql` additiva, idempotente, no-op su tabella assente; FK separata, nessun CASCADE
- [ ] `<NNN>_verify.sql` e `<NNN>_rollback.sql` presenti e coerenti; intestazione conforme (`-- TYPE/-- BACKFILL/-- VERIFY/-- ROLLBACK`)
- [ ] Nessuna colonna esistente alterata; nessun dato riscritto; nessun oggetto legato a D9 (WPS↔WPQR) finché D9 è aperta
- [ ] `DATABASE.md` allineato (ultimo `NNN`, tabella, colonne)
- [ ] CI migrazioni verde; `check-utf8-encoding.js` verde; **nessun file `backend/src`/`app` nel diff**
- [ ] Body PR: numero dichiarato, cosa serve per applicare, esito atteso del verify; **migrazione non applicata in PROD**
- [ ] Branch allineato a `origin/main` (`git fetch origin main && git merge origin/main`) **e** numero NNN ricontrollato (se un'altra PR ha preso 170 → rinumerare prima di push/PR); `bugbot run` **una sola volta** a slice chiusa

## HITL

**Applicazione in PROD/TEST della migrazione: sì esplicito del committente** (mai autonoma). Se serve toccare colonne esistenti → **stop**, handoff nel brief, livello Alto.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_WPQR_DATI.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto)_
