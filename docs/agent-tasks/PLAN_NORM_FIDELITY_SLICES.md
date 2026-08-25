# Piano slice — Fedeltà normativa (loop fonti → skill → moduli)

> **Destinazione**: agenti di sviluppo e runtime AI dell’app rispettano un **loop chiuso**: (1) prima di toccare logica di conformità, dichiarano le fonti Markdown; (2) se manca il testo, **richiedono** al committente (HITL) senza inventare; (3) il PDF viene ingerito (`pdf-to-json` → `docs/Normative/`); (4) la conoscenza alimenta skill Cursor **mirate** e servizi prodotto (NormBroker, gap, Second Brain) — non una «schiera» di agenti GitHub paralleli.
> **Spec / ADR**: [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) · [ADR-015](../adr/ADR-015-cursor-lead-deputy-workflow.md) · [ADR-018](../adr/ADR-018-company-profile-conformita-legislativa.md) · skill [`gap-analysis-normativa`](../../.cursor/skills/gap-analysis-normativa/SKILL.md) · [`pdf-to-json`](../../.cursor/skills/pdf-to-json/SKILL.md)
> **Brief attivo**: [`DEPUTYTASK.md`](DEPUTYTASK.md) — slice **NG-0** (APERTO)
> **Mappa creata**: 25/08/2026 (Lead wayfinder A — Chart the map; **nessun codice applicativo** in questa sessione)
> **Gap report**: [`GAP_NORM_FIDELITY_STRATEGICA_2026-08-25.md`](../gap-reports/GAP_NORM_FIDELITY_STRATEGICA_2026-08-25.md)

---

## Fuori scope

- Installare pacchetti skill GitHub (Ponytail, Caveman, wiki Obsidian, `mattpocock/skills` intero) — doppia governance vs ADR-015
- Unificare harness Cursor e cervello in-app (già deciso in [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md): **sviluppo ≠ prodotto**)
- Scraping UNI Store / CEI completo (connettori ADR-010) come prerequisito — resta backlog NormBroker
- Riscrivere tutti i moduli maturi «perché il loop non c’era»
- Context 1M di default «perché le norme sono tante»
- Far diventare ogni typo UI un gate normativo (vedi decisioni)

## Non ancora specificato

- Quali **skill Cursor aggiuntive** per ambito (es. `conformita-legislativa-45001`, `iso-3834-rdp`) oltre a rafforzare `gap-analysis-normativa` — solo dopo inventario NG-1 e 2–3 PDF reali ricevuti
- Se il backlog norme mancanti vive solo in Markdown repo o anche come job/alert in-app per lo studio
- Priorità PDF restanti da richiedere (9712, apporto 2560/…, Linea guida 1090, leggi settoriali) — **3834-2/-4:2021 ricevute e digitalizzate 25/08/2026**
- Quando (e se) un «supervisore» runtime in-app orchestra sotto-prompt specializzati (oggi: un LLM + tool/servizi)

## Decisioni già prese (25/08/2026, analisi Lead + tesi committente)

- **Sì**: il prodotto è pensato per **implementare, monitorare e migliorare** sistemi di gestione (PDCA): Audit, NC/CAPA, SAL/gap, Riesame, Registro+scadenze, 3834/CND, conformità legislativa (ADR-018 + SAL 5-B), Assistente AI.
- **Sì alla direzione**: fonti Markdown ufficiali → qualità risposte AI e coerenza FE/BE dei moduli dedicati. Senza testo non si inventano soglie/clausole.
- **No al «sempre» assoluto**: il gate normativo scatta su slice che toccano **requisiti, checklist, Rule Engine, seed, prompt conformità, gap, export citati, campi legati a norma**. Fix CSS/typo/deploy/auth non-normativi: **non** chiedono PDF.
- **Sì alla richiesta HITL se manca il testo**: formato standard (NG-0); lacune **tracciate**, slice coperta **non bloccata** (lezione già in GUIDA / operating-memory).
- **Crescita capacità = fonti + skill poche e profonde + servizi prodotto**, non proliferazione di agenti Cursor. Oggi: 3 skill repo (`gap-analysis-normativa`, `pdf-to-json`, `wayfinder-sgq`). Runtime: NormBroker + `gapAnalysis` + `figureKnowledge` + chat Ambito (Second Brain).
- **Due loop distinti** (non mescolare):
  1. **Sviluppo** (Lead/Deputy): brief → fonti → codice/test → PR
  2. **Prodotto** (utente studio): Ambito → fatti/gap → Assistente (cita, non certifica)

## Gap vs funzione attesa (sintesi)

| Aspetto | Oggi | Atteso | Slice |
|---------|------|--------|-------|
| Adesione normativa in sviluppo | Dichiarare MD solo su MC/seed/gap (regola già presente) | Stesso gate su **tutte** le slice «norm-touching», con richiesta HITL standard se manca PDF | **NG-0** |
| Inventario fonti globale | Forte su Material Compliance; catalogo skill su 9001/14001/45001/3834; lacune sparse | Un backlog unico «norme mancanti» + impatto moduli | **NG-1** |
| Ingest PDF → MD | Skill `pdf-to-json` + cartella `docs/Normative/` (~20+ norme) | Procedura ripetibile: ricevi PDF → MD/JSON → aggiorna inventario → (opz.) seed `norm_requirements` | **NG-2** |
| Skill specializzate Cursor | 3 skill; gap-analysis già cross-modulo | Estendere reference/mapping, non N agent GitHub; skill nuova solo se un ambito ha DoD ripetibile | **NG-3** |
| Runtime AI prodotto | NormBroker locale (+ publicLaw parziale); SAL legale; Second Brain parziale | Chat/gap citano clausole da DB; se manca → messaggio «caricare norma» (già idea ADR-010) | **NG-4** (dopo SB/SAL stabili) |
| Moduli FE/BE da dati norma | Pattern buono su 9606/MC/SAL; rischio campi senza fonte | Checklist «dato ↔ clausola ↔ UI ↔ API» nei brief normativi | **NG-0** (template brief) |

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **NG-0** | Policy + template richiesta norma + checklist brief | `.cursor/rules/sgq-operating-memory.mdc` (sezione gate), `docs/reference/NORME_MANCANTI_BACKLOG.md` (stub), template blocco in `DEPUTYTASK` / HANDOFF; **niente** codice app | — | AFK |
| **NG-1** | Inventario fonti globale (presente / mancante / impatto) | Estendere catalogo skill `gap-analysis-normativa/reference.md` + backlog NG-0 con righe da MC, 3834, CND/9712, leggi 81/152 | NG-0 | AFK |
| **NG-2** | Runbook ingest «PDF dal committente → Normative» | Doc how-to breve + riga in GUIDA; riuso skill `pdf-to-json`; un PDF campione se fornito | NG-0, PDF HITL | HITL (serve almeno 1 PDF) |
| **NG-3** | Rafforzare skill gap (non moltiplicare agenti) | `.cursor/skills/gap-analysis-normativa/` mapping moduli ↔ fonti; eventuale sottosezione «quando chiedere PDF» | NG-1 | AFK |
| **NG-4** | Runtime: messaggio «norma assente» in chat/gap | `normBroker` / `aiChat` / `gapAnalysis` — solo se NG-0…1 stabili e Second Brain non in conflitto file | NG-1, SB-3 se parallelo | AFK |
| **NG-5** | Conformità legislativa per profilo azienda | Collegare ADR-018 campi → obblighi tipici (senza inventare articoli); richiede MD leggi settoriali | NG-2 + PDF HITL | HITL |

**Ordine**: NG-0 → NG-1 → (HITL PDF) NG-2 → NG-3. NG-4/NG-5 solo dopo, file disgiunti da epic CND/SB aperte.

**Parallelo**: NG-0/1 sono solo docs/rules — ok in parallelo a CND codice **se** non si tocca lo stesso `DEPUTYTASK.md`. Questa mappa usa lo **slot** `DEPUTYTASK.md` (era CHIUSO).

## HITL per il committente (prodotto — non tecnico)

Rispondere quando comodo; sblocca NG-2/NG-5:

1. **Priorità PDF da digitalizzare** (scegline 1–3 ora): es. ISO 3834-2/4 ed. 2021, ISO 9712 integrale se serve CND-2, norme apporto (2560/17632), leggi settoriali oltre 81/152, Linea guida 1090 (Quaderno vuoto).
2. **Confermi** il perimetro del gate: solo slice norm-touching (proposta Lead) **oppure** anche brief generici con citazione «norma implicita»?
3. **Preferenza crescita**: prima **qualità fonti + skill gap** (NG-0…3) oppure prima **messaggi in-app** quando manca la norma (NG-4)?

## Collegamenti epic esistenti (non duplicare)

| Epic | Relazione |
|------|-----------|
| Material Compliance | Inventario MD già modello da generalizzare (NG-1) |
| Second Brain | Cervello **prodotto**; questa mappa governa **fonti e harness** |
| CND / 3834 / SAL evidenze | Consumatori del loop; non riscrivere i loro PLAN |
| Harness hardening | Collare AI già in piano; NG rafforza il lato «norme» |
