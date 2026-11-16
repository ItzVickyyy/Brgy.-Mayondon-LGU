# Allow the office network to reach the program (Windows Defender Firewall, Private
# network profile only). Asks Windows for administrator permission by itself.
#   .\scripts\open-firewall.ps1                 # plain HTTP on port 8000
#   .\scripts\open-firewall.ps1 -Ports 443,80   # when HTTPS is on (docs/11 G.7)
# Safe to run again: it replaces its own rules and touches nothing else.
# It never opens the database port (5432).

param(
    [int[]]$Ports = @(8000)
)

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    $list = ($Ports -join ",")
    Start-Process -FilePath "powershell.exe" -Verb RunAs -Wait `
        -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Ports $list"
    exit 0
}

foreach ($rule in (Get-NetFirewallRule -DisplayName "Mayondon web *" -ErrorAction SilentlyContinue)) {
    Remove-NetFirewallRule -Name $rule.Name
}
foreach ($port in $Ports) {
    if ($port -eq 5432) { throw "Refusing to open the database port." }
    New-NetFirewallRule -DisplayName "Mayondon web $port" -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $port -Profile Private | Out-Null
    Write-Host "Allowed inbound TCP $port on Private networks."
}
$publicNet = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object {
    $_.NetworkCategory -eq "Public" -and $_.IPv4Connectivity -notin @("Disconnected", "NoTraffic") -and
    $_.InterfaceAlias -notmatch "vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V|Loopback" })
if ($publicNet.Count -gt 0) {
    Write-Host ""
    Write-Host "WARNING: Windows treats '$($publicNet[0].Name)' as a PUBLIC network. The rule above does not apply there," -ForegroundColor Yellow
    Write-Host "so other computers cannot open the program. Set it to Private: Settings > Network > the network > Network profile type > Private." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
} else {
    Write-Host "If the office network is ever set to 'Public' in Windows, change it to 'Private' (Settings > Network)."
}
