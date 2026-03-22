# Guida consolidata — SGQ ISO 9001

> **Unico documento di esperienza operativa** da aggiornare quando cambia il comportamento del sistema (deploy, Word, DB, sync).  
> **Non creare** nuovi `SESSION_NOTES_YYYYMMDD.md`: si aggiorna questo file + `PROJECT_ROADMAP.md`.

## Cosa leggere a inizio sessione (ordine)

1. **[../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)** — stack, infra, workflow.  
2. **[PROJECT_ROADMAP.md](PROJECT_ROADMAP.md)** — fasi e backlog.  
3. **Questo file** — lezioni apprese e procedure ripetibili.  
4. **[DATABASE.md](DATABASE.md)** — connessione DB, script repro, ambienti `development` / `test`.  
5. Per deploy: [DEPLOY_CHECKLIST_RELEASE.md](DEPLOY_CHECKLIST_RELEASE.md), [DEPLOY_TROUBLESHOOTING.md](DEPLOY_TROUBLESHOOTING.md).

**Storico sessioni** (feb–mar 2026): cartella [archive/sessions/](archive/sessions/) — solo consultazione, non aggiornare.

---

## A. Checklist custom, sync, deploy VPS

| Problema | Causa / fix |
|----------|-------------|
| Dati custom persi al reload | Local-first + merge in `StorageContext` / `CustomChecklistAuditView`; sync su `syncService`. |
| `PUT custom-checklist-responses` 404 | Backend VPS senza route aggiornate o Node non riavviato; copiare anche **services** richiesti dai controller. |
| 401 senza token / 404 con token | Route assente dopo auth; allineare file + `systemctl restart`. |
| `MODULE_NOT_FOUND` sul VPS | Copiare tutti i `require` (es. `auditMaintenance.service.js`, `customChecklist.service.js`, `reportTemplate.service.js`). |
| Word senza dati custom | `ExportPanel`: merge `currentAudit.customResponses` + server prima di `exportAuditToWord` (server non vuoto vince). |
| Regressione verso ISO 9001 su audit custom | Preservare `custom_checklist_id` in update; `syncService` / `upsertAudit` non distruttivi — vedi commit `ac5d981` e hardening successivi. |
| Due utenti sullo stesso audit / conflitti salvataggio | **Lock pessimistico server** (tab. `audit_locks`, migrazione `027_audit_locks.sql`). Frontend: `StorageContext` + header `X-Audit-Lock-Token` via `apiService`; banner `AuditLockBanner.jsx`. Deploy: eseguire migrazione DB + aggiornare backend (`auditLock.service.js`, controller, route) + `systemctl restart`. |
| `DELETE /audits/:id` fallisce su ambienti legacy (`Invalid column name 'audit_id'`) | Risolto con hardening `auditMaintenance.service.js`: delete dinamici guidati da metadati `INFORMATION_SCHEMA.COLUMNS` (solo tabelle/colonne presenti), poi delete finale su `audits`. Strategia da riusare per compatibilita' cross-schema. |

**Deploy**: non copiare solo i controller; verificare `systemctl status sgq-backend.service`. Dettaglio: `DEPLOY_CHECKLIST_RELEASE.md`, script `deploy-controllers-to-vps.ps1`. Dopo release lock: copiare anche `services/auditLock.service.js` e `controllers/auditLock.controller.js`.

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

_Test operativo Deploy Preview (mar 2026): branch `chore/verify-netlify-preview` — PR di prova verso `main`; rimuovere questa riga dopo verifica OK._

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

## E. Punto di ripresa / idee

- [ ] ADR-006 (auto-reconcile cache) se non avviato.  
- [ ] `DATABASE.md` / `database.json` contengono segreti: non duplicare in chat; ruotare se esposti.  
- [ ] Opzionale: `ExecStartPre` systemd non bloccante (vedi note deploy).

---

## File spesso toccati (Word + export)

`wordExport.js`, `wordExportHelpers.js`, `ExportPanel.jsx`, template Verbale in `public/templates/`, `repro-custom-export.mjs`.

---

*Regola per l’AI: aggiornare **questo file** invece di aggiungere `SESSION_NOTES_*.md`. Memoria sintetica anche in `.cursor/rules/sgq-operating-memory.mdc`.*

---

**Cursor — regola utente**: se nelle impostazioni è ancora scritto “leggi `SESSION_NOTES_20260301`”, sostituiscilo con **`docs/GUIDA_CONSOLIDATA.md`**.
