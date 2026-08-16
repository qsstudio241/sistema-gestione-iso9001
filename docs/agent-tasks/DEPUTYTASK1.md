# DEPUTYTASK1 — ISO-1c: RBAC `company_access` sulle Attrezzature

**Stato:** CHIUSO  
**Aperto:** 16/08/2026 (dopo merge ISO-1b [PR #439](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/439))  
**Chiuso:** 16/08/2026 — [PR #441](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/441)  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio — PR + gate Bugbot; **non** push su `main`

---

## Esito

`buildScopeCondition` / `user.company_id` rimossi. Un utente con una sola azienda non vede/modifica le attrezzature delle altre. Asset studio (`company_id` NULL) restano visibili in lettura; scrittura solo studio.

- lista / stats / for-report: `NULL OR company_id IN (...)`
- get: 403 se azienda fuori elenco; NULL → 200
- create / update / delete / taratura: `assertMutatingAllowed` (NULL da utente azienda → 403)
- Test L1 Jest: 23 verdi

Prossima slice 3834: **ISO-1d** (RBAC su Welding Book) dopo merge di questa PR.

`DEPUTYTASK.md` (SAL S1a) non toccato.
