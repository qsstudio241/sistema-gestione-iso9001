# DEPUTYTASK1 — ISO-1b: RBAC `company_access` sui verbali NDT (CND)

**Stato:** CHIUSO  
**Aperto:** 16/08/2026 (dopo merge ISO-1a [PR #438](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/438))  
**Chiuso:** 16/08/2026 — [PR #439](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/439)  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio — PR + gate Bugbot; **non** push su `main`

---

## Esito

Un utente con `user_company_access` su una sola azienda non vede e non modifica i verbali NDT (VT/MT/PT/UT) delle altre. Studio senza access list resta org-wide.

- `listNdtReports` / `getNdtStats`: `companyAccessSqlFilter` (alias `r`)
- get: 403 se `company_id` NULL o fuori elenco (`FORBIDDEN`, non 400)
- create / update / delete: `assertMutatingAllowed`
- Test L1 Jest: 22 verdi (`ndtReports.controller.test.js` + `companyAccess.service.test.js`)

Prossima slice 3834: **ISO-1c** (RBAC su Attrezzature — togliere `buildScopeCondition` / `user.company_id`) dopo merge di questa PR.

`DEPUTYTASK.md` (SAL S1a) non toccato.
