# Architettura utenti, gerarchia e RBAC

> Documento di riferimento per rendere **robusta e affidabile** la gestione identità, deleghe e segregazione dati.  
> **Allineare** implementazione (backend + UI) e **non** duplicare regole solo lato client.  
> **Ultimo aggiornamento**: 2026-04-20.

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

**Stato attuale (lista/dettaglio audit, apr. 2026):** il predicato SQL condiviso per org + studio è in `backend/src/services/auditListRbac.service.js` (`studioScopeClause`, usato da `audit.controller` e da percorsi sync/lock collegati). Il middleware `authenticate` imposta `req.user.role` già **normalizzato in minuscolo** così varianti di casing dal DB o da token vecchi non fanno “cadere” l’utente nel ramo senza filtro studio. Ruoli non mappati esplicitamente non espandono mai la lettura a tutta l’organizzazione: default restrittivo su `created_by`.

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

## 8. Strategia prodotto (best practice per questo SGQ)

**Contesto**: PWA per consulenti ISO con **multi-tenant** a livello database (`organization_id`), **studi** operativi (`auditor_orgs`) e **clienti** auditable (`companies`). Obiettivo: **isolamento dati tra tenant**, **segregazione per studio** nella stessa org, **tracciabilità** (ISO), **minimo privilegio**.

### 8.1 Come *dovrebbe* essere la struttura utenti (modello di riferimento)

| Livello | Cosa rappresenta | Best practice |
|--------|------------------|---------------|
| **Tenant** (`organizations`) | Confine contrattuale e dati (es. “il cliente che paga il SaaS” o un’unica installazione). Gli utenti **non** attraversano mai due `organization_id` senza un ruolo di piattaforma esplicito (fuori scope MVP). | Un utente ha **sempre** un `organization_id`. Più tenant = più righe in `organizations` + provisioning (creazione org, primo admin). |
| **Studio** (`auditor_orgs`) | Team / ragione sociale interna / linea di consulenza (es. Mason vs Camellini) **nello stesso tenant**. | Separazione operativa e anagrafiche clienti (`companies.auditor_org_id`), **non** sostituisce il tenant salvo decisione commerciale di “uno studio = un contratto separato”. |
| **Azienda** (`companies`) | Cliente finale auditable. | Ogni company è legata a **uno** studio; gli audit puntano a `company_id` quando possibile. |
| **Utente** (`users`) | Login; ruolo + opzionale `auditor_org_id` (perimetro studio). | **Org admin** (admin/superadmin senza studio): gestione org. **Utenti di studio** (auditor/viewer con studio): perimetro studio. **Viewer cliente** (evoluzione): perimetro `company` via `user_company_access` (vedi §7 Fase 4). |

**Nota**: “Mason / Camellini / Franciosi” come **studi** sotto **un** `organization_id` è coerente con questo modello. Trasformarli in **tenant separati** (ciascuno con propria `organizations`) è un’**altra strategia commerciale** (multi-contratto): richiede più org nel DB + flussi di onboarding, non solo un campo in UI.

### 8.2 Cosa c’è già (implementato)

| Area | Stato |
|------|--------|
| Colonne `users.organization_id`, `users.auditor_org_id`, ruoli `admin` / `superadmin` / `auditor` / `viewer` | Presenti |
| Tabelle `organizations`, `auditor_orgs`, `companies` con collegamenti | Presenti |
| Autenticazione JWT, `GET /auth/me`, licenze moduli (`licensed_modules`) | Presenti |
| UI **Gestione utenti**: creazione, assegnazione studio, standard consentiti, disattivazione | Presente |
| Filtri RBAC su **lista/dettaglio/sync audit** e lock (predicati allineati al servizio `auditListRbac`) | Presente (da monitorare su deploy) |
| Admin “elevato” (senza studio) può gestire utenti e ruoli sensibili | Presente (policy backend) |

### 8.3 Cosa manca o è parziale (gap noti)

| Gap | Priorità tipica | Riferimento |
|-----|-----------------|-------------|
| **Stesso predicato RBAC** su *tutte* le risorse (NC, allegati, registry, checklist custom, statistiche) dove ancora usano solo `organization_id` | Alta | §5–7 |
| Ruolo **`studio_admin`** e API di delega “solo mio studio” | Media | §3–4, Fase 3 |
| Tabella **`user_company_access`** + viewer **per azienda** (cliente ERAM in sola lettura / permessi granulari) | Media–alta se serve B2B2C | Fase 4 |
| **Servizio centralizzato** `accessScope` / middleware unico su tutte le route | Alta man mano che cresce il codice | §6 |
| **Provisioning multi-tenant** (creazione nuova `organizations` da UI + utente admin) se il prodotto deve vendere “un tenant per cliente finale” | Dipende dal business | Fuori §7 fino a decisione |
| Flusso **invito email** invece di password condivise | Consigliato | §4 |
| **Audit trail** modifiche ruoli/utenti (chi ha promosso chi) | Compliance | Da definire |

### 8.4 “Abbiamo sbagliato strategia?”

**No** sul modello **tenant → studio → company → user**: è allineato a SaaS B2B per consulenza e a ISO (tracciabilità, separazione). **Sì come debito** se il mercato richiede **subito** “un tenant per ogni studio” o “un tenant per ERAM” senza aver implementato **provisioning org** e **isolamento completo** su tutti i moduli: allora non è il modello dati ad essere sbagliato, ma **il perimetro di rilascio** rispetto all’obiettivo commerciale.

**Prossima decisione prodotto** (da fissare con il committente): restare su **un tenant + più studi** oppure investire in **multi-org** (più righe `organizations`) **e** completare RBAC ovunque — le due strade possono coesistere nel tempo (prima coerenza scope, poi org aggiuntive).

### 8.5 Modello committente — tre tenant (decisione 2026-04)

**Premessa confermata**: esistono **tre tenant** distinti (tre abbonamenti / tre `organizations`). Le **licenze moduli** sono imputate al **tenant** (`organizations.licensed_modules`). **Camellini** lavora per **QS_Studio** (un solo `organization_id` per il suo account utente principale).

#### Tabella di allineamento (tenant → pagamenti → utenti)

| Tenant (esempio nome) | Ruolo commerciale | Licenze / abbonamento | Utenti tipici (esempi) | Nota prodotto / DB |
|------------------------|-------------------|------------------------|-------------------------|-------------------|
| **QS_Studio** | Tenant 1 | Moduli attivi su `organizations` dove `organization_id` = QS_Studio | **Camellini** (auditor, `users.organization_id` → QS_Studio); altri utenti QS | Account Camellini = **una** riga `users` con questo `organization_id`. |
| **MASON_Srl** (o nome reale tenant Mason) | Tenant 2 | Licenze proprie, indipendenti da QS_Studio | Auditor Mason, staff Mason | Dati e audit **non** mescolati con QS_Studio senza secondo account o feature multi-org. |
| **ERAM** | Tenant 3 | Licenze proprie | **Francioni** (auditor ERAM); utenti cliente ERAM (viewer, evoluzione) | Stesso principio: `organization_id` ERAM per Francioni. |

#### Scenari trasversali (stesso nominativo su più tenant)

| Esigenza | Approccio consigliato (oggi) | Se in futuro serve un solo login |
|----------|------------------------------|-----------------------------------|
| La stessa persona deve operare su **due** tenant (es. Camellini anche per lavori su MASON_Srl) | **Due account** (due righe `users`, eventualmente stessa email se il prodotto lo consente, o email distinte): `organization_id` diverso per ciascuno. | Membership multi-org (`user` ↔ più `organization_id`) + switch tenant in UI: **non** presente oggi; va progettato. |
| Solo **consultazione** cross-tenant da parte vostra (QS Studio / piattaforma) | Ruolo **superadmin** o operatore con accesso documentato (fuori singolo tenant) | Policy dedicate, non mescolare con auditor cliente. |

#### Checklist operativa DB (tre tenant reali)

1. In `organizations` devono comparire **tre righe** (tre `organization_id`), con `organization_code` / `organization_name` univoci (es. QS_STUDIO, MASON_SRL, ERAM).
2. Ogni utente “di quel cliente” ha `users.organization_id` uguale al tenant di riferimento.
3. **Camellini** → solo righe utente con `organization_id` = **QS_Studio** (salvo secondo account se deve lavorare anche per un altro tenant).
4. **Francioni** → `organization_id` = **ERAM** (o codice reale del terzo tenant).
5. Licenze: `PATCH /admin/licenses` (o equivalente) **per org** — eseguito nell’ambito del tenant giusto (admin di quell’org).

*Se in produzione compare ancora un solo `organization_id`, serve migrazione dati / creazione delle altre due org e riassegnazione utenti — operazione pianificata, non automatica.*

**Piano operativo dettagliato** (inventario tabelle, fasi, query di controllo): [MIGRATION_PLAN_SPLIT_TENANTS.md](MIGRATION_PLAN_SPLIT_TENANTS.md).

---

## 9. Definition of Done (modifiche che toccano RBAC)

- [ ] Stesso predicato di accesso su **tutti** i verbi HTTP per la stessa risorsa.
- [ ] Test automatici o repro per “utente studio A non accede a audit studio B” (stessa org).
- [ ] Aggiornamento di **questo file** e di [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) (piano qualità / smoke) se cambiano smoke o deploy.

---

*Documento introdotto per consolidare decisioni architetturali; aggiornarlo ad ogni cambio sostanziale a ruoli, scope o endpoint auth.*
