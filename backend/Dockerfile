# Build context: repo root (Railway default when no Root Directory is set).
# Therefore every COPY path is prefixed with `backend/`.
# In Railway Settings, set:
#   Dockerfile Path = /backend/Dockerfile
#   Watch Paths     = /backend/**
# (leave Root Directory unset)

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

# --- Core system deps ---
RUN set -eux; \
    apt-get update -o Acquire::Retries=3; \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libjpeg-dev \
        zlib1g-dev \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-eng \
        curl \
        ca-certificates; \
    rm -rf /var/lib/apt/lists/*

# --- Optional OCR language packs (non-blocking) ---
RUN set -eux; \
    apt-get update -o Acquire::Retries=3 && \
    apt-get install -y --no-install-recommends \
        tesseract-ocr-fra \
        tesseract-ocr-spa \
        tesseract-ocr-deu \
        tesseract-ocr-ita \
        tesseract-ocr-por \
    || echo "WARN: some OCR language packs failed to install; continuing with English only"; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Python deps (cacheable layer) ---
COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# --- App source ---
COPY backend/alembic.ini ./alembic.ini
COPY backend/alembic ./alembic
COPY backend/app ./app

EXPOSE 8000

# Startup: run migrations, then launch Uvicorn. Honors $PORT (Railway/Render
# inject it) and $WEB_CONCURRENCY (optional override for worker count).
CMD sh -c 'alembic upgrade head && exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    --proxy-headers \
    --forwarded-allow-ips="*"'
