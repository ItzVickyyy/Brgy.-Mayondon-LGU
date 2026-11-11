#!/usr/bin/env bash
# Container entrypoint: bring the database up to date, then run the command that
# was asked for (the app, or whatever "docker compose run" passed). If the
# migration step fails, the container stops and the reason is in
# "docker compose logs backend". See app/migrate_on_start.py.
set -e

python -m app.migrate_on_start

exec "$@"
