# MASTER — Fix CORS: ✅ RISOLTO (verificato 04/05/2026)

> **STATO**: CHIUSO. Il VPS risponde già con `Access-Control-Allow-Origin: https://sistema-gestione-iso9001.netlify.app`.
> Verifica: `curl -s -X OPTIONS "https://www.fr-busato.it:8443/api/v1/audits/sync" -H "Origin: https://sistema-gestione-iso9001.netlify.app" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type,Authorization,X-Audit-Lock-Token" -D - 2>&1 | grep -E "Access-Control|HTTP/"`

---

# (storico) Fix CORS: aggiorna .env sul VPS

## Contesto e causa radice identificata

L'app mostra `NETWORK_ERROR` (status: 0) su **tutte** le chiamate API da browser.
Non è rete instabile: è un **blocco CORS** del browser.

### Diagnosi esatta (già eseguita dal cloud agent)

Chiamata preflight OPTIONS verificata:
```
curl -X OPTIONS https://www.fr-busato.it:8443/api/v1/audits/sync \
  -H "Origin: https://sistema-gestione-iso9001.netlify.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization,X-Audit-Lock-Token"
```

**Risposta attuale del server (SBAGLIATA):**
```
Access-Control-Allow-Origin: https://systemgest.netlify.app
```

Il dominio reale dell'app è `https://sistema-gestione-iso9001.netlify.app`.
Il browser vede che l'Origin non corrisponde → blocca la risposta → `status: 0` → `NETWORK_ERROR`.

### Dove si trova la configurazione sul VPS

File: `/var/www/sgq-backend/.env`

Riga attuale (da cambiare):
```
CORS_ORIGIN=https://systemgest.netlify.app,http://localhost:5173
```

Riga corretta:
```
CORS_ORIGIN=https://sistema-gestione-iso9001.netlify.app,https://systemgest.netlify.app,http://localhost:5173
```

Il codice in `backend/src/server.js` è già corretto (`X-Audit-Lock-Token` è già negli `allowedHeaders`, `CORS_ORIGIN` viene letto da env). Il problema è solo il valore della variabile sul VPS.

---

## Cosa ha già fatto il cloud agent

1. **Aggiornato `backend/.env.example`** con il dominio corretto (commit `be7ea01` su `main`) — questo è il template di riferimento per il VPS
2. **Fix `syncService.js`** — errori `NETWORK_ERROR` non stallano più gli item della sync queue (commit `1a6729e` su `main`)
3. **Fix `syncService.js`** — backoff automatico e log aggregato quando ci sono cicli consecutivi di errori di rete (commit `72f0ae2` su `main`)
4. Deploy Netlify: tutti e tre i commit sono già su `main`, Netlify ha già rilasciato il frontend aggiornato

---

## Task da completare (richiede accesso SSH al VPS)

### Step 1 — Aggiorna `.env` sul VPS

Connettiti al VPS:
```bash
ssh -p 1122 spascarella@www.fr-busato.it
```

Aggiorna la riga CORS_ORIGIN:
```bash
sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://sistema-gestione-iso9001.netlify.app,https://systemgest.netlify.app,http://localhost:5173|' /var/www/sgq-backend/.env
```

Verifica che sia corretta:
```bash
grep CORS_ORIGIN /var/www/sgq-backend/.env
```

Output atteso:
```
CORS_ORIGIN=https://sistema-gestione-iso9001.netlify.app,https://systemgest.netlify.app,http://localhost:5173
```

### Step 2 — Riavvia il servizio backend

```bash
sudo systemctl restart sgq-backend
sleep 3
sudo systemctl status sgq-backend | head -15
```

### Step 3 — Verifica CORS post-deploy

```bash
curl -s -X OPTIONS https://www.fr-busato.it:8443/api/v1/audits/sync \
  -H "Origin: https://sistema-gestione-iso9001.netlify.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization,X-Audit-Lock-Token" \
  -D - 2>&1 | grep -E "Access-Control|HTTP/"
```

**Output atteso dopo il fix:**
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://sistema-gestione-iso9001.netlify.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Authorization, Content-Type, Accept, Origin, X-Audit-Lock-Token
```

### Step 4 — Smoke test

Apri l'app su `https://sistema-gestione-iso9001.netlify.app`, apri la console del browser e verifica che non compaiano più errori `NETWORK_ERROR` o `CORS policy` sulle chiamate API.

Opzionalmente esegui anche il curl di health:
```bash
curl -sk https://www.fr-busato.it:8443/api/v1/health
```

---

## Definition of Done

- [ ] `grep CORS_ORIGIN /var/www/sgq-backend/.env` mostra il dominio corretto
- [ ] `sudo systemctl status sgq-backend` → `active (running)`
- [ ] Il curl preflight risponde con `Access-Control-Allow-Origin: https://sistema-gestione-iso9001.netlify.app`
- [ ] Nessun `NETWORK_ERROR` in console browser sull'app Netlify
- [ ] La sync queue si svuota correttamente (badge "In coda" scompare o si azzera)

---

## File coinvolti (per contesto)

| File | Stato |
|------|-------|
| `backend/.env.example` | ✅ Aggiornato su `main` (dominio corretto) |
| `/var/www/sgq-backend/.env` sul VPS | ❌ Da aggiornare (richiede SSH) |
| `app/src/services/syncService.js` | ✅ Fix già su `main` + Netlify |

**Note di sicurezza**: non scrivere password o segreti nel file, non in chat. Usa la sessione PuTTY / Pageant / `backend/config/.ssh-deploy.local.ps1` (gitignored) come da `docs/ACCESSO_DEPLOY_AGENTS.md`.
