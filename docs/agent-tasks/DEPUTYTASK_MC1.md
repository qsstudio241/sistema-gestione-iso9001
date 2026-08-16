# DEPUTYTASK — Material Compliance MC-1 (tabelle certificato)

**Stato:** APERTO  
**Aperto:** 16/08/2026 (dopo merge MC-0 #447 e ISO-3 #448 + deploy VPS)  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md)  
**Spec:** [`MATERIAL_COMPLIANCE_DATA_MODEL.md`](../specs/MATERIAL_COMPLIANCE_DATA_MODEL.md)  
**Rischio:** Medio — migrazione additiva/nullable; PR + gate Bugbot; Cloud **non** mergia  
**Non toccare:** [`DEPUTYTASK.md`](DEPUTYTASK.md) (SAL S1a)

---

## Fonti Markdown (dichiarare, poi partire)

```text
Fonti Markdown:
- Coperte: EN 10204, EN 10168, ISO 10474/404/6929, EN 10025-2, ISO/TR 15608, ISO 14341 (classificazione, non soglie 3.1 lotto)
- Mancanti (non bloccano): EN 10210-1, EN 10219-1 (tubi); ISO 2560 / 17632 / 14174
- Si parte su: tabelle certificato base+apporto; tipo 2.1–3.2 sì; chimica/ReH apporto = skip
```

## Slice

SQL idempotente `database/migrations/149_material_certificates.sql` + `backend/scripts/run-migration-149-vps.js`.

Tabelle: `material_certificates` (`material_role` base\|filler, DDT, workflow ADR-024, JSON extract) e `material_certificate_checks` (CASCADE solo figlio→padre).

## Cosa NON fare

- UI, API extract, Rule Engine, seed soglie
- CRUD consumabili nel modulo Saldatura
- `ON DELETE CASCADE` verso `import_jobs` / `document_registry`
- Sovrascrivere `DEPUTYTASK.md` (SAL)
