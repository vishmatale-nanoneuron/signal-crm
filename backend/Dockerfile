# ─────────────────────────────────────────────
# Stage 1: Builder — install all dependencies
# ─────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# System deps needed only at build time
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python packages into a target dir (keeps runtime image clean)
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# ─────────────────────────────────────────────
# Stage 2: Runtime — minimal, secure image
# ─────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Runtime-only system lib (libpq for asyncpg)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# ── Security: run as non-root user (like Google, OpenAI do) ──
RUN groupadd -r appgroup && useradd -r -g appgroup -s /sbin/nologin appuser && \
    chown -R appuser:appgroup /app
USER appuser

# Expose port (Railway injects $PORT at runtime)
EXPOSE 8000

# ── Health check (Docker-native, not just Railway) ──
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# ── Start: Gunicorn + Uvicorn workers (production-grade, like FastAPI docs recommend) ──
CMD ["sh", "-c", \
  "exec gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers ${WEB_CONCURRENCY:-2} \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout 120 \
    --keep-alive 5 \
    --log-level info \
    --access-logfile - \
    --error-logfile - \
    --forwarded-allow-ips='*'"]
