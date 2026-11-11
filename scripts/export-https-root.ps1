# Copy the office HTTPS certificate authority (the "root certificate") out of the
# Caddy container so each office computer can trust it once.
# Run on the SERVER computer, from the repository root, with HTTPS switched on
# (docs/11 section G item 7) and the containers running.
#
# The file holds only a PUBLIC certificate: it is safe to put on a USB drive or
# send by e-mail. The private key stays inside the Docker volume caddy-data.

param([string]$Out = ".\mayondon-office-root.crt")

$ErrorActionPreference = "Stop"

docker compose -f compose.yml --profile https cp "caddy:/data/caddy/pki/authorities/local/root.crt" $Out
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Out)) {
    throw "Could not copy the certificate. Is HTTPS switched on and is the caddy container running? Check: docker compose -f compose.yml --profile https ps"
}

$resolved = (Resolve-Path -LiteralPath $Out).ProviderPath
$thumbprint = (Get-PfxCertificate -FilePath $resolved).Thumbprint
Write-Host "Saved: $resolved"
Write-Host "Thumbprint (check that every computer shows the same one): $thumbprint"
Write-Host ""
Write-Host "On each office computer (once): copy this file there, then run in PowerShell:"
Write-Host "  .\scripts\trust-office-https.ps1 -CertFile <path to the .crt file>"
