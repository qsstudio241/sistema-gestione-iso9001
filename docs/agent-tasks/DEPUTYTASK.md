# DEPUTYTASK — NG-0: policy fedeltà normativa + template richiesta fonti

**Stato:** APERTO  
**Aperto:** 25/08/2026  
**Branch previsto:** `cursor/ng-0-norm-fidelity-policy-<suffix>` (o riuso dopo merge di questa mappa)  
**Piano:** [`PLAN_NORM_FIDELITY_SLICES.md`](PLAN_NORM_FIDELITY_SLICES.md)  
**Gap:** [`GAP_NORM_FIDELITY_STRATEGICA_2026-08-25.md`](../gap-reports/GAP_NORM_FIDELITY_STRATEGICA_2026-08-25.md)  
**Rischio:** Basso — solo docs/rules; niente schema, auth, sync, codice app.  
**Slot precedente:** CND-1 CHIUSO  
**Parallelo:** eventuali epic CND/SB su altri slot — **non** toccare file codice di quelle epic.

## Perché

La tesi del committente è corretta nella direzione (fonti → qualità AI e moduli), ma oggi il gate «dichiara Markdown / non inventare» è **parziale** e la richiesta di PDF manca di un formato ripetibile. NG-0 chiude la **policy** senza implementare runtime.

## Cosa fare (DoD)

1. Aggiornare `.cursor/rules/sgq-operating-memory.mdc` (sezione Fonti Markdown / nuova sottosezione breve):
   - gate su slice **norm-touching** (requisiti, checklist, Rule Engine, seed, prompt conformità, gap, export con citazione, campi legati a norma);
   - se manca testo → **richiesta HITL** con blocco standard (non inventare; non bloccare perimetro già coperto);
   - chiarire: **non** moltiplicare agenti GitHub; approfondire skill esistenti + `docs/Normative/`.
2. Creare `docs/reference/NORME_MANCANTI_BACKLOG.md` (tabella: codice norma, impatto modulo, stato richiesta, note) con le lacune già note dal gap report (3834-2/4 2021, Quaderno 1090, 2560/17632/14174, …).
3. Aggiungere in `docs/agent-tasks/HANDOFF_TEMPLATE.md` (o nota nel PLAN) un blocco copia-incolla «Richiesta norma al committente».
4. Spuntare NG-0 nel PLAN; **non** aprire NG-1 nella stessa sessione se il contesto si gonfia.
5. Test: `node backend/scripts/check-utf8-encoding.js` sui file toccati (se disponibile); niente suite FE obbligatoria (solo docs).

## File previsti

- `.cursor/rules/sgq-operating-memory.mdc`
- `docs/reference/NORME_MANCANTI_BACKLOG.md` (nuovo)
- `docs/agent-tasks/HANDOFF_TEMPLATE.md` e/o `docs/agent-tasks/PLAN_NORM_FIDELITY_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK.md` (questo brief, chiusura)
- opz. 1 riga in `docs/PROJECT_ROADMAP.md` § Stato attuale se chat sola

## Cosa NON toccare

- `app/**`, `backend/src/**`, migrazioni, auth, sync
- Altri `PLAN_*` / brief APERTO di altre epic
- Installazione skill GitHub esterne
- Esecuzione NG-1…NG-5 in questa stessa sessione deputy

## Verifica chiusura

- [ ] Policy leggibile in operating-memory
- [ ] Backlog norme mancanti creato con ≥3 righe note
- [ ] Template richiesta PDF disponibile
- [ ] PLAN: NG-0 spuntato; Stato brief CHIUSO — TEST OK (docs)
- [ ] Commit + PR; rischio Basso

## Comando di lancio (per il deputy successivo)

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
