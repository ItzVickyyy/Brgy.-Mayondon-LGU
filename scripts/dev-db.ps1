# The separate DEVELOPMENT database (sample data). Never touches the real one.
# Usage (from the project folder):
#   .\scripts\dev-db.ps1 up      first time or later: start, create accounts, add sample data
#   .\scripts\dev-db.ps1 down    stop it (the sample data is kept)
#   .\scripts\dev-db.ps1 reset   DELETE the sample database and make a fresh one
#   .\scripts\dev-db.ps1 psql    open a database prompt on the sample database
#   .\scripts\dev-db.ps1 logs    show the last backend log lines
# The sample system opens at http://127.0.0.1:8002 (database on port 5433).
param([Parameter(Position = 0)][ValidateSet("up", "down", "reset", "psql", "logs")][string]$Command = "up")

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path ".env.dev")) {
    Copy-Item ".env.dev.example" ".env.dev"
    Write-Host "Made .env.dev from .env.dev.example (sample passwords; change them if you like)."
}

$dc = @("compose", "-p", "mayondon-dev", "--env-file", ".env.dev", "-f", "compose.yml", "-f", "compose.dev.yml")

switch ($Command) {
    "up" {
        docker @dc up -d --build --wait
        if ($LASTEXITCODE -ne 0) { throw "docker compose up failed." }
        docker @dc exec backend python app/initial_data.py
        docker @dc exec backend python -m app.sample_data_cli --residents 400
        Write-Host ""
        Write-Host "Sample system: http://127.0.0.1:8002  (admin@example.com / FIRST_SUPERUSER_PASSWORD in .env.dev)"
    }
    "down" { docker @dc down }
    "reset" {
        Write-Host "This deletes ONLY the sample database (project mayondon-dev). The real system is not touched."
        docker @dc down -v
        docker @dc up -d --build --wait
        if ($LASTEXITCODE -ne 0) { throw "docker compose up failed." }
        docker @dc exec backend python app/initial_data.py
        docker @dc exec backend python -m app.sample_data_cli --residents 400
    }
    "psql" { docker @dc exec db psql -U postgres -d app_dev }
    "logs" { docker @dc logs --tail 40 backend }
}
