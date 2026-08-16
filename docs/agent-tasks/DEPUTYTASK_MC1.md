# DEPUTYTASK — Material Compliance MC-1 (tabelle certificato)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 16/08/2026 (dopo merge MC-0 #447 e ISO-3 #448 + deploy VPS)  
**Chiuso:** 16/08/2026  
**PR:** [#450](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/450)  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md)  
**Spec:** [`MATERIAL_COMPLIANCE_DATA_MODEL.md`](../specs/MATERIAL_COMPLIANCE_DATA_MODEL.md)  
**Rischio:** Medio — migrazione additiva; PR + gate Bugbot; Cloud **non** mergia  
**Non toccare:** [`DEPUTYTASK.md`](DEPUTYTASK.md) (SAL S1a)

---

## Esito

- Migrazione **149** in `database/migrations/149_material_certificates.sql`.
- Tabelle `material_certificates` (34 colonne) + `material_certificate_checks`.
- Applicata su **TEST** (seconda run idempotente) e **PROD**.
- L1: 8/8 `materialCertificatesMigration149.test.js`.
- ISO-3 già deployata (health 200, smoke login OK).

Prossima MC: **MC-2** seed KB da Markdown (niente soglie inventate). `DEPUTYTASK.md` (SAL S1a) non toccato.
