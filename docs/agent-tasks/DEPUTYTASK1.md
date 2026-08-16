# DEPUTYTASK1 — ISO-1b: RBAC `company_access` sui verbali NDT (CND)

**Stato:** APERTO  
**Aperto:** 16/08/2026 (dopo merge ISO-1a [PR #438](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/438))  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio (backend RBAC, non auth/JWT/sync) — PR + gate Bugbot; **non** push su `main`

> **Allineamento Git (autonomo)**: `git fetch origin main` e `git pull origin main` prima di leggere questo brief. **Non** chiedere al committente di farlo.

---

## Slice unica di questa sessione: ISO-1b

**Obiettivo**: un utente con `user_company_access` su una sola azienda **non vede e non modifica** i verbali NDT (VT/MT/PT/UT) delle altre aziende dello stesso tenant. Stesso pattern di ISO-1a (RDP).

### Contesto (non riscrivere)

- Oggi `ndtReports.controller.js` filtra solo `organization_id` (+ `company_id` in query se l’utente lo passa). Un viewer di azienda A vede i verbali di B.
- Pattern chiuso in ISO-1a: `rdp.controller.js` + `companyAccess.service.js`. **Non** inventare un `buildScopeCondition` locale.
- Questa slice **non** tocca RDP, Attrezzature, Welding Book (ISO-1c/1d).

### DoD

1. `listNdtReports` e `getNdtStats`: dopo `organization_id`, applicare `companyAccessSqlFilter` se l’utente ha righe in `user_company_access`
2. `getNdtReport` / create / update / delete: 403 se `company_id` del verbale non è tra le aziende consentite; studio senza `company_access` resta org-wide
3. Test L1 Jest (service reale se `user.company_access` è già caricato): lista filtrata; get/update di un verbale di altra azienda → 403; utente studio senza access list → vede tutto il tenant
4. Nessuna migrazione. Nessun cambio UI. Nessun segreto in commit
5. PR (non `main`) + Bugbot; CI verde prima di dichiararla pronta

### File previsti

- `backend/src/controllers/ndtReports.controller.js`
- `backend/src/controllers/ndtReports.controller.test.js` (nuovo, mirror di `rdp.controller.test.js`)

### Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a, APERTO)
- `rdp.controller.js`, `equipment.controller.js`, `weldingBooks.controller.js`
- `auth.middleware.js`, sync, JWT
- UI NDT / Word VT (ISO-4 / ISO-9)

### Test L1

```bash
cd backend && npx jest src/controllers/ndtReports.controller.test.js src/services/companyAccess.service.test.js --no-coverage
```
