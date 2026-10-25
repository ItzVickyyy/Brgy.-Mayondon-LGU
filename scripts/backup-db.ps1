# Backup the local PostgreSQL database to a file outside Docker.
# Run from the repository root in PowerShell with Docker Compose running.

$ErrorActionPreference = "Stop"

$containerId = (docker compose ps -q db).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
    throw "The database container is not running. Start it with 'docker compose up -d db' first."
}

$backupDirectory = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$fileName = "mayondon-db-$timestamp.dump"
$containerPath = "/tmp/$fileName"
$backupPath = Join-Path $backupDirectory $fileName

Write-Host "Creating PostgreSQL custom-format backup..."
docker compose exec -T db pg_dump -U postgres -d app -Fc -f $containerPath
if ($LASTEXITCODE -ne 0) {
    docker compose exec -T db rm -f $containerPath
    throw "pg_dump failed. No backup was confirmed."
}

docker cp "$($containerId):$containerPath" "$backupPath"
if ($LASTEXITCODE -ne 0) {
    docker compose exec -T db rm -f $containerPath
    throw "Copying the backup from the container failed."
}

docker compose exec -T db rm -f $containerPath
if ($LASTEXITCODE -ne 0) {
    Write-Warning "The backup was copied, but the temporary container file could not be removed."
}

Write-Host "Backup created: $backupPath"
Write-Warning "This file contains resident data. Store it securely, restrict access, and keep a protected copy on separate storage."
