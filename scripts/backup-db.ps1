# Back up the local PostgreSQL database to a file outside Docker.
# Run from the repository root in PowerShell with Docker Compose running.
# MAYONDON_DATABASE_NAME is an optional override used by the isolated smoke test.
# This script writes an UNENCRYPTED file. Once backup encryption is set up
# (backups\backup-public.pem exists) it refuses to run unless -AllowPlain is given;
# use scripts\scheduled-backup.ps1 instead, which encrypts.

param([switch]$AllowPlain)

$ErrorActionPreference = "Stop"

if ((Test-Path -LiteralPath (Join-Path (Get-Location) "backups\backup-public.pem")) -and -not $AllowPlain) {
    throw "Backup encryption is set up, and this script would write an unencrypted file. Run .\scripts\scheduled-backup.ps1 instead (or add -AllowPlain if you really want a plain file)."
}

$databaseName = if ([string]::IsNullOrWhiteSpace($env:MAYONDON_DATABASE_NAME)) {
    "app"
} else {
    $env:MAYONDON_DATABASE_NAME
}
if ($databaseName -notmatch "^[A-Za-z0-9_]+$") {
    throw "MAYONDON_DATABASE_NAME may contain only letters, numbers, and underscores."
}

$containerId = (docker compose -f compose.yml ps -q db).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
    throw "The database container is not running. Start it with 'docker compose -f compose.yml up -d db' first."
}

$backupDirectory = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

# Milliseconds prevent two backups created in the same second from overwriting.
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$fileName = "mayondon-db-$timestamp.dump"
$containerPath = "/tmp/$fileName"
$backupPath = Join-Path $backupDirectory $fileName

Write-Host "Creating PostgreSQL custom-format backup of database '$databaseName'..."
docker compose -f compose.yml exec -T db pg_dump -U postgres -d $databaseName -Fc -f $containerPath
if ($LASTEXITCODE -ne 0) {
    docker compose -f compose.yml exec -T db rm -f $containerPath
    throw "pg_dump failed. No backup was confirmed."
}

docker compose -f compose.yml exec -T db pg_restore --list $containerPath
if ($LASTEXITCODE -ne 0) {
    docker compose -f compose.yml exec -T db rm -f $containerPath
    throw "The generated backup could not be validated as a PostgreSQL archive."
}

docker cp "$($containerId):$containerPath" "$backupPath"
if ($LASTEXITCODE -ne 0) {
    docker compose -f compose.yml exec -T db rm -f $containerPath
    throw "Copying the backup from the container failed."
}

if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
    docker compose -f compose.yml exec -T db rm -f $containerPath
    throw "The backup file is missing after copying."
}
if ((Get-Item -LiteralPath $backupPath).Length -le 0) {
    Remove-Item -LiteralPath $backupPath -Force
    docker compose -f compose.yml exec -T db rm -f $containerPath
    throw "The copied backup file is empty."
}

docker compose -f compose.yml exec -T db rm -f $containerPath
if ($LASTEXITCODE -ne 0) {
    Write-Warning "The backup was copied, but the temporary container file could not be removed."
}

Write-Host "Backup created: $backupPath"
Write-Warning "This file contains resident data. Store it securely, restrict access, and keep a protected copy on separate storage."
