# DEPUTYTASK1 — ISO-1a: RBAC `company_access` sui Rapporti di Prova (RDP)

**Stato:** CHIUSO  
**Aperto:** 15/08/2026 (Lead wayfinder — Chart the map ISO 3834)  
**Chiuso:** 16/08/2026 — [PR #438](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/438)  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio — PR + gate Bugbot; **non** push su `main`

---

## Esito

Un utente con `user_company_access` su una sola azienda non vede e non modifica i RDP delle altre. Studio senza access list resta org-wide.

- `listRdpReports` / `getRdpStats`: `companyAccessSqlFilter` (alias `r`)
- get: 403 se `company_id` NULL o fuori elenco (`FORBIDDEN`, non 400)
- create / update / delete: `assertMutatingAllowed`
- Test L1 Jest: 22 verdi (`rdp.controller.test.js` + `companyAccess.service.test.js`)

Prossima slice 3834: **ISO-1b** (RBAC su verbali NDT) — stesso pattern, file disgiunto. Non aprire finché questa PR non è mergiata.

`DEPUTYTASK.md` (SAL S1a) non toccato.
