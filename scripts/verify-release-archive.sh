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
  scripts/install.ps1 scripts/update.ps1 scripts/auto-update.ps1 scripts/update-watcher.ps1 \
  scripts/register-update-task.ps1 scripts/scheduled-backup.ps1 scripts/ensure-data-key.ps1 \
  scripts/restore-db.ps1 scripts/status.ps1 scripts/start-mayondon.ps1; do
  [ -e "$tmp/$f" ] || { echo "MISSING from the release: $f"; fail=1; }
done
# Every migration and print-form image must be in.
for d in backend/app/alembic/versions frontend/public/assets/print-forms; do
  a=$(git ls-files "$d" | wc -l); b=$(find "$tmp/$d" -type f 2>/dev/null | wc -l)
  [ "$a" = "$b" ] || { echo "$d: $b of $a files in the release"; fail=1; }
done
# Git must have written the commit into the version file (export-subst), because the office
# computer has no .git folder to ask. A literal "$Format" means the .gitattributes line is lost.
if grep -q 'Format:' "$tmp/frontend/build-info.json" 2>/dev/null; then
  echo "frontend/build-info.json was not filled in by git archive (check .gitattributes export-subst)"; fail=1
fi
# None of these may ship.
for f in compose.override.yml compose.dev.yml .env.dev.example .github docs/Barangay-softcopies \
  backend/tests frontend/tests packages scripts/dev-db.ps1 scripts/test.sh scripts/generate-client.sh \
  frontend/biome.json docs README.md LICENSE scripts/test-backup-restore.ps1 \
  backend/app/sample_data_cli.py backend/app/alembic/README backend/app/alembic/script.py.mako; do
  [ ! -e "$tmp/$f" ] || { echo "SHOULD NOT ship: $f"; fail=1; }
done

echo "Release files: $(find "$tmp" -type f | wc -l) of $(git ls-files | wc -l) tracked."
if [ "${1:-}" = "--build" ] && [ $fail = 0 ]; then
  # Same steps as backend/Dockerfile: install exactly bun.lock, then build.
  (cd "$tmp/frontend" && bun install --frozen-lockfile && bun run build)
fi
[ $fail = 0 ] && echo "Release archive OK." || echo "Release archive has problems."
exit $fail
