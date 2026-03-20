import os


class Config:
    _secret = os.environ.get('SECRET_KEY')
    if not _secret:
        raise RuntimeError(
            "SECRET_KEY environment variable must be set. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    SECRET_KEY = _secret

    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///users.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 24 * 365 * 10

    WEBAPP_URL = os.environ.get('WEBAPP_URL')
    BOT_USERNAME = os.environ.get('BOT_USERNAME')
    WEBAPP_SHORT_NAME = os.environ.get('WEBAPP_SHORT_NAME')

    # Security
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    # Set SESSION_COOKIE_SECURE=false in .env only for local HTTP development
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'true').lower() != 'false'
    SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10

    # CORS: set ALLOWED_ORIGIN in .env for cross-origin access (dev/external)
    ALLOWED_ORIGIN = os.environ.get('ALLOWED_ORIGIN', '')
