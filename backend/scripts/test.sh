#!/usr/bin/env bash

set -e
set -x

FASTAPI_ENV=development ENABLE_DEV_ROUTES=true coverage run -m pytest tests/
coverage report
coverage html --title "${@-coverage}"
