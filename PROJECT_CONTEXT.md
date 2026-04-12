# PROJECT CONTEXT — SGQ ISO 9001

> Documento di orientamento rapido per l'AI agent. Da leggere all'inizio di ogni sessione.  
> **Esperienza consolidata** (deploy, Word, sync): → [docs/GUIDA_CONSOLIDATA.md](docs/GUIDA_CONSOLIDATA.md)  
> **Fasi di sviluppo, DoD e test di robustezza** (piramide test, smoke, licenze): → stessa guida, sezione **«Piano qualità: fasi di sviluppo e test di robustezza»**.  
> **Utenti, gerarchia e RBAC** (tenant, studio, scope API): → [docs/ARCHITETTURA_UTENTI_RBAC.md](docs/ARCHITETTURA_UTENTI_RBAC.md).  
> Dettagli tecnici: → [DATABASE.md](docs/DATABASE.md) | [BACKEND_API.md](docs/BACKEND_API.md) | [docs/INDICE_DOCUMENTAZIONE.md](docs/INDICE_DOCUMENTAZIONE.md)

---

## Cos'è il progetto

**Sistema Gestione Qualità ISO 9001** — PWA offline-first per la gestione degli audit interni ISO 9001:2015.  
Sostituisce fogli Excel/Word con un sistema centralizzato, tracciabile e conforme ISO 9001:2015 (§7.5, §9.2, §10.2).

- **Target**: PMI italiane con SGQ certificato
- **Modello**: Multi-tenant SaaS — isolamento su `organization_id`
- **Standard**: ISO 9001:2015 (attivo) → ISO 14001:2015 e ISO 45001:2018 (backlog)

---

## Stack

| Layer | Tecnologia | Note |
|---|---|---|
| **Frontend** | React 18, Vite 5.4.21, PWA | Deploy Netlify automatico da `main` |
| **Offline** | IndexedDB | Audit e risposte cachati localmente |
| **Backend** | Node.js 20, Express 4 | VPS Ubuntu, porta 3000 → HTTPS 8443 via Nginx |
| **Database** | SQL Server (`mssql`) | `www.fr-busato.it,11043` / `SGQ_ISO9001` |
| **Auth** | JWT in cookie httpOnly (desktop) | `SameSite=None; Secure`, Axios `withCredentials` — mobile: localStorage ([ADR-004](docs/adr/ADR-004-mobile-auth-localstorage.md)) |
| **Export** | `docxtemplater` + `pizzip` + OOXML injection | Template `.docx` editabile in Word |
| **HTTP client** | Axios v1.7 con interceptor | Vietato `fetch` diretto |

---

## Infrastruttura produzione

| Risorsa | Dettaglio |
|---|---|
| **API** | `https://www.fr-busato.it:8443/api/v1` |
| **Frontend** | Netlify (auto-deploy da `main`) |
| **VPS** | `www.fr-busato.it` — Ubuntu |
| **SSH** | `ssh spascarella@www.fr-busato.it -p 1122` / `Sistemi@2026` |
| **Backend path** | `/var/www/sgq-backend/` |
| **App log** | `/var/www/sgq-backend/app.log` |
| **GitHub** | `qsstudio241/sistema-gestione-iso9001` |
| **Credenziali test** | `admin@sgq.local` / `Admin123!` |

### Restart server (comandi separati — NON concatenare con `;` il tail)

```bash
fuser -k 3000/tcp
sleep 2 && cd /var/www/sgq-backend && nohup node src/server.js > /var/www/sgq-backend/app.log 2>&1 &
sleep 4 && cat /var/www/sgq-backend/app.log
```

---

## Architettura offline-first

- **Sync strategy**: `server-wins` su campi critici (stato audit, firme, esiti); **merge** su note/evidenze
- **Conflict**: notifica utente + log persistente (tracciabilità ISO 9001:2015 §7.5/9.2/10.2)
- **SyncService**: batch con retry + backoff esponenziale
- **IndexedDB**: tutti gli audit/risposte cachati; sincronizzati in background al recupero connessione

---

## Architettura Word Export (`app/src/utils/wordExport.js`)

### Flusso

```
1. Carica template .docx   →  app/public/templates/ISO9001-audit-report.docx
2. docxtemplater            →  sostituisce {segnaposto} con dati audit
3. OOXML injection          →  replaceMarker() inserisce tabelle colorate
4. Salva blob               →  file-saver → download .docx
```

### Segnaposto template

`{clientName}` `{auditDate}` `{auditNumber}` `{procedureCode}` `{auditObject}` `{scope}`  
`{referenceDocuments}` `{processes}` `{programCommunicatedDate}` `{auditor}`  
`{objectiveDescription}` `{#participants}{role}{name}{/participants}` `{conclusions}`  
`{ncCount}` `{ossCount}` `{omCount}` `{nvCount}` `{summaryText}`

### Marker OOXML

| Marker | Contenuto generato |
|---|---|
| `CHECKLIST_MARKER` | Tabella checklist colorata per clausola (NC=rosso, C=verde, OSS=giallo, OM=blu, NA=grigio, NV=viola) |
| `RILIEVI_MARKER` | Tabella sintesi CONF\|NC\|OSS\|OM\|N.A. |

### File chiave export

| File | Ruolo |
|---|---|
| `app/src/utils/wordExport.js` | Entry point: carica template, chiama docxtemplater, injection OOXML |
| `app/src/utils/wordExportHelpers.js` | Genera stringhe OOXML raw (tabelle, colori) |
| `app/public/templates/ISO9001-audit-report.docx` | Template con logo e header/footer — **modificabile in Word** |
| `app/scripts/generateTemplate.js` | Rigenera template da zero (⚠️ sovrascrive personalizzazioni manuali) |

> **Regola**: ogni modifica al template `.docx` in Word va committata e pushata per apparire su Netlify.

### `replaceMarker()` — nota importante

La funzione cerca `<w:p ` o `<w:p>` (con spazio o `>`) camminando a ritroso dal marker.  
Esclude `<w:pPr>` — errore storico che corrompeva il file (commit `975ed3e`).

---

## Stato funzionalità (2026-03-01)

### ✅ Completate (2026-03-02)

| Funzionalità | Commit | Note |
|---|---|---|
| Auth JWT cookie (login/register/refresh) | — | httpOnly, SameSite=None |
| Gestione audit CRUD multi-tenant | — | |
| Checklist ISO 9001:2015 (35 domande, id 87-121) | migration-010 | standard_id=1 |
| Checklist ISO 14001:2015 (46 domande, id 122-167) | migration-012 | standard_id=2, sezioni `14001_s4`/`14001_s5` |
| Risposte conformità (C/NC/OSS/OM/NA/NV) | — | CHECK constraint fisso in DB |
| Non conformità CRUD | — | |
| Allegati upload/download/preview/replace/delete | `0520182` | fetch blob + URL.createObjectURL (NON img src) |
| Export Word (template-based) ISO 9001 | `975ed3e` | Template editabile in Word |
| Logo nel report Word | `57aabcf` | File template committato |
| Rilievi pendenti tra audit | migration-018 | tabella `pending_issues`, FK NO ACTION |
| `check-reaudit` API + UI selector | — | deployato su VPS |
| Sync offline-first (IndexedDB → server) | — | standard_id intero (fix `9894ed5`) |
| Fix 4 bug selezione standard | `9894ed5` | norms→selectedStandards, accordion _2015, standard_id |
| Manuale Utente v1.1 | `5fec508` | `docs/MANUALE_UTENTE.md` |

### Multi-standard State

| Standard | DB | Frontend | Sync | Export Word |
|---|---|---|---|---|
| ISO 9001:2015 | ✅ 35 domande | ✅ | ✅ | ✅ |
| ISO 14001:2015 | ✅ 46 domande | ✅ | ✅ fix `9894ed5` | ❌ Backlog |
| ISO 45001:2018 | ❌ 0 domande | ⚠️ Placeholder | ❌ | ❌ |

### 🔲 Backlog (Fase 2) — con file coinvolti

| Priorità | Funzionalità | File coinvolti |
|---|---|---|
| 🔴 | Test E2E fix standard su Netlify | — |
| 🔴 | **Export Word ISO 14001** | `wordExport.js`, `wordExportHelpers.js`, template .docx |
| 🔴 | **Rilievi Pendenti reali in Word** | `wordExport.js` — `RILIEVI_MARKER` → dati da `GET /audits/:id/pending-issues` |
| 🔴 | **Modal Re-Audit con lista pending** | `AuditSelector.jsx`, nuovo `ReauditModal.jsx` |
| 🟡 | **Fix Auth Mobile (ADR-004)** | `auth.controller.js`, `apiService.js`, `AuthContext.jsx`, `auth.middleware.js` |
| 🟡 | **SyncService offline allegati** | `syncService.js`, `IndexedDBProvider.js` (v3), `useAttachmentManager.js` |
| 🟡 | **Seed ISO 45001** | `database/migrations/019_seed_iso45001.sql` |
| 🟢 | Refresh token automatico | `apiService.js` interceptor 401, `POST /auth/refresh` |
| 🟢 | Auto-logout inattività 4h | `AuthContext.jsx` |
| 🟢 | Allineamento `/audits` vs `/audits/sync` | debito tecnico — standard_ids[] vs standard_id scalare |

---

## Struttura repository (cartelle chiave)

```
/
├── app/                        # Frontend React + Vite
│   ├── src/
│   │   ├── components/         # Componenti React
│   │   ├── services/           # apiService.js, syncService.js
│   │   ├── utils/              # wordExport.js, wordExportHelpers.js
│   │   └── hooks/              # Custom hooks
│   ├── public/
│   │   └── templates/          # ISO9001-audit-report.docx ← editare in Word
│   └── scripts/
│       └── generateTemplate.js # Rigenera template (⚠️ sovrascrive)
│
├── backend/
│   └── src/
│       ├── controllers/        # Logica business
│       ├── routes/             # Express router
│       ├── middleware/         # auth.middleware.js (authenticate, authenticateDownload)
│       ├── config/
│       │   └── database.js     # Pool mssql, healthCheck(), closePool()
│       └── utils/
│           └── logger.js       # Winston logger
│
├── docs/                       # Documentazione dettagliata
│   ├── DATABASE.md             # ← Quick-ref DB (questo progetto)
│   ├── BACKEND_API.md          # ← Tutti gli endpoint API
│   ├── DATABASE_SCHEMA.md      # Schema completo DB — LEGGERE PRIMA DI TOCCARE IL DB
│   ├── DATABASE_MAPPING.md     # Mapping frontend ↔ backend ↔ DB
│   ├── PROJECT_ROADMAP.md      # Roadmap versioni
│   ├── sessions/               # Session notes e commit messages
│   ├── archive/                # Roadmap e doc storici
│   └── adr/                    # Architecture Decision Records
└── PROJECT_CONTEXT.md          # ← Questo file
```

---

## Regole operative critiche

1. **Golden rule — flusso end-to-end**: ogni modifica che introduce nuovi campi o comportamenti **deve** coprire sia frontend sia backend (persistenza, API, sync, converter) in modo che il flusso di lavoro resti sempre funzionante. Robustezza e affidabilità di ogni modifica sono obbligatorie.
2. **Prima di modificare backend**: leggere il controller/route esistente
3. **`tail -N file`** NON funziona dopo `fuser` su questa shell → usare `cat`
4. **NON concatenare** restart server con `;` dopo `fuser -k` → comandi separati
5. **`conformity_status`** valori: `'C', 'NC', 'OSS', 'OM', 'NA', 'NV', NULL`
6. **`question_type`** valori DB: `'TEXT'`, `'YES_NO'`, `'MULTIPLE_CHOICE'` (MAIUSCOLO)
7. **`audit.status`** valori DB: `'draft'`, `'in_progress'`, `'completed'`, `'approved'` (minuscolo)
8. **Credenziali mai in repo** — `.env` + secrets CI/CD
9. **HTTP client**: solo Axios v1.7 con interceptor, vietato `fetch` diretto

---

## Workflow deploy

**Regola**: quando si chiede un commit per Netlify (o per il deploy), eseguire sempre **commit e push** insieme, così il deploy parte subito.

### Frontend (automatico)
```bash
git add .
git commit -m "feat: ..."
git push origin main
# Netlify deploy automatico — ~2 minuti
```

### Backend (manuale SCP / script)
Da PowerShell, dalla root del repo: `backend/scripts/deploy-controllers-to-vps.ps1` (usa pscp; richiede PuTTY). In alternativa, copia manualmente i controller modificati (es. `audit.controller.js`, `customChecklist.controller.js`) e riavvia Node sul VPS. Dettaglio: [docs/DEPLOY_CHECKLIST_RELEASE.md](docs/DEPLOY_CHECKLIST_RELEASE.md).
```bash
# 1. Copia i file (es. audit + customChecklist controller)
scp -P 1122 backend/src/controllers/audit.controller.js backend/src/controllers/customChecklist.controller.js \
  spascarella@www.fr-busato.it:/var/www/sgq-backend/src/controllers/

# 2. SSH sul server e restart
ssh -p 1122 spascarella@www.fr-busato.it
# Sul server: fuser -k 3000/tcp; sleep 2; cd /var/www/sgq-backend && nohup node src/server.js > app.log 2>&1 &
```

### Template Word (richiede commit)
```bash
# Dopo aver modificato app/public/templates/ISO9001-audit-report.docx in Word:
git add app/public/templates/ISO9001-audit-report.docx
git commit -m "chore: aggiorna template Word"
git push origin main
```

---

*Aggiornato: 2026-04-12 — Piano qualità/test in GUIDA_CONSOLIDATA; puntatore da contesto sessione.*
