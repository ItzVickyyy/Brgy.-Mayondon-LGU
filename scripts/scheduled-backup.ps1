# One scheduled backup: asks the backend container to make, check and record a
# backup (python -m app.backup_cli), writes the outcome to backups\last-run.json,
# and optionally copies the newest file to another drive.
# Normally started by the Task Scheduler task made by register-backup-task.ps1,
# but it can be run by hand from anywhere:  .\scripts\scheduled-backup.ps1
# Exit code: 0 = backup made, 1 = backup failed, 2 = could not start, 3 = made but the copy failed.

param(
    # Optional second location, for example an external drive: "E:\MayondonBackups".
    [string]$CopyTo,

    # How many files to keep in -CopyTo. The app prunes its own backups folder itself.
    [ValidateRange(1, 365)]
    [int]$KeepCopies = 14
)

$ErrorActionPreference = "Stop"

# The repository root is the folder above scripts\.
Set-Location (Split-Path -Parent $PSScriptRoot)
$backupDirectory = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$statusFile = Join-Path $backupDirectory "last-run.json"

function Write-Status([bool]$ok, [int]$code, [string]$message, [string]$copiedTo) {
    $status = [ordered]@{
        finished_at = (Get-Date).ToString("o")
        ok          = $ok
        exit_code   = $code
        message     = $message
        copied_to   = $copiedTo
    }
    $status | ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding UTF8
}

# Native commands write progress to stderr; do not let that stop the script.
$ErrorActionPreference = "Continue"
$output = (& docker compose -f compose.yml exec -T backend python -m app.backup_cli 2>&1 | Out-String).Trim()
$exitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($exitCode -ne 0) {
    $message = if ($output) { $output } else { "docker compose could not run the backup (is Docker Desktop running?)." }
    Write-Status $false $(if ($exitCode -eq 1) { 1 } else { 2 }) $message ""
    Write-Warning $message
    exit $(if ($exitCode -eq 1) { 1 } else { 2 })
}

$copiedTo = ""
if (-not [string]::IsNullOrWhiteSpace($CopyTo)) {
    try {
        New-Item -ItemType Directory -Path $CopyTo -Force | Out-Null
        # File names sort by date, so the last name is the newest backup.
        $newest = Get-ChildItem -LiteralPath $backupDirectory -Filter "mayondon-db-*" -File |
            Where-Object { $_.Name -match '\.dump(\.enc)?$' } |
            Sort-Object Name | Select-Object -Last 1
        if (-not $newest) { throw "No backup file was found in $backupDirectory." }
        $target = Join-Path $CopyTo $newest.Name
        Copy-Item -LiteralPath $newest.FullName -Destination $target -Force
        if ((Get-Item -LiteralPath $target).Length -ne $newest.Length) {
            throw "The copy in $CopyTo has a different size than the original."
        }
        # Keep only the newest files that follow the backup name pattern.
        Get-ChildItem -LiteralPath $CopyTo -Filter "mayondon-db-*" -File |
            Where-Object { $_.Name -match '\.dump(\.enc)?$' } |
            Sort-Object Name -Descending | Select-Object -Skip $KeepCopies |
            Remove-Item -Force
        $copiedTo = $target
    } catch {
        Write-Status $false 3 "Backup made, but the copy to '$CopyTo' failed: $($_.Exception.Message)" ""
        Write-Warning "Backup made, but the copy to '$CopyTo' failed: $($_.Exception.Message)"
        exit 3
    }
}

Write-Status $true 0 $output $copiedTo
Write-Host $output
if ($copiedTo) { Write-Host "Copied to: $copiedTo" }
exit 0
