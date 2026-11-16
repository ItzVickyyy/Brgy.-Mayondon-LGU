# Allow the office network to reach the program (Windows Defender Firewall).
# Default: Private network profile only. Asks Windows for administrator permission by itself.
#   powershell -ExecutionPolicy Bypass -File .\scripts\open-firewall.ps1                 # HTTP, port 8000
#   powershell -ExecutionPolicy Bypass -File .\scripts\open-firewall.ps1 -Ports 443,80   # when HTTPS is on (docs/11 G.7)
#   ... -AllNetworks   # for an office Wi-Fi that Windows calls 'Public' and cannot be changed:
#                      # the rule then applies on every network profile, but ONLY to computers
#                      # on the same local subnet (-RemoteAddress LocalSubnet). Still behind the login.
# Safe to run again: it replaces its own rules and touches nothing else.
# It never opens the database port (5432).

param(
    [int[]]$Ports = @(8000),
    [switch]$AllNetworks
)

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    $list = ($Ports -join ",")
    $extra = if ($AllNetworks) { " -AllNetworks" } else { "" }
    Start-Process -FilePath "powershell.exe" -Verb RunAs -Wait `
        -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Ports $list$extra"
    exit 0
}

foreach ($rule in (Get-NetFirewallRule -DisplayName "Mayondon web *" -ErrorAction SilentlyContinue)) {
    Remove-NetFirewallRule -Name $rule.Name
}
foreach ($port in $Ports) {
    if ($port -eq 5432) { throw "Refusing to open the database port." }
    if ($AllNetworks) {
        New-NetFirewallRule -DisplayName "Mayondon web $port" -Direction Inbound -Action Allow `
            -Protocol TCP -LocalPort $port -Profile Any -RemoteAddress LocalSubnet | Out-Null
        Write-Host "Allowed inbound TCP $port on every network profile, from the local subnet only."
    } else {
        New-NetFirewallRule -DisplayName "Mayondon web $port" -Direction Inbound -Action Allow `
            -Protocol TCP -LocalPort $port -Profile Private | Out-Null
        Write-Host "Allowed inbound TCP $port on Private networks."
    }
}
$publicNet = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object {
    $_.NetworkCategory -eq "Public" -and $_.IPv4Connectivity -notin @("Disconnected", "NoTraffic") -and
    $_.InterfaceAlias -notmatch "vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V|Loopback" })
if ($publicNet.Count -gt 0 -and -not $AllNetworks) {
    Write-Host ""
    Write-Host "WARNING: Windows treats '$($publicNet[0].Name)' as a PUBLIC network. The rule above does not apply there," -ForegroundColor Yellow
    Write-Host "so other computers cannot open the program. Either set it to Private (Settings > Network > the network > Network profile type > Private)," -ForegroundColor Yellow
    Write-Host "or run this script again with -AllNetworks (allows only computers on the same local subnet)." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
} elseif (-not $AllNetworks) {
    Write-Host "If the office network is ever set to 'Public' in Windows, change it to 'Private' (Settings > Network)."
}
