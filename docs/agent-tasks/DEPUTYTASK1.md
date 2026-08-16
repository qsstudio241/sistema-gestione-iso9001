# DEPUTYTASK1 — ISO-1a: RBAC `company_access` sui Rapporti di Prova (RDP)

**Stato:** APERTO  
**Aperto:** 15/08/2026 (Lead wayfinder — Chart the map ISO 3834)  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Gap:** [`GAP_RDP_3834_2026-08-15.md`](../gap-reports/GAP_RDP_3834_2026-08-15.md)  
**Rischio:** Medio (backend RBAC, non auth/JWT/sync) — PR + gate Bugbot; **non** push su `main`

> **Allineamento Git (autonomo)**: `git fetch origin main` e `git pull origin main` prima di leggere questo brief. **Non** chiedere al committente di farlo.

---

## Slice unica di questa sessione: ISO-1a

**Obiettivo**: un utente con `user_company_access` su una sola azienda **non vede e non modifica** i RDP delle altre aziende dello stesso tenant. Stesso pattern già usato da Commesse.

### Contesto (non riscrivere)

- Oggi `rdp.controller.js` filtra solo `organization_id` (+ `company_id` in query se l’utente lo passa). Un viewer di azienda A vede i RDP di B.
- Il pattern corretto è in `projects.controller.js`: `ensureCompanyAccessLoaded` + `companyAccessSqlFilter` in lista/stats; `assertMutatingAllowed` / `assertCompanyAccess` in get/create/update/delete.
- `companyAccess.service.js` è la fonte unica. **Non** inventare un `buildScopeCondition` locale (è il bug di `equipment.controller.js`).
- Questa slice **non** tocca NDT, Attrezzature, Welding Book (ISO-1b/1c/1d).

### DoD

1. `listRdpReports` e `getRdpStats`: dopo `organization_id`, applicare `companyAccessSqlFilter` se l’utente ha righe in `user_company_access`
2. `getRdpReport` / create / update / delete: negare (403) se `company_id` del report non è tra le aziende consentite; studio senza `company_access` resta org-wide (come Commesse)
3. Test L1 sul controller (mock del service): lista filtrata; get/update di un RDP di altra azienda → 403; utente studio senza access list → vede tutto il tenant
4. Nessuna migrazione. Nessun cambio UI. Nessun segreto in commit
5. PR (non `main`) + Bugbot; CI verde prima di dichiararla pronta

### File previsti

- `backend/src/controllers/rdp.controller.js`
- `backend/src/controllers/rdp.controller.test.js` (nuovo, mirror di `companyAccess.service.test.js` / pattern projects)

### Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a, APERTO)
- `ndtReports.controller.js`, `equipment.controller.js`, `weldingBooks.controller.js`
- `auth.middleware.js`, sync, JWT
- Template Word RDP / `RDPModule.jsx` (ISO-4)

### Test L1

```bash
cd backend && node --test src/controllers/rdp.controller.test.js src/services/companyAccess.service.test.js
```

Se il repo usa Jest per i controller backend, allinearsi al runner già usato da `qualifications.controller.test.js` / `projects` — non introdurre un secondo harness.
