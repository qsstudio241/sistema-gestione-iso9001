# DEPUTYTASK1 — ISO-1c: RBAC `company_access` sulle Attrezzature

**Stato:** APERTO  
**Aperto:** 16/08/2026 (dopo merge ISO-1b [PR #439](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/439))  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio (backend RBAC, non auth/JWT/sync) — PR + gate Bugbot; **non** push su `main`

> **Allineamento Git (autonomo)**: `git fetch origin main` e `git pull origin main` prima di leggere questo brief. **Non** chiedere al committente di farlo.

---

## Slice unica di questa sessione: ISO-1c

**Obiettivo**: un utente con `user_company_access` su una sola azienda **non vede e non modifica** le attrezzature delle altre aziende. Gli strumenti dello studio (`company_id` NULL) restano visibili in lettura a tutte le aziende del tenant (regola già documentata nel controller).

### Contesto (non riscrivere)

- Oggi `buildScopeCondition` usa `user.company_id`, colonna **inesistente**. Il filtro «utente azienda» non scatta mai: tutti vedono tutto il tenant.
- Fonte unica: `companyAccess.service.js`. **Non** tenere `buildScopeCondition` / `user.company_id`.
- Diverso da RDP/NDT: `company_id` NULL = patrimonio studio condiviso → **lettura ok**, scrittura solo studio.

### DoD

1. Lista / stats / for-report: `companyAccessSqlFilter` + `OR company_id IS NULL` se l’utente ha `user_company_access`
2. get / create / update / delete / tarature: 403 se l’asset è di un’altra azienda; create/update/delete di un asset studio da utente azienda → 403
3. Test L1 Jest (service reale se `company_access` già caricato)
4. Nessuna migrazione. Nessun cambio UI
5. PR + Bugbot; CI verde prima di dichiararla pronta

### File previsti

- `backend/src/controllers/equipment.controller.js`
- `backend/src/controllers/equipment.controller.test.js` (nuovo)

### Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a)
- `rdp.controller.js`, `ndtReports.controller.js`, `weldingBooks.controller.js`
- `auth.middleware.js`, sync, JWT
