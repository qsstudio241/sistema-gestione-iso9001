# Accesso VPS, API produzione e deploy autonomo (Cursor / agenti)

> **Aggiornato:** 2026-04-19.  
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

## Come l’assistente AI può operare “in autonomia” sul tuo PC

Cursor **non** ha credenziali nel cloud: esegue script **sul workspace locale** (la tua macchina Windows dove è aperto il repo).

Per **deploy backend** (`backend/scripts/deploy-controllers-to-vps.ps1`):

1. **Consigliato:** sessione PuTTY salvata + **Pageant** con chiave `.ppk`, oppure nome sessione in `SGQ_PUTTY_SESSION` / file `backend/config/.putty-session.local` (una riga, gitignored).
2. **Alternativa:** file **`backend/config/.ssh-deploy.local.ps1`** (gitignored), creato copiando **`.ssh-deploy.local.ps1.example`**. Puoi impostare lì `$env:SGQ_SSH_PASSWORD` e/o `$env:SGQ_SUDO_PASSWORD` **solo sul tuo disco** — non in chat e non in Git.
3. Lo script, se è presente **`SGQ_SSH_PASSWORD`**, **ignora la sessione PuTTY** per quell’esecuzione, così non si ripetono errori “sessione salvata non valida” mentre la password funziona.

Per **migrazioni DB** da script Node (`run-migration*.js`, `backend/run-migration.js`):

- Servono **`backend/config/database.json`** (o override `DB_*`) **già configurati sul PC** verso l’istanza desiderata. L’agente può lanciare il comando; **non** scrivere mai password SQL in file versionati o in chat.

Riferimenti incrociati: [REFERENCE.md](REFERENCE.md), [DEPLOY_CHECKLIST_RELEASE.md](DEPLOY_CHECKLIST_RELEASE.md), [DEPLOY_TROUBLESHOOTING.md](DEPLOY_TROUBLESHOOTING.md).

---

## Cosa non fare mai

- Non committare **`database.json`**, **`.putty-session.local`**, **`.ssh-deploy.local.ps1`**, file `.env` con segreti.
- Non incollare password SSH/SQL in issue, PR o messaggi chat: usare vault / file locali gitignored e **ruotare** se esposte.

---

## Limiti realistici

Nessuna configurazione garantisce “zero errori di rete” al 100% (VPN, firewall, credenziali scadute). La combinazione **host key fissata nello script** + **auth non interattiva documentata** + **file locale gitignored** riduce al minimo gli errori ripetitivi di accesso per deploy e smoke.
