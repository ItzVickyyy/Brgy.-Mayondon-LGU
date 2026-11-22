#!/usr/bin/env bash
# Checks the PowerShell scripts without Windows (needs pwsh and git; CI has both):
#   1. every scripts/*.ps1 parses;
#   2. scripts/update.ps1 behaves as decisions 75 and 76 say, run against a fake "docker"
#      and a throw-away Git project: the running program is saved as backend:previous only
#      when healthy, unnamed images are pruned only after a healthy update, and a failed
#      update prints the no-internet way back only when backend:previous exists.
#   3. scripts/ensure-data-key.ps1 (patch 213): adds the key once, keeps CRLF, never changes an
#      existing key and never prints it.
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

# --- 3. ensure-data-key.ps1 (patch 213)
ek="$tmp/ek"; mkdir "$ek"
printf 'A=1\r\n# DATA_ENCRYPTION_KEY=\r\nZ=2\r\n' > "$ek/.env"
out=$(pwsh -NoProfile -File "$root/scripts/ensure-data-key.ps1" -EnvFile "$ek/.env" 2>&1) || true
key=$(grep '^DATA_ENCRYPTION_KEY=' "$ek/.env" | tr -d '\r' | cut -d= -f2)
[ ${#key} -ge 32 ] && a=ok || a=bad; check "ensure-data-key adds a key of at least 32 characters" $a
grep -q 'Z=2' "$ek/.env" && [ "$(grep -c DATA_ENCRYPTION_KEY "$ek/.env")" = 1 ] && a=ok || a=bad; check "ensure-data-key replaces the commented line and keeps the rest" $a
grep -q $'^A=1\r$' "$ek/.env" && a=ok || a=bad; check "ensure-data-key keeps Windows line ends" $a
echo "$out" | grep -q "$key" && a=bad || a=ok; check "ensure-data-key never prints the key" $a
pwsh -NoProfile -File "$root/scripts/ensure-data-key.ps1" -EnvFile "$ek/.env" >/dev/null 2>&1 || true
[ "$(grep '^DATA_ENCRYPTION_KEY=' "$ek/.env" | tr -d '\r' | cut -d= -f2)" = "$key" ] && a=ok || a=bad; check "ensure-data-key leaves an existing key alone" $a
pwsh -NoProfile -File "$root/scripts/ensure-data-key.ps1" -EnvFile "$ek/missing" >/dev/null 2>&1 && a=bad || a=ok; check "ensure-data-key stops without a .env" $a

# --- 4. enable-https.ps1 (patch 220)
eh="$tmp/eh"; mkdir "$eh"
printf 'A=1\r\nCOMPOSE_FILE=compose.yml\r\n# APP_BIND=0.0.0.0\r\nSECRET_KEY=keepme\r\n' > "$eh/.env"
pwsh -NoProfile -File "$root/scripts/enable-https.ps1" -EnvFile "$eh/.env" -EnvOnly -HttpsHost 192.168.1.10 >/dev/null 2>&1 || true
grep -q $'^COMPOSE_PROFILES=https\r$' "$eh/.env" && grep -q $'^HTTPS_HOST=192.168.1.10\r$' "$eh/.env" && a=ok || a=bad; check "enable-https sets the profile and the address, keeping Windows line ends" $a
grep -q $'^APP_BIND=127.0.0.1\r$' "$eh/.env" && grep -q $'^FORWARDED_ALLOW_IPS=\*\r$' "$eh/.env" && a=ok || a=bad; check "enable-https binds plain HTTP to this computer and trusts the proxy" $a
[ "$(grep -c '^APP_BIND' "$eh/.env")" = 1 ] && grep -q 'SECRET_KEY=keepme' "$eh/.env" && grep -q '^A=1' "$eh/.env" && a=ok || a=bad; check "enable-https replaces the commented line and leaves everything else" $a
[ "$(ls "$eh"/.env.before-https-* 2>/dev/null | wc -l)" = 1 ] && a=ok || a=bad; check "enable-https saves the old .env first" $a
pwsh -NoProfile -File "$root/scripts/enable-https.ps1" -EnvFile "$eh/.env" -EnvOnly -HttpsHost 192.168.1.10 >/dev/null 2>&1 || true
[ "$(ls "$eh"/.env.before-https-* | wc -l)" = 1 ] && a=ok || a=bad; check "enable-https run again changes nothing and saves no second copy" $a
pwsh -NoProfile -File "$root/scripts/enable-https.ps1" -EnvFile "$eh/.env" -EnvOnly -HttpsHost 'bad host;x' >/dev/null 2>&1 && a=bad || a=ok; check "enable-https refuses an address with odd characters" $a
pwsh -NoProfile -File "$root/scripts/enable-https.ps1" -EnvFile "$eh/.env" -EnvOnly -Off >/dev/null 2>&1 || true
grep -q $'^APP_BIND=0.0.0.0\r$' "$eh/.env" && grep -q $'^COMPOSE_PROFILES=\r$' "$eh/.env" && grep -q 'SECRET_KEY=keepme' "$eh/.env" && a=ok || a=bad; check "enable-https -Off goes back to plain HTTP" $a
pwsh -NoProfile -File "$root/scripts/enable-https.ps1" -EnvFile "$eh/missing" -EnvOnly >/dev/null 2>&1 && a=bad || a=ok; check "enable-https stops without a .env" $a

[ $fail = 0 ] && echo "Office scripts OK." || echo "Office scripts have problems."
exit $fail
