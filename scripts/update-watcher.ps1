# Update watcher: the one program the Task Scheduler task "Mayondon Auto Update" runs (made by
# register-update-task.ps1). It starts when this Windows user signs in and keeps running, hidden,
# until sign-out. Every few seconds it does the first of these that applies:
#   1. An administrator pressed Update in the program (the program wrote
#      backups\update-request.json): run auto-update.ps1 -Now, at any hour.
#   2. It is night (from -NightFrom for -NightHours) and tonight's update has not been tried
#      yet: run auto-update.ps1, which installs the approved version of branch "Production".
#   3. The last look at GitHub is older than -CheckEveryMinutes: run auto-update.ps1
#      -CheckOnly -Record, which only writes backups\update-state.json so the program can
#      show "a new version is available" (and its Update button). Nothing is installed.
# It also writes backups\update-watcher.json every pass: the program shows the Update button
# only while that file is fresh, so a computer without the watcher never promises an update.
# Log: backups\update-watcher.log (short lines, no secrets).
#   .\scripts\update-watcher.ps1 -Once     one pass, then stop (tests, or to see what it does)
#
# It does nothing on a Git clone (the development computer).

param(
    [string]$Repo = "ItzVickyyy/Brgy.-Mayondon-LGU",
    [string]$Ref = "Production",
    [ValidatePattern("^([01][0-9]|2[0-3]):[0-5][0-9]$")]
    [string]$NightFrom = "02:00",
    [ValidateRange(1, 8)]
    [int]$NightHours = 3,
    [ValidateRange(10, 1440)]
    [int]$CheckEveryMinutes = 180,
    [ValidateRange(1, 600)]
    [int]$PollSeconds = 20,
    [switch]$Once,
    # Only for tests: passed on to auto-update.ps1.
    [string]$ApiBase = "https://api.github.com",
    [string]$ArchiveBase = "https://github.com"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (Test-Path -LiteralPath (Join-Path $repoRoot ".git")) {
    Write-Host "This folder is a Git clone (a development computer). The update watcher is only for installed copies."
    exit 0
}

$backups = Join-Path $repoRoot "backups"
New-Item -ItemType Directory -Path $backups -Force | Out-Null
$requestFile = Join-Path $backups "update-request.json"
$aliveFile = Join-Path $backups "update-watcher.json"
$logFile = Join-Path $backups "update-watcher.log"
$autoUpdate = Join-Path $PSScriptRoot "auto-update.ps1"
$powershell = (Get-Process -Id $PID).Path

# MAYONDON_CLOCK lets the tests pretend it is another time (nothing else sets it).
function Get-Clock {
    if ($env:MAYONDON_CLOCK) {
        try { return [datetime]::Parse($env:MAYONDON_CLOCK, [Globalization.CultureInfo]::InvariantCulture) } catch { }
    }
    return Get-Date
}

function Write-Log([string]$text) {
    try {
        if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 200KB) { Remove-Item -LiteralPath $logFile -Force }
        Add-Content -LiteralPath $logFile -Value ("{0} {1}" -f (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"), $text) -Encoding UTF8
    } catch { }
}

function Write-Alive {
    try {
        $tmp = "$aliveFile.tmp"
        ([ordered]@{ alive_at = (Get-Date).ToString("o"); night_from = $NightFrom; night_hours = $NightHours } |
            ConvertTo-Json) | Set-Content -LiteralPath $tmp -Encoding UTF8
        Move-Item -LiteralPath $tmp -Destination $aliveFile -Force
    } catch { }
}

# The night window that "now" belongs to, as its start date ("" when it is not night).
function Get-NightKey {
    $now = Get-Clock
    $from = [datetime]::ParseExact($NightFrom, "HH:mm", [Globalization.CultureInfo]::InvariantCulture).TimeOfDay
    $to = $from + [TimeSpan]::FromHours($NightHours)
    $time = $now.TimeOfDay
    if ($time -ge $from -and $time -lt $to) { return $now.Date.ToString("yyyy-MM-dd") }
    if ($to.TotalHours -gt 24 -and $time -lt ($to - [TimeSpan]::FromHours(24))) { return $now.Date.AddDays(-1).ToString("yyyy-MM-dd") }
    return ""
}

function Invoke-AutoUpdate([string[]]$extra) {
    $arguments = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $autoUpdate,
        "-Repo", $Repo, "-Ref", $Ref, "-NightFrom", $NightFrom, "-NightHours", [string]$NightHours,
        "-ApiBase", $ApiBase, "-ArchiveBase", $ArchiveBase
    ) + $extra
    & $powershell @arguments *> $null
    return $LASTEXITCODE
}

$script:lastNight = ""
$script:lastCheck = [datetime]::MinValue

Write-Log "watcher started (night from $NightFrom for $NightHours h, check every $CheckEveryMinutes min)"
while ($true) {
    try {
        Write-Alive
        $night = Get-NightKey
        if (Test-Path -LiteralPath $requestFile) {
            Write-Log "an administrator asked for the update: running it now"
            $code = Invoke-AutoUpdate @("-Now")
            Write-Log "update finished with exit code $code (see backups\last-autoupdate.json)"
            $script:lastCheck = Get-Date
            # A request that the run did not use up (for example GitHub was unreachable) is
            # dropped so it cannot loop; the notification then shows the version as available.
            if (Test-Path -LiteralPath $requestFile) { Remove-Item -LiteralPath $requestFile -Force -ErrorAction SilentlyContinue }
        } elseif ($night -and $night -ne $script:lastNight) {
            $script:lastNight = $night
            Write-Log "night window ${night}: looking for an update"
            $code = Invoke-AutoUpdate @()
            Write-Log "night run finished with exit code $code"
            $script:lastCheck = Get-Date
        } elseif (((Get-Date) - $script:lastCheck).TotalMinutes -ge $CheckEveryMinutes) {
            $code = Invoke-AutoUpdate @("-CheckOnly", "-Record")
            Write-Log "check finished with exit code $code"
            $script:lastCheck = Get-Date
        }
    } catch {
        Write-Log "error: $($_.Exception.Message)"
    }
    if ($Once) { break }
    Start-Sleep -Seconds $PollSeconds
}
