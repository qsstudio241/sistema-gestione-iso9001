# Guida Consolidata — Diario sessioni 2026

> **Archivio**: sessioni estratte da `GUIDA_CONSOLIDATA.md` il 30/06/2026.  
> Lezioni consolidate e procedure: [docs/GUIDA_CONSOLIDATA.md](../GUIDA_CONSOLIDATA.md).

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

#### Note checklist senza esito — sync dettatura (25/06/2026)
**Sintomo**: audit FP Modena QS-260611-01 — allegati su punti 7.1.5.1/7.1.5.2 salvati, note dettate vuote al refresh. **Causa**: `extractChecklistResponses` e `enqueueResponseEvent` sincronizzavano solo domande con status ≠ `NOT_ANSWERED`; dettatura prima del click C/NC/OSS non arrivava al server. **Diagnosi DB**: zero righe `audit_responses` e zero eventi `response_set` per `question_id` 100/101; 5 allegati presenti. **Fix** PR **#166**: sync note anche con `conformity_status: null`; eventi T3 anche su cambio campo `notes`; `response_cleared` solo se status e note entrambi assenti. **Recupero dati**: testo già perso non recuperabile — ricompilazione manuale. **Workflow CI**: smoke DB attivato anche su PR `app/**` (prima bloccava merge frontend-only).

#### Errori console systemgest — AI feedback, NC alerts, validazione (27/06/2026)
**Sintomi** su `systemgest.netlify.app`: `POST /ai/feedback` 500; `POST /notifications-config/run-nc-alerts` 400 (anteprima); `Schema validation errors` al logout; `Domanda q3834_s1_3` su click NC/OSS.

| Errore | Causa | Fix (PR **#172**) |
|---|---|---|
| `ai/feedback` 500 | `req.user.id` assente nel JWT (`user_id` è il campo corretto) | `aiAssist.controller.js`: `req.user.user_id \|\| req.user.id`; hotfix VPS stesso giorno |
| `run-nc-alerts` 400 | UI abilitava anteprima con toggle locali non salvati su `notifications_config` | `NotificationsSettingsPage`: pulsanti solo se `config.exists` + toggle attivi |
| Schema validation al logout | `validateAuditSchema` durante reset sessione | `StorageContext`: skip warn se `sessionResetInProgressRef` |
| `q3834_s1_3` warn | `validateQuestion` su click NC/OSS prima che l'utente compili le note | Rimosso `console.warn` prematuro in `ChecklistModule` (validazione a chiusura audit) |

**Verifica**: build app OK; health API VPS OK; tabella `ai_feedback` presente.

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

## Idee e sviluppi futuri (ex § E bis)

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
| DB test | Migration 099: tabella `management_reviews` (25 colonne alla creazione; 30 dopo migrazioni 110/112 — verificato su `INFORMATION_SCHEMA.COLUMNS`), numerazione `RD-YYYY-NNN`; smoke-testdb OK |
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

### Sessione 24/06/2026 — Riesame di Direzione §9.3: gap G3 (input c.5), G2 (export Word), G1 (link Piano Azioni), G6

Lavoro coerente su tre gap correlati che toccano gli stessi file (eseguiti in sequenza, non da agenti separati).

| Gap | Contenuto | File chiave | Stato |
|-----|-----------|-------------|-------|
| **G3** | Aggiunto input §9.3.2 **c.5 Risultati di monitoraggio e misurazione** (`input_monitoring`). Gli altri campi normativi (b, c.1, c.3, e) erano già presenti da migration 110. | Migration **112** (vps+local), `managementReviews.controller.js`, `ManagementReviewsPage.jsx`, `wordExportReview.js`, `generateManagementReviewTemplate.js` + template `.docx` | **Migration 112 applicata su DB produzione** (colonna presente). Frontend in `main`. Backend controller **da deployare su VPS**. |
| **G2** | Export Word verbale §9.3 — **già implementato** in PR #156 (`exportManagementReviewDocx`, pulsante 📋 nella lista). Esteso col nuovo segnaposto `{input_monitoring}`. | `wordExportReview.js`, template | **Già in produzione**; esteso. |
| **G1** | Collegamento output §9.3.3 → **Piano Azioni**: colonna `non_conformities.management_review_id` + FK + indice (migration **113**). Pulsante "Crea azioni dagli output" nella sezione §9.3.3 (solo su riesame salvato) che apre `NcCreateModal` precompilato e collegato al riesame (categoria `management_review`). | Migration **113** (vps+local), `nc.controller.js`, `ncCreateHelpers.js`, `NcCreateModal.jsx`, `ManagementReviewsPage.jsx` | **Migration 113 applicata su DB produzione**. Frontend in `main`. Backend `nc.controller` **da deployare su VPS**. |
| **G6** | Bug fix: la query obiettivi in `generateDraft`/`generateOutputs` non filtrava per `company_id` (a differenza di `getInputSummary`). Ora allineata. | `managementReviews.controller.js` | In `main`. |
| **G5** | Test L1: Vitest frontend (`managementReviews.test.jsx`, `managementReviewDraft.test.jsx`, `participantsList.test.jsx`) + **test backend Jest `managementReviews.controller.test.js`** su `getInputSummary` (7 casi: aggregazione, filtro `company_id`, scope `organization_id`, errori per-blocco, guard RBAC). | `app/src/tests/*`, `backend/src/controllers/managementReviews.controller.test.js` | In `main` — 7/7 verde. |

**Lezione (delta):** il task ipotizzava 4 campi G3 mancanti, ma la verifica diretta sul DB di produzione (`INFORMATION_SCHEMA.COLUMNS`) ha mostrato che 3 erano già presenti (migration 110) e l'export Word (G2) era già in produzione. Applicata la regola "VERIFICA PRIMA DI AGIRE": implementato **solo** ciò che mancava davvero (`input_monitoring` + link Piano Azioni), evitando duplicazioni.

**Migrazioni DB da Windows:** nuovo pattern `run-migration-NNN-local.js` che usa `backend/config/database.json` (profilo `production` di default) via `mergeDbEnv` — esegue le ALTER idempotenti direttamente sul DB di produzione senza passare dal VPS. Le versioni `-vps.js` restano come artefatto canonico/riproducibile per deploy via `run-on-vps.ps1`.

**Stato finale sessione:** controller backend (`managementReviews.controller.js`, `nc.controller.js`) **deployati su VPS** con restart `sgq-backend` (verifica PID) e smoke health 200; migrazioni 112/113 applicate in produzione; frontend live su `main`. Gap G1, G2, G3, G5, G6 chiusi.

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
