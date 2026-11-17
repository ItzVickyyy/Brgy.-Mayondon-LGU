param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,

    # Optional explicit confirmation for automated recovery tests.
    # Without this parameter, the script always prompts interactively.
    [string]$Confirmation,

    # Needed when the backup is encrypted (*.dump.enc): the private key file
    # (backup-private.pem, normally the copy on the USB drive). The script asks
    # for the passphrase; it is never put on a command line or written to disk.
    [string]$KeyFile
)

# Restore a PostgreSQL custom-format backup into the selected local database.
# This can replace existing database objects and data. Back up the current DB first.
# MAYONDON_DATABASE_NAME is an optional override used by the isolated smoke test.

$ErrorActionPreference = "Stop"

$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).ProviderPath
if (-not (Test-Path -LiteralPath $resolvedBackup -PathType Leaf)) {
    throw "Backup file not found: $BackupFile"
}
if ((Get-Item -LiteralPath $resolvedBackup).Length -le 0) {
    throw "The selected backup file is empty."
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

Write-Warning "RESTORE WARNING: this operation can replace current database objects and data in '$databaseName'."
Write-Host "Backup selected: $resolvedBackup"
if ([string]::IsNullOrWhiteSpace($Confirmation)) {
    $Confirmation = Read-Host "Type RESTORE to continue"
}
if ($Confirmation -cne "RESTORE") {
    Write-Host "Restore cancelled. No changes were made."
    exit 0
}

# An encrypted backup is opened first, inside a short-lived backend container
# that does not touch the database. The plain copy lives in the backups folder
# only until it has been copied into the database container.
$decryptedTemp = $null
if ($resolvedBackup.EndsWith(".enc", [System.StringComparison]::OrdinalIgnoreCase)) {
    if ([string]::IsNullOrWhiteSpace($KeyFile)) {
        throw "This backup is encrypted. Run again with -KeyFile <path to backup-private.pem> (the copy kept away from this computer)."
    }
    $resolvedKey = (Resolve-Path -LiteralPath $KeyFile).ProviderPath
    $secure = Read-Host "Backup passphrase (the sealed paper)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $env:BACKUP_PASSPHRASE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $backupFolder = Join-Path (Get-Location) "backups"
    New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
    $backupFolderFull = (Resolve-Path -LiteralPath $backupFolder).ProviderPath.TrimEnd("\")
    $tempName = "restore-temp-$([guid]::NewGuid().ToString('N')).dump"
    $decryptedTemp = Join-Path $backupFolderFull $tempName
    $script:staged = @()
    # Docker Desktop cannot always see a USB drive (a drive plugged in after Docker started shows up
    # EMPTY inside a container), so a mount of the key's folder would fail with a misleading "wrong
    # passphrase". The key (and a backup kept outside backups\) is copied into backups\ for the few
    # seconds the decryption takes, and always deleted afterwards.
    function Copy-IntoBackups([string]$path) {
        $parent = (Split-Path -Parent $path).TrimEnd("\")
        if ($parent -ieq $backupFolderFull) { return (Split-Path -Leaf $path) }
        $name = "restore-temp-$([guid]::NewGuid().ToString('N'))-$(Split-Path -Leaf $path)"
        $copy = Join-Path $backupFolderFull $name
        Copy-Item -LiteralPath $path -Destination $copy -Force
        $script:staged += $copy
        return $name
    }
    $decryptExit = $null
    try {
        $inName = Copy-IntoBackups $resolvedBackup
        $keyName = Copy-IntoBackups $resolvedKey
        docker compose -f compose.yml run --rm -T --no-deps -e MIGRATE_ON_START=false -e BACKUP_PASSPHRASE `
            backend python -m app.backup_cli decrypt `
            --in "/backups/$inName" `
            --key "/backups/$keyName" `
            --out "/backups/$tempName"
        $decryptExit = $LASTEXITCODE
    }
    finally {
        Remove-Item Env:BACKUP_PASSPHRASE -ErrorAction SilentlyContinue
        foreach ($copy in $script:staged) { Remove-Item -LiteralPath $copy -Force -ErrorAction SilentlyContinue }
        # Stopped before the decryption reported back (Ctrl+C, an error): do not leave a half-written
        # plain copy of the database in backups\.
        if ($null -eq $decryptExit) { Remove-Item -LiteralPath $decryptedTemp -Force -ErrorAction SilentlyContinue }
    }
    if ($decryptExit -ne 0 -or -not (Test-Path -LiteralPath $decryptedTemp)) {
        Remove-Item -LiteralPath $decryptedTemp -Force -ErrorAction SilentlyContinue
        throw "The backup could not be decrypted (wrong passphrase or key file, or the file is damaged). Nothing was changed."
    }
    $resolvedBackup = $decryptedTemp
}

$containerPath = "/tmp/mayondon-restore-$([guid]::NewGuid().ToString('N')).dump"
$copyExit = 1
try {
    docker cp "$resolvedBackup" "$($containerId):$containerPath"
    $copyExit = $LASTEXITCODE
}
finally {
    # The plain copy of an encrypted backup never outlives this step, even when it is interrupted.
    if ($decryptedTemp) {
        Remove-Item -LiteralPath $decryptedTemp -Force -ErrorAction SilentlyContinue
    }
}
if ($copyExit -ne 0) {
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
    docker compose -f compose.yml exec -T db pg_restore --exit-on-error -U postgres -d $databaseName --clean --if-exists --no-owner --no-privileges $containerPath
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore reported an error. The backend will remain stopped until the database is checked."
    }
    $restoreSucceeded = $true
}
finally {
    docker compose -f compose.yml exec -T db rm -f $containerPath
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "The restore finished, but the temporary container file could not be removed."
    }
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
