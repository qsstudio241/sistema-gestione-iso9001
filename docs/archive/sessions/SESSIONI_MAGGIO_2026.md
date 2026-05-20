# Archivio sessioni — Maggio 2026

> File di archivio generato automaticamente il 20/05/2026. Contiene le sessioni narrative da maggio 2026 spostate dalla GUIDA_CONSOLIDATA per ridurne le dimensioni. Consultare solo per riferimento storico.

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
  - `.xlsx` → fallback Office Online Viewer (Microsoft)

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
2. **Excel viewer**: attualmente "Visualizza" su `.xlsx` cade su Office Online Viewer
   (inaffidabile con porta 8443). Da valutare libreria browser-side equivalente a
   docx-preview per Excel (es. `xlsx-preview` o `sheetjs` + custom renderer).
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

- **Diagnosi autonoma con Playwright MCP**: per verificare header HTTP di produzione senza accesso fisico al device → `curl -sI https://[sito]/ | grep -i permissions-policy`. Per verificare se il bundle Netlify è aggiornato → fetch dell'index.html + search nel bundle JS per stringhe note. Credenziali login: usare `SGQ_APP_EMAIL` / `SGQ_APP_PASSWORD` env vars + `browser_run_code_unsafe` con script in `/workspace/.playwright-mcp/`.

- **Netlify può aggiornare gli header CDN (`netlify.toml`) senza ricompilare il bundle JS.** Se si cambia solo `netlify.toml` → header live in pochi minuti; bundle invariato. Se si cambia codice in `app/` → bundle nuovo hash al prossimo deploy completo.



**Branch**: `cursor/adr-010-ai-agentic-architecture-7330` → mergiato su `main` (commit `49a6a6c`).

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

#### Smoke test E2E — da completare

- ⏳ Login su `https://systemgest.netlify.app` → menu SGQ → "Riesame Requisiti" → creare caso → incollare capitolato → lanciare analisi AI → verificare suggerimenti
- Credenziali test: `admin@sgq.local` / `Sistemi@2026` (superadmin, org 1001)

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
- **SQL reserved keywords**: alias come `open`, `closed`, `status` possono causare errori oscuri su SQL Server anche senza essere in posizione keyword esplicita. Usare sempre prefissi descrittivi: `count_open`, `count_closed`, `count_in_progress`.
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
   - Salvataggio in document_registry + norm_document_sources come fonte AI
   - Prevenzione duplicati (verifica titolo/standard_code)
   - UI: pulsante "Carica Norme" nella cartella NORME E LEGGI (vista Albero)

4. **Verifica validità norme**
   - Servizio normValidityChecker interroga catalogo UNI settimanalmente
   - Se edizione superata: flag validity_status = 'superata'
   - Job cron ogni lunedì alle 03:00

### Migrazioni DB applicate
- 055_ai_feedback.sql — tabella feedback personalizzazione
- 060_norm_document_sources.sql — fonti normative da documenti caricati

### Lezioni apprese
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
4. **Alert Engine VPS preparato**: installati `nodemailer@^8.0.7` e `node-schedule@^2.1.1` in `/var/www/sgq-backend`; aggiunto blocco SMTP placeholder nel `.env` VPS con `ALERT_ENABLED=false`. Per attivare: compilare `SMTP_HOST/PORT/USER/PASS/FROM` + impostare `ALERT_ENABLED=true` nel `.env` e riavviare il servizio.

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
2. `scp` dello script sul VPS via `$SGQ_SSH_KEY_B64`
3. `ssh` + `node /tmp/run-migration-NNN-vps.js`
- **Nota SQL Server**: `ON DELETE SET NULL` in FK non è sempre supportato. Verificare con istruzione separata prima di aggiungere clausole ON DELETE/UPDATE.

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

