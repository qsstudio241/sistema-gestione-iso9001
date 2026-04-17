# 🎯 IMPLEMENTAZIONE COMPLETA - Piano Operativo

## ✅ Fatto Finora

1. **Schema Database SQL Server**

   - File: `/database/schema.sql`
   - 11 tabelle complete con relazioni, indici, trigger
   - Stored procedures per operazioni complesse
   - View aggregate per dashboard
   - Dati iniziali ISO 9001:2015 sezioni

2. **Backend Node.js Struttura**

   - File: `/backend/package.json`, `src/server.js`, `src/config/database.js`
   - Express + SQL Server (mssql driver)
   - JWT authentication, CORS, rate limiting
   - SSL/TLS support
   - Logging con Winston

3. **Documentazione Completa**
   - File: `/backend/README.md`
   - Setup step-by-step per Ubuntu + SQL Server Express
   - Configurazione Nginx reverse proxy
   - SSL Let's Encrypt
   - Systemd service per auto-start
   - Backup automatici
   - Troubleshooting guide

---

## 📋 Prossimi Step (da completare)

### STEP 1: Esegui Script SQL (5 minuti)

```bash
# Sul tuo server Ubuntu
sqlcmd -S localhost -U sa -i /path/to/database/schema.sql
```

**Output atteso:**

```
Schema database SGQ_ISO9001 creato con successo!
```

### STEP 2: Copia Backend sul Server (10 minuti)

```bash
# Crea struttura cartelle
sudo mkdir -p /var/www/sgq-iso9001/backend
sudo chown -R $USER:$USER /var/www/sgq-iso9001

# Copia file da Windows al server (usa SCP o SFTP)
# Dalla tua macchina Windows:
scp -r "C:\ProgettoISO\backend\*" \
  user@www.fr-busato.it:/var/www/sgq-iso9001/backend/
```

### STEP 3: Installa Dipendenze e Configura (15 minuti)

```bash
# SSH nel server
ssh user@www.fr-busato.it

cd /var/www/sgq-iso9001/backend

# Installa Node.js 18 (se non presente)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Installa dipendenze
npm install

# Configura .env
cp .env.example .env
nano .env  # Modifica password DB e JWT_SECRET

# Genera JWT secret sicuro
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### STEP 4: File Mancanti da Creare (30 minuti)

Ho generato solo i file principali. Devi creare:

#### 4.1 Routes (API Endpoints)

**`src/routes/auth.routes.js`**

```javascript
const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refreshToken);
router.post("/logout", authController.logout);

module.exports = router;
```

**`src/routes/audit.routes.js`**

```javascript
const express = require("express");
const router = express.Router();
const auditController = require("../controllers/audit.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Tutte le route richiedono autenticazione
router.use(authMiddleware);

router.get("/", auditController.getAllAudits);
router.get("/:id", auditController.getAuditById);
router.post("/", auditController.createAudit);
router.put("/:id", auditController.updateAudit);
router.delete("/:id", auditController.deleteAudit);
router.post("/:id/complete", auditController.completeAudit);

module.exports = router;
```

**(Simile per checklist.routes.js, attachment.routes.js, nc.routes.js, sync.routes.js)**

#### 4.2 Controllers (Logica Business)

**`src/controllers/auth.controller.js`**

```javascript
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/database");

async function register(req, res) {
  try {
    const { email, password, full_name, role } = req.body;

    // Check if user exists
    const existingUser = await query(
      "SELECT user_id FROM users WHERE email = @email",
      { email }
    );

    if (existingUser.recordset.length > 0) {
      return res.status(409).json({ error: "Email già registrata" });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       OUTPUT INSERTED.user_id, INSERTED.email, INSERTED.full_name, INSERTED.role
       VALUES (@email, @password_hash, @full_name, @role)`,
      { email, password_hash, full_name, role: role || "auditor" }
    );

    const user = result.recordset[0];

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: "Utente registrato con successo",
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Errore durante la registrazione" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await query(
      `SELECT user_id, email, password_hash, full_name, role, is_active
       FROM users WHERE email = @email`,
      { email }
    );

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    const user = result.recordset[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "Account disabilitato" });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    // Update last login
    await query(
      "UPDATE users SET last_login = GETDATE() WHERE user_id = @user_id",
      { user_id: user.user_id }
    );

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: "Login effettuato con successo",
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Errore durante il login" });
  }
}

// TODO: implementa refreshToken, logout

module.exports = { register, login };
```

**`src/controllers/audit.controller.js`** (schema simile)

#### 4.3 Middleware

**`src/middleware/auth.middleware.js`**

```javascript
const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token non fornito" });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Aggiungi user al request

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token scaduto" });
    }
    return res.status(401).json({ error: "Token non valido" });
  }
}

module.exports = authMiddleware;
```

#### 4.4 Utils

**`src/utils/logger.js`**

```javascript
const winston = require("winston");
const path = require("path");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

module.exports = logger;
```

### STEP 5: Test Backend Locale (prima del deploy)

```bash
# Avvia in development mode
npm run dev

# In un altro terminale, testa endpoint
curl http://localhost:3000/health
```

### STEP 6: Deploy su Server e Start

```bash
# Configura Nginx (segui README.md FASE 4)
# Configura Systemd (segui README.md FASE 5)

# Start servizio
sudo systemctl start sgq-backend
sudo systemctl status sgq-backend
```

---

## 🔄 STEP 7: Integrazione Frontend React

Dopo che il backend è online, devi modificare il frontend per usare le API invece di IndexedDB.

### 7.1 Crea Service Layer React

**`app/src/services/apiClient.js`**

```javascript
const API_BASE = "https://www.fr-busato.it:10443/api/v1";

class ApiClient {
  constructor() {
    this.token = localStorage.getItem("jwt_token");
  }

  async request(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  }

  // Auth
  async login(email, password) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    this.token = data.token;
    localStorage.setItem("jwt_token", data.token);
    return data;
  }

  async register(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  // Audits
  async getAllAudits() {
    return this.request("/audits");
  }

  async getAudit(auditId) {
    return this.request(`/audits/${auditId}`);
  }

  async createAudit(auditData) {
    return this.request("/audits", {
      method: "POST",
      body: JSON.stringify(auditData),
    });
  }

  async updateAudit(auditId, auditData) {
    return this.request(`/audits/${auditId}`, {
      method: "PUT",
      body: JSON.stringify(auditData),
    });
  }

  // Attachments
  async uploadAttachment(file, metadata) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify(metadata));

    return this.request("/attachments", {
      method: "POST",
      headers: {
        // Non impostare Content-Type, FormData lo fa automaticamente
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });
  }
}

export default new ApiClient();
```

### 7.2 Modifica StorageContext per Usare API

**Strategia Hybrid**: Mantieni IndexedDB come cache locale, sincronizza con backend.

```javascript
// In StorageContext.jsx
import apiClient from "../services/apiClient";

const syncWithBackend = async (audit) => {
  try {
    // Prova sync con backend
    await apiClient.updateAudit(audit.audit_uuid, audit);
    console.log("✅ Synced to backend");
  } catch (error) {
    console.warn("⚠️ Backend sync failed, using local only:", error);
    // Fallback: salva solo in IndexedDB
  }
};

// Aggiungi syncWithBackend dopo ogni updateCurrentAudit
```

---

## 🎯 Timeline Stimata

| Step       | Attività                           | Tempo        | Responsabile |
| ---------- | ---------------------------------- | ------------ | ------------ |
| 1          | Esegui schema SQL                  | 5 min        | DB Admin     |
| 2          | Copia backend su server            | 10 min       | DevOps       |
| 3          | npm install + config .env          | 15 min       | DevOps       |
| 4          | Scrivi controllers/routes mancanti | 2-3 ore      | Developer    |
| 5          | Test locale backend                | 30 min       | Developer    |
| 6          | Deploy + config Nginx/Systemd      | 1 ora        | DevOps       |
| 7          | Integra frontend con API           | 3-4 ore      | Frontend Dev |
| 8          | Test end-to-end                    | 1 ora        | QA           |
| **TOTALE** |                                    | **8-10 ore** |              |

---

## ❓ Domande da Rispondere Prima di Procedere

1. **Hai già accesso SSH al server Ubuntu?**

   - Se sì, posso darti comandi diretti da eseguire
   - Se no, serve configurare accesso

2. **SQL Server Express è già configurato con SA password?**

   - Serve per eseguire lo script schema.sql

3. **Preferisci che continui a generare tutti i controller/routes ora?**

   - Oppure preferisci che ti dia solo lo scheletro e li completi tu?

4. **Frontend: vuoi approccio HYBRID (IndexedDB cache + backend sync)?**
   - O vuoi eliminare completamente IndexedDB e usare solo backend?

**Dimmi come vuoi procedere e continuo con l'implementazione!** 🚀
