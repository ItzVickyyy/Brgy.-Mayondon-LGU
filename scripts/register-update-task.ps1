# Register (or remove) the Windows Task Scheduler task that runs auto-update.ps1
# once a day (docs/11 section H).
#   .\scripts\register-update-task.ps1                    # every day at 12:30
#   .\scripts\register-update-task.ps1 -Time 13:00
#   .\scripts\register-update-task.ps1 -Ref master        # NOT recommended, see below
#   .\scripts\register-update-task.ps1 -Unregister
# Test it afterwards:  .\scripts\auto-update.ps1 -CheckOnly
#
# The task installs only the commit that the branch given by -Ref (default
# "Production") points to. That branch holds approved releases only (docs/07
# section 4); the team creates it on purpose with "git push origin master:Production"
# when a version is approved. Until it exists the task finds nothing to install.
# Pointing -Ref at "master" would put every unreviewed change on the real computer.
#
# The task runs only while this Windows user is signed in (Docker Desktop is started
# by that sign-in). If the computer is off at the chosen time the update runs when
# the user signs in again. The program is restarted during an update, so choose a
# time when nobody is using it (the update needs about 2 to 10 minutes and the
# program is unavailable for under a minute of that).
# On a Git clone (the development computer) it registers nothing.

param(
    # Time of day, 24-hour, for example 12:30.
    [string]$Time = "12:30",
    [string]$Repo = "ItzVickyyy/Brgy.-Mayondon-LGU",
    [string]$Ref = "Production",
    [string]$TaskName = "Mayondon Auto Update",
    [switch]$Unregister
)

$ErrorActionPreference = "Stop"

if ($Unregister) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed the scheduled task '$TaskName'. Automatic updates are off."
    } else {
        Write-Host "There is no scheduled task named '$TaskName'."
    }
    exit 0
}

try {
    $at = [datetime]::ParseExact($Time, "HH:mm", [System.Globalization.CultureInfo]::InvariantCulture)
} catch {
    throw "-Time must look like 12:30 (24-hour, HH:mm)."
}
if ($Repo -notmatch "^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$") { throw "-Repo must look like owner/name." }
if ($Ref -notmatch "^[A-Za-z0-9._/-]+$") { throw "-Ref may contain only letters, digits and . _ / -" }

$repoRoot = Split-Path -Parent $PSScriptRoot
if (Test-Path -LiteralPath (Join-Path $repoRoot ".git")) {
    Write-Host "This folder is a Git clone (a development computer). Automatic update is only for installed copies, so no task was made."
    exit 0
}
$script = Join-Path $PSScriptRoot "auto-update.ps1"
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "auto-update.ps1 was not found next to this script." }

$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Repo `"$Repo`" -Ref `"$Ref`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$userName = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Principal $principal -Force | Out-Null

Write-Host "Scheduled task '$TaskName' registered: every day at $Time as $userName."
Write-Host "It installs only the approved version of branch '$Ref' of $Repo."
Write-Host "See what it would do now:  .\scripts\auto-update.ps1 -CheckOnly"
Write-Host "Run it now:                Start-ScheduledTask -TaskName `"$TaskName`""
Write-Host "Then read:                 $(Join-Path $repoRoot 'backups\last-autoupdate.json')"
