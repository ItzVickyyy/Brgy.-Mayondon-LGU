param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)

# Restore a PostgreSQL custom-format backup into the current local database.
# This can replace existing database objects and data. Back up the current DB first.

$ErrorActionPreference = "Stop"

$resolvedBackup = Resolve-Path -LiteralPath $BackupFile
if (-not (Test-Path -LiteralPath $resolvedBackup -PathType Leaf)) {
    throw "Backup file not found: $BackupFile"
}

$containerId = (docker compose ps -q db).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
    throw "The database container is not running. Start it with 'docker compose up -d db' first."
}

Write-Warning "RESTORE WARNING: this operation can replace current application database objects and data."
Write-Host "Backup selected: $resolvedBackup"
$confirmation = Read-Host "Type RESTORE to continue"
if ($confirmation -cne "RESTORE") {
    Write-Host "Restore cancelled. No changes were made."
    exit 0
}

$containerPath = "/tmp/mayondon-restore.dump"
docker cp "$resolvedBackup" "$($containerId):$containerPath"
if ($LASTEXITCODE -ne 0) {
    throw "Copying the backup into the database container failed."
}

try {
    docker compose exec -T db pg_restore -U postgres -d app --clean --if-exists --no-owner --no-privileges $containerPath
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore reported an error. Review the output and verify the database before using the system."
    }
    Write-Host "Restore command completed. Verify login, key records, and application workflows before returning the system to use."
}
finally {
    docker compose exec -T db rm -f $containerPath
}
