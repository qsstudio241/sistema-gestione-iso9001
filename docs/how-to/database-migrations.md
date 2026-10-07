# Database — migrazioni e repro

> Hub per modifiche schema e script SQL. **Schema completo:** [reference/DATABASE_SCHEMA.md](../reference/DATABASE_SCHEMA.md).
> Stato sequenza e apply-on-empty: [DATABASE.md](../reference/DATABASE.md) § Migration history.
> Policy PR: [`database/migrations/APPROVAL_POLICY.md`](../../database/migrations/APPROVAL_POLICY.md).

---

## Prima di modificare il DB

1. Leggere [DATABASE_SCHEMA.md](../reference/DATABASE_SCHEMA.md).
2. Connessione e ambienti: [DATABASE.md](../reference/DATABASE.md).
3. Piano split tenant (se multi-org): [MIGRATION_PLAN_SPLIT_TENANTS.md](../MIGRATION_PLAN_SPLIT_TENANTS.md).
4. Prossimo numero: `ls database/migrations/ | sort | tail -8` **su `origin/main`**, poi le PR aperte. Da **169** l'intestazione è obbligatoria.

---

## Contratto file (da 169)

Ogni nuova migrazione principale deve iniziare con:

```
-- TYPE: additive|transform|destructive
-- BACKFILL: none|SQL|Rielaborazioni
-- VERIFY: ...
-- ROLLBACK: ...
```

| TYPE | Cosa serve |
|---|---|
| `additive` | Solo schema (colonna/tabella nuova). VERIFY/ROLLBACK possono essere `n/a`. |
| `transform` / `destructive` | `NNN_verify.sql` + `NNN_rollback.sql`. Colonne vecchie **restano** fino a una cleanup successiva. |

Template in `database/migrations/_TEMPLATE_*.sql`. Gate L1: `backend/scripts/migrationHeaderContract.test.js`.

`NNN_verify.sql` deve restituire una riga con `esito` = `PASS` o `FAIL` e conteggi (righe prima/dopo, orfani, NULL attesi, FK).

---

## Procedura pre-VPS (obbligatoria se si toccano dati esistenti)

Da fare **prima** di produzione. Riportare l'esito nella PR (checklist «Migrazione / dati esistenti»).

1. **Backup** del DB di destinazione (prima TEST, poi PROD). Sul VPS, snapshot/backup SQL Server del database (`SGQ_ISO9001` o `2026-06-18_SGQ_ISO9001`). In locale, `node backend/scripts/backup-db.js` esporta JSON delle tabelle critiche — utile come evidenza, non sostituisce il backup SQL.
2. **Prova su copia**: applicare la SQL sul DB TEST (o su un restore del backup). Cloud Agent: nessun run VPS in questa governance senza richiesta esplicita.
3. **Annotare i conteggi prima** (righe delle tabelle toccate, orfani, NULL, FK `is_not_trusted`).
4. **Eseguire** `NNN_verify.sql` dopo la migrazione. Deve uscire `esito = PASS` e i numeri devono tornare con il prima.
5. **Solo allora** produzione, stessa SQL, stessi verify. Tenere a portata `NNN_rollback.sql`.
6. Incollare in PR la tabella prima/dopo del template.

---

## Esecuzione migrazioni

| Ambiente | Pattern |
|----------|---------|
| **PC sviluppo** | `backend/config/database.json` (gitignored) + script in `database/migrations/` |
| **Cloud Agent** | Script Node su VPS con `require('/var/www/sgq-backend/src/config/database')` — vedi [GUIDA_CONSOLIDATA § C](../GUIDA_CONSOLIDATA.md#c-database-e-repro) — **non** in questa slice di governance |
| **169 (VPS)** | `backend/scripts/run-migration-169-vps.js` sul server dopo scp (pattern 168). `SGQ_MIGRATION_TARGET=test\|prod` (default prod); `CHECK_ONLY=1` = pre-count senza DROP. Poi `169_verify.sql` con `esito=PASS`. |
| **158 / 159 (VPS)** | `run-migration-158-vps.js` / `run-migration-159-vps.js`: `SGQ_MIGRATION_TARGET=test\|prod` **obbligatoria** (nessun default, exit 1 se manca); `CHECK_ONLY=1` = solo INFORMATION_SCHEMA, elenca le colonne mancanti, nessun DDL. Esempio: `SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node /tmp/run-migration-158-vps.js`. |
| **CI** | `.github/workflows/ci-migrations.yml` — contratto L1 required; apply-on-empty applica **da 169** (pre-169 saltato, verde se solo quel gap) |

**FK SQL Server:** evitare `ON DELETE` su ADD CONSTRAINT in un unico statement; colonne e FK in step separati (regola in guida).

---

## Runner solo-TEST (`run-migrations-test-only.js`)

Applica i `.sql` dell'allowlist (piano [PIANO_ALLINEAMENTO_SCHEMA_TEST](../reference/PIANO_ALLINEAMENTO_SCHEMA_TEST_2026-10-07.md): 110…108) **solo** sul DB TEST `2026-06-18_SGQ_ISO9001`, con driver `mssql` (non `sqlcmd`): un errore SQL ferma tutto, mai «successo» con errori. Il target è hardcoded, non esiste un flag `prod`.

```bash
node backend/scripts/run-migrations-test-only.js --mode=check --migrations=110,124,145 [--file-dir=<dir>]
SGQ_CONFIRM_TEST_APPLY=2026-06-18_SGQ_ISO9001 node backend/scripts/run-migrations-test-only.js --mode=apply --migrations=110,124,145 [--file-dir=<dir>]
```

- `--mode` obbligatorio. `check` = `SET PARSEONLY ON` batch per batch + SELECT su `INFORMATION_SCHEMA`/`sys.*` (elenca oggetti mancanti, nessun DDL/DML). `apply` = un batch `GO` alla volta in transazione, poi verifica degli oggetti attesi.
- Variabili: `SGQ_MIGRATION_TARGET` (se impostata deve essere `test`); `SGQ_CONFIRM_TEST_APPLY` uguale al DB atteso (doppia conferma, obbligatoria per `apply`). Connessione da `backend/config/database.json` sezione `test`.
- Come evita PROD: config `test` ≠ `production` e database esatto; `DB_NAME()` esatto prima di ogni batch; `USE SGQ_ISO9001` rimosso con log, qualsiasi altro `USE` o nome a 3 parti verso `SGQ_ISO9001` blocca; allowlist (numeri fuori lista rifiutati). 112 e 113 hanno `.sql` in `database/migrations/` (DDL dai runner; già applicati su TEST 2026-10-07 — nessun apply dalla PR di versionamento).
- `--file-dir`: cartella con i `.sql` estratti da `origin/main` (non la cartella stale del VPS); il log riporta lo sha256 di ogni file.

---

## Repro e verifica dati

Procedure e query di repro: [GUIDA_CONSOLIDATA § C](../GUIDA_CONSOLIDATA.md#c-database-e-repro).

Mapping tabelle legacy: [DATABASE_MAPPING.md](../reference/DATABASE_MAPPING.md).
