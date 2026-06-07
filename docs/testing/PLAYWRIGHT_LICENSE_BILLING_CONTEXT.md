# Playwright � contesto licenze, RBAC azienda e billing

> Sintesi operativa per agente E2E che simula un **utente azienda cliente** (viewer o cliente con write), **non** superadmin e **non** consulente studio.  
> **Ultimo aggiornamento**: 2026-06-02.

**Correlati**: [ARCHITETTURA_UTENTI_RBAC.md](../ARCHITETTURA_UTENTI_RBAC.md) � [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md) � migration `081_user_company_access.sql` � migration `082_billing_layer.sql`

---

## A. Gerarchia e chi fa cosa

| Ruolo | Chi � | Cosa DEVE poter fare | Cosa NON DEVE vedere/fare |
|-------|--------|----------------------|---------------------------|
| **`superadmin`** | Piattaforma QS Studio | Tutti i tenant, `PATCH /admin/licenses`, dashboard `/settings/billing` | � (fuori scope test azienda) |
| **`admin`** | Amministratore tenant (studio) | Gestione utenti, licenze in **sola lettura**, tutti gli studi del tenant | Modificare licenze, billing platform |
| **`auditor`** | Consulente con `auditor_org_id` | Audit, checklist, export nel proprio studio | Aziende di altri studi; billing |
| **`viewer` azienda** | Cliente finale con `user_company_access` | Sola lettura (o write se `permission: write`) **solo** sulle aziende assegnate | Menu studio, utenti, licenze, billing, aziende non assegnate |

**Regola tenant**: ogni utente ha `organization_id`. I dati non attraversano il tenant.

**Regola azienda (Fase 4)**: se `user.company_access.length > 0`, l�utente � **cliente azienda** � menu ridotto, link �La mia Azienda� ? `/companies/{id}`.

---

## B. Licenze moduli (livello tenant)

**Fonte**: colonna `organizations.licensed_modules` (JSON array di chiavi). Esposta in login/`GET /auth/me` come `user.licensed_modules`.

### Comportamento atteso

| Condizione | API (ruoli ? admin/superadmin) | UI (`LicensedRoute`) |
|------------|----------------------------------|----------------------|
| Modulo **presente** in `licensed_modules` | 200 sulle route protette | Pagina modulo visibile |
| Modulo **assente** | **403** `{ code: "MODULE_NOT_LICENSED", module: "..." }` | Schermata `<ModuleLocked lockedByLicense />` � badge �Non incluso nel piano� |
| `licensed_modules` **NULL / vuoto / JSON invalido** | Tutti i moduli noti abilitati (retrocompat) | Tutte le route licenziate visibili |

**Bypass licenze API**: solo `superadmin` e `admin` org � **non** si applica al viewer azienda.

### Moduli noti nel codice (`KNOWN_MODULE_KEYS`)

| Chiave | Area prodotto |
|--------|----------------|
| `audit` | Audit (sempre incluso se si salvano licenze custom) |
| `documents` | Registro documenti, alert, WebDAV |
| `qualifiche` | Qualifiche personale |
| `nc` | Non conformit� |
| `rischi` | Rischi e obiettivi |
| `reclami` | Reclami + anagrafiche fornitori (`/anagrafiche`) |
| `notifications` | Impostazioni notifiche email |
| `sal` | SAL riesame direzione (UI spesso `locked`) |
| `saldatura` | Modulo ISO 3834 |
| `ai_import` | Import batch PDF |
| `ai_assist` | Assistente AI, knowledge health |
| `ai_norms` | AI norme (backend) |
| `ai_review` | Riesame requisiti contratto (`/contract-reviews`) |
| `ai_chat` | AI chat (backend) |

### Route UI protette da `LicensedRoute` (App.jsx)

`/documents` � `/qualifiche` � `/nc` � `/rischi` � `/reclami` � `/anagrafiche` � `/contract-reviews` � `/ai-assistant` � `/ai-knowledge-health` � `/sal` � `/saldatura/*` � `/settings/notifications` � `/settings/import-jobs`

Sidebar/bottom nav: voci con `licenseKey` **NON DEVONO** comparire se modulo non licenziato (`AppLayout` ? `filterByLicense`).

---

## C. Accesso per azienda (viewer / cliente)

**Tabella**: `user_company_access` � `(user_id, company_id, permission read|write, organization_id)`.

**Auth**: login e `GET /auth/me` restituiscono `company_access: [{ company_id, permission }]`.

### Comportamento atteso

| Utente | DEVE | NON DEVE |
|--------|------|----------|
| Viewer `permission: read` | Vedere �La mia Azienda�, aprire scheda azienda assegnata, UI personale in sola lettura | Creare/modificare personale (POST ? **403**), menu studio/admin, mutazioni API su doc/qualifiche/rischi |
| Cliente `permission: write` | Come sopra + CRUD operativo sulla propria azienda | Gestire altre aziende, settings admin |
| Viewer senza riga in `user_company_access` | Comportamento legacy studio (se ha `auditor_org_id`) | � |

**Fase 4.1 (02/06/2026)**: guard `assertMutatingAllowed` su API mutanti; scope `company_id` su audit/documenti/NC/qualifiche/rischi; login/me espone `is_company_client`.

---

## D. Billing (contesto test)

**Tabelle** (migration 082): `company_billing`, `billing_events`, `billing_snapshots`.

### Regole rilevanti per test azienda

- **`company_billing.status`**: `active` se azienda operativa, `suspended` se `companies.is_active = 0`.
- **Fatturabilit�** (backend): `is_billable = (billing_status === 'active' AND company.is_active === 1)` � usata solo da snapshot/export superadmin.
- **`billing_events`**: scritti dal backend (creazione azienda, toggle attivo, backfill, aggiornamento licenze) � **nessuna UI** per utente azienda.

### Cosa l�utente azienda NON DEVE vedere

- Voce menu **�Fatturazione�** (`/settings/billing`) � solo `superadmin`
- Chiamate API `GET /admin/billing/*` � **403** (o 401) per non-superadmin
- Eventi billing, export CSV, riepilogo tenant/studi

**Nota commerciale** ([PROJECT_ROADMAP](../PROJECT_ROADMAP.md)): canone per azienda attiva + moduli abilitati; il cliente azienda **non** gestisce il proprio piano � lo fa QS Studio via superadmin.

---

## E. Scenari Playwright consigliati

### 1. Login viewer con 1 azienda

- **Given**: `viewer.azienda11@alproject.sgq.local` + `user_company_access` su `company_id=11`, `permission=read`
- **DEVE**: redirect home, sidebar con �La mia Azienda� (non elenco studi)
- **DEVE**: URL azienda `/companies/11`
- **NON DEVE**: voci �Utenti�, �Licenze moduli�, �Fatturazione�, �Il mio Studio�

### 2. Modulo non licenziato

- **Setup**: tenant con `licensed_modules` che **esclude** es. `"nc"` (superadmin path separato � solo menzione)
- **When**: viewer naviga a `/nc` o chiama API NC
- **DEVE (UI)**: titolo modulo + testo �Non incluso nel piano� / �Chiedi a un amministratore��
- **DEVE (API)**: **403** + `code: MODULE_NOT_LICENSED`

### 3. Navigazione moduli licenziati

- **Given**: tenant con moduli base (`documents`, `nc`, �) in licenza
- **DEVE**: aprire `/documents`, `/nc` senza schermata locked
- **DEVE**: sidebar mostra voci corrispondenti

### 4. Write vs read (personale azienda)

- Viewer read ? pulsante �Aggiungi personale� assente o disabilitato; POST personnel **403**
- Cliente write (`cliente.azienda11@�`) ? POST personnel **201**

### 5. Superadmin (solo smoke separato)

- Path `/settings/billing`, `GET /admin/billing/overview` � **fuori** suite �utente azienda�

---

## F. Dati test utili

### Account (VPS / locale � password in `mcp.env`, non in repo)

| Email | Ruolo | company_access |
|-------|-------|----------------|
| `viewer.azienda11@alproject.sgq.local` | viewer | company 11, **read** |
| `cliente.azienda11@alproject.sgq.local` | viewer | company 11, **write** |

Script collegamento: `node backend/scripts/link-company-access-test-users.js`

### Endpoint API rilevanti

| Metodo | Path | Note attese viewer azienda |
|--------|------|----------------------------|
| POST | `/auth/login` | Risposta include `licensed_modules`, `company_access` |
| GET | `/auth/me` | Stesso payload utente |
| GET | `/companies` | Lista filtrata per scope azienda |
| GET/POST | `/companies/:id/personnel` | POST read-only ? **403** |
| * | `/nc/*`, `/documents/*`, � | **403** se modulo non in licenza |
| GET | `/admin/billing/*` | **403** (non superadmin) |
| PATCH | `/admin/licenses` | **403** (solo superadmin) |

### Route protette RBAC admin (NON DEVE raggiungere viewer azienda)

`/settings/users` � `/settings/licenses` � `/settings/billing` � `/settings/studio`

### Env / flag

| Variabile | Effetto sui test |
|-----------|------------------|
| `JWT_SECRET` | Obbligatorio backend |
| `NODE_ENV` | Seleziona config DB (`development` / `production`) |
| `DB_*` o `database.json` | Connessione SQL Server |
| `OPENAI_API_KEY` | Funzioni AI � senza chiave alcune API rispondono **503** (non confondere con 403 licenza) |
| `licensed_modules` NULL | Fail-open: tutti i moduli � impostare JSON esplicito per test �modulo bloccato� |

### Assertion rapide Playwright

```text
// UI modulo bloccato
page.getByText('Non incluso nel piano')

// API licenza
response.status() === 403 && body.code === 'MODULE_NOT_LICENSED'

// Cliente azienda
user.company_access.length >= 1 && !menu.getByText('Fatturazione')
```

---

*Aggiornare questo file quando cambiano ruoli, `KNOWN_MODULE_KEYS`, route licenziate o scope `company_access`.*
