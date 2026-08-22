# DEPUTYTASK — IA-16: throttle ingest cartella + 429 TPM Gemini

**Stato:** CHIUSO — TEST OK (22/08/2026)  
**Chiuso:** 22/08/2026  
**PR:** [#534](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/534)  
**SHA:** `1e418118`  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md) (IA-16; follow-up IA-15 CHIUSO #532)  
**Rischio:** Medio — backend additivo (classificazione 429 + pause/batch); niente schema/auth/sync.  
**Branch feature:** `cursor/ingest-gemini-throttle-d492`  
**Precedente slot:** IA-15 CHIUSO [#532](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/532)

## Perché

Ingest dalla cartella tratta tutti i PDF in sequenza stretta: embedding Gemini sfora TPM (1M token/min). Un 429 TPM marcava la chiave **esaurita** e spegneva anche Flash (stesso pool).

## File previsti

- `backend/src/services/adapters/geminiKeyPool.js` (+ test)
- `backend/src/services/adapters/geminiAdapter.js`
- `backend/src/services/aiProviderAdapter.test.js` (embed 429 TPM)
- `backend/src/services/normChunker.service.js`
- `backend/src/services/knowledgeIndexer.service.js` (stesso percorso embed)
- `backend/src/controllers/normUpload.controller.js` (+ test pausa)
- `docs/agent-tasks/DEPUTYTASK.md`

## Cosa NON toccare

- `contractReview`, tetto 20 PDF cartella
- `auth.middleware`, `syncService`, migrazioni
- GUIDA / roadmap (hub dopo merge)
- Schermata ingest nuova (riusa lista risultati + warning)

## Slice

1. 429 TPM / rate / resource exhausted transitorio → retry + backoff; **non** `markKeyExhausted`.
2. `markKeyExhausted` solo 403 o quota giornaliera/billing davvero morta.
3. Batch embed default 5 + pausa ~2,5s (`GEMINI_EMBED_BATCH` / `GEMINI_EMBED_PAUSE_MS`).
4. Pausa ~2s tra PDF cartella (`INGEST_FOLDER_PAUSE_MS`). Embed fallito dopo retry → warning, extract Flash già ok resta.

## Acceptance

- L1: 429 TPM non marca chiave; 403 sì.
- 7 PDF: Flash non muore per un picco embed al minuto.

## Esito (22/08/2026) — TEST OK

Mergiata [#534](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/534) su `main` SHA `1e418118`. 429 TPM / rate / resource exhausted → retry + backoff, **non** `markKeyExhausted`. Esausta solo 403 o quota giornaliera/billing. Batch embed + pausa tra PDF cartella. Deploy VPS in closeout (manifest già copriva i `.js`).
