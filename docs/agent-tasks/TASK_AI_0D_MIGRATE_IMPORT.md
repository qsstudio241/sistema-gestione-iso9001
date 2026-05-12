# TASK 0-D — Migrazione importAiExtraction su adapter

> **ADR di riferimento**: [docs/adr/ADR-010-ai-agentic-architecture.md](../adr/ADR-010-ai-agentic-architecture.md) sezione 1
> **Branch**: `feat/migrate-import-to-adapter`
> **Prerequisito**: TASK 0-A completato (il provider adapter deve esistere)

---

## Obiettivo

Refactorare `importAiExtraction.service.js` per usare `aiProviderAdapter` invece di chiamare direttamente `fetch` verso OpenAI. Zero breaking change: il comportamento esterno deve essere identico.

## File da modificare

### `backend/src/services/importAiExtraction.service.js`

**Prima** (oggi):
```javascript
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// ... fetch diretto verso OpenAI con OPENAI_API_KEY
```

**Dopo**:
```javascript
const { chat } = require('./aiProviderAdapter');
// ... usa chat() che passa dal provider attivo (Gemini, Azure, OpenAI)
```

Cambiamenti specifici:
1. Rimuovere `OPENAI_URL`, `fetch` diretto, gestione manuale di `AbortController`
2. Usare `chat(messages, { temperature: 0.2, responseFormat: 'json' })` dall'adapter
3. Mantenere identica la struttura dei messaggi `system` e `user` (sono specifici dell'import)
4. Mantenere identica la validazione della risposta JSON
5. Mantenere identici i codici errore (`AI_NOT_CONFIGURED`, `AI_REQUEST_FAILED`, ecc.)
6. `MAX_INPUT_CHARS` e `stripCodeFences` restano invariati
7. Il campo `model` nel risultato viene dal response dell'adapter

### `backend/src/services/importAiExtraction.service.test.js`

Aggiornare i test per mockare `aiProviderAdapter.chat()` invece di `fetch`.

## Verifica retrocompatibilità

Il test di retrocompatibilità è:
1. Se solo `OPENAI_API_KEY` è configurata → il comportamento è identico al pre-refactor (l'adapter usa OpenAIAdapter)
2. Se `GEMINI_API_KEY` è configurata → l'import PDF usa Gemini (nuovo comportamento, ma funzionalmente equivalente)
3. Se nessuna chiave → errore `AI_NOT_CONFIGURED` (identico)

## Regole

- Non cambiare il formato di output di `extractStructuredFromText()` — i controller e il frontend dipendono da `{ model, data, raw_content }`
- Non toccare `importJobs.controller.js` né le route
- Non cambiare il prompt (system/user message) — funziona bene così

## DoD

- `importAiExtraction.service.js` non contiene più `fetch` diretto verso OpenAI
- Test aggiornati passano
- Build pulita
- Commit su branch, PR aperta
