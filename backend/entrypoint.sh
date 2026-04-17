#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

# Honor Railway/Render $PORT; default to 8000 for local docker-compose.
PORT="${PORT:-8000}"

# Worker count: 2 per vCPU is a reasonable starting point for a mixed
# I/O + light CPU API. Overridable via WEB_CONCURRENCY.
WORKERS="${WEB_CONCURRENCY:-2}"

echo "Starting Uvicorn on 0.0.0.0:${PORT} with ${WORKERS} worker(s)..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers "${WORKERS}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
