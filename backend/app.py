import os
import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from config import Config
from db import db, User, OneTimeCode, ConfigItem
import telebot
from werkzeug.middleware.proxy_fix import ProxyFix
from sqlalchemy import text

# Determine project root
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='/')
app.config.from_object(Config)

# Configure for Nginx proxy
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# More permissive CORS
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
db.init_app(app)

# Serve frontend files
@app.route('/')
def serve_frontend():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)

# Configure session 
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(16))
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Disable secure cookie for local development
app.config['SESSION_COOKIE_SECURE'] = False

# Telegram Bot Setup
BOT_TOKEN = os.environ.get('BOT_TOKEN')
bot = telebot.TeleBot(BOT_TOKEN)

TARIFFS_PATH = os.path.join(PROJECT_ROOT, 'frontend', 'tariffs.json')

def load_tariffs():
    try:
        import json
        with open(TARIFFS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f).get('tariffs', [])
    except Exception:
        return []

def ensure_first_admin_code():
    """Ensure a one-time admin code exists. Print it once on startup."""
    existing_admin_code = OneTimeCode.query.filter_by(is_admin=True, used_at=None).first()
    if existing_admin_code:
        print(f"FIRST TIME ADMIN CODE: {existing_admin_code.code}")
        return

    # Create a new one-time admin code
    code = secrets.token_urlsafe(8)
    new_code = OneTimeCode(code=code, is_admin=True)
    db.session.add(new_code)
    db.session.commit()
    print(f"FIRST TIME ADMIN CODE: {code}")

def ensure_schema():
    """Lightweight migration to add missing columns/tables for sqlite."""
    # ensure users.tariff_id exists
    try:
        res = db.session.execute(text("PRAGMA table_info(users)"))
        cols = {row[1] for row in res}
        if 'tariff_id' not in cols:
            db.session.execute(text("ALTER TABLE users ADD COLUMN tariff_id INTEGER"))
            db.session.commit()
    except Exception:
        db.session.rollback()

@app.route('/auth', methods=['POST'])
def authenticate():
    data = request.json
    code = data.get('code')
    telegram_data = data.get('telegram_user')

    # Debug logs
    print("/auth called")
    print("code:", code)
    print("telegram_data:", telegram_data)

    if not telegram_data or not telegram_data.get('id'):
        return jsonify({'success': False, 'message': 'Нет данных Telegram'}), 400

    # If user already exists, auto-login without code
    existing_user = User.query.filter_by(telegram_id=telegram_data['id']).first()
    if existing_user:
        session['user_id'] = existing_user.id
        return jsonify({
            'success': True,
            'is_admin': existing_user.is_admin,
            'user': existing_user.to_dict(),
            'auto': True
        })
    
    # Validate one-time code
    one_time_code = OneTimeCode.query.filter_by(code=code).first()
    
    if not one_time_code:
        return jsonify({'success': False, 'message': 'Неверный код'})
    
    # Check if code is already used
    if one_time_code.used_at:
        return jsonify({'success': False, 'message': 'Код уже использован'})
    
    # Check code expiration (24 hours)
    if one_time_code.created_at < datetime.utcnow() - timedelta(hours=24):
        return jsonify({'success': False, 'message': 'Код просрочен'})
    
    # Create user
    new_user = User(
        telegram_id=telegram_data['id'],
        username=telegram_data.get('username'),
        first_name=telegram_data.get('first_name'),
        last_name=telegram_data.get('last_name'),
        is_admin=one_time_code.is_admin
    )
    db.session.add(new_user)
    db.session.commit()
    user_id = new_user.id
    
    # Mark code as used
    one_time_code.used_at = datetime.utcnow()
    db.session.commit()
    
    # Create session
    session['user_id'] = user_id
    
    user = User.query.get(user_id)
    return jsonify({
        'success': True,
        'is_admin': one_time_code.is_admin,
        'user': user.to_dict() if user else None
    })

@app.route('/generate_code', methods=['POST'])
def generate_code():
    # Only allow admin to generate codes
    user_id = session.get('user_id')
    user = User.query.get(user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.json or {}
    role = data.get('role')
    is_admin = True if role == 'admin' else False

    # Generate a unique one-time code
    while True:
        code = secrets.token_urlsafe(6)  # Generate a URL-safe code
        existing_code = OneTimeCode.query.filter_by(code=code).first()
        if not existing_code:
            break
    
    # Create new one-time code
    new_code = OneTimeCode(code=code, is_admin=is_admin)
    db.session.add(new_code)
    db.session.commit()
    
    return jsonify({'code': code, 'role': 'admin' if is_admin else 'user'})

@app.route('/api/tariffs', methods=['GET'])
def api_tariffs():
    return jsonify({'tariffs': load_tariffs()})

def admin_required():
    user_id = session.get('user_id')
    user = User.query.get(user_id) if user_id else None
    if not user or not user.is_admin:
        return None
    return user

@app.route('/api/admin/users', methods=['GET'])
def admin_users():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    tariffs = {t['id']: t for t in load_tariffs()}
    users = []
    for u in User.query.all():
        t = tariffs.get(u.tariff_id)
        users.append({
            **u.to_dict(),
            'role': 'admin' if u.is_admin else 'user',
            'tariff_name': t['name'] if t else None
        })
    return jsonify(users)

@app.route('/api/admin/user/set_tariff', methods=['POST'])
def admin_set_tariff():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    target_id = data.get('target_user_id')
    tariff_id = data.get('tariff_id')
    try:
        target_id = int(target_id)
    except Exception:
        return jsonify({'error': 'Bad user id'}), 400
    user = User.query.get(target_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user.tariff_id = tariff_id
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/api/admin/user/set_balance', methods=['POST'])
def admin_set_balance():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    target_id = data.get('target_user_id')
    balance = data.get('balance')
    try:
        target_id = int(target_id)
    except Exception:
        return jsonify({'error': 'Bad user id'}), 400
    user = User.query.get(target_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    try:
        user.balance = float(balance)
    except Exception:
        return jsonify({'error': 'Bad balance'}), 400
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/api/admin/user/delete', methods=['POST'])
def admin_delete_user():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    target_id = data.get('target_user_id')
    try:
        target_id = int(target_id)
    except Exception:
        return jsonify({'error': 'Bad user id'}), 400
    user = User.query.get(target_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    ConfigItem.query.filter_by(user_id=user.id).delete()
    db.session.delete(user)
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/api/admin/configs/list', methods=['POST'])
def admin_configs_list():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    target_id = data.get('target_user_id')
    try:
        target_id = int(target_id)
    except Exception:
        return jsonify({'error': 'Bad user id'}), 400
    return jsonify([c.to_dict() for c in ConfigItem.query.filter_by(user_id=target_id).all()])

@app.route('/api/admin/configs/add', methods=['POST'])
def admin_configs_add():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    target_id = data.get('target_user_id')
    try:
        target_id = int(target_id)
    except Exception:
        return jsonify({'error': 'Bad user id'}), 400
    title = data.get('title') or 'Config'
    protocol = data.get('protocol')
    name = data.get('name')
    config_text = data.get('config_text') or ''
    item = ConfigItem(user_id=target_id, title=title, protocol=protocol, name=name, config_text=config_text)
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict())

@app.route('/api/admin/configs/delete', methods=['POST'])
def admin_configs_delete():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    config_id = data.get('config_id')
    try:
        config_id = int(config_id)
    except Exception:
        return jsonify({'error': 'Bad config id'}), 400
    item = ConfigItem.query.get(config_id)
    if not item:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/user', methods=['GET'])
def get_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify(user.to_dict())

@app.route('/admin', methods=['GET'])
def admin_panel():
    user_id = session.get('user_id')
    user = User.query.get(user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify({'message': 'Welcome to admin panel'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        ensure_first_admin_code()
    app.run(host='0.0.0.0', port=5000, debug=True)