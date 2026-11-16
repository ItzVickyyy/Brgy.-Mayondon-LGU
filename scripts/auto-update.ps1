# Automatic update, started once a day by the Task Scheduler task made by
# register-update-task.ps1. It can also be run by hand:
#   .\scripts\auto-update.ps1 -CheckOnly      shows what it would do and changes nothing
#   .\scripts\auto-update.ps1                 does it now
#
# What it does:
#   1. Asks GitHub which commit the APPROVED branch points to (default: "production",
#      the release branch of docs/07 section 4). Only that branch is ever installed,
#      never "master", so work in progress cannot reach the barangay computer.
#   2. If that commit is already installed, or already failed here once, it stops.
#   3. Otherwise it downloads exactly that commit as a ZIP into a temporary folder and
#      runs update.ps1 -From <that folder>. update.ps1 makes an encrypted backup first
#      and stops without changing anything if the backup fails; .env, backups\ and the
#      database are never touched by the copy.
#   4. If the new version does not come up healthy it puts the previous program image
#      back, but ONLY when the database was not changed. If the database was changed it
#      leaves everything as it is and says so: the developers must look at it.
#   5. It writes backups\last-autoupdate.json (no secrets), the log
#      backups\auto-update.log, and the installed commit in .installed-commit.
#
# It does nothing on a Git clone (the development computer), when .env is missing,
# when Docker or the program is not running, or when GitHub cannot be reached.
# Exit code: 0 = updated, nothing to do or skipped, 1 = failed or rolled back.

param(
    [string]$Repo = "ItzVickyyy/Brgy.-Mayondon-LGU",
    [string]$Ref = "production",
    [switch]$CheckOnly,
    # Only for tests: where the GitHub API and the archive downloads come from.
    [string]$ApiBase = "https://api.github.com",
    [string]$ArchiveBase = "https://github.com"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$backups = Join-Path $repoRoot "backups"
New-Item -ItemType Directory -Path $backups -Force | Out-Null
$statusFile = Join-Path $backups "last-autoupdate.json"
$logFile = Join-Path $backups "auto-update.log"
$markerFile = Join-Path $repoRoot ".installed-commit"
$script:work = $null
$script:knownFailed = ""

if (-not $CheckOnly) { try { Start-Transcript -Path $logFile -Force | Out-Null } catch { } }

# A version that already failed here is remembered until a newer one appears.
if (Test-Path -LiteralPath $statusFile) {
    try {
        $old = Get-Content -LiteralPath $statusFile -Raw | ConvertFrom-Json
        if ($old.failed_sha) { $script:knownFailed = [string]$old.failed_sha }
    } catch { }
}

function Invoke-Quiet([scriptblock]$block) {
    $keep = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & $block } finally { $ErrorActionPreference = $keep }
}

function Finish([string]$result, [bool]$ok, [string]$message, [string]$target = "", [int]$code = 0) {
    Write-Host ""
    Write-Host "AUTO UPDATE: $result. $message"
    if (-not $CheckOnly) {
        $failed = $script:knownFailed
        if ($result -eq "updated") { $failed = "" }
        elseif ($result -eq "failed" -or $result -eq "rolled_back") { $failed = $target }
        try {
            ([ordered]@{
                finished_at = (Get-Date).ToString("o"); ok = $ok; result = $result
                message = $message; target = $target; failed_sha = $failed
            } | ConvertTo-Json) | Set-Content -LiteralPath $statusFile -Encoding UTF8
        } catch { }
    }
    if ($script:work -and (Test-Path -LiteralPath $script:work)) {
        try { Remove-Item -LiteralPath $script:work -Recurse -Force -ErrorAction SilentlyContinue } catch { }
    }
    if (-not $CheckOnly) { try { Stop-Transcript | Out-Null } catch { } }
    exit $code
}

function Test-BackendHealthy {
    $id = (Invoke-Quiet { docker compose -f compose.yml ps -q backend 2>$null } | Out-String).Trim()
    if (-not $id) { return $false }
    $state = (Invoke-Quiet { docker inspect --format "{{.State.Health.Status}}" $id 2>$null } | Out-String).Trim()
    return ($state -eq "healthy")
}
function Wait-BackendHealthy([int]$minutes) {
    $deadline = (Get-Date).AddMinutes($minutes)
    while ((Get-Date) -lt $deadline) {
        if (Test-BackendHealthy) { return $true }
        Start-Sleep -Seconds 5
    }
    return $false
}
function Get-DbRevision {
    $text = (Invoke-Quiet { docker compose -f compose.yml exec -T db psql -U postgres -d app -tAc "select version_num from alembic_version" 2>$null } | Out-String).Trim()
    $last = ($text -split "`r?`n" | Where-Object { $_ } | Select-Object -Last 1)
    if ($last -and $last.Trim() -match "^[A-Za-z0-9_]+$") { return $last.Trim() }
    return ""
}
function Get-ErrorCode($err) {
    try { if ($err.Exception.Response) { return [int]$err.Exception.Response.StatusCode } } catch { }
    return 0
}

try {
    # ------------------------------------------------------------ safe to run here?
    if (Test-Path -LiteralPath (Join-Path $repoRoot ".git")) {
        Finish "skipped" $true "This folder is a Git clone (a development computer); automatic update is only for installed copies."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot ".env"))) {
        Finish "skipped" $true "No .env here: this is not an installed system."
    }
    Invoke-Quiet { docker info *> $null }
    if ($LASTEXITCODE -ne 0) { Finish "skipped" $true "Docker Desktop is not running, so nothing was changed." }
    # After a missed run the task starts right at sign-in, while Docker is still starting.
    if (-not (Wait-BackendHealthy 8)) { Finish "skipped" $true "The program is not healthy, so nothing was changed." }

    # ------------------------------------------------ which commit is approved?
    $headers = @{ "User-Agent" = "Mayondon-AutoUpdate"; "Accept" = "application/vnd.github+json" }
    $target = ""
    try {
        $info = Invoke-RestMethod -Uri "$ApiBase/repos/$Repo/commits/$Ref" -Headers $headers -TimeoutSec 30
        $target = [string]$info.sha
    } catch {
        $http = Get-ErrorCode $_
        if ($http -eq 404 -or $http -eq 422) {
            Finish "no_release" $true "No approved version is published yet (the branch '$Ref' does not exist), so nothing was changed."
        }
        Finish "skipped" $true "GitHub could not be reached ($($_.Exception.Message)); will try again tomorrow."
    }
    if ($target -notmatch "^[0-9a-f]{40}$") { Finish "skipped" $true "GitHub gave an answer that was not understood; nothing was changed." }
    $short = $target.Substring(0, 7)

    $installed = ""
    if (Test-Path -LiteralPath $markerFile) {
        $text = (Get-Content -LiteralPath $markerFile -Raw).Trim()
        if ($text -match "^[0-9a-f]{40}$") { $installed = $text }
    }
    if ($installed -eq $target) { Finish "up_to_date" $true "Version $short is installed. Nothing to do." $target }
    if ($script:knownFailed -eq $target) {
        Finish "skipped" $false "Version $short failed on this computer before and was not tried again. Waiting for a newer approved version, or ask the developers." $target
    }

    # Never go backwards or sideways (for example after a force-push of the branch).
    if ($installed) {
        try {
            $cmp = Invoke-RestMethod -Uri "$ApiBase/repos/$Repo/compare/$installed...$target" -Headers $headers -TimeoutSec 30
            if ([string]$cmp.status -ne "ahead") {
                Finish "failed" $false "The approved version $short is not a newer version of the installed one ($($cmp.status)), so it was not installed. Ask the developers." $target 1
            }
        } catch {
            Finish "failed" $false "GitHub could not compare the installed version with $short ($($_.Exception.Message)), so nothing was changed. Ask the developers." $target 1
        }
    }

    $from = if ($installed) { $installed.Substring(0, 7) } else { "unknown" }
    if ($CheckOnly) {
        Finish "would_update" $true "Would update from $from to $short (nothing was changed)." $target
    }

    # --------------------------------------------------------------- download
    Write-Host "Downloading version $short ..."
    $script:work = Join-Path ([IO.Path]::GetTempPath()) "mu-$short"
    if (Test-Path -LiteralPath $script:work) { Remove-Item -LiteralPath $script:work -Recurse -Force }
    New-Item -ItemType Directory -Path $script:work | Out-Null
    $zip = Join-Path $script:work "s.zip"
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$ArchiveBase/$Repo/archive/$target.zip" -OutFile $zip -Headers @{ "User-Agent" = "Mayondon-AutoUpdate" } -TimeoutSec 900
        Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $script:work "src") -Force
    } catch {
        Finish "skipped" $true "The download of $short failed ($($_.Exception.Message)); nothing was changed, will try again tomorrow."
    }
    $inner = Get-ChildItem -LiteralPath (Join-Path $script:work "src") -Directory | Select-Object -First 1
    if (-not $inner -or -not (Test-Path -LiteralPath (Join-Path $inner.FullName "compose.yml")) -or
        -not (Test-Path -LiteralPath (Join-Path $inner.FullName "scripts\update.ps1"))) {
        Finish "failed" $false "The downloaded files for $short do not look like the program, so nothing was changed. Ask the developers." $target 1
    }

    # ---------------------------------------------------------------- update
    $preImage = (Invoke-Quiet { docker image inspect backend:latest --format "{{.Id}}" 2>$null } | Out-String).Trim()
    $preRevision = Get-DbRevision
    Write-Host "Running update.ps1 for version $short (installed: $from) ..."
    $code = 1
    try {
        & (Join-Path $PSScriptRoot "update.ps1") -From $inner.FullName
        $code = $LASTEXITCODE
    } catch {
        Write-Host "update.ps1 stopped with an error: $($_.Exception.Message)"
        $code = 1
    }

    if ($code -eq 0) {
        Set-Content -LiteralPath $markerFile -Value $target -Encoding ASCII
        Finish "updated" $true "Updated from $from to $short. The program is healthy." $target
    }

    # --------------------------------------------------------------- failure
    $postImage = (Invoke-Quiet { docker image inspect backend:latest --format "{{.Id}}" 2>$null } | Out-String).Trim()
    $healthyNow = Wait-BackendHealthy 1
    if ($postImage -eq $preImage -and $healthyNow) {
        Finish "failed" $false "The update to $short stopped before the program was changed (see backups\auto-update.log). The program is running as before." $target 1
    }
    if ($healthyNow) {
        Finish "failed" $false "The update to $short reported a problem, but the program is running. The developers should check backups\auto-update.log." $target 1
    }
    $postRevision = Get-DbRevision
    if ($preImage -and $preRevision -and $postRevision -eq $preRevision) {
        Write-Host "The new version did not start and the database is unchanged ($postRevision). Putting the previous program back ..."
        Invoke-Quiet { docker tag $preImage backend:latest }
        Invoke-Quiet { docker compose -f compose.yml up -d --no-build --force-recreate backend 2>&1 | Out-Null }
        if (Wait-BackendHealthy 4) {
            Finish "rolled_back" $false "Version $short did not start. The previous version was put back and the data was not changed. The developers need to look at backups\auto-update.log." $target 1
        }
    }
    Finish "failed" $false "Version $short did not start and could not be undone automatically. Your data is safe: an encrypted backup was made first (backups\). Tell the developers at once; see backups\auto-update.log." $target 1
} catch {
    Finish "failed" $false "Unexpected error: $($_.Exception.Message)" "" 1
}
