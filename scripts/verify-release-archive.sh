#!/usr/bin/env bash
# Builds the release archive of HEAD (the same file set GitHub's archive/<commit>.zip
# gives scripts/auto-update.ps1) and checks it. Run from anywhere inside the clone:
#   sh scripts/verify-release-archive.sh            check only
#   sh scripts/verify-release-archive.sh --build    also run the frontend build in it
# Rules live in .gitattributes (decision 70). Exit code 0 = good, 1 = problem.
set -eu
root=$(git rev-parse --show-toplevel)
cd "$root"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git archive --format=tar HEAD | tar -x -C "$tmp"
fail=0

# Everything the Docker build, Compose and the office scripts open.
for f in compose.yml package.json bun.lock pyproject.toml uv.lock .dockerignore .env.example \
  Install-Mayondon.cmd Start-Mayondon.cmd Update-Mayondon.cmd Check-Mayondon.cmd \
  deploy/Caddyfile backend/Dockerfile backend/pyproject.toml backend/alembic.ini \
  backend/scripts/entrypoint.sh backend/app/main.py backend/app/migrate_on_start.py \
  frontend/index.html frontend/package.json frontend/tsconfig.json frontend/tsconfig.build.json \
  frontend/tsconfig.node.json frontend/vite.config.ts frontend/src/main.tsx \
  scripts/install.ps1 scripts/update.ps1 scripts/auto-update.ps1 scripts/scheduled-backup.ps1 \
  scripts/restore-db.ps1 scripts/status.ps1 scripts/start-mayondon.ps1 \
  docs/11-Host-Checks.md docs/06-Architecture-and-Deployment.md; do
  [ -e "$tmp/$f" ] || { echo "MISSING from the release: $f"; fail=1; }
done
# Every migration and print-form image must be in.
for d in backend/app/alembic/versions frontend/public/assets/print-forms; do
  a=$(git ls-files "$d" | wc -l); b=$(find "$tmp/$d" -type f 2>/dev/null | wc -l)
  [ "$a" = "$b" ] || { echo "$d: $b of $a files in the release"; fail=1; }
done
# None of these may ship.
for f in compose.override.yml compose.dev.yml .env.dev.example .github docs/Barangay-softcopies \
  backend/tests frontend/tests packages scripts/dev-db.ps1 scripts/test.sh scripts/generate-client.sh \
  frontend/biome.json; do
  [ ! -e "$tmp/$f" ] || { echo "SHOULD NOT ship: $f"; fail=1; }
done

echo "Release files: $(find "$tmp" -type f | wc -l) of $(git ls-files | wc -l) tracked."
if [ "${1:-}" = "--build" ] && [ $fail = 0 ]; then
  (cd "$tmp/frontend" && bun install && bun run build)
fi
[ $fail = 0 ] && echo "Release archive OK." || echo "Release archive has problems."
exit $fail
