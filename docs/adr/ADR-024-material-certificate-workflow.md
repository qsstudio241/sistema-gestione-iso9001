# ADR-024 — Workflow certificato materiale e Human-in-the-Loop

> **Stato**: Proposto — 05/08/2026  
> **Spec**: [MODULO_MATERIAL_COMPLIANCE_AI.md](../specs/MODULO_MATERIAL_COMPLIANCE_AI.md)  
> **Correlati**: ADR-020, ADR-022, ADR-010 § human oversight

---

## Contesto e problema

La verifica certificati deve essere un flusso **controllato e ricostruibile** in audit. Senza stati espliciti e HITL, si rischiano auto-approvazioni o perdita della catena PDF → estrazione → regole → decisione.

---

## Decisione

### Stati (MVP)

| Stato | Significato |
|-------|-------------|
| `received` | PDF acquisito / job creato |
| `text_ready` | Testo (o Markdown) disponibile |
| `extracted` | JSON estratto dall’AI (bozza) |
| `pending_review` | Rule Engine eseguito; in attesa operatore |
| `compliant` | Operatore ha approvato come conforme |
| `non_compliant` | Operatore ha confermato non conformità (o respinge) |
| `archived` | Chiuso; collegato a Document Registry se previsto |

> Stati tecnici intermedi OCR (`ocr_running`) solo se/quando esiste adapter OCR (slice MC-B).

### Human-in-the-Loop (vincolante)

**Nessun certificato passa a `compliant` / `non_compliant` senza azione operatore autenticato.**

Azioni consentite in revisione:

- correggere campo estratto e ri-eseguire Rule Engine;
- approvare esito;
- respingere / richiedere riesame;
- archiviare.

### Audit trail minimo per certificato

| Artefatto | Persistenza |
|-----------|-------------|
| PDF originale | Storage + link registry / job file |
| Testo / Markdown | DB o blob referenziato |
| JSON estratto (+ correzioni) | DB |
| Snapshot regole (hash KB) | DB |
| Esito Rule Engine | DB |
| Utente + timestamp decisione | DB |
| Interazione AI | `ai_interactions` (ADR-010) |

### Lessons learned (post-MVP)

Le correzioni operatore alimentano `lessons/` / feedback ingest (pattern ADR-017), **senza** fine-tuning automatico in produzione.

---

## Cosa NON fare

- Transizione automatica `pending_review` → `compliant`.
- Cancellare PDF o JSON dopo approvazione.
- Bypassare RBAC sulle azioni di approvazione.

---

## Conseguenze

Ogni decisione è ricostruibile in audit.  
Il costo operativo è una revisione umana per certificato — accettato per conformità ISO.
