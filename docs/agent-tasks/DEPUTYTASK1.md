# DEPUTYTASK1 — Logout / pulizia sessione (ADR-007)

**Stato:** CHIUSO — FIX NON APPLICABILI  
**Aperto:** 30/08/2026  
**Chiuso:** 30/08/2026  
**Rischio:** Medio/Alto se si tocca `auth.middleware`/JWT in profondità — perimetro richiesto: solo clear storage al logout (passo correttivo storico)  
**Parallelo a:** LG-1 su [`DEPUTYTASK.md`](DEPUTYTASK.md) / PR #610 — **file disgiunti** (non toccare aiChat, librarySourceRequest, NormLibraryPage, AiAssistantSourceGaps, mig 160, parseSourceGaps).  
**Branch:** `cursor/logout-session-clear-9166`  
**ADR:** [`docs/adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md`](../adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Obiettivo (richiesto)

Verificare / completare pulizia al logout secondo ADR-007 e pattern già in repo (IndexedDB audit, sync queue/metadata/allegati offline, localStorage tenant-scoped se previsto). Gate Ponytail. Non inventare. Non toccare auth.middleware/JWT in profondità.

## Diagnosi (evidenza codice su `main`)

| Requisito ADR-007 / passo storico | Stato | Dove |
|---|---|---|
| Svuotare IndexedDB audit al logout | **Già presente** | `StorageContext.jsx` listener `sgq:userLoggedOut` → `fsProvider.clearAuditsStore()` |
| Svuotare sync queue + metadata + allegati offline | **Già presente** | `syncService.clearSessionStoresOnLogout()` (`syncQueue`, `sync_metadata`, `attachments_offline`) |
| Gate pre-logout se coda attiva (Fase A) | **Già presente** (SYNC-4, 29/04/2026) | `AuthContext.logout` + `LogoutSyncGuard` montato in `App.jsx`: sync / esci comunque / annulla |
| Conta solo item attivi (non stalled / update_audit senza lock) | **Già presente** | `syncService.getActiveQueueSize()` + test in `syncService.stall.test.js` |
| Clear JWT / lock token al logout | **Già presente** | `apiService.logout()` + `clearAllAuditLockTokens()` (ordine: `sgq:userLoggedOut` **prima** di `clearToken`) |
| Chat AI sessionStorage | **Già presente** | `AiAssistantPage.jsx` su `sgq:userLoggedOut` |
| Isolamento localStorage tenant-scoped (bozze CND/WB/NC, storico testo) | **Già coperto da pattern org_id** (#588/#595) — non clear-on-logout (evita perdita dati ADR-007) | `useNdtAutoSave`, `textFieldHistory`, `ncFieldDraftStorage`, … |
| Fase B mirror cartella PC | **Fuori scope** di questa slice (opt-in desktop, ADR ancora aperto) | ADR-007 Fase B |

## Esito

**FIX NON APPLICABILI** — niente nuovo codice di prodotto: il passo correttivo storico (clear IndexedDB + store sessione sync al logout) e la Fase A (gate + sync/conferma) sono già in `main`. Aggiornata checklist ADR-007 (Fase A) + test L1 di regressione sul contratto `clearSessionStoresOnLogout`.

## File toccati (questa PR)

- `docs/agent-tasks/DEPUTYTASK1.md` (questo brief)
- `docs/adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md` (checklist Fase A)
- `app/src/tests/syncService.logoutClear.test.js` (regressione L1)

## Cosa NON toccare

- File LG-1 / PR #610 (`aiChat.*`, `librarySourceRequest.*`, `NormLibraryPage.*`, `AiAssistantSourceGaps.*`, mig 160, `parseSourceGaps.*`)
- `auth.middleware.js`, JWT deep changes
- Fase B mirror PC (nuova feature, HITL/product)

## Test

```bash
cd app && NODE_ENV=test npx vitest run src/tests/syncService.logoutClear.test.js
```

## Residuo (non in questa slice)

- ADR-007 **Fase B** (mirror cartella PC) resta aperta — solo su richiesta esplicita.
- Roadmap Open points «Logout vs lavoro solo locale»: aggiornare **dopo merge** (parallelo LG-1: non toccare GUIDA/roadmap in questa PR).
