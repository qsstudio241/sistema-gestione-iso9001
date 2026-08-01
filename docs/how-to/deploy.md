# Deploy — hub operativo

> **Fonte unica di ingresso** per rilasci frontend (Netlify) e backend (VPS). I dettagli restano nei file collegati sotto (non duplicare checklist intere qui).

---

## Ordine consigliato (ogni release)

1. **Pre-deploy locale** — build + test (sezione 1 della checklist release).
2. **`git push` su `main`** — avvia build Netlify automatica (~2–3 min).
3. **Deploy backend VPS** — copia file (non è `git pull` sul server) + restart `sgq-backend`.
4. **Smoke** — health API, login, flusso toccato dalla release.
5. **Hard refresh** PWA (Ctrl+Shift+R) dopo deploy frontend.

---

## Documenti (per ruolo)

| Quando | Documento |
|--------|-----------|
| **Checklist completa release** | [DEPLOY_CHECKLIST_RELEASE.md](DEPLOY_CHECKLIST_RELEASE.md) |
| **Copia controller + restart systemd** | stessa checklist + script `backend/scripts/deploy-controllers-to-vps.ps1` |
| **Deploy manuale singolo controller** | [DEPLOY_BACKEND_VPS.md](DEPLOY_BACKEND_VPS.md) |
| **Frontend Netlify / PWA** | [NETLIFY_DEPLOYMENT.md](NETLIFY_DEPLOYMENT.md) |
| **SSH, health, credenziali agente** | [ACCESSO_DEPLOY_AGENTS.md](ACCESSO_DEPLOY_AGENTS.md) |
| **Errori PuTTY / plink / 404 post-deploy** | [DEPLOY_TROUBLESHOOTING.md](DEPLOY_TROUBLESHOOTING.md) |
| **Esperienza e smoke estesi** | [GUIDA_CONSOLIDATA.md](../GUIDA_CONSOLIDATA.md) (§ A, piano qualità) |
| **Infra e path VPS** | [REFERENCE.md](../REFERENCE.md) |

---

## Verifica rapida post-deploy

```powershell
# Dalla root del repo (Windows)
.\backend\scripts\deploy-controllers-to-vps.ps1

# Smoke health (da backend/)
cd backend
npm run smoke:deploy
```

Oppure curl manuale:

```bash
curl -sk https://sistemi.fr-busato.it:8443/api/v1/health
```

Risposta attesa: JSON con stato OK. Se 502/404 → [DEPLOY_TROUBLESHOOTING.md](DEPLOY_TROUBLESHOOTING.md).

**Manifest deploy:** lo script PowerShell e `deploy-to-vps.sh` usano lo stesso elenco file in `backend/scripts/deploy-manifest.json` (services → utils → controller → routes → server.js). Preflight blocca il deploy se manca un file locale.

**Release con norme / NC / documenti:** non serve copia manuale — il manifest include `normUpload`, `importJobs`, `documentTree`, `documentRegistryNorm`, `normCodesImport`, `ncResponsibleOptions`, ecc.

**Restart backend (VPS):** preferire `sudo systemctl restart sgq-backend.service` e verificare che **MainPID** cambi (vedi checklist release).

---

## Regole da non dimenticare

- `/var/www/sgq-backend` **non è un clone Git** — aggiornare solo con script/scp documentati.
- Dopo modifiche **sync / lock / CORS**: smoke su endpoint reali, non solo build locale.
- Credenziali: solo file gitignored (`database.json`, `.ssh-deploy.local.ps1`) — mai in repository.
