# Guida rapida — RBAC Fase 4.1 (cliente azienda)

> Per committente e test manuali. Password account test in `mcp.env`.

## Chi è il «cliente azienda»

Utente con almeno una riga in `user_company_access` (`company_access` in login/me).

- **read**: solo consultazione sulla company assegnata
- **write**: CRUD su personale, anagrafica azienda, documenti, qualifiche, rischi (solo quella company)

`is_company_client: true` in login/`GET /auth/me`.

## Cosa fa il backend

| Funzione | Ruolo |
|----------|--------|
| `assertMutatingAllowed(user, { companyId })` | Blocca POST/PUT/DELETE se read-only o company non autorizzata |
| `companyAccessScopeClause` | Filtra liste per `company_id` assegnati (precedenza su `auditor_org_id`) |

Moduli protetti: companies PUT, documents, qualifications, risks, NC (via audit.company_id), audit create.

## Cosa fa il frontend

- `canWriteModule()` / `canEditCompany()` da `AuthContext`
- Pulsanti «Nuovo audit», «Aggiungi documento», «Salva anagrafica» nascosti se read-only

## Test rapidi

```powershell
# Account (VPS)
node scripts/link-company-access-test-users.js

# Viewer read ? 403 su PUT /companies/11, POST /qualifications, PUT /documents/:id
# Cliente write ? 200/201 sulle stesse route per company 11
```

## Deploy

1. Deploy backend (controller + `companyAccess.service.js` + `auditListRbac.service.js`)
2. Restart `sgq-backend`
3. Opzionale: rieseguire script link test users
4. Deploy frontend (app build)

Nessuna migration aggiuntiva (081 sufficiente).
