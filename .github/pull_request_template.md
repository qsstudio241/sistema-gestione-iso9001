## Cosa cambia

<!-- 3–5 righe in italiano semplice: cosa vede o può fare l'utente dopo il merge. -->

## Checklist

### Migrazione / dati esistenti

Compilare **solo** se la PR tocca `database/migrations/` (file `NNN_*.sql` o companion). Altrimenti spuntare «non tocca» e saltare il resto della sezione.

- [ ] **Non tocca** `database/migrations/` — sezione non applicabile
- [ ] Intestazione presente (`-- TYPE`, `-- BACKFILL`, `-- VERIFY`, `-- ROLLBACK`) — obbligatoria da **169**
- [ ] Se `TYPE` è `transform` o `destructive`: allegati `NNN_verify.sql` e `NNN_rollback.sql`
- [ ] Colonne vecchie **non** droppate in questa slice (cleanup solo in una migrazione successiva)
- [ ] Backup + prova su **copia** (DB TEST) eseguiti; conteggi prima/dopo riportati sotto
- [ ] Nessun dato di produzione nel seed CI
- [ ] Nessuna migrazione eseguita sul VPS da questa PR, salvo richiesta esplicita del committente

Procedura: [`docs/how-to/database-migrations.md`](../docs/how-to/database-migrations.md) § Procedura pre-VPS.

### Esito prova su copia (se c'è una migrazione)

| Metrica | Prima | Dopo |
|---|---|---|
| Righe tabelle toccate | | |
| Orfani | | 0 |
| NULL non ammessi | | 0 |
| FK non trusted | | 0 |

Note / file verify eseguito:

## Test

- [ ] L1 eseguiti (Vitest/Jest mirati e/o build)
- [ ] CI `test-and-build` + `smoke` da leggere prima di «Pronta»
