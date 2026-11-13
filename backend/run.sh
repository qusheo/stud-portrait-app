#!/usr/bin/env bash
cd "$(dirname "$0")/src" || exit 1
exec ../.venv/Scripts/python.exe -m uvicorn studportrait.asgi:application \
    --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WORKERS:-1}" \
    --timeout-graceful-shutdown 5
