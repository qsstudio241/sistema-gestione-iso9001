# DEPUTYTASK2 — Hub sync post CTX-0…3 (#663–#666)

**Stato:** APERTO  
**Aperto:** 07/09/2026 (post-merge CTX-3 #666)  
**Piano:** roadmap § Stato attuale · [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § CTX-4 HITL  
**Rischio:** Basso — solo docs (roadmap, GUIDA, PLAN, questo brief); niente codice prodotto  
**Branch:** `cursor/hub-sync-post-ctx3-8269`  
**Slot precedente:** CTX-3 CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** `DEPUTYTASK.md` Alert #3 HITL APERTO — **NON toccato** (no codice Alert)

---

## Perché

Dopo lo stack CTX-0…3 mergiato, allineare hub (roadmap § Stato attuale + lezione GUIDA + checklist HITL CTX-4). CTX-4 OAuth = Alto → **non implementare**. Alert #3 resta HITL senza risposte.

## DoD

- [x] Roadmap: moduli maturi CTX-0…3; sessione hub sync; priorità #1 = CTX-4 HITL Alto; ISO-4 come Medio actionable
- [x] GUIDA: lezione CTX-3 proposte registro = checkbox, mai overwrite
- [x] PLAN SB: checklist HITL CTX-4 (blocca codice)
- [x] Nessun file prodotto / Alert / OAuth
- [ ] PR docs + push (branch allineato a `origin/main`)

## File previsti

- `docs/PROJECT_ROADMAP.md` (§ Stato attuale)
- `docs/GUIDA_CONSOLIDATA.md` (una riga lezioni)
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md` (§ CTX-4 HITL)
- `docs/agent-tasks/DEPUTYTASK2.md` (questo)

## Cosa NON toccare

- `qualificationAlert.service.js` / Alert UI / `DEPUTYTASK.md`
- Auth / OAuth / JWT / sync / migrazioni
- Codice FE/BE Second Brain (già in main)

## Bloccanti next (no codice questa slice)

| Voce | Motivo |
|------|--------|
| CTX-4 Email/Drive | Alto + HITL (checklist in PLAN) |
| Alert #3 destinatario | HITL in `DEPUTYTASK.md` |
| ING-5 / ROO-18 / MC-I4 / S1c | HITL o solo su richiesta |

**Next Medio senza HITL (se serve codice):** ISO-4 Word visita Mason.
