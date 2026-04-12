# Architettura utenti, gerarchia e RBAC

> Documento di riferimento per rendere **robusta e affidabile** la gestione identità, deleghe e segregazione dati.  
> **Allineare** implementazione (backend + UI) e **non** duplicare regole solo lato client.  
> **Ultimo aggiornamento**: 2026-04-12.

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
| **L2** | `companies` | Cliente dello studio; `audits.company_id` collega l’attività all’azienda. |
| **L3** | `users` | Soggetto con login; sempre in un tenant; opzionalmente `auditor_org_id` e/o assegnazioni a company (vedi evoluzione). |

**Regola di contenimento**: tutto ha `organization_id`. Ciò che è competenza dello studio deve essere filtrabile per `auditor_org_id` (e/o `company_id` dove applicabile) in modo **uniforme** su tutte le risorse (audit, NC, allegati, document registry — policy prodotto da decidere per il registry).

---

## 3. Catalogo ruoli consigliato (canonico)

Mappatura evolutiva rispetto ai valori DB attuali (`admin`, `superadmin`, `auditor`, `viewer`):

| Ruolo canonico | Ruolo DB / stato attuale | Scope |
|----------------|-------------------------|--------|
| **org_admin** | `admin` con `auditor_org_id` NULL (e policy per `superadmin` da uniformare) | Intero tenant; licenze; utenti globali; visione trasversale se richiesta dal business. |
| **studio_admin** | *Da introdurre* oppure delega esplicita dall’org_admin | Solo `auditor_org_id` assegnato; gestione utenti dello studio e anagrafiche nel perimetro studio. |
| **auditor** | `auditor` + `auditor_org_id` | Lavoro operativo: audit, checklist, export, NC nel perimetro dello studio (stesso predicato su lettura e scrittura). |
| **company_viewer** | `viewer` (da specializzare) | Solo lettura su risorse legate a `company_id` assegnate (`user_company_access` quando attivo). |

**Nota**: evitare sinonimi ambigui tra codice e prodotto; documentare qui la mappa ufficiale ad ogni cambio ruoli.

---

## 4. Delega: chi crea / invita utenti

| Attore | Può creare o invitare |
|--------|------------------------|
| **org_admin** | Qualsiasi ruolo nel tenant (con policy per altri org_admin); assegnazione a `auditor_org`. |
| **studio_admin** | Solo utenti nel proprio studio: `auditor`, `company_viewer` (mai org_admin salvo eccezione documentata). |
| **auditor** | **Non** crea account utente; solo contenuti (audit, allegati, ecc.). |

**Best practice**: flusso a **invito** (token email + primo accesso) invece di password propagate dall’admin, quando si espone il self-service.

---

## 5. Scope per area funzionale (obiettivo di coerenza)

Per **ogni** endpoint (GET/POST/PUT/DELETE/sync/download), stesso criterio di visibilità:

| Area | Obiettivo |
|------|-----------|
| Companies | Già legate a `auditor_org_id`; mantenere. |
| Audits | Lista, dettaglio, **update**, delete, sync, lock — **stesso** filtro org + studio (+ eccezioni documentate). |
| Responses, NC, pending, allegati | Derivano dall’audit; nessun accesso se l’audit non è nello scope utente. |
| Document registry | Decisione prodotto: **solo org-wide** (solo org_admin) **oppure** filtro per studio/company — una sola policy, applicata ovunque. |
| Checklist custom | Policy già presente (legacy vs `auditor_org_id`); formalizzare come regola versionata. |
| Licenze moduli | Solo org_admin (allineato a Sprint 8). |

---

## 6. Implementazione tecnica (direzione)

1. **Servizio centralizzato** (es. `accessScope.service.js`): predicati riusabili `assertUserCanAccessAudit`, `getAuditScopeWhereClause`, estensioni per company/document.
2. **Middleware** dopo `authenticate`: es. `requireAuditAccess('read'|'write')` sulle route parametriche `:auditRef`.
3. **JWT** leggero (`user_id`, `organization_id`, `role`, `auditor_org_id`); permessi estesi opzionalmente da `GET /auth/me` (capabilities calcolate server-side).
4. **UI**: menu e azioni da capabilities — evitare divergenza con API.

---

## 7. Piano di migrazione (fasi)

| Fase | Contenuto |
|------|-----------|
| **0** | Questo documento + matrice permessi in roadmap; fix bug naming (`isOrgWideAdmin` vs `isSuperadmin` in auditor-org list). |
| **1** | Allineare **write path** audit (PUT/DELETE/sync/statistiche) allo stesso scope della lista/dettaglio. |
| **2** | Estendere assert scope a NC, allegati, response legate ad audit. |
| **3** | Introdurre `studio_admin` e API creazione utenti per studio (se prodotto lo richiede). |
| **4** | `user_company_access` + ruolo `company_viewer` per clienti finali. |

---

## 8. Definition of Done (modifiche che toccano RBAC)

- [ ] Stesso predicato di accesso su **tutti** i verbi HTTP per la stessa risorsa.
- [ ] Test automatici o repro per “utente studio A non accede a audit studio B” (stessa org).
- [ ] Aggiornamento di **questo file** e di [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) (piano qualità / smoke) se cambiano smoke o deploy.

---

*Documento introdotto per consolidare decisioni architetturali; aggiornarlo ad ogni cambio sostanziale a ruoli, scope o endpoint auth.*
