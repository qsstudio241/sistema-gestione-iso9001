# =========================================
# Script Deploy Backend SGQ ISO 9001 - Produzione
# Server: www.fr-busato.it
# Porta: 10443 (HTTPS)
# =========================================

Write-Host "=== DEPLOY BACKEND SGQ ISO 9001 - PRODUZIONE ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verifica Node.js
Write-Host "[1/7] Verifica Node.js installato..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js versione: $nodeVersion" -ForegroundColor Green
    
    if (-not ($nodeVersion -match "v2\d\.")) {
        Write-Host "⚠ ATTENZIONE: Richiesto Node.js 20.x, trovato $nodeVersion" -ForegroundColor Red
        $continue = Read-Host "Continuare comunque? (s/n)"
        if ($continue -ne "s") { exit 1 }
    }
} catch {
    Write-Host "✗ Node.js NON trovato. Installare Node.js 20.x LTS" -ForegroundColor Red
    exit 1
}

$npmVersion = npm --version
Write-Host "✓ npm versione: $npmVersion" -ForegroundColor Green
Write-Host ""

# Step 2: Definisci directory di destinazione
$backendDir = "C:\inetpub\SGQ-Backend"
Write-Host "[2/7] Directory backend: $backendDir" -ForegroundColor Yellow

# Step 3: Crea directory se non esiste
if (-not (Test-Path $backendDir)) {
    Write-Host "  Creazione directory $backendDir..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $backendDir -Force | Out-Null
    Write-Host "✓ Directory creata" -ForegroundColor Green
} else {
    Write-Host "✓ Directory già esistente" -ForegroundColor Green
}
Write-Host ""

# Step 4: Copia file backend (ESCLUDI node_modules, logs, uploads)
Write-Host "[3/7] Copia file backend..." -ForegroundColor Yellow
$sourceDir = Split-Path -Parent $PSScriptRoot | Join-Path -ChildPath "backend"

if (-not (Test-Path $sourceDir)) {
    Write-Host "✗ Directory sorgente non trovata: $sourceDir" -ForegroundColor Red
    exit 1
}

# Lista file/cartelle da copiare
$itemsToCopy = @(
    "src",
    "config",
    "package.json",
    "package-lock.json",
    ".env.production"
)

foreach ($item in $itemsToCopy) {
    $source = Join-Path $sourceDir $item
    $dest = Join-Path $backendDir $item
    
    if (Test-Path $source) {
        Write-Host "  Copia: $item" -ForegroundColor Gray
        if (Test-Path $source -PathType Container) {
            # Copia directory
            Copy-Item -Path $source -Destination $dest -Recurse -Force
        } else {
            # Copia file
            Copy-Item -Path $source -Destination $dest -Force
        }
    } else {
        Write-Host "  ⚠ $item non trovato, skip" -ForegroundColor DarkYellow
    }
}
Write-Host "✓ File copiati" -ForegroundColor Green
Write-Host ""

# Step 5: Crea .env produzione
Write-Host "[4/7] Configurazione .env produzione..." -ForegroundColor Yellow
$envPath = Join-Path $backendDir ".env"

$envContent = @"
# =========================================
# BACKEND API - PRODUZIONE
# =========================================

# Server
NODE_ENV=production
PORT=10443
API_BASE_PATH=/api/v1

# Database SQL Server
DB_SERVER=www.fr-busato.it
DB_PORT=11043
DB_DATABASE=SGQ_ISO9001
DB_USER=your_sql_user
DB_PASSWORD=__REPLACE_WITH_STRONG_SQL_PASSWORD__
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# JWT Authentication
JWT_SECRET=__REPLACE_WITH_RANDOM_SECRET_MIN_32_CHARS__
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://systemgest.netlify.app,https://www.fr-busato.it
CORS_CREDENTIALS=true

# File Upload
UPLOAD_MAX_SIZE=52428800
UPLOAD_DIR=./uploads
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,audio/mpeg,audio/mp4,audio/wav,video/mp4,video/webem,application/pdf

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_DIR=./logs

# SSL/TLS
SSL_ENABLED=true
SSL_KEY_PATH=C:\Certbot\live\www.fr-busato.it\privkey.pem
SSL_CERT_PATH=C:\Certbot\live\www.fr-busato.it\fullchain.pem

# Backup automatico
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_DIR=C:\Backups\sgq-iso9001
BACKUP_RETENTION_DAYS=30
"@

Set-Content -Path $envPath -Value $envContent -Encoding UTF8
Write-Host "✓ File .env creato" -ForegroundColor Green
Write-Host ""

# Step 6: Installa dipendenze npm
Write-Host "[5/7] Installazione dipendenze npm..." -ForegroundColor Yellow
Push-Location $backendDir
try {
    npm install --production --no-audit --no-fund
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dipendenze installate" -ForegroundColor Green
    } else {
        Write-Host "✗ Errore installazione dipendenze" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} catch {
    Write-Host "✗ Errore npm install: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host ""

# Step 7: Crea cartelle necessarie
Write-Host "[6/7] Creazione cartelle runtime..." -ForegroundColor Yellow
$folders = @(
    (Join-Path $backendDir "logs"),
    (Join-Path $backendDir "uploads"),
    "C:\Backups\sgq-iso9001"
)

foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Write-Host "  ✓ Creata: $folder" -ForegroundColor Green
    } else {
        Write-Host "  ✓ Esiste: $folder" -ForegroundColor Gray
    }
}
Write-Host ""

# Step 8: Test connessione database
Write-Host "[7/7] Test connessione database..." -ForegroundColor Yellow
Push-Location $backendDir
try {
    $testScript = @"
require('dotenv').config();
const sql = require('mssql');
const config = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_DATABASE || 'SGQ_ISO9001',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};
if (!config.user || !config.password) {
    console.error('Manca DB_USER o DB_PASSWORD nel file .env appena creato. Compila i placeholder e riesegui.');
    process.exit(1);
}
sql.connect(config).then(pool => {
    console.log('✓ Connessione database OK');
    process.exit(0);
}).catch(err => {
    console.error('✗ Errore database:', err.message);
    process.exit(1);
});
"@
    
    $testFile = Join-Path $backendDir "test-db-temp.js"
    Set-Content -Path $testFile -Value $testScript -Encoding UTF8
    
    node $testFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database raggiungibile" -ForegroundColor Green
    } else {
        Write-Host "✗ Database NON raggiungibile" -ForegroundColor Red
    }
    
    Remove-Item $testFile -ErrorAction SilentlyContinue
} catch {
    Write-Host "⚠ Test database fallito: $_" -ForegroundColor DarkYellow
}
Pop-Location
Write-Host ""

# Riepilogo
Write-Host "=== DEPLOY COMPLETATO ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Directory backend: $backendDir" -ForegroundColor White
Write-Host "File .env: $envPath" -ForegroundColor White
Write-Host ""
Write-Host "PROSSIMI STEP:" -ForegroundColor Yellow
Write-Host "1. Configura backend come servizio Windows (pm2 o NSSM)" -ForegroundColor White
Write-Host "2. Avvia backend: cd $backendDir; npm start" -ForegroundColor White
Write-Host "3. Testa: Invoke-WebRequest https://www.fr-busato.it:10443/health" -ForegroundColor White
Write-Host ""
Write-Host "Per avviare manualmente ora:" -ForegroundColor Cyan
Write-Host "  cd $backendDir" -ForegroundColor Gray
Write-Host "  npm start" -ForegroundColor Gray
Write-Host ""

# Chiedi se avviare subito
$startNow = Read-Host "Avviare backend ora? (s/n)"
if ($startNow -eq "s") {
    Write-Host ""
    Write-Host "=== AVVIO BACKEND ===" -ForegroundColor Cyan
    Push-Location $backendDir
    npm start
    Pop-Location
}
