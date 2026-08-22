# DEPUTYTASK1 — IA-17: timeout ingest dalla cartella

**Stato:** CHIUSO — TEST OK (22/08/2026)  
**Aperto:** 22/08/2026  
**Chiuso:** 22/08/2026  
**PR:** [#536](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/536)  
**SHA:** `c9c6f9f3` (merge `d1a177d1`)  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md) (follow-up IA-16 mergiata #534)  
**Rischio:** Medio — FE + nginx in-repo + `setTimeout` socket sul controller norme; niente schema/auth/sync.  
**Branch feature:** `cursor/ingest-folder-timeout-d492`  
**Slot:** closeout docs post-merge #536; `DEPUTYTASK.md` IA-16 già CHIUSO.

## Perché

Dopo IA-16 le pause (2s/file + 2.5s/batch embed + retry TPM 20–45s) allungano `POST /documents/norms/ingest-from-folder`. Un run era già ~61s. Il client mostrava **«Richiesta timeout»** (`AbortError` in `apiService.request`). Timeout dedicato era **180s**; con 7–20 PDF non basta. Default GET 10–15s resta.

## File previsti

- `app/src/services/apiService.js` (+ test timeout)
- `app/src/components/NormUploadButton.jsx` (+ `normUploadButton.test.jsx`)
- `backend/src/controllers/normUpload.controller.js` (`req`/`res.setTimeout` 15 min, + test)
- `backend/config/nginx/sgq-backend.conf` (già in repo: 300s → 900s)
- `docs/agent-tasks/DEPUTYTASK1.md`

## Cosa NON toccare

- Pause IA-16 / `geminiKeyPool`
- Job async nuovo
- `contractReview`, `auth.middleware`, `syncService`
- `DEPUTYTASK.md` (chiusura IA-16 in #535)
- GUIDA / roadmap (hub dopo merge; chat parallela #535)
- Deploy VPS / nginx sul server (Cloud non mergia)

## Slice

1. Timeout **15 min** solo ingest-from-folder e upload batch norme (stesso client, stessi tetti PDF).
2. Messaggio UI italiano se ancora timeout (non «Richiesta timeout»).
3. Socket Node + proxy nginx in-repo allineati a 15 min.

## Acceptance

- L1: Vitest timeout/messaggio + Jest `setTimeout` controller.
- PR draft, Cloud non mergia, no deploy.
