# DEPUTYTASK_SAL_AI — S2a: Backend suggest documento mancante (HITL)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 29/08/2026  
**Chiuso:** 29/08/2026  
**Stream:** SAL AI evidenze — piano [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](PLAN_SAL_AI_EVIDENCE_SLICES.md)  
**S1a:** CHIUSO (PR [#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471))  
**S1b:** CHIUSO (PR [#603](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/603))  
**Rischio:** Medio — service backend additivo (campo JSON su `gap-ai-suggest`); niente auth/sync/migrazioni  
**Branch:** `cursor/sal-ai-s2a-doc-mancante-b42c`  
**PR:** da aprire draft su `main` — compare https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/sal-ai-s2a-doc-mancante-b42c?expand=1

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK_SAL_AI.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Perché

S1a/S1b fanno leggere PDF scansionati e foto. Se la clausola **non ha** evidenze collegate, il suggeritore diceva solo «collega prima». S2a propone tipo tipico + candidati scoped, **senza scrivere** FK (HITL / ADR-010). La UI collega/carica/ignora è **S2b**.

## Nebbia chiusa in S2a — mapping clausola → tipo documento

**Decisione:** euristica **statica piccola** (prefissi 5) + fallback `altro`. Non prompt AI, non ibrido.

Non sono obblighi di norma: solo etichette già in `app/src/data/documentTypes.js`. Nessun `doc_type` nuovo.

| Prefisso `clause_ref` | `typicalDocType` | Etichetta catalogo |
|-----------------------|------------------|--------------------|
| `5.2` | `manuale` | Manuale |
| `7.5` | `procedura` | Procedura |
| `8.4` | `procedura` | Procedura |
| `9.3` | `modulo` | Modulo / Registrazione |
| `10.2` | `modulo` | Modulo / Registrazione |
| (altro / non mappato) | `altro` | Altro |

Match: `clause_ref` uguale al prefisso, oppure inizia con `prefisso.` / `prefisso ` (così `5.2.1` sì, `5.20` no).

## Contratto JSON stabile (FE S2b)

Campo **sempre** presente su ogni elemento di `data.suggestions` (mai assente), tranne `CLAUSE_NOT_FOUND`:

- evidenze già collegate (lista IDs risolta non vuota) → `missingEvidenceSuggestion: null`
- nessuna evidenza (IDs assenti/vuoti / coverage missing = zero doc risolti) → oggetto sotto

```json
{
  "missingEvidenceSuggestion": {
    "typicalDocType": "procedura",
    "typicalDocTypeLabel": "Procedura",
    "candidates": [
      { "id": 10, "title": "PG-07 Acquisti", "doc_type": "procedura", "doc_code": "PG-07" }
    ],
    "reason": "Nessuna evidenza collegata alla clausola 8.4. Tipo tipico: Procedura."
  }
}
```

| Campo | Tipo | Note |
|-------|------|------|
| `typicalDocType` | string | Valore catalogo (`procedura` / `manuale` / `modulo` / `altro`) |
| `typicalDocTypeLabel` | string | Etichetta IT allineata a `DOC_TYPE_LABELS` |
| `candidates` | array | Max 8; scoped `organization_id` + `company_id`; non obsoleti; no `folder`; tipo tipico in testa |
| `candidates[].id` | number | `document_registry.id` |
| `candidates[].title` | string | |
| `candidates[].doc_type` | string | |
| `candidates[].doc_code` | string \| null | |
| `reason` | string | Motivazione corta per UI / disclaimer |

HITL: **nessun** `UPDATE`/`INSERT` su `requirement_implementation_status` né su `evidence_document_ids`.

Provider AI assente: contratto 5-A invariato (`aiAvailable: false`, `suggestions: []`).

## DoD

- [x] Contratto JSON documentato (questa sezione)
- [x] Query registro scoped org+azienda; limite 8
- [x] Test L1 sul service
- [x] HITL: nessun UPDATE a `requirement_implementation_status`

## File toccati

- `backend/src/services/salAiSuggest.service.js`
- `backend/src/services/salAiSuggest.service.test.js`
- `docs/agent-tasks/DEPUTYTASK_SAL_AI.md`
- `docs/agent-tasks/PLAN_SAL_AI_EVIDENCE_SLICES.md`

`deploy-manifest.json` invariato (`salAiSuggest.service.js` già listato).

## Cosa NON toccato

- `DEPUTYTASK.md` (LN-1 Libreria)
- UI SAL (`SALModule.jsx`, `SalAiSuggestDialog`, `SalEvidenceSection`) — **S2b**
- `documentTypes.js`; ingest; auth/sync/migrazioni
- GUIDA / roadmap (parallelo LN-1 — bozza sotto)

## Verifica

- [x] Jest: `salAiSuggest.service.test.js` — 39/39 verdi
- [x] Euristica: `5.2` manuale, `7.5`/`8.4` procedura, `9.3`/`10.2` modulo; `5.20` e `4.1` → `altro`
- [x] Lista evidenze piena → `missingEvidenceSuggestion: null`, nessuna query candidati
- [x] Query candidati: `@orgId` + `@companyId` + `TOP 8`; zero INSERT/UPDATE
- [x] Errore query candidati → `candidates: []`, nessun throw

## Esito

- Campo `missingEvidenceSuggestion` su ogni suggestion `gap-ai-suggest`
- Euristica statica (non AI) + candidati `document_registry` scoped
- Zero write HITL
- L1: 39/39 Jest
- Compare PR: https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/sal-ai-s2a-doc-mancante-b42c?expand=1
- Prossimo: **S2b** UI collega / carica / ignora

## Bozza hub (dopo merge, non in questa PR)

- **GUIDA**: una riga — `gap-ai-suggest` propone tipo tipico + candidati registro se manca evidenza; zero write (HITL); UI in S2b.
- **Roadmap**: S1b #603 + S2a backend documento mancante; prossimo S2b UI collega/carica/ignora.
