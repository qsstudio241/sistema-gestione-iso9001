# DEPUTYTASK — Chiusura 31/05/2026

**Branch:** `feat/ai-docs-deeplink-chat-persist`  
**Esito finale:** **TEST OK**

## Esiti slice

| Slice | Esito | Note |
|-------|-------|------|
| **A** Deep link citazioni → Registro / Albero | OK | `/documents?tab=tree&select=<id>`; URL sync + `expandToDocument` |
| **B** Persistenza chat sessionStorage | OK | Chiave org+user, cap 50, debounce, logout clear |
| **C** Coerenza foglie albero vs Catalogo | Documentato | Stessi filtri obsoleto; differenza `parent_id` intenzionale (orfani → Inbox) |
| **D** L1 + build + doc | OK | Vitest 531/531; Vite build OK |

## Test

| Livello | Comando | Esito |
|---------|---------|-------|
| L1 slice | `vitest run` su 5 file task | 18/18 |
| L1 globale | `vitest run` | 531/531 |
| Build | `vite build` | OK (~14s) |
| L3 smoke | Non eseguito in sessione deputy | Tabella DEPUTYTASK originale — da fare su preview post-deploy Netlify |

## File toccati (FE)

- `app/src/utils/aiCitations.js`, `searchResultLinks.js`
- `app/src/utils/documentRegistryUrl.js` (nuovo)
- `app/src/utils/aiAssistantChatPersist.js` (nuovo)
- `app/src/utils/documentTreeCoherence.js` (nuovo)
- `app/src/components/DocumentRegistry.jsx`
- `app/src/hooks/useDocumentTree.js` (`expandToDocument`)
- `app/src/pages/AiAssistantPage.jsx`
- Test: `aiCitations`, `searchResultLinks`, `documentRegistryUrl`, `aiAssistantChatPersist`, `documentTreeCoherence`
- `docs/GUIDA_CONSOLIDATA.md`

## Prossimi passi (non eseguiti — regola user)

- [ ] Commit locale su branch (se non già fatto)
- [ ] Push + PR + merge `main`
- [ ] Deploy Netlify automatico post-merge
- [ ] Smoke L3 manuale: chip documento → albero; back → chat presente

---

*Chiuso 31/05/2026 — deputy.*
