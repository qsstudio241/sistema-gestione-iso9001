# DEPUTYTASK — PONTE-1: Checklist ↔ allegati + flag required (HITL UX)

**Stato:** APERTO — HITL UX (nessun codice applicativo finché conferma layout A/B)  
**Aperto:** 03/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § PONTE-1 / priorità #3  
**UX:** [`UX_PONTE_CHECKLIST_ALLEGATI.md`](UX_PONTE_CHECKLIST_ALLEGATI.md)  
**Scenario:** [`SCENARIO_ING5_TRIAGE_OPZIONI.md`](SCENARIO_ING5_TRIAGE_OPZIONI.md) (Q5 chiusa)  
**Rischio:** — (solo docs / brief; implementazione = Medio dopo conferma UX)  
**Branch:** `cursor/ponte-checklist-allegati-ux-1c5d`  
**Slot precedente:** ING-5 HITL — HITL 03/09 ha scelto ponte; ING-5 resta dopo/nebbia (sovrascrittura slot consentita: stesso file, nuovo titolo APERTO)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> **Questa apertura**: deputy **non** implementa FE/BE — propone UX e lascia brief pronto. Codice solo dopo «Confermi A o B?».

---

## HITL registrato (03/09/2026)

| Voce | Decisione |
|------|-----------|
| Priorità | **Ponte checklist ↔ allegati** (non viste-per-ente come prima slice) |
| Obbligatorietà | **Flag** (alcuni allegati possono non essere presenti/previsti) |
| ING-5 triage | **Dopo / nebbia** |
| Preoccupazione | Usabilità FE → proposta concreta in `UX_PONTE_CHECKLIST_ALLEGATI.md` |

---

## Obiettivo questa sessione (docs)

1. Allineare PLAN + scenario alla decisione HITL.
2. Scrivere proposta UX (~60–100 righe) con **una** raccomandazione Lead (layout A) + alternativa B.
3. Brief APERTO pronto per la slice codice **dopo** conferma A/B.
4. **Zero** codice FE/BE.

## Domanda unica al committente

**Confermi questa UI (A) o preferisci B?** — vedi wireframe in [`UX_PONTE_CHECKLIST_ALLEGATI.md`](UX_PONTE_CHECKLIST_ALLEGATI.md).

---

## File previsti (questa PR docs)

- `docs/agent-tasks/UX_PONTE_CHECKLIST_ALLEGATI.md` (nuovo)
- `docs/agent-tasks/PLAN_VALUTAZIONE_COMMESSE_SLICES.md`
- `docs/agent-tasks/SCENARIO_ING5_TRIAGE_OPZIONI.md`
- `docs/agent-tasks/DEPUTYTASK.md` (questo brief)

## File previsti (dopo conferma UX — bozza codice, da riscrivere)

- Template: `ContractChecklistTemplatesPage.jsx` (+ colonna/flag `attachment_required` su item template — mig additiva TBD)
- Caso: `ContractReviewPage.jsx` (`ChecklistItemRow` + zona Allegati collegati / drawer B)
- Riuso: allegati caso esistenti + pattern `AttachmentSection` se applicabile — **niente** secondo DMS
- Test L1 mirati FE (+ BE se endpoint link item↔attachment)

## Cosa NON toccare

- `auth.middleware`, JWT, `syncService`, ADR-008
- Viste-per-ente (slice successiva solo se utile)
- ING-5 / monolite agenti
- VC-5 senza Lead
- SAL `gapAnalysis.service.js` come motore di questo flusso
- Look UI nuovo (solo `.cr-*` / libreria esistente)

## Esito atteso questa PR docs

- PLAN: PONTE-1 + HITL 03/09; ING-5 = dopo
- Scenario: Q5 chiusa su ponte checklist↔allegati
- UX proposta A (raccomandata) + B
- Brief APERTO; **niente** implementazione → chiusura codice = N/A

## Handoff

- **Obiettivo**: conferma layout A o B → poi nuova sessione implementazione PONTE-1
- **Stato**: BLOCCATA — attesa conferma UX
- **Fatto**: PLAN/scenario/brief aggiornati; `UX_PONTE_CHECKLIST_ALLEGATI.md` scritto
- **Manca**: risposta «A o B?»; poi file list codice + mig se serve
- **Non toccare**: auth/sync; secondo DMS; viste-per-ente; ING-5
- **Test**: N/A (solo docs)
- **Brief**: `docs/agent-tasks/DEPUTYTASK.md`
- **Branch / PR**: `cursor/ponte-checklist-allegati-ux-1c5d`
- **Roadmap**: aggiornare «sessione più recente» dopo merge (o se chat sola)
