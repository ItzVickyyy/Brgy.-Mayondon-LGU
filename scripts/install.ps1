# One-time installer for the server computer. Double-click Install-Mayondon.cmd
# in the project folder (it runs this script); nobody needs to type commands.
#
# What it does, in order (it is safe to run again: it never replaces an existing
# .env, never touches an existing database and never replaces a backup key):
#   1. checks that Docker Desktop is running (and starts it if it can)
#   2. makes .env with NEW random secrets (SECRET_KEY, database password, the
#      two-factor key) and the administrator account you choose
#   3. builds the program, starts it and waits until it is healthy
#   4. creates the administrator account
#   5. makes the backup key pair (you type the passphrase) and turns encryption on
#   6. registers the daily backup task, the start-at-sign-in task (it also opens the
#      program in the browser) and the automatic update task (night only)
#   7. opens the firewall for the office network (asks Windows for permission)
#   8. puts a "Barangay Mayondon" shortcut on the desktop
#
# HTTPS is ON by default (patch 220): the program is reached at https://<this computer's LAN address>.
# Optional: -HttpsHost 192.168.1.10          use this address or name instead of the detected one
#           -NoHttps                        plain HTTP on port 8000 (not recommended: passwords cross the network in clear text)
#           -AdminEmail you@example.com     skips the question
#           -BackupTime 17:00               time of the daily backup
#           -BackupCopyTo "E:\MayondonBackups"   second location for backups
#           -NoBrowser                      do not open the program at sign-in
#           -NoAutoUpdate                   do not register the automatic update
#           -AllNetworks                    firewall rule for every network profile (local subnet only),
#                                           for an office Wi-Fi that Windows calls 'Public'
#           -UpdateTime 02:00               start of the night window of the automatic update
# This script never prints or stores a secret except the one-time message that
# shows a generated administrator password on screen.

param(
    [string]$AdminEmail,
    [string]$HttpsHost,
    [switch]$NoHttps,
    [string]$BackupTime = "17:00",
    [string]$BackupCopyTo,
    [switch]$NoBrowser,
    [switch]$NoAutoUpdate,
    [switch]$AllNetworks,
    [string]$UpdateTime = "02:00"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Step([string]$text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }
function Stop-Here([string]$text) { Write-Host ""; Write-Host "STOPPED: $text" -ForegroundColor Red; exit 1 }

# The office address is the one of the adapter that has a default gateway (the Wi-Fi or cable to the router).
# Taking "the first address" picked Docker's or WSL's own virtual adapter (172.x.x.x) on the first real run.
function Get-OfficeIp {
    $found = $null
    try {
        $found = (Get-NetIPConfiguration -ErrorAction Stop |
            Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address -and $_.NetAdapter.Status -eq "Up" -and $_.InterfaceAlias -notmatch "vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V" } |
            Select-Object -First 1).IPv4Address.IPAddress
    } catch { }
    if (-not $found) {
        try {
            $found = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
                Where-Object { $_.IPAddress -notmatch "^(127|169\.254)\." -and $_.PrefixOrigin -ne "WellKnown" -and $_.InterfaceAlias -notmatch "vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V" } |
                Select-Object -First 1).IPAddress
        } catch { }
    }
    return $found
}

# An existing .env decides: running the installer again never switches an installed computer between
# HTTP and HTTPS (scripts\enable-https.ps1 does that on purpose).
$existingEnv = Join-Path $repoRoot ".env"
$envExists = Test-Path -LiteralPath $existingEnv
if ($envExists) {
    $existingText = [System.IO.File]::ReadAllText($existingEnv)
    $HttpsHost = ""
    if (($existingText -match "(?m)^COMPOSE_PROFILES=.*\bhttps\b") -and ($existingText -match "(?m)^HTTPS_HOST=(\S+)\s*$")) { $HttpsHost = $Matches[1] }
}
# HTTPS by default: use the detected office address unless a host was given or -NoHttps.
if (-not $envExists -and -not $NoHttps -and [string]::IsNullOrWhiteSpace($HttpsHost)) {
    $HttpsHost = Get-OfficeIp
    if ([string]::IsNullOrWhiteSpace($HttpsHost)) {
        Write-Warning "This computer's office address could not be found, so the program is set up with plain HTTP. Run scripts\enable-https.ps1 once the computer is on the office network."
    }
}
if ($NoHttps -and -not $envExists) { $HttpsHost = "" }

# A random value that is safe inside .env and inside a database URL (letters and digits only).
function New-Secret([int]$length) {
    $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789".ToCharArray()
    $bytes = New-Object byte[] ($length * 2)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    $out = New-Object System.Text.StringBuilder
    foreach ($b in $bytes) {
        # Skip bytes that would make some characters more likely than others.
        if ($b -lt (256 - (256 % $chars.Length)) -and $out.Length -lt $length) {
            [void]$out.Append($chars[$b % $chars.Length])
        }
    }
    if ($out.Length -lt $length) { return (New-Secret $length) }
    return $out.ToString()
}

function Read-SecretText([string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

# Write .env as UTF-8 WITHOUT a byte-order mark (Compose would misread the first line).
function Write-EnvFile([string]$path, [string]$text) {
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

# Replace the first "NAME=..." or "# NAME=..." line, or add the line at the end.
function Set-EnvLine([string]$text, [string]$name, [string]$value) {
    $pattern = "(?m)^[ \t]*#?[ \t]*$([regex]::Escape($name))=[^\r\n]*"
    $line = "$name=$value"
    $regex = New-Object System.Text.RegularExpressions.Regex($pattern)
    if ($regex.IsMatch($text)) {
        $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $line }
        return $regex.Replace($text, $evaluator, 1)
    }
    return $text.TrimEnd() + "`r`n" + $line + "`r`n"
}

# Native programs write progress to stderr; with $ErrorActionPreference = "Stop"
# PowerShell 5.1 would treat that as an error as soon as the output is redirected.
function Invoke-Quiet([scriptblock]$block) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & $block } finally { $ErrorActionPreference = $old }
}

# ---------------------------------------------------------------- 1. Docker
Step "1/8  Checking Docker Desktop"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-Here "Docker Desktop is not installed. Install it first, start it once, then run this installer again."
}
function Test-Docker { Invoke-Quiet { docker info *> $null }; return ($LASTEXITCODE -eq 0) }
if (-not (Test-Docker)) {
    $desktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (Test-Path -LiteralPath $desktop) {
        Write-Host "Starting Docker Desktop (this can take a few minutes)..."
        Start-Process -FilePath $desktop
    }
    $deadline = (Get-Date).AddMinutes(4)
    while (-not (Test-Docker) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 5 }
    if (-not (Test-Docker)) { Stop-Here "Docker Desktop is not running. Open it, wait until it says it is running, then run this installer again." }
}
Write-Host "Docker is running."

# ------------------------------------------------------------------ 2. .env
Step "2/8  Settings and secrets (.env)"
$envPath = Join-Path $repoRoot ".env"
$adminPasswordShown = $null
if (Test-Path -LiteralPath $envPath) {
    Write-Host ".env already exists. It is kept as it is (nothing is replaced)."
} else {
    # A database volume from an earlier run holds an OLD database password. A new
    # random password in .env would then lock the backend out of it. Never guess here.
    $volumes = (& docker volume ls -q) -join "`n"
    if ($volumes -match "app-db-data") {
        Stop-Here "A database from an earlier installation already exists on this computer, but .env is missing. Installing over it would lock the program out of its own data. Ask the developers to check it first; nothing was changed."
    }
    $examplePath = Join-Path $repoRoot ".env.example"
    if (-not (Test-Path -LiteralPath $examplePath)) { Stop-Here ".env.example is missing from the project folder." }

    if ([string]::IsNullOrWhiteSpace($AdminEmail)) {
        $AdminEmail = (Read-Host "E-mail address for the System Administrator account").Trim()
    }
    if ($AdminEmail -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") { Stop-Here "That does not look like an e-mail address." }

    Write-Host "Choose the administrator's password (at least 12 characters), or press Enter to have one made for you."
    $adminPassword = Read-SecretText "Administrator password"
    if ([string]::IsNullOrEmpty($adminPassword)) {
        $adminPassword = New-Secret 16
        $adminPasswordShown = $adminPassword
    } else {
        if ($adminPassword.Length -lt 12) { Stop-Here "The password must have at least 12 characters." }
        if ($adminPassword -ne (Read-SecretText "Type it again")) { Stop-Here "The two passwords were different." }
    }

    $dbPassword = New-Secret 32
    $text = [System.IO.File]::ReadAllText($examplePath)
    $text = Set-EnvLine $text "COMPOSE_FILE" "compose.yml"
    $text = Set-EnvLine $text "SECRET_KEY" (New-Secret 48)
    $text = Set-EnvLine $text "MFA_ENCRYPTION_KEY" (New-Secret 48)
    $text = Set-EnvLine $text "DATA_ENCRYPTION_KEY" (New-Secret 48)
    $text = Set-EnvLine $text "FIRST_SUPERUSER" $AdminEmail
    $text = Set-EnvLine $text "FIRST_SUPERUSER_PASSWORD" $adminPassword
    $text = Set-EnvLine $text "POSTGRES_PASSWORD" $dbPassword
    $text = Set-EnvLine $text "DATABASE_URL" "postgresql://postgres:$dbPassword@localhost:5432/app"
    if (-not [string]::IsNullOrWhiteSpace($HttpsHost)) {
        $text = Set-EnvLine $text "COMPOSE_PROFILES" "https"
        $text = Set-EnvLine $text "HTTPS_HOST" $HttpsHost
        $text = Set-EnvLine $text "APP_BIND" "127.0.0.1"
        $text = Set-EnvLine $text "FORWARDED_ALLOW_IPS" "*"
    }
    Write-EnvFile $envPath $text
    $adminPassword = $null; $dbPassword = $null; $text = $null
    Write-Host ".env created with new random secrets."
}

# ----------------------------------------------------------- 3. build + start
Step "3/8  Building and starting the program (the first time takes several minutes)"
New-Item -ItemType Directory -Path (Join-Path $repoRoot "backups") -Force | Out-Null
& docker compose -f compose.yml build backend
if ($LASTEXITCODE -ne 0) { Stop-Here "The build failed. It needs the internet the first time. Check the connection and run the installer again." }
& docker compose -f compose.yml up -d
if ($LASTEXITCODE -ne 0) { Stop-Here "The program could not be started. Run: docker compose -f compose.yml logs --tail 40" }

function Wait-Healthy([int]$minutes) {
    $deadline = (Get-Date).AddMinutes($minutes)
    while ((Get-Date) -lt $deadline) {
        $id = (& docker compose -f compose.yml ps -q backend | Out-String).Trim()
        if ($id) {
            $state = (Invoke-Quiet { docker inspect --format "{{.State.Health.Status}}" $id 2>$null } | Out-String).Trim()
            if ($state -eq "healthy") { return $true }
        }
        Start-Sleep -Seconds 5
    }
    return $false
}
Write-Host "Waiting for the program to become healthy..."
if (-not (Wait-Healthy 6)) { Stop-Here "The program did not become healthy. Run: docker compose -f compose.yml logs backend --tail 30" }
Write-Host "The program is running."

# --------------------------------------------------------------- 4. admin
Step "4/8  Creating the administrator account"
& docker compose -f compose.yml exec -T backend python -m app.initial_data
if ($LASTEXITCODE -ne 0) { Stop-Here "The administrator account could not be created. Run: docker compose -f compose.yml logs backend --tail 30" }

# ------------------------------------------------------ 5. backup encryption
Step "5/8  Backup encryption"
$publicKey = Join-Path $repoRoot "backups\backup-public.pem"
$privateKey = Join-Path $repoRoot "backups\backup-private.pem"
if (Test-Path -LiteralPath $publicKey) {
    Write-Host "A backup key already exists. It is kept."
} else {
    Write-Host "Every backup is locked with a key so a stolen file cannot be read."
    Write-Host "You will now type a passphrase of at least 16 characters twice."
    Write-Host "WRITE IT ON PAPER, SEAL IT AND KEEP IT SAFE. It cannot be recovered; without it every backup is lost." -ForegroundColor Yellow
    & docker compose -f compose.yml exec backend python -m app.backup_cli make-key
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $publicKey)) {
        Stop-Here "The backup key was not made. Run the installer again."
    }
    if (Test-Path -LiteralPath $privateKey) {
        Write-Host ""
        Write-Host "Plug in the USB drive that will be kept AWAY from this computer."
        $usb = (Read-Host "Type its folder (for example E:\) or press Enter to do this later by hand").Trim().Trim('"').Trim()
        if ($usb -match '^[A-Za-z]$') { $usb = $usb + ":\" }
        elseif ($usb -match '^[A-Za-z]:$') { $usb = $usb + "\" }
        if ($usb) {
            try {
                # A drive root such as D:\ already exists and New-Item refuses it
                # ("The path is not of a legal form"), so only make a folder that is missing.
                if (-not (Test-Path -LiteralPath $usb -PathType Container)) {
                    New-Item -ItemType Directory -Path $usb -Force | Out-Null
                }
                $target = Join-Path $usb "backup-private.pem"
                Copy-Item -LiteralPath $privateKey -Destination $target -Force
                if ((Get-Item -LiteralPath $target).Length -ne (Get-Item -LiteralPath $privateKey).Length) {
                    throw "The copy has a different size than the original."
                }
                Remove-Item -LiteralPath $privateKey -Force
                Write-Host "The private key is on $usb and was removed from this computer."
            } catch {
                Write-Warning "Could not copy the private key: $($_.Exception.Message). It stays in the backups folder; copy it to a USB drive and delete it from there by hand."
            }
        } else {
            Write-Warning "The private key is still in the backups folder. Copy it to a USB drive kept elsewhere and delete it from here."
        }
    }
}
$text = [System.IO.File]::ReadAllText($envPath)
if ($text -notmatch "(?m)^BACKUP_REQUIRE_ENCRYPTION=true\s*$") {
    Write-EnvFile $envPath (Set-EnvLine $text "BACKUP_REQUIRE_ENCRYPTION" "true")
    & docker compose -f compose.yml up -d
    if (-not (Wait-Healthy 4)) { Stop-Here "The program did not come back after turning backup encryption on. Run: docker compose -f compose.yml logs backend --tail 30" }
}

# -------------------------------------------------------- 6. backup task
Step "6/8  Daily backup"
$taskArgs = @{ Time = $BackupTime }
if (-not [string]::IsNullOrWhiteSpace($BackupCopyTo)) { $taskArgs.CopyTo = $BackupCopyTo }
try {
    & (Join-Path $PSScriptRoot "register-backup-task.ps1") @taskArgs
    & (Join-Path $PSScriptRoot "scheduled-backup.ps1") | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "A first backup was made." } else { Write-Warning "The first backup failed. Read backups\last-run.json." }
} catch {
    Write-Warning "The backup task was not set up: $($_.Exception.Message). Run scripts\register-backup-task.ps1 by hand."
}

try {
    $startArgs = @{}
    if ($NoBrowser) { $startArgs.NoBrowser = $true }
    & (Join-Path $PSScriptRoot "register-start-task.ps1") @startArgs
} catch {
    Write-Warning "The start-at-sign-in task was not set up: $($_.Exception.Message). Run scripts\register-start-task.ps1 by hand."
}

if (-not $NoAutoUpdate) {
    try {
        & (Join-Path $PSScriptRoot "register-update-task.ps1") -Time $UpdateTime
    } catch {
        Write-Warning "The automatic update task was not set up: $($_.Exception.Message). Run scripts\register-update-task.ps1 by hand."
    }
}

# ------------------------------------------------------------ 7. firewall
Step "7/8  Firewall for the office network"
try {
    $ports = if ([string]::IsNullOrWhiteSpace($HttpsHost)) { "8000" } else { "443,80" }
    $fw = Join-Path $PSScriptRoot "open-firewall.ps1"
    $fwExtra = if ($AllNetworks) { " -AllNetworks" } else { "" }
    Start-Process -FilePath "powershell.exe" -Verb RunAs -Wait `
        -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$fw`" -Ports $ports$fwExtra"
    Write-Host "Firewall step finished (a Windows permission window may have appeared)."
} catch {
    Write-Warning "The firewall was not changed ($($_.Exception.Message)). Run scripts\open-firewall.ps1 as administrator."
}

# ------------------------------------------------------------ 8. shortcut
Step "8/8  Desktop shortcut"
$url = if ([string]::IsNullOrWhiteSpace($HttpsHost)) { "http://localhost:8000" } else { "https://$HttpsHost" }
try {
    $desktopDir = [Environment]::GetFolderPath("Desktop")
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path $desktopDir "Barangay Mayondon.url"))
    $shortcut.TargetPath = $url
    $shortcut.Save()
    Write-Host "Shortcut 'Barangay Mayondon' put on the desktop ($url)."
} catch {
    Write-Warning "The shortcut could not be made: $($_.Exception.Message)"
}

if (-not [string]::IsNullOrWhiteSpace($HttpsHost)) {
    Write-Host ""
    Write-Host "HTTPS: run scripts\export-https-root.ps1 now, then trust the file on every office computer (scripts\trust-office-https.ps1). Until then their browsers show a warning." -ForegroundColor Yellow
}

# --------------------------------------------------------------- summary
$ip = Get-OfficeIp

Write-Host ""
Write-Host "==================== DONE ====================" -ForegroundColor Green
Write-Host "On this computer open:  $url"
if ($ip -and [string]::IsNullOrWhiteSpace($HttpsHost)) { Write-Host "Other office computers: http://$($ip):8000   (ask the network administrator to reserve this address)" }
if (-not [string]::IsNullOrWhiteSpace($HttpsHost)) { Write-Host "Other office computers: https://$HttpsHost   (ask the network administrator to reserve this address; the certificate is made for it)" }
if ($adminPasswordShown) {
    Write-Host ""
    Write-Host "Administrator password (shown ONCE, write it down now):  $adminPasswordShown" -ForegroundColor Yellow
    Write-Host "Sign in, then change it from My Account."
    Read-Host "Press Enter after you wrote it down (the screen will be cleared)" | Out-Null
    Clear-Host
}
Write-Host "Next, signed in as the administrator: add the streets and puroks, create staff accounts with each person present, and ask everyone to set their security questions."
Write-Host "The program starts by itself when this Windows user signs in (task 'Mayondon Start at Sign-in')$(if (-not $NoBrowser) { ' and opens in the browser' }). Tick Docker Desktop > Settings > General > 'Start Docker Desktop when you sign in' as well. Check anytime with Check-Mayondon.cmd."
if (-not $NoAutoUpdate) { Write-Host "Updates: at night (from $UpdateTime) the program installs the newest approved version by itself (task 'Mayondon Auto Update'); it makes a backup first. An administrator can also press Update in the notification bell." }
