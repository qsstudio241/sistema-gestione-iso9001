# ADR-022 — Separazione estrazione AI e Rule Engine

> **Stato**: Proposto — 05/08/2026  
> **Spec**: [MODULO_MATERIAL_COMPLIANCE_AI.md](../specs/MODULO_MATERIAL_COMPLIANCE_AI.md)  
> **Correlati**: ADR-010 (AI propone, motori deterministici decidono), ADR-020, ADR-021

---

## Contesto e problema

I modelli AI non sono deterministici. Per ISO 9001 / ISO 3834 l’esito di conformità di un certificato materiale deve essere **ripetibile, spiegabile e verificabile**. Non può dipendere dal “giudizio” del modello.

Stesso principio già applicato a WPS (matcher 15614 deterministico) e SAL (AI suggerisce, operatore scrive).

---

## Decisione

### Ripartizione responsabilità

| Ruolo | Fa | Non fa |
|-------|----|--------|
| **AI** (via `aiProviderAdapter` / `importAiExtraction`) | Classificare documento, estrarre campi, sinonimi → chiavi canoniche, normalizzare unità | Dichiarare conforme/non conforme; approvare; scegliere quale requisito applicare |
| **Rule Engine** (servizio dedicato, codice puro) | Applicare limiti da KB/DB, confrontare valori, produrre esito + explanation | Chiamare LLM; interpretare PDF grezzo |
| **Operatore qualità** | Correggere estrazione, approvare/respingere, riesame | Essere bypassato da auto-approve |

### Principio (vincolante)

> **AI estrae → Rule Engine valuta → Operatore approva.**

### Contratto dati minimo

1. AI → JSON estratto validato contro schema (campi noti del data dictionary).  
2. Rule Engine → JSON esito (`status`, `checks[]` come da ADR-021).  
3. Persistenza di **entrambi** + snapshot regole usate (version/hash KB).

### Esempio

- AI: `ReH = 395` (MPa)  
- Rule Engine: requisito interno ≥ 400 → `NON_CONFORME`  
- Operatore: conferma o corregge il valore estratto e ri-lancia il motore

---

## Cosa NON fare

- Prompt del tipo «dimmi se il certificato è conforme».
- Scrivere esito finale in DB solo dalla risposta LLM.
- Disabilitare HITL “per velocità” in produzione.

---

## Conseguenze

| + | − |
|---|---|
| Esiti auditabili e ripetibili | Due componenti da mantenere (estrattore + motore) |
| Allineamento ADR-010 | OCR/errori estrazione restano gestiti in revisione umana |
