# DEPUTYTASK — Material Compliance MC-3 (Rule Engine)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 17/08/2026 (dopo merge MC-2 #451 e hollow 10210/10219 #452)  
**Chiuso:** 17/08/2026  
**PR:** [#454](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/454)  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-3  
**Spec:** [`MATERIAL_COMPLIANCE_DATA_MODEL.md`](../specs/MATERIAL_COMPLIANCE_DATA_MODEL.md) § Rule Engine · [ADR-021](../adr/ADR-021-material-requirements-hierarchy.md)  
**Rischio:** Medio — service backend additivo, nessuna migrazione; PR + gate Bugbot; Cloud **non** mergia  
**Ambiente:** TEST (nessun SQL; schema MC-1 / mig. **149** già TEST+PROD). Non toccate 149/151/152.  
**Non toccare:** [`DEPUTYTASK.md`](DEPUTYTASK.md) (SAL S1a)

---

## Fonti Markdown (dichiarare, poi partire)

```text
Fonti Markdown:
- Coperte: EN 10204, EN 10168, ISO 10474/404/6929, EN 10025-2, EN 10210-1, EN 10219-1, ISO/TR 15608, ISO 14341 (classificazione filo, non soglie 3.1 lotto)
- Mancanti (non bloccano): ISO 2560 / 17632 / 14174 e altre norme prodotto apporto
- Si parte su: confronto deterministico JSON certificato vs snapshot KB (loader MC-2); skip su livello ADR-021 assente e su soglie apporto
```

## Esito

- Motore `backend/src/services/materialComplianceRuleEngine.service.js`
- Input: `corrected_json` ?? `extracted_json` + snapshot loader; `scope.po|customer|company` opzionale
- Output: `{ status: pass|fail|skip, kb_snapshot_hash, checks[] }` — zero LLM, niente `workflow_status=compliant`
- Più restrittivo vince (ReH min più alto, CEV/C max più basso) senza `if (cliente === 'FASSI')`
- L1: 17/17 `materialComplianceRuleEngine.service.test.js`
- Nessuna migrazione (schema 149 basta)

Prossima: **MC-4** API (`POST .../evaluate` persiste checks). `DEPUTYTASK.md` (SAL S1a) non toccato.
