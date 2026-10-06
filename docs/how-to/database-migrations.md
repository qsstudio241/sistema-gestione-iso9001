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
| **CI** | `.github/workflows/ci-migrations.yml` — contratto L1 required; apply-on-empty applica **da 169** (pre-169 saltato, verde se solo quel gap) |

**FK SQL Server:** evitare `ON DELETE` su ADD CONSTRAINT in un unico statement; colonne e FK in step separati (regola in guida).

---

## Repro e verifica dati

Procedure e query di repro: [GUIDA_CONSOLIDATA § C](../GUIDA_CONSOLIDATA.md#c-database-e-repro).

Mapping tabelle legacy: [DATABASE_MAPPING.md](../reference/DATABASE_MAPPING.md).
