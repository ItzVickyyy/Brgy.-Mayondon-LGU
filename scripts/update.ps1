# Update the system to a newer version. Double-click Update-Mayondon.cmd.
#
# Two ways to get the new version:
#   (default)         the project folder is a Git clone: it runs "git pull" (needs internet)
#   -From <folder>    a newer copy of the project folder, for example from a USB drive
#                     (no internet needed for the copy; the first build after a
#                     change of libraries still needs it)
# Your .env, the backups folder and the database are never touched by the copy.
#
# Order: safety backup (the update stops if it fails) -> new code -> build ->
# restart -> wait until healthy -> check the database update line in the log.
# The program itself saves one more safety copy before it changes the database
# (mayondon-premigrate-*.dump in backups\).
# If something fails the script does NOT undo anything by itself (the database may
# already be newer than the old program): it prints the exact way back.

param(
    [string]$From
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Step([string]$text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }
function Stop-Here([string]$text) { Write-Host ""; Write-Host "STOPPED: $text" -ForegroundColor Red; exit 1 }

# Native programs write progress to stderr; with $ErrorActionPreference = "Stop"
# PowerShell 5.1 would treat that as an error as soon as the output is redirected.
function Invoke-Quiet([scriptblock]$block) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & $block } finally { $ErrorActionPreference = $old }
}

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot ".env"))) { Stop-Here "No .env here. This is not an installed system (run Install-Mayondon.cmd)." }
Invoke-Quiet { docker info *> $null }
if ($LASTEXITCODE -ne 0) { Stop-Here "Docker Desktop is not running. Open it, wait until it is running, then run the update again." }

$oldCommit = $null
if (Test-Path -LiteralPath (Join-Path $repoRoot ".git")) {
    $oldCommit = (Invoke-Quiet { git rev-parse HEAD 2>$null } | Out-String).Trim()
}

# ------------------------------------------------------------ 1. backup
Step "1/5  Safety backup"
& (Join-Path $PSScriptRoot "scheduled-backup.ps1")
if ($LASTEXITCODE -ne 0) { Stop-Here "The backup failed, so nothing was changed. Read backups\last-run.json." }

# --------------------------------------------------------- 2. new code
Step "2/5  Getting the new version"
if ($From) {
    $source = (Resolve-Path -LiteralPath $From).ProviderPath
    if (-not (Test-Path -LiteralPath (Join-Path $source "compose.yml"))) { Stop-Here "'$source' is not a project folder (no compose.yml)." }
    & robocopy $source $repoRoot /E /XD backups .git node_modules .venv /XF .env ".env.*" /NFL /NDL /NJH /NJS /NP | Out-Null
    # robocopy: 0 to 7 means success.
    if ($LASTEXITCODE -ge 8) { Stop-Here "Copying the new files failed (robocopy code $LASTEXITCODE). Nothing was built." }
    Write-Host "New files copied from $source."
} else {
    if (-not $oldCommit) { Stop-Here "This folder is not a Git clone. Use:  Update-Mayondon.cmd -From <folder with the new version>" }
    & git pull --ff-only
    if ($LASTEXITCODE -ne 0) { Stop-Here "git pull failed (no internet, or local changes in the folder). Nothing was built." }
}
$newCommit = if ($oldCommit) { (Invoke-Quiet { git rev-parse HEAD 2>$null } | Out-String).Trim() } else { $null }
if ($oldCommit -and $oldCommit -eq $newCommit -and -not $From) {
    Write-Host "Already up to date. Nothing to do." -ForegroundColor Green
    exit 0
}

# ---------------------------------------------- 3. keep the old image
Step "3/5  Building the new version (the program keeps running until the build is done)"
Invoke-Quiet { docker image inspect backend:latest *> $null }
if ($LASTEXITCODE -eq 0) { & docker tag backend:latest backend:previous }
& docker compose -f compose.yml build backend
if ($LASTEXITCODE -ne 0) { Stop-Here "The build failed. The running program was not changed." }

# ------------------------------------------------------------ 4. restart
Step "4/5  Restarting"
& docker compose -f compose.yml up -d
if ($LASTEXITCODE -ne 0) { Stop-Here "Restart failed. See the way back below." }

$healthy = $false
$deadline = (Get-Date).AddMinutes(6)
while ((Get-Date) -lt $deadline) {
    $id = (& docker compose -f compose.yml ps -q backend | Out-String).Trim()
    if ($id) {
        $state = (Invoke-Quiet { docker inspect --format "{{.State.Health.Status}}" $id 2>$null } | Out-String).Trim()
        if ($state -eq "healthy") { $healthy = $true; break }
    }
    Start-Sleep -Seconds 5
}

# ------------------------------------------------------------- 5. check
Step "5/5  Checking"
$log = (Invoke-Quiet { docker compose -f compose.yml logs backend --tail 60 2>&1 } | Out-String)
$migrateLine = ($log -split "`r?`n" | Where-Object { $_ -match "\[migrate\]" } | Select-Object -Last 1)
if ($migrateLine) { Write-Host $migrateLine }

if ($healthy -and $log -notmatch "\[migrate\] STOP") {
    Write-Host ""
    Write-Host "UPDATE DONE. The program is healthy." -ForegroundColor Green
    if ($oldCommit -and $newCommit) { Write-Host "Version: $($oldCommit.Substring(0,7)) -> $($newCommit.Substring(0,7))" }
    Write-Host "Check it: sign in, open Records and Issuances. The old image is kept as backend:previous."
    exit 0
}

Write-Host ""
Write-Host "THE UPDATE DID NOT COME UP HEALTHY." -ForegroundColor Red
Write-Host "Read the reason:  docker compose -f compose.yml logs backend --tail 40"
Write-Host "Nothing was undone automatically. Your data is safe: a backup was made at the start (backups\)."
Write-Host "The way back, only if the developers cannot fix it quickly:"
if ($oldCommit) { Write-Host "  1. git checkout $oldCommit" }
Write-Host "  2. docker compose -f compose.yml build backend"
Write-Host "  3. If the log says the database is NEWER than the program, restore the backup first:"
Write-Host "       .\scripts\restore-db.ps1 -BackupFile .\backups\<newest mayondon-db-... or mayondon-premigrate-... file> [-KeyFile <USB>\backup-private.pem]"
Write-Host "  4. docker compose -f compose.yml up -d"
exit 1
