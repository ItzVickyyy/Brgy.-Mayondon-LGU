# Plain-language health check. Double-click Check-Mayondon.cmd.
# Prints OK / WARNING / PROBLEM lines; changes nothing and never prints a secret.

$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
$problems = 0; $warnings = 0

function Ok([string]$t) { Write-Host "  OK       $t" -ForegroundColor Green }
function Warn([string]$t) { $script:warnings++; Write-Host "  WARNING  $t" -ForegroundColor Yellow }
function Bad([string]$t) { $script:problems++; Write-Host "  PROBLEM  $t" -ForegroundColor Red }

Write-Host "Barangay Mayondon system check  ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
Write-Host ""

# Docker and containers
$dockerOk = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker info *> $null
    $dockerOk = ($LASTEXITCODE -eq 0)
}
if (-not $dockerOk) {
    Bad "Docker Desktop is not running. Double-click Start-Mayondon.cmd, or open Docker Desktop and wait until it says it is running."
} else {
    Ok "Docker Desktop is running."
    # Without .env, Docker Compose prints a wall of "variable not set" errors: say it once, in plain words.
    $notInstalled = -not (Test-Path .env)
    if ($notInstalled) { Bad "The program is not installed yet (.env is missing). Double-click Install-Mayondon.cmd." }
    $backendId = if ($notInstalled) { "" } else { (docker compose -f compose.yml ps -q backend 2>$null | Out-String).Trim() }
    if ($notInstalled) {
        # nothing more to ask Docker Compose here
    } elseif (-not $backendId) {
        Bad "The program is not started. Double-click Start-Mayondon.cmd (or sign out of Windows and sign in again), then run this check again."
    } else {
        $health = (docker inspect --format "{{.State.Health.Status}}" $backendId 2>$null | Out-String).Trim()
        if ($health -eq "healthy") { Ok "The program is healthy." } else { Bad "The program is '$health' (not healthy). Run: docker compose -f compose.yml logs backend --tail 30" }
    }
    if (-not $notInstalled) {
        $dbId = (docker compose -f compose.yml ps -q db 2>$null | Out-String).Trim()
        if (-not $dbId) { Bad "The database container is not running." }
        $services = (docker compose -f compose.yml ps --services 2>$null | Out-String) -split "`r?`n" | Where-Object { $_ }
        $extra = $services | Where-Object { $_ -notin @("db", "backend", "caddy") }
        if ($extra) { Warn "Development services are running here: $($extra -join ', '). The real system should show only db, backend (and caddy with HTTPS)." }

        $log = (docker compose -f compose.yml logs backend --tail 500 2>&1 | Out-String)
        $line = ($log -split "`r?`n" | Where-Object { $_ -match "\[migrate\]" } | Select-Object -Last 1)
        if ($line -match "STOP") { Bad $line.Trim() } elseif ($line) { Ok $line.Trim() }
    }
}

# Web answer
try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 8 "http://localhost:8000/api/v1/utils/health-check/"
    if ($r.StatusCode -eq 200) { Ok "http://localhost:8000 answers." }
} catch {
    $envText = if (Test-Path .env) { Get-Content .env -Raw } else { "" }
    if ($envText -match "(?m)^APP_BIND=127\.0\.0\.1") { Warn "Port 8000 did not answer (expected only if it is bound to this computer; try the https address)." }
    else { Bad "http://localhost:8000 does not answer." }
}

# Settings
if (-not (Test-Path .env)) { if ($dockerOk) { } else { Bad ".env is missing." } } else {
    $envText = Get-Content .env -Raw
    if ($envText -match "(?m)^COMPOSE_FILE=compose\.yml\s*$") { Ok "Development files are switched off (COMPOSE_FILE)." } else { Bad "COMPOSE_FILE=compose.yml is missing from .env: a plain 'docker compose up' would start Adminer and development mode." }
    if ($envText -match "(?m)^(SECRET_KEY|POSTGRES_PASSWORD|FIRST_SUPERUSER_PASSWORD)=replace-with") { Bad "A sample secret is still in .env." }
    if ($envText -match "(?m)^\s*(FASTAPI_ENV|ENABLE_DEV_ROUTES)=\S") { Bad "Development mode is switched on in .env." }
    if ($envText -match "(?m)^BACKUP_REQUIRE_ENCRYPTION=true\s*$") { Ok "Backups must be encrypted." } else { Warn "BACKUP_REQUIRE_ENCRYPTION is not true." }
}

# Backups
$backups = Join-Path $repoRoot "backups"
if (Test-Path (Join-Path $backups "backup-private.pem")) { Warn "backup-private.pem is on this computer. Copy ONLY that file to the USB drive and delete it here. Leave backup-public.pem in the backups folder: the program needs it to make backups." }
if (-not (Test-Path (Join-Path $backups "backup-public.pem"))) {
    $encRequired = (Test-Path .env) -and ((Get-Content .env -Raw) -match "(?m)^BACKUP_REQUIRE_ENCRYPTION=true\s*$")
    if ($encRequired) { Bad "backup-public.pem is missing from the backups folder, so every backup is being REFUSED. Put it back (copy it from the USB drive) or make a new key (docs/11 section G)." }
    else { Warn "No backup key yet (backups would be unencrypted)." }
}
$newest = Get-ChildItem -LiteralPath $backups -Filter "mayondon-db-*" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '\.dump(\.enc)?$' } | Sort-Object LastWriteTime | Select-Object -Last 1
if (-not $newest) { Bad "There is no backup file yet." } else {
    $age = (Get-Date) - $newest.LastWriteTime
    if ($age.TotalHours -le 36) { Ok "Newest backup: $($newest.Name) ($([int]$age.TotalHours) hours old)." } else { Bad "Newest backup is $([int]$age.TotalDays) days old." }
}
$lastRun = Join-Path $backups "last-run.json"
if (Test-Path $lastRun) {
    $j = Get-Content $lastRun -Raw | ConvertFrom-Json
    if ($j.ok) { Ok "Last scheduled backup worked ($($j.finished_at))." } else { Bad "Last scheduled backup FAILED: $($j.message)" }
}
foreach ($name in @("Mayondon Database Backup", "Mayondon Start at Sign-in")) {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) { Ok "Scheduled task '$name' exists." } else { Warn "Scheduled task '$name' is missing." }
}

# Network profile: the firewall rule opens port 8000 on Private networks only
try {
    $publicNet = @(Get-NetConnectionProfile -ErrorAction Stop | Where-Object {
        $_.NetworkCategory -eq "Public" -and $_.IPv4Connectivity -notin @("Disconnected", "NoTraffic") -and
        $_.InterfaceAlias -notmatch "vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V|Loopback" })
    if ($publicNet.Count -gt 0) {
        Warn "Windows treats the network '$($publicNet[0].Name)' as Public, so other office computers cannot open the program. Set it to Private: Settings > Network > the network > Network profile type > Private."
    }
} catch { }

# Disk
try {
    $drive = Get-PSDrive -Name ($repoRoot.Substring(0, 1)) -ErrorAction Stop
    $freeGb = [math]::Round($drive.Free / 1GB, 1)
    if ($freeGb -lt 5) { Bad "Only $freeGb GB free on the disk." } elseif ($freeGb -lt 20) { Warn "$freeGb GB free on the disk." } else { Ok "$freeGb GB free on the disk." }
} catch { }

Write-Host ""
if ($problems -gt 0) { Write-Host "RESULT: $problems problem(s), $warnings warning(s). Tell the developers what is written above." -ForegroundColor Red }
elseif ($warnings -gt 0) { Write-Host "RESULT: working, with $warnings warning(s)." -ForegroundColor Yellow }
else { Write-Host "RESULT: everything is fine." -ForegroundColor Green }
