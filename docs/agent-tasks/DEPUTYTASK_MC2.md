# DEPUTYTASK — Material Compliance MC-2 (KB seed + loader)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 17/08/2026 (dopo merge MC-1 [PR #450](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/450))  
**Chiuso:** 17/08/2026  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md)  
**Non toccare:** [`DEPUTYTASK.md`](DEPUTYTASK.md) (SAL S1a)

---

## Esito

- Seed parseable EN 10025-2 (S235–S500) in `knowledge/material-compliance/standards/en-10025-2.md`
- `COVERAGE.md`: coperte / mancanti / si parte su
- Loader `materialKbLoader.service.js`: snapshot + hash SHA-256; lookup ReH/CEV/C/KV; skip tubi e apporto
- Copia identica in `backend/data/material-compliance/` (deploy VPS)
- L1: 12/12

Prossima: **MC-3** Rule Engine (zero LLM). `DEPUTYTASK.md` (SAL S1a) non toccato.
