---
name: wayfinder-sgq
description: >-
  Pianifica un lavoro più grande di una sessione agente restando nella smart
  zone (~100k token): mappa di decisioni/slice su PLAN_*_SLICES.md e un
  DEPUTYTASK per sessione. Usare quando l'utente chiede wayfinder, piano enorme,
  modulo nuovo, epic, "troppo grande per una chat", smart zone / dumb zone
  (Matt Pocock), o lavori tipo Material Compliance / Personale azienda.
  NON usare per bugfix 1-2 file né per eseguire un DEPUTYTASK già aperto.
---

# Wayfinder SGQ — piano enorme, contesto piccolo

Adattamento ProgettoISO della skill **wayfinder** di Matt Pocock
([mattpocock/skills](https://github.com/mattpocock/skills)).

**Idea**: gli LLM ragionano bene nella **smart zone** (~100–150k token). Oltre
si scivola nella **dumb zone** (dimenticanze, allucinazioni, codice peggiore)
anche se la finestra tecnica è 1M. Un lavoro enorme non entra in una chat:
si spezza in **una decisione o una slice per sessione**, con una mappa condivisa
nel repo.

## Cosa NON fare (vincoli ProgettoISO)

| Vietato | Perché |
|---------|--------|
| Installare il pacchetto intero `mattpocock/skills` | Doppia governance vs [ADR-015](../../../docs/adr/ADR-015-cursor-lead-deputy-workflow.md) |
| Creare GitHub Issues come mappa (`wayfinder:map`) | Brief ufficiale = `docs/agent-tasks/DEPUTYTASK*.md` + `PLAN_*_SLICES.md` |
| Creare un secondo `CONTEXT.md` | Fonte unica: `PROJECT_CONTEXT.md` |
| Grilling di 40–80 domande tecniche al committente | Scelte tecniche autonome; HITL solo prodotto / commerciale / legale / livello Alto |
| Skill GitHub Ponytail / Caveman / Impeccable / Taste / wiki Obsidian | Seconda governance vs DNA visivo + gate Ponytail in `sgq-operating-memory.mdc`; fonte unica = `PROJECT_CONTEXT.md` |
| Implementare l’intera epic nella stessa sessione che disegna la mappa | La sessione di charting **non** esegue le slice |
| Usare context 1M «perché il lavoro è grosso» | Il grosso si spezza; 1M resta eccezione Lead |
| Leggere GUIDA + roadmap **intere** all'avvio di ogni slice | Saturano la smart zone prima del codice. Protocollo: `AGENTS.md` (dieta) + bussola in `PROJECT_CONTEXT.md` |

## Mapping Matt Pocock → artefatti già nostri

| Wayfinder originale | ProgettoISO |
|---------------------|-------------|
| Issue GitHub `wayfinder:map` | `docs/agent-tasks/PLAN_<EPIC>_SLICES.md` + riga in `docs/PROJECT_ROADMAP.md` |
| Ticket figlio (una domanda / una slice) | Riga numerata nel PLAN + brief `DEPUTYTASK.md` (o `DEPUTYTASK1.md`… se parallelo) |
| Una ticket per sessione | Un Cloud Agent / una chat = **una** slice aperta |
| Smart zone ~100k | Deputy: context **default/basso**. Lead: alto solo se serve. Mai 1M di default |
| AFK | Deputy autonomo (codice, test L1, PR) |
| HITL | Conferma committente: prodotto, breaking change, sync/auth/DB distruttivo |
| Fog of war | Sezione **Non ancora specificato** nel PLAN (non pre-spezzare il buio) |
| Out of scope | Sezione **Fuori scope** nel PLAN (come già in Material Compliance) |
| `grill-me` | Solo domande di **prodotto**; il resto si decide da codice + ADR + golden rules |
| `to-tickets` (slice verticali) | Già in `.cursor/rules/sgq-workflow-method.mdc` |

Esempio già conforme: [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](../../../docs/agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md).

## Quando attivare

- Epic / modulo nuovo più grande di una sessione (schema + API + UI + test + deploy).
- «Dobbiamo fare X ma non sappiamo ancora come arriverci».
- Il Lead sta per scrivere un `DEPUTYTASK` che tocca più di ~3 file **e** più di un layer (DB+BE+FE) senza un PLAN.

**Non attivare** se:

- esiste già un `DEPUTYTASK*.md` **APERTO** da eseguire (allinea Git ed eseguilo);
- è un fix 1–2 file / typo / doc;
- la via è già chiara in un’unica slice (allora un solo brief, niente mappa).

## Due modalità

### A — Chart the map (disegnare la via)

Sessione Lead. **Non implementare codice applicativo.**

1. **Nomina la destinazione** (1–2 frasi): cosa è vero quando la mappa è finita
   (spec consegnata, decisione chiusa, MVP usabile). Fissa lo scope.
2. **Frontiera breadth-first**: elenca le decisioni/slice *già formulabili ora*.
   Leggi codice + ADR + roadmap **prima** di chiedere. Al committente solo
   dilemmi di prodotto non deducibili dai doc.
3. **Se non c’è nebbia** (tutto sta in una sessione): stop. Chiedi se procedere
   con un unico `DEPUTYTASK` invece della mappa.
4. **Scrivi** `docs/agent-tasks/PLAN_<EPIC>_SLICES.md` con il template sotto.
5. **Apri solo la prima slice eseguibile** in `DEPUTYTASK.md` (Stato: APERTO),
   commit + push su `origin/main` (o PR se il resto della sessione lo richiede).
6. **Stop.** La sessione di mappa non esegue MC-1, S2, ecc.

### B — Work through the map (camminare la via)

Sessione Deputy (o Lead su una sola decisione).

1. Carica il PLAN (vista a bassa risoluzione: destinazione, decisioni fatte, tabella slice). **Non** rileggere tutte le spec collegate se non servono a *questa* slice.
2. Prendi la prima slice **sbloccata** e non fatta. Se un altro `DEPUTYTASK*.md` è già APERTO su quella slice, non duplicare.
3. Sovrascrivi/apri il brief `DEPUTYTASK*.md` con **una** slice, DoD, file previsti, Cosa NON toccare.
4. Esegui **solo quella** slice (test L1, PR). Aggiorna il PLAN: spunta DoD, sposta gist in «Decisioni già prese», promuovi nebbia ora specificabile a nuove righe.
5. Non aprire la slice successiva nella stessa sessione se il contesto sta gonfiandosi (sintomi: rileggere le stesse regole, ripetere un errore già corretto, «mi ricordo che…» senza rileggere il file).
6. Se la slice **non è chiusa**: copia [`HANDOFF_TEMPLATE.md`](../../../docs/agent-tasks/HANDOFF_TEMPLATE.md) nel brief attivo e ferma. La sessione dopo riparte dall'handoff.

## Template PLAN

```markdown
# Piano slice — <Nome epic>

> **Destinazione**: <1–2 frasi, stato finale verificabile>
> **Spec / ADR**: <link>
> **Brief attivo**: <link DEPUTYTASK se aperto>

## Fuori scope
- …

## Non ancora specificato
- <nebbia in-scope, non abbastanza nitida da diventare una riga slice>

## Decisioni già prese
- <slice chiusa> — <gist di una riga + link commit/PR>

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| X-0 | … | … | — | AFK o HITL |
```

**Tipo**: `AFK` = il deputy può chiudere da solo. `HITL` = serve una risposta del committente (prodotto/Alto) prima o durante.

Ogni slice nel PLAN deve essere un **tracer bullet verticale** (un percorso stretto schema→API→UI→test), non uno strato orizzontale («tutto il DB, poi tutte le API»).

## Budget contesto (smart zone)

| Run | Context Cursor | Contenuto in sessione |
|-----|----------------|------------------------|
| Chart the map (Lead) | Default o alto, **non** 1M di default | Destinazione + PLAN + 2–3 file di vincolo, non tutto il modulo |
| Esecuzione slice (Deputy) | **Default / basso** | Solo il `DEPUTYTASK` + i file della slice |
| Review / Bugbot | Finestra pulita | Diff + standard, non la storia della mappa |

Se una slice non entra nella smart zone, **spezzarla** (prefactoring prima, poi il cambio facile) — non alzare il context.

## Qualità della mappa

- Una slice = un obiettivo **demoable o verificabile** da solo.
- Preferire tante slice sottili a poche spesse.
- La prima slice è il «hello world» end-to-end più piccolo possibile.
- Dipendenze esplicite; file disgiunti se si vogliono deputy paralleli (`DEPUTYTASK1.md`, `DEPUTYTASK2.md`).
- Nessun numero di migrazione riservato in anticipo (sequenza condivisa `database/migrations/` in root).
