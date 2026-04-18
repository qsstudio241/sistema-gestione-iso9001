# Sistema Gestione ISO 9001 - Backend API + Database

Backend REST API Node.js/Express + SQL Server per gestione audit ISO 9001:2015.

## 🏗️ Architettura

```
┌──────────────────────────────────────────────────┐
│  FRONTEND (Netlify)                              │
│  https://systemgest.netlify.app                  │
│  React 18 + PWA + IndexedDB (cache offline)      │
└───────────────┬──────────────────────────────────┘
                │ HTTPS/REST
                │
┌───────────────▼──────────────────────────────────┐
│  BACKEND API (Ubuntu Server)                     │
│  https://www.fr-busato.it:10443/api/v1          │
│  Node.js 18 + Express + JWT Auth                │
└───────────────┬──────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────┐
│  DATABASE (SQL Server Express 2022)              │
│  SGQ_ISO9001                                     │
│  - audits, checklist_sections, audit_responses  │
│  - non_conformities, attachments, users         │
└──────────────────────────────────────────────────┘
```

---

## 📋 Prerequisiti

### Server Ubuntu

- Ubuntu 20.04 LTS o superiore
- 2 GB RAM minimo (4 GB consigliato)
- 20 GB spazio disco
- IP pubblico statico
- Dominio: `www.fr-busato.it` puntato al server

### Software

- ✅ SQL Server Express 2022 (già installato)
- Node.js 18 LTS
- npm 9+
- Nginx (reverse proxy)
- Certbot (SSL Let's Encrypt)

---

## 🚀 Setup Completo (Step-by-Step)

### FASE 1: Preparazione Database

#### 1.1 Connessione SQL Server

```bash
# Verifica SQL Server in esecuzione
sudo systemctl status mssql-server

# Connettiti come SA
sqlcmd -S localhost -U sa -P 'TuaPasswordSA'
```

#### 1.2 Crea Database e Utente API

```sql
-- Esegui lo script schema.sql
:r /path/to/database/schema.sql
GO

-- Crea utente per backend API
USE master;
GO

CREATE LOGIN sgq_api_user WITH PASSWORD = 'PASSWORD_SICURA_QUI';
GO

USE SGQ_ISO9001;
GO

CREATE USER sgq_api_user FOR LOGIN sgq_api_user;
GO

-- Grant permessi minimi necessari
ALTER ROLE db_datareader ADD MEMBER sgq_api_user;
ALTER ROLE db_datawriter ADD MEMBER sgq_api_user;
GRANT EXECUTE TO sgq_api_user; -- Per stored procedures
GO

-- Verifica permessi
SELECT dp.name, dp.type_desc, dp.default_schema_name
FROM sys.database_principals dp
WHERE dp.name = 'sgq_api_user';
GO
```

#### 1.3 Configura Firewall SQL Server

```bash
# Abilita porta 1433 solo per localhost (sicurezza)
sudo ufw allow from 127.0.0.1 to any port 1433
sudo ufw status
```

---

### FASE 2: Installazione Backend Node.js

#### 2.1 Installa Node.js 18 LTS

```bash
# Aggiungi repository NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Installa Node.js e npm
sudo apt install -y nodejs

# Verifica versioni
node --version  # v18.x.x
npm --version   # 9.x.x
```

#### 2.2 Setup Progetto Backend

```bash
# Naviga nella cartella backend
cd /var/www/sgq-iso9001/backend

# Copia file .env.example
cp .env.example .env

# Modifica variabili di ambiente
nano .env
```

**File `.env` da configurare:**

```env
NODE_ENV=production
PORT=10443
API_BASE_PATH=/api/v1

# Database
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=SGQ_ISO9001
DB_USER=sgq_api_user
DB_PASSWORD=PASSWORD_SICURA_QUI  # <-- CAMBIA QUESTA
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# JWT (genera con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=GENERA_SECRET_CASUALE_64_CARATTERI  # <-- CAMBIA QUESTA
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=https://systemgest.netlify.app,http://localhost:5173
CORS_CREDENTIALS=true

# Upload
UPLOAD_MAX_SIZE=52428800
UPLOAD_DIR=/var/www/sgq-iso9001/uploads
ALLOWED_FILE_TYPES=image/jpeg,image/png,audio/mpeg,video/mp4,application/pdf

# SSL
SSL_ENABLED=true
SSL_KEY_PATH=/etc/letsencrypt/live/www.fr-busato.it/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/www.fr-busato.it/fullchain.pem
```

#### 2.3 Installa Dipendenze

```bash
npm install
```

#### 2.4 Crea Cartelle Necessarie

```bash
# Cartella uploads
sudo mkdir -p /var/www/sgq-iso9001/uploads
sudo chown -R $USER:$USER /var/www/sgq-iso9001/uploads
sudo chmod 755 /var/www/sgq-iso9001/uploads

# Cartella logs
sudo mkdir -p /var/www/sgq-iso9001/backend/logs
sudo chown -R $USER:$USER /var/www/sgq-iso9001/backend/logs
```

---

### FASE 3: Configurazione SSL/TLS (Let's Encrypt)

#### 3.1 Installa Certbot

```bash
sudo apt install -y certbot
```

#### 3.2 Ottieni Certificato SSL

```bash
# Stop temporaneamente servizi su porta 80/443
sudo systemctl stop nginx  # se presente

# Richiedi certificato
sudo certbot certonly --standalone \
  -d www.fr-busato.it \
  --email tua-email@dominio.it \
  --agree-tos \
  --no-eff-email

# Verifica certificati creati
sudo ls -la /etc/letsencrypt/live/www.fr-busato.it/
```

#### 3.3 Rinnovo Automatico

```bash
# Aggiungi cron job per rinnovo
sudo crontab -e

# Aggiungi questa riga (rinnova ogni giorno alle 3 AM)
0 3 * * * certbot renew --quiet && systemctl restart sgq-backend
```

---

### FASE 4: Configurazione Nginx (Reverse Proxy)

#### 4.1 Installa Nginx

```bash
sudo apt install -y nginx
```

#### 4.2 Configura Virtual Host

```bash
sudo nano /etc/nginx/sites-available/sgq-api
```

**Contenuto file:**

```nginx
# API Backend - Port 10443
upstream sgq_backend {
    server 127.0.0.1:3000;  # Node.js internal port
    keepalive 64;
}

server {
    listen 10443 ssl http2;
    server_name www.fr-busato.it;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/www.fr-busato.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.fr-busato.it/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';

    # Logs
    access_log /var/log/nginx/sgq-api-access.log;
    error_log /var/log/nginx/sgq-api-error.log;

    # Max body size (upload files)
    client_max_body_size 50M;

    # API Routes
    location / {
        proxy_pass http://sgq_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
    }

    # Static files (uploads)
    location /uploads/ {
        alias /var/www/sgq-iso9001/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 4.3 Attiva Configurazione

```bash
# Crea symlink
sudo ln -s /etc/nginx/sites-available/sgq-api /etc/nginx/sites-enabled/

# Test configurazione
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### 4.4 Firewall

```bash
# Abilita porta 10443
sudo ufw allow 10443/tcp
sudo ufw status
```

---

### FASE 5: Servizio Systemd (Auto-Start)

#### 5.1 Crea Service File

```bash
sudo nano /etc/systemd/system/sgq-backend.service
```

**Contenuto:**

```ini
[Unit]
Description=SGQ ISO 9001 Backend API
After=network.target mssql-server.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/sgq-iso9001/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

#### 5.2 Attiva Servizio

```bash
# Reload systemd
sudo systemctl daemon-reload

# Abilita auto-start
sudo systemctl enable sgq-backend

# Avvia servizio
sudo systemctl start sgq-backend

# Verifica status
sudo systemctl status sgq-backend

# Log in tempo reale
sudo journalctl -u sgq-backend -f
```

---

### FASE 6: Test API

#### 6.1 Health Check

```bash
curl -k https://www.fr-busato.it:10443/health
```

**Output atteso:**

```json
{
  "status": "healthy",
  "database": {
    "healthy": true,
    "message": "Database connection OK"
  },
  "uptime": 123.456,
  "timestamp": "2025-11-26T10:30:00.000Z"
}
```

#### 6.2 Test Registrazione Utente

```bash
curl -k -X POST https://www.fr-busato.it:8443/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@qsstudio.it",
    "password": "<password-di-test>",
    "full_name": "Test User",
    "role": "auditor"
  }'
```

#### 6.3 Test Login

```bash
curl -k -X POST https://www.fr-busato.it:8443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@qsstudio.it",
    "password": "<password-di-test>"
  }'
```

**Salva il token JWT ricevuto!**

---

## 📁 Struttura File Backend

```
backend/
├── src/
│   ├── server.js              # Entry point Express
│   ├── config/
│   │   └── database.js        # SQL Server connection pool
│   ├── routes/
│   │   ├── auth.routes.js     # POST /login, /register
│   │   ├── audit.routes.js    # CRUD audits
│   │   ├── checklist.routes.js
│   │   ├── attachment.routes.js
│   │   ├── nc.routes.js       # Non conformità
│   │   └── sync.routes.js     # Delta sync offline
│   ├── controllers/
│   │   ├── audit.controller.js
│   │   ├── auth.controller.js
│   │   └── ...
│   ├── middleware/
│   │   ├── auth.middleware.js # JWT verify
│   │   ├── upload.middleware.js
│   │   └── validator.middleware.js
│   └── utils/
│       ├── logger.js
│       └── helpers.js
├── logs/                      # Winston logs
├── uploads/                   # File allegati
├── .env                       # Variabili ambiente
├── .env.example
└── package.json
```

---

## 🔐 Sicurezza Checklist

- [x] Database user con permessi minimi (no SA)
- [x] SQL Server solo su localhost (no accesso remoto)
- [x] JWT secret casuale di 64+ caratteri
- [x] HTTPS/TLS con certificati Let's Encrypt
- [x] Helmet.js per security headers
- [x] Rate limiting (100 req/15min per IP)
- [x] CORS ristretto a domini whitelisted
- [x] Validazione input con express-validator
- [x] Password hash bcrypt (10 rounds)
- [x] File upload limitati (50MB, whitelist MIME)
- [ ] Implementare 2FA (TOTP) - TODO
- [ ] IP whitelisting per endpoint admin - TODO
- [ ] Audit log di tutte le modifiche - FATTO (audit_history table)

---

## 🛠️ Operazioni Manutenzione

### Backup Database

```bash
# Backup giornaliero automatico
sudo nano /etc/cron.daily/sgq-backup
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/sgq-iso9001"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup SQL Server
/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P 'PASSWORD_SA' \
  -Q "BACKUP DATABASE [SGQ_ISO9001] TO DISK = N'$BACKUP_DIR/sgq_$DATE.bak'"

# Backup uploads
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" /var/www/sgq-iso9001/uploads/

# Rimuovi backup > 30 giorni
find "$BACKUP_DIR" -type f -mtime +30 -delete

echo "Backup completato: $DATE"
```

```bash
sudo chmod +x /etc/cron.daily/sgq-backup
```

### Monitoring

```bash
# Log backend real-time
sudo journalctl -u sgq-backend -f

# Spazio disco
df -h

# Memoria RAM
free -h

# Processi Node.js
ps aux | grep node

# Connessioni SQL Server
sqlcmd -S localhost -U sa -Q "SELECT * FROM sys.dm_exec_sessions WHERE is_user_process = 1"
```

---

## 🚨 Troubleshooting

### Errore: "Cannot connect to SQL Server"

```bash
# Verifica SQL Server attivo
sudo systemctl status mssql-server

# Test connessione
sqlcmd -S localhost -U sgq_api_user -P 'PASSWORD'

# Log SQL Server
sudo tail -f /var/opt/mssql/log/errorlog
```

### Errore: "SSL Certificate Not Found"

```bash
# Verifica certificati
sudo ls -la /etc/letsencrypt/live/www.fr-busato.it/

# Rigenera certificati
sudo certbot renew --force-renewal
```

### Errore: "Port 10443 already in use"

```bash
# Trova processo su porta
sudo lsof -i :8443

# Kill processo
sudo kill -9 <PID>

# Restart servizio
sudo systemctl restart sgq-backend
```

---

## 📞 Supporto

- **Documentazione API**: https://www.fr-busato.it:8443/api-docs (da implementare con Swagger)
- **GitHub Issues**: [Repository Link]
- **Email**: support@qsstudio.it

---

## 📄 License

MIT License - QS Studio 2025
