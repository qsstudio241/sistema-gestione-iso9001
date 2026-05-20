# Archivio sessioni — Marzo/Aprile 2026

> File di archivio generato automaticamente il 20/05/2026. Contiene le sessioni narrative da marzo-aprile 2026 spostate dalla GUIDA_CONSOLIDATA per ridurne le dimensioni. Consultare solo per riferimento storico.

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
