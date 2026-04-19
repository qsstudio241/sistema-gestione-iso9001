# BACKEND API — SGQ ISO 9001

> **Base URL produzione**: `https://www.fr-busato.it:8443/api/v1`  
> **Base URL locale**: `http://localhost:3000/api/v1`  
> **Autenticazione**: JWT in cookie `httpOnly` (`SameSite=None; Secure`) — Axios con `withCredentials: true`

---

## Autenticazione

Tutti gli endpoint (eccetto quelli marcati **PUBLIC**) richiedono il cookie JWT impostato al login.  
Per endpoint `download`/`view` allegati usati in `<img src>` o `<iframe>`: passare `?token=<JWT>` nella query string.

---

## Health

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/health` | PUBLIC | Health check root |
| GET | `/api/v1/health` | PUBLIC | Health check API (risposta: `{status, database, uptime, timestamp}`) |

---

## Auth — `/api/v1`

| Metodo | Path | Auth | Body | Descrizione |
|---|---|---|---|---|
| POST | `/auth/register` | PUBLIC | `{email, password, full_name, organization_name}` | Registra utente + organizzazione |
| POST | `/auth/login` | PUBLIC | `{email, password}` | Login → set cookie JWT |
| POST | `/auth/refresh` | Cookie JWT | — | Rinnova access token |
| GET | `/auth/me` | JWT | — | Restituisce utente corrente |

---

## Audit — `/api/v1`

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/audits` | JWT | Lista audit: `organization_id` da JWT + filtro studio/RBAC (`auditListRbac.studioScopeClause`; ruolo normalizzato in middleware). Query: `?status=`, `?standard_id=`, paginazione. |
| GET | `/audits/:id` | JWT | Dettaglio audit (stesso scope lista) |
| GET | `/audits/:id/statistics` | JWT | Statistiche conformità |
| GET | `/audits/:id/pending-issues` | JWT | Rilievi pendenti da audit precedenti |
| GET | `/audits/:id/nc-responses` | JWT | Risposte NC dell'audit |
| POST | `/audits/check-reaudit` | JWT | Verifica se esiste re-audit per cliente (`body: {client_name}`) |
| POST | `/audits/sync` | JWT | Upsert batch offline-sync (body: array audit) |
| POST | `/audits` | JWT | Crea nuovo audit |
| PUT | `/audits/:id` | JWT | Aggiorna audit |
| DELETE | `/audits/:id` | JWT | Elimina audit |
| POST | `/audits/:id/bulk-responses` | JWT | Salvataggio bulk risposte checklist |

---

## Risposte — `/api/v1`

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/audits/:id/responses` | JWT | Lista risposte per audit |
| POST | `/audits/:id/responses` | JWT | Salva/aggiorna singola risposta (`{question_id, conformity_status, notes, answer_value}`) |
| POST | `/audits/:id/responses/bulk` | JWT | Salvataggio bulk (array risposte) |
| DELETE | `/audits/:id/responses/:response_id` | JWT | Elimina risposta |
| GET | `/response-options` | PUBLIC | Lista opzioni risposta (C/NC/OSS/OM/NA/NV) |

---

## Non Conformità — `/api/v1`

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/nc` | JWT | Lista NC dell'organizzazione (`?audit_id=`, `?status=`) |
| GET | `/nc/statistics` | JWT | Statistiche NC |
| GET | `/nc/:id` | JWT | Dettaglio NC |
| POST | `/nc` | JWT | Crea NC (`{audit_id, standard_id, section_code, nc_type, description, severity}`) |
| PUT | `/nc/:id` | JWT | Aggiorna NC |
| DELETE | `/nc/:id` | JWT | Elimina NC |

---

## Allegati — `/api/v1`

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/attachments` | JWT | Lista allegati (`?audit_id=&question_id=`) |
| GET | `/attachments/:id` | JWT | Metadati allegato |
| GET | `/attachments/:id/download` | JWT / `?token=` | Download allegato (Content-Disposition: attachment) |
| GET | `/attachments/:id/view` | JWT / `?token=` | Preview inline (img/PDF nel browser) |
| POST | `/attachments/upload` | JWT | Upload file (multipart; body: `audit_id`, `question_id`, `description`) |
| DELETE | `/attachments/:id` | JWT | Elimina allegato |
| PUT | `/attachments/:id` | JWT | Sostituisce file allegato |

> `download` e `view` accettano `?token=<JWT>` per essere usati in attributi HTML `src`/`href`.  
> `authenticateDownload` middleware controlla prima il cookie, poi il query param `token`.

---

## Standard — `/api/v1`

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/standards` | JWT | Lista standard attivi |
| GET | `/standards/statistics` | JWT | Statistiche per standard |
| GET | `/standards/:id` | JWT | Dettaglio standard |
| GET | `/standards/:id/questions` | JWT | Domande dello standard |

---

## Checklist — `/api/v1`

Dati **master read-only** — pubblici, condivisi tra tutte le organizzazioni.

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/checklist/sections` | PUBLIC | Sezioni per standard (`?standard_id=1`) |
| GET | `/checklist/questions` | PUBLIC | Domande per sezione (`?standard_id=1&section_code=clause4`) |

---

## Sync — `/api/v1`

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/sync/audits` | JWT | Sync batch audit offline → server |
| PUT | `/sync/metadata/:audit_id` | JWT | Aggiorna metadati di sync |

---

## Middleware globale (ordine in `server.js`)

```
helmet → compression → CORS → body-parser (50 MB) → rate-limit (commentato) → logger
→ /health (no auth)
→ /api/v1/health (no auth)
→ /api/v1/response-options (no auth)
→ authRoutes        (no auth globale — login/register pubblici)
→ attachmentRoutes  (per-route: authenticateDownload su /view e /download)
→ auditRoutes       (router.use(authenticate))
→ responseRoutes    (router.use(authenticate))
→ ncRoutes          (router.use(authenticate))
→ checklistRoutes   (PUBLIC)
→ syncRoutes        (router.use(authenticate))
→ standardRoutes    (router.use(authenticate))
→ /uploads (static)
→ 404 handler
→ error handler
```

> `attachmentRoutes` è montato **prima** degli altri router authenticati per evitare che il loro `router.use(authenticate)` globale blocchi le richieste `?token=` in arrivo su `/attachments`.

---

## Variabili d'ambiente backend (`.env`)

```env
PORT=3000
NODE_ENV=production
API_BASE_PATH=/api/v1

# DB SQL Server (override opzionali; vedi anche backend/config/database.json locale da .example)
DB_SERVER=your-sql-host
DB_PORT=1433
DB_DATABASE=SGQ_ISO9001
DB_USER=your_sql_user
DB_PASSWORD=your_sql_password

# JWT
JWT_SECRET=<segreto>
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# CORS
CORS_ORIGIN=https://sgq-qs.netlify.app,http://localhost:5173
CORS_CREDENTIALS=true

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=50

# SSL
SSL_ENABLED=true
SSL_KEY_PATH=/etc/letsencrypt/live/fr-busato.it/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/fr-busato.it/fullchain.pem

# Rate limit
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10000
```

---

## Deploy backend

```bash
# Copia file modificato sul VPS
scp -P 1122 backend/src/controllers/audit.controller.js \
  spascarella@www.fr-busato.it:/var/www/sgq-backend/src/controllers/

# Restart server (3 comandi separati — NON usare && dopo fuser)
fuser -k 3000/tcp
sleep 2 && cd /var/www/sgq-backend && nohup node src/server.js > /var/www/sgq-backend/app.log 2>&1 &
sleep 4 && cat /var/www/sgq-backend/app.log
```

> `tail -N file` **NON funziona** su questa shell dopo `fuser`. Usare `cat`.

---

*Aggiornato: 2026-03-01*
