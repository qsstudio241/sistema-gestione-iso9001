# DEPUTYTASK1 — Fix CI: Accetta SAL AI → updateGapStatus

**Stato:** CHIUSO — TEST OK  
**Aperto:** 29/08/2026  
**Chiuso:** 29/08/2026  
**Rischio:** Basso — fix FE mirato path Accetta suggeritore SAL AI + test L1; niente auth/sync/DB  
**Origine:** fail CI `test-and-build` su PR #597 (docs STUD-3-B, DiffRelation unrelated) — `salAiSuggest.test.jsx` «Accetta scrive lo stato proposto via updateGapStatus», `updateGapStatus` Number of calls: 0  
**Parallelo a:** STUD-3-B su [`DEPUTYTASK.md`](DEPUTYTASK.md) — **file disgiunti** (non toccare quel brief).  
**Branch:** `cursor/fix-sal-ai-accept-9166`

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Obiettivo

Ripristinare Accetta → `apiService.updateGapStatus` nel dialog suggeritore SAL AI. Test mirato verde in locale e in CI.

## Causa (diagnosi)

`SalAiSuggestDialog` inizializzava `items` solo in `useEffect` dopo il mount. Al primo paint `st.status` era `undefined`; Accetta chiamava `onAccept(s, undefined)`; `handleAiAccept` faceva early-return su `!finalStatus` → zero chiamate API. Race flaky sotto carico CI.

## Esito

- Init sincrono `items` + fallback `st.status || s.suggestedStatus` + Accetta disabled senza status
- Fallback status in `handleAiAccept`
- Test: attesa `Completato` **dentro** il dialog (non in griglia) prima di Accetta
- L1: `npx vitest run src/tests/salAiSuggest.test.jsx` — 6/6 verdi (anche stress 20× Accetta)

## File toccati

- `app/src/components/SalAiSuggestDialog.jsx`
- `app/src/pages/SALModule.jsx`
- `app/src/tests/salAiSuggest.test.jsx`
- `docs/agent-tasks/DEPUTYTASK1.md`

## Cosa NON toccare (rispettato)

- `docs/agent-tasks/DEPUTYTASK.md` (STUD-3-B)
- Codice WPQR stud / ingest / welding
- Auth, sync, migrazioni DB
