# DEPUTYTASK_SAL_AI — S2b: UI HITL collega / carica / ignora

**Stato:** APERTO  
**Aperto:** 29/08/2026  
**Stream:** SAL AI evidenze — piano [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](PLAN_SAL_AI_EVIDENCE_SLICES.md)  
**S1a:** CHIUSO (PR [#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471))  
**S1b:** CHIUSO (PR [#603](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/603))  
**S2a:** CHIUSO (PR [#605](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/605))  
**Rischio:** Medio — UI additiva sul dialog AI + wiring PATCH evidenze già esistente; niente auth/sync/migrazioni  
**Branch:** `cursor/sal-ai-s2b-ui-evidenze-b42c`

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK_SAL_AI.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Perché

S2a propone `missingEvidenceSuggestion` (tipo tipico + candidati registro) **senza scrivere**. S2b fa scegliere all’utente: **collegare** un candidato, **caricare** nel registro, o **ignorare**. HITL: mai `evidence_document_ids` / stato SAL senza conferma.

## Contratto JSON (S2a, già in main)

`missingEvidenceSuggestion: null | { typicalDocType, typicalDocTypeLabel, candidates: [{ id, title, doc_type, doc_code }], reason }`

- oggetto → mostra tipo + motivo + lista; `null` / assente → nessun blocco

## File previsti

- `app/src/components/SalAiSuggestDialog.jsx`
- `app/src/components/SalAiSuggestDialog.css`
- `app/src/pages/SALModule.jsx` (solo wiring)
- `app/src/tests/salAiSuggest.test.jsx`
- `docs/agent-tasks/DEPUTYTASK_SAL_AI.md`
- `docs/agent-tasks/PLAN_SAL_AI_EVIDENCE_SLICES.md`

## Cosa NON toccare

- `DEPUTYTASK.md`
- backend S2a (`salAiSuggest.service.js`) salvo bug bloccante UI
- auth / sync / migrazioni / ingest / `.doc` / S1c
- `SalEvidenceSection.jsx` (riuso link registro, non riscrivere)

## DoD

- [ ] Dal dialog: collega candidato / apre registro / ignora
- [ ] Write evidenze solo dopo Collega (PATCH `updateGapStatus` esistente)
- [ ] Ignora e sola apertura dialog: zero write
- [ ] `typicalDocTypeLabel` + `reason` + candidati se oggetto; se `null` nessun blocco
- [ ] `AiDisclaimer` invariato
- [ ] Test Vitest mirato

## Bozza hub (PR #606 aperta su GUIDA/roadmap — non in questa PR)

- **GUIDA**: S1b OCR immagini #603; S2a `missingEvidenceSuggestion` zero write #605; S2b UI collega/carica/ignora HITL.
- **Roadmap**: piano SAL AI evidenze chiuso dopo S2b; S1c `.doc` solo su richiesta.
