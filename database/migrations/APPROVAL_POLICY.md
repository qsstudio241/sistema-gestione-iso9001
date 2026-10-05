# Policy di approvazione PR — `database/migrations/` (Alto rischio)

> Vedi [`sgq-git-autonomy.mdc`](../../.cursor/rules/sgq-git-autonomy.mdc) § Livelli di rischio — Alto.
> Procedura operativa: [`docs/how-to/database-migrations.md`](../../docs/how-to/database-migrations.md).
> Stato sequenza: [`docs/reference/DATABASE.md`](../../docs/reference/DATABASE.md) § Migration history.

## Regola

**Mai approvazione automatica. Mai instradare come "pronta" solo perché i test file sono verdi.**
Sempre `Request Reviewers` con nota esplicita: "migrazione DB — richiede conferma committente prima del merge".

## Idempotenza (storico e nuove)

Verificare nel commento di routing se la migrazione è idempotente (`IF NOT EXISTS` / controllo
esistenza colonna/tabella prima di `ALTER`/`CREATE`) — segnalarlo se manca, non bloccare da solo.

## Intestazione obbligatoria (da 169)

Ogni **nuova** migrazione principale `NNN_*.sql` con `NNN >= 169` deve aprire con:

```
-- TYPE: additive|transform|destructive
-- BACKFILL: none|SQL|Rielaborazioni
-- VERIFY: ...
-- ROLLBACK: ...
```

Gate L1: `backend/scripts/migrationHeaderContract.test.js` (lo storico `< 169` è grandfathered).
Template: `_TEMPLATE_additive.sql`, `_TEMPLATE_transform.sql`.

## Transform / destructive

Se `TYPE` non è `additive` servono i companion:

- `NNN_verify.sql` — conteggi righe prima/dopo, 0 orfani, 0 NULL attesi, FK intatte, colonna `esito` = `PASS`|`FAIL`
- `NNN_rollback.sql` — come tornare indietro senza inventare un restore da zero

Le colonne **vecchie restano** fino a una migrazione di cleanup successiva. Vietato dropparle nella stessa slice del backfill.

## Prima del VPS (produzione)

Backup → prova su **copia** (DB TEST) → confronto conteggi / `NNN_verify.sql` → solo allora produzione.
Riportare l'esito nella PR (tabella del template `.github/pull_request_template.md`).
Nessun Cloud Agent applica migrazioni su VPS in questa governance senza richiesta esplicita.

## CI

- **Required per i file:** job `Contratto intestazione + numerazione (L1)` in `.github/workflows/ci-migrations.yml`
- **Non-required:** job apply su SQL Server vuoto — lo storico non ha baseline; il fallimento è onesto (script esce 1). Non usarlo come via libera. Issue [#699](https://github.com/qsstudio241/sistema-gestione-iso9001/issues/699).
