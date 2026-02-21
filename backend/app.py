import os
import secrets
import calendar
import threading
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from config import Config
from db import db, User, OneTimeCode, ConfigItem
import telebot
import io
import base64
import qrcode
from PIL import Image
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
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_MAX_AGE'] = 60 * 60 * 24 * 365 * 10

# Disable secure cookie for local development (already set above)

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

def get_auth_user():
    telegram_id = request.headers.get('X-Telegram-Id')
    try:
        telegram_id = int(telegram_id) if telegram_id else None
    except Exception:
        telegram_id = None
    if not telegram_id:
        return None
    return User.query.filter_by(telegram_id=telegram_id).first()

def add_months(dt: datetime, months: int) -> datetime:
    if not dt:
        return dt
    m = dt.month - 1 + months
    y = dt.year + m // 12
    m = m % 12 + 1
    d = min(dt.day, calendar.monthrange(y, m)[1])
    return dt.replace(year=y, month=m, day=d)

def send_bot_message(chat_id, text):
    if not BOT_TOKEN:
        return
    try:
        bot.send_message(chat_id, text)
    except Exception as e:
        print("bot send error", e)

def run_billing_cycle():
    tariffs = {t['id']: t for t in load_tariffs()}
    now = datetime.utcnow()
    admins = User.query.filter_by(is_admin=True).all()

    for user in User.query.filter(User.tariff_id.isnot(None)).all():
        tariff = tariffs.get(user.tariff_id)
        if not tariff:
            continue

        price = float(tariff.get('price_rub') or 0)
        months = int(tariff.get('period_months') or 1)

        if not user.tariff_next_charge_at:
            user.tariff_next_charge_at = now
        if not user.tariff_paid_until:
            user.tariff_paid_until = user.tariff_next_charge_at

        # warn user 14 days before charge if not enough balance
        warn_at = user.tariff_next_charge_at - timedelta(days=14)
        if now >= warn_at and user.balance < price:
            if not user.last_low_balance_warn_at or user.last_low_balance_warn_at < warn_at:
                send_bot_message(user.telegram_id, (
                    f"Напоминание: до оплаты тарифа осталось 14 дней. "
                    f"Для продления тарифа «{tariff.get('name')}» нужно {price:.2f} ₽."
                ))
                user.last_low_balance_warn_at = now

        # charge if due
        if now >= user.tariff_next_charge_at:
            if user.balance >= price:
                user.balance -= price
                user.tariff_paid_until = add_months(user.tariff_next_charge_at, months)
                user.tariff_next_charge_at = user.tariff_paid_until
                user.last_overdue_admin_at = None
            else:
                overdue_at = user.tariff_next_charge_at + timedelta(days=14)
                if now >= overdue_at:
                    if not user.last_overdue_admin_at or user.last_overdue_admin_at < overdue_at:
                        for admin in admins:
                            send_bot_message(admin.telegram_id, (
                                f"Пользователь {user.first_name or ''} @{user.username or ''} "
                                f"не оплатил тариф «{tariff.get('name')}». "
                                "Нужно удалить или попросить оплатить."
                            ))
                        user.last_overdue_admin_at = now

    db.session.commit()

def recalc_user_tariff(user: User):
    if not user or not user.tariff_id:
        return
    tariffs = {t['id']: t for t in load_tariffs()}
    t = tariffs.get(user.tariff_id)
    if not t:
        return
    now = datetime.utcnow()
    price = float(t.get('price_rub') or 0)
    months = int(t.get('period_months') or 1)
    if not user.tariff_next_charge_at:
        user.tariff_next_charge_at = now
    if user.balance >= price and (not user.tariff_paid_until or user.tariff_next_charge_at <= now):
        user.balance -= price
        user.tariff_paid_until = add_months(user.tariff_next_charge_at or now, months)
        user.tariff_next_charge_at = user.tariff_paid_until
        user.last_overdue_admin_at = None

def billing_loop():
    while True:
        try:
            with app.app_context():
                run_billing_cycle()
        except Exception as e:
            print("billing loop error", e)
        time.sleep(3600)

billing_thread = None
def start_billing_thread():
    global billing_thread
    if billing_thread:
        return
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        billing_thread = threading.Thread(target=billing_loop, daemon=True)
        billing_thread.start()

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

    # ensure configs.is_used exists
    try:
        res = db.session.execute(text("PRAGMA table_info(configs)"))
        cols = {row[1] for row in res}
        if 'is_used' not in cols:
            db.session.execute(text("ALTER TABLE configs ADD COLUMN is_used BOOLEAN DEFAULT 0"))
            db.session.commit()
    except Exception:
        db.session.rollback()

    # ensure users tariff billing columns exist
    try:
        res = db.session.execute(text("PRAGMA table_info(users)"))
        cols = {row[1] for row in res}
        if 'tariff_paid_until' not in cols:
            db.session.execute(text("ALTER TABLE users ADD COLUMN tariff_paid_until DATETIME"))
        if 'tariff_next_charge_at' not in cols:
            db.session.execute(text("ALTER TABLE users ADD COLUMN tariff_next_charge_at DATETIME"))
        if 'last_low_balance_warn_at' not in cols:
            db.session.execute(text("ALTER TABLE users ADD COLUMN last_low_balance_warn_at DATETIME"))
        if 'last_overdue_admin_at' not in cols:
            db.session.execute(text("ALTER TABLE users ADD COLUMN last_overdue_admin_at DATETIME"))
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
    
    # Check code expiration (1 hour)
    if one_time_code.created_at < datetime.utcnow() - timedelta(hours=1):
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
    
    user = User.query.get(user_id)
    return jsonify({
        'success': True,
        'is_admin': one_time_code.is_admin,
        'user': user.to_dict() if user else None
    })

@app.route('/generate_code', methods=['POST'])
def generate_code():
    # Only allow admin to generate codes
    user = get_auth_user()
    
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
    user = get_auth_user()
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
    tariffs = {t['id']: t for t in load_tariffs()}
    t = tariffs.get(tariff_id)
    now = datetime.utcnow()
    user.tariff_next_charge_at = now
    user.tariff_paid_until = None
    if t:
        price = float(t.get('price_rub') or 0)
        months = int(t.get('period_months') or 1)
        if user.balance >= price:
            user.balance -= price
            user.tariff_paid_until = add_months(now, months)
            user.tariff_next_charge_at = user.tariff_paid_until
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

@app.route('/api/configs', methods=['GET'])
def user_configs():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    configs = ConfigItem.query.filter_by(user_id=user.id).all()
    return jsonify([c.to_dict() for c in configs])

@app.route('/api/configs/mark_used', methods=['POST'])
def user_config_mark_used():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.json or {}
    config_id = data.get('config_id')
    try:
        config_id = int(config_id)
    except Exception:
        return jsonify({'error': 'Bad config id'}), 400
    item = ConfigItem.query.get(config_id)
    if not item or item.user_id != user.id:
        return jsonify({'error': 'Not found'}), 404
    item.is_used = True
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/user', methods=['GET'])
def get_user():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = user.to_dict()
    tariffs = {t['id']: t for t in load_tariffs()}
    t = tariffs.get(user.tariff_id)
    if t:
        data['tariff_name'] = t.get('name')
        data['tariff_price_rub'] = t.get('price_rub')
        data['tariff_period_months'] = t.get('period_months')
    return jsonify(data)

@app.route('/api/qr', methods=['POST'])
def generate_qr():
    data = request.json or {}
    text = data.get('text') or ''
    size = int(data.get('size') or 320)
    if not text:
        return jsonify({'error': 'No text'}), 400
    size = max(120, min(size, 720))

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=0
    )
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img = img.resize((size, size), Image.NEAREST)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    encoded = base64.b64encode(buf.getvalue()).decode('utf-8')
    return jsonify({'url': f"data:image/png;base64,{encoded}"})

@app.route('/admin', methods=['GET'])
def admin_panel():
    user = get_auth_user()
    if not user or not user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify({'message': 'Welcome to admin panel'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        ensure_first_admin_code()
        start_billing_thread()
    app.run(host='0.0.0.0', port=5000, debug=True)