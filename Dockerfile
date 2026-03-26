FROM python:3.11-slim

# System deps for Pillow / qrcode
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (better layer caching)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Data directory for persistent files (DB + logs)
# The actual files live on the host via Docker volume mount
RUN mkdir -p /data

WORKDIR /app/backend

EXPOSE 5000

# Single worker — required for SQLite (no concurrent writes)
# Increase --timeout if bot polling delays requests
CMD ["gunicorn", \
     "--workers", "1", \
     "--bind", "0.0.0.0:5000", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "wsgi:app"]
