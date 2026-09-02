# DEPUTYTASK4 — CONS-4: Hydrate non copre il locale se la coda è pendente

**Stato:** CHIUSO — TEST OK  
**Aperto:** 02/09/2026  
**Chiuso:** 02/09/2026  
**Piano:** [`PLAN_AUDIT_CONSERVAZIONE_SLICES.md`](PLAN_AUDIT_CONSERVAZIONE_SLICES.md) § CONS-4  
**Rischio:** Alto — hydrate/reconcile server-wins; PR, non push su `main`. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.  
**Branch:** `cursor/cons4-hydrate-pending-queue-2271`  
**Base:** CONS-3 (`cursor/cons3-login-no-wipe-2271`) già nel branch  
**Slot precedente:** filtri WPS/WPQR CHIUSO (10/08) — sovrascrittura consentita  
**Parallelo:** `DEPUTYTASK.md` = ING-5 APERTO — **non toccato**. `DEPUTYTASK3.md` CONS-3 — **non toccato**.

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git fetch origin cursor/cons3-login-no-wipe-2271`. Parti da CONS-3, crea questo branch, merge `origin/main` se serve (no rebase). **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK4.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> Brief da eseguire solo se su questo branch questo file ha **Stato: APERTO** e titolo CONS-4.

---

## Perché

All’apertura audit, `fetchAndApplyServerResponses` applica gli esiti **server** (server-wins). Se sul telefono c’è ancora coda (`save_responses` / `update_audit` / eventi) per quello UUID, il server è vecchio: l’UI mostra lì e un tap può accodare lo stato vuoto al posto del lavoro buono.

## File previsti

- `app/src/utils/pendingAuditQueue.js` (nuovo helper puro)
- `app/src/tests/pendingAuditQueue.test.js` (nuovo)
- `app/src/contexts/StorageContext.jsx` — solo `fetchAndApplyServerResponses` / reconcile hydrate
- `app/src/services/syncService.js` — **solo** getter read `getQueueItems()`
- `docs/agent-tasks/DEPUTYTASK4.md` (questo brief)

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (ING-5 APERTO)
- `DEPUTYTASK3.md` (CONS-3)
- `useAutoSave.js` (CONS-1)
- `AuditLockBanner.jsx` (CONS-2)
- `AuthContext.jsx`, JWT, backend, migrazioni, GUIDA
- Logica CONS-3 (login no-wipe) già sul branch base
- `syncService.js` oltre al getter read

## Cosa fare

1. Helper `shouldSkipServerHydrate(queueItems, auditUuid)`: item attivi (non stalled) dei tipi `save_responses`, `save_custom_checklist_responses`, `update_audit`, `send_audit_event` per quello UUID → skip.
2. `fetchAndApplyServerResponses`: se skip, non applicare esiti server (ISO + custom). Dopo `processQueue` ok si può hydratare.
3. Reconcile hydrate: stessa regola — non coprire checklist/esiti locali se la coda di quell’UUID è pendente. Riusa `resolveMergedChecklistForReconcile` / `applyServerResponsesPreservingLocalNotes` / draft registry.
4. Test L1 + `cd app && npm run build`.
5. Commit, push, PR base `main` (draft). Cloud Agent non mergia. Non dire «pronta».

## DoD

- [x] Coda attiva per UUID → non si applicano esiti server
- [x] Item stalled o altro UUID → hydrate invariato
- [x] Dopo processQueue ok (coda vuota per UUID) → hydrate consentito
- [x] Test L1 verdi + build `app/`
- [x] CONS-3 / ING-5 / GUIDA non toccati

---

## Esito deputy

**TEST OK** — se `syncQueue` ha item attivi (non stalled) `save_responses` / `save_custom_checklist_responses` / `update_audit` / `send_audit_event` per l’UUID, `fetchAndApplyServerResponses` e il merge reconcile non applicano gli esiti server. Dopo `processQueue` ok (coda vuota per UUID) l’hydrate riprende. Helper puro `shouldSkipServerHydrate`. Riusati `resolveMergedChecklistForReconcile` / `applyServerResponsesPreservingLocalNotes`. CONS-3 no-wipe invariato. Non toccati `DEPUTYTASK.md`, `DEPUTYTASK3.md`, `useAutoSave.js`, `AuthContext.jsx`, GUIDA.

| Voce | Dettaglio |
|------|-----------|
| Helper | `pendingAuditQueue.js` — `shouldSkipServerHydrate`, `resolveChecklistHydrateWithPendingQueue` |
| Getter | `syncService.getQueueItems()` sola lettura |
| Hydrate | `fetchAndApplyServerResponses`: processQueue → skip se coda attiva |
| Reconcile | checklist + customResponses locali se skip |
| Test L1 | `pendingAuditQueue.test.js` 16/16; loginNoWipe 11/11; checklistTextMerge 8/8 |
| Build | `cd app && npm run build` OK |
| PR | draft su `main` (rischio Alto: non «pronta» senza CI+Bugbot+Security) |
