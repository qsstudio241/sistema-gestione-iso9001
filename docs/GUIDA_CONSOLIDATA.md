# Guida consolidata — SGQ ISO 9001

> **Unico documento di esperienza operativa** da aggiornare quando cambia il comportamento del sistema (deploy, Word, DB, sync) **o** le regole di verifica/release (smoke, licenze, DoD).  
> **Non creare** nuovi `SESSION_NOTES_YYYYMMDD.md`: si aggiorna questo file + `PROJECT_ROADMAP.md`.

## Indice rapido (navigazione)

| Sezione | Contenuto |
|---------|-----------|
| [Inizio sessione](#cosa-leggere-a-inizio-sessione-ordine) | Ordine di lettura file progetto |
| [**Lezioni apprese (fonte unica)**](#lezioni-apprese-consolidate-fonte-unica) | Indice regole operative + link al dettaglio |
| [Metodo di lavoro (slice + multitasking)](../.cursor/rules/sgq-workflow-method.mdc) | Regola `.cursor`: slice, parallelizzazione, worktree, triage PR |
| [Deploy (hub)](how-to/deploy.md) | Ingresso unico release Netlify + VPS |
| [Manuale NC + Canvas](how-to/MANUALE_UTENTE_NC.md) | Registro non conformità — guida utente e canvas interattivo Glass |
| [Libreria UI SGQ](reference/LIBRERIA_UI_SGQ.md) | Catalogo componenti UI, duplicati, matrice moduli (~55% copertura Fase A) |
| [Principi documentazione](#principi-di-documentazione-chiarezza-e-best-practice) | Dove scrivere cosa, cosa evitare |
| [Piano qualità / test](#piano-qualità-fasi-di-sviluppo-e-test-di-robustezza) | DoD, piramide L1–L5, smoke |
| [Procedura chiusura autonoma](#procedura-chiusura-autonoma) | Ciclo slice agente: fix, test, smoke, doc, limiti |
| [Sync ADR-008](#architettura-target-sync--event-sourced-adr-008) | Event-sourcing, regole sync |
| [**A** — Checklist, sync, deploy](#a-checklist-custom-sync-deploy-vps) | Procedure operative principali |
| [**B** — Word Verbale](#b-report-word--checklist-custom-verbale) | Export OOXML / template |
| [**C** — Database e repro](#c-database-e-repro) | Script SQL, repro bug |
| [**D** — Verifica rapida](#d-comandi-di-verifica-rapida) | Comandi curl/test |
| [**E** — SAL / import / RAG](#e-flusso-2--sal--sopralluoghi--evidenze-documentali--import--rag-retrieval) | Flusso documentale avanzato |
| [**F** — Architettura piattaforma](#f-architettura-unificata-della-piattaforma-sessione-05042026) | Visione moduli unificati |
| [File Word spesso toccati](#file-spesso-toccati-word--export) | Path sorgenti export |

Sessioni recenti (consultazione): [Sessione 23/06/2026 — Riesame §9.3 stato modulo](#sessione-23062026--riesame-di-direzione-93-stato-modulo-3-slice-ai-in-produzione), [Sessione 23/06/2026 — incident deploy WIP](#sessione-23062026-incident--deploy-sicuro-con-working-tree-sporco), [Sessione 22/06/2026 — Riesame pattern Ambito azienda](#sessione-22062026--riesame-di-direzione-pattern-ambito-azienda), [Sessione 19/06/2026 — Coverage range-aware qualifiche](#sessione-19062026-notte--slice-1-coverage-range-aware-qualifiche-saldatori), [Sessione 19/06/2026 — Integrazione AI Riesame §9.3](#sessione-19062026--integrazione-ai-riesame-di-direzione-93), [Sessione 19/06/2026 — Ambiente TEST VPS backend](#ambiente-test-backend-istanza-parallela-vps--configurato-19062026), [Sessione 14/06/2026 — Import qualifiche ERAM (chiusura)](#sessione-14062026--import-qualifiche-eram--workflow-preview-chiusura), [Sessione 30/05/2026 — Modulo NC (chiusura)](#sessione-30052026--modulo-nc-chiusura-sessione--attesa-feedback-utenti), [Sessione 30/05/2026 — Tooling Cursor/MCP](#sessione-30052026--tooling-cursor--mcp--node--vitest-chiusura-sessione), [Sessione 26/05/2026](#sessione-26052026--refactor-ui-slice-abd-vigenti-nav), [Sessione 25/05/2026](#sessione-25052026--registro-norme-sot-r1r7-completato-e-chiusura-pr), [Sessione 24/05/2026 (bis)](#sessione-24052026-bis--modulo-documentale-ux-e-upload), [Sessione 24/05/2026](#sessione-24052026--smoke-e2e-login-playwright-cloud-agent), [Sessione 22/05/2026 (bis)](#aggiornamento-22052026--jsx-sequenze-literal-u-in-ui-rischi--progetti--qualifiche), [Sessione 22/05/2026](#sessione-22052026--fix-allegati-iso-45001), [Sessione 17/05/2026](#sessione-17052026--modulo-saldatura-iso-3834-operativo).

---

## Cosa leggere a inizio sessione (ordine)

1. **[../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)** — stack, infra, workflow.  
2. **[PROJECT_ROADMAP.md](PROJECT_ROADMAP.md)** — fasi e backlog.  
3. **[ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md)** — gerarchia utenti, segregazione dati, ruoli e piano migrazione RBAC (aspetto portante; aggiornare quando si toccano auth o scope query).  
4. **Questo file** — lezioni apprese, procedure ripetibili e **piano qualità / test di robustezza** (sezione omonima sotto).  
5. **[DATABASE.md](reference/DATABASE.md)** — connessione DB, script repro, ambienti `development` / `test`.  
6. Per deploy: **[how-to/deploy.md](how-to/deploy.md)** (hub) → checklist, VPS, troubleshooting, accesso agenti.
7. Se il task tocca editing documentale desktop: **[MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](specs/MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md)**.

**Percorsi workspace (Windows)** — `C:\ProgettoISO` non è “un progetto diverso” dal repo su disco: sui PC configurati così è di solito una **junction verso Google Drive** (`G:\Il mio Drive\...`). Una cartella omonima sotto **OneDrive** può invece essere un **checkout separato**. Dettaglio e regole operative: sezione *Percorsi di lavoro locale* in **[../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)**.

**Storico sessioni** (feb–mar 2026): cartella [archive/sessions/](archive/sessions/) — solo consultazione, non aggiornare.

> **Come è organizzato questo file.** In alto: le **lezioni apprese consolidate** (sotto) + i **principi** + il **piano qualità/metodo** + le **procedure A–F**. In basso: il **diario cronologico delle sessioni** (consultazione, append-only). Per il *metodo* di lavoro ripetibile (slice, multitasking, worktree, triage PR) vedi la regola [`.cursor/rules/sgq-workflow-method.mdc`](../.cursor/rules/sgq-workflow-method.mdc).

---

## Lezioni apprese consolidate (fonte unica)

> Indice unico delle lezioni operative: ogni riga è una **regola da applicare** + un link al dettaglio (sessione o doc). Quando emerge una nuova lezione, aggiungerla **qui** (sintesi) e linkare il dettaglio cronologico più sotto — non duplicare il racconto.

### Architettura UI e form

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Form HTML annidati** — «Salva azione» nel drawer NC non persisteva (nessun POST nei log VPS, drawer si chiudeva senza errore). HTML vieta `<form>` dentro `<form>`: il browser ignora il form interno e il submit va a quello esterno. | **Mai annidare `<form>`.** Un componente contenitore che usa `<form onSubmit>` va convertito in `<div>` se contiene figli con propri form di salvataggio; i pulsanti interni devono essere `type="button"` con `onClick`. | [Sessione 07/06/2026 — NC notifiche + form annidati](#sessione-07062026---nc-notifiche--form-annidati-chiusura-sessione) |
| **Pattern "Ambito" azienda — standard per tutti i moduli multi-azienda** | Quando un modulo mostra dati filtrabili per azienda, usare **sempre** il pattern Ambito: (1) utility `xxxCompanyScope.js` con `resolveInitial…`, `readStored…`, `persist…` su localStorage; (2) selettore `"Ambito:"` nell'**header** della pagina (non nella toolbar); (3) il `companyScope` alimenta lista, form e widget; (4) nel form il campo azienda è testo fisso "(da ambito)" se scope attivo, select libero altrimenti; (5) auto-selezione se l'org ha una sola azienda. **Non** usare dropdown azienda in toolbar né nel form come campo indipendente. Moduli già conformi: Qualifiche (`qualificationsCompanyScope.js`), WPS/Saldatura, Registro documenti (`documentRegistryCompanyScope.js`), Riesame di Direzione (`managementReviewsCompanyScope.js`). Moduli con `filterCompany` in toolbar ancora da aggiornare: NC, NDT Reports, Attrezzature, Scadenzari. | PR #154 · sessione 22/06/2026 |
| **Riuso UI «blocco unico»** | Prima di creare un elemento UI, verificare se esiste già un componente/classe nel repo (tabella in `sgq-operating-memory.mdc`). Usare sempre l'esistente. | [Libreria UI SGQ](reference/LIBRERIA_UI_SGQ.md) |
| **JSX: sequenze `\u` literal** | Gli escape `\uXXXX` tra tag JSX finiscono a schermo come testo. Metterli **dentro una stringa JS** (`{"\u26A0\uFE0F …"}`). | [Aggiornamento 22/05/2026 — JSX `\u`](#aggiornamento-22052026--jsx-sequenze-literal-u-in-ui-rischi--progetti--qualifiche) |

### Multi-tenant, RBAC e dati

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Isolamento dati AI multi-tenant** | Utente **STUDIO**: vista d'insieme, può selezionare solo tra le **proprie aziende clienti** (`auditor_org_id`). Utente **AZIENDA cliente**: il backend **forza** `company_id` sull'anagrafica primaria (mai fidarsi del `companyId` dal client), niente 403. **RAG**: filtro `company_id = @compId`, **niente** `OR IS NULL` / chunk globali. | [PR #91 — regola scope azienda AI](#pr-91--regola-di-prodotto-ambito-azienda-dellassistente-ai-07062026) |
| **Qualifiche — una azienda per certificato** | Ogni qualifica ha `company_id` **obbligatorio** (UI ambito + form, API `qualificationCompany.service`, mig. 087). Import AI eredita `company_id` dal job. Dopo approvazione **non** si cambia azienda; stesso numero certificato/PDF non può esistere su un'altra azienda del tenant. Pattern UI: `qualificationsCompanyScope.js` (come registro documenti). | [Aggiornamento 10/06/2026 — qualifiche company scope](#aggiornamento-10062026--qualifiche-ambito-azienda-obbligatorio) |
| **Anagrafica personale ↔ qualifiche** | `company_personnel` = master (nome, mansione, email); `qualifications` = fascicolo certificati con `personnel_id` FK opzionale. Import guidato + backfill link; tab **Salute mansione** (4 tipi: acuità visiva, Ishihara, idoneità medica, sorveglianza sanitaria). Mig. **088**. | [Aggiornamento 10/06/2026 — collegamento personale-qualifiche](#aggiornamento-10062026--collegamento-anagrafica-personale-qualifiche) |
| **Controparti azienda ↔ riesame commerciale** | `company_counterparties` sotto `companies` (ruoli `customer` / `end_customer` / `supplier`). Mig. **096** tabella + `commercial_cases.commercial_customer_id`; mig. **097** backfill idempotente da `commercial_customer_name`/`ref` (095) e `projects.client_name` → `end_customer_id`. **Snapshot 095 non rimosso** (deprecato, non DROP). Write: se FK impostata, `contractReview` sincronizza name/ref dalla controparte (`commercialCustomerCounterparty.service`). Verifica: `node backend/scripts/verify-counterparties-migration.js`. Pilota: LM&CO = azienda SGQ, PT.MAIDO = `end_customer`. | sessione 14/06/2026 |
| **Saldatore ISO 9606-1 — campi end-to-end** | Catena AI→schema(FE/BE)→commit→DB→scheda allineata sulle **stesse chiavi**: ogni nuovo campo va in `aiPrompt`/`aiExpectedSchema`, `fields[].key` FE, e mappatura `commitToQualification`/`qualificationIngest`, altrimenti l'AI estrae ma il commit lo scarta. Mig. **092**: spessore/diametro **numerici min/max** (deriva legacy `thickness_range`/`pipe_diameter`), date `exam_date`/`last_confirmation_date`/`next_confirmation_due`/`revalidation_date` (stop overwrite `issue_date`), `product_type`/`weld_details`/`qualification_designation` (calcolata). Semaforo 9606 = **min(next_confirmation_due, expiry_date)** difensivo. Obbligatori scheda su blur/submit; in import-commit solo **warning**, mai blocco. | commit `0034399`/`f7936c1`/`8d427d8` |
| **Import PDF → qualifica: PDF collegato** | `commitToQualification` imposta `certificate_file_url` da `import_job_files.storage_path` (pattern `/uploads/...` come ingest) e `import_job_files.qualification_id` (mig. **093**). Link visibile subito in `QualificationsPage` / `QualificationForm`. | sessione 14/06/2026 |
| **Alert + scadenzario qualifiche** | Toggle `alert_qualif_expiry` cablato in `alertScheduler` (+10 min dopo doc). Servizio `qualificationAlert.service.js`: data guida = min(expiry, next_confirmation per 9606); email al coordinatore per azienda (rubrica `notification_contacts` company → `company_personnel` job coordinatore → `user_company_access` ruolo coordinatore → fallback org). Dedup `qual_notification_log` (mig. 093). Scadenzario `/deadlines`: righe virtuali `item_type=qualification` senza toccare `deadline_items` Excel. Badge `/alerts` include qualifiche approvate. | sessione 14/06/2026 |
| **Registro conferme semestrali 9606** | Mig. **094**: tabella `qualification_confirmations` + flag `company_personnel.is_primary_welding_coordinator`. API: `POST /qualifications/:id/confirm-semiannual`, `GET …/confirmations`, `GET /qualifications/confirmations/export` (xlsx). Solo qualifiche **approvate** tipo 9606; auth = email utente = coordinatore primario azienda (fallback admin/superadmin). UI: sezione collassabile in `QualificationForm`; deep link scadenzario `?highlight=&section=conferma`. **No timbro PDF** sulla conferma. | sessione 14/06/2026 |
| **API 500 da `studioScopeClause` errato sulle `companies`** | Nelle clausole di scope su `companies` usare l'alias colonna corretto (`c.organization_id`, **non** `co.organization_id`) e la logica `isOrgWideAdmin` / `auditor_org_id` (mai `isSuperadmin` indiscriminato). | [Sessione 07/06/2026 — fix responsible-options](#sessione-07062026---nc-notifiche--form-annidati-chiusura-sessione) |
| **Menu audit vs RBAC** | Lista e dettaglio audit filtrano con `studioScopeClause` (`auditListRbac.service`); `organization_id` sempre da `req.user`. | [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) |
| **`companies` NON ha `organization_id`** | La tabella `companies` è scopata via `auditor_org_id`; l'org si ottiene con join `auditor_orgs ao ON ao.id = c.auditor_org_id` (`companyBelongsToOrg`). Nei JOIN basta `LEFT JOIN companies c ON c.id = x.company_id`, mai `c.organization_id`. Regressione 13/06/2026: il fix `9fda958` aveva aggiunto `... AND c.organization_id = j.organization_id` in `importJobs.listJobs/getJob` → errore SQL `Invalid column name 'organization_id'` (lista + dettaglio Import PDF bloccati). Fix `98bc36f` rimuove la condizione errata + test mirati su `listJobs/getJob`. | commit `98bc36f` |

### Notifiche NC e alert

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Notifiche NC — rubrica + escalation** | Ogni azienda ha una **rubrica referenti** (`notification_contacts`, mig. 073-074) con ruolo email. L'alert scadenza NC usa **priorità: personale azienda (`responsible_contact_id`) > rubrica (`recipients_email`)**. Lo scheduler (`docAlertEscalation.service`) gestisce l'escalation **allineata alla config**. I responsabili NC si scelgono dal **personale azienda** (`responsible-options`). | [Sessione 07/06/2026 — NC notifiche](#sessione-07062026---nc-notifiche--form-annidati-chiusura-sessione) · [ADR-012](adr/ADR-012-company-personnel-anagrafica.md) |

### Ambiente di lavoro e tooling

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Worktree su disco locale `C:`** | Il repo vive su **Google Drive** (`G:\…`) dietro junction `C:\ProgettoISO`: l'I/O è lento e la **suite Vitest completa si impalla**. Per task corposi/paralleli usare un **worktree su `C:`** da `origin/main`; come L1 affidarsi a **build Vite + Vitest mirato** (o CI Netlify), non alla suite intera. | [`sgq-workflow-method.mdc` § Worktree](../.cursor/rules/sgq-workflow-method.mdc) · [Workspace consigliato](#workspace-consigliato--ponte-cprogettoiso-cursor--terminale) |
| **`gh` CLI + MCP GitHub** | Su Windows: `gh auth login` con account **qsstudio241** (verificare con `gh auth status`). Preflight PR: `gh pr list`, `gh pr merge`. Fallback se `gh` non autenticato: **MCP GitHub** — leggere schema tool prima di chiamarlo. | [`sgq-workflow-method.mdc` § Triage PR](../.cursor/rules/sgq-workflow-method.mdc) · sessione 14/06/2026 |
| **Migrazioni DB — sequenza condivisa** | Numerazione **unica** (stato ~082). Le PR vecchie con numeri bassi vanno **rinumerate in coda** e rese **idempotenti** (check esistenza prima di `ALTER`/`CREATE`). FK SQL Server: statement separati. | [how-to/database-migrations.md](how-to/database-migrations.md) |
| **Encoding UTF-8 senza BOM** | Lo strumento di salvataggio può produrre **ANSI/BOM** o interpretare `\n`/`\t` come newline/tab. Dopo ogni scrittura: verificare **UTF-8 senza BOM**, accenti italiani corretti, **nessun `U+FFFD`**. Script: `backend/scripts/check-utf8-encoding.js`. | [Playbook caratteri non riconoscibili](#playbook-riutilizzabile--caratteri-non-riconoscibili-ufffd--tofu-in-ui) · [`sgq-encoding-quality.mdc`](../.cursor/rules/sgq-encoding-quality.mdc) |
| **`contractReview.controller.js` NON è nel deploy-manifest** | `backend/scripts/deploy-manifest.json` non include `contractReview.controller.js`/`.routes.js`: quando un commit li modifica vanno copiati a mano con `pscp` **prima** del restart, poi lanciare `deploy-controllers-to-vps.ps1` per il resto. Deploy fix segregazione `company_id` Import PDF 13/06/2026 (commit `9fda958`): push `main`, copia manuale `contractReview.controller.js`, deploy manifest, MainPID 646321→652768, health `healthy`, `/import-jobs` → 401 coerente. | Sessione 13/06/2026 — commit `9fda958` |
| **Deploy sicuro con working tree "sporco"** | `deploy-controllers-to-vps.ps1` copia il **working tree dal disco** (manifest di ~118 file), **non** lo stato committato: se il tree contiene WIP non pertinente al rilascio, il WIP finisce in produzione (incidente 23/06/2026: una versione WIP di `knowledgeIndexer.service.js` importava un file nuovo non tracciato → crash `MODULE_NOT_FOUND`, API offline 503). **Regola**: (1) prima di ogni deploy backend verificare `git status --short`; se il tree NON è pulito e il WIP non riguarda il rilascio, **non** usare lo script completo; (2) fare un **deploy mirato dei soli file committati** (`pscp` del singolo file, oppure `git show HEAD:percorso` per forzare la versione di `HEAD`) + restart con verifica `MainPID`; (3) se il rilascio introduce un **nuovo pacchetto npm** (es. `mammoth`), eseguire `npm install`/`npm ci` sul VPS, altrimenti `MODULE_NOT_FOUND`. Funzioni riutilizzabili in `backend/scripts/lib/vps-ssh.ps1` (`Initialize-SgqVpsSsh`, `Test-SgqVpsSession`, `Copy-SgqVpsFile`, `Invoke-SgqVps`, `Get-SgqVpsHealth`); password sudo a `plink` **solo via stdin**, mai nella stringa del comando. | [Sessione 23/06/2026 — incident deploy WIP](#sessione-23062026-incident--deploy-sicuro-con-working-tree-sporco) |
| **Token Netlify CLI (Windows)** | Credenziali locali: `backend/config/.netlify.local.ps1` (copia da `.netlify.local.ps1.example`, gitignored). Preflight: `.\backend\scripts\netlify-preflight.ps1` → deve stampare `NETLIFY_ACCESS_OK`. **Mai** token Netlify in chat o su Git. | [NETLIFY_DEPLOYMENT.md](how-to/NETLIFY_DEPLOYMENT.md) |

### Import Excel / Scadenzario (ADR-013)

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **`findColumnByPattern` — priorità pattern, non colonna** | Il detector `excelDeadlineDetector.js` scansiona gli header per pattern (lista ordinata per priorità), non posizione colonna. La lista deve mettere le varianti "future" (`prossima`, `next`) **prima** di quelle "passate" (`ultima`, `last`): altrimenti la colonna sbagliata vince quando entrambe sono presenti nello sheet. | [fix commit `92952ec`](https://github.com/qsstudio241/sistema-gestione-iso9001/commit/92952ec) |
| **VPS restart senza `sudo systemctl`** | Se `systemctl restart` non è disponibile, usare: `lsof -ti:3000 \| head -1` → `kill -15 $PID`; systemd con `Restart=on-failure` riavvia automaticamente (~5 s). Verificare cambio PID per confermare riavvio effettivo. | Sessione 08-09/06/2026 ADR-013 smoke |
| **Reset password temporanea per smoke** | (1) `bcrypt.hash('pw_temp', 10)` da script locale con `database.json`; (2) `UPDATE users SET password_hash=... WHERE id=...`; (3) smoke; (4) **ripristinare subito l'hash originale**. Mai lasciare password temporanee in produzione. | Sessione 08-09/06/2026 ADR-013 smoke |
| **ADR-013 slices completate (09/06/2026)** | S1 detector, S2 migrazione 083, S3 API detect, S4 API import/CRUD, S5 DataGridExportable, S6 dialog+pagina `/deadlines`, S7 PriorityView. **S8** (notifiche email), **S9** (cascade delete), **S10** (auto-refresh) in roadmap. | [PR #100](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/100) |
| **Ripristini scadenzario/UI senza credenziali** | Se una funzionalità UI appena sviluppata non è visibile in produzione, verificare prima se il commit è su `main` e se Netlify ha deployato. Non modificare password/hash utenti per ripristinare funzionalità UI: credenziali e feature gating sono ambiti separati. | Sessione 09/06/2026 — commit `a1c4cc1`/`fecf114` su `main` |
| **Import PDF — menu azioni + contrasto AI (14/06/2026)** | UX: azioni file PDF raggruppate in menu **Altre azioni**; pulsante **Analisi AI** con contrasto leggibile. Preview committente **TEST OK**. | [PR #109](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/109) mergiata su `main` |
| **Scadenzario — card e file origine** | Le card riepilogo della pagina `/deadlines` devono essere **filtri rapidi** come nel modulo NC (click/toggle + stato attivo), non semplici contatori. La colonna **File origine** deve aprire il documento sorgente con `buildDocumentRegistryPath({ selectId })`, riusando il Registro Documenti. | [PR #102](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/102) |

### Sync (vincolante)

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Sync event-sourced (ADR-008)** | Nessuna nuova feature di sync può inviare lo **«stato corrente intero»**: ogni campo → evento atomico con `idempotency_key`. Server-wins all'apertura; debounce hydrate resettato al cambio audit. | [§ Architettura target sync — ADR-008](#architettura-target-sync--event-sourced-adr-008) |

---

## Registro decisioni triage PR backlog (07/06/2026)

Triage completo delle PR aperte residue (senior lead, in autonomia). Criterio: mergiare solo fix a basso rischio ancora utili e non già in main; lasciare aperte feature di prodotto o modifiche al sync sensibile (eccezioni golden rules); chiudere ciò che è già recuperato altrove.

### Mergiate su `main`
| PR | Titolo | Note |
|----|--------|------|
| #97 | fix(backend): eliminazione azienda con cleanup dipendenze FK | Fix integrità DB. Conflitti GUIDA (whole-file CRLF) risolti tenendo main + nota esperienza FK. `companyMaintenance.service` + delega controller verificati. |
| #57 | fix(ai): retry automatico Gemini su 503/429 | Retry server-side mancante in main (solo embeddings lo aveva). Conflitti su `aiAssist.test.js` (allineato a `userId` reale) e GUIDA risolti. Syntax-check OK. |
| #91 | feat(ai): ambito azienda su chat+RAG (con **regola scope azienda bloccata**) | Mergiata con **adattamento prodotto deciso dal committente** (vedi sotto). Mantiene il fix sicurezza RAG (filtro `company_id = X`, niente `OR IS NULL`/chunk globali). Branch `pr-91-integ` (merge origin/main + fix encoding em-dash UTF-8). Conflitto GUIDA risolto tenendo main + questa nota. Test AI/scope L1 PASS, build OK. |

### Chiuse (contenuto già recuperato / stale)
| PR | Titolo | Motivo |
|----|--------|--------|
| #28 | docs: diagnosi rinnovo Let's Encrypt | Parte operativa (HTTP-01, Apache vs Nginx, port forwarding WAN:80 verso VPS:10880) consolidata in *Ops/Sysadmin — Rinnovo SSL Let's Encrypt* (più sotto). |
| #52 | feat: audit close verso document_registry (ADR-009 F5) | **CHIUSA per decisione di prodotto (07/06/2026)**. L'automatismo audit-close → `document_registry` non è desiderato: il report Word esportato deve restare **modificabile** dall'utente e **caricato manualmente** nell'albero. Il requisito corretto (revisione documento = numeratore audit al caricamento di un verbale) è tracciato come **requisito futuro** (vedi sotto) e in `DEPUTYTASK.md`. |
| #38 | feat: compressione foto + editor foto + Word resize | **CHIUSA il 07/06/2026 — completata**. Parte A (compressione foto) e parte B (editor `PhotoEditModal`) recuperate e integrate su `main`; il resize export Word è già presente in `main`. Vedi sottosezioni *PR #38 parte A* e *parte B*. |

### Lasciate aperte (feature/prodotto o sync sensibile — con prossimo passo)
| PR | Titolo | Perché aperta | Prossimo passo |
|----|--------|---------------|----------------|
| #31 | perf(sync): debounce 1500ms + enqueueOrReplace | Sync sensibile (ADR-008 T3/T4/T5) | Rivalutare vs architettura sync + test L3 multi-device |
| #10 | feat(settings): pagina Organizzazione P.IVA + logo | Si sovrappone al billing layer (migration 082) in sviluppo | Coordinare con billing per evitare doppioni, poi rebase |

#### Requisito futuro (NON ora) — Caricamento verbale di audit con revisione = numeratore audit

Nato dalla chiusura di #52. Quando l'utente caricherà **manualmente** un verbale di audit nell'albero documentale, la revisione del documento deve coincidere con il **numeratore dell'audit**:

- **Tipo documento dedicato** "Verbale di audit" (cartella **12 AUDIT**).
- **Al caricamento**: selezione dell'audit → `revision = audit.audit_number` (formato `PREFISSO-YYMMDD-NN`); campo revisione **read-only**.
- **Opzionale**: riconoscimento automatico dell'audit dal nome file di export (`{Cliente}_{NumeroAudit}_{Standard}.docx`, trattini resi come underscore).
- **Nota tecnica DB**: `document_registry.revision` è `NVARCHAR(20)` → potrebbe servire **allargare la colonna** (numeri audit fino a ~26 caratteri).
- **Tracciabilità**: nessuna FK audit attuale in `document_registry` → salvare `audit_id` / `audit_number` in `type_specific_data` (JSON).

#### PR #38 parte A — Compressione foto allegati lato client (07/06/2026)

Recuperata **solo** la compressione immagini dalla PR #38 (niente editor, niente modifiche export Word), integrata in modo pulito su `main` attuale.

- **File toccato**: `app/src/hooks/useAttachmentManager.js` (+ test `app/src/tests/compressImageFile.test.js`).
- **Comportamento**: per allegati di categoria **"foto"** (e solo se `image/*`), compressione lato client con **Canvas + `toBlob('image/jpeg')`** prima di salvataggio/upload. Parametri: **maxDim 1600px** (lato lungo, aspect ratio preservato), **qualità 0.82**, **skip < 300KB** (`minSizeToSkip`). PDF e altri tipi: **nessuna compressione**.
- **Fallback robusti**: ritorna il file originale se non è immagine, se il canvas fallisce, o se il JPEG risulta più grande dell'originale. Il file compresso eredita nome `.jpg`; `name/type/size` dei metadata allegato usano il file effettivamente salvato (`fileToUpload`).
- **Nessuna nuova dipendenza npm** (Canvas nativo del browser).
- **NON replicata** la rimozione del blocco `customItemId` presente nella PR #38 (era una regressione): il supporto agli item checklist custom resta intatto.
- **Verifica**: build Vite **OK**. Test mirato di gating (skip <300KB / solo immagini) aggiunto ed eseguibile in jsdom; il **runner vitest locale si impalla** in questo ambiente sandbox (pool threads/forks), quindi il test gira in **CI/Netlify** — build come L1.

#### PR #38 parte B — Editor foto pre-upload `PhotoEditModal` (07/06/2026)

Recuperata la **seconda e ultima parte** della PR #38: l'editor foto opzionale prima dell'upload. Con questo la PR #38 è **completata e chiusa** (parte A compressione + parte B editor; il resize export Word era già in `main`).

- **File toccati**: `app/src/components/PhotoEditModal.jsx` (nuovo), `app/src/components/PhotoEditModal.css` (nuovo), `app/src/components/AttachmentSection.jsx` (wiring), `app/package.json` + `app/package-lock.json` (nuova dipendenza).
- **Nuova dipendenza**: `react-easy-crop@^5.5.7` (peer `react >=16.4.0`, compatibile con React 18.2 del progetto).
- **Comportamento**: alla scelta di una foto (Gallery/Camera) si apre `PhotoEditModal` per **ritaglio (crop), rotazione ±90°, zoom, aspect ratio**. L'editor è **opzionale**: l'utente può **"Salta"** (usa l'originale), **"Conferma"** (applica crop/rotazione via Canvas → JPEG 0.92) o **"Annulla tutto"** (nessun upload). Più foto vengono mostrate in sequenza.
- **Flusso integrato**: scelta file foto → editor opzionale → `addAttachments("foto", ...)` → **compressione esistente (parte A, 0.82, max 1600px)** → upload. **Una sola compressione** (l'editor non comprime, produce JPEG ad alta qualità). `customItemId` preservato per gli item checklist custom.
- **Verifica**: build Vite **OK** (`react-easy-crop` bundle in `vendor-react`); test mirato `compressImageFile.test.js` **3/3 PASS**. Nessun test dedicato all'editor (UI). Suite completa non eseguita (si impalla su Google Drive nel repo principale; worktree su disco locale `C:`).
- **PR #38**: **CHIUSA** su GitHub via MCP (merge su `main` via git locale + push, no force/squash). L'export Word con resize era già presente in `main`, quindi non toccato.

#### PR #91 — Regola di prodotto: ambito azienda dell'assistente AI (07/06/2026)

Decisione committente sull'adattamento di #91 (diverso dalla PR originale):

- **Utente STUDIO** (auditor_org / superadmin studio): può avere la vista complessiva e **selezionare** tra le **sole aziende clienti** del suo `auditor_org_id`. Comportamento invariato rispetto alla PR.
- **Utente AZIENDA cliente** (ha righe in `user_company_access`): vede **solo i propri contenuti**. Il backend **forza** sempre `company_id` sulla sua **anagrafica primaria**, ignorando qualunque `companyId` inviato dal client. **Nessun errore 403** "scegli azienda" (la PR originale dava 403 al cliente multi-azienda che non sceglieva — qui invece blocchiamo/forziamo).
  - **Anagrafica primaria** = primo record di `user_company_access` ordinato per `company_id` (il `company_id` più basso). Scelta **deterministica e documentata**: se il cliente ha accesso a più aziende via RBAC, l'AI resta comunque bloccata sulla primaria.
  - **Frontend** (`AiAssistantPage.jsx`): per l'utente azienda il chip selettore azienda è **disabilitato** e preimpostato sulla sua azienda (nessun dropdown); l'inferenza automatica e i reset non lo sovrascrivono.
- **Sicurezza RAG mantenuta**: il filtro `searchKnowledge` resta `company_id = @compId` (niente `OR IS NULL`), quindi nessun chunk globale/di altre aziende rientra nel contesto del cliente.
- **File toccati**: `backend/src/services/aiCompanyScope.service.js` (+ test), `backend/src/controllers/aiChat.controller.test.js`, `app/src/pages/AiAssistantPage.jsx` (+ `.css`).

---

### Sessione 20 maggio 2026 — AI conclusioni: retry Gemini su 503 "model overloaded"

#### Sintomo
Il modale "Assistente AI — Conclusioni" mostra ripetutamente l'errore "Servizio AI temporaneamente sovraccarico" (o, su bundle pre-fix, il messaggio Nginx "Server temporaneamente non disponibile"). Capita soprattutto in orari di picco perché Gemini 2.5 Flash restituisce intermittentemente **503 model overloaded**.

#### Catena di fix (in ordine di scoperta)
1. **Nginx intercettava 503**: `error_page 502 503 504 = @backend_down` mascherava il messaggio del backend con il generico Nginx. **Fix**: rimosso `503` (rimane `502 504`), perché 503 può essere un errore funzionale legittimo.
2. **Controller AI usava 503 anche per upstream errors**: il fronte Nginx lo intercettava comunque. **Fix**: `aiAssist.controller.js` mappa errori upstream a HTTP **500** con messaggi italiani; 503 riservato solo a `AI_NOT_CONFIGURED`.
3. **Tabelle `ai_feedback` / `ai_interactions` mancanti** + `req.user.id` invece di `req.user.user_id` → ogni "Accetta/Scarta" generava DB error. **Fix**: migrazione 071 + correzione field.
4. **Nessun retry server-side per 503/429 da Gemini**: ogni picco di carico Google arrivava direttamente all'utente. **Fix definitivo**: `geminiAdapter.js` ora ritenta automaticamente su **429/500/502/503/504** con backoff esponenziale (800ms → 1600ms → 3200ms ± jitter 250ms, cap 5s) per default 3 tentativi (configurabile via `GEMINI_MAX_ATTEMPTS`). Rispetta `Retry-After` se presente.

#### Regole consolidate
- **Errori HTTP nei controller AI**: non usare 503 per errori runtime (Gemini down, timeout, quota). Usare **HTTP 500** con messaggio italiano leggibile. 503 solo per "provider non configurato".
- **Retry server-side per provider AI**: tutti gli adapter (Gemini/Azure/OpenAI) devono assorbire gli errori transienti del provider prima di propagare al client. Codici retryable: **429, 500, 502, 503, 504**. Non retryable: 400 (richiesta invalida), `AI_REQUEST_FAILED` (rete locale), `AI_EMPTY_RESPONSE`.
- **Diagnosi messaggio "non in repo"**: se un endpoint restituisce testo non grep-pabile nel repo backend, controllare `proxy_intercept_errors` + `error_page` in `/etc/nginx/sites-available/`.

#### Tabelle AI
| Tabella | Uso |
|---|---|
| `ai_feedback` | Feedback utente (accepted/rejected/rephrased) per personalizzazione |
| `ai_interactions` | Audit trail ogni chiamata AI (provider, model, tokens, latency) |

---

### Playbook riutilizzabile — Caratteri non riconoscibili (U+FFFD / tofu in UI)

**Quando ripetere questa procedura:** in schermata compaiono **U+FFFD** (simbolo con punto interrogativo), **`??`**, o accenti **mancanti/sostituiti** (es. "Qualit" al posto di "Qualità"), spesso solo su **Windows** o solo in **produzione**.

#### Cause tipiche (non escludersi a vicenda)

| # | Causa | Indizio |
|---|--------|--------|
| 1 | **Byte non UTF-8** o copia-incolla corrotta nel sorgente | Nel file manca la sequenza hex corretta per à (`C3 A0`); grep trova `�` |
| 2 | **Glifo assente** nel font effettivo: `›` U+203A, `—` U+2014 | Schermo OK su un PC, tofu su un altro |
| 3 | **Emoji/simboli** senza glifo nella stack font | Icone che diventano tofu |
| 4 | **Bundle o Service Worker obsoleto** (Netlify / PWA) | Repo a posto, browser ancora su JS vecchio |
| 5 | **Escape `\uXXXX` dentro testo JSX** (non in stringa JS) | La UI mostra **letterale** `\u26A0` o `\u00e0` invece di emoji/accenti |

#### Checklist operativa (ordine consigliato)

1. **Trovare il file** (cerca stringa spezzata nel repo; React DevTools sul testo).
2. **React/JSX:** se compaiono **sequenze letterali `\u`** (spesso dopo `>` su titoli, pulsanti o label), il testo **non è** una stringa JavaScript → le escape Unicode **non valgono**. Corregere con **`{"..."}`** dove tra virgolette c'è una **stringa** JS (escape `\u`), oppure **`String.fromCodePoint(...)`**, oppure UTF-8 reale nel sorgente (accenti). Fare grep su `\u` **fuori** da `{ ... }` dopo un tag JSX.
3. **Validare UTF-8** su `app/src` / `backend/src`: script `backend/scripts/check-utf8-encoding.js` (walk file + segnalazioni).
4. **Correggere (encoding):** lettere italiane corrette **oppure**, per robustezza, **escape Unicode** in **stringhe** JS (`conformit\u00E0`, `pi\u00F9`, … — stesso effetto a video). Per separatori **visibili**: preferire **ASCII** (`/`, ` - `) o **SVG**; evitare in UI critica `›` ed em dash lungo se non necessari.
5. **Verifica:** `vite build` in `app/`; se toccato export Word, `vitest` su `wordExport.placeholders.test.js` e `wordExport.imageDimensions.test.js` (nota: i placeholder possono stare in `word/header2.xml`, non solo `header1.xml`).
6. **Rilasciare:** commit + push; dopo deploy Netlify **hard refresh** (Ctrl+Shift+R) o aggiornamento PWA.

#### Canvas agente — encoding

Nei file `.canvas.tsx` (Glass / agente): su Windows il salvataggio diretto di accenti o em dash puo' produrre **U+FFFD** — usare escape `\uXXXX` **dentro stringhe JS** (`"Passo 1 \u2014 Apri"`, `"Priorit\u00E0"`) oppure espressioni `{"..."}`; mai `\u` come testo JSX grezzo dopo `>`. Prima del commit: grep su `EF BF BD` / `\uFFFD` e `node backend/scripts/check-utf8-encoding.js docs/canvas/`. Allineare `canvases/` (runtime Glass) e `docs/canvas/` (repo).

#### Riferimenti vincolanti

- Regola Cursor: `.cursor/rules/sgq-encoding-quality.mdc`
- Esempio di batch chiuso su `main`: commit `a5e7876` (maggio 2026), con deploy Netlify e verifica post-cache.

**Esperienza 07/06/2026 — Fix logo azienda — Express Router auth intercept**

Gli utenti desktop autenticati tramite cookie httpOnly hanno `getToken()` → `null` (nessun Bearer header). Il middleware `router.use(authenticate)` montato su `/api/v1` intercetta **ogni** richiesta priva di Bearer token — incluse quelle destinate ad altri router — rispondendo 401 prima che la route target venga raggiunta. Il componente `CompanyLogo` in `CompanyDetailPage` e `CompaniesPage` non riceveva mai la risposta immagine e cadeva in fallback silenzioso.

**Soluzione:** registrare gli endpoint pubblici (logo, allegati non sensibili) direttamente in `server.js` **prima** dei router autenticati:
```js
// server.js — PRIMA di app.use('/api/v1', auditRoutes)
app.get('/api/v1/companies/:id/logo', getLogo);
```
**Commit:** `3787ad1` — 07/06/2026 — TEST OK (verificato in produzione).

**Lezione:** se un endpoint deve essere accessibile senza Bearer (es. risorse immagine da `<img src>`), non basta non chiamare `authenticate` nella route — bisogna uscire dal router autenticato. Registrare l'endpoint prima di `app.use('/api/v1', routerAutenticato)` in `server.js`.

**Esperienza 30/05/2026 — encoding UI NC + drawer dettaglio**

I testi NC (Camellini e altre org) mostravano `?` o caratteri spezzati perché diversi sorgenti (`NcDetailPanel`, `NcCreateModal`, `ncWorkflow`, helper export/create) contenevano byte Latin-1/Windows-1252 invalidi in file dichiarati UTF-8. Fix: riscrittura stringhe UI con UTF-8 reale o escape `\u00E0`/`\u00F9` in **stringhe JS**; validazione con `backend/scripts/check-utf8-encoding.js`. Per UX registro lungo: il dettaglio NC non va più sotto la griglia ma in **drawer laterale destro**, riusando le classi `doc-detail__overlay` / `doc-detail` del modulo Documenti (`DocumentDetailPanel.css`); deep-link `/nc?select=` apre il drawer; mobile full-width come documenti. **UI guida flusso**: sezioni numerate nel drawer seguono l'ordine ISO 10.2 (Scheda → Stato workflow → Cause → Azioni → Evidenze → Verifica → Chiusura), non un form flat per tipo campo.

**Esperienza 30/05/2026 — campi testo NC = standard audit (`RichTextField`)**

Componente unico `RichTextField.jsx` compone `AutoTextarea` (dettatura it-IT) + `draftFieldRegistry` (scope `nc:<id>`) + `ncFieldDraftStorage` (localStorage, debounce 800 ms) + `textFieldHistory` (ultime versioni su blur, ripristino UI). Applicato a dettaglio NC, modale creazione, azioni e nota verifica azione. Validazione descrizione NC resta su blur/submit. Test L1: `ncTextFields.test.js`, `ncDetailPanel.test.js`.

**Esperienza 30/05/2026 — pulsanti workflow NC nel drawer (`.status-btn` 40×40)**

`.status-btn` in `ChecklistModule.css` è pensato per **codici brevi** (C, NC, OSS…), box fisso 40×40 px. Nel drawer NC le etichette lunghe («Avvia lavorazione», «Segna come risolta») senza override spezzavano il testo su due righe; lo stesso problema colpiva i **filtri scadenza azioni** («Tutte», «In scadenza 7 gg») con testo sovrapposto. Fix: override in `NCPage.css` su `.nc-workflow-btns .status-btn` e `.nc-action-due-filters .status-btn` (`width: auto`, padding, `white-space: nowrap`). Colore giallo su «in corso» = variante `.partial` attesa, non bug. **Lezione libreria UI:** riusare la classe canonica ma adattare il **sizing al contesto** — vedi [`LIBRERIA_UI_SGQ.md`](reference/LIBRERIA_UI_SGQ.md). PR [#112](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/112) merge `main` 17/06/2026 — verifica committente mobile **TEST OK**.

**Esperienza 31/05/2026 — RBAC Fase 2 (chiusura sessione — TEST OK)**

| Voce | Esito / lezione |
|------|-----------------|
| Codice | PR [#76](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/76) merge `main` — commit `cf5a556`; predicato `studioScopeClause` / `documentRegistryScopeClause` su write path audit, NC, allegati, registry ([ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) sez. 5–7) |
| Jest L1 | **22/22** (`auditListRbac`, `nc.controller`, `attachment.controller`) — 31/05/2026 |
| Smoke L3 | Script `.cursor/rbac-smoke-l3-phase2.mjs`: approccio **a fette** (`--slice`), non monolite; upload allegato non deve bloccare test audit/NC |
| Credenziali smoke | Solo `.cursor/mcp.env` + `.cursor/sync-sgq-smoke-env.ps1` — **mai** `_rbac-temp-pw.cjs` / rotazione hash DB admin |
| Token setup NC/allegati | `superadmin` con `auditor_org_id` **non** è org-wide per upload: usare token **tenant admin** org-wide |
| Cleanup | Ordine FK: `document_history` → `document_registry` → company/studio; utenti smoke = hard-delete SQL (API = soft-delete). `--keep-data` / `--cleanup` per ispezione committente |
| Dati reali | **Manitou** non cancellata dallo smoke (solo prefisso `RBAC_SMOKE_*`); scomparsa in UI = spesso filtro RBAC, non delete |
| Error pattern | Primo smoke monolitico: `NC_NOT_FOUND` su upload (scope superadmin); password admin compromessa da workaround — ripristinata da backup |

**Esperienza 31/05/2026 — chiusura slice D2 LIBRERIA_UI + smoke Registro Norme L1**

| Voce | Esito |
|------|--------|
| D2 | Grep `app/src`: zero import di `NonConformitiesManager.jsx` / `AuditTabsLayout.jsx` → rimossi 4 file (jsx+css); catalogo [`LIBRERIA_UI_SGQ.md`](reference/LIBRERIA_UI_SGQ.md) aggiornato |
| Registro Norme L1 | **30/30 OK** — `importNormCommit` (8), `standardsRegistry` (19), `normUploadResults` (3) |
| RBAC L3 (riuso) | **Non rieseguito** — `.cursor/rbac-smoke-l3-phase2.mjs` richiede `database.json` → SQL Server; fallito `localhost:1433` (DNS/host produzione non raggiungibile da desktop). Credenziali `mcp.env` OK; riuso smoke Fase 2 già in tabella sopra |


---

### Sessione 30/05/2026 — Modulo NC (chiusura sessione — attesa feedback utenti)

**Stato committente:** modulo NC **considerato terminato** per sviluppo pianificato; eventuali bug o ritocchi UX arrivano in **nuova chat** con feedback campo (es. Camellini).

#### Delta iniziale vs soluzione corretta

| Ipotesi iniziale | Realtà |
|------------------|--------|
| Registro NC = estensione tabella audit | Serve **modulo organizzativo** cross-audit ISO §10.2 con workflow proprio, push ISO+custom, gate RQ |
| Dettaglio sotto la griglia | **Drawer laterale** (pattern Documenti) + deep-link `/nc?select=` |
| Pulsanti workflow testuali custom | **`.status-btn`** con override dimensioni nel drawer, non nuove classi parallele |
| Encoding «solo produzione» | Byte Latin-1 in sorgenti dichiarati UTF-8 — fix repo + `check-utf8-encoding.js` (lezione **ripetuta**) |

#### Commit di riferimento (sessione)

| Hash | Contenuto |
|------|-----------|
| `8f66d93`–`b23f79d` | Fase 1 slice 5–11 — griglia, creazione, scadenze |
| `d80dafa` | Fase 1 chiusura — alert scadenze, simulazione |
| `ac9b1a8` | Hardening H1–H6 — push custom, RQ, CSV, azioni cross-NC |
| `327be94` | RichTextField + dettatura + draft offline |
| `6810518` | Drawer guidato flusso ISO 10.2 |
| `505e551` | Drawer laterale + encoding UI |
| `527a04d` | Layout pulsanti workflow nel drawer |

#### Lezioni consolidate (tutta la sessione NC)

1. **Simulazione NC audit → gap ISO:** `onRowSelect(rowKey, row)`; audit `status: active` per dropdown creazione; sezioni HLS su audit non ISO 9001 → **400** esplicito; E2E griglia preferire `/nc?select=<id>`.
2. **Slice verticali:** Fase 1 (griglia, modal, workflow, scadenze) poi H1–H6 senza mescolare migrazioni e refactor UI nella stessa consegna.
3. **Hardening:** push custom checklist (072), email 08:05 (`NC_ALERT_ENABLED`), approvazione RQ, export CSV client-side, tab azioni cross-NC.
4. **Golden rule UI:** ordine drawer ISO 10.2 — Scheda → Stato → Cause → Azioni → Evidenze → Verifica → Chiusura (non form flat per tipo campo).
5. **Encoding:** UTF-8 reale o `\u` in **stringhe JS**; mai `\u` come testo JSX grezzo; validare con `check-utf8-encoding.js` anche su `.md` manuale.
6. **Libreria UI:** catalogo Fase A ~52 pattern / ~55–65% UI reale — secondo passaggio su `pages/` e moduli secondari; consultare [`LIBRERIA_UI_SGQ.md`](reference/LIBRERIA_UI_SGQ.md) prima di nuovi blocchi UI.
7. **Form annidati (bug critico 07/06/2026):** HTML non supporta `<form>` nested. Se un componente contenitore (es. `NcDetailPanel`) usa `<form onSubmit>` e al suo interno c'è un altro `<form>` (es. `NcActionsList`), il browser ignora il form interno e il click su qualsiasi `type="submit"` submita il form esterno. Sintomo: nessun POST visibile nei log VPS, azione non salvata, "drawer chiuso senza errore". Fix: convertire il form contenitore in `<div>` e usare `type="button" onClick={handleSubmit}` per il pulsante di salvataggio esterno.

**Monitoraggio post-chiusura:** email job 08:05 (SMTP + destinatari `notifications_config`); push custom da audit reale Camellini; feedback utenti su drawer/flusso.

**Ripresa:** [PROMPT_RIPRESA_NC.md](agent-tasks/PROMPT_RIPRESA_NC.md) — solo bug feedback o P2 (AI CAPA, LIBRERIA_UI completa, export PDF).

---

### Sessione 24/05/2026 — Smoke E2E login Playwright (cloud agent)

#### Attività completate

| # | Cosa | Risultato |
|---|---|---|
| 1 | Documentazione Fase 6 test E2E autenticato | Template Playwright + errori comuni in `sgq-bug-fix-methodology.mdc` (commit `9ae2265`) |
| 2 | Smoke login su `systemgest.netlify.app` | **Primo tentativo fallito** — errore UI «Inserire email» |
| 3 | Diagnosi + fix template doc | Input React controllati: `page.fill()` non basta → `pressSequentially` su `#email` / `#password` |
| 4 | Smoke login (secondo tentativo) | **OK** — `POST /auth/login` 200, dashboard visibile (`admin@sgq.local`, org Al.project) |
| 5 | PR doc corretta | [#63](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/63) — **MERGED** su `main` (commit `d4c9a04`) |

#### Lezione appresa (24/05/2026)

**Ipotesi iniziale sbagliata:** credenziali errate o API backend non raggiungibile.

**Causa reale:** `Login.jsx` usa input **controllati React** (`value={formData.email}` + `onChange`). Playwright `page.fill()` scrive nel DOM ma **non** aggiorna lo stato React; al submit la validazione locale legge `formData` vuoto → «Inserire email», **senza** chiamare l'API (o con body vuoto).

**Pattern risolutivo (E2E su form React controllati):**

1. **Prima** verificare l'API con `curl` — se 200, il problema è UI/test, non backend.
2. Leggere il messaggio di errore **in pagina** (`.login-error`), non solo «form ancora visibile».
3. Compilare con `pressSequentially` (o helper `fillReactInput`) su `#email` / `#password`, non solo `page.fill()`.
4. **Non** usare Playwright MCP per login — non legge `SGQ_APP_PASSWORD`; usare script Node in `/tmp/test-login.mjs`.

**Regola ripetibile:** su qualsiasi form React controllato in test E2E, se il DOM mostra il valore ma la validazione fallisce → simulare digitazione reale (`pressSequentially`) o dispatch esplicito di eventi `input`/`change`.

**Riferimenti:** `sgq-bug-fix-methodology.mdc` Fase 6 (template aggiornato); `app/src/components/Login.jsx`.

---

### Sessione 26/05/2026 — Refactor UI slice A/B/D (vigenti, nav)

#### Attività completate

| Slice | Contenuto | Commit |
|---|---|---|
| A | Fix link HomePage `/nc`; contatore header vigenti (`rilasciato`+`vigente`, esclude `folder`); badge stato nascosto su cartelle via `shouldShowDocumentStatusBadge()` | `2640100` |
| B | `.btn-primary` centralizzato in `index.css`; rimosso duplicato da `DocumentRegistry.css` (override per-pagina mantenuti) | `2640100` |
| D | `@deprecated` su `NonConformitiesManager` e `AuditTabsLayout` (non in routing) | `2640100` |
| D2 | Rimossi file morti `NonConformitiesManager` / `AuditTabsLayout` (grep zero import in `app/src`) | 31/05/2026 |
| Backend | `backend/src/constants/documentStatus.js` + stats API allineate; deploy VPS `document.controller.js` + constants | deploy 26/05 |

#### Test L1

| Suite | Esito |
|---|---|
| `documentValidity.test.js` + `documentTree.test.jsx` | 22/22 OK |
| `documentStatus.test.js` (Jest) | 3/3 OK |

#### Lezioni apprese

- **Due significati di "vigente"**: stato ciclo di vita (`document_registry.status`) vs vigore norma (`type_specific_data.validity_status` su `doc_type=norma`) — contatore header e badge albero usano solo il primo; non confonderli in query SQL o UI.
- **Bug "0 vigenti" con badge verdi**: causa doppia — stats API ignorava status `vigente` (legacy migration 067) **e** cartelle mostravano badge per errore. Fix minimo: `RELEASED_STATUS_SQL_IN` condiviso FE/BE + `shouldShowDocumentStatusBadge()`.
- **Deploy constants nuova cartella VPS**: il manifest `backend/scripts/deploy-manifest.json` include `document.controller.js`, `src/constants/documentStatus.js` e tutti i servizi norme/NC; usare `deploy-controllers-to-vps.ps1` o `deploy-to-vps.sh` (non copia manuale). Preflight verifica file locali prima di SCP; post-deploy health check automatico.

#### Prossimo step (backlog, non in scope sessione)

- ~~Slice C: estrarre `SgqDataGrid` + pilota (`CompaniesPage` o `NCPage`)~~ ✅ 26/05 sera — vedi sotto
- ~~Slice B2: rimuovere `.btn-primary` duplicati identici a `index.css`~~ ✅ parziale — scoped override per-pagina
- Slice D2: eliminare file `@deprecated` dopo grep zero import
- Proposte estetiche sidebar/colori: richiedono OK committente (vedi `DEPUTYTASK.md`)

#### Pattern riusabile — SgqDataGrid (26/05/2026)

Componente condiviso `app/src/components/SgqDataGrid.jsx` per tabelle con sort, empty/loading, selezione riga opzionale.

| Prop | Uso |
|---|---|
| `theme="catalog"` | Stile Registro Documenti (`datagrid-*`, header scuro) — usato da `DocumentDataGrid` |
| `theme="plain"` | Intestazioni chiare — pilota `CompaniesPage` |
| `columns` | `{ id, label, sortable?, width?, cellClassName? }` |
| `renderCell(row, col)` | Contenuto cella |
| `selectable` + `selectedRowKey` | Toolbar contestuale (pattern DocumentDataGrid) |
| `getSortValue(row, colId)` | Sort custom (es. label tipo documento) |

CSS: `SgqDataGrid.css` (tema plain) + `DocumentDataGrid.css` (tema catalog + badge norme/scadenze).

**B2 CSS:** `.btn-primary` / `.btn-secondary` in `index.css`; override colore solo con selettore scoped (`.nc-page`, `.companies-page`, …) — mai duplicare regole globali identiche.

---

### Sessione 03/06/2026 — Visualizzazione Excel in-app (SpreadsheetViewer)

| PR | Contenuto |
|---|---|
| [#93](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/93) | `DocFileDialog`: `.xlsx` → `SpreadsheetViewer` (SheetJS) al posto di Office Online; download via `getDocFileBlob` |

**Lezione**: Office Online (`view.officeapps.live.com`) non funziona con API su `:8443` e senza token pubblico — stesso pattern già risolto per Word con `DocumentDocxViewer`.

**Smoke SAVECO scadenzario** (doc `1698`, org QS `1002`, file ~71 KB): 4 fogli (`TO_DO`, `SCADENZARIO`, `IMPIANTI TERMICI`, `PRESIDI ANTINCENDIO`) parsati con SheetJS su copia file da VPS. Verifica UI post-merge: login org Camellini → Registro documenti → SAVECO → Scadenzario → **Visualizza**.

### Sessione 25/05/2026 — Registro norme SoT R1–R7 (completato) e chiusura PR

#### Attività completate

| PR / commit | Slice | Contenuto |
|---|---|---|
| [#66](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/66) | R1 | Job validità norme legge `document_registry` come SoT; test L1 19/19; deploy VPS; log confermato `checked=1` |
| [#67](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/67) | R2+R5+Sprint11 | R2: lookup norma persiste su `type_specific_data` via JSON_MODIFY; R5: knowledgeIndexer arricchisce testo con metadati norma; CommercialCase test L1 14/14 (già implementato, test aggiunti) |
| [#68](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/68) | R4 | Badge vigore (verde/rosso/ambra) nella lista Catalogo; campo `norm_validity_status` nella lista API; CI verde; badge "Superata" visibile in prod su ISO_9016_2012 |
| `ef0d6f8` | R3+R6+R7 | Schema unificato upload bulk/form; backfill VPS idempotente; [ADR-011](adr/ADR-011-registry-norm-sot.md); deploy VPS OK |
| [#62](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/62) | Seed legislativo | Merge `b255207`: `findSeededLegislativoAmbientale` usa `CHARINDEX` al posto di `LIKE` (marker con `[]`); deploy VPS backend 25/05 |
| [#60](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/60) | Template Word audit | Merge `9ba45b7`: script `patch-audit-template-structure.cjs` + template ISO 9001/14001/3834/45001; CI `test-and-build` verde |
| [#64](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/64) | — | Chiusa senza merge (draft obsoleta); tema collocamento archivio da riaprire in roadmap se serve |

#### Lezioni apprese (sessione)

- **Scoperta vs implementazione**: Sprint 11 (CommercialCase) era già nel codebase — verificare prima di reimplementare; test/verifica restano utili su codice preesistente.
- **Backfill idempotente (R6)**: `mergeMissingNormTypeSpecificData` aggiorna solo campi mancanti — evita regressioni su dati già allineati post-R2/R3.
- **Allineamento bulk upload (R3)**: un solo contratto `type_specific_data` tra `normUpload.controller` e form manuale (`documentRegistryNorm.service.js`).
- **Chiusura PR stale**: chiudere draft obsolete (#64) senza merge riduce rumore su branch non allineati a `main`.

#### Prossimo step (roadmap)

- **ADR-009 Fase 2**: Sezione 11 e Close Panel per-norma + flag SGI integrato — vedi [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md).

### Sessione 24/05/2026 (bis) — Modulo documentale UX e upload

#### Attività completate

| # | Cosa | Risultato |
|---|---|---|
| 1 | Rimozione «Apri in Word/Excel» via WebDAV da `DocFileDialog` | Eliminato popup credenziali Windows (`Microsoft-WebDAV-MiniRedir`); editing resta via viewer browser + download |
| 2 | Tab **Catalogo**: `DocumentDataGrid` | Selezione riga, toolbar Allegato/Modifica/Archivia, colonne ordinabili, hint toolbar |
| 3 | Albero cartelle | Rimossa icona lucchetto confusa sulle cartelle di sistema; tooltip su nomi troncati |
| 3b | Albero cartelle (05/2026) | Rinomina/Elimina cartelle custom (elimina solo se vuota, 409 `FOLDER_NOT_EMPTY`); sottocartella sotto selezione; icone colore sistema vs custom; cartelle sistema non modificabili |
| 3c | Albero cartelle (05/2026) | Sidebar albero **ridimensionabile** (drag 220–480px, chiave `sgq-doc-tree-width`); su mobile (≤768px) barra con **nome completo cartella selezionata** sopra l'albero (tooltip `title` insufficiente su touch) |
| 4 | Upload hardening | Backend: limite **200 MB**; frontend: avviso soft **50 MB** + barra progresso; fix `getExt`; versioning in transazione SQL |
| 5 | Test `NormUploadButton` | 12 test Vitest aggiunti |
| 6 | Deploy su `main` | `2024747` (feat UX), `864c9e1` (integrazione DataGrid Catalogo) — **nessuna PR** |

#### Lezione appresa (modulo documenti)

**WebDAV rimosso dal dialog file:** il round-trip Office via WebDAV (vedi [sessione 16/05](#sessione-16-maggio-2026-sera--office-round-trip-webdav--lifecycle-documenti--viewer-docx-browser)) resta documentato lato backend, ma **non** va esposto in UI se il client Windows apre il popup credenziali nativo senza passare il token JWT. Preferire download + viewer `.docx` in browser finché non c'è un flusso Office365/SharePoint o link firmato temporaneo.

**Policy upload (200 MB / 50 MB):** hard limit server (413) + soft warning client prima dell'invio — evita upload bloccati a metà e allinea aspettative utente su reti lente.

**Pattern `DocumentDataGrid`:** riutilizzare per liste tabellari documenti (selezione singola, sort client-side, toolbar contestuale) invece di card sparse nel Catalogo; colonna selezione e frecce sort devono essere visibili subito (fix visibilità in `864c9e1`).

**Backlog differito:** feature «Condividi via email» con link temporaneo firmato — non in scope sessione.

---

### Aggiornamento 10/06/2026 — Qualifiche: ambito azienda obbligatorio

**Problema:** `qualifications.company_id` era nullable; UI con opzione «nessuna»; stesso certificato poteva finire su clienti diversi; import AI non ereditava l'azienda del job.

**Soluzione (pattern registro documenti):**

| Livello | Intervento |
|---------|------------|
| UI | Selettore **Ambito** su `QualificationsPage` (`qualificationsCompanyScope.js` + localStorage); creazione bloccata senza ambito; form con azienda obbligatoria; lock azienda se `approval_status = approvata` |
| API | `qualificationCompany.service.js` su POST/PUT e `commit-to-qualification` |
| DB | Migrazione **087**: backfill orfani → `NOT NULL` → indice unico filtrato `(org, company, cert#, person_name)` |

**Deploy produzione (ordine):**

1. Merge PR [#106](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/106) + deploy backend (controller + service) — **OK 10/06/2026**
2. Cloud Agent / VPS: `scp backend/scripts/run-migration-087-vps.js` → `node /tmp/run-migration-087-vps.js` — **OK 10/06/2026**
3. Netlify build frontend (ambito + form) — automatica su push `main`

**Pitfall migrazione 087:** prima di `ALTER COLUMN … NOT NULL` su `company_id` va droppato `IX_qualif_company`; nei filtered index SQL Server **non** ammette `LTRIM/RTRIM` nel predicato `WHERE`.

**Smoke:** creare qualifica con ambito selezionato; tentare stesso `certificate_number` su altra azienda → 409; dopo approvazione cambio azienda → 400.

---

### Aggiornamento 10/06/2026 — Collegamento anagrafica personale ↔ qualifiche

**Obiettivo:** collegare `company_personnel` (anagrafica NC/audit) al modulo qualifiche senza fondere i due moduli. Ogni certificato resta in `qualifications`; il collegamento è `personnel_id` + sync `person_name` da anagrafica.

**Documenti salute mansione (ISO 3834 — saldatori/ispettori VT):** oltre all'acuità visiva, prevedere come tipi qualifica con scadenza e PDF:

| Tipo qualifica | Note |
|----------------|------|
| Certificato acuità visiva | VT / ispettori |
| Certificato visione cromatica (Ishihara) | VT livello 2+ |
| Idoneità medica alla mansione | Sorveglianza ingresso |
| Sorveglianza sanitaria periodica | Rinnovo periodico |

**Slice implementate:**

| Slice | Contenuto |
|-------|-----------|
| A | `POST .../personnel/import-from-qualifications` — deduplica `normalizePersonKey` (codice > nome) |
| B | `qualifications.personnel_id` FK + picker form + validazione API |
| C | Tab **Salute mansione** su `QualificationsPage`; tipi in `occupationalQualificationTypes.js` |
| D | Pannello personale: Import / Collega / modal qualifiche per riga |

**Deploy produzione (ordine post-merge PR):**

1. Merge PR [#107](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/107) + deploy backend — **OK 10/06/2026** (PID 568473, health 200)
2. VPS: `node /tmp/run-migration-088-vps.js` — **OK 10/06/2026** (personnel_id, person_code, FK, indici)
3. Netlify produzione — **OK 10/06/2026** (tab Salute mansione, picker form, pannello personale)

**API:**

| Metodo | Endpoint |
|--------|----------|
| POST | `/companies/:companyId/personnel/import-from-qualifications` |
| POST | `/companies/:companyId/personnel/link-qualifications` |
| GET | `/companies/:companyId/personnel/:id/qualifications` |

**Smoke:** da scheda azienda → Import da qualifiche → Collega qualifiche → icona certificati su riga personale; nuova qualifica salute mansione con picker anagrafica; tab Salute mansione filtra i 4 tipi.

---

### Sessione 14/06/2026 — Import qualifiche ERAM + workflow preview (chiusura)

**Stato:** **CHIUSO — TEST OK** (preview committente su PR [#109](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/109), merge `20db3ff` / doc `b258837`).

| Obiettivo | Esito |
|-----------|-------|
| Import PDF qualifiche — azienda obbligatoria + segregazione `company_id` | ✅ UI ambito + API `qualificationCompany.service`; fix regressione JOIN `companies` (`98bc36f`) |
| Campi saldatore ISO 9606-1 end-to-end | ✅ Mig. **092**; catena AI → schema FE/BE → `commitToQualification` / ingest |
| PDF collegato al commit qualifica | ✅ Mig. **093**; `certificate_file_url` + `import_job_files.qualification_id` (`4152e81`) |
| Alert email + scadenzario qualifiche | ✅ Mig. **093**; `qualificationAlert.service`; righe virtuali `/deadlines` |
| Registro conferme semestrali 9606 | ✅ Mig. **094** (`101c7af`); API confirm/export; sezione in `QualificationForm` |
| UX Import PDF (menu **Altre azioni** + contrasto **Analisi AI**) | ✅ PR **#109** mergiata 14/06/2026 |
| Workflow branch → Deploy Preview → merge | ✅ Operativizzato; CORS preview su VPS + Express (`2034b63`); `netlify-preflight.ps1` + `.netlify.local.ps1` |

#### Delta iniziale vs finale (introspezione)

| Ipotesi iniziale | Esito reale |
|------------------|-------------|
| Scope tenant su `companies` via colonna `organization_id` nei JOIN | **Errato:** `companies` è scopata con `auditor_org_id` → join `auditor_orgs`; condizione `c.organization_id` in `importJobs.listJobs/getJob` bloccava lista Import PDF (`Invalid column name`) |
| Commit qualifica = solo record DB | Serve anche **`certificate_file_url`** da `storage_path` del file import (mig. 093) per link immediato in scheda |
| Merge UI senza preview | Preview Netlify + **TEST OK committente** obbligatori per feature UI; CORS preview va deployato sul VPS prima del test |
| `gh` / Netlify non usabili da agente Windows | **`netlify-preflight.ps1`** → `NETLIFY_ACCESS_OK`; **`gh auth login`** qsstudio241 — niente token in chat |

#### Regole ripetibili

1. JOIN `companies`: `LEFT JOIN companies c ON c.id = x.company_id` + scope org via `companyBelongsToOrg` / `auditor_org_id` — **mai** `c.organization_id`.
2. Nuovo campo qualifica: aggiornare **prompt AI, schema Zod, `documentTypeSchemas` FE+BE, commit/ingest** nella stessa slice.
3. Feature UI: branch → PR → preview → TEST OK → merge; eccezione solo hotfix o solo-backend già live.
4. Preflight tooling: `.\backend\scripts\netlify-preflight.ps1` e `gh auth status` **prima** di dichiarare CLI non configurata.

**Esperienza 16/06/2026 — Controparti PR1 live:** [PR #110](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/110) mergiata su `main` (merge `8b53608`); tab Controparti + mig. **096–097** + API nested; TEST OK committente (LM&CO, PT.MAIDO committente finale, riesame + analisi AI client senza errori console). **Prossimo:** PR2 select committente in `ContractReviewPage` ([DEPUTYTASK](agent-tasks/DEPUTYTASK.md)).

---

### Aggiornamento 22/05/2026 — JSX: sequenze literal `\u` in UI (Rischi / Progetti / Qualifiche)

**Sintomo:** in pagina (es. **Rischi & Obiettivi**) titoli, tab e icone apparivano come testo `\u26A0\uFE0F`, `\uD83D\uDEA7`, `\u00e0`, `\u00a7`, ecc.

**Causa:** in React, il contenuto tra tag (`<h1>\uXXXX ...</h1>`) è **HTML/JSX testuale**, non una stringa JavaScript → `\u` **non viene interpretato**.

**Fix applicati:**  
- `app/src/pages/RisksPage.jsx` — testo/icona tramite **`{"..."}`** (stringa JS con escape dove servono emoji) o UTF-8 per italiano/simbolo ×.  
- `app/src/pages/QualificationForm.jsx` — stesso schema sull’errore form.  
- `app/src/pages/ProjectsPage.jsx` — pulsante **Sì** (prima `S\u00EC` in JSX, mostrato letterale).

**Regola ripetibile:** prima di `\u`/emoji in JSX, preferire **`{expr}`** dove `expr` è stringa/template **JavaScript**, oppure scrivere il carattere Unicode diretto in UTF-8.

---

### Sessione 22/05/2026 — Fix allegati ISO 45001

**Problema**: pulsante "+ Aggiungi Allegati" visibile ma non funzionante sulla checklist 45001 (errore silenzioso "ID domanda non disponibile"). Su 9001 e 14001 funzionava regolarmente.

**Causa root**: `ISO_45001_TEMPLATE` in `checklistTemplates.js` aveva tutte le 53 domande con `questionId: null`. `useAttachmentManager` blocca l'upload alla prima riga se `questionId == null`. Le domande esistevano già nel DB (question_id 276-328, migration maggio 2026) ma il template frontend non era stato allineato.

**Fix** (solo frontend, nessun VPS):
- `checklistTemplates.js` — template riscritto con 53 domande reali, `sectionCode` allineati al DB (`45001_c4`…`45001_c10`), `questionId` 276-328
- `StorageContext.jsx` — `hydrateQuestionIds` estesa per `ISO_45001` (standard_id=3) con remap sezioni legacy (`clause4 → 45001_c4`)
- `ChecklistModule.jsx` — hydratation attivata anche per ISO_45001

**Regola appresa — "Template-DB parity"**: ogni volta che si inseriscono domande nel DB per un nuovo standard, aggiornare **immediatamente** il template frontend corrispondente con i questionId reali. Un template con `questionId: null` blocca allegati, sync risposte e ogni funzione che richiede l'ID numerico del DB.

**Verifica rapida**: `curl -s "https://systemgest.netlify.app/assets/$(curl -s https://systemgest.netlify.app/ | grep -o 'index-[^"]*\.js')" | grep -c 'questionId:[0-9]'` deve restituire > 0 per ogni standard attivo.

---

### Audit multi-giorno (migrazione 070 — maggio 2026)

| Campo | Ruolo |
|--------|--------|
| `audits.audit_date` | Data **inizio** (invariato, retrocompatibile) |
| `audits.audit_date_end` | Data **fine**; `NULL` o uguale a inizio = audit mono-giorno |
| `metadata.auditDateEnd` / `generalData.auditDateEnd` | Mirror frontend + sync (`audit_extra_data`) |

- **Validazione**: fine ≥ inizio; avviso (non blocco) se date nel futuro — come `audit_date` (`auditUtils.js`).
- **Word**: `{auditDate}` = inizio; `{auditDateEnd}`; `{auditPeriod}` (es. `10/05/2026 – 12/05/2026` o singola data).
- **DB**: `database/migrations/070_audit_date_end.sql`; su VPS: `backend/scripts/run-migration-070-vps.js` (scp + `node /tmp/...`).
- **Deploy backend**: dopo migrazione, `deploy-controllers-to-vps.ps1` + restart `sgq-backend`.

---

### Sessione 16 maggio 2026 (sera) — Office round-trip WebDAV + lifecycle documenti + viewer .docx browser

#### Sintesi
Maratona stabilizzazione Office round-trip e lifecycle documenti. Ha richiesto 9 fix
consecutivi sul WebDAV controller perché Word desktop su Windows ha un comportamento
poco documentato: delega le richieste WebDAV al client nativo `Microsoft-WebDAV-MiniRedir`
che NON inoltra i query parameter del browser.

#### Fix WebDAV (in ordine di scoperta)
1. **Spazi nel nome file** — `encodeURIComponent` produce `%20` ma Office decodifica
   in spazio letterale prima della richiesta HTTP → Nginx 400. Fix: sanitize del filename
   nell'URL (`spazi → _`, caratteri speciali → `_`). Il file è sempre recuperato dal DB
   via `docId`, il nome nell'URL è solo cosmético.
2. **URL senza porta 8443** — Nginx usa `proxy_set_header Host $host` (senza porta) →
   backend generava URL su porta 443 (default HTTPS, non aperta). Fix: variabile
   `WEBDAV_BASE_URL=https://www.fr-busato.it:8443` nel `.env` del VPS.
3. **CORS middleware Express intercetta OPTIONS WebDAV** — il middleware `cors()` con
   `preflightContinue: false` rispondeva 204 a TUTTE le OPTIONS, anche quelle WebDAV
   di Office, senza header `DAV: 1, 2`. Office non riconosceva il server come WebDAV
   scrivibile e apriva in sola lettura. Fix: wrapper che bypassa `cors()` per
   `OPTIONS /webdav/*`.
4. **Handler HEAD mancante** — Office invia HEAD prima di LOCK ("Existence Discovery",
   "Word 2014 check"). Senza handler → 405. Fix: aggiunto `handleWebdavHead`.
5. **Route OPTIONS senza filename** — `OPTIONS /webdav/:orgId/:docId/` (collection)
   ritornava 404. Fix: route `webdavRouter.all('/:orgId/:docId/', ctrl.handleWebdavOptions)`.
6. **PROPFIND/HEAD richiedevano token ma MiniRedir non lo passa** — il client WebDAV
   nativo Windows scarta `?dt=token` e fa PROPFIND senza auth → 401 ripetuto 12 volte
   → Word assume read-only. Fix: PROPFIND e HEAD accettano richieste senza token
   (espongono solo metadata pubblici, scopati a `orgId+docId`).
7. **LOCK/UNLOCK senza token mostravano dialog credenziali Windows** — il 401 attivava
   automaticamente il prompt "Sicurezza di Windows". Fix: LOCK e UNLOCK accettano
   senza token (sono advisory, non scrivono dati). PUT resta protetto.
8. **GET dopo LOCK senza token (causa principale del prompt)** — MiniRedir, dopo aver
   ottenuto il LOCK, rifaceva GET del file e perdeva di nuovo il `?dt=`. Fix definitivo:
   **token nel PATH** invece che in query string.
   - Prima: `https://host:8443/webdav/orgId/docId/file.docx?dt=TOKEN`
   - Dopo:  `https://host:8443/webdav/dt/TOKEN/orgId/docId/file.docx`
   - MiniRedir preserva l'intero path → tutte le richieste restano autenticate
9. **Vera sola lettura** — `ms-word:ofv` apre Word in "view mode" ma è solo una hint:
   se il server WebDAV è scrivibile, Word permette il banner "Modifica comunque". Fix:
   token con `mode: 'edit' | 'read'` nel `tokenStore`. PUT respinge 403 se mode='read'.
   Il client passa `mode='read'` per il pulsante "Visualizza".

**Regola consolidata WebDAV**: ogni operazione che NON modifica i dati deve essere
accessibile senza token (Microsoft-WebDAV-MiniRedir li scarta). Solo PUT richiede
auth completa. Il path scopato a `(orgId, docId)` garantisce il multi-tenant.
Quando si genera l'URL, **mettere sempre il token nel PATH**, mai in query string.

#### Lifecycle documenti (rilasciato/bozza + RILASCIA REVISIONE)
Implementato lifecycle ISO 9001 §7.5 sul registro documenti:
- **DB migrato** (41 doc): aggiunte colonne `revision_number INT DEFAULT 0` e
  `released_at DATETIME2 NULL`. `CHECK constraint` aggiornato per includere
  `rilasciato`, `bozza`. UPDATE `vigente → rilasciato`.
- **Backend**: `vigente → rilasciato` in tutte le query (5 file). Nuovo endpoint
  `POST /api/v1/documents/:id/release-revision` (incrementa revision_number,
  imposta released_at, genera label "Rev. NN" se non fornita).
- **WebDAV PUT**: dopo salvataggio Word → `status='bozza'`. **Eccezione**: se
  `doc_type='folder'` non aggiorna lo status (le cartelle non hanno lifecycle
  revisione anche se hanno file allegati).
- **Frontend**: `DocFileDialog` con alert "Documento rilasciato — aprirlo creerà
  bozza, continuare?" + pulsante verde "Rilascia revisione" per le bozze.
- **Filtro UI default**: cambiato da `status='rilasciato'` a `status=''` (= tutti
  gli stati attivi). Backend in mancanza di filtro esplicito esclude solo `obsoleto`.
  Senza questo fix i documenti appena salvati in bozza "scomparivano" all'utente.

#### Viewer documenti (PDF + .docx browser-native)
- **PDF viewer (DocumentPdfViewer)**: 2 fix.
  - `frame-ancestors 'none'` di Helmet bloccava l'iframe del viewer. Fix:
    `frameAncestors: ["'self'", ...CORS_ORIGIN]` per permettere embedding solo
    dai domini Netlify.
  - Il viewer usava `<iframe src="...?token=NULL">` (`getToken()` ritorna null
    su desktop con cookie httpOnly). Fix: `getDocFileBlob()` con `fetch` +
    `URL.createObjectURL()`. Nessun token in URL.
- **NUOVO Viewer .docx (`DocumentDocxViewer`)**: usa libreria `docx-preview`
  (173KB / 51KB gzip, chunk separato lazy-loaded). Renderizza `.docx` come HTML+CSS
  preservando layout, tabelle, immagini. **Vera sola lettura totale**: nessun modo
  per modificare. Niente Microsoft Cloud, niente Word desktop richiesto.
- Controlli viewer: zoom 50%-250%, fullscreen toggle, scarica.
- Routing pulsante "Visualizza":
  - `.pdf` → `DocumentPdfViewer` (iframe nativo browser)
  - `.docx`/`.doc` → `DocumentDocxViewer` (docx-preview)
  - `.xlsx` → `SpreadsheetViewer` (SheetJS in-app, PR #93)

#### DocumentDetailPanel (slide-in dettaglio documento)
Bug: il pannello slide-in da albero/catalogo mostrava sempre "Nessun file allegato"
anche con file presente. Causa: leggeva `doc.files`, popolato solo da `/documents`
list ma non da `/documents/tree/...`. Fix: `useEffect` che chiama `getDocFiles(docId)`
quando il pannello si apre.

#### Lezioni apprese (18/05/2026) — Rate limit e loop di retry lock

**Sintomo**: sezione 1.4 "Rilievi Ente Certificatore" mostrava "Troppe richieste" continuamente (utente Camellini).

**Causa radice**: heartbeat lock (60s) fallisce per 429 → `demoteOwnerLockOnHeartbeatFailure` imposta `mode="pending_server"` → effect retry ogni 5s → esaurisce il budget rate limit (500 req/15min) → tutte le API bloccate → ciclo infinito.

**Fix**: (1) heartbeat ignora 429 (riprova al ciclo successivo 60s); (2) `pending_server` retry usa backoff esponenziale su 429 (5s→120s max); (3) rate limit alzato da 500 a 1000 req/15min.

**Regola generale**: ogni `setInterval`/`setTimeout` che chiama API **DEVE** gestire il 429 con backoff o skip silenzioso — mai ignorarlo lasciando il timer attivo a intervallo fisso. Senza questa protezione un singolo sottosistema (es. lock) puo' bloccare l'intera app.

**Diagnosi rapida**: se un utente vede "Troppe richieste" → `sudo grep 429 /var/log/nginx/access.log | grep IP_UTENTE | tail -30` per capire quale endpoint genera il loop.

#### Lezioni apprese (16/05/2026 sera)
1. **Microsoft-WebDAV-MiniRedir** è un client legacy di Windows che parte automaticamente
   quando un'app Office invoca un URL WebDAV. **Non passa token in query string**.
   Per supportarlo: o token nel path, o auth via Basic/NTLM, o endpoint pubblici per
   metadata read-only.
2. **`ms-word:ofv`** è una hint UI, non un blocco di scrittura. Per vera sola lettura
   serve respingere il PUT lato server con un token mode separato.
3. **`docx-preview` è il viewer .docx browser-native più affidabile**. Office Online
   Viewer fallisce con porte non standard come `:8443` (limitazione documentata
   Microsoft).
4. Quando il filtro UI default nasconde stati di workflow (`bozza`), l'utente
   percepisce "il file è sparito". Default sicuro: **mostra tutto tranne soft-deleted**.
5. **Cartelle (`doc_type='folder'`) non sono documenti** anche se hanno attachment.
   Il lifecycle revisione (bozza/rilasciato/RILASCIA REVISIONE) non si applica.
   Filtrare esplicitamente in tutte le operazioni di transizione di stato.

#### Commit principali (16/05/2026 sera)
- `fix(webdav): sanitize filename in URL` (PR #50)
- `fix(webdav): token nel path URL anziche' query string`
- `fix(webdav): rimuove dialog credenziali Windows su LOCK`
- `feat(webdav): token mode (edit|read) per garantire vera sola lettura`
- `feat(docs): lifecycle documenti — rilasciato/bozza + RILASCIA REVISIONE` (PR #51)
- `feat(viewer): visualizzatore .docx browser-native (sola lettura)`
- `feat(viewer): zoom e fullscreen per visualizzatore .docx`
- `fix(docs): pannello dettaglio carica i file allegati via API`
- `fix(docs): cartelle non diventano bozza al salvataggio Word + filtro default mostra bozze`

#### Punti aperti (per ripresa 17/05/2026)
1. **Placeholder dinamici nei .docx** (richiesta utente). Pattern proposto: hook
   nell'endpoint `release-revision` che apre il `.docx` con `docxtemplater` (già nel
   progetto), sostituisce `{{data_rilascio}}`, `{{numero_revisione}}`, `{{revisione_label}}`,
   salva la nuova versione. Da implementare.
2. ~~**Excel viewer**~~ → risolto PR #93 (`SpreadsheetViewer` + `getDocFileBlob`).
3. **Test L1** della suite frontend non eseguiti dopo le modifiche di oggi (Vitest).
   Da lanciare prima di considerare definitivamente chiuso il modulo Word round-trip.
4. **Pulsante "Visualizza" su .doc legacy**: docx-preview probabilmente non supporta
   `.doc` (formato binario pre-2007). Verificare e gestire fallback.
5. **`SGQ_APP_PASSWORD` Cloud Secret** non corrisponde all'hash DB (verificato in
   sessione). L'utente dovrebbe aggiornare il segreto in Cursor Cloud per permettere
   ai prossimi cloud agent di fare test UI con login automatico.

---

### Sessione 16 maggio 2026 — Assistente AI: contesto azienda e ottimizzazione knowledge

#### Architettura assistente AI — contesto e ottimizzazione

- **Contesto a 4 livelli**: Studio (implicito da org), Azienda (auto da audit + override manuale con dropdown), Standard (backlog), Sessione (backlog)
- **Soft reset conversazione**: separatore visivo al cambio contesto, messaggi precedenti sfumati ma accessibili, clear per azzeramento completo
- **Knowledge Optimizer**: L1 notturno 03:00 (dedup cosine >0.95, prune stale NC chiuse >180gg, gap detection per azienda), L2 settimanale domenica 04:00 (sintesi AI per azienda, pattern trasversali cross-company, enrichment chunk deboli)
- **Dashboard KPI Knowledge Health**: `/ai-knowledge-health`, solo admin/superadmin — 4 KPI cards, coverage per azienda, gap rilevati
- **Modello embedding**: `gemini-embedding-001` (NON `text-embedding-004` che è deprecato)
- **Migrazioni**: 063 (colonna `company_id` + indice su `knowledge_chunks`), 064 (tabelle `ai_usage_log` + `ai_optimization_runs`, colonne `is_stale`/`usage_count`), 065 (colonna `source_run_id` su `knowledge_chunks`)
- **Protezione chunk AI**: i chunk con `entity_type` prefisso `ai_*` non vengono cancellati dal reindex

#### Lezioni apprese (16/05/2026)

- **Bug pattern query indexer**: verificare sempre che le colonne SQL nelle query dell'indexer corrispondano allo schema reale del DB. Fix multipli: `nc_type` inesistente, `corrective_action` → `resolution_summary`, `NULL AS company_id` → `r.company_id`, `organization_id` → `auditor_org_id` in companies join.
- **Modello embedding Gemini**: `text-embedding-004` è deprecato e ritorna errore. Usare `gemini-embedding-001`.
- **Contratto API flat vs nested**: quando si progetta un endpoint dashboard (es. `/ai/knowledge-health`), definire il formato di risposta (flat object vs nested) e allinearlo subito al frontend. Disallineamento causa errore silenzioso (valori `undefined`).

#### Commit principali (16/05/2026)

| Commit | Contenuto |
|--------|-----------|
| `306e0fe` | AI context: companyId in chat, chip header, dropdown, migrazione 063 |
| `4f467b5` | AI usage log + Knowledge Optimizer L1, migrazione 064 |
| `23aeaaa` | Dashboard Knowledge Health frontend + endpoint |
| `87f628e` | Knowledge Optimizer L2 (sintesi AI settimanale), migrazione 065 |
| `2e521d2`, `d3a4374` | Bug fix: contratto API, embedding deprecato, query SQL |

---

### Sessione 15 maggio 2026 — Fix sezione 1.4 ghost-click mobile

#### Problema
Camellini: "nella sezione 1.4, quando aggiunge un rilievo si chiude continuamente".

#### Causa radice
**Ghost-click mobile** (iOS/Android): il browser genera un secondo click sintetico ~300ms dopo il tap su un pulsante. Se il tap apre una modale `position:fixed; inset:0`, il ghost-click atterrisce sull'overlay nello stesso punto e, se `e.target === e.currentTarget`, chiude la modale immediatamente. Su desktop il bug non è riproducibile (il mouse non genera ghost-click).

#### Fix
`CertificationFindingsSection.jsx` — `openTimeRef = useRef(0)`:
- `openNew()` e `openEdit()` salvano `Date.now()` al momento dell'apertura
- L'overlay ignora i click entro 350ms dall'apertura

**Regola generale**: qualsiasi overlay `position:fixed` aperto da un tap mobile deve proteggere dalla chiusura accidentale entro 300-400ms via debounce sul `Date.now()`. Questo vale per tutte le modali aperte da pulsanti (non solo `CertificationFindingsSection`).

**Branch**: `cursor/fix-cert-findings-modal-close-7b68` → PR #48 → mergiata su `main` (commit `6898554`).

---

### Sessione 14 maggio 2026 — Fix UI mobile + microfono PWA (root cause header HTTP)

#### Attività completate

| # | Cosa | Risultato |
|---|---|---|
| 1 | Fix pulsanti C/NC/OSS/OM/NA/NV su mobile | `flex-wrap:wrap` + `min-width:calc(33.333%-6px)` in `ChecklistModule.css` → layout 3+3 garantito |
| 2 | Fix microfono PWA Android | Root cause: `Permissions-Policy: microphone=()` in `netlify.toml` bloccava tutto → cambiato in `microphone=(self)` |
| 3 | Robustezza `AutoTextarea` | `getUserMedia` pre-check + `permissions.query` upfront + gestione errori per tutti i codici Speech API |

#### Lezioni apprese (14/05/2026)

- **`Permissions-Policy` blocca le API browser prima dei permessi Android/Chrome.** Se una funzione (mic, camera, geolocation) non funziona su PWA Netlify nonostante i permessi di sistema siano concessi, verificare **subito** `netlify.toml` → sezione `[[headers]]` → `Permissions-Policy`. Il valore `microphone=()` blocca _tutto_ senza mostrare alcun dialog. Il corretto è `microphone=(self)`. **Regola**: controllare l'header HTTP prima di diagnosticare permessi utente.

- **Su Android PWA, `console.log` può non apparire mai se il service worker serve il bundle vecchio.** Se l'utente dice "non vedo log" → il click potrebbe non raggiungere il nuovo codice. Soluzione: aggiungere un **pannello di debug in-page** (stato React visibile sullo schermo) che bypassa sia la console che la cache del SW. Pattern da usare ogni volta che i log di console non sono affidabili su mobile.

- **`getUserMedia({audio:true})` deve precedere `SpeechRecognition.start()` su Android Chrome PWA.** Senza questa chiamata, Chrome non mostra il dialog di consenso nativo e rigetta silenziosamente. Sequenza corretta: `permissions.query` → `getUserMedia` → `SpeechRecognition.start()`.

- **Test E2E autenticato da cloud agent (pattern verificato 24/05/2026)**: NON usare il Playwright MCP per il login — non ha accesso alle env var. Usare uno script Node.js in `/tmp/test-login.mjs` che legge `process.env.SGQ_APP_PASSWORD`. Setup: `cd /tmp && npm install playwright && npx playwright install chromium`. **Attenzione**: il form login usa input React controllati — `page.fill()` da solo fallisce con errore «Inserire email»; usare `pressSequentially` su `#email` / `#password` (template in `sgq-bug-fix-methodology.mdc` Fase 6).

- **Netlify può aggiornare gli header CDN (`netlify.toml`) senza ricompilare il bundle JS.** Se si cambia solo `netlify.toml` → header live in pochi minuti; bundle invariato. Se si cambia codice in `app/` → bundle nuovo hash al prossimo deploy completo.



**Branch**: `cursor/adr-010-ai-agentic-architecture-7330` → mergiato su `main` (commit `49a6a6c`).

### Sessione 02 giugno 2026 — API complete Riesame requisiti + UI slide

**Branch**: `cursor/contract-review-api-complete-5351`  
**Spec**: [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md)

| Area | Contenuto |
|---|---|
| Backend | `contractReviewWorkflow.service.js` (gate ISO §8.2), estensione controller/routes, migrazione **068** |
| Frontend | `ContractReviewPage` con **slide** Workflow / Checklist / Chiarimenti / Documenti / Analisi AI; inbox + summary |
| Test L1 | Jest workflow + controller; Vitest `contractReviewLabels.test.js` |
| Doc API | Sezione in [BACKEND_API.md](reference/BACKEND_API.md) |

**Slide UI dettaglio** (ordine operativo): tab orizzontali — non confondere con presentazioni; guidano il commerciale/tecnico fase per fase.

**Deploy VPS** (cloud agent): `scp` migration SQL + `run-migration-068-vps.js`; deploy `contractReview.controller.js`, `contractReview.routes.js`, `contractReviewWorkflow.service.js`; restart `sgq-backend` con verifica PID.

**Chiusura sessione 02/06/2026** — **TEST OK**

| Esito | Dettaglio |
|---|---|
| PR | [#79](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/79) mergiata su `main` (`2521b5b`) |
| UI produzione | https://systemgest.netlify.app/contract-reviews — tab slide deployate |
| Migrazione 068 | Applicata VPS; fix batch `GO` prima dell'indice `IX_attachments_commercial_case` |
| Incidente login | SQL Server **Evaluation scaduta** (errore 17051) → `mssql-conf -n set-edition` con `MSSQL_PID=Developer`; `systemctl reset-failed` + start; restart backend |

**Lezioni (02/06/2026)**

- **Login impossibile + health `unhealthy`**: verificare **prima** `GET /api/v1/health` e `systemctl status mssql-server`. Sintomo tipico: `Failed to connect to localhost:11043`. Log: `/var/opt/mssql/log/errorlog` — cercare `evaluation period has expired`.
- **Recovery SQL Evaluation scaduta**: `sudo ACCEPT_EULA=Y MSSQL_PID=Developer /opt/mssql/bin/mssql-conf -n set-edition` → `sudo systemctl reset-failed mssql-server` → `sudo systemctl start mssql-server` → restart `sgq-backend`.
- **Migrazione 068**: indice filtered su colonna appena aggiunta richiede separatore `GO` (SQL Server valida il batch prima del commit DDL).

**Prossimo passo opzionale**: smoke L3 manuale tab slide + transizione con gate; Sprint 9–10 `import-from-job`.

### Slice R1 import-from-job (02/06/2026 pomeriggio)

**PR**: [#80](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/80) mergiata (`5403b1c`).

| Elemento | Dettaglio |
|---|---|
| Endpoint | `POST /api/v1/contract-reviews/import-from-job` |
| Effetto | Caso `DRAFT` + checklist preliminare + allegati da file job (`extracted`/`reviewed`) |
| Idempotenza parziale | **409** `ALREADY_LINKED` se `storage_path` già su `attachments.commercial_case_id` |
| Deploy | Backend VPS aggiornato; health OK |
| Test L1 | Jest `contractReview.controller.test.js` (+4 test) |

**Prossima slice**: ~~**R2**~~ ✅ — vedi sotto. **R3** link bidirezionale (migrazione **070**).

**Lezione**: piano slice in `TASK_RIESAME_ESTENSIONI_SLICES.md` va committato su `main` **prima** di delegare al deputy locale — altrimenti l'agente non trova la spec (commit `0e6160a`).

### Slice R2 UI Import Jobs (02/06/2026 sera) — TEST OK

**PR**: [#81](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/81) UI; hotfix DB [#82](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/82) migrazione 069.

| Elemento | Dettaglio |
|---|---|
| UI | Pulsante «Crea caso Riesame» + modale (titolo, cliente, anteprima testo) in `ImportJobsPage.jsx` |
| API client | `importContractCaseFromJob` → `POST /contract-reviews/import-from-job` |
| Successo | Redirect `/contract-reviews/:id` (History API — usare `waitForFunction` su pathname in smoke Playwright) |
| Smoke L3 | Playwright autonomo su `systemgest.netlify.app`: job PDF → estrai → conferma → allegato in tab Documenti → refresh OK |

**Bug scoperto in smoke (R1 residuo):** `CHK_attachments_parent` (036) non accettava righe con solo `commercial_case_id` (068). Fix migrazione **069** su VPS.

**Lezione**: dopo ogni migrazione che aggiunge un nuovo «parent» agli allegati, aggiornare subito `CHK_attachments_parent` — altrimenti endpoint che linkano file senza audit/NC/document_id falliscono in produzione.

**Prossima slice**: ~~**R3**~~ ✅ — vedi sotto. **S1** UI fornitori.

### Slice R3 link bidirezionale (02/06/2026) — TEST OK

**PR**: [#83](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/83) link job↔caso; hotfix [#84](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/84) badge origine.

| Elemento | Dettaglio |
|---|---|
| Migrazione **070** | `commercial_cases.source_import_job_id`; `import_job_files.commercial_case_id` — VPS OK |
| UI job | Badge «Caso Riesame #N»; pulsante create nascosto se collegato |
| UI caso | Badge «Origine: Import job #N» → `/settings/import-jobs?job=N` |
| Idempotenza | 409 `ALREADY_LINKED` con `case_id` |
| Smoke L3 Epic R | Playwright 14/14 su `systemgest.netlify.app` (job #10 → caso #7) |

**Bug smoke R3:** `rowCase()` in `ContractReviewPage.jsx` non propagava `source_import_job_id` → badge origine assente nonostante API corretta. Fix one-liner PR #84.

**Lezione smoke import PDF:** usare PDF valido per `pdf-parse` (es. sample Mozilla); PDF minimali/generati possono fallire con «bad XRef entry». Login smoke cloud: preferire API login + `localStorage` token (`sgq_auth_token`) se il form React non invia POST.

**Prossima slice**: ~~**S2**~~ ✅ — vedi sotto. **N1** notifiche eventi.

### Slice S2 supplier_id anagrafica (02/06/2026) — TEST OK agente

| Elemento | Dettaglio |
|---|---|
| Migrazione **073** | `commercial_case_documents.supplier_id` + FK `suppliers` + indice |
| Backend | `linkDocument` valida `supplier_id` org-scoped; `getCase`/`listCaseDocuments` espongono `supplier_name` |
| UI | Dropdown fornitore se controparte=Fornitore; badge nome fornitore; highlight checklist P9 |
| Test L1 | Jest `linkDocument` (4 casi) + build Vite OK |
| Deploy VPS | Migrazione 073 + controller deployato; health 200 |
| PR | [#86](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/86) (include S1) |

**Nota numerazione:** la spec citava migrazione 071 ma quella è già usata per NC — S2 usa **073**.

**Prossima slice**: ~~**N1**~~ ✅ — Epic estensioni **completa** (H1).

### Slice N1+N2 notifiche approvazione (02/06/2026) — TEST OK agente

| Elemento | Dettaglio |
|---|---|
| Migrazione **074** | Tabella `commercial_case_notifications` |
| Service | `contractReviewNotification.service.js` — eventi `pending_approval` e `assigned` |
| Email N2 | Trigger immediato via `alertMail.service.js` con link `/contract-reviews/:uuid` |
| Test L1 | Jest service (6) + controller mock OK |
| Deploy VPS | Migrazione 074 + deploy backend; health 200 |
| PR | [#87](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/87) |

### Slice H1 handoff stub H-A (02/06/2026) — TEST OK agente

| Elemento | Dettaglio |
|---|---|
| Decisione H0 | Opzione **H-A** (riferimento testo, nessun modulo commesse) |
| Migrazione **075** | `handoff_ref`, `handoff_at`, `handoff_by`, `handoff_notes` su `commercial_cases` |
| API | `POST /contract-reviews/:id/handoff` — solo status `APPROVED` |
| UI | Tab Workflow: sezione «Passaggio a esecuzione» + riepilogo dopo registrazione |
| Fix | `rowCase()` propagava campi handoff (pattern R3 `source_import_job_id`) |
| Test L1 | Jest `registerHandoff` (4 casi) + build Vite OK |
| Deploy VPS | Migrazione 075 + deploy backend; health 200 |
| PR | [#88](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/88) |

### Personale azienda S4+S5 + VPS migration 078 (02/06/2026)

| Elemento | Dettaglio |
|---|---|
| Migration **078** | Tabella `company_personnel` + bridge `notification_contacts`; script `backend/scripts/run-migration-078-vps.js` |
| API | `GET/POST/PUT/DELETE /api/v1/companies/:companyId/personnel` |
| UI | Route frontend `/companies/:id` — tab Anagrafica + Personale (`CompanyDetailPage`, `CompanyPersonnelPanel`) |
| Deploy VPS | Migration 078 OK; deploy controller/routes personale; health `https://www.fr-busato.it:8443/api/v1/health` OK (MainPID rinnovato post-restart) |
| Test | Vitest `companyDetailPage.test.jsx` — 3/3 |

### Hotfix viewer + RBAC Fase 4 company_access (02/06/2026)

| Elemento | Dettaglio |
|---|---|
| Hotfix | Viewer studio: POST/PUT/DELETE personnel → 403; UI nasconde CRUD (`canEdit`) |
| Migration **081** | `user_company_access` (permission read/write per user+company) |
| API admin | `GET/POST/DELETE /admin/users/:id/company-access` |
| Auth | `company_access[]` in login e `GET /auth/me` |
| UI | Menu ridotto cliente azienda; `CompaniesPage` senza Nuova/Elimina; `canEdit` da permission |
| Test | Jest personnel 14 + service 6; Vitest `companyAccess.test.js` 3 |
| Account test | `cliente.azienda11@…` write company 11; `viewer.azienda11@…` read — password in mcp.env |
| VPS | Migration **081** applicata 02/06/2026 (tabella + 2 righe test); deploy `companyAccess.service.js` + controller; health 200; smoke viewer POST 403 / cliente write 201 |

### Slice S1 UI counterparty fornitori (02/06/2026)

| Elemento | Dettaglio |
|---|---|
| UI tab Documenti | Select Controparte (Cliente/Fornitore/Interno) + Direzione (in/out) su collega registro e upload |
| Badge riga | «Fornitore · in» (arancione se supplier) su documenti registro e allegati |
| Backend | Nessuna modifica — API già accettava `counterparty`/`direction` |
| Test L1 | `contractReviewLabels.test.js` + build Vite OK |

**Prossima slice**: ~~**S2**~~ ✅ PR [#86](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/86). **N1** notifiche.

#### Attività completate

| # | Cosa | Risultato |
|---|---|---|
| 1 | Verifica licenza `ai_review`/`ai_assist` per org 1002 | `licensed_modules = null` = tutti i moduli già attivi — nessuna modifica necessaria |
| 2 | GEMINI_API_KEY configurata sul VPS | `AIzaSyAyeq...` in `/var/www/sgq-backend/.env` |
| 3 | GEMINI_MODEL aggiornato | `gemini-2.5-flash` (unico modello funzionante nel free tier con questa key) |
| 4 | Smoke test `/ai/suggest` | HTTP 200 in ~1.7s — Gemini risponde correttamente |
| 5 | Seed `norm_requirements` | 234 clausole: ISO 9001 (91), ISO 14001 (45), ISO 45001 (56), 3834-1 (3), 3834-3 (35), 3834-5 (4) |
| 6 | Merge PR #44 in main | Conflitti risolti (migrazioni rinomerate, App.jsx + AppLayout.jsx uniti) |
| 7 | Route frontend `/contract-reviews` | Aggiunta in App.jsx + voce "Riesame Requisiti" 📑 in AppLayout.jsx |

#### Lezioni apprese (13/05/2026)

- **Gemini free tier 2026**: `gemini-1.5-flash` non è disponibile sulla v1beta API. `gemini-2.0-flash` ha quota 0 sul tier gratuito "Default Project". **Soluzione**: `gemini-2.5-flash` funziona correttamente. Default aggiornato in `geminiAdapter.js` e in `.env` VPS.
- **Password admin@sgq.local**: era sconosciuta. Impostata a `Sistemi@2026` via script bcrypt sul VPS (stesso pattern SSH/sudo del progetto).
- **Conflitti numerazione migrazioni**: ADR-010 usava 052/053/054 ma `main` aveva già 052_departments, 053_enhance_suppliers, 054_enhance_complaints. Il file `run-migration-052-vps.js` era in conflitto. Tenuto la versione main (NC integration); le migrazioni ADR-010 sono `052_norm_requirements.sql`, `053_ai_interactions.sql`, `054_commercial_cases.sql` già applicate sul VPS prima del conflitto.
- **Merge con rebase fallisce se ci sono N commit con conflitti docs**: usare `git pull --no-rebase` per merge standard quando si integrano branch con molti commit su file .md.
- **Seed norme**: script `import-norms-from-markdown.js` genera `backend/data/norm_requirements_seed.json` (eseguire in locale). Script separato per INSERT nel DB va eseguito sul VPS tramite `scp + node`. Non eseguire mai il seed direttamente da Windows (MSSQL pool lento).

#### Stato VPS al 13/05/2026

| Componente | Stato |
|---|---|
| Backend sgq-backend | ✅ attivo, PID aggiornato dopo restart |
| `GEMINI_API_KEY` | ✅ configurata in `.env` |
| `GEMINI_MODEL` | ✅ `gemini-2.5-flash` |
| `norm_requirements` | ✅ 234 righe |
| `ai_interactions` | ✅ tabella creata (migrazione 053) |
| `commercial_cases` | ✅ tabella creata (migrazione 054) |
| Route `/ai/suggest` | ✅ HTTP 401 senza auth, 200 con token valido |
| Route `/contract-reviews` | ✅ HTTP 401 senza auth |
| Route `/norm-broker/search` | ✅ HTTP 401 senza auth |

#### Smoke test E2E login — completato (24/05/2026)

- ✅ Login su `https://systemgest.netlify.app` con script Playwright Node (`/tmp/test-login.mjs`) — dashboard post-auth verificata
- Credenziali test: `admin@sgq.local` via env `SGQ_APP_EMAIL` / `SGQ_APP_PASSWORD` (superadmin, org 1001)
- Smoke esteso moduli (Riesame Requisiti, AI, ecc.): da eseguire in sessione dedicata se serve

---

### Sessione 12 maggio 2026 — Fix backend pending-issues/NC + UI PendingIssuesCascade + collapse clausola

**Branch**: `cursor/adr009-fase1-registro-standard-52c5` → mergiato su `main` + deploy Netlify. Fix backend deployati su VPS.

#### Fix backend (VPS deployati)

| # | Bug | Causa radice | File | Fix |
|---|---|---|---|---|
| 1 | Pending issues non mostrava NC/OSS/NV corretti | Filtro `conformity_status IN ('NC','OSS','NV')` era stato cambiato in `OM` | `audit.controller.js` + migrazione DB | Ripristinato filtro corretto + migrazione CHECK constraint `CK_pending_issues_original_status` da `('NC','OSS','OM')` a `('NC','OSS','NV')` |
| 2 | NC statistics causava errore SQL | Alias `open`/`in_progress` sono keyword riservate in SQL Server | `nc.controller.js` | Rinominati in `count_open`/`count_in_progress` |
| 3 | `nc_id` non collegato dopo MERGE pending-issues | MERGE inseriva righe senza aggiornare `nc_id` dal modulo NC tramite `source_question_id` | `audit.controller.js` | Aggiunto UPDATE post-MERGE per collegare `nc_id` |

#### Fix frontend (branch mergiato su main + deploy Netlify)

**PendingIssuesCascade** — fix UI/UX multipli:
- Badge NC/OSS/NV standardizzate con classi `status-btn non-compliant/partial/not-verified active` di `ChecklistModule.css`
- Rimossa nota ridondante "Rilievi dell'audit #xxx da verificare..."
- Badge contatori sostituiti con chip compatte identiche a "Rilievi Emergenti"
- Rimosso label "Note originali:", semplificato link NC modulo
- Word-break fix sul testo note (overflow su parole lunghe)
- "Vai alla domanda" implementato con prop callback diretta (stesso pattern `AuditClosePanel` → `onNavigateTo`)
- Chip sezione con classe `question-reference` (identica a `QuestionCard`)
- `SECTION_LABELS` map per tradurre chiave interna (`clause8` → "8 - Attività operative")

**ChecklistModule** — pulsante ▲/▼ per collasso/espansione singola clausola spostato fuori da `.clause-progress` (era nascosto da media query mobile `display: none`).

#### Lezioni apprese (12/05/2026)

- **CHECK constraint SQL Server — verificare prima di modificare valori**: prima di usare un valore come contenuto di colonna, verificare i CHECK constraint esistenti con `SELECT name, definition FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('tabella')`. Nel bug corrente, `pending_issues.original_status` aveva un CHECK `IN ('NC','OSS','OM')` errato che bloccava i rilievi NV.
- **T-SQL — Alias con parole riservate**: keyword T-SQL (`OPEN`, `CLOSE`, `READ`, `KEY`, `STATUS`, ecc.) non possono essere usate come alias di colonna senza escape. Due soluzioni valide: (1) prefissi descrittivi (`count_open`, `count_closed`, `count_in_progress`) — preferibile per chiarezza; (2) parentesi quadre `AS [open]`, `AS [closed]`, `AS [key]` — utile quando il nome dell'alias è imposto dall'API consumer. Sintomo: `RequestError: Incorrect syntax near the keyword 'xxx'` con status 500 sull'endpoint. Fix applicato il 12/05/2026 su `nc.controller.js` (statistiche overview NC).
- **CSS media query nasconde elementi padre**: quando un pulsante/elemento non appare su mobile, verificare se un **contenitore genitore** ha `display: none` in una media query (es. `.clause-progress { display: none }` su mobile). La soluzione è spostare l'elemento fuori da quel contenitore, non modificare la media query.
- **Navigazione accordion — callback diretta è l'unico pattern affidabile**: per navigare a una domanda specifica da un componente esterno usare prop callback diretta (`onGoToQuestion` passata da `AuditAccordionLayout`) + `setChecklistExpandTrigger(prev => prev+1)`. I `CustomEvent` globali (`window.dispatchEvent`) hanno problemi di timing/mount e non sono affidabili.
- **Coerenza visiva badge stati conformità**: ogni componente che mostra NC/OSS/NV deve usare esclusivamente `status-btn non-compliant/partial/not-verified active` di `ChecklistModule.css`. Mai creare classi CSS parallele per gli stessi stati — crea inconsistenza visiva e debito tecnico.

#### Stato modulo pending-issues al 12/05/2026

- ✅ Filtro `conformity_status IN ('NC','OSS','NV')` corretto in `audit.controller.js`
- ✅ CHECK constraint DB `CK_pending_issues_original_status` aggiornato a `('NC','OSS','NV')`
- ✅ `nc_id` collegato dopo MERGE tramite `source_question_id`
- ✅ UI PendingIssuesCascade: badge standardizzati, "Vai alla domanda" funzionante, chip sezione, SECTION_LABELS
- ✅ NC statistics: alias SQL corretti (`count_open`, `count_in_progress`)
- ⚠️ NC/OSS senza note non ancora nei blockers guided close (da aggiungere in ADR-009 Fase 2)

---

### Sessione 09 maggio 2026 (sera) — Fix validazione, guided close, collapse button

**Struttura accordion AuditAccordionLayout — mappa completa (da NON ri-esplorare):**

| openSections key | Titolo UI | Contiene sub-sezioni (openSubSections key) |
|---|---|---|
| `"general-data"` | 1 – Dati Generali | `"general-data-form"` (1.1), `"objective"` (1.2), `"pending-issues"` (1.3), `"cert-findings"` (1.4) |
| `"checklist"` | Checklist | `"custom-checklist"` + chiavi per ogni standard (da STANDARDS_CONFIG) |
| `"nc-register"` | Registro NC | — |
| `"outcome"` | 11 – Esito Audit | — |
| `"conclusions"` | 12 – Conclusioni | — |
| `"close"` | Chiusura Audit | — (contiene AuditClosePanel) |
| `"export"` | Export Report | — |

**Field ID navigabili (guided close `useGuidedCompletion`):**

| Campo | sectionId | subSectionId | fieldId |
|---|---|---|---|
| Oggetto audit | `general-data` | `general-data-form` | `field-auditObject` |
| Campo applicazione | `general-data` | `general-data-form` | `field-scope` |
| Obiettivo audit | `general-data` | `objective` | `field-auditDescription` |
| Conclusioni | `conclusions` | null | `conclusions` |
| % checklist | `checklist` | null | null |

**Pattern `navigateToSection(sectionId, subSectionId, fieldId)`** — callback diretta da `AuditAccordionLayout` → `AuditClosePanel`. NON usare event bus (`window.dispatchEvent`) per componenti parent→child.

**Ottimizzazione backlog — navigazione accordion auto-discovery:**
Attualmente il `path[]` di ogni campo deve essere dichiarato esplicitamente. Un futuro miglioramento renderebbe il sistema completamente automatico: aggiungere `data-accordion-key="nome-sezione"` a ogni wrapper accordion nel DOM + un walker che risale l'albero dal campo target verso il root aprendo ogni livello trovato. Richiede di instrumentare tutti gli accordion ma eliminerebbe la necessità di aggiornare i `path[]` quando cambia la struttura. **Da valutare solo se i livelli di annidamento crescono oltre 3-4 o se si aggiungono molti nuovi moduli con accordion propri.**

**Commits chiave sessione 09-10/05:**
- `4505490` Fix validazione: rimozione obbligo evidence, note solo per NC/OSS
- `3c8f509` Regola autonomia decisioni tecniche in operating-memory
- `db32a05` Guided close v7: path-based definitivo (section→subsection→clauseExpand)
- `a8a701b` Collapse button "▲ Chiudi" in fondo ad ogni accordion aperto
- `65514d4` Hotfix: `validation is not defined` in AuditClosePanel
- `commit`  Guided close v9: `id="custom-item-{id}"` in QuestionCard + primo item custom incompleto

**Pendenti committente chiusi al 10/05/2026:**
- ✅ SMTP + ALERT_ENABLED=true attivo e verificato con e-mail di test
- ✅ Smoke L3 Mason passi 6-7: colori checklist e contatori Word verificati
- ✅ Camellini: nessuna segnalazione da campo da venerdì 08/05

**Stato guided close al 10/05/2026:**
- ✅ ISO checklist (9001/14001/45001): trova prima domanda NOT_ANSWERED → apre section+subsection+clausole → scroll+focus
- ✅ Custom checklist: trova primo item incompleto → apre section+subsection → scroll+focus
- ✅ Campi testuali (auditObject, scope, description, conclusions): naviga correttamente
- ✅ Pulsante "▲ Chiudi" in fondo ad ogni accordion
- ✅ Hook `useGuidedCompletion` riusabile per futuri moduli
- ⚠️ NC/OSS senza note non ancora nei blockers (da aggiungere in ADR-009 Fase 2)

---

### Sessione 09 maggio 2026 (sera) — Fix validazione checklist + pattern Node cloud agent

**Commit**: `4505490` su `main` — deploy Netlify automatico.

**Fix**: `checklistValidation.js` + `ChecklistModule.jsx`
- Rimossa regola che richiedeva `evidence.mainDocumentRef` per domande C/OSS (falso positivo — l'utente non compila mai quel campo legacy; scrivere nella textarea `notes` non soddisfaceva la condizione)
- Note obbligatorie ora solo per NC e OSS (non per C, OM, NA, NV); allegato mai obbligatorio
- Rimosso `console.log` debug `🔍 [VALIDATION]` in `ChecklistModule.jsx`
- 403 su `GET /companies/:id/certification-findings?standard_id=2`: gestito silenziosamente da ExportPanel (fallback `[]`); il VPS ha probabilmente la route con `requireLicensedModule` non presente nel repo — da allineare al prossimo deploy backend

**Lezione operativa — Node/npm nel cloud agent (09/05/2026)**:
`npm` non è nel PATH in questa sessione Cursor. Soluzione trovata dopo ~10 tentativi — ora scritta in `sgq-operating-memory.mdc` per evitare esplorazione futile:
```powershell
$node = "c:\Users\AI.Project\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe"
# Test: & $node "node_modules\vitest\vitest.mjs" run  (block_until_ms: 300000)
# Build: & $node "node_modules\vite\bin\vite.js" build
```
Per fix a basso rischio (1-2 file, nessuna logica sync/metriche): saltare il test locale e affidarsi al build Netlify come verifica L1 equivalente.

---

### Sessione 08-09 maggio 2026 — Maratona stabilizzazione multi-standard + ADR-009 strategico

**Branch principali mergiati in main**:
- `cursor/checklist-empty-fallback-fix-06dc` (PR #39)
- `cursor/module-license-admin-bypass-06dc`
- `cursor/fix-rich-fields-empty-on-load-06dc`
- `cursor/fix-checklist-responses-overwrite-reconcile-06dc`
- `cursor/fix-exception4-multi-standard-06dc`
- `cursor/adr009-multi-standard-architettura-06dc`

**Test L1**: 125/125 PASS · Build Vite OK · Service worker rigenerato (`BUILD_DATE` 2026-05-08T18:55Z) · Deploy Netlify confermato online.

#### 6 fix consecutivi su 4 ore (08/05/2026 13:20→18:55 UTC)

| # | Bug osservato | Causa radice | File | Fix |
|---|---|---|---|---|
| 1 | "Checklist Non Inizializzata" Sighinolfi su passaggio PC→cellulare | Race rendering: converter restituiva `{ISO_9001:{}}` vuoto, useEffect post-mount riempiva il template ma fra 1° render e effect appariva il fallback | `auditConverter.js`, `ChecklistModule.jsx` | Pre-popolazione template + grace period 1.5s prima di mostrare fallback |
| 2 | Admin riceveva "Modulo non abilitato per la tua organizzazione" su `/non-conformities` e altri | `requireLicensedModule` ignorava il ruolo, controllava solo `licensed_modules` | `backend/src/middleware/moduleLicense.middleware.js` | Bypass per `superadmin` e `admin` (allineato a `authorize()`). Auditor restano vincolati. |
| 3 | Caselle testo Note/Osservazioni si svuotavano dopo qualche secondo dall'apertura audit | Exception 1 in `reconcileAuditsFromServer` usava `!serverField` per oggetti che potevano essere `{description:''}` truthy ma vuoti → server-wins con dati vuoti | `StorageContext.jsx` | Helper `hasRichContent()` che distingue `{}` da contenuto reale; logica per-campo invece di all-or-nothing |
| 4 | Risposte/note checklist si azzeravano ogni 45 secondi | Exception 4 reintrodotto dal fix #1: il converter pre-popolava il template, Exception 4 non scattava più (vedeva struttura non-vuota), reconcile sovrascriveva con NOT_ANSWERED ad ogni ciclo | `auditConverter.js` | Reverting pre-popolazione: converter torna a restituire `{ISO_9001:{}}` (chiave presente, struttura vuota). Grace period 1.5s gestisce la finestra. |
| 5 | Stesso messaggio "Checklist Non Inizializzata" dopo 1.5s su audit con 2+ norme | Exception 4 hardcoded `serverChecklistKeys[0] === 'ISO_9001'` → audit con 2 standard `length=2` faceva fallire la condizione `=== 1` | `StorageContext.jsx` (Exception 4 in `reconcileAuditsFromServer` + `loadAuditsFromIndexedDB`) | Generalizzato: preserva locale se TUTTE le norme nel payload server hanno struttura `{}` vuota — funziona per 1, 2, N standard |
| 6 | Errori CORS in console su allegati durante restart server | nginx proxy_pass restituiva 502 muto senza header CORS quando Node.js era in restart (~10s window) | `/etc/nginx/sites-enabled/sgq-backend` (VPS) | OPTIONS preflight gestito da nginx direttamente + fallback `@backend_down` con 503 + header CORS quando upstream non raggiungibile |

**Tutti gli audit di Camellini in produzione integri** (verificato `audit_id 35191` SIGHINOLFI: `audit_standards` ✅ ISO_9001+ISO_14001, 17 risposte in `audit_responses`, `audit_extra_data` con `generalData/objective/outcome` ok). Nessun fix DB necessario.

#### Lezioni apprese (08/05/2026)

- **`{}` è truthy in JS**: ogni controllo di "presenza dato ricco" deve usare `hasRichContent()` o equivalente, mai `!field` su oggetti.
- **Race rendering React**: dato sincronamente disponibile (template hardcoded) deve essere popolato nel converter, non delegato a `useEffect` post-mount. **Eccezione**: se la pre-popolazione rompe altre logiche di merge (Exception 4!), serve un grace period UX nel componente che renderizza.
- **Hardcoded `=== 'ISO_9001'`**: ogni occorrenza di questo pattern nel codice è un bug architetturale. Generalizzare con iterazione su `selectedStandards`.
- **Bypass licenze per admin**: comportamento atteso dagli operatori (allineato a `authorize()` per superadmin). I controlli licenza sono **per organizzazione** (modello SaaS), il ruolo è **per utente** — sono due assi distinti.
- **CORS quando il backend è down**: mai delegare gli header CORS solo all'app Express. nginx (o reverse proxy equivalente) deve poterli emettere autonomamente per OPTIONS preflight e fallback errori upstream. Pattern documentato in config.
- **Verifica DB prima del codice**: pattern `node + dotenv` su VPS confermò in 2 secondi che i dati erano integri lato server. Bug era 100% client-side. Risparmiati ore di refactor backend inutile. Da riusare per ogni bug "i dati spariscono" multi-device.

#### Decisione strategica — ADR-009 (08-09/05/2026)

I 6 fix sono sintomi della stessa debolezza: app nata mono-standard con ISO 14001/45001/3834/RDP/Custom appiccicati sopra. Discussione product owner-Lead su come rendere l'app **veramente scalabile** per:
- 5 standard ISO già a DB (9001 41Q, 14001 53Q, 45001 53Q, 3834-2 22Q, RDP Mason 0Q)
- Custom checklist (variabili)
- Future: ISO 27001, 50001, 13485, ecc.
- Nuovi tipi documento: SAL, RDP, riesame contratto §8.2, rapporti VT/MT/PT

**Decisioni vincolanti** (vedi [ADR-009](adr/ADR-009-multi-standard-architettura-per-norma.md)):

1. **Modello a 2 assi**: `document_type` × `selectedStandards[]`
2. **Modello dati `byStandard[key]`**: tutto ciò che è per-norma vive sotto chiave dello standard, persistenza in `audit_extra_data.byStandard`
3. **`STANDARDS_REGISTRY` centralizzato** (`app/src/data/standardsRegistry.js`) come Source of Truth, sostituisce `STANDARDS_CONFIG` locale
4. **Flag `isIntegratedSystem`**: valido solo per `kind='iso_hls'` (9001/14001/45001), immutabile dopo prima risposta compilata, modificabile in draft puro
5. **RDP** = specializzazione custom checklist (`has_outcome_buttons=false`, `requires_photos=true`), esposto come `document_type='rdp'` (scorciatoia di prodotto)
6. **SAL** = modulo gestionale separato, riusa `document_registry` con overlay stato implementazione
7. **Custom checklist** = "norma virtuale" `CUSTOM_<id>` pari grado a una ISO
8. **Componenti UI modulari**: `<NormConclusionsBlock>`, `<MetricsByStandardChip>`, `<EvidenceGallery>`, `<DocumentRegistryGrid>`, `<NormExcerptInline>` come hook per AI futura
9. **Audit pilota di `document_registry`**: audit chiuso sarà documento del registro con scadenza prossima sorveglianza
10. **AI come licenza separata**: comportamento UI "B" (nascosta se off, riconsiderazione futura per upselling)

**Test di scalabilità (criterio di accettazione)**: aggiungere un nuovo standard ISO (es. ISO 27001) deve richiedere SOLO 1 INSERT DB + 1 riga registro + (opz.) 1 template Word, **zero altre modifiche**.

**Implementazione 5 fasi pianificate** (incrementali, ognuna committabile separatamente). **Avvio Fase 1 condizionato** a 24-48h di stabilità conclamata in produzione (zero segnalazioni Camellini).

---

### Sessione 08 maggio 2026 — Fix "Checklist Non Inizializzata" su passaggio device (Cloud Agent)

**Branch**: `cursor/checklist-empty-fallback-fix-06dc`
**Test**: 110/110 Vitest PASS · build Vite OK · service worker rigenerato (BUILD_DATE 2026-05-08).

#### Caso utente
Camellini avvia audit "IDRAULICA SIGHINOLFI" (audit_id 35191) su PC con due norme (ISO 9001 + ISO 14001). Compila 17 risposte, sincronizza, chiude. Apre la stessa app sul cellulare → comparsa la schermata "Checklist Non Inizializzata".

#### Verifica DB produzione (script `/tmp/diag-sighinolfi.js` sul VPS)
- `audit_standards`: ✅ righe per `ISO_9001_2015` (id 1) e `ISO_14001_2015` (id 2).
- `audit_responses`: ✅ 17 risposte answered (last_update 2026-05-08 12:27).
- `audit_extra_data`: contiene `generalData / auditObjective / auditOutcome` ma **non** la struttura `checklist` (per design: il server salva risposte in `audit_responses`, non template).
- Audit "rotti" (no `audit_standards`, no `custom_checklist_id`): **0**.

I dati lato server erano integri: nessun fix DB necessario.

#### Causa radice
`auditConverter.backendToFrontend` restituiva `checklist: { ISO_9001: {}, ISO_14001: {} }` — chiavi presenti ma senza clausole. Tra il primo render di `ChecklistModule` e l'esecuzione del `useEffect [currentAudit?.id]` di `AuditAccordionLayout` (che chiama `initializeChecklist` per ogni standard) c'è un **race window** di almeno un frame in cui il modulo ISO mostra il fallback "Checklist Non Inizializzata". Su mobile lento o cache PWA stantia, il fallback restava visibile abbastanza da spaventare l'utente.

#### Fix applicati (belt and suspenders, 3 livelli)
| Livello | File | Azione |
|---|---|---|
| 1. Pre-popolamento sincrono | `app/src/utils/auditConverter.js` | Nuovo helper `buildChecklistFromTemplate(normKey)` — popola la struttura clausole+domande dal template ISO **già nel converter**. Il primo render trova checklist pronta. Anche `audit_extra_data.checklist` esistente ma vuoto (`{}`) viene ricostruito invece di essere preservato silenziosamente. |
| 2. Grace period UX | `app/src/components/ChecklistModule.jsx` | Nuovo state `showEmptyFallback`: se la checklist arriva vuota, mostra "⏳ Caricamento checklist…" per 1.5s prima di esporre il fallback "Non Inizializzata". Reset a ogni cambio audit/norma. |
| 3. Fallback manuale rinforzato | `app/src/components/ChecklistModule.jsx` | Pulsante "✨ Inizializza Checklist" sempre disponibile dopo il grace period, con messaggio aggiornato che chiarisce: "Le risposte già salvate sul server verranno ripristinate automaticamente". |

I due useEffect di auto-init (in `ChecklistModule` e in `AuditAccordionLayout`) restano come ulteriore rete di sicurezza per audit caricati da IndexedDB (cache locale del PC) o standard aggiunti durante la sessione.

#### Test L1 aggiunti
- `app/src/tests/auditConverter.checklistTemplate.test.js` (7 test): converter pre-popola template per 1/2 standard, preserva `audit_extra_data.checklist` legacy, ricostruisce su `{}` vuoto, fallback ISO 9001 per audit legacy senza standards né custom.
- `app/src/tests/multiDeviceChecklistInit.test.js` (3 test): scenario reale Camellini SIGHINOLFI — payload server replicato 1:1, asserzione che `Object.keys(audit.checklist.ISO_9001).length > 0` al primo render. Test parametrizzato anche per `standards` come stringa CSV (lista) e come array di oggetti (`getAuditById`).

#### Lezioni apprese (08/05/2026)
- **Race window di rendering React**: `useState({})` o struttura vuota messa a disposizione di un componente che la renderizza subito è una **bomba a tempo**. Se è disponibile sincronamente (template hardcoded), popolare nel converter elimina la classe di bug per sempre. Non delegare l'inizializzazione a un `useEffect` post-mount per dati ottenibili sincronamente.
- **Fallback "vuoto" rumoroso**: una schermata "Non Inizializzata" che compare anche solo per 200ms genera un sospetto di perdita dati. Tre livelli sono il minimo: (a) struttura pronta nel converter, (b) grace period con stato neutro `⏳ Caricamento`, (c) pulsante manuale come ultima risorsa.
- **Verifica DB prima del codice**: script `node` con `NODE_ENV=production` + `dotenv` su `/var/www/sgq-backend/src/config/database.js` ha confermato in 2 secondi che il problema NON era nel DB. Risparmiati ore di refactor backend inutile. Pattern da riusare per ogni bug "i dati spariscono" multi-device.
- **`audit_extra_data` non è source-of-truth della checklist**: il server salva in `audit_responses` (righe per question). Il converter deve essere autosufficiente nel popolare la struttura template — non aspettarsi mai `extraData.checklist` non vuoto da `getAudits`.

#### Cosa NON è stato fatto (non necessario)
- Nessun fix backend: il server restituisce esattamente quello che deve restituire. La query `getAudits` con `STRING_AGG(s.standard_code)` da `audit_standards` è coerente con il converter dopo questo fix.
- Nessuna migrazione DB: 0 audit "rotti" in produzione.
- Nessun deploy VPS: cambiamenti solo lato `app/` (frontend), Netlify si occupa del rilascio.

---

## Sessione 08/06/2026 — Licenze moduli multi-tenant (ERAM + UI superadmin)

### Problema
Mauro Franciosi (admin ERAM, org **1004**) non vedeva **Assistente AI** in sidebar. Non era un bug RBAC: la sidebar filtra su `organizations.licensed_modules`. ERAM aveva lista esplicita **senza** `ai_assist` (copiata allo split multi-tenant prima dell'introduzione moduli AI). Il superadmin in **Impostazioni → Licenze** vedeva solo l'org propria (Al.project), non ERAM.

### Slice applicate
| Slice | Esito |
|---|---|
| Hotfix DB ERAM (org 1004) | Eseguito su VPS con `backend/scripts/run-patch-eram-ai-licenses-vps.js` — aggiunti `ai_assist`, `ai_norms`, `ai_review`, `ai_chat` |
| Backend API | `GET /admin/organizations`, `GET /admin/organizations/:id/licenses`; helper `appendLicensedModulesForOrg`, `getOrgLicensesPayload` |
| Frontend | Selettore tenant in `LicensesSettingsPage.jsx` (solo superadmin); banner quando si modifica un altro studio |
| Test L1 | Jest `moduleLicense.service.test.js` (6 test); build Vite OK |

### Regola operativa (lezione)
- **`licensed_modules = NULL`** → tutti i moduli (retrocompatibile).
- **Lista esplicita** → non eredita automaticamente nuove chiavi modulo: serve hotfix idempotente o intervento superadmin.
- **Catalogo licenze ≠ licenza tenant**: la pagina licenze del superadmin deve permettere di scegliere **quale organizzazione** modificare (non solo la propria).
- Dopo aggiornamento licenze: gli utenti del tenant devono **logout/login** (o refresh token) per vedere la sidebar aggiornata.

### Passi post-merge (desktop)
1. Deploy backend VPS: `backend/scripts/deploy-controllers-to-vps.ps1` (admin controller + routes + **moduleLicense.service** + middleware — vedi `deploy-manifest.json` gruppi `services-core` e `middleware-entry`).
2. Netlify: merge PR → build automatico.
3. Comunicare a Mauro Franciosi: logout/login → voce **Assistente AI** visibile (hotfix DB già applicato 08/06/2026).

**Chiusura 09/06/2026:** PR #101 mergiata, deploy VPS OK, Franciosi vede Assistente AI; manifest deploy allineato con `moduleLicense.service.js` + `moduleLicense.middleware.js`.

---

## Sessione 17/05/2026 — Modulo Saldatura ISO 3834 operativo

### Cosa e' stato fatto
- **Dashboard coordinatore ISO 3834** (`/saldatura`): card Commesse/WPS/Qualifiche con conteggi, alert scadenze, tabella commesse attive
- **Pagina Commesse** (`/saldatura/commesse`): CRUD completo con filtri stato/ricerca, sezioni WPS applicabili e saldatori assegnati
- **Fix BUG-A**: colonne `testing_body`, `welder_name`, `certificate_number` aggiunte a `wpqr_records` (migrazione 069)
- **Fix BUG-B**: filtro `qualification_type` ora funziona nel backend (mapping codici frontend verso pattern LIKE)
- **API Commesse**: controller + routes con CRUD completo, stats per dashboard, soft/hard delete
- **Endpoint wps_welders**: assegnazione saldatori qualificati a WPS (list/assign/remove)
- **Sidebar**: gruppo Saldatura aggiornato — Dashboard 3834, Commesse, Procedure WPS/WPQR (rimosso lucchetto)
- **Licenza MASON_Srl**: aggiornata da `["audit"]` a tutti i moduli

### Commit
- `8aa5865` feat: modulo saldatura ISO 3834 - Fase 0+1+2 (15 file, +2305 righe)

### File chiave creati
| File | Descrizione |
|------|-------------|
| `backend/scripts/run-migration-069-vps.js` | Migrazione: colonne WPQR + tabelle wps_welders/project_welders |
| `backend/src/controllers/projects.controller.js` | CRUD commesse |
| `backend/src/routes/projects.routes.js` | Route commesse |
| `app/src/pages/WeldingDashboardPage.jsx/.css` | Dashboard coordinatore ISO 3834 |
| `app/src/pages/ProjectsPage.jsx/.css` | Gestione commesse |

### Piano di riferimento
`docs/piano_modulo_saldatura_v2.plan.md` — contiene Fasi 0-4 con 15 task e 6 scenari di test Mason.

### Fase 3-4 da completare (prossima sessione)
- Allegati PDF su WPS/WPQR (UI)
- Range validita' qualifiche ISO 9606 (calcolo automatico)
- NC specifiche saldatura (collegamento a WPS/saldatore/commessa)
- Certificati materiali EN 10204 (tipo documento strutturato)
- Stampa/export WPS formato standard
- Collegamento commesse-audit ISO 3834
- Alert scadenze nella dashboard

### Anomalia UX annotata
La pagina admin "Utenti" ha "Standard consentiti" (quali norme l'utente puo' auditare), ma la visibilita' dei moduli nella sidebar dipende dalla licenza dell'**organizzazione** (`organizations.licensed_modules`). Sono due concetti separati: l'admin puo' pensare di aver abilitato la saldatura per un utente, ma se l'organizzazione non ha la licenza il modulo resta invisibile. Da chiarire in UI o unificare.

### Test utente Mason
- Email: andrea.mason@mason-cs.com
- Organizzazione: MASON_Srl (org 1003)
- Ruolo: Admin Studio
- Verificato: login OK, dashboard 3834 visibile, commesse funzionanti

---

## Sessione 15/05/2026 — AI Audit Conclusions + Upload Norme

### Funzionalità implementate

1. **Assistente AI Conclusioni Audit**
   - Pulsante "Assistente AI Conclusioni" nella sezione 12 dell'audit
   - Modale popup con Accetta / Scarta / Riformula
   - Due modalità: "Genera proposta" (se conclusioni vuote) e "Migliora bozza" (se esistenti)
   - Context builder arricchito: clausole normative pertinenti, metriche, findings dettagliati
   - Supporto multi-standard (pulsante per ogni norma)

2. **Personalizzazione AI (3 livelli)**
   - Livello A: enrichment normativo automatico dal DB norm_requirements
   - Livello B: tabella ai_feedback — salva accetta/scarta/riformula per ogni interazione
   - Livello C: few-shot learning — le ultime 3 conclusioni accettate diventano esempi nel prompt
   - Framework ISO 19011:2018 §6.4.9 integrato nel system prompt

3. **Upload multiplo norme nel Registro Documentale**
   - Endpoint POST /documents/norms/upload (max 10 PDF, 50MB ciascuno)
   - Estrazione testo con pdf-parse + metadati con AI (titolo, codice, anno, ente)
   - Salvataggio in `document_registry` (con `type_specific_data` canonico) + `norm_document_sources` come estensione AI/testo
   - Prevenzione duplicati (verifica titolo/standard_code)
   - UI: pulsante "Carica Norme" nella cartella NORME E LEGGI (vista Albero)

3b. **Import da lista codici — Fase 3 (29/05/2026)**
   - Endpoint `POST /documents/norm-import-codes` — max 50 codici, **PDF non richiesto**
   - Lookup catalogo online + bozza registro con `type_specific_data` (vigore, URL, ente inferito)
   - Duplicati bloccati per `standard_code` nella stessa organizzazione
   - UI: **Importa da catalogo (codici)** nella cartella NORME E LEGGI
   - Compatibile job settimanale validità (slice R1)

4. **Verifica validità norme**
   - Lookup in form: cataloghi UNI/ISO/BSI + **Normattiva** (atti IT) + **EUR-Lex** (UE) — PR [#65](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/65)
   - Job settimanale (lunedì 03:00): **legge `document_registry`** (`doc_type=norma`) come SoT — slice R1 (25/05/2026, PR [#66](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/66))
   - Per ogni riga con `JSON_VALUE(type_specific_data, '$.standard_code') IS NOT NULL` chiama `checkNormValidity` e aggiorna `type_specific_data` via `JSON_MODIFY` (merge, non sovrascrive altri campi)
   - Mirror retrocompatibile su `norm_document_sources` se `document_id` presente (fino a R5)
   - Email se `ALERT_ENABLED=true` e norme superate; log `[NormValidityChecker] checked ≥ norme con codice`
   - Stati vigenti controllati: `vigente`, `rilasciato` (null incluso)
   - **Gate 0 (25/05/2026)**: PR [#65](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/65) mergiata (`b0a5900`), deploy VPS connettori, smoke `norm-lookup` D.Lgs. 81/2008 → `active` + URL Normattiva
   - **R1 completata (25/05/2026)**: PR [#66](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/66) mergiata — job legge `document_registry`; test L1 19/19 verdi; deploy VPS PID 260874; log job confermato: `checked=1 >= norme registro con codice=1`, ISO_9016_2012 marcata `withdrawn` dal catalogo ISO
   - **R2 completata (25/05/2026)**: `lookupNormStatus` accetta `document_id` opzionale; persiste `validity_status`, `last_validity_check`, `validity_check_url`, `superseded_by` in `type_specific_data` via `JSON_MODIFY` (merge); `DocumentForm.jsx` passa `doc.id` in edit + include campi vigore nel save payload
   - **R3 completata (25/05/2026)**: upload bulk scrive `type_specific_data` con lo stesso schema del form manuale (`documentRegistryNorm.service.js` + `normUpload.controller.js`); 13 test Jest L1 verdi
   - **R4 completata (25/05/2026)**: PR [#68](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/68) — badge vigore nella lista Registro Documenti (tab Catalogo); `listDocuments` aggiunge `norm_validity_status` + `norm_last_check` via `JSON_VALUE`; `DocumentDataGrid` mostra pill verde/rosso/ambra; CI verde; test visuale: norma ISO_9016_2012 mostra badge "Superata" (rosso)
   - **R5 completata (25/05/2026)**: `knowledgeIndexer` arricchisce testo indicizzato per `doc_type='norma'` con `standard_code`, `issuing_body`, `edition_year`, `validity_status`, `superseded_by` da `type_specific_data`
   - **R6 completata (25/05/2026)**: backfill VPS `norm_document_sources` → `document_registry.type_specific_data` — report produzione: 2 righe totali, **1 aggiornata** (ISO_9016_2012), 1 senza codice; script `backfill-norm-type-specific-data-vps.js` idempotente
   - **R7 completata (25/05/2026)**: [ADR-011](adr/ADR-011-registry-norm-sot.md) — SoT metadati norma su registro; `norm_document_sources` solo mirror AI/chunking
   - **Piano refactor SoT**: [PLAN_REGISTRY_NORM_SOT_SLICES.md](agent-tasks/PLAN_REGISTRY_NORM_SOT_SLICES.md) — **R1–R7 completate**
   - **Sprint 11 CommercialCase (25/05/2026)**: modulo riesame requisiti contratto GIÀ implementato — tabelle `commercial_cases/history/checklist`, controller, routes, `ContractReviewPage.jsx`, menu voce "Riesame Requisiti"; AI analisi capitolato via `useAiAssist` → `review_requirements`; test L1 Jest 14/14 verdi; smoke UI OK (crea caso, checklist 10 voci, transizione stato); PR #67
   - **Email settimanale norme superate**: richiede `node-schedule` + `nodemailer` installati sul VPS (`npm install` in `/var/www/sgq-backend`) se i log mostrano scheduler disabilitato

### Migrazioni DB applicate
- 055_ai_feedback.sql — tabella feedback personalizzazione
- 060_norm_document_sources.sql — fonti normative da documenti caricati

### Lezioni apprese
- **SoT norme (R7)**: metadati inventario solo in `document_registry.type_specific_data`; `norm_document_sources` per testo PDF/chunk AI — vedi [ADR-011](adr/ADR-011-registry-norm-sot.md)
- **Backfill R6**: script VPS idempotente con `mergeMissingNormTypeSpecificData` — non sovrascrivere campi già popolati post-R2/R3
- PDF scansionati (come ISO 19011): pdf-parse estrae poco/nulla, servono PDF nativi per buona qualità
- Gemini 2.5 flash: occasional "high demand" transient errors — retry dopo 15s risolve
- PowerShell: evitare heredoc bash, usare file .sh copiati via pscp per comandi complessi
- Attachments document_registry: serve sia INSERT in attachments CON document_id, sia UPDATE document_registry SET attachment_id (bidirezionale)

### Stato VPS
- Backend: attivo, health OK
- Tabelle: ai_feedback, norm_document_sources create
- Cartella /var/www/sgq-backend/uploads/norms/ creata
- Job validità norme: registrato in alertScheduler

### Prossimi passi suggeriti
- OCR completo ISO 19011 (installare tesseract o usare servizio esterno)
- Caricare linee guida Conforma come PDF nativi
- Test approfondito upload norme dall'interfaccia con PDF reali
- Verificare comportamento few-shot dopo 3+ interazioni accettate

---

### Chiusura sessione 07 maggio 2026 — tarda sera (Cloud Agent)

**Branch**: `cursor/custom-checklist-gap-fixes-3f28` (PR da creare → merge in main + deploy)

#### Attività eseguite
1. **Merge PR #36** (`cursor/audit-filter-no-autoswitch-e3df`) → `main`. Push su origin → Netlify auto-deploy.
2. **GAP-B1 Template condiviso**: `customChecklist.service.listChecklists` ora restituisce `active_audit_count` (subquery su `audits` status non closed). `CustomChecklistsPage`: badge "N audit attivi" nella lista; banner arancione nell'editor quando `active_audit_count > 0`. VPS deployato (customChecklist.service.js).
3. **GAP-B2 Metriche custom nel payload**: `StorageContext.updateCurrentAudit` ora importa `calculateCustomFindingsMetrics` e aggiunge `customMetrics.totalNC` a `non_conformities_count` nel payload `update_audit`. Il server riceve il conteggio reale ISO + custom.
4. **GAP-B3 T3 event-based custom**: `syncService.enqueueCustomResponseEvent` aggiunto (event_type=`custom_response_set`, field_path=`custom_responses.{itemId}`). `CustomChecklistAuditView.handleStatusChange` lo chiama quando `VITE_SYNC_MODE=events`. Backend `auditEvents.controller`: proiezione immediata `MERGE` su `audit_custom_checklist_responses` per `custom_response_set`. VPS deployato.

#### Lezioni apprese
- **`calculateCustomFindingsMetrics` esiste già** in `metricsCalculator.js` — prima di duplicare logica di calcolo, cercare sempre in quel file.
- **`auditEvents.controller` già accettava `custom_response_set`** nel whitelist `VALID_TYPES` ma mancava solo la proiezione immediata su `audit_custom_checklist_responses`. Il backend era "mezzo pronto" — controllare sempre il controller intero prima di aggiungere endpoint.
- **Pattern SCP: due directory diverse** — quando si copia controller + service nello stesso SCP, verificare i path destinazione separatamente. Copiare tutto in `controllers/` per errore è un rischio.

---

### Chiusura sessione 07 maggio 2026 — sera (Cloud Agent)

**Branch**: `cursor/audit-filter-no-autoswitch-e3df` → **PR #36**  
**Commit**: 2 commit — 103/103 Vitest PASS, build Vite OK.

#### Fix eseguiti

| # | Fix | File | Area |
|---|-----|------|------|
| FILTER-1 | Auto-switch silenzioso rimosso da `handleCompanyChange` / `handleShowClosedAuditsChange`; `buildAuditsForSecondSelect` restituisce `{ list, currentOutsideFilter }`; audit fuori-filtro visibile in testa con etichetta `⚠ … — fuori filtro` | `AuditSelector.jsx` | UX/Bug |
| CUSTOM-1 | `loadChecklist` propaga `customChecklist` nell'audit globale (`_systemCall=true`, `skipSync=true`) → sezione 11 somma correttamente NC/OSS/OM custom | `CustomChecklistAuditView.jsx` | Bug critico |
| CUSTOM-2 | `fetchAndApplyServerResponses` idrata anche custom checklist (template + statuses + risposte) prima dell'early-return ISO → copre audit solo-custom e scenario multi-device | `StorageContext.jsx` | Bug critico |

#### Lezioni apprese (07/05/2026 sera)

- **I filtri non devono mai cambiare la selezione attiva**: principio UX fondamentale violato dall'auto-switch. Pattern corretto: filtro restringe la lista, l'oggetto selezionato resta finché l'utente non cambia esplicitamente.
- **`_systemCall=true` è il pattern per hydration che bypassa lock e `draft→in_progress`**: usarlo su ogni updater che porta dati dal server (reconcile, hydrate, init). Il ref `isHydratingRef.current` protegge solo la coda sync, non la transizione di stato.
- **L'early-return ISO in `fetchAndApplyServerResponses` blocca la hydration degli audit solo-custom**: inserire sempre la hydration custom PRIMA della guard `rows.length === 0`.
- **`updateAuditMetrics` in `metricsCalculator.js` è dead code**: la logica effettiva per sezione 11 è in `AuditOutcomeSection.jsx` (useEffect con dep `currentAudit?.customChecklist`). Non aggiungere nuova logica a `updateAuditMetrics`.

#### Gap custom checklist rimanenti (media/bassa priorità)

| Gap | File | Priorità |
|-----|------|----------|
| Modifica template durante audit aggiorna il template condiviso (impatta altri audit della stessa org) | `CustomChecklistAuditView.jsx` | 🟡 Media |
| `update_audit` invia al server solo metriche ISO (completamento custom invisibile al server) | `StorageContext.jsx` | 🟡 Media |
| Sync event-based (T3): ISO usa T3, custom no | `ChecklistModule.jsx`, `CustomChecklistAuditView.jsx` | 🟡 Media |
| Deep-link "vai alla domanda" risolve solo clausole ISO | `AuditAccordionLayout.jsx` | 🟢 Bassa |
| Doppio naming `customChecklistId` vs `custom_checklist_id` | tutto il codebase | 🟢 Bassa |

---

### Ripresa sessione 07 maggio 2026 (Cloud Agent — pomeriggio)

**Branch ISO 14001**: `cursor/iso14001-checklist-completa-3f67`

#### Attività eseguite
1. **Merge PR #33** → `main` con git merge --no-ff; push su origin → Netlify auto-deploy avviato.
2. **Deploy backend VPS**: 4 controller (audit/attachment/customChecklist/response) + `audit.routes.js` copiati via SCP. Fix bug critico: `audit.routes.js` sul VPS aveva route `POST /audits/:auditId/promote-nc → promoteAuditNcToModule` (funzione mai esistita nel controller locale) che mandava in crash il server; rimossa deployando il file locale canonico.
3. **Migration 049 — ISO 14001 checklist completa**: 53 domande che coprono tutti i sotto-requisiti per clausola (§4→§10), suddivise in 7 sezioni `14001_c4..c10`. Soft-delete delle 46 domande legislative precedenti; sezioni legacy `14001_s4/s5` disattivate. Pattern esecuzione VPS: `DB_SERVER=localhost DB_PORT=11043 ... NODE_ENV=production node /tmp/run-migration-049-vps.js`.
4. **Esperienza 22/05/2026 (Camellini)**: osservazione corretta — in app compariva ancora la matrice **legislativa** (VIA, AIA, rifiuti…) perché `app/src/data/checklistTemplates.js` non era allineato al DB post-049. Fix: `ISO_14001_TEMPLATE` = audit SGA (53 domande); matrice legislativa spostata in `ISO_14001_LEGISLATIVO_TEMPLATE`. `initializeChecklist` re-inizializza audit con sezioni `14001_s4/s5` obsolete. Rigenerazione template SGA: `node app/scripts/buildIso14001Template.js` + export JSON da VPS.
5. **Checklist custom legislativa (post-merge PR #61)**: matrice 152/06 importabile da **Admin → Checklist personalizzate** (pulsante «Importa matrice legislativa ambientale»). API idempotente `POST /api/v1/custom-checklists/seed/legislativo-ambientale`; marker description `[SGQ_TEMPLATE:LEG_AMBIENTE_152]`. **Uso Camellini**: audit norma **ISO 14001** = SGA clausole 4–10; sopralluogo/consulenza legislativa = checklist custom (assegnabile in creazione audit, anche con ISO 9001). Deploy backend VPS richiesto per il seed. Rigenerazione dati backend: `node backend/scripts/buildLegislativoAmbientaleTemplate.js`.
   - **Smoke L3 autonomo 24/05/2026**: DB produzione — ISO 14001 = 53 domande `14001_c4..c10` (SGA), zero sezioni `14001_s*`. Netlify bundle `index-C66x6whP.js` contiene template SGA + API `seedLegislativoAmbientale`. **Seed QS Studio (org 1002)**: checklist «Conformità legislativa ambientale (D.Lgs. 152/06)» creata con 46 voci; idempotenza OK. **Bug fix seed**: `findSeededLegislativoAmbientale` usava `LIKE` con marker `[SGQ_TEMPLATE:…]` — le parentesi quadre in SQL Server sono wildcard; corretto con `CHARINDEX`. **Login UI Playwright**: bloccato — `SGQ_APP_PASSWORD` cloud non coincide con hash DB (`admin@sgq.local` → 401); aggiornare segreto Cursor Cloud con password reale (account prod: `marcocamellini@gmail.com` org QS_Studio).
6. **Alert Engine VPS preparato**: installati `nodemailer@^8.0.7` e `node-schedule@^2.1.1` in `/var/www/sgq-backend`; aggiunto blocco SMTP placeholder nel `.env` VPS con `ALERT_ENABLED=false`. Per attivare: compilare `SMTP_HOST/PORT/USER/PASS/FROM` + impostare `ALERT_ENABLED=true` nel `.env` e riavviare il servizio.

#### Nota deploy VPS: bug route promoteAuditNcToModule
La route `POST /audits/:auditId/promote-nc` era stata aggiunta manualmente al file `audit.routes.js` sul VPS in una sessione precedente senza corrispondente commit git. Il controller non esportava `promoteAuditNcToModule`. Fix: deployato il `audit.routes.js` locale (canonico), che non ha quella route. La funzionalità S-A6-C ("Registra nel modulo NC") è implementata solo nel frontend (navigazione React Router) e non richiede un endpoint backend dedicato.

---

### Chiusura sessione 07 maggio 2026 (completa)

**Branch**: `cursor/audit-module-gap-fixes-7b2a` → **PR #33**  
**Commit**: 5 commit, 14 fix totali — 103/103 Vitest PASS, build Vite OK in tutti i commit.

#### Tabella completa fix sessione 07/05/2026

| # | Fix | File | Area |
|---|-----|------|------|
| FIX-1 | Conflitti Git irrisolti (build bloccata) | `AuditAccordionLayout.jsx`, `PendingIssuesCascade.jsx/.css` | Infra |
| FIX-2 | Route NC errata: `/nc` → `/non-conformities` | `apiService.js` | Bug |
| FIX-3 (S-A6-C) | Pulsante "Registra nel modulo NC" + flag `registeredToOrg` + gestione 403 | `NonConformitiesManager.jsx/.css` | Feature |
| FIX-4 | `updateAuditMetrics` somma ISO+custom; `NV: null` esplicito | `metricsCalculator.js` | Bug |
| FIX-5 | Ellissi NC preview solo se description > 80 char | `NonConformitiesManager.jsx` | UX |
| FIX-6 | Emoji/caratteri corrotti `?`/`??` → ✅🔒❌⚠️ | `AuditClosePanel.jsx` | UX |
| FIX-7 | Prop morta `onUpdate` rimossa; `console.log` produzione rimosso | `AuditAccordionLayout.jsx`, `ExportPanel.jsx` | Cleanup |
| FIX-8 (G8 stub) | Link "Gestione Documentale" dopo export per audit completed/approved | `ExportPanel.jsx/.css` | Feature |
| SYNC-5-A | `syncUploadAttachment`: fix `customItemId`, emette `sgq:attachmentSynced` | `syncService.js` | Bug/Feature |
| SYNC-5-B | `delete_attachment` in coda; `removeAttachment` chiama DELETE API | `syncService.js`, `useAttachmentManager.js` | Feature |
| SYNC-5-C | `StorageContext` listener `sgq:attachmentSynced` — patch allegato locale | `StorageContext.jsx` | Feature |
| SYNC-5-D | Badge ⏳ animato su allegati `pendingSync: true` | `AttachmentSection.jsx/.css` | UX |
| FIX-LOCK-1 | `updateCurrentAudit`: `isSystemCall` valutato prima del blocco lock foreign → hydration server-wins per utente B | `StorageContext.jsx` | Bug critico |
| FIX-LOCK-2 | `isReadOnly` include `auditLock.mode==='foreign'`: controlli disabilitati per utente B | `AuditAccordionLayout.jsx` | UX |
| FIX-LOCK-3 | Auto-retry lock ogni 30s in stato `foreign` → acquisizione automatica quando A rilascia | `StorageContext.jsx` | Feature |
| FIX-LOCK-4 | Import morti `assertWriteAllowed`/`getLockTokenFromRequest` rimossi da 4 controller | `audit/attachment/customChecklist/response.controller.js` | Cleanup |
| FIX-OFFLINE-1 | `save_responses` + `update_audit` accodati **anche offline** (rimossa guard `navigator.onLine`) | `StorageContext.jsx` | Bug critico |
| FIX-OFFLINE-2 | Hint offline: "N modifiche in coda — invio automatico al reconnect"; ⏫ "Sincronizzazione..." al reconnect | `ConnectionStatus.jsx` | UX |

#### Lezioni apprese (07/05/2026)

- **Guard `navigator.onLine` su enqueue è un anti-pattern offline-first**: la coda IndexedDB è persistente e progettata per l'offline — la guardia eliminava silenziosamente dati che l'utente riteneva salvati. Regola: non aggiungere mai `if (navigator.onLine)` prima di un `syncService.enqueue`.
- **`isSystemCall` deve precedere qualsiasi blocco di policy**: il check lock-foreign in `updateCurrentAudit` bloccava anche le chiamate di hydration marcate `_systemCall=true`, causando dati obsoleti per l'utente B in sola lettura. Pattern: determinare `isSystemCall` come prima istruzione del blocco, poi applicare le policy.
- **Conflitti Git sopravvivono inosservati**: i marker `<<<<<<<` possono passare nei commit se non c'è CI che esegue `git grep` o una build obbligatoria. Regola da aggiungere in CI: `git grep -l "^<<<<<<<" -- "*.jsx" "*.js" "*.css"` → fail se trovato.
- **Lock auto-retry**: il pattern `setInterval` su `mode === 'foreign'` è già usato per `pending_server` (ogni 5s) — replicarlo per `foreign` (ogni 30s) è stata la scelta ovvia e corretta.

#### Stato gap modulo audit al 07/05/2026

| Gap | Stato |
|-----|-------|
| G1 Post-chiusura (S-A1/S-A2) | ✅ |
| G4 Chiusura custom (S-A3) | ✅ |
| G2 Pending UX (S-A4) | ✅ |
| G3 Pending creazione vs DB (S-A5) | ✅ |
| G6 NC audit vs modulo (S-A6-C) | ✅ |
| SYNC-5 Allegati offline | ✅ |
| Accesso concorrente lock | ✅ migliorato (3 fix) |
| Offline-first completo | ✅ |
| G5 Sezione 11 drill-down | Backlog P2 |
| G7 Token monouso allegati Word | Backlog P2 |
| G8 Registra in Documentale | Stub ✅ (link nav) / piena integrazione Backlog P2 |
| G9 Upload offline | ✅ SYNC-5 |

---

### Chiusura sessione 07 maggio 2026 — Prima parte (ore 08:36–09:05)

**Analisi gap modulo audit + 5 fix (branch `cursor/audit-module-gap-fixes-7b2a`):**

| Fix | File | Dettaglio |
|-----|------|-----------|
| FIX-1 — Conflitto Git irrisolto | `AuditAccordionLayout.jsx`, `PendingIssuesCascade.jsx`, `PendingIssuesCascade.css` | 4 blocchi `<<<<<<<` lasciati da merge `e5fc864` (S-A4) — bloccavano la build Vite. Risolti scegliendo la versione con il commento più completo. |
| FIX-2 — Route NC errata | `apiService.js` | `createNonConformity` usava `/nc` (rotta inesistente); corretto in `/non-conformities`. |
| FIX-3 — S-A6 Opzione C | `NonConformitiesManager.jsx`, `.css` | Pulsante "Registra nel modulo NC" su ogni NC locale: chiama `POST /non-conformities` con mapping categoria→severity. Flag `registeredToOrg` persistito nell'audit locale. Gestione 403/MODULE_NOT_LICENSED. |
| FIX-4 — metriche ISO+custom | `metricsCalculator.js` | `updateAuditMetrics` ora somma ISO + custom (se `has_outcome_buttons`), coerente con `AuditOutcomeSection`. |
| FIX-5 — ellissi NC preview | `NonConformitiesManager.jsx` | `nc-description-preview` aggiungeva `...` sempre; ora solo se description > 80 caratteri. |
| Bonus — NV in STATUS_TO_FINDING | `metricsCalculator.js` | Aggiunto `NV: null` esplicitamente per chiarezza (era già gestito come `undefined → null` ma non documentato). |

**Risultati test post-fix**: 103/103 Vitest ✅ · build Vite ✅

**Stato gap modulo audit aggiornato al 07/05/2026:**

| Gap | Stato |
|-----|-------|
| G1 Post-chiusura (S-A1/S-A2) | ✅ |
| G4 Chiusura custom (S-A3) | ✅ |
| G2 Pending UX (S-A4) | ✅ |
| G3 Pending creazione vs DB (S-A5) | ✅ |
| G6 NC audit vs modulo (S-A6) | ✅ Opzione C implementata |
| G5/G7/G9 P2 | Backlog |

**Lezione**: I conflitti Git da merge non risolto possono sopravvivere inosservati se i file risultanti sono sintatticamente validi in un branch ma la build lato Vite li rileva solo al primo `npm run build`. Pattern da aggiungere in CI: `git grep -l "^<<<<<<<" -- '*.jsx' '*.js' '*.css'` → fail se trovato.

---

### Chiusura sessione 05 maggio 2026

**Completamento gap modulo audit: S-A5 + documentazione S-A6:**

| Fix | File | Dettaglio |
|-----|------|-----------|
| S-A5 — Preserva `pendingIssues` al reconcile | `StorageContext.jsx` | Eccezione 7 in `reconcileAuditsFromServer`: se il locale ha `pendingIssues.length > 0` e il server restituisce array vuoto (come atteso: `auditConverter` imposta sempre `[]`), si mantiene il locale. Evita perdita rilievi pendenti copia-al-creazione re-audit ad ogni page refresh. |
| S-A5 — Eccezione coerente con pattern esistente | `StorageContext.jsx` | Allineata alle Eccezioni 1-6 già presenti nel blocco `mergedAudits.map(...)`. |
| S-A6 — Decisione di prodotto documentata | `AUDIT_MODULE_LEAD_BRIEF.md §10` | 3 opzioni (A depreca, B sync server, C stub monodirezionale). Default consigliato: C. Attendere risposta committente prima di avviare il task. |

**Stato matrice gap modulo audit al 05/05/2026:**

| Gap | Stato |
|-----|-------|
| G1 Post-chiusura (S-A1/S-A2) | ✅ |
| G4 Chiusura custom (S-A3) | ✅ |
| G2 Pending UX (S-A4) | ✅ |
| G3 Pending creazione vs DB (S-A5) | ✅ |
| G6 NC audit vs modulo (S-A6) | ⏳ Decisione committente |
| G5/G7/G9 P2 | Backlog |

**Lezione**: `auditConverter.backendToFrontend` è il punto di reset di tutti i campi non presenti nell'API `GET /audits`. Ogni campo puramente locale che deve sopravvivere al reconcile richiede un'eccezione esplicita nel blocco `mergedAudits.map(...)` di `reconcileAuditsFromServer`. Il pattern "Eccezione N" è già consolidato e scalabile.

#### Ops/Sysadmin — Rinnovo SSL Let's Encrypt `www.fr-busato.it` (diagnosi HTTP-01)

Recuperato dalla PR #28 (chiusa, contenuto consolidato qui).

| Evidenza | Dettaglio |
|----------|-----------|
| Scadenza cert | `notAfter=May 5 11:32:22 2026 GMT` su `https://www.fr-busato.it:8443` |
| Sintomo `certbot renew` | Let's Encrypt risponde **HTTP-01 unauthorized**: **404** su `http://www.fr-busato.it/.well-known/acme-challenge/...` |
| Causa radice | La porta **80 pubblica** (e la redirect HTTPS) arriva ad **Apache su Raspbian** (`Server: Apache/2.4.66`), non all'**Nginx** del VPS Ubuntu dove gira Certbot. Il backend API (8443, Nginx verso Node) è corretto, ma il validatore ACME non colpisce quel Nginx. |
| Trappola `/etc/hosts` | Rimuovere eventuale `127.0.0.1 www.fr-busato.it` sul VPS (fa risolvere il dominio in loopback; backup `/etc/hosts.bak`). Da solo **non** risolve il 404 esterno. |
| **Porta 10880 (Nginx VPS)** | Virtual host dedicato `acme-challenge-10880.conf` (`sites-available` + symlink `sites-enabled`): **listen 10880**, serve solo `/.well-known/acme-challenge/` da `root /var/www/html`, resto **404**. Verifica da Internet: `curl -s http://www.fr-busato.it:10880/.well-known/acme-challenge/probe-10880` deve dare `probe-10880`. |
| **Renewal config** | In `/etc/letsencrypt/renewal/www.fr-busato.it.conf`: `authenticator = webroot`, `webroot_path = /var/www/html` (niente plugin nginx al renew; backup `.bak.<timestamp>`). |

**Per sbloccare il rinnovo** (azione su router / Raspberry — Let's Encrypt contatta *sempre* la 80 pubblica):

1. **Consigliata:** sul router **WAN:80 verso IP LAN del VPS `fr-sql1`:10880** (TCP). Evitare che il Raspberry intercetti ancora la 80 in ingresso senza forward.
2. **Alternativa:** **WAN:80 verso VPS:80** (se Nginx ascolta sulla 80 standard).
3. **Oppure** completare HTTP-01 **su Apache** (host che oggi risponde sulla 80): webroot/proxy verso `/var/www/html` del VPS.

Quando da rete esterna `curl -s http://www.fr-busato.it/.well-known/acme-challenge/probe-10880` restituisce `probe-10880` (non un **301** Apache verso HTTPS): sul VPS `sudo certbot renew --force-renewal` poi `sudo systemctl reload nginx`. Verifica date: `echo | openssl s_client -connect 127.0.0.1:8443 -servername www.fr-busato.it 2>/dev/null | openssl x509 -noout -dates`.

---

### Chiusura sessione 04 maggio 2026

**Gate read-only modulo audit — S-A1/S-A2/S-A3 (PR #25, merge su main, deploy VPS 04/05/2026):**

| Fix | File | Dettaglio |
|-----|------|-----------|
| Policy API `AUDIT_READ_ONLY` | `response.controller.js` | `saveResponse` + `bulkSaveResponses`: guard 403 su audit `completed`/`approved`/`archived` |
| Policy API `updateAudit` | `audit.controller.js` | Guard 403 per `completed`/`approved`/`archived` — status letto dalla SELECT esistente, zero query extra |
| Sync queue stall permanente | `syncService.js` | `AUDIT_READ_ONLY` aggiunto ai codici 403 che causano stall definitivo (no retry infinito) |
| Gate UI read-only | `AuditAccordionLayout.jsx` | Predicato `isReadOnly`, banner ambra, propagazione `readOnly` a tutti i 6 figli |
| Figli read-only | `GeneralDataSection`, `AuditObjectiveSection`, `AuditOutcomeSection`, `ChecklistModule`, `CustomChecklistAuditView`, `NonConformitiesManager` | Prop `readOnly=false` (retrocompatibile), `disabled` su input/pulsanti |
| CSS | `AuditAccordionLayout.css` | `.audit-readonly-banner`, `.readonly-mode` |
| ClosePanel custom | `AuditClosePanel.jsx` | Blocco chiusura audit solo-custom: soglia 80% applicata anche a risposte custom |

**Test**: 101/101 Vitest PASS, build Vite OK.  
**Deploy**: SCP `response.controller.js` + `audit.controller.js` sul VPS → restart sgq-backend → PID 263552→271427 ✅ → health OK.

**Prossima slice**: S-A4 (pending deep-link + ordinamento NC/OSS/NV) — analisi già in `AUDIT_MODULE_LEAD_BRIEF.md` §9.

---

### Chiusura sessione 03 maggio 2026

**Refactoring strutturale + storicizzazione completati (commit `de37950`, `16e7b14`, `f8f4720`):**

#### Gap chiusi in questa sessione

| Fix | Dettaglio |
|-----|-----------|
| `AuditClosePanel` metriche NC | Warning ora somma ISO + custom checklist (`isoMetrics + customMetrics`) |
| `dateHelpers.js` | `formatDate` centralizzata — rimossa da `NCPage`, `RisksPage`, `QualificationsPage`, `DocumentRegistry` |
| Migration 048 | Temporal table su `audit_custom_checklist_responses` — applicata in produzione. DB: tutte e 3 le tabelle audit ora SYSTEM_VERSIONED |
| `alert.routes.js` | Protetto con `requireLicensedModule('documents')` |
| Alert Engine SMTP | Documentato setup VPS in GUIDA_CONSOLIDATA (sezione Alert Engine) |

#### Lezione — verifica prima di riscrivere

Prima di includere un fix in DEPUTYTASK, **leggere la funzione target**. In questa sessione `handleFileSelect` in `CustomChecklistAuditView.jsx` era già corretto (usa `apiService.uploadAttachment` + `syncService.enqueue` offline) — il fix era stato inserito nel task per errore di analisi statica superficiale. La lettura del codice ha evitato una modifica inutile.

**Regola**: ogni "gap" ipotizzato dall'analisi va verificato con una lettura delle righe effettive prima di essere inserito nel DEPUTYTASK.

#### Stato global moduli al 03/05/2026

- **Modulo Audit**: chiuso (T1–T5, temporal tables, event store, refactoring)
- **Gestione Documentale**: `DocumentRegistry` + Sprint 10 completati
- **Scadenziari**: `QualificationsPage` + `alertScheduler` pronti (SMTP da configurare manualmente)
- **NC/Rischi/Reclami**: Sprint 3/6/7 completati
- **Storicizzazione DB**: `audits`, `audit_responses`, `audit_custom_checklist_responses` — tutte SYSTEM_VERSIONED

---

### Chiusura sessione 01 maggio 2026

**Sprint audit completato — modulo audit sostanzialmente chiuso (T3→T5, refactoring, allegati unificati):**

**Lezioni apprese — approcci vincenti da riusare:**

#### Pattern server-wins al reconcile (multi-device)
Il bug multi-device (modifiche del Device 2 non visibili su Device 1) aveva **due cause distinte** da correggere insieme:
1. **Debounce 60s su `fetchAndApplyServerResponses`**: non veniva resettato al cambio audit → il fetch veniva saltato e si usavano i dati IndexedDB locali. Fix: `useEffect` su `currentAuditId` che azzera `fetchAndApplyLastRunRef`; debounce ridotto a 10s (solo per doppio mount React).
2. **Merge "locale prevale se non vuoto"** in `fetchAndApplyServerResponses` e in entrambi i blocchi di `reconcileAuditsFromServer`: le note/evidenze locali (vecchie) vincevano sulle note server (più recenti). Fix: server-wins incondizionato all'apertura audit; fallback locale SOLO se il server non ha mai ricevuto quei dati (draft puro, `audit_extra_data` vuoto).
- **Regola**: al reconcile/hydrate il server è fonte di verità. Il locale prevale SOLO offline o per dati mai sincronizzati.
- **File**: `StorageContext.jsx` — `fetchAndApplyServerResponses`, `reconcileAuditsFromServer` (due blocchi identici da tenere allineati).

#### Textarea note — draft guard (maggio 2026)
Sintomo: durante la digitazione nelle note checklist il testo si azzera (“refresh”). Cause: (1) `fetchAndApplyServerResponses` lenta che sovrascrive `notes` mentre si digita; (2) `reconcileAuditsFromServer` ogni ~45s che legge IndexedDB (autosave debounce 2s) e fa `setAudits` con dati obsoleti.
- **Fix**: `draftFieldRegistry` + `AutoTextarea` (`auditUuid`, `draftFieldId` su focus/change); merge note con `checklistTextMerge.js` (`applyServerResponsesPreservingLocalNotes`, `resolveMergedChecklistForReconcile`); reconcile usa `auditsRef.current` prima di IndexedDB.
- **Test L1**: `app/src/tests/checklistTextMerge.test.js`.

#### Coerenza percorsi di scrittura (T3/T4/T5)
Quando si introduce un nuovo percorso di scrittura (T3: eventi atomici), il vecchio percorso (bulk `save_responses`) non va disabilitato ma reso parallelo/additivo. Se si disabilita uno dei percorsi si crea asimmetria (status scritto, note bloccate). Analogamente il lock non deve bloccare un percorso e lasciarne un altro libero.
- **Regola**: tutti i percorsi di scrittura devono avere lo stesso comportamento rispetto a lock, retry e error handling.
- **T5**: rimosso `assertWriteAllowed` da `audit.controller`, `response.controller`, `customChecklist.controller`, `attachment.controller`. Lock ora solo UX (banner).

#### Riuso componenti UI — "QuestionCard universale"
Prima di implementare qualsiasi nuovo widget di domanda/item, verificare se esiste già un componente equivalente. La checklist custom era stata scritta da zero invece di riusare `QuestionCard` della ISO, causando tre gap (layout, allegati, contatori). Il refactoring ha estratto `QuestionCard.jsx` standalone con props universali e slot `children` per contenuto aggiuntivo.
- **Regola**: `QuestionCard` è il componente canonico per qualsiasi tipo di domanda — non creare wrapper paralleli.
- **Pattern**: props universali (`question`, `onStatusChange`, `onNotesChange`, `attachmentManager`, `customItemId`) + slot `children` per contenuto specifico.

#### Deploy VPS — verifica PID riavvio
`systemctl restart` può restituire exit 0 senza riavviare davvero il processo (ottimizzazione systemd se il servizio è già running). Il deploy script ora:
1. Legge `OLD_PID` prima del restart
2. Esegue restart **con password** (più affidabile di `sudo -n`)
3. Verifica `NEW_PID != OLD_PID` — se uguale stampa warning esplicito
- **File**: `backend/scripts/deploy-to-vps.sh`
- **Conseguenza**: senza questa verifica il VPS girava con file JS vecchi in memoria nonostante il deploy.

#### Migration DB via SSH (non via cloud agent)
Il cloud agent Cursor non raggiunge il DB SQL Server direttamente (DNS non risolve il server). Pattern consolidato:
1. Scrivi script `run-migration-NNN-vps.js` che usa `require('/var/www/sgq-backend/src/config/database')`
2. **Windows (Cursor desktop):** `.\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-NNN-vps.js` (usa `.ssh-deploy.local.ps1`, **non** `SGQ_SSH_KEY_B64`). Preflight: `vps-preflight.ps1` → `VPS_ACCESS_OK`.
3. **Cloud Agent (Linux):** `scp` via `$SGQ_SSH_KEY_B64` + `ssh` + `node /tmp/run-migration-NNN-vps.js`
4. **PC con `database.json`:** migrazione diretta con Node/sqlcmd senza SSH.
- **Nota SQL Server**: `ON DELETE SET NULL` in FK non è sempre supportato. Verificare con istruzione separata prima di aggiungere clausole ON DELETE/UPDATE.

#### Accesso VPS da Windows — non usare SGQ_SSH_KEY_B64 (07/06/2026)
Su Cursor desktop (Windows) `SGQ_SSH_KEY_B64` è **sempre vuota** — è un secret solo Cloud Agent. L'agente che si ferma con *"Impossibile verificare… va rieseguita dal cloud agent"* sbaglia percorso.
- **Setup una tantum:** `backend/config/.ssh-deploy.local.ps1` (da `.example`) + `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- **Preflight obbligatorio:** `.\backend\scripts\vps-preflight.ps1` → `VPS_ACCESS_OK`.
- **Script/query sul VPS:** `run-on-vps.ps1` (PuTTY `plink`/`pscp`, carica `.ssh-deploy.local.ps1`).
- **Deploy:** `deploy-controllers-to-vps.ps1` (health check compatibile PowerShell 5.1: `Invoke-WebRequest -UseBasicParsing`).
- **Lezione:** non cercare `.ppk` se non esiste — password SSH in file gitignored è il percorso documentato; chiave `.ppk` + Pageant è upgrade opzionale.

#### Unificazione allegati ISO e custom (migration 047)
`evidence_blocks` della custom già referenziava `attachment_id` dalla tabella `attachments` — erano già unificati a livello DB. Il gap era solo nel frontend: `AttachmentSection`/`AttachmentPreview` non sapevano filtrare per `custom_item_id`. Soluzione minima: aggiungere `custom_item_id` nullable a `attachments` + propagare il param nei 4 punti frontend.
- **Beneficio**: tutte le feature future sugli allegati (download token, Office round-trip, Word embedding, offline sync) funzionano automaticamente anche per la custom.

---

**Task completati questa sessione:**
- T3 smoke L3 ✅ (status + note multi-device su prod)
- T4: `enqueueFieldUpdatedEvent` con debounce 500ms per generalData/auditObjective/auditOutcome/notes ✅
- T5: lock solo UX, rimosso da tutti gli endpoint ✅
- Rilievi pendenti Word 0.5 ✅ (già implementato in ExportPanel)
- Refactoring `QuestionCard` universale (standard + custom) ✅
- Fix contatori C/NA/NV in `AuditOutcomeSection` includono `customStatuses` ✅
- Migration 047: `custom_item_id` in `attachments` + `useAttachmentManager` nella custom ✅
- Fix deploy VPS: verifica PID + `response.controller.js` nello script ✅
- Fix multi-device: server-wins su tutti i campi (status, note, generalData, obiettivo, conclusioni) ✅

**Prossimo**: smoke test allegati su produzione (upload PDF/foto → verifica link + embed); ISO 14001 checklist completa; P1 smoke L3 custom checklist (DEPUTYTASK pronto).

**Nota 02/05/2026 — Word checklist custom**: gli allegati nelle `evidence_blocks` ora generano **HYPERLINK** cliccabile (come checklist ISO) quando è disponibile `getViewUrl`; in modalità **Incorpora foto** sotto l’immagine compare anche il link. La mappa allegati usa `attachment_id` / `serverAttachmentId` / `id`.

**Nota 28/05/2026 — Word checklist custom, allegati mancanti**: l'upload da **AttachmentSection** salva su server con `custom_item_id` ma spesso non aggiorna `evidence_blocks.attachment_id`. L'export ISO elenca allegati per `questionId`; il ramo custom leggeva solo i blocchi. Fix: `buildCustomChecklistSectionOoxml` (`attachmentsForCustomItem`). Per il menu template: copiare un `.docx` in `public/templates/` **non** registra il file — serve **POST** `/api/v1/report-templates` e assegnazione in editor checklist o Impostazioni.

---

### Chiusura sessione 29–30 aprile 2026

**Sprint sync + storicizzazione completato (25 commit):**
- SYNC-1/2/3/4: save_responses indipendente dal lock, field-level merge, banner merge UI, guard logout modal
- T1: temporal tables `audit_responses`/`audits` — storicizzazione automatica SQL Server (migration 045)
- T2: event store `audit_events` + endpoint `POST/GET /audits/:uuid/events` + idempotency (migration 046, 9 test L1)
- Fix multi-device: `initializeChecklist` non sovrascrive più risposte server; `isHydratingRef` blocca save durante hydrate
- Fix loop 401: heartbeat lock e reconcile interval si fermano a sessione scaduta
- Pulizia sync queue: `clearQueueForUnknownAudits` rimuove ghost UUID (es. `2E59A341`) al login/reconcile
- Banner stato caricamento: `serverDataStatus` idle→loading→ready/error con animazione
- Deploy autonomo cloud agent: `deploy-to-vps.sh` + `run-migration-agent.sh` (nota: DNS blocca DB da cloud, migrazioni via SSH sul VPS)
- Segreti Cursor configurati: `SGQ_SSH_KEY_B64`, `SGQ_SUDO_PASSWORD`, `DB_*`
- **T3**: percorso event-based per `save_responses` — `generateResponseEventKey`, `enqueueResponseEvent`, `syncSendAuditEvent`, fork `VITE_SYNC_MODE` in StorageContext e ChecklistModule (9/9 test L1, build OK). Produzione: `VITE_SYNC_MODE=legacy` (default, comportamento invariato).
- **429 (stress API)**: `syncService` applica **pausa globale** sulla coda (nessun incremento `retryAfter` sugli item), legge `retryAfterMs` da `ApiError.data` (header `Retry-After` o `RateLimit-Reset` in `apiService`), schedula `processQueue` al termine ed emette evento `sgq:syncRateLimited` per eventuale banner UI. Per carichi molto alti in produzione: valutare `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` sul backend (env già supportate in `server.js`).

**Prossimo**: smoke L3 umano T3 con `VITE_SYNC_MODE=events` su Netlify (da pianificare). Poi: smoke test allegati, ISO 14001 checklist, T4 (campi ricchi event-based).

### Workspace consigliato — ponte `C:\ProgettoISO` (Cursor / terminale)

Per **non dipendere dalla lettera disco di Google Drive** e mantenere stabile il percorso visto da Cursor (chat, indici, terminale):

- Usare una cartella fissa su disco locale, es. **`C:\ProgettoISO`**, come **workspace del progetto**.
- I file possono restare fisicamente su **Google Drive** (o altra unità): si crea un **collegamento simbolico (symlink)** o una **junction** da `C:\ProgettoISO` verso la cartella reale sul cloud. Se Drive cambia lettera o percorso, si **aggiorna solo il ponte**, non la configurazione di Cursor.
- Eseguire sempre **`git`**, **`npm run test:run`**, **`npm run build`** dalla root **`C:\ProgettoISO`** (evita doppi checkout dello stesso repo su `C:` e su unità cloud contemporaneamente).

### Artefatti IDE e `.gitignore`

- Cartelle **machine-specific** da non versionare: `.vscode/`, `.idea/`, **`.vs/`** (cache/layout Visual Studio) — tutte in **`.gitignore`** alla radice.
- **`.editorconfig`** (versionato, root): UTF-8, LF, indent — allineato a `.cursor/rules/sgq-encoding-quality.mdc`.
- **MCP locale (gitignored)**: `.cursor/mcp.json`, `.cursor/mcp.env` — template `mcp.env.example` + script `sync-github-mcp-env.ps1` (vedi [Sessione 30/05/2026 — Tooling](#sessione-30052026--tooling-cursor--mcp--node--vitest-chiusura-sessione)).
- **Audit storico (2026-04)**: scansione `git log --all` sui path contenenti `.vs/`: **nessun file** risulta mai stato committato in questo repository; **non** serve `git filter-repo` / BFG per `.vs/`.
- Se in futuro finissero per errore nell’indice: `git rm -r --cached .vs/` e commit; un **rewrite della history** (es. `git filter-repo`) vale solo se serve rimuovere blob dalla storia remota (dimensioni clone, policy compliance), non come passo obbligatorio dopo il solo `rm --cached`.

---

## Principi di documentazione (chiarezza e best practice)

> Riferimento incrociato: [INDICE_DOCUMENTAZIONE.md](INDICE_DOCUMENTAZIONE.md). Allineamento a pratiche consolidate (*documentation-as-code*, struttura tipo **Diátaxis** — tutorial/how-to/reference dove ha senso). Obiettivo: chi apre un file capisce **scopo**, **pubblico** e **quando aggiornarlo** senza leggere tutto il repository.

### Struttura e leggibilità

1. **Sintesi in cima** (blocco `> …` o paragrafo breve): cosa contiene il documento e per chi è.
2. **Gerarchia titoli coerente**: `##` per macro-sezioni, `###` per sotto-parti; evitare salti (`#` → `####` senza `##`).
3. **Paragrafi brevi**; **elenchi numerati** per procedure ordinate; **tabelle** per ambienti, checklist, matrici decisionali.
4. **Linguaggio operativo** nelle procedure: verbi chiari (*Apri…*, *Esegui…*, *Verifica…*). Alla prima occorrenza di un acronimo o termine di dominio, una riga di definizione o link a sezione/glossario.

### Dove scrivere cosa (fonte unica — evitare duplicati)

| Tipo di informazione | Dove vive |
|----------------------|-----------|
| Procedure ripetibili, lezioni da incidenti, smoke manuali, DoD operativi | **Questo file** (`GUIDA_CONSOLIDATA.md`) |
| Priorità, fasi, backlog, “Prossimo step” macro | `PROJECT_ROADMAP.md` |
| **Open points** che devono restare visibili tra sessioni AI (logout vs bozze, mirror PC, cache audit…) | `PROJECT_ROADMAP.md` — sezione **Open points e memoria trasversale** + ADR collegato (oggi [ADR-007](adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md)) |
| Stack, repo, flusso deploy ad alto livello | `PROJECT_CONTEXT.md` (root) |
| Decisione architetturale non ovvia | `docs/adr/ADR-*.md` + link da guida/roadmap |
| Incarico agente / deputy (scope, branch, DoD) | `docs/agent-tasks/*.md` |

Se una informazione esiste già altrove: **un link + una riga di contesto**, non copincollare paragrafi interi in più file.

### Manutenzione e review (come per il codice)

- **Messaggi di commit** espliciti per doc (`docs: …`, `docs(smoke): …`) così la storia Git è navigabile.
- **PR**: diff leggibile; per file molto lunghi valutare **indice** (TOC) a inizio documento o sezioni più piccole collegate.
- **Dopo cambio di comportamento del sistema**: aggiornare nella stessa PR (o subito dopo) la doc che descrive quel flusso — doc obsoleta è peggio di assente.

### Cosa evitare

- Nuovi `SESSION_NOTES_*` per procedure operative (vanno in guida + roadmap).
- **TODO** senza owner/data in doc “ufficiali”: meglio voce in roadmap o issue tracciata.
- **Dati sensibili** in markdown versionato (credenziali, URL con segreti, nomi cliente in checklist pubbliche): anonimizzare; stesse regole del codice.

---

## Piano qualità: fasi di sviluppo e test di robustezza

> Obiettivo: **stessa fonte** per pianificare slice di sviluppo, criteri di chiusura e **prove ripetibili** (automatiche + smoke + hardening). Aggiornare questa sezione quando cambiano moduli critici (auth, licenze, sync, export).

### Allineamento documenti (inizio / fine ciclo)

| Momento | Azione |
|--------|--------|
| **Inizio sprint o sessione** | Leggere [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) (**Prossimo step**, **Open points e memoria trasversale**, checklist aperte) e, se il task tocca permessi o dati per studio/azienda, [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md). |
| **Durante lo sviluppo** | Ogni vertical slice: elencare in PR/commit **file toccati** + **test aggiunti o da eseguire manualmente** (non solo “build ok”). |
| **Prima del merge su `main`** | CI app su PR ([`.github/workflows/ci-app-pr.yml`](../.github/workflows/ci-app-pr.yml)); localmente: sezione **D** (test + build). |
| **Dopo deploy** | [how-to/deploy.md](how-to/deploy.md) + [DEPLOY_CHECKLIST_RELEASE.md](how-to/DEPLOY_CHECKLIST_RELEASE.md) + smoke tabella sotto; se tocca licenze/auth → anche righe “Sicurezza e licenze”. |

### Definition of Done (slice verticale — minimo)

- [ ] **Persistenza e API**: stesso comportamento da UI reale (non solo happy path da Postman).
- [ ] **Multi-tenant**: almeno verifica mentale o test che `organization_id` / scope non “fugge” tra org (query + middleware).
- [ ] **Sync / offline** (se tocca audit o risposte): scenario reconnect o secondo dispositivo descritto o coperto da test.
- [ ] **Regressioni note**: Word/custom checklist/allegati — se la slice li sfiora, eseguire script o test elencati in sezione **D** o **B**.
- [ ] **Documentazione**: aggiornare **questa guida** o **roadmap** se cambia procedura deploy, vincolo licenza, o comando di verifica.

### Piramide test (cosa pianificare per robustezza)

| Livello | Cosa | Quando |
|--------|------|--------|
| **L1 — Automatici app** | `cd app` → `NODE_ENV=test` → `npm run test:run` + `npm run build` | Ogni modifica sostanziale a React/utils (wordExport, converter, hook critici). Pattern Vitest: `src/**/*.{test,spec}.{js,jsx}` (incluso contratto `response-options` in `src/tests/integration/`, mock senza rete in CI). |
| **L2 — Script / repro** | `node scripts/repro-custom-export.mjs`, `verify-template-repair.js` (se Word/template) | Dopo cambi a export OOXML o template. |
| **L3 — Smoke post-deploy** | Health API, login, lista audit, un flusso CRUD del modulo toccato, export Word se toccato | Sempre dopo release frontend/backend ([how-to/deploy.md](how-to/deploy.md)). Checklist strutturata: [Matrice smoke robustezza](#matrice-smoke-robustezza-checklist-manuale-ripetibile) (sotto). |
| **L4 — Hardening** | Due sessioni, lock audit, licenze (`403 MODULE_NOT_LICENSED`), refresh sessione, PWA offline (cache vs server) | Dopo modifiche a `auth`, `moduleLicense`, `syncService`, `IndexedDB`, lock. |
| **L5 — E2E / browser** (backlog prodotto) | Flussi completi su Netlify preview o staging | Pianificato in roadmap; non sostituisce L1–L4. |

### Procedura chiusura autonoma

> Ciclo **obbligatorio** per ogni slice verticale chiusa da agente (desktop o cloud) senza supervisione continua del committente. Complementa il DoD sopra e le regole in `.cursor/rules/sgq-operating-memory.mdc`.

#### Obiettivo e chiusura slice

| Fase | Cosa fare | Criterio chiusura |
|------|-----------|-------------------|
| **Perimetro** | Una slice = un obiettivo verificabile (bug, feature minima, doc) | Scope dichiarato in PR/commit; niente refactor paralleli |
| **Fix minimo** | Solo codice necessario al perimetro; riuso componenti/pattern esistenti | Diff piccolo; nessun «profittare» per pulizie non richieste |
| **Test L1** | Vitest/Jest mirati + build (`app/` o `backend/` secondo area) | Suite toccata verde; build ok |
| **Smoke L2–L3 simulato** | Script o checklist con **input → output atteso** (tabella sotto) | Esito documentato in guida/PR; L3 reale solo se richiesto |
| **Doc** | Aggiornare **questa guida** e/o **roadmap** se cambia procedura, vincolo o comando | Nessun nuovo `SESSION_NOTES_*` |
| **Chiusura** | Commit/PR con messaggio «perché»; merge su `main` se CI verde | Stato slice = TEST OK o rischio residuo scritto |

#### Smoke simulato L2–L3 (input → output atteso)

Usare quando non c’è device reale o deploy immediato. Ogni riga è ripetibile da script (curl, Node, Playwright headless) o da checklist manuale breve.

| Livello | Input | Output atteso |
|---------|-------|---------------|
| **L2 — API health** | `GET /api/v1/health` | `200`, body con stato servizio |
| **L2 — Auth** | `POST /auth/login` credenziali smoke (env) | `200`, token + `organization_id` |
| **L2 — Scope RBAC** | GET risorsa altra org con token tenant A | `403` o `404`, mai dati altrui |
| **L3 — Flusso modulo** | CRUD minimo del modulo toccato (es. NC create → list → detail) | Persistenza coerente; UI o API allineate |
| **L3 — Export** (se toccato Word) | Export audit con checklist custom | File OOXML scaricabile; placeholder critici presenti |
| **L3 — Sync** (se toccato) | Modifica su device A, refresh device B (o script reconcile) | Server-wins o merge documentato in ADR-008 |

**Nota:** smoke **L3 su dispositivi mobili reali** (PWA, lock, offline) resta **umana**: data, esecutore, device, note in guida o checklist dedicata — non marcare OK senza evidenza.

#### Limiti (non autonomi)

| Area | Regola |
|------|--------|
| **Schema DB produzione** | Nessun breaking change senza migrazione idempotente + piano rollback documentato |
| **Decisioni prodotto** | Prezzi, priorità cliente, scope contrattuale → fermarsi e chiedere |
| **Segreti** | Mai in repo/chat; usare `database.json`, `.cursor/mcp.env`, env cloud |
| **Smoke L3 campo** | Agenti simulano L2–L3; prove su tablet/telefono reali = committente o utente pilota |
| **Deploy VPS** | Autonomo se credenziali SGQ_* presenti; altrimenti documentare passi manuali |

#### Multitasking (worker paralleli)

| Consentito | Vietato |
|------------|---------|
| Task su **file/perimetri disgiunti** (es. TASK 0-A adapter vs 0-B migrazione SQL) | Due agenti sul **stesso file** o stesso endpoint |
| Brief separati (`DEPUTYTASK.md` + task file) con branch distinti | Slice che condividono migrazione DB o refactor sync |
| Merge sequenziale dopo CI verde per ogni branch | Parallelo su auth, licenze o `syncService` senza coordinamento |

Mappa dipendenze: vedere overview task in `docs/archive/agent-tasks/` (es. Fase 0 AI: 0-D dopo 0-A).

#### Slice documentazione — chiusura (31/05/2026)

| Slice | Esito |
|-------|-------|
| **3a — ADR** | [adr/README.md](adr/README.md): ADR-011 in indice; numerazione duplicata 002/003 citata per **nome file** |
| **3b — Archivio agent-tasks** | `TASK_AI_*` Fase 0 (implementati) → [archive/agent-tasks/](archive/agent-tasks/); stub redirect in `agent-tasks/` |

Prossime slice doc (backlog): 3c–3f in [INDICE_DOCUMENTAZIONE.md](INDICE_DOCUMENTAZIONE.md).

---

## Architettura target sync — Event-Sourced (ADR-008)

> **Da leggere prima di toccare qualsiasi codice di sincronizzazione, lock o audit_responses.**  
> Riferimento completo: [docs/adr/ADR-008-event-sourcing-sync.md](adr/ADR-008-event-sourcing-sync.md)

### Perché è stata presa questa decisione

Il 28 aprile 2026 l'utente Camellini ha perso ore di lavoro su un audit reale. L'indagine ha dimostrato che il sistema inviava lo **stato corrente intero** dell'audit come payload unico — un approccio intrinsecamente fragile perché:
- Il lock heartbeat aggiornava `updated_at` → il server rifiutava il payload come "obsoleto" (409)
- La guard del lock bloccava le risposte checklist quando il lock oscillava su rete mobile
- Nessuna storia delle modifiche: dato perso = dato irrecuperabile

I fix SYNC-1/2/3/4 hanno risolto il problema immediato. L'architettura event-sourced lo elimina strutturalmente.

### Regola vincolante (da ADR-008)

**Nessuna nuova feature che tocca la sync può usare il modello "stato corrente intero".** Ogni modifica a un campo deve produrre un evento atomico con `idempotency_key`. Questo vale per audit, risposte, checklist custom, NC, allegati.

### Stato sprint T e cosa NON fare in attesa

| Sprint | Stato | Cosa NON fare prima che sia completato |
|---|---|---|
| **T0** — Staging environment | ⏳ Da avviare | Non eseguire T1 su produzione senza staging |
| **T1** — Temporal tables | ⏳ Dopo T0 | Non aggiungere nuove tabelle senza temporal versioning |
| **T2** — Event store + endpoint | ⏳ Dopo T1 | Non creare nuovi endpoint "sync stato intero" |
| **T3** — Frontend save_responses eventi | ⏳ Dopo T2 | Non modificare la sync queue senza feature flag |
| **T4** — Frontend campi ricchi eventi | ⏳ Dopo T3 stabile 2 sett. | Non toccare debounce/StorageContext senza allineamento ADR-008 |
| **T5** — Lock opzionale | ⏳ Dopo T4 stabile 2 sett. | Non rimuovere lock prima di T4 |
| **T6** — Recovery UI + compaction | ⏳ Dopo T5 | — |

### Prerequisiti tecnici da documentare prima di T1

Prima di avviare T1, l'amministratore di sistema deve completare e documentare qui:

| Prerequisito | Chi fa | Dove documentare | Fatto? |
|---|---|---|---|
| DB staging creato (copia schema, dati anonimi) | Admin sistema | [DATABASE.md](reference/DATABASE.md) sezione "Ambienti" | ☐ |
| Connection string staging in `backend/config/database.json` con env `staging` | Admin sistema | File locale gitignored | ☐ |
| Script di anonimizzazione dati (per GDPR) | Dev | `database/scripts/anonymize-staging.sql` | ☐ |
| Policy retention event_store documentata | Product owner | ADR-008 sezione Compaction | ☐ |
| Approvazione product owner su temporal tables | Product owner | Questo file, firma + data | ☐ |

### Smoke L3 obbligatorio per ogni sprint T (chi / cosa / quando)

Per ogni sprint T, il product owner (o un utente Camellini/Mason in campo) esegue la smoke checklist definita in ADR-008. Le checklist non possono essere delegate ad agenti AI perché richiedono accesso reale all'app su dispositivi mobili reali.

**Formato dichiarazione completamento:**
```
Sprint T1 — Smoke L3 completato
Data: ____  Esecutore: ____  Dispositivo: ____
[ ] Login e visualizzazione audit
[ ] Modifica risposta e verifica persistenza  
[ ] Verifica history su DB staging
[ ] Nessuna regressione sui flussi esistenti
Note: ____
```

---

### Matrice smoke robustezza (checklist manuale ripetibile)

Spuntare dopo deploy o prima di demo cliente. Adattare profondità al rischio della release.

| Area | Verifica minima | Note / rischio |
|------|-----------------|----------------|
| **Auth / sessione** | Login, `/auth/me`, operazione autenticata, logout | Token refresh senza aggiornare `licensed_modules` in UI se non previsto fix. |
| **Licenze moduli** | Org con licenza parziale: menu + `LicensedRoute` + chiamata API modulo disabilitato → **403** codice `MODULE_NOT_LICENSED` | Allineamento route backend vs voci menu ([roadmap — checklist licenze](PROJECT_ROADMAP.md)). |
| **RBAC / studio** | Due utenti stesso tenant, `auditor_org` diversi: A non apre audit/B con id noto (GET/PUT/sync/allegati) | Vedi [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) sez. 5–7. Script L3: `.cursor/rbac-smoke-l3-phase2.mjs` (sotto). |

#### Smoke L3 RBAC Fase 2 (`.cursor/rbac-smoke-l3-phase2.mjs`)

Verifica REST cross-studio su API produzione (`fr-busato.it:8443`). Login da `.cursor/mcp.env` (`SGQ_APP_EMAIL` / `SGQ_APP_PASSWORD`) — **non** modifica hash password admin.

| Flag | Default | Uso |
|------|---------|-----|
| `--slice=gate|audit|nc|attach|registry|admin|all` | `all` | Esegue solo la fetta indicata |
| `--keep-data` | sì (sessione chiusura) | Non elimina record `RBAC_SMOKE_*`; stampa ID creati |
| `--no-keep-data` | — | Cleanup automatico a fine run |
| `--cleanup` | — | Elimina **tutti** i residui `RBAC_SMOKE_*` e termina |

```powershell
node .cursor/rbac-smoke-l3-phase2.mjs --slice=all --keep-data
node .cursor/rbac-smoke-l3-phase2.mjs --slice=audit --keep-data
node .cursor/rbac-smoke-l3-phase2.mjs --cleanup
```

Esito in `.cursor/rbac-smoke-l3-result.json`. **TEST OK** globale se slice `audit` + `nc` verdi; `attach`/`registry` possono essere **SKIP** (scope studio su download o GET documenti).

| **Multi-tenant** | Utente org A: nessun dato org B in liste principali | Isolamento query. |
| **Sync / audit** | Modifica audit → sync o reload → coerenza con server | `server-wins` su campi critici. |
| **Export Word** | Un audit reale: sezioni, allegati link, pending issues se applicabile | Mojibake, VERIFICATORE, logo. |
| **Import PDF (Sprint 9)** | Job + process + (opz.) AI extract con chiave | Licenza `ai_import`, privacy testo. |
| **Admin** | CRUD utente o licenze come da ruolo | Solo admin/superadmin senza scope errato. |

### Protocollo passo-passo — «il salvataggio arriva sul server?»

> Uso tipico: **più utenti collegati su audit diversi** (probabile). **Due utenti sullo stesso audit** è raro in campo, ma resta utile il lock per **due schede dello stesso utente**, tablet + PC, o errore di assegnazione — evita dati mescolati.

Seguire **in ordine**; se un passo fallisce, **fermarsi** e correggere prima del successivo (non serve stress test finché i passi base non sono verdi).

| # | Passo (cosa fare) | Risultato atteso | Test / evidenza |
|---|---------------------|------------------|-----------------|
| 1 | Login con utente reale | Dashboard senza errore rosso | — |
| 2 | Aprire **lista audit** e scegliere un audit di prova | Lista coerente con ciò che ti aspetti dal server | Se dubbi: confronto con altra sessione o admin DB (solo chi autorizzato). |
| 3 | **Selezionare** l’audit e aprirlo | Si vede il modulo audit; nessun loop di errori | Hard refresh una volta dopo deploy Netlify (`Ctrl+Shift+R`). |
| 4 | Attendere 2–5 s (lock server) | Nessun messaggio permanente «lock non attivo» mentre lavori solo | Se compare spesso: verificare deploy **frontend + backend** allineati (guida sez. A). |
| 5 | Modificare **una** voce (esito + nota/evidenza se richiesta) e attendere autosalvataggio | Indicatore salvataggio ok o assenza errori bloccanti | **DevTools → Rete**: una richiesta verso API `fr-busato` con **2xx** (non 401/423/404 ripetuti). |
| 6 | **Ricaricare la pagina** (F5) con lo stesso audit | Le modifiche del passo 5 sono ancora lì | Se spariscono: problema sync/server o coda — non passare al passo 7. |
| 7 | (Opz.) Secondo browser **stesso utente** su **altro** audit | Stesso comportamento | Copre «più utenti in lavoro» senza richiedere due persone sullo stesso file. |
| 8 | Dopo **modifica al codice** in quest’area | Regressione assente | Su PC sviluppo: `cd app` → `NODE_ENV=test` → `npm run test:run` + `npm run build` (L1). |

**Perché non sempre “hard test” automatici dall’agente in chat:** (1) sul workspace dell’agente spesso **manca** l’ambiente completo (`npm` in PATH, credenziali, divieto di bombardare la **produzione** senza esplicito ok); (2) i tool gratuiti (es. k6) vanno lanciati **sul vostro PC o in CI** con URL di **staging** o con limiti bassi sulla prod; (3) **prima** questo protocollo a passi — se il passo 5–6 fallisce, lo stress test non aggiunge diagnosi.

### Backlog test automatici (da tenere in roadmap)

- E2E stabilizzati su Netlify preview (login + checklist + export) — oggi CI PR = build + unit test app.
- Test contract API (lista endpoint critici vs `requireLicensedModule`) dopo ogni nuovo router modulare.

---

## A. Checklist custom, sync, deploy VPS

| Problema | Causa / fix |
|----------|-------------|
| Dati custom persi al reload | Local-first + merge in `StorageContext` / `CustomChecklistAuditView`; sync su `syncService`. |
| Checklist custom: nome/sezioni/voci non modificabili | UI `CustomChecklistsPage` + API `PUT /custom-checklists/:id`, `PUT .../sections/:sectionId`, `PUT .../items/:itemId` (`customChecklist.service` / `customChecklist.routes`). Deploy VPS: copiare controller, routes, service aggiornati + restart. |
| `PUT custom-checklist-responses` 404 | Backend VPS senza route aggiornate o Node non riavviato; copiare anche **services** richiesti dai controller. |
| 401 senza token / 404 con token | Route assente dopo auth; allineare file + `systemctl restart`. |
| `MODULE_NOT_FOUND` sul VPS | Copiare tutti i `require` (es. `auditMaintenance.service.js`, `customChecklist.service.js`, `reportTemplate.service.js`). |
| Word senza dati custom | `ExportPanel`: merge `currentAudit.customResponses` + server prima di `exportAuditToWord` (server non vuoto vince). |
| Rilievi pendenti in Word | `prepareAuditForExport`: prima `GET /audits/:id/pending-issues`, poi fallback `checkReaudit` + `nc-responses`. Riga **AP** in `RILIEVI_MARKER`: X su **NC** se ci sono pending aperti, altrimenti X su **CONF** (legacy). |
| Regressione verso ISO 9001 su audit custom | Preservare `custom_checklist_id` in update; `syncService` / `upsertAudit` non distruttivi — vedi commit `ac5d981` e hardening successivi. |
| Due utenti sullo stesso audit / conflitti salvataggio | **Lock pessimistico server** (tab. `audit_locks`, migrazione `027_audit_locks.sql`). Frontend: `StorageContext` + header `X-Audit-Lock-Token` via `apiService`; banner `AuditLockBanner.jsx`. Deploy: eseguire migrazione DB + aggiornare backend (`auditLock.service.js`, controller, route) + `systemctl restart`. |
| Popup «Audit bloccato: serve lock attivo» mentre si lavora da soli (checklist custom / salvataggi) | Il token era indicizzato solo per **UUID** ma le API usano spesso **`audit_id` numerico** nell'URL (`saveCustomChecklistResponses`, risposte ISO): l'header non partiva. Fix: `setAuditLockTokensForAudit` in `apiService.js` + `StorageContext` (stesso token sotto UUID e sotto `audit_id` dalla risposta `POST .../lock`). Deploy: solo **frontend** (Netlify da `main`). |
| **423** su `PUT /audits/:id` (update metadati / risoluzione conflitto sync) con lock attivo | `updateAudit` non passava `lockAuditUuid` → nessun `X-Audit-Lock-Token`. Fix: `updateAudit` invia `lockAuditUuid: String(id)` (UUID o numerico, coerente con la Map). |
| **Alert / popup** alla selezione di un audit esistente, poi tutto ok | Race: `processQueue` partiva prima del lock → 423; la coda **rimuoveva** l’item e `AuditLockBanner` faceva `alert`. Fix: su errori lock in sync **solo** `updateRetryCount` (retry al ciclo successivo), **nessuna** rimozione né `alert` (stato lock resta sul banner). |
| `DELETE /audits/:id` fallisce su ambienti legacy (`Invalid column name 'audit_id'`) | Risolto con hardening `auditMaintenance.service.js`: delete dinamici guidati da metadati `INFORMATION_SCHEMA.COLUMNS` (solo tabelle/colonne presenti), poi delete finale su `audits`. Strategia da riusare per compatibilita' cross-schema. |
| Admin: creare / modificare utenti | UI `UsersAdminPage` + API `POST /admin/users`, `PATCH /admin/users/:id`, `DELETE /admin/users/:id` (`admin.controller` / `admin.routes`). Solo **admin/superadmin senza** `auditor_org_id` può creare o promuovere **admin**; non si può disattivare sé stessi né l’**ultimo admin attivo** dell’org. Deploy VPS: script `backend/scripts/deploy-controllers-to-vps.ps1` include anche `admin.controller.js`, `admin.routes.js`, `auditorOrg.controller.js` + restart `sgq-backend`. |
| `GET /auditor-orgs` 500 / menu Studio vuoto in Gestione utenti | Bug: in `listAuditorOrgs` si usava `isSuperadmin` **non definito** (ReferenceError) invece di `isOrgWideAdmin` già calcolato → 500; la UI mascherava con `catch(() => ({ data: [] }))` e il dropdown restava senza opzioni. Fix backend: condizione su `isOrgWideAdmin`; fix UI: non ingoiare l’errore silenziosamente, mostrare messaggio se il caricamento studi fallisce. |
| Checklist custom visibili tra studi diversi | Fix scope per `auditor_org_id` in `custom_checklists` (migrazione `028_custom_checklists_auditor_org_scope.sql` + service/controller). Policy **B**: checklist legacy (`auditor_org_id NULL`) visibili a tutti gli auditor; nuove checklist create da auditor legate al proprio studio. |
| **Licenze moduli (Sprint 8)** | Colonna `organizations.licensed_modules` (JSON array di chiavi modulo; **NULL** = tutti i moduli attivi, retrocompatibile). API: `GET/PATCH /admin/licenses` (solo admin/superadmin org). Backend: `moduleLicense.service.js`, `requireLicensedModule` su documenti/allegati doc, NC, rischi, qualifiche, reclami+fornitori, notifiche. Login e `GET /auth/me` includono `licensed_modules`. Frontend: `LicensedRoute.jsx`, pagina **Impostazioni → Licenze moduli** (`/settings/licenses`), sidebar filtra voci senza licenza. Deploy VPS: `run-migration-037.js` + copiare service/middleware/controller/routes interessati + `server.js` (mount API su `/complaints` e `/suppliers`) + restart. **`requireLicensedModule` (2026-05-08)**: utenti con ruolo JWT **`superadmin`** o **`admin`** bypassano il controllo licenze sulle API (stesso spirito di `authorize()` per `superadmin`), così admin non riceve più `403 MODULE_NOT_LICENSED` durante collaudo o salvataggio impostazioni; gli **auditor** restano vincolati a `licensed_modules`. |
| **Licenze: admin salva ma UI non cambia** | Dopo `PATCH /admin/licenses` la sessione locale deve aggiornare `user` con `GET /auth/me`: usare `refreshUser()` da `AuthContext` (chiamato da `LicensesSettingsPage` dopo salvataggio). **Altri utenti** della stessa org: niente push automatico; vedono i moduli aggiornati al **prossimo login** o al **refresh token** / nuova chiamata `/auth/me` — documentare messaggio in UI (vedi roadmap Sessione A). |
| **Import PDF batch (Sprint 9)** | Tabelle `import_jobs`, `import_job_files`; API `GET/POST/PATCH/DELETE /import-jobs`, upload `POST .../files` (multipart `files`), `POST .../process` usa `pdf-parse` + `confidenceFromTextLength` (euristica). **`POST .../files/:fileId/ai-extract`**: estrazione JSON strutturata via OpenAI sul testo già estratto (richiede `OPENAI_API_KEY` sul server; rate limit dedicato). Colonne file: `ai_extraction_json`, `ai_extraction_error`, `ai_extraction_at`, `ai_model` (migrazione **039**). Licenza modulo **`ai_import`**. UI admin: **Impostazioni → Import PDF** (`/settings/import-jobs`). Deploy VPS: `run-migration-038.js` + **`run-migration-039.js`**, **`npm install`** nella cartella backend (dipendenza `pdf-parse`), copiare `importJobs.controller.js`, `importJobs.routes.js`, `importPdfText.js`, **`importAiExtraction.service.js`**, `server.js`, `moduleLicense.service.js` + restart. **Privacy**: il testo inviato all’API è lo stesso mostrato in schermata revisione; valutare accordo/DPA OpenAI per l’organizzazione. |
| **Confine ingest vs workflow commerciale** | Sprint 9 = **solo ingest** (testo da PDF + revisione). Il **riesame requisiti contratto** (stati, approvazioni, checklist §8.2) è modulo dedicato in roadmap (**Sprint 11**) con mini-specifica [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md). Il passaggio ingest → record documento tipizzato è **Sprint 10** (staging + commit umano), non da confondere con gli stati del caso commerciale. |
| **Import PDF — Fase 2 commit norme** | Dialog **Commit al Registry**: se `doc_type=norma`, campi **codice / ente / anno edizione** (no revisione/responsabile/scadenza); dopo il codice (AI o nome file) → `POST /documents/norm-lookup` precompila vigore + link catalogo; backend `commit-to-registry` scrive `type_specific_data` via `documentRegistryNorm.service` (come upload bulk / `DocumentForm`). File: `ImportJobsPage.jsx`, `importNormCommit.js`, `importJobs.controller.js`. Test L1: `app/src/tests/importNormCommit.test.js`. **Smoke 30/05/2026**: PR **#72** mergiata (fix `ISO_9001` underscore in filename); alias AI **`norma_tecnica`** → form norma automatico (`isNormDocType`); credenziali smoke → `.cursor/mcp.env.example` + `sync-sgq-smoke-env.ps1` (desktop) / Secrets Cursor Cloud. |
| **Registro norme — Fase 3 import codici (29/05/2026)** | **Senza PDF obbligatorio**: textarea «un codice per riga» nella cartella **NORME E LEGGI** → `POST /documents/norm-import-codes` → lookup `normCatalogLookup` → bozza `document_registry` (`status=bozza`, `type_specific_data` canonico con vigore + URL catalogo). Duplicati bloccati se `standard_code` già presente nella stessa org. Compatibile job settimanale `normValidityChecker` (legge `JSON_VALUE(..., '$.standard_code')`). File: `normCodesImport.service.js`, `NormCodesImportButton.jsx`, `document.controller.js`. Test L1: `backend/src/services/normCodesImport.service.test.js` (9 test). Deploy VPS: copiare service + controller + routes documenti + restart. |
| **Numerazione report audit (formato Mason)** | Alla creazione (`POST /audits` e sync create) il backend assegna `audit_number` come **`PREFISSO-YYMMDD-NN`** (es. `MSN-260417-01`): giorno calendario **Europe/Rome**, contatore atomico per org+prefisso+giorno (`audit_daily_sequences`, migrazione **040**). Prefisso: colonna **`organizations.audit_report_prefix`** (NULL = default `MSN`). Deploy VPS: `node backend/scripts/run-migration-040.js` (o SQL **040**) + script **`backend/scripts/deploy-controllers-to-vps.ps1`** (include già `auditNumberAllocation.service.js`, `audit.controller.js`, `sync.controller.js`) + restart. **Smoke read-only DB**: da `backend` con `NODE_ENV=production` → `node scripts/smoke-mason-db.js` (dopo almeno una creazione audit post-040 deve comparire almeno un numero Mason). |

**Deploy**: non copiare solo i controller; verificare `systemctl status sgq-backend.service`. **`/var/www/sgq-backend` sul VPS non è Git** — dopo `git push` va sempre aggiornata la copia file (script `deploy-controllers-to-vps.ps1` include anche `organization` + `auth` + `server.js` dove previsto) + restart `sgq-backend`. Dettaglio: [how-to/deploy.md](how-to/deploy.md). Dopo release lock: copiare anche `services/auditLock.service.js` e `controllers/auditLock.controller.js`.

### Workflow PR sicuro — regole branch main

**Stato attivo dal 18/06/2026** — branch `main` protetto via GitHub Branch Protection.

#### Protezioni attive

| Regola | Valore |
|--------|--------|
| Push diretto su `main` | Bloccato (admin può bypassare con avviso) |
| PR obbligatoria | Sì — almeno 1 PR aperta prima del merge |
| Review umana | Non richiesta (`required_approving_review_count: 0`) |
| Status check obbligatorio | **Smoke test DB test (via backend VPS)** deve essere `pass` |
| Dismiss stale reviews | Sì |
| Force push | Disabilitato |
| Eliminazione branch | Disabilitata |
| Enforce admin | No — il proprietario `qsstudio241` può bypassare in emergenza |

#### Flusso autonomo agente AI

```
feature branch → push → PR (gh pr create --fill) → smoke auto → check verde → merge (gh pr merge N --merge)
```

| Fase | Chi | Comando |
|------|-----|---------|
| 1. Branch | Agente | `git checkout -b feat/nome` |
| 2. Modifica + push | Agente | `git push origin feat/nome` |
| 3. Apri PR | Agente | `gh pr create --fill` |
| 4. Attendi check | Automatico | `gh pr checks N` (smoke passa in ~30s) |
| 5. Merge | Agente (dopo check verde) | `gh pr merge N --merge --delete-branch` |

**Comando rapido** per aprire PR da agente (usa title/body dal commit):
```bash
gh pr create --fill
```

**Verifica protezioni attive**:
```bash
gh api repos/qsstudio241/sistema-gestione-iso9001/branches/main/protection
```

**Emergenza (bypass admin)**: il proprietario `qsstudio241` può ancora fare push diretto su `main` — GitHub mostra avviso `Bypassed rule violations` ma accetta il push. Usare solo per hotfix critici.

---

### Workflow sviluppo: branch → preview → merge

**Regola default**: modifiche UI o feature → branch `feat/nome-descrittivo` → Pull Request verso `main` → **Deploy Preview Netlify** → **TEST OK committente** → merge su `main` (production Netlify).

| Fase | Chi | Azione |
|------|-----|--------|
| 1. Branch | Agente / dev | `git checkout -b feat/nome` da `main` aggiornato |
| 2. PR | Agente | Push branch + `gh pr create` con test plan |
| 3. Preview | Netlify (auto) | Build su URL `deploy-preview-N--systemgest.netlify.app` |
| 4. Test | **Committente** | Login, flusso modificato, API produzione (CORS preview attivo sul VPS) |
| 5. Merge | Committente o agente post-OK | `gh pr merge` → deploy production da `main` |

**Eccezioni** (merge diretto su `main` senza preview obbligatoria):

- **Hotfix produzione** critico (rollback o fix immediato beta tester).
- **Solo backend** già deployato sul VPS (migrazioni, CORS, API) senza cambi UI da verificare in preview.
- **Solo documentazione** senza effetto runtime.

**Checklist committente** (prima del merge):

| # | Verifica | Dove |
|---|----------|------|
| 1 | Deploy Preview Netlify **Success** (verde) | Tab Checks sulla PR GitHub |
| 2 | App preview carica (login / home) | URL preview nel commento Netlify |
| 3 | Flusso modificato funziona end-to-end | Preview + API **test** `https://www.fr-busato.it:8443/test-api/api/v1` (automatico da `netlify.toml`) |
| 4 | CI app verde (se tocca `app/`) | Check **CI app (Pull Request)** |
| 5 | Dichiarare **TEST OK** in chat o commento PR | — |

**Abilitazione preview** (una tantum): vedi sezione [Netlify — Deploy Preview (guida passo-passo)](#netlify--deploy-preview-guida-passo-passo) — Passo 2 *Deploy Previews → Any pull request*.

**CORS preview**: nginx (`conf.d/sgq-cors-map.conf` + `sites-available/sgq-backend`) e Express (`backend/src/config/corsOrigins.js`) accettano origini `https://deploy-preview-*--systemgest.netlify.app` e `https://*--systemgest.netlify.app` oltre a `systemgest.netlify.app`, `sistema-gestione-iso9001.netlify.app` e `fr-busato.it`. Deploy nginx: `.\backend\scripts\deploy-nginx-cors-vps.ps1`.

---

### Ambiente TEST backend (istanza parallela VPS — configurato 19/06/2026)

Sul VPS gira un secondo processo Node.js **separato** dal servizio di produzione, destinato al collaudo funzionale di branch prima del merge.

| Parametro | Valore |
|-----------|--------|
| **URL pubblico** | `https://www.fr-busato.it:8443/test-api/` |
| **Health check** | `curl -sk https://www.fr-busato.it:8443/test-api/api/v1/health` |
| **Porta interna Node.js** | `3001` (produzione usa `3000`) |
| **DB** | `2026-06-18_SGQ_ISO9001` (non tocca produzione `SGQ_ISO9001`) |
| **Servizio systemd** | `sgq-backend-test` |
| **File env VPS** | `/var/www/sgq-backend/.env.test` |
| **Config nginx** | `/etc/nginx/sites-available/sgq-backend-test` (blocco `listen 8444 ssl` — porta non esposta provider) |
| `NODE_ENV` | `test`, `LOG_LEVEL=debug` |
| `GEMINI_API_KEY` | ✅ presente in `.env.test`, allineata a produzione (`.env`) — abilita estrazione requisiti da disegni (adapter Gemini) anche su test/demo |

> **Nota porta 8444**: nginx è configurato anche su `:8444` (TLS) → `:3001`, ma il provider non espone quella porta all'esterno. Si accede via path-prefix `/test-api/` sulla porta `8443` già aperta. Se in futuro si vuole aprire `8444`: pannello di controllo del provider VPS → firewall → aggiungi regola TCP 8444.

> **Nota chiavi AI (20/06/2026)**: `GEMINI_API_KEY` è stata copiata da `.env` a `.env.test` lato server (valore mai esposto in chat/log) e il servizio `sgq-backend-test` è stato riavviato. L'estrazione requisiti da disegni (`POST /test-api/api/v1/import-jobs/:id/files/:fileId/ai-extract`, adapter `geminiAdapter.js`) funziona ora anche sull'ambiente test/demo. Verifica: health `healthy` + endpoint che risponde `401` senza auth (registrato).


#### Tabella ambienti (produzione vs test)

| Ambiente | URL frontend | URL backend | DB |
|---|---|---|---|
| **Produzione** (`main`) | `https://systemgest.netlify.app` | `https://www.fr-busato.it:8443/api/v1` | `SGQ_ISO9001` |
| **Test** (Deploy Preview PR) | `https://deploy-preview-NNN--systemgest.netlify.app` | `https://www.fr-busato.it:8443/test-api/api/v1` | `2026-06-18_SGQ_ISO9001` |

La variabile `VITE_API_URL` viene iniettata automaticamente da `netlify.toml` (`[context.deploy-preview.environment]`) — nessuna azione manuale necessaria.

#### Flusso completo test su branch

```
feat/branch → push → gh pr create → [GitHub Actions: smoke DB test] → [Netlify: Deploy Preview → VITE_API_URL=test-api automatico] → test funzionale su URL preview → TEST OK → gh pr merge → deploy produzione (deploy-controllers-to-vps.ps1)
```

#### Comandi rapidi ambiente test

```powershell
# Restart istanza test (dopo deploy file backend)
.\backend\scripts\run-on-vps.ps1 -Command "echo 'Sistemi@2026' | sudo -S systemctl restart sgq-backend-test"

# Health check test
curl -sk https://www.fr-busato.it:8443/test-api/api/v1/health

# Log istanza test (ultimi 50)
.\backend\scripts\run-on-vps.ps1 -Command "echo 'Sistemi@2026' | sudo -S journalctl -u sgq-backend-test -n 50 --no-pager"

# Stato servizio test
.\backend\scripts\run-on-vps.ps1 -Command "echo 'Sistemi@2026' | sudo -S systemctl status sgq-backend-test --no-pager"

# Smoke DB + VPS test opzionale
cd backend && node scripts/smoke-testdb.js --check-vps
```

#### Come fare deploy di un branch sull'istanza test

**Metodo A — Deploy completo (raccomandato dal 21/06/2026):**
```powershell
.\\backend\\scripts\\deploy-controllers-to-vps.ps1 -AlsoRestartTest
```
Copia tutti i file del manifest, riavvia `sgq-backend` (prod) + `sgq-backend-test` in sequenza, health check su entrambi.

**Metodo B — Deploy singolo file (hotfix rapido):**
1. Copia file: `run-on-vps.ps1 -LocalFile ... -RemotePath /tmp/... -RemoteCommand "sudo cp /tmp/... /var/www/sgq-backend/..."`
2. Restart test: `.\.\backend\scripts\run-on-vps.ps1 -Command "echo '[REDACTED]' | sudo -S systemctl restart sgq-backend-test"`
3. Verifica: `curl -sk https://www.fr-busato.it:8443/test-api/api/v1/health`
4. Test funzionali su Deploy Preview Netlify (VITE_API_URL automatico da `netlify.toml`)
5. Se OK → merge → `.\\backend\\scripts\\deploy-controllers-to-vps.ps1` per produzione

### Netlify — Deploy Preview (guida passo-passo)

**Cosa ottieni**: per ogni **Pull Request** su GitHub, Netlify costruisce un sito di anteprima con URL dedicato (es. `deploy-preview-12--nome-sito.netlify.app`). **Non** serve un secondo progetto Netlify né configurazioni diverse per branch: è la stessa app collegata al repo.

**Prerequisiti**
- Sito Netlify già collegato al repository GitHub (deploy da `main` funziona oggi).
- Permessi **Owner** o ruolo che possa modificare *Site configuration*.

---

#### Passo 1 — Verificare collegamento GitHub

1. Accedi a [Netlify](https://app.netlify.com) → seleziona il **sito** del SGQ.
2. **Site configuration** (ingranaggio o menu sito) → **Build & deploy**.
3. Sotto **Continuous deployment** deve comparire il **repository** corretto (es. `qsstudio241/sistema-gestione-iso9001`) e il branch di produzione (di solito **`main`**).

**Verifica OK**: vedi il nome repo e l’ultimo deploy da `main` con stato *Published*.

**Se manca il repo**: *Link repository* → autorizza GitHub → scegli il repo → branch `main` → conferma. Netlify userà `netlify.toml` in root (`base = "app"`, `publish = "dist"`).

---

#### Passo 2 — Abilitare i Deploy Preview

L’interfaccia Netlify cambia a volte nome alle voci; cerca sempre equivalenti a *Deploy previews* / *Pull request previews*.

1. Stesso percorso: **Site configuration** → **Build & deploy**.
2. Cerca la sezione **Deploy Previews** (o **Pull request previews** / sotto *Branches and deploy contexts*).
3. Imposta **Deploy Previews** su **Any pull request** (o **All pull requests** / **Enabled** — formulazione equivalente).

**Cosa evitare**: non limitare i preview a “solo branch con nome X” se l’obiettivo è provare ogni PR verso `main`.

**Verifica OK**: l’opzione risulta attiva e salvata (nessun messaggio di errore in pagina).

---

#### Passo 3 — Permessi GitHub App Netlify (se i preview non partono)

1. Su GitHub: **Settings** dell’organizzazione o dell’utente → **Applications** → **Installed GitHub Apps** → **Netlify**.
2. Controlla **Repository access**: deve includere il repo del progetto.
3. Se Netlify chiede scope aggiuntivi per **Pull requests**, accetta.

**Verifica OK**: Netlify può ricevere eventi `pull_request` dal repo.

---

#### Passo 4 — Prova reale con una Pull Request

1. Su GitHub crea un branch minimo (es. `chore/test-netlify-preview`) da `main`.
2. Modifica un file banale (es. un commento in `app/README` o una riga in `docs` — oppure solo merge una riga senza effetto se preferisci).
3. Apri **Pull Request** verso **`main`**.
4. Nella pagina della PR, attendi 1–3 minuti: dovrebbe comparire il check **netlify** / **Deploy Preview** (o un commento di Netlify con il link).
5. Clicca l’URL del **Deploy Preview** e verifica che l’app carichi (login, home).

**Verifica OK**
- Build Netlify sulla PR in stato **Success** (verde).
- URL preview apre la SPA (anche `/` → `index.html` grazie al redirect in `netlify.toml`).

**Se fallisce**
- In Netlify: **Deploys** → filtra per *Deploy previews* → apri il deploy fallito → leggi **Deploy log** (errore `npm`, Node, ecc.).
- Confronta **Node**: in `netlify.toml` è `NODE_VERSION = "20"`; deve essere coerente con CI locale.
- Stato **Canceled** con *Building* ok e *Deploying* skipped: sul piano **Free** spesso c’è **una sola build concorrente**; un altro deploy (es. su `main`) può far annullare il preview. Attendere o usare **Retry** → *Retry with latest branch commit*; aprire il deploy riuscito e **Open deploy preview**.

**Best practice — PR solo per smoke test Deploy Preview**
- **Non mergiare** commit “usa e getta” (es. riga di prova in questa guida): chiudere la PR **senza merge** e **eliminare il branch** remoto (`git push origin --delete nome-branch`).
- I Deploy Preview restano attivi sul sito Netlify; la verifica non richiede merge su `main`.

---

#### Passo 5 — Differenza tra Production e Preview

| Contesto | Cosa viene deployato | Chi lo usa |
|----------|----------------------|------------|
| **Production** | Branch `main` (dopo merge) | Beta tester URL principale |
| **Deploy Preview** | Ogni PR | Sviluppatore / QA prima del merge |

I preview **non** sostituiscono `main`: servono a **non rompere** i beta finché la PR non è mergiata.

---

#### Passo 6 — CI GitHub sulle PR (consigliato, già in repo)

Workflow: `.github/workflows/ci-app-pr.yml` — su ogni PR che tocca `app/` esegue `npm ci`, `npm run test:run` (con `NODE_ENV=test`), `npm run build` nella cartella `app`.

**Verifica OK**: nella PR, tab **Checks**, job **CI app (Pull Request)** verde.

**Nota**: Netlify e GitHub Actions sono indipendenti; entrambi verdi = maggiore sicurezza prima del merge.

---

**Backlog architetturale**: [adr/ADR-006-auto-reconcile-cache-sync.md](adr/ADR-006-auto-reconcile-cache-sync.md).

---

## B. Report Word — checklist custom (Verbale)

| Problema | Dove / cosa |
|----------|-------------|
| `**` letterali | `wordExportHelpers.js` → `buildCustomChecklistSectionOoxml` (`lineToRichRuns`, `textToRichParagraphs`). |
| Solo link allegato, no foto | `ExportPanel.jsx`: `photoMode: 'preview'`; `preloadImagesIntoAudit` + `embedImagesInZip`. |
| DOCX illeggibile con JPEG | `[Content_Types].xml` senza `.jpg` → `ensureImageContentTypesInZip` in `wordExport.js`. |
| XML dopo render | `repairWordDocumentXmlMalformedAttrs` dopo `doc.render` e dopo inject marker. |
| Più tabelle | Un solo `xmlTable` in `buildCustomChecklistSectionOoxml`. |
| Righe `1.1.2`, `1.1.3` | Una riga per voce; `evidence_blocks` concatenati; codice `itemCode`. |
| `rId` duplicati | Indice sequenziale `30000 + imageRegistry.length`. |
| Foto sempre **landscape** in Word | Allegati checklist: prima `xmlImageOoxml(rId, imgId)` senza dimensioni → fallback fisso 1905000×1428750 EMU (~200×150 px). Fix (mag 2026): `embeddedImageEmuFromBase64` in `wordExportHelpers.js` legge pixel reali da PNG/JPEG e scambia w/h se EXIF orientation 5–8; logo già corretto in `wordExport.js`. Test: `wordExport.imageDimensions.test.js`. |
| Template ISO al posto del Verbale | `generateDocxBlob`: ramo `isCustomChecklist` + fallback `TEMPLATE_MAP.custom_checklist`. |
| Tabelle fuori margini | `w:tblInd` negativo → `normalizeNegativeTableIndentsInZip`; script `app/scripts/fix-verbale-table-margins.js`. |

**Template**: fallback `app/public/templates/VerbaleVisita-generic.docx` (allineato a migration 026 / `report_templates`). Il file `Verbale_di_riunione_QTAFI_VIS001.docx` resta copia cliente senza placeholder docxtemplater — **non** usarlo come fallback export. Se `getReportTemplate` restituisce URL (anche `/uploads/...`), quello ha priorità. **Repro** (`repro-custom-export.mjs`): solo file in `public/templates`, senza resolver API.

**Ordine capitoli e sommario (mag 2026)**: in `wordExport.js`, `normalizeAuditReportDocumentStructure` riordina **Conclusioni dopo RILIEVI** (come ISO patchate) e rimuove righe Sommario TOC cache obsolete (`_Toc*`) così Word rigenera l’indice aprendo il file. Test: `wordExport.chapterOrder.test.js`. Script offline: `patch-audit-template-structure.cjs` (include `VerbaleVisita-generic.docx`).


### Sessione 30/05/2026 — Tooling Cursor / MCP / Node / Vitest (chiusura sessione)

#### Attività completate

| # | Area | Esito |
|---|------|--------|
| 1 | Cursor Marketplace — estensioni | GitHub PR, Vitest, MSSQL, EditorConfig, Remote SSH; **Modern Web Guidance** opzionale |
| 2 | GitHub MCP | URL `https://api.githubcopilot.com/mcp/`; PAT fine-grained ok; **43 tools** |
| 3 | Playwright MCP | Test ok — **23 tools** |
| 4 | Node LTS | Installato per Vitest extension e Playwright MCP |
| 5 | `.editorconfig` | UTF-8, LF, indent coerente (root repo) |
| 6 | Sync PAT GitHub | `.cursor/mcp.env.example` + `.cursor/sync-github-mcp-env.ps1` |
| 7 | Vitest L1 | **432 pass / 2 fail** (`importNormCommit` — preesistente) |

#### Lezioni apprese — Cursor Marketplace e estensioni

- **Estensioni utili**: GitHub Pull Requests, Vitest, MSSQL, EditorConfig, Remote SSH.
- **Installazione CLI**: usare `cursor.cmd --install-extension <publisher.extension> --force -Wait`, **non** lanciare ripetutamente `Cursor.exe` (evita finestre multiple).

#### Lezioni apprese — GitHub MCP (server HTTP)

- **URL server**: `https://api.githubcopilot.com/mcp/` — PAT fine-grained accettato.
- In `mcp.json` usare `"Authorization": "Bearer ${env:GITHUB_PERSONAL_ACCESS_TOKEN}"` (o equivalente headers).
- **`envFile` NON funziona** per server MCP basati su URL HTTP (solo stdio). Non affidarsi a `envFile` in `.cursor/mcp.json` per GitHub.
- **Pattern corretto (Windows)**:
  1. Copiare `.cursor/mcp.env.example` → `.cursor/mcp.env` e incollare il PAT (senza `Bearer`, senza virgolette).
  2. Eseguire: `powershell -ExecutionPolicy Bypass -File .cursor/sync-github-mcp-env.ps1` — imposta variabile **utente Windows** `GITHUB_PERSONAL_ACCESS_TOKEN`.
  3. Riavviare Cursor completamente (chiudere tutte le finestre).
- **Profilo Windows**: la variabile va impostata sul profilo **corretto** (`AI.Project` vs account manutenzione). Se MCP non vede il token, verificare nello stesso profilo usato da Cursor: `[Environment]::GetEnvironmentVariable('GITHUB_PERSONAL_ACCESS_TOKEN','User')`.
- Se in Impostazioni MCP GitHub mostra **Logout** (OAuth): uscire da OAuth e usare **solo** il PAT.

#### Lezioni apprese — Node, Vitest extension, Playwright MCP

- **Node.js LTS** (`C:\Program Files\nodejs\`) necessario per Vitest extension in IDE e Playwright MCP.
- Cursor può avere nel PATH un **node bundled** prima del Node di sistema → in `.cursor/mcp.json` usare path assoluto per Playwright: `"command": "C:\\Program Files\\nodejs\\npx.cmd"`.
- **`.vscode/settings.json`** (gitignored, locale): `"vitest.nodeExecutable": "C:\\Program Files\\nodejs\\node.exe"` per far usare a Vitest extension il Node LTS.
- **Test da terminale agent** (cloud): pattern esistente con `$node` bundled Cursor — vedi sezione *npm non è nel PATH* più sotto; su desktop IDE preferire Node LTS di sistema.

#### Test L1 — esito sessione

| Suite | Esito | Note |
|-------|--------|------|
| Vitest `app/` | **8/8 pass** (`importNormCommit.test.js`, 30/05/2026) | PR #72 mergiata + alias `norma_tecnica` |

#### Prossimo test consigliato (circuito Registro Norme)

Ordine smoke integrato: **Vitest** (`importNormCommit`, `normCodesImport`) → **Playwright MCP** (UI Registro → NORME E LEGGI) → **SQL** (verifica `type_specific_data` / duplicati) → **GitHub MCP** (trace PR/commit).

**File locali sessione (non committati)**: `.editorconfig`, `.cursor/mcp.env.example`, `.cursor/sync-github-mcp-env.ps1`, modifica `.gitignore` (ignore `mcp.json` / `mcp.env`).

---

**Esperienza 29/05/2026 - registro norme e albero documenti (chiusura sessione)**

- **Fase 2 norme (commit import PDF)**: allineamento `type_specific_data` canonico al commit batch; form tipo `norma` senza campi revisione/responsabile/scadenza SGQ. Commit `a77b616`.
- **Fase 3 import codici catalogo**: textarea codici in **NORME E LEGGI** → `POST /documents/norm-import-codes` → `normCodesImport.service` + lookup catalogo; duplicati su `standard_code` per org. Commit `a77b616` (service) + deploy VPS manuale service/controller/routes documenti.
- **Smoke / fix backend**: ISO 5817 e dedup import; esclusione documenti **obsoleti** dall'albero (`526ae9f`). Pannello dettaglio: metadati norma visibili (`dde4d6e`).
- **UI albero** (`b2c0694` + `b3e5b51`): tooltip; rinomina/elimina solo cartelle **custom**; icone sistema vs custom; `FOLDER_NOT_EMPTY` se cartella non vuota. **Sidebar ridimensionabile**: maniglia sottile a destra dell'albero, larghezza in `localStorage` chiave `sgq-doc-tree-width`; su mobile barra **Cartella selezionata** sopra il dettaglio.
- **Norme (lessico SGQ)**: niente campo *revisione* documentale — usare **edizione** / **anno edizione**, **vigore** e lookup **catalogo-first** (`norm-lookup`, import codici); cartelle **sistema** (es. NORME E LEGGI) **non** rinomina/elimina dall'UI.
- **UX visibilità novità (30/05)**: deploy Netlify **systemgest.netlify.app** può essere OK mentre l'utente «non vede nulla» → aprire tab **Albero** nel Registro documenti, URL produzione corretto, provare **drag** sulla maniglia; se PWA/cache vecchia: hard refresh o reinstallazione PWA.
- **Deploy VPS**: `deploy-controllers-to-vps.ps1` (manifest unico `deploy-manifest.json`) copia tutti i file norme/NC/documenti + restart `sgq-backend`; smoke `npm run smoke:deploy`.
- **Commit di riferimento**: `a77b616`, `526ae9f`, `dde4d6e`, `b2c0694`, `30f5fd5`, `b3e5b51`.

**Esperienza 01/06/2026 — Registro documenti multi-azienda (slice D1)**

- **Regole cartelle**: ogni azienda può **aggiungere** cartelle custom (`is_system_folder = 0`); le cartelle da **provisioning** restano protette (UI + API 403 su rinomina/elimina/sposta).
- **Tab Albero**: selettore **Ambito** (tutto lo studio / azienda X) allineato a Ricerca SGQ; `useDocumentTree(companyId)` propaga `company_id` a tree, lazy children e nuove cartelle custom.
- **Deep link**: `/documents?tab=tree&company_id=N&select=DOC_ID`.
- **Backend**: `GET /documents/tree/:parentId/children?company_id=` — stesso filtro di `getTree` (azienda + nodi con `company_id` NULL = condivisi studio). Deploy VPS `documentTree.controller.js` dopo merge.
- **Backlog**: ~~D2 scope su Priorità/Catalogo~~; ~~D3 provisioning albero per `company_id` alla creazione cliente~~ (vedi slice D2/D3 sotto).

**Esperienza 01/06/2026 — Registro documenti multi-azienda (slice D2/D3)**

- **D2 — Ambito condiviso**: selettore **Ambito** nell'header del Registro (Priorità / Catalogo / Albero); `company_id` su API lista documenti e deep link `?company_id=` su tutte le tab; persistenza `localStorage` chiave `sgq-doc-registry-company-scope`; nuovo documento precompila azienda da ambito.
- **D3 — Provisioning automatico**: `POST /companies` dopo INSERT chiama `documentTreeProvisioner.provisionTree(org_id, company_id, …)` se manca root per quella azienda (non bloccante, idempotente). Deploy VPS: `company.controller.js`.

**Esperienza 03/06/2026 — Albero documentale per-azienda (Camellini / org 1002)**

| Step | Cosa | File / comando |
|------|------|----------------|
| A | API albero con `?company_id=X`: filtro **stretto** (`dr.company_id = X`, niente `OR IS NULL`); `children_count` allineato | `documentTree.controller.js`, `documentTreeCompanyScope.js` |
| B | Migrazione dati org QS: provision per ogni azienda, rimappa `parent_id` per `folder_code`, archivia albero condiviso (`company_id NULL` → `obsoleto`) | `backend/scripts/migrate-per-company-document-trees-vps.js` su VPS |
| C | Nuove aziende: provisioning sempre su `company_id` (già in `company.controller.js`) | — |
| Operativo | In Registro documenti → tab **Albero**, impostare **Ambito = nome cliente**; hard refresh PWA dopo deploy | — |

```bash
# VPS: anteprima poi apply (ORG_ID default 1002)
scp -P 1122 -i $KEY backend/scripts/migrate-per-company-document-trees-vps.js user@vps:/tmp/
ssh … "DRY_RUN=1 node /tmp/migrate-per-company-document-trees-vps.js"
ssh … "DRY_RUN=0 node /tmp/migrate-per-company-document-trees-vps.js"
# Poi deploy documentTree.controller.js + utils e restart sgq-backend
```

**Esperienza 13/06/2026 — Migrazione batch alberi per-azienda (MASON + ERAM)**

- **Sintomo**: nuova azienda **LM&CO Sas** (ERAM org **1004**) mostrava in tab Albero le **15 norme** già caricate per **DNV** — albero studio ancora **condiviso** (`company_id` NULL).
- **Diagnosi**: `node backend/scripts/scan-shared-document-trees.js` — tenant da migrare: **1003** (MASON, 1 azienda) e **1004** (ERAM, 2 aziende). QS (**1002**) già OK.
- **Slice eseguiti**: (1) script scan; (2) estensione migrazione con `rehomeSharedOrphans` (norme NULL → prima azienda per `id`); (3) `DRY_RUN` batch; (4) apply `DRY_RUN=0`.
- **Esito ERAM**: 15 norme assegnate a **DNV** (`company_id=16`), spostate sotto cartella 2.3 per-azienda; **LM&CO** albero vuoto (corretto). Albero condiviso archiviato.
- **Esito MASON**: albero provisionato per **MANITOU ITALIA SRL**; condiviso archiviato.
- **Verifica post**: scan → `Tenant da migrare: 0`; ogni azienda 15 radici, 0 duplicati.

```bash
# Diagnosi tutti i tenant
node backend/scripts/scan-shared-document-trees.js

# Anteprima batch
node backend/scripts/migrate-shared-trees-batch.js

# Apply (solo tenant con radici NULL attive)
DRY_RUN=0 node backend/scripts/migrate-shared-trees-batch.js

# Singolo tenant
DRY_RUN=0 ORG_ID=1004 node backend/scripts/migrate-per-company-document-trees-vps.js
```

- **Operativo utente**: Registro documenti → **Ambito = nome azienda** → hard refresh PWA. Nuove aziende ricevono albero dedicato automaticamente (non esiste più albero condiviso nello studio).

**Esperienza 05/06/2026 — DELETE azienda falliva con FK (AAA-NN / Camellini)**

- **Sintomo**: `DELETE /companies/:id` → 500 «Errore eliminazione azienda»; SQL `FK_doc_registry_company` (azienda con albero provisionato + audit + chunk AI).
- **Fix**: `companyMaintenance.service.js` — ordine cleanup: `audit_events` + `hardDeleteAudit` → `knowledge_chunks` → `document_history` / `attachments` / relazioni → `document_registry` → altre FK (`company_personnel`, billing, …) → `companies`. Controller `deleteCompany` delega al service.
- **Deploy**: `company.controller.js` + `companyMaintenance.service.js` su VPS + restart `sgq-backend`. Smoke: azienda test `AAA-NN` (id 8) eliminata OK in produzione.

**Esperienza 28/05/2026 — export Word Verbale custom (chiusura sessione)**

- **Template giusto**: checklist custom → `VerbaleVisita-generic.docx`, **non** i template ISO 9001/14001; ramo `isCustomChecklist` + fallback `TEMPLATE_MAP.custom_checklist`.
- **Allegati custom**: l’upload salva `custom_item_id` su `attachments` ma spesso **non** popola `evidence_blocks.attachment_id`; l’export deve leggere anche `attachmentsForCustomItem` (non solo i blocchi).
- **Foto in Word**: normalizzare **EXIF orientation** (5–8) prima dell’embed OOXML (`embeddedImageEmuFromBase64`); altrimenti foto sempre landscape.
- **Mojibake**: `Â°` ≠ `à` — sequenza UTF-8/Latin-1 distinta; usare `fixWordXmlMojibake` su template e post-render (`fix-audit-template-mojibake.cjs`).
- **Sommario / titoli sezione 3**: capitoli **3 / 3.1 / 3.2** in stile **Titolo 1** come 1–2 (non Titolo2); numerazione verbale **3.x** vs audit ISO **11.x**; dopo patch template aggiornare sommario in Word (**F9**).
- **Upload template**: copiare `.docx` in `public/templates/` **non** basta — registrare con **POST** `/api/v1/report-templates` e assegnazione checklist/org. **Da UI (29/05/2026)**: **Gestione → Template report** — banner upload + griglia `SgqDataGrid` (Scarica / Duplica da sistema con modal nome / Elimina solo studio); dropdown «Scarica modello di sistema» (`/templates/...`). Upload **senza** obbligo `standard_key` ISO — adatto a 5S, sopralluogo, verbali generici; assegnazione ISO sotto griglia, checklist custom in **Checklist personalizzate** (`GET /report-templates?scope=audit` condiviso). Warning soft se mancano `CHECKLIST_MARKER` / `RILIEVI_MARKER`. API: `POST /report-templates/:id/duplicate` `{ name }`, `DELETE /report-templates/:id`, `GET /report-template-assignments/standards`.
- **Intestazione verbale**: modifiche grafiche (logo, layout) vanno fatte su `VerbaleVisita-generic.docx` in repo + deploy Netlify; runtime OOXML non sostituisce l’header se già nel template patchato.

Script aggiuntivo: `patch-verbale-visita-headings.cjs` (allinea Titolo 1 offline; mirror runtime `normalizeVerbaleVisitaSectionHeadings`).

**Registrazione template custom (menu a tendina)**: il dropdown in **Admin → Checklist personalizzate → editor** legge `GET /report-templates?scope=audit` (righe in tabella `report_templates`: template di sistema `organization_id` NULL + upload org). Copiare/rinominare un file sotto `app/public/templates/` **non** crea una voce nel menu. Per usare una copia del template ISO 9001: caricare il `.docx` via API/UI upload, poi **PUT** `/report-template-assignments/custom-checklist/:id` (o dropdown nell'editor). Il file deve contenere i marker `CHECKLIST_MARKER` e `RILIEVI_MARKER` (come il Verbale di sistema) oltre ai placeholder docxtemplater (`{auditDate}`, `{clientName}`, …).

**Script utili**: `fix-verbale-template-xml.js`, `verify-template-repair.js`. Marker: `CHECKLIST_MARKER`, `RILIEVI_MARKER`. Dettaglio placeholder: [ISTRUZIONI_PLACEHOLDER_TEMPLATE_WORD.md](ISTRUZIONI_PLACEHOLDER_TEMPLATE_WORD.md).

---

## C. Database e repro

- `development` in `database.json` = DB di lavoro (vedi [DATABASE.md](reference/DATABASE.md)). `test` = `localhost:1433` (spesso assente).  
- Lo script repro normalizza `NODE_ENV=test` → `development` prima del pool.  
- Comandi: vedi sezione **D** sotto.

---

## Smoke test remoti (DB di test via backend VPS)

> Obiettivo: poter eseguire verifiche del DB di test **da qualsiasi macchina** (GitHub Actions, Netlify CI, PC remoto) senza esporre SQL Server su internet. Il backend VPS funziona da proxy sicuro.

### Architettura

```
GitHub Actions / PC remoto
        │  HTTPS GET + X-Smoke-Token
        ▼
backend VPS :8443  →  GET /api/v1/smoke/testdb
        │  connessione isolata (pool separato)
        ▼
SQL Server test :11043  (DB 2026-06-18_SGQ_ISO9001)
```

- **Nessuna porta SQL Server esposta a internet** — tutto passa via HTTPS al backend.
- Il token `X-Smoke-Token` è l'unica autenticazione richiesta (nessun JWT utente).
- Il controller usa una `ConnectionPool` separata → non interferisce con il pool di produzione.

### File coinvolti

| File | Ruolo |
|------|-------|
| `backend/src/controllers/smoke.controller.js` | Logica smoke: tabelle, conteggi, guardia anti-prod |
| `backend/src/routes/smoke.routes.js` | Route `GET /api/v1/smoke/testdb` |
| `backend/src/server.js` | Monta `smokeRoutes` prima dei router autenticati |
| `backend/scripts/smoke-remote.js` | Client standalone: chiama l'endpoint e fa exit 0/1 |
| `.github/workflows/smoke-test.yml` | Job CI automatico su push/PR su `main` |

### Configurazione VPS (una tantum)

Aggiungere nel file `.env` del backend sul VPS (`/var/www/sgq-backend/.env`):

```bash
SMOKE_TOKEN=<valore-casuale-segreto>
```

Poi riavviare il servizio:

```bash
sudo systemctl restart sgq-backend.service
```

> Il valore di default `dev-smoke-token-change-in-prod` è accettato solo in sviluppo locale. In produzione il server logga un avviso se viene usato il default.

### Configurazione GitHub Secrets (una tantum)

In **Settings → Secrets and variables → Actions** del repository, aggiungere:

| Secret | Valore |
|--------|--------|
| `SMOKE_ENDPOINT` | `www.fr-busato.it:8443` |
| `SMOKE_TOKEN` | stesso valore impostato nel `.env` del VPS |

### Esecuzione manuale con curl

```bash
# Verifica rapida da terminale (Linux/macOS/WSL)
curl -sk -H "X-Smoke-Token: XXX" https://www.fr-busato.it:8443/api/v1/smoke/testdb | python3 -m json.tool

# Atteso se OK:
# { "ok": true, "db": "2026-06-18_SGQ_ISO9001", "checks": { ... }, "errors": [] }
```

### Esecuzione manuale dello script Node

```powershell
# Windows PowerShell (dal root del progetto)
$env:SMOKE_ENDPOINT = "www.fr-busato.it:8443"
$env:SMOKE_TOKEN    = "XXX"
node backend/scripts/smoke-remote.js
```

### Verifica che il workflow CI sia attivo

Il workflow `.github/workflows/smoke-test.yml` si attiva su:
- Push su `main` che toccano `backend/src/**` o `backend/scripts/smoke-remote.js`
- Pull Request verso `main` con le stesse path
- Esecuzione manuale (`workflow_dispatch`) da GitHub Actions UI

---

## D. Comandi di verifica rapida

### Delega Cursor desktop / web (senza aumentare il carico operativo)

- Brief condivisi in **`docs/agent-tasks/`** (es. `CASE_STUDY_01_USERS_ADMIN.md`). L’agente **web** restituisce lavoro via **branch + PR**; l’agente **desktop** analizza diff/CI. Nessun canale diretto tra sessioni AI.
- **Case study 01** (gestione utenti): chiusura tecnica in file case study + merge su `main` (mar 2026); deploy VPS con `deploy-controllers-to-vps.ps1` + fallback restart.
- **Approvazione umana** solo per eccezioni alle golden rules; task a basso rischio (doc, checklist, fix mirati + L1) in autonomia: vedi `.cursor/rules/sgq-operating-memory.mdc` (approvazione + chunking / piramide L1–L5 in questa guida).

```powershell
cd "...\app"
$env:NODE_ENV = "test"; npm run test:run
node scripts/verify-template-repair.js
npm run build
```

```powershell
cd "...\backend"
node scripts/repro-custom-export.mjs
```

---

## E. Flusso 2 — SAL / Sopralluoghi + Evidenze documentali + Import + RAG (retrieval)

Questa sezione consolida le decisioni operative per supportare **due flussi** coerenti nello stesso prodotto, senza perdere scalabilità/robustezza:

- **Flusso 1 — Audit di sistema**: checklist, esiti (C/NC/OSS/OM/NA/NV), pending issues, report Word.
- **Flusso 2 — SAL/Sopralluoghi**: avanzamento implementazione requisiti (es. ISO 9001/14001/45001) + evidenze documentali + stati (discusso/in corso/da validare/completato).

### Golden rules (da rispettare sempre)

- **Record vs Retrieval**: il **DB relazionale** rimane il *system of record* (entità, permessi, stati, collegamenti, metadati strutturati). Il **RAG** è solo un *layer di retrieval* (ricerca semantica / suggerimenti), **mai** l’unica fonte di verità.
- **AI asincrona e auditabile**: estrazioni/analisi AI devono essere job asincroni con `extractor_version`, `confidence`, log e possibilità di revisione umana (*da validare*).
- **Multi-tenant hard**: ogni entità e documento è isolato per `organization_id` (indici e vincoli).
- **Incremental delivery**: rilasci a *vertical slice* (valore end-to-end) con feature flag/dark launch per ridurre rischi.
- **Mobile first per audit**: su mobile priorità a compilazione sul campo; funzioni “pesanti” (import massivo, gestione documentale avanzata) restano desktop finché non sono stabilissime.

### SAL: legenda requisiti multi-standard (dal documento SAL cliente)

Nel file `Check List Audit/CLIENTE - SAL documentale iso 14001 - 9001 - 45001.docx` è presente una legenda colori che mappa l’applicabilità dei requisiti:

- **NERO**: requisito comune a tutti gli schemi (9001 + 14001 + 45001)
- **BLU**: requisito specifico ISO 9001
- **VERDE**: requisito specifico ISO 14001
- **ROSSO**: requisito specifico ISO 45001
- **VIOLA**: requisito specifico 14001 + 45001

In DB questo non deve restare “colore”: va modellato come `applicable_standards` o equivalente.

### Import massivo (CSV/Excel) — best practice

Use case tipico: import anagrafiche personale / elenco qualifiche / elenco WPS da file forniti dal cliente.

- **Workflow**: upload file → **dry-run** (anteprima mapping + validazione) → import asincrono → report (errori scaricabili).
- **Idempotenza**: evitare duplicati tramite chiavi naturali (`organization_id` + codice/email/matricola).
- **Chunking**: import a blocchi (es. 200 righe) con commit per blocco e report dettagliato.
- **Audit trail**: registrare chi ha importato, quando, e cosa è stato creato/aggiornato.

### Mobile vs Desktop (policy operativa)

- **Mobile (primario)**:
  - audit sul campo (checklist + note + foto)
  - consultazione rapida (elenchi + scadenze)
  - upload “leggero” (foto/camera) quando supportato e stabile
- **Desktop (primario)**:
  - import CSV/Excel massivo (mapping colonne + preview)
  - gestione documentale complessa (PDF multipagina, versioni, collegamenti WPS/WPQR/WPQ)
  - amministrazione (utenti/ruoli/standard/template)

Nota: “allegati da e-mail” è da trattare come step successivo (inbox server-side o share-sheet), non come integrazione diretta immediata con Gmail/Outlook.

### RAG: quando introdurlo e a cosa serve

Il RAG è **utile** quando iniziamo a gestire:
- normative esterne (testo lungo, multi-versione)
- procedure/istruzioni operative clienti
- evidenze (PDF/DOCX) che devono essere “trovabili” e collegabili ai requisiti

**Uso corretto del RAG**:
- ricerca semantica (trova dove si parla di un requisito)
- suggerimento link documento → requisito
- supporto all’estrazione guidata (es. “estrai campi WPQR/WPQR-like”)

**Uso scorretto** (vietato): decidere “conforme/non conforme” solo da output AI senza evidenza + validazione.

### Multi-agenti: come accelerare senza perdere coerenza

Strategia consigliata: task paralleli con output “mergeabile”, ma con un’unica guida di integrazione.

- **Agente A (normativa/requirements)**: estrarre clausole e requisiti in forma strutturata (codice, titolo, testo, applicabilità).
- **Agente B (DB/API)**: progettare schema tabelle + migrazioni + endpoint (senza UI).
- **Agente C (UI/UX)**: implementare schermate SAL + import wizard + dashboard scadenze.
- **Agente D (AI/RAG)**: pipeline ingestion/chunking/estrazione (job asincroni + audit trail).

Regola: ogni task produce un branch/PR e aggiorna **questa sezione** con “cosa è stato introdotto” e “definition of done”.

---

## F. Architettura Unificata della Piattaforma (sessione 05/04/2026)

### Contesto della decisione

Sessione dedicata all'analisi sistematica dell'intera architettura. Obiettivo: verificare la coerenza del flusso di sviluppo, identificare debolezze, e stabilire un'architettura unificata scalabile per tutti i sistemi normativi (ISO 9001, 14001, 45001, ISO 3834) e tutti i clienti (Camellini + Mason).

### Scoperta chiave: HLS — High Level Structure

ISO 9001, 14001 e 45001 condividono la stessa struttura normativa (sezioni 4–10). Questo non è una coincidenza: ISO ha definito l'HLS appositamente per integrare i sistemi di gestione. Conseguenza pratica: **lo stesso motore di checklist, rischi, obiettivi e azioni funziona per tutti e tre gli standard** senza duplicare codice.

ISO 3834 ha struttura diversa (specifica di processo, non di sistema) ma condivide le stesse entità: personale qualificato, documenti controllati, non conformità, azioni correttive.

### 4 scenari d'uso e 2 clienti attuali

| Scenario | Cliente | Norma | Output |
|---|---|---|---|
| S1 — Audit di sistema | Camellini | ISO 9001/14001/45001 | Report audit + checklist |
| S2 — Audit terza parte | Camellini/Mason | Norme committente | Report con ref. normative |
| S3 — SAL/Consulenza | Camellini | ISO 9001/14001/45001 | Tabella avanzamento requisiti |
| S4 — Rapporto di Prova | Mason | ISO 3834-2/3 | Report con prove e foto obbligatorie |

### Categorie documentali per sistema (da gestire nel Document Registry)

**ISO 9001 / 14001 / 45001 (struttura HLS comune):**
- Politica del sistema, campo di applicazione
- Aspetti/pericoli significativi (specifici per 14001 e 45001)
- Obblighi di conformità (requisiti legali)
- Rischi e opportunità (§6.1)
- Obiettivi e KPI (§6.2)
- Competenze personale (§7.2)
- Controllo documenti e registrazioni (§7.5) — conservazione minima 3-5 anni
- Pianificazione e controllo operativi (§8)
- Piano di emergenza (§8.2)
- Monitoraggio e misurazione (§9.1)
- Risultati audit interno (§9.2)
- Verbale riesame di direzione (§9.3)
- Non conformità e azioni correttive (§10.2)

### Modulo NC organizzativo — Fase 1 + Hardening + UX drawer (route `/nc`, 30/05/2026)

**Stato:** ✅ **completo** — in attesa feedback utenti reali (chiusura sessione 30/05/2026). Non aprire `SESSION_NOTES_*`.

**Manuale utente:** [how-to/MANUALE_UTENTE_NC.md](how-to/MANUALE_UTENTE_NC.md) — scenari operativi, FAQ, canvas Glass.

**Libreria UI:** [reference/LIBRERIA_UI_SGQ.md](reference/LIBRERIA_UI_SGQ.md) — consultare prima di nuovi blocchi UI nel modulo o refactor.

Registro cross-audit ISO §10.2 con workflow `open → in_progress → resolved → verified →` **approvazione RQ** `→ closed`.

| Area | Implementazione |
|------|-----------------|
| **Griglia** | `SgqDataGrid` theme `plain` — colonne nc_number, stato, severità, cliente, audit, scadenza, origine |
| **Dettaglio** | **Drawer laterale** (shell `.doc-detail` da Documenti) → `NcDetailPanel` sezioni ISO 10.2 + workflow `.status-btn` / `.nc-workflow-btn` + `ActionsList`; deep-link `/nc?select=` |
| **Campi testo** | `RichTextField` (dettatura, draft `nc:<id>`, storico versioni) — allineato audit |
| **Creazione manuale** | Pulsante «Nuova NC» → `NcCreateModal` → `POST /non-conformities` (`source_type: manual`) |
| **Tracciabilità** | Badge origine + link reclamo (`source_complaint_id`) + link audit; `PendingIssuesCascade` link `/nc?select=` |
| **Scadenze** | API `overdue=true`, `due_within_days=7`; stats `due_soon`; filtro UI «In scadenza (7 gg)» |
| **Gate verifica** | `verification_notes` obbligatorie per stati verified/closed (UI + API); migrazione **071** `verification_responsible` |
| **Email remind NC / trigger manuale** | Job `runNcDueAlertJob` in `alertScheduler.js` (cron **08:05**) + `POST /api/v1/notifications-config/run-nc-alerts` (admin, dry-run disponibile via `?dryRun=true`); UI in Impostazioni → Notifiche (sezione "Smoke test promemoria NC", pulsanti "Anteprima" e "Esegui ora"). Fix SQL 17/06/2026: rimossa colonna inesistente `nc.title` (sostituita con `nc.description`). Deploy PR #113 + fix `441e85f` su main. |

Test L1: `ncCreate.test.js`, `ncPushIso.regression.test.js`, `ncDetailPanel.test.js`, `nc.controller.test.js`.

#### Simulazione operativa Fase 1 — 30/05/2026 (TEST OK)

| Step | Ruolo | Esito |
|------|-------|-------|
| Health API + DB migrazione **071** | Ops | OK — colonna `verification_responsible` presente |
| Login produzione `systemgest.netlify.app` | A | OK — sessione `PS_Admin` |
| Griglia `/nc` — stats, filtri, link audit | B | OK — 3 NC visibili; filtri stato/severità/scadenze presenti |
| Selezione riga → dettaglio (`?select=`) | A | OK dopo fix `handleRowSelect(rowKey, row)` (commit `d80dafa`) |
| Workflow API open→closed + gate note verifica | A | OK — NC `1043`, responsabili e note tracciati |
| Creazione manuale modal «Nuova NC» | A | OK audit in dropdown dopo fix lista audit (commit `d80dafa`); FK sezione→standard: errore **400** esplicito se sezione HLS su audit non ISO 9001 |
| Deploy VPS backend | Ops | OK — `deploy-controllers-to-vps.ps1` + restart `sgq-backend` |

**Lezioni (delta):** (1) `SgqDataGrid.onRowSelect` passa `(rowKey, row)` — non il solo oggetto riga. (2) `NcCreateModal` con `status: active` lasciava dropdown audit vuoto (nessun audit `active` in org test). (3) Sezioni HLS `clause10` falliscono FK su audit ISO 14001/3834 — serve audit ISO 9001 o sezione compatibile col `standard_id`. (4) Test E2E griglia: righe `<tr>` non sempre in snapshot a11y — usare CDP click o deep-link `/nc?select=<id>`.

**URL app:** https://systemgest.netlify.app/nc | **API:** https://www.fr-busato.it:8443/api/v1


### Bonifica dati test NC (org Al.project) — 02/06/2026

Dati NC di simulazione auditor bonificati su **produzione** via API admin (admin@sgq.local): approccio **A** (riapertura RQ → campi → verified → POST approve-closure → closed). Nessuno script SQL.

| NC | Prima | Dopo |
|----|--------|------|
| **1042** | 
oot_cause vuoto; chiusura già con RQ | 
oot_cause compilata; approved_at invariato (30/05/2026) |
| **1043** | Chiusa senza approved_at / approved_by | RQ approvata 02/06/2026; note verifica bonifica; 
oot_cause allineata |
| **1037** | Chiusa senza note verifica, senza RQ; azione verified senza verification_note | Note NC + nota azione + RQ + chiusura coerente |

Verifica: GET /non-conformities/1042|1043|1037 su API produzione.
**Backlog P2 (solo su richiesta committente):** export PDF registro; agente AI CAPA; completamento catalogo LIBRERIA_UI (Fase B/C); smoke L3 email ricezione reale.

### NC Hardening — slice H1–H6 (30/05/2026, TEST OK)

| Slice | Implementazione |
|-------|-----------------|
| **H1 Push custom** | `pushAuditToNcRegister` legge anche `audit_custom_checklist_responses` (NC/OSS); idempotenza `(audit_id, source_custom_item_id)` migrazione **072**; summary `iso_findings` + `custom_findings` |
| **H2 Email NC** | Job `runNcDueAlertJob` cron 08:05 + trigger manuale `POST /notifications-config/run-nc-alerts`; VPS: `ALERT_ENABLED=true`, `NC_ALERT_ENABLED=true`, `SMTP_*` configurati |
| **H3 Approvazione RQ** | Colonne `approved_by`, `approved_at`; `POST /non-conformities/:id/approve-closure` (admin/superadmin); gate `closed` → `NC_APPROVAL_REQUIRED` |
| **H4 Sezioni modal** | `NcCreateModal` carica sezioni da `GET /checklist/sections?standard_id=` dell'audit selezionato |
| **H5 Export CSV** | Pulsante «Export CSV» in `/nc` — export client-side con filtri griglia correnti |
| **H6 Azioni cross-NC** | Tab «Azioni in scadenza» + `GET /non-conformities/actions/due?due_within_days=30&overdue=true` |

Test L1 aggiuntivi: `ncExport.test.js`, `ncWorkflowApproval.test.js`. Migrazione **072** eseguita su VPS (step-by-step `run-migration-072-vps.js`).

**Esperienza 13/06/2026 — Export Word scheda NC + Template report (commit `91f9d05`, TEST OK)**

| Area | Implementazione / lezione |
|------|---------------------------|
| **Export Word singola NC** | `ncWordExport.js` + template `app/public/templates/NC-scheda.docx`; pulsante **Scarica Word** nell'header fisso del drawer `/nc` (non in toolbar pagina — confondibile con Export CSV registro) |
| **Template admin tab NC** | `GET/PUT /report-template-assignments/nc`, `GET /report-templates?scope=nc`; migrazione **090** (`assignment_type`, seed «Scheda NC (default)») |
| **HTTP 404 pagina Template report** | Frontend deployato su Netlify **prima** del backend VPS: route `/report-template-assignments/nc` assente perché `reportTemplate.controller.js` / `reportTemplate.routes.js` **non erano nel `deploy-manifest.json`**. Fix: aggiunti al manifest + `deploy-controllers-to-vps.ps1` + migration 090 |
| **Caricamento pagina** | `Promise.all` su 5 API → un solo 404 blocca tutto; sostituito con `allSettled` (errore NC non blocca tab audit) |
| **Encoding JSX** | Testo `conformit\u00E0` tra tag JSX mostra `\u00E0` letterale — usare UTF-8 reale (`conformità`) o `{"\u00E0"}` in espressione JS |
| **Deploy pattern** | Dopo feature backend: verificare file in `backend/scripts/deploy-manifest.json`, non solo `git push` (Netlify ≠ VPS) |

Smoke 13/06/2026: health API OK; endpoint template 401 (route presenti); Netlify bundle `index-ClEknwz1.js` con `nc-detail-header-actions` + tab «Non conformità»; L1 `ncWordExport` / `reportTemplateUpload` / `ncPage.drawer` 23 test OK.

**Bug fix 13/06/2026 — commit-to-qualification HTTP 500 (Camellini segnala errore caricamento qualifica)**

| Area | Causa / Fix |
|------|-------------|
| **Sintomo** | `POST /import-jobs/:id/files/:fileId/commit-to-qualification` → 500; log VPS: `commitToQualification Validation failed for parameter 'personnel_id'. Invalid string.` |
| **Causa radice** | `commitToQualification` chiamava `resolvePersonnelForQualification` con chiavi **snake_case** (`person_name`, `company_id`, `organization_id`) invece dei **camelCase** attesi dalla funzione (`personName`, `companyId`, `organizationId`). Risultato: `personName=undefined` → funzione ritornava oggetto errore `{ ok: false, ... }` (truthy) → `personnel_id` veniva impostato all'oggetto → mssql: «Invalid string» |
| **Fix** | `importJobs.controller.js` riga 832: parametri rinominati in camelCase; risultato decomposto con `.ok` + `.personnelId` invece di usarlo come scalare |
| **Test** | Mock aggiornato a `{ ok: true, personnelId: 77, ... }` (forma corretta). 8/8 test passano. |
| **Deploy** | SCP controller + `systemctl restart sgq-backend` (PID 659715, uptime OK) |
| **Lezione** | Quando un service restituisce `{ ok, ... }` va sempre decomposto; mai usare `result \|\| null` se `result` può essere un oggetto truthy con errore. Verificare che i nomi dei parametri passati a una funzione corrispondano esattamente alla sua firma. |

**Escluso (backlog):** agente AI CAPA, export PDF registro NC.

**ISO 3834 (specifiche processo saldatura):**
- Qualifiche saldatori (ISO 9606-1..5) — scadenza 2/3 anni
- Qualifiche operatori (ISO 14732)
- Qualifica coordinatore saldatura (ISO 14731) — Mason stesso
- Certificazioni NDT personale (ISO 9712: VT/MT/PT/UT/RT) — scadenza 5 anni
- WPS — Welding Procedure Specifications (ISO 15609-1..6)
- WPQR — Qualification Records (ISO 15614-1..14)
- Elenco attrezzature essenziali (§9.2)
- Piani manutenzione attrezzature
- Taratura strumenti (ISO 17662) — scadenza annuale
- Certificati materiali base e materiali d'apporto
- Registrazioni per commessa (riesame requisiti, riesame tecnico, piano saldatura)
- Rapporti ispezione (VT/MT/UT/RT) per commessa
- Registrazioni PWHT se applicabili
- Rapporti non conformità e riparazioni

### Navigazione Document Registry — struttura cartelle virtuale

```
📁 [AZIENDA]
├── 📁 Documenti Sistema (ISO 9001/14001/45001)
│   ├── 📁 Politiche e Procedure
│   ├── 📁 Rischi e Opportunità
│   ├── 📁 Obiettivi
│   ├── 📁 Audit Interni
│   └── 📁 Riesami di Direzione
├── 📁 Personale e Qualifiche (con alert scadenza)
│   ├── 📁 Qualifiche Saldatori (ISO 9606)
│   ├── 📁 Qualifiche NDT (ISO 9712)
│   └── 📁 Coordinatore Saldatura (ISO 14731)
├── 📁 Procedure di Saldatura
│   ├── 📁 WPS
│   └── 📁 WPQR
├── 📁 Attrezzature
│   ├── 📁 Elenco e Manutenzione
│   └── 📁 Tarature (con alert scadenza annuale)
└── 📁 Commesse ISO 3834
    └── 📁 [CODICE COMMESSA]
        ├── Riesame Requisiti
        ├── Piano Saldatura
        ├── Rapporti Ispezione
        └── NC e Riparazioni
```

### Alert Engine — scadenze da monitorare automaticamente

| Tipo | Trigger | Preavviso |
|---|---|---|
| Patentino saldatore | `expiry_date` | 60/30/7 giorni 🔴 critico |
| Certificazione NDT | `expiry_date` (5 anni) | 90/30 giorni 🔴 critico |
| Taratura strumento | `expiry_date` (annuale) | 30 giorni 🟡 |
| Documento in scadenza | `expiry_date` | 60/30 giorni 🟡 |
| NC aperta | `due_date` superata | immediato 🔴 |
| Requisito SAL in ritardo | `due_date` < oggi | 7 giorni 🟡 |
| Abbonamento standard | `valid_to` | 30 giorni 🟡 |

#### Alert Engine — configurazione SMTP sul VPS

Il cron job (`alertScheduler.js`) si avvia automaticamente all'avvio del backend (ogni giorno alle 08:00).
È disabilitato (con log warning) se `node-schedule` o `nodemailer` non sono installati.
Le rotte `/alerts` e `/alerts/count` richiedono licenza modulo `documents`.

**Installazione dipendenze sul VPS** (se non già fatto):
```bash
cd /opt/sgq-backend && npm install node-schedule nodemailer
systemctl restart sgq-backend
```

**Variabili `.env` da configurare manualmente sul VPS** (non committare nel repo):

| Variabile | Esempio | Note |
|-----------|---------|------|
| `ALERT_ENABLED` | `true` | Abilita invio email |
| `SMTP_HOST` | `smtp.gmail.com` | Host server SMTP |
| `SMTP_PORT` | `587` | Porta SMTP (587 = TLS) |
| `SMTP_USER` | `alerts@qsstudio.it` | Account mittente |
| `SMTP_PASS` | `<app-password>` | App-password Gmail o token SMTP |
| `SMTP_FROM` | `SGQ Studio <alerts@qsstudio.it>` | Nome visualizzato |

**Test rapido**: `GET /alerts` con utente autenticato con licenza `documents` → deve restituire lista scadenze entro 60 giorni.

**Soglie attive**: 30 giorni (prima soglia) e 7 giorni (seconda soglia) — configurabili in `alertScheduler.js` (`ALERT_DAYS_1`, `ALERT_DAYS_2`).

### Pipeline AI import documenti

Ogni documento normativo ha struttura definita dalla norma → estrazione deterministica possibile:

```
Upload PDF (batch) → rilevamento tipo → estrazione testo (pdf-parse / OCR Tesseract)
  → LLM structured extraction (schema Zod per tipo) → preview con confidence score
  → validazione utente (campi incerti evidenziati) → commit DB
  → record in stato 'ai_draft' → diventa 'active' solo dopo conferma umana
```

**Regola golden**: solo record con `import_status = 'active'` o `'verified'` appaiono negli elenchi ufficiali e nelle esportazioni per enti certificatori.

**Commit norme da Import batch (Fase 2, 29/05/2026)**: allineare sempre `document_registry.type_specific_data` allo schema canonico norma (`standard_code`, `issuing_body`, `edition_year`, `validity_status`, `validity_check_url`, …). Il form di commit per tipo `norma` non usa i campi generici revisione/responsabile/scadenza; il lookup catalogo è lo stesso di **Carica norme** / `DocumentForm`.

**Import da lista codici — Fase 3 (29/05/2026)**: per popolare il registro norme **senza PDF** (allegato opzionale in seguito). Flusso: operatore incolla codici (`UNI EN ISO 12944-6:2001`, `D.Lgs. 81/2008`, …) → backend `normCodesImport.service` → `lookupNormStatus` (Normattiva / EUR-Lex / UNI / ISO / BSI) → INSERT bozza in cartella `folder_code=2.3` con `serializeNormTypeSpecificData`. **Duplicati**: query su `JSON_VALUE(type_specific_data, '$.standard_code')` case-insensitive per `organization_id`. **Job vigore**: record compatibili (stesso schema R1–R3); nessuna riga in `norm_document_sources` finché non si carica un PDF. UI: pulsante **Importa da catalogo (codici)** accanto a **Carica norme (batch)** in vista Albero. Limite: 50 codici per richiesta. Smoke L3: Registro → NORME E LEGGI → incollare 2 codici → verificare riepilogo creati/duplicati → riaprire scheda e badge vigore.

### DataGrid universale — requisiti del componente

Il componente `<DataGrid />` deve essere riutilizzabile per tutti i moduli:
- Colonne configurabili (testo, data, badge colorato, semaforo scadenza, link)
- Ordinamento e filtri per colonna
- Paginazione server-side (per grandi dataset)
- Export Excel (libreria: `xlsx` / SheetJS — già compatibile browser)
- Selezione multipla + azioni batch
- Slot per azioni riga (modifica, elimina, download PDF originale)

---

## E. Punto di ripresa / idee

### Sospensione lavori — 14 aprile 2026 (fine sessione)

**Consegnato su `main` (commit precedenti nella giornata):** test contratto `response-options` sotto `app/src/tests/integration/` (mock per CI); `docs/open_points.md` come puntatore a roadmap/guida; nota L1 in piramide test.

**Documentazione (questa sessione):** sezione **Workspace consigliato — ponte `C:\ProgettoISO`** (symlink/junction verso Google Drive) per allineare Cursor, terminale e prossime sessioni.

**Ripresa suggerita:** `git pull` **nel repository locale**; leggere header [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md); smoke roadmap (0)–(3) se deploy recente; poi traccia **licenze/auth (sessioni A–E)** e **RBAC** come da checklist roadmap. Todo interne: D1 smoke, D2–D5 licenze, D6 RBAC, delega web (brief `docs/agent-tasks/`).

### Chiusura sessione 19 aprile 2026 — RBAC lista audit (studio / tenant)

- **Problema:** utente auditor (es. perimetro Mason) vedeva nel menu **tutti** gli audit del tenant se il ruolo nel JWT/DB non combaciava esattamente con le stringhe attese (`auditor` / `viewer`) oppure in casi limite: il predicato studio veniva omesso e restava solo il filtro `organization_id`.
- **Backend (fonte di verità API):** `backend/src/services/auditListRbac.service.js` — `studioScopeClause` / `normalizeRole`, fallback minimo privilegi su `created_by`; `backend/src/middleware/auth.middleware.js` — `role` su `req.user` in minuscolo dal JWT; `backend/src/controllers/audit.controller.js` — `organization_id` da `req.user` in `listAudits` / `getAuditById` + uso di `studioScopeClause`. Test: `backend/src/services/auditListRbac.service.test.js` (`cd backend` → `npx jest --no-coverage`, oppure `npm test` con coverage).
- **Frontend:** remount controllato del `<select>` audit / aziende in `AuditSelector.jsx` (già su `main` in commit dedicato) per coerenza UI dopo cambio elenco.
- **Deploy:** il comportamento in **produzione** dipende dall’**API sulla VPS** (Netlify aggiorna solo la PWA). Sul server **non** basta `git pull` se la cartella è solo copia file: eseguire `backend/scripts/deploy-controllers-to-vps.ps1` (include controller, `auditListRbac.service.js`, **`auth.middleware.js`**) + restart; poi smoke riga tabella **RBAC / studio** in questa guida (due utenti, `auditor_org` diversi).

### Chiusura sessione 28 marzo 2026

- **Lista audit all’avvio (tutte le piattaforme):** il primo download dopo l’avvio non usa più `GET /audits` senza paginazione (limite backend 50). Usa la stessa funzione della riconciliazione (`fetchAllServerAudits`, pagine da 200) **solo se** online e presente JWT (`apiService.getToken()`), così il DB/server è la fonte completa del menu audit anche senza attendere login o i 45s di intervallo.

### Chiusura sessione 31 maggio 2026 — menu audit server-first aggressivo

- **Sintomo:** su mobile (e in generale) compaiono audit nel menu che, in eliminazione, danno `DELETE` 404 («già eliminato») — fantasma in IndexedDB non allineati al server.
- **Policy (committente):** server-first **aggressivo** — purge automatica della cache locale (equivalente operativo a «Svuota cache»), senza pulsante manuale.
- **Frontend (`StorageContext.jsx`):** dopo ogni reconcile/load con GET /audits OK: `purgeStaleAuditsFromDevice` + `persistFinalAuditsToIndexedDB` (clear store + rewrite). Lista server **vuota** ma fetch OK → solo bozze `metadata.isIntentionalDraft === true`. Rimosso il ripristino dell’audit corrente da cache locale (Bug 5 Fix B). Al **login**: `processQueue` → `clearAuditsStore` → reconcile. Se download fallisce da online: **non** mostrare tutta la cache; solo bozze intenzionali + retry reconcile. **Mobile:** `visibilitychange` / `pageshow` (PR #74) invariati.
- **Verifica:** hard refresh PWA → logout/login; console log `🧹 [RECONCILE] Server lista vuota` o `Rimozione N audit stale`. Test L1: `storageContext.dedup.test.js`.

### Chiusura sessione 27 marzo 2026

**Fatto in codice:**
- **`[LOGO]` in export Word:** prima dell’invio del DOCX, se l’audit ha `metadata.companyId` e il logo è fetchabile da `GET /companies/:id/logo` (JWT), JPEG/PNG/GIF vengono embedded in `document.xml` / `header*.xml` / `footer*.xml` che contengono il testo `[LOGO]` (rel + `word/media/company_logo_export.*`). `ExportPanel.prepareAuditForExport` imposta `embedCompanyLogo.dataUrl`; `wordExport.injectCompanyLogoInZip` esegue la sostituzione.
- **Tabella `RILIEVI_MARKER`:** corretto `gridSpan` riga separatore standard (7 colonne dopo NV). Test automatici: `app/src/tests/wordExport.riepilogo.test.js` (NV vs N.A., riga AP).

**Verifica manuale consigliata:** export su audit reale con logo JPG/PNG e con voci NV + N.A.; smoke browser **pending issues** + riga **AP** su produzione.

### Sospensione lavori — 27 marzo 2026 (fine sessione)

**Consegnato su `main` (commit recenti): export Word — verificatore, mojibake, template**

| Problema | Fix operativo |
|----------|----------------|
| Campo **VERIFICATORE** nel DOCX = «Non specificato» pur essendo l’utente loggato | Backend invia spesso quel testo come `auditorName`; `ExportPanel.prepareAuditForExport` tratta come «mancante» anche `Non specificato` / `n/d` / `n.d.` / `nd` e applica fallback `user.full_name` se valorizzato. |
| Titoli tipo **«1 â€¦ DATI GENERALI»** (sequenza â+€+“) anche nel sommario Word | `fixWordXmlMojibake` in `wordExport.js` con ponte XML tra `<w:t>` spezzati (TOC / `proofErr`); preprocess su `footnotes`/`endnotes`; fix dopo `injectOoxmlMarkers` e passaggio finale sullo zip prima del blob. Template `ISO9001-audit-report.docx` ripulito in repo. |
| Stesso difatto su altri `.docx` | `VerbaleVisita-generic.docx` corretto; `ISO45001-audit-report.docx` aggiunto (copia da ISO 9001, stessi placeholder) perché `TEMPLATE_MAP` lo richiedeva. Script: `app/scripts/fix-audit-template-mojibake.cjs` (tutti i template in `public/templates`), `app/scripts/scan-template-mojibake.cjs` (diagnostica). |
| Export vs sync server | La sync mantiene i dati su DB; i pulsanti Export (Word, file system, backup/import JSON) producono **artefatti** (documento per terzi, cartella locale, copia file di sicurezza) — vedi dialoghi in sessione. |

**Ripresa suggerita:** dopo deploy Netlify, smoke manuale export Word (verificatore + titoli senza caratteri corrotti) su audit reale; opzionale personalizzare template ISO 45001 in Word. Poi smoke logo / NV / pending issues come da roadmap.

### Chiusura sessione 21 marzo 2026 (sera)

**Stato:** interruzione richiesta dall’utente; nessun commit aggiuntivo in questa micro-sessione.

**Già in codice (da verificare in prossima sessione):**
- Riepilogo audit UI + tabella `RILIEVI_MARKER` in Word: conteggio **NV** separato da **N.A.** (branch di lavoro precedente già su `main` se mergiato).

**Ripresa operativa (ordine suggerito):**
1. **Test funzionale Word:** su un audit di prova, impostare almeno una voce **NV** e una **N.A.**, esportare il DOCX e confermare colonne distinte in `RILIEVI_MARKER`.
2. **Logo report:** in anagrafica aziende il campo logo è valorizzato ma in export il placeholder **`[LOGO]`** in intestazione non mostra l’immagine — diagnosticare in `wordExport.js` / `wordExportHelpers.js` / `ExportPanel` (URL logo vs blob, header OOXML, sostituzione marker).
3. Poi smoke **pending issues** + roadmap (0.2 ISO 14001 / `DATABASE_SCHEMA` `norm_excerpt`) come già indicato sotto.

### Sessione 21 aprile 2026 — Fix Word export ISO 3834 + toggle foto

**Obiettivo**: correggere i 6 problemi segnalati da Mason sul report Word audit 2026-04 (MANITOU) e aggiungere scelta esplicita modalità foto.

**Diagnosi da documento reale (`Audit_2026_04_MANITOU_ITALIA_SRL_ISO38342.docx`):**
- `PR04.04` in intestazione → valore di `{procedureCode}` salvato da Mason nell'audit (corretto, non bug).
- `N/D` in intestazione → `{auditDate}` mancante (dato non inserito nell'audit pre-fix).
- `INDIRIZZO: Sistema di Gestione per la Qualità` → `{scope}` riceveva fallback letterale del testo italiano; fix: default cambiato in `'—'`.
- `ISPETTORE: Tutti i processi aziendali` → template ISO3834 usava `{processes}` nella cella ISPETTORE; fix: nuovo placeholder `{ispettore}`.
- Foto come testo → documento generato con codice precedente al fix photo-embedding; con codice corrente vengono incorporate.
- Disegni/specifiche vuoti → campo non compilato nell'UI (non bug).

**Fix 4 — `app/src/utils/wordExport.js`:**
- Aggiunto campo `fornitoreIndirizzo: fornitoreAddressRaw || '—'` (valore diretto indirizzo fornitore, disponibile anche per audit non `second_party`).
- Aggiunto campo `ispettore: primaryAuditor` (alias diretto del nome ispettore).
- Eliminato fallback `'Sistema di Gestione per la Qualità'` per `scope`; ora sempre `gd.scope || '—'`.
- `fornitoreAddressRaw` ora legge `meta.fornitoreAddress || meta.exportCompanyAddress` anche per audit first-party.
- Aggiunti `fornitoreIndirizzo` e `ispettore` alla lista `SIMPLE_DOCXTEMPLATE_VAR_NAMES` (ricomposizione run spezzati).

**Fix 6 — `app/public/templates/ISO3834-audit-report.docx`:**
- `INDIRIZZO: {scope}` → `INDIRIZZO: {fornitoreIndirizzo}` (1 sostituzione in `<w:t>`).
- `ISPETTORE: {processes}` → `ISPETTORE: {ispettore}` (testo `processes` nel run XML spezzato sostituito con `ispettore`).
- Verifica: la sezione fornitore nel template ora mostra correttamente tutti i nuovi placeholder.

**Toggle foto — `app/src/components/ExportPanel.jsx` + `ExportPanel.css`:**
- Aggiunto stato `embedPhotos` (null = auto-detect, true = forza embed, false = forza link).
- Helper `resolvePhotoMode(standardKey, customChecklistId)` centralizza la logica: rispetta scelta utente, altrimenti auto (ISO 3834 / checklist custom → embed).
- Helper `auditHasPhotoStandard()` calcola valore di default del checkbox dal tipo di audit corrente.
- Checkbox "Incorpora foto nel documento (auto)" con pulsante "ripristina auto" se manualmente modificato.
- Testo informativo dinamico che avverte l'utente sull'impatto dimensionale.
- Messaggi di avanzamento più chiari: "⏳ Caricamento immagini in corso..." durante preload foto.

**Test:**
- Aggiunto test `ISO3834 template: fornitoreIndirizzo e ispettore sostituiti correttamente` in `wordExport.placeholders.test.js`.
- Suite L1: **48/48 PASS** (8 file, durata ~106 s).

**Note deployment:**
- Il template `ISO3834-audit-report.docx` è servito dal frontend (Netlify, path `/templates/`) — viene aggiornato con il prossimo push `main`.
- Mason non ha template custom assegnati nel DB (org 1003, `report_template_assignments` vuota) → usa il template di sistema.
- Nessuna modifica backend necessaria per questi fix.

---

### Sessione 21 aprile 2026 — Robustezza e qualità del codice

**Obiettivo**: ridurre superficie d'attacco, eliminare dead code, aumentare copertura test.

**1. Strip log in produzione — Vite (frontend)**
- `vite.config.mjs` convertito a forma funzione (`defineConfig(({ mode }) => {…})`).
- In build `production`: `esbuild.drop: ['debugger']` (rimozione statement debugger) + `define` no-op per `console.log/debug/info`; `console.warn` e `console.error` preservati.
- `build.sourcemap: false` — nessuna source map espostain produzione (riduce leakage codice sorgente).
- Aggiunto `app/src/utils/clientLogger.js` — wrapper logger che è no-op in produzione; da usare in nuovi moduli al posto di `console.log` diretto.

**2. Helmet Content Security Policy — backend**
- `backend/src/server.js`: CSP abilitata con policy restrittiva (`defaultSrc: 'none'`, `imgSrc: self/data/blob`, `frameAncestors: none`, etc.).
- Aggiunto `hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }`.

**3. Dead code rimosso**
- Eliminati 3 file non referenziati da nessun import:
  - `app/src/contexts/DataContext.jsx` (~263 righe — context localStorage pre-StorageContext)
  - `app/src/components/NonConformitaForm.jsx` (~200 righe — form NC legacy)
  - `app/src/utils/wordExport.backup.js` (~787 righe — backup obsoleto export Word)
- Totale: ~−41 kB di codice morto.

**4. Error handler backend standardizzato**
- `backend/src/server.js`: tutti gli errori restituiscono `{ code, message }` con codici machine-readable coerenti (`NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, etc.).
- Log `logger.error` per errori 5xx, `logger.warn` per 4xx.

**5. Test frontend aggiunti**
- `app/src/tests/storageContext.dedup.test.js` — **13 test** per `dedupeAudits` e `filterLocalAuditsAfterServerFetch` (coprono bug storici: stessa UUID non duplica, versione ricca vince, cross-tenant rimosso dopo server fetch).
- `app/src/tests/syncService.stall.test.js` — **5 test** per `updateRetryCount` (stall capping a 5, evento `sgq:syncQueueStalled`) e `clearQueueForServerAudits` (rimuove solo UUID con server ID, mantiene bozze).
- Totale: **+18 test** frontend; tutti PASS.

**Deploy da eseguire:**
- Backend (server.js con CSP + error handler): `.\backend\scripts\deploy-controllers-to-vps.ps1` + copia manuale `src/server.js` al VPS.
- Frontend: push `main` → Netlify build automatica (vite.config.mjs + clientLogger).

**Pendente immutato:**
- Approvazione SQL `fix_visibility_audit_2026_04_to_mason_safe.sql` (audit `2026-04` → tenant Mason).
- Smoke manuale: login Mason UI → dropdown → Export Word `2026-02`.

---

### Chiusura sessione 22 aprile 2026

**P1 — Custom checklist outcome buttons (deputy + lead agent, commit `125131d` + merge `e1f3c5b`):**
- **Funzionalità**: pulsanti esito C / OSS / NC / OM / NV / NA per checklist personalizzate con flag `has_outcome_buttons`.
- **DB produzione (migrazione 043)**: `custom_checklists.has_outcome_buttons BIT DEFAULT 0` + `audit_custom_checklist_responses.status NVARCHAR(10) NULL` — applicata e verificata.
- **Backend VPS**: `customChecklist.controller.js`, `customChecklist.service.js` aggiornati, deploy riuscito (lead agent 22/04/2026), servizio `active (running)` alle 18:56 UTC, health `/api/v1/health` HTTP 200.
- **Frontend**: `CustomChecklistAuditView.jsx` (pulsanti esito condizionali, CSS colori semantici), `CustomChecklistsPage.jsx` (toggle "Abilita valutazione"), `wordExport.js` + `wordExportHelpers.js` (badge [STATUS] + tabella riepilogo NC/OSS/OM nel Word).
- **Test (deputy)**: 48/48 Vitest PASS; dev build OK; prod build fallisce per esbuild/node mismatch locale pre-esistente (non causato da queste modifiche; Netlify non impattato).
- **Pendente (solo smoke manuale utente)**: L3 — creare checklist con flag, aprire in audit, cliccare pulsanti, verificare salvataggio + riepilogo Word export.

**Bug fix — audit cancellato ricompare nel menu (commit `748e754`):**
- `StorageContext.jsx`: `deleteAudit` ora chiama `fsProvider.deleteAudit(auditId)` (rimozione da IndexedDB) e registra in `recentlyDeletedRef` per bloccare il restore di Bug-5-Fix-B in `reconcileAuditsFromServer`.
- Smoke DB: `LOCK-SMOKE-1774111224043` cancellato e verificato assente su SQL Server produzione.
- `storageContext.dedup.test.js`: 2 nuovi test per documentare il comportamento corretto.

**P2 — Sicurezza credenziali (commit `a579958`):**
- `server.js`: fail-fast JWT_SECRET + CORS_ORIGIN in produzione.
- `auth.controller.js`: JWT_SECRET fallback sicuro, gestione login email ambigua (400 `requires_organization_id`), register policy `superadmin_only` in produzione.
- 3 nuovi test Jest in `auth-rbac.test.js`.

**Prossima sessione — cosa fare (ordine):**
1. Leggere `PROJECT_ROADMAP.md` + questa sezione.
2. **Smoke L3 P1** (se non già fatto dall'utente): login Camellini → crea checklist con flag "Abilita valutazione" → audit → pulsanti → Word export.
3. **P4 Sprint 0 Navigation Foundation**: React Router v6, sidebar, dashboard (vedi roadmap).
4. Pulizia branch remoto `cursor/custom-checklist-outcome-buttons-bb01` (già mergiato).
5. Pulizia script temporanei in `backend/scripts/` (diagnose-*, smoke-*, fix-mason-*, check-audit-*).

---

### Chiusura sessione 24 aprile 2026 (sera)

**Hardening sync queue e console noise (commit corrente + deploy Netlify):**

Problema residuo della sessione precedente: al login/logout/refresh, la console mostrava decine di warning `AUDIT_LOCK_REQUIRED` e `Conflict server-wins` in loop. Causa: tre meccanismi interagenti.

- **Loop `auditsToUploadRichData`**: la migrazione dati ricchi (generalData, auditObjective, auditOutcome) ri-accodava `update_audit` ad ogni load perché il list endpoint `/audits` non restituisce quei campi → condizione sempre vera. Fix: `richDataMigrationDoneRef` (Set per sessione) impedisce ri-accodamento dello stesso UUID (`StorageContext.jsx`).
- **409 conflict senza serverData**: quando il server rispondeva 409 ma `serverData.audit_id` era assente, il fallback `resolveConflict()` poteva fallire. Fix: accetta server-wins silenziosamente e salva timestamp corrente (`syncService.js`).
- **Item pre-fix senza flag `isStalled`**: item nella coda creati prima del deploy con `lastError` contenente `AUDIT_LOCK_REQUIRED` non avevano il flag `isStalled`. Fix: `processQueue` ora controlla anche `lastError` via regex e marca retroattivamente (`syncService.js`).
- **Log ridotti**: `console.warn` → `console.debug` per i conflict server-wins (non sono errori).

File modificati: `app/src/contexts/StorageContext.jsx`, `app/src/services/syncService.js`.

**Aggiornamento 26 aprile 2026 — coda dopo eliminazione audit e 404 `responses/bulk`:**

- Dopo **Elimina audit** dalla UI, la sync queue non veniva svuotata per `save_responses` perché il payload usa `auditId` (UUID) e non `audit_uuid`: restavano `POST .../responses/bulk` → **404** e item in **stallo** con spam in console. Fix: `deleteAudit` chiama `clearQueueForStaleAudits` con l’UUID; `clearQueueForStaleAudits` considera anche `payload.auditId` stringa; su **404 `AUDIT_NOT_FOUND`** gli item `save_responses` / `update_audit` / upload collegati all’audit assente vengono **rimossi** dalla coda (non stallati). Service worker: fallback cache su `fetch` fallito per evitare rejection non gestita.

---

### Chiusura sessione 26 aprile 2026

**Problema principale risolto — 409 ciclici `POST /audits/sync` durante la compilazione:**

Radice del problema in 2 strati:

1. **Timestamp calcolato all'enqueue, non all'invio.** Quando più item `update_audit` venivano accodati in rapida successione, item #2 aveva nel payload un `updated_at` calcolato prima che item #1 ricevesse la risposta 409 e aggiornasse `sgq_srv_ts_<uuid>` in localStorage. Risultato: item #2 usava ancora il vecchio timestamp → altro 409 → loop.
   - **Fix**: in `syncUpsertAudit` (`syncService.js`), `updated_at` viene **ricalcolato al momento dell'invio** con `Math.max(Date.now(), sgq_srv_ts + 1)`, sovrascrivendo il valore nel payload accumulato in IndexedDB.

2. **Migrazione dati ricchi senza timestamp server.** La migrazione `generalData/auditObjective/auditOutcome` usava `new Date().toISOString()` invece di leggere `sgq_srv_ts`. Se il clock del SQL Server era anche solo pochi ms avanti rispetto al browser (o se il timestamp era già stato aggiornato da una sync precedente), il server restituiva 409 ad ogni apertura audit.
   - **Fix A** (`StorageContext.jsx`): al download `fetchAllServerAudits`, si fa il **seeding di `sgq_srv_ts_<uuid>`** per ogni audit → la migrazione trova già il valore corretto.
   - **Fix B** (`StorageContext.jsx`): la migrazione usa anch'essa `Math.max(Date.now(), serverTs + 1)`.

**Problema risolto — `DELETE /lock 401` al logout:**

Il flusso di logout in `AuthContext.jsx` chiamava `apiService.logout()` (che esegue `clearToken()`) e solo dopo sparava `sgq:userLoggedOut`. In `onUserLoggedOut` (StorageContext), la `releaseAuditLock` trovava già il token nullo → 401 → il gestore 401 di apiService sparava un nuovo `auth:logout` → doppio ciclo di pulizia e doppio log `[LOGOUT] Cache azzerate`.
- **Fix** (`AuthContext.jsx`): `window.dispatchEvent("sgq:userLoggedOut")` spostato **prima** di `apiService.logout()` → `onUserLoggedOut` fa la `releaseAuditLock` fire-and-forget con token ancora valido, poi `clearToken()` viene chiamato.

**File modificati in questa sessione:**

| File | Modifica |
|---|---|
| `app/src/contexts/StorageContext.jsx` | Seeding `sgq_srv_ts` al download server; migrazione usa `Math.max` |
| `app/src/services/syncService.js` | `updated_at` ricalcolato al momento dell'invio in `syncUpsertAudit` |
| `app/src/contexts/AuthContext.jsx` | `sgq:userLoggedOut` prima di `clearToken()` al logout |

**Stato console post-fix (bundle `index-BhKOBwrK`):**

| Messaggio | Stato |
|---|---|
| `POST /audits/sync 409` | ✅ Eliminato |
| `DELETE /lock 401` al logout | ✅ Eliminato |
| `⏸️ enqueue write sospeso: lock non owner none` | ⬜ Normale — mouseup precede acquisizione lock di ~100ms; nessuna perdita dati |
| `⚠️ Domanda qclauseX validazione` | ⬜ Non bloccante — validazione evidenza mancante; logica corretta |

**All'inizio della prossima sessione:**

1. **Smoke test allegati**: upload PDF, upload foto → verifica link cliccabile nel Word export, verifica foto incorporata.
2. ~~Valutare Sprint 10~~ → **✅ Sprint 10 implementato** (03/05/2026) — commit `939af59`, migration 048.
3. `DEPUTYTASK.md` attivo: fix CORS `.env` VPS (richiede accesso SSH — non bloccante perché l'app usa già `systemgest.netlify.app` configurato).

---

### Chiusura sessione 24 aprile 2026

**Bug critico risolto — Audit cancellati che ricompaiono nel menu (commit `b3961f5`):**

Radice del problema: bozze locali (IndexedDB) senza marcatore "intenzionale" venivano preservate dal ciclo `reconcileAuditsFromServer` ogni 45 secondi, causando la ricomparsa infinita dei LOCK-* audit e differenze di contenuto tra device diversi.

- **`auditDataModel.js`**: `createNewAudit` aggiunge `isIntentionalDraft: true` a ogni nuova bozza creata dall'utente.
- **`StorageContext.jsx`**: `filterLocalAuditsAfterServerFetch` ora scarta bozze solo-locali senza `isIntentionalDraft` (= residui di sessioni vecchie / audit di test); nuova funzione `forceClearLocalCache` per reset manuale.
- **`SyncStatusIndicator.jsx`**: pulsante rosso "🧹 Pulisci cache" per svuotare IndexedDB e riscaricare dal server — disponibile su qualsiasi device.
- **Test**: 54/54 pass (suite completa). Tutti i LOCK-* audit spariscono al primo reconcile post-deploy (≤ 45 sec).

**Diagnosi cross-device**: confermato che Mason (org 1003) vede solo i propri audit per RBAC (1 audit MANITOU 2026-02); il menu di PS_Admin (org 1001) mostrava in più i LOCK-* test stantii solo-locali, non dati di Mason. Non è un bug di visibilità ma di cache stantia.

**I LOCK audit `LOCK-PUB-1774111423756`, `LOCK-LOCAL-1774111412500`, `LOCK-LOCAL-1774111266631` non esistono nel DB server** — erano solo nell'IndexedDB del browser. Spariscono automaticamente dopo il deploy senza intervento manuale.

**All'inizio della prossima sessione:**
1. Aprire l'app sul proprio PC e su quello di Mason — i LOCK spariscono entro 45 sec.
2. Se si vuole forzare subito: cliccare "🧹 Pulisci cache" nel pannello sync.
3. Verificare **Smoke L3 P1** (checklist custom con pulsanti esito) se non ancora completato.
4. ~~Decidere Sprint 10~~ → **✅ Sprint 10 completato** (03/05/2026).

---

### Chiusura sessione 20 aprile 2026

**Hardening audit visibility multi-tenant (commit `30fb6c0`):**
- **Root cause**: audits sparivano dal menu dropdown per conflitto deduplica su `auditNumber` + cancellazione silenziosa item sync dopo max-retry + numerazione audit client-side non autoritativa.
- **Fix applicati (4 file, build OK, Jest 16/16 PASS)**:
  - `audit.controller.js`: `audit_number` server-authoritative al INSERT (`allocateAuditReportNumber` + retry anti-collisione); immutabile all'UPDATE.
  - `syncService.js`: item stallati dopo max-retry marcati `isStalled` (non eliminati); `clearQueueForServerAudits` rimuove solo item con `audit_id` confermato.
  - `StorageContext.jsx`: `dedupeAudits` e `filterLocalAuditsAfterServerFetch` usano UUID/audit_id come chiave stabile.
  - `AuthContext.jsx`: guard anti-perdita al logout (flush sync + conferma esplicita se pendenti).
- **Deploy**: backend VPS (pscp + systemd restart OK), frontend push `main` → Netlify.
- **Smoke test**: health HTTP 200; Mason login OK (1 audit `2026-02`); Camellini login OK (3 audit: `2026-07`, `2026-04`, `2026-03`).
- **Pendente approvazione**: `database/scripts/fix_visibility_audit_2026_04_to_mason_safe.sql` — sposta audit `2026-04` da tenant Camellini a Mason (operazione su dati, conferma esplicita richiesta).
- **Pendente deputy**: `docs/agent-tasks/TASK_MASON_REPORT_ANOMALIE_2026-04-20.md` — fix Word export (foto embedded, intestazione dinamica, dati fornitore, data audit, ispettori).

**All'inizio della prossima sessione (ordine consigliato):**
1. Leggere `PROJECT_ROADMAP.md` + questa sezione.
2. **Decisione**: applicare `fix_visibility_audit_2026_04_to_mason_safe.sql` per rendere `2026-04` visibile a Mason (richiede approvazione esplicita).
3. **Deputy**: avviare task Word export `TASK_MASON_REPORT_ANOMALIE_2026-04-20.md`.
4. Smoke test manuale UI: login Mason → dropdown → Export Word `2026-02`.
5. Traccia sviluppo: **0.2 ISO 14001** vs aggiornare DATABASE_SCHEMA.

---

### Chiusura sessione 22 marzo 2026

**Consegnato su `main` (GitHub + Netlify al prossimo deploy):**
- Case study 01 gestione utenti: chiusura doc + cherry-pick branch web; deploy VPS con script aggiornato (`admin` / `auditorOrg`) e restart con fallback `fuser`+`nohup`.
- **Fase 0.5**: export Word — prima `GET /audits/:id/pending-issues`, fallback `checkReaudit`+NC; riga **AP** in `RILIEVI_MARKER` con X su **NC** se pending aperti.
- Regole operative: comandi meccanici nel workspace = agente; approvazione solo eccezioni golden rules.

**All’inizio della prossima sessione (ordine consigliato):**
1. Leggere `PROJECT_ROADMAP.md` (header) + questa sezione.  
2. **Smoke test** (browser, utente reale): aprire audit con storico cliente → Export Word → verificare tabella rilievi pendenti e riga AP coerente con dati server.  
3. Scegliere traccia sviluppo: **0.2 ISO 14001** (migration + template) **vs** aggiornare **DATABASE_SCHEMA** per `norm_excerpt` / `checklist_questions`.  
4. Opzionale GitHub: eliminare branch remoto `docs/case-study-01-chiusura` (già mergiato in `main`).

**Backlog invariato / ricorrente:**
- [ ] ADR-006 (auto-reconcile cache) se non avviato.
- [ ] [DATABASE.md](reference/DATABASE.md) / `database.json`: segreti — non in chat; ruotare se esposti.
- [ ] Opzionale: `ExecStartPre` systemd non bloccante (vedi note deploy).
- [ ] Eliminare branch remoto `docs/case-study-01-chiusura` (già mergiato in `main`).

---

## File spesso toccati (Word + export)

`wordExport.js`, `wordExportHelpers.js`, `ExportPanel.jsx`, template Verbale in `public/templates/`, `repro-custom-export.mjs`.

---

*Regola per l’AI: aggiornare **questo file** invece di aggiungere `SESSION_NOTES_*.md`. Memoria sintetica anche in `.cursor/rules/sgq-operating-memory.mdc`.*

---

**Cursor — regola utente**: se nelle impostazioni è ancora scritto “leggi `SESSION_NOTES_20260301`”, sostituiscilo con **`docs/GUIDA_CONSOLIDATA.md`**.



---

## Deploy contesto AI multi-livello (30/05/2026)

| Step | Comando / verifica |
|------|-------------------|
| Migrazioni DB produzione | SCP `backend/scripts/run-migration-066-vps.js` e `067-vps.js` su VPS; `node /tmp/run-migration-066-vps.js` poi `067-vps.js` |
| Deploy backend | `backend/scripts/deploy-controllers-to-vps.ps1` + copia file AI (`aiChat`, `aiAssist`, servizi contesto, `knowledgeIndexer`, `normChunker`) |
| Restart | `sudo systemctl restart sgq-backend.service` — verificare MainPID cambiato |
| Reindex | `POST /api/v1/ai/reindex` (admin) dopo mig. 067 |
| Smoke | `GET/PATCH /api/v1/organizations/me` (`ai_context_notes`); `POST /api/v1/ai/chat` con `standardId` |
| UI | Impostazioni studio (note contesto) + Assistente AI (chip norma) — Netlify da merge su `main` |

Script VPS 066/067 allineati alle SQL `066_organization_ai_context_notes.sql` e `067_knowledge_chunks_standard_id.sql`.

### Slice 2 — propagazione audit (30/05/2026)

| Voce | Esito |
|------|-------|
| Frontend | Auto-contesto audit (azienda, norma, clausola checklist) in Assistente AI; separatore chat al cambio audit; `standardId` in suggest conclusioni e riesame contratti |
| Backend | `POST /ai/chat` accetta `auditId`, `clauseRef`, `questionId`; `POST /ai/suggest` arricchisce con norma se `standardId`; upload norme PDF con enrich org |
| Reindex | `inferStandardId` su documenti norma (`type_specific_data.standard_code`) e qualifiche (`standard_ref`) |
| Deploy | Commit `ec62a54` su `main`; VPS PID `331861` → `332487`; smoke: chat con audit context, rimozione nota smoke `ai_context_notes` |

### Fase A — citazioni cliccabili in chat (30/05/2026)

| Voce | Esito |
|------|-------|
| API | `POST /ai/chat` restituisce `citations[]` (`entityType`, `entityId`, `label`, `score`) e `sourcesCount` da chunk RAG deduplicati |
| Frontend | Chip sotto risposta assistant + «Basato su N record del SGQ»; link NC con `?select=`; componente `AiAssistantCitations` |
| Test L1 | Jest 8 + Vitest 5 (`aiCitations`, `AiAssistantCitations`) |
| Deploy | `deploy-controllers-to-vps.ps1` include `aiChat.controller.js` e `utils/aiCitations.js`; commit `c3ef889` |
| Smoke | `.cursor/ai-citations-smoke.mjs` — es. 14 citazioni su domanda NC |

**Aggiornamento 31/05/2026 — deep link documenti + chat persistente**

| Voce | Esito |
|------|-------|
| Contratto URL | `/documents?tab=tree&select=<docId>` (allineato a `/nc?select=`); helper `documentRegistryUrl.js` |
| Citazioni / ricerca | `getCitationPath` / `getSearchResultPath`: `document` e `norm_content` → tab Albero + drawer |
| Registro | `DocumentRegistry.jsx`: legge `tab`/`select` (mount + `popstate`); `expandToDocument` via breadcrumb API; `replace` URL su tab/dettaglio |
| Chat Assistente | `sessionStorage` chiave `sgq:ai-assistant-messages:<org>:<user>`; cap 50 messaggi; debounce 400 ms; pulizia su logout (`sgq:userLoggedOut`); pulsante «Nuova conversazione» |
| Coerenza albero | Regola unica in `documentTreeCoherence.js`: foglie = `parent_id` cartella + status ≠ obsoleto; catalogo/priorità = elenco piatto (orfani in Inbox, non nel ramo) — **nessun gap API**, differenza intenzionale |
| Test L1 | Vitest 531 OK (`documentRegistryUrl`, `aiAssistantChatPersist`, `documentTreeCoherence` + aggiornamenti citazioni/ricerca) |
| Deploy | Solo Netlify (FE); nessun restart VPS |
| Merge main | 31/05/2026 commit 88caa9b (fast-forward); deploy Netlify automatico; PR non creata (gh non disponibile su agent) |

### Fase C — ricerca unificata studio/azienda (31/05/2026)

| Voce | Esito |
|------|-------|
| C1 API | `GET /api/v1/search` — LIKE multi-entità, filtro `company_id` rigido, RBAC studio su NC/audit |
| C2 UI | Pagina `/search`, scope Tutto lo studio / Azienda, risultati raggruppati, deep link (`searchResultLinks.js`) |
| C3 RAG | Tab **Significato** → `POST /ai/chat` + `AiAssistantCitations`; tab **Esatto** → GET search |
| Test L1 | Jest 10 (backend) + Vitest 5 (`searchResultLinks`, `SearchPage`) |
| Deploy | `deploy-controllers-to-vps.ps1` include search routes/controller/service + `server.js` |
| Smoke | `GET /api/v1/search?q=...` con JWT; verificare assenza leak cross-company con `companyId` |

### Sessione 07/06/2026 - NC notifiche + form annidati (chiusura sessione)

| Voce | Esito |
|------|-------|
| Rubrica referenti NC | `NotificationContactsPanel.jsx` + tabella `notification_contacts` (mig. 073-074): ogni azienda ha referenti email per ricezione notifiche NC con ruolo (Responsabile QS, Tecnico, ecc.) |
| Fix responsible-options 500 | `GET /nc/:id/responsible-options`: `studioScopeClause` errato sulle `companies` (usava `co.organization_id` invece di `c.organization_id`). Fix: alias `c` corretto in `nc.controller.js`. Commit `48124e0` |
| Fix form annidati (bug critico) | `NcDetailPanel` aveva un `<form onSubmit>` esterno che avvolgeva `NcActionsList` (con il suo form). Click su «Salva azione» submittava il form esterno invece del `POST /non-conformities/:id/actions`. Fix: form esterno -> `<div>`, pulsante `type="button"` con `onClick`. Commit `8464ca` |
| Pattern alert scalabile | Alert scadenza NC: `responsible_contact_id` (personale azienda) + `recipients_email` (fallback). Scheduler `docAlertEscalation.service.js` gestisce l'escalation con priorita' personale > rubrica |
| Migrazione schema | mig. 073 (`notification_contacts`), 074 (`nc_notification_contacts`), 081 (`user_company_access`) deployate su VPS |
| Punti aperti prossima sessione | (1) Email placeholder da sostituire con indirizzo reale nel seed; (2) NC-QS-260515-01-019 senza responsabile ne' scadenza da assegnare; (3) PR vecchie aperte (#15-97) da triaggiare |
| Commit principali | 8464ca fix form annidati, 48124e0 fix responsible-options, ffcf37 feat rubrica NC, 47fbd14 fix scope company_access |

**Lezione chiave — Form HTML annidati:** HTML vieta `<form>` dentro `<form>`. Il browser ignora silenziosamente il form interno e il submit va a quello esterno. Sintomo: nessun POST nei log VPS, drawer chiuso senza errore. **Regola:** qualsiasi componente contenitore che usa `<form onSubmit>` deve essere convertito in `<div>` quando contiene componenti figlio con propri form di salvataggio. Consolidata nella sezione [Lezioni apprese consolidate](#lezioni-apprese-consolidate-fonte-unica).

---

## G. Modulo Qualifiche v2 — Architettura consolidata (09/06/2026)

### Cosa è stato fatto

| Slice | File chiave | Note |
|-------|-------------|------|
| Migration 084 | `database/migrations/084_qualifications_v2.sql` + `run-migration-084-vps.js` | 24 colonne nuove: `approval_status`, `previous_qualification_id`, campi specializzati per saldatori/NDT/coordinatori/PES-PAV/generico. Idempotente. |
| Migration 085 | `database/migrations/085_projects_version.sql` + `run-migration-085-vps.js` | `projects.commercial_case_id` FK + `qualifications.previous_qualification_id` FK. |
| Backend qualifiche v2 | `qualifications.controller.js`, `qualifications.routes.js` | Nuovi endpoint: `POST /approve`, `POST /reject`, `POST /renew`, `GET /coverage?project_id=X`. Filtro `approval_status`. QUAL_TYPE_MAP esteso con tutti i tipi NDT. |
| Backend project_welders | `projects.controller.js`, `projects.routes.js` | `POST /projects/:id/welders` (con validazione qualifica approvata/non scaduta), `DELETE /projects/:id/welders/:qualificationId`. |
| Import batch AI | `importJobs.controller.js`, `importJobs.routes.js`, `documentTypeSchemas.js` | Tipo `qualification`: endpoint `commit-to-qualification`, schemi AI per `qualifica_14731` e `pes_pav`. |
| Frontend QualificationsPage v2 | `QualificationsPage.jsx`, `QualificationsPage.css` | Tab per tipo (Tutti/Saldatori/NDT/Coordinatori/Operatori/Abilitazioni/Generiche), colonne dinamiche, badge `approval_status`, pulsanti Approva/Rifiuta/Rinnova (solo coordinatori/admin), modal rifiuto. |
| Vista Copertura Commessa | `ProjectsPage.jsx`, `ContractReviewPage.jsx` | `CoverageModal` in ProjectsPage (pulsante per ogni riga), `CoveragePanel` in ContractReviewPage (sezione APPROVED). Saldatori assegnati ora con checkbox funzionali. |

### Architettura del flusso approvazione qualifiche
```
PDF certificato → Import Job → AI estrae campi → commit-to-qualification → approval_status=bozza
→ Coordinatore approva (POST /approve) → approval_status=approvata
  └─ [se certificate_file_url presente] timbro visivo SGQ applicato con pdf-lib
     → certificate_file_url aggiornato al file timbrato (*_approved.pdf)
     → certificate_original_url conserva il path originale (migration 086)
→ Scadenzario / rinnovo (POST /renew → nuovo record con previous_qualification_id)
```

### Timbro visivo PDF su approvazione (09/06/2026)

**Funzionalità**: quando il coordinatore approva una qualifica con PDF allegato, `pdf-lib` aggiunge su ogni pagina in basso a destra un box con:
- `✓ Verificato da: [nome] ([titolo IWT/IWE/IWS])` — titolo preso dalla qualifica ISO 14731 più recente approvata del coordinatore
- `Studio: [organization name]`
- `Data: [dd/mm/yyyy]`
- `Approvazione SGQ — [certificate_number]`

**Comportamento best-effort**: se il PDF non è trovato, non è un `.pdf`, o `pdf-lib` fallisce, l'approvazione procede comunque senza timbro (nessun blocco UI).
**Idempotenza**: se `certificate_original_url` è già valorizzato, il timbro non viene riapplicato.
**Dipendenze**: `pdf-lib ^1.17.1` — installato in `backend/package.json`; sul VPS con `npm install --no-save --ignore-scripts pdf-lib` dopo aver fixato permessi nodemon con `sudo chown -R spascarella:spascarella /var/www/sgq-backend/node_modules/nodemon`.
**Migration**: `086_qualifications_original_url.sql` — aggiunge colonna `certificate_original_url NVARCHAR(500) NULL`. Eseguita dal PC locale con `run-migration-086-local.cjs` (usa `database.json` gitignored).

### Pattern VPS per migrazioni Node.js da Windows
Usare **sempre** `127.0.0.1:11043` invece di `www.fr-busato.it:11043` nei runner VPS — l'IP pubblico è bloccato da hairpin NAT. Il servizio systemd usa invece il nome host perché ha route diverse.

### File non nel deploy manifest (fix aggiunto)
`projects.controller.js`, `qualifications.routes.js`, `projects.routes.js`, `documentTypeSchemas.js` — aggiunti al `deploy-manifest.json` nella stessa sessione.

---

### Sessione 17/06/2026 — Trigger manuale promemoria NC

| Voce | Esito |
|------|-------|
| Endpoint | `POST /notifications-config/run-nc-alerts` — trigger manuale con `dryRun` flag, cooldown 15 min, risposta `{ success, dryRun, message, count }` |
| Fix SQL | `nc.title` → `nc.description` in `fetchOrgNcRows` (`ncAlertEscalation.service.js`): la tabella `non_conformities` non ha colonna `title` |
| UI | Pulsante «Invia promemoria NC ora» in Impostazioni → Notifiche con badge dry-run e cooldown visivo |
| Deploy manifest | Aggiunti `ncAlertEscalation.service.js`, `notifications.controller.js`, `notificationContacts.controller.js`, `notifications.routes.js` |
| Smoke | Dry-run `200 { success: true, dryRun: true, message: "Anteprima: 1 email..." }` — OK |
| PR | #113 mergiata su `main` (commit `000571e`); fix SQL `441e85f`; manifest `bf09f37` |

**Lezione chiave — schema NC:** `non_conformities` non ha colonna `title` — solo `description` e `nc_number`. Qualsiasi query che referenzia `nc.title` fallisce con *"Invalid column name 'title'"*. Usare `nc.description` come titolo descrittivo.

**Pattern dry-run:** passare `{ dryRun: true }` a `runNcEscalationForOrg` per smoke test senza inviare email e senza scrivere su `nc_notification_log`.

**Netlify + commit backend-only:** se un commit tocca solo file backend (non in `app/`), Netlify può annullare il build con *"Canceled build due to no content change"* — comportamento corretto, non un errore.

---

### Sessione 18/06/2026 — Riesame di Direzione ISO 9001 §9.3 (migration 099 + CRUD + frontend)

| Voce | Esito |
|------|-------|
| DB test | Migration 099: tabella `management_reviews` (90 colonne, numerazione `RD-YYYY-NNN`); smoke-testdb OK |
| DB prod | Migration 099 applicata via `run-on-vps.ps1` con dotenv da `/var/www/sgq-backend/.env` |
| Backend | Controller + routes: 5 endpoint REST `/api/v1/management-reviews`; multi-tenant; `companyAccess.service` |
| Frontend | `ManagementReviewsPage`: lista tabellare + form collassabile (§9.3.2 ×8, §9.3.3 ×3); nav "Riesame Direzione" |
| Deploy | `deploy-manifest.json` aggiornato; controller+routes copiati sul VPS; restart OK; health OK |
| PR | #117 mergiata su `main` (tutti i check pass: smoke DB, test-and-build, Netlify) |

**Lezione appresa — script migration VPS:**
- Pattern corretto per script che girano su VPS in contesto standalone:
  ```js
  require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
  const { getPool } = require('/var/www/sgq-backend/src/config/database');
  ```
- **Non usare** `require('dotenv')` diretto (non nel PATH da `/tmp/`) né `require('./routes/...')` (percorso relativo sbagliato)
- **Non includere FK constraints inline** nel CREATE TABLE: questo progetto usa colonne `organization_id/company_id INT` senza REFERENCES (pattern da migration 034 `risks`)
- `deploy-manifest.json` va aggiornato contestualmente ad ogni nuovo controller/route, altrimenti il deploy successivo lascia il server in crash per modulo mancante

---

### Sessione 18/06/2026 — Piano Azioni multi-fonte (Action Plan)

| Voce | Esito |
|------|-------|
| DB | Migration 098: `audit_id` nullable, `source_category` (7 valori), `source_origin_text`, `organization_id` su `non_conformities`; backfill 22 NC esistenti → `source_category='audit'` |
| Backend | `nc.controller.js`: tutte le query INNER JOIN → LEFT JOIN; `createNonConformity` condizionale su `audit_id`; filtro `source_category` in lista; RBAC per NC senza audit (admin-only) |
| Frontend | `NcCreateModal`: selector categoria come prima voce; audit picker contestuale; campo origine libero; `NCPage`: filtro categoria, badge colorati, shortcuts bar 7 pulsanti, titolo aggiornato |
| Deploy | Migration 098 eseguita su VPS (localhost:11043); backend deployato e riavviato (PID 36616); frontend su `main` → Netlify |
| PR | #114 mergiata su `main` |
| Test | 28/28 Vitest OK; build Vite OK; health API OK |

**Architettura Action Plan — pattern consolidato:**
- `source_category` è il campo di business (7 valori): `audit`, `complaint`, `risk_action`, `management_review`, `improvement`, `operational`, `external_audit`
- `source_type` resta il campo tecnico (come è stata creata la NC: `manual`, `audit_nc`, `audit_oss`, ecc.) — i due campi sono ortogonali
- NC senza `audit_id`: `organization_id` diretto sulla tabella garantisce RBAC; solo admin/superadmin possono creare/modificare
- Studio scope nelle query: `(nc.audit_id IS NULL OR (studio_scope_on_a))` — pattern riusabile per ogni query futura

**Lezione chiave — SQL Server + VPS SSH:** il server SQL non è raggiungibile via hostname pubblico (`www.fr-busato.it:11043`) dal VPS stesso — usare sempre `localhost:11043` negli script di migrazione eseguiti via SSH sul nodo.

**Backlog Action Plan (prossima sessione):** vedi `docs/PROJECT_ROADMAP.md` sezione *Action Plan — Evoluzione futura*.

**Pattern aggregazione dati §9.3 — AI-assisted pre-compilazione (2026-06-19 — PR #119):**
- Endpoint di aggregazione multi-tabella: ogni sezione (NC, Obiettivi, Audit, Fornitori, Reclami) ha il proprio `try/catch` per graceful degradation — se una query fallisce, l'endpoint restituisce il dato parziale con `note: "Dato non disponibile"` senza bloccare l'intera risposta.
- Route specifica (`/management-reviews/input-summary`) va registrata **prima** della route parametrica (`/management-reviews/:id`) in Express per evitare il match errato su `:id = "input-summary"`.
- Widget pre-compilazione: pattern `onPrefill(field, text)` — se il campo ha già contenuto, il testo viene appendato con doppio newline preservando le note manuali; altrimenti sostituisce direttamente.
- `norm_coverage: []` è il fallback corretto se `norm_requirements` non esiste nel DB — il widget gestisce l'array vuoto senza mostrare sezione vuota.

**Bug trovati con smoke test MCP (2026-06-19 — PR #122, #123):**
- `KNOWN_MODULE_KEYS` in `moduleLicense.service.js` è l'unica fonte di verità per i moduli: se la chiave manca lì, il token non la include e il frontend blocca menu + pagina anche se il codice React è corretto. Aggiungere sempre la chiave contestualmente al nuovo modulo.
- JOIN `companies`: usare sempre `c.id`, mai `c.company_id` — la tabella `companies` usa `id` come PK. Pattern corretto: `LEFT JOIN companies c ON c.id = mr.company_id`.
- **`sgq-backend-test` riavvio dopo deploy** — **RISOLTO 21/06/2026** (commit su `cursor/fix-deploy-test-restart-d4ed`): `deploy-controllers-to-vps.ps1` accetta ora il parametro `-AlsoRestartTest`. Usare `.\backend\scripts\deploy-controllers-to-vps.ps1 -AlsoRestartTest` per riavviare in sequenza prod + test. Senza il flag: comportamento invariato (solo prod). Fallback manuale se SGQ_SUDO_PASSWORD non disponibile: `.\backend\scripts\run-on-vps.ps1 -Command "echo $b64 | base64 -d | sudo -S systemctl restart sgq-backend-test.service"`

---

### Sessione 19/06/2026 (serale) — Migration 100 norm_requirements + AI Draft §9.3.2

| Voce | Esito |
|------|-------|
| Migration 100 (VPS) | SKIP confermato: tabella `norm_requirements` preesistente con 91 righe `ISO_9001_2015` e schema `clause_ref` |
| Backend | `getInputSummary`: `norm_coverage` ora popolato con clausole reali; `generateDraft` nuovo endpoint bozze §9.3.2 |
| Frontend | Pulsante "✨ Genera bozza testo" in `InputSummaryWidget`; popola campi §9.3.2 in un click |
| Deploy | PR #120 → CI verde → merge → `deploy-controllers-to-vps.ps1` × 2; fix push diretto su `main` |
| Smoke | Backend health OK; migrazione 100 SKIP OK (schema già corretto) |

**Nota critica — schema norm_requirements reale (da verificare a inizio sessione):**
- Colonna: `clause_ref` (non `clause_number`) — scoperto solo in fase di run VPS
- Standard code: `ISO_9001_2015` con underscore (non `ISO9001:2015` con colon) 
- Filtro clausole sezione: `LEN(clause_ref) - LEN(REPLACE(clause_ref, '.', '')) = 1` → livello N.N
- Prima di qualsiasi migrazione che tocca `norm_requirements`: eseguire `_check-schema-test.js` per verificare lo schema reale

**Pattern generate-draft (deterministico + AI opzionale):**
- `POST /management-reviews/:id/generate-draft` — richiede `period_from`, `period_to`; opzionale `company_id`
- Se AI non configurata (`aiAdapter` lancia `AI_NOT_CONFIGURED`): testo deterministico da dati aggregati
- Se AI configurata (Gemini/Azure/OpenAI via `aiProviderAdapter`): testo GPT-style da prompt strutturato
- Risposta: `{ success, drafts: { nc_summary, objectives_summary, audits_summary, suppliers_summary, norm_gaps }, meta: { ai_used } }`
- Frontend: pulsante visibile solo se `reviewId` (initial?.id) è disponibile — non su nuovo riesame non ancora salvato

---

### Sessione 21/06/2026 (pomeriggio) — CND: UX mobile, form VT, WPS/WPQR

| PR | Contenuto |
|----|-----------|
| #143 | foto: pulsante 📷 nella riga + foto difetti nel Word export |
| #144 | mobile UX: accordion chiuse di default + 📷 nella riga (non sotto) |
| #145 | cliente: select anagrafica + testo libero (no duplicazione) |
| #146 | nav mobile: etichetta `CND` (era `VT/CND`) |
| #147 | fornitore ispezionato: campo + scenario Mason→Manitou→Fornitore1 |
| #148 | elimina duplicazione Azienda committente / Cliente |
| #149 | fornitore: select dall'anagrafica fornitori |
| #150 | fornitori filtrati per cliente selezionato (company_id) |
| #151 | WPS: select dal modulo Saldatura, filtrata per cliente |
| #152 | WPS/WPQR form: company_id ereditato dal selettore azienda |

**Lezioni:**

| Lezione | Regola |
|---|---|
| **📷 non visibile su mobile con scroll orizzontale** | Elementi aggiuntivi in righe `<tr>` sotto una tabella wide non sono mai visibili su mobile senza scroll. Mettere sempre le azioni IN-ROW nell'ultima colonna. |
| **`useEffect` su stato form** | Per caricare dati dipendenti da un campo form (es. fornitori filtrati per company_id), usare `useEffect([form.company_id])` dentro il form — non caricare tutto al mount del componente padre. |
| **Accordion su mobile** | `useState` di apertura sezioni deve essere `!isMobile` per le sezioni non primarie — altrimenti su mobile tutto è aperto e lo schermo è occupato prima di compilare. |
| **WPS form company_id** | Passare `defaultCompanyId={companyScopeId}` come prop al form modale — il form non legge lo scope dal contesto ma dipende dal parent per il default. |
| **Griglia standard** | `SgqDataGrid` NON è lo standard universale — usato solo in 3 pagine (NC, Deadlines, Studio). Welding/CND/Equipment usano tabelle HTML custom. Non è debito tecnico urgente. |

---

### Sessione 21/06/2026 — Modulo CND: completamento, fix operativi e go-live mobile

| Voce | Esito |
|---|---|
| Modulo CND su main | PR #134 mergiata — DB prod migrato (104-108), backend deployato |
| Mobile responsive | PR #135 — form VT ottimizzato per tablet/smartphone |
| Auto-calcolo taratura | PR #136 — `next_calibration_date = ultima_verifica + mesi_freq` |
| Gap template VT | PR #137 — ruolo strumenti (calibro/luxmetro/lampada), inspector auto-fill, messaggio strumenti vuoti |
| Gestione difetti | PR #138 — note per riga, riepilogo R/S, warning note errate, link NC |
| Fix UX | PR #139 — AutoTextarea note difetto, NcCreateModal pre-compilata, useNdtAutoSave wiring |
| Foto saldature | PR #140 — `attachments.ndt_report_item_id`, NdtItemAttachments, fotocamera Android |
| Menu mobile | PR #141 — VT/CND nel bottom navigation (4° voce) |
| Modulo licenza | SQL diretto — aggiunto `cnd` a org 1003 MASON_Srl e 1004 ERAM |

**Lezioni critiche di questa sessione:**

| Lezione | Regola |
|---|---|
| **Modulo licenza non si auto-attiva** | Quando si aggiunge un nuovo `module_key` a `KNOWN_MODULE_KEYS`, le org con `licensed_modules IS NOT NULL` **non** lo ricevono automaticamente. Bisogna aggiornare via SQL: `UPDATE organizations SET licensed_modules=JSON_MODIFY(licensed_modules,'append $','nuova_chiave') WHERE ...` oppure con script Node. **Sempre verificare** dopo deploy. |
| **Bottom navigation mobile** | Il menu mobile ha 5 voci hardcoded in `buildMobileNavItems`. Ogni nuovo modulo primario **deve essere aggiunto esplicitamente** alla lista e la priorità decidere quale voce scalzare (CND sostituisce Documenti al 4° posto). |
| **Filtered index SQL Server** | `CREATE INDEX ... WHERE col IS NOT NULL` su una colonna appena aggiunta con `ALTER TABLE` **fallisce** se eseguito nello stesso batch. Soluzione: statement separati (ALTER TABLE in un `query()`, CREATE INDEX in un secondo `query()`). |
| **Template VT vs modulo** | Il verbale VT è strutturalmente simile a un audit (riga+esito+nota) ma non va modellato sopra il sistema audit — il dominio normativo CND è specifico (codici UNI EN ISO 6520, strumenti, parametri VT/MT/PT/UT). La scalabilità per altri metodi si ottiene con `report_type` discriminator + `method_params JSON`. |
| **Ruolo strumenti nel template Word** | Il template VT ha celle fisse per Calibro / Luxmetro / Lampada. Il Word export usa `instrument_role` (`gauge`/`luxmeter`/`lamp`). Se il ruolo non è assegnato dalla UI, le celle mostrano N/D. La UI **deve** esporre un dropdown ruolo per ogni strumento selezionato. |

---

### Sessione 20/06/2026 — Modulo CND (6 slice complete — PR #127-#132)

| Slice | PR | Contenuto | Stato |
|---|---|---|---|
| 1 | #127 | Migrazione DB 101-103: `equipment_assets`, `equipment_calibrations`, `ndt_reports`/`items`/`instruments` | ✅ |
| 2 | #128 | Backend CRUD: `equipment.controller.js`, `ndtReports.controller.js`, route, modulo `cnd` in `moduleLicense.service.js` | ✅ |
| 3 | #129 | Frontend: `EquipmentPage.jsx` (lista+form strumenti, stats taratura) | ✅ |
| 4 | #130 | Frontend: `NdtReportsPage.jsx` (lista+form VT a 5 sezioni, Elenco Marche dinamico, giudizio A/R/S con `.status-btn`) | ✅ |
| 5 | #131 | Export Word: `vtWordExport.js` + template `VT-verbale.docx` (36 placeholder, loop `{#items}`) | ✅ |
| 6 | #132 | Offline: `useNdtAutoSave.js` (localStorage debounce) + sync queue `create/update/delete_ndt_report` in `syncService.js` | ✅ |

**Architettura chiave:**
- `equipment_assets`: tabella trasversale a tutti i sistemi (9001/14001/45001/3834/CND); `company_id NULL` = studio, valorizzato = azienda cliente
- `ndt_reports`: `report_type='VT'|'MT'|'PT'|'UT'`; `method_params JSON` per parametri specifici per metodo → scalabile senza nuove tabelle
- Numerazione automatica: `VT-YYYY-NNN` (pattern `RD-YYYY-NNN` da managementReviews)
- Modulo licenza: chiave `cnd` aggiunta a `KNOWN_MODULE_KEYS` e `LABELS_IT`
- Menu sidebar: gruppo "CND" con voci Strumenti e Verbali
- Smoke test API sul backend-test: 7/7 OK
- Build Vite: OK su ogni slice

**Lezioni:**
- `equipment_assets.company_id IS NULL` = asset dello studio (condiviso); filtro `for-report` mostra studio + azienda
- Template `.docx` generato con `node scripts/generateVtTemplate.js` (pattern `generateNcTemplate.js`) — rilanciare se si vuole modificare il layout
- Verbali CND = online-first (come NC/Riesame Direzione), non offline-first come gli audit ISO; `useNdtAutoSave` aggiunge resilienza locale senza complessità IndexedDB

---

### Sessione 23/06/2026 — Riesame di Direzione: robustezza multi-azienda + copertura normativa §9.3.2 completa

| Voce | Esito |
|------|-------|
| Bug fix UX | Widget "Dati disponibili §9.3.2" ora auto-carica al mount (section 3 aperta); "Genera bozza" funziona client-side senza `reviewId` (PR #156) |
| Copertura normativa | 4 campi aggiunti: `input_context_changes` (§9.3.2 b), `input_customer_satisfaction` (c.1), `input_process_performance` (c.3), `input_risk_effectiveness` (e) — migrazione 110 eseguita su VPS |
| Export Word §7.5 | `wordExportReview.js` + template `management-review-verbale.docx`; pulsante 📋 su ogni riesame → scarica verbale `.docx` |
| Fix robustezza multi-azienda | **key={companyId}** su `InputSummaryWidget` forza re-mount al cambio azienda → nessun dato stale in scenario ERAM→MASON; `onFillAll` (replace) vs `onPrefill` (append) separati |
| RBAC hardening | `assertCompanyRead` su `getInputSummary` e `getOneReview`; `assertCompanyRead` importato nel controller |
| Deploy | PR #156 mergiata; backend controller + migrazione 110 VPS; Netlify live (chunk `ManagementReviewsPage-DVT4Sh6S.js`) |

**Gap residui noti (backlog, non bloccanti):**
- **NC standalone** (senza `audit_id`): in `getInputSummary` con `companyId` le NC non legate ad audit sono escluse dal conteggio per azienda (filtro `a.company_id = @companyId` ritorna NULL su LEFT JOIN). Undercount minore in scenari con NC dirette non da audit.
- **`createReview` company_id** (P10): nessuna verifica che `company_id` passato nel body appartenga all'organizzazione (solo RBAC write). Fix: aggiungere `assertCompanyRead` prima dell'INSERT.
- **`updateReview` cambio company_id** (P9): `assertMutatingAllowed` verifica il `company_id` esistente ma non il nuovo. Fix: leggere il nuovo `company_id` dal body e aggiungere check.
- **`norm_coverage` aggregazione** (P6): con `companyId` presente, la join tra clausole e audit può includere clausole "ok" per audit di altre aziende. Fix: filtrare `a.company_id` anche nella subquery `norm_coverage`.

---

### Sessione 23/06/2026 (incident) — Deploy sicuro con working tree "sporco"

**Problema**: `backend/scripts/deploy-controllers-to-vps.ps1` copia sul VPS **tutto il working tree** (manifest di ~118 file letti dal disco), **incluso il WIP non committato**. Durante una sessione con lavoro in corso di un altro workstream, il deploy ha portato in produzione una versione modificata di `knowledgeIndexer.service.js` che importava un file nuovo non ancora tracciato da git (`documentTextExtractor.service.js`), non incluso nel deploy → backend in crash `MODULE_NOT_FOUND`, API offline (HTTP 503).

**Causa radice**: lo script deploya dal **working tree**, non dallo stato committato/`HEAD`. Se il tree è "sporco" con WIP, il WIP finisce in produzione.

**Ripristino effettuato**: riportate sul VPS le versioni **committate** dei file impattati (`knowledgeIndexer.service.js`, `package.json`) via `pscp` mirato + restart `sgq-backend` (verifica `MainPID` cambiato) + health check 200.

**Pratica sicura (regola operativa):**

| # | Regola |
|---|--------|
| 1 | Prima di qualsiasi deploy backend, verificare `git status --short`. Se il tree NON è pulito e il WIP non è pertinente al rilascio, **non** usare lo script di deploy completo. |
| 2 | Usare invece un **deploy mirato dei soli file committati**: `pscp` del singolo file, oppure `git show HEAD:percorso` quando si vuole forzare la versione committata, verso il percorso remoto; poi restart con verifica `MainPID`. |
| 3 | Le funzioni riutilizzabili sono in `backend/scripts/lib/vps-ssh.ps1` (`Initialize-SgqVpsSsh`, `Test-SgqVpsSession`, `Copy-SgqVpsFile`, `Invoke-SgqVps`, `Get-SgqVpsHealth`). Passare la password sudo a `plink` via **stdin**, mai nella stringa del comando (che potrebbe finire nei log). |
| 4 | **Nuove dipendenze runtime**: se un rilascio introduce un nuovo pacchetto npm (es. `mammoth`), il deploy backend DEVE eseguire `npm install`/`npm ci` sul VPS, altrimenti `MODULE_NOT_FOUND`. |

---

### Sessione 23/06/2026 — Riesame di Direzione §9.3: stato modulo (3 slice AI in produzione)

Stato consolidato del modulo Riesame di Direzione: le 3 slice sono tutte in `main` e in produzione.

| Slice | Contenuto | Endpoint/File chiave | Stato |
|------|-----------|----------------------|-------|
| Fix iniziale | Corretto doppio dereference `res.data.data`→`res.data` (e `res.data.pagination`) che bloccava caricamento dati/lista/export | `app/src/pages/ManagementReviewsPage.jsx` | In main (commit `2aa4f4f`) |
| Slice 1 | Pulsante "Genera bozza" collegato a `POST /management-reviews/:id/generate-draft` con badge "AI attiva/Bozza automatica" e fallback ai template locali | `ManagementReviewsPage.jsx` (widget `InputSummaryWidget`) | In main (`60121ba`), frontend live |
| Slice 2 | Aggregazione §9.3.2 ampliata: rischi/opportunità, output del riesame precedente, dettaglio NC; prompt+fallback estesi (`risks_summary`, `previous_actions_summary`) | `backend/src/controllers/managementReviews.controller.js` (`getInputSummary`, `generate-draft`) | In main (`2d4e64a`), backend deployato |
| Slice 3 | Generazione assistita output §9.3.3 (miglioramenti, modifiche SGQ, risorse) via nuovo endpoint `POST /management-reviews/:id/generate-outputs`, sezione UI `OutputsDraftSection` con fallback | controller + `managementReviews.routes.js` + `ManagementReviewsPage.jsx` | In main (`ec71b8a`), backend deployato e verificato (health 200, endpoint 401 senza auth) |

**Stato AI**: l'infrastruttura LLM (`aiProviderAdapter`, provider Gemini/Azure/OpenAI) è presente. L'adapter sceglie il provider in base alle variabili d'ambiente del servizio (`GEMINI_API_KEY` → Gemini; `AZURE_OPENAI_ENDPOINT`+`AZURE_OPENAI_API_KEY` → Azure; `OPENAI_API_KEY` → OpenAI); se nessuna è presente opera il **fallback deterministico** (badge "Bozza automatica").

**Verifica provider sul VPS (23/06/2026)** — controllata la sola presenza delle chiavi (mai i valori) in `/var/www/sgq-backend/.env` e negli override systemd:

| Variabile | Stato VPS (23/06/2026) |
|-----------|------------------------|
| `GEMINI_API_KEY` | **CONFIGURATO** (valore presente, 39 caratteri — non mostrato) |
| `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_ENDPOINT` | Non configurato |
| `OPENAI_API_KEY` | Non configurato |

**Esito**: **Provider LLM sul VPS = Gemini CONFIGURATO** → l'AI reale è attiva (l'adapter usa Gemini), **non** il fallback deterministico. Nessun override delle variabili nel unit systemd. (Verifica eseguita da Windows via `vps-preflight.ps1` + `lib/vps-ssh.ps1`, valore della chiave mai stampato né salvato.)

**Backlog (cosa resta):** **Slice 4 rimandata** — integrazione KPI/monitoraggio §9.1 (bloccata: il modulo §9.1 non è ancora strutturato) e pannello assistente conversazionale. Il modulo §9.1 è ora tracciato come prerequisito nel [Backlog parcheggiato della roadmap](PROJECT_ROADMAP.md#backlog-parcheggiato-task-futuri--fonte-unica).

---

### Sessione 22/06/2026 — Riesame di Direzione: pattern Ambito azienda

| Voce | Esito |
|------|-------|
| Problema rilevato | Toolbar Riesame di Direzione aveva solo filtro Stato; mancavano filtri Anno e Azienda; l'azienda non era selezionabile nel form di creazione |
| Fix toolbar | Aggiunto filtro Anno (dropdown `YEAR(review_date)`) e filtro Azienda al backend `listReviews` + frontend toolbar |
| Refactoring pattern Ambito | Selettore "Ambito:" spostato nell'header della pagina (standard app); rimosso dropdown azienda dalla toolbar e dal form come campo indipendente |
| Nuovo file | `app/src/utils/managementReviewsCompanyScope.js` — utility localStorage identica a `qualificationsCompanyScope.js` e `documentRegistryCompanyScope.js` |
| Comportamento form | Se ambito attivo → campo azienda = testo fisso "(da ambito)"; senza ambito → select libero; auto-selezione se org ha una sola azienda |
| Deploy | PR #154 mergiata su `main`; backend `managementReviews.controller.js` copiato su VPS; restart servizio (PID 37543); health ✅ |
| CI | Smoke test DB e CI app PR: entrambi `success` |

**Lezione chiave (aggiunta alle regole UI):** Il pattern "Ambito" è lo standard per tutti i moduli multi-azienda dell'app. Non usare dropdown azienda in toolbar o form come elementi indipendenti. Moduli con `filterCompany` ancora da aggiornare (backlog): NC, NDT Reports, Attrezzature, Scadenzari.

---

### Sessione 19/06/2026 (notte) — Slice 1 coverage range-aware qualifiche saldatori

| Voce | Esito |
|------|-------|
| Funzione trovata | `getCoverage` in `backend/src/controllers/qualifications.controller.js` (match solo per codice processo) |
| Schema DB verificato | `welding_procedures`: `thickness_range_min/max` (decimal), `base_material_group`, `welding_positions`; `qualifications`: `thickness_min_mm/max_mm` (decimal), `material_group`, `position_range` |
| Utility creata | `backend/src/utils/qualificationCoverage.js` — funzioni pure: `checkThickness`, `checkMaterialGroup`, `checkPositions`, `checkProcess`, `computeQualificationCoverage`, `computeWpsCoverageEsito` |
| Test | `qualificationCoverage.test.js` — 36 test, tutti verdi (Jest) |
| Controller aggiornato | `getCoverage` usa logica range-aware; risposta granulare con `coverage_detail` per saldatore e `partial`/`giallo` per campi NULL |
| Deploy | File copiati su VPS; restart manuale PID (systemctl sudo non disponibile) — backend health OK |
| Commit | Incluso in PR #120 (merge automatico su main) + manifest update `ec8de58` |

**Gestione NULL difensiva:**
- Campo NULL nella WPS → non vincolante (non fa fallire il match)
- Campo NULL nella qualifica → `unverifiable` → esito `partial`/`giallo` (segnala verifica manuale, non esclude il saldatore)
- Motivazione: evitare falsi negativi su archivi storici incompleti

**Pattern `computeQualificationCoverage` (riusabile):**
- Input: `qual` (riga DB qualifiche) + `wps` (riga DB welding_procedures normalizzata)
- Output: `{ process, thickness, material_group, position, overall: 'ok'|'partial'|'excluded' }`
- `computeWpsCoverageEsito(details[]) → 'verde'|'giallo'|'rosso'`

**Nota deploy-manifest:** aggiungere sempre file utils nuovi a `backend/scripts/deploy-manifest.json` gruppo `utils` prima del prossimo deploy — altrimenti il file non viene copiato sul VPS.

### Sessione 24/06/2026 — AI Know-how Studio: content_scope, Patrimonio Studio, indicizzazione contenuti

| Voce | Esito |
|------|-------|
| PR | [#161](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/161) — MERGED su main (`5403322`) |
| Migrazione 111 | Colonna `content_scope` (`client`/`studio`/`reference`) su `document_registry` + CHECK + DEFAULT + indice; backfill 770 client, 97 reference |
| Patrimonio Studio | Template `studio_patrimonio_v1` + provisioning radici per org 1001-1004 |
| Indicizzazione contenuto documenti | `documentTextExtractor.service.js` estrae testo da DOCX/PDF; `knowledgeIndexer.service.js` genera chunk e embedding per scope-aware search |
| Timeout difensivo embedding | `geminiAdapter.js` `embed()`: AbortController 30s (env `GEMINI_EMBED_TIMEOUT_MS`) + cap 2 retry su 429; test L1 3/3 |
| Deploy backend VPS | 119 file copiati; `mammoth` installato; restart PID 74632 -> 95408; health OK |
| Reindex produzione | Avviato per tutte le org; esecuzione lunga (embedding reale) |
| Ambiente TEST isolato | `/var/www/sgq-backend-test` (drop-in systemd, DB `2026-06-18_SGQ_ISO9001`); utile per validazione pre-prod, dismettibile a regime |
| Deploy-manifest | Aggiunto `documentTextExtractor.service.js` al manifest (mancava) |

**Lezioni apprese:**
- Il deploy-manifest deve essere aggiornato **insieme** al codice quando si aggiunge un nuovo file di servizio — altrimenti il file non arriva sul VPS.
- L'embedding AI senza timeout causa hang indefiniti quando il provider e' a rate-limit. Il pattern `AbortController` + cap retry e' ora standard per tutte le chiamate Gemini.
- L'isolamento test backend (directory separata + drop-in systemd) e' un pattern valido per validare feature che toccano schema DB prima del rilascio in produzione.
