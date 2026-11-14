# Bring the program up after Windows sign-in: start Docker Desktop if it is not
# running, wait for it, then "docker compose up -d". Run by the Task Scheduler task
# made by register-start-task.ps1; it can also be run by hand.
# Result is written to backups\last-start.json (no secrets).
# Exit code: 0 = started, 1 = Docker did not become ready, 2 = compose failed.

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
exit 0
