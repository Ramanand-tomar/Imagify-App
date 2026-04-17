# Build context: the `backend/` directory.
# On Render: render.yaml sets `rootDir: backend`, so the context is already backend/.
# On Railway: set Root Directory = backend (and Dockerfile Path = Dockerfile).

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
COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# --- App source ---
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000

# Single-container mode: run Celery worker + beat in the background, then
# migrations, then Uvicorn in the foreground. $PORT is injected by Railway;
# we fall back to 8000 locally. Shared /tmp/imagify means API <-> worker
# file hand-off works without any external storage refactor.
CMD sh -c '\
    celery -A app.core.celery_app.celery_app worker \
        --beat \
        --loglevel=info \
        --concurrency=${CELERY_CONCURRENCY:-2} & \
    alembic upgrade head && \
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port "${PORT:-8000}" \
        --workers "${WEB_CONCURRENCY:-2}" \
        --proxy-headers \
        --forwarded-allow-ips="*"\
'
