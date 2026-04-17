FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

# --- Core system deps (required for app build + runtime) ---
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

# Python deps first (cacheable layer)
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# App source
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000

# Startup: run migrations, then start Uvicorn. Honors $PORT (Railway/Render
# inject it) and $WEB_CONCURRENCY (optional override for worker count).
CMD sh -c 'alembic upgrade head && exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    --proxy-headers \
    --forwarded-allow-ips="*"'
