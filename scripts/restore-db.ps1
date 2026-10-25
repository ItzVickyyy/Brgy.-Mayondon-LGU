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

$containerId = (docker compose -f compose.yml ps -q db).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
    throw "The database container is not running. Start it with 'docker compose -f compose.yml up -d db' first."
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

# Validate that PostgreSQL can read the archive before stopping the application.
docker compose -f compose.yml exec -T db pg_restore --list $containerPath
if ($LASTEXITCODE -ne 0) {
    docker compose -f compose.yml exec -T db rm -f $containerPath
    throw "The selected file is not a readable PostgreSQL custom-format backup. The backend was not stopped."
}

# Prevent requests from changing data while the restore is in progress.
docker compose -f compose.yml stop backend
if ($LASTEXITCODE -ne 0) {
    docker compose -f compose.yml exec -T db rm -f $containerPath
    throw "Could not stop the backend. Restore cancelled."
}

$restoreSucceeded = $false
try {
    docker compose -f compose.yml exec -T db pg_restore --exit-on-error -U postgres -d app --clean --if-exists --no-owner --no-privileges $containerPath
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore reported an error. The backend will remain stopped until the database is checked."
    }
    $restoreSucceeded = $true
}
finally {
    docker compose -f compose.yml exec -T db rm -f $containerPath
}

if ($restoreSucceeded) {
    docker compose -f compose.yml start backend
    if ($LASTEXITCODE -ne 0) {
        throw "Restore completed, but the backend did not restart. Verify the database and start the backend manually."
    }
    Write-Host "Restore command completed and backend restarted. Verify login, key records, and application workflows before returning the system to use."
}
else {
    throw "Restore did not complete. Keep the backend stopped and verify the database before restarting the application."
}
