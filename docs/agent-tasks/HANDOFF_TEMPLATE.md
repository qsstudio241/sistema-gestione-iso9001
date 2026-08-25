# Handoff sessione (template)

> Compilare **nel `DEPUTYTASK*.md` attivo** se la slice non è chiusa. La sessione successiva parte **da qui**, non dalla GUIDA intera.
> **Non** creare `SESSION_NOTES_*` né un secondo `CONTEXT.md`.

```markdown
## Handoff (sessione interrotta)

- **Obiettivo**:
- **Stato**: INTERROTTA | BLOCCATA | PRONTA-PR
- **Fatto** (file + commit):
- **Manca** (un solo prossimo passo):
- **Non toccare**:
- **Test**: L1 … / smoke … / non eseguiti perché …
- **Rischi / Bugbot**:
- **Brief**: `docs/agent-tasks/DEPUTYTASK.md`
- **Branch / PR**:
- **Lezione GUIDA** (bozza da copiare dopo merge se c'era parallelo):
- **Roadmap** (1 riga «sessione più recente», stessa regola):
```

---

## Richiesta norma al committente (copia-incolla)

> Usare quando una slice **norm-touching** non ha Markdown/PDF sufficiente. Aggiornare anche [`docs/reference/NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md).

```markdown
## Richiesta norma (HITL)

- **Codice / titolo**: (es. ISO 9712:2022, Quaderno LG 1090)
- **Edizione desiderata**:
- **Serve a** (modulo / slice):
- **Cosa c’è già in repo**: (path MD/estratto oppure «assente»)
- **Cosa NON inventiamo senza PDF**: (soglie, clausole, range)
- **Perimetro su cui si parte comunque**: (slice coperta dalle fonti presenti)
- **Formato utile**: PDF (preferito) → digitalizzazione con skill `pdf-to-json`
- **Dopo digitalizzazione**: aggiornare backlog → seed `norm_requirements` + VPS se norma SGQ a clausole
```
