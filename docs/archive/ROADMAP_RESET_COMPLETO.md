# 🗺️ ROADMAP: Reset Completo Database + Cache Invalidation Automatica

**Data:** 15 febbraio 2026  
**Obiettivo:** Sistema pulito operativo + cache auto-sync robusta  
**Tempo stimato:** 2-3 ore

---

## 📊 STATO ATTUALE (14 febbraio ore 20:00)

### ✅ Completato
- Database production: **0 audits** (reset eseguito con successo)
- Backend: Running PID 155198, blacklist UUID attivo
- Constraint: `UQ_audits_uuid_org` attivo (previene duplicati)

### ❌ Problemi Aperti
1. **Desktop browser:** Sync queue persistente (3 item vecchi non cancellati)
2. **Rate limiter:** 429 Too Many Requests (scade dopo 15 min inattività)
3. **Mobile cache:** Non testato dopo reset database
4. **Cache invalidation:** Manuale (richiede script console ogni volta)

### 🎯 Obiettivi Sessione Domani
1. Pulizia completa cache desktop + mobile
2. Implementazione cache invalidation automatica (Service Worker v1.0.4)
3. Test workflow completo: Nuovo audit → Checklist → Offline sync
4. Validazione PWA su mobile (Android)
5. Deploy finale con auto-invalidation

---

## 🚀 FASE 1: Preparazione Ambiente (15 min)

### Pre-requisiti
- **Attendi 15+ minuti** dall'ultimo login fallito (rate limiter)
- Backend in esecuzione (verifica https://www.fr-busato.it:8443/api/v1/health)
- Database production: 0 audits (già verificato)

### Step 1.1: Verifica Backend Attivo

**SSH al server:**
```bash
ssh spascarella@www.fr-busato.it -p 1122
# Password SSH: solo da vault (rimossa da repo — non versionare segreti)
```

**Check processo node:**
```bash
ps aux | grep "node src/server.js" | grep -v grep
# Expected output: PID 155198 o superiore
```

**Se NON running:**
```bash
cd /var/www/sgq-backend
nohup node src/server.js > /dev/null 2>&1 &
ps aux | grep "node src/server.js" | grep -v grep
exit
```

### Step 1.2: Verifica Database Vuoto

**SSMS → Esegui:**
```sql
USE SGQ_ISO9001;
GO

SELECT COUNT(*) AS total_audits FROM audits;
SELECT COUNT(*) AS total_responses FROM audit_responses;
SELECT COUNT(*) AS total_standards FROM audit_standards;
SELECT COUNT(*) AS total_questions FROM checklist_questions WHERE standard_id = 1;
```

**Expected:**
- `total_audits`: **0**
- `total_responses`: **0**
- `total_standards`: **0**
- `total_questions`: **78** (ISO 9001 master data intatto)

**❌ Se total_questions = 0:** STOP - master data corrotto, restore necessario.

---

## 🧹 FASE 2: Pulizia Cache Desktop + Mobile (20 min)

### Step 2.1: Desktop - Script Pulizia Aggressiva

**Browser:** Apri https://systemgest.netlify.app  
**Console (F12):** Esegui questo script **PRIMA di fare login**:

```javascript
(async () => {
  console.log('🗑️ === PULIZIA AGGRESSIVA CACHE ===');
  
  // 1) Lista tutti i database IndexedDB
  const dbs = await indexedDB.databases();
  console.log('📂 Database trovati:', dbs.length);
  console.table(dbs);
  
  // 2) Cancella OGNI database (inclusa sync queue)
  for (const db of dbs) {
    console.log(`❌ Deleting: ${db.name} (version ${db.version})`);
    await indexedDB.deleteDatabase(db.name);
  }
  
  // 3) Verifica cancellazione completa
  const remaining = await indexedDB.databases();
  if (remaining.length === 0) {
    console.log('✅ Tutti i database IndexedDB cancellati');
  } else {
    console.error('⚠️ Database residui:', remaining);
  }
  
  // 4) Cancella storage
  localStorage.clear();
  sessionStorage.clear();
  console.log('✅ localStorage + sessionStorage cleared');
  
  // 5) Cancella cache assets
  const cacheNames = await caches.keys();
  console.log('📦 Cache trovate:', cacheNames.length);
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('✅ Cache assets cleared');
  
  // 6) Unregister Service Worker
  const registrations = await navigator.serviceWorker.getRegistrations();
  console.log('🔧 Service Workers:', registrations.length);
  await Promise.all(registrations.map(reg => reg.unregister()));
  console.log('✅ Service Workers unregistered');
  
  console.log('');
  console.log('✅ === PULIZIA COMPLETATA ===');
  console.log('⏳ Ricarico pagina in 3 secondi...');
  setTimeout(() => location.reload(), 3000);
})();
```

**Verifica Output Console:**
```
✅ Tutti i database IndexedDB cancellati
✅ localStorage + sessionStorage cleared
✅ Cache assets cleared
✅ Service Workers unregistered
✅ === PULIZIA COMPLETATA ===
```

**Dopo reload:**
- Pagina login visibile
- **NON fare login ancora** → Passa a Step 2.2

---

### Step 2.2: Mobile - Pulizia Manuale

**Android Chrome:**

1. **Apri:** https://systemgest.netlify.app (non fare login)
2. **Menu ⋮** → Impostazioni
3. **Privacy e sicurezza** → Cancella dati di navigazione
4. **Intervallo:** "Tutto"
5. **Seleziona TUTTO:**
   - ✅ Cronologia di navigazione
   - ✅ Cookie e dati dei siti
   - ✅ Immagini e file nella cache
   - ✅ Dati siti ospitati
6. **Cancella dati** → Conferma
7. **Chiudi Chrome completamente** (task switcher → swipe up)
8. **Attendi 10 secondi**
9. **Riapri Chrome** → https://systemgest.netlify.app

**Verifica:**
- Pagina login visibile
- PWA disinstallata (icona home screen rimossa)
- **NON fare login ancora** → Passa a FASE 3

---

## 🔧 FASE 3: Implementazione Cache Auto-Invalidation (45 min)

### Obiettivo
Evitare pulizia manuale cache quando database cambia. Implementiamo **2 livelli**:

1. **Service Worker Versioning** (invalida assets statici)
2. **Database Schema Version Check** (invalida dati IndexedDB)

---

### Step 3.1: Service Worker Versioning

**File:** `app/public/service-worker.js`

**Modifica:**

```javascript
// ========== VERSIONING CONFIGURATION ==========
const CACHE_VERSION = 'v1.0.4'; // ⬅️ Bump questa manualmente ad ogni deploy con breaking changes
const CACHE_NAME = `sgq-iso9001-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// ========== INSTALL (cache assets) ==========
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${CACHE_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // Force activate new SW
});

// ========== ACTIVATE (delete old caches) ==========
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${CACHE_VERSION}`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('sgq-iso9001-') && name !== CACHE_NAME)
          .map(name => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim(); // Activate immediately
});

// ========== FETCH (network-first per API, cache-first per assets) ==========
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Network-first per API (sempre dati aggiornati)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(err => {
          console.error('[SW] API fetch failed, offline:', err);
          return new Response(JSON.stringify({ 
            error: 'Offline - dati non disponibili' 
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // Cache-first per assets statici
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (response.ok) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        }
        return response;
      });
    })
  );
});

// ========== MESSAGE (notify clients of update) ==========
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

**Commit:**
```bash
git add app/public/service-worker.js
git commit -m "feat: Service Worker versioning v1.0.4 - auto cache invalidation"
```

---

### Step 3.2: Database Schema Version Check

**File:** `app/src/contexts/StorageContext.jsx`

**Trova funzione `loadAuditsFromServer` (circa linea 270):**

```javascript
const loadAuditsFromServer = async () => {
  try {
    const apiService = (await import('../services/apiService')).default;
    const converter = await import('../utils/auditConverter');
    
    // ========== NEW: Schema Version Check ==========
    const localSchemaVersion = localStorage.getItem('db_schema_version');
    const CURRENT_SCHEMA_VERSION = '2.1.0'; // ⬅️ Bump quando cambia struttura DB
    
    if (localSchemaVersion && localSchemaVersion !== CURRENT_SCHEMA_VERSION) {
      console.warn(`⚠️ Schema mismatch detected!`);
      console.warn(`   Local: ${localSchemaVersion}`);
      console.warn(`   Server: ${CURRENT_SCHEMA_VERSION}`);
      console.warn(`   → Clearing IndexedDB cache...`);
      
      // Clear IndexedDB
      await indexedDB.deleteDatabase('SGQ_ISO9001');
      
      // Update version
      localStorage.setItem('db_schema_version', CURRENT_SCHEMA_VERSION);
    } else if (!localSchemaVersion) {
      // First run - set version
      localStorage.setItem('db_schema_version', CURRENT_SCHEMA_VERSION);
    }
    // ========== END Schema Version Check ==========
    
    // Download audits from server
    const response = await apiService.getAudits();
    const serverAudits = converter.convertAuditsFromBackend(response.data);
    
    console.log(`✅ [DOWNLOAD] Scaricati ${serverAudits.length} audit dal server`);
    
    // Update IndexedDB with server data
    for (const audit of serverAudits) {
      await fsProvider.saveAudit(audit);
    }
    
    return serverAudits;
  } catch (error) {
    console.error('❌ [DOWNLOAD] Errore:', error);
    throw error;
  }
};
```

**Commit:**
```bash
git add app/src/contexts/StorageContext.jsx
git commit -m "feat: auto schema version check - clear IndexedDB on mismatch"
```

---

### Step 3.3: Frontend - Notify User on SW Update

**File:** `app/src/App.jsx`

**Aggiungi hook per Service Worker update detection:**

```javascript
import React, { useEffect, useState } from 'react';

function App() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  
  useEffect(() => {
    // Detect Service Worker update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW available
              console.log('🔄 Nuova versione disponibile');
              setUpdateAvailable(true);
            }
          });
        });
      });
    }
  }, []);
  
  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    window.location.reload();
  };
  
  return (
    <div className="App">
      {updateAvailable && (
        <div className="update-banner">
          <p>🔄 Nuova versione disponibile</p>
          <button onClick={handleUpdate}>Aggiorna Ora</button>
        </div>
      )}
      
      {/* ... rest of App */}
    </div>
  );
}
```

**CSS:** `app/src/App.css`

```css
.update-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #2196F3;
  color: white;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 9999;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.update-banner p {
  margin: 0;
  font-weight: 500;
}

.update-banner button {
  background: white;
  color: #2196F3;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.update-banner button:hover {
  background: #f0f0f0;
}
```

**Commit:**
```bash
git add app/src/App.jsx app/src/App.css
git commit -m "feat: auto update banner when new SW version available"
```

---

### Step 3.4: Deploy con Bump Versione

**Build + Test locale:**
```bash
cd app
npm run build
```

**Verifica output:**
- `dist/` folder creato
- Nessun errore build

**Git push:**
```bash
git push origin main
```

**Netlify auto-deploy:**
- Monitora: https://app.netlify.com/sites/systemgest/deploys
- Attendi "Published" (circa 2-3 minuti)

---

## ✅ FASE 4: Test Workflow Completo (30 min)

### Step 4.1: Login Desktop + Verifica Cache Pulita

**Browser:** https://systemgest.netlify.app  
**Login:**
- Email: `admin@sgq.local`
- Password ambiente di test: solo da vault (non in repository)

**Verifica Console (F12):**
```
✅ Login effettuato: Amministratore SGQ (admin)
📂 Caricati 0 audit da IndexedDB
🔄 [DOWNLOAD] Download audits dal server...
✅ [DOWNLOAD] Scaricati 0 audit dal server
🔄 [SYNC] Inizio processamento queue...
📋 [SYNC] Trovati 0 item in queue  ⬅️ DEVE ESSERE 0!
✅ [SYNC] Queue vuota
```

**❌ Se vedi ancora "Trovati 3 item in queue":**
```javascript
// Console - Force clear sync queue
(async () => {
  const db = await indexedDB.databases();
  console.log('DB esistenti:', db);
  await indexedDB.deleteDatabase('SGQ_ISO9001');
  location.reload();
})();
```

**Verifica UI:**
- Dropdown audit: **"-- Seleziona un audit --"** (vuoto)
- Nessun audit nella lista

---

### Step 4.2: Crea Nuovo Audit Desktop

**Click:** "+ Nuovo Audit"

**Form:**
- **Cliente:** Test Reset Completo 2026
- **Numero Audit:** 2026-03
- **Anno:** 2026
- **Data Audit:** 15/02/2026
- **Auditor:** Mario Rossi
- **Tipo:** Interno
- **Stato:** Bozza

**Click:** "Salva"

**Verifica Console:**
```
✅ [CREATE] Nuovo audit creato: 2026-03
🔄 [SYNC] Aggiunto a queue: create_audit
🌐 [API] POST /audits/sync
✅ [SYNC] Audit sincronizzato: 2026-03 (audit_id: XXXX)
```

**Verifica UI:**
- Audit appare nel dropdown
- Status: "Bozza"

---

### Step 4.3: Seleziona ISO 9001 Standard

**Apri audit creato** → Click nome nel dropdown

**Vai a:** "Dati Generali" → Sezione "1.1 Dati Generali"

**Scroll:** Trova "Standard Applicabili"

**Click:** Icona matita (edit) accanto a "Standard Applicabili"

**Modal aperta:**
- ✅ Checkbox: **ISO 9001:2015 Qualità**
- Click fuori dal modal per chiudere (auto-save)

**Verifica Console:**
```
✅ [UPDATE] Standard salvati per audit: 2026-03
🔄 [SYNC] Aggiunto a queue: update_audit_standards
🌐 [API] POST /audits/sync
✅ [SYNC] Standards sincronizzati
```

---

### Step 4.4: Verifica Checklist Generata

**Vai a:** Sezione "Checklist"

**Verifica UI:**
- ✅ **Titolo visibile:** "Checklist ISO 9001:2015"
- ✅ **Clause 4 visibile:** "4. Contesto dell'organizzazione"
- ✅ **Domanda 4.1 visibile:** "Comprendere l'organizzazione e il suo contesto"
- ✅ **Opzioni risposta:**
  - 🟢 C - Conforme
  - 🔴 NC - Non Conforme
  - 🟡 OSS - Osservazione
  - 🟠 OM - Opportunità di Miglioramento
  - ⚪ NA - Non Applicabile
  - ⚫ NV - Non Verificato

**❌ Se vedi "Nessuno standard selezionato":**

**Check database SSMS:**
```sql
SELECT a.audit_id, a.audit_number, ast.standard_id
FROM audits a
LEFT JOIN audit_standards ast ON a.audit_id = ast.audit_id
WHERE a.audit_number = '2026-03';
```

**Expected:**
- `audit_id`: XXXX (not null)
- `standard_id`: 1 (ISO 9001)

**Se standard_id = NULL:**
- Problema sync backend → Check backend logs
- Riprova selezione standard

---

### Step 4.5: Test Risposta Checklist

**Click domanda 4.1:** "Comprendere l'organizzazione e il suo contesto"

**Seleziona:** 🟢 **C - Conforme**

**Aggiungi nota (opzionale):**
- "Organizzazione ben definita con organigramma chiaro"

**Verifica Console:**
```
✅ [RESPONSE] Risposta salvata: 4.1 → C
🔄 [SYNC] Aggiunto a queue: create_audit_response
🌐 [API] POST /audits/sync
✅ [SYNC] Risposta sincronizzata
```

**Verifica UI:**
- Indicatore risposta: 🟢 (verde)
- Contatore: "1/78 domande" aggiornato
- Percentage: "1.3%" (circa)

---

### Step 4.6: Verifica Database Aggiornato

**SSMS:**
```sql
-- Check audit creato
SELECT audit_id, audit_number, client_name, status, total_questions, answered_questions
FROM audits
WHERE audit_number = '2026-03';

-- Check standard linkato
SELECT * FROM audit_standards
WHERE audit_id = (SELECT audit_id FROM audits WHERE audit_number = '2026-03');

-- Check risposta salvata
SELECT ar.response_id, ar.audit_id, ar.question_id, ar.response_value, ar.notes
FROM audit_responses ar
WHERE ar.audit_id = (SELECT audit_id FROM audits WHERE audit_number = '2026-03');
```

**Expected:**
- 1 audit: `2026-03, Test Reset Completo 2026, status=draft`
- 1 standard: `standard_id=1` (ISO 9001)
- 1 response: `question_id=XXX, response_value='C'`

---

## 📱 FASE 5: Test Mobile PWA (30 min)

### Step 5.1: Login Mobile + Sync Download

**Android Chrome:** https://systemgest.netlify.app

**Login:**
- Email: `admin@sgq.local`
- Password ambiente di test: solo da vault (non in repository)

**Verifica Console (Eruda 🔧):**
```
✅ Login effettuato
🔄 [DOWNLOAD] Download audits dal server...
✅ [DOWNLOAD] Scaricati 1 audit dal server  ⬅️ L'audit creato su desktop!
✅ [MERGE] 1 audit salvati in IndexedDB
```

**Verifica UI:**
- Dropdown: "2026-03 - Test Reset Completo 2026" visibile
- Status: Bozza

---

### Step 5.2: Reinstalla PWA

**Menu ⋮** → "Aggiungi a schermata Home"

**Popup:**
- Nome: "SGQ ISO 9001"
- Icona: Logo app
- Click: **"Aggiungi"**

**Home screen Android:**
- ✅ Icona "SGQ ISO 9001" comparsa
- Click icona → App si apre in **standalone mode** (no browser UI)

---

### Step 5.3: Test Offline Mode

**1) Apri audit in PWA:**
- Click "2026-03 - Test Reset Completo 2026"
- Vai a "Checklist"

**2) Abilita Airplane Mode:** ✈️
- Swipe down notification panel
- Click icona Airplane Mode

**3) Modifica offline:**
- Click domanda "4.2 Comprendere le esigenze..."
- Seleziona: 🟢 **C - Conforme**
- Nota: "Test modifica offline"

**Verifica Console (Eruda):**
```
✅ [RESPONSE] Risposta salvata LOCAL: 4.2 → C
🔄 [SYNC] Queue aggiunta (offline): create_audit_response
⚠️ [SYNC] Offline - sync rinviato
```

**Verifica UI:**
- Indicatore: ⚠️ "Offline - 1 modifica in queue"
- Risposta salvata localmente (verde)

---

### Step 5.4: Test Sync Automatico (Online)

**1) Disabilita Airplane Mode:** (Wi-Fi/4G attivo)

**2) Attendi 30 secondi** (auto-sync interval)

**Verifica Console:**
```
🌐 [SYNC] Rilevata connessione
🔄 [SYNC] Processamento queue...
📋 [SYNC] Trovati 1 item in queue
🌐 [API] POST /audits/sync
✅ [SYNC] Risposta sincronizzata: 4.2
✅ [SYNC] Queue svuotata - 1/1 successo
```

**Verifica UI:**
- Indicatore offline: ❌ Scomparso
- Icona sync: ✅ Verde (sincronizzato)

---

### Step 5.5: Verifica Cross-Device Sync

**Desktop browser:** Ricarica pagina (F5)

**Apri stesso audit:** "2026-03 - Test Reset Completo 2026"

**Vai a Checklist:**

**Verifica:**
- ✅ Domanda 4.1: 🟢 Conforme (creata da desktop)
- ✅ Domanda 4.2: 🟢 Conforme (creata da mobile offline!)

**Console Desktop:**
```
🔄 [DOWNLOAD] Download audits dal server...
✅ [DOWNLOAD] Scaricati 1 audit dal server
✅ [DOWNLOAD] Risposte aggiornate: 2/78
```

**✅ SUCCESS:** Sync bidirezionale funzionante!

---

## 🐛 FASE 6: Troubleshooting Common Issues (Riferimento)

### Issue 1: "Trovati X item in queue" dopo pulizia

**Causa:** Sync queue database separato non cancellato

**Fix:**
```javascript
// Console
(async () => {
  const dbs = await indexedDB.databases();
  console.table(dbs);
  for (const db of dbs) {
    await indexedDB.deleteDatabase(db.name);
  }
  location.reload();
})();
```

---

### Issue 2: Rate Limiter 429 "Too Many Requests"

**Causa:** Troppi tentativi login (5+ in 15 minuti)

**Fix:**
- **Opzione A:** Attendi 15 minuti senza login
- **Opzione B:** Riavvia backend (reset rate limiter):
  ```bash
  ssh spascarella@www.fr-busato.it -p 1122
  ps aux | grep "node src/server.js" | grep -v grep
  kill <PID>
  cd /var/www/sgq-backend
  nohup node src/server.js > /dev/null 2>&1 &
  ```

---

### Issue 3: Checklist non generata ("Nessuno standard selezionato")

**Debug:**

1. **Check browser console:**
   ```
   Cerca errore: "Failed to load questions"
   ```

2. **Check database SSMS:**
   ```sql
   SELECT * FROM audit_standards WHERE audit_id = XXX;
   -- Expected: 1 row con standard_id=1
   
   SELECT COUNT(*) FROM checklist_questions WHERE standard_id = 1;
   -- Expected: 78
   ```

3. **Se audit_standards vuoto:**
   - Riprova selezione standard nel modal
   - Check console per errore sync

4. **Se checklist_questions =  0:**
   - ❌ **CRITICAL:** Master data corrotto
   - Restore backup o re-seed database

---

### Issue 4: Sync loop infinito (duplicate re-upload)

**Causa:** Blacklist UUID scaduta o cache non pulita

**Fix:**

1. **Check backend blacklist attivo:**
   ```bash
   ssh spascarella@www.fr-busato.it -p 1122
   grep -n "BLACKLISTED_UUIDS" /var/www/sgq-backend/src/controllers/audit.controller.js
   # Expected: lines 628-642 con audit-002, audit-003
   ```

2. **Rimuovi UUID dalla blacklist** (se audit non esistono più nel DB):
   - Edit `backend/src/controllers/audit.controller.js`
   - Rimuovi UUID obsoleti dall'array
   - SCP deploy + backend restart

3. **Constraint database attivo:**
   ```sql
   SELECT name, definition FROM sys.check_constraints
   WHERE parent_object_id = OBJECT_ID('audits');
   -- Expected: UQ_audits_uuid_org
   ```

---

### Issue 5: PWA non si installa su mobile

**Debug:**

1. **Check HTTPS attivo:**
   - URL deve essere `https://systemgest.netlify.app` (non http)

2. **Check manifest.json:**
   ```javascript
   // Console mobile
   fetch('/manifest.json').then(r => r.json()).then(console.log);
   // Expected: {name, short_name, icons, start_url, display: "standalone"}
   ```

3. **Check Service Worker registrato:**
   ```javascript
   navigator.serviceWorker.getRegistration().then(reg => {
     console.log('SW active:', reg?.active?.state);
   });
   // Expected: "activated"
   ```

4. **Force re-register SW:**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(regs => {
     return Promise.all(regs.map(r => r.unregister()));
   }).then(() => {
     return navigator.serviceWorker.register('/service-worker.js');
   }).then(() => location.reload());
   ```

---

## 📝 FASE 7: Deploy Finale + Documentazione (20 min)

### Step 7.1: Git Commit Finale

**Check status:**
```bash
git status
# Should show modified:
# - app/public/service-worker.js
# - app/src/contexts/StorageContext.jsx
# - app/src/App.jsx
# - app/src/App.css
```

**Commit all changes:**
```bash
git add -A
git commit -m "feat: auto cache invalidation system

- Service Worker versioning v1.0.4 (auto delete old caches)
- Database schema version check (auto clear IndexedDB on mismatch)
- Update banner UI when new SW available
- User-friendly reload workflow

Closes: cache manual cleanup issue
Refs: ADR-004 (offline-first cache strategy)"
```

---

### Step 7.2: Push + Netlify Deploy

```bash
git push origin main
```

**Monitora deploy:**
- https://app.netlify.com/sites/systemgest/deploys
- Attendi "✅ Published"

**Test post-deploy:**
1. Desktop: Ricarica https://systemgest.netlify.app
2. Console: Vedi `[SW] Installing version v1.0.4`
3. Banner: Appare "🔄 Nuova versione disponibile"
4. Click "Aggiorna Ora" → Reload automatico
5. Verifica versione: `localStorage.getItem('db_schema_version')` → `"2.1.0"`

---

### Step 7.3: Aggiorna Documentazione

**File:** `docs/SESSION_NOTES_20260215.md` (creare domani)

**Sezioni:**
- Timeline sessione (start/end time)
- Problemi risolti (sync queue, rate limiter, cache manual)
- Codice modificato (service-worker.js, StorageContext.jsx, App.jsx)
- Test eseguiti (desktop workflow, mobile offline, cross-device sync)
- Metriche (DB: 1 audit, 2 responses, 1 standard; Tempo sessione: 2-3h)
- Lessons learned (IndexedDB multiple databases, SW versioning strategy)
- Next steps (FASE 2 cleanup, mobile layout fix, PM2 cluster)

---

### Step 7.4: Update CLEANUP_ROADMAP.md

**Marca completato:**

```markdown
## ✅ FASE 1: Database + Cache Cleanup (COMPLETATA 15/02/2026)

- [x] Reset database completo (0 audits)
- [x] Pulizia cache desktop + mobile (IndexedDB, localStorage, SW)
- [x] Service Worker versioning (v1.0.4)
- [x] Database schema version check (auto-invalidation)
- [x] Test workflow completo (audit → standard → checklist → response)
- [x] Test PWA offline mode (airplane mode + auto-sync)
- [x] Deploy produzione Netlify

**Durata:** 2.5 ore  
**Commit:** [hash]  
**Deploy:** https://systemgest.netlify.app
```

---

## ✅ CHECKLIST FINALE VALIDAZIONE

Prima di chiudere sessione, verifica **TUTTI** questi punti:

### Database
- [ ] `SELECT COUNT(*) FROM audits` → **1** (Test Reset Completo 2026)
- [ ] `SELECT COUNT(*) FROM audit_standards` → **1** (ISO 9001 linkato)
- [ ] `SELECT COUNT(*) FROM audit_responses` → **2** (4.1 desktop, 4.2 mobile)
- [ ] `SELECT COUNT(*) FROM checklist_questions WHERE standard_id=1` → **78**

### Desktop Browser
- [ ] Console: `📋 [SYNC] Trovati 0 item in queue`
- [ ] Dropdown: "2026-03 - Test Reset Completo 2026" visibile
- [ ] Checklist: Clause 4 con domande visibili
- [ ] Risposte: 4.1 🟢, 4.2 🟢
- [ ] Service Worker: `[SW] v1.0.4 active`
- [ ] Schema version: `localStorage.getItem('db_schema_version')` → `"2.1.0"`

### Mobile PWA
- [ ] Installato: Icona "SGQ ISO 9001" su home screen
- [ ] Standalone mode: Nessun browser UI (barra indirizzo/tab/menu)
- [ ] Sync download: "✅ Scaricati 1 audit dal server"
- [ ] Checklist: Risposte desktop visibili (4.1, 4.2)
- [ ] Offline mode: Modifica salvata in queue
- [ ] Online sync: Queue processata automaticamente

### Backend Production
- [ ] Process running: `ps aux | grep node` → PID attivo
- [ ] Health check: `curl https://www.fr-busato.it:8443/api/v1/health` → 200 OK
- [ ] Blacklist attivo: UUID audit-002, audit-003 rifiutati (403)
- [ ] Rate limiter: < 5 login tentativi recenti

### Git Repository
- [ ] Commit: "feat: auto cache invalidation system" pushed
- [ ] Files: service-worker.js, StorageContext.jsx, App.jsx, App.css
- [ ] Branch: `main` aggiornato
- [ ] Netlify: Deploy successful

---

## 📊 METRICHE SUCCESSO

### Performance
- **Time to First Audit:** < 10 secondi (login → dropdown caricato)
- **Sync Latency:** < 3 secondi (offline → online → sync completed)
- **Cache Hit Rate:** > 90% (assets statici serviti da SW cache)

### Funzionalità
- **Cross-Device Sync:** ✅ Desktop ↔ Mobile (bidirezionale)
- **Offline Resilience:** ✅ Modifiche persistono durante offline
- **Auto Cache Update:** ✅ Schema change invalida cache automaticamente

### User Experience
- **Manual Intervention:** ❌ Zero (no script console necessari)
- **Update Friction:** ⚠️ 1 click ("Aggiorna Ora" button)
- **Data Loss Risk:** ❌ Zero (server-wins + sync queue)

---

## 🚀 NEXT STEPS (Sessione Futura)

### Alta Priorità
1. **Mobile Layout Fix:** Banner blu testo domanda posizionamento
2. **FASE 2 Cleanup:** console.log, MOCK_AUDITS, CSS duplicati
3. **Bundle Optimization:** Code-split docx/file-saver (ridurre 720KB)

### Media Priorità
4. **PM2 Cluster:** Zero-downtime backend restart
5. **Incremental Sync:** `GET /audits?since=timestamp` (ridurre bandwidth)
6. **Conflict Resolution UI:** Dialog mostra diff desktop vs mobile

### Bassa Priorità
7. **Remove Blacklist UUID:** (dopo 2-3 settimane cache cleared)
8. **CI/CD Backend:** GitHub Actions → SSH auto-deploy
9. **Service Worker Analytics:** Track cache hit/miss rates

---

## 📞 SUPPORT REFERENCE

### SSH Backend
```bash
ssh spascarella@www.fr-busato.it -p 1122
Password SSH: solo da vault (non in repository)
Path: /var/www/sgq-backend/
```

### Database
```
Server: www.fr-busato.it,11043
Database: SGQ_ISO9001
Auth: Windows Authentication
```

### Netlify
- Site: https://systemgest.netlify.app
- Deploy: https://app.netlify.com/sites/systemgest/deploys
- Build: `npm run build` in `app/` directory

### Rate Limiter
- **Login:** 5 tentativi / 15 minuti
- **Reset:** Riavvia backend o attendi 15 min

---

**Fine Roadmap** 🎉

**Prossima sessione:** Segui FASE 1 step-by-step, valida con checklist finale, procedi a NEXT STEPS.
