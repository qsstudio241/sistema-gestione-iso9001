# DEPUTYTASK1 — ISO-1d: RBAC `company_access` sul Welding Book

**Stato:** CHIUSO  
**Aperto:** 16/08/2026 (dopo merge ISO-1c [PR #441](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/441))  
**Chiuso:** 16/08/2026 — [PR #442](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/442)  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio — PR + gate Bugbot; **non** push su `main`

---

## Esito

Un utente con `user_company_access` su una sola azienda non vede e non modifica i Welding Book delle altre. Studio senza access list resta org-wide. `company_id` NULL → 403 (come RDP, non come Attrezzature).

- `listWeldingBooks` / `getWeldingBookStats`: `companyAccessSqlFilter` (alias `b`)
- get / create / update / delete: `assertCompanyAccess` / `assertMutatingAllowed`
- Test L1 Jest: 22 verdi

**Serie ISO-1* RBAC chiusa** (dopo merge di questa PR): RDP #438, NDT #439, Attrezzature #441, Welding Book #442.

Prossima slice 3834 eseguibile: **ISO-2** (riesame §5.3 data/utente + Word) o **ISO-3** (persistenza AI capitolato, file disgiunti).

`DEPUTYTASK.md` (SAL S1a) non toccato.
