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

## 5. Script SQL — solo scheletro (da adattare)

**Non eseguire in cieco**: sostituire ID e condizioni con la mappatura reale.

```sql
-- Esempio: inserire due tenant (ID dipendono da IDENTITY; usare SCOPE_IDENTITY() o SELECT dopo INSERT)

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- INSERT INTO organizations (organization_code, organization_name, is_active, ...)
-- VALUES ('MASON_SRL', N'MASON Srl', 1, ...);

-- UPDATE users SET organization_id = @id_qs_studio WHERE user_id IN (...);
-- UPDATE auditor_orgs SET organization_id = @id_mason WHERE id IN (...);
-- UPDATE audits SET organization_id = @id_eram WHERE audit_id IN (...);

COMMIT TRANSACTION;
```

Generare gli script finali **dopo** la tabella di mappatura e revisione con il DBA.

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
