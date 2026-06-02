# TASK — RBAC Fase 4 (user_company_access)

**Stato:** ? Implementato 02/06/2026  
**Migration:** `081_user_company_access.sql`  
**ADR:** [ADR-012](../adr/ADR-012-company-personnel-anagrafica.md)  
**Architettura:** [ARCHITETTURA_UTENTI_RBAC.md](../ARCHITETTURA_UTENTI_RBAC.md) §7 Fase 4

---

## Slice consegnata

| Componente | Dettaglio |
|------------|-----------|
| DB | Tabella `user_company_access` (UNIQUE user+company, permission read/write) |
| API admin | `GET/POST/DELETE /admin/users/:id/company-access` |
| Auth | `GET /auth/me` e login ? `company_access: [{ company_id, permission }]` |
| Backend scope | `companyAccess.service.js` ? companies + personnel |
| UI | Menu ridotto cliente azienda; `canEdit` da permission write |
| Test | Jest service + personnel; Vitest `companyAccess.test.js` |
| VPS | `run-migration-081-vps.js` + script `link-company-access-test-users.js` |

---

## Account test (password in mcp.env)

| Username | company_id | permission |
|----------|------------|------------|
| `cliente.azienda11@alproject.sgq.local` | 11 | write |
| `viewer.azienda11@alproject.sgq.local` | 11 | read |

---

## Comando VPS post-deploy

```powershell
# Migration
ssh ... "cd /var/www/sgq-backend && node scripts/run-migration-081-vps.js"

# Link account test (email prod)
ssh ... "cd /var/www/sgq-backend && WRITE_EMAIL=cliente.azienda11@alproject.sgq.local READ_EMAIL=viewer.azienda11@alproject.sgq.local node scripts/link-company-access-test-users.js"
```

### VPS deploy 02/06/2026 (sessione corrente)

| Step | Esito |
|------|-------|
| Migration 081 | ? tabella `user_company_access` creata (2 righe test) |
| Deploy backend | ? `deploy-controllers-to-vps.ps1` + `companyAccess.service.js` |
| Restart | ? `sgq-backend` MainPID rinnovato; health 200 |
| Smoke API | ? cliente POST personnel 201; viewer POST 403 |

---

## Gap test 02/06/2026 — chiusi

| Gap | Stato |
|-----|-------|
| Viewer POST personnel ? 403 | ? Hotfix + company_access read |
| UI nasconde CRUD personale viewer | ? CompanyPersonnelPanel canEdit |
| Cliente azienda scope singola company | ? Fase 4 backend + menu |
| Admin assegna accesso per company | ? API admin company-access |
