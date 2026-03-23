import secrets
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, session

from db import db, User, OneTimeCode
from extensions import limiter
from utils import verify_telegram_init_data, get_auth_user, log_auth
from bot_setup import BOT_TOKEN

auth_bp = Blueprint('auth', __name__)


def _resolve_telegram_user(data: dict) -> tuple:
    """
    Extract Telegram user from request payload.

    Returns (user_dict, is_stored_only) where is_stored_only=True means
    the identity came only from localStorage (no live Telegram data).

    Priority:
    1. HMAC-verified initData          (most secure)
    2. telegram_user from initDataUnsafe (trusted live Telegram context)
    3. stored_telegram_id from localStorage (existing users re-auth only)
    """
    init_data      = (data.get('init_data') or '').strip()
    raw_tg_user    = data.get('telegram_user') or {}
    stored_tg_id   = data.get('stored_telegram_id')

    # 1. HMAC-verified initData
    if init_data and BOT_TOKEN:
        verified = verify_telegram_init_data(init_data, BOT_TOKEN)
        if verified and verified.get('id'):
            log_auth('auth_method', method='hmac_verified')
            return verified, False
        log_auth('auth_hmac_failed')

    # 2. Live telegram_user from initDataUnsafe
    if raw_tg_user and raw_tg_user.get('id'):
        log_auth('auth_method', method='tg_user_object')
        return raw_tg_user, False

    # 3. localStorage fallback — existing users only, no new registration
    if stored_tg_id:
        try:
            stored_tg_id = str(int(stored_tg_id))
            log_auth('auth_method', method='stored_id_fallback', tg_id=stored_tg_id)
            return {'id': stored_tg_id}, True
        except (TypeError, ValueError):
            pass

    return None, False


@auth_bp.route('/auth', methods=['POST'])
@limiter.limit("20 per minute")
def authenticate():
    data = request.get_json(silent=True) or {}
    code = (data.get('code') or '').strip()

    telegram_user, is_stored_only = _resolve_telegram_user(data)

    if not telegram_user or not telegram_user.get('id'):
        log_auth('auth_no_tg_data')
        return jsonify({'success': False, 'message': 'Откройте приложение из Telegram'}), 400

    tg_id = str(telegram_user['id'])

    # Auto-login for existing users
    existing_user = User.query.filter_by(telegram_id=tg_id).first()
    if existing_user:
        session['telegram_id'] = tg_id
        session.permanent = True
        log_auth('auth_auto_login', tg_id=tg_id, method='stored' if is_stored_only else 'tg')
        return jsonify({
            'success': True,
            'is_admin': existing_user.is_admin,
            'user': existing_user.to_dict(),
            'auto': True
        })

    # stored_telegram_id fallback cannot register new users — no Telegram identity
    if is_stored_only:
        return jsonify({'success': False, 'message': 'Откройте приложение через Telegram для входа'}), 400

    # New user — need a valid one-time code
    if not code:
        return jsonify({'success': False, 'message': 'Введите код доступа'})

    one_time_code = OneTimeCode.query.filter_by(code=code).first()
    if not one_time_code or one_time_code.used_at:
        log_auth('auth_invalid_code', tg_id=tg_id, reason='not_found_or_used')
        return jsonify({'success': False, 'message': 'Код недействителен'})

    if one_time_code.created_at < datetime.utcnow() - timedelta(hours=1):
        log_auth('auth_invalid_code', tg_id=tg_id, reason='expired')
        return jsonify({'success': False, 'message': 'Код недействителен'})

    new_user = User(
        telegram_id=tg_id,
        username=telegram_user.get('username'),
        first_name=telegram_user.get('first_name'),
        last_name=telegram_user.get('last_name'),
        is_admin=one_time_code.is_admin
    )
    db.session.add(new_user)
    one_time_code.used_at = datetime.utcnow()
    db.session.commit()

    session['telegram_id'] = tg_id
    session.permanent = True
    log_auth('auth_created_user', tg_id=tg_id, is_admin=one_time_code.is_admin)

    return jsonify({
        'success': True,
        'is_admin': one_time_code.is_admin,
        'user': new_user.to_dict()
    })


@auth_bp.route('/generate_code', methods=['POST'])
def generate_code():
    user = get_auth_user()
    if not user or not user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.json or {}
    is_admin = data.get('role') == 'admin'

    while True:
        code = secrets.token_urlsafe(6)
        if not OneTimeCode.query.filter_by(code=code).first():
            break

    new_code = OneTimeCode(code=code, is_admin=is_admin)
    db.session.add(new_code)
    db.session.commit()

    return jsonify({'code': code, 'role': 'admin' if is_admin else 'user'})
