# 🛠️ Mobile Debug Utils - Console Commands

Comandi utili da eseguire in **Eruda Console** (mobile) o **DevTools** (desktop).

---

## 📊 STATO SYNC QUEUE

### Verifica Numero Item in Queue

```javascript
// Apri IndexedDB e conta item
const dbRequest = indexedDB.open('SGQ_ISO9001', 2);
dbRequest.onsuccess = () => {
    const db = dbRequest.result;
    const tx = db.transaction(['sync_queue'], 'readonly');
    const store = tx.objectStore('sync_queue');
    const countRequest = store.count();
    countRequest.onsuccess = () => {
        console.log(`📋 Sync Queue: ${countRequest.result} item`);
    };
};
```

### Lista Tutti gli Item in Queue

```javascript
const dbRequest = indexedDB.open('SGQ_ISO9001', 2);
dbRequest.onsuccess = () => {
    const db = dbRequest.result;
    const tx = db.transaction(['sync_queue'], 'readonly');
    const store = tx.objectStore('sync_queue');
    const getAllRequest = store.getAll();
    getAllRequest.onsuccess = () => {
        console.table(getAllRequest.result.map(item => ({
            id: item.id,
            type: item.type,
            audit_uuid: item.payload?.audit_uuid,
            audit_number: item.payload?.audit_number,
            client_name: item.payload?.client_name,
            retry: item.retryCount,
            error: item.lastError?.substring(0, 50)
        })));
    };
};
```

---

## 🧹 PULIZIA SYNC QUEUE

### Pulisci Audit Malformati (Automatico)

```javascript
// Usa il metodo built-in del SyncService
import { syncService } from './services/syncService.js';

syncService.cleanMalformedAudits()
    .then(count => console.log(`✅ Rimossi ${count} audit malformati`))
    .catch(err => console.error('❌ Errore:', err));
```

**Alternativa rapida** (se syncService non disponibile in scope):

```javascript
// DevTools console (esegui da window context)
window.syncService.cleanMalformedAudits()
    .then(count => console.log(`✅ Rimossi ${count} audit malformati`))
    .catch(err => console.error('❌ Errore:', err));
```

### Reset Completo Sync Queue (⚠️ PERICOLOSO)

```javascript
// ATTENZIONE: Elimina TUTTI gli item in queue (anche quelli validi)
const dbRequest = indexedDB.open('SGQ_ISO9001', 2);
dbRequest.onsuccess = () => {
    const db = dbRequest.result;
    const tx = db.transaction(['sync_queue'], 'readwrite');
    const store = tx.objectStore('sync_queue');
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
        console.log('✅ Sync queue svuotata completamente');
    };
};
```

---

## 🔍 DEBUG AUDIT SPECIFICO

### Verifica Audit in IndexedDB

```javascript
const dbRequest = indexedDB.open('SGQ_ISO9001', 2);
dbRequest.onsuccess = () => {
    const db = dbRequest.result;
    const tx = db.transaction(['audits'], 'readonly');
    const store = tx.objectStore('audits');
    const getAllRequest = store.getAll();
    getAllRequest.onsuccess = () => {
        console.log(`📂 Audit in IndexedDB: ${getAllRequest.result.length}`);
        console.table(getAllRequest.result.map(a => ({
            id: a.id,
            audit_uuid: a.audit_uuid,
            audit_number: a.audit_number,
            client: a.client_name,
            status: a.status,
            synced: a.metadata?.synced ? '✅' : '❌'
        })));
    };
};
```

### Verifica Campi Obbligatori Audit

```javascript
const auditId = 'audit-001-rp-2025'; // ← Sostituisci con ID audit

const dbRequest = indexedDB.open('SGQ_ISO9001', 2);
dbRequest.onsuccess = () => {
    const db = dbRequest.result;
    const tx = db.transaction(['audits'], 'readonly');
    const store = tx.objectStore('audits');
    const getRequest = store.get(auditId);
    getRequest.onsuccess = () => {
        const audit = getRequest.result;
        if (!audit) {
            console.error('❌ Audit non trovato:', auditId);
            return;
        }
        
        const required = {
            audit_uuid: audit.audit_uuid,
            audit_number: audit.audit_number,
            client_name: audit.client_name
        };
        
        const missing = Object.keys(required).filter(k => !required[k]);
        
        if (missing.length > 0) {
            console.error('❌ Campi obbligatori MANCANTI:', missing);
        } else {
            console.log('✅ Audit valido:', required);
        }
    };
};
```

---

## 📤 FORCE SYNC MANUALE

### Trigger Sync Queue Manuale

```javascript
// Forza processamento sync queue (se sync automatico bloccato)
window.syncService.processQueue()
    .then(() => console.log('✅ Sync completata'))
    .catch(err => console.error('❌ Sync fallita:', err));
```

### Test Sync Audit Singolo

```javascript
const auditData = {
    audit_uuid: 'test-uuid-123',
    audit_number: 'AUD-TEST-001',
    client_name: 'Test Client',
    project_year: 2026,
    audit_date: new Date().toISOString(),
    status: 'draft',
    total_questions: 78,
    answered_questions: 0
};

window.syncService.syncUpsertAudit(auditData)
    .then(result => console.log('✅ Sync OK:', result))
    .catch(err => console.error('❌ Sync FAIL:', err));
```

---

## 🔧 RESET COMPLETO STORAGE (⚠️ DISTRUTTIVO)

### Reset IndexedDB + LocalStorage

```javascript
// ATTENZIONE: Elimina TUTTI i dati offline (audit, risposte, queue)
async function resetAllStorage() {
    // 1. Clear LocalStorage
    localStorage.clear();
    console.log('✅ LocalStorage cleared');
    
    // 2. Delete IndexedDB
    const deleteRequest = indexedDB.deleteDatabase('SGQ_ISO9001');
    deleteRequest.onsuccess = () => {
        console.log('✅ IndexedDB eliminato');
        console.log('🔄 Ricarica la pagina per reinizializzare');
    };
    deleteRequest.onerror = () => {
        console.error('❌ Errore eliminazione IndexedDB');
    };
}

// Esegui con conferma
if (confirm('⚠️ ATTENZIONE: Eliminare TUTTI i dati offline?')) {
    resetAllStorage();
}
```

---

## 📊 MONITORAGGIO SYNC STATUS

### Verifica Last Sync Timestamp

```javascript
const syncStatus = JSON.parse(localStorage.getItem('sync_status') || '{}');
if (syncStatus.lastSync) {
    const lastSyncDate = new Date(syncStatus.lastSync);
    const minutesAgo = Math.floor((Date.now() - syncStatus.lastSync) / 60000);
    console.log(`🕐 Ultimo sync: ${lastSyncDate.toLocaleString()} (${minutesAgo} minuti fa)`);
    console.log(`📊 Status: ${syncStatus.status}`);
    console.log(`📦 Item processati: ${syncStatus.itemsProcessed}`);
} else {
    console.log('⚠️ Nessun sync eseguito');
}
```

### Auto-Refresh Sync Status (Live Monitor)

```javascript
// Monitor sync status ogni 5 secondi
let monitorInterval = setInterval(() => {
    const syncStatus = JSON.parse(localStorage.getItem('sync_status') || '{}');
    const dbRequest = indexedDB.open('SGQ_ISO9001', 2);
    dbRequest.onsuccess = () => {
        const db = dbRequest.result;
        const tx = db.transaction(['sync_queue'], 'readonly');
        const store = tx.objectStore('sync_queue');
        const countRequest = store.count();
        countRequest.onsuccess = () => {
            console.log(`📊 [${new Date().toLocaleTimeString()}] Queue: ${countRequest.result} | Last: ${syncStatus.status || 'N/A'}`);
        };
    };
}, 5000);

// Per fermare il monitor:
// clearInterval(monitorInterval);
```

---

## 🧪 TEST API ENDPOINT

### Test Backend Sync Endpoint

```javascript
// Test POST /api/v1/audits/sync con audit valido
const testAudit = {
    audit_uuid: `test-${Date.now()}`,
    audit_number: `AUD-TEST-${Date.now()}`,
    client_name: 'Test Client Mobile',
    project_year: 2026,
    audit_date: new Date().toISOString(),
    auditor_name: 'Test User',
    audit_type: 'internal',
    status: 'draft',
    total_questions: 78,
    answered_questions: 0,
    standard_id: 1
};

fetch('https://busato.selfip.com:8443/api/v1/audits/sync', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    },
    body: JSON.stringify(testAudit)
})
.then(r => r.json())
.then(data => console.log('✅ Sync OK:', data))
.catch(err => console.error('❌ Sync FAIL:', err));
```

---

## 📝 NOTE

### Quando Usare cleanMalformedAudits()

Esegui dopo:
- Errori 400 "Campi obbligatori mancanti" ripetuti
- Dopo migration database che cambia schema audit
- Dopo recovery da crash app

### Quando Usare Reset Completo

Solo in caso di:
- Corruzione IndexedDB irrecuperabile
- Test ambiente di sviluppo
- Reset definitivo app (⚠️ perdi TUTTI i dati offline)

---

**Autore**: Sistema Gestione ISO 9001 - QS Studio  
**Data**: 6 Febbraio 2026  
**Versione**: 1.0
