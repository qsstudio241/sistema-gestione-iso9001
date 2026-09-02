# DEPUTYTASK5 — CONS-5: Coda `update_audit` senza lock e senza wipe

**Stato:** APERTO  
**Aperto:** 02/09/2026  
**Piano:** [`PLAN_AUDIT_CONSERVAZIONE_SLICES.md`](PLAN_AUDIT_CONSERVAZIONE_SLICES.md) § CONS-5  
**Rischio:** Alto — coda sync / ADR-008; PR, non push su `main`. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.  
**Branch:** `cursor/cons5-update-audit-queue-2271`  
**Base:** CONS-4 (`cursor/cons4-hydrate-pending-queue-2271`) già nel branch  
**Slot precedente:** Multimodal RAG MR-5 CHIUSO (19/08, #489) — sovrascrittura consentita  
**Parallelo:** `DEPUTYTASK.md` = ING-5 APERTO — **non toccato**. `DEPUTYTASK3.md` / `DEPUTYTASK4.md` — **non toccati**.

> **Allineamento Git (autonomo)**: `git fetch origin main`. Parti da CONS-4, crea questo branch, merge `origin/main` se serve (no rebase). **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK5.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> Brief da eseguire solo se su questo branch questo file ha **Stato: APERTO** e titolo CONS-5.

---

## Perché

`update_audit` in `syncService.js` viene saltato se manca il token di lock in memoria (`hasAuditLockToken`). Poi `clearQueueForServerAudits` può rimuovere quegli item se l’audit è già sul server — anche se non sono mai partiti. Obiettivo / generalData / conclusioni restano solo locali e si perdono (soprattutto dopo un login).

Lock sul server è solo UX (T5): le write non devono dipendere dal lucchetto.

## File previsti

- `app/src/services/syncService.js` (`processQueue` skip lock su `update_audit`; `clearQueueForServerAudits`)
- Test: `app/src/tests/syncService.stall.test.js` e/o `app/src/tests/syncService.updateAuditQueue.test.js`
- `docs/agent-tasks/DEPUTYTASK5.md` (questo brief)

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (ING-5 APERTO)
- `DEPUTYTASK3.md` (CONS-3)
- `DEPUTYTASK4.md` (CONS-4)
- `StorageContext.jsx` (CONS-3/4)
- `useAutoSave.js` (CONS-1)
- `AuditLockBanner.jsx` (CONS-2)
- `AuthContext.jsx`, JWT, backend, GUIDA, PLAN se collide

## Cosa fare

1. Non skippare `update_audit` in `processQueue` solo perché manca il lock token — inviare comunque (il server accetta senza lock).
2. `clearQueueForServerAudits` non rimuove `update_audit` mai inviato (niente mapping «già sync» se l’item non ha avuto successo). Tenere item non stalled non ancora processati.
3. Non rompere CONS-3/4 già sul branch.
4. Test L1 syncService + `cd app && npm run build`.
5. Commit, push, PR base `main` (draft). Cloud Agent non mergia. Non dire «pronta».

## DoD

- [ ] `update_audit` senza lock token viene inviato da `processQueue`
- [ ] `clearQueueForServerAudits` non cancella `update_audit` non stalled / mai inviato (anche se UUID ha mapping server)
- [ ] `create_audit` già sul server resta pulibile
- [ ] Test L1 verdi + build `app/`
- [ ] CONS-3 / CONS-4 / ING-5 / GUIDA non toccati
