# Accesso VPS, API produzione e deploy autonomo (Cursor / agenti)

> **Aggiornato:** 2026-04-28.  
> Obiettivo: stessa informazione operativa per umano e assistente AI, **senza segreti in repository**.

---

## Endpoint API produzione (pubblici, non segreti)

| Voce | Valore |
|------|--------|
| **Base API** | `https://www.fr-busato.it:8443/api/v1` |
| **Health** | `https://www.fr-busato.it:8443/api/v1/health` |
| **Frontend Netlify** | `https://systemgest.netlify.app` (vedi anche [NETLIFY_DEPLOYMENT.md](NETLIFY_DEPLOYMENT.md)) |

Il frontend in produzione usa la stessa base API salvo override `VITE_API_URL` su Netlify (vedi `app/src/services/apiService.js`).

---

## SSH e cartelle sul VPS (pubblici, non segreti)

| Voce | Valore |
|------|--------|
| **Host** | `www.fr-busato.it` |
| **Porta SSH** | `1122` (non la 22 standard) |
| **Utente Linux tipico** | `spascarella` |
| **Path backend deploy** | `/var/www/sgq-backend` (**copia file**, non `git clone`) |
| **Servizio systemd** | `sgq-backend.service` |
| **Log applicativo** | `/var/www/sgq-backend/app.log` |

Comando SSH manuale:

```bash
ssh -p 1122 spascarella@www.fr-busato.it
```

---

## SQL Server produzione (host pubblico, credenziali no)

| Voce | Valore |
|------|--------|
| **Server** | `www.fr-busato.it,11043` |
| **Database** | `SGQ_ISO9001` |

Login e password SQL stanno solo in **`backend/config/database.json`** (gitignored) o in variabili `DB_*` sul PC. Vedi [DATABASE.md](DATABASE.md).

---

## Come l'assistente AI può operare "in autonomia"

### A) Cursor desktop sul tuo PC (Windows)

Cursor esegue script **sul workspace locale** (la tua macchina Windows dove è aperto il repo).

Per **deploy backend** (`backend/scripts/deploy-controllers-to-vps.ps1`):

1. **Consigliato:** sessione PuTTY salvata + **Pageant** con chiave `.ppk`, oppure nome sessione in `SGQ_PUTTY_SESSION` / file `backend/config/.putty-session.local` (una riga, gitignored).
2. **Alternativa:** file **`backend/config/.ssh-deploy.local.ps1`** (gitignored), creato copiando **`.ssh-deploy.local.ps1.example`**. Puoi impostare lì `$env:SGQ_SSH_PASSWORD` e/o `$env:SGQ_SUDO_PASSWORD` **solo sul tuo disco** — non in chat e non in Git.
3. Lo script, se è presente **`SGQ_SSH_PASSWORD`**, **ignora la sessione PuTTY** per quell'esecuzione, così non si ripetono errori "sessione salvata non valida" mentre la password funziona.

Per **migrazioni DB** da script Node (`run-migration*.js`):

- Servono **`backend/config/database.json`** (o override `DB_*`) **già configurati sul PC** verso l'istanza desiderata. L'agente può lanciare il comando; **non** scrivere mai password SQL in file versionati o in chat.

---

### B) Cloud Agent Cursor (Linux — senza accesso al PC)

I Cloud Agent girano su macchine Linux remote e **non** hanno accesso al tuo PC né a PuTTY.
Usano **OpenSSH standard** (`ssh`/`scp`) e leggono le credenziali dalle **Cursor Cloud Secrets** (variabili d'ambiente iniettate automaticamente all'avvio dell'agent).

#### Segreti da configurare una volta sola

Vai su **cursor.com → Dashboard → Cloud Agents → Secrets** e aggiungi:

| Segreto | Valore | Usato da |
|---------|--------|----------|
| `SGQ_SSH_KEY_B64` | Chiave privata SSH in base64 (vedi sotto) | `deploy-to-vps.sh` |
| `SGQ_SUDO_PASSWORD` | Password sudo sul VPS (opzionale, abilita `systemctl restart`) | `deploy-to-vps.sh` |
| `DB_SERVER` | `www.fr-busato.it,11043` | `run-migration-agent.sh` |
| `DB_PORT` | `11043` | `run-migration-agent.sh` |
| `DB_DATABASE` | `SGQ_ISO9001` | `run-migration-agent.sh` |
| `DB_USER` | utente SQL Server | `run-migration-agent.sh` |
| `DB_PASSWORD` | password SQL Server | `run-migration-agent.sh` |

**Come generare `SGQ_SSH_KEY_B64`** (eseguire una volta sul tuo PC — Git Bash su Windows oppure terminale Linux/Mac):

```bash
# Se hai già una chiave autorizzata sul VPS:
base64 -w0 ~/.ssh/id_ed25519   # o id_rsa, id_ed25519_sgq, ecc.

# Se vuoi creare una chiave dedicata (consigliato):
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_sgq -C "cursor-cloud-agent" -N ""
# Autorizza la chiave sul VPS (una sola volta):
ssh-copy-id -i ~/.ssh/id_ed25519_sgq.pub -p 1122 spascarella@www.fr-busato.it
# Converti in base64 e copia il risultato nel secret Cursor:
base64 -w0 ~/.ssh/id_ed25519_sgq
```

Il valore base64 (una sola riga lunga) va incollato integralmente nel campo `SGQ_SSH_KEY_B64`.

#### Script disponibili per il Cloud Agent

| Script | Cosa fa |
|--------|---------|
| `bash backend/scripts/deploy-to-vps.sh` | Copia tutti i file backend (controller, route, service, middleware) sul VPS + restart `sgq-backend` + verifica health |
| `bash backend/scripts/run-migration-agent.sh 019` | Esegue `run-migration-019.js` sul DB di produzione usando le variabili `DB_*` |
| `bash backend/scripts/run-migration-agent.sh 040 production` | Come sopra, con env esplicito |

#### Flusso completo deploy da Cloud Agent

```
1. git push main          → Netlify aggiorna il frontend automaticamente (~2 min)
2. bash backend/scripts/deploy-to-vps.sh
      ├─ Legge SGQ_SSH_KEY_B64 → chiave privata in /tmp (cancellata alla fine)
      ├─ scp file backend → VPS /var/www/sgq-backend/src/...
      ├─ ssh → systemctl restart sgq-backend (usa SGQ_SUDO_PASSWORD se presente)
      └─ curl https://...8443/api/v1/health → verifica 200 OK
3. bash backend/scripts/run-migration-agent.sh <numero>   (se ci sono migrazioni DB)
```

#### Verifica segreti iniettati (senza esporre i valori)

```bash
env | grep -E "^(SGQ_|DB_)" | sed 's/=.*/=***/'
```

Riferimenti incrociati: [REFERENCE.md](REFERENCE.md), [DEPLOY_CHECKLIST_RELEASE.md](DEPLOY_CHECKLIST_RELEASE.md), [DEPLOY_TROUBLESHOOTING.md](DEPLOY_TROUBLESHOOTING.md).

---

## Cosa non fare mai

- Non committare **`database.json`**, **`.putty-session.local`**, **`.ssh-deploy.local.ps1`**, file `.env` con segreti.
- Non incollare password SSH/SQL in issue, PR o messaggi chat: usare vault / file locali gitignored e **ruotare** se esposte.

---

## Limiti realistici

Nessuna configurazione garantisce "zero errori di rete" al 100% (VPN, firewall, credenziali scadute). La combinazione **host key fissata nello script** + **auth non interattiva documentata** + **file locale gitignored** riduce al minimo gli errori ripetitivi di accesso per deploy e smoke.

## Contesto fase sviluppo (priorità)

Per iterazioni con **dati di prova** e obiettivo **velocità**, la policy operativa del repo (`.cursor/rules/sgq-operating-memory.mdc`) chiede all'agente di **non bloccare** deploy e commit per digressioni su sicurezza operativa quando l'accesso è risolvibile con i file locali gitignored sopra; resta il divieto di **committare** segreti nel repository.
