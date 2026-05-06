# Task per delega (Cursor desktop ↔ web)

## Scopo

Allineare **due o più sessioni** (lead + uno o più deputy) **senza** un canale diretto tra agenti: la **fonte di verità** è **GitHub** (file nel repo + branch + PR).

---

## Convenzione multi-deputy (attiva da 06/05/2026)

Ogni task ha il **proprio file** per consentire l'esecuzione parallela:

```
docs/agent-tasks/
  DEPUTYTASK_[ID]_[nome-breve].md   ← un file per task deputy
  DEPUTYTASK.md                     ← legacy / task singolo attivo
```

### Sezioni obbligatorie in ogni brief deputy

```markdown
## Modello consigliato
[categoria] — [motivo in una riga]

## File toccati
[elenco esplicito — il lead verifica che due brief paralleli non condividano file]

## Chiusura attesa
TEST OK | FIX NON APPLICABILI — [motivo]
```

### Griglia modelli consigliati

| Categoria | Quando | Modello in Cursor |
|-----------|--------|-------------------|
| **Meccanico** | Rename, aggiunta campi, CSS, cerca/sostituisci su file noti | Veloce (es. Haiku / Flash) |
| **Standard** | Nuovo componente su pattern esistente, test L1, piccola API REST | Bilanciato (es. Sonnet) |
| **Complesso** | Nuova architettura, sync, migrazione DB con edge case | Potente (es. Sonnet Max / Opus) |
| **Debug** | Causa radice non ovvia, riproduzione bug, ipotesi iterative | Potente (es. Sonnet Max / Opus) |

> Il lead non può impostare il modello per i deputy lanciati dall'utente — indica la categoria nel brief e l'utente sceglie il modello corrispondente nell'UI Cursor.

### Verifica indipendenza prima di lanciare in parallelo

Due task sono parallelizzabili solo se i rispettivi `## File toccati` **non si sovrappongono**. Il lead verifica questo prima di preparare i brief.

---

## Come usarlo

1. **Lead prepara il brief**: crea `docs/agent-tasks/DEPUTYTASK_[ID]_[nome].md` con obiettivo, vincoli, modello consigliato, criteri di completamento e branch suggerito.
2. **Committente lancia il deputy** nella finestra Agents di Cursor (selezionare il modello suggerito):
   `Leggi docs/agent-tasks/DEPUTYTASK_[ID]_[nome].md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`
3. **Restituzione risultati**: commit sul branch indicato + **PR verso `main`** (mai push forzato su `main` senza review).
4. **Verifica**: tab **Checks** sulla PR — workflow `.github/workflows/ci-app-pr.yml` (test + build `app/`).

---

## Stabilità del progetto

- Non introdurre segreti nel repo.
- Preferire **PR** per modifiche non banali; merge su `main` solo con CI verde (o rischio documentato).
- Backend/VPS: deploy separato; l'agente web non sostituisce operazioni che richiedono credenziali server.

## Checklist rapida deputy

- Per la revisione rapida del lavoro delegato: `docs/agent-tasks/MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md`.
- Per anomalie report cliente Mason (export Word): `docs/agent-tasks/TASK_MASON_REPORT_ANOMALIE_2026-04-20.md`.
- Per audit non visibile in menu Mason (`2026-04`): `docs/agent-tasks/TASK_MASON_AUDIT_2026-04_VISIBILITY_2026-04-20.md`.
