# Destructive-operation-free backup/restore smoke test.
# This uses a temporary PostgreSQL database and never targets the application "app" database.
# Run from any directory in PowerShell while the Compose database and backend are running.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$backupDirectory = Join-Path $repoRoot "backups"
$backupScript = Join-Path $PSScriptRoot "backup-db.ps1"
$restoreScript = Join-Path $PSScriptRoot "restore-db.ps1"
$timestamp = Get-Date -Format "yyyyMMddHHmmssfff"
$databaseName = "mayondon_backup_test_$timestamp"
$previousDatabaseName = $env:MAYONDON_DATABASE_NAME
$backupPath = $null
$databaseCreated = $false

Push-Location $repoRoot
try {
    $dbContainer = (docker compose -f compose.yml ps -q db).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($dbContainer)) {
        throw "The database container is not running. Start the stack with 'docker compose -f compose.yml up -d' first."
    }

    $backendContainer = (docker compose -f compose.yml ps -q backend).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($backendContainer)) {
        throw "The backend container must be running because the restore procedure stops and restarts it."
    }

    docker compose -f compose.yml exec -T db createdb -U postgres $databaseName
    if ($LASTEXITCODE -ne 0) {
        throw "Could not create the temporary verification database."
    }
    $databaseCreated = $true
    $env:MAYONDON_DATABASE_NAME = $databaseName

    $createSql = "CREATE TABLE backup_restore_smoke (id integer PRIMARY KEY, marker text NOT NULL); INSERT INTO backup_restore_smoke (id, marker) VALUES (1, 'original-before-backup');"
    docker compose -f compose.yml exec -T db psql -U postgres -d $databaseName -v ON_ERROR_STOP=1 -c $createSql
    if ($LASTEXITCODE -ne 0) {
        throw "Could not prepare the temporary verification record."
    }

    $existingBackups = @(
        Get-ChildItem -LiteralPath $backupDirectory -Filter "mayondon-db-*.dump" -File -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName }
    )
    & $backupScript
    if ($LASTEXITCODE -ne 0) {
        throw "The backup script failed."
    }

    $createdBackup = Get-ChildItem -LiteralPath $backupDirectory -Filter "mayondon-db-*.dump" -File |
        Where-Object { $_.FullName -notin $existingBackups } |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
    if ($null -eq $createdBackup -or $createdBackup.Length -le 0) {
        throw "The backup script did not create a new, non-empty archive."
    }
    $backupPath = $createdBackup.FullName

    docker compose -f compose.yml exec -T db psql -U postgres -d $databaseName -v ON_ERROR_STOP=1 -c "UPDATE backup_restore_smoke SET marker = 'changed-after-backup' WHERE id = 1;"
    if ($LASTEXITCODE -ne 0) {
        throw "Could not change the temporary verification record."
    }

    & $restoreScript -BackupFile $backupPath -Confirmation "RESTORE"
    if ($LASTEXITCODE -ne 0) {
        throw "The restore script failed."
    }

    $actual = docker compose -f compose.yml exec -T db psql -U postgres -d $databaseName -qAt -c "SELECT marker FROM backup_restore_smoke WHERE id = 1;"
    if ($LASTEXITCODE -ne 0) {
        throw "Could not read the restored verification record."
    }
    $actual = ($actual | Out-String).Trim()
    if ($actual -cne "original-before-backup") {
        throw "Restore verification failed. Expected 'original-before-backup', received '$actual'."
    }

    Write-Host "PASS: backup archive created, restored, and original data verified."
}
finally {
    if ($databaseCreated) {
        docker compose -f compose.yml exec -T db dropdb -U postgres --if-exists $databaseName
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Could not remove the temporary verification database '$databaseName'."
        }
    }
    if ($backupPath -and (Test-Path -LiteralPath $backupPath)) {
        Remove-Item -LiteralPath $backupPath -Force
    }
    if ($null -eq $previousDatabaseName) {
        Remove-Item Env:MAYONDON_DATABASE_NAME -ErrorAction SilentlyContinue
    } else {
        $env:MAYONDON_DATABASE_NAME = $previousDatabaseName
    }
    Pop-Location
}
