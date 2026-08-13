# Policy di approvazione PR — `backend/src/` (Medio/Alto rischio)

> Vedi tabella rischio in [`sgq-git-autonomy.mdc`](../../.cursor/rules/sgq-git-autonomy.mdc).

## Regola

**Mai approvazione automatica.** Sempre `Request Reviewers`.

Bugbot Review Context è **obbligatorio** prima di segnalare una PR come "pronta per review": se Bugbot
non è eseguibile su questa PR, non instradarla come pronta — segnalarlo esplicitamente nel commento di
routing.

## Segnalazione rischio Alto esplicita

Se la PR tocca uno di questi pattern, il commento di routing deve indicare **"livello Alto — richiede
conferma committente prima del merge"**, non solo review tecnica:

- `controllers/auth*`, `middleware/auth*`
- `services/syncService*`
- `services/*AiSuggest*`, `services/wpsGenerator*`, `services/gapAnalysis*`
- `services/moduleLicense*`
- qualsiasi file che tocca `company_access` / scope multi-tenant
