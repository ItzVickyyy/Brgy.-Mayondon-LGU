# Bring the program up after Windows sign-in: start Docker Desktop if it is not
# running, wait for it, then "docker compose up -d". Run by the Task Scheduler task
# made by register-start-task.ps1; it can also be run by hand.
# Result is written to backups\last-start.json (no secrets).
# With -OpenBrowser (the sign-in task uses it) it also opens the program in the
# default browser as soon as the program answers: http://localhost:8000, or
# https://<HTTPS_HOST> when HTTPS by name is switched on in .env.
# Exit code: 0 = started, 1 = Docker did not become ready, 2 = compose failed.

param(
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
$backupDirectory = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$statusFile = Join-Path $backupDirectory "last-start.json"

function Write-Status([bool]$ok, [string]$message) {
    ([ordered]@{ finished_at = (Get-Date).ToString("o"); ok = $ok; message = $message } |
        ConvertTo-Json) | Set-Content -LiteralPath $statusFile -Encoding UTF8
}
function Invoke-Quiet([scriptblock]$block) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & $block } finally { $ErrorActionPreference = $old }
}
function Test-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
    Invoke-Quiet { docker info *> $null }
    return ($LASTEXITCODE -eq 0)
}

if (-not (Test-Docker)) {
    $desktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (Test-Path -LiteralPath $desktop) { Start-Process -FilePath $desktop }
    $deadline = (Get-Date).AddMinutes(6)
    while (-not (Test-Docker) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 5 }
}
if (-not (Test-Docker)) {
    Write-Status $false "Docker Desktop did not become ready within 6 minutes."
    exit 1
}

Invoke-Quiet { docker compose -f compose.yml up -d 2>&1 | Out-Null }
if ($LASTEXITCODE -ne 0) {
    Write-Status $false "docker compose up -d failed."
    exit 2
}
Write-Status $true "Started."

if ($OpenBrowser) {
    $url = "http://localhost:8000"
    $envFile = Join-Path (Get-Location) ".env"
    if (Test-Path -LiteralPath $envFile) {
        $envText = Get-Content -LiteralPath $envFile -Raw
        if (($envText -match "(?m)^COMPOSE_PROFILES=.*\bhttps\b") -and ($envText -match "(?m)^HTTPS_HOST=(\S+)\s*$")) {
            $url = "https://" + $Matches[1]
        }
    }
    $ready = $false
    $deadline = (Get-Date).AddMinutes(5)
    while (-not $ready -and (Get-Date) -lt $deadline) {
        try {
            $answer = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://localhost:8000/api/v1/utils/health-check/"
            if ($answer.StatusCode -eq 200) { $ready = $true }
        } catch { }
        if (-not $ready) { Start-Sleep -Seconds 5 }
    }
    if ($ready) {
        if ($url.StartsWith("https://")) { Start-Sleep -Seconds 3 }
        try {
            Start-Process $url
            Write-Status $true "Started and opened $url."
        } catch {
            Write-Status $true "Started. The browser could not be opened: $($_.Exception.Message)"
        }
    } else {
        Write-Status $true "Started, but the program did not answer within 5 minutes, so the browser was not opened."
    }
}
exit 0
