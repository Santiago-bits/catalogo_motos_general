<#
.SYNOPSIS
  Arma el paquete para subir a Hostinger.

.DESCRIPTION
  Deja en deploy/out/:
    laravel/       backend listo para producción (vendor sin dev, .env con APP_URL y APP_KEY)
    public_html/   sitio Angular compilado + index.php + .htaccess + imágenes subidas (storage/)
    database.sql   copia de la base local con las URLs de imágenes apuntando al dominio
    hostinger.zip  las dos carpetas juntas, para subir y descomprimir en domains/<dominio>/

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\build-hostinger.ps1 -Url https://motos.com.ar
#>
param(
    [Parameter(Mandatory = $true)][string]$Url,
    [switch]$SkipDatabase,
    [switch]$SkipFrontend
)

$ErrorActionPreference = 'Stop'
$Url = $Url.TrimEnd('/')
$root = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$out = Join-Path $PSScriptRoot 'out'
$laravel = Join-Path $out 'laravel'
$public = Join-Path $out 'public_html'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "Falló: $what (código $LASTEXITCODE)" } }

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $laravel, $public | Out-Null

# 1. Sitio Angular -------------------------------------------------------------
if (-not $SkipFrontend) {
    Step 'Compilando el sitio (Angular, producción)'
    Push-Location $frontend
    try {
        if (-not (Test-Path 'node_modules')) { npm ci; Check 'npm ci' }
        $env:NODE_OPTIONS = '--max-old-space-size=4096'
        npx ng build --configuration production
        Check 'ng build'
    } finally { Pop-Location }
}
$browser = Join-Path $frontend 'dist\frontend\browser'
if (-not (Test-Path (Join-Path $browser 'index.html'))) { throw "No está el build del sitio en $browser" }

# 2. Backend Laravel -----------------------------------------------------------
Step 'Copiando el backend'
$excludeDirs = @('vendor', 'node_modules', 'tests', '.git', '.idea', '.vscode',
    (Join-Path $backend 'public'), (Join-Path $backend 'storage'))
robocopy $backend $laravel /E /NFL /NDL /NJH /NJS /NP /XD $excludeDirs /XF .env .env.* *.md *.log .phpunit.result.cache | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'Falló la copia del backend' }

# storage vacío con la estructura que Laravel necesita (las imágenes van a public_html/storage).
foreach ($dir in 'app\private', 'framework\cache\data', 'framework\sessions', 'framework\views', 'logs') {
    New-Item -ItemType Directory -Force (Join-Path $laravel "storage\$dir") | Out-Null
}
# Cachés locales: listan paquetes de desarrollo que en producción no están.
Remove-Item (Join-Path $laravel 'bootstrap\cache\*.php') -Force -ErrorAction SilentlyContinue

Step 'Instalando dependencias de producción (composer --no-dev)'
Push-Location $laravel
try {
    composer install --no-dev --optimize-autoloader --no-interaction --no-progress
    Check 'composer install'
} finally { Pop-Location }

Step 'Armando laravel/.env'
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$envText = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '.env.hostinger.example'), $utf8)
$envText = $envText.Replace('https://<tu-dominio.com>', $Url)
$envText = $envText -replace '(?m)^APP_KEY=.*$', ('APP_KEY=base64:' + [Convert]::ToBase64String($bytes))
[IO.File]::WriteAllText((Join-Path $laravel '.env'), $envText, $utf8)

# 3. public_html ---------------------------------------------------------------
Step 'Armando public_html'
Copy-Item (Join-Path $browser '*') $public -Recurse -Force
Copy-Item (Join-Path $backend 'public\robots.txt') $public -Force
Copy-Item (Join-Path $PSScriptRoot 'public_html\index.php') $public -Force
Copy-Item (Join-Path $PSScriptRoot 'public_html\.htaccess') $public -Force
$storage = Join-Path $public 'storage'
New-Item -ItemType Directory -Force $storage | Out-Null
$uploads = Join-Path $backend 'storage\app\public'
if (Test-Path $uploads) {
    Get-ChildItem $uploads -Exclude '.gitignore' | Copy-Item -Destination $storage -Recurse -Force
}

# 4. Base de datos -------------------------------------------------------------
if (-not $SkipDatabase) {
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

    # Las imágenes quedaron guardadas con la URL local: se pasan al dominio.
    $dump = [IO.File]::ReadAllText($sql, $utf8)
    foreach ($local in 'http://localhost:8000', 'http://127.0.0.1:8000') { $dump = $dump.Replace($local, $Url) }
    [IO.File]::WriteAllText($sql, $dump, $utf8)
}

# 5. Zip -----------------------------------------------------------------------
Step 'Comprimiendo hostinger.zip'
# tar de Windows arma el zip con rutas "/" (Compress-Archive usa "\" y en Linux se rompe).
& "$env:SystemRoot\System32\tar.exe" -a -c -f (Join-Path $out 'hostinger.zip') -C $out laravel public_html
Check 'tar'

Write-Host "`nListo. Archivos en $out" -ForegroundColor Green
Write-Host '  1. Subí hostinger.zip a domains/<dominio>/ y descomprimilo (reemplaza public_html).'
Write-Host '  2. En laravel/.env completá DB_DATABASE, DB_USERNAME y DB_PASSWORD.'
if (-not $SkipDatabase) { Write-Host '  3. Importá database.sql desde phpMyAdmin.' }
