#! /usr/bin/env bash

set -e
set -x

cd backend
FASTAPI_ENV=development ENABLE_DEV_ROUTES=true uv run python -c "import app.main; import json; print(json.dumps(app.main.app.openapi()))" > ../openapi.json
cd ..
mv openapi.json frontend/
bun run --filter frontend generate-client
bun run lint
