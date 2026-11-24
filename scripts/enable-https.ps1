# Switches the program to HTTPS (patch 220; decision 101). Run on the SERVER computer, from the
# project folder. A new installation does this by itself; this is for a computer installed before.
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\enable-https.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\enable-https.ps1 -HttpsHost 192.168.1.10
#   powershell -ExecutionPolicy Bypass -File .\scripts\enable-https.ps1 -Off      # back to plain HTTP
#
# What it changes: only these lines of .env (the old .env is saved first as
# .env.before-https-<time>): COMPOSE_PROFILES, HTTPS_HOST, APP_BIND, FORWARDED_ALLOW_IPS.
# No secret is read or printed. Then it restarts the program, opens ports 443 and 80 in the
# firewall (Windows asks for permission) and saves the office certificate for you to copy.
#
# AFTER THIS every office computer must trust the certificate ONCE (trust-office-https.ps1),
# otherwise its browser shows a warning. The address is the server computer's LAN address: ask the
# network administrator to reserve it, because the certificate is made for that address.
# People sign in again once, because the browser treats https:// as a different site.
#
# -EnvFile and -EnvOnly are for the tests: they change the file and do nothing else.

param(
    [string]$HttpsHost,
    [switch]$Off,
    [string]$EnvFile,
    [switch]$EnvOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) { $EnvFile = Join-Path $repoRoot ".env" }
if (-not (Test-Path -LiteralPath $EnvFile)) {
    Write-Host "No .env at $EnvFile. This is not an installed system." -ForegroundColor Red
    exit 1
}

# The address of the adapter that has a default gateway (not Docker's or WSL's virtual one).
function Get-OfficeIp {
    $ip = $null
    try {
        $ip = (Get-NetIPConfiguration -ErrorAction Stop |
            Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address -and $_.NetAdapter.Status -eq "Up" -and $_.InterfaceAlias -notmatch "vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V" } |
            Select-Object -First 1).IPv4Address.IPAddress
    } catch { }
    return $ip
}

function Set-EnvLineKeepingEnds([string]$text, [string]$name, [string]$value) {
    $nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
    $line = "$name=$value"
    $regex = New-Object System.Text.RegularExpressions.Regex("(?m)^[ \t]*#?[ \t]*$([regex]::Escape($name))=[^\r\n]*")
    if ($regex.IsMatch($text)) {
        $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $line }
        return $regex.Replace($text, $evaluator, 1)
    }
    return $text.TrimEnd() + $nl + $line + $nl
}

if ($Off) {
    $settings = [ordered]@{ COMPOSE_PROFILES = ""; APP_BIND = "0.0.0.0"; FORWARDED_ALLOW_IPS = "127.0.0.1" }
} else {
    if (-not $HttpsHost) { $HttpsHost = Get-OfficeIp }
    if (-not $HttpsHost) {
        Write-Host "The address of this computer could not be found. Run again with -HttpsHost <address>, for example -HttpsHost 192.168.1.10" -ForegroundColor Red
        exit 1
    }
    if ($HttpsHost -notmatch '^[A-Za-z0-9.-]+(,[A-Za-z0-9.-]+)*$') {
        Write-Host "-HttpsHost may hold only letters, digits, dots and hyphens (several addresses separated by commas)." -ForegroundColor Red
        exit 1
    }
    $settings = [ordered]@{ COMPOSE_PROFILES = "https"; HTTPS_HOST = $HttpsHost; APP_BIND = "127.0.0.1"; FORWARDED_ALLOW_IPS = "*" }
}

$original = [System.IO.File]::ReadAllText($EnvFile)
$text = $original
foreach ($name in $settings.Keys) { $text = Set-EnvLineKeepingEnds $text $name $settings[$name] }
if ($text -eq $original) {
    Write-Host "Nothing to change: .env already has these settings."
} else {
    $copy = "$EnvFile.before-https-" + (Get-Date -Format "yyyyMMdd-HHmmss")
    [System.IO.File]::WriteAllText($copy, $original, (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::WriteAllText($EnvFile, $text, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Saved the old .env as $(Split-Path -Leaf $copy) and changed the HTTPS lines."
}
if ($EnvOnly) { exit 0 }

Set-Location $repoRoot
# Docker Desktop on Windows can free the old port a few seconds late after the binding moves
# (the backend and caddy then stay "Created"). So on a failure: stop the backend, wait, try once more.
$retryWait = 15
if ($env:MAYONDON_RETRY_SECONDS) { $retryWait = [int]$env:MAYONDON_RETRY_SECONDS }  # tests only
& docker compose -f compose.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "The program did not start (Docker may free the port a few seconds late). Trying once more in $retryWait seconds..." -ForegroundColor Yellow
    & docker compose -f compose.yml stop backend
    Start-Sleep -Seconds $retryWait
    & docker compose -f compose.yml up -d
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "The program could not be restarted. Nothing was deleted." -ForegroundColor Red
    Write-Host "Way back: run  .\scripts\enable-https.ps1 -Off   or put the saved .env.before-https-* file back as .env, then run: docker compose -f compose.yml up -d" -ForegroundColor Red
    exit 1
}

if ($Off) {
    Write-Host "Back to plain HTTP on port 8000. Open the firewall for it if needed: scripts\open-firewall.ps1" -ForegroundColor Yellow
    exit 0
}

try {
    Start-Process -FilePath "powershell.exe" -Verb RunAs -Wait `
        -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'open-firewall.ps1')`" -Ports 443,80"
} catch {
    Write-Warning "The firewall was not changed. Run scripts\open-firewall.ps1 -Ports 443,80 as administrator."
}

Start-Sleep -Seconds 8
try { & (Join-Path $PSScriptRoot "export-https-root.ps1") } catch { Write-Warning $_.Exception.Message }

Write-Host ""
Write-Host "HTTPS is on. Office computers open:  https://$HttpsHost" -ForegroundColor Green
Write-Host "Next, on EACH office computer (once): copy mayondon-office-root.crt there and run" -ForegroundColor Yellow
Write-Host "  .\scripts\trust-office-https.ps1 -CertFile <path to the .crt file>" -ForegroundColor Yellow
Write-Host "Until a computer trusts the certificate its browser shows a warning. Everyone signs in again once."
