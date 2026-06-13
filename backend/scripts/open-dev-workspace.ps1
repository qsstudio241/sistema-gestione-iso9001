# Apre Cursor sulla copia locale di sviluppo (non la junction C:\ProgettoISO).
$devRoot = 'C:\Dev\ProgettoISO'
if (-not (Test-Path -LiteralPath $devRoot)) {
    throw "Workspace non trovato: $devRoot"
}
$cursor = Join-Path $env:LOCALAPPDATA 'Programs\cursor\Cursor.exe'
if (-not (Test-Path -LiteralPath $cursor)) {
    throw "Cursor.exe non trovato in $cursor"
}
Start-Process -FilePath $cursor -ArgumentList @($devRoot)
