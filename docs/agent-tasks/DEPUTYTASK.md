# DEPUTYTASK — LN-3: Libreria qualità info agenti (sola lettura)

**Stato:** APERTO  
**Aperto:** 29/08/2026  
**Piano:** [`PLAN_LIBRERIA_NORME_SLICES.md`](PLAN_LIBRERIA_NORME_SLICES.md)  
**Rischio:** Medio — FE colonne/badge + SELECT list documenti **additivo** (`text_quality`, `has_chunks`, riuso `norm_last_check`); niente auth/sync/breaking schema  
**Origine:** Piano Libreria dopo LN-2; «esaurire» ramo fonti  
**Branch:** `cursor/ln3-libreria-quality-0b72` (basato su LN-2)  
**Dipende da:** LN-1 CHIUSO; LN-2 su branch (non ancora su main)

> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Obiettivo

Catalogo Libreria mostra, sola lettura:

1. **Qualità testo** (`text_quality` da `norm_document_sources`) via `StatusBadge` type `norm_quality`
2. **Chunk RAG** presenza (`knowledge_chunks` entity_type=`document`)
3. **Ultimo check vigore** (`norm_last_check` già in list API)

Niente inventare soglie. Niente Knowledge Health rewrite.

## File previsti

| Path | Perché |
|------|--------|
| `docs/agent-tasks/DEPUTYTASK.md` | Brief |
| `docs/agent-tasks/PLAN_LIBRERIA_NORME_SLICES.md` | Spunta |
| `backend/src/controllers/document.controller.js` | LEFT JOIN nds + EXISTS chunks |
| `backend/src/controllers/document.controller.test.js` | Assert SELECT |
| `app/src/pages/NormLibraryPage.jsx` (+ CSS) | Colonne qualità |
| `app/src/tests/normLibraryPage.test.jsx` | L1 badge/colonne |

## Cosa NON toccare

- Migrazioni nuove / CHECK doc_type
- sync/auth/JWT
- Knowledge Health page rewrite
- Backlog scrivibile (LN-5)
