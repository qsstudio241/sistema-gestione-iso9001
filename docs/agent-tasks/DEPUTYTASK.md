# DEPUTYTASK — IA-5b: coda admin «da completare»

**Stato:** APERTO  
**Aperto:** 21/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md) § IA-5b  
**Rischio:** Medio — filtro registro + UI; niente schema/auth/sync; Cloud **non** mergia.  
**Branch:** `cursor/ingest-ia5b-coda-d492`  
**Origine:** committente «Mergiato» su [#518](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/518); prossima fetta concordata IA-5b.

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

## Acceptance

- Lista filtrata incompleti (tipo / cartella / campi / bozza AI).
- Badge con conteggio.
- Screening non bloccato.
- Click riga = form documento esistente (nessuna pagina nuova).
