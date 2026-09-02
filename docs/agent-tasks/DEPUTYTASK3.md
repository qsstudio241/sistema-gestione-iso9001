# DEPUTYTASK3 — CONS-3: Login non svuota IndexedDB (stesso utente)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 02/09/2026  
**Chiuso:** 02/09/2026  
**Piano:** [`PLAN_AUDIT_CONSERVAZIONE_SLICES.md`](PLAN_AUDIT_CONSERVAZIONE_SLICES.md) § CONS-3  
**Rischio:** Alto — `StorageContext` / sync locale; PR, non push su `main`. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.  
**Branch:** `cursor/cons3-login-no-wipe-2271`  
**Slot precedente:** shell dialog ingest CHIUSO (10/08, #377) — sovrascrittura consentita  
**Parallelo:** `DEPUTYTASK.md` = ING-5 APERTO — **non toccato**. CONS-1/2/6 già su `main`.

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK3.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> Brief da eseguire solo se su questo branch / `origin/main` questo file ha **Stato: APERTO** e titolo CONS-3.

---

## Perché

In `StorageContext.jsx` l’handler `auth:login` faceva `processQueue` → `clearAuditsStore()` → `reconcileAuditsFromServer`. Se la rete è ancora instabile, l’archivio locale sparisce e il server è vecchio. Il lavoro della giornata di audit si perde.

## File previsti

- `app/src/contexts/StorageContext.jsx` (handler login + helper merge/decisione)
- `app/src/tests/storageContext.loginNoWipe.test.js` (nuovo)
- `docs/agent-tasks/DEPUTYTASK3.md` (questo brief)
- Opzionale: 1 riga DoD CONS-3 su `PLAN_AUDIT_CONSERVAZIONE_SLICES.md`

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (ING-5 APERTO)
- `DEPUTYTASK1.md` / `DEPUTYTASK2.md` (CONS-2/6 CHIUSI)
- `useAutoSave.js` (CONS-1)
- `AuditLockBanner.jsx` (CONS-2)
- `auditRecoveryExport.js` / `AuditAccordionLayout.jsx` (CONS-6)
- `syncService.js` (CONS-5) — solo chiamate esistenti `processQueue`
- `AuthContext.jsx`, JWT, backend, migrazioni, GUIDA

## Cosa fare

1. Mai `clearAuditsStore` al login dello **stesso** utente.
2. Ordine: `processQueue` → merge locale più ricco + server (`hasRichContent` / `resolveMergedChecklistForReconcile`) → persist.
3. Wipe IndexedDB audit + coda resta **solo** al logout (`sgq:userLoggedOut` / `LogoutSyncGuard`).
4. Test L1: al login stesso utente NON si chiama `clearAuditsStore`; dati locali ricchi restano se il server è vuoto/vecchio.
5. `cd app && NODE_ENV=test npm run test:run -- src/tests/storageContext.loginNoWipe.test.js` + `cd app && npm run build`.
6. Commit, push, PR base `main` (draft). Cloud Agent non mergia.

## DoD

- [x] Stesso utente: nessun wipe pre-merge al login
- [x] Server vuoto/vecchio: locale ricco persistito
- [x] Test L1 verdi + build `app/`
- [x] Wipe logout invariato (`sgq:userLoggedOut`)

---

## Esito deputy

**TEST OK** — al login dello stesso utente non si chiama `clearAuditsStore`. Ordine: `processQueue` → merge (`hasRichContent` / `resolveMergedChecklistForReconcile`) → persist. Se il server è vuoto o vecchio, il locale ricco resta (`preserveLocalIfServerEmpty` + `resolveAuditsAfterLogin`). Wipe IndexedDB resta solo su `sgq:userLoggedOut`. Non toccati `DEPUTYTASK.md`, `syncService.js`, `AuthContext.jsx`, GUIDA.

| Voce | Dettaglio |
|------|-----------|
| Handler | `StorageContext.jsx` — `auth:login` senza wipe stesso utente |
| Helper | `shouldClearAuditsStoreOnLogin`, `runLoginAuditHydrate`, `resolveAuditsAfterLogin` |
| Test L1 | `storageContext.loginNoWipe.test.js` 11/11 |
| Build | `cd app && npm run build` OK |
| PR | draft su `main` (rischio Alto: non «pronta» senza CI+Bugbot+Security) |
