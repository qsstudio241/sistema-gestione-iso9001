# DEPUTYTASK_SAL_AI — S2b: UI HITL collega / carica / ignora

**Stato:** CHIUSO — TEST OK  
**Aperto:** 29/08/2026  
**Chiuso:** 29/08/2026  
**Stream:** SAL AI evidenze — piano [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](PLAN_SAL_AI_EVIDENCE_SLICES.md) **chiuso** (S1c solo su richiesta)  
**S1a:** CHIUSO (PR [#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471))  
**S1b:** CHIUSO (PR [#603](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/603))  
**S2a:** CHIUSO (PR [#605](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/605))  
**Rischio:** Medio — UI additiva sul dialog AI + wiring PATCH evidenze già esistente; niente auth/sync/migrazioni  
**Branch:** `cursor/sal-ai-s2b-ui-evidenze-b42c`

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK_SAL_AI.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Perché

S2a propone `missingEvidenceSuggestion` **senza scrivere**. S2b fa scegliere: **collegare** un candidato, **caricare** nel registro, o **ignorare**. HITL: mai `evidence_document_ids` / stato SAL senza conferma.

## Contratto JSON (S2a)

`missingEvidenceSuggestion: null | { typicalDocType, typicalDocTypeLabel, candidates: [{ id, title, doc_type, doc_code }], reason }`

- oggetto → tipo + motivo + lista; `null` / assente → nessun blocco

## DoD

- [x] Dal dialog: collega candidato / apre registro / ignora
- [x] Write evidenze solo dopo Collega (PATCH `updateGapStatus` esistente)
- [x] Ignora e sola apertura dialog: zero write
- [x] `typicalDocTypeLabel` + `reason` + candidati se oggetto; se `null` nessun blocco
- [x] `AiDisclaimer` invariato
- [x] Test Vitest mirato

## File toccati

- `app/src/components/SalAiSuggestDialog.jsx`
- `app/src/components/SalAiSuggestDialog.css`
- `app/src/pages/SALModule.jsx` (solo wiring + `saveStatus` ritorna boolean)
- `app/src/tests/salAiSuggest.test.jsx`
- `docs/agent-tasks/DEPUTYTASK_SAL_AI.md`
- `docs/agent-tasks/PLAN_SAL_AI_EVIDENCE_SLICES.md`
- `docs/GUIDA_CONSOLIDATA.md` (1 riga S1b+S2a+S2b)
- `docs/PROJECT_ROADMAP.md` (1 riga, piano chiuso)

## Cosa NON toccato

- `DEPUTYTASK.md`
- backend S2a (`salAiSuggest.service.js`)
- `SalEvidenceSection.jsx` (riuso `buildDocumentRegistryPath` / link catalogo)
- auth / sync / migrazioni / ingest / `.doc` / S1c

## Verifica

- [x] Vitest `salAiSuggest.test.jsx` — 12/12
- [x] Vitest `salModule.test.jsx` — 6/6 (regressione)
- [x] Apertura dialog con oggetto → blocco visibile; `null` → assente
- [x] Collega → `updateGapStatus` con `evidenceDocumentIds`, stato riga invariato
- [x] Ignora → nasconde blocco, zero write
- [x] Carica → link `/documents?tab=catalog&company_id=…`

## Esito

- HITL collega / carica / ignora nel dialog AI
- Zero write senza click Collega (o Accetta stato, invariato)
- Piano SAL AI evidenze **chiuso**; S1c solo su richiesta
