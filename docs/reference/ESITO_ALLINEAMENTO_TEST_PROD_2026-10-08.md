# Esito allineamento schema TEST ↔ PROD (08/10/2026)

Via libera esplicito del committente (2026-10-08 07:22 Rome): «TEST va allineato a PROD». Perimetro: **solo TEST** (`2026-06-18_SGQ_ISO9001`, backend `/var/www/sgq-backend-test`). PROD **solo lettura** (`SELECT` su `sys.*`). Nessun deploy, nessun restart. Seguito di [`PIANO_ALLINEAMENTO_SCHEMA_TEST_2026-10-07.md`](PIANO_ALLINEAMENTO_SCHEMA_TEST_2026-10-07.md) (batch A, B1, B2, C già eseguiti il 07/10).

Migrazioni e allowlist: PR [#751](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/751) (draft, `database/migrations/**`: nessun automerge, consenso esplicito del committente).

## 1. Backup (COPY_ONLY + CHECKSUM + `RESTORE VERIFYONLY` + controllo `msdb`)

Tutti in `/var/opt/mssql/data/` sul VPS, 973 202 944 byte, `is_copy_only=1`, `has_backup_checksums=1`, `is_damaged=0`. **Mantenuti.**

| File | sha256 |
|---|---|
| `TEST_pre_inputs_20261008.bak` (prima di 171/170/120/144) | `10359998818e2a1a4c0b92e1d1f1bdd5dd83ba776042c394c3407efc45a33d0b` |
| `TEST_pre_167_20261008.bak` (prima di 172) | `61118bc3de4c86318c8b2e3e460311200f6a56dee4c442575c29bb7fea6a0c59` |
| `TEST_pre_batchA_20261007.bak` | `5faecc85542ed6071cff43d240a07be1e8b889b554538d5548d207bf000917ef` |
| `TEST_pre_batchB1_20261007.bak` | `3e90ec31c82a37fdbbd27257370a9aa27774f58d0426ac89e930f00ff8b864d2` |
| `TEST_pre_batchB2_20261007.bak` | `6e47d39ec65bd0843c974a1b3ed15e939f3f60430b12b56e359efedb5d436ad2` |
| `TEST_pre_batchC_20261007.bak` | `95896be3c0666fa120a91cac47a7a72137d99d4fe64be252186ed6e40b037af1` |

## 2. Migrazioni applicate su TEST (runner solo-TEST dal branch della PR #751, `check` poi `apply`)

| N. | File | sha256 `.sql` | check | apply | Oggetti verificati |
|---|---|---|---|---|---|
| 171 | `171_management_reviews_input_columns.sql` (nuova) | `db3cfb3d3b37b7aabb91fc895860c8591dc13f996f3f8270e319b5a535081eb4` | EXIT 0 | EXIT 0 | 4/4 colonne |
| 170 | `170_attachments_ndt_item_index.sql` | `66a4df13beabbfca01c2c39e1808eb6453c1da96cdbe71d1fe41063106e89b2b` | EXIT 0 | EXIT 0 | 1/1 indice |
| 120 | `120_ingest_reference_patterns.sql` | `176d47c2330483766d3bb447afd3c01ae40c9e481ba4d7b913af6145586d2f59` | EXIT 0 | EXIT 0 | 2/2 |
| 144 | `144_auditor_orgs_email_unique.sql` | `0ccdd9fd0bbd15526181858942328e347aba9647c0da4fa8f1129f630705ee9a` | EXIT 0 | EXIT 0 | 1/1 indice (prima: 0 gruppi di email duplicate su TEST) |
| 172 | `172_ai_assistant_tables_align_prod.sql` (nuova) | `48ca1afc58c1d6e58ab9d54366d9a496755d139328b81fe60c4f4e7f2d7d6f64` | EXIT 0 | EXIT 0 | 6/6 |

Runner `run-migrations-test-only.js`: sha256 `28eb9875ee9a6357141415f20cb284ca8a983ece62d7e5445e4b1d4f5b47ffcd` (171, 170, 120, 144) e `b52ac6ef05954af9303d9683a72be60496da4a25b987336109b33551447453c0` (172, con la 172 in allowlist). `mergeDbEnv.js`: `410da8f76e34109ac03601f68fc7b7cdc37ed6f1a5bc211df10525b4454fbe85`. Allowlist: nuovo batch `D` (120, 144, 170, 171, 172); la 167 **resta fuori**.

### Differenze 167 (repo) ↔ PR #739 ↔ PROD

- **167 del repo:** crea `FK_ai_assistant_usage_org` → `organizations(id)`, `FK_ai_assistant_usage_user` → `users(id)`, `FK_ai_assistant_notif_org` → `organizations(id)`, tutte `ON DELETE CASCADE` e su colonne inesistenti (le PK sono `organization_id` / `user_id`).
- **PR #739:** solo documento di revisione, nessun `.sql`. Propone una 170 con FK senza CASCADE anche su `ai_assistant_usage`: diversa da PROD. Non toccata.
- **PROD (reale):** `ai_assistant_usage` senza alcuna FK; `ai_assistant_notifications` con `FK_ai_assistant_notif_org` → `organizations(organization_id)`, **`ON DELETE CASCADE`**, `ON UPDATE NO_ACTION`, trusted. 0 righe in entrambe.
- **172:** replica PROD identico (colonne, PK, default, `UQ_ai_assistant_notif_org_std_date`, `IX_ai_assistant_usage_org_date`, `IX_ai_assistant_notif_org_std_date`, la sola FK con CASCADE). No-op senza `dbo.organizations`.

### Nota su CASCADE in 167/172

Il CASCADE su `FK_ai_assistant_notif_org` è replicato perché è lo stato reale di PROD ed è **decisione esplicita del committente** (2026-10-08), in deroga alla regola generale «niente CASCADE». Non è stato modificato né corretto. La tabella contiene solo throttling notifiche (dato rigenerabile).

## 3. Verifiche

- **Schema:** tipi, nullable, default, collation, indici (filtri e colonne in chiave), FK (azioni, trusted) identici a PROD per le 4 colonne `input_*`, `IX_attachments_ndt_item`, `ingest_reference_patterns`, `UX_auditor_orgs_email`, le due tabelle `ai_assistant_*`. Differiscono solo i nomi auto-generati `PK__…` (hash).
- **Smoke test-api** (`/test-api/api/v1`, `DISABLE_EMAIL=1`): `POST /management-reviews` con i 4 campi 201, `PUT` 200 (valori persistiti, verificati in SQL), `POST /management-reviews/:id/generate-outputs` 200 (`ai_used=false`, fallback deterministico: il provider AI ha risposto in errore, nessun costo), `DELETE` 200; record `ZZ_SMOKE_` rimossi con `DELETE` SQL (residui 0). Regressione `GET` 200: `/non-conformities`, `/attachments`, `/ndt-reports`, `/welding/wpqr`, `/qualifications/stats`, `/auditor-orgs`, `/management-reviews`.
- **172:** `POST /question-assistant` **non** chiamato (costo AI reale e inserimento in `alerts`). Verifica funzionale in transazione con `ROLLBACK`: INSERT in entrambe le tabelle riuscito, secondo INSERT duplicato rifiutato da `UQ_ai_assistant_notif_org_std_date`, tabelle a 0 righe dopo il rollback.
- **Journal** `sgq-backend-test` dal pre-check: 0 occorrenze di «Invalid column name» / «Invalid object name» (solo il WARN atteso del fallback AI).
- **Conteggi** invariati: `non_conformities` 22, `attachments` 235, `ndt_reports` 1; `management_reviews` 1 (come prima).

## 4. Numeri prima → dopo (confronto completo `SELECT`-only, 127 tabelle in entrambi)

| Oggetto | 07/10 mattina (prima dei batch) | Dopo batch A+B1+B2+C | **Ora** |
|---|---|---|---|
| Tabelle TEST→PROD | 116→127 | 124→127 | **127→127** |
| Colonne | 1615→1805 | 1781→1805 | **1805→1805** |
| Indici/PK/UNIQUE | 406→444 | 434→444 | **444→444** |
| FK | 201→218 | 217→218 | **218→218** |
| CHECK | 91→97 | 97→97 | **97→97** |
| Solo PROD (tabelle / colonne / indici / FK / CHECK) | 11 / 190 / 39 / 17 / 6 | 3 / 24 / 10 / 1 / 0 | **0 / 0 / 0 / 0 / 0** |
| Solo TEST | 0 | 0 | **0** |
| Oggetti «diversi» | vari | 0 | **0** |
| Trigger / viste / SP / funzioni | uguali | uguali | **uguali** (6 / 12) |

**Residuo HIGH: 0. MEDIUM: 0.** Artefatti (dump JSON, script, CSV) nella cartella artefatti dell'agente.

### Residuo LOW / fuori perimetro

- **Nomi auto-generati** (`PK__<tab>__<hash>`, `DF__…`): 22 indici/PK con hash diverso tra TEST e PROD, ignorati dal confronto (funzionalmente equivalenti).
- **Ordine fisico delle colonne** (`column_id`) diverso in 6 tabelle (`attachments`, `companies`, `management_reviews`, `ndt_reports`, `qualifications`, `risks`; 34 colonne): effetto delle `ADD` in ordine diverso da PROD. Nessun impatto (le query usano nomi di colonna). Non correggibile senza ricreare le tabelle.
- **Dati:** TEST contiene dati di prova, PROD dati reali: i conteggi riga differiscono (atteso, non oggetto di allineamento).
- **`not_trusted`:** identico in TEST e PROD (`CK_nc_source_category`, `CK_ris_status`, `CK_rish_status`, `CK_doc_registry_content_scope`, `FK_nc_management_review`).
- **Tabelle PROD senza `CREATE TABLE` nel repo** (baseline non versionata, 19 tabelle) e indici attesi ma assenti in entrambi i DB (`IX_norm_req_standard`, `IX_equipment_assets_calibration`): invariati, fuori perimetro.

## 5. Decisioni aperte

1. **PR #751** (171, 172, allowlist): serve il consenso esplicito del committente al merge (`database/migrations/**`). Nessuna azione su PROD è stata eseguita: PROD ha già questo schema.
2. **PR #739** (revisione 167): contiene una proposta (170 senza CASCADE, FK su `ai_assistant_usage`) che **diverge da PROD** e dalla decisione del 08/10 di replicare PROD. Il committente decide se chiuderla o riscriverla.
3. **Numerazione:** la proposta «170» della PR #739 collide con la 170 già su `main` (`IX_attachments_ndt_item`).
4. **CASCADE** su `FK_ai_assistant_notif_org`: replicato come in PROD per decisione del committente; eventuale rimozione (anche su PROD) resta una scelta separata.
