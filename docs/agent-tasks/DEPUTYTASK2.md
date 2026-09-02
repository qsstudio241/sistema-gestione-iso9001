# DEPUTYTASK2 — CONS-6: Pacchetto di recupero audit (export JSON)

**Stato:** APERTO  
**Aperto:** 02/09/2026  
**Piano:** [`PLAN_AUDIT_CONSERVAZIONE_SLICES.md`](PLAN_AUDIT_CONSERVAZIONE_SLICES.md) § CONS-6  
**Rischio:** Medio — util FE pura + un pulsante UI; niente auth, niente edit `syncService` / `StorageContext` / `useAutoSave` / `LogoutSyncGuard`  
**Branch:** `cursor/cons6-audit-recovery-export-2271`  
**Parallelo a:** CONS-1 su [`DEPUTYTASK.md`](DEPUTYTASK.md) — **file disgiunti** (CONS-1 = `useAutoSave.js`)  
**Slot precedente:** CND-4 CHIUSO (23/08)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK2.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> Brief da eseguire solo se su `origin/main` questo file ha **Stato: APERTO** e titolo CONS-6.  
> Questa esecuzione parte dal comando Cloud (branch da `origin/main`); lo slot su `main` era CND-4 CHIUSO, quindi sovrascrivibile.

---

## Perché

Se la rete non torna per giorni, l’auditor deve poter scaricare **audit aperto + item coda di quell’UUID** sul telefono. Non sostituisce CONS-1…5. Niente mirror cartella PC (ADR-007 Fase B). Niente modifica a `LogoutSyncGuard`.

## File previsti

- `app/src/utils/auditRecoveryExport.js` (nuovo)
- `app/src/tests/auditRecoveryExport.test.js` (nuovo)
- `app/src/components/AuditAccordionLayout.jsx` (un solo file UI: pulsante)
- `docs/agent-tasks/DEPUTYTASK2.md` (questo brief)

## Cosa NON toccare

- `useAutoSave.js`, `AuditLockBanner.jsx`, `StorageContext.jsx`
- `syncService.js` (niente edit; import/lettura store via `getDatabase` OK)
- `AuthContext.jsx`, `LogoutSyncGuard.jsx`
- backend, GUIDA, PLAN, `DEPUTYTASK.md`, `DEPUTYTASK1.md`

## Cosa fare

1. Funzione pura: audit + coda → JSON `{ version, exportedAt, auditUuid, audit, queueItems }` filtrato per UUID. Scope `organization_id` se c’è. Niente token.
2. Download Blob + `a[download]` nome `sgq-audit-recupero-<uuid-corto>-<data>.json`.
3. Test L1: filtra coda per UUID; senza coda; no token.
4. Pulsante «Scarica copia di recupero» sull’audit aperto, anche offline; `disabled` se manca audit. DNA esistente, italiano accentato, niente emoji JSX nuovi.
5. `cd app && NODE_ENV=test npm run test:run -- src/tests/auditRecoveryExport.test.js` + `cd app && npm run build`.
6. Commit, push, PR base `main`.
7. Rischio Medio. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.

## DoD

- File JSON scaricabile dal header audit (anche offline)
- Coda di altri UUID esclusa; token/jwt/password assenti dal JSON
- Test L1 verdi + build `app/`
