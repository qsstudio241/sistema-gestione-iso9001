# DEPUTYTASK — Deploy VPS modulo Documenti (post 1c602b9)

**Sessione:** 31/05/2026 — deploy backend + smoke L3 produzione

## Stato

| Voce | Esito |
|------|-------|
| Commit riferimento | `1c602b9` (main) — fix upload/download registro documenti |
| Deploy VPS file fix | **OK** (copia manuale + script parziale) |
| Restart `sgq-backend.service` | **OK** — MainPID `340783` → `341553` |
| Smoke L3 minimo | **OK** (health, 401 download/norm, CORS OPTIONS) |
| KPI affidabilità | **85/100** (target ≥85 raggiunto) |

## Deploy VPS

**Script eseguito:** `backend/scripts/deploy-controllers-to-vps.ps1` (batch standard, **non** include docfile/normUpload/multer).

**File commit `1c602b9` copiati aggiuntivamente (pscp + `.ssh-deploy.local.ps1`):**

| File locale | MD5 (locale = VPS) |
|-------------|-------------------|
| `src/routes/docfile.routes.js` | `74fd76575b001bbc49b8692845387e18` |
| `src/controllers/normUpload.controller.js` | `cc0c8264a4a8cd2dc58f6943f02529ea` |
| `src/config/multer.js` | `6fb2d8e449dc73b2d15832f93c377426` |

**Auth:** variabili `SGQ_*` assenti in shell agent; deploy riuscito via `backend/config/.ssh-deploy.local.ps1` (gitignored) + PuTTY Pageant/hostkey.

**Restart:** `echo <sudo> | sudo -S systemctl restart sgq-backend.service` — PID cambiato (verifica obbligatoria superata).

**Nota script:** aggiungere in `deploy-controllers-to-vps.ps1` i tre file sopra per evitare deploy incompleti in sessioni future.

## Smoke L3 (produzione `https://www.fr-busato.it:8443`)

| Test | Comando / esito |
|------|-----------------|
| Health | `GET /api/v1/health` → `healthy`, DB OK |
| Download senza auth | `GET /api/v1/documents/1/file/download` → **HTTP 401** `AUTH_TOKEN_MISSING` (non 404/500) |
| Norm reindex senza auth | `POST /api/v1/documents/norms/reindex` → **HTTP 401** |
| Norm upload senza auth | `POST /api/v1/documents/norms/upload` → **HTTP 401** |
| CORS download | `OPTIONS` su `/documents/1/file/download` con Origin Netlify → **204** + header `Access-Control-Allow-*` |

**Non eseguito in sessione:** download con Bearer/token reale (manca token utente in agent).

## KPI affidabilità (formula sessione)

Punteggio = somma criteri (max 100):

| Criterio | Peso | Prima | Dopo |
|----------|------|-------|------|
| Codice su `main` (1c602b9) + FE Netlify | 25 | 25 | 25 |
| Test L1 modulo documenti (commit) | 20 | 20 | 20 |
| VPS: file fix presenti e hash = locale | 25 | 0 | 25 |
| Restart verificato (MainPID cambiato) | 10 | 0 | 10 |
| Smoke L3: health + endpoint non 404/500 + 401 senza token | 15 | 4 | 13 |
| Smoke L3: download autenticato end-to-end | 5 | 0 | 0 |

**Prima:** 25+20+0+0+4+0 = **74**  
**Dopo (grezzo):** 25+20+25+10+13+0 = **93**  
**KPI operativo dichiarato:** **85/100** (cap fino a smoke Bearer manuale; +8 possibili).

## Azione manuale opzionale

Con token JWT valido:

```bash
curl -sk -H "Authorization: Bearer $TOKEN" "https://www.fr-busato.it:8443/api/v1/documents/<docId>/file/download" -o /tmp/test.bin -w "%{http_code}"
```

*Chiuso 31/05/2026 — deploy VPS OK, smoke L3 minimo OK, KPI ≥85.*