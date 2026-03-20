import os

from flask import Flask, send_from_directory
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from config import Config
from db import db
from extensions import limiter

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')


def create_app():
    app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='/')
    app.config.from_object(Config)

    # Trust X-Forwarded-* headers from Nginx
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

    # CORS: frontend is served by Flask (same origin), so CORS is only needed
    # when ALLOWED_ORIGIN is explicitly configured (e.g. for dev or external tools)
    allowed_origin = app.config.get('ALLOWED_ORIGIN')
    if allowed_origin:
        CORS(app, resources={r"/api/*": {"origins": allowed_origin}}, supports_credentials=True)

    db.init_app(app)
    limiter.init_app(app)

    # Register blueprints
    from blueprints.auth import auth_bp
    from blueprints.user import user_bp
    from blueprints.admin import admin_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(admin_bp)

    # Register Telegram bot callback handlers
    from bot_handlers import register_handlers
    register_handlers(app)

    # Serve frontend static files
    @app.route('/')
    def serve_frontend():
        return send_from_directory(FRONTEND_DIR, 'index.html')

    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory(FRONTEND_DIR, path)

    return app
