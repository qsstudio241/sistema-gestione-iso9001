# Guida consolidata — SGQ ISO 9001

> **Unico documento di esperienza operativa** da aggiornare quando cambia il comportamento del sistema (deploy, Word, DB, sync) **o** le regole di verifica/release (smoke, licenze, DoD).  
> **Non creare** nuovi `SESSION_NOTES_YYYYMMDD.md`: si aggiorna questo file + `PROJECT_ROADMAP.md`.

## Cosa leggere a inizio sessione (ordine)

1. **[../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)** — stack, infra, workflow.  
2. **[PROJECT_ROADMAP.md](PROJECT_ROADMAP.md)** — fasi e backlog.  
3. **[ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md)** — gerarchia utenti, segregazione dati, ruoli e piano migrazione RBAC (aspetto portante; aggiornare quando si toccano auth o scope query).  
4. **Questo file** — lezioni apprese, procedure ripetibili e **piano qualità / test di robustezza** (sezione omonima sotto).  
5. **[DATABASE.md](DATABASE.md)** — connessione DB, script repro, ambienti `development` / `test`.  
6. Per deploy: [DEPLOY_CHECKLIST_RELEASE.md](DEPLOY_CHECKLIST_RELEASE.md), [DEPLOY_TROUBLESHOOTING.md](DEPLOY_TROUBLESHOOTING.md), [ACCESSO_DEPLOY_AGENTS.md](ACCESSO_DEPLOY_AGENTS.md) (API prod., SSH, file locale sicuro per Cursor).
7. Se il task tocca editing documentale desktop: **[MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md)**.

**Storico sessioni** (feb–mar 2026): cartella [archive/sessions/](archive/sessions/) — solo consultazione, non aggiornare.

### Workspace consigliato — ponte `C:\ProgettoISO` (Cursor / terminale)

Per **non dipendere dalla lettera disco di Google Drive** e mantenere stabile il percorso visto da Cursor (chat, indici, terminale):

- Usare una cartella fissa su disco locale, es. **`C:\ProgettoISO`**, come **workspace del progetto**.
- I file possono restare fisicamente su **Google Drive** (o altra unità): si crea un **collegamento simbolico (symlink)** o una **junction** da `C:\ProgettoISO` verso la cartella reale sul cloud. Se Drive cambia lettera o percorso, si **aggiorna solo il ponte**, non la configurazione di Cursor.
- Eseguire sempre **`git`**, **`npm run test:run`**, **`npm run build`** dalla root **`C:\ProgettoISO`** (evita doppi checkout dello stesso repo su `C:` e su unità cloud contemporaneamente).

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
| **Dopo deploy** | [DEPLOY_CHECKLIST_RELEASE.md](DEPLOY_CHECKLIST_RELEASE.md) + smoke tabella sotto; se tocca licenze/auth → anche righe “Sicurezza e licenze”. |

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
| **L3 — Smoke post-deploy** | Health API, login, lista audit, un flusso CRUD del modulo toccato, export Word se toccato | Sempre dopo release frontend/backend ([DEPLOY_CHECKLIST_RELEASE.md](DEPLOY_CHECKLIST_RELEASE.md)). Checklist strutturata esempio: [agent-tasks/SMOKE_CHECKLIST_WEEKEND_2026-04-18.md](agent-tasks/SMOKE_CHECKLIST_WEEKEND_2026-04-18.md). |
| **L4 — Hardening** | Due sessioni, lock audit, licenze (`403 MODULE_NOT_LICENSED`), refresh sessione, PWA offline (cache vs server) | Dopo modifiche a `auth`, `moduleLicense`, `syncService`, `IndexedDB`, lock. |
| **L5 — E2E / browser** (backlog prodotto) | Flussi completi su Netlify preview o staging | Pianificato in roadmap; non sostituisce L1–L4. |

### Matrice smoke robustezza (checklist manuale ripetibile)

Spuntare dopo deploy o prima di demo cliente. Adattare profondità al rischio della release.

| Area | Verifica minima | Note / rischio |
|------|-----------------|----------------|
| **Auth / sessione** | Login, `/auth/me`, operazione autenticata, logout | Token refresh senza aggiornare `licensed_modules` in UI se non previsto fix. |
| **Licenze moduli** | Org con licenza parziale: menu + `LicensedRoute` + chiamata API modulo disabilitato → **403** codice `MODULE_NOT_LICENSED` | Allineamento route backend vs voci menu ([roadmap — checklist licenze](PROJECT_ROADMAP.md)). |
| **RBAC / studio** | Due utenti stesso tenant, `auditor_org` diversi: A non apre audit/B con id noto (GET/PUT/sync/allegati) | Vedi [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) sez. 5–7. |
| **Multi-tenant** | Utente org A: nessun dato org B in liste principali | Isolamento query. |
| **Sync / audit** | Modifica audit → sync o reload → coerenza con server | `server-wins` su campi critici. |
| **Export Word** | Un audit reale: sezioni, allegati link, pending issues se applicabile | Mojibake, VERIFICATORE, logo. |
| **Import PDF (Sprint 9)** | Job + process + (opz.) AI extract con chiave | Licenza `ai_import`, privacy testo. |
| **Admin** | CRUD utente o licenze come da ruolo | Solo admin/superadmin senza scope errato. |

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
| **Licenze moduli (Sprint 8)** | Colonna `organizations.licensed_modules` (JSON array di chiavi modulo; **NULL** = tutti i moduli attivi, retrocompatibile). API: `GET/PATCH /admin/licenses` (solo admin/superadmin org). Backend: `moduleLicense.service.js`, `requireLicensedModule` su documenti/allegati doc, NC, rischi, qualifiche, reclami+fornitori, notifiche. Login e `GET /auth/me` includono `licensed_modules`. Frontend: `LicensedRoute.jsx`, pagina **Impostazioni → Licenze moduli** (`/settings/licenses`), sidebar filtra voci senza licenza. Deploy VPS: `run-migration-037.js` + copiare service/middleware/controller/routes interessati + `server.js` (mount API su `/complaints` e `/suppliers`) + restart. |
| **Licenze: admin salva ma UI non cambia** | Dopo `PATCH /admin/licenses` la sessione locale deve aggiornare `user` con `GET /auth/me`: usare `refreshUser()` da `AuthContext` (chiamato da `LicensesSettingsPage` dopo salvataggio). **Altri utenti** della stessa org: niente push automatico; vedono i moduli aggiornati al **prossimo login** o al **refresh token** / nuova chiamata `/auth/me` — documentare messaggio in UI (vedi roadmap Sessione A). |
| **Import PDF batch (Sprint 9)** | Tabelle `import_jobs`, `import_job_files`; API `GET/POST/PATCH/DELETE /import-jobs`, upload `POST .../files` (multipart `files`), `POST .../process` usa `pdf-parse` + `confidenceFromTextLength` (euristica). **`POST .../files/:fileId/ai-extract`**: estrazione JSON strutturata via OpenAI sul testo già estratto (richiede `OPENAI_API_KEY` sul server; rate limit dedicato). Colonne file: `ai_extraction_json`, `ai_extraction_error`, `ai_extraction_at`, `ai_model` (migrazione **039**). Licenza modulo **`ai_import`**. UI admin: **Impostazioni → Import PDF** (`/settings/import-jobs`). Deploy VPS: `run-migration-038.js` + **`run-migration-039.js`**, **`npm install`** nella cartella backend (dipendenza `pdf-parse`), copiare `importJobs.controller.js`, `importJobs.routes.js`, `importPdfText.js`, **`importAiExtraction.service.js`**, `server.js`, `moduleLicense.service.js` + restart. **Privacy**: il testo inviato all’API è lo stesso mostrato in schermata revisione; valutare accordo/DPA OpenAI per l’organizzazione. |
| **Confine ingest vs workflow commerciale** | Sprint 9 = **solo ingest** (testo da PDF + revisione). Il **riesame requisiti contratto** (stati, approvazioni, checklist §8.2) è modulo dedicato in roadmap (**Sprint 11**) con mini-specifica [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md). Il passaggio ingest → record documento tipizzato è **Sprint 10** (staging + commit umano), non da confondere con gli stati del caso commerciale. |
| **Numerazione report audit (formato Mason)** | Alla creazione (`POST /audits` e sync create) il backend assegna `audit_number` come **`PREFISSO-YYMMDD-NN`** (es. `MSN-260417-01`): giorno calendario **Europe/Rome**, contatore atomico per org+prefisso+giorno (`audit_daily_sequences`, migrazione **040**). Prefisso: colonna **`organizations.audit_report_prefix`** (NULL = default `MSN`). Deploy VPS: `node backend/scripts/run-migration-040.js` (o SQL **040**) + script **`backend/scripts/deploy-controllers-to-vps.ps1`** (include già `auditNumberAllocation.service.js`, `audit.controller.js`, `sync.controller.js`) + restart. **Smoke read-only DB**: da `backend` con `NODE_ENV=production` → `node scripts/smoke-mason-db.js` (dopo almeno una creazione audit post-040 deve comparire almeno un numero Mason). |

**Deploy**: non copiare solo i controller; verificare `systemctl status sgq-backend.service`. **`/var/www/sgq-backend` sul VPS non è Git** — dopo `git push` va sempre aggiornata la copia file (script `deploy-controllers-to-vps.ps1` include anche `organization` + `auth` + `server.js` dove previsto) + restart `sgq-backend`. Dettaglio: `DEPLOY_CHECKLIST_RELEASE.md`. Dopo release lock: copiare anche `services/auditLock.service.js` e `controllers/auditLock.controller.js`.

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
| Template ISO al posto del Verbale | `generateDocxBlob`: ramo `isCustomChecklist` + fallback `TEMPLATE_MAP.custom_checklist`. |
| Tabelle fuori margini | `w:tblInd` negativo → `normalizeNegativeTableIndentsInZip`; script `app/scripts/fix-verbale-table-margins.js`. |

**Template**: fallback `app/public/templates/Verbale_di_riunione_QTAFI_VIS001.docx`. Se `getReportTemplate` restituisce URL (anche `/uploads/...`), quello ha priorità. **Repro** (`repro-custom-export.mjs`): solo file in `public/templates`, senza resolver API.

**Script utili**: `fix-verbale-template-xml.js`, `verify-template-repair.js`. Marker: `CHECKLIST_MARKER`, `RILIEVI_MARKER`. Dettaglio placeholder: [ISTRUZIONI_PLACEHOLDER_TEMPLATE_WORD.md](ISTRUZIONI_PLACEHOLDER_TEMPLATE_WORD.md).

---

## C. Database e repro

- `development` in `database.json` = DB di lavoro (vedi `DATABASE.md`). `test` = `localhost:1433` (spesso assente).  
- Lo script repro normalizza `NODE_ENV=test` → `development` prima del pool.  
- Comandi: vedi sezione **D** sotto.

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

### Pipeline AI import documenti

Ogni documento normativo ha struttura definita dalla norma → estrazione deterministica possibile:

```
Upload PDF (batch) → rilevamento tipo → estrazione testo (pdf-parse / OCR Tesseract)
  → LLM structured extraction (schema Zod per tipo) → preview con confidence score
  → validazione utente (campi incerti evidenziati) → commit DB
  → record in stato 'ai_draft' → diventa 'active' solo dopo conferma umana
```

**Regola golden**: solo record con `import_status = 'active'` o `'verified'` appaiono negli elenchi ufficiali e nelle esportazioni per enti certificatori.

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
4. Decidere se procedere con **Sprint 10** (staging → document registry) o altro.

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
- [ ] `DATABASE.md` / `database.json`: segreti — non in chat; ruotare se esposti.
- [ ] Opzionale: `ExecStartPre` systemd non bloccante (vedi note deploy).
- [ ] Eliminare branch remoto `docs/case-study-01-chiusura` (già mergiato in `main`).

---

## File spesso toccati (Word + export)

`wordExport.js`, `wordExportHelpers.js`, `ExportPanel.jsx`, template Verbale in `public/templates/`, `repro-custom-export.mjs`.

---

*Regola per l’AI: aggiornare **questo file** invece di aggiungere `SESSION_NOTES_*.md`. Memoria sintetica anche in `.cursor/rules/sgq-operating-memory.mdc`.*

---

**Cursor — regola utente**: se nelle impostazioni è ancora scritto “leggi `SESSION_NOTES_20260301`”, sostituiscilo con **`docs/GUIDA_CONSOLIDATA.md`**.
