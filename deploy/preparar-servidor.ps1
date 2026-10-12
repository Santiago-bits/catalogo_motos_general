<#
.SYNOPSIS
  Prepara lo que se sube una sola vez a Hostinger (el código llega solo por git).

.DESCRIPTION
  Deja en deploy/out/:
    .env           va a public_html/laravel/.env (falta completar DB_PASSWORD)
    database.sql   copia de la base local para importar en phpMyAdmin
    storage.zip    imágenes y archivos subidos; se descomprime en public_html/

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\preparar-servidor.ps1 -DbName u404079745_motos -DbUser u404079745_motos
#>
param(
    [Parameter(Mandatory = $true)][string]$DbName,
    [Parameter(Mandatory = $true)][string]$DbUser,
    # Opcional: si se deja vacío, las URLs salen del dominio con el que se entra al sitio.
    [string]$Url = ''
)

$ErrorActionPreference = 'Stop'
$Url = $Url.TrimEnd('/')
$root = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root 'backend'
$out = Join-Path $PSScriptRoot 'out'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "Falló: $what (código $LASTEXITCODE)" } }

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null

# 1. .env del servidor ---------------------------------------------------------
Step 'Armando .env'
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$envText = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '.env.hostinger.example'), $utf8)
$envText = $envText -replace '(?m)^APP_KEY=.*$', ('APP_KEY=base64:' + [Convert]::ToBase64String($bytes))
$envText = $envText -replace '(?m)^APP_URL=.*$', "APP_URL=$Url"
$envText = $envText -replace '(?m)^DB_DATABASE=.*$', "DB_DATABASE=$DbName"
$envText = $envText -replace '(?m)^DB_USERNAME=.*$', "DB_USERNAME=$DbUser"
[IO.File]::WriteAllText((Join-Path $out '.env'), $envText, $utf8)

# 2. Base de datos -------------------------------------------------------------
Step 'Exportando la base local'
$localEnv = @{}
Get-Content (Join-Path $backend '.env') | Where-Object { $_ -match '^\s*([A-Z_]+)=(.*)$' } | ForEach-Object {
    $localEnv[$Matches[1]] = $Matches[2].Trim('"')
}
$mysqldump = 'C:\xampp\mysql\bin\mysqldump.exe'
if (-not (Test-Path $mysqldump)) { $mysqldump = 'mysqldump' }
$sql = Join-Path $out 'database.sql'
$dumpArgs = @("--host=$($localEnv['DB_HOST'])", "--port=$($localEnv['DB_PORT'])", "--user=$($localEnv['DB_USERNAME'])",
    '--default-character-set=utf8mb4', '--single-transaction', '--no-tablespaces', '--skip-add-locks',
    "--result-file=$sql", $localEnv['DB_DATABASE'])
if ($localEnv['DB_PASSWORD']) { $dumpArgs = @("--password=$($localEnv['DB_PASSWORD'])") + $dumpArgs }
& $mysqldump @dumpArgs
Check 'mysqldump'

# Las imágenes quedaron guardadas con la URL local: pasan al dominio (o a ruta relativa /storage/...).
$dump = [IO.File]::ReadAllText($sql, $utf8)
foreach ($local in 'http://localhost:8000', 'http://127.0.0.1:8000') { $dump = $dump.Replace($local, $Url) }
[IO.File]::WriteAllText($sql, $dump, $utf8)

# 3. Archivos subidos ----------------------------------------------------------
Step 'Comprimiendo imágenes subidas'
$uploads = Join-Path $backend 'storage\app\public'
$stage = Join-Path $out 'storage'
New-Item -ItemType Directory -Force $stage | Out-Null
if (Test-Path $uploads) { Get-ChildItem $uploads -Exclude '.gitignore' | Copy-Item -Destination $stage -Recurse -Force }
# tar de Windows arma el zip con rutas "/" (Compress-Archive usa "\" y en Linux se rompe).
& "$env:SystemRoot\System32\tar.exe" -a -c -f (Join-Path $out 'storage.zip') -C $out storage
Check 'tar'
Remove-Item $stage -Recurse -Force

Write-Host "`nListo. Archivos en $out" -ForegroundColor Green
Write-Host '  .env         -> public_html/laravel/.env (completá DB_PASSWORD)'
Write-Host '  database.sql -> importar en phpMyAdmin'
Write-Host '  storage.zip  -> subir a public_html/ y descomprimir'
