# Removes files an earlier version left on this computer that the new release no
# longer contains (tests, CI files, documents, Word templates, development Compose files, old
# source files). Called by update.ps1 after it has copied a new version in; it can
# also be run by hand:
#   .\scripts\prune-release.ps1 -Source <folder with the new version> -DryRun   (lists only)
#   .\scripts\prune-release.ps1 -Source <folder with the new version>
#
# Safe by design (decision 70):
#   * It only deletes files that are NOT in the new version, and only inside the
#     program folders listed below. .env, backups\, keys, certificates, the database
#     and .installed-commit are never looked at.
#   * It refuses to run if -Source does not look like a project folder.
#   * It does nothing on a Git clone (the development computer).
#   * A failure here never stops an update; update.ps1 only prints a warning.

param(
    [Parameter(Mandatory = $true)][string]$Source,
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$Source = (Resolve-Path -LiteralPath $Source).ProviderPath.TrimEnd('\', '/')
$Root = (Resolve-Path -LiteralPath $Root).ProviderPath.TrimEnd('\', '/')

# Paths below are written with \ ; on Windows that is the real separator.
$sep = [IO.Path]::DirectorySeparatorChar
function Fs([string]$rel) { $rel.Replace('\', $sep) }
function Rel([string]$full) { $full.Substring($Root.Length + 1).Replace($sep, '\') }

if ($Source -eq $Root) { throw "-Source and the installed folder are the same folder." }
foreach ($need in @("compose.yml", "scripts\update.ps1", "backend\Dockerfile")) {
    if (-not (Test-Path -LiteralPath (Join-Path $Source (Fs $need)))) { throw "'$Source' is not a project folder (no $need). Nothing was removed." }
}
if (Test-Path -LiteralPath (Join-Path $Root ".git")) {
    Write-Host "This folder is a Git clone (a development computer). Nothing was removed."
    exit 0
}

# Folders that are fully mirrored: files not in the new version are removed.
$mirrored = @("backend\app", "backend\scripts", "frontend\src", "frontend\public", "deploy", "scripts")
# Folders where only the files directly inside are mirrored (sub-folders are left alone).
$flat = @("backend", "frontend")
# Folders that exist only for development; removed when the new version has no such folder.
$devOnly = @("backend\tests", "frontend\tests", "packages", ".github", ".vscode", "docs")
# Single files that exist only for development; removed when the new version has no such file.
$devFiles = @("compose.override.yml", "compose.dev.yml", ".env.dev.example", ".pre-commit-config.yaml", ".python-version", ".gitattributes", "README.md", "LICENSE")
# Never removed, whatever the rules above say.
$protected = '(^|\\)(\.env(\.dev|\.before-rotation-.*)?|\.installed-commit|backups(\\.*)?|.*\.pem|.*\.crt|.*\.dump(\.enc)?|__pycache__(\\.*)?|node_modules(\\.*)?|\.venv(\\.*)?)$'

$removed = 0
function Remove-Path([string]$full, [string]$rel, [bool]$isDir) {
    if ($rel -match $protected) { return }
    if ($DryRun) { Write-Host "  would remove $rel" }
    else {
        if ($isDir) { Remove-Item -LiteralPath $full -Recurse -Force } else { Remove-Item -LiteralPath $full -Force }
        Write-Host "  removed $rel"
    }
    $script:removed++
}

foreach ($dir in $mirrored) {
    $installed = Join-Path $Root (Fs $dir)
    if (-not (Test-Path -LiteralPath $installed -PathType Container)) { continue }
    if (-not (Test-Path -LiteralPath (Join-Path $Source (Fs $dir)) -PathType Container)) { continue }
    foreach ($file in Get-ChildItem -LiteralPath $installed -Recurse -File -Force) {
        $rel = Rel $file.FullName
        if ($rel -eq "backend\app\frontend" -or $rel.StartsWith("backend\app\frontend\")) { continue }
        if (-not (Test-Path -LiteralPath (Join-Path $Source (Fs $rel)))) { Remove-Path $file.FullName $rel $false }
    }
}
foreach ($dir in $flat) {
    $installed = Join-Path $Root (Fs $dir)
    if (-not (Test-Path -LiteralPath $installed -PathType Container)) { continue }
    foreach ($file in Get-ChildItem -LiteralPath $installed -File -Force) {
        $rel = Rel $file.FullName
        if (-not (Test-Path -LiteralPath (Join-Path $Source (Fs $rel)))) { Remove-Path $file.FullName $rel $false }
    }
}
foreach ($dir in $devOnly) {
    $installed = Join-Path $Root (Fs $dir)
    if ((Test-Path -LiteralPath $installed -PathType Container) -and -not (Test-Path -LiteralPath (Join-Path $Source (Fs $dir)))) {
        Remove-Path $installed $dir $true
    }
}
foreach ($f in $devFiles) {
    $installed = Join-Path $Root (Fs $f)
    if ((Test-Path -LiteralPath $installed -PathType Leaf) -and -not (Test-Path -LiteralPath (Join-Path $Source (Fs $f)))) {
        Remove-Path $installed $f $false
    }
}
# Empty folders left behind by the mirrored clean-up.
if (-not $DryRun) {
    foreach ($dir in $mirrored) {
        $installed = Join-Path $Root (Fs $dir)
        if (-not (Test-Path -LiteralPath $installed -PathType Container)) { continue }
        Get-ChildItem -LiteralPath $installed -Recurse -Directory -Force |
            Sort-Object { $_.FullName.Length } -Descending |
            Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force) -and (Rel $_.FullName) -notmatch '^backend\\app\\frontend' } |
            ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
    }
}

if ($DryRun) { Write-Host "$removed file(s) or folder(s) would be removed. Nothing was changed." }
else { Write-Host "$removed file(s) or folder(s) from older versions removed." }
exit 0
