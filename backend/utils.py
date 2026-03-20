import os
import hmac
import json
import secrets
import hashlib
import calendar
import logging
from datetime import datetime, timedelta
from urllib.parse import parse_qsl

from bot_setup import bot, BOT_TOKEN

LOG_PATH = os.path.join(os.path.dirname(__file__), 'auth_debug.log')
logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)


def log_auth(event, **fields):
    try:
        logging.info("%s | %s", event, fields)
    except Exception:
        pass


def add_months(dt: datetime, months: int) -> datetime:
    if not dt:
        return dt
    m = dt.month - 1 + months
    y = dt.year + m // 12
    m = m % 12 + 1
    d = min(dt.day, calendar.monthrange(y, m)[1])
    return dt.replace(year=y, month=m, day=d)


def send_bot_message(chat_id, text):
    if not BOT_TOKEN or not bot:
        return
    try:
        bot.send_message(chat_id, text)
    except Exception as e:
        log_auth('bot_send_error', chat_id=chat_id, error=str(e))


def send_bot_message_with_markup(chat_id, text, markup=None):
    if not BOT_TOKEN or not bot:
        return
    try:
        bot.send_message(chat_id, text, reply_markup=markup)
    except Exception as e:
        log_auth('bot_send_error', chat_id=chat_id, error=str(e))


def notify_admins_topup(ticket, user):
    from db import User
    admins = User.query.filter_by(is_admin=True).all()
    if not admins:
        return
    text = (
        f"Пользователь {user.first_name or ''} @{user.username or ''} отправил перевод на сумму "
        f"{ticket.amount:.2f} ₽. Откройте приложение для подтверждения."
    )
    for admin in admins:
        send_bot_message(admin.telegram_id, text)
    ticket.last_admin_notify_at = datetime.utcnow()


def apply_topup_action(ticket, admin_user, approve: bool):
    from db import db, User
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
                f"на сумму {ticket.amount:.2f} ₽ подтверждён админом "
                f"{admin_user.first_name or ''} @{admin_user.username or ''}."
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
                f"на сумму {ticket.amount:.2f} ₽ отклонён админом "
                f"{admin_user.first_name or ''} @{admin_user.username or ''}."
            ))


def verify_telegram_init_data(init_data: str, bot_token: str):
    """
    Verify Telegram WebApp initData using HMAC-SHA256.
    Returns user dict if valid, None otherwise.
    """
    if not init_data or not bot_token:
        return None
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = parsed.pop('hash', None)
        if not received_hash:
            return None

        # Reject stale data (older than 24 hours)
        auth_date = int(parsed.get('auth_date', 0))
        if datetime.utcnow().timestamp() - auth_date > 86400:
            log_auth('init_data_expired', auth_date=auth_date)
            return None

        data_check_string = '\n'.join(f'{k}={v}' for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b'WebAppData', bot_token.encode(), hashlib.sha256).digest()
        expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected_hash, received_hash):
            log_auth('init_data_invalid_hash')
            return None

        return json.loads(parsed.get('user', '{}'))
    except Exception as e:
        log_auth('init_data_verify_error', error=str(e))
        return None


def get_auth_user():
    from flask import session
    from db import User
    telegram_id = session.get('telegram_id')
    if not telegram_id:
        return None
    return User.query.filter_by(telegram_id=str(telegram_id)).first()


def admin_required():
    user = get_auth_user()
    if not user or not user.is_admin:
        return None
    return user


def ensure_first_admin_code():
    from db import db, OneTimeCode
    existing = OneTimeCode.query.filter_by(is_admin=True, used_at=None).first()
    if existing:
        print(f"FIRST TIME ADMIN CODE: {existing.code}")
        return
    code = secrets.token_urlsafe(8)
    new_code = OneTimeCode(code=code, is_admin=True)
    db.session.add(new_code)
    db.session.commit()
    print(f"FIRST TIME ADMIN CODE: {code}")
