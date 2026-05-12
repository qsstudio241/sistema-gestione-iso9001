# TASK 0-A — Adapter multi-provider AI

> **ADR di riferimento**: [docs/adr/ADR-010-ai-agentic-architecture.md](../adr/ADR-010-ai-agentic-architecture.md) sezione 1
> **Branch**: `feat/ai-provider-adapter`
> **Eseguibile in parallelo con**: 0-B, 0-C

---

## Obiettivo

Creare un servizio backend che astrae il provider LLM (Gemini, Azure OpenAI, OpenAI). Il codice applicativo chiama solo `aiProviderAdapter` senza sapere quale provider è attivo.

## File da creare

### `backend/src/services/aiProviderAdapter.js`
Modulo principale. Esporta:
- `chat(messages[], options)` → `{ content, model, tokens: { input, output }, cost }`
- `chatStream(messages[], onChunk)` → AsyncIterator (implementazione base: non-streaming wrapper se il provider non supporta)
- `getActiveProvider()` → `'gemini' | 'azure_openai' | 'openai' | null`

Logica di selezione provider (cascata):
1. Se `GEMINI_API_KEY` presente → usa GeminiAdapter
2. Se `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` presenti → usa AzureOpenAIAdapter
3. Se `OPENAI_API_KEY` presente → usa OpenAIAdapter
4. Nessuna chiave → throw con code `AI_NOT_CONFIGURED`

### `backend/src/services/adapters/geminiAdapter.js`
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Modello default: `process.env.GEMINI_MODEL || 'gemini-1.5-flash'`
- Auth: query param `?key={GEMINI_API_KEY}`
- Mapping: formato messaggi OpenAI → formato Gemini (`contents[]` con `parts[]`)
- Ritorna nel formato comune `{ content, model, tokens, cost }`

### `backend/src/services/adapters/azureOpenaiAdapter.js`
- Endpoint: `{AZURE_OPENAI_ENDPOINT}/openai/deployments/{deployment}/chat/completions?api-version=2024-08-01-preview`
- Auth: header `api-key`
- Modello: `process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini'`
- Il formato messaggi è identico a OpenAI

### `backend/src/services/adapters/openaiAdapter.js`
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Auth: header `Authorization: Bearer {key}`
- Modello: `process.env.OPENAI_MODEL || process.env.OPENAI_IMPORT_MODEL || 'gpt-4o-mini'`
- Mantiene retrocompatibilità con le variabili env già usate da Sprint 9

### `backend/src/services/aiProviderAdapter.test.js`
- Test con mock fetch per ogni adapter
- Test cascata selezione provider
- Test graceful error (timeout, 429, 500)

## Variabili `.env` (documentare in README o .env.example)

```env
# Gemini (default — gratis)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

# Azure OpenAI (alternativa)
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# OpenAI diretto (esistente, retrocompatibile)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Regole

- Usare `fetch` nativo Node 20 (no dipendenze npm aggiuntive per ora)
- Timeout configurabile: `process.env.AI_REQUEST_TIMEOUT_MS || 90000`
- Ogni adapter gestisce il proprio formato di errore e lo normalizza in: `{ code, message, status }`
- Non modificare nessun altro file esistente in questo task (la migrazione di `importAiExtraction` è nel task 0-D)

## DoD

- `getActiveProvider()` ritorna il provider corretto in base alle env vars
- `chat()` funziona con almeno GeminiAdapter (test con mock)
- Tutti i test passano
- Commit su branch, PR aperta
