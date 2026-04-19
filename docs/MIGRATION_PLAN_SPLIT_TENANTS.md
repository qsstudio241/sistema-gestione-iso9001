# Piano di migrazione — da un tenant unico a più organizzazioni (tenant)

> **Scopo**: allineare il database allo schema commerciale (**QS_Studio**, **MASON_Srl**, **ERAM** come tenant distinti con abbonamenti/licenze propri) quando oggi i dati risiedono ancora sotto **un solo** `organization_id` (es. `1` = `DEFAULT_ORG`).  
> **Principio**: nessuno script automatico senza **mappatura business** approvata; backup obbligatorio; prove su **copia** del DB prima della produzione.

**Correlati**: [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) §8.5, [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), [DATABASE.md](DATABASE.md).

---

## 1. Perché oggi la struttura risulta “sbagliata”

| Aspetto | Stato tipico (pre-migrazione) | Stato obiettivo |
|--------|--------------------------------|-----------------|
| `organizations` | Una riga (es. `organization_id = 1`) | Tre (o più) righe, una per tenant commerciale |
| Abbonamenti / `licensed_modules` | Un solo contenitore | Uno per tenant che paga |
| Utenti | Tutti `users.organization_id = 1` | `organization_id` = tenant di appartenenza |
| Audit, checklist, ecc. | `organization_id = 1` ovunque | Partizionati per tenant |

Il modello dati **supporta** già il multi-tenant; manca la **suddivisione dei dati** e l’inserimento delle **nuove organizzazioni**.

---

## 2. Inventario tabelle con `organization_id` (o equivalente)

Da migrare o verificare in coerenza (elenco operativo; controllare su SQL Server con `INFORMATION_SCHEMA` se il vostro schema ha varianti):

| Area | Tabella / nota |
|------|----------------|
| Core | `organizations`, `users` |
| Studio | `auditor_orgs` (**FK a `organizations`**) — ogni studio appartiene a **un** tenant |
| Operativo | `audits`, `import_jobs` |
| Config org | `notifications_config`, `audit_daily_sequences` |
| Template / checklist | `custom_checklists`, `report_template_assignments`; `report_templates` (può avere `organization_id` NULL = sistema) |
| Altro modulo | `document_registry`, `qualifications`, `risks`, `objectives` |
| Legacy / opzionale | `user_org_roles` (`org_id`) se popolata |

Tabelle **senza** `organization_id` diretto ma **legate al tenant** via catena:

| Tabella | Collegamento |
|---------|--------------|
| `companies` | `auditor_org_id` → `auditor_orgs` → `organization_id` |
| `subscriptions` | `auditor_org_id` → `auditor_orgs` |
| `audit_responses`, `attachments`, NC, … | tramite `audits.audit_id` / join su audit |

**Regola**: dopo aver spostato `audits.organization_id` e `auditor_orgs.organization_id` in modo coerente, molte dipendenze restano consistenti; andare sempre verificato con query di controllo (§6).

---

## 3. Regole di business da definire **prima** dello SQL

Compilare una tabella (Excel o foglio interno) con almeno:

1. **Nuove organizzazioni**: `organization_code`, `organization_name` (es. `QS_STUDIO`, `MASON_SRL`, `ERAM`).
2. **Mapping `auditor_orgs`**: per ogni riga in `auditor_orgs` oggi su org `1`, indicare il **nuovo** `organization_id` di destinazione (o creare nuove righe `auditor_orgs` per tenant nuovi e disattivare le vecchie).
3. **Mapping utenti**: ogni `user_id` → `organization_id` finale (es. Camellini → QS_Studio; Francioni → ERAM).
4. **Mapping audit** (se non deducibile solo da `company_id` / `auditor_org`): elenco `audit_id` → `organization_id` oppure regole (es. “tutti gli audit con `company_id` in società dello studio X → org Y”).
5. **Licenze**: per ogni nuovo tenant, valori `licensed_modules` / default da copiare dall’org 1 o da definire a mano.

Senza questo documento la migrazione è **pericolosa**.

---

## 4. Fasi operative consigliate

### Sequenza a due passi (organizzazioni → auditor org)

**Sì, è l’ordine consigliato** quando si lavora a mano o con script separati:

1. **Passo 1 — `organizations`**: portare il catalogo tenant allo stato finale (righe `organization_id` / `organization_code` / nome / email contatto / `is_active`, più `licensed_modules` e `audit_report_prefix` se già decisi). Verificare con `SELECT * FROM organizations ORDER BY organization_id` prima di proseguire.  
   Se oggi c’è **una sola riga** (`DEFAULT_ORG`, `organization_id = 1`), servono **`UPDATE` della riga 1** e **`INSERT` delle altre organizzazioni** — altrimenti mancano i tenant referenziati dai codici `ORG_00002`… e la fase 2 va in **FK 547**. Gli `organization_id` delle nuove righe **non devono** essere necessariamente 2, 3, 4 (spesso l’IDENTITY salta, es. 1002, 1003, 1004): conta il **`organization_code`**. Script pronto: `database/scripts/split_tenants_phase1_insert_four_organizations.sql`.
2. **Passo 2 — `auditor_orgs`**: aggiornare solo `auditor_orgs.organization_id` in base alla mappatura “questo studio appartiene a questo tenant”. `companies` e `subscriptions` restano legate a `auditor_org_id` (stesso `id` studio); cambia solo a quale `organizations` punta lo studio.

**Perché prima le org**: così ogni `UPDATE` su `auditor_orgs` usa `organization_id` già esistenti e stabili (es. nel vostro schema: `ORG_00002` = QS_Studio, `ORG_00003` = MASON_Srl, `ORG_00004` = ERAM, `ORG_00001` = Al.project). I passi successivi (utenti, audit, satelliti) possono seguire in un terzo momento, sempre dopo aver controllato coerenza studio ↔ tenant.

**Al.project e `organization_id = 1`**: se il **1** è vissuto come residuo del monolite e si preferisce **allineare numericamente** Al.project a **1001** (sempre `ORG_00001`), usare lo script opzionale `split_tenants_optional_renumber_org1_to_1001.sql` dopo aver consolidato le quattro org (e preferibilmente dopo aver rivisto `auditor_orgs`), così amministratore piattaforma e tenant cliente non condividono più il numero “speciale” 1 a livello semantico.

Script dedicato al **solo passo 2** (template da adattare): `database/scripts/split_tenants_phase2_map_auditor_orgs_template.sql`.

### Fase A — Preparazione (nessuna modifica a produzione)

- [ ] Backup completo del database (`.bak` + verifica restore su istanza di test).
- [ ] Esportare elenchi: `SELECT * FROM organizations`; `auditor_orgs`; `users`; conteggi per `audits.organization_id`.
- [ ] Compilare la mappatura (§3).
- [ ] Eseguire **tutta** la migrazione su **copia** del DB e validare (§6).

### Fase B — Inserimento nuove organizzazioni

- [ ] `INSERT` nelle `organizations` per **MASON_Srl** e **ERAM** (se non esistono), con `organization_code`, `organization_name`, `is_active = 1`.
- [ ] Opzionale: rinominare l’org `1` da `DEFAULT_ORG` a **QS_Studio** (solo nome/codice, stesso `organization_id` = minor rischio per FK).
- [ ] Impostare `licensed_modules` / `audit_report_prefix` per ciascun tenant come da contratto.

### Fase C — Spostare “perimetro studio” (`auditor_orgs`)

- [ ] Per ogni `auditor_orgs` che deve passare a un altro tenant: `UPDATE auditor_orgs SET organization_id = @nuovo_org WHERE id = @auditor_org_id` (solo se la mappatura lo prevede).
- [ ] Attenzione: `companies` e `subscriptions` puntano a `auditor_org_id`; non rompere i FK. Verificare che non esistano vincoli incoerenti tra `auditor_orgs.organization_id` e i dati attesi.

### Fase D — Utenti

- [ ] `UPDATE users SET organization_id = @target WHERE user_id = ...` secondo mappatura (Camellini → QS, Francioni → ERAM, ecc.).
- [ ] Allineare `users.auditor_org_id` se gli studi sono stati duplicati o spostati.

**Login e email**: oggi il login può risolvere l’utente solo con `email` se l’email è **unica** nel DB. Se dopo la migrazione la **stessa email** esiste in **due** tenant, il client deve inviare anche `organization_id` al login (già supportato nel backend). Evitare duplicati di email finché la UI non gestisce la scelta org.

### Fase E — Audit e tabelle con `organization_id` diretto

- [ ] `UPDATE audits SET organization_id = @target WHERE ...` secondo regole (per audit_id, o tramite join su `companies` → `auditor_orgs`).
- [ ] Aggiornare in blocco: `custom_checklists`, `import_jobs`, `document_registry`, `notifications_config`, `qualifications`, `risks`, `objectives`, `audit_daily_sequences`, `report_template_assignments` dove il dato appartiene a un tenant spostato.

Ordine suggerito: prima **auditor_orgs** e **users**, poi **audits** (per non lasciare audit con `organization_id` incoerente con `created_by`).

### Fase F — Verifiche e smoke

- [ ] Query di consistenza (§6).
- [ ] Login per ogni tenant di test; `GET /auth/me`; lista audit; creazione audit di prova.
- [ ] Deploy backend già allineato a RBAC; nessun secret in repo.

### Fase G — Produzione

- [ ] Finestra di manutenzione breve o basso traffico.
- [ ] Ripetere backup immediatamente prima del run.
- [ ] Eseguire script in **transazione** dove possibile (`BEGIN TRAN` / `COMMIT` / `ROLLBACK` su errore).

---

## 5. Script SQL nel repository (split tenant)

**Non eseguire in cieco**: compilare prima le tabelle di mappatura (`migration_split_*`), backup, prova su copia DB.

| File | Contenuto |
|------|-----------|
| `database/scripts/split_tenants_01_create_mapping_tables.sql` | Crea tabelle di staging: `migration_split_meta`, `migration_split_new_orgs`, `migration_split_auditor_org`, `migration_split_user`, `migration_split_audit_override`. |
| `database/scripts/split_tenants_02b_export_for_mapping.sql` | **Sola lettura**: esporta `organizations`, `auditor_orgs`, `users`, sintesi audit, candidati override, email duplicate; genera bozze `INSERT` per `migration_split_auditor_org` e `migration_split_user`. |
| `database/scripts/split_tenants_02c_seed_from_export_2026.sql` | **Esempio compilato** da export reale (DEFAULT_ORG → QS_STUDIO; MASON_SRL + ERAM; mapping auditor/user). Verificare `organization_id` 2/3 prima dell’apply. |
| `database/scripts/split_tenants_02_seed_template.sql` | Template commentato per `INSERT` nella mappatura (rinomina QS Studio, nuove org, mapping auditor/user/audit). |
| `database/scripts/split_tenants_03_apply_migration.sql` | `BEGIN TRAN`: INSERT nuove `organizations`, rinomina legacy, `UPDATE` auditor_orgs/users/audits/satelliti, verifiche FK, `COMMIT`. |
| `database/scripts/split_tenants_04_verify_queries.sql` | Query di controllo post-migrazione (read-only). |
| `database/scripts/split_tenants_05_verify_all_linkages.sql` | **Verifica legami** post-split: organizations, `auditor_orgs`, `users`, `companies`, `subscriptions`, `audits`, `user_org_roles`, tabelle satellite, mismatch audit vs company, email duplicate, incrocio email studio/tenant. |
| `database/scripts/split_tenants_06_verify_content_modules.sql` | **Verifica contenuti** per tenant: conteggi (checklist, RTA, template, document_registry, import, qualifiche, rischi, obiettivi) + mismatch checklist↔studio, RTA↔checklist, documenti↔società/studio. |
| `database/scripts/split_tenants_phase1_insert_four_organizations.sql` | **Solo passo 1** quando esiste solo `DEFAULT_ORG`: `UPDATE` org `1` → `ORG_00001` / Al.project + tre `INSERT` (`ORG_00002` QS_Studio, `ORG_00003` MASON_Srl, `ORG_00004` ERAM); copia opzionale `licensed_modules` dalla org 1. |
| `database/scripts/split_tenants_optional_renumber_org1_to_1001.sql` | **Opzionale**: sposta il tenant Al.project da `organization_id = 1` a **1001** (stesso `ORG_00001`), aggiornando tutte le FK note + tabelle staging `migration_split_*`. Utile se **1** è vissuto come monolite e si vuole allineare a **1002+** senza cambiare codici. |
| `database/scripts/split_tenants_patch_auditor_orgs_ai_admin_eram.sql` | Patch: rinomina studio interno in **AI.Admin**; aggiunge riga `auditor_orgs` per tenant **1004** (ERAM) con email Mauro Franciosi. |
| `database/scripts/split_tenants_fix_ai_admin_org_to_org00001.sql` | Corregge **AI.Admin** (`auditor_orgs.id = 1`): `organization_id` → tenant **ORG_00001** (Al.project), se ancora erroneamente su ORG_00002. |
| `database/scripts/split_tenants_fix_users_audits_org_mismatch.sql` | Dopo verifica §5/§9: allinea `users.organization_id` allo studio (`auditor_orgs`); allinea `audits.organization_id` alla catena `companies` → `auditor_orgs`. |
| `database/scripts/split_tenants_fix_custom_checklists_org_from_studio.sql` | Dopo verifica §6: allinea `custom_checklists.organization_id` al tenant dello studio; allinea `report_template_assignments` alla checklist. |
| `database/scripts/split_tenants_fix_document_registry_organization.sql` | Riassegna `document_registry.organization_id` con precedenza: `auditor_org_id` → società → `created_by` (utente). |
| `database/scripts/split_tenants_reassign_all_documents_to_camellini.sql` | Se **tutti** i documenti sono di Marco: imposta su tutte le righe `organization_id`, `auditor_org_id`, `created_by` (e opz. `company_id`) con DECLARE verificabili. |
| `database/scripts/split_tenants_08_nullable_tenant_fk_audit.sql` | **Audit read-only** colonne nullable legate a tenant/società/creatore: catalogo `INFORMATION_SCHEMA`, conteggi NULL su tabelle note, campioni candidati a compilazione (senza UPDATE automatici). |
| `database/scripts/split_tenants_fix_risks_objectives_org_from_created_by.sql` | Allinea `risks` / `objectives`.`organization_id` al tenant di `created_by` se mismatch (es. Marco ancora su 1001). |
| `database/scripts/split_tenants_fix_audits_org_from_created_by_optional.sql` | **Opzionale**: allinea `audits.organization_id` al creatore; blocchi commentati (tutti i mismatch vs solo escluso `created_by = 1` su org 1001). |

**Completezza dipendenze**: dopo split tenant, oltre alle verifiche §05–06, eseguire `split_tenants_08_nullable_tenant_fk_audit.sql` per individuare NULL “compilabili” solo dove la policy business lo consente (evitare mass update ciechi).
| `database/scripts/split_tenants_phase2_map_auditor_orgs_template.sql` | **Solo passo 2**: `UPDATE auditor_orgs` verso i tenant del passo 1. Risolve gli `organization_id` dai `organization_code` e **blocca** l’esecuzione se manca un codice (evita errore **547** / `FK_auditor_orgs_organization`). |

**Errore 547 su `UPDATE auditor_orgs`**: di solito **mancano righe in `organizations`** (DB ancora con un solo tenant) oppure `organization_id` / `organization_code` non coincidono. Verificare: `SELECT organization_id, organization_code FROM organizations ORDER BY organization_id;` — se c’è una sola riga, eseguire prima **`split_tenants_phase1_insert_four_organizations.sql`** (o INSERT manuali equivalenti), poi la fase 2.

**Nota su approccio “monolite” vs passi**: `split_tenants_03_apply_migration.sql` unisce creazione org da staging e propagazione; se le **`organizations` sono già definite** (come tabella a quattro tenant con codici `ORG_0000x`), **non** serve ripetere INSERT org da quello script: usare il passo 2 dedicato e, più avanti, utenti/audit come da §4 Fasi D–E.

**Note**: `notifications_config` ha `UNIQUE(organization_id)`: dopo lo split potrebbe servire **clonare** le righe per i nuovi tenant (non incluso nello script automatico). `report_template_assignments` con solo `standard_id` (senza `custom_checklist_id`) potrebbe richiedere allineamento manuale.

Esempio storico (pseudocodice):

```sql
SET XACT_ABORT ON;
BEGIN TRANSACTION;
-- INSERT INTO organizations ...
-- UPDATE users / auditor_orgs / audits ...
COMMIT TRANSACTION;
```

---

## 6. Query di controllo post-migrazione

```sql
-- Nessun audit con organization_id che non esiste
SELECT a.audit_id FROM audits a
LEFT JOIN organizations o ON a.organization_id = o.organization_id
WHERE o.organization_id IS NULL;

-- Utenti con org inesistente
SELECT u.user_id FROM users u
LEFT JOIN organizations o ON u.organization_id = o.organization_id
WHERE o.organization_id IS NULL;

-- Conteggi per tenant
SELECT organization_id, COUNT(*) FROM audits WHERE is_deleted = 0 GROUP BY organization_id;
SELECT organization_id, COUNT(*) FROM users GROUP BY organization_id;

-- Coerenza auditor_org -> organization
SELECT ao.id, ao.name, ao.organization_id, o.organization_name
FROM auditor_orgs ao
JOIN organizations o ON ao.organization_id = o.organization_id;
```

---

## 7. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Orfani FK | Transazioni + query di verifica prima del COMMIT |
| Stesso utente su due tenant | Due `users` con email diverse **oppure** login con `organization_id` + UX chiara |
| Numerazione audit (`audit_number`, `audit_daily_sequences`) | Verificare unicità per org dopo lo split |
| Client offline / PWA | Gli utenti devono **rifare login** nel tenant corretto; possibile reset cache app |
| Licenze | `licensed_modules` per ogni nuova riga `organizations` |

---

## 8. Cosa **non** è questa migrazione

- Non sostituisce la **feature** “un utente, più tenant con switch” (membership multi-org): resta fuori scope; qui si parla solo di **ripartizione dati** tra `organization_id` esistenti nel modello.
- Non modifica automaticamente il **frontend** per creare nuovi tenant: serve processo operativo o sviluppo dedicato (provisioning).

---

*Documento operativo: aggiornare dopo ogni migrazione reale (data, ambiente, esito).*
