# One-time setup of the GPMS database on a local PostgreSQL server.
#
#   powershell -ExecutionPolicy Bypass -File .\setup-postgres.ps1
#
# What it does:
#   1. Creates a dedicated login role `gpms_app` (random password) and database `gpms`.
#      psql will ask for YOUR `postgres` superuser password — it is typed into psql only, never stored.
#   2. Writes backend\.env pointing the API at that database (with a fresh JWT secret).
#   3. Runs migrations and seeds reference data + the first Super Admin (+ optional demo data).
param(
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',
  [string]$PgHost = 'localhost',
  [int]$PgPort = 5432,
  [string]$Database = 'gpms',
  [string]$AdminEmail = 'admin@gpms.local',
  [switch]$Demo
)
$ErrorActionPreference = 'Stop'
$psql = Join-Path $PgBin 'psql.exe'
if (-not (Test-Path $psql)) { throw "psql.exe not found in $PgBin. Pass -PgBin with your PostgreSQL bin folder." }

function New-Secret([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return ([Convert]::ToBase64String($b) -replace '[+/=]', '')
}

$appPassword = New-Secret 24
$sql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gpms_app') THEN
    CREATE ROLE gpms_app LOGIN PASSWORD '$appPassword';
  ELSE
    ALTER ROLE gpms_app WITH LOGIN PASSWORD '$appPassword';
  END IF;
END
`$`$;
SELECT 'CREATE DATABASE $Database OWNER gpms_app ENCODING ''UTF8'''
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$Database')\gexec
"@

$tmp = New-TemporaryFile
try {
  Set-Content -Path $tmp -Value $sql -Encoding ascii
  Write-Host "Creating role gpms_app and database $Database (enter the postgres superuser password when asked)..." -ForegroundColor Cyan
  & $psql -h $PgHost -p $PgPort -U postgres -d postgres -v ON_ERROR_STOP=1 -f $tmp
  if ($LASTEXITCODE -ne 0) { throw 'psql failed — database was not created.' }
} finally {
  Remove-Item $tmp -Force
}

$backend = Join-Path $PSScriptRoot 'backend'
$envFile = Join-Path $backend '.env'
if (Test-Path $envFile) { Copy-Item $envFile "$envFile.bak" -Force; Write-Host "Existing .env backed up to .env.bak" }
@"
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://gpms_app:$appPassword@${PgHost}:$PgPort/$Database
DB_POOL_MAX=10
JWT_SECRET=$(New-Secret 48)
JWT_EXPIRES_IN=8h
APP_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
ADMIN_EMAIL=$AdminEmail
UPLOAD_DIR=uploads
MAX_UPLOAD_MB=5
"@ | Set-Content -Path $envFile -Encoding utf8

Push-Location $backend
try {
  if (-not (Test-Path 'node_modules')) { npm install }
  npm run migrate
  if ($Demo) { node --env-file=.env src/seed.js --demo } else { node --env-file=.env src/seed.js }
} finally {
  Pop-Location
}
Write-Host "`nDone. Note the Super Admin password printed above, then start the app (see README.md)." -ForegroundColor Green
