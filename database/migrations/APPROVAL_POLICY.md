# Policy di approvazione PR — `database/migrations/` (Alto rischio)

> Vedi [`sgq-git-autonomy.mdc`](../../.cursor/rules/sgq-git-autonomy.mdc) § Livelli di rischio — Alto.

## Regola

**Mai approvazione automatica. Mai instradare come "pronta".** Sempre `Request Reviewers` con nota
esplicita: "migrazione DB — richiede conferma committente prima del merge".

Verificare sempre nel commento di routing se la migrazione è idempotente (`IF NOT EXISTS` / controllo
esistenza colonna/tabella prima di `ALTER`/`CREATE`) — segnalarlo se manca, non bloccare da solo.
