# Database — migrazioni e repro

> Hub per modifiche schema e script SQL. **Schema completo:** [reference/DATABASE_SCHEMA.md](../reference/DATABASE_SCHEMA.md).

---

## Prima di modificare il DB

1. Leggere [DATABASE_SCHEMA.md](../reference/DATABASE_SCHEMA.md).
2. Connessione e ambienti: [DATABASE.md](../reference/DATABASE.md).
3. Piano split tenant (se multi-org): [MIGRATION_PLAN_SPLIT_TENANTS.md](../MIGRATION_PLAN_SPLIT_TENANTS.md).

---

## Esecuzione migrazioni

| Ambiente | Pattern |
|----------|---------|
| **PC sviluppo** | `backend/config/database.json` (gitignored) + script in `database/migrations/` |
| **Cloud Agent** | Script Node su VPS con `require('/var/www/sgq-backend/src/config/database')` — vedi [GUIDA_CONSOLIDATA § C](../GUIDA_CONSOLIDATA.md#c-database-e-repro) |

**FK SQL Server:** evitare `ON DELETE` su ADD CONSTRAINT in un unico statement; colonne e FK in step separati (regola in guida).

---

## Repro e verifica dati

Procedure e query di repro: [GUIDA_CONSOLIDATA § C](../GUIDA_CONSOLIDATA.md#c-database-e-repro).

Mapping tabelle legacy: [DATABASE_MAPPING.md](../reference/DATABASE_MAPPING.md).
