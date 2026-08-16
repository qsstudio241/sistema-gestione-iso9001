# DEPUTYTASK1 — ISO-1d: RBAC `company_access` sul Welding Book

**Stato:** APERTO  
**Aperto:** 16/08/2026 (dopo merge ISO-1c [PR #441](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/441))  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio (backend RBAC, non auth/JWT/sync) — PR + gate Bugbot; **non** push su `main`

> **Allineamento Git (autonomo)**: `git fetch origin main` e `git pull origin main` prima di leggere questo brief. **Non** chiedere al committente di farlo.

---

## Slice unica di questa sessione: ISO-1d

**Obiettivo**: un utente con `user_company_access` su una sola azienda **non vede e non modifica** i Welding Book delle altre. Stesso pattern di ISO-1a (RDP), non quello Attrezzature (NULL condiviso).

### Contesto (non riscrivere)

- Oggi `weldingBooks.controller.js` filtra solo `organization_id`. Un viewer di azienda A vede i libri di B.
- Pattern: `companyAccess.service.js` come in `rdp.controller.js`. **Non** `buildScopeCondition` / `user.company_id`.
- Welding Book è IOF di fabbricazione per azienda/commessa: `company_id` NULL → 403 per utente con access list (come RDP, non come Attrezzature).

### DoD

1. `listWeldingBooks` e `getWeldingBookStats`: `companyAccessSqlFilter` (alias `b`)
2. get / create / update / delete: 403 se `company_id` fuori elenco o NULL per utente azienda; studio senza access list resta org-wide
3. Test L1 Jest (service reale se `company_access` già caricato)
4. Nessuna migrazione. Nessun cambio UI
5. PR + Bugbot; CI verde prima di dichiararla pronta

### File previsti

- `backend/src/controllers/weldingBooks.controller.js`
- `backend/src/controllers/weldingBooks.controller.test.js` (nuovo)

### Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a)
- `rdp.controller.js`, `ndtReports.controller.js`, `equipment.controller.js`
- `auth.middleware.js`, sync, JWT
- Word Welding Book (ISO-5)
