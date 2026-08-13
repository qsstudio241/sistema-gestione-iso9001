# Policy di approvazione PR — `docs/` (Basso rischio)

> Vedi [`sgq-git-autonomy.mdc`](../.cursor/rules/sgq-git-autonomy.mdc) § Livelli di rischio —
> `docs/**/*.md` è classificato Basso per definizione.

## Approvazione automatica

Consentita se:

- Bugbot Review Context senza rilievi critici.
- CI verde (o non applicabile a un cambio solo documentale).
- Nessun file fuori da `docs/**` nello stesso diff.

## Eccezione — solo Request Reviewers, mai approvazione automatica

- `docs/adr/**` (decisioni architetturali: impatto su scelte vincolanti future).
- `docs/specs/**` quando il contenuto descrive logica normativa (es. requisiti ISO 3834/15614/9606,
  criteri di copertura WPS/WPQR): guida implementazioni normative, non è semplice documentazione.
- `docs/agent-tasks/DEPUTYTASK*.md` quando cambia lo **Stato** di un task da CHIUSO ad APERTO o
  viceversa in modo non ovvio (rischio di deputy che eseguono un brief non autorizzato).
