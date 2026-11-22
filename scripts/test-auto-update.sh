#!/usr/bin/env bash
# Tests scripts/auto-update.ps1 end to end without Windows or GitHub (needs pwsh, python3):
# a fake GitHub (local web server), a fake "docker" that keeps the state of the program
# image and the database revision in files, and a fake "robocopy". Covers: a good update,
# a new version that does not start (put back when the database is unchanged, left alone
# when the database changed), already installed, a version that failed before, and
# -CheckOnly. Run from anywhere inside the clone:  bash scripts/test-auto-update.sh
# Exit code 0 = good, 1 = problem. Takes about a minute.
set -eu
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
server_pid=""
cleanup() { [ -n "$server_pid" ] && kill "$server_pid" 2>/dev/null || true; rm -rf "$tmp"; }
trap cleanup EXIT
fail=0
check() { if [ "$2" = ok ]; then echo "ok    $1"; else echo "FAIL  $1"; fail=1; fi; }

OLD=1111111111111111111111111111111111111111
NEW=2222222222222222222222222222222222222222
REPO="Owner/Repo"

# ---- the fake GitHub: the approved commit, the comparison and the archive
mkdir -p "$tmp/base/scripts"
cp "$root"/scripts/*.ps1 "$tmp/base/scripts/"
echo 'exit 0' > "$tmp/base/scripts/scheduled-backup.ps1"   # no real backup here
echo 'services: {}' > "$tmp/base/compose.yml"
python3 - "$tmp" "$NEW" <<'PY'
import sys, zipfile, os
tmp, new = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(os.path.join(tmp, "release.zip"), "w") as z:
    for dirpath, _, files in os.walk(os.path.join(tmp, "base")):
        for f in files:
            full = os.path.join(dirpath, f)
            z.write(full, "repo-" + new + "/" + os.path.relpath(full, os.path.join(tmp, "base")))
    z.writestr("repo-" + new + "/NEW-VERSION.txt", "new")
PY
cat > "$tmp/server.py" <<'PY'
import http.server, json, sys
tmp, old, new, repo = sys.argv[1:5]
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        p = self.path
        if p == f"/repos/{repo}/commits/Production": body, kind = json.dumps({"sha": new}).encode(), "application/json"
        elif p.startswith(f"/repos/{repo}/compare/"): body, kind = json.dumps({"status": "ahead"}).encode(), "application/json"
        elif p == f"/{repo}/archive/{new}.zip": body, kind = open(f"{tmp}/release.zip", "rb").read(), "application/zip"
        else: self.send_response(404); self.end_headers(); return
        self.send_response(200); self.send_header("Content-Type", kind); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
s = http.server.HTTPServer(("127.0.0.1", 0), H)
open(f"{tmp}/port", "w").write(str(s.server_address[1]))
s.serve_forever()
PY
python3 "$tmp/server.py" "$tmp" "$OLD" "$NEW" "$REPO" &
server_pid=$!
for _ in $(seq 1 50); do [ -s "$tmp/port" ] && break; sleep 0.1; done
base="http://127.0.0.1:$(cat "$tmp/port")"

# ---- the fake docker and robocopy
mkdir "$tmp/bin"
cat > "$tmp/bin/docker" <<'FAKE'
#!/bin/sh
S="$FAKE_STATE"
echo "docker $*" >> "$S/calls.log"
latest=$(cat "$S/latest")
if [ "$1" = tag ]; then
  if [ "$3" = backend:latest ]; then echo "$2" > "$S/latest"; else echo "$latest" > "$S/previous"; fi
  exit 0
fi
case "$*" in
  "info") exit 0 ;;
  "compose -f compose.yml ps -q backend") echo cid ;;
  "inspect --format {{.State.Health.Status}} cid") if [ "$latest" = bad ]; then echo unhealthy; else echo healthy; fi ;;
  "image inspect backend:latest --format {{.Id}}") echo "$latest" ;;
  "image inspect backend:latest") exit 0 ;;
  "image inspect backend:previous") [ -f "$S/previous" ] || exit 1 ;;
  "compose -f compose.yml build backend")
    if [ -n "${FAKE_NEWBAD:-}" ]; then echo bad > "$S/latest"; else echo new > "$S/latest"; fi
    [ -n "${FAKE_DBCHANGE:-}" ] && echo rev2 > "$S/rev" ;;
  "compose -f compose.yml exec -T db psql"*) cat "$S/rev" ;;
  "compose -f compose.yml logs backend --tail 500")
    if [ "$latest" = bad ]; then echo "[migrate] STOP failed"; else echo "[migrate] up to date"; fi ;;
esac
exit 0
FAKE
cat > "$tmp/bin/robocopy" <<'FAKE'
#!/bin/sh
cp -a "$1"/. "$2"/
exit 1
FAKE
chmod +x "$tmp/bin/docker" "$tmp/bin/robocopy"
export PATH="$tmp/bin:$PATH" MAYONDON_WAIT_FACTOR=0.02

# ---- one run of auto-update.ps1 on a fresh "installed copy"
# usage: run <installed commit or none> [extra environment as NAME=value ...] -- [script arguments]
run() {
  inst=$1; shift
  rm -rf "$tmp/app" "$tmp/state"; mkdir -p "$tmp/app" "$tmp/state"
  cp -a "$tmp/base/." "$tmp/app/"; echo 'x=1' > "$tmp/app/.env"
  [ "$inst" = none ] || echo "$inst" > "$tmp/app/.installed-commit"
  # FAILED_SHA: a version an earlier run recorded as failed here
  if [ -n "${FAILED_SHA:-}" ]; then
    mkdir -p "$tmp/app/backups"; printf '{"result":"rolled_back","failed_sha":"%s"}' "$FAILED_SHA" > "$tmp/app/backups/last-autoupdate.json"
  fi
  # INFO_SHA: the commit written into frontend/build-info.json by the release archive
  if [ -n "${INFO_SHA:-}" ]; then
    mkdir -p "$tmp/app/frontend"; printf '{"commit":"x","full":"%s"}' "$INFO_SHA" > "$tmp/app/frontend/build-info.json"
  fi
  echo old > "$tmp/state/latest"; echo rev1 > "$tmp/state/rev"
  envs=()
  while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift
  (cd "$tmp/app" && env FAKE_STATE="$tmp/state" "${envs[@]}" timeout 120 \
    pwsh -NoProfile -File scripts/auto-update.ps1 -Repo "$REPO" -ApiBase "$base" -ArchiveBase "$base" "$@" \
    > "$tmp/out.txt" 2>&1) && code=0 || code=$?
}
result() { python3 -c "import json,sys; print(json.load(open('$tmp/app/backups/last-autoupdate.json'))['result'])" 2>/dev/null || echo none; }
state() { cat "$tmp/state/$1" 2>/dev/null || echo none; }

echo "-- a good update"
run $OLD A=1 --
[ "$(result)" = updated ] && a=ok || a=bad; check "result is updated" $a
[ "$code" = 0 ] && a=ok || a=bad; check "exit code 0" $a
[ "$(cat "$tmp/app/.installed-commit")" = "$NEW" ] && a=ok || a=bad; check "the new commit is recorded as installed" $a
[ -f "$tmp/app/NEW-VERSION.txt" ] && a=ok || a=bad; check "the new files were copied" $a
[ "$(state latest)" = new ] && a=ok || a=bad; check "the new program image is the running one" $a

echo "-- the new version does not start, the database is unchanged"
run $OLD FAKE_NEWBAD=1 --
[ "$(result)" = rolled_back ] && a=ok || a=bad; check "result is rolled_back" $a
[ "$code" = 1 ] && a=ok || a=bad; check "exit code 1" $a
[ "$(state latest)" = old ] && a=ok || a=bad; check "the previous program image was put back" $a
[ "$(cat "$tmp/app/.installed-commit")" = "$OLD" ] && a=ok || a=bad; check "the installed commit is still the old one" $a
grep -q '"failed_sha": *"'$NEW'"' "$tmp/app/backups/last-autoupdate.json" && a=ok || a=bad; check "the failed version is remembered" $a

echo "-- the new version does not start, the database was changed"
run $OLD FAKE_NEWBAD=1 FAKE_DBCHANGE=1 --
[ "$(result)" = failed ] && a=ok || a=bad; check "result is failed (not rolled back)" $a
[ "$(state latest)" = bad ] && a=ok || a=bad; check "nothing was put back over a changed database" $a

echo "-- already installed"
run $NEW A=1 --
[ "$(result)" = up_to_date ] && a=ok || a=bad; check "result is up_to_date" $a
grep -q "compose -f compose.yml build" "$tmp/state/calls.log" && a=bad || a=ok; check "nothing was built" $a

echo "-- no .installed-commit, but the release archive's own commit is the approved one"
INFO_SHA=$NEW run none A=1 --
[ "$(result)" = up_to_date ] && a=ok || a=bad; check "result is up_to_date" $a
grep -q "compose -f compose.yml build" "$tmp/state/calls.log" && a=bad || a=ok; check "nothing was built" $a

echo "-- no .installed-commit and an older commit in build-info.json"
INFO_SHA=$OLD run none A=1 --
[ "$(result)" = updated ] && a=ok || a=bad; check "result is updated" $a

echo "-- no .installed-commit, the failed version's files are in place"
FAILED_SHA=$NEW INFO_SHA=$NEW run none A=1 --
[ "$(result)" = skipped ] && a=ok || a=bad; check "it is skipped, not reported as installed" $a
grep -q "compose -f compose.yml build" "$tmp/state/calls.log" && a=bad || a=ok; check "nothing was built" $a

echo "-- -CheckOnly"
run $OLD A=1 -- -CheckOnly
grep -q "would_update\|Would update" "$tmp/out.txt" && a=ok || a=bad; check "it says what it would do" $a
[ ! -e "$tmp/app/NEW-VERSION.txt" ] && [ "$(cat "$tmp/app/.installed-commit")" = "$OLD" ] && a=ok || a=bad; check "it changed nothing" $a

[ $fail = 0 ] && echo "Auto-update OK." || { echo "Auto-update has problems."; sed -n 1,60p "$tmp/out.txt"; }
exit $fail
