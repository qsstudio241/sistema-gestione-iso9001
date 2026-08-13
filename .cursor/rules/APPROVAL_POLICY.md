# Policy di approvazione PR — `.cursor/rules/` (Basso rischio operativo, alto impatto di governance)

> Le regole agente cambiano il comportamento futuro di ogni deputy/lead. Nessun impatto diretto su
> dati o produzione, ma un impatto di governance non banale — trattare con più cautela di un normale
> file "Basso".

## Approvazione automatica

Consentita solo se:

- Bugbot Review Context senza rilievi critici.
- CI verde.
- Diff limitato a `.cursor/rules/**` o `AGENTS.md`.
- La modifica **aggiunge o chiarisce** un vincolo, non lo rimuove né lo allenta.

## Sempre solo Request Reviewers (mai approvazione automatica)

Se il diff tocca [`sgq-git-autonomy.mdc`](sgq-git-autonomy.mdc) o la sezione *Allineamento Git
autonomo* di [`sgq-operating-memory.mdc`](sgq-operating-memory.mdc): un classificatore automatico non
ha modo affidabile di distinguere "rafforza una regola di sicurezza" da "la allenta" — trattare sempre
come richiede review umana.
