# ADR-005: Strategia storage allegati — Filesystem Linux (migration-ready Azure Blob)

**Data**: 2026-03-02  
**Stato**: IMPLEMENTATA e in produzione  
**Autori**: Team SGQ, sessione 01/03/2026  
**Commit di riferimento**: See `migration-017`, `attachment.controller.js`

---

## Contesto

Il sistema SGQ permette agli auditor di allegare prove documentali (`evidence`) a ogni risposta di checklist. Queste prove possono essere:
- Screenshot di non conformità
- PDF di documenti di processo
- Immagini (.jpg, .png) di evidenze fisiche

Le scelte da fare riguardano: **dove** salvare i file fisici, **come** servirli al frontend, e **come** gestire la preview senza violazioni CORS.

---

## Decisione

### Storage: Filesystem Linux con path relativi

```
/var/www/sgq-backend/uploads/{year}/{month}/{uuid}_{original_filename}
esempio: /var/www/sgq-backend/uploads/2026/03/a1b2c3d4-e5f6-evidence_nc_linea5.jpg
```

**Motivazione**: semplicità operativa, nessun costo aggiuntivo, compatibile con il VPS attuale.  
**Migration-ready**: il campo `storage_path` in DB contiene il path **relativo** (`2026/03/uuid_file.jpg`) — non il path assoluto — per permettere futuro spostamento su Azure Blob Storage senza riscrivere la logica applicativa.

### DB: Tabella `attachments` (migration-017)

| Colonna | Tipo | Note |
|---|---|---|
| `attachment_id` | INT PK | |
| `attachment_uuid` | UNIQUEIDENTIFIER | UUID generato da backend Node.js |
| `audit_id` | INT FK → audits | |
| `nc_id` | INT NULL FK → nonconformities | |
| `question_id` | INT NULL FK → checklist_questions | ← aggiunto migration-017 |
| `file_name` | NVARCHAR(255) | nome originale |
| `file_type` | NVARCHAR(100) | estensione |
| `file_size` | BIGINT | bytes |
| `mime_type` | NVARCHAR(100) | es. `image/jpeg` |
| `storage_path` | NVARCHAR(500) | path relativo da uploads root |
| `category` | NVARCHAR(50) DEFAULT 'evidence' | |
| `description` | NVARCHAR(500) NULL | |
| `uploaded_by` | INT FK → users | |
| `created_at` | DATETIME2 | |

### Preview/Download: fetch() + blob (NON img src diretto)

```javascript
// ✅ PATTERN OBBLIGATORIO — evita CORS su porta 8443 da Netlify
async function openAttachment(attachmentId) {
  const blob = await apiService.fetchAttachmentBlob(attachmentId);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ❌ PATTERN VIETATO — CORS blocca richieste da Netlify a sistemi.fr-busato.it:8443
<img src={`${API_BASE}/attachments/${id}/view?token=${token}`} />
```

**Perché CORS blocca `<img src>`**: Il tag `<img>` in React fa una GET cross-origin verso porta 8443. Il browser richiede CORS headers sull'immagine stessa, ma `express.static` o i middleware esistenti non li rilevano come richieste credenziali dal dominio Netlify. La soluzione `fetch()` con header `Authorization` funziona perché è una richiesta CORS credenziale gestita dall'interceptor Axios.

---

## Endpoint

```
POST /api/v1/attachments/upload
  - multipart/form-data
  - campi: file, audit_id, question_id (opzionale), category, description

GET /api/v1/attachments?audit_id=&question_id=
  - lista allegati filtrata per audit e/o domanda

GET /api/v1/attachments/:id/download?token=JWT
  - stream file con header Content-Disposition: attachment
  - usa authenticateDownload (accetta ?token= per apertura in nuova tab)

GET /api/v1/attachments/:id/view?token=JWT
  - stream file con Content-Disposition: inline (preview img/PDF)
  - usa authenticateDownload

PUT /api/v1/attachments/:id/replace
  - sostituisce file mantenendo stesso attachment_id
  - elimina vecchio file dal filesystem

DELETE /api/v1/attachments/:id
  - rimuove record DB + file fisico da filesystem
```

### `authenticateDownload` (auth.middleware.js)

Il middleware specifico legge JWT da `?token=` query param OPPURE da cookie/header — necessario perché `<a href>`, `window.open()` e `<iframe>` non permettono di aggiungere header HTTP custom.

---

## Conseguenze

### Positive
- Zero costi storage aggiuntivi (filesystem VPS incluso nel canone)
- Preview immediata senza encoding base64 (nessun overhead trasmissione)
- Path relativi: zero refactoring per migrazione Azure Blob Storage futura
- `authenticateDownload` gestisce tutti i casi desktop (link, popup, iframe)

### Negative / Limitazioni note
- **Offline attachment sync**: NON ancora implementato. Le foto scattate offline non sono in queue di sync. Il file `useAttachmentManager.js` deve essere esteso con store IndexedDB `attachments` (v3 del DB schema) + queue upload in `syncService.js`.
- Storage locale non replicato: nessun backup automatico. Raccomandare backup cron del folder `uploads/`.
- Dimensione massima file: 10 MB (configurabile in multer options).
- Mobile `<input type="file">` non permette cattura fotocamera diretta su Android < 12 — dipendenza da OS.

---

## Stato implementazione offline sync allegati (backlog)

**Problema**: un auditor offline che carica un allegato vede l'immagine localmente, ma al prossimo sync il file non viene inviato al server.

**Soluzione pianificata** (NON ancora implementata):

```javascript
// 1. IndexedDB schema v3 — aggiungere store 'attachments'
const db = idbRequest.result;
if (oldVersion < 3) {
  db.createObjectStore('attachments', { keyPath: 'localId' });
  // campi: localId, auditId, questionId, file (Blob), status ('pending'|'synced')
}

// 2. useAttachmentManager.js — saveAttachmentOffline
const saveAttachmentOffline = async (file, auditId, questionId) => {
  const localId = crypto.randomUUID();
  await idb.put('attachments', {
    localId, auditId, questionId, file, status: 'pending', createdAt: Date.now()
  });
  return localId;
};

// 3. syncService.js — syncUploadAttachment (già presente, da connettere)
const syncPendingAttachments = async () => {
  const pending = await idb.getAll('attachments');
  for (const att of pending.filter(a => a.status === 'pending')) {
    try {
      await apiService.uploadAttachment(att.auditId, att.questionId, att.file);
      await idb.put('attachments', { ...att, status: 'synced' });
    } catch (e) {
      console.warn('Attachment sync failed, retry later', e);
    }
  }
};
```

---

## Alternativa scartata

**Base64 in DB**: salvare il contenuto file come VARBINARY(MAX) o NVARCHAR(MAX) base64 direttamente nella tabella. Scartata per:
- Overhead 33% su trasmissione rete
- SQL Server non ottimizzato per query su campi BLOB grandi
- Nessun benefit rispetto al filesystem per file non strutturati
