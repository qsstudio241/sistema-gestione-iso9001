# DEPUTYTASK — CONS-1: Persistenza audit su disco prima della chiusura

**Stato:** CHIUSO — TEST OK  
**Aperto:** 02/09/2026  
**Chiuso:** 02/09/2026  
**Esito:** TEST OK  
**Piano:** [`PLAN_AUDIT_CONSERVAZIONE_SLICES.md`](PLAN_AUDIT_CONSERVAZIONE_SLICES.md) § CONS-1  
**Rischio:** Medio — solo hook autosave IndexedDB + test; niente auth, niente `syncService`, niente login/hydrate, niente migrazione  
**Branch:** `cursor/cons1-autosave-flush-2271`

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> Brief da eseguire solo se su `origin/main` questo file ha **Stato: APERTO** e titolo CONS-1.

---

## Perché

Il lavoro della giornata di audit deve restare sul telefono anche se si chiude l’app o cade la scheda **prima** che passino i 2 secondi di debounce.

Oggi `useAutoSave` programma `saveAudit` dopo 2000 ms; il cleanup dell’effect **cancella il timer** all’unmount. Chiusura PWA / cambio scheda = ultime C/NC/OSS e note solo in RAM → perse.

La coda `syncService` è un altro magazzino (CONS-3…5). CONS-1 sistema **solo** lo store `audits`.

## File previsti

- `app/src/hooks/useAutoSave.js`
- `app/src/tests/useAutoSave.flush.test.js` (nuovo)
- `docs/agent-tasks/PLAN_AUDIT_CONSERVAZIONE_SLICES.md` (spunta DoD CONS-1)
- `docs/agent-tasks/DEPUTYTASK.md` (chiusura)

## Cosa NON toccare

- `app/src/services/syncService.js`
- `app/src/contexts/StorageContext.jsx` (login, reconcile, hydrate, lock)
- `app/src/contexts/AuthContext.jsx`
- `app/src/components/AuditLockBanner.jsx` (CONS-2)
- `app/src/components/LogoutSyncGuard.jsx`
- `app/src/hooks/useNdtAutoSave.js` / Welding Book autosave
- Backend, migrazioni, JWT, GUIDA
- `DEPUTYTASK1.md` / altri slot

## Riuso obbligatorio

- Stesso `storageProvider.saveAudit` già usato
- **Tenere** il debounce mentre si digita (niente write a ogni tasto)
- Nessun secondo IndexedDB, nessuna libreria nuova

## Slice (unica)

1. Se c’è un salvataggio in attesa, **flush immediato** su:
   - `pagehide`
   - `visibilitychange` con `document.visibilityState === 'hidden'`
   - unmount del hook (invece di solo `clearTimeout`)
2. Dopo flush: aggiornare `previousDataRef` così non si riscrive lo stesso snapshot.
3. Errori `saveAudit` (quota): `saveStatus = 'error'`; non lanciare in UI.
4. Test L1:
   - dati cambiati + unmount prima dello scadere del delay → `saveAudit` chiamato almeno una volta
   - dati identici → nessun save
   - `pagehide` o `visibilitychange` hidden con pending → `saveAudit` chiamato
5. `cd app && NODE_ENV=test npm run test:run -- src/tests/useAutoSave.flush.test.js` e `cd app && npm run build`

## Acceptance

- Chiudere l’app / cambiare scheda **non** butta via l’ultimo audit in modifica: è su IndexedDB.
- Digitare una nota non genera una write per tasto (debounce resta).
- Nessun cambio al comportamento della coda o del login.

## Fuori da questa slice

- Avviso «non aprire da PC» → CONS-2
- Login che svuota IndexedDB → CONS-3
- Hydrate server-wins → CONS-4
- Coda `update_audit` → CONS-5
- Export recupero → CONS-6

## Prossima slice (non eseguire in questa sessione)

CONS-2 sul PLAN (banner), oppure CONS-3 se CONS-1 e CONS-2 sono già su `main` e si accetta il livello Alto.
