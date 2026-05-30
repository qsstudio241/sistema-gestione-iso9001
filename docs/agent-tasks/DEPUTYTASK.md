# DEPUTYTASK — Fase A citazioni AI (slice verticali)

**Avviato:** 30/05/2026 — Assistente AI: `citations[]` in risposta chat + chip UI.

## Checklist slice

| Slice | Descrizione | Test | Esito |
|-------|-------------|------|-------|
| **A1** | Backend `/ai/chat` → `citations[]` da chunk RAG (`buildCitationsFromChunks`) | Jest: `aiCitations.test.js` (3) + `aiChat.controller.test.js` (5) = **8** | **OK** |
| **A2** | Frontend `app/src/utils/aiCitations.js` mapping route + footnote | Vitest: `aiCitations.test.js` (**3**) | **OK** |
| **A3** | UI chip `AiAssistantCitations.jsx` in `AiAssistantPage` | Vitest: `AiAssistantCitations.test.jsx` (**2**) | **OK** |
| **A4** | Commit/push + deploy VPS backend + smoke chat | curl/script smoke | *in corso* |

## File toccati

- `backend/src/utils/aiCitations.js` (+ test)
- `backend/src/controllers/aiChat.controller.js` (+ test citations)
- `app/src/utils/aiCitations.js` (+ test)
- `app/src/components/AiAssistantCitations.jsx` (+ test render)
- `app/src/pages/AiAssistantPage.jsx`, `AiAssistantPage.css`

## Regole

- Nessuna modifica modulo documenti (altra chat).
- Prossima slice solo se test precedente verde.

*Aggiornato 30/05/2026 — agent slice A.*
