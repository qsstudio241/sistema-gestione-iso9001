# Guida agenti — Scadenze, alert e tipologie documento

> **Per chi modifica codice** senza ri-analizzare il dominio.  
> Ultimo aggiornamento: 2026-06-02 · commit feature `06c8cf7` (P0–P3 tipi doc + P0–P2 alert).

**Non confondere:** scadenza del documento ? regola di reminder email ? priorità UI/roadmap.

---

## 1. Modello a 3 livelli

| Livello | Cosa rappresenta | Dove vive | Esempio |
|---------|------------------|-----------|---------|
| **1 — Scadenza (dato)** | Data fine validità del singolo documento | `document_registry.expiry_date` (+ calcolo da `doc_type_config.default_expiry_months` al rilascio) | Procedura PG-012 scade il 15/09/2026 |
| **2 — Regole reminder (quando avvisare)** | Soglie giorni prima/dopo scadenza; curva escalation | `notifications_config`, `doc_escalation_profile.rules_json`, helper `alertSchedulerHelpers.js` | Email a 35, 28, 21… giorni e promemoria giornaliero post-scadenza |
| **3 — Destinatari (a chi)** | Rubrica NC, email org, opzionale responsabile doc | `notification_contacts`, `notifications_config.recipients_email`, `document_registry.responsible` (solo se email) | Referente attuazione NC + CC studio |

**Finestra operativa unificata:** `alert_days_1` (default 30) definisce:
- quanti giorni avanti mostrare documenti “urgenti” in **Home**, **Registro documenti**, query scheduler;
- soglia minima inclusa nella curva escalation (documenti e NC senza `due_date` “aperte da N giorni”).

**`alert_days_2`:** seconda soglia org (tipico 7); usata nelle curve NC e documenti, non sostituisce `alert_days_1`.

**Priorità roadmap (P0/P1/P2):** backlog prodotto in `PROJECT_ROADMAP.md` — **non** mappare su colonne DB alert.

---

## 2. Tabelle DB chiave

### `doc_type_config` (051 + 077)

Per org: prefisso codice, autonumerazione, contatore, scadenza default per tipo.

| Colonna | Ruolo |
|---------|--------|
| `doc_type` | Chiave canonica snake_case (`procedura`, `modulo`, …) — vedi `app/src/data/documentTypes.js` |
| `prefix` | Prefisso codice (es. `PG`) |
| `auto_number` | Se generare `doc_code` automaticamente |
| `next_number` | Contatore atomico NNN in `PREFISSO-NNN` |
| `default_expiry_months` | Mesi aggiunti a `issue_date` se `expiry_date` vuota al rilascio |

### `notifications_config` (030 + 080)

Una riga per org — configurazione alert email e flag documenti.

| Colonna | Ruolo |
|---------|--------|
| `recipients_email` | Destinatari default (virgola/punto e virgola) — obbligatori in UI |
| `alert_days_1` / `alert_days_2` | Soglie org (30 / 7 default) |
| `send_time` | Orario cron documenti (`HH:MM`, timezone server Node) |
| `alert_doc_expiry` / `alert_nc_open` / `alert_qualif_expiry` | Abilitazione per categoria |
| `enabled` | Master switch org |
| `doc_escalation_enabled` | Curva escalation documenti (080) |
| `doc_use_legacy_digest` | Se true: un’email riepilogo/giorno invece di escalation per soglia |
| `doc_notify_responsible` | Se true e `responsible` contiene email valida ? destinatario primario |
| `doc_escalation_profile_id` | FK profilo default org (fallback se nessun profilo per tipo) |

### `doc_escalation_profile` (080)

Profili curva reminder per tipo documento.

| Colonna | Ruolo |
|---------|--------|
| `doc_type` | `NULL` = default org; altrimenti match su `document_registry.doc_type` |
| `rules_json` | JSON es. `{"thresholds":[35,28,21,14,7,3,1]}` — se assente usa default helper |
| Risoluzione | Profilo per tipo ? profilo default (`doc_type IS NULL`) ? `doc_escalation_profile_id` |

### `doc_notification_log` (079)

Anti-duplicati invii documenti. UNIQUE su `(document_id, recipient_email, alert_date, threshold_days)`.  
`threshold_days = -1` = promemoria giornaliero post-scadenza.

### `nc_notification_log` (074)

Anti-duplicati NC/azioni. UNIQUE su `(entity_type, entity_id, recipient_email, alert_date, threshold_days)`.  
`entity_type` ? `nc` | `action`.

### Correlati (NC escalation)

- `notification_contacts` — rubrica referenti (tab Notifiche)
- `non_conformities.responsible_contact_id` / `verification_contact_id`
- `nc_actions.responsible_contact_id`

---

## 3. File codice chiave

### Scheduler e invio email (solo VPS)

| File | Ruolo |
|------|--------|
| `backend/src/services/alertScheduler.js` | Cron: documenti (`send_time`), NC (+5 min), norme, knowledge |
| `backend/src/services/alertSchedulerHelpers.js` | Curve soglie, `matchDocAlertRule`, `matchNcAlertRule`, parse email |
| `backend/src/services/docAlertEscalation.service.js` | Escalation email documenti + log `doc_notification_log` |
| `backend/src/services/ncAlertEscalation.service.js` | Escalation NC/azioni + log `nc_notification_log` |
| `backend/src/services/alertMail.service.js` | SMTP via nodemailer |
| `backend/src/server.js` | Avvia `startAlertScheduler()` all’boot |

**Env VPS:** `ALERT_ENABLED=true`, `NC_ALERT_ENABLED=true`, `SMTP_*`. Senza scheduler attivo sul VPS **nessuna email** (Netlify non esegue cron).

### API configurazione

| Route | Controller |
|-------|------------|
| `GET/PUT /notifications-config` | `notifications.controller.js` |
| `GET/PUT /doc-type-config` | `organization.controller.js` |
| `GET /alerts`, `GET /alerts/count` | `alert.controller.js` (badge sidebar; doc count usa 30 gg fissi — vedi gap) |

### Tipi documento e codici

| File | Ruolo |
|------|--------|
| `app/src/data/documentTypes.js` | Fonte unica tipi UI (snake_case) |
| `app/src/data/documentTypeSchemas.js` | Campi per tipo, prompt AI |
| `backend/src/utils/docTypeConfigHelpers.js` | Migrazione etichette legacy ? canonico |
| `backend/src/services/docCodeGenerator.service.js` | `doc_code` + `expiry_date` da `default_expiry_months` |

### UI

| Route / componente | Ruolo |
|--------------------|--------|
| `/settings/studio` ? tab **Documenti** | `StudioSettingsPage.jsx` ? `TabDocumenti`: prefissi, autonum, `default_expiry_months` |
| `/settings/studio` ? tab **Notifiche** | Link + pannello verso pagina dedicata |
| `/settings/notifications` | `NotificationsSettingsPage.jsx`: soglie, toggle escalation, digest legacy |
| `NotificationContactsPanel.jsx` | Rubrica referenti NC (anche in Studio tab Notifiche) |
| `DocumentRegistry.jsx` | Filtri scadenza con `alert_days_1` da API config |
| `HomePage.jsx` | Widget urgenti con `alert_days_1` |

### Test utili

- `backend/src/services/alertSchedulerHelpers.test.js`
- `backend/src/services/docAlertEscalation.service.test.js`
- `backend/src/services/alertScheduler.docAlerts.test.js`
- `app/src/tests/documentTypesAlignment.test.js`

---

## 4. Migrazioni numerate

| # | File | Cosa fa |
|---|------|---------|
| **051** | `051_doc_type_config.sql` | Crea `doc_type_config` (prefisso, autonumerazione per org+tipo) |
| **076** | `076_sgq_3834_tree_template.sql` | Template albero `sgq_3834_v1` (ISO 3834-2) — **non** alert; legato sessione tipi doc P0 |
| **077** | `077_doc_type_config_counters_expiry.sql` | Aggiunge `next_number`, `default_expiry_months`, `updated_at` |
| **079** | `079_doc_notification_log.sql` | Tabella log anti-duplicati alert documenti |
| **080** | `080_doc_escalation.sql` | `doc_escalation_profile` + colonne doc su `notifications_config` |

**Correlata NC:** **074** (`nc_notification_log` + FK contatti NC).

Script VPS esempio: `backend/scripts/run-migration-051-vps.js`; per 077–080 eseguire SQL su VPS come da `docs/how-to/database-migrations.md` (non tutti hanno runner dedicato).

---

## 5. Deploy

| Target | Cosa deploya | Alert |
|--------|--------------|-------|
| **Netlify** | Solo frontend React (`app/`) | Nessun cron — legge `/alerts` via API |
| **VPS** | Backend Node `/var/www/sgq-backend` | Scheduler + SMTP; restart `sgq-backend` dopo deploy |
| **DB** | SQL Server remoto | Migrazioni **manuali** (script Node o SQL diretto) — non automatiche da Netlify |

Flusso tipico: `git push` ? deploy Netlify auto ? `deploy-controllers-to-vps.ps1` + migrazioni mancanti + restart backend.  
Dettaglio: `docs/how-to/deploy.md`, `docs/how-to/DEPLOY_BACKEND_VPS.md`.

---

## 6. Config operativa

### `alert_days_1` unificato

Usato coerentemente in: escalation documenti (finestra query + soglia curva), escalation NC (`open_stale`), Home/Registro (se API config caricata).

**Eccezione nota:** `alert.controller.js` usa ancora costante 30 gg per badge `/alerts/count` — allineamento backlog.

### Curva escalation documenti (default)

Se `rules_json` assente: `[35, 28, 21, 14, 7, 3, 1]` merge con `alert_days_1`, `alert_days_2`, 14, 7, 1 (deduplicati, ordine decrescente).

Documenti eleggibili: `status NOT IN ('obsoleto')`, `expiry_date` valorizzata, entro finestra `alert_days_1`.  
Stati esclusi dal match regola: `obsoleto`, `bozza`, `in_approvazione`.

Post-scadenza: un promemorio/giorno/destinatario (`threshold_days = -1`).

### `default_expiry_months`

Configurato per tipo in tab Studio ? Documenti. Applicato in creazione/rilascio quando manca `expiry_date` esplicita (`docCodeGenerator.service.js`).

### Modalità legacy digest

`doc_use_legacy_digest = 1`: una email riepilogativa/giorno a `recipients_email` (comportamento pre-P2). Disattivare per escalation per soglia.

### Orari job

- Documenti: `notifications_config.send_time`
- NC escalation: `send_time + 5 min`
- NC due alert legacy: cron fisso 08:05 se `NC_ALERT_ENABLED` (coesiste con escalation 074)

---

## 7. Gap e limitazioni note

| Gap | Dettaglio |
|-----|-----------|
| **UI profili escalation per doc_type** | Tabella e backend pronti; **manca CRUD UI** per `doc_escalation_profile` — oggi solo default helper + eventuale seed SQL |
| **Responsabile documento** | `doc_notify_responsible` invia solo se `responsible` **è un indirizzo email** (non lookup personale/rubrica) |
| **Badge `/alerts/count`** | Finestra 30 gg hardcoded, non legge `alert_days_1` live |
| **Cartelle / norme** | `doc_type=folder` senza lifecycle scadenza SGQ; norme hanno vigore normativo separato (`type_specific_data.validity_status`) |
| **Qualifiche saldatura** | `alert_qualif_expiry` flag presente; copertura scheduler parziale vs documenti/NC |
| **Timezone** | Cron usa ora locale server VPS — documentare in ops |
| **Duplicati tipi legacy** | GET `doc-type-config` auto-migra etichette italiane ? snake_case (`docTypeConfigHelpers.js`) |

---

## 8. Verifica rapida (checklist agente)

- [ ] `documentTypes.js` e `documentTypeSchemas.js` (app + backend mirror) allineati su nuovo tipo
- [ ] Riga `doc_type_config` per org con `prefix` / `default_expiry_months` sensati
- [ ] Migrazioni 077–080 applicate su DB target
- [ ] `notifications_config.enabled=1`, destinatari compilati, `alert_doc_expiry=1`
- [ ] VPS: `ALERT_ENABLED=true`, SMTP ok, backend riavviato (`app.log` ? `[AlertScheduler]`)
- [ ] Test L1: `npm test -- alertSchedulerHelpers docAlertEscalation` (backend)
- [ ] Smoke UI: `/settings/studio` tab Documenti salva; `/settings/notifications` toggle escalation
- [ ] Dopo invio test: righe in `doc_notification_log` / `nc_notification_log` con UNIQUE rispettata
- [ ] Non committare `.env`, `database.json`, script temporanei `.cursor/_*.cjs`

---

## Riferimenti (non duplicare)

- Esperienza operativa SMTP/VPS: `GUIDA_CONSOLIDATA.md` (sezione Alert Engine)
- Schema DB completo: `docs/reference/DATABASE_SCHEMA.md`
- Ripresa modulo NC: `docs/agent-tasks/PROMPT_RIPRESA_NC.md`
- Roadmap priorità prodotto: `docs/PROJECT_ROADMAP.md`
