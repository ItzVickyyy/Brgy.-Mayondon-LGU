# Register (or remove) the Windows Task Scheduler task "Mayondon Auto Update" (docs/11 section H).
# The task starts update-watcher.ps1 when this Windows user signs in; the watcher keeps running,
# hidden, and
#   - installs the approved version only AT NIGHT (from -Time, for 3 hours),
#   - looks for a new version a few times a day and tells the program (its notification then
#     shows an Update button for administrators),
#   - installs at once when an administrator presses that Update button.
#   .\scripts\register-update-task.ps1                    # night window from 02:00
#   .\scripts\register-update-task.ps1 -Time 01:00
#   .\scripts\register-update-task.ps1 -Ref master        # NOT recommended, see below
#   .\scripts\register-update-task.ps1 -Unregister
# Test it afterwards:  .\scripts\auto-update.ps1 -CheckOnly
# An older computer has the task from before this change (daily at 12:30, no watcher): run this
# script once to replace it.
#
# The task installs only the commit that the branch given by -Ref (default
# "Production") points to. That branch holds approved releases only (docs/07
# section 4); the team creates it on purpose with "git push origin master:Production"
# when a version is approved. Until it exists the task finds nothing to install.
# Pointing -Ref at "master" would put every unreviewed change on the real computer.
#
# The task runs only while this Windows user is signed in (Docker Desktop is started
# by that sign-in), so the computer must be on and signed in during the night window, or an
# administrator presses Update the next day. The program is restarted during an update (the
# update needs about 2 to 10 minutes and the program is unavailable for under a minute of
# that), which is why it waits for the night.
# On a Git clone (the development computer) it registers nothing.

param(
    # When the night window starts, 24-hour, for example 02:00; it lasts 3 hours.
    [string]$Time = "02:00",
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
    throw "-Time must look like 02:00 (24-hour, HH:mm)."
}
if ($Repo -notmatch "^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$") { throw "-Repo must look like owner/name." }
if ($Ref -notmatch "^[A-Za-z0-9._/-]+$") { throw "-Ref may contain only letters, digits and . _ / -" }

$repoRoot = Split-Path -Parent $PSScriptRoot
if (Test-Path -LiteralPath (Join-Path $repoRoot ".git")) {
    Write-Host "This folder is a Git clone (a development computer). Automatic update is only for installed copies, so no task was made."
    exit 0
}
$script = Join-Path $PSScriptRoot "update-watcher.ps1"
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "update-watcher.ps1 was not found next to this script." }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "auto-update.ps1") -PathType Leaf)) { throw "auto-update.ps1 was not found next to this script." }

$userName = "$env:USERDOMAIN\$env:USERNAME"
$nightFrom = $at.ToString("HH:mm")
$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Repo `"$Repo`" -Ref `"$Ref`" -NightFrom $nightFrom"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userName
# The watcher never ends on its own, so there is no time limit; if it stops it is started again.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 5) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Principal $principal -Force | Out-Null

Write-Host "Scheduled task '$TaskName' registered: starts when $userName signs in and keeps watching."
Write-Host "It installs the approved version of branch '$Ref' of $Repo only at night (from $nightFrom, 3 hours)."
Write-Host "An administrator can also press Update in the program (the notification bell) at any hour."
Write-Host "See what it would do now:  .\scripts\auto-update.ps1 -CheckOnly"
Write-Host "Start it now:              Start-ScheduledTask -TaskName `"$TaskName`""
Write-Host "Then read:                 $(Join-Path $repoRoot 'backups\update-watcher.log')"
Write-Host "Then read:                 $(Join-Path $repoRoot 'backups\last-autoupdate.json')"
