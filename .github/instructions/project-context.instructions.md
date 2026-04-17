---
description: "SGQ ISO 9001 – Contesto strategico, architettura e stato progetto"
applyTo: "**/*"
---

# Sistema Gestione ISO 9001 – Contesto Strategico

## Obiettivo del Progetto

PWA offline-first per la **gestione degli audit ISO 9001:2015** (e futuri multi-standard: ISO 14001, ISO 45001).  
Sostituisce fogli Excel e documenti Word con un sistema centralizzato, tracciabile e conforme ISO 9001:2015 (§ 7.5 Documented Information, § 9.2 Internal Audit, § 10.2 Nonconformity).

**Clienti target**: PMI italiane con sistema di gestione qualità certificato.  
**Modello**: Multi-tenant SaaS – ogni organizzazione vede solo i propri dati (`organization_id`).

---

## Infrastruttura Produzione

| Risorsa | Dettaglio |
|---|---|
| **VPS Backend** | `www.fr-busato.it` – Ubuntu, porta 3000 → HTTPS 8443 via Nginx |
| **SSH** | `ssh -p 1122 spascarella@www.fr-busato.it` — chiave SSH o PuTTY (`SGQ_PUTTY_SESSION`); non versionare password |
| **Backend path** | `/var/www/sgq-backend/` |
| **Log** | `/var/www/sgq-backend/app.log` (NON `/var/log/`) |
| **DB** | SQL Server `www.fr-busato.it,11043` / DB: `SGQ_ISO9001` |
| **API Base URL** | `https://www.fr-busato.it:8443/api/v1` |
| **Frontend (Netlify)** | Deploy automatico da `main` branch |
| **Deploy backend** | `scp -P 1122 <file> spascarella@www.fr-busato.it:/var/www/sgq-backend/<path>/` |

### Restart Server (comandi separati — NON concatenare con `;` il tail)
```bash
fuser -k 3000/tcp
sleep 2 && cd /var/www/sgq-backend && nohup node src/server.js > /var/www/sgq-backend/app.log 2>&1 &
sleep 4 && cat /var/www/sgq-backend/app.log
```

---

## Stack Tecnico

| Layer | Tecnologia |
|---|---|
| **Frontend** | React 18, PWA, IndexedDB (offline-first), Vite |
| **Backend** | Node.js 20, Express 4, mssql driver |
| **Database** | SQL Server (Azure SQL compat) |
| **Auth** | JWT in cookie httpOnly |
| **Export** | docx (Word), file-saver |
| **Deploy FE** | Netlify (auto da `main`) |
| **Deploy BE** | SCP manuale + server restart |

---

## Architettura Offline-First

- **Sync strategy**: `server-wins` su campi critici (stato audit, firme, esiti) — **merge** su note/evidenze
- **Overwrite**: notifica utente + log persistente (tracciabilità ISO 9001:2015 §7.5/9.2/10.2)
- **SyncService**: batch con retry + backoff esponenziale
- **IndexedDB**: tutti gli audit/risposte cachati localmente; sincronizzati in background

---

## Schema Database (tabelle critiche)

```sql
-- Valori conformity_status (CHECK constraint)
'C', 'NC', 'OSS', 'OM', 'NA', 'NV', NULL

-- attachments (migration 017)
attachment_id, attachment_uuid, audit_id, nc_id, question_id (FK → checklist_questions),
file_name, file_type, file_size, mime_type, storage_path,
category DEFAULT 'evidence', description, uploaded_by, created_at

-- pending_issues (migration 018)
issue_id, target_audit_id FK→audits (CASCADE),
source_audit_id FK→audits, question_id FK→checklist_questions,
source_response_id INT NULL FK→audit_responses (NO ACTION),  -- ← no cascade cycle
status CHECK('open','resolved','persists'),
original_status CHECK('NC','OSS','OM'),
resolution_notes, organization_id FK→organizations, created_at, updated_at
```

---

## Stato Corrente (21/02/2026)

### ✅ Backend Deployato e Funzionante

| File | Stato | Note |
|---|---|---|
| `auth.middleware.js` | ✅ Deployato | `authenticateDownload` accetta `?token=` per `<img src>` / `<iframe>` |
| `attachment.controller.js` | ✅ Deployato | `question_id` in list/upload, `viewAttachment` inline per img/PDF |
| `attachment.routes.js` | ✅ Deployato | Route `/view` con `authenticateDownload` |
| `audit.controller.js` | ✅ Deployato | `checkReaudit()` aggiunto |
| `audit.routes.js` | ✅ Deployato | `POST /audits/check-reaudit` |

### ✅ Frontend (locale, da deployare via Netlify)

| File | Stato | Note |
|---|---|---|
| `apiService.js` | ✅ Pronto | `getAttachmentViewUrl()`, `checkReaudit()` |
| `AuditSelector.jsx` | ✅ Pronto | Mock rimosso, usa `apiService.checkReaudit()` |
| `AuditObjectiveSection.jsx` | ✅ Pronto | Da verificare modifiche |
| `PendingIssuesCascade.jsx` | ✅ Pronto | Componente rilievi pendenti |
| `Dashboard.jsx` | ✅ Pronto | Aggiornamenti dashboard |

### ✅ Database

- Migration 017: `attachments.question_id` ✅
- Migration 018: `pending_issues` table ✅
- `FK_pending_issues_source_response` (NO ACTION) ✅

---

## API Endpoints (principali)

```
GET    /api/v1/audits                      → lista audit
GET    /api/v1/audits/:id                  → dettaglio
GET    /api/v1/audits/:id/statistics       → statistiche
GET    /api/v1/audits/:id/pending-issues   → rilievi pendenti
POST   /api/v1/audits/check-reaudit        → verifica re-audit (body: {client_name})
POST   /api/v1/audits/sync                 → upsert offline sync
POST   /api/v1/audits                      → crea nuovo
PUT    /api/v1/audits/:id                  → aggiorna
DELETE /api/v1/audits/:id                  → elimina

GET    /api/v1/attachments?audit_id=&question_id=   → lista allegati
POST   /api/v1/attachments/upload                   → upload file
GET    /api/v1/attachments/:id/download?token=      → download (inline img/PDF)
GET    /api/v1/attachments/:id/view?token=          → preview inline
DELETE /api/v1/attachments/:id                      → elimina
```

---

## Backlog Fase 2 (prossimi sviluppi)

1. **Frontend**: Componente `<AttachmentPreview>` con `<img src={apiService.getAttachmentViewUrl(id)}>` per preview allegati inline nella checklist
2. **Frontend**: Sezione "Rilievi Pendenti" nel `CreateAuditModal` — dati reali da `checkReaudit`, lista NC/OSS/OM da risolvere
3. **SyncService**: Offline-first per upload allegati (file da IndexedDB → server al momento del sync)
4. **Report Word**: Integrare rilievi pendenti reali (da DB) nella sezione "3 - RILIEVI PENDENTI" del `wordExport.js`
5. **Multi-standard**: Seed dati ISO 14001 / ISO 45001 nella checklist

---

## Regole Operative (CRITICHE)

1. **"calma, abbiamo un server — guarda nella documentazione esistente prima di eseguire qualsiasi azione"**
2. Prima di modificare backend: leggere il controller/route esistente
3. `tail -N file` NON funziona dopo `fuser` su questa shell → usare `cat`
4. NON concatenare restart server con `;` dopo `fuser -k` → comandi separati
5. Credenziali mai in repo (`.env` + secrets CI/CD)
6. `conformity_status` valori: `'C', 'NC', 'OSS', 'OM', 'NA', 'NV', NULL`
