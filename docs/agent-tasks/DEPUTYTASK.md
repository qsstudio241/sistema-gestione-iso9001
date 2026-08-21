# DEPUTYTASK — IA-5b: coda admin «da completare»

**Stato:** CHIUSO — TEST OK (21/08/2026), mergiata [#519](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/519) + deploy VPS  
**Aperto:** 21/08/2026  
**Chiuso:** 21/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md) § IA-5b  
**Rischio:** Medio — filtro registro + UI; niente schema/auth/sync.  
**Branch:** `cursor/ingest-ia5b-coda-d492`  
**SHA merge:** `503a9e33eb9531cc8297e1fc32bef01b17f92e57`  
**Origine:** committente «Mergiato» su [#518](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/518); slice IA-5b.

---

## Perché

Dopo un carico grosso i file finiscono nello scaffale (`document_registry`) incompleti: tipo incerto (`altro`), cartella assente, campi vuoti, bozza `ai_draft`. Oggi l’admin apre uno per uno. Serve una **coda** con badge, come profilo/qualifiche.

## File previsti

- `backend/src/controllers/document.controller.js`
- `backend/src/controllers/document.controller.test.js`
- `app/src/utils/documentIncompleteQueue.js`
- `app/src/tests/documentIncompleteQueue.test.js`
- `app/src/utils/documentRegistryUrl.js`
- `app/src/tests/documentRegistryUrl.test.js`
- `app/src/components/DocumentRegistry.jsx`
- `app/src/components/DocumentDataGrid.jsx`
- `app/src/components/DocumentDataGrid.css`
- `app/src/pages/ImportJobsPage.jsx`
- `app/src/tests/importJobsPage.incompleteQueue.test.jsx`
- `docs/agent-tasks/DEPUTYTASK.md`
- `docs/agent-tasks/PLAN_INGEST_ARCHIVIO_SLICES.md` (spuntare IA-5b)
- `docs/PROJECT_ROADMAP.md` § Stato attuale (chat sola)
- `docs/GUIDA_CONSOLIDATA.md` (una lezione breve; chat sola)

## Cosa NON toccare

`contractReview.*` (IA-6), ingest staging MC, SAL, unificare mappe folder, tetto 80, OCR, UX ×/Annulla/Storico Import, path `Z:\`, `PROJECT_CONTEXT.md`, auth/sync, migrazioni.

## Slice

1. Predicato condiviso: incompleto = tipo `altro`/vuoto **o** `parent_id` assente **o** titolo vuoto **o** `import_status=ai_draft`. Esclude cartelle e obsoleti.
2. `GET /documents?incomplete=1` + conteggio `da_completare` in `GET /documents/stats`. Scope `organization_id` / RBAC invariato.
3. Documenti: badge **Da completare** (stesso posto di «senza allegato» / Inbox). Click → Catalogo filtrato. Chip motivo in griglia. URL `?tab=catalog&incomplete=1`.
4. Import PDF: dopo Screening, link «Apri coda da completare» (non è un cancello).
5. L1 + build. PR draft. Non Bugbot da questo deputy.

## Esito L1

- FE Vitest: documentIncompleteQueue 4 + documentRegistryUrl 9 + documentDataGrid 2 + importJobsPage.incompleteQueue 1 = **16 verdi**
- BE Jest: `document.controller.test.js` **12 verdi** (incluso `incomplete=1` + `da_completare`)
- `cd app && npm run build` OK
- `ManagePullRequest` assente; titolo/body per il parent. **Non pronta** senza CI + Bugbot + Security su questo SHA. Nessun deploy VPS (dopo merge).

## Acceptance

- Lista filtrata incompleti (tipo / cartella / campi / bozza AI).
- Badge con conteggio.
- Screening non bloccato.
- Click riga = form documento esistente (nessuna pagina nuova).

## Chiusura (21/08/2026)

- [PR #519](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/519) mergiata su `main` `503a9e33`.
- Deploy VPS: PID `1149359` → `1163278`, health 200. Nessuna migrazione SQL (solo predicato query). `document.controller.js` già nel manifest.
- Smoke: login 200; `GET /documents/stats` → `da_completare=1`; `GET /documents?incomplete=1` 200 (1 riga).
- GUIDA + piano già in #519. Prossima fetta solo se chiesta: **IA-6**.
