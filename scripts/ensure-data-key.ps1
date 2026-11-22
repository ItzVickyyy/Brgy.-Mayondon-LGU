# Adds DATA_ENCRYPTION_KEY to .env when it has none (patch 213). The key locks the health
# condition of an Assistance Certification in the database. It is made once and never changed:
# KEEP A COPY OF .env ON YOUR USB DRIVE, because without the exact key those values cannot be read.
#
# Safe to run again: a .env that already has a key is left alone. update.ps1 runs this; a new
# installation gets its key from install.ps1. The key is never printed.
#   powershell -ExecutionPolicy Bypass -File .\scripts\ensure-data-key.ps1
# Then run  docker compose -f compose.yml up -d  so the program picks it up (an update does).
#
# -EnvFile is for the tests.

param(
    [string]$EnvFile
)

$ErrorActionPreference = "Stop"
if (-not $EnvFile) { $EnvFile = Join-Path (Split-Path -Parent $PSScriptRoot) ".env" }
if (-not (Test-Path -LiteralPath $EnvFile)) {
    Write-Host "No .env at $EnvFile. This is not an installed system." -ForegroundColor Red
    exit 1
}

$text = [System.IO.File]::ReadAllText($EnvFile)
if ($text -match "(?m)^[ \t]*DATA_ENCRYPTION_KEY=[^\s]") {
    Write-Host "DATA_ENCRYPTION_KEY is already set. Nothing changed."
    exit 0
}

# 48 random letters and digits, every character equally likely.
$chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789".ToCharArray()
$limit = 256 - (256 % $chars.Length)
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$key = New-Object System.Text.StringBuilder
while ($key.Length -lt 48) {
    $bytes = New-Object byte[] 96
    $rng.GetBytes($bytes)
    foreach ($b in $bytes) {
        if ($b -lt $limit -and $key.Length -lt 48) { [void]$key.Append($chars[$b % $chars.Length]) }
    }
}
$rng.Dispose()

$nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
$line = "DATA_ENCRYPTION_KEY=$($key.ToString())"
$regex = New-Object System.Text.RegularExpressions.Regex("(?m)^[ \t]*#?[ \t]*DATA_ENCRYPTION_KEY=[^\r\n]*")
if ($regex.IsMatch($text)) {
    $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $line }
    $new = $regex.Replace($text, $evaluator, 1)
} else {
    $new = $text.TrimEnd() + $nl + $line + $nl
}

$temp = "$EnvFile.new"
[System.IO.File]::WriteAllText($temp, $new, (New-Object System.Text.UTF8Encoding($false)))
Move-Item -LiteralPath $temp -Destination $EnvFile -Force
Write-Host "DATA_ENCRYPTION_KEY was added to .env. Keep a copy of .env on your USB drive." -ForegroundColor Green
exit 0
