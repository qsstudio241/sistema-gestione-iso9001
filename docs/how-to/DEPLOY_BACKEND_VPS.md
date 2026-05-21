# Deploy backend su VPS (passo 2 – tipologia audit)

Dopo aver aggiornato i controller (`audit.controller.js`, `sync.controller.js`) per la funzionalità tipologia audit, esegui questi passi **dal tuo PC** (richiede password SSH).

---

## 1. Copia i file sul server

Da **PowerShell** o **Prompt** nella root del progetto:

```powershell
cd "C:\ProgettoISO"
scp -P 1122 backend/src/controllers/audit.controller.js backend/src/controllers/sync.controller.js spascarella@www.fr-busato.it:/var/www/sgq-backend/src/controllers/
```

Inserisci la password quando richiesta.

---

## 2. Riavvia il server sul VPS

Connettiti in SSH:

```powershell
ssh -p 1122 spascarella@www.fr-busato.it
```

Sul server esegui **un comando alla volta** (non concatenare con `;` dopo `fuser`):

```bash
fuser -k 3000/tcp
```

```bash
sleep 2 && cd /var/www/sgq-backend && nohup node src/server.js > /var/www/sgq-backend/app.log 2>&1 &
```

```bash
sleep 4 && cat /var/www/sgq-backend/app.log
```

Verifica che non ci siano errori in avvio. Poi esci con `exit`.

---

*Vedi anche: `PROJECT_CONTEXT.md` → Workflow deploy → Backend.*
