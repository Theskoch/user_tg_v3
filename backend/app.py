import os
import secrets
import calendar
import threading
import time
from datetime import datetime, timedelta, time as dt_time
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from config import Config
from db import db, User, OneTimeCode, ConfigItem, TopUpTicket
import telebot
from telebot import types
import io
import base64
import qrcode
from PIL import Image
from werkzeug.middleware.proxy_fix import ProxyFix
from sqlalchemy import text
import logging

# Auth debug logging
LOG_PATH = os.path.join(os.path.dirname(__file__), 'auth_debug.log')
logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)

def log_auth(event, **fields):
    try:
        safe_fields = {k: v for k, v in fields.items()}
        logging.info("%s | %s", event, safe_fields)
    except Exception:
        pass

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
    telegram_id = str(telegram_id).strip() if telegram_id else None
    log_auth('get_auth_user', header=telegram_id, path=str(request.path))
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
        log_auth('bot_send_skip', reason='no_bot_token', chat_id=chat_id)
        return
    try:
        bot.send_message(chat_id, text)
        log_auth('bot_send_ok', chat_id=chat_id, text_preview=str(text)[:120])
    except Exception as e:
        log_auth('bot_send_error', chat_id=chat_id, error=str(e))

def send_bot_message_with_markup(chat_id, text, markup=None):
    if not BOT_TOKEN:
        log_auth('bot_send_skip', reason='no_bot_token', chat_id=chat_id)
        return
    try:
        bot.send_message(chat_id, text, reply_markup=markup)
        log_auth('bot_send_ok', chat_id=chat_id, text_preview=str(text)[:120])
    except Exception as e:
        log_auth('bot_send_error', chat_id=chat_id, error=str(e))

def build_topup_admin_markup(ticket_id):
    markup = types.InlineKeyboardMarkup(row_width=2)
    markup.add(
        types.InlineKeyboardButton("✅ Подтвердить", callback_data=f"topup:approve:{ticket_id}"),
        types.InlineKeyboardButton("❌ Не подтверждаю", callback_data=f"topup:reject:{ticket_id}")
    )
    return markup

def notify_admins_topup(ticket, user):
    admins = User.query.filter_by(is_admin=True).all()
    if not admins:
        log_auth('topup_notify_admins', reason='no_admins', ticket_id=ticket.id)
        return
    webapp_url = app.config.get('WEBAPP_URL')
    if not webapp_url:
        webapp_url = app.config.get('BASE_URL') if hasattr(app.config, 'BASE_URL') else None
    if not webapp_url:
        try:
            host = os.environ.get('HOSTNAME') or 'localhost:5000'
            webapp_url = f"https://{host}" if not host.startswith('http') else host
        except Exception:
            webapp_url = None
    link = None
    if webapp_url:
        link = f"{webapp_url}/?admin=1&user_id={user.id}&ticket_id={ticket.id}"
    text = (
        f"Пользователь {user.first_name or ''} @{user.username or ''} отправил перевод на сумму "
        f"{ticket.amount:.2f} ₽. Откройте приложение для подтверждения."
    )
    markup = None
    if link:
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("Открыть приложение", url=link))
    for admin in admins:
        send_bot_message_with_markup(admin.telegram_id, text, markup=markup)
    ticket.last_admin_notify_at = datetime.utcnow()
    log_auth('topup_notify_admins', ticket_id=ticket.id, admins=[a.telegram_id for a in admins], link=link)

@bot.callback_query_handler(func=lambda call: call.data and call.data.startswith('topup:'))
def handle_topup_callback(call):
    try:
        parts = call.data.split(':')
        if len(parts) != 3:
            return
        action = parts[1]
        ticket_id = int(parts[2])
        with app.app_context():
            admin = User.query.filter_by(telegram_id=str(call.from_user.id)).first()
            if not admin or not admin.is_admin:
                bot.answer_callback_query(call.id, "Недостаточно прав")
                return

            ticket = TopUpTicket.query.get(ticket_id)
            if not ticket or ticket.status != 'pending':
                bot.answer_callback_query(call.id, "Платёж уже обработан")
                return

            user = User.query.get(ticket.user_id)
            now = datetime.utcnow()

            if action == 'approve':
                apply_topup_action(ticket, admin, approve=True)
                bot.answer_callback_query(call.id, "Подтверждено")

            elif action == 'reject':
                apply_topup_action(ticket, admin, approve=False)
                bot.answer_callback_query(call.id, "Отклонено")
    except Exception as e:
        log_auth('topup_callback_error', error=str(e))

def apply_topup_action(ticket, admin_user, approve: bool):
    user = User.query.get(ticket.user_id)
    now = datetime.utcnow()
    if approve:
        ticket.status = 'approved'
        ticket.updated_at = now
        ticket.approved_at = now
        ticket.approved_by = admin_user.id
        if user:
            user.balance = float(user.balance or 0) + float(ticket.amount)
        db.session.commit()

        if user:
            send_bot_message(user.telegram_id, f"Платёж подтверждён. Баланс пополнен на {ticket.amount:.2f} ₽.")

        admins = User.query.filter_by(is_admin=True).all()
        for a in admins:
            send_bot_message(a.telegram_id, (
                f"Платёж пользователя {user.first_name or ''} @{user.username or ''} "
                f"на сумму {ticket.amount:.2f} ₽ подтверждён админом {admin_user.first_name or ''} @{admin_user.username or ''}."
            ))
    else:
        ticket.status = 'rejected'
        ticket.updated_at = now
        ticket.rejected_at = now
        ticket.rejected_by = admin_user.id
        db.session.commit()

        if user:
            send_bot_message(user.telegram_id, "Платёж отклонён администратором.")

        admins = User.query.filter_by(is_admin=True).all()
        for a in admins:
            send_bot_message(a.telegram_id, (
                f"Платёж пользователя {user.first_name or ''} @{user.username or ''} "
                f"на сумму {ticket.amount:.2f} ₽ отклонён админом {admin_user.first_name or ''} @{admin_user.username or ''}."
            ))

def run_billing_cycle():
    tariffs = {t['id']: t for t in load_tariffs()}
    now = datetime.utcnow()
    now_msk = now + timedelta(hours=3)
    today_msk = now_msk.date()
    is_noon_msk = now_msk.time().hour == 12
    admins = User.query.filter_by(is_admin=True).all()

    def fmt_dt(dt_val):
        return dt_val.strftime('%d.%m.%Y') if dt_val else '—'

    def days_left(target_dt):
        if not target_dt:
            return None
        return (target_dt.date() - today_msk).days

    def send_admins(text):
        for admin in admins:
            send_bot_message(admin.telegram_id, text)

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

        # user reminders: 14 / 7 / 0 days before charge
        if user.balance < price:
            left_days = days_left(user.tariff_next_charge_at)
            if left_days is not None:
                if left_days == 14 and (not user.user_warn_14_at or user.user_warn_14_at.date() != today_msk):
                    send_bot_message(user.telegram_id, (
                        f"Напоминание: до оплаты тарифа осталось {left_days} дней. "
                        f"Дата оплаты: {fmt_dt(user.tariff_next_charge_at)}. "
                        f"Для продления тарифа «{tariff.get('name')}» нужно {price:.2f} ₽."
                    ))
                    user.user_warn_14_at = now
                if left_days == 7 and (not user.user_warn_7_at or user.user_warn_7_at.date() != today_msk):
                    send_bot_message(user.telegram_id, (
                        f"Напоминание: до оплаты тарифа осталось {left_days} дней. "
                        f"Дата оплаты: {fmt_dt(user.tariff_next_charge_at)}. "
                        f"Для продления тарифа «{tariff.get('name')}» нужно {price:.2f} ₽."
                    ))
                    user.user_warn_7_at = now
                if left_days == 0 and (not user.user_warn_0_at or user.user_warn_0_at.date() != today_msk):
                    send_bot_message(user.telegram_id, (
                        f"Сегодня последний день оплаты тарифа. "
                        f"Дата оплаты: {fmt_dt(user.tariff_next_charge_at)}. "
                        f"Для продления тарифа «{tariff.get('name')}» нужно {price:.2f} ₽."
                    ))
                    user.user_warn_0_at = now

        # admin notice on due date
        if user.balance < price and user.tariff_next_charge_at:
            left_days = days_left(user.tariff_next_charge_at)
            if left_days == 0 and (not user.admin_warn_0_at or user.admin_warn_0_at.date() != today_msk):
                send_admins(
                    f"Тариф пользователя {user.first_name or ''} @{user.username or ''} закончился сегодня. "
                    f"Дата оплаты: {fmt_dt(user.tariff_next_charge_at)}."
                )
                user.admin_warn_0_at = now

        # charge if due
        if user.tariff_next_charge_at and now >= user.tariff_next_charge_at:
            if user.balance >= price:
                user.balance -= price
                user.tariff_paid_until = add_months(user.tariff_next_charge_at, months)
                user.tariff_next_charge_at = user.tariff_paid_until
                user.last_overdue_admin_at = None
            else:
                overdue_days = (today_msk - user.tariff_next_charge_at.date()).days

                # user daily reminders after overdue (up to 14 days), at 12:00 MSK
                if overdue_days >= 1 and overdue_days <= 14 and is_noon_msk:
                    if not user.user_overdue_daily_at or user.user_overdue_daily_at.date() != today_msk:
                        block_date = user.tariff_next_charge_at.date() + timedelta(days=14)
                        send_bot_message(user.telegram_id, (
                            f"Тариф просрочен на {overdue_days} дней. "
                            f"Оплатите до {block_date.strftime('%d.%m.%Y')}, иначе доступ будет заблокирован вручную."
                        ))
                        user.user_overdue_daily_at = now

                # admin notices at +7 and +14 days
                if overdue_days == 7 and (not user.admin_warn_7_at or user.admin_warn_7_at.date() != today_msk):
                    send_admins(
                        f"Пользователь {user.first_name or ''} @{user.username or ''} не оплатил тариф уже 7 дней. "
                        f"Дата оплаты: {fmt_dt(user.tariff_next_charge_at)}."
                    )
                    user.admin_warn_7_at = now

                if overdue_days == 14 and (not user.admin_warn_14_at or user.admin_warn_14_at.date() != today_msk):
                    send_admins(
                        f"Пользователь {user.first_name or ''} @{user.username or ''} не оплатил тариф 14 дней. "
                        "Нужно заблокировать вручную."
                    )
                    user.admin_warn_14_at = now

    db.session.commit()

    # topup ticket reminders/auto-reject
    now = datetime.utcnow()
    pending_tickets = TopUpTicket.query.filter_by(status='pending').all()
    for t in pending_tickets:
        user = User.query.get(t.user_id)
        if not user:
            continue
        created_at = t.created_at or now
        age_hours = (now - created_at).total_seconds() / 3600

        if age_hours >= 48:
            # auto reject
            t.status = 'rejected'
            t.updated_at = now
            t.rejected_at = now
            t.rejected_by = None
            send_bot_message(user.telegram_id, "Платёж отклонён (нет подтверждения более 48 часов).")
            admins = User.query.filter_by(is_admin=True).all()
            for admin in admins:
                send_bot_message(admin.telegram_id, (
                    f"Платёж пользователя {user.first_name or ''} @{user.username or ''} "
                    f"на сумму {t.amount:.2f} ₽ отклонён автоматически (48ч)."
                ))
            continue

        if age_hours >= 24:
            # resend admin notify once per 24h
            if not t.last_admin_notify_at or (now - t.last_admin_notify_at).total_seconds() >= 24 * 3600:
                notify_admins_topup(t, user)

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
            log_auth('billing_loop_error', error=str(e))
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
        try:
            print(f"FIRST TIME ADMIN CODE: {existing_admin_code.code}")
        except Exception:
            log_auth('first_admin_code', code=existing_admin_code.code)
        return

    # Create a new one-time admin code
    code = secrets.token_urlsafe(8)
    new_code = OneTimeCode(code=code, is_admin=True)
    db.session.add(new_code)
    db.session.commit()
    try:
        print(f"FIRST TIME ADMIN CODE: {code}")
    except Exception:
        log_auth('first_admin_code', code=code)


@app.route('/auth', methods=['POST'])
def authenticate():
    data = request.get_json(silent=True) or {}
    code = data.get('code')
    telegram_data = data.get('telegram_user')

    log_auth('auth_called', code=code, has_tg=bool(telegram_data))

    if not telegram_data or not telegram_data.get('id'):
        log_auth('auth_no_tg', code=code, telegram_data=telegram_data)
        return jsonify({'success': False, 'message': 'Нет данных Telegram'}), 400

    # If user already exists, auto-login without code
    tg_id = str(telegram_data['id'])
    existing_user = User.query.filter_by(telegram_id=tg_id).first()
    if existing_user:
        log_auth('auth_existing_user', tg_id=tg_id)
        return jsonify({
            'success': True,
            'is_admin': existing_user.is_admin,
            'user': existing_user.to_dict(),
            'auto': True
        })
    
    # Validate one-time code
    one_time_code = OneTimeCode.query.filter_by(code=code).first()
    if not one_time_code or one_time_code.used_at:
        log_auth('auth_invalid_code', tg_id=tg_id, code=code, reason='not_found_or_used')
        return jsonify({'success': False, 'message': 'Код недействителен'})

    # Check code expiration (1 hour)
    if one_time_code.created_at < datetime.utcnow() - timedelta(hours=1):
        log_auth('auth_invalid_code', tg_id=tg_id, code=code, reason='expired')
        return jsonify({'success': False, 'message': 'Код недействителен'})
    
    # Create user
    new_user = User(
        telegram_id=tg_id,
        username=telegram_data.get('username'),
        first_name=telegram_data.get('first_name'),
        last_name=telegram_data.get('last_name'),
        is_admin=one_time_code.is_admin
    )
    db.session.add(new_user)
    db.session.commit()
    user_id = new_user.id

    log_auth('auth_created_user', tg_id=tg_id, user_id=user_id, is_admin=one_time_code.is_admin)
    
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

@app.route('/api/admin/user/set_tariff_until', methods=['POST'])
def admin_set_tariff_until():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    target_id = data.get('target_user_id')
    tariff_paid_until = data.get('tariff_paid_until')
    try:
        target_id = int(target_id)
    except Exception:
        return jsonify({'error': 'Bad user id'}), 400
    user = User.query.get(target_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if tariff_paid_until:
        try:
            user.tariff_paid_until = datetime.fromisoformat(tariff_paid_until)
        except Exception:
            return jsonify({'error': 'Bad date'}), 400
    else:
        user.tariff_paid_until = None
    user.tariff_next_charge_at = user.tariff_paid_until
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

@app.route('/api/configs/update_name', methods=['POST'])
def user_config_update_name():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.json or {}
    config_id = data.get('config_id')
    name = (data.get('name') or '').strip() or 'Config'
    try:
        config_id = int(config_id)
    except Exception:
        return jsonify({'error': 'Bad config id'}), 400
    item = ConfigItem.query.get(config_id)
    if not item or item.user_id != user.id:
        return jsonify({'error': 'Not found'}), 404
    item.name = name
    db.session.commit()
    return jsonify({'ok': True, 'name': name})

@app.route('/api/admin/configs/update_name', methods=['POST'])
def admin_configs_update_name():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    config_id = data.get('config_id')
    name = (data.get('name') or '').strip() or 'Config'
    try:
        config_id = int(config_id)
    except Exception:
        return jsonify({'error': 'Bad config id'}), 400
    item = ConfigItem.query.get(config_id)
    if not item:
        return jsonify({'error': 'Not found'}), 404
    item.name = name
    db.session.commit()
    return jsonify({'ok': True, 'name': name})

@app.route('/api/topup/create', methods=['POST'])
def topup_create():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.json or {}
    amount = data.get('amount')
    try:
        amount = float(amount)
    except Exception:
        return jsonify({'error': 'Bad amount'}), 400
    if amount <= 0:
        return jsonify({'error': 'Bad amount'}), 400

    method = (data.get('method') or 'transfer').strip() or 'transfer'
    ticket = TopUpTicket(user_id=user.id, amount=amount, status='pending', method=method)
    db.session.add(ticket)
    db.session.commit()

    notify_admins_topup(ticket, user)
    db.session.commit()

    return jsonify({'ok': True, 'ticket': ticket.to_dict()})

@app.route('/api/topup/history', methods=['GET'])
def topup_history():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    items = TopUpTicket.query.filter_by(user_id=user.id).order_by(TopUpTicket.created_at.desc()).all()
    return jsonify([t.to_dict() for t in items])

@app.route('/api/admin/topup/history', methods=['POST'])
def admin_topup_history():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    target_id = data.get('target_user_id')
    try:
        target_id = int(target_id)
    except Exception:
        return jsonify({'error': 'Bad user id'}), 400
    items = TopUpTicket.query.filter_by(user_id=target_id).order_by(TopUpTicket.created_at.desc()).all()
    return jsonify([t.to_dict() for t in items])

@app.route('/api/admin/topup/act', methods=['POST'])
def admin_topup_act():
    admin = admin_required()
    if not admin:
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    ticket_id = data.get('ticket_id')
    action = data.get('action')
    try:
        ticket_id = int(ticket_id)
    except Exception:
        return jsonify({'error': 'Bad ticket id'}), 400

    ticket = TopUpTicket.query.get(ticket_id)
    if not ticket or ticket.status != 'pending':
        return jsonify({'error': 'Not found'}), 404

    if action == 'approve':
        apply_topup_action(ticket, admin, approve=True)
    elif action == 'reject':
        apply_topup_action(ticket, admin, approve=False)
    else:
        return jsonify({'error': 'Bad action'}), 400

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
    app.run(host='0.0.0.0', port=5000, debug=False)