# DEPUTYTASK1 — NG-4: messaggio «norma assente» in chat / gap

**Stato:** CHIUSO — TEST OK  
**Aperto:** 25/08/2026  
**Chiuso:** 26/08/2026  
**Piano:** [`PLAN_NORM_FIDELITY_SLICES.md`](PLAN_NORM_FIDELITY_SLICES.md)  
**Dipende da:** NG-0 + NG-1 + NG-3 **CHIUSI**  
**Rischio:** Medio — BE AI (NormBroker / chat / gap); niente auth JWT, niente sync audit, niente migrazioni.  
**Parallelo a:** CND-3 su [`DEPUTYTASK.md`](DEPUTYTASK.md) e STUD-1 su [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) — **file disgiunti** (questa slice = AI runtime, non verbali NDT / WPQR).

## Fonti Markdown

- Coperte: ADR-010 (NormBroker), gap report [`GAP_NORM_FIDELITY_STRATEGICA_2026-08-25.md`](../gap-reports/GAP_NORM_FIDELITY_STRATEGICA_2026-08-25.md), backlog [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md), pattern già in `salAiSuggest.service.js` (`textAvailable=false` + messaggio onesto)
- Mancanti: PDF HITL (NG-2) — **non bloccante** per questa slice
- Si parte su: quando il broker non trova clausola/standard, l’utente vede un messaggio chiaro invece di un’allucinazione

## Perché

NormBroker già restituisce `null` e logga «not found»; SAL suggest degrada con grazia. Chat Assistente / gap analysis possono ancora rispondere come se il testo ci fosse. NG-4 chiude il loop **prodotto**: «norma assente → dillo e indica cosa fare (Registro / Carica norme / chiedi PDF)», senza inventare clausole.

## DoD

1. Helper o contratto unico (es. su `normBroker` o modulo piccolo riusato) che, se clausola/standard assente, espone un messaggio **stabile** in italiano (UTF-8, accenti corretti) del tipo: testo non in archivio locale → non valutare a caso → indica percorso Registro Documenti / ingest norme / richiesta allo studio.
2. Collegare il messaggio almeno a **due** punti runtime già esistenti tra: `aiChat` / `aiContextBuilder` / `gapAnalysis` / suggest che usa `getClauseText` — riusare il pattern `salAiSuggest` dove possibile.
3. **Non** inventare testo normativo di fallback; **non** spegnere la chat intera (graceful: risposta utile + avviso fonte mancante).
4. Test L1 (Jest) sul caso `getClauseText` → null / standard sconosciuto.
5. Spuntare NG-4 in PLAN_NORM; brief **CHIUSO** — TEST OK.
6. Eventuale 1 riga in backlog se emerge lacuna ricorrente (non obbligatorio).

## File previsti

- `backend/src/services/normBroker.service.js` (+ test se presente / nuovo test mirato)
- uno o due tra: `backend/src/controllers/aiChat.controller.js`, `backend/src/services/aiContextBuilder.service.js`, `backend/src/services/gapAnalysis.service.js` (solo i punti dove oggi si tace o si inventa)
- eventuale riuso messaggio già in `salAiSuggest.service.js` (estrarre costante condivisa se evita duplicazione)
- `docs/agent-tasks/PLAN_NORM_FIDELITY_SLICES.md` + questo brief (chiusura)

## Cosa NON toccare

- `DEPUTYTASK.md` / CND / `NdtReportsPage` / controller NDT
- NG-2 runbook ingest (HITL PDF), NG-5 conformità legislativa profilo
- Scraping UNI Store / nuovi connettori ADR-010
- Auth, sync, migrazioni, seed VPS
- Installazione skill GitHub esterne
- GUIDA / roadmap § Stato attuale (parallelo CND-3 — sync **dopo merge**)

## Verifica

- [x] Con clausola assente: messaggio onesto, nessuna allucinazione di testo norma
- [x] Test L1 verdi sul caso null
- [x] PLAN NG-4 spuntato; brief CHIUSO — TEST OK

## Esito (26/08/2026)

Contratto unico su `normBroker`: `buildNormAbsentMessage` / `resolveClauseText` / `resolveStandardAbsent` (`NORM_TEXT_ABSENT`). Collegato a **aiChat** (avviso in prompt + prefisso reply, chat resta attiva), **gapAnalysis** (standard sconosciuto → `normAbsent` in JSON + testo in pagina), **aiContextBuilder** (getClauseText null / getFullNorm vuoto: niente testo inventato nel prompt). Jest: `normBroker.service.test.js`, `aiChat.controller.test.js`, `gapAnalysis.service.test.js`, `aiContextBuilder.service.test.js`.
