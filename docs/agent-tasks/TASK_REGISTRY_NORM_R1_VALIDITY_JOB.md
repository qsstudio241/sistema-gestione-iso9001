# TASK R1 — Job validità norme sul `document_registry`

> **Stato (25/05/2026): ✅ COMPLETATO** — PR [#66](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/66) mergiata. Documento conservato come riferimento storico.

> **Piano**: [PLAN_REGISTRY_NORM_SOT_SLICES.md](./PLAN_REGISTRY_NORM_SOT_SLICES.md)  
> **Prerequisito**: Gate 0 completato (PR #65 merge + deploy VPS).  
> **Branch**: `cursor/registry-norm-sot-r1-b492` da `main`.

---

## Obiettivo

Estendere `normValidityChecker.service.js` in modo che il job settimanale (e eventuale invocazione manuale) verifichi **tutte** le norme presenti in `document_registry`, non solo le righe in `norm_document_sources`.

---

## Vincoli

- Multi-tenant: sempre filtro `organization_id`.
- **SoT visibile** = `document_registry.type_specific_data` (campi vigore aggiornati lì).
- Se esiste `norm_document_sources` collegata (`document_id`), aggiornare anche quella riga (compatibilità fino a R5).
- Riutilizzare `normCatalog.lookupNormStatus` (già con Normattiva/EUR-Lex post-PR #65).
- Nessuna migrazione DB obbligatoria: usare `JSON_VALUE` / parse JSON su `type_specific_data`.
- Stati vigenti da controllare: `vigente`, `rilasciato` (in JSON o colonna `status` registro — allineare a convenzione esistente in `documentTypeSchemas`).

---

## Implementazione suggerita

1. Estrarre helper `parseNormFieldsFromRegistry(row)` → `{ standard_code, edition_year, issuing_body, validity_status }`.
2. Query principale:
   - `FROM document_registry dr`
   - `WHERE dr.doc_type = 'norma' AND dr.organization_id = @orgId`
   - `AND JSON_VALUE(dr.type_specific_data, '$.standard_code') IS NOT NULL`
   - vigore in (`vigente`, `rilasciato`, null) — coerente con `VIGENT_STATUSES` attuale.
3. Per ogni riga: `checkNormValidity(...)` → UPDATE `type_specific_data` con merge JSON (non sovrascrivere altri campi).
4. LEFT JOIN / seconda query su `norm_document_sources` per mirror update.
5. Array `updated` per email: includere `dr.id`, `dr.title`, `dr.doc_code`, campi vigore.

---

## Test L1 (Jest)

- Mock `query` + `normCatalog.lookupNormStatus`.
- Caso A: solo `document_registry` con codice UNI → checker chiamato, JSON aggiornato.
- Caso B: registro + `norm_document_sources` → entrambi aggiornati.
- Caso C: norma senza `standard_code` → saltata.

```bash
cd backend && npm test -- --testPathPattern="normValidityChecker"
```

---

## Verifica post-deploy (VPS)

- Restart `sgq-backend` (PID cambiato).
- Script diagnostico opzionale: contare norme registro con codice vs righe in `norm_document_sources` per org test.

---

## DoD

- [ ] Test Jest verdi
- [ ] PR con CI verde
- [ ] Deploy VPS
- [ ] Log job: `checked` ≥ numero norme registro con codice (non solo sources)
- [ ] Aggiornata sezione in `GUIDA_CONSOLIDATA.md` (riga “job legge registro”)

---

## Prompt deputy

```
Leggi docs/agent-tasks/TASK_REGISTRY_NORM_R1_VALIDITY_JOB.md ed eseguilo.
Chiudi con TEST OK o FIX NON APPLICABILI.
```
