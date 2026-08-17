# Guida consolidata — SGQ ISO 9001

> **Unico documento di esperienza operativa** da aggiornare quando cambia il comportamento del sistema (deploy, Word, DB, sync) **o** le regole di verifica/release (smoke, licenze, DoD).  
> **Non creare** nuovi `SESSION_NOTES_YYYYMMDD.md`: si aggiorna questo file + `PROJECT_ROADMAP.md`.

## Indice rapido (navigazione)

| Sezione | Contenuto |
|---------|-----------|
| [Inizio sessione](#cosa-leggere-a-inizio-sessione-ordine) | Ordine di lettura file progetto |
| [**Cloud Agent / context window**](#cloud-agent-cursor--ambiente-e-context-window) | environment.json, AGENTS.md, policy costi |
| [**Check prodotto Mobile + AI**](specs/PRODUCT_CHECK_MOBILE_AI.md) | Priorità moduli in campo, AI affidabile (citazioni), slice M-AI-1…6 |
| [**Lezioni apprese (fonte unica)**](archive/sessions/GUIDA_DIARIO_2026.md#lezioni-apprese-consolidate-fonte-unica) | Indice regole operative + link al dettaglio |
| [Metodo di lavoro (slice + multitasking)](../.cursor/rules/sgq-workflow-method.mdc) | Regola `.cursor`: slice, parallelizzazione, worktree, triage PR |
| [Deploy (hub)](how-to/deploy.md) | Ingresso unico release Netlify + VPS |
| [Manuale NC + Canvas](how-to/MANUALE_UTENTE_NC.md) | Registro non conformità — guida utente e canvas interattivo Glass |
| [Libreria UI SGQ](reference/LIBRERIA_UI_SGQ.md) | Catalogo componenti UI, duplicati, matrice moduli (~55% copertura Fase A) |
| [Principi documentazione](archive/sessions/GUIDA_DIARIO_2026.md#principi-di-documentazione-chiarezza-e-best-practice) | Dove scrivere cosa, cosa evitare |
| [Piano qualità / test](archive/sessions/GUIDA_DIARIO_2026.md#piano-qualità-fasi-di-sviluppo-e-test-di-robustezza) | DoD, piramide L1–L5, smoke |
| [Procedura chiusura autonoma](archive/sessions/GUIDA_DIARIO_2026.md#procedura-chiusura-autonoma) | Ciclo slice agente: fix, test, smoke, doc, limiti |
| [Sync ADR-008](archive/sessions/GUIDA_DIARIO_2026.md#architettura-target-sync--event-sourced-adr-008) | Event-sourcing, regole sync |
| [**A** — Checklist, sync, deploy](#a-checklist-custom-sync-deploy-vps) | Procedure operative principali |
| [**B** — Word Verbale](#b-report-word--checklist-custom-verbale) | Export OOXML / template |
| [**C** — Database e repro](#c-database-e-repro) | Script SQL, repro bug |
| [**D** — Verifica rapida](#d-comandi-di-verifica-rapida) | Comandi curl/test |
| [**D bis** — Catalogo smoke](#d-bis-catalogo-smoke-harness) | Script test/smoke CI e ops |
| [**E** — SAL / import / RAG](#e-flusso-2--sal--sopralluoghi--evidenze-documentali--import--rag-retrieval) | Flusso documentale avanzato |
| [**F** — Architettura piattaforma](archive/sessions/GUIDA_DIARIO_2026.md#f-architettura-unificata-della-piattaforma-sessione-05042026) | Visione moduli unificati (archivio) |
| [File Word spesso toccati](archive/sessions/GUIDA_DIARIO_2026.md#file-spesso-toccati-word--export) | Path sorgenti export |

Sessioni archiviate (consultazione): [GUIDA_DIARIO_2026.md](archive/sessions/GUIDA_DIARIO_2026.md)

---

## Hostname VPS (31/07/2026)

Dominio backend/SSH: **`sistemi.fr-busato.it`** (percorso: `www.fr-busato.it` → `busato.selfip.com` → `sistemi.fr-busato.it`).  
**Sessione chiusa** — PR [#337](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/337) MERGED su `main`.

| Cosa | Stato |
|------|--------|
| Certificato TLS Let's Encrypt | ✅ Emesso `CN=sistemi.fr-busato.it` (scade 2026-10-29); nginx punta a `/etc/letsencrypt/live/sistemi.fr-busato.it/` |
| Health HTTPS trusted | ✅ `curl https://sistemi.fr-busato.it:8443/api/v1/health` (senza `-k`) |
| Repo (codice/doc) | ✅ PR #337 |
| Netlify `VITE_API_URL` | ✅ prod / preview / branch / dev → `sistemi.fr-busato.it` |
| GitHub secret `SMOKE_ENDPOINT` | ✅ `sistemi.fr-busato.it:8443` |
| Locali gitignored (PC) | ✅ tipici: `backend/config/database.json`, `backend/.env`, `backend/config/.ssh-deploy.local.ps1`, `app/.env.production` — **mai in Git** |
| VPS `.env` | ✅ WEBDAV già `sistemi`; commenti SSL aggiornati; `DB_SERVER=localhost` invariato; no restart per solo hostname |
| PuTTY SSH `:1122` | ✅ sessione OK; al primo collegamento **Accept host key** se fingerprint nuovo |
| Cursor Cloud Secrets | tipicamente niente (host non nei secret) |
| Rinnovo automatico LE | DNS-01 manuale: renew unattended richiede di nuovo TXT (o HTTP-01 se WAN:80 → VPS). Hook: `/usr/local/sbin/acme-dns-auth.sh` |
| Alias `busato.selfip.com` | Opzionale; certificato **non** lo include (name mismatch in browser) |

**Lezione:** un cambio hostname non è solo repo — aggiornare in parallelo locali gitignored, Netlify, GitHub smoke secret, URL pubblici sul VPS, e host key PuTTY. Non committare secret.

---

## Cosa leggere a inizio sessione (ordine)

**Fonte vincolante:** [`AGENTS.md`](../AGENTS.md) (dieta). Non usare l'elenco sotto come avvio obbligatorio.

1. **[`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md)** — bussola moduli.  
2. **[`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) solo § Stato attuale** — non banner storico né backlog lungo.  
3. Brief `DEPUTYTASK*.md` + 2–4 file della bussola.  
4. **Questo file** — **solo la sezione** del task (deploy, Word, sync, encoding, lezione citata). Vietato leggerlo per intero «per orientarsi».  
5. Deploy: **[how-to/deploy.md](how-to/deploy.md)**. Slice non chiusa: **[HANDOFF_TEMPLATE.md](agent-tasks/HANDOFF_TEMPLATE.md)** nel brief attivo.

**Percorsi workspace (Windows)** — `C:\ProgettoISO` non è “un progetto diverso” dal repo su disco: sui PC configurati così è di solito una **junction verso Google Drive** (`G:\Il mio Drive\...`). Una cartella omonima sotto **OneDrive** può invece essere un **checkout separato**. Dettaglio e regole operative: sezione *Percorsi di lavoro locale* in **[../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)**.

**Storico sessioni** (feb–mar 2026): cartella [archive/sessions/](archive/sessions/) — solo consultazione, non aggiornare.

> **Come è organizzato questo file.** In alto: le **lezioni apprese consolidate** + i **principi** + il **piano qualità/metodo** + le **procedure A–E**. Il diario sessioni è in [archive/sessions/GUIDA_DIARIO_2026.md](archive/sessions/GUIDA_DIARIO_2026.md). Metodo: [`.cursor/rules/sgq-workflow-method.mdc`](../.cursor/rules/sgq-workflow-method.mdc).

---

## Lezioni apprese consolidate (fonte unica)

> Indice unico delle lezioni operative: ogni riga è una **regola da applicare** + un link al dettaglio (sessione o doc). Quando emerge una nuova lezione, aggiungerla **qui** (sintesi) e linkare il dettaglio cronologico più sotto — non duplicare il racconto.

### Architettura UI e form

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **ISO 3834 = processi §5–18, non pagine (15–16/08/2026)** — WPS/WPQR/qualifiche/commesse/RDP ci sono; il gap è ponti + RBAC + report. HITL: niente blocco §5.3; Word RDP Mason; livello 2/3/4 = meno schermate *dopo*, partenza senza filtri; certificati **base e apporto** = stessa griglia DDT + anagrafica (epic MC, ingest qualifiche/WPQR + OCR). | Non aprire un CRUD 3834 per 3.1/consumabili. Elenco MC = `SgqDataGrid` come Qualifiche, colonna Ruolo `base`\|`filler`. DDT in griglia (compilabile dopo l’upload). | [PLAN](agent-tasks/PLAN_3834_SLICES.md) · [PLAN MC](agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md) · [DATA_MODEL](specs/MATERIAL_COMPLIANCE_DATA_MODEL.md) · [gap 15/08](gap-reports/GAP_RDP_3834_2026-08-15.md) |
| **Ingest rischi M03 = detect → conferma → insert (15/08/2026)** — parser Excel (ADR-013) + **stesso guscio di qualifiche/WPQR**: `IngestDialogShell` + `IngestSourcePreview` (file a sinistra, mapping a destra). Non `ingest_staging`/AI. Non sovrascrive righe esistenti. Residuo P/G: o entrambi validi, o nessuno. | Riusare `IngestDialogShell` + `SpreadsheetViewer` embedded, non il solo overlay `did-*`. | `RiskM03ImportDialog.jsx` · ROO-6 · PR #429 |
| **Analisi rischi M03 = griglia, non card (14/08/2026)** — la superficie di lavoro §6.1 è la matrice Excel-like (`SgqDataGrid` theme `plain`); click riga apre il form esistente. Residuo P×G e nota efficacia sono colonne sulla stessa riga (`147`). Scala P/G resta 1–3. | Non reintrodurre le card come lista principale. Non allargare 1–4 senza HITL ROO-13. Temp. = `review_date` (niente `action_due_date` in questa slice). | [PLAN ROO](agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md) · `RisksPage.jsx` |
| **Form HTML annidati** — «Salva azione» nel drawer NC non persisteva (nessun POST nei log VPS, drawer si chiudeva senza errore). HTML vieta `<form>` dentro `<form>`: il browser ignora il form interno e il submit va a quello esterno. | **Mai annidare `<form>`.** Un componente contenitore che usa `<form onSubmit>` va convertito in `<div>` se contiene figli con propri form di salvataggio; i pulsanti interni devono essere `type="button"` con `onClick`. | [Sessione 07/06/2026 — NC notifiche + form annidati](archive/sessions/GUIDA_DIARIO_2026.md#sessione-07062026---nc-notifiche--form-annidati-chiusura-sessione) |
| **Pattern "Ambito" azienda — standard per tutti i moduli multi-azienda** | Quando un modulo mostra dati filtrabili per azienda, usare **sempre** il pattern Ambito: (1) utility `xxxCompanyScope.js` con `resolveInitial…`, `readStored…`, `persist…` su localStorage; (2) selettore `"Ambito:"` nell'**header** della pagina (non nella toolbar); (3) il `companyScope` alimenta lista, form e widget; (4) nel form il campo azienda è testo fisso "(da ambito)" se scope attivo, select libero altrimenti; (5) auto-selezione se l'org ha una sola azienda. **Non** usare dropdown azienda in toolbar né nel form come campo indipendente. Moduli già conformi: Qualifiche (`qualificationsCompanyScope.js`, `company_id` **NOT NULL** a DB — pattern più robusto del progetto), WPS/Saldatura, Registro documenti (`documentRegistryCompanyScope.js`), Riesame di Direzione (`managementReviewsCompanyScope.js`), SAL (`salCompanyScope.js`), Commesse ISO 3834 (`projectsCompanyScope.js`). Moduli con `filterCompany` in toolbar ancora da aggiornare: NC, NDT Reports, Attrezzature, Scadenzari. **Moduli senza alcun campo azienda in UI (gap più grave — creazione sempre `company_id NULL`, verificato 25/07/2026)**: Rischi (`RisksPage.jsx`), Reclami (`ComplaintsPage.jsx`) — il backend supporta già `company_id` e il filtro RBAC (`companyAccessSqlFilter`), manca solo il selettore in UI. **Nota**: anche Audit (il modulo preso a riferimento) accetta `company_id` nullo — in `AuditSelector.jsx` la select azienda ha un'opzione "inserimento manuale" che lascia `companyId=null`; solo `client_name` è obbligatorio. Lo standard "ambito sempre obbligatorio" oggi è rispettato solo da **Qualifiche**. | PR #154 · sessione 22/06/2026; analisi trasversale 25/07/2026 · Commesse: PR #303 |
| **RBAC `company_access` non applicato uniformemente al backend (gap trasversale verificato 25/07/2026)** | Il servizio centralizzato `companyAccess.service.js` (`assertMutatingAllowed`, `companyAccessSqlFilter`, tabella `user_company_access` — mig. 081) è usato da NC, Audit, Rischi, Reclami, Fornitori, Qualifiche, Riesami, Documenti, Saldatura — ma **non** da `equipment.controller.js`, `rdp.controller.js`, `ndtReports.controller.js`. Più grave: `equipment.controller.js` ha un proprio `buildScopeCondition()` basato su `user.company_id` — colonna che **non esiste** sulla tabella `users` (il modello reale multi-azienda è la tabella `user_company_access`, N:N). La condizione risulta quindi sempre vera per "vede tutto il tenant" anche per un viewer con permesso su una sola azienda: **Attrezzature non è segregato per azienda per nessun ruolo**. Fix raccomandato: migrare i 3 controller al pattern `companyAccess.service.js` già maturo, eliminando la condizione legacy in `equipment.controller.js`. | [ARCHITETTURA_UTENTI_RBAC.md §8.3](ARCHITETTURA_UTENTI_RBAC.md#83-cosa-manca-o-è-parziale-gap-noti) · analisi trasversale 25/07/2026 |
| **Colonna FK "morta" (nessuna FK, 0 righe) vs colonna già collegata — verificare sempre lo schema reale prima di fidarsi del controller (25/07/2026)** — `projects.controller.js` scriveva su `client_company_id` (nessuna migrazione la crea, nessun vincolo FK, 0 righe popolate in produzione — verificato con query diretta su `sys.foreign_keys`/`COUNT(*)`), mentre `projects.end_customer_id` (FK reale verso `company_counterparties`, aggiunta e già backfillata dalla migrazione 097) non era mai usato né da controller né da frontend. Il campo "Cliente" della commessa restava quindi testo libero, disconnesso dall'anagrafica aziende, nonostante l'infrastruttura DB fosse già pronta. | **Prima di estendere un modulo con un nuovo campo relazionale, verificare lo schema reale** (`sys.columns`/`sys.foreign_keys` via script diagnostico VPS), non solo il codice del controller: un campo referenziato nel codice può essere orfano (mai migrato, nessuna FK) mentre un altro campo già pronto in DB resta inutilizzato. Riusare sempre un servizio condiviso già testato (qui `commercialCustomerCounterparty.service.js`, già usato da Riesame Contratti) invece di reinventare la logica FK+snapshot testo. | PR #303 |
| **Riuso UI «blocco unico»** | Prima di creare un elemento UI, verificare se esiste già un componente/classe nel repo (tabella in `sgq-operating-memory.mdc`). Usare sempre l'esistente. | [Libreria UI SGQ](reference/LIBRERIA_UI_SGQ.md) |
| **DNA visivo + 3 schermate di riferimento (13/08/2026)** — gli agenti senza vincolo visivo inventano UI da landing (palette nuova, tre card con icona, form alfabetico). Il repo aveva già token e catalogo, ma **non erano nel boot di sessione**. | Se il task tocca JSX/CSS: leggere **prima** [`app/src/design-system/README.md`](../app/src/design-system/README.md) (voce prodotto, anti-pattern, gate). Copiare una delle 3 schermate: (1) shell `AppLayout`, (2) elenco+filtri `QualificationsPage`/`DeadlinesPage`, (3) scheda a fasi drawer NC. Non installare skill GitHub di design. | `AGENTS.md` passo 5 · `LIBRERIA_UI_SGQ.md` |
| **Ambito azienda unico in header (13/08/2026)** — i selettori Ambito per pagina si disallineavano (chiave localStorage diversa, default diverso, assenti su NC/NDT/RDP/Rischi/Reclami). | Un solo selettore in `AppLayout` (`CompanyScopeSelect` + `CompanyScopeContext`, chiave `sgq-app-company-scope`). I selettori di pagina **si eliminano**, non si spostano. **Le azioni (upload batch, Nuova qualifica, …) si conservano**: restano visibili, `disabled` + titolo se manca l'azienda — non smontarle. Default: personale studio → **Tutto lo studio** (ripristina ultima azienda se salvata, anche dalle chiavi legacy di pagina); utente con 1 azienda → quella, **non modificabile**; utente con 2+ aziende → solo le sue, mai "tutto lo studio". Registro: checkbox "Solo patrimonio studio" resta filtro del modulo (non è un'azienda). SAL/Gap analysis: se manca l'azienda, empty state "scegli Ambito in alto". Pulizia banner (solo etichetta + menu, niente nome/logo/P.IVA): **PR #414 mergiata**, verificato su produzione 14/08/2026 (login Playwright: testo banner `Ambito` + `Tutto lo studio`, nessun logo/P.IVA in quella riga). Menu personale studio: (1) Tutto lo studio (2) **Patrimonio dello studio** sempre (etichetta fissa; valore **sempre** `studio`, mai l'id dell'azienda omonima) (3) altre aziende A→Z. `Al.project` e `Ai.project` sono lo stesso nome (L/i). Utente `company_access`: non vede le due voci di studio. **Combobox digita-per-filtrare** (al posto del `<select>` nativo, che su Mason non filtrava): stessa riga Ambito + campo, stessi token `.layout-scope-select`, helper `buildScopeMenuOptions` / `filterScopeMenuOptions`. [PR #419](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/419) **mergiata**; bundle Netlify contiene `layout-scope-combo` / `layout-scope-listbox`. | `appCompanyScope.js` · `CompanyScopeContext.jsx` · **PR #401 mergiata** · banner [PR #414](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/414) mergiata · Patrimonio [PR #417](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/417) mergiata · combobox `CompanyScopeSelect.jsx` |
| **Patrimonio ≠ azienda omonima (15/08/2026)** — su Camellini `organization_name=QS_Studio` coincide con l'azienda «QS Studio» (id 48). `resolvePatrimonioScopeValue` restituiva `48`: Ambito «Patrimonio» mostrava l'albero ISO di quell'azienda, non le 6 cartelle STD (`content_scope=studio`, `company_id NULL`). Mason vedeva PATRIMONIO STUDIO perché su Ai.project non c'è omonima. | **Patrimonio vale sempre `studio`.** L'omonima esce dalla lista A→Z (non è un cliente) ma non è più il valore del menu. `sanitizeScopeAgainstCompanies` rimappa un id omonimo già salvato in localStorage verso `studio`. Il Registro Documenti non carica l'albero finché `scopeReady` (aziende caricate + remap), così un id 48 in localStorage non mostra per un attimo l'albero ISO. Albero studio e albero clienti restano due alberi distinti. Ricreare le 6 cartelle STD solo se zero documenti patrimonio: `backend/scripts/recreate-studio-patrimony-folders-vps.js` (`DRY_RUN=1` default; `ORG_IDS=1002 DRY_RUN=0` sul VPS). Non toccare le cartelle ISO per-azienda né i documenti clienti. Non ricreare org 1001 (ha 1 documento). | [PR #428](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/428) **mergiata** · verificato dal committente in produzione 15/08/2026 (Camellini: Patrimonio = 6 cartelle STD, clienti invariati) · sessione chiusa 15/08 · `appCompanyScope.js` · script VPS `recreate-studio-patrimony-folders-vps.js` |
| **Azioni gated da un controllo che si rimuove (13/08/2026)** — dopo Ambito unico (PR #401) il pulsante **Carica qualifiche (batch)** spariva su «Tutto lo studio»: era montato solo se `companyScope` era valorizzato, lo stesso gate del selettore di pagina. L'utente perde una funzione, non solo un filtro. | **Prima di togliere un controllo**, elencare le **azioni** che ne dipendono (upload, crea, genera). Il controllo si elimina; i pulsanti restano visibili, disabilitati con titolo «scegli Ambito in alto». Stesso trattamento su WPQR/WPS. Se esisteva una chiave localStorage di pagina, migrarla **una volta** nella chiave globale (non se l'utente ha già scelto esplicitamente Tutto lo studio). | **PR #408 mergiata** · test `qualificationUploadButton.test.jsx`, `batchUploadButtonsNoCompany.test.jsx`, `appCompanyScope.test.js` |
| **Claim visivo senza aprire la pagina (14/08/2026)** — l'agente ha scritto «la barra è solo Ambito + tendina» senza login. Prima del merge la produzione aveva ancora logo + Al.project + P.IVA; la prima preview era **vuota** (`CompanyScopeSelect` tornava `null` se `companies.length === 0`). I test L1 mockavano già le aziende, quindi erano verdi e ciechi. Dopo merge #414: produzione verificata a schermo (solo Ambito + tendina). | **Non dichiarare un layout** senza aprire la pagina (Playwright autenticato o test che monta `AppLayout`). Un test che mocka i dati «felici» non intercetta `return null` / lista vuota. **Non dire «è fatto» su produzione** se la PR è ancora aperta. Il menu Ambito deve restare visibile anche con lista aziende vuota. | **PR #414 mergiata** · test `appLayoutBanner.test.jsx`, `companyScopeSelect.test.jsx` |
| **JSX: sequenze `\u` literal** | Gli escape `\uXXXX` tra tag JSX finiscono a schermo come testo. Metterli **dentro una stringa JS** (`{"\u26A0\uFE0F …"}`). | [Aggiornamento 22/05/2026 — JSX `\u`](archive/sessions/GUIDA_DIARIO_2026.md#aggiornamento-22052026--jsx-sequenze-literal-u-in-ui-rischi--progetti--qualifiche) |
| **Primo click su «Salva» perso per spostamento di layout al blur (28/07/2026)** — sintomo identico ai form annidati (riga sopra): il pulsante sembra morto, nessuna richiesta di rete, nessun messaggio d'errore. Causa diversa: il blocco «Storico testo» di `RichTextField` veniva montato **solo al primo blur** del campo; il `mousedown` sul pulsante causa il blur, il blocco appare, i controlli sottostanti scendono di ~27px e il `mouseup` cade fuori dal pulsante → il browser **non emette `click`**, il form non invia nulla. Nei log nginx si vedono più POST ravvicinati (l'utente clicca ripetutamente). | **Nessun elemento deve comparire al blur sopra o prima di un pulsante d'azione.** Se un blocco condizionale (storico, hint, contatore, badge di validazione) si monta su `blur`/`focusout`, **riservare lo spazio da subito** (contenitore sempre renderizzato + `min-height`) oppure posizionarlo fuori dal flusso. **Diagnosi**: se un pulsante non risponde, verificare quali eventi arrivano davvero — `pointerdown`/`mousedown` presenti ma `mouseup`/`click` assenti = l'elemento si è spostato durante il click; misurare `boundingBox()` prima e dopo il blur. | PR #315 · test `richTextFieldHistorySlot.test.jsx` |
| **Qualifiche saldatori — "metodo di trasferimento" mancante, richiesta committente (28/07/2026)** — il committente ha chiesto spiegazione del concetto e segnalato che il form di compilazione qualifiche non permetteva di sceglierlo. Verifica normativa (non dedotta): ISO 9606-1 §5.2 tratta esplicitamente il transfer mode nell'eccezione di continuità processi ("qualifying the welder for dip (short-circuit) transfer mode (131, 135 and 138) shall qualify him for other transfer modes, but not vice versa") e §9.3 lo elenca come riga "Welding process(es); **Transfer mode**" nella tabella "Range of qualification" del modulo certificato ufficiale — quindi è un dato del patentino saldatore, non solo del WPS. Era già gestito come testo libero in WPQR (`welding.controller.js`, colonna `metal_transfer`) ma assente da schema/DB/form/ingest del modulo Qualifiche. | **Fix implementato**: nuova colonna `qualifications.transfer_mode` (NVARCHAR(20) nullable, migrazione **136**), select con 4 valori standard (spray_arc/pulsed_arc/short_arc/globular — più controllato del testo libero WPQR) in `QualificationForm.jsx`, visibile **solo** se il processo scelto è 131/135/136/138 (arco con filo continuo). Estesa `getApplicableWelderFields` (`weldingQualificationRules9606.js`, FE+BE) con `transferModeApplicable`, stesso pattern già usato per il diametro tubo condizionato al prodotto. Aggiornati schema AI (`documentTypeSchemas.js`), mapping ingest (`qualificationIngest.service.js`), controller create/update. **Scelta consapevole di non estendere**: la regola di continuità §5.2 (dip qualifica anche gli altri transfer mode) resta solo documentata in `ISO-9606-1-range-validita-patentino.md`, non implementata come logica di copertura automatica (`qualificationCoverage.js`) — l'intervento richiesto era la sola registrazione/estrazione del dato, non una modifica al calcolo del range di validità. | Migrazione 136 · `weldingQualificationRules9606.test.js`, `qualificationFormConditionalFields.test.jsx`, `qualificationIngest.service.test.js`, `qualifications.controller.test.js` |
| **Qualifiche — rimozione gate Approva/Rifiuta/Revoca, certificati già validi da ente terzo (28/07/2026)** — il committente ha chiarito che i patentini caricati sono attestati **già emessi e validi** da un ente accreditato (TEC Eurolab/Accredia): il modulo serve solo a estrarre/interrogare i dati, non a gestire un workflow di certificazione interno. Prima di rimuovere «Revoca» andava verificato **se esisteva già** un controllo automatico basato su date equivalente, perché "Revoca" non era solo un gate sui dati inseriti ma l'unico modo per escludere dalla copertura ISO 3834 un saldatore con **conferma semestrale scaduta** (obbligo ISO 9606-1/14732) anche a certificato non scaduto. Verifica: `getCoverage` e `caseExtractedCoverage.service.js` filtravano solo `expiry_date`, **non** `next_confirmation_due` → senza intervento, rimuovere "Revoca" avrebbe fatto rispondere "sì, saldatore qualificato" anche con conferma scaduta (rischio compliance reale). | **Fix implementato**: nuova funzione centralizzata `isQualificationOperationallyActive(q, todayIso)` in `weldingCoordinatorAuth.service.js` — esclude `status` revocata/sospesa, `expiry_date` scaduta, e per tipi 9606/14732 anche `next_confirmation_due` scaduta. Applicata come filtro JS dopo la query SQL in `getCoverage` (qualifications.controller.js) e `caseExtractedCoverage.service.js`; usata anche per rimuovere il gate `approval_status='approvata'` da `qualificationAlert.service.js` e `alert.controller.js` (gli alert ora scattano su qualsiasi qualifica attiva, non solo "approvata"). Rimossi endpoint/route/UI Approva-Rifiuta; "Revoca" (soft-delete → `status='revocata'`) resta come endpoint interno non più esposto come pulsante (l'operatore può ottenere lo stesso effetto impostando Stato=`sospesa`/`revocata` dal form). `createQualification`/`renewQualification`/ingest AI ora forzano sempre `approval_status='approvata'`; normalizzati anche i 4 record legacy `bozza` in produzione (update dati, non schema). `hardDeleteQualification` (Elimina reale) non dipende più da `approval_status`: resta bloccata solo da legami reali (conferme semestrali, import, rinnovo, WPS). **Pattern generale**: quando si rimuove un controllo manuale, verificare sempre se sostituisce un controllo di sicurezza/compliance silenzioso — se sì, il controllo deve diventare automatico/data-driven, non sparire. | Sessione 28/07/2026 · test `weldingCoordinatorAuth.service.test.js`, `qualifications.controller.test.js`, `qualificationAlert.service.test.js` |
| **Pivot WPS — generazione da WPQR, non ingest (30/07/2026, Mason)** — valutando il modulo con il cliente è emerso che caricare PDF di WPS già scritte non risponde al caso d’uso reale del coordinatore: «genera una WPS per FW S355 10 mm + S235 5 mm dalle WPQR disponibili; se mancano estensioni, segnalalo». L’ingest WPS resta solo import legacy; l’ingest **WPQR** e le regole 15614 restano il carburante. | **Prodotto**: matcher deterministico (Tabella 5 gruppi + range spessore/gola) → bozza WPS 15609 o elenco estensioni. L’AI orchestra la richiesta in linguaggio naturale ma **non** decide la copertura del range (ADR-010). Spec [MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md](specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md); brief P0 [DEPUTYTASK1.md](agent-tasks/DEPUTYTASK1.md). Non confondere con il modulo **SAL** (tracker SGQ Camellini). | Lead 30/07/2026 |
| **P0 generatore WPS — Tabella 5 + `wpsGenerator` (30/07/2026)** — fondazione deterministica senza UI/endpoint: matrice Tabella 5 + footnote (a)/(b)/(c) in `weldingQualificationRules15614.js` (mirror FE), servizio `wpsGenerator.service.js` che fa matching WPQR→bozza o `extensions_needed` in italiano. Caso Mason (FW S355 10 + S235 5) coperto da WPQR gruppo 1.2 con range spessore dichiarato; controesempi gruppo 8 / spessore fuori range / registro vuoto → `not_possible`. | **Regola**: range spessore = valori **dichiarati** sul WPQR (`thickness_min`/`max`); calcolo Level 2 solo come `partial`+warning. Nessuna scrittura DB in P0. Deploy: aggiungere `wpsGenerator.service.js` al `deploy-manifest.json`. P1 = endpoint + UI. | DEPUTYTASK1 · test `weldingQualificationRules15614` + `wpsGenerator.service` |
| **P1 generatore WPS — API + UI + AskAi (30/07/2026)** — `POST /welding/wps/generate` **prima** di `/:id` (altrimenti Express cattura `generate` come id); nessuna scrittura in generate; salvataggio solo via `POST /welding/wps` status `bozza`. Chip AskAi non chiama LLM per i range 15614: `saveWpsGenerateIntent` + navigate al form precompilato Mason. | **Regola**: path statici welding (`generate`, `coverage`, `upload-batch`) sempre **sopra** `/:id`. Matching resta in `wpsGenerator.service.js`. | DEPUTYTASK1 · `wpsGenerate.controller.test` · `GenerateWpsModal.test` |
| **P2b upload WPS non piu' primario (31/07/2026)** — il batch «Carica WPS» competava con Genera WPS. | Header: **Genera WPS** / Nuova WPS in primo piano; import PDF solo dietro **Import PDF (legacy)**. WPQR upload invariato. | Lead · `weldingProceduresP2bLegacyUpload.test.jsx` |
| **P2 export Word WPS Annex A (30/07/2026)** — giro Mason chiuso: da bozza scaricabile `.docx` ispirato a ISO 15609-1 Annex A (etichette form, footer SystemGest). Solo FE, niente migrazione. | **Pattern**: `wordExportWps.js` programmatico (`docx`, come SAL); campi assenti → vuoti; pulsante Word su riga tab WPS. P2b = deprecare upload batch. | DEPUTYTASK1 · `wordExportWps.test.js` |
| **Range spessore aperto (senza limite superiore) su WPQR giunti FW — bug reale WPQR cliente Mason (07/08/2026)** — verificando l'ingest AI su un WPQR reale (VB0377/23, giunto ad angolo, "t1 = >=5 ; t2 => 5", Annex B ISO 15614-1) è emerso che `thickness_max=NULL` era **ambiguo**: sia "dato non estratto" sia "range aperto dichiarato" finivano `NULL`, e sia `wpqrIngest.service.js` (`calcThicknessRange`) sia il suo bug gemello in `wpsGenerator.service.js` (`checkThicknessCoverage`) applicavano sempre un **massimo calcolato con la formula Tabella 7 (pensata per giunti BW)** anche a giunti FW, rifiutando come "fuori range" spessori di produzione realmente coperti. | **Fix**: nuovo flag esplicito `thickness_max_unlimited` (BIT, migrazione **139**, non un terzo stato di `NULL`) persistito su `wpqr_records` e propagato da AI (`documentTypeSchemas.js`) → ingest → generatore WPS. **Regola generale**: quando un campo numerico può legittimamente essere "senza limite" (range aperto dichiarato da una norma ISO), non sovraccaricare `NULL` — aggiungere un **booleano dedicato** che i fallback/calcoli a valle devono controllare **prima** di applicare una formula sostitutiva. Ogni funzione che ricalcola un range da un valore mancante deve rispettare i flag espliciti già presenti, non solo verificare `!Number.isFinite(...)`. Cercare sempre eventuali **bug gemelli** in servizi downstream che leggono lo stesso campo DB (qui ingest → generatore WPS) prima di considerare un fix completo. | PR fix `a3971aeb` · migrazione 139 · test `wpqrIngest.service.test.js`, `wpsGenerator.service.test.js`, `ingestPlausibilityChecks.test.js` |
| **Chiusura sessione 08/08/2026 — audit WPQR/Qualifiche + policy git + triage PR backlog** | Sessione completa: fix WPQR (etichette, menu enti chiusi, regola piastra→tubo, form modifica completo — PR #357/#358/#359), fix Qualifiche (`personnel_id` mai salvato da form manuale, registro rielaborazione esteso a `thickness_max_unlimited` — PR #360), policy git a 3 livelli + gate Bugbot (PR #358), auto-merge GitHub abilitato dal committente. **Tutte le PR della sessione mergiate su `main`** (#357, #358, #359, #360) + triage di 4 PR pregresse non di questa sessione: **mergiate** #356 (fix reale: 3 PDF copyright ancora tracciati nonostante commit precedente lo dichiarasse falsamente), #355 e #339 (docs, nessun impatto codice/DB); **lasciata aperta** [PR #10](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/10) (Impostazioni Organizzazione P.IVA/logo, ferma da aprile 2026, 180 file in conflitto reale con `main` — richiede sessione dedicata di ricostruzione, non un semplice aggiornamento). Vedi backlog roadmap per i 2 gap aperti non chiusi in autonomia (reprocess WPQR, PR #10). | PR #357–#360 · [PROJECT_ROADMAP.md § Backlog parcheggiato](PROJECT_ROADMAP.md#backlog-parcheggiato-task-futuri--fonte-unica) |
| **Sistematizzazione "completezza modifica manuale vs ingest" (08/08/2026)** — dopo aver trovato a mano che il form "Modifica WPQR" era rimasto indietro rispetto all'ingest AI (vedi riga sotto) e un bug analogo nelle Qualifiche (`personnel_id` selezionato nel form ma mai salvato da create/updateQualification — la funzione di collegamento anagrafica `resolvePersonnelForQualification` era importata ma mai chiamata), l'audit manuale è stato reso un **test automatico permanente**. | Nuovo helper `backend/src/utils/manualEditCompletenessCheck.js` (`findIngestFieldsMissingFromManualEdit`): confronta le chiavi di `aiExpectedSchema` di un doc type con una whitelist di campi editabili da form/API manuale (`WPQR_MANUAL_EDITABLE_FIELDS` in `welding.controller.js`, `QUALIFICATION_MANUAL_EDITABLE_FIELDS` in `qualifications.controller.js` — entrambe **esportate come fonte unica**, mai duplicate nel test). Test: `welding.controller.manualFieldsCompleteness.test.js`, `qualifications.controller.manualFieldsCompleteness.test.js` (4 doc type: patentino_saldatore, qualifica_14732, cert_ndt, qualifica_14731). **Il test ha già trovato 2 falsi positivi risolti con alias documentati** (`thickness_test_mm`→`thickness_tested`, `approval_date`→`issue_date` — stesso concetto, nome colonna storico diverso) — prova che l'audit automatico è più affidabile di quello a mano. **Regola per il futuro**: ogni volta che si aggiunge un campo a un `aiExpectedSchema` (`documentTypeSchemas.js`), aggiungerlo anche alla whitelist `*_MANUAL_EDITABLE_FIELDS` del controller corrispondente (o a un alias documentato) — il test lo blocca in CI se dimenticato, niente più scoperte da un utente mesi dopo. Complementare al "round-trip a sentinella" (07/08/2026): quello copre ingest→DB, questo copre ingest→modifica manuale. | PR #359 · `manualEditCompletenessCheck.js` |
| **Chiusura audit strutturale ingest saldatura/3834 (07/08/2026, sessione successiva)** — dopo l'audit (riga sotto), chiusi in un'unica slice: (1) bug attivo `qualificationCoverage.js` fail-open su spessore max qualifiche (flag `thickness_max_unlimited` esteso da WPQR a qualifiche, mig. **140**, + fix dell'ulteriore gap scoperto in corsa: `backend/src/data/documentTypeSchemas.js` — la copia realmente usata dal prompt AI in produzione — non aveva mai ricevuto il flag né per qualifiche né per WPQR, quindi il fix WPQR mig.139 della sessione precedente non era ancora efficace lato AI); (2) `preheat_temp`/`interpass_temp` WPQR persi tra pipeline e DB (mig. **141**); (3) nuovo campo dichiarato `throat_test_mm` (gola FW, prima mai estratto); (4) diametro tubo Tabella 9 wired in `wpsGenerator.service.js` (nuovo parametro opzionale richiesta `pipe_diameter_mm`, UI "Genera WPS"); (5) helper riutilizzabile **round-trip a sentinella** (`backend/src/utils/ingestRoundTripSentinel.js`) applicato a `wpqr` e `patentino_saldatore`. **Decisione tecnica documentata (non un fix)**: posizione di saldatura e mono/multipassata **non** vanno filtrate in copertura senza un campo `impact_test_required` — ISO 15614-1 §8.4.2/8.4.3 rende quelle variabili essenziali **solo se richieste prove d'urto/durezza**; un filtro "difensivo" senza quel dato sarebbe un fail-closed normativamente scorretto (peggiore del gap attuale). | **Lezione doppia**: (a) quando esistono **due copie** di uno schema AI (FE per UI, BE per il prompt realmente inviato), un fix che tocca solo la copia FE è **inefficace in produzione** — verificare sempre `backend/src/data/documentTypeSchemas.js` per primo; (b) prima di aggiungere un filtro di copertura "per sicurezza", verificare che la regola normativa non sia **condizionale** a un dato non ancora estratto — in quel caso il filtro va rimandato, non forzato con un default. | Gap report [`GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md`](gap-reports/GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md) · migrazioni 140/141 (applicate e verificate in produzione, deploy backend completato, health OK) · PR #357 · test `qualificationCoverage.test.js`, `wpqrIngest.service.test.js`, `qualificationIngest.service.test.js`, `wpsGenerator.service.test.js`, `wpsGenerate.controller.test.js`. **Aggiornamento stessa sessione**: chiuso anche il gap gola/throat residuo — `checkThroatCoverage()` (Tabella 8, da `thickness_tested`), nuovo parametro `throat_mm` (API + UI, solo giunti FW), secondo deploy completato. Individuata nel testo integrale della norma (pag. 31) una **seconda formula in direzione opposta** (gola nominale provino "a" → range spessore materiale 0,75a-1,5a mono-passata) — non implementata, backlog separato (userebbe `throat_test_mm` + `single_multi_run` per affinare `checkThicknessCoverage`, non `checkThroatCoverage`). **Lezione**: quando una tabella normativa ha più colonne/note, verificare sempre se codifica **relazioni bidirezionali** prima di assumere una sola direzione — qui la Tabella 8 mappa sia spessore→gola sia gola→spessore, due controlli distinti. |
| **Filtri: card statistiche vs tendina — terza applicazione, modulo NC (10/08/2026)** — regola committente "singola fonte di verità" (v. `sgq-operating-memory.mdc` § Filtri), già applicata a Qualifiche (PR #368, card "Non attiva" per Sospese/Revocate) e Scadenzari (PR #371, card "Archiviate"/"Prese in carico"). NC aveva due tendine ridondanti: "Stato" (Tutti/Aperte/Chiuse — solo "Chiuse" non aveva card) e "Tutte le scadenze" (Solo scadute/In scadenza 7gg — entrambe già coperte dalle card Scadute/In scadenza). | Aggiunta card **"Chiuse"** (`stats.closed`, già calcolato dal backend `nc.controller.js`, nessuna migrazione) prima di rimuovere la tendina "Stato"; tendina "Tutte le scadenze" rimossa senza bisogno di nuove card. Rimossa anche la gating `dueSoonCount > 0` sulla card "In scadenza" (era l'unico accesso rimasto al filtro `due_within_days` dopo la rimozione della tendina, non doveva dipendere dal conteggio corrente). **Pattern consolidato**: prima di rimuovere una tendina ridondante con le card statistiche, elencare tutti i valori distinti gestiti da entrambe — se il select ha opzioni senza card corrispondente, aggiungerla **prima** di eliminare il select. | `app/src/tests/ncPage.filterCards.test.jsx` (9 test) · nessuna modifica backend |
| **Filtri: card statistiche vs tendina — quarta applicazione, modulo Saldatura WPQR (DEPUTYTASK4, 10/08/2026)** — a differenza dei 3 casi precedenti (Qualifiche/Scadenzari/NC, una sola dimensione filtro duplicata da una tendina), qui le 5 card (Valide/Scad.60/Scad.30/Scadute/Da approvare, `WeldingProceduresPage.jsx`) sono calcolate **solo su `wpqr_records`** (`getWPQRStats`) e non hanno alcun senso nel tab WPS adiacente — erano però mostrate sempre, anche fuori contesto. Mappatura: la tendina `approval_status` (bozza/approvata/rifiutata) duplicava **esattamente** "Da approvare" (bozza); "rifiutata" era un valore **orfano invisibile in ogni card** (stesso gap di "Sospesa"/"Revocata" in Qualifiche); "approvata" non aveva una card 1:1 (è l'unione di Valide+Scad.60+Scad.30+Scadute). **Bug trovato in aggiunta**: il bucket SQL "scadute" contava qualsiasi WPQR con `expiry_date` passata **indipendentemente da `approval_status`**, a differenza degli altri 3 bucket — un WPQR bozza/rifiutata scaduto finiva conteggiato in "Scadute" (rosso) mentre a riga il semaforo (`SemaforoDot`) lo mostra grigio "Non approvata": card e riga in contraddizione, stesso pattern già corretto in Scadenzari (tarature `status:'expired'`). | **Fix**: (1) barra statistiche mostrata solo con `activeTab === "wpqr"`; (2) bucket "scadute" ora richiede `approval_status = 'approvata'` (coerenza con `SemaforoDot`); (3) aggiunti bucket "rifiutate" e "approvate" (prima assenti) alla query `getWPQRStats`; (4) tendina `approval_status` **rimossa**, sostituita da 3 card cliccabili con toggle (Da approvare/Approvate/Rifiutate — pattern `handleWpqrApprovalCardClick`, stesso stile toggle di NC); le 4 card semaforo scadenza restano informative (nessuna tendina duplicava quella dimensione — nessuna azione necessaria, non esiste ancora un filtro backend per bucket di scadenza WPQR, fuori scope minimo di questa slice). **Pattern rinforzato**: prima di consolidare, verificare sempre a **quale vista/tab** si applica davvero una card condivisa — non solo se duplica una tendina. | PR DEPUTYTASK4 · test `welding.controller.wpqrStats.test.js`, `weldingProceduresPage.filterCards.test.jsx` |
| **Provisioning nuovo studio da UI + gap "amministratore invitato senza accesso" (11/08/2026, PR #380/#382/#383/#384/#386)** — il committente ha segnalato che un tentativo di "generare l'anagrafica per un nuovo studio" non compariva in lista. Causa reale: **nessuna funzione di creazione studio esisteva** (solo script SQL one-off usati per lo split tenant di aprile 2026) — colmata con `POST /auditor-orgs` (crea `organizations`+`auditor_orgs` in transazione). Trovato **in aggiunta** un gap più critico durante la stessa analisi: creare il nuovo studio non generava alcun modo di accedervi (nessun utente/password/email) — `admin.controller.js::createUser` scopa sempre `organization_id` all'attore, quindi non può mai assegnare il primo utente a un tenant appena creato (`organization_id` diverso per costruzione). | **Pattern per estendere un flusso multi-tenant esistente senza aumentarne il rischio**: non estendere una funzione centrale già ampiamente testata (`createUser`) con un'eccezione cross-tenant — creare un endpoint **nuovo, minimale, a scopo esplicito** (`POST /auditor-orgs/:id/invite-admin`, solo superadmin) che riusa l'infrastruttura invito già in produzione (`userInviteService`, nessuna password provvisoria). **Lezione RBAC (gate Bugbot, severità alta)**: l'admin invitato per un nuovo tenant va creato con `auditor_org_id = NULL` ("amministratore principale" org-wide, pattern `isOrgWideAdmin` usato in tutto il codice) — impostarlo al singolo studio target lo scoperebbe erroneamente come "Admin Studio", perdendo visibilità su audit/documenti/checklist del proprio tenant. **Lezione deploy (ripetuta 2 volte nella stessa sessione)**: `deploy-manifest.json` non è un inventario completo di `backend/src/routes/` — è una lista incrementale che si aggiorna solo quando un file viene toccato. **Prima di ogni deploy che modifica un file `routes.js` esistente**, verificare che sia nel manifest (`grep nome_file.routes.js deploy-manifest.json`), non solo i file *nuovi* (regola già nota per i controller). Un fix al manifest non ancora mergiato su `main` non protegge da questo problema: il `git pull` di una sessione successiva lo sovrascrive silenziosamente. **Lezione CI**: `deadlinesPage.filterCards.test.jsx` è flakato 2 volte in questa sessione su PR completamente non correlate (docs-only e markdown) — passa sempre in isolamento e in suite completa locale; se flaka una terza volta, va investigato seriamente (non solo re-triggerato) come già fatto per `ncPage.filterCards.test.jsx`. | PR #380 (checkbox CND mancante) · #382/#384 (provisioning + invito admin, gate Bugbot su entrambe) · #383 (fix manifest, richiesto 2 volte prima del merge) · #386 (DEPUTYTASK2, badge coerente + nota piano abbonamento) |
| **Chiusura ciclo provisioning studio: bug email globale, badge unificato, ruolo Admin ristretto (12/08/2026, PR #388/#389/#390/#391/#392)** — seguito diretto della riga sopra, stessa area (`UsersAdminPage.jsx`/`auditorOrg.controller.js`/`admin.controller.js`). **Bug reale in produzione** (non ipotetico): il committente ha creato uno studio vero e l'invito del primo admin falliva con 500 grezzo — causa: il pre-check duplicati email in `inviteFirstStudioAdmin` era scoped a `organization_id`, ma il vincolo DB reale (`UQ_users_email`) è **globale su tutta la piattaforma**; trovato e corretto lo stesso bug gemello (mai manifestato ma stesso rischio) in `admin.controller.js::createUser`. **Anomalia visiva ricorsiva**: il fix del badge "Tutti i moduli" (PR #386) aveva introdotto **due colori diversi** per lo stesso stato (di nuovo un'incoerenza, sia pure più lieve) — unificato a un solo badge. **Bug CSS strutturale scoperto verificando quel fix**: una regola globale `input, textarea, select { width:100%; padding:10px; border:...; margin-bottom:12px }` (`index.css`, pensata per i campi di testo) si applica per errore a **qualsiasi** checkbox/radio nell'app priva di un reset esplicito — pattern già "toppato" altrove (`ProjectsPage.css`, `AuditSelector.css`, ecc.) ma mai applicato in questa pagina: trovato e corretto sia sulla nuova matrice moduli sia sulla sezione "Standard consentiti" sia sui radiobutton "Come impostare la password" (3 punti diversi, stesso bug). **Rimosso il campo "Piano abbonamento"** dal form Nuovo studio: verificato che non era letto da nessuna logica né mostrato in alcun punto dell'UI dopo la creazione — un controllo che chiede una scelta e la butta via non ha motivo di esistere; se servirà una vera gestione piani, va reintrodotto insieme alla logica reale. **Decisione di RBAC**: il ruolo Admin non si crea/promuove più da `createUser`/`updateUser` (prima bastava essere un admin qualsiasi, `isElevatedAdmin` non controllava affatto `auditor_org_id` nonostante il testo in UI suggerisse il contrario) — unica fonte di verità resta `inviteFirstStudioAdmin`; **eccezione necessaria** (gate Bugbot, severità alta): il superadmin può ancora promuovere via `updateUser`, altrimenti un utente demozionato resterebbe bloccato per sempre (`inviteFirstStudioAdmin` crea sempre un utente **nuovo**, mai una promozione). | **Pattern ricorrente in questa sessione**: quando si estende un endpoint esistente con logica cross-tenant/cross-org, verificare sempre se un vincolo DB citato come "scoped" nel codice di riferimento (qui `createUser`) è in realtà **globale** — copiare un pattern di validazione senza verificare il vincolo reale sottostante crea un bug silenzioso che emerge solo in produzione. **Pattern CSS**: se un checkbox/radio "si allarga" o il testo va a capo inaspettatamente, sospettare sempre il leak `input,textarea,select{width:100%}` di `index.css` prima di ipotesi più complesse — verificare con `getComputedStyle`+ispezione stylesheet (`document.styleSheets`), non solo a occhio da uno screenshot (un allineamento tecnicamente corretto può *sembrare* sbagliato in uno screenshot piccolo/compresso). **Pattern RBAC**: quando si centralizza un'autorizzazione ("solo da qui"), verificare sempre se esiste un percorso "inverso" (demozione) che una regola troppo rigida bloccherebbe senza via di ripristino. | PR #388 (badge unico) · #389 (rimozione piano abbonamento) · #390 (fix email globale, gate Bugbot su `createUser`) · #391 (raggruppamento moduli + fix CSS checkbox/radio) · #392 (ruolo Admin ristretto, gate Bugbot su promozione/demozione) |
| **Consolidamento guscio dialog ingest — DEPUTYTASK3 (10/08/2026)** — `IngestReviewDialog.jsx` e `ReprocessGroupDialog` (dentro `ReprocessQueueBanner.jsx`) condividevano già logica/hook (`useIngestReviewSplit`, `FieldInput`, `IngestSourcePreview`); restava duplicato solo il guscio visivo (overlay/header-expand/layout/resizer/Escape, ~60-80 righe). | Estratto `IngestDialogShell.jsx`+`.css`: overlay/dialog/header-top/layout/resizer/footer con stato `expanded` e gestione Escape **incapsulati nella shell** (prima duplicati in ognuno dei due dialog); ogni dialog passa solo contenuto specifico (titolo, meta, campi, azioni) via render prop. **Pattern per generalizzare senza perdere le differenze intenzionali**: dimensioni/spaziature proprie di ciascun sito (larghezza, altezze massime, padding, colori pulsanti) restano nei rispettivi CSS, applicate con **selettori discendenti** sulla classe del dialog specifico + la classe condivisa (es. `.ingest-review__dialog .ingest-dialog-shell__layout { margin-top: .75rem; }`) — nessuna nuova prop di styling sulla shell, nessun valore perso. Verifica: `expanded` può vivere internamente alla shell (non più nel dialog padre) quando il dialog padre già smonta/rimonta la shell a ogni apertura (`if (!open) return null` prima del render) — evita di dover sincronizzare un `resetKey` esplicito. **Nota testing**: drag manuale via `computerUse` su un resizer sottile (6px) può fallire per imprecisione del puntatore simulato — non è di per sé prova di regressione; verificare con uno script Playwright dedicato (`page.mouse.down/move({steps})/up`) che il drag reale funzioni prima di concludere che c'è un bug. | PR #377 · `IngestDialogShell.jsx` |
| **Audit strutturale ingest saldatura/3834 (07/08/2026) — il pattern "campo in schema/prompt AI ma perso prima del DB" è STRUTTURALE, non isolato alla WPQR** — verificate tutte le pipeline (WPQR, WPS upload P2b, qualifiche saldatori 9606-1, NDT 9712, capitolato): trovati **4 episodi reali** con la stessa causa radice (schema/prompt esteso, mapping revisione→DB dimenticato) — WPQR preheat/interpass (questa sessione), WPS legacy 10 campi (`joint_type`, `welding_positions`, `filler_material`, `shielding_gas`, `preheat_temp`, `interpass_temp`, `heat_input`, `pipe_outside_diameter_mm`, `wpqr_ref`, `base_material` — mostrati in revisione, mai scritti da `wpsIngest.service.js`), e 3 episodi già chiusi su qualifiche saldatori (`shielding_gas` 26/07, `product_type`/`weld_details` 26/07, `filler_material_group`/`pipe_diameter_mm` 01/08 — quest'ultimo ha richiesto backfill `REPROCESSABLE_FIELDS`). **Bug attivo trovato in aggiunta** (non ancora corretto): `qualificationCoverage.js` tratta `thickness_max_mm`/`pipe_diameter_max_mm` NULL sempre come "nessun limite" (`Infinity`) — stessa ambiguità della WPQR ma irrisolta e nella direzione più rischiosa (fail-open su una decisione ISO 3834-2 §8.2 "personale idoneo per la commessa"). **Nessuna delle 5 pipeline ha un test che verifichi la coerenza schema↔mapping↔DB**: il gap dipende solo dalla disciplina manuale di chi estende uno schema. | **Regola**: non correggere più questi bug uno a uno soltanto — la soluzione trasversale è un test generico "round-trip a sentinella" (valore univoco per ogni chiave di `aiExpectedSchema`, verificare che sopravviva sia a `mapPipelineFieldsToReview` sia a `mapReviewFieldsToDb`/`commitXFromFields`), applicabile a tutti gli schemi di `documentTypeSchemas.js` con un solo helper condiviso — avrebbe intercettato tutti e 4 gli episodi di mapping dimenticato (non i casi "campo mai aggiunto allo schema", quelli restano gap di analisi normativa). Per l'ambiguità NULL "aperto vs mancante", generalizzare il pattern flag `*_unlimited` (vedi riga sopra) anche alle qualifiche saldatori. | Analisi audit, nessuna modifica codice in questo giro — fix prioritari da pianificare: `qualificationCoverage.js` (attivo), gola WPQR FW, WPS legacy 10 campi |

### Harness agentico e AI runtime

| Lezione | Regola da applicare | Dettaglio |
|---------|---------------------|-----------|
| **Harness hardening HK (giugno 2026)** — 10 slice verticali per chiudere i gap strutturali su governance Cursor, alleggerire la memoria operativa, completare il collare AI runtime (audit trail, licenze, NormBroker v1 cascata, gap analysis MVP, disclaimer). | Ogni feature AI ha un **endpoint canonico univoco** con licenza specifica (`ai_import`, `ai_assist`, `ai_review`, `ai_norms`, `ai_chat`). Audit trail (`logAiInteraction`) su ogni route AI. `AiDisclaimer` nei 4 flussi principali. `norm_access_log` per accessi non-locali. Gap analysis heuristica come Fase 2 ADR-010. | [`PLAN_HARNESS_HARDENING_SLICES.md`](agent-tasks/PLAN_HARNESS_HARDENING_SLICES.md) · branch `cursor/harness-hardening-hk-6b60` |
| **SAL Fase 5-A — suggeritore stato AI (human-in-the-loop)** — l'AI legge le evidenze documentali collegate a una clausola SAL e PROPONE stato + confidenza + motivazione; l'operatore Accetta/Modifica/Rifiuta. L'AI **non scrive mai** lo stato (ISO §7.5). | Nuova feature AI su modulo esistente = **doppio gate licenza**: la route SAL applica già `requireLicensedModule('sal')`, il suggeritore aggiunge `requireLicensedModule('ai_norms')` SOPRA. Riuso obbligatorio: `aiProviderAdapter` (chat/getActiveProvider), `documentTextExtractor.extractDocumentText` (document_registry→attachments `is_current_doc_version=1`), `assertCompanyInOrganization` per lo scope multi-tenant a monte del prompt. Confidenza adattiva nel dialog = riuso `ConfidenceBadge` di `IngestReviewDialog`. Graceful degradation: provider assente → `aiAvailable:false` (200, no crash); documento senza testo/PDF immagine → confidence `low`, AI non chiamata. Nessuna migrazione: la proposta vive a runtime, la scrittura passa dall'`upsertStatus` esistente. **Encoding**: lo strumento di scrittura file su questo PC salva i **file nuovi** come ANSI/CP1252 se contengono non-ASCII raw (es. em-dash `—`→`0x97`, `§`→`0x9D`) → usare solo ASCII nei commenti e `\uXXXX` nelle stringhe runtime; `StrReplace` invece preserva UTF-8. | PR SAL Fase 5-A · branch `feat/sal-ai-suggest-fase5a` |
| **SAL Fase 5-B — conformità LEGISLATIVA nel suggeritore AI (18/07/2026)** — oltre allo stato di implementazione (asse tecnico, 5-A), l'AI valuta anche gli **obblighi di legge** collegati alla clausola. | Esteso **lo stesso** `salAiSuggest.service.js` (mai un service parallelo). Flusso: `loadClause` legge `linked_legislation` → `parseLinkedLegislation` ricava `(standard_code, clause_ref)` per articolo (formato `"D.Lgs. 81/2008 art.28; art.29"`; mapping generico `D.Lgs. N/AAAA`→`DLgs_N_AAAA`) → testo caricato da **`normBroker.getClauseText`** (cascata local_db→publicLaw). **Scoping**: le leggi sono universali (`norm_requirements` non è scoped) → nessun filtro tenant sugli articoli; le **evidenze** restano scoped `organization_id`+`company_id` come in 5-A. Prompt a due assi: l'AI ritorna anche `legalConformity[]` `{articleRef, coverage covered/partial/missing, gap, rationale}` + `legalConfidence`; parse anti-allucinazione per `articleRef` (solo articoli realmente collegati). **Nessuna scrittura DB.** Graceful: clausola senza `linked_legislation` → `legal` assente (UI non mostra la sezione); articolo non in local_db o broker in errore → `textAvailable:false`, coverage `null`, nota; nessun testo evidenza/provider assente → `legal.evaluated:false` con elenco articoli senza verdetto. `localStoreConnector.getClauseText` ora ritorna anche `sourceUrl` (permalink pubblico art.5 L.633/1941, citabile — a differenza del testo UNI/ISO, ADR-010 §9). UI: `SalAiSuggestDialog` con sezione «Conformità legislativa» (nuovo `CoverageBadge`) SEMPRE distinta da «Conformità norma tecnica». Audit: nessun nuovo feature/schema — il `context_summary` di `sal_suggest` segnala l'analisi legale. | PR SAL Fase 5-B · branch `feat/sal-ai-legal-conformity-5b` |
| **SAL Fase 5-B seam — capability `SAL_LEGAL_CONFORMITY` separabile (18/07/2026)** — la conformità legislativa AI resta **venduta dentro `ai_norms`** ma diventa **separabile con un flag pulito**, pronta per una futura licenza dedicata **senza refactor**. | Un unico **seam di capability** vive in `backend/src/services/moduleLicense.service.js`: costante `SAL_LEGAL_CONFORMITY_MODULE_KEY = 'ai_norms'` + helper `hasSalLegalConformityCapability(organizationId, role)` (admin/superadmin sempre ON, coerente con `requireLicensedModule`). Il controller `gapAnalysis.controller.js` calcola la capability e passa `legalConformityEnabled` a `suggestSalStatus`; il servizio calcola l'asse legislativo **solo se ON** (capability OFF → in `buildClauseContext` `legislation=[]`, **zero chiamate a `normBroker`**, ritorno del solo asse tecnico 5-A, nessun errore). Server = fonte di verità: la UI mostra «Conformità legislativa» solo se la risposta contiene `legal` (già graceful, nessuna seconda chiamata licenza lato FE). Comportamento utente **invariato** (oggi capability ON ⇔ `ai_norms` attivo). **COME SCORPORARE IN 2 MOSSE**, senza refactor: **(1)** aggiungi la nuova chiave (es. `ai_legal`) a `KNOWN_MODULE_KEYS` (+ `LABELS_IT`) in `moduleLicense.service.js`; **(2)** ripunta `SAL_LEGAL_CONFORMITY_MODULE_KEY` a quella chiave. Nient'altro cambia (service e UI leggono la capability solo tramite il seam). Test L1: `moduleLicense.service.test.js` (seam ON/OFF + bypass admin), `salAiSuggest.service.test.js` (capability OFF → solo tecnico, broker mai chiamato), vitest `salAiSuggest.test.jsx` (sezione legale presente/assente). **Fatturazione futura (nota)**: il prezzo a regime sarà **«per azienda gestita»**; prerequisito tecnico = **tracciare `company_id` nelle interazioni AI** (colonna `company_id` su `ai_interactions`) — **da fare quando si costruirà il billing**, non ora (nessuna modifica schema in questo slice). | PR seam capability · branch `feat/sal-legal-capability-flag` |
| **Profilo azienda esteso per conformità legislativa — S0 (23/07/2026)** — anagrafica `companies` resta minima; dati ATECO/sedi/SSL/ambiente in tabella 1:1 `company_profile`, utile soprattutto agli studi con sistemi 14001/45001 e asse legale. | **Non** gonfiare `companies` (lista/audit/export invariati). Gate UI/API sul seam **`SAL_LEGAL_CONFORMITY`** (stesso di SAL 5-B; oggi `ai_norms`). Livello A = campi da visura/Excel; livello B = solo consulente/studio. Import Excel = pattern ADR-013 (detect → dry-run → upsert). Lookup Registro Imprese = fase 2 opzionale, sempre human-in-the-loop. Spec: ADR-018 + catalogo campi/template Excel. **S1–S5 fatti** (14/08/2026, PR #399/#400/#409/#411/#418). Lookup = pulsante «Recupera da registro» (dry-run + conferma, `source=registry`). **S6** «Cerca nel registro» in anagrafica (PR #426, VPS 15/08): P.IVA → 1 risultato; nome (≥3 lettere) → lista `IT-search` `name` (max 8); tu scegli, poi Salva. Non crea l'azienda da sola. **Lezione OpenAPI:** Start/Advanced ≠ Search. `IT-search` 402 = prodotto/credito non attivo, non è un bug del gestionale. «Autocomplete 100/giorno gratis» = solo ID, inutilizzabili in lista. VIES (UE) è gratis ma solo con P.IVA (nome+indirizzo, niente ATECO). Non scrapare registroimprese.it. Token `SGQ_OPENAPI_COMPANY_TOKEN` nel `.env` del VPS (stesso posto di `GEMINI_API_KEY`) + riavvio `sgq-backend`; senza token l'API risponde 503. ATECO solo con piano `IT-advanced` (402 → fallback `IT-start` senza ATECO). Detect = dry-run; conferma = JSON campi (niente re-upload). v1: una riga / azienda corrente. iCRIBIS resta fuori (sito, non API). GET senza riga precompila nome/P.IVA da `companies` (non scrive finché non si salva). Indirizzo libero non è spezzabile in via/CAP/comune. | [ADR-018](adr/ADR-018-company-profile-conformita-legislativa.md) · [catalogo](specs/COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md) |
| **Material Compliance AI — fondazione doc (05/08/2026)** — nuovo modulo certificati EN 10204 3.1: non app separata; riuso ingest/`documentTextExtractor`/`importAiExtraction`/`aiProviderAdapter`. | **AI estrae, Rule Engine valuta, operatore approva** (ADR-022; stesso spirito WPS/SAL). MVP-A senza OCR (PDF testo); OCR = slice MC-B. KB in `knowledge/material-compliance/` con `companies/<slug>/` (mai hardcode cliente). UI MVP = lista+dettaglio+HITL (no dashboard/KPI subito). Seam licenza `MATERIAL_COMPLIANCE` → `saldatura`+`ai_import`. Ordine slice: MC-0 spec → MC-1 DB → MC-2 KB → MC-3 motore → MC-4 API → MC-5 UI → MC-6 gate/audit. | [MODULO](specs/MODULO_MATERIAL_COMPLIANCE_AI.md) · [PLAN](agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md) · ADR-020…024 |
| **Registro obblighi legali — gap analysis + ADR-019 (28/07/2026)** — dai due documenti di riferimento del committente (report reale Grantini 14001+45001, template vuoto Certiquality 14001) è emerso che (1) esiste già un template ambientale a livello di capitolo (`LEG_AMBIENTE_152`) ma **nessun equivalente sicurezza** (D.Lgs. 81/08), e (2) **esiste già** un agente di verifica periodica validità norme (`normValidityChecker.service.js` + cron lunedì 03:00, PR #65) — non va creato da zero, va **estesso**. | Granularità sotto-domanda (a/b/c + SI/NO/NA) **non** richiede un nuovo concetto item_kind/parent: si riusa `custom_checklist_sections` (1 capitolo = 1 sezione, già esistente) con **2 sole colonne nuove nullable** (`reference_text`, `linked_legislation` — stesso formato già usato da SAL, riuso `parseLinkedLegislation` estratto in util condiviso). Risposta SI/NO/NA = sottoinsieme dei 6 pulsanti `status-btn` esistenti via nuova prop opzionale `statusOptions` su `QuestionCard.jsx` (default retrocompatibile). Ambiente e sicurezza restano **moduli separati** (content-authoring disgiunto); reporting combinato = aggregatore dei due export, P2. Contenuto normativo mai inventato da AI — solo da fonte verificata (Normattiva/EUR-Lex/documenti committente), evidenze di clienti terzi citati nei documenti di riferimento **non vanno mai persistite** nel repo. | [ADR-019](adr/ADR-019-registro-obblighi-legali-ambiente-sicurezza.md) · `DEPUTYTASK1-4.md` |
| **Registro obblighi legali — chiusura PR #317 (01/08/2026)** — cosa esiste vs cosa era da creare | **Ambiente `LEG_AMBIENTE_152`**: già presente (46 voci capitolo, 2 sezioni macro) — non va ricreato; upgrade a/b/c da Certiquality = backlog P2. **Sicurezza `LEG_SICUREZZA_81`**: creata in questa iniziativa (29 capitoli da Grantini + `reference_text`/`linked_legislation`, seed FE+BE, endpoint seed). Mig. **138** eseguita su VPS. **Lezione sync**: dopo QA FE sul capitolo 29, rigenerare sempre il seed BE con `node backend/scripts/buildLegislativoSicurezzaTemplate.js` (altrimenti FE 29 / BE 28). Residuo: **N5** revisione umana contenuto prima di audit cliente reale. | PR #317 · mig. 138 · `legislativoSicurezzaTemplate.js` |
| **Allineamento Git autonomo con DEPUTYTASK multipli (24/07/2026)** — con più ambienti (Lead/Deputy/Cloud) e brief `DEPUTYTASK.md` / `DEPUTYTASK1.md` / `DEPUTYTASK2.md`, chiedere al committente «fai `git pull`» crea disallineamenti e ritardi. | **Regola**: ogni agente con terminale esegue **sempre** `git fetch origin main` (+ `git pull` quando lavora su `main` o prima di leggere/eseguire un `DEPUTYTASK*`) **da solo**. Vietato delegare il pull al committente. Verificare il brief su `origin/main` con `git show` prima di dichiararlo attivo. | `.cursor/rules/sgq-operating-memory.mdc` · `AGENTS.md` |
| **DNA visivo nel boot agente (13/08/2026)** — stesso principio di `AGENTS.md`: le regole di gusto stanno in un file sempre letto quando si tocca UI, non in una skill esterna. | Passo 6 di `AGENTS.md` (solo se il task tocca JSX/CSS). Fonte: [`app/src/design-system/README.md`](../app/src/design-system/README.md). | Harness · nessuna dipendenza GitHub |
| **Dieta avvio + bussola moduli (13/08/2026)** — `AGENTS.md` obbligava GUIDA (~337 KB) + roadmap intera (~88 KB) prima di ogni Deputy: la smart zone (~100k token) si saturava prima del codice. | Avvio = `PROJECT_CONTEXT.md` (tabella «Se lavori su…») + roadmap **solo** § Stato attuale. GUIDA **solo se** deploy/Word/sync/lezione citata. Bussola: aggiornare nella stessa PR se nasce/si rinomina un modulo; path in backtick devono esistere. Misura: `node backend/scripts/check-harness-boot.js` (tetto 50 KB avvio obbligatorio + scenario `company_profile`). Non copiare second brain/RAG sul codice (Cursor cerca già nel repo). | `AGENTS.md` · `PROJECT_CONTEXT.md` · `check-harness-boot.js` |
| **PR Routing & Approval + Bugbot always-on attivati (13/08/2026, piano Ultra individuale)** — dopo aver verificato che Cursor documenta questo automation reale ([`cursor.com/docs/approval-agents`](https://cursor.com/docs/approval-agents)), preparata l'infrastruttura repo (`APPROVAL_POLICY.md` per directory, `.cursor/approval-policies/ROUTING.md`, `.cursor/BUGBOT.md`) e attivata da dashboard dal committente. | **Scoperta pratica non documentata da Cursor**: su un repo con un solo operatore umano, l'azione **"Request Reviewers" non ha mai un destinatario valido** — GitHub rifiuta di assegnare review all'autore stesso della PR. **"Approve PR" è quindi l'unica azione utile**, non un'opzione più aggressiva scelta per comodità. Verificato anche: `.cursor/BUGBOT.md` (regole custom repo) e il pannello dashboard "Manual/Learned Rules" sono **due canali indipendenti**, non sincronizzati — il primo si applica sempre, il secondo va gestito solo da UI; conferma via commento `bugbot run verbose=true` su una PR. **3 rilievi Bugbot reali trovati e corretti** durante il setup (buco logico in policy, formato Markdown invece di YAML richiesto per `ROUTING.md`, denylist frontend con qualifica ambigua) — prova che la revisione automatica serve anche su contenuti "solo policy", un errore non si vede rileggendo il proprio testo. | PR [#402](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/402)/[#404](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/404)/[#405](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/405)/[#406](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/406) · [`docs/how-to/SETUP_PR_ROUTING_APPROVAL.md`](how-to/SETUP_PR_ROUTING_APPROVAL.md) |
| **«Solo la sezione» senza indicazione meccanica non basta — verificato con un sub-agente reale, non solo con lo script (13/08/2026)** — la dieta avvio sopra diceva "leggi solo § Stato attuale" della roadmap (>900 righe). Lanciando un vero sub-agente a freddo sul brief `DEPUTYTASK.md` (non solo verificando `check-harness-boot.js`, che controlla la struttura del testo ma non osserva un agente reale), è emerso che leggeva comunque **il file intero** (927 righe) — lui stesso l'ha segnalato in auto-osservazione. Un'istruzione "solo" senza il parametro esplicito dello strumento è debole: l'agente, di fronte a un file non enorme, tende a leggerlo tutto per sicurezza. | **Specificare sempre il meccanismo, non solo l'intento**: "usa Read con `limit: 45`" invece di "leggi solo la sezione". Aggiunto controllo automatico in `check-harness-boot.js` (`checkAgentsDiet` richiede la parola `limit` sulla riga roadmap) — intercetta la regressione testuale, ma la prova che **funziona davvero** resta il secondo lancio del sub-agente (ha usato `Read offset=1 limit=60`, GUIDA non aperta). **Pattern generale**: un controllo statico su regole/istruzioni prova solo che il testo è coerente; per provare che un agente si comporta come voluto serve anche un test comportamentale con un sub-agente reale — i due livelli si completano, non si sostituiscono. Bonus dello stesso giro: il sub-agente ha scoperto che il numero migrazione `130` citato in `DEPUTYTASK.md` era già occupato (sequenza condivisa arrivata a `144`) — corretto in `145` con nota di verifica `ls database/migrations/ \| sort \| tail -5` prima di fidarsi del numero scritto nel brief. | `check-harness-boot.js` (+ `check-harness-boot.test.js`, 21 test di mutazione) · `docs/agent-tasks/DEPUTYTASK.md` |
| **Handoff + Ponytail + smoke critici (13/08/2026)** — catalogo plugin Claude Code (wiki Obsidian, grilling, Impeccable, Supabase) duplicava la governance. Principi utili: contesto pulito tra sessioni, minimo codice, verifica indipendente. | (1) Slice non chiusa → blocco [`HANDOFF_TEMPLATE.md`](agent-tasks/HANDOFF_TEMPLATE.md) nel `DEPUTYTASK` attivo, nuova sessione. (2) Gate 5 domande prima di codice nuovo (`sgq-operating-memory.mdc` § Ponytail). (3) Bugbot su PR Medio; smoke percorso toccato: `backend/scripts/smoke-percorsi-critici.mjs`. Non installare skill GitHub. | `AGENTS.md` · `sgq-git-autonomy.mdc` |
| **Playwright+Chromium nello snapshot Cloud, non in `/tmp` (14/08/2026)** — ogni sessione Cloud è una VM nuova; il playbook imponeva `cd /tmp && npm i playwright && npx playwright install chromium` anche se Playwright è già devDependency di `backend/` e Chrome di sistema è già in VM. MCP Playwright non è collegato in Cloud e non legge `SGQ_APP_PASSWORD`. | Chromium lo installa `cloud-install.sh` (resta nello snapshot). Smoke: `node backend/scripts/smoke-percorsi-critici.mjs` senza reinstall. Fallback solo se manca il binario: `cd backend && npx playwright install chromium`. Click a schermo: `computerUse`, non MCP Playwright. **Kitesurf** (Cloudflare Browser Run, beta ago 2026): browser agent-first su Workers, CDP compatibile, meno CPU/RAM su screenshot one-shot. **Non adottare**: non accelera il SGQ; non copre sessioni autenticate persistenti (login PWA + cookie/JWT), che è il nostro smoke; aggiunge account/token/costi Browser Run. Rivalutare solo se un giorno avremo già Browser Run e Kitesurf uscirà da beta con stato persistente. | `cloud-install.sh` · Fase 6 `sgq-bug-fix-methodology.mdc` |
| **SAL Fase 0 — motore dati gap operativo (luglio 2026)** | Tabella `requirement_implementation_status` + storico `requirement_implementation_history` (mig. **117**). Servizio canonico `gapAnalysis.service.js`: `getGapMatrix`, `upsertStatus`, `seedForCompany` (macro-clausole N.N da `norm_requirements`). API licenza **`sal`**: `GET/POST /companies/:id/gap-matrix`, `GET/PUT /companies/:id/gap-statuses`. Distinto da `GET /gap-analysis` (euristica documenti, licenza `ai_norms`). Decisione ADR-009: stato persistito in tabella dedicata, non overlay su registro documenti. | [`MODULO_SAL_SCOPO_E_ROADMAP.md`](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §D/H Fase 0 |
| **SAL Fase 1 — UI griglia `/sal` (luglio 2026)** | Pagina `SALModule.jsx`: ambito azienda (`salCompanyScope.js`), tab filtro standard 9001/14001/45001, griglia `SgqDataGrid` con cambio stato inline + modal note/responsabile/scadenza, pulsante seed se matrice non seedata. Metodi `apiService.getGapMatrix` / `updateGapStatus` / `seedGapMatrix`. Menu sidebar senza lucchetto (licenza `sal`). Test L1: `salModule.test.jsx`, `salCompanyScope.test.js`. | [`MODULO_SAL_SCOPO_E_ROADMAP.md`](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 1 |
| **SAL Fase 2 — export Word + storico + evidenze registro (luglio 2026)** | Export Word programmatico (`wordExportSal.js`, distinto da verbale Riesame §9.3). Modal ampliato: `SalEvidenceSection` collega `evidence_document_ids` → `document_registry` (picker documenti rilasciati, link `buildDocumentRegistryPath` / `RouterContext`). Backend: `validateEvidenceDocumentIds`, `enrichRowsWithEvidence`, `GET .../gap-statuses/:id/history`; UPDATE con `COALESCE` per non azzerare evidenze su cambio stato inline. Test L1: `salModule.test.jsx` (5), `gapAnalysis.service.test.js` (13). | [`MODULO_SAL_SCOPO_E_ROADMAP.md`](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 2 |
| **SAL Fase 3 — integrazioni audit + NC sal_gap (luglio 2026)** | `syncAuditConformityHints` da ultimo audit completato (12 mesi) → colonna hint in griglia; mig. **118** `source_category='sal_gap'`; azione Piano Azioni da modal SAL (`NcCreateModal`). **Non** tocca Welding Book (ADR-016). Deploy VPS: mig. 118 separata da mig. 110. | [`MODULO_SAL_SCOPO_E_ROADMAP.md`](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 3 |
| **SAL Fase 4 — feed Riesame §9.3 (luglio 2026)** | `getInputSummary` con `company_id` legge `getNormCoverageForReview` (motore SAL) al posto del JOIN audit grossolano; fallback `audit_legacy` senza ambito azienda. Campo `norm_coverage_source`: `sal` \| `audit_legacy`. | [`MODULO_SAL_SCOPO_E_ROADMAP.md`](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 4 · §G |
| **Gap Analysis ↔ SAL "dialogano" (23-24/07/2026)** — i due moduli potevano mostrare copertura diversa per la stessa clausola senza che l'utente lo sapesse (GAP = euristica parole chiave su tutte le clausole/zero setup; SAL = stato tracciato con evidenze validate, solo macro-clausole N.N, richiede seed+link manuale). | `runGapAnalysis` legge anche `getGapMatrix` per lo stesso standard/azienda: se una macro-clausola ha uno stato SAL tracciato, quello **sovrascrive** la stima lessicale (`coverageSource: 'sal'` vs `'heuristic'`; badge "SAL" vs "(stima)" in UI). Sotto-clausole (SAL non le gestisce) restano euristiche con riferimento alla macro-clausola genitrice (`extractSalMacroClauseRef`: prime due sezioni del clause_ref, es. `8.1.4.2`→`8.1`). Deep link `app/src/utils/salDeepLink.js` (`/sal?company_id=&standard=&clause=`) da un pulsante "Apri/Verifica in SAL" per riga: precompila ambito+standard in `SALModule.jsx` e evidenzia (dissolvenza CSS) la riga target. **Lezione test**: `jest.clearAllMocks()` NON svuota la coda `mockResolvedValueOnce` (serve `mockReset()`) — un test "puro" senza chiamate a `query()` dentro un `describe` con `beforeEach` che pre-accoda risposte lascia un residuo che disallinea i test successivi nello stesso file; spostare i test unitari puri fuori da quel `describe` o usare `mockReset()` esplicito. | PR [#292](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/292) (fix `doc_type`/`is_current`), [#295](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/295) (dialogo GAP↔SAL, superseeded #293) |
| **ADR-017 — rete ingest + catalogo UNI (luglio 2026)** | Tre livelli: A regole globali, B `ingest_reference_patterns` (pattern anonimi cross-tenant, no PII), C few-shot org. Catalogo **UNI Store primario** (`uniStoreConnector`) prima di ISO.org. Fix estrazione norme [#223](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/223); dedup/purge/re-audit [#224](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/224). Mig. **120** su VPS **OK** (04/07/2026). **Upgrade backlog**: agente manutenzione norme (cron ~30 gg, report duplicati + re-audit PDF). | [ADR-017](adr/ADR-017-ingest-reference-network.md) |
| **Ingest norme — chiusura refactoring patrimonio (05/07/2026)** | Metadati pre-fix ingestati con pipeline vecchia: **re-audit PDF** (`reaudit-norms-from-pdf-vps.js`) + purge hard-delete (`purge-norms-for-reupload-vps.js`) + ricaricamento manuale. Upload blocca duplicati su `standard_code` (org, esclusi `obsoleto`). DB verificato post-sessione: Mason #1990/#1991 OK; QS Studio patrimonio Camellini #1992 (`EN 1090-2`); ERAM/AI.Admin da ricaricare. **Non** hardenare upload oltre duplicato codice; manutenzione periodica delegata ad agente futuro. | PR [#223](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/223) · [#224](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/224) |
| **UNI Store — due capacità distinte, non confondere** | (1) **Lookup catalogo/vigore** (`uniStoreConnector.service.js`) usa le **API pubbliche** di store.uni.com/uni.com (nessun login, nessun dato protetto) → **già funzionante**, verificato 05/07/2026 su `UNI EN ISO 3834-2:2021` (trova URL catalogo reale). (2) **Estrazione testo integrale norma** richiederebbe login con abbonamento personale/organizzazione (es. Studio Mason) → **testato e scartato** 05/07/2026: la chiamata di autenticazione viene bloccata a livello di rete da una protezione anti-bot (nessuna risposta HTTP, non un problema di selettori), riprodotto sia headless sia headed con user-agent reale. **Non proseguire** con tecniche di evasione (fragili + violano i Termini di Servizio UNI). Per norme mancanti nel catalogo (`docs/Normative/`): download manuale autorizzato da chi detiene l'abbonamento + conversione con `backend/scripts/pdf_to_json/` (stesso pattern delle 6 norme esistenti). | [ADR-010](adr/ADR-010-ai-agentic-architecture.md#stato-implementazione-2026-06-hk-harness-hardening) · script diagnostico `backend/scripts/uni-store-diagnostic.js` |
| **Abbonamento consultazione UNI-CNPI — DRM insormontabile, task abortito (06/07/2026)** | Login assistito riutilizzabile + attivazione/rilascio abbonamento (UTILIZZA/TERMINA, API dirette `store.uni.com`) + download del PDF completo: **tutti automatizzabili**. **Lettura del contenuto no**: il PDF scaricato è cifrato con DRM proprietario **FileOpen (`FOPN_foweb`)** — nessuna libreria open source lo apre (pdfplumber/PyMuPDF/pypdf/pikepdf tutte fallite); la stampa da Acrobat Reader è disabilitata per questo tier di sola consultazione (diverso da acquisto definitivo); lo screenshot automatico della GUI è impossibile per **isolamento sessione Windows** (il processo dell'agente non vede finestre del desktop interattivo). **Non riprendere** questo filone. Se in futuro servirà davvero il testo integrale di una norma: valutare l'**acquisto definitivo** (consente stampa) caso per caso — non un meccanismo generale. Script riutilizzabili da mantenere: `uni-store-diagnostic.js` (login, PR #226), `uni-store-download-and-ingest.js`, `uni-store-consult-and-ingest.js`; lookup catalogo pubblico `uniStoreConnector.service.js` resta valido e va tenuto. | [ADR-010 § Stato implementazione](adr/ADR-010-ai-agentic-architecture.md#stato-implementazione-2026-06-hk-harness-hardening) |
| **Ingestione LEGISLAZIONE da Normattiva (18/07/2026)** — a differenza delle norme UNI/ISO (bloccate da DRM, vedi righe sopra), i testi degli atti ufficiali dello Stato **non** sono coperti da copyright (art. 5 L. 633/1941) e sono ingestabili legalmente da Normattiva.it. **Limite tecnico**: la pagina statica del permalink URN restituisce solo una shell JS (32 KB identici per ogni URN); il testo articolo si carica via sessione + AJAX `/atto/caricaArticolo?...codiceRedazionale=...`. **Soluzione**: harvest one-time con headless browser (Playwright MCP) del div `.bodyTesto` di ogni articolo, salvato in `backend/data/legislation_seed.json` (testo verbatim + permalink `source_url`, `source='normattiva'`); ingestione idempotente con `backend/scripts/ingest-legislation-normattiva-vps.js` in `norm_requirements` (chiave `standard_code`+`clause_ref`+`norm_version`). standard_code `DLgs_81_2008`/`DLgs_152_2006`, clause_ref `art.NN`. Matrice norma↔legge = colonna **`linked_legislation`** già esistente su `norm_requirements` (nessuna migrazione): valorizzata sulle clausole ISO 45001→81/2008 e 14001→152/2006. Il connettore `normativaConnector.getClauseText` (fallback broker step publicLaw, prima morto perché il metodo non esisteva) ora è implementato: prova live, degrada a `null` senza mai inventare testo. **Non** tentare scraping statico di Normattiva né estrazione UNI/ISO. | [ADR-010 Task 2-B/2-D](adr/ADR-010-ai-agentic-architecture.md) · `backend/data/legislation_seed.json` |
| **Ingest AI commesse — slice #5–#7 (luglio 2026)** | Orchestratore `caseDocumentAnalysis.service.js` + `POST /cases/:id/analyze-documents` (pulsante tab Documenti). Checklist §8.2: pannello suggerimenti applica note preliminare+finale con prefisso `[AI doc]`. Copertura saldatori: `GET /cases/:id/extracted-coverage?project_id=` arricchisce WPS con profilo da requisiti estratti (`extractedRequirementsProfile.js`). Deploy: aggiungere i 3 service + utils al `deploy-manifest.json`. | [`MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md`](specs/MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md) §E |
| **Workflow Lead/Deputy** — il deputy esegue slice atomiche, commit per slice, aggiorna `DEPUTYTASK.md` dopo ogni slice. Il Lead prepara il brief in `DEPUTYTASK.md` e `PLAN_…_SLICES.md`. | **Non** usare `.github/agents/` (legacy). Usare `docs/agent-tasks/DEPUTYTASK.md` come unico brief attivo. | [ADR-015](adr/ADR-015-cursor-lead-deputy-workflow.md) |
| **Cloud Agent — environment + context window (luglio 2026)** | Repo ha `.cursor/environment.json` + `AGENTS.md` + regola `sgq-cloud-agent-env.mdc`. Context **default/basso** per Deputy; **1M solo** per Lead/audit ampi. Non ripristinare 1M come default (costo). | Sezione sotto · [cursor.com/docs/cloud-agent](https://cursor.com/docs/cloud-agent) |
| **Wayfinder SGQ — smart zone, non 1M (13/08/2026)** — la skill Matt Pocock `wayfinder` (piano enorme a ticket, una per sessione) è **adattata** al Lead/Deputy: mappa in `PLAN_*_SLICES.md`, esecuzione in `DEPUTYTASK*.md`. **Non** installare il repo `mattpocock/skills` intero (GitHub Issues + grilling tecnico contraddicono ADR-015 e l’autonomia sulle scelte tecniche). | Epic > 1 sessione → skill [`wayfinder-sgq`](../.cursor/skills/wayfinder-sgq/SKILL.md). Deputy resta context default/basso. Esempio già conforme: `PLAN_MATERIAL_COMPLIANCE_SLICES.md`. | [ADR-015](adr/ADR-015-cursor-lead-deputy-workflow.md) · sezione Cloud Agent sotto |
| **Mobile + AI — check prodotto (19/07/2026)** | Telefono = **cattura e verifica** (Audit, NC, scadenze/qualifiche, CND); PC = analisi/report. Vantaggio competitivo AI = risposte **specifiche** (NormBroker + dati azienda + citazioni), non chatbot generico; sempre human-in-the-loop (ISO §7.5). Sequenza slice **M-AI-1…6**. | [`PRODUCT_CHECK_MOBILE_AI.md`](specs/PRODUCT_CHECK_MOBILE_AI.md) · roadmap *Strategia Mobile / Desktop* |
| **M-AI-1…5 completati (19-20/07/2026)** — Pattern `AskAiButton` scalabile + suggestion chip contestuali + suggestion inline NC + contesto qualifiche/WPS. | **Pattern riutilizzabile**: (1) `licenseUtils.hasLicensedModule` condivisa; (2) `AskAiButton` unico componente license-gated + `onBeforeNavigate`; (3) `saveQualContext`/`loadQualContext` per moduli senza audit; (4) `buildContextualSuggestions` con rami clausola/audit/qualifica; (5) suggestion inline (`useAiAssist` + accept/riformula/scarta + `AiDisclaimer`). **Fix test ricorrente**: quando si aggiunge `AskAiButton` a un componente il cui test mocka `RouterContext`, aggiungere `useNavigate: () => () => {}` al mock. **Branch protection**: push diretto su `main` bloccato → usare sempre branch + PR; dopo merge di PR su base comune, il branch figlio risulta BEHIND → fare `git rebase origin/main` + `push --force-with-lease` per sbloccare CI. | PR #259–#265 · [PRODUCT_CHECK_MOBILE_AI.md](specs/PRODUCT_CHECK_MOBILE_AI.md) |
| **Verifica preventiva task «già chiusi» (21/07/2026)** — DEPUTYTASK PR2 Controparti era già implementata su `main` da sessione precedente (commits `565fed3`, `cd93ab1`, `81aae9a`) con il DEPUTYTASK ancora marcato APERTO. | **Regola**: prima di iniziare qualsiasi task da `DEPUTYTASK.md`, verificare `git log --oneline --follow <file_chiave>` per accertarsi che il codice non sia già in `main`. Se trovato: marcare CHIUSO + commit doc, senza toccare codice. Test `contractReviewCounterpartySelect.test.js` (14/14) già presenti confermavano la copertura. | PR #267 · commit `42eb6b0` |
| **Analisi + fix moduli Report e Re-Audit (21/07/2026)** — Gap analysis approfondita dei moduli generazione report e clonazione audit. Identificati 14 gap (P0→P3). Fix autonomi completati: P0 (GAP1/10/11), P1 via deputy (GAP2/3/4/5), P2 GAP6. | **Lezioni**: (1) `handleExportToFileSystem` deve passare `standardKey` per ogni standard (allineato a `handleExportWord`) — senza, checklist e metriche sono aggregate per tutti gli standard. (2) Re-audit: passare `excludeUuid=null` a `checkReaudit` per trovare i rilievi dell'audit corrente (non del precedente). (3) `RDP_MSN` va aggiunto esplicitamente a `TEMPLATE_MAP` — non hereda automaticamente da `3834`. (4) Inizializzare sempre norme/auditor nel re-audit dal `currentAudit.metadata`. | PR #269 (P0) · PR #270 (P1 deputy) · PR #271 (P2 GAP6) |
| **Lavori paralleli deputy + merge Rischi/ActionPlan (22/07/2026)** — DEPUTYTASK2 (Action Plan P1: picker reclamo + statistiche categoria) e DEPUTYTASK1 (Rischi §6.1 Slices 1-3: campo nature, §4.1/§4.2, link Piano Azioni) completati e mergiati. ADR-009 Fase 2 (flag `isIntegratedSystem` SGI) completata e mergiata. | **Lezione conflitto rebase**: quando due deputy toccano lo stesso controller (`nc.controller.js`) in parallelo, il rebase produce conflitto sui destructuring `req.body` — tenere ENTRAMBI i campi nuovi. **Lezione deploy deputy**: verificare sempre che il deputy abbia deployato il backend su VPS; se mancante, deployare con `scp + systemctl restart` prima del merge. | PR #278 (Action Plan P1) · PR #279 (Rischi §6.1) · PR #275 (ADR-009 Fase 2) |
| **Password app in chiaro in 4 script smoke test (24/07/2026)** — segnalata come "password VPS sudo" ma verificando il contesto esatto era in realtà la **password login app** (`admin@sgq.local` via `/auth/login`), non `SGQ_SUDO_PASSWORD`. | **Prima di generalizzare una variabile segreta, verificare sempre l'endpoint/contesto d'uso esatto della riga** (login app ≠ sudo VPS ≠ DB), non fidarsi della descrizione iniziale del problema. Usare il nome **già documentato** in `ACCESSO_DEPLOY_AGENTS.md` (`SGQ_APP_EMAIL`/`SGQ_APP_PASSWORD`), mai inventarne uno nuovo. File corretti: `backend/smoke-norms-upload.sh`, `backend/scripts/smoke-ai-conclusions.sh`, `backend/scripts/curl-nc-responsible-prod.js`, `.cursor/company-client-test.mjs` — password sostituita con `${SGQ_APP_PASSWORD:?...}` (bash) / `process.env.SGQ_APP_PASSWORD` (JS), nessuna rotazione password eseguita (fuori scope), cronologia Git non toccata. | commit `9b6453fa` |
| **Collisione numerazione migrazioni — cartella fantasma `backend/database/migrations/` (22/07/2026)** — Il brief DEPUTYTASK1 (Rischi) indicava `backend/database/migrations/` come destinazione. Quella cartella è una **reliquia storica mai deployata sul VPS** (37 file vecchi, nessuno script `run-migration-*-vps.js` la referenzia — tutti puntano a `/var/www/sgq-backend/database/migrations/`, che corrisponde a `database/migrations/` nella **root** del repo). Il deputy ha creato lì `121_risks_nature.sql`/`122_context_factors...`/`123_nc_source_risk_id.sql`, numeri già occupati nella sequenza reale da `121_nc_correction_gate.sql`/`122_qualifications_14732_fields.sql` (sessione parallela). **Nessun danno DB**: gli script VPS avevano SQL inline (non leggevano il file), già eseguiti con successo — verificato con query dirette su `INFORMATION_SCHEMA` (colonna/tabelle presenti). Fix: file rinumerati **123/124/125** e spostati in `database/migrations/` (root), script rinominati per coerenza. | **Regola vincolante**: prima di assegnare un numero migrazione, verificare **`database/migrations/` (root repo)** — è l'UNICA sequenza canonica (corrisponde a `/var/www/sgq-backend/database/migrations/` sul VPS). **Mai** usare `backend/database/migrations/` (nome simile, ma morta). Aggiornare sempre `sgq-sysadmin.mdc` e i brief DEPUTYTASK con questo path esplicito. | commit fix numerazione · branch `cursor/fix-migration-numbering-collision-3bea` |
| **Gap Analysis `/gap-analysis` rotta — colonne inesistenti `document_type`/`is_current` (23/07/2026)** — `gapAnalysis.service.js` (euristica documenti, `runGapAnalysis`/`validateEvidenceDocumentIds`/`enrichRowsWithEvidence`) interrogava `document_registry` con `document_type` (colonna reale: **`doc_type`**, mig. 029) e `is_current` (colonna **inesistente** su questa tabella — il soft-delete è `status <> 'obsoleto'`, come in `document.controller.js`). Il bug era presente da subito (mai testato E2E contro schema reale) e produceva `500 Invalid column name` su ogni avvio dell'analisi. Anche il test L1 esistente **rispecchiava il bug** (mockava `document_type`/asseriva `is_current = 1` nella query) — un falso positivo che non avrebbe mai potuto scoprirlo. | **Regola**: quando un test unitario mocka `query()` e asserisce sulla stringa SQL, verificare che i nomi colonna nel mock corrispondano allo **schema reale** (migration file), non solo che il test sia interno-consistente — altrimenti il test blinda il bug. **Regola deploy**: dopo `deploy-to-vps.sh`, non fidarsi solo del log "file copiati"/PID cambiato — verificare col `grep`/`md5sum` **il contenuto del file specifico appena corretto** sul VPS (osservato un caso in cui, nonostante lo script terminasse con successo e PID cambiato, il file copiato conteneva ancora la versione pre-fix; root cause non isolata con certezza — possibile interferenza fra sessioni SSH concorrenti). Il deploy di questo fix ha innescato anche un **crash-loop transitorio self-healing** di `sgq-backend` (systemd `Restart=on-failure` + errore di sintassi momentaneo su un altro file del manifest durante la copia sequenziale) risolto dal riavvio automatico dopo pochi secondi — non è stato necessario intervento manuale su quel fronte. | PR #292 · smoke E2E autenticato (login reale + `GET /gap-analysis?companyId=...&standardCode=ISO_45001_2018` 500→200) |
| **ADR-009 completato Fasi 1-4, Fase 5 chiusa come "superata" (22/07/2026)** — Fase 3 (export Word integrato SGI + bundle ZIP multi-standard) e Fase 4 (custom checklist pari grado a ISO negli audit ibridi) implementate. Fase 5 (audit → document_registry automatico alla chiusura) **non implementata**: superata da una decisione di prodotto presa il 07/06/2026 (chiusura PR #52) che ha scelto il caricamento manuale del verbale con `revision` pre-compilata, non un automatismo. | **Lezione metodologica**: prima di eseguire una fase di un ADR datato, verificare se decisioni di prodotto successive l'hanno superata — non implementare ciecamente un piano vecchio senza controllare lo stato reale del backlog. **Lezione tecnica Fase 4**: bug reale scoperto durante l'implementazione — l'export Word per audit ibridi (ISO + checklist personalizzata insieme) ometteva **silenziosamente** il contenuto della checklist custom (il branch "export custom" richiedeva l'assenza totale di standard ISO). Fix: `ExportPanel.jsx` genera ora un file Word aggiuntivo dedicato al custom, in più rispetto ai file ISO, per ogni audit ibrido. Custom checklist non si integra mai con `isIntegratedSystem` (kind='custom' nel registry, mai integrabile) — ottiene sempre un blocco separato indipendente dal flag SGI. | PR #284 (Fase 3) · commit ADR-009 Fase 4 (22/07/2026) |
| **Triage e merge autonomo PR arretrate — 6 PR "in attesa" mergiate (22/07/2026)** — #103 (fix `releaseRevision` NULL SQL), #180 (seed checklist QTAFI Mason), #189 (script analisi orfani DB), #171 (registro documenti: ambito cartelle + scope), #177 (fix indice NDT per-organizzazione). Pattern ricorrente: la migrazione NDT `114_ndt_reports_number_index_fix.sql` era stata creata nella cartella fantasma `backend/database/migrations/` (già occupata a 119) — stesso errore già visto per Rischi (riga sopra) — rinumerata **126** e spostata in `database/migrations/` (root) prima del merge, script VPS rinominato `run-migration-126-ndt-number-index-vps.js` (idempotente, non ri-eseguito: già applicato in produzione col vecchio nome). Un test Vitest (`salAiSuggest.test.jsx`) è risultato **flaky in CI** (fallito nella suite completa, verde se rilanciato/isolato) — non era un bug della PR NDT: prima di bollare una PR come "test falliti per bug reale", rilanciare la CI (`gh pr update-branch` + attesa) e verificare che il file fallito non sia estraneo al diff della PR. | **Lezione multi-agente**: durante questa sessione un'altra sessione/deputy ha operato **in parallelo sullo stesso workspace** (merge PR #287 e fix+merge autonomo di PR #171/#177/#103/#180/#189 avvenuti mentre questa sessione lavorava sulle stesse PR) — i comandi `git checkout`/branch locali possono quindi "spostarsi" per intervento esterno tra un comando shell e il successivo: **verificare sempre `git branch --show-current` + `git log -1` prima di operazioni distruttive** (`git add -A`, `checkout --`) quando si sa che altre sessioni sono attive sul medesimo repo locale. **PR #242 completata di seguito**: conflitto reale risolto a mano in `documentIngestPipeline.service.js` (unito logging dettagliato + messaggio errore pulito) e `qualificationIngest.service.js` (uniti campi `pipe_diameter_min/max_mm` di `main` con le date/fallback conferma semestrale della PR); test file `qualificationIngest.service.test.js` in conflitto add/add — unite entrambe le suite invece di sceglierne una. **Lezione deploy manifest**: `customChecklist.service.js` importa `../data/qtafiVis001Template.js`, assente da `deploy-manifest.json` — un deploy con quel service senza il data file avrebbe causato `MODULE_NOT_FOUND` al restart; **verificare sempre i `require()` dei file nuovi/modificati contro il manifest prima del deploy**, non solo i file elencati nella PR. | PR #103, #180, #189, #171, #177, #242 tutte mergiate e deployate su VPS (verificato via hash MD5 + health check) |
| **NC ambito azienda — selettore aggiunto ma non collegato ai responsabili (25/07/2026, seguito della riga sotto)** — dopo il fix del 400, il cliente segnalava ancora NC "slegate" dall'azienda e menu Responsabile attuazione/verifica incoerenti. Causa: il nuovo select "Azienda/ambito" in `NcCreateModal.jsx` scriveva solo in `form.company_id` (usato per il payload), ma i menu Responsabile leggono i contatti tramite `loadNcResponsibleContacts({ companyId: selectedCompanyId })` — una **variabile di stato separata**, pensata originariamente solo per il flusso audit (`audit.company_id`), mai collegata al nuovo select manuale. Risultato: `selectedCompanyId` restava sempre `null` per le categorie non-audit → `loadNcResponsibleContacts` andava sempre sul fallback rubrica legacy org-wide invece che su `GET /non-conformities/responsible-options?company_id=...` (personale+rubrica della azienda scelta). Il backend (`nc.controller.js`, `ncResponsibleOptions.service.js`, query lista/dettaglio) era già corretto — bug **100% frontend**, un classico "due fonti di verità per lo stesso dato" introdotto aggiungendo una feature senza ricollegare tutti i consumer dello stato esistente. | **Regola**: quando si aggiunge un nuovo campo/selettore che duplica concettualmente un dato già usato altrove nello stesso componente (qui: "azienda selezionata"), **non creare un secondo stato** — riusare l'unico esistente o sincronizzarlo esplicitamente con un effetto dedicato, mai lasciare che due `useState` rappresentino la stessa informazione con vie di aggiornamento diverse. Fix: aggiunto un `useEffect` dedicato che sincronizza `selectedCompanyId` da `form.company_id` per le categorie non-audit (`[open, requiresAudit, form.company_id]`), rimosso il reset ridondante `setSelectedCompanyId(null)` dall'effetto "Carica sezioni" (avrebbe vinto la race sovrascrivendo la sync, essendo dichiarato dopo) e da `handleCategoryChange` (si azzera solo passando a categoria audit, dove sarà ridefinito dall'audit scelto). **Regola test**: per bug di sincronizzazione stato React, un test di solo testo/grep non li intercetta — serve un render reale (`@testing-library/react`) che simuli l'interazione utente (select→fireEvent.change) e verifichi l'argomento passato alla funzione a valle; verificato che il test fallisse (2/3) sul codice pre-fix prima di considerarlo valido. | test `ncCreateModalCompanyScope.test.jsx` |
| **Qualifiche saldatori — "Error converting data type nvarchar to numeric" bloccava cliente reale in produzione (27/07/2026, cliente Mason)** — revisione/conferma di un patentino ISO 9606-1 (ingest AI da PDF) falliva al salvataggio col popup SQL Server nel titolo. Causa radice: `commitQualificationFromFields`/`mapPipelineFieldsToReview` (`qualificationIngest.service.js`) scrivevano `f.thickness_min_mm ?? null` (idem `thickness_max_mm`, `pipe_diameter_min_mm/max_mm`) su colonne **DECIMAL** (`qualifications`, mig. 092) senza alcuna conversione numerica. L'operatore `??` non intercetta la stringa vuota `""` (campo lasciato vuoto, come suggerito dall'hint UI "lascia vuoto se non c'è limite superiore") né testo come `"N.A."` (letterale nel PDF originale per giunti FW/tubo dove certi campi non si applicano) — il driver `mssql` bind-a una stringa JS come `NVarChar`, SQL Server rifiuta la scrittura su una colonna `DECIMAL`. Lo stesso pattern (`?? null` + `parseFloat` senza guardia) esisteva anche in `wpsIngest.service.js` (`thickness_range_min/max` su `welding_procedures`, DECIMAL) e nel path manuale `qualifications.controller.js` (`ndt_level`/`training_hours` con `parseInt` grezzo su colonne INT). | **Fix condiviso**: nuova utility `backend/src/utils/numericSanitizer.js` (`toNumericOrNull`) — policy documentata nel file: stringa vuota/whitespace/token "non applicabile" (N.A., N/D, "-", ecc.) → `null`; virgola decimale italiana → punto; simboli soglia (≥/≤/~/</>) rimossi; range testuale ambiguo su un campo singolo (es. "3-6") → primo numero trovato (mai una stringa al driver SQL). Applicata in **tutti** i punti di scrittura numerica: `qualificationIngest.service.js` (thickness/pipe_diameter/ndt_level, sia in revisione che in commit), `wpsIngest.service.js` (thickness_range_min/max), `qualifications.controller.js` (`toNum`/nuovo `toIntOrNull` per ndt_level/training_hours, riusato dal path manuale create/update — difesa in profondità anche se il form React invia già numeri). **Regola per il futuro**: qualsiasi campo che scrive su una colonna DECIMAL/NUMERIC/INT proveniente da ingest AI, OCR o form con opzioni "N.A." deve passare da `toNumericOrNull`/`toIntOrNull` — mai un `?? null` nudo, che non filtra stringhe vuote o testo. | commit fix + test (`numericSanitizer.test.js`, `qualificationIngest.service.test.js`, `wpsIngest.service.test.js`, `qualifications.controller.test.js`) |
| **UX conseguente — campo diametro tubo nascosto se prodotto = piastra (27/07/2026, seguito del fix nvarchar sopra)** — dopo aver risolto il crash SQL, il committente ha chiesto (giustamente: buona pratica di usability/integrità dati, evita l'ambiguità "N.A. perché non richiesto" vs "N.A. perché dato mancante") che i campi non applicabili alla combinazione scelta non siano più semplicemente compilabili con placeholder "N.A.". Verificato nel codice: `weldingQualificationRules9606.js` non esponeva alcuna funzione di lookup applicabilità campi (solo calcolo range) — aggiunta `getApplicableWelderFields({ productType })` (sincronizzata in `app/` e `backend/`, unica sorgente). Unica regola codificabile con certezza (Tabella 7): il diametro tubo ha senso solo se `product_type === 'T'` — il tipo di giunto (BW/FW) NON lo esclude (si eseguono anche su tubo). Nessuna prova per altre esclusioni joint-type-only (es. spessore su FW: Tabella 8 lo definisce comunque) — non implementate per evitare regole normative non verificate. Applicato in `IngestReviewDialog.jsx` (campo `pipe_diameter_mm`, nascosto con nota "Non applicabile — prodotto: Piastra" quando non pertinente, valore azzerato via `useEffect` se il tipo prodotto cambia dopo la compilazione) e in `QualificationForm.jsx` (stessa logica su `pipe_diameter_min_mm`/`max_mm`, condivisa da 9606/14732/15614). Sanitizer backend (`numericSanitizer.js`) resta comunque seconda linea di difesa. | **Regola**: prima di implementare un'esclusione condizionale UI basata su una norma tecnica, verificare che la fonte dati esistente (qui `weldingQualificationRules9606.js`) codifichi davvero quella regola con certezza — se manca solo l'esposizione di una funzione di lookup, estendere lì (non duplicare), ma non inventare esclusioni aggiuntive senza riscontro nel testo normativo o nel feedback cliente verificato. | commit UX campi condizionati + test Vitest (`weldingQualificationRules9606.test.js`, `ingestReviewDialog.test.jsx`, `qualificationFormConditionalFields.test.jsx`) |
| **Gap residuo chiuso — WPQR ingest allineato a `numericSanitizer` (27/07/2026, hardening proattivo)** — dopo il fix qualifiche/WPS sopra, `wpqrIngest.service.js` (`mapPipelineFieldsToReview`/`mapReviewFieldsToDb`, usato da `POST /api/v1/welding/wpqr/upload-batch`, endpoint live) aveva ancora `thickness_test_mm` con guardia parziale (`!= ''` + `parseFloat`, non gestiva "N.A."/virgola/soglie) e `thickness_min`/`thickness_max`/`diameter_min`/`diameter_max` **senza alcuna protezione** (passthrough diretto verso `wpqr_records`, colonne DECIMAL) — stesso crash SQL riproducibile con un WPQR "N.A." su spessore/diametro. | Sostituiti tutti e 4 i punti con `toNumericOrNull` (stesso identico pattern dei 3 file già corretti); per i range dichiarati, il fallback al calcolo automatico (`calcThicknessRange`) ora scatta anche quando il valore dichiarato non è numerico (prima scattava solo se il campo era `null`/`undefined`, lasciando passare stringhe come "N.A."). | commit hardening + test (`wpqrIngest.service.test.js`, 2 nuovi casi) · deploy VPS con verifica PID/health |
| **NC creazione bloccata 400 — audit senza standard associati + errore FE invisibile (25/07/2026)** — cliente reale (org 1002, admin) non riusciva a creare NC di tipo "Audit interno": il backend rispondeva 400 `NO_STANDARDS_FOUND` perché `createNonConformity` risolveva lo standard con `SELECT TOP 1 standard_id FROM audit_standards WHERE audit_id=...` **senza fallback**, mentre l'audit selezionato (bozza, standard non ancora assegnati) non aveva righe in `audit_standards`. Il bug era **doppiamente invisibile**: (1) un helper già esistente e più robusto (`resolveAuditStandardId`, con `ORDER BY` + fallback ISO 9001) era usato solo da `pushAuditToNcRegister` ma non dalla creazione manuale singola; (2) `NcCreateModal.jsx` leggeva l'errore con `err?.response?.data?.error` (convenzione Axios), ma `apiService.js` lancia una `ApiError` custom con `.message`/`.code`/`.data` **diretti sull'oggetto** (fetch-based, non Axios) — quindi l'utente vedeva sempre il messaggio generico "Errore durante la creazione.", mai la causa reale, e anche il debug lato server risultava difficile perché i log/tentativi non davano nessun indizio visibile lato client. Riscontrato anche un secondo bug collegato: `getNonConformityById` usava `INNER JOIN audits` che escludeva sempre le NC non legate ad audit (dettaglio 404 per qualunque azione manuale). Diagnosi rallentata anche da un **processo Node orfano dal giorno precedente** ancora attivo sul VPS accanto a quello gestito da systemd (probabile relitto del fallback `fuser+nohup`, vedi lezione crash-loop sopra) — contribuiva a 503 intermittenti su altri endpoint nello stesso batch di richieste, disorientando la diagnosi. | **Regola**: quando esiste già un helper più robusto per la stessa risoluzione dati (qui `resolveAuditStandardId`+fallback), usarlo ovunque serva lo stesso dato — non duplicare una versione più fragile in un secondo endpoint. **Regola FE**: `apiService.js` lancia `ApiError` con proprietà dirette (`err.message`, `err.status`, `err.code`, `err.data`) — **mai** `err.response.data.*` (pattern Axios, non applicabile qui). Bonificato lo stesso bug in 10 file frontend che lo replicavano (`ManagementReviewsPage`, `NCPage`, `ComplaintsPage`, `EquipmentPage`, `CreateAuditPage`, `AuditClosePanel`, `NdtReportsPage`, `RDPModule`, `DocumentTree`, `AnagrafichePage`). **Feature aggiunta**: colonna `company_id` diretta su `non_conformities` (mig. **134**) per imputare ad un'azienda specifica anche le NC non legate ad audit (rischi, riesame, reclami, miglioramento) — select opzionale "Azienda / ambito" in `NcCreateModal.jsx`, validazione ownership lato backend (pattern copiato da `listNcResponsibleOptionsHandler`: `companies.auditor_org_id → auditor_orgs.id → organizations.organization_id`, **mai** un confronto diretto `companies.auditor_org_id = organization_id`). **Regola sysadmin**: dopo ogni deploy con restart di fallback (`fuser+nohup`), verificare `ps aux \| grep 'node src/server.js'` per processi duplicati/orfani — un PID più vecchio ancora vivo accanto a quello nuovo è un segnale di instabilità futura (memoria, 503 intermittenti), va terminato (`kill -9`). | Migrazione 134 · fix `nc.controller.js`/`NcCreateModal.jsx`/`ncCreateHelpers.js` |
| **Qualifiche — campi vuoti in modifica dopo ingest (01/08/2026, patentino LOVETERE)** — dopo conferma revisione AI, aprendo la matita alcuni campi risultavano vuoti (`filler_material`, diametro tubo, `revalidation_date`, a volte `examiner_body`) pur essendo stati visti in revisione. Diagnosi DB su `#1049`: colonne davvero `NULL`; non era un bug di hydrate del form. Causa: (1) schema AI/revisione usa `filler_material_group` + `pipe_diameter_mm`, ma `commitQualificationFromFields` **non scriveva** `filler_material` e **non mappava** `pipe_diameter_mm` → min/max; (2) fallback incrociato `material_group \|\| filler_material_group` contaminava la designazione con il gruppo base (`11.1` al posto di `FM*`); (3) path `importJobs.commitToQualification` non persisteva `transfer_mode` (asimmetria inversa). | **Regola**: ogni campo mostrato in `IngestReviewDialog` / `documentTypeSchemas` deve avere un bridge esplicito fino alla colonna DB nel commit (alias + INSERT). Mai mescolare `material_group` (ISO/TR 15608) con `filler_material`/`filler_material_group` (FM1–FM6). Diametro singolo AI → `pipe_diameter_min_mm` (max null → designazione `D≥…`). Form FE: alias `filler_material_group`/`pipe_diameter_mm` in hydrate + anteprima designazione legge anche `filler_material`. | PR [#340](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/340) MERGED |
| **Qualifiche — link "Visualizza certificato allegato" non apre il PDF (01/08/2026)** — il DB aveva `certificate_file_url=/uploads/qualifications/...pdf` e il file esisteva sul VPS (HTTP 200 su `:8443/uploads/...`), ma il `<a href>` relativo apriva il path sul dominio Netlify → 404. Stesso pattern su lista qualifiche e link certificato WPQR. | **Regola**: ogni link a file in `/uploads/...` dal frontend deve passare da `resolveBackendUploadUrl(url, apiService.baseUrl)` (stesso bridge già usato per template report / loghi). Mai usare il path relativo grezzo in `<a href>`. | PR [#340](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/340) MERGED |
| **Rielaborazione filler/diametro post-bug ingest (01/08/2026)** — dopo PR #340 il commit nuovo è corretto, ma i patentini già in DB restano con `filler_material`/`pipe_diameter_min_mm` NULL. | Esteso il registro già esistente (`reprocessableFields.js` + `REPROCESSABLE_FIELDS`) con `filler_material` e `pipe_diameter_min_mm` (alias AI → colonna in `resolveExtractedReprocessValue`; filtro `productTypeWhitelist: ['T']` per il diametro). Lancio CLI sul VPS: **19/19** proposte `filler_material` + **3/3** `pipe_diameter_min_mm` in coda revisione (da confermare in Qualifiche). `revalidation_date`: backfill SQL **24** righe (`expiry_date`, senza AI). | PR #342 |

### Testing (Vitest/Jest)

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **`waitFor(apiCalled)` non equivale a "la UI ha i dati"** — `deadlinesPage.filterCards.test.jsx` flake in CI (suite completa, verde in isolamento): `getDeadlineItems` risulta already called mentre la griglia è ancora `Caricamento...`, poi `getByText("Termometro")` fallisce. Stesso flake su `ncPage.filterCards.test.jsx` (card Chiuse, PR #401). | In test RTL su liste async, `waitFor` deve cercare **il contenuto visibile** (riga, conteggio card), non solo `toHaveBeenCalled()` sul mock. `mockResolvedValue` (stabile) al posto di `Once` se il componente può rifetchare. | `deadlinesPage.filterCards.test.jsx` · `ncPage.filterCards.test.jsx` · PR #401 |
| **Non dire «PR pronta» prima della CI GitHub** — 13/08/2026: test locali verdi, committente non poteva mergiare perché `CI app / test-and-build` era rosso. | «Pronta» = `get_ci_status` SUCCESS. I test sul workspace dell'agente **non** sostituiscono il check GitHub. | `.cursor/rules/sgq-git-autonomy.mdc` § pronto al click |
| **Backend Jest — 5 test falliti "pre-esistenti" erano quasi tutti test rimasti indietro rispetto a un fix legittimo, non bug nuovi.** Diagnosi 1 per 1: (1) `attachment.controller.test.js` assertiva la query SQL senza `rdp_r.organization_id`, aggiunta legittimamente dalla feature RDP (`f154c94e`) → **fix test**; (2) `auditNumberAllocation.service.test.js` assertiva default prefisso `'MSN'`, cambiato intenzionalmente in `'AUD'` in `7c42b6dd` (commit lo dichiara esplicitamente) → **fix test** + commento stale aggiornato; (3) `docAlertEscalation.service.test.js` aveva un refuso nel fixture (`'Manuale qualità '` minuscolo vs assert `'Manuale Qualit'` maiuscolo) → **fix fixture**; (4) `auth-rbac.test.js`/`auditEvents.test.js` (integration) fallivano con `EADDRINUSE :::10443` perché `server.js` chiama `app.listen(PORT)` come side-effect al `require()`, e più file integration nello stesso worker Jest bindano la stessa porta fissa — supertest non ne ha bisogno (`request(app)` crea un socket effimero da solo) → **fix**: guardia `if (process.env.NODE_ENV !== 'test') startServer()` in `server.js`. (5) `normCodesImport.service.test.js` era invece un **bug reale**, **risolto il 27/07/2026**: `standardCodeNormalizer.service.js` era pensato solo per codici ISO/UNI/EN e, su un codice di legge italiana come `"D.Lgs. 81/2008"`, scartava silenziosamente il token testuale non riconosciuto producendo un canonical insensato (`"81-2008:2008"`). | Prima di segnare un test come "pre-esistente non correlato", leggere `git log -p` del file di produzione toccato: spesso il messaggio di commit dichiara già il cambiamento intenzionale, e il fix è aggiornare il test, non il codice. Per i test di integrazione con server Express reale, mai lasciare `app.listen()` su porta fissa attivo in `NODE_ENV=test`: guardarlo sempre, supertest non ne ha bisogno. **Fix (27/07/2026)**: branch **additivo** e indipendente in `parseStandardCode` — `parseItalianLawCode()` riconosce all'inizio stringa le label `D.Lgs.`, `D.P.R.`, `D.M.`, `D.L.`, `Legge`/`L.`, `Circolare`/`Circ.`, `Regolamento`/`Reg.` seguite da `numero[/ -]anno` e ritorna il riferimento **invariato** (solo separatore normalizzato a `/`), **senza** attraversare la tokenizzazione ORG_TOKENS/DOC_TYPE_TOKENS che spezzava "81/2008". Verificato che i 5 punti che usano il modulo (`documentRegistryNorm.service.js`, `normCatalogLookup.service.js`, `uniStoreConnector.service.js`, `normIngest.service.js`, `ruleFieldExtractors.js`/pipeline ingest WPQR-WPS-norma) restano invariati sui codici tecnici esistenti — anzi corregge un effetto collaterale: prima del fix, `isPublicLawLookup` non riconosceva più il codice normalizzato come atto italiano (perché "D.Lgs." veniva perso) e finiva per interrogare erroneamente UNI Store invece di Normattiva. | sessione 27/07/2026 — 5 test Jest backend (4 fixati subito, 1 bug reale chiuso in sessione successiva stesso giorno) |

### Cloud Agent Cursor — ambiente e context window

Configurazione **versionata nel repo** (priorità massima rispetto all'ambiente personale dashboard):

| File | Ruolo |
|------|--------|
| `.cursor/environment.json` | Install dipendenze all'avvio VM (`app/` + `backend/`) |
| `.cursor/scripts/cloud-install.sh` | Script idempotente `npm ci` |
| `AGENTS.md` | Istruzioni Cloud + policy context/costi |
| `.cursor/rules/sgq-cloud-agent-env.mdc` | Regola sempre attiva per gli agenti |

**Come scegliere il context window** (UI su [cursor.com/agents](https://cursor.com/agents) → **Edit** accanto al modello):

| Tipo run | Context | Perché |
|----------|---------|--------|
| Deputy / slice da `DEPUTYTASK.md` | Default o basso | Brief già mirato; 1M spreca budget |
| Lead / sync / RBAC / multi-modulo | Alto o 1M se serve | Serve tenere molti vincoli insieme |
| Fix 1–2 file a basso rischio | Default | CI Netlify basta come L1 |

**Secrets** (Dashboard → Cloud Agents → Secrets, non in Git): `SGQ_SSH_KEY_B64`, `SGQ_SUDO_PASSWORD`, `SGQ_APP_EMAIL`, `SGQ_APP_PASSWORD` — dettaglio in [ACCESSO_DEPLOY_AGENTS.md](how-to/ACCESSO_DEPLOY_AGENTS.md).

**Nota operativa una tantum (dashboard):** impostare modello default Cloud su standard/fast e context **non** 1M; alzare solo per run Lead espliciti. Spend limit: [Dashboard → Spending](https://cursor.com/dashboard/spending).

**Dieta avvio (13/08/2026):** non leggere GUIDA né la roadmap per intero all'avvio — saturano la smart zone. Protocollo in `AGENTS.md`; bussola in `PROJECT_CONTEXT.md`; misura `node backend/scripts/check-harness-boot.js`.

**Una sessione = una slice.** Se non chiudi: handoff in [`HANDOFF_TEMPLATE.md`](agent-tasks/HANDOFF_TEMPLATE.md) nel brief attivo. Gate codice nuovo: Ponytail in `sgq-operating-memory.mdc`. Smoke UI: `backend/scripts/smoke-percorsi-critici.mjs`.

**Smart zone (Matt Pocock, adattato 13/08/2026):** oltre ~100–150k token la qualità cala anche se la finestra è 1M. Un lavoro enorme si spezza con [`.cursor/skills/wayfinder-sgq/SKILL.md`](../.cursor/skills/wayfinder-sgq/SKILL.md) (mappa `PLAN_*` + una slice per sessione). Non alzare il context «perché l'epic è grosso»; non installare il pacchetto intero `mattpocock/skills`.

### Multi-tenant, RBAC e dati

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Isolamento dati AI multi-tenant** | Utente **STUDIO**: vista d'insieme, può selezionare solo tra le **proprie aziende clienti** (`auditor_org_id`). Utente **AZIENDA cliente**: il backend **forza** `company_id` sull'anagrafica primaria (mai fidarsi del `companyId` dal client), niente 403. **RAG**: filtro `company_id = @compId`, **niente** `OR IS NULL` / chunk globali. | [PR #91 — regola scope azienda AI](archive/sessions/GUIDA_DIARIO_2026.md#pr-91--regola-di-prodotto-ambito-azienda-dellassistente-ai-07062026) |
| **Provisioning nuovo studio da UI — S1/S2 completi, S3 (primo admin) bloccato da architettura esistente (10/08/2026, DEPUTYTASK1)** — implementato `POST /api/v1/auditor-orgs` (solo superadmin, transazione `organizations`+`auditor_orgs`, `organization_code` `ORG_%05d` successivo) + form "+ Nuovo studio" in `UsersAdminPage.jsx` (append immediato alla lista, licenze default = tutti i moduli). Verificando S3 con un test Vitest reale (non solo a occhio) è emerso che il form "Nuovo utente" **non può mai** assegnare il primo utente a uno studio appena creato: il select filtra `ao.organization_id === user.organization_id` (riga ~727) e `admin.controller.js::createUser` forza sempre `organization_id = req.user.organization_id`, validando `auditor_org_id` sulla stessa org — un nuovo studio ha per definizione un `organization_id` diverso da quello del superadmin che lo crea. | **Regola**: quando un brief assume "nessun codice aggiuntivo necessario se lo slice precedente è fatto bene" per un passaggio che attraversa un confine multi-tenant, **verificarlo con un test end-to-end reale** (qui: creare lo studio nel test e poi controllare il select) prima di dare per scontato che lo stato condiviso basti — un filtro o una validazione scoped-per-org a valle può rendere invisibile/inutilizzabile un dato appena creato anche se lo stato React è aggiornato correttamente. Il fix (permettere a un superadmin di creare il primo utente per un `organization_id` diverso dal proprio) tocca `POST /admin/users` (auth/creazione utenti cross-tenant) — Alto rischio, richiede conferma esplicita del committente prima di procedere; **non applicato in questo slice**, tracciato in backlog. | [PROJECT_ROADMAP.md § Backlog](PROJECT_ROADMAP.md#backlog-parcheggiato-task-futuri--fonte-unica) · `backend/src/controllers/auditorOrg.controller.test.js`, `app/src/tests/usersAdminPage.test.jsx` |
| **Qualifiche — una azienda per certificato** | Ogni qualifica ha `company_id` **obbligatorio** (UI ambito + form, API `qualificationCompany.service`, mig. 087). Import AI eredita `company_id` dal job. Dopo approvazione **non** si cambia azienda; stesso numero certificato/PDF non può esistere su un'altra azienda del tenant. Pattern UI: `qualificationsCompanyScope.js` (come registro documenti). | [Aggiornamento 10/06/2026 — qualifiche company scope](archive/sessions/GUIDA_DIARIO_2026.md#aggiornamento-10062026--qualifiche-ambito-azienda-obbligatorio) |
| **Anagrafica personale ↔ qualifiche** | `company_personnel` = master (nome, mansione, email); `qualifications` = fascicolo certificati con `personnel_id` FK opzionale. Import guidato + backfill link; tab **Salute mansione** (3 tipi form: idoneità visiva unica acuità+Ishihara, idoneità medica, sorveglianza; alias legacy letti). Mig. **088** + unificazione visione 03/08/2026. | [Aggiornamento 10/06/2026 — collegamento personale-qualifiche](archive/sessions/GUIDA_DIARIO_2026.md#aggiornamento-10062026--collegamento-anagrafica-personale-qualifiche) |
| **Controparti azienda ↔ riesame commerciale** | `company_counterparties` sotto `companies` (ruoli `customer` / `end_customer` / `supplier`). Mig. **096** tabella + `commercial_cases.commercial_customer_id`; mig. **097** backfill idempotente da `commercial_customer_name`/`ref` (095) e `projects.client_name` → `end_customer_id`. **Snapshot 095 non rimosso** (deprecato, non DROP). Write: se FK impostata, `contractReview` sincronizza name/ref dalla controparte (`commercialCustomerCounterparty.service`). Verifica: `node backend/scripts/verify-counterparties-migration.js`. Pilota: LM&CO = azienda SGQ, PT.MAIDO = `end_customer`. | sessione 14/06/2026 |
| **Saldatore ISO 9606-1 — campi end-to-end** | Catena AI→schema(FE/BE)→commit→DB→scheda allineata sulle **stesse chiavi**: ogni nuovo campo va in `aiPrompt`/`aiExpectedSchema`, `fields[].key` FE, e mappatura `commitToQualification`/`qualificationIngest`, altrimenti l'AI estrae ma il commit lo scarta. Mig. **092**: spessore/diametro **numerici min/max** (deriva legacy `thickness_range`/`pipe_diameter`), date `exam_date`/`last_confirmation_date`/`next_confirmation_due`/`revalidation_date` (stop overwrite `issue_date`), `product_type`/`weld_details`/`qualification_designation` (calcolata). Semaforo 9606 = **min(next_confirmation_due, expiry_date)** difensivo. Obbligatori scheda su blur/submit; in import-commit solo **warning**, mai blocco. | commit `0034399`/`f7936c1`/`8d427d8` |
| **Import PDF → qualifica: PDF collegato** | `commitToQualification` imposta `certificate_file_url` da `import_job_files.storage_path` (pattern `/uploads/...` come ingest) e `import_job_files.qualification_id` (mig. **093**). Link visibile subito in `QualificationsPage` / `QualificationForm`. | sessione 14/06/2026 |
| **Feedback cliente reale (Studio Mason) — priorità sui GAP normativi** | 6 punti su patentini saldatori, tutti risolti/proposti in una sessione: ODC mancanti (`issuing_body` select), **gruppo padre selezionabile oltre al sottogruppo** in `material_group` (il cliente ha corretto una regola RC-0 scritta senza controfirma reale: ISO 9606-1 qualifica per gruppo intero, il certificato spesso riporta solo il gruppo padre), simbolo **≥** per spessori/diametri senza limite superiore (`weldingDesignation.js`, `deriveRangeString`), label "Data di scadenza" generica (rimossa assunzione "2 anni" errata per 9606-1), nota advisory (non auto-fill DB) per diametro piastre in posizione rotante marcata **non verificata su copia integrale norma**, hardening logging/messaggi errore batch upload (`ingestErrorMessage.js`). **Regola**: quando una regola normativa in `docs/reference/*.md` è dedotta solo da analisi codice/norma senza controfirma su caso reale, marcarla "da confermare su campione reale" — non bloccare opzioni valide nel form. | `docs/agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md` § Feedback cliente Studio Mason · branch `fix/feedback-studio-mason-patentini` |
| **Nome ente da feedback cliente — verificare, non indovinare** | Il punto 1 del feedback Studio Mason citava "Tec Eurolab / Sideius" come ODC mancante; una prima stesura aveva inserito per errore **"Sidercert"** (nome mai citato dal cliente, solo simile). Verifica web ha confermato **Sideius S.r.l.** = gruppo accreditato ACCREDIA che comprende i brand **TEC Eurolab** (lab prove) e **Valor** (organismo di certificazione). Corretto in `documentTypeSchemas.js` (option `sideius`, label "Sideius (Valor)"). **Bug collegato scoperto nella verifica**: `normalizeIssuingBodyCode` in `textEncodingRepair.js` mappava sia "TEC Eurolab" sia "Sideius" genericamente su `altro`, disallineato dalle opzioni select — ogni nuova opzione UI va **sempre** propagata anche al normalizzatore backend, non solo al select frontend. **Regola**: quando un feedback cliente cita un nome proprio (enti, laboratori, aziende) mai desumerlo per assonanza — verificare con ricerca web o chiedere conferma esplicita prima di scriverlo nel codice. | commit `279cbb1` · 17/07/2026 |
| **Nota "da confermare/non verificata" — prima di lasciarla così, ricercare il testo originale della norma.** Due punti del feedback Studio Mason (16/07/2026) erano stati codificati come "GAP/da confermare su copia integrale" (nota diametro piastra in posizione rotante) e come possibile richiesta di una terza categoria "tubo-piastra" nel `product_type`. Alla verifica puntuale del 27/07/2026 su `docs/Normative/Normative NORMA_00018_ UNI EN ISO 9606-1_2017 Rev. 0.md` (già digitalizzato, mai riletto per questo dettaglio) entrambi i punti erano **testualmente presenti** nella norma (§5.3 criteri b/c per il diametro; §3.16/§5.4c per il "branch joint" = tipo di giunto, non terza categoria prodotto) — non erano ipotesi cliente da prendere con riserva, solo dettagli mancanti nell'estratto sintetico del catalogo. Aggiornati in sincronia `weldingQualificationRules9606.js` (FE+BE), relativi test, `documentTypeSchemas.js` (hint AI) e `ISO-9606-1-range-validita-patentino.md`. **Regola**: quando in `docs/reference/*.md` c'è una nota marcata "non verificata/da confermare" e la fonte normativa integrale è già stata digitalizzata in `docs/Normative/`, non lasciarla a tempo indeterminato — cercare prima il termine chiave nel `.md` sorgente: spesso il dato "mancante" è solo non ancora ricercato, non realmente assente dalla norma. | sessione 27/07/2026 |
| **Ingest documenti — pipeline unificata (IG-1)** | Motore `documentIngestPipeline.service.js`: testo (`pdf-parse` + OCR) → regex (`ruleFieldExtractors`) → AI (`importAiExtraction` + `jsonRepair` + retry) → merge con `fieldConfidence`. Tipi iniziali: `wpqr`, `patentino_saldatore`, `wps`. OCR richiede `tesseract.js` + `pdf2pic` (`npm install` VPS). **IG-2** collegherà upload batch; **IG-4/5** feedback operatore. Piano: `docs/agent-tasks/PLAN_INGEST_LEARNING_SLICES.md`. | slice IG-1 · 28/06/2026 |
| **Ingest IG-3 — revisione pre-commit** | Upload batch WPQR/patentini → `ingest_staging` (mig. **114**) + `IngestReviewDialog` con anteprima PDF affiancata (`IngestSourcePreview`, PR **#207**). **Ingrandisci affiancato** (PR **#209**): schermo intero PDF + campi insieme; ESC/Riduci torna compatto. API confirm/reject. **Produzione**: eseguire mig. **114+115** su `SGQ_ISO9001` (errore `Invalid object name 'ingest_staging'` se mancanti). Script: `run-migration-114-vps.js`, `run-migration-115-vps.js`. | slice IG-3 · 28/06/2026 |
| **Ingest IG-4/5/6 — feedback + few-shot + WPS** | Tabella `import_extraction_feedback` (mig. **115**); hook su confirm/reject; few-shot in `extractStructuredByDocType`; batch WPS con staging. Deploy TEST automatico senza conferma. Smoke: `backend/scripts/smoke-ingest-e2e-test.js` + UI batch su Deploy Preview (test-api). | slice IG-4/5/6 · 28/06/2026 |
| **Nuovo docType — checklist di registrazione completa (RC-8, 17/07/2026)** | `qualifica_14732` esisteva come stub da mesi ma **mai realmente collegato**: `SUPPORTED_DOC_TYPES` in `documentIngestPipeline.service.js` non lo includeva (pipeline unificata regole+AI+confidenza saltata), e `importAiExtraction.service.js` aveva un refuso storico `qualifica_operatore` (id inesistente) al posto di `qualifica_14732` nel set che attiva le sezioni prompt processo/posizioni — bug silenzioso, nessun errore visibile, solo AI meno accurata. **Pattern ricorrente** (già visto col caso Sideius, riga sopra): quando si aggiunge/arricchisce un tipo documento, verificare **tutti** i punti di aggancio, non solo lo schema UI: (1) `documentTypeSchemas.js` FE+BE, (2) `SUPPORTED_DOC_TYPES` pipeline ingest, (3) set doc-type in `importAiExtraction.service.js` (materiale/processo/posizioni), (4) `ruleFieldExtractors.js` (extractor euristico dedicato), (5) `deploy-manifest.json` se nuovi file. Fonte normativa: PDF **scansionato** (zero testo nativo) convertito con OCR locale Tesseract 5.4 — qualità ottima (28/28 pagine leggibili), confermando che l'OCR locale è affidabile anche su scan puri, non solo su font corrotti. | `docs/reference/ISO-14732-operatori-saldatura.md` · PLAN_INGEST_REFERENCE_CATALOGS.md § RC-8 |
| **cert_ndt + OCR nome grande (02/08/2026)** | Simulazione VPS su certificato TEC-Eurolab UT Level II: (1) `cert_ndt` era in menu upload ma **assente** da `SUPPORTED_DOC_TYPES` → `UNSUPPORTED_DOC_TYPE` (stesso anti-pattern RC-8); (2) OCR default (PSM≈6) **saltava il nominativo grande centrato** (`LUIGI LA FORGIA`) pur presente nell'immagine → AI assegnava erroneamente il Certification Manager. Fix: whitelist `cert_ndt`, `OCR_PSM=3` in `ocrExtractor`, regole dedicate + anti-falso `IFICATION` da "CERTIFICATION BODY". | PR fix-cert-ndt-pipeline |
| **ndt_sector allineato ISO 9712 Annex A (02/08/2026)** | Menu settori era errato rispetto a UNI EN ISO 9712:2012 A.2/A.3 (es. `s`=getti invece di pre/in-service; `p`=laminati invece di compositi). Certificati TEC-Eurolab MT/PT/RT: industriale = *prova pre-servizio e in servizio* → codice `s`; UT con *fabbricazione metalli* → `m`. Opzioni FE/BE + prompt AI + form modifica aggiornati. | PR #344 |
| **Idoneità visiva unica + gap NDT (03/08/2026)** | Acuità e Ishihara = **un** certificato oculistico nel form; alias legacy filtrati. API `GET /qualifications/vision-fitness-gaps` + banner tab NDT/Salute mansione. **Deploy VPS 04/08/2026** OK (PID cambiato, health 200). **Smoke prod:** org 1004 (ERAM) → gap `missing` per LUIGI LA FORGIA (unica NDT attiva in DB: UT Lv2, nessun certificato oculistico). Nota: utente smoke `admin@sgq.local` è org 1001 (senza NDT) → summary a zero; verificare con login tenant che ha le NDT. Manifest: includere sempre `visionFitness.service.js` (#348). | PR #347 + #348 |
| **Ingest — revisione adattiva per confidenza (minimo intervento umano)** | Gap reale trovato in `IngestReviewDialog.jsx`: fino a luglio 2026 **ogni** campo (anche `fieldConfidence=high`) era renderizzato come select/input editabile identico — l'operatore doveva sempre cliccare/confermare a colpo d'occhio anche i campi già certi, contraddicendo l'obiettivo "minimo intervento" di ADR-017. Fix: campo con confidenza **alta + valore non vuoto** → mostrato **readonly** (testo + "✓" + label opzione leggibile, non il codice grezzo) con pulsante **"Modifica"** opzionale (reversibile con "Annulla modifica"); campo **media/bassa/assente** → sempre editabile e evidenziato (bordo ambra/rosso). Logica in `isFieldConfirmedByAi()` + `formatReadonlyDisplay()`, stesso componente riusato da patentini/WPQR/WPS/norme (nessuna duplicazione). **Non toccata** la pipeline di feedback (`import_extraction_feedback`, IG-4/5): la correzione dell'operatore passa sempre per lo stesso `onConfirm`. | PR ingest-review-confidence-adaptive · 17/07/2026 |
| **`qualifica_14732` — integrazione completa (22/07/2026)** | Dopo RC-8 (riga sopra) il docType restava "collegato all'ingest ma isolato dal resto": nessuna conferma semestrale, nessun alert, nessun campo dedicato in `QualificationForm`. **Fix**: generalizzato `isWelder9606Type` → `requiresSemiannualConfirmation` (unica funzione in `weldingCoordinatorAuth.service.js`, riusata da `qualifications.controller`, `qualificationAlert.service`, `alert.controller`, `SemiannualConfirmationSection.jsx`) così **9606 e 14732 condividono lo stesso gate**, invece di duplicare la logica per ogni norma che richiede conferma periodica. Mig. **122**: solo 3 colonne nuove (`welding_type`, `single_multi_run`, `qualification_method`) — tutto il resto (spessori, date, `equipment_type`) era già generico e riusato da 9606. **Regola per il prossimo docType con requisiti periodici**: prima chiedersi "quale logica esistente va generalizzata?" invece di duplicare un `is<Norma>Type` per ogni standard. | PR #277 · branch `cursor/integrazione-qualifica-14732-3bea` |
| **Catalogo simboli ISO 2553 per l'estrazione disegni (22/07/2026)** | Committente ha fornito un libro (Woodhead Publishing, non la norma stessa) con simboli di saldatura ISO 2553/AWS A2.4. **Copyright**: l'estrazione PDF→Markdown intermedia (71 pagine, testo integrale del libro) è stata usata solo per analisi e **non committata** — cancellata dopo la sintesi, come già da regola per ISO 14732 ("qui solo tabelle/regole sintetiche, mai testo normativo/bibliografico copiato"). Creato `backend/src/data/weldingSymbols2553.js` (stesso pattern `buildXPromptSection()` di `weldingProcesses4063.js`/`weldingPositions6947.js`) e collegato al prompt vision di `drawingExtraction.service.js` (`req_type: weld_symbol`) così l'AI etichetta i simboli sui disegni con terminologia standard invece di descrivere solo la forma grafica. Doc gemella: `docs/reference/ISO-2553-simboli-saldatura.md`. | sessione 22/07/2026 |
| **Rielaborazione/backfill su nuovo campo schema (28/07/2026) — pattern riusabile** | Quando si aggiunge un campo estratto dall'AI (es. `transfer_mode`), le qualifiche ingestite **prima** restano con quel campo NULL. Il PDF originale **non viene mai cancellato** dopo il commit (`certificate_file_url` punta sempre a un file persistente in `/uploads` sul VPS — verificato: 15/15 file presenti per il backfill `transfer_mode`), quindi si può ri-estrarre **senza richiedere un nuovo upload**. Pattern generico creato: (1) whitelist `REPROCESSABLE_FIELDS` in `qualificationIngest.service.js` + funzione `applyFieldReprocessUpdate` (UPDATE mirato al solo campo, mai un commit completo); (2) mig. **137**: `ingest_staging` esteso con `target_qualification_id` + `field_scope` per distinguere una proposta di "aggiornamento su record esistente" da una normale ingestione (nuovo record); (3) script generico **`backend/scripts/reprocess-qualifications.js --field=<nome> [--dry-run] [--limit=N] [--org-id=N]`** — selezione candidati (campo NULL + processo pertinente + file su disco + nessuna proposta già in coda) → riusa `runDocumentIngest`/`mapPipelineFieldsToReview` (stessa pipeline AI dell'ingest normale, nessun prompt duplicato) → crea proposta in `ingest_staging`, **mai scrive direttamente** sul record di produzione; (4) UI: `ReprocessQueueBanner.jsx` in `QualificationsPage` mostra le proposte pendenti (stessa coda/dialog di revisione ingest, filtro `reprocessOnly=true` su `GET /ingest-staging`). **Per un nuovo campo rielaborabile in futuro**: aggiungere una riga a `REPROCESSABLE_FIELDS` (backend) e a `FIELD_CONFIGS` (script) — nessuno script dedicato per campo. **Deliberatamente NON creato**: un job schedulato automatico che richiama l'AI periodicamente su tutto il DB — costo AI ricorrente non controllato è una decisione di prodotto/costi, non tecnica; lo script resta a lancio manuale on-demand finché il committente non richiede esplicitamente uno scheduler (es. mensile). Deploy: script aggiunto al gruppo `scripts` in `deploy-manifest.json` (deve vivere in `/var/www/sgq-backend/scripts/` per risolvere correttamente i `require` relativi ai servizi). | mig. 137 · `reprocess-qualifications.js` · 28/07/2026 |
| **Registro rielaborazioni + pannello superadmin (28/07/2026)** | Generalizzazione della riga sopra: il committente ha chiesto **niente scheduler automatico** (costo AI non supervisionato) ma un **alert + pulsante manuale** nella dashboard superadmin. Pattern creato: (1) **`backend/src/data/reprocessableFields.js`** — registro centralizzato di ogni campo rielaborabile (`key`, `label`, `module`, `table`, `qualTypeLike`, `processWhitelist`); (2) **`backend/src/services/qualificationReprocess.service.js`** — UNICA implementazione di selezione candidati/conteggio/esecuzione, estratta da `reprocess-qualifications.js` e riusata sia dal CLI sia dall'endpoint HTTP (nessuna duplicazione: lo script ora è solo un thin wrapper CLI che chiama lo stesso servizio); (3) API **`GET /admin/reprocess-tasks`** (conteggio candidati per voce, cross-tenant di default — pattern `billing.controller.js`, `organization_id` opzionale per singolo tenant) e **`POST /admin/reprocess-tasks/:key/run`** (lancia la rielaborazione, risposta **sincrona** con riepilogo `{candidatesFound, proposalsCreated, errors, hasMore, ...}` — accettabile per i volumi attuali, decine-centinaia di record; `DEFAULT_RUN_LIMIT=100` per record per singolo lancio evita richieste HTTP troppo lunghe, `hasMore:true` segnala di rilanciare); entrambe `superadminOnly` (`admin.routes.js`); (4) UI: sezione **"Rielaborazioni disponibili"** in `BillingDashboardPage.jsx` (dashboard superadmin già esistente, cross-tenant) — banner di alert quando `total_candidates > 0`, tabella con conteggio per campo e pulsante "Lancia rielaborazione" (disabilitato a 0 candidati), esito mostrato inline dopo il lancio. **Alert = la sezione stessa nella dashboard superadmin visitata**, non un nuovo canale email/notifiche: non esisteva un meccanismo di notifica superadmin cross-tenant da riusare (il sistema `alert.controller.js`/badge sidebar è org-scoped per singolo tenant), quindi non si è creato un secondo sistema di notifica parallelo. **Per aggiungere un nuovo campo rielaborabile in futuro**: aggiungere UNA riga a `REPROCESSABLE_FIELD_REGISTRY` (e alla whitelist `REPROCESSABLE_FIELDS` di `qualificationIngest.service.js`, se il campo non c'è già) — nessun nuovo script, nessuna nuova route, il pannello e l'API sono già generici. Nessuna nuova migrazione: l'audit trail delle rielaborazioni lanciate è già tracciato dai record `ingest_staging` creati (created_at, field_scope, target_qualification_id) — non serve una tabella di log dedicata ai volumi attuali. **Deploy verificato** (30/07/2026): commit `b267dc8c` su `main`, backend VPS riavviato (systemd, MainPID cambiato) + health OK + smoke autenticato su `GET /admin/reprocess-tasks` con utente superadmin reale — 44 candidati totali confermati in produzione (15 transfer_mode, 11 shielding_gas, 9 joint_type, 9 weld_details, tutti org 1003). | `reprocessableFields.js` · `qualificationReprocess.service.js` · `reprocessTasks.controller.js` · commit `b267dc8c` · 28-30/07/2026 |
| **Alert + scadenzario qualifiche** | Toggle `alert_qualif_expiry` cablato in `alertScheduler` (+10 min dopo doc). Servizio `qualificationAlert.service.js`: data guida = min(expiry, next_confirmation per 9606); email al coordinatore per azienda (rubrica `notification_contacts` company → `company_personnel` job coordinatore → `user_company_access` ruolo coordinatore → fallback org). Dedup `qual_notification_log` (mig. 093). Scadenzario `/deadlines`: righe virtuali `item_type=qualification` + tarature `equipment` (merge in `listDeadlineItems`). Badge `/alerts` include qualifiche approvate. | sessione 14/06/2026 |
| **Scadenzario — ordine dichiarazione `equipRows`** | Estendendo ADR-013 con tarature strumenti, **`let equipRows` va dichiarato prima del `const merged`** (stesso pattern di `qualRows`). Altrimenti `GET /deadline-items` risponde 500 con `Cannot access 'equipRows' before initialization` e la pagina `/deadlines` mostra banner rosso. Fix: [PR #179](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/179) — deploy VPS `deadlines.controller.js` (04/07/2026). | incidente 04/07/2026 |
| **Registro conferme semestrali 9606** | Mig. **094**: tabella `qualification_confirmations` + flag `company_personnel.is_primary_welding_coordinator`. API: `POST /qualifications/:id/confirm-semiannual`, `GET …/confirmations`, `GET /qualifications/confirmations/export` (xlsx). Solo qualifiche **approvate** tipo 9606; auth = email utente = coordinatore primario azienda (fallback admin/superadmin). UI: sezione collassabile in `QualificationForm`; deep link scadenzario `?highlight=&section=conferma`. **No timbro PDF** sulla conferma. | sessione 14/06/2026 |
| **API 500 da `studioScopeClause` errato sulle `companies`** | Nelle clausole di scope su `companies` usare l'alias colonna corretto (`c.organization_id`, **non** `co.organization_id`) e la logica `isOrgWideAdmin` / `auditor_org_id` (mai `isSuperadmin` indiscriminato). | [Sessione 07/06/2026 — fix responsible-options](archive/sessions/GUIDA_DIARIO_2026.md#sessione-07062026---nc-notifiche--form-annidati-chiusura-sessione) |
| **Menu audit vs RBAC** | Lista e dettaglio audit filtrano con `studioScopeClause` (`auditListRbac.service`); `organization_id` sempre da `req.user`. | [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) |
| **NC non-audit invisibili agli endpoint figli: `INNER JOIN audits` (28/07/2026)** — le NC del Piano Azioni multi-fonte (reclamo, rischi, riesame, operativa) hanno `audit_id NULL` e il tenant su `nc.organization_id`. `getNonConformityById` e `updateNonConformity` usavano già `LEFT JOIN` + doppia condizione, ma **azioni** (`listNcActions`, `createNcAction`, `updateNcAction`, `deleteNcAction`), `approveNcClosure`, la lista azioni in scadenza e l'**upload allegati** verificavano la proprietà con `INNER JOIN audits`: 404 «Non conformità non trovata» all'admin proprietario. Trattamento non salvabile e allegati non caricabili su tutte le NC non-audit. | **Mai verificare la proprietà di una NC con `INNER JOIN audits`.** Usare l'helper condiviso **`ncOwnershipScope`** (`auditListRbac.service.js`): `LEFT JOIN audits` + `(audit_id IS NOT NULL AND a.organization_id = @org) OR (audit_id IS NULL AND nc.organization_id = @org)`, con lo scope studio applicato **solo** quando l'audit esiste (`audit_id IS NULL OR (clause)`) — altrimenti il `LEFT JOIN` a NULL riesclude le NC non-audit. Stessa attenzione in `attachmentScope`: il `COALESCE` dell'organizzazione deve includere `nc.organization_id`. Isolamento tenant e fail-closed per auditor restano verificati a query diretta. | PR #315 |
| **Colonna duplicata da `nc.*` + alias omonimo → il driver mssql ritorna un array (28/07/2026)** — dopo la mig. 134 (`non_conformities.company_id`), le query `SELECT nc.*, …, COALESCE(a.company_id, nc.company_id) AS company_id` producevano **due** colonne `company_id`: `recordset` conteneva `[null, null]`, che serializzato in querystring diventa `company_id=,` → 400 su `/non-conformities/responsible-options` a ogni apertura del drawer NC (menu responsabili silenziosamente in fallback rubrica, senza scope azienda). | **Quando si aggiunge una colonna a una tabella già letta con `tabella.*`, controllare che nessun alias nella stessa `SELECT` usi quel nome.** Dare all'espressione un nome distinto (es. `effective_company_id`) e normalizzarlo nel controller prima della risposta, così il contratto API resta invariato. | PR #315 |
| **`deploy-manifest.json` — anche i file `src/config/` vanno elencati (28/07/2026)** — un fix in `src/config/multer.js` (MIME allegati) restava nel repo: il manifest non lo includeva, il VPS continuava a rispondere 415 sui `.tif` e lo smoke post-deploy sembrava smentire il fix. | La regola «ogni nuovo file `.js` in `backend/src/` va nel manifest» vale anche per i **file esistenti mai deployati**: prima di dichiarare che un fix backend non funziona, verificare con `rg <path> backend/scripts/deploy-manifest.json` che il file sia effettivamente nel manifest. `src/config/` ha ora un gruppo dedicato, prima dei controller che lo richiedono. | PR #315 |
| **`companies` NON ha `organization_id`** | La tabella `companies` è scopata via `auditor_org_id`; l'org si ottiene con join `auditor_orgs ao ON ao.id = c.auditor_org_id` (`companyBelongsToOrg`). Nei JOIN basta `LEFT JOIN companies c ON c.id = x.company_id`, mai `c.organization_id`. Regressione 13/06/2026: il fix `9fda958` aveva aggiunto `... AND c.organization_id = j.organization_id` in `importJobs.listJobs/getJob` → errore SQL `Invalid column name 'organization_id'` (lista + dettaglio Import PDF bloccati). Fix `98bc36f` rimuove la condizione errata + test mirati su `listJobs/getJob`. | commit `98bc36f` |
| **Ciclo di vita account utente — UAL-1…4 completato (23/07/2026)** — 4 slice sequenziali (basso→alto rischio) per invito email, audit trail, accessi aziende clienti, reset password self-service, senza mai toccare login esistente. | **Pattern token riusabile**: tabella generica `user_action_tokens` (mig. 131) con `token_type` (`invite`/`reset`) + TTL diversi, hash **SHA-256** del token (mai il valore in chiaro), uso singolo, invalidazione automatica dei token precedenti dello stesso tipo. **Isolamento auth**: ogni nuovo flusso pubblico non autenticato vive in controller/route **dedicati** (`invite.controller.js`, `passwordReset.controller.js`), mai dentro `auth.controller.js`/`auth.routes.js` — montati sotto `/auth` in `server.js` per eredità automatica di `authLimiter` senza duplicare rate-limit. **Anti user-enumeration**: `forgot-password` deve rispondere con lo **stesso messaggio generico** per email esistente/inesistente/disattivata/pending — verificare con un test che confronta le risposte byte-per-byte, non solo "non lancia errore". **Audit generico**: `user_audit_log` (mig. 130) con `action_type` in un CHECK constraint esteso ad ogni slice (drop+recreate idempotente, SQL Server non permette ALTER di un CHECK esistente). **Gap processo**: il deputy non sempre crea lo script `run-migration-NNN-local.js` per ogni migrazione — il lead deve verificarne la presenza prima di eseguire, altrimenti va scritto al momento della revisione (pattern in `backend/scripts/run-migration-13{0,1}-local.js`). | [`PLAN_USER_ACCOUNT_LIFECYCLE.md`](agent-tasks/PLAN_USER_ACCOUNT_LIFECYCLE.md) · PR #296, #297, #298, #299 |

### Notifiche NC e alert

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Notifiche NC — rubrica + escalation** | Ogni azienda ha una **rubrica referenti** (`notification_contacts`, mig. 073-074) con ruolo email. L'alert scadenza NC usa **priorità: personale azienda (`responsible_contact_id`) > rubrica (`recipients_email`)**. Lo scheduler (`docAlertEscalation.service`) gestisce l'escalation **allineata alla config**. I responsabili NC si scelgono dal **personale azienda** (`responsible-options`). | [Sessione 07/06/2026 — NC notifiche](archive/sessions/GUIDA_DIARIO_2026.md#sessione-07062026---nc-notifiche--form-annidati-chiusura-sessione) · [ADR-012](adr/ADR-012-company-personnel-anagrafica.md) |
| **Verifica efficacia = giudizio complessivo, non per singola azione** | La verifica di efficacia (ISO 10.2.1 e) valuta l'insieme delle azioni correttive di una NC, non ha senso per singola azione. Workflow azione semplificato a `Aperta → In corso → Completata` (rimosso lo step "Verifica" in `NcActionsList.jsx`). **Aggiornamento 26/07/2026**: il completamento di tutte le azioni **non** cambia più lo stato NC (niente auto-`resolved`); la chiusura è solo esplicita con gate. | PR [#244](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/244) · 11/07/2026 |
| **Correzione obbligatoria (ISO 10.2.1 a) ≠ azione correttiva (10.2.1 b-d)** | La norma richiede **sempre** una reazione immediata alla NC (punto a), mentre l'azione correttiva è condizionata a una **valutazione** (punto b). Campo `corrective_action_needed` (yes/no) + note di valutazione: se **No**, sezioni cause/azioni nascoste; se **Sì**, obbligatorie per chiudere. | mig. 121 · semplificazione flusso 26/07/2026 |
| **NC — solo Aperta / Chiusa (niente approvazione RQ separata)** | Stati UI: **Aperta** e **Chiusa**. Pulsante **Chiudi** solo se: (A) AC non necessaria + trattamento completato + motivazione + note verifica + **responsabile verifica selezionato dal menu**; oppure (B) AC necessaria + causa + azione correttiva completata + stessa verifica. Il responsabile verifica **è** la funzione RQ: nessuna auto-selezione, nessun click «Approva chiusura». Riapertura solo admin → Aperta. | branch `cursor/nc-workflow-aperta-chiusa-2dff` · 26/07/2026 |
| **Report Word NC — correzione/allegati assenti: due bug distinti, non uno** | (1) **Conflitto placeholder docxtemplater**: il loop azioni usava `{description}`, stesso nome del campo NC a livello root (sezione 2) → docxtemplater risolveva sempre il valore root, correzione vuota. Fix: rinominare in `{actionDescription}` sia nel template (`generateNcTemplate.js`) sia nel mapper (`buildNcTemplateData`). (2) **Bug critico in `replaceNcAttachmentsMarker`**: la regex per inserire le immagini allegate matchava dal **primo `<w:p>` del documento** fino al paragrafo del marker, cancellando tutto il contenuto precedente (correzione, azioni, descrizione) ogni volta che l'NC aveva almeno un allegato immagine. Sintomo ingannevole: senza allegati la correzione appariva (bug 1 nascondeva/mascherava il bug 2). Fix: sostituire **solo** il paragrafo che contiene il marker (`lastIndexOf('<w:p', idx)` → `indexOf('</w:p>', idx)`), mai una regex "dal primo tag". **Lezione generale**: quando un fix su un placeholder non risolve il sintomo, verificare con un **test di integrazione reale** (template su disco + docxtemplater vero, non mock) l'XML renderizzato passo-passo (dopo `render()`, dopo sostituzione marker, dopo `generate()`) — i mock unitari avevano nascosto il bug 2 per intere iterazioni. | PR [#247](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/247) · 13/07/2026 |
| **Drawer NC riordinato sull'ordine letterale ISO 10.2.1 (a→b→c→d)** | Feedback di un revisore esterno (Marco): il flusso «Scheda → Stato workflow → Cause → Correzione» non seguiva l'ordine della norma (a: reazione/correzione → b: analisi cause → c: azione correttiva → d: verifica). Riordinato in **Scheda → Difetto/Problema → Trattamento (correzione immediata, §10.2.1a) → Cause e valutazione (§10.2.1b) → Stato workflow → Azioni correttive/preventive (§10.2.1c) → Evidenze → Verifica efficacia (§10.2.1d) → Chiusura**. Il blocco «Correzione» (immediata) è stato estratto da `NcActionsList.jsx` in un componente dedicato `NcCorrectionSection.jsx`, condividendo lo stato con `NcActionsList` tramite l'hook `useNcActions` (fetch unica, nessun disallineamento). **Lezione**: quando un revisore esterno propone un riordino UI, verificare prima se corrisponde già a un punto della norma applicabile — a volte la norma stessa dà l'ordine "giusto" invece di scegliere arbitrariamente tra due proposte. | PR [#283](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/283) merge `main` 22/07/2026 · 802 test verdi |
| **Bug critico trasversale: `daysUntilDue` non riconosceva le date come oggetti `Date` nativi mssql — nessun alert email è mai partito (10/08/2026)** — investigando perché lo Scadenzari di Mason mostrasse 0 qualifiche (segnalazione committente, nonostante 3+ qualifiche realmente scadute per conferma semestrale ISO 9606-1), è emerso che `daysUntilDue` (`alertSchedulerHelpers.js`, condivisa da documenti/NC/qualifiche) faceva `String(dueDate)` e testava una regex ISO — su un oggetto `Date` nativo (formato reale restituito da mssql per le colonne `DATE`: `expiry_date`, `next_confirmation_due`, `due_date`) produce `"Thu Aug 31 2028 00:00:00 GMT+0000 (...)"`, che non combacia mai → tornava sempre `null`. **Verificato empiricamente in produzione**: `qual_notification_log` e `doc_notification_log` a **0 righe da sempre**, per tutte le organizzazioni — nessuna email di scadenza documento o qualifica è mai partita da quando la funzionalità esiste. I test esistenti passavano solo stringhe ISO nei fixture, mai un `Date` nativo: il bug era invisibile alla suite. | **Fix**: `daysUntilDue` riconosce sia `Date` nativi (estratti in UTC, come normalizza mssql) sia stringhe ISO. Corretto anche l'ordinamento di `mapQualificationDeadlineRows` (confrontava `Date.toString()` come stringa — inizia dal nome del giorno della settimana, non dalla data — invece della data reale). **Prima di deployare un fix che sblocca un sistema di invio email rimasto silenzioso per molto tempo**: verificare sempre l'ampiezza del possibile "effetto raffica" (qui: solo 1 documento scaduto su un'org interna, rischio reale trascurabile) prima di procedere. **Dopo il fix**: riattivato `notifications_config.enabled=1` per MASON_Srl (org 1003) su richiesta committente — prima era `false` a livello di interruttore generale, indipendentemente dal bug. **Gap noto non ancora risolto (da riprendere in una sessione dedicata al modulo Notifiche/Alert)**: il destinatario delle email qualifiche è deciso da un algoritmo a cascata (`resolveWeldingCoordinatorRecipients`: `notification_contacts` company → `company_personnel` job coordinatore → `user_company_access` ruolo coordinatore → fallback org) — il flag anagrafica «Coordinatore saldatura responsabile (primario)» (`is_primary_welding_coordinator`) **non** entra in questa catena, serve solo ad autorizzare chi registra la conferma semestrale. Non esiste oggi una scelta esplicita in UI "manda le allerte qualifiche a questa persona". | PR [#369](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/369) · test `alertSchedulerHelpers.test.js`, `qualificationAlert.service.test.js` · vedi anche PR [#366](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/366)/[#368](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/368) (filtro dashboard Qualifiche + card "Non attiva", stessa sessione) |

### Ambiente di lavoro e tooling

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Worktree su disco locale `C:`** | Il repo vive su **Google Drive** (`G:\…`) dietro junction `C:\ProgettoISO`: l'I/O è lento e la **suite Vitest completa si impalla**. Per task corposi/paralleli usare un **worktree su `C:`** da `origin/main`; come L1 affidarsi a **build Vite + Vitest mirato** (o CI Netlify), non alla suite intera. | [`sgq-workflow-method.mdc` § Worktree](../.cursor/rules/sgq-workflow-method.mdc) · [Workspace consigliato](archive/sessions/GUIDA_DIARIO_2026.md#workspace-consigliato--ponte-cprogettoiso-cursor--terminale) |
| **Cursor desktop apre il workspace su Google Drive, ma il checkout reale può essere altrove (25/07/2026)** — sessione DEPUTYTASK1 avviata sul percorso di default `G:\Il mio Drive\Sistema Gestione ISO 9001`: `git commit`/`git show` risultavano corretti, ma tool **Read/Grep** rileggevano contenuto "vecchio" (funzioni mancanti) subito dopo la scrittura — causato dalla sincronizzazione asincrona del client Google Drive che serve snapshot diversi a processi diversi. Il committente ha segnalato che il vero checkout attivo su quel PC è `C:\Dev\ProgettoISO` (disco locale, non junction). | **Non fidarsi del workspace path di default di Cursor.** A inizio sessione, se emergono incongruenze tra `git diff`/`git show` (autoritativi) e le letture Read/Grep di file appena scritti, **sospettare subito Google Drive streaming** e chiedere/verificare se esiste un checkout locale reale (`Test-Path`, poi `git remote -v` per confermare stesso `origin`). Da lì in poi: fetch del branch pushato (`git fetch origin <branch>`), `git checkout`, e proseguire **solo** su quel percorso (test/build molto più rapidi). Vedi tabella percorsi in [`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md#percorsi-di-lavoro-locale-windows--evitare-confusione-tra-drive). | Sessione 25/07/2026 — DEPUTYTASK1 WPQR coverage · branch `cursor/deputytask1-wpqr-coverage-fields` |
| **`gh` CLI + MCP GitHub** | Su Windows: `gh auth login` con account **qsstudio241** (verificare con `gh auth status`). Preflight PR: `gh pr list`, `gh pr merge`. Fallback se `gh` non autenticato: **MCP GitHub** — leggere schema tool prima di chiamarlo. | [`sgq-workflow-method.mdc` § Triage PR](../.cursor/rules/sgq-workflow-method.mdc) · sessione 14/06/2026 |
| **Migrazioni DB — sequenza condivisa** | Numerazione **unica** (stato ~082). Le PR vecchie con numeri bassi vanno **rinumerate in coda** e rese **idempotenti** (check esistenza prima di `ALTER`/`CREATE`). FK SQL Server: statement separati. | [how-to/database-migrations.md](how-to/database-migrations.md) |
| **Encoding UTF-8 senza BOM** | Lo strumento di salvataggio può produrre **ANSI/BOM** o interpretare `\n`/`\t` come newline/tab. Dopo ogni scrittura: verificare **UTF-8 senza BOM**, accenti italiani corretti, **nessun `U+FFFD`**. Script: `backend/scripts/check-utf8-encoding.js` (**gate CI** su ogni PR `app/**`). Riparazione batch: `repair-utf8-encoding.js --write` + `fix-encoding-corruption.js --write`. | [Playbook caratteri non riconoscibili](archive/sessions/GUIDA_DIARIO_2026.md#playbook-riutilizzabile--caratteri-non-riconoscibili-ufffd--tofu-in-ui) · [`sgq-encoding-quality.mdc`](../.cursor/rules/sgq-encoding-quality.mdc) |
| **`check-utf8-encoding.js` — loop infinito senza flag `g`** | Le regex dei pattern venivano scandite con `regex.exec(text)` ripetuto in un `while`, ma senza il flag `g` un match trovato viene **restituito all'infinito** (lastIndex non avanza): CI `test-and-build` restava bloccata "in_progress" per ore su qualunque branch con un match già presente nel repo (es. un vero refuso pre-esistente in `welding.controller.js`, "gi? assegnato" invece di "già assegnato"). Sintomo: step "Encoding UTF-8 sorgenti" mai completato, nessun errore visibile. **Fix**: aggiungere `g` a tutte le regex del file; verificare sempre con `node backend/scripts/check-utf8-encoding.js --human` in **locale con timeout** prima di fidarsi che "non dia errore" — uno script che non termina in pochi secondi su ~600 file è già un sintomo. | PR [#244](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/244) · 11/07/2026 |
| **`contractReview.controller.js` NON è nel deploy-manifest** | `backend/scripts/deploy-manifest.json` non include `contractReview.controller.js`/`.routes.js`: quando un commit li modifica vanno copiati a mano con `pscp` **prima** del restart, poi lanciare `deploy-controllers-to-vps.ps1` per il resto. Deploy fix segregazione `company_id` Import PDF 13/06/2026 (commit `9fda958`): push `main`, copia manuale `contractReview.controller.js`, deploy manifest, MainPID 646321→652768, health `healthy`, `/import-jobs` → 401 coerente. | Sessione 13/06/2026 — commit `9fda958` |
| **Deploy sicuro con working tree "sporco"** | `deploy-controllers-to-vps.ps1` copia il **working tree dal disco** (manifest di ~118 file), **non** lo stato committato: se il tree contiene WIP non pertinente al rilascio, il WIP finisce in produzione (incidente 23/06/2026: una versione WIP di `knowledgeIndexer.service.js` importava un file nuovo non tracciato → crash `MODULE_NOT_FOUND`, API offline 503). **Regola**: (1) prima di ogni deploy backend verificare `git status --short`; se il tree NON è pulito e il WIP non riguarda il rilascio, **non** usare lo script completo; (2) fare un **deploy mirato dei soli file committati** (`pscp` del singolo file, oppure `git show HEAD:percorso` per forzare la versione di `HEAD`) + restart con verifica `MainPID`; (3) se il rilascio introduce un **nuovo pacchetto npm** (es. `mammoth`), eseguire `npm install`/`npm ci` sul VPS, altrimenti `MODULE_NOT_FOUND`. Funzioni riutilizzabili in `backend/scripts/lib/vps-ssh.ps1` (`Initialize-SgqVpsSsh`, `Test-SgqVpsSession`, `Copy-SgqVpsFile`, `Invoke-SgqVps`, `Get-SgqVpsHealth`); password sudo a `plink` **solo via stdin**, mai nella stringa del comando. | [Sessione 23/06/2026 — incident deploy WIP](archive/sessions/GUIDA_DIARIO_2026.md#sessione-23062026-incident--deploy-sicuro-con-working-tree-sporco) |
| **Token Netlify CLI (Windows)** | Credenziali locali: `backend/config/.netlify.local.ps1` (copia da `.netlify.local.ps1.example`, gitignored). Preflight: `.\backend\scripts\netlify-preflight.ps1` → deve stampare `NETLIFY_ACCESS_OK`. **Mai** token Netlify in chat o su Git. | [NETLIFY_DEPLOYMENT.md](how-to/NETLIFY_DEPLOYMENT.md) |
| **Cambio hostname VPS — locali + secret (31/07/2026)** | Dopo rename DNS/TLS: aggiornare i file gitignored tipici (`database.json`, `backend/.env`, `.ssh-deploy.local.ps1`, `app/.env.production`), Netlify `VITE_API_URL` (tutti gli ambienti), GitHub `SMOKE_ENDPOINT`, URL pubblici in VPS `.env`; al primo SSH PuTTY accettare la nuova host key. **Mai** committare secret. Cursor Cloud Secrets di solito invariati. | [Hostname VPS](#hostname-vps-31072026) · PR #337 |
| **Deploy massivo (168 file) — pscp può troncare un singolo file** | Merge di 2 PR parallele (RDP + AI 3834-3, 23/07/2026) → `deploy-controllers-to-vps.ps1` ha copiato 168 file; `organization.controller.js` (non toccato dalle PR, invariato da settimane) è arrivato sul VPS **troncato a 380/395 righe** → `SyntaxError: Missing catch or finally` al restart → backend **503** per ~3 minuti. Causa probabile: glitch di rete/buffer su `pscp` durante un trasferimento lungo, non un bug di codice (sintassi locale OK, hash locale ≠ remoto). **Fix**: diff riga-count/hash locale vs remoto (`wc -l` + `sha256sum` via SSH) per isolare il file, poi `Copy-SgqVpsFile` mirato del solo file + restart con verifica `MainPID`. **Azione preventiva aggiunta**: dopo ogni deploy con **>50 file**, oltre all'health check generico, lanciare un check di sintassi su **tutti** i `.js` remoti: `find src -name '*.js' -exec node --check {} \;` (pochi secondi, individua troncamenti che l'health check da solo non rileva se il file rotto non è nel path critico di boot... qui invece bloccava l'intero `require` chain). | Sessione 23/07/2026 — merge [PR #290](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/290) + [PR #291](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/291) |
| **PDF → Markdown → JSON (tool generico)** | Per digitalizzare una nuova norma/Quaderno/checklist/capitolato: usare **sempre** `backend/scripts/pdf_to_json/` (pdfplumber + fallback pymupdf/pypdf, OCR locale opzionale via tesseract, nessuna chiamata cloud) invece di scrivere parsing ad-hoc. Rileva anche i PDF con font a codifica rotta/offuscata (testo "presente" ma illeggibile, es. placeholder `(cid:NNN)`) e li segnala come pagine a bassa qualità invece di produrre JSON silenziosamente sbagliato. Salva sempre il `.md` intermedio da revisionare prima di fidarsi del `.json`. | [`.cursor/skills/pdf-to-json/`](../.cursor/skills/pdf-to-json/SKILL.md) · [`backend/scripts/pdf_to_json/README.md`](../backend/scripts/pdf_to_json/README.md) |
| **Fonti Markdown: dichiarare, tracciare, poi partire (16/08/2026)** — dopo EN 10025-2 restano norme richiamate senza `.md` (es. EN 10210-1 / 10219-1 per tubi). Non si aspetta il pacchetto completo. | Prima di seed/Rule Engine/gap: 3 righe in chat (coperte / mancanti / si parte su). Inventario in [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md). GAP onesto sul prodotto senza Markdown; **non** inventare soglie; **non** bloccare la slice coperta. | skill `pdf-to-json` · `gap-analysis-normativa` · `sgq-operating-memory.mdc` |
| **ISO 14175:2008 — supporto 3834 (gas)** | Norma di **classificazione gas** (non SGQ): utile per WPS/WPQR/patentini (`shielding_gas` = M21, I1, C1…). MD/JSON in `docs/Normative/Normative NORMA_00012_ UNI EN ISO 14175_2008 Rev. 0.*`; estratto operativo `docs/reference/ISO-14175-gas-protezione.md`; catalogo `shieldingGases14175.js` + prompt ingest. **Non** in `import-norms-from-markdown.js`. Pattern per altre norme complementari 3834: digitalizza → estratto `docs/reference/` → catalogo JS → hook AI (vedi RC in PLAN_INGEST_REFERENCE_CATALOGS). | RC-3 · skill `pdf-to-json` / `gap-analysis-normativa` |
| **ISO 13916:2025 — supporto 3834 (temperature)** | Norma di **misura** Tp/Ti/Tm (preriscaldo, interpass, mantenimento), non SGQ e non catalogo simboli. Utile per WPS/WPQR (`preheat_temp`, `interpass_temp`). MD/JSON `docs/Normative/Normative NORMA_00013_ UNI EN ISO 13916_2025 Rev. 0.*`; estratto `docs/reference/ISO-13916-temperature-saldatura.md`; modulo `weldingTemperatures13916.js` (solo prompt/regole) + hook AI WPS/WPQR. Citata in ISO 3834-5. **Non** in `import-norms`. | RC-9 · skill `pdf-to-json` / `gap-analysis-normativa` |
| **ISO 15609-1/-2:2019 — contenuto WPS (arco/gas)** | Norme di **contenuto** pWPS/WPS (variabili §4), non SGQ. Utile per ingest WPS e allineamento schema campi. MD/JSON `NORMA_00014` (15609-1 arco) + `NORMA_00015` (15609-2 gas); estratto unico `docs/reference/ISO-15609-WPS-contenuto.md`; hook in `documentTypeSchemas` + mapping `wpsIngest` (no catalogo JS: riusa 4063/6947/14175/13916). Citata in ISO 3834-5. **Non** in `import-norms`. Annex A PDF spesso illeggibile → usare clausole §4. | RC-10 · skill `pdf-to-json` / `gap-analysis-normativa` |
| **ISO 14341:2020 — supporto 3834 (fili GMAW)** | Norma di **classificazione** fili-elettrodo/depositi MAG-MIG acciai non legati e a grano fine (non SGQ). Utile per WPS/WPQR campo `filler_material` (es. `G 42 4 M21 3Si1`). MD/JSON `NORMA_00016`; estratto `docs/reference/ISO-14341-consumabili-filo.md`; modulo `fillerWire14341.js` (solo prompt/regole, non catalogo esaustivo) + hook AI WPS/WPQR. Gas nella designazione = ISO 14175. **Non** confondere con FM1–FM6 (RC-4). Tabella 3A/3B chimica: GAP estrazione. **Non** in `import-norms`. | RC-11 · skill `pdf-to-json` / `gap-analysis-normativa` |
| **WPQR — campi copertura pag.1 + parametri prova pag.2 (DEPUTYTASK1, 25/07/2026)** | Estratto WPQR precedente troppo minimale (solo processo/gruppo/spessore/data): mancavano level, joint_type, range dichiarati, posizioni, filler, ente, wps_ref, parametri prova. Estesi schema UI+AI (FE/BE `documentTypeSchemas.js`), estrattori euristici (`ruleFieldExtractors.js`), colonne DB (mig. **133**, idempotente, solo colonne nullable), `wpqrIngest.service.js` e `welding.controller.js` (create+update ora persistono anche i campi tecnici già raccolti dal form manuale, gap pre-esistente). **Bug corretto**: `inferWeldingProcessFromText` (`weldingProcesses4063.js`) controllava gli **alias testuali prima** dei codici numerici espliciti — la parola "elettrodo" (frequente per il diametro del filo/elettrodo d'apporto, anche su WPQR MAG/135) vinceva su un codice "135" esplicito nel testo, restituendo erroneamente "111". Fix: priorità **codice etichettato → codice nudo isolato → alias** (mai il contrario). Analogo per `expiry_date`: non assumere più l'ultima data del PDF come scadenza (i WPQR spesso non ne hanno) — solo se etichettata esplicitamente ("Expiry"/"Scadenza"). | PR branch `cursor/deputytask1-wpqr-coverage-fields` · mig. 133 verificata su VPS produzione |
| **Font PDF "anti-copia" — correggere, non scartare (RC-5/RC-6, luglio 2026)** | Ipotesi iniziale sbagliata: scartare il `.md` di `UNI EN ISO 9606-1:2017` perché il font incorporato genera errori sistematici (`buii`→`butt`, `materia1`→`material`, `docurnent`→`document`, `qualitication`/`qualiiication`/`qualilication`→`qualification` — stessa lettera originale reso in modo diverso a seconda della pagina/subset font, quindi **non** un mapping carattere-per-carattere affidabile). Soluzione corretta: **dizionario di parole intere** osservate corrotte (nessuna è una parola inglese valida → falsi positivi marginali) in `backend/src/utils/textEncodingRepair.js` (`repairFontSubstitutionArtifacts` + `detectLikelyFontSubstitutionCorruption`, soglia 3 occorrenze). Agganciato come step opzionale in `documentIngestPipeline.service.js::extractDocumentText`: si attiva solo se il testo mostra ≥3 pattern noti, mai su testo pulito. | [`PLAN_INGEST_REFERENCE_CATALOGS.md`](agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md) RC-5/RC-6 |
| **GAP Tabelle 6/9/10 ISO 9606-1 risolto — la causa NON era "griglia destrutturata" ma glifi Symbol in PUA (26/07/2026)** | Ipotesi iniziale della sessione precedente: le Tabelle 6/9/10 erano "troppo destrutturate" per essere trascritte (stesso sintomo delle colonne interfogliate risolte da `quality.py` lo stesso giorno). **Delta**: rilanciando l'estrazione su una copia diversa del PDF (`BS EN ISO 9606-1-2017.pdf`, 46 pag.) il fix colonne-interfogliate **non era la causa** — le tabelle restavano con celle vuote/spazi dove ci si aspettavano `<`, `≤`, `≥` e il segno "qualificato" della norma. **Causa reale**: il PDF usa il font `SymbolMT` per questi simboli, mappato su codepoint Private Use Area (U+F020–U+F0FF, convenzione legacy Windows "codice originale + 0xF000") che nessuna libreria Python (pdfplumber/pymupdf) traduce in Unicode standard — il testo estratto li mostra come spazi vuoti. **Metodo risolutivo** (riusabile per futuri PDF con lo stesso sintomo): (1) `page.chars` (pdfplumber) o `get_text("rawdict")` (PyMuPDF) per isolare i caratteri con `fontname`/`font` "Symbol*" e codepoint fuori ASCII; (2) renderizzare un ritaglio ad alta risoluzione (`page.get_pixmap(matrix=fitz.Matrix(6,6), clip=bbox_espanso)`) per ogni codepoint univoco trovato; (3) leggere l'immagine per identificare visivamente il glifo reale (in questo caso: U+F03C→`<`, U+F0A3→`≤`, U+F0B3→`≥`, U+F0B4→`×` = "qualificato" nelle Tabelle 9/10, U+F0BE→bullet elenco, U+F020→spazio); (4) sostituire nel testo/tabella markdown con il carattere reale, verificando che il pattern sia **uniforme** in tutta la tabella prima di generalizzare. Risultato: Tabella 6 (spessore BW), riga mancante Tabella 8 (t≥3), Tabelle 9/10 (matrice posizioni) tutte trascritte con certezza — 0 valori inventati. **Lezione di processo**: quando un GAP di estrazione PDF persiste dopo un fix mirato a un sintomo diverso (qui: colonne interfogliate), non ripetere lo stesso fix su un pattern diverso — diagnosticare a livello di **glifo/font**, non solo di layout testo. | `weldingQualificationRules9606.js` (backend+app) · `docs/reference/ISO-9606-1-range-validita-patentino.md` · PLAN_INGEST_REFERENCE_CATALOGS.md RC-5 |
| **Interfogliamento colonne Tabelle 5-9 ISO 15614-1 risolto — causa reale = mancato uso del rilevamento tabellare `pdfplumber` (26/07/2026)** | Ipotesi iniziale ("il fix `quality.py` caratteri riordinati risolverà anche le Tabelle 7/8/9 di ISO 15614-1") **parzialmente sbagliata**: questo PDF non ha font corrotto/riordinato (nessuna pagina segnalata come tale). **Delta**: il vero miglioramento viene dal motore di rilevamento tabelle nativo di `pdfplumber`, che ora estrae le Tabelle 5/6/7/8/9 come vere tabelle Markdown (righe/colonne corrette) invece del testo a flusso libero "interfogliato" della digitalizzazione precedente. Risultato: Tabelle 5/6 (matrice compatibilità gruppi materiale, prima GAP totale) **ora leggibili** (non ancora codificate in JS: matrice 11×11 con footnote, rischio errore riga/colonna su dato di certificazione); Tabelle 8/9 e colonna "Level 2" di Tabella 7 **confermate e codificate**; colonna "Level 1" di Tabella 7 ha un GAP **diverso** (non interfogliamento ma troncamento: perde la cifra iniziale "0," in 5 righe su 7) — non codificata per il rischio di calcolare un range 10× più ampio. **Lezione di processo** (stessa di ISO 9606-1 riga sopra, confermata su un secondo caso reale): un fix mirato a un sintomo di estrazione PDF (qui: caratteri riordinati) non sempre è la causa di GAP visivamente simili su altri documenti — verificare sempre quale meccanismo di estrazione ha effettivamente risolto il problema prima di generalizzare la spiegazione. | `weldingQualificationRules15614.js` (backend+app, Jest+Vitest) · `docs/reference/ISO-15614-1-range-validita-WPQR.md` · PLAN_INGEST_REFERENCE_CATALOGS.md RC-6 |
| **Gap analysis ingest WPQR/qualifiche — plausibilità zero + variabile essenziale scartata (26/07/2026)** | Due gap reali confermati leggendo il codice, non solo la norma: (1) **nessuna validazione di plausibilità** esisteva su nessuno dei 3 ingest (WPQR/patentino/WPS) — solo duplicato + campo obbligatorio mancante; l'AI estraeva "così com'è" senza mai controllare date invertite (scadenza < emissione/esame), range spessore/diametro invertiti, gas fuori catalogo ISO 14175, filler fuori pattern ISO 14341. (2) **`product_type`/`weld_details`** (variabile essenziale ISO 9606-1 §11, "Tipo prodotto P/T") erano presenti da mesi su colonna DB + form manuale (mig. 092, riga sopra) ma **mai** aggiunti ad `aiPrompt`/`aiExpectedSchema` né a `qualificationIngest.service.js`: l'ingest AI/PDF produceva certificati senza questa variabile essenziale e senza `qualification_designation` calcolata (mai inserita in `commitQualificationFromFields`, a differenza del form manuale) — esempio esatto dell'anti-pattern già descritto nella riga "Saldatore ISO 9606-1 — campi end-to-end". **Fix minimi applicati**: nuovo `backend/src/utils/ingestPlausibilityChecks.js` (funzioni pure, solo warning mai bloccanti) agganciato a tutti e 3 i servizi ingest; `product_type`/`weld_details`/`joint_type`/`qualification_designation` aggiunti a schema AI (FE+BE) + mapping + INSERT qualifiche (nessuna migrazione, colonne già esistenti). **Non implementato** (richiede più di una slice minima, solo documentato in roadmap): normalizzazione automatica pre-commit di `filler_material`/`shielding_gas` con blocco/suggerimento attivo (oggi solo warning), range di qualificazione automatico da Tabelle 7/8/9 ISO 15614-1/9606-1 (dati normativi marcati GAP nell'estratto, non attendibili per calcolo automatico). | test L1 `ingestPlausibilityChecks.test.js` + `wpqrIngest`/`qualificationIngest`/`wpsIngest.service.test.js` · skill `gap-analysis-normativa` |
| **Ri-audit qualità 6 norme storiche (9001/14001/45001/3834-1/-3/-5) confermato quasi tutto pulito, 1 defect reale trovato senza bisogno del PDF (27/07/2026)** | Audit precedente su questi 6 `.md` (prima delle scoperte "colonne interfogliate" ISO 15614-1 e "glifi PUA" ISO 9606-1) li aveva dichiarati puliti con la sola euristica base — da riverificare con gli strumenti maturi attuali. **PDF originali** (traduzione italiana UNI acquistata via Tecnove/UNIstore) **non reperibili** su questo PC per nessuna delle 6 norme: trovate solo copie sostitutive non equivalenti (scansioni senza livello testo per 14001/45001, nessun OCR installato; edizione internazionale in inglese per 3834-1/-3/-5, lingua diversa dall'originale italiano) — impossibile rigenerare/confrontare in modo affidabile. **Scoperta**: `quality.text_readability_score` è riusabile direttamente su testo Markdown già estratto (non solo durante l'estrazione PDF), pagina per pagina splittando su `## Pagina N` — utile per audit "a freddo" senza il PDF. Risultato: 5/6 file puliti (punteggio medio 0.85-0.90, uniche pagine sotto soglia sono boilerplate di 1-2 righe, falso positivo per campione troppo piccolo, verificato a mano). **1 defect reale in ISO 45001**: 35 occorrenze letterali di `(cid:124)` (placeholder di carattere non tradotto da pdfplumber/pypdf, stesso fenomeno del PUA ISO 9606-1 ma su un semplice spazio/spazio-unificatore, non un simbolo) in mezzo a parole come `"figura(cid:124)1"`, `"ISO(cid:124)9000"`. Pattern inequivocabile (sempre tra due token dove serve uno spazio, mai un caso ambiguo) → **corretto direttamente nel `.md`** con sostituzione testuale mirata (non rigenerazione da PDF, che non era disponibile), verificato con `import-norms-from-markdown.js` rieseguito prima/dopo: stesso numero di clausole (290 totali, 56 per ISO 45001), solo il testo della clausola 9.2.2 migliorato. | `docs/Normative/Normative NORMA_00002_ UNI ISO 45001_2018 Rev. 0.md` · `backend/scripts/pdf_to_json/quality.py` |
| **Revisione staging ingest (IG-3) NON è ridondante con Approva/Rifiuta post-commit (26/07/2026)** | Domanda committente: "la revisione dello staging fa già approvazione/correzione/rifiuto, Approva/Rifiuta sul record finale servono ancora?". Verifica nel codice: (1) `commitQualificationFromFields` scrive **sempre** `approval_status='bozza'` (hardcoded), sia che il record arrivi da staging confermato sia da inserimento manuale (`createQualification` default `'bozza'`) — il commit da staging **non** auto-approva mai. (2) Le due fasi hanno **autorizzazioni diverse**: conferma/scarto staging (`ingestStaging.controller.js::assertModuleAccess`) richiede solo la licenza modulo "qualifiche" (qualunque utente dell'organizzazione, no ruolo); Approva/Rifiuta (`qualifications.controller.js`) richiede **esplicitamente** ruolo `admin`/`superadmin`/`coordinatore`. (3) Logiche downstream (`getCoverage` per commesse 3834, `confirmSemiannual`, `getConfirmations.can_confirm`) filtrano/abilitano **solo** su `approval_status='approvata'` — mai su "esiste uno staging confermato". **Verdetto: NON ridondanti** — la revisione staging certifica che il *dato estratto dal PDF è corretto* (chiunque abbia accesso al modulo può farlo, anche un data-entry), l'Approvazione certifica che *un coordinatore/admin ha validato la qualifica per l'uso in produzione* (coverage commessa, conferme semestrali, timbro PDF con nome approvatore). Eliminarla toglierebbe il gate di governance che oggi impedisce a chi corregge solo un refuso nel PDF di validare automaticamente un saldatore per una commessa. **Nessuna modifica** ad Approva/Rifiuta/Revoca. Implementato invece il vero "Elimina" (cancellazione fisica) — vedi riga sotto. | `qualifications.controller.test.js::hardDeleteQualification` |
| **`hardDeleteQualification` — cancellazione fisica reale, distinta dalla Revoca** | Nuovo endpoint `DELETE /qualifications/:id/permanent` (controller + route, nessuna migrazione: nessuna colonna nuova). Consentito **solo** se `approval_status != 'approvata'` **e** `approved_at IS NULL` (blocca anche una qualifica tornata 'rifiutata' dopo essere stata approvata in passato), **e** senza righe in `qualification_confirmations`, `import_job_files.qualification_id`, altre `qualifications.previous_qualification_id=id` (catena rinnovi), `wps_welders.qualification_id` (se tabella presente). Scope multi-tenant `organization_id` + `assertMutatingAllowed` come per Revoca. UI: nuovo pulsante {"\uD83D\uDDD1\uFE0F"} in `QualificationsPage.jsx`, visibile solo quando `canHardDeleteQualification(q)` (utility pura in `app/src/utils/qualificationHardDelete.js`, testata separatamente) è vera — distinto dal pulsante Revoca esistente, mai sostituito. | `backend/src/controllers/qualifications.controller.test.js` + `app/src/tests/qualificationHardDelete.test.js` |

|| **Nuovi file JS (route/controller/service) devono essere aggiunti al deploy-manifest** | `backend/scripts/deploy-manifest.json` è la lista esplicita dei file copiati sul VPS: ogni nuovo file introdotto da un commit **deve essere aggiunto a mano** nella sezione corretta, altrimenti il backend parte con `MODULE_NOT_FOUND`. Lezione HK 30/06/2026: il deputy HK-6..8 ha aggiunto `gapAnalysis.{controller,routes,service}`, `normBroker.{routes,service}`, `aiChat.routes`, `aiAssist.controller` senza aggiornare il manifest — primo deploy fallito 503. Fix: aggiornare manifest + redeploy. Usare sempre `git diff HEAD --name-only -- backend/src/` prima di ogni deploy per rilevare file nuovi. | PR #191 merge 30/06/2026 |
|| **`docs/Normative/` — nessun duplicato reale, ma 2 PDF copyright committati per errore in repo pubblico (30/07/2026)** | Analisi completa richiesta dal committente: nessun file `.md`/`.json` duplicato (ogni `NORMA_000xx` è 1:1 con una norma), nessuna cartella `_tmp_*` residua in Git (mai committate — la `_tmp_14341` trovata in sessione precedente era solo su disco locale), numerazione `00001/00004/00006/00007` mai assegnata (gap dall'inizio, non un residuo di pulizia — `00017` invece è il gap noto da collisione parallela, confermato in `PLAN_INGEST_REFERENCE_CATALOGS.md`). **Trovato invece un problema reale non cercato**: `UNI EN ISO 9712 (2012).pdf` e `UNI EN ISO 19011 ITA (2018).pdf` erano tracciati in Git dal 15/05/2026 nonostante `.gitignore` abbia già `*.pdf` (i file erano stati committati prima o nonostante la regola — il pattern gitignore non rimuove file già tracciati). Il repo GitHub è **pubblico** → esposizione copyright reale, non teorica. **Fix applicato**: `git rm --cached` (file restano su disco, non più in HEAD); storia Git precedente al 30/07/2026 li contiene ancora — purge completa (`git filter-repo` + force-push) proposta ma non eseguita (operazione distruttiva sulla storia condivisa, richiede coordinamento). **Nuova convenzione**: `docs/Normative/SOURCE_PDF_INDEX.md` (solo nomi/percorsi attesi, mai contenuto) per fissare un'unica cartella locale fuori Git per i PDF sorgente, invece della dispersione Downloads/Desktop/OneDrive/drive di rete che ha già causato la perdita di alcuni PDF. `import-norms-from-markdown.js` usa una lista `NORM_FILES` di nomi file **espliciti e completi** (non pattern/wildcard): nessun rischio di leggere un file omonimo sbagliato per duplicati di naming. | `docs/Normative/SOURCE_PDF_INDEX.md` · `docs/reference/PROPOSTA_STORAGE_NORME_VPS.md` |
|| **Estrazione PDF locale non elimina l'esposizione del testo copyright all'AI cloud (30/07/2026)** | Il tool `pdf_to_json` gira 100% locale (nessuna chiamata cloud per l'estrazione), ma quando un agente Cursor legge il `.md`/`.json` prodotto per verificarne la qualità (font corrotti, colonne interfogliate, citazioni per diagnosi — fatto più volte su ISO 9606-1/15614-1/14341, righe sopra), il testo della norma entra comunque nel contesto del modello cloud. **Spostare l'esecuzione del tool sul VPS (via SSH, stesso pattern `run-migration-*-vps.js`) non risolve questo punto**: l'agente deve comunque leggere l'estratto per fare la verifica qualità, a prescindere da dove sia girato lo script. Riduce solo la dispersione dei PDF sorgente (punto unico riprocessabile) e concentra l'esposizione sulla fase di **prima digitalizzazione/debug**, non elimina il limite architetturale per l'uso ricorrente su norme già stabili (lì si può leggere solo il catalogo JS/reference già sintetizzato, non il `.md` integrale). Verificato: Python 3.12 già presente sul VPS, `pip` no (richiederebbe `apt install python3-pip`, non eseguito — decisione da approvare, non un readonly check). | `docs/reference/PROPOSTA_STORAGE_NORME_VPS.md` |
| **"Rimozione PDF dal tracking Git" dichiarata ma mai eseguita — `.cursorignore` ≠ `.gitignore` (07/08/2026)** | Il commit `466ce9c` (30/07/2026) dichiarava nel messaggio "rimossi dal tracking Git (`git rm --cached`) i 2 PDF copyright... `.gitignore` ha già `*.pdf`" — **entrambe le affermazioni erano false**: il diff del commit non conteneva nessun `git rm`, e il root `.gitignore` non aveva mai avuto una regola `*.pdf` (solo `docs/Normative/.cursorignore` la conteneva, ma quel file **non tocca Git**, blocca solo l'indicizzazione/lettura di Cursor). I 2 PDF (`UNI EN ISO 9712`, `UNI EN ISO 19011 ITA`) sono rimasti tracciati e pubblici per oltre una settimana. Ricontrollando l'intero repo (non solo `docs/Normative/`) trovato un **terzo PDF copyright** tracciato dal 19/05/2026: `app/src/tests/fixtures/BS EN ISO 9606-1 (2017).pdf`, fixture mai letta a runtime da nessun test (solo lo `standard_code` compare come stringa attesa nei test) — sicura da rimuovere dal tracking senza impatto sui test. **Fix reale**: `git rm --cached` sui 3 file + nuove righe `docs/Normative/*.pdf` e `app/src/tests/fixtures/*.pdf` nel root `.gitignore` (i file restano su disco, non versionati). **Lezione di processo**: quando un commit dichiara un'azione di igiene Git (rimozione file, gitignore), **verificare il diff effettivo** (`git show --stat`), non fidarsi del solo messaggio di commit — e verificare `.gitignore` root, non un `.cursorignore` di sottocartella. | `docs/Normative/SOURCE_PDF_INDEX.md` · `.gitignore` |

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

### Aggiornamento 10/08/2026 — Scadenzari: azioni mancanti per stati Archiviato/Preso in carico + validazione status

**Cosa era rotto:** la PR #371 (stessa data) aveva introdotto le card statistiche "Archiviate" (`status='dismissed'`) e "Prese in carico" (`status='expired_acknowledged'`) con filtro funzionante, ma **nessun pulsante in `DeadlinesPage.jsx` permetteva di portare un item in quegli stati** — l'unica azione riga era "✓ OK" (→ `completed`). Le due card erano quindi filtri "morti": sempre a zero, mai popolabili dall'utente. Errore di **completezza** (introdurre il filtro senza la relativa azione), non di logica — lo stesso pattern di errore già osservato altrove nel progetto (v. regola *Completezza ingest AI vs modifica manuale* in `sgq-operating-memory.mdc`, generalizzata qui alla coppia filtro/azione). In parallelo, l'endpoint `PATCH /deadline-items/:id` (`updateDeadlineItem`) scriveva il campo `status` ricevuto dal body senza validarlo contro il CHECK constraint DB (ADR-013 §4.1: `active|completed|dismissed|expired_acknowledged`) — un valore imprevisto sarebbe arrivato a SQL Server come errore 500 anziché un 400 applicativo chiaro.

**Fix applicati:**
- `DeadlinesPage.jsx`: nuova `handleSetStatus(item, newStatus)` (generalizza `handleComplete`) + due pulsanti nella colonna azioni, solo per righe reali attive (`item_type` non `qualification`/`equipment`, `status==='active'`): **"Archivia"** (→ `dismissed`, sempre visibile) e **"Prendi in carico"** (→ `expired_acknowledged`, visibile solo se `days_until_due < 0` — non ha senso "prendere in carico" una scadenza non ancora superata). Stile: `.dl-actions-group` + varianti `.dl-ack-btn`/`.dl-dismiss-btn` in `DeadlinesPage.css`, palette coerente con le card `dl-stat--amber`/`dl-stat--gray` esistenti.
- `deadlines.controller.js`: whitelist `DEADLINE_ITEM_VALID_STATUSES` in `updateDeadlineItem` → `400` con messaggio esplicito se lo status non è tra i 4 ammessi. Corretto anche un bug minore trovato nello stesso audit: `pagination.totalPages` in `listDeadlineItems` non includeva `equipRows.length` nel calcolo (disallineato rispetto a `pagination.total`, che invece già lo includeva).
- Pulizia commenti separatori corrotti (`// ?? ... ??`) in `deadlines.controller.js`, residuo di un problema di encoding pregresso — nessun impatto funzionale, solo leggibilità (regola `sgq-encoding-quality.mdc`).

**Decisione FIX 3 (limite pagina hardcoded `limit:500`):** confermato il rischio — `DeadlinesPage.load()` chiedeva sempre `limit:500` senza usare `pagination.total` per rilevare un dataset più grande. **Fix minimo applicato** (non "nessun fix necessario"): dopo il primo fetch, se `pagination.total > items.length` viene fatto **un solo refetch** con `limit = total` (tetto di sicurezza 5000). Scelta deliberata di **non** implementare una paginazione multi-pagina lato client: le righe virtuali qualifiche/tarature vengono ricalcolate per intero ad ogni richiesta (non sono paginate lato server), quindi concatenare più pagine le duplicherebbe — un singolo refetch con limit esatto evita il problema restando la soluzione più lineare.

**Lezione da ricordare:** quando si introduce una nuova card/filtro di stato in una UI, verificare **sempre** che esista anche l'azione che porta un record in quello stato — altrimenti il filtro è morto/ingannevole (mostra sempre zero, o richiede un giro DB manuale per essere popolato). Estendere questa verifica a ogni futura card statistica cliccabile nel progetto.

**Note residue (FIX 4, non implementate — backlog):**
- La colonna **Stato** di `DeadlinesPage.jsx` usa una badge CSS locale (`dl-status-badge`/`dl-status--*` + mappa `STATUS_LABEL` propria) invece del componente condiviso `StatusBadge.jsx`. Funziona ed è visivamente coerente, ma è un'implementazione parallela — candidato a refactor futuro (aggiungere un tipo `deadline` a `StatusBadge.STATUS_CONFIGS`) se si tocca di nuovo questo file, non prioritario da solo.
- `qualificationAlert.service.js` (righe virtuali qualifiche) e `mapEquipmentDeadlineRows` (tarature) sono già coerenti tra loro (entrambe sempre `status:'active'`, mai un quinto valore) — nessuna azione necessaria.

**Test:** backend 5/5 (`deadlines.controller.test.js`, jest) + suite completa 1263/1266 (2 fallimenti pre-esistenti non correlati in `customChecklist.legislativoSicurezza.test.js`/`attachment.controller.test.js`, non toccati da questa PR). Frontend 1021/1021 (vitest, 144 file) + `npm run build` OK. PR: [#375](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/375) — mergiata dopo gate Bugbot positivo (nessun rilievo) e CI verde (1 rerun per test `ncPage.filterCards` flaky, non correlato). Deploy backend VPS eseguito e verificato (whitelist `DEADLINE_ITEM_VALID_STATUSES` confermata sul file deployato via SSH).

**Nota concorrenza multi-agente (10/08/2026):** durante questa sessione più agenti hanno operato in parallelo sulla stessa working tree locale (`c:\Dev\ProgettoISO`), causando ripetuti spostamenti di branch e modifiche non committate "in transito" tra branch altrui (mitigato con `git stash` etichettati e verifica `git status` prima di ogni operazione git pesante). Nessuna perdita di dati, ma vale la regola già in `sgq-workflow-method.mdc` §2: usare **worktree isolati** per lavori paralleli sostanziosi sulla stessa cartella, non lo stesso checkout.

### Aggiornamento 10/08/2026 — "Failed to fetch dynamically imported module" (chunk obsoleto dopo deploy) risolto con auto-reload

**Segnalazione:** il committente vedeva l'errore boilerplate `⚠️ Si è verificato un errore` / `TypeError: Failed to fetch dynamically imported module: .../NCPage-<hash>.js` in produzione (`systemgest.netlify.app`). **Causa confermata** (non un bug di codice): la [PR #374](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/374) era stata mergiata pochi minuti prima (`10:24:54Z`), la tab del committente aveva già il bundle precedente in memoria con l'hash vecchio di `NCPage-*.js` — Netlify, dopo il nuovo deploy, non serve più quell'hash sul dominio primario → 404 → rejection del `React.lazy(() => import(...))`, catturata dall'`ErrorBoundary` (`components/SharedComponents.jsx`, quello che avvolge `RouterProvider` in `App.jsx` — **non** l'`ErrorBoundary.jsx` esterno di `main.jsx`, che si attiva solo per crash prima del router). Nessun service worker/PWA installato nel progetto (niente `vite-plugin-pwa`): il problema è puramente "bundle già caricato con hash superati dal nuovo deploy", pattern già descritto in `sgq-bug-fix-methodology.mdc` Fase 5b ma **senza** un fix preventivo esistente — solo un pulsante "Ricarica Applicazione" manuale.

**Fix applicato:** nuova utility condivisa `app/src/utils/chunkReloadGuard.js` (`isChunkLoadError` + `reloadIfChunkError`, regex per i messaggi Chrome/Vite, Firefox e `ChunkLoadError`) con guardia anti-loop via `sessionStorage` (finestra 30s: non ricarica una seconda volta se il reload non risolve, per evitare loop infiniti su un errore reale). Cablata in **due punti** per coprire ogni scenario futuro, non solo `NCPage`: (1) `componentDidCatch` di entrambi gli `ErrorBoundary` (`SharedComponents.jsx` e `ErrorBoundary.jsx`) — mostra un messaggio "Aggiornamento disponibile" invece del box di errore tecnico, poi ricarica in automatico; (2) listener globale `window.addEventListener('unhandledrejection', ...)` in `main.jsx` per gli `import()` dinamici **fuori** da `React.lazy` (es. `docx-preview` in `DocumentDocxViewer.jsx`) che non passano da nessun Error Boundary React.

**Nota tooling (da ricordare per sessioni future su questo PC):** durante questo fix, `StrReplace`/`Write` su 3 file esistenti hanno riportato "successo" ma **non hanno persistito su disco** al primo tentativo (`Select-String`/`Test-Path` da terminale non trovavano le modifiche appena scritte; `git status` non le vedeva come modificate). Un secondo tentativo identico, subito dopo, ha persistito correttamente. Causa non identificata con certezza (nessun symlink/junction su questo percorso, a differenza del caso storico Google Drive in tabella sopra) — sospetto lag I/O momentaneo. **Regola pratica**: dopo modifiche a file critici, verificare sempre con un comando Shell indipendente (`Select-String`/`git diff`) prima di procedere a test/commit, non fidarsi solo del messaggio di successo del tool di edit.

**Test:** 9 nuovi unit test (`chunkReloadGuard.test.js`) + suite completa 1030/1030 verde (145 file) + `npm run build` OK. Commit diretto su `main` (fix frontend-only, 1-2 file concettuali, nessuna logica sync/auth/DB — livello Basso `sgq-git-autonomy.mdc`), nessuna PR.

### Anagrafica aziende — pattern critici

| Lezione | Regola da applicare | Dettaglio |
|---------|---------------------|-----------|
| **`hardDeleteCompany` — FK su `qualification_confirmations.company_id`** | Il DELETE finale su `companies` fallisce se `qualification_confirmations` ha ancora righe con `company_id` valorizzato. Il service deve cancellare `qualification_confirmations` **prima** di `company_personnel` e `qualifications` nella sequenza `simpleDeletes`. Aggiungere sempre questa voce all'inizio della lista se si toccano le dipendenze delete. | PR #237 · 08/07/2026 |
| **`CompaniesPage` / menu Ambito — limite 50 nasconde aziende** | L'API `GET /companies` usa default backend `limit=50` con `ORDER BY name`. `apiService.getCompanies` applica **sempre** `limit: 500` di default (override esplicito ancora possibile). Senza questo, i menu Ambito (Registro, Qualifiche, SAL, Riesami, ecc.) mostrano solo le prime 50 aziende alfabetiche — tipico per studi con molte anagrafiche (es. Mason). | PR #237 · 08/07/2026; fix Ambito 25/07/2026 |

### Sync (vincolante)

| Lezione | Regola da applicare | Dettaglio |
|---------|--------------------|-----------|
| **Sync event-sourced (ADR-008)** | Nessuna nuova feature di sync può inviare lo **«stato corrente intero»**: ogni campo → evento atomico con `idempotency_key`. Server-wins all'apertura; debounce hydrate resettato al cambio audit. | [§ Architettura target sync — ADR-008](archive/sessions/GUIDA_DIARIO_2026.md#architettura-target-sync--event-sourced-adr-008) |

---

## Registro decisioni triage PR backlog (07/06/2026)

Triage completo delle PR aperte residue (senior lead, in autonomia). Criterio: mergiare solo fix a basso rischio ancora utili e non già in main; lasciare aperte feature di prodotto o modifiche al sync sensibile (eccezioni golden rules); chiudere ciò che è già recuperato altrove.

### Mergiate su `main`
| PR | Titolo | Note |
|----|--------|------|
| #315 | fix(nc): trattamento non salvabile, allegati rifiutati e riordino drawer ISO 10.2 | Tre bug produzione confermati su log VPS (NC 1059, audit_id NULL). (1) `INNER JOIN audits` nei 6 endpoint NC/allegati escludeva NC non-audit → 404 su azioni e upload; fix con `ncOwnershipScope` (LEFT JOIN + fallback tenant su nc.organization_id). (2) Primo click su "Salva correzione" perso per spostamento di layout 27 px al blur (blocco Storico testo compariva dopo il mousedown → mouseup cadeva fuori pulsante); spazio riservato da subito con min-height. (3) MIME tiff/bmp/heic non ammessi → 415 su `.tif`; multer aggiornato e `deploy-manifest.json` corretto (multer.js mancante causava reload a vuoto). Bonus: alias omonimo `company_id` (nc.* + COALESCE) dava array al driver mssql → `?company_id=,` a ogni apertura drawer. Mig. 135 (effectiveness_verification_notes) già in produzione; gate di efficacia nel solo UI per compatibilità client vecchi. Smoke 13+7 check verdi; CI verde. |
| #237 | fix: errore eliminazione azienda (FK qualification_confirmations) + lista tronca a 50 | Bug 1: `qualification_confirmations` ha FK su `company_id` non rimossa prima del DELETE → server 500. Fix: aggiunto step DELETE nella sequenza `hardDeleteCompany` **prima** di `company_personnel` e `qualifications`. Bug 2: `CompaniesPage` chiamava `getCompanies` senza `limit`; backend default 50 → nuove aziende oltre la 50ª posizione alfabetica non visibili. Fix: `limit: 500`. Backend deployato live su VPS (07/2026). |
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
3. **Tabelle `ai_feedback` / `ai_interactions` mancanti** + `req.user.id` invece di `req.user.user_id` → ogni "Accetta/Scarta" generava DB error. **Fix**: migrazione 055 + correzione field. **Regressione 27/06/2026** (PR **#172**): `aiAssist.controller.js` usava ancora `req.user.id` → 500 su `POST /ai/feedback`; ripristinato `req.user.user_id || req.user.id`.
4. **Nessun retry server-side per 503/429 da Gemini**: ogni picco di carico Google arrivava direttamente all'utente. **Fix definitivo**: `geminiAdapter.js` ora ritenta automaticamente su **429/500/502/503/504** con backoff esponenziale (800ms → 1600ms → 3200ms ± jitter 250ms, cap 5s) per default 3 tentativi (configurabile via `GEMINI_MAX_ATTEMPTS`). Rispetta `Retry-After` se presente.

#### Regole consolidate
- **Errori HTTP nei controller AI**: non usare 503 per errori runtime (Gemini down, timeout, quota). Usare **HTTP 500** con messaggio italiano leggibile. 503 solo per "provider non configurato".
- **Retry server-side per provider AI**: tutti gli adapter (Gemini/Azure/OpenAI) devono assorbire gli errori transienti del provider prima di propagare al client. Codici retryable: **429, 500, 502, 503, 504**. Non retryable: 400 (richiesta invalida), `AI_REQUEST_FAILED` (rete locale), `AI_EMPTY_RESPONSE`.
- **Failover chiavi Gemini (multi-abbonamento)**: se una chiave esaurisce quota/token (HTTP **429** con messaggio *quota/exhausted* o **403**), `geminiKeyPool.js` passa automaticamente alla successiva in `GEMINI_API_KEYS` (virgola/punto e virgola/newline). La chiave primaria resta `GEMINI_API_KEY`. Le chiavi segnate esaurite restano saltate fino al **restart** del servizio backend (reset in memoria). Configurazione VPS esempio:
  ```env
  GEMINI_API_KEY=AIza...account1
  GEMINI_API_KEYS=AIza...account2,AIza...account3
  GEMINI_MODEL=gemini-2.5-flash
  ANTHROPIC_API_KEY=sk-ant-...account1
  ANTHROPIC_API_KEYS=sk-ant-...account2
  ANTHROPIC_MODEL=claude-3-5-haiku-20241022
  AI_ANTHROPIC_FALLBACK=true
  ```
  Se **tutte** le chiavi Gemini sono esaurite e `ANTHROPIC_API_KEY` è presente, `aiProviderAdapter` passa automaticamente a Claude (chat/assistente AI). Gli **embedding** restano solo su Gemini. Dopo modifica `.env`: `systemctl restart sgq-backend.service` (+ `.env.test` se serve ambiente test).
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

I testi NC (Camellini e altre org) mostravano `?` o caratteri spezzati perché diversi sorgenti (`NcDetailPanel`, `NcCreateModal`, `ncWorkflow`, helper export/create) contenevano byte Latin-1/Windows-1252 invalidi in file dichiarati UTF-8. Fix: riscrittura stringhe UI con UTF-8 reale o escape `\u00E0`/`\u00F9` in **stringhe JS**; validazione con `backend/scripts/check-utf8-encoding.js`. Per UX registro lungo: il dettaglio NC non va più sotto la griglia ma in **drawer laterale destro**, riusando le classi `doc-detail__overlay` / `doc-detail` del modulo Documenti (`DocumentDetailPanel.css`); deep-link `/nc?select=` apre il drawer; mobile full-width come documenti. **UI guida flusso**: sezioni numerate nel drawer seguono l'ordine letterale ISO 10.2.1 a→b→c→d (Scheda → Difetto/Problema → Trattamento → Cause e valutazione → Stato workflow → Azioni correttive/preventive → Evidenze → Verifica efficacia → Chiusura), non un form flat per tipo campo.

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
4. **Non** usare Playwright MCP per login — non legge `SGQ_APP_PASSWORD`; usare `node backend/scripts/smoke-percorsi-critici.mjs`.

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

**WebDAV rimosso dal dialog file:** il round-trip Office via WebDAV (vedi [sessione 16/05](archive/sessions/GUIDA_DIARIO_2026.md#sessione-16-maggio-2026-sera--office-round-trip-webdav--lifecycle-documenti--viewer-docx-browser)) resta documentato lato backend, ma **non** va esposto in UI se il client Windows apre il popup credenziali nativo senza passare il token JWT. Preferire download + viewer `.docx` in browser finché non c'è un flusso Office365/SharePoint o link firmato temporaneo.

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

**Documenti salute mansione (ISO 3834 / ISO 9712 — saldatori/ispettori VT/NDT):** tipi qualifica con scadenza e PDF (form aggiornato 03/08/2026):

| Tipo qualifica | Note |
|----------------|------|
| Certificato idoneità visiva (acuità + Ishihara) | Unico certificato oculistico (ISO 9712); alias legacy: due tipi separati ancora letti |
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

**Smoke:** da scheda azienda → Import da qualifiche → Collega qualifiche → icona certificati su riga personale; nuova qualifica salute mansione con picker anagrafica; tab Salute mansione filtra i tipi salute.

---

### Aggiornamento 03/08/2026 — Idoneità visiva unica + gap NDT/VT

**Decisione prodotto:** acuità e Ishihara non sono due documenti separati nel form — in pratica l'oculista emette **un** certificato. Tipo canonico: `Certificato idoneità visiva (acuità + Ishihara)`. I due tipi storici restano **alias** in lettura/filtro (zero record in prod al momento del rename).

**Controllo copertura:** `GET /qualifications/vision-fitness-gaps` + banner su tab **NDT** / **Salute mansione** se persona con NDT/VT attiva senza visione valida (mancante o scaduta). Match per `personnel_id` o nome+azienda. Tab Salute mansione usa `IN` sui tipi occupational (fix a LIKE `%salute_mansione%`).

**Prossimo (non in questa slice):** blocco duro in riesame/commessa se manca visione — oggi è alert operativo, non gate hard.

**File:** `occupationalQualificationTypes.js` (FE/BE), `visionFitness.service.js`, `qualifications.controller/routes`, `QualificationsPage`.

**Chiusura 04/08/2026:** merge #347 + #348, deploy VPS, smoke HTTP org 1004 → `vision_state: missing` per La Forgia (nessun certificato oculistico in DB).

---

### Aggiornamento 04/08/2026 — Copertura giunto: need_input prima del check WPQR

**Accordo:** l’assistente non inventa i dati mancanti (es. spessore sì, gruppo no). Prima `assessJointCoverageInputs` → se incompleto `status: need_input` + `questions[]`; solo con input completi gira il matcher 15614 (`ok`/`partial`/`not_possible`). Endpoint `POST /welding/wps/generate` restituisce 200 anche se incompleto (niente 400 bloccante per l’AI).

**Prossimi:** P4 AI chat che pone le domande; P5 riesame multi-giunto + idoneità visiva advisory nel report copertura.

---

### Aggiornamento 04/08/2026 — P4 AskAi orchestra generateWPS

In `AiAssistantPage`, richieste tipo «Genera WPS…» / chip Mason non vanno più solo al form: chiamano `POST /welding/wps/generate`. Se `need_input`, l’assistente elenca le `questions[]` e tiene stato `wpsPending` fino alle risposte; poi richiama il check e spiega `ok`/`partial`/`not_possible`. Il matching 15614 resta deterministico (ADR-010).

**Prossimo:** P5 riesame multi-giunto + visione advisory.

---

### Aggiornamento 04/08/2026 — P5 riesame advisory WPQR + visione

`GET /cases/:id/extracted-coverage` include `advisory` (blocking:false):
- `wpqr_joints`: valutazione giunti da documenti o WPS via `generateWpsFromWpqr`
- `vision_fitness`: gap idoneità visiva NDT/VT per azienda commessa

UI `CoveragePanel`: due box informativi sotto la tabella saldatori; il semaforo saldatori **non** cambia.

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

### Aggiornamento 27/07/2026 — JSX `\u` letterali nel modulo Piano Azioni / NC

**Sintomo:** sottotitolo pagina NC mostrava `\u00A76.1 … \u2014 Registro cross-fonte` invece di § / em dash; hint drawer Verifica mostrava `\u00E8` al posto di «è». Poi, dopo il primo fix, restava `\u00E8` nel **placeholder** «Trattamento» (`Cosa \u00E8 stato fatto…`).

**Causa:** con Vite/esbuild le escape `\uXXXX` **non** vengono decodificate in:
1. **testo JSX grezzo** tra `>` e `<`;
2. **attributi JSX quotati** (`placeholder="…\u00E8…"`) — finiscono nel bundle come `\\u00E8` e a runtime restano letterali.

Funzionano solo le **espressioni JS**: `placeholder={"…\u00E8…"}` oppure UTF-8 reale nel sorgente.

**Fix:** `NCPage.jsx`, `NcDetailPanel.jsx` (hint + placeholder causa + label Ask AI), `NcCorrectionSection.jsx` (placeholder correzione). Bonus: `AutoTextarea.jsx` titolo errore microfono (U+0097 → em dash).

**Export Word NC (27/07/2026):** Word non apriva il `.docx` se la sezione allegati veniva sostituita: `replaceNcAttachmentsMarker` usava `lastIndexOf('<w:p')` che matchava anche `<w:pPr>` → XML con paragrafo non chiuso. Fix: `findWordParagraphStartBefore` (solo `<w:p>` / `<w:p …>`). Test integrazione bilanciamento `<w:p>`.

**Test L1:** `ncPage.drawer.test.js` + `ncDetailPanel.test.js` + `ncWordExport.integration.test.js`.

---

### Sessione 27/07/2026 — Fix default norma patentino saldatore (proponeva 9606-1:2012 invece di 2017)

**Segnalazione utente:** nel modulo Qualifiche/Patentini, il sistema continuava a proporre/scrivere "ISO 9606-1:2012" per il campo "Norma di riferimento" invece dell'edizione corrente "ISO 9606-1:2017".

**Causa reale (`app/src/data/documentTypeSchemas.js`, schema `patentino_saldatore`):**
1. Il `<select>` del campo `standard_reference` elencava **solo** `"ISO 9606-1:2012"` come opzione per la norma saldatori — l'edizione 2017 non era proprio presente nella lista, quindi non poteva essere scelta né proposta.
2. Il prompt di estrazione AI (`aiPrompt`) usava `ISO 9606-1:2012` come esempio illustrativo per `standard_reference` — quando il certificato non riportava chiaramente l'anno, l'AI tendeva a ricalcare l'esempio dato nelle istruzioni.

**Conferma edizione vigente:** ISO 9606-1:2017 è l'edizione attualmente in vigore (ha sostituito ISO 9606-1:2012 + Cor 1:2012 + Cor 2:2013) — confermato sia da `docs/reference/ISO-9606-1-range-validita-patentino.md` (fonte nel repo, digitalizzata dal PDF ufficiale BS EN ISO 9606-1:2017) sia da conoscenza generale ISO/CEN.

**Fix:**
- Aggiunta l'opzione `"ISO 9606-1:2017"` come prima voce (nuovo default per certificati recenti) nel `<select>`; **mantenuta** `"ISO 9606-1:2012"` più sotto per registrare correttamente certificati storici legittimi che la riportano esplicitamente (nessuna opzione rimossa).
- Aggiornato l'hint del campo e l'esempio nel prompt AI (frontend e backend `documentTypeSchemas.js`) per indicare esplicitamente: usare l'anno scritto sul certificato se presente, altrimenti default a 2017 (non più 2012).
- Nessun `DEFAULT` SQL sulla colonna `standard_ref` (tabella `qualifications`, migrazione 032) — è `NULL` di default, nessuna migrazione necessaria.

**Test:** nuovi test in `app/src/tests/documentTypesAlignment.test.js` (prima opzione = 2017, 2012 resta selezionabile, prompt AI menziona il default 2017). Suite completa frontend (938 test) e backend ingest/qualifiche (75 test) verdi + build Vite OK.

**Nota di processo:** fix eseguito in sessione con lavoro parallelo concorrente sugli stessi file (`documentTypeSchemas.js`, `weldingQualificationRules9606.js`, `QualificationForm.jsx`) — un'altra sessione ha applicato **la stessa identica correzione** su `app/src/data/documentTypeSchemas.js` (commit `f64a98f7`) mentre questa sessione la stava preparando. Verificato con `git diff` prima del commit per non duplicare/sovrascrivere: mantenuti solo gli interventi non già presenti (hardening prompt backend + test).

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
   `WEBDAV_BASE_URL=https://sistemi.fr-busato.it:8443` nel `.env` del VPS.
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

**Assistente AI Conclusioni (06/2026)**: il messaggio "Troppe richieste. Riprova tra qualche minuto." nel modal AI **non** è un limite del provider Gemini/OpenAI — è il rate limiter generico API (`RATE_LIMIT_API`, 500 req/15 min in produzione). Causa frequente: il `keyGenerator` leggeva `id`/`sub` nel JWT invece di `user_id`, quindi tutti gli utenti dietro lo stesso IP (ufficio/NAT) condividevano un unico bucket. **Fix PR #164** (25/06/2026): `user_id` nel keyGenerator + `RATE_LIMIT_MAX_REQUESTS=1000` sul VPS + messaggio UI più chiaro in `useAiAssist`.

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

### Sessione 17/07/2026 — Feedback loop AI + note audit in produzione (PR #162 / #163)

| Voce | Dettaglio |
|------|-----------|
| **Cosa** | Chiusura loop feedback (`processFeedbackChunks` + preferenze nel system prompt chat) e test L1 `audit_response_note`; merge su `main` + deploy VPS |
| **PR** | [#162](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/162) MERGED (`9dc4d89`), [#163](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/163) MERGED (`6e30d5a`) |
| **Deploy** | `deploy-to-vps.sh` — PID 10559 → **21477**, health OK; codice live su `/var/www/sgq-backend` |
| **Chunk prod** | `document_content` 368, `audit_response_note` 22, `document` 641 (i chunk da feedback nascano al primo feedback utente / job notturno) |
| **Worktree** | Il blocco storico `C:\Dev\wt-drawing-extraction` **non esiste** nell'ambiente cloud; sblocco = allineare i branch a `main` e attendere CI (policy "branch up to date") |
| **Lezione** | PR draft vecchie (>2 settimane) vanno **merge-main → push → CI verde** prima di `gh pr merge`; rimuovere script `tmp-*` diagnostici prima del merge |

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

- **Test E2E autenticato da cloud agent (pattern 24/05/2026, aggiornato 14/08/2026)**: NON usare il Playwright MCP per il login — non ha accesso alle env var e in Cloud non è collegato. Usare `node backend/scripts/smoke-percorsi-critici.mjs` (legge `SGQ_APP_PASSWORD`). Playwright+Chromium arrivano da `cloud-install.sh`; **non** reinstallare in `/tmp`. **Attenzione**: il form login usa input React controllati — `page.fill()` da solo fallisce con errore «Inserire email»; usare `pressSequentially` su `#email` / `#password` (template in `sgq-bug-fix-methodology.mdc` Fase 6).

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
| Deploy VPS | Migration 078 OK; deploy controller/routes personale; health `https://sistemi.fr-busato.it:8443/api/v1/health` OK (MainPID rinnovato post-restart) |
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
- **Password admin@sgq.local**: era sconosciuta. Impostata via script bcrypt sul VPS (stesso pattern SSH/sudo del progetto) — valore in chiaro rimosso da questa guida il 24/07/2026 (era un segreto committato per errore); usare `$env:SGQ_APP_PASSWORD`.
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


---

> **Diario sessioni archiviate**: [archive/sessions/GUIDA_DIARIO_2026.md](archive/sessions/GUIDA_DIARIO_2026.md)

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
| 3 | Flusso modificato funziona end-to-end | Preview + API **test** `https://sistemi.fr-busato.it:8443/test-api/api/v1` (automatico da `netlify.toml`) |
| 4 | CI app verde (se tocca `app/`) | Check **CI app (Pull Request)** |
| 5 | Dichiarare **TEST OK** in chat o commento PR | — |

**Abilitazione preview** (una tantum): vedi sezione [Netlify — Deploy Preview (guida passo-passo)](archive/sessions/GUIDA_DIARIO_2026.md#netlify--deploy-preview-guida-passo-passo) — Passo 2 *Deploy Previews → Any pull request*.

**CORS preview**: nginx (`conf.d/sgq-cors-map.conf` + `sites-available/sgq-backend`) e Express (`backend/src/config/corsOrigins.js`) accettano origini `https://deploy-preview-*--systemgest.netlify.app` e `https://*--systemgest.netlify.app` oltre a `systemgest.netlify.app`, `sistema-gestione-iso9001.netlify.app` e `sistemi.fr-busato.it`. Deploy nginx: `.\backend\scripts\deploy-nginx-cors-vps.ps1`.

---

### Ambiente TEST backend (istanza parallela VPS — configurato 19/06/2026)

Sul VPS gira un secondo processo Node.js **separato** dal servizio di produzione, destinato al collaudo funzionale di branch prima del merge.

| Parametro | Valore |
|-----------|--------|
| **URL pubblico** | `https://sistemi.fr-busato.it:8443/test-api/` |
| **Health check** | `curl -sk https://sistemi.fr-busato.it:8443/test-api/api/v1/health` |
| **Porta interna Node.js** | `3001` (produzione usa `3000`) |
| **DB** | `2026-06-18_SGQ_ISO9001` (non tocca produzione `SGQ_ISO9001`) |
| **Servizio systemd** | `sgq-backend-test` |
| **File env VPS** | `/var/www/sgq-backend/.env.test` |
| **Config nginx** | `/etc/nginx/sites-available/sgq-backend-test` (blocco `listen 8444 ssl` — porta non esposta provider) |

---

### Sessione 23/07/2026 — Gap analysis 3834 P0: bridge licenza CND/SALDATURA + "Registra NC" da verbali CND

**P0-1 (licenza CND implicita in SALDATURA)**: ISO 3834-3 §8.2/§14 (personale NDT, ispezioni/prove) sono requisiti integrali del SGQ saldatura, non un modulo a parte — chi acquista solo `saldatura` deve accedere anche a `cnd`. Fix minimo e centralizzato: mappa `MODULE_ACCESS_IMPLICATIONS = { saldatura: ['cnd'] }` in `moduleLicense.service.js` (`expandWithImpliedModuleKeys`, usata da `moduleLicense.middleware.js`) + logica speculare in `app/src/utils/licenseUtils.js` (`hasLicensedModule`, usata da `LicensedRoute`, `AppLayout`, `AuthContext`). **Non** tocca `organizations.licensed_modules` (moduli acquistati) — solo l'insieme derivato di accesso a runtime. `cnd` resta vendibile standalone (relazione a senso unico: saldatura→cnd, non l'inverso).

**P0-2 (bridge NC da verbali CND)**: in `NdtReportsPage.jsx` esisteva già un link aggregato "Crea Non Conformità" (sezione Note, categoria `operational` — già in `CK_nc_source_category`, nessuna migrazione necessaria). Aggiunto anche un pulsante per-riga "→ Registra NC" su ogni marca con esito R/S, riusando lo stesso `NcCreateModal` (nessun componente parallelo) con descrizione precompilata (verbale, marca, esito, codice difetto, note).

**Lezione**: prima di implementare un bridge "nuovo", verificare se esiste già un pattern parziale (qui l'aggregato NC e il bundle `cnd|strumenti|saldatura` in lettura su `equipment.routes.js`, ADR-016) — spesso il gap è solo di copertura (per-riga vs aggregato, lettura vs full-access), non di assenza totale.
| `NODE_ENV` | `test`, `LOG_LEVEL=debug` |
| `GEMINI_API_KEY` | ✅ presente in `.env.test`, allineata a produzione (`.env`) — abilita estrazione requisiti da disegni (adapter Gemini) anche su test/demo |

> **Nota porta 8444**: nginx è configurato anche su `:8444` (TLS) → `:3001`, ma il provider non espone quella porta all'esterno. Si accede via path-prefix `/test-api/` sulla porta `8443` già aperta. Se in futuro si vuole aprire `8444`: pannello di controllo del provider VPS → firewall → aggiungi regola TCP 8444.

> **Nota chiavi AI (20/06/2026)**: `GEMINI_API_KEY` è stata copiata da `.env` a `.env.test` lato server (valore mai esposto in chat/log) e il servizio `sgq-backend-test` è stato riavviato. L'estrazione requisiti da disegni (`POST /test-api/api/v1/import-jobs/:id/files/:fileId/ai-extract`, adapter `geminiAdapter.js`) funziona ora anche sull'ambiente test/demo. Verifica: health `healthy` + endpoint che risponde `401` senza auth (registrato).


#### Tabella ambienti (produzione vs test)

| Ambiente | URL frontend | URL backend | DB |
|---|---|---|---|
| **Produzione** (`main`) | `https://systemgest.netlify.app` | `https://sistemi.fr-busato.it:8443/api/v1` | `SGQ_ISO9001` |
| **Test** (Deploy Preview PR) | `https://deploy-preview-NNN--systemgest.netlify.app` | `https://sistemi.fr-busato.it:8443/test-api/api/v1` | `2026-06-18_SGQ_ISO9001` |

La variabile `VITE_API_URL` viene iniettata automaticamente da `netlify.toml` (`[context.deploy-preview.environment]`) — nessuna azione manuale necessaria.

#### Flusso completo test su branch

```
feat/branch → push → gh pr create → [GitHub Actions: smoke DB test] → [Netlify: Deploy Preview → VITE_API_URL=test-api automatico] → test funzionale su URL preview → TEST OK → gh pr merge → deploy produzione (deploy-controllers-to-vps.ps1)
```

#### Comandi rapidi ambiente test

**Regola agente (28/06/2026):** ogni slice backend/DB va resa **operativa su TEST senza chiedere conferma** — migrazione su `2026-06-18_SGQ_ISO9001`, deploy `sgq-backend-test`, restart + health `test-api`. Produzione (`SGQ_ISO9001` + `sgq-backend`) solo dopo TEST OK o merge esplicito su `main`.

```powershell
# Deploy solo TEST (Cloud Agent / bash)
bash backend/scripts/deploy-to-vps-test.sh

# Migrazione solo TEST (dopo scp script + SQL)
# node /tmp/run-migration-114-test-vps.js  (pattern: run-migration-NNN-test-vps.js)
```

```powershell
# Restart istanza test (dopo deploy file backend) - $env:SGQ_SUDO_PASSWORD da backend/config/.ssh-deploy.local.ps1
.\backend\scripts\run-on-vps.ps1 -Command "echo '$env:SGQ_SUDO_PASSWORD' | sudo -S systemctl restart sgq-backend-test"

# Health check test
curl -sk https://sistemi.fr-busato.it:8443/test-api/api/v1/health

# Log istanza test (ultimi 50)
.\backend\scripts\run-on-vps.ps1 -Command "echo '$env:SGQ_SUDO_PASSWORD' | sudo -S journalctl -u sgq-backend-test -n 50 --no-pager"

# Stato servizio test
.\backend\scripts\run-on-vps.ps1 -Command "echo '$env:SGQ_SUDO_PASSWORD' | sudo -S systemctl status sgq-backend-test --no-pager"

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
3. Verifica: `curl -sk https://sistemi.fr-busato.it:8443/test-api/api/v1/health`
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
- **MC-1 (16/08/2026)**: tabelle additive `material_certificates` / `material_certificate_checks` = mig. **149**. FK verso `import_jobs`/`document_registry`/`projects` = `ON DELETE SET NULL`. `import_job_file_id` **senza FK** (SQL Server rifiuta SET NULL su job+file insieme; NO ACTION bloccherebbe `DELETE import_jobs` — Bugbot PR #450). CASCADE solo checks→certificato. Esecuzione: `node /tmp/run-migration-149-vps.js` (prod) o `SGQ_MIGRATION_TARGET=test node /tmp/run-migration-149-vps.js`.
- **MC-2 (17/08/2026)**: KB Markdown in `knowledge/material-compliance/` (copia deploy `backend/data/material-compliance/`). Loader `materialKbLoader.service.js`: hash SHA-256 dei file, soglie EN 10025-2 da tabelle; tubi, apporto, grado non seedato e spessore assente/fuori fascia = skip. Note h/i (C heat) e b (CEV lunghi) nel seed. Niente soglie inventate. PR [#451](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/451).
- **MC-3 (17/08/2026)**: Rule Engine `materialComplianceRuleEngine.service.js` — input JSON + snapshot KB, output `pass|fail|skip` + `checks[]`. Zero LLM. Non imposta `workflow_status=compliant` (solo HITL in MC-4). Più restrittivo vince (ADR-021) da `scope.po|customer|company` iniettato, niente `if (cliente === 'FASSI')`. Migrazione: nessuna (schema 149 basta).
- **EN 10210-1 (17/08/2026)**: NORMA_00027 + estratto [`EN-10210-1-sezioni-cave.md`](reference/EN-10210-1-sezioni-cave.md). Loader valuta hollow a caldo solo se è citata EN 10210. Pagine 24/25/27 del PDF avevano tabelle specchiate: numeri presi dal testo pymupdf, non dalla griglia Markdown.
- **EN 10219-1 (17/08/2026)**: NORMA_00028 + estratto [`EN-10219-1-sezioni-cave.md`](reference/EN-10219-1-sezioni-cave.md). 38 pagine, nessuna ATTENZIONE. Loader valuta hollow a freddo solo se è citata EN 10219. CEV S235JRH = 0,35 (10210: 0,37). Rm a 3 mm = fascia ≥3. Senza citazione 10210 vs 10219 resta skip.

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
| `SMOKE_ENDPOINT` | `sistemi.fr-busato.it:8443` |
| `SMOKE_TOKEN` | stesso valore impostato nel `.env` del VPS |

### Esecuzione manuale con curl

```bash
# Verifica rapida da terminale (Linux/macOS/WSL)
curl -sk -H "X-Smoke-Token: XXX" https://sistemi.fr-busato.it:8443/api/v1/smoke/testdb | python3 -m json.tool

# Atteso se OK:
# { "ok": true, "db": "2026-06-18_SGQ_ISO9001", "checks": { ... }, "errors": [] }
```

### Esecuzione manuale dello script Node

```powershell
# Windows PowerShell (dal root del progetto)
$env:SMOKE_ENDPOINT = "sistemi.fr-busato.it:8443"
$env:SMOKE_TOKEN    = "XXX"
node backend/scripts/smoke-remote.js
```

### Verifica che il workflow CI sia attivo

Il workflow `.github/workflows/smoke-test.yml` si attiva su:
- Push su `main` che toccano `backend/src/**` o `backend/scripts/smoke-remote.js`
- Pull Request verso `main` con le stesse path
- Esecuzione manuale (`workflow_dispatch`) da GitHub Actions UI

### Deploy backend SOLO su TEST + smoke test UAL-1..UAL-4 (24/07/2026)

> Pattern per verificare codice+migrazioni sull'istanza TEST (`sgq-backend-test`, DB `2026-06-18_SGQ_ISO9001`) **senza mai toccare produzione**, prima di decidere il rilascio.

| Script | Ruolo |
|---|---|
| `backend/scripts/deploy-to-vps-test.ps1` | Deploy manifest + restart **solo** `sgq-backend-test.service` su `/var/www/sgq-backend-test` (mai `sgq-backend.service`/produzione). Stesso pattern robusto di restart (sudo -S → sudo -n → fallback fuser+nohup) e verifica PID prima/dopo di `deploy-controllers-to-vps.ps1`, con `$RemoteBase`/`$RemoteService` fissi sul test. |
| `backend/scripts/_smoke-ual.ps1` | Smoke test end-to-end come admin sui 4 flussi UAL (company-access, audit-log, invito email, reset password) contro `https://sistemi.fr-busato.it:8443/test-api/api/v1`. Crea utenti fixture con email uniche (timestamp), verifica ogni step via API reale, pulisce con soft-delete a fine esecuzione. Riavviabile in autonomia (non richiede SMTP reale). |
| `backend/scripts/_smoke-token-helper.js` | Helper Node (`NODE_ENV=test`) usato da `_smoke-ual.ps1` per generare/interrogare token `user_action_tokens` direttamente sul DB test, bypassando l'invio email reale (SMTP test non configurato) mantenendo comunque un test end-to-end reale del consumo token via API. |

**Lezione appresa — output Node misto a log Winston**: quando uno script Node stampa un JSON su `stdout` per essere letto da PowerShell, il logger applicativo (connessione DB, ecc.) inquina lo stesso stream. Soluzione: (a) `console.log(JSON.stringify(x))` **su una sola riga** (mai `null, 2`), (b) lato PowerShell filtrare le righe con un regex tipo `^\s*[\{\[]` e prendere l'ultima come JSON valido, prima di `ConvertFrom-Json`.

**Esito verificato 24/07/2026**: 24/24 controlli OK (vedi tabella dettagliata in `docs/agent-tasks/PLAN_USER_ACCOUNT_LIFECYCLE.md`). Bug corretto prima del deploy: `deploy-manifest.json` mancava `userAudit.service.js` (richiesto da `admin.controller.js`).

### Deploy backend su PRODUZIONE — UAL-1..UAL-4 (24/07/2026)

> Rilascio in produzione (`sgq-backend`, DB `SGQ_ISO9001`) dopo TEST OK. Migrazioni 130/131/132 **già presenti** sul DB produzione (stesso DB fisico di `development`, verificato in `backend/config/database.json`) — nessuna DDL eseguita, solo verifica read-only.

| Script | Ruolo |
|---|---|
| `backend/scripts/verify-ual-schema-production.js` | Verifica read-only (`sys.objects`/`sys.columns`/`sys.check_constraints`) di `user_audit_log`, `user_action_tokens`, `users.pending_activation`, CHECK `CK_user_audit_log_action` — nessuna DDL. Riusabile per verifiche pre-deploy future. |
| `backend/scripts/smoke-ual-production.js` | Smoke test read-only in produzione via `fetch` diretto alle API reali (login admin + `GET /admin/users`, `GET /admin/users/:id/company-access`, `GET /admin/users/:id/audit-log`, `POST /auth/forgot-password` con email inesistente). Nessun utente/token creato. |

**Esito**: schema produzione già completo (nessuna migrazione necessaria) → deploy `deploy-controllers-to-vps.ps1` (176 file, solo `sgq-backend`, `sgq-backend-test` non toccato) → PID cambiato da `85528` a `116291`, health `healthy`, 5/5 smoke check OK (incluso messaggio anti-enumerazione identico per email inesistente).

**Lezione appresa — crash transitorio durante il restart senza `SGQ_SUDO_PASSWORD`**: quando `SGQ_SUDO_PASSWORD` non è configurato, `deploy-controllers-to-vps.ps1` usa il fallback `fuser -k 3000/tcp` + `nohup node src/server.js`. Se il servizio systemd ha `Restart=on-failure`/`always`, la liberazione della porta fa scattare **in parallelo** anche il riavvio automatico di systemd (`ExecStartPre=fuser -k 3000/tcp`), generando una breve corsa critica: il processo di fallback nohup può leggere un file per una frazione di secondo prima che l'ultimo `pscp` lo finisca di scrivere (osservato: `SyntaxError` su `organization.routes.js`, poi il processo nohup viene killato da systemd e il **secondo** avvio — quello reale, gestito da systemd — parte pulito). **Non è un bug del codice deployato**: verificare sempre con `systemctl show sgq-backend --property=MainPID,NRestarts` + `journalctl -u sgq-backend` (il log del servizio reale, non lo stream diretto di `plink`) per distinguere un crash-loop persistente da questo singolo riavvio transitorio innocuo. Per evitarlo in futuro: configurare `SGQ_SUDO_PASSWORD` in `backend/config/.ssh-deploy.local.ps1` così il restart passa sempre dal percorso `systemctl restart` diretto, senza mai liberare la porta manualmente.

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

---

## D bis. Catalogo smoke harness

> Riferimento rapido per l'esecuzione test/smoke del sistema.

| Modulo | Script | Livello |
|--------|--------|---------|
| CI PR frontend | `.github/workflows/ci-app-pr.yml` | L1 |
| Backend test Jest | `npm test` in `backend/` | L1 |
| Build Vite | `node node_modules/vite/bin/vite.js build` in `app/` | L1 |
| Vitest frontend | `node node_modules/vitest/vitest.mjs run` in `app/` | L1 |
| Smoke workflow | `.github/workflows/smoke-test.yml` | L2 |
| Smoke UI percorsi critici (login, NC, Qualifiche, SAL, WPS/WPQR) | `backend/scripts/smoke-percorsi-critici.mjs` (`SGQ_APP_*`; `SGQ_SMOKE_PATHS` per filtrare) | L3 |
| Ingest E2E | `backend/scripts/smoke-ingest-e2e-test.js` | L3 |
| VPS preflight | `backend/scripts/vps-preflight.ps1` | ops |
| Netlify preflight | `backend/scripts/netlify-preflight.ps1` | ops |
| Deploy backend VPS (produzione) | `backend/scripts/deploy-controllers-to-vps.ps1` | ops |
| Deploy backend VPS (SOLO test) | `backend/scripts/deploy-to-vps-test.ps1` | ops |
| Smoke UAL-1..UAL-4 (ambiente test) | `backend/scripts/_smoke-ual.ps1` | L3 |
| Smoke UI ERAM (WPQR + visione P3/P4/P5) | `backend/scripts/smoke-eram-coverage-ui.js` (JWT mint VPS org 1004; Playwright) | L3 |
| Checklist stampabile smoke copertura | `docs/testing/SMOKE_COPERTURA_WPQR_VISIONE_CHECKLIST.md` + `.docx` (`node backend/scripts/generate-smoke-checklist-docx.mjs`) | L3/ops |
| Encoding check | `node backend/scripts/check-utf8-encoding.js [file]` | qualità |

**Nota ERAM (04/08/2026):** `SGQ_APP_*` è admin org 1001 (senza NDT) → per smoke UI tenant ERAM mintare JWT di `mauro.franciosi@eram-technologies.com` sul VPS. Il pannello **Verifica Copertura Saldatori** (advisory WPQR/visione) è sul **dettaglio riesame in ogni stato**, non solo `APPROVED`. Eseguire lo smoke su **produzione** (`systemgest.netlify.app` → API prod): il Deploy Preview punta a `test-api` dove mancano NDT La Forgia e l’endpoint `vision-fitness-gaps`. Smoke OK 04/08/2026: 9/9 su prod (`node backend/scripts/smoke-eram-coverage-ui.js`).


## E. Flusso 2 — SAL / Sopralluoghi + Evidenze documentali + Import + RAG (retrieval)

Questa sezione consolida le decisioni operative per supportare **due flussi** coerenti nello stesso prodotto, senza perdere scalabilità/robustezza:

- **Flusso 1 — Audit di sistema**: checklist, esiti (C/NC/OSS/OM/NA/NV), pending issues, report Word.
- **Flusso 2 — SAL/Sopralluoghi**: avanzamento implementazione requisiti (es. ISO 9001/14001/45001) + evidenze documentali + stati (discusso/in corso/da validare/completato).

**Fase 0 backend (01/07/2026 — completata)**: motore dati `requirement_implementation_status` (mig. 117) con seed idempotente macro-clausole N.N; API sotto `/api/v1/companies/:companyId/gap-matrix` e `/gap-statuses` (licenza `sal`).

**Fase 1 UI (01/07/2026 — completata)**: route `/sal` → `SALModule.jsx` (griglia requisiti × stati, ambito azienda, seed).

**Fase 2 export + evidenze (02/07/2026 — completata)**: export Word SAL (`wordExportSal.js`), storico revisioni in modal, evidenze collegate al Registro Documenti (`SalEvidenceSection` + validazione backend su `document_registry`).

**Fase 3 integrazioni audit/NC (02/07/2026)**: `conformity_hint` sincronizzato da ultimo audit completato (`POST .../sync-audit-hints`); azioni Piano Azioni con `source_category='sal_gap'` (mig. 118).

**Fase 4 feed Riesame (02/07/2026)**: widget copertura normativa del Riesame §9.3 legge la matrice SAL per azienda (`norm_coverage_source=sal`).

**Fase 5-A/5-B AI SAL (07–18/07/2026 — completate)**: suggeritore stato da evidenze (human-in-the-loop) + asse conformità legislativa (`linked_legislation`, ingest Normattiva, capability `SAL_LEGAL_CONFORMITY`). Prossimo opzionale: Fase 5-C (assistente AI Riesame §9.3); smoke L3 consigliato su `/sal`.

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

