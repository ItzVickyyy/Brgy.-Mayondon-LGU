# Register (or remove) a Windows Task Scheduler task that runs scheduled-backup.ps1 every day.
# Run in PowerShell from the repository root:
#   .\scripts\register-backup-task.ps1                       # daily at 17:00
#   .\scripts\register-backup-task.ps1 -Time 18:30 -CopyTo "E:\MayondonBackups"
#   .\scripts\register-backup-task.ps1 -Unregister
# Test it afterwards:  Start-ScheduledTask -TaskName "Mayondon Database Backup"
# then read backups\last-run.json.
#
# Default: the task runs only while this Windows user is signed in. Docker Desktop is
# normally started by that sign-in, so a backup before sign-in cannot reach Docker anyway.
# -StartWhenAvailable runs a missed backup as soon as the user is back.
# -RunWhetherLoggedOn asks for the Windows password and runs the task without a sign-in;
# it only works if Docker Desktop is also running then (see docs/11-Host-Checks.md).

param(
    # Time of day, 24-hour, for example 17:00.
    [string]$Time = "17:00",

    # Optional second location, for example an external drive.
    [string]$CopyTo,

    # How many files to keep in -CopyTo.
    [ValidateRange(1, 365)]
    [int]$KeepCopies = 14,

    [string]$TaskName = "Mayondon Database Backup",

    [switch]$RunWhetherLoggedOn,

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

try {
    $at = [datetime]::ParseExact($Time, "HH:mm", [System.Globalization.CultureInfo]::InvariantCulture)
} catch {
    throw "-Time must look like 17:00 (24-hour, HH:mm)."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot "scheduled-backup.ps1"
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    throw "scheduled-backup.ps1 was not found next to this script."
}

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -KeepCopies $KeepCopies"
if (-not [string]::IsNullOrWhiteSpace($CopyTo)) {
    $arguments += " -CopyTo `"$CopyTo`""
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$userName = "$env:USERDOMAIN\$env:USERNAME"

if ($RunWhetherLoggedOn) {
    $credential = Get-Credential -UserName $userName -Message "Windows password for the scheduled backup"
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
        -User $credential.UserName -Password $credential.GetNetworkCredential().Password -Force | Out-Null
} else {
    $principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
        -Principal $principal -Force | Out-Null
}

Write-Host "Scheduled task '$TaskName' registered: every day at $Time as $userName."
if ($CopyTo) { Write-Host "Each backup is also copied to $CopyTo (newest $KeepCopies kept)." }
Write-Host "Test it now:  Start-ScheduledTask -TaskName `"$TaskName`""
Write-Host "Then read:    $(Join-Path $repoRoot 'backups\last-run.json')"
