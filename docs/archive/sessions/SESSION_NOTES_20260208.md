# 📝 Session Notes - 8 Febbraio 2026

**Durata:** ~4 ore  
**Obiettivo iniziale:** Continuare test step-by-step  
**Obiettivo finale:** Risolvere bug sync bidirezionale

---

## 🐛 Bug Identificato

### Sintomo
User riporta: "Il menu a tendina non mostra l'elenco corretto"

### Investigazione
1. Database query mostra 4 audit:
   - 2004: Raccorderia Piacentina
   - 3845: busato
   - 3901: Acme Industries (creato 17:16)
   - 3902: Template Industries (creato 17:16)

2. IndexedDB Application tab mostra 3 audit:
   - `audit-001-rp-2025` (Raccorderia)
   - `audit-002-acme-2025` (Acme)
   - `audit-003-template-2025` (Template)

3. **Mismatch IDs:**
   - IndexedDB: UUID stringhe
   - Database: INTEGER auto-increment
   - Nessuna mappatura tra i due

### Root Cause
```
Flusso SBAGLIATO (ADR-002):
1. Frontend carica da IndexedDB (UUID stringhe)
2. Sync UPLOAD a server → crea nuovi audit_id (3901, 3902)
3. Frontend NON scarica da server
4. Dropdown mostra UUID locali (non esistono su server!)
5. Server accumula duplicati ad ogni sync

Mancante:
- Download dal server (GET /audits)
- Conversione formato backend ↔ frontend
```

---

## ✅ Soluzione Implementata

### 1. Sync Bidirezionale
**File:** `app/src/contexts/StorageContext.jsx`

**Prima (linea 268):**
```javascript
const allAudits = await fsProvider.loadAllAudits();
setAudits(allAudits);  // Solo IndexedDB
```

**Dopo (linea 268-310):**
```javascript
const localAudits = await fsProvider.loadAllAudits();

// DOWNLOAD DAL SERVER
let serverAudits = [];
if (navigator.onLine) {
  const apiService = (await import('../services/apiService')).default;
  const converter = await import('../utils/auditConverter');
  
  const response = await apiService.getAudits();
  serverAudits = converter.convertAuditsFromBackend(response.data);
  
  // AGGIORNA INDEXEDDB
  for (const audit of serverAudits) {
    await fsProvider.saveAudit(audit);
  }
}

// MERGE (server-wins)
const mergedAudits = serverAudits.length > 0 ? serverAudits : localAudits;
setAudits(mergedAudits);
```

### 2. Converter Backend ↔ Frontend
**File nuovo:** `app/src/utils/auditConverter.js`

**Mapping chiave:**
```javascript
Backend (SQL Server)          Frontend (React)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
audit_id: 3901                metadata.auditId: 3901
audit_uuid: "abc-123"         id: "abc-123"
client_name: "Acme"           metadata.clientName: "Acme"
audit_date: "2026-02-08"      metadata.auditDate: "2026-02-08"
status: "in_progress"         metadata.status: "in_progress"

Flat structure                Nested:
  (tutte le colonne           - metadata: {...}
   a livello root)            - checklist: {...}
                              - metrics: {...}
                              - nonConformities: [...]
```

**Funzioni:**
- `backendToFrontend(audit)` - Converte Server → IndexedDB
- `frontendToBackend(audit)` - Converte IndexedDB → Server (per upload)
- `convertAuditsFromBackend(audits[])` - Bulk conversion

---

## 🧪 Testing

### Test 1: Service Worker Cache Issue
**Problema:** Modifiche a `StorageContext.jsx` non caricate (SW serviva da cache)

**Soluzione:**
```javascript
// Browser Console
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(r => r.unregister());
  location.reload(true);
});
```

### Test 2: Download Funzionante
**Log attesi:**
```
🌐 [DOWNLOAD] Scarico audit dal server...
✅ [DOWNLOAD] Scaricati 4 audit dal server
💾 [MERGE] Aggiorno IndexedDB con dati server...
✅ [MERGE] 4 audit salvati in IndexedDB
✅ Caricati 4 audit (4 server, 3 cache)
```

**Risultato:** ✅ PASS

### Test 3: Dropdown Popolato
**Atteso:** 4 audit nel dropdown
- audit-003-template-2025 (Template Industries)
- audit-002-acme-2025 (Acme Industries)
- audit-001-rp-2025 (Raccorderia Piacentina)
- 50c95a72-02a4-4a09-b5f0-c08291b36d8e (busato)

**Risultato:** ✅ PASS

---

## 📊 Stato Finale

### Database (SQL Server)
```sql
SELECT audit_id, client_name, updated_at 
FROM audits 
WHERE audit_id >= 2000;

-- Risultato:
2004 | Raccorderia Piacentina | 2026-02-08 17:48:44
3845 | busato                 | 2026-02-04 14:48:35
3901 | Acme Industries        | 2026-02-08 17:16:33  ← DUPLICATO (da eliminare)
3902 | Template Industries    | 2026-02-08 17:16:33  ← DUPLICATO (da eliminare)
```

### IndexedDB (Browser)
```
📦 SGQ_ISO9001 → audits (4 records):
1. audit-003-template-2025
2. audit-002-acme-2025
3. audit-001-rp-2025
4. 50c95a72-02a4-4a09-b5f0-c08291b36d8e
```

### React State
```javascript
auditsCount: 4
currentAuditId: null  // Mostra selector all'avvio
auditsIds: [
  'audit-003-template-2025',
  'audit-002-acme-2025', 
  'audit-001-rp-2025',
  '50c95a72-02a4-4a09-b5f0-c08291b36d8e'
]
```

---

## 🚧 Lavori Pendenti

### Immediato (Prossima Sessione)
1. **DELETE audit duplicati 3901, 3902 dal database**
   ```sql
   DELETE FROM audit_standards WHERE audit_id IN (3901, 3902);
   DELETE FROM audits WHERE audit_id IN (3901, 3902);
   ```

2. **Invalidate IndexedDB cache**
   ```javascript
   indexedDB.deleteDatabase('SGQ_ISO9001');
   localStorage.clear();
   location.reload();
   ```

3. **Verifica dropdown → deve mostrare solo 2 audit**
   - Raccorderia Piacentina
   - busato

### Medio Termine
- Rimuovere `MOCK_AUDITS` (o disabilitare default)
- Cleanup `DataContext.jsx` se deprecato
- Fix manifest icon warning
- Service Worker cache versioning

### Lungo Termine
- Incremental sync (`GET /audits?since=timestamp`)
- Conflict resolution UI
- Tombstone pattern (soft delete)
- Push notifications (WebSocket)

---

## 📚 Documentazione Creata

1. **ADR-003-bidirectional-sync.md**
   - Context: problema sync unidirezionale
   - Decision: sync bidirezionale + converter
   - Consequences: pro/contro
   - Alternatives considered

2. **CLEANUP_ROADMAP.md**
   - Piano 5 fasi pulizia ambiente
   - Checklist completa
   - SQL scripts ready
   - Test scenarios beta

3. **COMMIT_MESSAGES.md**
   - 7 commit preparati
   - Conventional commits format
   - Tagging strategy v1.0.0-beta.1
   - Rollback procedures

4. **SESSION_NOTES_20260208.md** (questo file)
   - Cronologia sessione
   - Bug investigation
   - Testing results
   - TODO items

---

## 🎯 Obiettivi Prossima Sessione (09/02)

### FASE 1: Database Cleanup
- [ ] Esegui SQL DELETE audit 3901, 3902
- [ ] Verifica FK dependencies (0 rows)
- [ ] Invalidate IndexedDB browser
- [ ] Hard refresh (Ctrl+Shift+R)
- [ ] Verifica dropdown: 2 audit

### FASE 2 (se tempo): Frontend Cleanup
- [ ] Grep search `DataContext` usage
- [ ] Se inutilizzato → DELETE file
- [ ] Rimuovi console.log ridondanti
- [ ] Fix manifest icon path

### Beta Test Validation
- [ ] Crea nuovo audit "Beta Test Industries 2026"
- [ ] Compila checklist sezione 4-5
- [ ] Test export Word
- [ ] Verifica sync offline→online

---

## 💡 Lessons Learned

1. **Service Worker può nascondere bug**
   - Serve sempre da cache anche dopo modifiche
   - Necessario unregister esplicito durante dev
   - In prod: versioning cache + auto-cleanup

2. **IndexedDB ≠ Single Source of Truth**
   - È una cache sincronizzata
   - Server deve essere fonte autorevole
   - Download periodico essenziale

3. **Formato backend ≠ frontend**
   - snake_case vs camelCase
   - Flat vs nested structure
   - Converter layer necessario

4. **Sync bidirezionale non triviale**
   - Merge strategy critica (server-wins)
   - Conflict resolution necessaria
   - Tombstone pattern per DELETE

5. **Testing multi-layer**
   - Database (SQL queries)
   - IndexedDB (Application tab)
   - React State (DevTools Components)
   - UI (dropdown visuale)
   - Tutti devono essere allineati

---

## 🔗 References

- ADR-001: Multi-Agent Workflow
- ADR-002: Offline-First Architecture
- ADR-003: Bidirectional Sync (NEW)
- DATABASE_SCHEMA.md v1.11
- TEST_REPORT_STEP_3.md
- CLEANUP_ROADMAP.md

---

## 📞 Handoff Notes

**Per il prossimo developer/sessione:**

1. **Contesto:** Bug sync risolto, ambiente quasi pronto per beta
2. **Immediate action:** Eseguire FASE 1 cleanup (SQL DELETE + cache invalidation)
3. **Expected result:** Dropdown con 2 audit sincronizzati
4. **Blockers:** Nessuno (ambiente funzionante)
5. **Documentation:** Tutto in CLEANUP_ROADMAP.md

**Comando rapido start:**
```bash
cd "OneDrive - QS Studio/Sistema Gestione ISO 9001"
code .

# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend
cd app
npm run dev

# Browser
http://localhost:3000
F12 → Console per log

# SSMS
Server: busato.selfip.com:11043
Database: SGQ_ISO9001
Auth: pascarella
```

**First task tomorrow:**
```sql
-- In SSMS
USE SGQ_ISO9001;
DELETE FROM audit_standards WHERE audit_id IN (3901, 3902);
DELETE FROM audits WHERE audit_id IN (3901, 3902);
SELECT * FROM audits WHERE audit_id >= 2000;
-- Expected: 2 rows (2004, 3845)
```

```javascript
// In Browser Console
indexedDB.deleteDatabase('SGQ_ISO9001');
localStorage.clear();
location.reload();
// Wait for reload, check dropdown → 2 audits
```

---

**Fine sessione:** 18:50  
**Prossima sessione:** 09/02/2026 mattina  
**Mood:** ✅ Produttiva, bug critico risolto!

🌙 Buonanotte!
