#!/usr/bin/env bash
# Tests scripts/prune-release.ps1 on a made-up old installation (decision 70).
# Needs PowerShell 7 (pwsh). Run from anywhere inside the clone:
#   sh scripts/test-prune-release.sh
set -eu
root=$(git rev-parse --show-toplevel)
cd "$root"
command -v pwsh >/dev/null || { echo "pwsh (PowerShell 7) is not installed."; exit 1; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/old" "$tmp/new"
# "Old installation": every tracked file (what a full copy of the repository gave).
git ls-files -z | tar --null -T - -cf - | tar -x -C "$tmp/old"
# "New release": what the archive now contains.
git archive HEAD | tar -x -C "$tmp/new"
cd "$tmp/old"
# Things that belong to this computer and must survive.
echo secret > .env; echo old > .env.before-rotation-1; echo c > .installed-commit; echo crt > mayondon-office-root.crt
mkdir -p backups backend/app/__pycache__ backend/app/frontend frontend/node_modules/x
echo d > backups/a.dump.enc; echo k > backups/backup-public.pem; echo p > backend/app/__pycache__/a.pyc
echo b > backend/app/frontend/index.html; echo n > frontend/node_modules/x/i.js
# Stale program files from an older version.
echo old > backend/app/old_removed.py; echo old > frontend/src/stale.tsx

before=$(find . -type f | wc -l)
pwsh -NoProfile -File "$root/scripts/prune-release.ps1" -Source "$tmp/new" -Root "$tmp/old" -DryRun >/dev/null
[ "$(find . -type f | wc -l)" = "$before" ] || { echo "FAIL: -DryRun changed files"; exit 1; }
pwsh -NoProfile -File "$root/scripts/prune-release.ps1" -Source "$tmp/new" -Root "$tmp/old" >/dev/null

fail=0
for f in .env .env.before-rotation-1 .installed-commit mayondon-office-root.crt backups/a.dump.enc \
  backups/backup-public.pem backend/app/__pycache__/a.pyc backend/app/frontend/index.html frontend/node_modules/x/i.js; do
  [ -e "$f" ] || { echo "FAIL: removed a file that must stay: $f"; fail=1; }
done
for f in backend/app/old_removed.py frontend/src/stale.tsx compose.override.yml compose.dev.yml .env.dev.example \
  backend/tests frontend/tests packages .github docs docs/Barangay-softcopies README.md LICENSE \
  scripts/dev-db.ps1 scripts/test-backup-restore.ps1 backend/app/sample_data_cli.py backend/scripts/test.sh; do
  [ ! -e "$f" ] || { echo "FAIL: not removed: $f"; fail=1; }
done
# Every file of the new release is still there.
(cd "$tmp/new" && find . -type f | sort) > "$tmp/want"
find . -type f | sort > "$tmp/have"
missing=$(comm -23 "$tmp/want" "$tmp/have" | grep -v prune-release || true)
[ -z "$missing" ] || { echo "FAIL: release files missing:"; echo "$missing"; fail=1; }
# A bad source folder must be refused and nothing removed.
n=$(find . -type f | wc -l)
pwsh -NoProfile -File "$root/scripts/prune-release.ps1" -Source /tmp -Root "$tmp/old" >/dev/null 2>&1 && { echo "FAIL: a bad source was accepted"; fail=1; }
[ "$(find . -type f | wc -l)" = "$n" ] || { echo "FAIL: files removed with a bad source"; fail=1; }
[ $fail = 0 ] && echo "prune-release OK." || exit 1
