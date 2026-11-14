# Register (or remove) a Windows Task Scheduler task that runs start-mayondon.ps1
# every time this Windows user signs in, so the program comes back after a restart
# or a power cut without anyone opening Docker Desktop (docs/11 section B and H).
#   .\scripts\register-start-task.ps1
#   .\scripts\register-start-task.ps1 -Unregister
# It starts at SIGN-IN, not at power-on: Windows must reach the sign-in and the
# user must sign in (automatic sign-in is a Windows setting you may choose to use;
# weigh it against the physical security of the computer).

param(
    [string]$TaskName = "Mayondon Start at Sign-in",
    [switch]$Unregister
)

$ErrorActionPreference = "Stop"

if ($Unregister) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed the scheduled task '$TaskName'."
    } else {
        Write-Host "There is no scheduled task named '$TaskName'."
    }
    exit 0
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot "start-mayondon.ps1"
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "start-mayondon.ps1 was not found next to this script." }

$userName = "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -WorkingDirectory $repoRoot `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userName
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Principal $principal -Force | Out-Null

Write-Host "Scheduled task '$TaskName' registered: runs when $userName signs in."
Write-Host "Test it now:  Start-ScheduledTask -TaskName `"$TaskName`""
Write-Host "Then read:    $(Join-Path $repoRoot 'backups\last-start.json')"
