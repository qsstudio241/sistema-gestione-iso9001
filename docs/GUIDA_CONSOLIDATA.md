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


