# Piano slice — Fedeltà normativa (loop fonti → skill → moduli)

> **Destinazione**: agenti di sviluppo e runtime AI dell’app rispettano un **loop chiuso**: (1) prima di toccare logica di conformità, dichiarano le fonti Markdown; (2) se manca il testo, **richiedono** al committente (HITL) senza inventare; (3) il PDF viene ingerito (`pdf-to-json` → `docs/Normative/`); (4) la conoscenza alimenta skill Cursor **mirate** e servizi prodotto (NormBroker, gap, Second Brain) — non una «schiera» di agenti GitHub paralleli.
> **Spec / ADR**: [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) · [ADR-015](../adr/ADR-015-cursor-lead-deputy-workflow.md) · [ADR-018](../adr/ADR-018-company-profile-conformita-legislativa.md) · skill [`gap-analysis-normativa`](../../.cursor/skills/gap-analysis-normativa/SKILL.md) · [`pdf-to-json`](../../.cursor/skills/pdf-to-json/SKILL.md)
> **Brief attivi (parallelo)**: [`DEPUTYTASK1.md`](DEPUTYTASK1.md) **CND-2** (file disgiunti). NG-3 **CHIUSO**.
> **Mappa creata**: 25/08/2026 · **NG-0+NG-1**: 25/08/2026 · **NG-3**: 25/08/2026
> **Gap report**: [`GAP_NORM_FIDELITY_STRATEGICA_2026-08-25.md`](../gap-reports/GAP_NORM_FIDELITY_STRATEGICA_2026-08-25.md)
> **Backlog lacune**: [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md)

---

## Fuori scope

- Installare pacchetti skill GitHub (Ponytail, Caveman, wiki Obsidian, `mattpocock/skills` intero) — doppia governance vs ADR-015
- Unificare harness Cursor e cervello in-app (già deciso in [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md): **sviluppo ≠ prodotto**)
- Scraping UNI Store / CEI completo (connettori ADR-010) come prerequisito — resta backlog NormBroker
- Riscrivere tutti i moduli maturi «perché il loop non c’era»
- Context 1M di default «perché le norme sono tante»
- Far diventare ogni typo UI un gate normativo (vedi decisioni)

## Non ancora specificato

- Quali **skill Cursor aggiuntive** per ambito oltre a rafforzare `gap-analysis-normativa` — dopo NG-3 e PDF reali
- Se il backlog norme mancanti vive anche come job/alert in-app per lo studio
- Priorità PDF restanti (vedi backlog): 9712, 2560/17632/14174, Quaderno 1090, 19011, leggi settoriali
- Quando (e se) un «supervisore» runtime in-app orchestra sotto-prompt specializzati

## Decisioni già prese

- **Sì** PDCA SGQ; **sì** fonti MD → qualità; **no** gate su ogni typo; **sì** HITL se manca testo; **no** schiere agenti GitHub
- **Due loop**: sviluppo (Markdown/seed) ≠ prodotto (Registro + RAG + validità)
- **VPS**: `norm_requirements` allineato all’ultima edizione Markdown (`seed-norm-requirements-from-json-vps.js`)
- **NG-0 ✅** (25/08/2026) — gate norm-touching + template richiesta + backlog
- **NG-1 ✅** (25/08/2026) — inventario globale in skill reference + backlog popolato; 3834-2/-4 già digitalizzate
- **NG-3 ✅** (25/08/2026) — skill `gap-analysis-normativa`: sezione «Quando chiedere PDF» + mapping SAL/RDP/checklist aggiornato

## Mappa slice

| Slice | Tema | Perimetro | Dipende da | Tipo | Stato |
|-------|------|-----------|------------|------|-------|
| **NG-0** | Policy + template + backlog stub | operating-memory, `NORME_MANCANTI_BACKLOG`, HANDOFF | — | AFK | ✅ |
| **NG-1** | Inventario fonti globale | skill `reference.md` + backlog | NG-0 | AFK | ✅ |
| **NG-2** | Runbook ingest PDF → Normative | how-to + GUIDA; `pdf-to-json` | NG-0, PDF HITL | HITL | pending |
| **NG-3** | Rafforzare skill gap | `.cursor/skills/gap-analysis-normativa/` | NG-1 | AFK | ✅ (`DEPUTYTASK.md`, 25/08/2026) |
| **NG-4** | Messaggio «norma assente» in chat/gap | normBroker / aiChat / gapAnalysis | NG-1 | AFK | pending |
| **NG-5** | Conformità legislativa profilo | ADR-018 + MD leggi | NG-2 + HITL | HITL | pending |

**Parallelo ora**: CND-2 (verbali NDT / gate 9712) su [`DEPUTYTASK1.md`](DEPUTYTASK1.md) — file disgiunti da questa slice già chiusa.

## HITL residuo

1. Priorità PDF: 9712, apporto 2560/17632, Quaderno 1090 (vedi backlog)
2. Conferma perimetro gate: solo norm-touching (default Lead) — ok se non dici altrimenti
3. Preferenza NG-2 vs NG-4: NG-3 chiuso; CND-2 ancora in parallelo
