# 📖 Sistema Gestione ISO 9001 - Reference Guide

**Last Updated:** 2026-02-15  
**Purpose:** Informazioni statiche riutilizzabili per operazioni comuni

---

## 🔐 Production Environment

### Backend Server
```
Host: www.fr-busato.it
Port HTTPS: 8443
API Base: https://www.fr-busato.it:8443/api/v1
Health Check: https://www.fr-busato.it:8443/api/v1/health
```

### SSH Access
```bash
Host: www.fr-busato.it
Port: 1122
User: spascarella
Backend Path: /var/www/sgq-backend/
```

**Autenticazione:** chiave SSH, **Pageant**, oppure sessione **PuTTY** salvata (variabile `SGQ_PUTTY_SESSION` nello script `backend/scripts/deploy-controllers-to-vps.ps1`). Non versionare password SSH.

**Quick Connect:**
```bash
ssh spascarella@www.fr-busato.it -p 1122
```

### Database (SQL Server Express)
```
Server: www.fr-busato.it,11043
Database: SGQ_ISO9001
Authentication: Windows Authentication
User: spascarella
```

**SSMS Connection String:**
```
Server=www.fr-busato.it,11043;Database=SGQ_ISO9001;Integrated Security=false;User Id=spascarella;
```

### Netlify Deployment
```
Site Name: systemgest
URL Production: https://systemgest.netlify.app
Admin Panel: https://app.netlify.com/sites/systemgest/deploys
Build Command: npm run build
Publish Directory: dist/
Base Directory: app/
Node Version: 20
NPM Version: 10
```

**Auto-Deploy:** Push to `main` branch triggers automatic deploy (2-3 min)

---

## 🔧 Common Operations

### Backend Restart (SSH Required)

**Check Process Status:**
```bash
ssh spascarella@www.fr-busato.it -p 1122
ps aux | grep "node src/server.js" | grep -v grep
# Output: spascarella 155198 ... node src/server.js
```

**Kill Process:**
```bash
kill 155198  # Replace with actual PID from ps output
```

**Start Backend (Detached):**
```bash
cd /var/www/sgq-backend
nohup node src/server.js > /dev/null 2>&1 &
```

**Verify Running:**
```bash
ps aux | grep "node src/server.js" | grep -v grep
# Verify new PID appears
exit
```

**Alternative - One-Liner Restart:**
```bash
ssh spascarella@www.fr-busato.it -p 1122 "cd /var/www/sgq-backend && pkill -f 'node src/server.js' && nohup node src/server.js > /dev/null 2>&1 &"
```

---

### Backend Deploy (SCP File Transfer)

**Transfer Single File:**
```bash
scp -P 1122 backend/src/controllers/audit.controller.js spascarella@www.fr-busato.it:/var/www/sgq-backend/src/controllers/
```

**Transfer Multiple Files:**
```bash
scp -P 1122 -r backend/src/services/* spascarella@www.fr-busato.it:/var/www/sgq-backend/src/services/
```

**Verify Transfer + Restart:**
```bash
ssh spascarella@www.fr-busato.it -p 1122
cd /var/www/sgq-backend
ls -lah src/controllers/audit.controller.js  # Verify timestamp updated
pkill -f 'node src/server.js'
nohup node src/server.js > /dev/null 2>&1 &
exit
```

---

### Database Operations (SSMS)

**Reset All Audit Data (Keep Master Data):**
```sql
USE SGQ_ISO9001;
GO

-- Delete audit operational data
DELETE FROM audit_responses;
DELETE FROM audit_standards;
DELETE FROM audit_history;
DELETE FROM attachments;
DELETE FROM sync_metadata;
DELETE FROM non_conformities;
DELETE FROM audits;

-- Verify cleanup
SELECT COUNT(*) AS total_audits FROM audits;
SELECT COUNT(*) AS total_responses FROM audit_responses;
-- Expected: 0, 0
```

**Verify Master Data Intact:**
```sql
-- ISO 9001 Standard
SELECT standard_id, name, version 
FROM standards 
WHERE standard_id = 1;
-- Expected: 1 row (ISO 9001:2015 Qualità)

-- Checklist Questions
SELECT COUNT(*) AS total_questions 
FROM checklist_questions 
WHERE standard_id = 1;
-- Expected: 78

-- Checklist Sections
SELECT COUNT(*) AS total_sections 
FROM checklist_sections 
WHERE standard_id = 1;
-- Expected: 10 (clause 4-10)
```

**Check Specific Audit:**
```sql
-- Audit with standards and responses
SELECT 
    a.audit_id,
    a.audit_number,
    a.client_name,
    a.status,
    ast.standard_id,
    s.name AS standard_name,
    COUNT(ar.response_id) AS total_responses
FROM audits a
LEFT JOIN audit_standards ast ON a.audit_id = ast.audit_id
LEFT JOIN standards s ON ast.standard_id = s.standard_id
LEFT JOIN audit_responses ar ON a.audit_id = ar.audit_id
WHERE a.audit_number = '2026-03'
GROUP BY a.audit_id, a.audit_number, a.client_name, a.status, ast.standard_id, s.name;
```

**Delete Specific Audit:**
```sql
DECLARE @audit_id INT = (SELECT audit_id FROM audits WHERE audit_number = '2026-03');

DELETE FROM audit_responses WHERE audit_id = @audit_id;
DELETE FROM audit_standards WHERE audit_id = @audit_id;
DELETE FROM audit_history WHERE audit_id = @audit_id;
DELETE FROM attachments WHERE audit_id = @audit_id;
DELETE FROM audits WHERE audit_id = @audit_id;
```

---

### Frontend Cache Clear (Browser Console)

**Full Cache Clear (Desktop/Mobile):**
```javascript
(async () => {
  console.log('🧹 Clearing all cache...');
  
  // 1) IndexedDB (all databases)
  const dbs = await indexedDB.databases();
  for (const db of dbs) {
    console.log(`Deleting DB: ${db.name}`);
    await indexedDB.deleteDatabase(db.name);
  }
  
  // 2) localStorage + sessionStorage
  localStorage.clear();
  sessionStorage.clear();
  
  // 3) Cache API (assets)
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  
  // 4) Service Worker
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(reg => reg.unregister()));
  
  console.log('✅ Cache cleared - reloading...');
  setTimeout(() => location.reload(), 2000);
})();
```

**Verify Cache Cleared:**
```javascript
// After reload, check:
(async () => {
  const dbs = await indexedDB.databases();
  console.log('Databases:', dbs.length); // Expected: 0 (dopo primo login: 1)
  
  const caches = await caches.keys();
  console.log('Caches:', caches.length); // Expected: 0-1
  
  console.log('localStorage keys:', Object.keys(localStorage).length); // Expected: 0-2
})();
```

---

### Netlify Deploy (Git Workflow)

**Local Build Test:**
```bash
cd app
npm run build
# Verify no errors, dist/ folder created
```

**Deploy to Production:**
```bash
git add -A
git commit -m "feat: description of changes"
git push origin main
```

**Monitor Deploy:**
1. Open: https://app.netlify.com/sites/systemgest/deploys
2. Latest deploy: Status "Building" → "Published" (2-3 min)
3. Check logs if failed
4. Test: https://systemgest.netlify.app

**Manual Trigger Deploy (if auto-deploy fails):**
- Netlify Admin → Deploys → Trigger deploy → Deploy site

---

## 🐛 Known Issues & Quick Fixes

### Issue 1: Sync Queue Persistent After Cache Clear

**Symptom:**
```
Console: 📋 [SYNC] Trovati 3 item in queue
(expected: 0 item dopo cache clear)
```

**Root Cause:** Sync queue stored in separate IndexedDB database not deleted

**Fix:**
```javascript
// Console - Force clear ALL IndexedDB databases
(async () => {
  const dbs = await indexedDB.databases();
  console.log('Found databases:', dbs);
  for (const db of dbs) {
    console.log(`Deleting: ${db.name}`);
    await indexedDB.deleteDatabase(db.name);
  }
  console.log('All databases deleted');
  location.reload();
})();
```

---

### Issue 2: Rate Limiter "429 Too Many Requests"

**Symptom:**
```
POST /auth/login 429 (Forbidden)
Error: Troppi tentativi di login. Riprova tra 15 minuti.
```

**Root Cause:** 5+ login attempts in 15 minutes window

**Fix Option A - Wait:**
- Wait 15 minutes without login attempts
- Rate limiter window expires automatically

**Fix Option B - Backend Restart (RECOMMENDED):**
```bash
ssh spascarella@www.fr-busato.it -p 1122
pkill -f 'node src/server.js'
cd /var/www/sgq-backend
nohup node src/server.js > /dev/null 2>&1 &
exit
```

**Fix Option C - Database Reset (if persist):**
```sql
-- Clears rate limiter store (if table exists)
DELETE FROM rate_limit_store WHERE ip_address = 'YOUR_IP';
```

**Prevention:**
- Max 4 login attempts when testing
- Usa le credenziali di test corrette (utente `admin@sgq.local`; password solo da vault / amministratore, non in repo)

---

### Issue 3: Checklist Not Generated ("Nessuno standard selezionato")

**Symptom:**
```
Checklist section shows:
"⚠️ Nessuno standard selezionato - Vai su Dati Generali → 1.1 Dati Generali"
```

**Debug Steps:**

**1. Check Console Errors:**
```javascript
// Look for errors like:
❌ Failed to load questions for standard_id: 1
❌ audit_standards is empty
```

**2. Check Database Relationship:**
```sql
-- Verify audit has standard linked
SELECT ast.*, s.name 
FROM audit_standards ast
JOIN standards s ON ast.standard_id = s.standard_id
WHERE ast.audit_id = (SELECT audit_id FROM audits WHERE audit_number = '2026-03');
-- Expected: 1 row with standard_id = 1
```

**3. Check Master Data:**
```sql
-- Verify questions exist
SELECT COUNT(*) FROM checklist_questions WHERE standard_id = 1;
-- Expected: 78 (ISO 9001)
```

**Fix - If audit_standards Empty:**
1. Open audit in UI
2. Go to "Dati Generali" → "Standard Applicabili"
3. Check "✅ ISO 9001:2015 Qualità"
4. Close modal (auto-save)
5. Return to Checklist → should appear

**Fix - If Master Data Missing (CRITICAL):**
```sql
-- ❌ Master data corrupted - requires database restore or re-seed
-- Contact DBA or restore from backup
```

---

### Issue 4: Blacklist UUID 403 Error

**Symptom:**
```
POST /audits/sync 403 (Forbidden)
Error: Audit obsoleto - cancella cache browser
audit_uuid: audit-002-acme-2025
```

**Root Cause:** Backend blacklist blocks deprecated audit UUIDs

**Fix - Clear Cache (user-side):**
```javascript
// See "Frontend Cache Clear" section above
```

**Fix - Remove from Blacklist (after all clients cleared cache):**
```bash
# SSH to server
ssh spascarella@www.fr-busato.it -p 1122

# Edit controller
nano /var/www/sgq-backend/src/controllers/audit.controller.js

# Find BLACKLISTED_UUIDS array (lines ~628-642)
# Remove deprecated UUIDs or entire block if no longer needed

# Save and restart
pkill -f 'node src/server.js'
cd /var/www/sgq-backend
nohup node src/server.js > /dev/null 2>&1 &
exit
```

**Current Blacklisted UUIDs:**
- `audit-002-acme-2025`
- `audit-003-template-2025`

**Timeline:** Remove blacklist after 2-3 weeks (all clients cache cleared)

---

### Issue 5: PWA Not Installing on Mobile

**Symptom:**
- "Add to Home Screen" option not appearing
- PWA install prompt not showing

**Debug Steps:**

**1. Verify HTTPS:**
```
URL must be https://systemgest.netlify.app (not http)
```

**2. Check manifest.json:**
```javascript
// Mobile browser console
fetch('/manifest.json').then(r => r.json()).then(console.log);
// Expected: {name, short_name, icons, start_url, display: "standalone"}
```

**3. Check Service Worker:**
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW State:', reg?.active?.state);
  // Expected: "activated"
});
```

**Fix - Force Service Worker Re-register:**
```javascript
(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(r => r.unregister()));
  await navigator.serviceWorker.register('/service-worker.js');
  location.reload();
})();
```

**Alternative - Manual Install (Android Chrome):**
1. Menu ⋮ → Add to Home screen
2. If option missing: Check Chrome flags `chrome://flags/#bypass-app-banner-engagement-checks`

---

## 📊 Master Data Reference

### Standards
```sql
SELECT * FROM standards;
```

| standard_id | name | version | description |
|-------------|------|---------|-------------|
| 1 | ISO 9001:2015 | 2015 | Sistema di Gestione per la Qualità |

### ISO 9001 Structure
- **Total Questions:** 78
- **Sections (Clauses):** 10
  - Clause 4: Contesto dell'organizzazione (4 questions)
  - Clause 5: Leadership (8 questions)
  - Clause 6: Pianificazione (8 questions)
  - Clause 7: Supporto (12 questions)
  - Clause 8: Attività operative (18 questions)
  - Clause 9: Valutazione delle prestazioni (10 questions)
  - Clause 10: Miglioramento (4 questions)

### Response Values
- **C** - Conforme (🟢 verde)
- **NC** - Non Conforme (🔴 rosso)
- **OSS** - Osservazione (🟡 giallo)
- **OM** - Opportunità di Miglioramento (🟠 arancione)
- **NA** - Non Applicabile (⚪ bianco)
- **NV** - Non Verificato (⚫ grigio)

### Database Constraints
```sql
-- Prevent duplicate audits same UUID + organization
CONSTRAINT UQ_audits_uuid_org UNIQUE (audit_uuid, organization_id)

-- Standard active constraint
CONSTRAINT UQ_standards_name UNIQUE (name, version)
```

---

## 🔑 Authentication

### Admin User (Testing)
```
Email: admin@sgq.local
Password: (ambiente di test — chiedere all'amministratore / vault, non in repository)
Role: Amministratore SGQ
Organization: QS Studio (organization_id = 1)
```

### JWT Cookie
- **Method:** httpOnly cookie (SameSite=None, Secure)
- **Expiration:** 24 hours
- **Refresh:** Auto-refresh on activity
- **Storage:** Browser cookie storage (NOT localStorage)

---

## 📝 Git Workflow

### Branch Strategy
- **main:** Production (auto-deploy to Netlify)
- **develop:** (future) Development branch
- **feature/xxx:** (future) Feature branches

### Commit Message Convention
```bash
# Format: type(scope): description

feat(backend): add UUID blacklist validation
fix(frontend): correct sync queue processing
docs(adr): add ADR-004 cache invalidation
chore(deps): bump axios to v1.7.2
refactor(ui): extract ChecklistItem component
test(integration): add audit creation test
```

**Types:** feat, fix, docs, chore, refactor, test, perf, style

---

## 🚀 Performance Benchmarks

### Expected Metrics
- **Login Time:** < 2 seconds (cold start)
- **Audit List Load:** < 1 second (10 audits)
- **Checklist Render:** < 500ms (78 questions)
- **Sync Upload:** < 3 seconds (1 audit + responses)
- **Offline → Online Sync:** < 5 seconds (auto-process queue)

### Bundle Sizes (Production)
- **Main Bundle:** ~720 KB (gzipped: ~220 KB)
- **Vendor Chunk:** ~450 KB (React, Axios, etc.)
- **Service Worker:** ~5 KB

### Database Performance
- **Audit Query:** < 100ms (single audit with joins)
- **Checklist Questions:** < 50ms (78 rows, standard_id = 1)
- **Response Insert:** < 20ms (single transaction)

---

## 📞 Support Contacts

### Server Administration
- **Provider:** Aruba / Custom VPS
- **Contact:** IT Admin (escalation needed)

### Database Administration
- **DBA:** Internal team
- **Backup Schedule:** (to be defined)

### Frontend Deployment
- **Platform:** Netlify
- **Account Owner:** QS Studio
- **Support:** Netlify community / docs

---

## 📚 External Documentation

### Technologies
- **React:** https://react.dev
- **Vite:** https://vitejs.dev
- **Axios:** https://axios-http.com
- **IndexedDB:** https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **Service Workers:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

### Standards
- **ISO 9001:2015:** https://www.iso.org/standard/62085.html
- **UNI EN ISO 9001:2015:** Normative/UNI EN ISO 9001_2015 Rev. 0.txt (local file)

---

**Maintained by:** Development Team  
**Last Review:** 2026-02-15  
**Next Review:** 2026-03-15 (monthly)
