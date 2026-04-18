# Session Notes – 01 marzo 2026 (aggiornato 07/03/2026)

**Branch**: `main` | **Deploy**: Netlify live `https://systemgest.netlify.app` | **Commit**: `vedi sotto`

---

## 📌 PUNTO DI RIPRESA — PROSSIMA SESSIONE

**Stato**: ✅ Deploy completato. Fix sommario Word e layout checklist applicati.

**Prossime priorità:**

1. **Test export Word** su `https://systemgest.netlify.app` con audit ERAM:
   - Verificare sommario completo (cap. 1, 2, 3, 3.1, 4→10, 11)
   - Verificare margini stretti e larghezze colonne checklist
   - Verificare campo VERIFICATORE valorizzato

2. **Decisione architetturale discussa** — prossimi sviluppi concordati:
   - ISO 14001: duplicare struttura 9001 con checklist da norma PDF ✅ norma disponibile
   - ISO 45001: stessa cosa ✅ norma disponibile
   - Modulo SAL (Stato Avanzamento Lavori): nuovo tipo documento per Camellini
   - Modulo RDP (Rapporto di Prova): nuovo tipo documento per Mason/ISO 3834

3. **Logo azienda** (non ancora testato su produzione):
   - Aprire Anagrafica Aziende → caricare logo → verificare thumbnail

4. **Pagina Admin** (priorità bassa): UI gestione utenti

---

## ✅ Completato – sessione 07/03/2026 (fix Word: sommario, layout, auditor)

### Fix report Word ISO 9001 — tutti completati e deployati

**Commit**: `e2ad5b8` + successivo — deploy Netlify attivo

#### W2 — Sommario Word incompleto (solo cap. 1, 2, 11)
- **Causa**: Il template Word è in italiano → stili `Titolo1`/`Titolo2`, non `Heading1`/`Heading2`
- **Fix**: Cambiate tutte le `style: 'Heading2'` in `style: 'Titolo1'` (capitoli 3–10) e `Titolo2` per sottocapitoli
- **Risultato atteso**: Sommario mostra tutti i capitoli 1→11 più sottocapitoli
- **File**: `app/src/utils/wordExportHelpers.js`

#### W3 — Sezione 1.4 Rilievi Ente posizionata dopo cap. 3
- **Fix**: Rinumerata come cap. **3.1** (sottocapitolo di 3 – Rilievi Pendenti), con stile `Titolo2`
- **File**: `app/src/utils/wordExportHelpers.js`

#### W4 — VERIFICATORE sempre "N/D"
- **Causa**: `wordExport.js` leggeva `meta.auditor` ma il campo si chiama `meta.auditorName`
- **Fix**: `auditor: meta.auditorName || meta.auditors?.[0] || meta.auditor || 'N/D'`
- **File**: `app/src/utils/wordExport.js`

#### W5 — Larghezze colonne checklist e margini pagina
- **Fix colonne**: Passate da percentuale approssimativa a **DXA esatti**:
  - Col 1 "Attività/processo": **3.70 cm** = 2098 DXA
  - Col 2 "Valutazione": **2.70 cm** = 1531 DXA
  - Col 3 "Dettaglio": **12.07 cm** = 6844 DXA
- **Fix margini**: Impostati **margini stretti (1.27 cm = 720 DXA)** direttamente via JS
  (regex su `sectPr` in `injectOoxmlMarkers` — evita manipolazione binaria del template)
- **File**: `app/src/utils/wordExportHelpers.js`, `app/src/utils/wordExport.js`

#### Fix backend — Endpoint rilievi certificatore non trovato
- **Causa**: Due percorsi errati nei nuovi file: `../middleware/auth` → `../middleware/auth.middleware`
  e `../db/connection` → `../config/database`
- **Fix**: Corretti entrambi i `require()` e backend riavviato
- **File**: `backend/src/routes/certificationFindings.routes.js`, `backend/src/controllers/certificationFindings.controller.js`

### Discussione architetturale
- Analizzati 4 scenari d'uso: audit sistema, audit terza parte, consulenza/SAL, rapporti di prova
- Caricate normative PDF: ISO 14001, ISO 45001, ISO 3834-1/3/5 (leggibili dal tool)
- Definita roadmap per prossime fasi (vedi PUNTO DI RIPRESA)

---

## ✅ Completato – sessione 06/03/2026 (fix auditor + deploy)

### Fix segnalati dall'auditor dopo test — tutti risolti e deployati

**Commit**: `29fd421` — deploy Netlify + backend riavviato

#### B1 — Barra spaziatrice non funzionante nel campo Note
- **Causa**: `value.trim()` applicato ad ogni keystroke in `ChecklistModule.jsx` → spazi rimossi in tempo reale
- **Fix**: rimosso `trim()` dall'aggiornamento live; limite lunghezza 5000 char mantenuto
- **File**: `app/src/components/ChecklistModule.jsx`

#### B2+B3 — Nessun modo di uscire dall'audit / salvataggio non visibile
- **Fix B2**: pulsante **"← Lista Audit"** nell'header di ogni audit → torna alla selezione
- **Fix B3**: indicatore stato salvataggio: `⏳ Salvataggio...` / `✓ Salvato` / `● In attesa`
- **File**: `AuditAccordionLayout.jsx` + `AuditAccordionLayout.css` + `Dashboard.jsx` + `StorageContext.jsx`
- **Dettaglio**: aggiunto `deselectAudit: () => setCurrentAuditId(null)` nel context; passato come `onBack` all'accordion

#### C1-C4 — Struttura checklist ISO 9001 non corrispondente al documento originale
Verificato contro il file originale: `Check List Audit/Report Audit Sistema Gestione ISO 9001_Quesiti.docx`

| Problema | Soluzione |
|---|---|
| Numerazione auto 5.1→5.4 invece di 5.1, 5.2.1, 5.2.2, 5.3 | Aggiunti clauseRef espliciti nel template |
| Numerazione auto 7.1→7.9 invece di 7.1.2→7.1.5.2, 7.2→7.5 | Aggiunti clauseRef espliciti nel template |
| 8.2.2 invece di 8.2 / 8.4 invece di 8.4.1 / 8.7 invece di 8.7.2 | Corretti clauseRef |
| 9.1 invece di 9.1.1 / 9.2 invece di 9.2.2 / 9.3 invece di 9.3.3 | Corretti clauseRef |
| 3 domande aggiunte in eccesso (6.3, 7.1.1, 7.1.6) non nel documento originale | `is_active=0` nel DB (IDs 191, 192, 193) |

**Totale domande ISO 9001 attive nel DB: 35** ✅ (stesso numero del documento originale)

- **File DB**: migration scripts in `backend/scripts/run-migration-022.js`, `fix-display-orders.js`
- **File frontend**: `app/src/data/checklistTemplates.js` — tutte le 35 domande con `clauseRef` esplicito
- **File context**: `StorageContext.jsx` — usa `q.clauseRef` dal template invece di auto-generarlo

#### W1 — Titoli sezioni nel Word saltavano da sezione 2 a sezione 11 nel sommario
- **Causa**: i titoli delle clausole 4→10 iniettati come semplici paragrafi non appaiono nel TOC Word
- **Fix**: i titoli usano ora lo stile `Heading2` (`<w:pStyle w:val="Heading2"/>`) → visibili nel sommario
- **Effetto aggiuntivo**: ogni clausola inizia su una nuova pagina (page break before heading)
- **File**: `app/src/utils/wordExportHelpers.js` — `xmlPara` supporta nuovo parametro `style`; `buildChecklistSectionOoxml` usa `{ style: 'Heading2' }`

---

## ✅ Completato – sessione ISO 3834 (questa sessione)

### ISO 3834-2 — Completato in due fasi

**Sessione precedente (DB):**
- Standard `ISO_3834_2` inserito (`standard_id = 6`)
- 4 sezioni + 22 domande nel DB (migration 021)
- `companies.logo_url NVARCHAR(500) NULL`

**Questa sessione (Backend + Frontend + Template):**

| Componente | File | Descrizione |
|---|---|---|
| Backend | `company.controller.js` | +`uploadLogo`, `getLogo`, `deleteLogo`; `logo_url` in tutte le SELECT |
| Backend | `company.routes.js` | +`POST/GET/DELETE /companies/:id/logo` con multer immagini |
| Frontend | `apiService.js` | +`uploadCompanyLogo`, `deleteCompanyLogo`, `getCompanyLogoUrl` |
| Frontend | `CompaniesPage.jsx` | Logo thumbnail in lista + upload nel modal |
| Frontend | `ExportPanel.jsx` | Dialog scelta foto (link / anteprima+link) prima del Word export |
| Helpers | `wordExport.js` | `photoMode` option + `preloadImagesIntoAudit` + `embedImagesInZip` |
| Helpers | `wordExportHelpers.js` | `buildClauseTableOoxml` con embedded OOXML per immagini |
| Template | `ISO3834-audit-report.docx` | Generato da `generateTemplate3834.js` |
| Mappa | `wordExport.js` `TEMPLATE_MAP` | `ISO_3834_2` → `ISO3834-audit-report.docx` |

**Fonte del template:** File `RDP_MSN-260127-01_REV_0.docx` (Mason Srl) — analizzato, 22 domande estratte.

---

## ✅ Completato – sessione 04/03 (stato stabile e robusto)

### Dev locale + Server come fonte di verità

| Modifica | Descrizione |
|---|---|
| **Proxy Vite** | `/api/v1` → backend remoto; evita CORS in sviluppo |
| **Service Worker** | Disabilitato su localhost; bypass richieste `/api/` nel SW |
| **Server-wins** | Cache IndexedDB sostituita completamente ad ogni download server |
| **IndexedDBProvider** | Nuovo `clearAuditsStore()` per sostituzione cache |

### Best practice implementate
- **Fonte di verità**: DB server quando online; cache locale solo per offline
- **Cambio device**: dati sempre aggiornati dal DB
- **Dev senza CORS**: proxy Vite su localhost:5173

### Script di verifica
- `backend/scripts/verify-fase1.js` — API + DB Fase 1
- `backend/scripts/verify-audit-2026-02.js` — dati audit e risposte

### Commit
| Hash | Descrizione |
|---|---|
| `7daf871` | feat: server come fonte di verità + dev locale robusto |

---

## ✅ Completato in questa sessione

### Bug fix & funzionalità

| Commit | Descrizione |
|---|---|
| `ca0dc93` | Bottone **NV** aggiunto alla checklist (viola `#6a1b9a`) |
| `176620d` | OM escluso dai rilievi pendenti; sezione nascosta su nuovo audit; lista read-only |
| `f6ff93a` | `PendingIssuesCascade` fetch live da API (era mock) |
| `a298190` | Fix errore 500: `clause_number` → `section_code` (colonna inesistente) |
| `2fbf717` | Note sempre visibili nei rilievi (con placeholder se vuote) |
| `8630c3b` | Gestione allegati completa: upload → refresh preview, replace desktop, cache-bust |
| `fb6e3fe` | Fix auth allegati: sostituisce `?token=` in URL con `fetch + blob` (token mancante cross-origin) |
| `62fe79f` | Refactor preview: banner cliccabili lazy (nessuna thumbnail), blob fetch al click |
| `0825d0c` | Fix doppio banner + Office Online Viewer per Word/Excel |
| `72bb07e` | Rimozione Office Online Viewer (porta 8443 non raggiungibile da Microsoft) |

### Architettura allegati (definitiva)

| Tipo file | Azione | Comportamento |
|---|---|---|
| Immagini (jpg/png/webp/gif) | ↗ Apri | `fetch blob` → `URL.createObjectURL` → nuova scheda. Blob in RAM, revocato dopo 10s |
| PDF | ↗ Apri | Idem |
| Testo / CSV | ↗ Apri | Idem |
| Word / Excel / PPT | ⬇ Scarica | `fetch blob` → `<a download>` → cartella Downloads browser |
| Replace | ✏️ (desktop-only) | `PUT /api/v1/attachments/:id/replace` → elimina file vecchio su disco, aggiorna DB |
| Delete | ✕ | `DELETE /api/v1/attachments/:id` → elimina da DB e disco |

### Doppio banner: fix
`AttachmentSection` ora mostra **solo** i file `pendingSync: true` o senza `serverAttachmentId`.
I file già confermati sul server appaiono solo in `AttachmentPreview`.

### Nota su Office Online Viewer
`view.officeapps.live.com` non raggiunge server su porta non-standard (8443).
**Alternativa futura**: configurare Nginx per esporre backend anche su 443.

---

## ✅ Completato – seconda parte 01/03 (pomeriggio)

### Analisi e fix flag selezione standard

Analisi flusso completo dei flag ISO sul codice → trovati e corretti **4 bug**:

| Commit | Descrizione |
|---|---|
| `9894ed5` | **Fix 4 bug standard selection** (vedi dettaglio sotto) |
| `5fec508` | `docs: MANUALE_UTENTE.md` v1.1 creato con flusso verificato |

#### Bug corretti (commit `9894ed5`)

| # | File | Bug | Fix |
|---|---|---|---|
| 1 | `AuditSelector.jsx` | `formData.norms` (array norme modal) non veniva mappato a `selectedStandards` → nuovi audit sempre con solo ISO 9001 indipendentemente dalla selezione | Aggiunto `submitData.selectedStandards = formData.norms` nel `handleSubmit` |
| 2 | `AuditAccordionLayout.jsx` | Accordion ISO 14001/45001 usava `includes("ISO_14001")` ma `GeneralDataSection` salva `"ISO_14001_2015"` → tab checklist non visibile dopo selezione da Dati Generali 1.1 | Sostituito con `.some(s => s === "ISO_14001" || s === "ISO_14001_2015")` (stesso pattern già usato per ISO 9001) |
| 3 | `auditConverter.js` `backendToFrontend` | Restituiva `['ISO_9001_2015']` (formato con anno) mentre modal e checklist usano `'ISO_9001'` → inconsistenza formato; non sfruttava il campo `standards` (comma-separated da junction table) | Normalizzazione a formato canonico senza anno; ora usa `backendAudit.standards` per multi-standard reale, con fallback su `standard_id` |
| 4 | `syncService.js` `syncUpsertAudit` | Inviava `standard_ids: ["ISO_9001"]` (array di stringhe) mentre `/audits/sync` legge `standard_id: 1` (intero singolo) → ISO 14001 non persistito sul server | Aggiunta funzione `resolveStandardId()` che converte codice stringa → intero; ora invia `standard_id: 2` per ISO 14001 |

#### Note architetturali emerse

- `checklist_sections.section_code` è `VARCHAR(10)` → max 10 caratteri (usare `14001_s4`, non `iso14001_s4`)
- Il backend `/audits/sync` (upsert) usa `standard_id` singolo (non array). Il backend `/audits` (create) usa `standard_ids[]`. I due endpoint hanno interfaccia diversa — da allineare in futuro.
- `auditConverter.js` ora legge il campo `standards` (CSV dal JOIN `audit_standards`) che il backend già restituisce in `listAudits`
- `ChecklistModule.normalizeChecklistKey()` gestisce già correttamente i codici con anno (`ISO_9001_2015 → ISO_9001`) — non modificato

#### Manuale utente

Creato `docs/MANUALE_UTENTE.md` (v1.1) con:
- Flusso completo login → export, ogni passo verificato sulla codebase reale
- Richiami al codice sorgente per punti architetturali critici
- §11 Limitazioni note + backlog (aggiornare ad ogni release)
- §12 Changelog funzionalità (tabella da mantenere)

---

## 🔲 Prossimi step (priorità 2 roadmap)

### 1. Test end-to-end su Netlify (prossima sessione)
Verificare che i fix del commit `9894ed5` funzionino end-to-end su deploy produzione:
- [ ] Creare audit con ISO 9001 + ISO 14001 selezionati dal modal → verificare `selectedStandards` nel metadata
- [ ] Verificare che accordeon Checklist mostri entrambi i tab
- [ ] Verificare che la sync invii `standard_id: 2` al server per ISO 14001
- [ ] Riaprire l'audit (da IndexedDB) → risposte checklist ISO 14001 ripristinate
- [ ] Modificare standard da Dati Generali 1.1 → tab checklist aggiornato in tempo reale

### 2. Export Word ISO 14001 (priorità alta, backlog §L1)
Il report `.docx` include solo ISO 9001. Aggiungere sezione ISO 14001.

**Task frontend** (`wordExport.js` / `ExportPanel.jsx`):
- [ ] Identificare funzione che costruisce la sezione checklist nel Word
- [ ] Aggiungere sezione ISO 14001 con stessa struttura (46 domande → riepilogo NC/OSS/OM)

### 3. Allineamento backend `/audits` vs `/audits/sync`
- [ ] `/audits` (create) usa `standard_ids: number[]`
- [ ] `/audits/sync` (upsert) usa `standard_id: number` singolo
- [ ] Valutare se allineare `/audits/sync` ad array (migration + ALTER colonna journal)

### 4. Multi-standard backend: junction table `audit_standards`
Il campo `audits.standard_id` è legacy. Gli audit con più norme sono gestiti via `audit_standards` (già presente). La colonna `standard_id` su `audits` è ridondante ma ancora usata.
- [ ] ADR per deprecazione `audits.standard_id` → solo `audit_standards`

### 5. Report Word (priorità alta)
- [ ] Verificare se `docx` è in `backend/package.json`
- [ ] Sezione "Export Report" già visibile in UI → collegare a `apiService.getWordReport(auditId)`

### 6. Allegati su porta 443 (bassa priorità, sblocca Office Online)
- [ ] Configurare Nginx per proxy su 443 → localhost:3000 (aggiuntivo a 8443)

### Fase 1 Multi-Tenant – Commit recenti
| Commit | Descrizione |
|---|---|
| `cc78b86` | Fix migration 020 (batch separati, `[plan]` SQL Server) |
| `b853d05` | feat(fase1) RBAC + endpoint CRUD companies e auditor-orgs |
| `758b216` | feat(fase1) integrazione CompaniesPage in app con navigazione Anagrafica Aziende |

### Verifica audit 2026-02 (04/03)
- **DB**: 81 risposte in `audit_responses` per audit_id 4914
- **API**: GET /audits/4914/responses restituisce 81 risposte correttamente
- **Locale e Netlify**: usano lo stesso backend e DB — dati identici

### Server come fonte di verità (04/03)
- **Fix cache obsoleta**: quando il download dal server ha successo, la cache IndexedDB viene **sostituita completamente** con i dati server
- **Cambio device**: i dati provengono sempre dal DB — nessuna cache locale obsoleta
- **IndexedDBProvider**: nuovo metodo `clearAuditsStore()` per svuotare la cache prima di salvare i dati server

### 7. Fase 1 Multi-Tenant – Completato ✅
- [x] Migration 020: `auditor_orgs`, `companies`, `user_org_roles`, `subscriptions`; colonne `users.auditor_org_id`, `audits.company_id`
- [x] Backend: RBAC, CRUD companies, list/get auditor_orgs; `auditor_org_id` in JWT e login
- [x] Frontend: `CompaniesPage` con lista/crea/modifica/elimina aziende; navigazione "🏢 Anagrafica Aziende" in header
- [x] Integrazione audit → company: selettore azienda nel modal creazione audit; backend upsert con `company_id`; `auditConverter` e `auditDataModel` con `companyId`

### 8. Anagrafica / RBAC (backlog futuro)
- [ ] `client_name` attualmente stringa libera → diventerà FK verso tabella `companies`
- [ ] Ruoli editor/viewer per auditor org

---

## 📌 Decisioni architetturali prese

| Decisione | Motivazione |
|---|---|
| Una sola app (no split frontend/backend separati) | Semplicità operativa PMI |
| `client_name` stabile come chiave | Diventerà FK quando faremo anagrafica |
| `conformity_status`: `C, NC, OSS, OM, NA, NV` | CHECK constraint fisso in DB |
| Pending issues trigger: `NC, OSS, NV` (OM escluso) | OM = Osservazione minore, non rilievo persistente |
| Blob URL per allegati (no token in URL) | token in query-string non inviato su img/a cross-origin |
| Server-wins su campi critici (stato audit, firme) | ISO 9001:2015 §7.5 tracciabilità |
| Merge su note/evidenze in conflitto | Supporto offline-first |

---

## 🔑 Riferimenti tecnici

```
Server SSH:   ssh spascarella@www.fr-busato.it -p 1122 (password: solo vault, non in repo)
Backend:      /var/www/sgq-backend/  porta 3000
API base:     https://www.fr-busato.it:8443/api/v1
Frontend:     https://systemgest.netlify.app
DB:           SGQ_ISO9001 @ www.fr-busato.it,11043

Restart backend (3 comandi separati):
  fuser -k 3000/tcp
  sleep 2 && cd /var/www/sgq-backend && nohup node src/server.js > /var/www/sgq-backend/app.log 2>&1 &
  sleep 4 && cat /var/www/sgq-backend/app.log

Upload file:
  # Non usare -pw in documentazione: usare chiave SSH o sessione PuTTY salvata (vedi deploy-controllers-to-vps.ps1)
  pscp -P 1122 … "localfile" spascarella@www.fr-busato.it:/var/www/sgq-backend/path/

checklist_questions colonne:
  question_id, question_uuid, section_code, question_text,
  question_type, display_order, is_mandatory, is_active,
  created_at, updated_at, standard_id
  (NON esiste clause_number né requirement_reference)
```
