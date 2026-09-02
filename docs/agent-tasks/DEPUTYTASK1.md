# DEPUTYTASK1 — CONS-2: Avviso offline «non aprire lo stesso audit dal PC»

**Stato:** CHIUSO — TEST OK  
**Aperto:** 02/09/2026  
**Chiuso:** 02/09/2026  
**Piano:** [`PLAN_AUDIT_CONSERVAZIONE_SLICES.md`](PLAN_AUDIT_CONSERVAZIONE_SLICES.md) § CONS-2  
**Rischio:** Basso — solo testo banner `offline` + test L1; niente StorageContext, sync, auth, backend  
**Branch:** `cursor/cons2-offline-pc-warning-2271`  
**Parallelo a:** CONS-1 su [`DEPUTYTASK.md`](DEPUTYTASK.md) — **file disgiunti** (`useAutoSave.js` vs `AuditLockBanner.jsx`)  
**Slot precedente:** ING-4 CHIUSO su `origin/main` (sovrascrittura consentita)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> Brief da eseguire solo se su questo branch / `origin/main` questo file ha **Stato: APERTO** e titolo CONS-2.

---

## Perché

In offline il banner lock c’è già (`mode === 'offline'`, mostra `auditLock.message`: lock non attivo). Manca l’avviso deciso dal committente: il lavoro resta su **questo telefono**; **non** aprire lo stesso audit dal PC finché non torna la rete e la sync è completata.

Riuso: stesso `AuditLockBanner` montato in `App.jsx`. Nessun secondo alert.

## File previsti

- `app/src/components/AuditLockBanner.jsx`
- `app/src/components/AuditLockBanner.css` solo se serve
- `app/src/tests/auditLockBanner.offlinePc.test.jsx` (nuovo)
- `docs/agent-tasks/DEPUTYTASK1.md` (questo brief)

## Cosa NON toccare

- `app/src/hooks/useAutoSave.js` (CONS-1)
- `app/src/contexts/StorageContext.jsx` (CONS-3/4)
- `app/src/services/syncService.js` (import read-only OK; CONS-5)
- `app/src/contexts/AuthContext.jsx`
- Backend, migrazioni, GUIDA, PLAN, `DEPUTYTASK.md`, `DEPUTYTASK2.md`

## Criteri chiusura

1. `mode === 'offline'`: testo italiano (accenti UTF-8) che integra il messaggio attuale (lock non attivo) + avviso PC/telefono.
2. Solo offline — altri mode invariati.
3. Emoji solo in stringa JS, mai JSX grezzo.
4. Stesso look del banner. Nessuna schermata nuova.
5. Test L1: testo PC visibile in mode offline.
6. `cd app && NODE_ENV=test npm run test:run` sul test nuovo + `cd app && npm run build`.

## Esito deputy

**TEST OK** — banner `mode === 'offline'` integra lock-non-attivo + avviso PC/telefono. Nessun secondo alert. StorageContext non toccato.

| Voce | Dettaglio |
|------|-----------|
| UI | `AuditLockBanner.jsx` — `buildOfflineBannerMessage` + `OFFLINE_PC_WARNING` |
| CSS | invariato |
| Storage | nessuno |
| Test L1 | `auditLockBanner.offlinePc.test.jsx` 4/4 + `npm run build` OK |
| Ops | solo FE; Netlify da `main` dopo merge umano |

**Prossima slice:** CONS-3 (login senza wipe) è Alto e tocca `StorageContext.jsx` — seriale, non in questa PR. CONS-6 può restare parallela (file disgiunti).
