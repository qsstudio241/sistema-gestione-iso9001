# DEPUTYTASK — Fase A citazioni AI — **TEST OK**

**Chiuso:** 30/05/2026

## Checklist slice

| Slice | Descrizione | Test | Esito |
|-------|-------------|------|-------|
| **A1** | Backend `/ai/chat` → `citations[]` da chunk RAG | Jest **8** (`aiCitations` 3 + `aiChat.controller` 5) | **OK** |
| **A2** | `app/src/utils/aiCitations.js` mapping route + footnote | Vitest **3** | **OK** |
| **A3** | `AiAssistantCitations.jsx` + pagina assistente | Vitest **2** (render chip/footnote) | **OK** |
| **A4** | Push `main`, deploy VPS `aiChat` + `aiCitations`, smoke | `ai-citations-smoke.mjs` → 14 citazioni | **OK** |

## Commit

- `34bf942` — citazioni backend + UI base
- `c3ef889` — componente testabile, encoding, deploy script, smoke

## Smoke (prod)

```
OK ai/chat sourcesCount: 14 citations: 14
SMOKE_CITATIONS_A4_OK
```

*Prossimo task: sovrascrivere questo file con nuovo DEPUTYTASK.*
