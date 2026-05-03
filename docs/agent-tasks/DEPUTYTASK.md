# DEPUTYTASK — Refactoring strutturale + storicizzazione custom checklist

> **Data**: 03/05/2026  
> **Autore**: Lead Agent  
> **Tipo**: Refactoring + Fix funzionale + Migration DB  
> **Priorità**: P0 critico (bug) → P1 DB → P2 modularità  
> **Chiusura attesa**: TEST OK oppure FIX NON APPLICABILI per ciascuna fase

---

## Analisi eseguita

Il Lead Agent ha analizzato l'intero codebase frontend (`app/src/`) e backend per verificare la corretta applicazione dei pattern architetturali (modularità, storicizzazione, riuso componenti). Risultato:

| Area | Stato |
|------|-------|
| **Gestione documentale** (DocumentRegistry, ImportJobsPage Sprint 10) | ✅ Implementata e funzionale — expiry_date, tab Priorità/scadenze, flusso import → staging → registry completato |
| **Scadenziari** (QualificationsPage, alertScheduler, alert.routes) | ✅ Implementati — semaforo UI, cron job email, API `/alerts` e `/alerts/count` presenti |
| **Temporal tables** (audit_responses, audits) | ✅ Migration 045 applicata (T1) |
| **Event store** (audit_events, T2/T3/T4/T5) | ✅ Completato |
| **Temporal table `audit_custom_checklist_responses`** | ❌ MANCANTE — da fare (backlog noto) |
| **AuditClosePanel — metriche NC custom** | ❌ BUG — warning NC non include checklist custom |
| **`formatDate` helpers** | ⚠️ Duplicata in 5 file frontend + 1 backend |
| **Extra evidence blocks — upload offline** | ⚠️ Usa `<input file>` inline invece di `useAttachmentManager` |

**Conclusione**: le funzionalità principali di gestione documentale e scadenziari sono complete. I gap residui sono 4 item specifici descritti sotto.

---

## FASE 1 — P0: Fix AuditClosePanel — metriche NC custom checklist

**File**: `app/src/components/AuditClosePanel.jsx`  
**Problema**: il `useMemo` di validazione (righe 75-80) chiama `calculateFindingsMetrics(currentAudit?.checklist)` che legge SOLO la checklist ISO. Se l'audit usa una checklist personalizzata con `has_outcome_buttons=true`, i contatori NC/OSS/OM custom non appaiono nel warning di chiusura.  
**Non blocca la chiusura** (è un warning, non un blocker), ma il numero NC mostrato è 0 anche se ci sono NC sulla custom checklist.

### Soluzione

In `AuditClosePanel.jsx`, nel `useMemo` di validazione:

```javascript
// PRIMA (riga ~75):
const metrics = calculateFindingsMetrics(currentAudit?.checklist);

// DOPO:
import { calculateFindingsMetrics, calculateCustomFindingsMetrics } from "../utils/metricsCalculator";

const isoMetrics    = calculateFindingsMetrics(currentAudit?.checklist);
const customMetrics = currentAudit?.customChecklist?.has_outcome_buttons
  ? calculateCustomFindingsMetrics(currentAudit.customStatuses)
  : { totalNC: 0, totalOSS: 0, totalOM: 0 };
const metrics = {
  totalNC:  isoMetrics.totalNC  + customMetrics.totalNC,
  totalOSS: isoMetrics.totalOSS + customMetrics.totalOSS,
  totalOM:  isoMetrics.totalOM  + customMetrics.totalOM,
};
```

**Import**: `calculateCustomFindingsMetrics` è già esportata da `metricsCalculator.js` — nessuna modifica backend.

**Test atteso**: apri audit con checklist custom e 2+ NC segnate → chiudi pannello sezione 13 → il warning mostra il numero corretto di NC.

---

## FASE 2 — P1: Migration 048 — Temporal table su `audit_custom_checklist_responses`

**Motivazione**: ADR-008 richiede storicizzazione per tutte le entità audit. La tabella `audit_responses` ha già temporal table (migration 045). `audit_custom_checklist_responses` ne è priva → rischio perdita dati in caso di conflitto sync o bug future.

### 2A — File migration SQL

Crea `database/migrations/048_temporal_tables_custom_checklist_responses.sql`:

```sql
-- =============================================================================
-- Migrazione 048 — Temporal Table su audit_custom_checklist_responses
-- =============================================================================
-- Motivazione: parità con migration 045 (audit_responses + audits).
-- ADR-008: ogni entità audit deve avere storicizzazione automatica.
-- Prerequisiti: SQL Server 2016+ (verificato: SQL Server 2025 Enterprise)
-- Backup: eseguire prima dell'applicazione.
--
-- Rollback:
--   ALTER TABLE audit_custom_checklist_responses SET (SYSTEM_VERSIONING = OFF);
--   ALTER TABLE audit_custom_checklist_responses DROP PERIOD FOR SYSTEM_TIME;
--   ALTER TABLE audit_custom_checklist_responses DROP COLUMN ValidFrom, ValidTo;
--   DROP TABLE IF EXISTS dbo.audit_custom_checklist_responses_history;
-- =============================================================================

PRINT '=== Migration 048: Temporal Table custom_checklist_responses ===';

-- 1. Rimuovi temporal table se esiste già (idempotente)
IF EXISTS (
  SELECT 1 FROM sys.tables
  WHERE name = 'audit_custom_checklist_responses'
    AND temporal_type = 2
)
BEGIN
  ALTER TABLE [dbo].[audit_custom_checklist_responses] SET (SYSTEM_VERSIONING = OFF);
  ALTER TABLE [dbo].[audit_custom_checklist_responses]
    DROP PERIOD FOR SYSTEM_TIME;
  ALTER TABLE [dbo].[audit_custom_checklist_responses]
    DROP COLUMN IF EXISTS ValidFrom, DROP COLUMN IF EXISTS ValidTo;
  DROP TABLE IF EXISTS [dbo].[audit_custom_checklist_responses_history];
  PRINT '[RESET] Temporal table rimossa per riapplicazione';
END

-- 2. Aggiungi colonne HIDDEN per period
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.audit_custom_checklist_responses')
    AND name = 'ValidFrom'
)
BEGIN
  ALTER TABLE [dbo].[audit_custom_checklist_responses]
    ADD ValidFrom DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN
        CONSTRAINT DF_custom_resp_ValidFrom DEFAULT '2000-01-01 00:00:00',
        ValidTo   DATETIME2 GENERATED ALWAYS AS ROW END   HIDDEN
        CONSTRAINT DF_custom_resp_ValidTo   DEFAULT '9999-12-31 23:59:59.9999999',
        PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
  PRINT '[OK] Colonne ValidFrom/ValidTo aggiunte';
END
ELSE
  PRINT '[SKIP] Colonne ValidFrom/ValidTo già presenti';

-- 3. Crea tabella history e abilita system versioning
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'audit_custom_checklist_responses_history')
BEGIN
  ALTER TABLE [dbo].[audit_custom_checklist_responses]
    SET (SYSTEM_VERSIONING = ON (
      HISTORY_TABLE = dbo.audit_custom_checklist_responses_history,
      DATA_CONSISTENCY_CHECK = ON
    ));
  PRINT '[OK] System versioning abilitato su audit_custom_checklist_responses';
  PRINT '[OK] History table: audit_custom_checklist_responses_history';
END
ELSE
  PRINT '[SKIP] History table già presente';

-- 4. Verifica
SELECT
  t.name AS tabella,
  t.temporal_type_desc,
  h.name AS history_table
FROM sys.tables t
LEFT JOIN sys.tables h ON t.history_table_id = h.object_id
WHERE t.name IN ('audit_custom_checklist_responses', 'audit_responses', 'audits');

PRINT '=== Migration 048 completata ===';
```

### 2B — Script di esecuzione VPS

Crea `backend/scripts/run-migration-048.js` (modello: `run-migration-019.js`):

```javascript
require('dotenv').config();
const fs   = require('fs'), path = require('path');
const cfgs = JSON.parse(fs.readFileSync(path.join(__dirname,'..','config','database.json'),'utf8'));
let c = cfgs.production;
if (process.env.DB_SERVER) c = {
  ...c,
  server:   process.env.DB_SERVER,
  port:     parseInt(process.env.DB_PORT || c.port, 10),
  database: process.env.DB_DATABASE || c.database,
  user:     process.env.DB_USER     || c.user,
  password: process.env.DB_PASSWORD || c.password,
};
const sql  = require('mssql');
const sqlText = fs.readFileSync(
  path.join(__dirname, '..', '..', 'database', 'migrations', '048_temporal_tables_custom_checklist_responses.sql'),
  'utf8'
);

sql.connect({
  server: c.server, port: c.port || 1433, database: c.database,
  user: c.user, password: c.password,
  options: { trustServerCertificate: true, encrypt: true },
}).then(async pool => {
  console.log('Connesso al DB. Esecuzione migration 048...\n');
  const statements = sqlText.split(/\nGO\s*\n/i).filter(s => s.trim());
  for (const stmt of statements) {
    if (stmt.trim()) await pool.request().query(stmt);
  }
  console.log('\n=== Migration 048 completata ===');
  await pool.close();
}).catch(err => { console.error('Errore:', err.message); process.exit(1); });
```

### 2C — Esecuzione sul VPS

Copia i file su VPS e lancia (via `.ssh-deploy.local.ps1`):

```powershell
# 1. Copia migration sul VPS
scp -P <PORT> "G:\Il mio Drive\Sistema Gestione ISO 9001\database\migrations\048_temporal_tables_custom_checklist_responses.sql" <VPS_USER>@<VPS_HOST>:/opt/sgq-backend/database/migrations/

# 2. Copia script Node
scp -P <PORT> "G:\Il mio Drive\Sistema Gestione ISO 9001\backend\scripts\run-migration-048.js" <VPS_USER>@<VPS_HOST>:/opt/sgq-backend/scripts/

# 3. Esegui
ssh -p <PORT> <VPS_USER>@<VPS_HOST> "cd /opt/sgq-backend && node scripts/run-migration-048.js"
```

**Verifica**: nel log deve apparire `audit_custom_checklist_responses | SYSTEM_VERSIONED | audit_custom_checklist_responses_history`.

---

## FASE 3 — P2: Centralizzare `formatDate` → `utils/dateHelpers.js`

**Problema**: la stessa funzione `formatDate` è copiata in 5 file frontend:
- `app/src/pages/NCPage.jsx`
- `app/src/pages/RisksPage.jsx`
- `app/src/pages/QualificationsPage.jsx`
- `app/src/components/DocumentRegistry.jsx`
- `app/src/pages/ComplaintsPage.jsx`

(Il backend `alertScheduler.js` ha la propria copia locale — OK, non toccare il backend in questa fase.)

### Soluzione

**Step 1**: Crea `app/src/utils/dateHelpers.js`:

```javascript
/**
 * dateHelpers.js — Utilità condivise per formattazione date
 */

/**
 * Formatta una data ISO (YYYY-MM-DD...) in formato italiano (DD/MM/YYYY).
 * Gestisce: stringhe ISO, Date objects, null/undefined.
 * @param {string|Date|null} d
 * @returns {string} Data formattata o "—"
 */
export function formatDate(d) {
  if (!d) return "—";
  const s = typeof d === "string" ? d : String(d);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) return dt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  return "—";
}
```

**Step 2**: In ciascuno dei 5 file, **elimina** la definizione locale di `formatDate` e **aggiungi** l'import:

```javascript
import { formatDate } from "../utils/dateHelpers";
// oppure (per pages):
import { formatDate } from "../../utils/dateHelpers";
// adattare il percorso relativo in base alla posizione del file
```

Percorsi corretti:
- `app/src/pages/NCPage.jsx` → `import { formatDate } from "../utils/dateHelpers";`
- `app/src/pages/RisksPage.jsx` → `import { formatDate } from "../utils/dateHelpers";`
- `app/src/pages/QualificationsPage.jsx` → `import { formatDate } from "../utils/dateHelpers";`
- `app/src/components/DocumentRegistry.jsx` → `import { formatDate } from "../utils/dateHelpers";`
- `app/src/pages/ComplaintsPage.jsx` → `import { formatDate } from "../utils/dateHelpers";`

**Nota**: `DocumentRegistry.jsx` usa anche `formatDate` dentro `daysUntil` e `sortKey` — assicurarsi che l'import copra tutti gli usi nel file.

**Test atteso**: `npm run build` senza errori. Aprire le 5 pagine in produzione e verificare che le date appaiano nel formato `GG/MM/YYYY`.

---

## FASE 4 — P2: Extra evidence blocks — usare `attachmentManager`

**File**: `app/src/components/CustomChecklistAuditView.jsx` (righe ~454-495)  
**Problema**: i blocchi evidenza aggiuntivi (2° in poi) usano un `<input type="file">` inline che chiama `handleFileSelect(item.id, idx, f)` — questo non passa per `useAttachmentManager` e non è compatibile con la futura pipeline SYNC-5 (upload offline → queue → retry).

**Azione**: verifica se `handleFileSelect` usa già `attachmentManager.uploadAttachment()` internamente:

```javascript
// Cerca questa funzione nel file:
async function handleFileSelect(itemId, blockIdx, file) { ... }
```

- **Se usa già `attachmentManager.uploadAttachment()`** → nessuna modifica necessaria, annotare "FIX NON APPLICABILE".
- **Se usa `apiService.uploadAttachment()` direttamente** → sostituire la chiamata con `attachmentManager.uploadAttachment({ file, customItemId: itemId })` e aggiornare il blocco con l'`attachment_id` restituito.

**Test atteso**: allegare un file su un blocco evidenza extra e verificare che appaia in `GET /attachments?auditId=X`.

---

## FASE 5 — P3: Verifica Alert Engine + documentazione SMTP

**Scopo**: confermare che Alert Engine è operativo in produzione; documentare setup SMTP.

### 5A — Verifica route `/alerts` con licenza

Apri `backend/src/routes/alert.routes.js`. Le route usano solo `authenticate` senza `requireLicensedModule`.

Verificare nel file `backend/src/middleware/auth.middleware.js` quali moduli sono nella lista `KNOWN_MODULE_KEYS`. Se esiste una chiave `documents` o `alerts`:

- Aggiungere a `alert.routes.js`:
  ```javascript
  const { requireLicensedModule } = require('../middleware/auth.middleware');
  router.get('/alerts/count', requireLicensedModule('documents'), alertCtrl.getAlertCount);
  router.get('/alerts',       requireLicensedModule('documents'), alertCtrl.getAlerts);
  ```
  
- **Se non esiste una chiave adeguata** → lasciare come `authenticate` only e annotare "FIX NON APPLICABILE — allineamento licenze rinviato a Sessione B roadmap".

### 5B — Verifica variabili SMTP in produzione

Sul VPS, verificare che il file `.env` contenga:

```
ALERT_ENABLED=true
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
```

Se mancano → **non aggiungere** credenziali SMTP (dati sensibili, li inserisce il committente). Annotare in `docs/GUIDA_CONSOLIDATA.md` sezione "Deploy checklist — Alert Engine":

```markdown
### Alert Engine — configurazione SMTP

Il cron job (`alertScheduler.js`) si avvia automaticamente con il backend.
È disabilitato (log warning) se `node-schedule` o `nodemailer` non sono installati.
Variabili .env da configurare sul VPS (inserire manualmente):

| Variabile    | Esempio                      | Obbligatoria |
|--------------|------------------------------|--------------|
| ALERT_ENABLED | `true`                      | sì           |
| SMTP_HOST    | `smtp.gmail.com`             | sì           |
| SMTP_PORT    | `587`                        | sì           |
| SMTP_USER    | `alerts@qsstudio.it`         | sì           |
| SMTP_PASS    | `<app-password>`             | sì           |
| SMTP_FROM    | `SGQ Studio <alerts@qsstudio.it>` | sì      |

Per testare manualmente: `GET /alerts` → lista scadenze attive per l'org loggata.
```

Dopo aver aggiunto la documentazione, eseguire sul VPS: `npm install node-schedule nodemailer` (se non già installati) e riavviare il backend.

---

## Riepilogo attività da svolgere

| # | Fase | File/Azione | Priorità | Stima |
|---|------|-------------|----------|-------|
| 1 | Fix AuditClosePanel metriche NC custom | `AuditClosePanel.jsx` | P0 | 20 min |
| 2A | SQL migration 048 temporal table | `database/migrations/048_*.sql` | P1 | 15 min |
| 2B | Script Node esecuzione VPS | `backend/scripts/run-migration-048.js` | P1 | 10 min |
| 2C | Esecuzione su VPS + verifica | SSH VPS | P1 | 10 min |
| 3 | Centralizza `formatDate` | `utils/dateHelpers.js` + 5 file | P2 | 30 min |
| 4 | Extra blocks → `attachmentManager` | `CustomChecklistAuditView.jsx` | P2 | 20 min |
| 5A | Alert routes licenza | `alert.routes.js` | P3 | 15 min |
| 5B | Doc SMTP + install VPS | `GUIDA_CONSOLIDATA.md` + SSH | P3 | 20 min |

**Totale stimato**: ~2h

---

## Stato globale moduli (non richiedono modifiche)

| Modulo | File | Stato |
|--------|------|-------|
| Registro documenti | `DocumentRegistry.jsx` | ✅ Completo — expiry, semaforo, tab Priorità |
| Import PDF → staging → registry | `ImportJobsPage.jsx` | ✅ Sprint 10 completato |
| Scadenziari qualifiche | `QualificationsPage.jsx` | ✅ Semaforo UI funzionante |
| Alert Engine backend | `alertScheduler.js` | ✅ Cron 08:00, email template HTML |
| NC & Azioni correttive | `NCPage.jsx` | ✅ Sprint 3 completo |
| Rischi & Obiettivi | `RisksPage.jsx` | ✅ Sprint 6 completo |
| Reclami & Fornitori | `ComplaintsPage.jsx` | ✅ Sprint 7 completo |
| Temporal tables audit | migrations 045-046 | ✅ T1+T2 applicati |

---

## Chiusura

Al completamento di tutte le fasi, rispondere: **TEST OK** oppure per ogni fase non eseguita: **FIX NON APPLICABILE — [motivo]**.

Aggiornare `docs/PROJECT_ROADMAP.md` aggiungendo al backlog:
- `048_temporal_tables_custom_checklist_responses` ✅ se applicata
- `formatDate centralizzata` ✅ se applicata
