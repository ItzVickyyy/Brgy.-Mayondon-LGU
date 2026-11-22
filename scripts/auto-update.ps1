# Automatic update. update-watcher.ps1 (the Task Scheduler task made by
# register-update-task.ps1) runs it; it can also be run by hand:
#   .\scripts\auto-update.ps1 -CheckOnly      shows what it would do and changes nothing
#   .\scripts\auto-update.ps1 -CheckOnly -Record   the same, and writes backups\update-state.json
#                                              (what the program's notification reads)
#   .\scripts\auto-update.ps1                 installs, but ONLY at night (see below)
#   .\scripts\auto-update.ps1 -Now            installs now, at any hour (what the Update
#                                              button in the program asks for)
#
# Night rule: without -Now it installs only from -NightFrom (default 02:00) for -NightHours
# (default 3). At any other time it only records that a version is waiting, so nobody is
# interrupted at work; an administrator can still press Update in the program.
#
# What it does:
#   1. Asks GitHub which commit the APPROVED branch points to (default: "Production",
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
#   5. It writes backups\last-autoupdate.json (no secrets), backups\update-state.json (what
#      the program's notification shows: up_to_date, available, updating or failed), the log
#      backups\auto-update.log, and the installed commit in .installed-commit. Without that
#      file (a first install, or a manual update) the commit in frontend\build-info.json is
#      taken as the installed version.
#
# It does nothing on a Git clone (the development computer), when .env is missing,
# when Docker or the program is not running, or when GitHub cannot be reached.
# Exit code: 0 = updated, nothing to do or skipped, 1 = failed or rolled back.

param(
    [string]$Repo = "ItzVickyyy/Brgy.-Mayondon-LGU",
    [string]$Ref = "Production",
    [switch]$CheckOnly,
    # With -CheckOnly: also write backups\update-state.json (nothing else is changed).
    [switch]$Record,
    # Install even outside the night window (manual run, or the Update button).
    [switch]$Now,
    # The night window: it starts at this time (24-hour HH:mm) and lasts this many hours.
    [ValidatePattern("^([01][0-9]|2[0-3]):[0-5][0-9]$")]
    [string]$NightFrom = "02:00",
    [ValidateRange(1, 8)]
    [int]$NightHours = 3,
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
$stateFile = Join-Path $backups "update-state.json"
$requestFile = Join-Path $backups "update-request.json"
$script:work = $null
$script:knownFailed = ""
$script:stateInstalled = ""
$script:stateTarget = ""

# The log is appended to (a run that only waits for the night must not wipe the last install's
# log); it starts again when it grows past 1 MB.
if (-not $CheckOnly) {
    try {
        if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 1MB) { Remove-Item -LiteralPath $logFile -Force }
        Start-Transcript -Path $logFile -Append | Out-Null
    } catch { }
}

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

# The clock; MAYONDON_CLOCK lets the tests pretend it is another time (nothing else sets it).
function Get-Clock {
    if ($env:MAYONDON_CLOCK) {
        try { return [datetime]::Parse($env:MAYONDON_CLOCK, [Globalization.CultureInfo]::InvariantCulture) } catch { }
    }
    return Get-Date
}
function Test-NightWindow {
    $from = [datetime]::ParseExact($NightFrom, "HH:mm", [Globalization.CultureInfo]::InvariantCulture).TimeOfDay
    $now = (Get-Clock).TimeOfDay
    $to = $from + [TimeSpan]::FromHours($NightHours)
    if ($to.TotalHours -le 24) { return ($now -ge $from -and $now -lt $to) }
    return ($now -ge $from -or $now -lt ($to - [TimeSpan]::FromHours(24)))
}

# What the program shows in its notification (no secrets): up_to_date, available, updating, failed.
function Write-State([string]$state, [string]$message) {
    try {
        $tmp = "$stateFile.tmp"
        ([ordered]@{
            checked_at = (Get-Date).ToString("o"); state = $state
            installed = $script:stateInstalled; target = $script:stateTarget; message = $message
        } | ConvertTo-Json) | Set-Content -LiteralPath $tmp -Encoding UTF8
        Move-Item -LiteralPath $tmp -Destination $stateFile -Force
    } catch { }
}

function Finish([string]$result, [bool]$ok, [string]$message, [string]$target = "", [int]$code = 0) {
    Write-Host ""
    Write-Host "AUTO UPDATE: $result. $message"
    if (-not $CheckOnly -or $Record) {
        $state = switch ($result) {
            "up_to_date" { "up_to_date" }
            "updated" { "up_to_date" }
            "would_update" { "available" }
            "waiting_for_night" { "available" }
            "failed" { "failed" }
            "rolled_back" { "failed" }
            # A version that failed here before is "skipped" with ok = false; other skips change nothing.
            "skipped" { if (-not $ok) { "failed" } else { "" } }
            default { "" }
        }
        if ($state) {
            if ($target) { $script:stateTarget = $target.Substring(0, 7) }
            Write-State $state $message
        }
    }
    # An administrator's request from the program is used up once this run has looked at it.
    if ($Now -and -not $CheckOnly -and (Test-Path -LiteralPath $requestFile)) {
        try { Remove-Item -LiteralPath $requestFile -Force } catch { }
    }
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
# MAYONDON_WAIT_FACTOR shortens the waits; only the tests set it (test-auto-update.sh).
$waitFactor = 1.0
if ($env:MAYONDON_WAIT_FACTOR -match "^[0-9.]+$") { $waitFactor = [double]$env:MAYONDON_WAIT_FACTOR }
function Wait-BackendHealthy([int]$minutes) {
    $deadline = (Get-Date).AddMinutes($minutes * $waitFactor)
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
    # A computer that was installed or updated by hand has no .installed-commit. The release
    # archive carries its own commit in frontend\build-info.json (Git fills it in when the archive
    # is made, see .gitattributes), so use that instead of treating the version as unknown. A
    # version that already failed here is not taken from it: its files may be in place while the
    # old program is the one running.
    if (-not $installed) {
        $infoFile = Join-Path $repoRoot "frontend\build-info.json"
        if (Test-Path -LiteralPath $infoFile) {
            try {
                $full = [string]((Get-Content -LiteralPath $infoFile -Raw | ConvertFrom-Json).full)
                if ($full -match "^[0-9a-f]{40}$" -and $full -ne $script:knownFailed) { $installed = $full }
            } catch { }
        }
    }
    $script:stateInstalled = if ($installed) { $installed.Substring(0, 7) } else { "" }
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
            $http = Get-ErrorCode $_
            if ($http -eq 404 -or $http -eq 422) {
                # GitHub does not know the installed commit (or the two are unrelated): a developer must look.
                Finish "failed" $false "GitHub could not compare the installed version with $short ($($_.Exception.Message)), so nothing was changed. Ask the developers." $target 1
            }
            # A network hiccup must not mark the version as failed for good: try again tomorrow.
            Finish "skipped" $true "GitHub could not be reached to compare versions ($($_.Exception.Message)); nothing was changed, will try again tomorrow."
        }
    }

    $from = if ($installed) { $installed.Substring(0, 7) } else { "unknown" }
    if ($CheckOnly) {
        Finish "would_update" $true "Would update from $from to $short (nothing was changed)." $target
    }
    if (-not $Now -and -not (Test-NightWindow)) {
        Finish "waiting_for_night" $true "Version $short is ready (installed: $from). It is installed at night, from $NightFrom, or when an administrator presses Update in the program." $target
    }

    # --------------------------------------------------------------- download
    Write-State "updating" "Updating from $from to $short."
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
