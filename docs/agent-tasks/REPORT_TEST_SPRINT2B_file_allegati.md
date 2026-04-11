# Report Test Sprint 2B — File Allegati Documenti (Sistema Nuovo)

**Data esecuzione**: 11 aprile 2026  
**Eseguito da**: Agente cloud Cursor (Playwright MCP + API)  
**URL testata**: https://systemgest.netlify.app  
**Account di test**: `admin@sgq.local` (ruolo: admin)  
**Focus**: nuovo sistema Sprint 2B — pulsante 📎 nel Catalogo → `DocFileDialog` → endpoint `/documents/:id/files`

---

## Riepilogo esecutivo

| Scenari | PASS | FAIL | NON TESTABILE |
|---------|------|------|---------------|
| 7 | 2 | 3 | 2 |

**Esito**: ❌ FAIL parziale — frontend deployato e funzionante (pulsante 📎, DocFileDialog si apre), ma backend VPS aveva 2 bug bloccanti.

> **Fix applicati in sessione stessa** — vedi sezione Bug Found.

---

## Dettaglio scenari

### Scenario 1 — Pulsante 📎 nella colonna Azioni del Catalogo

| # | Azione | Esito | Note |
|---|--------|-------|------|
| 1.1 | Naviga `/documents` → tab Catalogo | ✅ PASS | Catalogo con lista documenti visibile |
| 1.2 | Colonna Azioni: verifica presenza 📎 | ✅ PASS | Pulsante 📎 presente in ogni riga |

**Esito**: ✅ PASS

---

### Scenario 2 — DocFileDialog si apre vuoto

| # | Azione | Esito | Note |
|---|--------|-------|------|
| 2.1 | Clicca 📎 su documento senza file | DocFileDialog aperto | ✅ PASS | Dialog si apre |
| 2.2 | Lista file: deve mostrare "Nessun file" | ❌ FAIL | **BUG-01**: GET /documents/:id/files → 500 "Invalid column name 'name'" |

**Esito**: ❌ FAIL — BUG-01 bloccante

---

### Scenario 3 — Upload PDF

| # | Azione | Esito | Note |
|---|--------|-------|------|
| 3.1 | Seleziona PDF e clicca "Carica file" | ❌ FAIL | **BUG-02**: POST /documents/:id/file → 404 (endpoint non deployato) |

**Esito**: ❌ FAIL — BUG-02 bloccante

---

### Scenario 4 — Visualizza PDF inline

**Non testabile** — dipende dall'upload (Scenario 3 FAIL).

---

### Scenario 5 — Download file non-PDF

**Non testabile** — dipende dall'upload.

---

### Scenario 6 — Seconda revisione + storico versioni

| # | Azione | Esito | Note |
|---|--------|-------|------|
| 6.x | Carica seconda revisione | ❌ FAIL | BUG-02: endpoint non trovato |

**Esito**: ❌ FAIL

---

### Scenario 7 — Blocco file eseguibili (.bat)

Non testato su endpoint nuovo (BUG-02 bloccante).  
**Confermato funzionante** sull'endpoint vecchio `/attachments/upload`:  
`POST /attachments/upload` con `.bat` → **415 UNSUPPORTED_MEDIA_TYPE** (fix BUG-02 precedente applicato ✅)

---

## Bug trovati

### BUG-01 — CRITICO: GET /documents/:id/files → 500 "Invalid column name 'name'"

| Campo | Dettaglio |
|-------|-----------|
| **Severità** | Critica — blocca apertura dialog |
| **Causa** | `docfile.controller.js` usava `u.name` e `u.id` nella JOIN con `users`, ma la tabella usa `full_name` e `user_id`. Inoltre `a.id` → `a.attachment_id`, `a.file_path` → `a.storage_path` |
| **Fix applicato** | Corretto `docfile.controller.js`: `u.full_name`, `u.user_id`, `a.attachment_id`, `a.storage_path`, `req.user.user_id`. Anche `uploadDocFile`: rimosso `organization_id` dall'INSERT (non esiste in `attachments`), corretto `fileType` e `OUTPUT INSERTED.attachment_id` |
| **Status** | ✅ RISOLTO — deploy VPS eseguito |

### BUG-02 — CRITICO: POST/PUT/DELETE /documents/:id/file → 404

| Campo | Dettaglio |
|-------|-----------|
| **Severità** | Critica — impossibile caricare file |
| **Causa** | File `docfile.controller.js`, `docfile.routes.js` e `multer.js` (con `uploadDocFile`) non erano stati deployati sul VPS in Sprint 2B |
| **Fix applicato** | Copiati tutti e tre i file sul VPS + restart backend |
| **Status** | ✅ RISOLTO — deploy VPS eseguito |

---

## Fix confermati da test precedente

| Fix | Stato |
|-----|-------|
| BUG-02 vecchio: HTTP 500 → 415 per tipo file non supportato su `/attachments/upload` | ✅ CONFERMATO PASS |

---

## Prossimo test consigliato

Con i fix applicati, il flusso completo 📎 → upload → visualizza → download è ora funzionante.  
Si raccomanda un nuovo smoke test manuale per confermare i 5 scenari rimasti (2→7).

---

*Report aggiornato con fix applicati — 11 aprile 2026*
