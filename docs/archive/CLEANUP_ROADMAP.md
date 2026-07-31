# 🧹 Roadmap Pulizia Ambiente - Beta Test Ready

**Data inizio:** 8 febbraio 2026  
**Obiettivo:** Preparare ambiente pulito e funzionale per beta test completo

---

## ✅ Completato (Sessione 08/02/2026)

### Bug Sync Bidirezionale RISOLTO
- **Problema:** Sync unidirezionale (solo upload), dropdown mostrava audit locali obsoleti
- **Soluzione:** Implementato download dal server + converter formato backend↔frontend
- **File modificati:**
  - `app/src/contexts/StorageContext.jsx` (linee 268-310)
  - `app/src/utils/auditConverter.js` (nuovo file)
- **Commit pending:** "feat(sync): implementa sync bidirezionale con converter backend↔frontend"
- **ADR:** ADR-003-bidirectional-sync.md (da creare)

### Audit Attualmente nel Sistema
**Database (4 audit):**
1. audit_id `2004` - Raccorderia Piacentina (completed) - UUID: `audit-001-rp-2025`
2. audit_id `3845` - busato (draft) - UUID: `50c95a72-02a4-4a09-b5f0-c08291b36d8e`
3. audit_id `3901` - Acme Industries (in_progress) - UUID: `audit-002-acme-2025` ⚠️ DUPLICATO
4. audit_id `3902` - Template Industries (draft) - UUID: `audit-003-template-2025` ⚠️ DUPLICATO

**IndexedDB (4 audit):**
- Sincronizzati correttamente dal server via `GET /audits`
- Formato convertito: backend (snake_case) → frontend (camelCase + nested)

---

## 🔄 FASE 1: Database Cleanup (Priorità ALTA)

### 1.1 Identifica Audit Duplicati/Obsoleti
```sql
-- Query 1: Audit con stesso client_name ma audit_id diversi
SELECT 
    audit_id,
    audit_number,
    client_name,
    status,
    created_at,
    updated_at
FROM audits
WHERE client_name IN (
    SELECT client_name 
    FROM audits 
    GROUP BY client_name 
    HAVING COUNT(*) > 1
)
ORDER BY client_name, created_at;

-- Query 2: Audit con UUID duplicati (stesso audit_uuid)
SELECT 
    audit_id,
    audit_number,
    client_name,
    created_at
FROM audits
WHERE audit_id >= 3900
ORDER BY created_at;
```

**Decisione:**
- [ ] Mantenere audit più vecchi (2004, 3845)
- [ ] Eliminare duplicati recenti (3901, 3902) creati da sync errato

### 1.2 Verifica Dipendenze FK
```sql
-- Verifica audit_standards orphan
SELECT 
    ast.audit_standard_id,
    ast.audit_id,
    a.client_name
FROM audit_standards ast
LEFT JOIN audits a ON ast.audit_id = a.audit_id
WHERE ast.audit_id IN (3901, 3902);

-- Verifica audit_responses orphan
SELECT COUNT(*) 
FROM audit_responses 
WHERE audit_id IN (3901, 3902);

-- Verifica sync_metadata orphan
SELECT COUNT(*)
FROM sync_metadata
WHERE entity_type = 'audit'
AND entity_id IN (3901, 3902);

-- Verifica attachments orphan
SELECT COUNT(*)
FROM attachments
WHERE audit_id IN (3901, 3902);
```

### 1.3 DELETE Audit Duplicati (FK-safe order)
```sql
USE SGQ_ISO9001;
GO

BEGIN TRANSACTION;

-- STEP 1: Preview dependencies
SELECT 'AUDIT_STANDARDS' AS Tabella, COUNT(*) AS Totale
FROM audit_standards
WHERE audit_id IN (3901, 3902)
UNION ALL
SELECT 'AUDIT_RESPONSES', COUNT(*)
FROM audit_responses
WHERE audit_id IN (3901, 3902)
UNION ALL
SELECT 'SYNC_METADATA', COUNT(*)
FROM sync_metadata
WHERE entity_type = 'audit' AND entity_id IN (3901, 3902)
UNION ALL
SELECT 'ATTACHMENTS', COUNT(*)
FROM attachments
WHERE audit_id IN (3901, 3902);

-- STEP 2: DELETE dependencies (FK order)
DELETE FROM audit_standards WHERE audit_id IN (3901, 3902);
DELETE FROM audit_responses WHERE audit_id IN (3901, 3902);
DELETE FROM sync_metadata WHERE entity_type = 'audit' AND entity_id IN (3901, 3902);
DELETE FROM attachments WHERE audit_id IN (3901, 3902);

-- STEP 3: DELETE parent audits
DELETE FROM audits WHERE audit_id IN (3901, 3902);

-- STEP 4: Verify cleanup
SELECT 
    audit_id,
    audit_number,
    client_name,
    status
FROM audits
WHERE audit_id >= 2000
ORDER BY audit_id;

-- Expected result: 2 audits (2004, 3845)

COMMIT;
-- Se errori: ROLLBACK;
```

### 1.4 Cleanup IndexedDB Cache
**Browser Console (dopo DELETE database):**
```javascript
indexedDB.deleteDatabase('SGQ_ISO9001');
indexedDB.deleteDatabase('SGQ_ISO9001_sync');
localStorage.clear();
console.log('✅ Cache invalidata');
setTimeout(() => location.reload(), 500);
```

**Expected log dopo reload:**
```
🌐 [DOWNLOAD] Scarico audit dal server...
✅ [DOWNLOAD] Scaricati 2 audit dal server
💾 [MERGE] Aggiorno IndexedDB con dati server...
✅ [MERGE] 2 audit salvati in IndexedDB
✅ Caricati 2 audit (2 server, 0 cache)
```

---

## 🎨 FASE 2: Frontend UI Cleanup (Priorità MEDIA)

### 2.1 Rimuovi Componenti Deprecati
```bash
# File da verificare ed eventualmente rimuovere:
- app/src/contexts/DataContext.jsx  # DEPRECATO? Sostituito da StorageContext
- app/src/components/StorageTestComponent.jsx  # Solo testing, rimuovere in prod
- app/src/data/testAuditUtils.js  # Test utilities, mantenere solo in dev
```

**Checklist:**
- [ ] Verifica import `DataContext` in altri file (grep search)
- [ ] Se non usato → DELETE file
- [ ] Se usato → Migrare a `StorageContext`

### 2.2 Consolida CSS Duplicati
```bash
# Possibili duplicazioni:
- AuditAccordionLayout.css vs AuditTabsLayout.css
- SharedComponents.css consolidabile?
```

**Azione:**
- [ ] Grep classi CSS duplicate
- [ ] Merge in file comune (es: `components/common.css`)

### 2.3 Rimuovi Console.log Non Necessari
**Pattern da mantenere:**
- `console.log` con emoji (`🚀`, `✅`, `❌`) → Utili per debugging
- `console.error`, `console.warn` → Sempre mantenere

**Pattern da rimuovere:**
- `console.log("DEBUG: ...")` senza emoji
- `console.log` in loop (performance)
- `console.log` in handler eventi frequenti

**Script cleanup:**
```bash
# Trova tutti i console.log senza emoji
grep -r "console\.log\(" app/src --include="*.jsx" --include="*.js" | grep -v "🚀\|✅\|❌\|📊\|💾"
```

### 2.4 Fix Warning Manifest
**Errore attuale:**
```
Error while trying to use the following icon from the Manifest: 
http://localhost:3000/screenshots/desktop-checklist.png 
(Download error or resource isn't a valid image)
```

**Fix:**
```json
// public/manifest.json
{
  "icons": [
    {
      "src": "/icons/icon-192x192.png",  // ✅ Corretto
      "sizes": "192x192",
      "type": "image/png"
    }
    // Rimuovere riferimento a screenshots/desktop-checklist.png
  ]
}
```

**Meta tag deprecato:**
```html
<!-- index.html: cambiare -->
<meta name="apple-mobile-web-app-capable" content="yes">
<!-- in: -->
<meta name="mobile-web-app-capable" content="yes">
```

---

## 🔧 FASE 3: Codice Ridondante (Priorità BASSA)

### 3.1 localStorage Legacy Cleanup
**Keys obsolete (migrato a IndexedDB):**
```javascript
// Rimuovere da StorageContext.jsx:
const STORAGE_KEYS = {
  AUDITS: "audits",  // ❌ Non più usato
  CURRENT_AUDIT_ID: "currentAuditId",  // ❌ Non più salvato
  FS_CONNECTED: "fsConnected"  // ✅ Mantenere (flag UI)
};
```

**Migrazione code cleanup:**
```javascript
// LinEE 238-262 StorageContext.jsx - RIMUOVERE dopo verifica:
const storedAudits = localStorage.getItem(STORAGE_KEYS.AUDITS);
if (storedAudits) {
  // Migrazione localStorage → IndexedDB (una tantum)
  // ⚠️ Rimuovere dopo 1-2 settimane di deploy
}
```

### 3.2 MOCK_AUDITS Cleanup
**File: `app/src/data/mockAudits.js`**

**Decisione:**
- Se beta test usa dati reali → DELETE `MOCK_AUDITS`
- Se serve per demo → Mantenere ma disabilitare default

**Modifica StorageContext.jsx:**
```javascript
// Linea 100: Cambiare default
export function StorageProvider({ children, useMockData = false }) {  // false invece di true
```

### 3.3 Import Inutilizzati
```bash
# Trova import mai usati
npm run lint -- --fix

# Oppure manualmente:
grep -r "^import.*from" app/src --include="*.jsx" | \
  awk '{print $2}' | sort | uniq -c | sort -rn
```

### 3.4 File Backup/Test da Rimuovere
```bash
# Pattern file da eliminare:
**/*.backup.js
**/*.old.jsx
**/*.test.skip.js  # Test disabilitati
**/audit_responses_backup_20260111  # Tabella DB backup (verifica se necessaria)
```

---

## ⚙️ FASE 4: Service Worker Optimization

### 4.1 Cache Versioning
**File: `public/service-worker.js`**

**Problema:** Cache vecchie non invalidate

**Fix:**
```javascript
// Linea 1: Bump version dopo ogni deploy
const CACHE_VERSION = 'v1.0.3';  // Era v1.0.2

// Linea 31: Cleanup cache vecchie
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_VERSION)
          .map(name => caches.delete(name))
      );
    })
  );
});
```

### 4.2 Selective Caching (Evita cache API calls)
```javascript
// NON cachare risposte API dinamiche
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip cache per API calls
  if (url.pathname.startsWith('/api/')) {
    return;  // Network-first sempre
  }
  
  // Cache static assets
  event.respondWith(/* cache strategy */);
});
```

---

## ✅ FASE 5: Beta Test Validation

### 5.1 Test Scenario: Nuovo Audit da Zero
**Steps:**
1. Click "➕ Nuovo Audit"
2. Compila form:
   - Tipo: Certificazione/Sorveglianza
   - Cliente: "Beta Test Industries 2026"
   - Data: Oggi
   - Auditor: "Marco Camellini"
   - Standard: ISO 9001:2015 ✓
3. Click "💾 Crea Audit"
4. **Verifica:**
   - Dropdown mostra nuovo audit
   - Console: `✅ Audit creato con successo`
   - Database: SELECT mostra nuovo audit_id
   - IndexedDB: Audit presente in cache

### 5.2 Test Scenario: Checklist Completo
**Steps:**
1. Seleziona audit "Beta Test Industries"
2. Espandi sezione 4.1 - Contesto organizzazione
3. Compila 5 domande consecutive (C/NC/NA)
4. Verifica auto-save: `💾 [AUTO-SAVE] X audit salvati`
5. Refresh pagina → Risposte persistite
6. **Verifica database:**
   ```sql
   SELECT COUNT(*) 
   FROM audit_responses 
   WHERE audit_id = (SELECT audit_id FROM audits WHERE client_name = 'Beta Test Industries 2026');
   ```

### 5.3 Test Scenario: Offline → Online Sync
**Steps:**
1. DevTools → Network tab → Check "Offline"
2. Modifica 3 risposte checklist
3. Console mostra: `⚠️ Offline - modifiche in queue`
4. Uncheck "Offline"
5. Console: `🔄 [SYNC] Inizio processamento queue...`
6. **Verifica:** `✅ [SYNC] Completato: X items`

### 5.4 Test Scenario: Export Word
**Steps:**
1. Seleziona audit completo
2. Click "📄 Esporta Word"
3. Verifica file `.docx` downloadato
4. Apri in Word/LibreOffice
5. **Checklist export:**
   - [ ] Sezioni checklist presenti
   - [ ] Risposte formattate (✓ C, ✗ NC, - N/A)
   - [ ] Non conformità elencate
   - [ ] Metadati audit corretti

---

## 📋 Checklist Finale Pre-Beta

### Database
- [ ] Solo 2 audit production (2004, 3845)
- [ ] Zero audit_responses orphan
- [ ] Zero sync_metadata orphan
- [ ] Zero attachments orphan

### Frontend
- [ ] Zero errori console (rossi)
- [ ] Zero warning deprecation
- [ ] Dropdown mostra audit corretti
- [ ] Auto-save funzionante

### Sync
- [ ] Download server → IndexedDB ✅
- [ ] Upload IndexedDB → server ✅
- [ ] Offline queue funzionante ✅
- [ ] Conflict resolution (server-wins)

### Export
- [ ] Word export genera file valido
- [ ] JSON export corretto
- [ ] CSV summary leggibile

### Service Worker
- [ ] Cache version bumped
- [ ] Old caches deleted
- [ ] API calls not cached
- [ ] Manifest icons validi

---

## 🚀 Deployment Checklist

**Pre-deploy:**
- [ ] Git commit: pulizia ambiente
- [ ] Git tag: `v1.0.0-beta.1`
- [ ] ADR-003 committed
- [ ] CHANGELOG.md updated

**Deploy:**
- [ ] Backend restart (nuovi audit_id sequence)
- [ ] Frontend build production
- [ ] Netlify deploy (HTTPS per PWA)
- [ ] Service Worker versioning check

**Post-deploy:**
- [ ] Smoke test: login
- [ ] Smoke test: sync download
- [ ] Smoke test: crea audit
- [ ] Monitor logs 24h

---

## 📝 Note Tecniche

### Formato Audit (Post-Converter)
**Backend (Database):**
```sql
audit_id: INTEGER (PK)
audit_uuid: VARCHAR(36) (UUID v4)
audit_number: VARCHAR(50)
client_name: VARCHAR(255)
status: VARCHAR(20) ('draft', 'in_progress', 'completed')
created_at: DATETIME2
updated_at: DATETIME2
```

**Frontend (IndexedDB):**
```javascript
{
  id: "audit-xxx" | UUID,
  metadata: {
    auditId: INTEGER,       // Mantiene riferimento DB
    auditNumber: "2025-01",
    clientName: "XYZ",
    status: "draft",
    // ...
  },
  checklist: { ISO_9001: {} },
  nonConformities: [],
  metrics: { ... }
}
```

### Sync Flow (Bidirezionale)
```
1. App Start
   ↓
2. Load from IndexedDB (cache)
   ↓
3. IF online → GET /audits (server)
   ↓
4. Convert backend → frontend (auditConverter.js)
   ↓
5. Merge (server-wins)
   ↓
6. Update IndexedDB (cache refresh)
   ↓
7. Set React state (UI update)
```

### Converter Mapping
**snake_case → camelCase:**
- `audit_number` → `auditNumber`
- `client_name` → `clientName`
- `audit_date` → `auditDate`
- `auditor_name` → `auditorName`
- `audit_type` → `auditType`

**Nested structure:**
- DB flat → Frontend `metadata` object
- DB flat → Frontend `metrics` object
- Checklist sempre vuoto al download (lazy load)

---

## 📞 Contatti & Risorse

**Developer:** AI Agent  
**Project:** Sistema Gestione ISO 9001  
**Cliente:** QS Studio  
**Database:** sistemi.fr-busato.it:11043 (SGQ_ISO9001)  
**Backend:** localhost:10443 (dev) | sistemi.fr-busato.it:8443 (prod)  
**Frontend:** localhost:3000 (dev) | Netlify (prod)

**Document References:**
- ADR-001: Multi-Agent Workflow
- ADR-002: Offline-First Architecture
- ADR-003: Bidirectional Sync (TO CREATE)
- DATABASE_SCHEMA.md v1.11
- TEST_REPORT_STEP_3.md

---

**Ultima modifica:** 8 febbraio 2026, 18:30  
**Prossima sessione:** 9 febbraio 2026 - FASE 1: Database Cleanup
