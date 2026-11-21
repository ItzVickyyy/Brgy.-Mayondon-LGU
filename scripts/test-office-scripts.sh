#!/usr/bin/env bash
# Checks the PowerShell scripts without Windows (needs pwsh and git; CI has both):
#   1. every scripts/*.ps1 parses;
#   2. scripts/update.ps1 behaves as decisions 75 and 76 say, run against a fake "docker"
#      and a throw-away Git project: the running program is saved as backend:previous only
#      when healthy, unnamed images are pruned only after a healthy update, and a failed
#      update prints the no-internet way back only when backend:previous exists.
# Run from anywhere inside the clone:  bash scripts/test-office-scripts.sh
# Exit code 0 = good, 1 = problem.
set -eu
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0
check() { if [ "$2" = ok ]; then echo "ok    $1"; else echo "FAIL  $1"; fail=1; fi; }

# --- 1. syntax
bad=$(pwsh -NoProfile -Command '
  foreach ($f in Get-ChildItem -Path "'"$root"'/scripts/*.ps1") {
    $t = $null; $e = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$t, [ref]$e)
    foreach ($x in $e) { "$($f.Name):$($x.Extent.StartLineNumber): $($x.Message)" }
  }')
if [ -z "$bad" ]; then check "all scripts/*.ps1 parse" ok; else echo "$bad"; check "all scripts/*.ps1 parse" bad; fi

# --- 2. update.ps1 against a fake docker
git init -q --bare -b main "$tmp/origin.git"
git clone -q "$tmp/origin.git" "$tmp/proj" 2>/dev/null
cd "$tmp/proj"
git checkout -q -b main 2>/dev/null || true
git config user.email t@example.com; git config user.name test
mkdir scripts
cp "$root/scripts/update.ps1" scripts/
echo 'services: {}' > compose.yml
echo 'exit 0' > scripts/scheduled-backup.ps1
echo '.env' > .gitignore
echo 'x=1' > .env
git add -A; git commit -qm one; git push -q -u origin main
first=$(git rev-parse HEAD)
git clone -q "$tmp/origin.git" "$tmp/other" 2>/dev/null
(cd "$tmp/other" && git config user.email t@example.com && git config user.name test \
  && echo 2 > f.txt && git add f.txt && git commit -qm two && git push -q origin main)

mkdir "$tmp/bin"
cat > "$tmp/bin/docker" <<'FAKE'
#!/bin/sh
echo "docker $*" >> "$FAKE_LOG"
case "$*" in
  "info") exit 0 ;;
  "compose -f compose.yml ps -q backend") echo cid123 ;;
  "inspect --format {{.State.Health.Status}} cid123") echo "${FAKE_HEALTH:-healthy}" ;;
  "image inspect backend:latest") exit 0 ;;
  "image inspect backend:previous") [ "${FAKE_PREVIOUS:-yes}" = yes ] && exit 0 || exit 1 ;;
  "compose -f compose.yml logs backend --tail 500")
    if [ -n "${FAKE_STOP:-}" ]; then echo "[migrate] STOP the database is newer"; else echo "[migrate] up to date"; fi ;;
esac
exit 0
FAKE
chmod +x "$tmp/bin/docker"
export PATH="$tmp/bin:$PATH" FAKE_LOG="$tmp/calls.log"

run_update() { # env settings are passed by the caller
  git -C "$tmp/proj" reset -q --hard "$first"
  : > "$FAKE_LOG"
  (cd "$tmp/proj" && timeout 60 pwsh -NoProfile -File scripts/update.ps1 > "$tmp/out.txt" 2>&1) || true
}

# a healthy program is updated: previous saved, old images pruned, success reported
FAKE_HEALTH=healthy run_update
grep -q "docker tag backend:latest backend:previous" "$FAKE_LOG" && a=ok || a=bad; check "healthy program is saved as backend:previous" $a
grep -q "docker image prune -f" "$FAKE_LOG" && a=ok || a=bad; check "unnamed images are pruned after a healthy update" $a
grep -q "UPDATE DONE" "$tmp/out.txt" && a=ok || a=bad; check "a healthy update reports success" $a

# the running program is not healthy: backend:previous must not be overwritten
FAKE_HEALTH=unhealthy FAKE_STOP=1 run_update
grep -q "backend:previous" "$FAKE_LOG" && a=bad || a=ok; check "an unhealthy program is not saved as backend:previous" $a

# the update fails and backend:previous exists: no prune, quick way back printed
FAKE_HEALTH=healthy FAKE_STOP=1 run_update
grep -q "docker image prune" "$FAKE_LOG" && a=bad || a=ok; check "no pruning after a failed update" $a
grep -q "docker tag backend:previous backend:latest" "$tmp/out.txt" && a=ok || a=bad; check "failed update prints the no-internet way back" $a
grep -q "up -d --no-build --force-recreate backend" "$tmp/out.txt" && a=ok || a=bad; check "failed update prints the restart command" $a

# the update fails and there is no backend:previous: the rebuild instruction is printed
FAKE_HEALTH=healthy FAKE_STOP=1 FAKE_PREVIOUS=no run_update
grep -q "build backend    (needs internet" "$tmp/out.txt" && a=ok || a=bad; check "without backend:previous the rebuild is printed" $a

[ $fail = 0 ] && echo "Office scripts OK." || echo "Office scripts have problems."
exit $fail
