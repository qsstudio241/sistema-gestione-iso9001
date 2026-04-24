# Architettura utenti, gerarchia e RBAC

> Documento di riferimento per rendere **robusta e affidabile** la gestione identità, deleghe e segregazione dati.  
> **Allineare** implementazione (backend + UI) e **non** duplicare regole solo lato client.  
> **Ultimo aggiornamento**: 2026-04-24.

**Correlati**: [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) (checklist licenze/sessioni), [SCHEMA_UTENTI_CHECKLIST_SISTEMI_REPORT.md](SCHEMA_UTENTI_CHECKLIST_SISTEMI_REPORT.md) (diagrammi obiettivo prodotto), [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) (deploy e piano qualità).

---

## 1. Principi vincolanti

1. **Fonte di verità unica per i permessi** — Le API e i servizi backend decidono; la UI riflette (capabilities o equivalente da `GET /auth/me`).
2. **Separazione dei concetti** — Identità (login, org) ≠ gerarchia operativa (studio, azienda) ≠ autorizzazione (lettura/scrittura su risorse).
3. **Minimo privilegio** — Default restrittivo; ampliamenti solo espliciti (ruolo o assegnazione es. company).
4. **Scope nelle query** — Ogni operazione su dati sensibili passa da predicati coerenti (stesso modello per GET e PUT/DELETE/sync).
5. **Tracciabilità** — Creazione/modifica utenti e ruoli con audit trail (chi, quando) per conformità e supporto.

---

## 2. Modello a livelli (tenant → studio → azienda → utente)

| Livello | Entità | Ruolo |
|--------|--------|--------|
| **L0** | `organizations` | Confine **tenant**: dati e utenti non attraversano `organization_id`. |
| **L1** | `auditor_orgs` | Studio / team: insieme di consulenti e **aziende** collegate (`companies.auditor_org_id`). |
| **L2** | `companies` | Cliente dello studio; `audits.company_id` collega l'attività all'azienda. |
| **L3** | `users` | Soggetto con login; sempre in un tenant; opzionalmente `auditor_org_id` e/o assegnazioni a company (vedi evoluzione). |

**Regola di contenimento**: tutto ha `organization_id`. Ciò che è competenza dello studio deve essere filtrabile per `auditor_org_id` (e/o `company_id` dove applicabile) in modo **uniforme** su tutte le risorse (audit, NC, allegati, document registry — policy prodotto da decidere per il registry).

---

## 3. Catalogo ruoli (canonico — verificato 2026-04-24)

| Ruolo DB | Scope operativo | Note |
|----------|-----------------|------|
| **`superadmin`** | Piattaforma cross-tenant: vede tutti gli utenti e tutti gli studi di tutti i tenant. Unico che può modificare le licenze moduli (`PATCH /admin/licenses`). | Nessun `auditor_org_id`. |
| **`admin`** | Intero tenant: gestisce utenti, vede le licenze in sola lettura, crea `auditor` e `viewer`. | Nessun `auditor_org_id` (admin "elevato"). |
| **`auditor`** | Studio assegnato: audit, checklist, export, NC nel perimetro del proprio `auditor_org_id`. **Deve** avere `auditor_org_id` — validato in UI e consigliato in backend. | `auditor_org_id` obbligatorio. |
| **`viewer`** | Sola lettura nel perimetro studio (oggi) o azienda (Fase 4). | `auditor_org_id` opzionale; scope azienda via `user_company_access` non ancora implementato. |

**Nota**: evitare sinonimi ambigui tra codice e prodotto; documentare qui la mappa ufficiale ad ogni cambio ruoli.

---

## 4. Delega: chi crea / invita utenti

| Attore | Può creare o invitare |
|--------|------------------------|
| **`superadmin`** | Qualsiasi utente in qualsiasi tenant (visione piattaforma). Unico che modifica licenze. |
| **`admin`** | `auditor` e `viewer` nel proprio tenant. Può creare altri `admin` solo se è "elevated" (senza studio). |
| **`auditor`** | **Non** crea account utente; solo contenuti (audit, allegati, ecc.). |

**Best practice**: flusso a **invito** (token email + primo accesso) invece di password propagate dall'admin, quando si espone il self-service.

---

## 5. Scope per area funzionale (obiettivo di coerenza)

Per **ogni** endpoint (GET/POST/PUT/DELETE/sync/download), stesso criterio di visibilità:

| Area | Obiettivo |
|------|-----------|
| Companies | Già legate a `auditor_org_id`; mantenere. |
| Audits | Lista, dettaglio, **update**, delete, sync, lock — **stesso** filtro org + studio (+ eccezioni documentate). |
| Responses, NC, pending, allegati | Derivano dall'audit; nessun accesso se l'audit non è nello scope utente. |
| Document registry | Decisione prodotto: **solo org-wide** (solo org_admin) **oppure** filtro per studio/company — una sola policy, applicata ovunque. |
| Checklist custom | Policy già presente (legacy vs `auditor_org_id`); formalizzare come regola versionata. |
| Licenze moduli | **Lettura**: `admin` org. **Modifica**: solo `superadmin` (piattaforma). `PATCH /admin/licenses` protetto da guard `superadminOnly`. Implementato 2026-04-24. |

---

## 6. Implementazione tecnica (direzione)

1. **Servizio centralizzato** (es. `accessScope.service.js`): predicati riusabili `assertUserCanAccessAudit`, `getAuditScopeWhereClause`, estensioni per company/document.
2. **Middleware** dopo `authenticate`: es. `requireAuditAccess('read'|'write')` sulle route parametriche `:auditRef`.
3. **JWT** leggero (`user_id`, `organization_id`, `role`, `auditor_org_id`); permessi estesi opzionalmente da `GET /auth/me` (capabilities calcolate server-side).
4. **UI**: menu e azioni da capabilities — evitare divergenza con API.

**Stato attuale (24 apr. 2026):**
- Predicato SQL org + studio condiviso in `auditListRbac.service.js` (list/dettaglio/sync/lock audit).
- `authenticate` normalizza `role` in minuscolo; default restrittivo su `created_by`.
- `GET /api/v1/auditor-orgs`: `superadmin` riceve studi **cross-tenant** (tutti i tenant); `admin` solo il proprio; `auditor` solo il proprio studio. Fix 2026-04-24.
- `PATCH /admin/licenses`: guard `superadminOnly` — solo la piattaforma modifica le licenze; `admin` org legge in sola lettura. Fix 2026-04-24.
- UI Gestione Utenti: dropdown Studio filtra per `organization_id` dell'utente in modifica. Fix 2026-04-24.
- Auditor senza `auditor_org_id`: bloccato in UI (form crea + modifica) con badge visivo e tasto disabilitato. Fix 2026-04-24.

---

## 7. Piano di migrazione (fasi)

| Fase | Contenuto | Stato |
|------|-----------|-------|
| **0** | Documento + matrice permessi; fix RBAC licenze e dropdown studio cross-tenant. | ✅ Completato 2026-04-24 |
| **1** | Allineare **write path** audit (PUT/DELETE/sync/statistiche) allo stesso scope della lista/dettaglio. | In corso |
| **2** | Estendere assert scope a NC, allegati, response legate ad audit. | Backlog |
| **3** | Introdurre `studio_admin` e API creazione utenti per studio (se prodotto lo richiede). | Backlog |
| **4** | `user_company_access` + ruolo `viewer` per azienda (clienti finali in sola lettura). | Backlog |

---

## 8. Strategia prodotto (best practice per questo SGQ)

**Contesto**: PWA per consulenti ISO con **multi-tenant** a livello database (`organization_id`), **studi** operativi (`auditor_orgs`) e **clienti** auditable (`companies`). Obiettivo: **isolamento dati tra tenant**, **segregazione per studio** nella stessa org, **tracciabilità** (ISO), **minimo privilegio**.

### 8.1 Come è strutturata la gerarchia (verificato 2026-04-24)

| Livello | Cosa rappresenta | Regola |
|--------|------------------|--------|
| **Tenant** (`organizations`) | Chi paga l'abbonamento SaaS. Confine contrattuale e dati. | Un utente ha **sempre** un `organization_id`. Licenze imputate qui. |
| **Studio** (`auditor_orgs`) | Team operativo dentro il tenant. | Separazione anagrafiche clienti (`companies.auditor_org_id`). |
| **Azienda** (`companies`) | Cliente finale auditable dello studio. | Legata a **uno** studio; gli audit puntano a `company_id`. |
| **Utente** (`users`) | Login con ruolo + studio opzionale. | `auditor` deve avere studio. `viewer` scope azienda (Fase 4). |

**Caso ERAM (duplice ruolo — verificato e non bloccante)**: ERAM è sia tenant autonomo (con Franciosi come auditor interno) sia azienda cliente di Camellini (QS_Studio). Le due entità sono in tabelle separate senza FK diretta — convivono correttamente su binari paralleli.

### 8.2 Cosa c'è già (implementato — verificato 2026-04-24)

| Area | Stato |
|------|--------|
| Colonne `users.organization_id`, `users.auditor_org_id`, ruoli `admin` / `superadmin` / `auditor` / `viewer` | ✅ Presenti |
| Tabelle `organizations`, `auditor_orgs`, `companies` con collegamenti | ✅ Presenti |
| Autenticazione JWT, `GET /auth/me`, licenze moduli (`licensed_modules`) | ✅ Presenti |
| UI **Gestione utenti**: creazione, assegnazione studio, standard consentiti, disattivazione | ✅ Presente |
| Filtri RBAC su **lista/dettaglio/sync audit** e lock (predicati allineati al servizio `auditListRbac`) | ✅ Presente e verificato |
| `superadmin` senza studio: gestione utenti e ruoli sensibili cross-tenant | ✅ Presente |
| **Licenze modificabili solo da `superadmin`** (`PATCH /admin/licenses` → guard `superadminOnly`) | ✅ Implementato 2026-04-24 |
| **Dropdown Studio cross-tenant** per superadmin (filtra per tenant utente in modifica) | ✅ Implementato 2026-04-24 |
| **Validazione auditor orfano** in UI (badge ⚠, tasto disabilitato se no studio) | ✅ Implementato 2026-04-24 |

### 8.3 Cosa manca o è parziale (gap noti)

| Gap | Priorità | Riferimento |
|-----|----------|-------------|
| **Stesso predicato RBAC** su *tutte* le risorse (NC, allegati, registry, checklist custom, statistiche) | Alta | §5–7, Fase 2 |
| Tabella **`user_company_access`** + viewer **per azienda** (clienti finali in sola lettura) | Media-alta | Fase 4 |
| **Servizio centralizzato** `accessScope` / middleware unico su tutte le route | Alta man mano che cresce il codice | §6 |
| **Provisioning multi-tenant** (creazione nuova `organizations` da UI) | Dipende dal business | Fuori §7 fino a decisione |
| Flusso **invito email** invece di password condivise | Consigliato | §4 |
| **Audit trail** modifiche ruoli/utenti (chi ha promosso chi) | Compliance | Da definire |

### 8.4 Stato reale DB (verificato 2026-04-24 con query live)

| org_id | Codice | Nome | Auditor | Studio (auditor_org) |
|--------|--------|------|---------|----------------------|
| 1001 | ORG_00001 | Al.project | PS_Admin (superadmin) | AI.Admin |
| 1002 | ORG_00002 | QS_Studio | Marco Camellini | QS Studio |
| 1003 | ORG_00003 | MASON_Srl | Andrea Mason | Mason |
| 1004 | ORG_00004 | ERAM | Mauro Franciosi | ERAM |

Tutti gli auditor hanno `auditor_org_id` assegnato correttamente. Nessun orfano. Tutte le aziende clienti assegnate allo studio corretto.

### 8.5 Prossima decisione prodotto

**Restare su un tenant per studio** (modello attuale, corretto) **oppure** investire in provisioning multi-org da UI — le due strade coesistono nel tempo. Priorità attuale: completare RBAC su tutte le risorse (Fase 2) prima di aggiungere nuovi tenant.

---

## 9. Definition of Done (modifiche che toccano RBAC)

- [ ] Stesso predicato di accesso su **tutti** i verbi HTTP per la stessa risorsa.
- [ ] Test automatici o repro per "utente studio A non accede a audit studio B" (stessa org).
- [ ] Aggiornamento di **questo file** e di [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) (piano qualità / smoke) se cambiano smoke o deploy.

---

*Documento introdotto per consolidare decisioni architetturali; aggiornarlo ad ogni cambio sostanziale a ruoli, scope o endpoint auth.*
