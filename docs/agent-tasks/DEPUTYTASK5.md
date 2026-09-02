# DEPUTYTASK5 — CONS-5: Coda `update_audit` senza lock e senza wipe

**Stato:** CHIUSO — TEST OK  
**Aperto:** 02/09/2026  
**Chiuso:** 02/09/2026  
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

- [x] `update_audit` senza lock token viene inviato da `processQueue`
- [x] `clearQueueForServerAudits` non cancella `update_audit` non stalled / mai inviato (anche se UUID ha mapping server)
- [x] `create_audit` già sul server resta pulibile
- [x] Test L1 verdi + build `app/`
- [x] CONS-3 / CONS-4 / ING-5 / GUIDA non toccati

---

## Esito deputy

**TEST OK** — `processQueue` invia `update_audit` anche senza lock token (lock = UX, ADR-008 T5). `clearQueueForServerAudits` non tratta il mapping uuid→audit_id come «già sync»: tiene `update_audit` non stalled mai inviato; `create_audit` già sul server e `update_audit` stalled restano pulibili. `getActiveQueueSize` conta gli update non stalled (logout non ignora coda intestazione). Non toccati `StorageContext.jsx`, `DEPUTYTASK.md`, `DEPUTYTASK3.md`, `DEPUTYTASK4.md`, GUIDA.

| Voce | Dettaglio |
|------|-----------|
| processQueue | rimosso skip `hasAuditLockToken` su `update_audit` |
| clearQueue | `update_audit` non stalled tenuto; mapping server non implica successo |
| Logout | `getActiveQueueSize` = item non stalled (anche senza lock) |
| Test L1 | `syncService.updateAuditQueue.test.js` 2/2; `syncService.stall.test.js` 9/9; suite sync+CONS-3/4 63/63 |
| Build | `cd app && npm run build` OK |
| PR | draft su `main` (rischio Alto: non «pronta» senza CI+Bugbot+Security) |
