# =============================================
# Script: Export Schema Completo da SQL Server
# Data: 11 gennaio 2026
# Scopo: Generare schema.sql aggiornato dopo migration
# =============================================

param(
    [string]$ServerInstance = "www.fr-busato.it,11043",
    [string]$Database = "SGQ_ISO9001",
    [string]$Username = "pascarella",
    [string]$Password = "",
    [string]$OutputFile = "..\schema.sql"
)

if (-not $Password) {
    $Password = $env:DB_PASSWORD
}
if (-not $Password) {
    throw "Password SQL mancante: passa -Password oppure imposta variabile d'ambiente DB_PASSWORD (non versionare in repo)."
}

Write-Host ">> Export Schema Database: $Database" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Connessione SQL
$connectionString = "Server=$ServerInstance;Database=$Database;User Id=$Username;Password=$Password;TrustServerCertificate=True;"

# Output header (evitiamo here-string per compatibilita encoding/parsing)
$timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
$header = @(
    "-- =============================================",
    "-- Schema Completo Database: $Database",
    "-- Generato: $timestamp",
    "-- Server: $ServerInstance",
    "-- ATTENZIONE: File generato automaticamente",
    "-- NON modificare manualmente, usa migration SQL",
    "-- =============================================",
    "",
    "USE [$Database];",
    'GO',
    ''
) -join [Environment]::NewLine

$header | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host ">> Esportazione tabelle..." -ForegroundColor Yellow

# Query per ottenere script CREATE TABLE di tutte le tabelle (here-string singolo @' '@ evita problemi encoding)
$query = @'
SELECT 
    'CREATE TABLE [' + t.name + '] (' + CHAR(13) + CHAR(10) +
    STUFF((
        SELECT ',' + CHAR(13) + CHAR(10) + 
            '    [' + c.name + '] ' + 
            TYPE_NAME(c.user_type_id) + 
            CASE 
                WHEN TYPE_NAME(c.user_type_id) IN ('varchar', 'nvarchar', 'char', 'nchar') 
                THEN '(' + CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length AS VARCHAR) END + ')'
                WHEN TYPE_NAME(c.user_type_id) IN ('decimal', 'numeric')
                THEN '(' + CAST(c.precision AS VARCHAR) + ',' + CAST(c.scale AS VARCHAR) + ')'
                ELSE ''
            END +
            CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE ' NULL' END +
            CASE WHEN c.is_identity = 1 THEN ' IDENTITY(1,1)' ELSE '' END
        FROM sys.columns c
        WHERE c.object_id = t.object_id
        ORDER BY c.column_id
        FOR XML PATH('')
    ), 1, 1, '') + CHAR(13) + CHAR(10) + ');' + CHAR(13) + CHAR(10) + 'GO' + CHAR(13) + CHAR(10)
FROM sys.tables t
WHERE t.is_ms_shipped = 0
ORDER BY t.name;
'@

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    
    $command = $connection.CreateCommand()
    $command.CommandText = $query
    
    $reader = $command.ExecuteReader()
    
    while ($reader.Read()) {
        $tableScript = $reader.GetString(0)
        $tableScript | Out-File -FilePath $OutputFile -Append -Encoding UTF8
    }
    
    $reader.Close()
    $connection.Close()
    
    Write-Host "OK Schema esportato in: $OutputFile" -ForegroundColor Green
    Write-Host ""
    Write-Host ">> Statistiche:" -ForegroundColor Cyan
    
    # Conta righe file
    $lines = (Get-Content $OutputFile).Count
    Write-Host "   - Righe totali: $lines" -ForegroundColor White
    
    # Conta tabelle
    $tables = (Get-Content $OutputFile | Select-String -Pattern "CREATE TABLE").Count
    Write-Host "   - Tabelle: $tables" -ForegroundColor White
    
} catch {
    Write-Host "ERRORE durante export: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "OK Export completato!" -ForegroundColor Green
