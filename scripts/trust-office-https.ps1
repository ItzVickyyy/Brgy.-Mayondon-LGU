# Make THIS computer trust the office HTTPS certificate authority, once.
# Run on each office computer (and on the server computer if it opens the
# https address). No administrator rights are needed: the certificate is added
# for the signed-in Windows user. Windows shows a security question: compare the
# thumbprint it prints with the one scripts\export-https-root.ps1 printed on the
# server, then answer Yes.
#
# Edge and Chrome use the Windows store. Firefox keeps its own: in Firefox open
# about:config and set security.enterprise_roots.enabled to true.

param(
    [Parameter(Mandatory = $true)][string]$CertFile
)

$ErrorActionPreference = "Stop"

$resolved = (Resolve-Path -LiteralPath $CertFile).ProviderPath
$certificate = Get-PfxCertificate -FilePath $resolved
Write-Host "Certificate: $($certificate.Subject)"
Write-Host "Thumbprint:  $($certificate.Thumbprint)"
Import-Certificate -FilePath $resolved -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
Write-Host "Done. Close and reopen the browser, then open the https address."
