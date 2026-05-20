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

**Percorsi workspace (Windows)** — `C:\ProgettoISO` non è “un progetto diverso” dal repo su disco: sui PC configurati così è di solito una **junction verso Google Drive** (`G:\Il mio Drive\...`). Una cartella omonima sotto **OneDrive** può invece essere un **checkout separato**. Dettaglio e regole operative: sezione *Percorsi di lavoro locale* in **[../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)**.

**Storico sessioni** (feb–mar 2026): cartella [archive/sessions/](archive/sessions/) — solo consultazione, non aggiornare.


---

## Indice rapido

| Area | Sezione |
|---|---|
| Encoding / caratteri corrotti | [Playbook encoding](#playbook-riutilizzabile--caratteri-non-riconoscibili-ufffd--tofu-in-ui) |
| Assistente AI 503 | [Playbook AI 503](#sessione-20-maggio-2026--errore-generico-ai-server-temporaneamente-non-disponibile) |
| WebDAV Office round-trip | [Playbook WebDAV](#playbook-riutilizzabile--webdav-office-round-trip) |
| Rate limit / 429 loop | [Playbook 429](#playbook-riutilizzabile--rate-limit-429-da-setinterval) |
| PWA / microfono / Permissions-Policy | [Playbook PWA](#playbook-riutilizzabile--pwa--microfono--permissions-policy-netlify) |
| Principi di documentazione | [Sezione](#principi-di-documentazione-chiarezza-e-best-practice) |
| Piano qualità / piramide test | [Sezione](#piano-qualit%C3%A0-fasi-di-sviluppo-e-test-di-robustezza) |
| Architettura sync ADR-008 | [Sezione](#architettura-target-sync--event-sourced-adr-008) |
| Deploy VPS (checklist A) | [Sezione A](#a-checklist-custom-sync-deploy-vps) |
| Word export (checklist B) | [Sezione B](#b-report-word--checklist-custom-verbale) |
| Comandi rapidi (checklist D) | [Sezione D](#d-comandi-di-verifica-rapida) |
| Sessioni archiviate (riferimento) | [maggio 2026](archive/sessions/SESSIONI_MAGGIO_2026.md) · [mar–apr 2026](archive/sessions/SESSIONI_MARZO_APRILE_2026.md) |

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

#### Checklist operativa (ordine consigliato)

1. **Trovare il file** (cerca stringa spezzata nel repo; React DevTools sul testo).
2. **Validare UTF-8** su `app/src` / `backend/src`: script `backend/scripts/check-utf8-encoding.js` (walk file + segnalazioni).
3. **Correggere:** lettere italiane corrette **oppure**, per robustezza, **escape Unicode** in stringhe JS (`conformit\u00E0`, `pi\u00F9`, … — stesso effetto a video). Per separatori **visibili**: preferire **ASCII** (`/`, ` - `) o **SVG**; evitare in UI critica `›` ed em dash lungo se non necessari.
4. **Verifica:** `vite build` in `app/`; se toccato export Word, `vitest` su `wordExport.placeholders.test.js` (nota: i placeholder possono stare in `word/header2.xml`, non solo `header1.xml`).
5. **Rilasciare:** commit + push; dopo deploy Netlify **hard refresh** (Ctrl+Shift+R) o aggiornamento PWA.

#### Riferimenti vincolanti

- Regola Cursor: `.cursor/rules/sgq-encoding-quality.mdc`
- Esempio di batch chiuso su `main`: commit `a5e7876` (maggio 2026), con deploy Netlify e verifica post-cache.

---

### Sessione 20 maggio 2026 — Errore generico AI "Server temporaneamente non disponibile"

#### Causa root
`proxy_intercept_errors on` + `error_page 502 503 504 = @backend_down` in Nginx intercettava **tutti** i codici 503 provenienti da Express — inclusi i 503 deliberati del controller AI (Gemini momentaneamente sovraccarico). L'utente vedeva sempre il messaggio generico di Nginx invece del motivo reale.

#### Fix applicati (PR #55)
1. **Nginx VPS** — rimosso `503` dalla lista: `error_page 502 504 = @backend_down` (backup: `.bak.20260520`).
2. **`aiAssist.controller.js`** — errori Gemini mappati a messaggi italiani; upstream errors usano HTTP 500 (non 503) per evitare intercettazione Nginx.
3. **`req.user.id` → `req.user.user_id`** — auth middleware JWT usa `user_id`, non `id`.
4. **Migrazione 071** — tabelle `ai_feedback` e `ai_interactions` create (erano assenti → DB error ad ogni click Accetta/Scarta).

#### Regola nuova: errori HTTP nei controller AI
**Non usare 503** per errori runtime dell'app (Gemini down, timeout, quota). Usare **HTTP 500** con messaggio italiano. Riservare 503 SOLO per "provider non configurato" (`AI_NOT_CONFIGURED`), che è un errore di setup non intercettabile dal Nginx corretto.

#### Percorso diagnosi (da replicare in futuro)
Quando un endpoint restituisce un messaggio che NON è in nessun file del repo:
1. Controllare `grep -rn 'parola' /var/www/sgq-backend/src/` — se assente...
2. Controllare il **body size in bytes** nel Nginx access log
3. Cercare in `/etc/nginx/sites-available/` se Nginx ha `return 503 '...'` custom
4. Verificare `proxy_intercept_errors` nella config Nginx

#### Tabelle AI (migration 071 — già eseguita)
| Tabella | Uso |
|---|---|
| `ai_feedback` | Feedback utente (accepted/rejected/rephrased) per personalizzazione |
| `ai_interactions` | Audit trail ogni chiamata AI (provider, model, tokens, latency) |

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

### Playbook riutilizzabile — WebDAV Office round-trip

**Quando usare**: Word Desktop su Windows non apre il file in modifica, mostra dialog credenziali, apre in sola lettura, o le modifiche non vengono salvate.

**Regola chiave — token nel PATH (non in query string)**:
- Prima: `https://host:8443/webdav/orgId/docId/file.docx?dt=TOKEN`
- Dopo: `https://host:8443/webdav/dt/TOKEN/orgId/docId/file.docx`
- Motivazione: `Microsoft-WebDAV-MiniRedir` (client nativo Windows) scarta i query parameter. Il token nel path viene preservato da tutte le operazioni WebDAV.

**Regola autenticazione**:
- Solo `PUT` richiede auth completa — protegge la scrittura
- `PROPFIND`, `HEAD`, `OPTIONS`, `LOCK`, `UNLOCK` accettano richieste senza token (metadata read-only, scoped a `orgId+docId` per multi-tenant)
- `mode: 'edit' | 'read'` nel tokenStore — solo `edit` permette PUT; `read` restituisce 403

**Regola CORS**:
- Le OPTIONS WebDAV non devono essere intercettate dal middleware `cors()` di Express — altrimenti Office non riconosce il server come scrivibile
- Fix: wrapper Nginx che bypassa CORS per `OPTIONS /webdav/*`

**Viewer .docx browser-native**: libreria `docx-preview` (chunk lazy-loaded) — non richiede Microsoft Cloud, funziona con porte non standard come `:8443`. Per `.pdf`: iframe. Per `.xlsx`: fallback Office Online Viewer (inaffidabile con :8443).

**Lifecycle documenti**: Word → `status='bozza'` → utente clicca "Rilascia revisione" → `status='rilasciato'`. Le cartelle (`doc_type='folder'`) non seguono questo lifecycle.

**Dettaglio completo**: [SESSIONI_MAGGIO_2026.md](archive/sessions/SESSIONI_MAGGIO_2026.md) sezione "16 maggio 2026 sera".

---

### Playbook riutilizzabile — Rate limit 429 da setInterval

**Sintomo**: un utente vede "Troppe richieste" continuamente; tutte le API del sito bloccate.

**Causa**: un `setInterval` / heartbeat chiama un'API ogni pochi secondi → riceve 429 → **non gestisce il 429** → continua a chiamare → esaurisce il budget rate limit → loop infinito che blocca tutto.

**Regola**: ogni `setInterval` / `setTimeout` che chiama API **deve** gestire 429 con backoff esponenziale o skip silenzioso al ciclo corrente. Mai ignorare 429 lasciando il timer attivo a intervallo fisso.

**Diagnosi rapida**:
```bash
sudo grep 429 /var/log/nginx/access.log | grep IP_UTENTE | tail -30
```

**Fix applicato (18/05/2026)**: heartbeat lock ignora 429 (riprova al ciclo successivo 60s); retry pending_server usa backoff su 429 (5s→120s max); rate limit alzato da 500 a 1000 req/15min.

---

### Playbook riutilizzabile — PWA / microfono / Permissions-Policy Netlify

**Quando**: funzione browser (microfono, camera) non funziona su PWA Netlify anche con permessi Android/Chrome concessi.

**Primo passo obbligatorio** — verificare header HTTP:
```bash
curl -sI "https://systemgest.netlify.app/" | grep -i permissions-policy
```
- `microphone=()` → BLOCCO TOTALE (nessun dialog mostrato mai)
- `microphone=(self)` → corretto

**File da correggere**: `netlify.toml` → `Permissions-Policy`.

**Sequenza SpeechRecognition Chrome Android**:
1. `navigator.permissions.query({ name: "microphone" })` — se denied, messaggio e stop
2. `navigator.mediaDevices.getUserMedia({ audio: true })` — forza dialog consenso nativo
3. Libera la stream, poi `recognition.start()`

**Nota Netlify**: modificare solo `netlify.toml` (headers) aggiorna la CDN senza ricompilare il bundle JS.

**Dettaglio completo**: [SESSIONI_MAGGIO_2026.md](archive/sessions/SESSIONI_MAGGIO_2026.md) sezione "14-15 maggio 2026".

---

### Sessioni maggio 2026 — altre lezioni chiave

| Data | Argomento | Lezione |
|---|---|---|
| 20/05 | AI 503 Nginx | Vedere playbook sopra (separato) |
| 16/05 | AI context builder | DB queries nel builder sono in try/catch — graceful degradation. ADR-010. |
| 12-15/05 | NC / pending issues | Migration 052 nc_audit_integration. Cascade modale. |
| 09/05 | Validazione checklist | Fix guided close; schema validazione `required` campi |
| 08-09/05 | Multi-standard sync | ADR-009 multi-standard; 6 fix consecutivi 4h (vedere archivio) |
| 07-08/05 | Checklist non inizializzata | Bug su passaggio device: 3 livelli fix (server+IDB+tombstone) |
| 07/05 | Sync T3 | `VITE_SYNC_MODE=events` feature flag; produzione usa `legacy` (default). |

**Archivio completo**: [SESSIONI_MAGGIO_2026.md](archive/sessions/SESSIONI_MAGGIO_2026.md)

---

### Workspace consigliato — ponte `C:\ProgettoISO` (Cursor / terminale)

Per **non dipendere dalla lettera disco di Google Drive** e mantenere stabile il percorso visto da Cursor (chat, indici, terminale):

- Usare una cartella fissa su disco locale, es. **`C:\ProgettoISO`**, come **workspace del progetto**.
- I file possono restare fisicamente su **Google Drive** (o altra unità): si crea un **collegamento simbolico (symlink)** o una **junction** da `C:\ProgettoISO` verso la cartella reale sul cloud. Se Drive cambia lettera o percorso, si **aggiorna solo il ponte**, non la configurazione di Cursor.
- Eseguire sempre **`git`**, **`npm run test:run`**, **`npm run build`** dalla root **`C:\ProgettoISO`** (evita doppi checkout dello stesso repo su `C:` e su unità cloud contemporaneamente).

### Artefatti IDE e `.gitignore`

- Cartelle **machine-specific** da non versionare: `.vscode/`, `.idea/`, **`.vs/`** (cache/layout Visual Studio) — tutte in **`.gitignore`** alla radice.
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
| DB staging creato (copia schema, dati anonimi) | Admin sistema | [DATABASE.md](DATABASE.md) sezione "Ambienti" | ☐ |
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
| **RBAC / studio** | Due utenti stesso tenant, `auditor_org` diversi: A non apre audit/B con id noto (GET/PUT/sync/allegati) | Vedi [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) sez. 5–7. |
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

### DataGrid universale — requisiti del componente

Il componente `<DataGrid />` deve essere riutilizzabile per tutti i moduli:
- Colonne configurabili (testo, data, badge colorato, semaforo scadenza, link)
- Ordinamento e filtri per colonna
- Paginazione server-side (per grandi dataset)
- Export Excel (libreria: `xlsx` / SheetJS — già compatibile browser)
- Selezione multipla + azioni batch
- Slot per azioni riga (modifica, elimina, download PDF originale)

---

---

### Sessioni marzo–aprile 2026 — lezioni chiave archiviate

| Data | Argomento | Lezione |
|---|---|---|
| 28/04 | Perdita dati Camellini | Causa → ADR-008 Event-Sourced Sync. Lock heartbeat + 409 "stato corrente intero" |
| 24/04 | Pending issues + NC | Tabella `pending_issues` FK NO ACTION; migration 018 |
| 22/04 | Stabilizzazione sync | SYNC-1/2/3/4 fix; debounce hydrate su cambio audit |
| 21/04 | Word ISO 3834 + foto | Toggle `embedPhotos`; placeholder `{ispettore}`, `{fornitoreIndirizzo}` |
| 21/04 | Sicurezza / qualità | Helmet CSP; strip console.log in prod (`clientLogger.js`); source map off |
| 19/04 | RBAC lista audit | `auditListRbac.service.js`, `studioScopeClause`; deploy richiede script VPS |
| 27-28/03 | Word VERIFICATORE + mojibake | `fixWordXmlMojibake`; logo embed; template ISO45001 aggiunto |
| 21/03 | NV vs N.A. Word | Tabella `RILIEVI_MARKER` — colonne separate NV / N.A. |

**Archivio completo**: [SESSIONI_MARZO_APRILE_2026.md](archive/sessions/SESSIONI_MARZO_APRILE_2026.md)

---


## File spesso toccati (Word + export)

`wordExport.js`, `wordExportHelpers.js`, `ExportPanel.jsx`, template Verbale in `public/templates/`, `repro-custom-export.mjs`.

---

*Regola per l’AI: aggiornare **questo file** invece di aggiungere `SESSION_NOTES_*.md`. Memoria sintetica anche in `.cursor/rules/sgq-operating-memory.mdc`.*

---

**Cursor — regola utente**: se nelle impostazioni è ancora scritto “leggi `SESSION_NOTES_20260301`”, sostituiscilo con **`docs/GUIDA_CONSOLIDATA.md`**.


